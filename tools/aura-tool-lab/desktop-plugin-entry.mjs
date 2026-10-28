import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { invokeLocal, validateLocal, toolDefinitions } from './local-tools.mjs';

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = input => createHash('sha256').update(JSON.stringify(stable(input))).digest('hex');
const inputs = {
  aura_json_to_csv: Schema.Struct({ rows: Schema.Array(Schema.Unknown), delimiter: Schema.optionalKey(Schema.String), spreadsheetSafe: Schema.optionalKey(Schema.Boolean) }),
  aura_csv_to_json: Schema.Struct({ csv: Schema.String, delimiter: Schema.optionalKey(Schema.String) }),
  aura_text_diff: Schema.Struct({ text1: Schema.String, text2: Schema.String, mode: Schema.optionalKey(Schema.Literals(['char', 'word', 'line'])) }),
  aura_validate_iban: Schema.Struct({ iban: Schema.String })
};

export default { id: 'aura.local-tools', async setup(ctx) {
  // Validate raw input before the native schema can discard unknown fields.
  await ctx.tool.hook('execute.before', event => {
    if (Object.hasOwn(inputs, event.tool)) validateLocal(event.tool, event.input);
  });
  await ctx.tool.transform(editor => {
    for (const tool of toolDefinitions) editor.add({
      name: tool.name, description: `${tool.description} Lokal behandling uden fil- eller netværksadgang. Kræver godkendelse af hvert kald.`,
      options: { codemode: false }, input: inputs[tool.name], output: Schema.Unknown,
      async execute(input, context) {
        context.signal.throwIfAborted();
        validateLocal(tool.name, input);
        const snapshot = JSON.parse(JSON.stringify(input)), inputHash = digest(snapshot);
        await ctx.permission.assert({ sessionID: context.sessionID, agent: context.agent, action: tool.name,
          resources: [`${tool.title} · lokal behandling`],
          metadata: { description: `${tool.title} på denne computer. Ingen filer ændres. Resultatet følger samtalens dataregler.`,
            localTool: { id: tool.name, version: tool.version, inputHash, inputBytes: Buffer.byteLength(JSON.stringify(snapshot)), dataEgress: 'none' }, arguments: snapshot },
          source: { type: 'tool', messageID: context.messageID, id: context.id } });
        context.signal.throwIfAborted();
        if (digest(input) !== inputHash) throw new Error('Tool input changed after approval');
        const result = invokeLocal(tool.name, snapshot);
        context.signal.throwIfAborted();
        return { output: result, content: JSON.stringify(result), metadata: { localTool: { id: tool.name, version: tool.version, inputHash }, locality: 'device' } };
      }
    });
  });
} };
