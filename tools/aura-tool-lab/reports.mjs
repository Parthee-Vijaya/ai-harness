import fs from 'node:fs/promises';
import path from 'node:path';
import { PrivateStore } from './private-store.mjs';

const sensitive = /(?:token|secret|password|authorization|cookie|api[_-]?key|code_verifier)/i;
export function redact(value, secrets = []) {
  if (typeof value === 'string') return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join('[REDACTED]'), value);
  if (Array.isArray(value)) return value.map(item => redact(item, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item, secrets)]));
  return value;
}
export function unpack(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.filter(item => item.type === 'text').map(item => item.text).join('\n');
  try { return JSON.parse(text); } catch { return text || ''; }
}
export async function report(name, value) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid report name');
  const directory = path.resolve('reports'); await fs.mkdir(directory, { recursive: true });
  const tokens = await new PrivateStore().read('tokens.json');
  const clean = redact(value, [tokens?.access_token, tokens?.refresh_token]);
  const file = path.join(directory, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(clean, null, 2), { mode: 0o600 });
  return { file, data: clean };
}
export function csv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const cell = value => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  return [keys, ...rows.map(row => keys.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\n') + '\n';
}
