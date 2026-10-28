import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeLocal, toolDefinitions } from '../local-tools.mjs';
import { cases, checkResult, localCase } from '../cases.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('all five Apyhub evaluation fixtures also pass through local functions', () => {
  for (const fixture of cases) {
    const mapped = localCase(fixture);
    assert.equal(checkResult(fixture, mapped.normalize(invokeLocal(mapped.name, mapped.args))), true, fixture.id);
  }
});

test('all five fixtures pass through the actual MCP subprocess', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL('../server.mjs', import.meta.url).pathname], stderr: 'pipe' });
  const client = new Client({ name: 'aura-local-tool-test', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    for (const fixture of cases) {
      const mapped = localCase(fixture), response = await client.callTool({ name: mapped.name, arguments: mapped.args });
      assert.notEqual(response.isError, true);
      assert.equal(checkResult(fixture, mapped.normalize(response.structuredContent)), true, fixture.id);
    }
    assert.equal((await client.callTool({ name: 'aura_validate_iban', arguments: { iban: 'SECRET', remoteUrl: 'https://example.invalid' } })).isError, true);
  } finally { await client.close(); }
});

test('CSV export protects formula strings while preserving negative numbers, booleans and zero', () => {
  const result = invokeLocal('aura_json_to_csv', { rows: [{ formula: '=1+1', negative: -2, active: false, zero: 0 }] });
  assert.equal(result.escapedCells, 1);
  assert.equal(result.csv, 'formula,negative,active,zero\r\n\'=1+1,-2,false,0\r\n');
  assert.equal(invokeLocal('aura_json_to_csv', { rows: [{ formula: '=1+1' }], spreadsheetSafe: false }).escapedCells, 0);
});

test('CSV import rejects silent data loss from duplicate headers and inconsistent row widths', () => {
  for (const csv of ['name,name\na,b', 'name,age\na', 'name,age\na,1,extra', ',age\na,1', 'name\n"unclosed']) assert.throws(() => invokeLocal('aura_csv_to_json', { csv }));
  assert.deepEqual(invokeLocal('aura_csv_to_json', { csv: '\uFEFFname,age\r\nÆble,0\r\n' }).data, [{ name: 'Æble', age: '0' }]);
});

test('reserved object keys are rejected rather than silently dropped by schema parsers', () => {
  assert.throws(() => invokeLocal('aura_csv_to_json', { csv: '__proto__,constructor\nhello,world\n' }));
  assert.throws(() => invokeLocal('aura_json_to_csv', { rows: [JSON.parse('{"__proto__":"hello"}')] }));
  assert.equal({}.hello, undefined);
});

test('strict tool contracts reject nested rows, arbitrary paths, URLs and oversized input', () => {
  for (const [name, args] of [
    ['aura_json_to_csv', { rows: [{ nested: { a: 1 } }] }],
    ['aura_json_to_csv', { rows: [] }],
    ['aura_text_diff', { text1: 'x'.repeat(256 * 1024 + 1), text2: '' }],
    ['aura_text_diff', { text1: 'æ'.repeat(128 * 1024), text2: '' }],
    ['aura_csv_to_json', { csv: 'a\nx', filePath: '/etc/passwd' }],
    ['aura_validate_iban', { iban: 'test', url: 'https://example.invalid' }]
  ]) assert.throws(() => invokeLocal(name, args));
  assert.throws(() => invokeLocal('call_api', {}), /Unknown/);
  assert.equal(toolDefinitions.every(tool => tool.dataEgress === 'none' && tool.filesystem === 'none'), true);
});

test('IBAN normalization handles spaces and case without claiming account ownership', () => {
  const good = invokeLocal('aura_validate_iban', { iban: 'fr76 3000 6000 0112 3456 7890 189' });
  assert.equal(good.data.valid, true);
  assert.equal(good.accountExistenceVerified, false);
  assert.equal(good.validationScope, 'structure-and-checksum');
  assert.equal(invokeLocal('aura_validate_iban', { iban: 'FR76\n30006000011234567890189' }).data, false);
  assert.equal(invokeLocal('aura_validate_iban', { iban: 'ZZ7630006000011234567890189' }).data, false);
});

test('all diff modes reconstruct Unicode, whitespace and empty inputs exactly', () => {
  for (const mode of ['char', 'word', 'line']) for (const [text1, text2] of [['', ''], ['', 'Æble\n'], ['a\r\nb\n', 'a\nb\r\n'], ['👩‍💻 test æ', '👩‍💻 nyt ø']]) {
    const value = invokeLocal('aura_text_diff', { text1, text2, mode }).data;
    assert.equal(value.diffs.filter(item => item.op !== 'insert').map(item => item.text).join(''), text1);
    assert.equal(value.diffs.filter(item => item.op !== 'delete').map(item => item.text).join(''), text2);
  }
});
