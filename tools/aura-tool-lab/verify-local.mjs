import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { cases, checkResult, localCase } from './cases.mjs';
import { csv } from './reports.mjs';
import { localManifest } from './local-tools.mjs';

const directory = path.resolve('reports'); await fs.mkdir(directory, { recursive: true });
const client = new Client({ name: 'aura-local-comparison', version: '0.1.0' }, { capabilities: {} });
const transport = new StdioClientTransport({ command: process.execPath, args: [new URL('./server.mjs', import.meta.url).pathname], stderr: 'pipe' });
const results = [];
try {
  await client.connect(transport);
  for (const fixture of cases) {
    const mapped = localCase(fixture), started = performance.now();
    const response = await client.callTool({ name: mapped.name, arguments: mapped.args });
    const passed = !response.isError && checkResult(fixture, mapped.normalize(response.structuredContent));
    results.push({ caseId: fixture.id, tool: mapped.name, status: passed ? 'passed' : 'failed', latencyMs: Math.round(performance.now() - started), response: response.structuredContent });
  }
} finally { await client.close(); }
const payload = { checkedAt: new Date().toISOString(), boundary: 'real-stdio-mcp-process', additionalExternalCalls: 0, desktopIntegration: 'trusted-native-plugin', results };
await fs.writeFile(path.join(directory, 'local-comparison.json'), JSON.stringify(payload, null, 2));
await fs.writeFile(path.join(directory, 'local-comparison.csv'), csv(results.map(({ caseId, tool, status, latencyMs }) => ({ caseId, tool, status, latencyMs }))));
await fs.writeFile(new URL('./manifest.json', import.meta.url), JSON.stringify({ schemaVersion: 1, package: '@aura/tool-lab', version: '0.1.0', tools: localManifest }, null, 2) + '\n');
console.log(JSON.stringify({ results: results.map(({ caseId, tool, status }) => ({ caseId, tool, status })), additionalExternalCalls: 0 }));
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
