const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { permissions, createReadGuard, OpenCodeEngine } = require('../core/engine.cjs');
const { nativePermissions } = require('../core/engine-opencode2.cjs');
const protectedPaths = require('../core/protected-paths.cjs');
const { startFakeProvider } = require('../scripts/fixtures/fake-provider.cjs');
const { observeEngine } = require('../scripts/fixtures/opencode-contract.cjs');

test('only the exact canonical project-root resource overrides the trailing-dot read deny', () => {
  for (const mode of ['chat', 'plan', 'free']) {
    const permission = permissions('/synthetic/project', [], mode);
    const rules = nativePermissions(permission).filter(rule => rule.action === 'read');
    assert.deepEqual(rules.at(-1), { action: 'read', resource: '.', effect: 'allow' });
    assert.deepEqual(rules.filter(rule => rule.effect === 'deny').map(rule => rule.resource), protectedPaths.toOpenCodeGlobs());
    assert.deepEqual(rules.filter(rule => rule.effect === 'allow').map(rule => rule.resource), ['*', '.']);
    assert.equal(permission.external_directory['*'], 'ask', 'Outside paths retain their independent approval');
    assert.notEqual(permission.edit?.['.'], 'allow', 'Directory reads grant no mutation authority');
  }
});

test('canonical project-root spellings remain ordinary, while protected roots and portable aliases stay blocked', async t => {
  const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-root-guard-')));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'project');
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  const read = async (name, project = root) => {
    const output = { args: { filePath: name } };
    await createReadGuard({ fs, path, root: project })({ tool: 'read' }, output);
    return output.args.filePath;
  };
  for (const name of ['.', './', root, path.join(root, 'public', '..')]) assert.equal(await read(name), root);
  for (const name of ['bad.', 'bad. ', '.ENV', '.git', 'references', '.git::$DATA', 'public/credentials.json'])
    await assert.rejects(read(name), /Aura beskytter/, name);
  for (const name of ['bad.', '.env', '.git', 'references'])
    await assert.rejects(read('.', path.join(base, name)), /Aura beskytter/, 'A root exception cannot bypass the realpath guard: ' + name);
});

const nativeSkip = process.env.AURA_ENGINE_NATIVE !== '1'
  ? 'Set AURA_ENGINE_NATIVE=1 with the prepared pinned runtime.'
  : process.platform !== 'darwin' ? 'Native symlink and portable-name contract is qualified on macOS only.' : false;

