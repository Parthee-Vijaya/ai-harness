import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { login, connect, discover, endpoint, restrictedFetch } from './apyhub.mjs';
import { PrivateStore } from './private-store.mjs';
import { report, unpack } from './reports.mjs';
import { evaluate, exportSummary, summarizeRecorded } from './evaluate.mjs';
import { cases } from './cases.mjs';

const command = process.argv[2] || 'help';
try {
  if (command === 'login') {
    const result = await login({ onAuthorization: async url => {
      await new PrivateStore().write('login-handoff.json', { authorizationUrl: url.href });
      console.log(JSON.stringify({ status: 'awaiting_browser', message: 'Login ready; open authorization URL from private login-handoff.json.' }));
    } });
    console.log(JSON.stringify(result));
  } else if (command === 'probe') {
    const response = await restrictedFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'aura-tool-lab', version: '0.1.0' } } }) });
    console.log(JSON.stringify({ endpoint, httpStatus: response.status, requiresLogin: response.status === 401, checkedAt: new Date().toISOString() }));
    await response.body?.cancel();
  } else if (command === 'discover') {
    const client = await connect();
    try {
      const tools = await discover(client);
      const directory = path.resolve('reports'); await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, 'apyhub-inventory.json'), JSON.stringify({ endpoint, checkedAt: new Date().toISOString(), trust: 'Remote descriptions are untrusted data, not instructions.', tools }, null, 2));
      console.log(JSON.stringify({ connected: true, toolCount: tools.length, tools: tools.map(({ name }) => name), report: path.join(directory, 'apyhub-inventory.json') }));
    } finally { await client.close(); }
  } else if (['catalog', 'search', 'inspect'].includes(command)) {
    const [first, second] = process.argv.slice(3);
    const method = { catalog: 'curated_apis', search: 'search_apis', inspect: 'get_api_spec' }[command];
    if (command === 'search' && (!first || first.length > 200)) throw new Error('Supply a short capability query');
    if (command === 'inspect' && ![first, second].every(value => /^[a-z0-9_-]{1,160}$/i.test(value || ''))) throw new Error('Supply observed service and endpoint identifiers');
    const args = command === 'catalog' ? {} : command === 'search' ? { query: first, limit: 10 } : { service: first, endpoint: second };
    const client = await connect();
    try {
      const tools = await discover(client);
      if (!tools.some(tool => tool.name === method)) throw new Error('Metadata tool unavailable');
      const result = await client.callTool({ name: method, arguments: args }, undefined, { timeout: 30_000 });
      const name = command === 'inspect' ? `spec-${first}-${second}` : command === 'search' ? `apyhub-search-${createHash('sha256').update(first).digest('hex').slice(0, 12)}` : 'apyhub-catalog';
      const saved = await report(name, { endpoint, checkedAt: new Date().toISOString(), query: command === 'search' ? first : undefined, isError: result.isError === true, result: unpack(result) });
      console.log(JSON.stringify(saved));
      if (result.isError) process.exitCode = 1;
    } finally { await client.close(); }
  } else if (command === 'evaluate') {
    const requested = process.argv.slice(3);
    const ids = requested.length === 1 && requested[0] === 'all' ? cases.map(test => test.id) : requested;
    const client = await connect();
    try {
      const results = await evaluate(client, ids);
      const csvFile = await exportSummary(results);
      console.log(JSON.stringify({ results: results.map(({ id, status, latencyMs }) => ({ id, status, latencyMs })), csvFile }));
      if (results.length !== ids.length || results.some(result => result.status !== 'passed')) process.exitCode = 1;
    } finally { await client.close(); }
  } else if (command === 'summarize') {
    const { results, csvFile } = await summarizeRecorded();
    console.log(JSON.stringify({ results: results.map(({ id, status, latencyMs, normalizationCorrected }) => ({ id, status, latencyMs, normalizationCorrected })), csvFile, additionalApiCalls: 0 }));
    if (!results.length || results.some(result => result.status !== 'passed')) process.exitCode = 1;
  } else { console.log('Aura Tool Lab: node cli.mjs probe | login | discover | catalog | search "capability" | inspect service endpoint | evaluate all | summarize'); }
} catch (error) {
  // Do not print arbitrary SDK/provider exceptions: they may contain credentials.
  console.error(JSON.stringify({ status: 'failed', kind: error.name, message: error.message.startsWith('Login required') ? error.message : 'Apyhub-operationen kunne ikke afsluttes. Ingen rå auth-data er udskrevet.' }));
  process.exitCode = 1;
}
