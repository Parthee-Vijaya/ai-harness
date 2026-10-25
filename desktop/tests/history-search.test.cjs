const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Store } = require('../core/store.cjs');
const { WorkspaceHistory } = require('../core/workspace-history.cjs');
const { searchHistory } = require('../core/history-search.cjs');

// Rigtige samtalefiler i en midlertidig mappe, som Aura selv ville skrive dem.
async function setup(t, prefix) {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state'), {}), history = new WorkspaceHistory(store);
  return { dir, store, history };
}

test('søgningen finder en præcis gammel besked med projekt, samtale og sider og skriver ikke i historikken', async t => {
  const { dir, store, history } = await setup(t, 'aura-soeg-');
  const root = path.join(dir, 'project'); await fs.mkdir(root); await history.open({ root, name: 'Syntetisk projekt' });
  const chat = await history.createChat(root, { fresh: true });
  await history.updateChat(root, chat.id, c => { c.title = 'En titel uden ordet'; c.renamed = true; c.messages = Array.from({ length: 50 }, (_, i) => ({ id: `besked-${i}`, role: i % 2 ? 'assistant' : 'user', text: `Valgt farve ${i} til projektet` })); });
  const before = await fs.readFile(history.chatFile(root, chat.id));
  const first = await searchHistory(history, { query: 'FARVE', limit: 3 });
  assert.equal(first.results.length, 3); assert.equal(first.nextOffset, 3); assert.equal(first.results[0].message, 'besked-0'); assert.equal(first.localOnly, true);
  assert.equal(JSON.stringify(first).includes(root), false, 'projektets sti sendes ikke til brugerfladen');
  const next = await searchHistory(history, { query: 'farve', project: store.projectKey(root), chat: chat.id, offset: 3, limit: 3 });
  assert.equal(next.results[0].message, 'besked-3');
  assert.equal((await searchHistory(history, { query: 'findes ikke' })).results.length, 0);
  assert.deepEqual(await fs.readFile(history.chatFile(root, chat.id)), before);
  await assert.rejects(searchHistory(history, { query: 'x', root: '/etc' }), /lokale/);
  await assert.rejects(searchHistory(history, { query: 'x', limit: 100000 }), /ugyldig/);
});

test('søgningen springer symlinkede, ødelagte og for store samtaler over uden at ændre dem', async t => {
  const { dir, history } = await setup(t, 'aura-soeg-graenser-');
  const root = path.join(dir, 'project'); await fs.mkdir(root);
  const project = await history.open({ root, name: 'Syntetisk' }), id = project.active;
  await history.updateChat(root, id, c => { c.messages = [{ id: 'm', role: 'user', text: 'nål' }]; });
  const file = history.chatFile(root, id), original = await fs.readFile(file), outside = path.join(dir, 'udenfor.json');
  await fs.writeFile(outside, original); await fs.unlink(file); await fs.symlink(outside, file);
  assert.equal((await searchHistory(history, { query: 'nål' })).results.length, 0, 'et symlink følges ikke');
  assert.deepEqual(await fs.readFile(outside), original);
  await fs.unlink(file); await fs.writeFile(file, '{ødelagt');
  assert.equal((await searchHistory(history, { query: 'nål' })).skipped, 1);
  await fs.writeFile(file, Buffer.alloc(8 * 1024 * 1024 + 1));
  const large = await searchHistory(history, { query: 'nål' });
  assert.equal(large.results.length, 0); assert.equal(large.skipped, 1); assert.equal(large.truncated, false, 'en for stor samtale springes over, men søgningen fortsætter');
  await fs.writeFile(file, original);
  const folder = history.folder(root), moved = path.join(dir, 'flyttet');
  await fs.rename(folder, moved); await fs.symlink(moved, folder);
  assert.equal((await searchHistory(history, { query: 'nål' })).results.length, 0, 'en symlinket samtalemappe følges ikke');
});

test('søgningen migrerer aldrig gammel historik og ændrer den ikke', async t => {
  const { dir, history } = await setup(t, 'aura-soeg-gammel-');
  const root = path.join(dir, 'project'); await fs.mkdir(root); await history.open({ root, name: 'Gammel' });
  const old = JSON.stringify({ version: 1, draft: 'behold', messages: [{ role: 'user', text: 'nål' }], planConversation: [] });
  await fs.writeFile(history.file(root), old);
  history.chats = () => { throw Error('Søgningen må ikke migrere historikken'); };
  const result = await searchHistory(history, { query: 'nål' });
  assert.equal(result.results.length, 0); assert.equal(result.unopened, 1, 'projektet tæller som uåbnet, ikke som ulæselig samtale'); assert.equal(result.skipped, 0);
  assert.equal(await fs.readFile(history.file(root), 'utf8'), old);
});

test('projekt og samtale afgrænser søgningen, og ukendte projekter giver intet', async t => {
  const { dir, store, history } = await setup(t, 'aura-soeg-omfang-');
  const ids = [];
  for (const n of [1, 2]) {
    const root = path.join(dir, 'project' + n); await fs.mkdir(root);
    const p = await history.open({ root, name: 'Projekt ' + n });
    await history.updateChat(root, p.active, c => { c.messages = [{ id: 'm' + n, role: 'user', text: 'fælles søgeord' }]; });
    ids.push({ root, id: p.active });
  }
  assert.equal((await searchHistory(history, { query: 'FÆLLES' })).results.length, 2);
  const scoped = await searchHistory(history, { query: 'søgeord', project: store.projectKey(ids[0].root), chat: ids[0].id });
  assert.deepEqual(scoped.results.map(r => r.message), ['m1']);
  assert.equal((await searchHistory(history, { query: 'søgeord', project: '0'.repeat(64) })).results.length, 0);
});

test('ødelagte filer tæller også med i det samlede loft for læsning', async t => {
  const { dir, history } = await setup(t, 'aura-soeg-loft-');
  const root = path.join(dir, 'project'); await fs.mkdir(root); await history.open({ root, name: 'Syntetisk' });
  const entries = Array.from({ length: 6 }, () => ({ id: crypto.randomUUID(), title: 'Ødelagt', updatedAt: new Date().toISOString() }));
  await history.updateProject(root, p => { p.chats = entries; });
  for (const entry of entries) await fs.writeFile(history.chatFile(root, entry.id), Buffer.alloc(8 * 1024 * 1024));
  const open = fs.open; let bytes = 0;
  fs.open = async (...args) => { const fd = await open(...args); return { stat: () => fd.stat(), read: async (...values) => { const result = await fd.read(...values); bytes += result.bytesRead; return result; }, close: () => fd.close() }; };
  try {
    const result = await searchHistory(history, { query: 'hvad som helst' });
    assert.equal(result.results.length, 0); assert.equal(result.truncated, true, 'det samlede loft stopper søgningen');
    assert.ok(result.skipped >= 3, 'samtaler, der blev læst og ikke kunne bruges, tælles');
    assert.ok(bytes > 0 && bytes <= 32 * 1024 * 1024, `Læste ${bytes} byte`);
  } finally { fs.open = open; }
});
