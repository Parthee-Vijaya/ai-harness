import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import contracts from './fixtures/contracts.json' with { type: 'json' };
import { invokeLocal, toolDefinitions, localManifest } from './local-tools.mjs';

// The future tool seam is deliberately local and contains no auth provider.
// An agent cannot turn this local server into an Apyhub API proxy.
export function createServer() {
  const server = new McpServer({ name: 'aura-tool-lab', version: '0.1.0' });
  server.registerTool('aura_lab_list_candidates', {
    title: 'Kandidater til Aura-tools',
    description: 'Vis de funktioner, der afprøves til egne Aura-tools. Returnerer kun kontraktmetadata; udfører ingen ekstern handling.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async () => {
    const data = { schemaVersion: 1, phase: 'desktop-integrated', desktopIntegration: 'trusted-native-plugin', standaloneServerInstalledByPackage: false, tools: localManifest, candidates: contracts.map(({ service, endpoint, provider, atoms }) => ({ id: service, referenceEndpoint: endpoint, referenceProvider: provider, listedAtoms: atoms })) };
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  });
  for (const definition of toolDefinitions) server.registerTool(definition.name, {
    title: definition.title, description: definition.description, inputSchema: definition.schema, outputSchema: definition.outputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }
  }, async input => {
    try {
      const result = invokeLocal(definition.name, input);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      // Validation-library exceptions may contain values; use a fixed fallback.
      return { isError: true, content: [{ type: 'text', text: error.name === 'ZodError' ? 'Tool output did not match its contract' : error.message }] };
    }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await createServer().connect(new StdioServerTransport());
