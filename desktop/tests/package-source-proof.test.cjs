const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { sourceProof, verify, productFiles } = require('../scripts/package-source-proof.cjs');

// Et lille Git-repo med syntetisk kilde, uden brugerens Git-indstillinger.
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-kildebevis-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'desktop'); await fs.mkdir(desktop); await fs.writeFile(path.join(desktop, 'main.cjs'), '// Syntetisk kilde\n');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Prøve', GIT_AUTHOR_EMAIL: 'proeve@example.invalid', GIT_COMMITTER_NAME: 'Prøve', GIT_COMMITTER_EMAIL: 'proeve@example.invalid' } });
  git('init', '--quiet'); git('add', 'desktop/main.cjs'); git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'syntetisk kilde');
  return { root, desktop, git };
}

test('kildebeviset binder de committede bytes og tåler senere commits, der kun ændrer dokumentation', async t => {
  const f = await fixture(t), proof = await sourceProof(f.desktop, ['main.cjs']);
  assert.equal((await verify(f.desktop, proof)).files, 1);
  await fs.writeFile(path.join(f.root, 'README.md'), 'Syntetisk dokumentation'); f.git('add', 'README.md'); f.git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'dokumentation');
  assert.notEqual(f.git('rev-parse', 'HEAD').trim(), proof.sourceCommit);
  assert.equal((await verify(f.desktop, proof)).sourceCommit, proof.sourceCommit);
});

test('ikke-committede produktfiler kan ikke pakkes, og fejlen nævner filen', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.desktop, 'main.cjs'), '// Ændret\n');
  await assert.rejects(sourceProof(f.desktop, ['main.cjs']), /Commit ændringerne før pakning: desktop\/main\.cjs/);
  await fs.writeFile(path.join(f.desktop, 'ny.cjs'), '// Aldrig committet\n');
  await assert.rejects(sourceProof(f.desktop, ['ny.cjs']), /desktop\/ny\.cjs/);
});

test('kildebeviset afviser ændrede bytes, ugyldigt commit, stier ud af repoet og en omskrevet kontrolsum', async t => {
  const f = await fixture(t), proof = await sourceProof(f.desktop, ['main.cjs']);
  for (const next of [{ ...proof, sourceCommit: 'bad' }, { ...proof, files: { 'desktop/../secret': '0'.repeat(64) } }, { ...proof, files: { 'desktop/main.cjs': '0'.repeat(64) } }]) await assert.rejects(verify(f.desktop, next));
  await fs.writeFile(path.join(f.desktop, 'main.cjs'), '// Ændret efter pakning\n');
  await assert.rejects(verify(f.desktop, proof), /matcher ikke/);
});

test('et commit, der ikke findes i den aktuelle historik, afvises', async t => {
  const f = await fixture(t), proof = await sourceProof(f.desktop, ['main.cjs']);
  // En ny historik uden kildebevisets commit, fx efter en omskrivning.
  f.git('checkout', '--quiet', '--orphan', 'anden'); f.git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'anden historik');
  await assert.rejects(verify(f.desktop, proof), /findes ikke i den aktuelle historik/);
});

test('produktlisten dækker byggekonfiguration, entitlements og byggescripts', async () => {
  const names = await productFiles(path.join(__dirname, '..'));
  for (const name of ['electron-builder.cjs', 'packaging/entitlements.mac.plist', 'packaging/entitlements.node.mac.plist', 'scripts/sign-mac.cjs', 'scripts/prepare-runtime.cjs', 'main.cjs', 'core/engine.cjs', '../LICENSE']) assert.ok(names.includes(name), name);
  assert.ok(names.some(name => name.startsWith('packaging/licenses/')));
});

// Et syntetisk repo med alle produktfilernes faste navne, så create() kan køres helt.
async function product(t) {
  const f = await fixture(t), { BUILD_SCRIPTS } = require('../scripts/package-source-proof.cjs');
  const write = async (name, content = 'syntetisk\n') => { await fs.mkdir(path.dirname(path.join(f.root, name)), { recursive: true }); await fs.writeFile(path.join(f.root, name), content); };
  for (const name of ['package.json', 'package-lock.json', 'runtime-lock.json', 'preload.cjs', 'electron-builder.cjs', 'packaging/entitlements.mac.plist', 'packaging/entitlements.node.mac.plist', 'packaging/icon.png', 'packaging/licenses/A.txt', 'core/a.cjs', 'ui/a.js', ...BUILD_SCRIPTS.map(s => 'scripts/' + s)]) await write('desktop/' + name);
  for (const name of ['LICENSE', 'profiles/catalog.json', 'profiles/grundregler.md', 'profiles/gitignore.txt', 'profiles/skills/a/SKILL.md']) await write(name);
  f.git('add', '-A'); f.git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'produktfiler');
  return f;
}

test('en committet fil, der er slettet på disken, eller en fil, Git ikke følger, stopper pakningen; Finder-filer gør ikke', async t => {
  const { create } = require('../scripts/package-source-proof.cjs');
  const f = await product(t), out = path.join(f.root, 'bevis.json');
  assert.ok((await create(f.desktop, out)).files['desktop/core/a.cjs']);
  await fs.writeFile(path.join(f.desktop, 'core/.DS_Store'), 'finder'); await create(f.desktop, out);
  const removed = path.join(f.root, 'profiles/skills/a/SKILL.md'), original = await fs.readFile(removed);
  await fs.unlink(removed);
  await assert.rejects(create(f.desktop, out), /Commit sletningerne før pakning: \.\.\/profiles\/skills\/a\/SKILL\.md/);
  await fs.writeFile(removed, original);
  await fs.writeFile(path.join(f.desktop, 'ui/ny.js'), '// ikke fulgt\n');
  await assert.rejects(create(f.desktop, out), /Git ikke følger, før pakning: ui\/ny\.js/);
});
