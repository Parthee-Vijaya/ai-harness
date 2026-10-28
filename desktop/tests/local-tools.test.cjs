const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const tools = require('../core/local-tools.cjs');
const { ApprovalsPolicy } = require('../core/approvals-policy.cjs');
const { Store } = require('../core/store.cjs');
const { OpenCodeEngine, permissions } = require('../core/engine.cjs');
const { startFakeProvider } = require('../scripts/fixtures/fake-provider.cjs');

async function fixture(t) {
  const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-local-tool-')));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'project'); await fs.mkdir(root);
  const store = new Store(path.join(base, 'profile'));
  return { base, root, policy: new ApprovalsPolicy(store), context: { projectRoot: root, workspaceRoot: root, mode: 'chat', conversationPermission: { active: true } } };
}
const permission = (args = { iban: 'FR7630006000011234567890189' }) => ({ id: 'per_local', permission: 'aura_validate_iban', patterns: ['Kontrollér IBAN-format · lokal behandling'], metadata: { localTool: { id: 'aura_validate_iban', version: '0.1.0', dataEgress: 'none', inputHash: tools.inputHash(args), inputBytes: Buffer.byteLength(JSON.stringify(args)) }, arguments: args }, toolInput: { tool: 'aura_validate_iban', input: args } });

test('local tools are explicit ask rules in every mode without enabling remote MCP', () => {
  for (const mode of ['chat', 'plan', 'free', 'build']) for (const id of tools.ids) assert.equal(permissions('/synthetic', [], mode)[id], 'ask');
  assert.equal(tools.ids.includes('call_api'), false);
});

test('local tool approvals bind input/version and never acquire persistent or YOLO authority', async t => {
  const { policy, context } = await fixture(t), p = permission();
  const result = await policy.allowed(context, p);
  assert.equal(result.allowed, false);
  assert.equal(result.descriptor.persistable, false);
  assert.equal(result.descriptor.projectFile, false);
  assert.equal(result.descriptor.match.inputHash, p.metadata.localTool.inputHash);
  await assert.rejects(policy.grant(context, p, { scope: 'project' }));
  const changed = structuredClone(p); changed.metadata.arguments.iban = 'different';
  assert.equal((await policy.describe(context, changed)).match, undefined);
  assert.notEqual((await policy.describe(context, changed)).fingerprint, result.descriptor.fingerprint);
  const wrong = structuredClone(p); wrong.metadata.localTool.version = 'untrusted';
  assert.equal((await policy.describe(context, wrong)).match, undefined);
  const wrongTool = structuredClone(p); wrongTool.toolInput.tool = 'read';
  assert.equal((await policy.describe(context, wrongTool)).match, undefined);
});

test('trusted plugin writer refuses symlink entries and keeps unknown material', async t => {
  const { base } = await fixture(t), directory = path.join(base, 'plugin');
  await tools.writeTrustedAsset(directory);
  assert.equal((await fs.stat(path.join(directory, 'index.mjs'))).mode & 0o777, 0o600);
  await fs.writeFile(path.join(directory, 'unknown.txt'), 'preserve');
  await assert.rejects(tools.writeTrustedAsset(directory));
  assert.equal(await fs.readFile(path.join(directory, 'unknown.txt'), 'utf8'), 'preserve');
});

const skip = process.env.AURA_ENGINE_NATIVE === '1' ? false : 'Set AURA_ENGINE_NATIVE=1 for the pinned real engine';
test('native tool invocation waits for exact approval; rejection and Stop never execute', { skip, timeout: 120_000 }, async t => {
  for (const action of ['allow', 'reject', 'stop']) await t.test(action, async t => {
    const { base, root, policy, context } = await fixture(t);
    const provider = await startFakeProvider({ synthetic: true, script: [{ text: '', toolCalls: [{ id: 'local_fixture', name: 'aura_validate_iban', arguments: JSON.stringify({ iban: 'FR7630006000011234567890189' }) }] }, { text: 'LOCAL_DONE' }] });
    const events = [];
    const model = { npm: '@ai-sdk/openai-compatible', name: 'Synthetic', options: { baseURL: provider.url, apiKey: provider.key }, models: { [provider.model]: { name: 'Synthetic', tool_call: true, limit: { context: 32768, output: 1024 } } } };
    const engine = new OpenCodeEngine({ root, directory: path.join(base, 'engine'), mode: 'chat', provider: model, model: { id: provider.model }, onEvent: e => events.push(e) });
    try {
      await engine.start(); await engine.send('Synthetic local tool test.', 'Only use the fixed fixture.');
      const end = Date.now() + 20_000;
      while (!engine.pending.size && Date.now() < end) await delay(10);
      assert.equal(engine.pending.size, 1);
      const request = [...engine.pending.values()][0];
      const part = [...engine.adapter.tools.values()].find(part => part.callID === request.tool.callID);
      const p = { ...request, toolInput: { ...part.state.input, tool: part.tool, input: part.state.input } };
      const descriptor = await policy.describe(context, p);
      assert.ok(descriptor.match); assert.equal(descriptor.persistable, false);
      assert.equal(provider.requests.length, 1, 'No result has reached the model before approval');
      assert.equal(part.state.status, 'running');
      if (action === 'stop') await engine.abort(); else await engine.reply(request.id, action === 'allow');
      while (action !== 'stop' && !events.some(e => ['session.idle', 'session.error', 'engine.error'].includes(e.type)) && Date.now() < end) await delay(10);
      const completed = [...engine.adapter.tools.values()].filter(part => part.state.status === 'completed');
      assert.equal(completed.length, action === 'allow' ? 1 : 0);
      if (action === 'allow') { assert.equal(JSON.parse(completed[0].state.output).data.valid, true); assert.equal(provider.requests.length, 2); }
      else assert.equal(provider.requests.length, 1);
      await assert.rejects(engine.reply(request.id, true), /Ingen|udløbet|findes|afsluttet|answered|pending/i);
    } finally { await engine.close(); await provider.close(); }
  });
});
