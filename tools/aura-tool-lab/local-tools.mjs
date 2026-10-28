import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { diffChars, diffWordsWithSpace, diffLines } from 'diff';
import { isValidIBAN, isSEPACountry } from 'ibantools';
import { z } from 'zod';

// Pure in-memory functions: no filesystem, URLs, provider credentials or fetch.
export const limits = { inputBytes: 256 * 1024, rows: 10_000, columns: 200, diffTimeoutMs: 250 };
const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const columnName = z.string().regex(/^(?!(?:__proto__|constructor|prototype)$)[\s\S]+$/);
const row = z.record(columnName, cell);
const delimiter = z.enum([',', ';', '\t']).default(',');
const boundedText = z.string().max(limits.inputBytes);
const schemas = {
  aura_json_to_csv: z.object({ rows: z.array(row).min(1).max(limits.rows), delimiter, spreadsheetSafe: z.boolean().default(true) }).strict(),
  aura_csv_to_json: z.object({ csv: boundedText.min(1), delimiter }).strict(),
  aura_text_diff: z.object({ text1: boundedText, text2: boundedText, mode: z.enum(['char', 'word', 'line']).default('word') }).strict(),
  aura_validate_iban: z.object({ iban: z.string().min(1).max(80) }).strict()
};
const outputs = {
  aura_json_to_csv: z.object({ csv: z.string(), columns: z.array(z.string()), count: z.number().int().nonnegative(), spreadsheetSafe: z.boolean(), escapedCells: z.number().int().nonnegative() }).strict(),
  aura_csv_to_json: z.object({ data: z.array(z.record(z.string(), z.string())), columns: z.array(z.string()), count: z.number().int().nonnegative() }).strict(),
  aura_text_diff: z.object({ data: z.object({ mode: z.enum(['char', 'word', 'line']), diffs: z.array(z.object({ op: z.enum(['equal', 'insert', 'delete']), text: z.string() }).strict()), stats: z.object({ additions: z.number().int().nonnegative(), deletions: z.number().int().nonnegative(), unchanged: z.number().int().nonnegative() }).strict() }).strict(), counting: z.string() }).strict(),
  aura_validate_iban: z.object({ data: z.union([z.literal(false), z.object({ valid: z.literal(true), iban: z.string(), bban: z.string(), country_code: z.string(), sepa_country: z.boolean(), printable_format: z.string() }).strict()]), validationScope: z.literal('structure-and-checksum'), accountExistenceVerified: z.literal(false) }).strict()
};
function bounded(value) { if (Buffer.byteLength(JSON.stringify(value), 'utf8') > limits.inputBytes) throw new Error('Input exceeds 256 KiB'); }
function safeCell(value) { return typeof value === 'string' && /^[=+@\-\t\r\n\uFF1D\uFF0B\uFF0D\uFF20]/u.test(value) ? `'${value}` : value; }

