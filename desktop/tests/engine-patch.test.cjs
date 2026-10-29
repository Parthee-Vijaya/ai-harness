const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventAdapter } = require('../core/engine-opencode2.cjs');
const { ApprovalsPolicy } = require('../core/approvals-policy.cjs');

const wire = (type, data) => ({ type, data });
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-v2-patch-')));
  await fs.mkdir(path.join(root, 'public'));
  await fs.writeFile(path.join(root, 'public/index.html'), 'before\n');
  await fs.writeFile(path.join(root, 'public/remove.css'), 'remove\n');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, context: { projectRoot: root, workspaceRoot: root, mode: 'build' }, policy: new ApprovalsPolicy({}) };
}
function approval(root, patchText, files, patterns = files.map(file => file.file)) {
  const adapter = new EventAdapter(root), d = { sessionID: 'ses_patch', assistantMessageID: 'msg_patch', id: 'call_patch' };
  adapter.normalize(wire('session.tool.input.started', { ...d, name: 'patch' }));
  const running = adapter.normalize(wire('session.tool.called', { ...d, input: { patchText } }))[0].properties.part;
  const event = adapter.normalize(wire('permission.asked', { id: 'per_patch', sessionID: d.sessionID, action: 'edit', resources: patterns, metadata: { filepath: patterns.join(', '), files }, source: { type: 'tool', messageID: d.assistantMessageID, id: d.id } }))[0];
  return { adapter, running, request: { ...event.properties, toolInput: { ...running.state.input, tool: running.tool } } };
}
const patch = root => `*** Begin Patch\n*** Update File: ${path.join(root, 'public/index.html')}\n@@\n-before\n+after\n*** Add File: ${path.join(root, 'public/new.js')}\n+new\n*** Delete File: ${path.join(root, 'public/remove.css')}\n*** End Patch`;
const files = () => [
  { file: 'public/index.html', status: 'modified', patch: '@@\n-before\n+after' },
  { file: 'public/new.js', status: 'added', patch: '@@\n+new' },
  { file: 'public/remove.css', status: 'deleted', patch: '@@\n-remove' },
];

test('V2 patch keeps raw input and call identity across events and restored history', () => {
  const root = '/synthetic/project', raw = patch(root), { adapter, running } = approval(root, raw, files());
  assert.equal(running.tool, 'apply_patch');
  assert.equal(running.state.input.patchText, raw);
  assert.equal(running.callID, 'call_patch');
  const restored = adapter.message({ id: 'msg_patch', type: 'assistant', content: [{ id: 'call_patch', name: 'patch', type: 'tool', state: { status: 'completed', input: { patchText: raw } } }] }, 'ses_patch');
  assert.equal(restored.parts[0].tool, 'apply_patch');
  assert.equal(restored.parts[0].state.input.patchText, raw);
});

