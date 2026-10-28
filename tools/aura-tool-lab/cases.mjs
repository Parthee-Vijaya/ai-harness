// Only synthetic text/rows and the public IBAN example from Apyhub's docs.
// No file paths, contacts, uploads, arbitrary URLs or secrets are accepted here.
export const cases = [
  { id: 'iban-valid', service: 'validate-iban', endpoint: 'validate-an-iban', args: { body: { iban: 'FR7630006000011234567890189' } }, check: 'iban-valid' },
  { id: 'iban-invalid', service: 'validate-iban', endpoint: 'validate-an-iban', args: { body: { iban: 'FR0030006000011234567890189' } }, check: 'iban-invalid' },
  { id: 'text-diff-danish', service: 'compare-text-or-code-snippets', endpoint: 'compare-two-text-or-code-snippets', args: { body: { text1: 'Æbler til mødet.\nPris: 100 kr.\n', text2: 'Æbler og pærer til mødet.\nPris: 125 kr.\n', mode: 'line' } }, check: 'text-diff' },
  { id: 'json-to-csv-danish', service: 'json-to-csv', endpoint: 'convert-raw-json-body-to-csv-inline-resp', args: { body: [{ navn: 'Æble, grøn', note: 'Han sagde "hej"', antal: 2 }, { navn: 'Ø-test', note: 'linje 1\nlinje 2', antal: 0 }] }, check: 'json-to-csv' },
  { id: 'csv-to-json-danish', service: 'raw-csv-to-json', endpoint: 'convert-a-csv-string-to-a-json-array-of', args: { body: { csv: 'navn;note;antal\r\n"Æble; grøn";"Han sagde ""hej""";2\r\nØ-test;"linje 1\nlinje 2";0\r\n', delimiter: ';' } }, check: 'csv-to-json' }
];

export function localCase(test) {
  if (test.check.startsWith('iban-')) return { name: 'aura_validate_iban', args: test.args.body, normalize: value => value };
  if (test.check === 'text-diff') return { name: 'aura_text_diff', args: test.args.body, normalize: value => value };
  if (test.check === 'json-to-csv') return { name: 'aura_json_to_csv', args: { rows: test.args.body }, normalize: value => value.csv };
  return { name: 'aura_csv_to_json', args: test.args.body, normalize: value => value };
}

// Semantic assertions are independent of the vendor's response-schema check.
export function checkResult(test, value) {
  if (test.check === 'iban-valid') return value?.data?.valid === true && value.data.country_code === 'FR' && value.data.iban === test.args.body.iban;
  if (test.check === 'iban-invalid') return value?.data === false;
  if (test.check === 'text-diff') {
    const data = value?.data;
    if (data?.mode !== 'line' || !Array.isArray(data.diffs) || !data.diffs.length) return false;
    const original = data.diffs.filter(item => ['equal', 'delete'].includes(item.op)).map(item => item.text).join('');
    const updated = data.diffs.filter(item => ['equal', 'insert'].includes(item.op)).map(item => item.text).join('');
    return original === test.args.body.text1 && updated === test.args.body.text2 && data.stats?.additions > 0 && data.stats?.deletions > 0;
  }
  if (test.check === 'json-to-csv') {
    // Parse with a test-only reference CSV parser, never the candidate converter.
    if (typeof value !== 'string') return false;
    const rows = parseCsv(value);
    const [header, ...data] = rows;
    const keys = Object.keys(test.args.body[0]);
    if (!header || new Set(header).size !== keys.length || header.length !== keys.length || header.some(key => !keys.includes(key)) || data.length !== test.args.body.length) return false;
    return data.every((row, index) => row.length === header.length && row.every((value, column) => value === String(test.args.body[index][header[column]])));
  }
  if (test.check === 'csv-to-json') return value?.count === 2 && JSON.stringify(value.data) === JSON.stringify([{ navn: 'Æble; grøn', note: 'Han sagde "hej"', antal: '2' }, { navn: 'Ø-test', note: 'linje 1\nlinje 2', antal: '0' }]);
  return false;
}

// Small strict reference parser for these bounded fixtures, not a production tool.
export function parseCsv(text, separator = ',') {
  let field = '', row = [], rows = [], quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') { if (field || closed) throw new Error('Invalid CSV quote'); quoted = true; }
    else if (ch === separator) { row.push(field); field = ''; closed = false; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; closed = false; }
    else { if (closed) throw new Error('Unexpected CSV content'); field += ch; }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
