// Kildebevis for en pakke: det commit, pakken er bygget fra, og SHA-256 for hver fil, der bestemmer pakkens indhold.
// Pakning kræver, at filerne er committet. Det er sporbarhed, ikke en signatur. Efter forslag i #39.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
// Scripts, der forbereder, pakker, signerer eller afgør kildebevisets filliste.
const BUILD_SCRIPTS = ['create-icon.cjs', 'package-source-proof.cjs', 'prepare-runtime.cjs', 'runtime-integrity.cjs', 'sign-mac.cjs', 'signed-runtime-proof.cjs', 'verify-package-source.cjs'];
// Mapper, hvis indhold er produktfiler.
const FOLDERS = ['packaging/licenses', 'core', 'ui', '../profiles/skills'];

// Én fælles liste til pakning og kontrol: appkode, profiler, byggekonfiguration, entitlements og byggescripts.
// Uden commit læses mapperne fra disken; med et commit læses de fra Git, så en fil, der mangler på disken, også tæller.
async function folderFiles(root, folder, commit) {
  if (!commit) return require('./verify-package-source.cjs').files(path.join(root, folder), folder + '/');
  const gitFolder = path.relative(path.dirname(root), path.resolve(root, folder)).split(path.sep).join('/');
  // Stien er relativ til repoets rod (desktop-mappens forælder), så ls-tree køres derfra.
  const listed = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', gitFolder + '/'], { cwd: path.dirname(path.resolve(root)), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return listed.split('\n').filter(Boolean).map(name => folder + '/' + name.slice(gitFolder.length + 1)).sort();
}
async function productFiles(root, commit = null) {
  const listed = (await Promise.all(FOLDERS.map(folder => folderFiles(root, folder, commit)))).flat();
  return [...new Set([
    'package.json', 'package-lock.json', 'runtime-lock.json', 'main.cjs', 'preload.cjs', 'electron-builder.cjs',
    ...BUILD_SCRIPTS.map(name => 'scripts/' + name),
    'packaging/entitlements.mac.plist', 'packaging/entitlements.node.mac.plist', 'packaging/icon.png',
    ...listed,
    '../LICENSE', '../profiles/catalog.json', '../profiles/grundregler.md', '../profiles/gitignore.txt'
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
  // Filer, der er committet, men slettet på disken, og filer på disken, Git ikke følger, stopper også pakningen.
  const onDisk = await productFiles(root), committed = await productFiles(root, 'HEAD');
  const deleted = committed.filter(name => !onDisk.includes(name)), untracked = onDisk.filter(name => !committed.includes(name));
  if (deleted.length) throw Error(`Commit sletningerne før pakning: ${deleted.slice(0, 5).join(', ')}`);
  if (untracked.length) throw Error(`Fjern eller commit filerne, Git ikke følger, før pakning: ${untracked.slice(0, 5).join(', ')}`);
  const proof = await sourceProof(root, onDisk);
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
