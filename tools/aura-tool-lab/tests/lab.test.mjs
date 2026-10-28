import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PrivateStore } from '../private-store.mjs';
import { validCallback, restrictedFetch, ApyhubAuth, discover } from '../apyhub.mjs';
import { cases, checkResult, parseCsv } from '../cases.mjs';
import { redact, csv, unpack } from '../reports.mjs';
import { evaluate } from '../evaluate.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-tool-lab-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  // macOS /var is a symlink; production rejects ambiguous credential roots.
  return new PrivateStore(await fs.realpath(directory));
}

test('OAuth callbacks bind the code to the exact state and callback path', () => {
  assert.equal(validCallback(new URL('http://127.0.0.1/callback?state=abc&code=test'), 'abc'), true);
  for (const input of ['/callback?state=wrong&code=test', '/other?state=abc&code=test', '/callback?state=abc&state=abc&code=test', '/callback?state=abc&code=', '/callback?state=abc&code=test&error=denied']) assert.equal(validCallback(new URL(input, 'http://127.0.0.1'), 'abc'), false);
});

test('credential files are owner-only and refuse symlinks or broad permissions', async t => {
  const store = await temporary(t);
  await store.write('tokens.json', { access_token: 'synthetic-secret' });
  assert.equal((await fs.stat(store.directory)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(store.file('tokens.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await store.read('tokens.json'), { access_token: 'synthetic-secret' });
  await fs.chmod(store.file('tokens.json'), 0o644);
  await assert.rejects(store.read('tokens.json'), /Unsafe/);
  await fs.symlink(store.file('tokens.json'), store.file('linked.json'));
  await assert.rejects(store.read('linked.json'));
  await assert.rejects(store.write('linked.json', {}), /Unsafe/);
  assert.throws(() => store.file('../tokens.json'), /Invalid/);
});

test('redirected credential roots and non-Apyhub requests are rejected', async t => {
  const store = await temporary(t);
  await fs.symlink(store.directory, path.join(store.directory, 'alias'));
  await assert.rejects(new PrivateStore(path.join(store.directory, 'alias')).prepare(), /Unsafe/);
  for (const address of ['https://evil.invalid/', 'http://apyhub.com/', 'https://apyhub.com.evil.invalid/', 'https://name:password@apyhub.com/']) await assert.rejects(restrictedFetch(address), /Unapproved/);
  const auth = new ApyhubAuth(store, { redirectUrl: 'http://127.0.0.1:1234/callback' });
  await assert.rejects(auth.redirectToAuthorization(new URL('https://evil.invalid/oauth/authorize')), /Unapproved/);
  await assert.rejects(auth.redirectToAuthorization(new URL('https://apyhub.com/oauth/authorize')), /Login required/);
});

test('reports redact credentials recursively and escape spreadsheet formulas', () => {
  const raw = { token: 'hidden', body: { nested: 'hello SECRET', api_key: 'hidden' }, items: ['SECRET'] };
  assert.deepEqual(redact(raw, ['SECRET']), { token: '[REDACTED]', body: { nested: 'hello [REDACTED]', api_key: '[REDACTED]' }, items: ['[REDACTED]'] });
  assert.equal(csv([{ a: '=1+1', b: '"quoted"\nnext' }]), '"a","b"\n"\'=1+1","""quoted""\nnext"\n');
  assert.deepEqual(unpack({ content: [{ type: 'text', text: '{"data":false}' }] }), { data: false });
  assert.equal(unpack({ content: [{ type: 'text', text: 'a,b\n1,2' }] }), 'a,b\n1,2');
});

test('CSV semantic checks cover Danish characters, quotes, multiline fields and zero', () => {
  const jsonCase = cases.find(item => item.id === 'json-to-csv-danish');
  const good = 'navn,note,antal\r\n"Æble, grøn","Han sagde ""hej""",2\r\nØ-test,"linje 1\nlinje 2",0\r\n';
  assert.equal(checkResult(jsonCase, good), true);
  assert.equal(checkResult(jsonCase, 'antal,navn,note\n2,"Æble, grøn","Han sagde ""hej"""\n0,Ø-test,"linje 1\nlinje 2"'), true);
  assert.equal(checkResult(jsonCase, good.replace('Ø-test', 'O-test')), false);
  assert.equal(checkResult(jsonCase, good.replace(',0', ',')), false);
  assert.throws(() => parseCsv('a\n"unclosed'), /Unclosed/);
});

test('IBAN and diff success require correct meaning rather than an HTTP success', () => {
  const valid = cases[0], invalid = cases[1], diff = cases[2];
  assert.equal(checkResult(valid, { data: { valid: true, country_code: 'FR', iban: valid.args.body.iban } }), true);
  assert.equal(checkResult(valid, { data: { valid: false } }), false);
  assert.equal(checkResult(invalid, { data: false }), true);
  assert.equal(checkResult(invalid, { data: { valid: true } }), false);
  assert.equal(checkResult(diff, { data: { mode: 'line', diffs: [{ op: 'equal', text: 'unrelated' }], stats: { additions: 1, deletions: 1 } } }), false);
});

test('discovery follows pagination but rejects loops', async () => {
  let count = 0;
  assert.deepEqual(await discover({ listTools: async () => ++count === 1 ? { tools: [{ name: 'one' }], nextCursor: 'second' } : { tools: [{ name: 'two' }] } }), [{ name: 'one' }, { name: 'two' }]);
  await assert.rejects(discover({ listTools: async () => ({ tools: [], nextCursor: 'loop' }) }), /pagination/);
});

test('evaluation reserves quota before transmission, refuses duplicate runs and never retries', async t => {
  const store = await temporary(t), saved = []; let calls = 0;
  const client = { callTool: async request => {
    calls++;
    assert.equal((await store.read('evaluation-ledger.json')).attempts.length, 1);
    assert.equal(request.name, 'call_api');
    throw Object.assign(new Error('do-not-print-SECRET'), { name: 'TimeoutError' });
  } };
  const options = { store, now: () => new Date('2026-10-28T10:00:00Z'), save: async (_, value) => saved.push(value) };
  const result = await evaluate(client, ['iban-valid', 'iban-invalid'], options);
  assert.equal(calls, 1); assert.equal(result.length, 1); assert.equal(result[0].status, 'request_failed');
  assert.equal(JSON.stringify(saved).includes('SECRET'), false);
  await assert.rejects(evaluate(client, ['iban-valid'], options), /already attempted/);
  await assert.rejects(evaluate(client, ['unknown'], options), /Unknown/);
  await store.write('evaluation-ledger.json', { date: '2026-10-28', attempts: Array.from({ length: 5 }, (_, id) => ({ id: String(id), atoms: 5 })) });
  await assert.rejects(evaluate(client, ['iban-invalid'], options), /Daily evaluation limit/);
  assert.equal(calls, 1);
});

test('concurrent evaluators cannot consume quota twice', async t => {
  const store = await temporary(t); let release;
  const hold = new Promise(resolve => { release = resolve; });
  const client = { callTool: async () => { await hold; return { content: [{ type: 'text', text: '{"data":false}' }] }; } };
  const running = evaluate(client, ['iban-invalid'], { store, save: async () => {} });
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await store.read('evaluation-ledger.json'))?.attempts.length) break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  try { await assert.rejects(evaluate(client, ['iban-valid'], { store, save: async () => {} }), { code: 'EEXIST' }); }
  finally { release(); await running; }
});

test('real stdio MCP boundary exposes only local tools, never an API proxy', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL('../server.mjs', import.meta.url).pathname], stderr: 'pipe' });
  const client = new Client({ name: 'aura-lab-contract-test', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ['aura_lab_list_candidates', 'aura_json_to_csv', 'aura_csv_to_json', 'aura_text_diff', 'aura_validate_iban']);
    const result = await client.callTool({ name: 'aura_lab_list_candidates', arguments: {} });
    assert.equal(result.structuredContent.auraDesktopEnabled, false);
    assert.equal(result.structuredContent.candidates.length, 4);
    assert.equal((await client.callTool({ name: 'call_api', arguments: {} })).isError, true);
  } finally { await client.close(); }
});