test('pinned engine reads project roots and ordinary aliases without opening protected files or external directories', { skip: nativeSkip, timeout: 120000 }, async t => {
  for (const mode of ['plan', 'free']) await t.test(mode, async () => {
    const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-native-root-read-')));
    const root = path.join(base, 'project');
    const files = { 'public/index.html': 'SYNTHETIC_PUBLIC', '.env': 'SYNTHETIC_PRIVATE', '.git/config': 'SYNTHETIC_PRIVATE', 'references/selected.txt': 'SYNTHETIC_SELECTED', 'references/private.txt': 'SYNTHETIC_PRIVATE', 'bad./file.txt': 'SYNTHETIC_PRIVATE' };
    for (const [name, content] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fs.writeFile(path.join(root, name), content);
    }
    await fs.mkdir(path.join(base, 'outside'));
    await fs.writeFile(path.join(base, 'outside', 'file.txt'), 'SYNTHETIC_EXTERNAL');
    for (const [name, target] of [['root-alias', root], ['file-alias', path.join(root, 'public/index.html')], ['private-alias', path.join(root, '.env')], ['reference-alias', path.join(root, 'references/private.txt')], ['outside-alias', path.join(base, 'outside')]])
      await fs.symlink(target, path.join(root, name));
    const cases = [
      { name: 'absolute-root', file: root, allowed: true },
      { name: 'relative-root', file: '.', allowed: true },
      { name: 'normalized-root', file: 'public/..', allowed: true },
      { name: 'symlink-root', file: 'root-alias', allowed: true },
      { name: 'nested-directory', file: 'public', allowed: true },
      { name: 'absolute-file', file: path.join(root, 'public/index.html'), allowed: true },
      { name: 'relative-file', file: 'public/index.html', allowed: true },
      { name: 'symlink-file', file: 'file-alias', allowed: true },
      { name: 'selected-reference', file: 'references/selected.txt', allowed: true },
      { name: 'trailing-dot', file: 'bad.' },
      { name: 'trailing-dot-descendant', file: 'bad./file.txt' },
      { name: 'private-file', file: '.env' },
      { name: 'private-case-alias', file: '.ENV' },
      { name: 'git-directory', file: '.git' },
      { name: 'git-file', file: '.git/config' },
      { name: 'references-directory', file: 'references' },
      { name: 'unselected-reference', file: 'references/private.txt' },
      { name: 'private-symlink', file: 'private-alias' },
      { name: 'reference-symlink', file: 'reference-alias' },
      { name: 'external-symlink', file: 'outside-alias', external: true },
    ];
    const model = await startFakeProvider({ synthetic: true, script: [
      ...cases.map(spec => ({ text: '', toolCalls: [{ id: 'call_' + spec.name, name: 'read', arguments: JSON.stringify({ path: spec.file }) }] })),
      { text: 'SYNTHETIC_ROOT_CONTRACT_DONE' },
    ] });
    const provider = { npm: '@ai-sdk/openai-compatible', name: 'Synthetic project-root contract', options: { baseURL: model.url, apiKey: model.key }, models: { [model.model]: { name: 'Synthetic', tool_call: true, limit: { context: 32768, output: 1024 } } } };
    const events = [], approvals = [];
    const engine = new OpenCodeEngine({ root, directory: path.join(base, 'engine'), mode, references: ['references/selected.txt'], provider, model: { id: model.model }, onEvent: event => events.push(event) });
    const observations = observeEngine(engine, { synthetic: true });
    try {
      await engine.start();
      await engine.send('SYNTHETIC_ROOT_READ_CONTRACT', 'Use only the fixed local synthetic fixture. Preserve every file and approval boundary.');
      const deadline = Date.now() + 45000;
      while (!events.some(event => ['session.idle', 'session.error', 'engine.error'].includes(event.type))) {
        assert.ok(Date.now() < deadline, 'Native read contract must terminate');
        for (const approval of [...engine.pending.values()]) {
          approvals.push(structuredClone(approval));
          await engine.reply(approval.id, false);
        }
        await delay(10);
      }
      const finished = observations.map(item => item.event).filter(event => event && ['session.tool.success', 'session.tool.failed'].includes(event.type));
      for (const spec of cases) {
        const matches = finished.filter(event => event.data.id === 'call_' + spec.name);
        assert.equal(matches.length, 1, spec.name + ' executes exactly once');
        assert.equal(matches[0].type, spec.allowed ? 'session.tool.success' : 'session.tool.failed', spec.name + ': ' + JSON.stringify(matches[0].data.error));
        if (!spec.allowed && !spec.external) assert.match(JSON.stringify(matches[0].data.error), /Aura beskytter/, spec.name + ' is refused by the unchanged realpath guard');
        assert.doesNotMatch(JSON.stringify(matches[0].data.content || []), /SYNTHETIC_PRIVATE|SYNTHETIC_EXTERNAL/, spec.name);
      }
      assert.equal(approvals.length, 1, 'Only the external symlink reaches review');
      assert.equal(approvals[0].permission, 'external_directory');
      assert.equal(model.requests.length, cases.length, 'The final explicit external denial stops before another model call');
      for (const [name, content] of Object.entries(files)) assert.equal(await fs.readFile(path.join(root, name), 'utf8'), content, 'Files remain unchanged: ' + name);
    } finally {
      await engine.close();
      await model.close();
      assert.ok(!engine.child || engine.child.exitCode !== null || engine.child.signalCode !== null, 'Owned engine has exited before removing synthetic fixtures');
      await fs.rm(base, { recursive: true, force: true });
    }
  });
});
