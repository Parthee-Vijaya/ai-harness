// Bevis for de versionslåste værktøjer i runtime-mappen: hver fil med størrelse, SHA-256 og kørselsret, og hvert
// link. Det er et byggebevis, ikke en signatur. Efter forslag i #39.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const assert = require('node:assert/strict');
const hash = value => createHash('sha256').update(value).digest('hex');

async function inventory(root) {
  const entries = new Map();
  async function visit(relative = '') {
    const directory = path.join(root, relative);
    for (const name of (await fs.readdir(directory)).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      if (key === 'manifest.json') continue;
      const file = path.join(root, key), before = await fs.lstat(file, { bigint: true });
      if (before.isSymbolicLink()) {
        const target = await fs.readlink(file), resolved = path.resolve(path.dirname(file), target);
        if (path.isAbsolute(target) || !resolved.startsWith(path.resolve(root) + path.sep)) throw Error('Runtime-link forlader pakken: ' + key);
        // Hele kæden følges, også links i overliggende mapper; et dødt link afvises.
        const real = await fs.realpath(file);
        if (!real.startsWith(await fs.realpath(root) + path.sep)) throw Error('Runtime-link forlader pakken: ' + key);
        entries.set(key, { type: 'link', target });
      } else if (before.isDirectory()) await visit(key);
      else if (before.isFile()) {
        const digest = createHash('sha256');
        for await (const chunk of createReadStream(file)) digest.update(chunk);
        const after = await fs.lstat(file, { bigint: true });
        if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some(field => before[field] !== after[field])) throw Error('Runtime-filen ændrede sig under kontrollen: ' + key);
        entries.set(key, { type: 'file', bytes: Number(before.size), sha256: digest.digest('hex'), executable: Boolean(before.mode & 0o111n) });
      } else throw Error('Ukendt runtime-filtype: ' + key);
    }
  }
  await visit();
  const payloads = Object.fromEntries(entries);
  return { schemaVersion: 1, entries: payloads, sha256: hash(JSON.stringify(payloads)) };
}

// De første filer, der er ændret, mangler eller er i overskud, så en fejl siger, hvad der afviger.
function difference(expected, actual) {
  const names = [...new Set([...Object.keys(expected.entries), ...Object.keys(actual.entries)])].sort();
  const lines = [];
  for (const name of names) {
    const before = expected.entries[name], after = actual.entries[name];
    if (!after) lines.push(`mangler: ${name}`);
    else if (!before) lines.push(`i overskud: ${name}`);
    else if (JSON.stringify(before) !== JSON.stringify(after)) lines.push(`ændret: ${name}`);
    if (lines.length === 5) break;
  }
  return lines.join(', ');
}

async function verifyRuntime(root, manifest, expected, lock, target, finalPayloads = null) {
  assert.equal(manifest.target, target, 'Forkert runtime-platform');
  assert.deepEqual(manifest.archives, lock.targets[target], 'Runtime-arkiverne afviger fra låsefilen');
  assert.deepEqual(manifest.sources || [], lock.sources || [], 'Runtime-kildearkiverne afviger fra låsefilen');
  assert.deepEqual(manifest.versions, { opencode: lock.opencode, git: lock.git, node: lock.node }, 'Runtime-versionerne afviger fra låsefilen');
  assert.equal(expected.payloads?.schemaVersion, 1, 'Forbered runtime igen med npm run runtime:prepare før pakning');
  assert.deepEqual(manifest.payloads, expected.payloads, 'Pakkens runtimebevis afviger fra den forberedte runtime');
  const actual = await inventory(root), wanted = finalPayloads || expected.payloads;
  if (actual.sha256 !== wanted.sha256) throw Error(`Runtime-payload er ændret, ufuldstændig eller har ekstra filer: ${difference(wanted, actual)}`);
  return { files: Object.keys(actual.entries).length, sha256: actual.sha256 };
}
// Licenserne i runtime-mappen er kopier af packaging/licenses. Er de rettet efter runtime:prepare, skal den køres igen.
async function verifyLicenses(licenses, manifest) {
  const expected = {};
  for (const name of (await fs.readdir(licenses)).filter(name => name !== '.DS_Store' && !name.startsWith('._'))) expected['licenses/' + name] = hash(await fs.readFile(path.join(licenses, name)));
  const actual = Object.fromEntries(Object.entries(manifest.payloads?.entries || {}).filter(([name]) => name.startsWith('licenses/')).map(([name, entry]) => [name, entry.sha256]));
  if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(actual).sort())) throw Error('Licenserne i den forberedte runtime afviger fra packaging/licenses. Kør npm run runtime:prepare igen.');
}
// De installerede pakker i node_modules skal være dem, package-lock.json låser; ellers kan pakken indeholde andre
// versioner end beviset viser. Valgfrie pakker til andre platforme mangler med rette.
async function verifyInstalled(root) {
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8')).packages || {};
  let hidden;
  try { hidden = JSON.parse(await fs.readFile(path.join(root, 'node_modules', '.package-lock.json'), 'utf8')).packages || {}; }
  catch { throw Error('node_modules mangler eller er ikke installeret med npm. Kør npm ci før pakning.'); }
  const differs = [];
  for (const [name, entry] of Object.entries(hidden)) if (!lock[name] || lock[name].version !== entry.version || lock[name].integrity !== entry.integrity) differs.push(name);
  for (const [name, entry] of Object.entries(lock)) if (name && !entry.optional && !entry.devOptional && !entry.os && !entry.cpu && !entry.link && !hidden[name]) differs.push(name);
  if (differs.length) throw Error(`node_modules svarer ikke til package-lock.json (${differs.slice(0, 3).join(', ')}). Kør npm ci før pakning.`);
}
module.exports = { inventory, verifyRuntime, difference, verifyLicenses, verifyInstalled };
