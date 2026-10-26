const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../core/store.cjs');
const { Appearance, windowBackground } = require('../core/appearance.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-udseende-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, store: new Store(root, {}), theme: { themeSource: 'unset', shouldUseDarkColors: false } };
}

test('udseendet følger systemet, indtil brugeren vælger andet, og valget huskes', async t => {
  const f = await fixture(t);
  assert.deepEqual(await new Appearance(f.store, f.theme).start(), { theme: 'system' });
  assert.equal(f.theme.themeSource, 'system');
  assert.deepEqual(await new Appearance(f.store, f.theme).save({ theme: 'dark' }), { theme: 'dark' });
  assert.equal(f.theme.themeSource, 'dark');
  const reopened = { themeSource: 'unset' };
  assert.deepEqual(await new Appearance(new Store(f.root, {}), reopened).start(), { theme: 'dark' });
  assert.equal(reopened.themeSource, 'dark');
});

test('valget ændrer ikke andre indstillinger', async t => {
  const f = await fixture(t);
  await f.store.update(state => { state.connections = [{ id: 'ai' }]; state.updates = { automatic: false }; });
  await new Appearance(f.store, f.theme).save({ theme: 'light' });
  const state = await f.store.read();
  assert.deepEqual(state.connections, [{ id: 'ai' }]); assert.deepEqual(state.updates, { automatic: false }); assert.deepEqual(state.appearance, { theme: 'light' });
});

test('ukendte valg afvises og gemmes ikke; en ukendt gemt værdi følger systemet', async t => {
  const f = await fixture(t), appearance = new Appearance(f.store, f.theme);
  for (const theme of ['', 'Mørkt', 'high-contrast', null, { theme: 'dark' }, '__proto__']) await assert.rejects(appearance.save({ theme }), /Ukendt udseende/);
  await assert.rejects(appearance.save(null), /Ukendt udseende/);
  assert.equal((await f.store.read()).appearance, undefined);
  assert.equal(f.theme.themeSource, 'unset');
  await f.store.update(state => { state.appearance = { theme: 'neon' }; });
  assert.deepEqual(await appearance.get(), { theme: 'system' });
});

test('ulæselige indstillinger stopper ikke opstarten; appen følger systemet', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'settings.json'), '{ ikke json');
  assert.deepEqual(await new Appearance(new Store(f.root, {}), f.theme).start(), { theme: 'system' });
  assert.equal(f.theme.themeSource, 'system');
});

test('vinduets baggrund svarer til lys og mørk baggrund i stilarket', async () => {
  const css = await fs.readFile(path.join(__dirname, '..', 'ui', 'styles.css'), 'utf8');
  const [, light, dark] = css.match(/--canvas: light-dark\((#[0-9a-f]+), (#[0-9a-f]+)\)/i);
  assert.equal(windowBackground({ shouldUseDarkColors: false }).toLowerCase(), light.toLowerCase());
  assert.equal(windowBackground({ shouldUseDarkColors: true }).toLowerCase(), dark.toLowerCase());
});
