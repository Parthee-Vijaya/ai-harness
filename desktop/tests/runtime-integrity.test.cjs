const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { inventory, verifyRuntime } = require('../scripts/runtime-integrity.cjs');

// En syntetisk runtime-mappe med låsefil og manifest. Ingen værktøjer køres.
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-runtimebevis-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'node/bin'), { recursive: true });
  await fs.writeFile(path.join(root, 'node/bin/node'), 'syntetisk program', { mode: 0o755 });
  await fs.writeFile(path.join(root, 'LICENSE'), 'syntetisk licens');
  const lock = { node: 'test-node', git: 'test-git', opencode: 'test-motor', sources: [], targets: { fixture: { node: { checksum: 'syntetisk' } } } };
  const manifest = { target: 'fixture', versions: { node: lock.node, git: lock.git, opencode: lock.opencode }, sources: [], archives: lock.targets.fixture, payloads: await inventory(root) };
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, lock, manifest, verify: () => verifyRuntime(root, manifest, manifest, lock, 'fixture') };
}

test('et låst runtimebevis kontrollerer bytes, licens, kørselsret og interne links uden at køre værktøjer', async t => {
  const f = await fixture(t);
  if (process.platform !== 'win32') await fs.symlink('bin/node', path.join(f.root, 'node/current'));
  f.manifest.payloads = await inventory(f.root);
  assert.equal((await f.verify()).files, process.platform === 'win32' ? 2 : 3);
  assert.equal((await inventory(f.root)).sha256, f.manifest.payloads.sha256);
});

for (const [change, word] of [['alter', 'ændret'], ['missing', 'mangler'], ['extra', 'i overskud'], ['executable', 'ændret']]) test(`afviser ændringer i runtime-mappen og nævner filen: ${change}`, async t => {
  if (change === 'executable' && process.platform === 'win32') return t.skip('Windows har ingen kørselsbit');
  const f = await fixture(t), file = path.join(f.root, 'node/bin/node');
  if (change === 'alter') await fs.writeFile(file, 'ændret program');
  if (change === 'missing') await fs.unlink(file);
  if (change === 'extra') await fs.writeFile(path.join(f.root, 'ekstra'), 'ukendt fil');
  if (change === 'executable') await fs.chmod(file, 0o644);
  await assert.rejects(f.verify(), new RegExp(`Runtime-payload.*${word}: ${change === 'extra' ? 'ekstra' : 'node/bin/node'}`));
});

test('et omskrevet manifest, en forkert platform eller forkerte arkiver kan ikke skjule ændringer', async t => {
  const f = await fixture(t), original = structuredClone(f.manifest);
  await fs.writeFile(path.join(f.root, 'LICENSE'), 'ændret licens');
  f.manifest.payloads = await inventory(f.root);
  await assert.rejects(verifyRuntime(f.root, f.manifest, original, f.lock, 'fixture'), /runtimebevis/);
  await assert.rejects(verifyRuntime(f.root, { ...f.manifest, target: 'forkert' }, original, f.lock, 'fixture'), /platform/);
  await assert.rejects(verifyRuntime(f.root, { ...f.manifest, archives: {} }, original, f.lock, 'fixture'), /arkiverne/);
});

test('afviser absolutte, udadgående og døde links', async t => {
  if (process.platform === 'win32') return t.skip('Symlinks kan kræve rettigheder på Windows');
  for (const target of ['/etc/passwd', '../../udenfor', 'mangler']) {
    const f = await fixture(t); await fs.symlink(target, path.join(f.root, 'node/link'));
    await assert.rejects(inventory(f.root));
  }
});

test('særlige egenskabsnavne kan ikke skjule en ukendt fil', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, '__proto__'), 'ukendt program', { mode: 0o755 });
  const actual = await inventory(f.root); assert.ok(Object.hasOwn(actual.entries, '__proto__'));
  assert.notEqual(actual.sha256, f.manifest.payloads.sha256); await assert.rejects(f.verify(), /Runtime-payload/);
});

