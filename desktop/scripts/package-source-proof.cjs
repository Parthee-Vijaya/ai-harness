// Kildebevis for en pakke: det commit, pakken er bygget fra, og SHA-256 for hver fil, der bestemmer pakkens indhold.
// Pakning kræver, at filerne er committet. Det er sporbarhed, ikke en signatur. Efter forslag i #39.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
// Byggescripts, som electron-builder kører under pakning og signering.
const BUILD_SCRIPTS = ['create-icon.cjs', 'package-source-proof.cjs', 'prepare-runtime.cjs', 'runtime-integrity.cjs', 'sign-mac.cjs', 'signed-runtime-proof.cjs'];

// Én fælles liste til pakning og kontrol: appkode, profiler, byggekonfiguration, entitlements og byggescripts.
async function productFiles(root) {
  const { files } = require('./verify-package-source.cjs');
  return [...new Set([
    'package.json', 'package-lock.json', 'runtime-lock.json', 'main.cjs', 'preload.cjs', 'electron-builder.cjs',
    ...BUILD_SCRIPTS.map(name => 'scripts/' + name),
    'packaging/entitlements.mac.plist', 'packaging/entitlements.node.mac.plist', 'packaging/icon.png',
    ...await files(path.join(root, 'packaging/licenses'), 'packaging/licenses/'),
    ...await files(path.join(root, 'core'), 'core/'), ...await files(path.join(root, 'ui'), 'ui/'),
    '../LICENSE', '../profiles/catalog.json', '../profiles/grundregler.md', '../profiles/gitignore.txt',
    ...await files(path.join(root, '../profiles/skills'), '../profiles/skills/')
  ])].sort();
}

async function sourceProof(root, names) {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const files = {}, changed = [];
  for (const name of [...new Set(names)].sort()) {
    const file = path.resolve(root, name);
    const gitPath = path.relative(path.dirname(root), file).split(path.sep).join('/');
    if (!gitPath || gitPath.startsWith('../') || path.isAbsolute(gitPath)) throw Error('Ukendt kildefil i kildebeviset: ' + name);
    const current = await fs.readFile(file);
    let committed = null;
    try { committed = execFileSync('git', ['show', `${sourceCommit}:${gitPath}`], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* Filen er ikke committet. */ }
    if (!committed || !current.equals(committed)) changed.push(gitPath);
    files[gitPath] = hash(current);
  }
  if (changed.length) throw Error(`Commit ændringerne før pakning: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` og ${changed.length - 5} mere` : ''}`);
  return { schemaVersion: 1, sourceCommit, files };
}

async function create(root, output) {
  const proof = await sourceProof(root, await productFiles(root));
  await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

async function verify(root, proof) {
  if (proof?.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(proof.sourceCommit) || !proof.files || !Object.keys(proof.files).length) throw Error('Pakkens kildebevis mangler eller er ugyldigt.');
  // Commit'et skal kunne nås fra den aktuelle historik; et omskrevet commit kan ingen andre finde.
  try { execFileSync('git', ['merge-base', '--is-ancestor', proof.sourceCommit, 'HEAD'], { cwd: root, stdio: 'ignore' }); }
  catch { throw Error('Kildebevisets commit findes ikke i den aktuelle historik: ' + proof.sourceCommit); }
  for (const [name, expected] of Object.entries(proof.files)) {
    if ((!/^(desktop|profiles)\//.test(name) && name !== 'LICENSE') || name.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Ugyldig kildepost i kildebeviset: ' + name);
    const committed = execFileSync('git', ['show', `${proof.sourceCommit}:${name}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    if (hash(committed) !== expected || hash(await fs.readFile(path.resolve(root, '..', name))) !== expected) throw Error('Kildebeviset matcher ikke commit og arbejdsmappe: ' + name);
  }
  return { sourceCommit: proof.sourceCommit, files: Object.keys(proof.files).length };
}
module.exports = { productFiles, sourceProof, create, verify, BUILD_SCRIPTS };
