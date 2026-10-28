// SPDX-License-Identifier: EUPL-1.2
// A fixed app-owned plugin. No project configuration, external MCP or credentials.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const integrity = require('./local-tools-integrity.json');
const ids = Object.freeze(['aura_json_to_csv', 'aura_csv_to_json', 'aura_text_diff', 'aura_validate_iban']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const inputHash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function permissionBinding(p) {
  const info = p?.metadata?.localTool, args = p?.metadata?.arguments;
  if (!ids.includes(p?.permission) || info?.id !== p.permission || info.version !== integrity.version || info.dataEgress !== 'none' || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Ugyldigt lokalt toolkald.');
  if (inputHash(args) !== info.inputHash || Buffer.byteLength(JSON.stringify(args)) !== info.inputBytes || info.inputBytes > 256 * 1024) throw new Error('Toolkaldets data har ændret sig.');
  if (p.toolInput?.tool && (p.toolInput.tool !== info.id || inputHash(p.toolInput.input || {}) !== info.inputHash)) throw new Error('Toolkaldets data har ændret sig.');
  return { kind: p.permission, tool: info.id, version: info.version, inputHash: info.inputHash };
}
async function writeTrustedAsset(directory) {
  const source = await fs.readFile(path.join(__dirname, 'local-tools-plugin.mjs'), 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== integrity.sha256) throw new Error('De lokale tools matcher ikke den kontrollerede version.');
  await require('./engine-opencode2.cjs').writeTrustedPlugin(directory, source);
  if (createHash('sha256').update(await fs.readFile(path.join(directory, 'index.mjs'))).digest('hex') !== integrity.sha256) throw new Error('De lokale tools kunne ikke verificeres.');
}
module.exports = { ids, inputHash, permissionBinding, writeTrustedAsset };