function jsonToCsv({ rows, delimiter, spreadsheetSafe }) {
  const headers = [...new Set(rows.flatMap(item => Object.keys(item)))];
  if (!headers.length || headers.length > limits.columns || headers.some(key => !key.trim())) throw new Error('Use 1–200 non-empty column names');
  const values = [headers, ...rows.map(item => headers.map(key => Object.hasOwn(item, key) ? item[key] : null))];
  let escapedCells = 0;
  const output = spreadsheetSafe ? values.map(values => values.map(value => { const safe = safeCell(value); if (safe !== value) escapedCells++; return safe; })) : values;
  return { csv: stringify(output, { delimiter, record_delimiter: '\r\n', quoted_match: /[\r\n]/, cast: { boolean: value => String(value) } }), columns: headers, count: rows.length, spreadsheetSafe, escapedCells };
}
function csvToJson({ csv, delimiter }) {
  let values;
  try { values = parse(csv, { delimiter, bom: true, skip_empty_lines: true, max_record_size: limits.inputBytes, to: limits.rows + 2 }); }
  catch { throw new Error('Invalid CSV: check quotes, delimiter and column counts'); }
  const [headers, ...rows] = values;
  if (!headers?.length || headers.length > limits.columns || headers.some(key => !key.trim() || !columnName.safeParse(key).success) || new Set(headers).size !== headers.length) throw new Error('Use unique, non-empty column names without reserved object keys');
  if (rows.length > limits.rows) throw new Error('CSV exceeds 10000 rows');
  return { data: rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index]]))), columns: headers, count: rows.length };
}
function textDiff({ text1, text2, mode }) {
  const compare = { char: diffChars, word: diffWordsWithSpace, line: diffLines }[mode];
  const changes = compare(text1, text2, { timeout: limits.diffTimeoutMs, maxEditLength: 10_000 });
  if (!changes) throw new Error('Diff exceeded its time or change limit');
  const stats = { additions: 0, deletions: 0, unchanged: 0 };
  const diffs = changes.map(part => {
    const op = part.added ? 'insert' : part.removed ? 'delete' : 'equal';
    stats[part.added ? 'additions' : part.removed ? 'deletions' : 'unchanged'] += part.count;
    return { op, text: part.value };
  });
  return { data: { mode, diffs, stats }, counting: mode === 'word' ? 'Words, punctuation and whitespace tokens are counted separately.' : `${mode} units` };
}
function validateIban({ iban }) {
  const value = iban.replace(/ /g, '').toUpperCase();
  const valid = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(value) && isValidIBAN(value);
  return { data: valid ? { valid: true, iban: value, bban: value.slice(4), country_code: value.slice(0, 2), sepa_country: isSEPACountry(value.slice(0, 2)), printable_format: value.match(/.{1,4}/g).join(' ') } : false, validationScope: 'structure-and-checksum', accountExistenceVerified: false };
}

const execute = { aura_json_to_csv: jsonToCsv, aura_csv_to_json: csvToJson, aura_text_diff: textDiff, aura_validate_iban: validateIban };
export const toolDefinitions = [
  { name: 'aura_json_to_csv', title: 'JSON til CSV', description: 'Konvertér flade JSON-rækker til CSV i hukommelsen. Bevarer rækkefølge og danske tegn. Formellignende tekstceller beskyttes som standard; escapedCells angiver ændringerne.' },
  { name: 'aura_csv_to_json', title: 'CSV til JSON', description: 'Læs CSV med komma, semikolon eller tabulator, danske tegn, citationstegn og linjeskift. Alle celleværdier bevares som tekst; dublerede kolonnenavne afvises.' },
  { name: 'aura_text_diff', title: 'Sammenlign tekst', description: 'Sammenlign to tekster på tegn-, ord- eller linjeniveau. Returnerer ændringer, der kan genskabe begge originaltekster. Højst 256 KiB input og 250 ms beregning.' },
  { name: 'aura_validate_iban', title: 'Kontrollér IBAN-format', description: 'Kontrollér IBAN-struktur og kontrolcifre lokalt. Dokumenterer ikke, om kontoen findes eller hvem der ejer den.' }
].map(definition => ({ ...definition, schema: schemas[definition.name], outputSchema: outputs[definition.name], version: '0.1.0', execution: 'local', dataEgress: 'none', filesystem: 'none', maxInputBytes: limits.inputBytes }));

export const localManifest = toolDefinitions.map(({ schema, outputSchema, ...metadata }) => ({ ...metadata, inputSchema: z.toJSONSchema(schema), outputSchema: z.toJSONSchema(outputSchema) }));

export function validateLocal(name, input) {
  const definition = toolDefinitions.find(item => item.name === name);
  if (!definition) throw new Error('Unknown local tool');
  bounded(input);
  const parsed = definition.schema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid tool arguments');
  return parsed.data;
}
export function invokeLocal(name, input) {
  const parsed = validateLocal(name, input);
  const definition = toolDefinitions.find(item => item.name === name);
  return definition.outputSchema.parse(execute[name](parsed));
}