test('macOS-signeringen får en kvittering pr. bygning; senere ændringer og andre kildefiler afvises', { skip: process.platform !== 'darwin' }, async t => {
  const { execFileSync } = require('node:child_process');
  const { record, expected, receiptPath } = require('../scripts/signed-runtime-proof.cjs');
  const f = await fixture(t), target = 'darwin-syntetisk-proeve', resources = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-signeret-'));
  t.after(() => fs.rm(resources, { recursive: true, force: true }));
  await fs.mkdir(path.join(resources, 'runtime')); await fs.copyFile('/usr/bin/true', path.join(resources, 'runtime', 'tool'));
  await fs.writeFile(path.join(resources, 'source-proof.json'), '{"source":"syntetisk"}');
  const receipt = await receiptPath(resources, target); t.after(() => fs.rm(receipt, { force: true }));
  const input = await inventory(path.join(resources, 'runtime'));
  const manifest = { ...f.manifest, target, payloads: input }, lock = { ...f.lock, targets: { [target]: f.manifest.archives } };
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', path.join(resources, 'runtime', 'tool')], { stdio: 'pipe' });
  await assert.rejects(verifyRuntime(path.join(resources, 'runtime'), manifest, manifest, lock, target));
  const recorded = await record(resources, target, input);
  assert.notEqual(recorded.payloads.sha256, input.sha256);
  const final = await expected(resources, target, input);
  await verifyRuntime(path.join(resources, 'runtime'), manifest, manifest, lock, target, final);
  await fs.appendFile(path.join(resources, 'runtime', 'tool'), 'ændret');
  await assert.rejects(verifyRuntime(path.join(resources, 'runtime'), manifest, manifest, lock, target, final));
  // En anden bygning har et andet kildebevis og dermed sin egen kvittering; den gamle bevares.
  await fs.writeFile(path.join(resources, 'source-proof.json'), '{"source":"anden"}');
  assert.equal(await expected(resources, target, input), null);
  await fs.access(receipt);
});

test('signeringen kontrollerer runtime før signering og gemmer kvitteringen efter', { skip: process.platform !== 'darwin' }, async t => {
  const { execFileSync } = require('node:child_process');
  const { sign } = require('../scripts/sign-mac.cjs'), { receiptPath } = require('../scripts/signed-runtime-proof.cjs');
  const target = 'darwin-syntetisk-sign', prepared = path.join(__dirname, '..', '.runtime', target);
  const app = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-sign-')), 'Aura.app'), resources = path.join(app, 'Contents', 'Resources');
  t.after(() => fs.rm(path.dirname(app), { recursive: true, force: true })); t.after(() => fs.rm(prepared, { recursive: true, force: true }));
  await fs.mkdir(path.join(resources, 'runtime'), { recursive: true }); await fs.copyFile('/usr/bin/true', path.join(resources, 'runtime', 'tool'));
  await fs.writeFile(path.join(resources, 'source-proof.json'), '{"source":"sign"}');
  const lock = require('../runtime-lock.json');
  const manifest = { target, versions: { opencode: lock.opencode, git: lock.git, node: lock.node }, sources: lock.sources || [], archives: lock.targets[target], payloads: await inventory(path.join(resources, 'runtime')) };
  await fs.writeFile(path.join(resources, 'runtime', 'manifest.json'), JSON.stringify(manifest));
  await fs.mkdir(prepared, { recursive: true }); await fs.writeFile(path.join(prepared, 'manifest.json'), JSON.stringify(manifest));
  const receipt = await receiptPath(resources, target); t.after(() => fs.rm(receipt, { force: true }));
  const calls = [];
  const signer = async () => { calls.push('signér'); execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', path.join(resources, 'runtime', 'tool')], { stdio: 'pipe' }); };
  await sign({ app }, signer);
  assert.deepEqual(calls, ['signér']);
  assert.equal(JSON.parse(await fs.readFile(receipt, 'utf8')).target, target, 'kvitteringen er gemt');
  // En runtime, der er ændret før signeringen, stopper pakningen, før der signeres.
  await fs.appendFile(path.join(resources, 'runtime', 'tool'), 'ændret');
  await assert.rejects(sign({ app }, signer), /Runtime-payload/);
  assert.deepEqual(calls, ['signér']);
});