test('V2 multifile patch metadata binds all changed paths without granting approval', async t => {
  const { root, context, policy } = await fixture(t), { request } = approval(root, patch(root), files());
  assert.deepEqual(request.metadata.files.map(file => file.type), ['update', 'add', 'delete']);
  assert.deepEqual(request.metadata.files.map(file => file.filePath), files().map(file => path.join(root, file.file)));
  const descriptor = await policy.describe(context, request);
  assert.equal(descriptor.projectFile, true);
  assert.deepEqual(descriptor.match.targets.map(target => target.path).sort(), files().map(file => path.join(root, file.file)).sort());
  assert.equal(descriptor.match.targets.every(target => target.subtree === false), true);
  assert.match(descriptor.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(request.reply, undefined);
});

test('V2 one-file patch preserves the exact display-list contract', async t => {
  const { root, context, policy } = await fixture(t), raw = `*** Begin Patch\n*** Update File: ${path.join(root, 'public/index.html')}\n@@\n-before\n+after\n*** End Patch`;
  const { request } = approval(root, raw, files().slice(0, 1));
  assert.equal(request.metadata.filepath, 'public/index.html');
  assert.equal((await policy.describe(context, request)).projectFile, true);
});

test('V2 pending single-file write and edit keep absolute targets before snapshot recovery', async t => {
  const { root, context, policy } = await fixture(t);
  for (const name of ['write', 'edit']) {
    const adapter = new EventAdapter(root);
    const request = adapter.normalize(wire('permission.asked', { id: 'per_recovered', sessionID: 'ses_patch', action: 'edit', resources: ['public/index.html'], metadata: { files: [{ file: 'public/index.html', patch: '@@\n-before\n+after' }] }, source: { messageID: 'msg_patch', id: 'call_patch' } }))[0].properties;
    assert.equal(request.metadata.filepath, path.join(root, 'public/index.html'));
    const restored = adapter.message({ id: 'msg_patch', type: 'assistant', content: [{ id: 'call_patch', name, type: 'tool', state: { status: 'running', input: { path: 'public/index.html', content: 'after\n' } } }] }, 'ses_patch').parts[0];
    const descriptor = await policy.describe(context, { ...request, toolInput: { ...restored.state.input, tool: restored.tool } });
    assert.equal(descriptor.projectFile, true);
    assert.deepEqual(descriptor.match.targets.map(target => target.path), [path.join(root, 'public/index.html')]);
  }
});

test('V2 recovered patch keeps live canonical targets and fingerprint after pending-before-snapshot', async t => {
  const { root, context, policy } = await fixture(t);
  for (const entries of [files().slice(0, 1), files()]) {
    const raw = entries.length === 1 ? `*** Begin Patch\n*** Update File: ${path.join(root, 'public/index.html')}\n@@\n-before\n+after\n*** End Patch` : patch(root);
    const live = approval(root, raw, entries), adapter = new EventAdapter(root), patterns = entries.map(file => file.file);
    const pending = adapter.normalize(wire('permission.asked', { id: 'per_patch', sessionID: 'ses_patch', action: 'edit', resources: patterns, metadata: { filepath: patterns.join(', '), files: entries }, source: { type: 'tool', messageID: 'msg_patch', id: 'call_patch' } }))[0].properties;
    assert.equal(pending.metadata.filepath, patterns.join(', '));
    const restored = adapter.message({ id: 'msg_patch', type: 'assistant', content: [{ id: 'call_patch', name: 'patch', type: 'tool', state: { status: 'running', input: { patchText: raw } } }] }, 'ses_patch').parts[0];
    const recovered = await policy.describe(context, { ...pending, toolInput: { ...restored.state.input, tool: restored.tool } });
    const original = await policy.describe(context, live.request);
    assert.equal(recovered.projectFile, true);
    assert.deepEqual(recovered.match.targets, original.match.targets);
    assert.equal(recovered.fingerprint, original.fingerprint);
  }
});

test('V2 patch cannot hide protected targets, unknown statuses or ambiguous files', async t => {
  const { root, context, policy } = await fixture(t);
  const cases = [
    [...files(), { file: 'public/.env', status: 'added' }],
    files().map((file, index) => index === 0 ? { ...file, status: 'renamed' } : file),
    files().map((file, index) => index === 0 ? { ...file, status: 'unknown' } : file),
    files().map((file, index) => index === 0 ? { ...file, file: '../outside.txt' } : file),
  ];
  for (const metadata of cases) assert.equal((await policy.describe(context, approval(root, patch(root), metadata).request)).projectFile, false);
});

test('V2 patch plan mode and fingerprint checks survive normalization', async t => {
  const { root, context, policy } = await fixture(t), { request } = approval(root, patch(root), files());
  const build = await policy.describe(context, request);
  const plan = await policy.describe({ ...context, mode: 'plan' }, request);
  assert.equal(plan.blockedMode, true);
  assert.equal(plan.persistable, false);
  const changed = structuredClone(request); changed.toolInput.patchText = changed.toolInput.patchText.replace('+after', '+different');
  assert.notEqual((await policy.describe(context, changed)).fingerprint, build.fingerprint);
  const mismatch = structuredClone(request); mismatch.patterns[0] = 'public/other.html';
  assert.equal((await policy.describe(context, mismatch)).projectFile, false);
});

test('V2 move metadata still binds both source and destination from the raw patch', async t => {
  const { root, context, policy } = await fixture(t);
  const raw = `*** Begin Patch\n*** Update File: ${path.join(root, 'public/index.html')}\n*** Move to: ${path.join(root, 'public/moved.html')}\n@@\n-before\n+after\n*** End Patch`;
  const { request } = approval(root, raw, [{ file: 'public/moved.html', status: 'modified' }], ['public/index.html', 'public/moved.html']);
  const descriptor = await policy.describe(context, request);
  assert.equal(descriptor.projectFile, true);
  assert.deepEqual(descriptor.match.targets.map(target => target.path).sort(), ['public/index.html', 'public/moved.html'].map(file => path.join(root, file)).sort());
  const changed = structuredClone(request); changed.toolInput.patchText = raw.replace('public/moved.html', 'public/.env');
  assert.equal((await policy.describe(context, changed)).projectFile, false);
});

test('native V2 patch applies add, delete and move only after exact project-target approval', { skip: process.env.AURA_ENGINE_NATIVE !== '1' ? 'Opt-in native OpenCode fixture; no external model calls' : false }, async t => {
  const { root, context, policy } = await fixture(t);
  const { OpenCodeEngine } = require('../core/engine.cjs');
  const { startFakeProvider } = require('../scripts/fixtures/fake-provider.cjs');
  const { setTimeout: delay } = require('node:timers/promises');
  const raw = `*** Begin Patch\n*** Update File: ${path.join(root, 'public/index.html')}\n*** Move to: ${path.join(root, 'public/moved.html')}\n@@\n-before\n+after\n*** Add File: ${path.join(root, 'public/new.js')}\n+new\n*** Delete File: ${path.join(root, 'public/remove.css')}\n*** End Patch`;
  const model = await startFakeProvider({ synthetic: true, model: 'gpt-6.1-sol', script: [{ text: '', toolCalls: [{ id: 'call_native_patch', name: 'patch', arguments: JSON.stringify({ patchText: raw }) }] }, { text: 'SYNTHETIC_PATCH_COMPLETE' }] });
  const provider = { npm: '@ai-sdk/openai-compatible', name: 'Synthetic patch contract', options: { baseURL: model.url, apiKey: model.key }, models: { [model.model]: { name: 'Synthetic', tool_call: true, limit: { context: 32768, output: 1024 } } } };
  const events = [], decisions = [];
  const engine = new OpenCodeEngine({ root, directory: path.join(root, 'runtime'), provider, model: { id: model.model }, onEvent: event => events.push(event) });
  try {
    await engine.start(); await engine.send('SYNTHETIC_PATCH_CONTRACT', 'Use only the controlled fixture.');
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !events.some(event => ['session.idle', 'session.error', 'engine.error'].includes(event.type))) {
      for (const request of engine.pending.values()) {
        const tool = [...engine.adapter.tools.values()].find(part => part.callID === request.tool.callID);
        const descriptor = await policy.describe(context, { ...request, toolInput: { ...tool.state.input, tool: tool.tool } });
        decisions.push(descriptor);
        await engine.reply(request.id, descriptor.projectFile === true && descriptor.match.targets.length === 4);
      }
      await delay(20);
    }
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].projectFile, true);
    assert.equal(model.requests.length, 2);
    assert.equal(events.some(event => event.type === 'session.idle'), true);
    assert.equal(await fs.readFile(path.join(root, 'public/moved.html'), 'utf8'), 'after\n');
    assert.equal(await fs.readFile(path.join(root, 'public/new.js'), 'utf8'), 'new\n');
    await assert.rejects(fs.stat(path.join(root, 'public/index.html')), { code: 'ENOENT' });
    await assert.rejects(fs.stat(path.join(root, 'public/remove.css')), { code: 'ENOENT' });
  } finally { await engine.close(); await model.close(); }
});
