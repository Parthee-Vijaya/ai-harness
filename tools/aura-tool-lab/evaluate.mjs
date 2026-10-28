import fs from 'node:fs/promises';
import path from 'node:path';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { cases, checkResult } from './cases.mjs';
import { PrivateStore } from './private-store.mjs';
import { report, unpack, csv } from './reports.mjs';

export const contracts = JSON.parse(await fs.readFile(new URL('./fixtures/contracts.json', import.meta.url)));
const validator = new AjvJsonSchemaValidator();
const day = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export async function evaluate(client, ids, { store = new PrivateStore(), now = () => new Date(), save = report } = {}) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 5 || new Set(ids).size !== ids.length) throw new Error('Select one to five distinct fixed cases');
  const selected = ids.map(id => { const test = cases.find(test => test.id === id); if (!test) throw new Error('Unknown synthetic case'); return test; });
  // One owner-only lock across all processes: reserve before transmission, never retry.
  await store.prepare();
  const lockPath = path.join(store.directory, 'evaluation.lock');
  const lock = await fs.open(lockPath, 'wx', 0o600);
  const results = [];
  try {
    const date = day(now());
    let ledger = await store.read('evaluation-ledger.json') || { date, attempts: [] };
    if (ledger.date !== date) ledger = { date, attempts: [] };
    const estimatedAtoms = selected.reduce((total, test) => total + contracts.find(item => item.service === test.service && item.endpoint === test.endpoint).atoms, 0);
    if (ledger.attempts.length + selected.length > 5 || estimatedAtoms + ledger.attempts.reduce((sum, item) => sum + item.atoms, 0) > 200) throw new Error('Daily evaluation limit reached (5 API calls / 200 listed atoms)');
    if (selected.some(test => ledger.attempts.some(attempt => attempt.id === test.id))) throw new Error('Case already attempted today; no automatic retry');
    for (const test of selected) {
      const contract = contracts.find(item => item.service === test.service && item.endpoint === test.endpoint);
      if (!validator.getValidator(contract.inputSchema)(test.args).valid) throw new Error('Fixture does not match observed input schema');
      ledger.attempts.push({ id: test.id, atoms: contract.atoms, reservedAt: now().toISOString() });
      await store.write('evaluation-ledger.json', ledger);
      const started = performance.now(); let outcome;
      try {
        const raw = await client.callTool({ name: 'call_api', arguments: { service: test.service, endpoint: test.endpoint, args: test.args } }, undefined, { timeout: 45_000 });
        const value = unpack(raw);
        const schemaValid = validator.getValidator(contract.outputSchema)(value).valid;
        let semanticValid = false; try { semanticValid = checkResult(test, value); } catch { /* Report malformed content as failure. */ }
        outcome = { status: raw.isError ? 'provider_error' : schemaValid && semanticValid ? 'passed' : 'failed', schemaValid, semanticValid, response: value };
      } catch (error) { outcome = { status: 'request_failed', errorKind: error.name }; }
      const result = { id: test.id, service: test.service, endpoint: test.endpoint, input: test.args, provider: contract.provider, listedAtoms: contract.atoms, checkedAt: now().toISOString(), latencyMs: Math.round(performance.now() - started), ...outcome };
      await save(`case-${test.id}-${date}`, result); results.push(result);
      if (['request_failed', 'provider_error'].includes(result.status)) break;
    }
    await save(`evaluation-${date}`, { checkedAt: now().toISOString(), syntheticOnly: true, noAutomaticRetries: true, results });
    return results;
  } finally { await lock.close(); await fs.unlink(lockPath); }
}

export async function exportSummary(results) {
  const directory = path.resolve('reports'); await fs.mkdir(directory, { recursive: true });
  const rows = results.map(({ id, status, latencyMs, listedAtoms, schemaValid, semanticValid }) => ({ id, status, latencyMs, listedAtoms, schemaValid, semanticValid }));
  const file = path.join(directory, 'evaluation.csv'); await fs.writeFile(file, csv(rows)); return file;
}

export async function summarizeRecorded() {
  const directory = path.resolve('reports');
  const files = (await fs.readdir(directory)).filter(name => /^case-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const results = [];
  for (const file of files) {
    const observed = JSON.parse(await fs.readFile(path.join(directory, file)));
    const test = cases.find(test => test.id === observed.id);
    const contract = contracts.find(item => item.service === observed.service && item.endpoint === observed.endpoint);
    if (!test || !contract) continue;
    // Migration for the first lab recorder: retain original reports untouched.
    // MCP text content is the response itself when the endpoint returns text.
    const corrected = contract.outputSchema.type === 'string' && observed.response?.isError === false && typeof observed.response.text === 'string';
    const response = corrected ? observed.response.text : observed.response;
    const schemaValid = validator.getValidator(contract.outputSchema)(response).valid;
    let semanticValid = false; try { semanticValid = checkResult(test, response); } catch {}
    const status = ['request_failed', 'provider_error'].includes(observed.status) ? observed.status : schemaValid && semanticValid ? 'passed' : 'failed';
    results.push({ ...observed, response, status, schemaValid, semanticValid, originalStatus: observed.status, originalReport: file, revalidatedFromRecordedResponse: true, normalizationCorrected: corrected });
  }
  await report('evaluation-reviewed', { checkedAt: new Date().toISOString(), validationMode: 'recorded-response', additionalApiCalls: 0, results });
  return { results, csvFile: await exportSummary(results) };
}
