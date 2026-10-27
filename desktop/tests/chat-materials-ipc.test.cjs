const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { installChatMaterials, METHODS } = require('../core/chat-materials-ipc.cjs');
// Brugerfladen må aldrig kunne sende en filsti. Prøverne holder den grænse og kontrollen af den åbne samtale.
async function fixture(t, { running = false, busy = false } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vedhaeftning-ipc-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'noter.md');
  await fs.writeFile(file, 'Tre mødelokaler.');
  const chat = { id: 'samtale-1', project: { root }, root, generation: 0, running, sending: false, starting: false, finishing: null, prepared: null };
  const bench = { project: { root }, chatID: chat.id, chats: new Map([[chat.id, chat]]), chatFor: id => (id === chat.id ? chat : null), busyRoot: () => busy };
  const channels = new Map();
  let dialogCalls = 0, result = { canceled: false, filePaths: [file] };
  installChatMaterials({
    getWorkbench: () => bench,
    register: (channel, action) => channels.set(channel, action),
    dialog: { showOpenDialog: async () => { dialogCalls++; return result; } },
    exclusive: action => action(),
    emit() {}
  });
  const invoke = (name, value) => channels.get(METHODS[name])(value);
  return { root, file, bench, chat, invoke, calls: () => dialogCalls, cancel: () => { result = { canceled: true, filePaths: [] }; } };
}

test('brugerfladen kan ikke sende en filsti eller et ukendt felt', async t => {
  const f = await fixture(t);
  for (const value of [{ chat: 'samtale-1', path: f.file }, { chat: 'samtale-1', paths: [f.file] }, { path: f.file }, 'samtale-1', null, [f.file]]) {
    await assert.rejects(f.invoke('chatMaterialsChooseFiles', value), /Der modtages ingen filstier|Brug filvalget/);
  }
  assert.equal(f.calls(), 0, 'filvælgeren åbnes ikke for et ugyldigt kald');
});

test('kun den åbne samtale kan ændre sit filvalg', async t => {
  const f = await fixture(t);
  await assert.rejects(f.invoke('chatMaterialsChooseFiles', { chat: 'samtale-2' }), /Vælg den aktuelle samtale/);
  f.bench.chatID = 'samtale-2';
  await assert.rejects(f.invoke('chatMaterialsChooseFiles', { chat: 'samtale-1' }), /Vælg den aktuelle samtale/);
  assert.equal(f.calls(), 0);
});

test('en opgave i gang spærrer for ændringer i filvalget', async t => {
  const running = await fixture(t, { running: true });
  await assert.rejects(running.invoke('chatMaterialsChooseFiles', { chat: 'samtale-1' }), /Vent på opgaven/);
  const busy = await fixture(t, { busy: true });
  await assert.rejects(busy.invoke('chatMaterialsChooseFiles', { chat: 'samtale-1' }), /Vent på opgaven/);
  assert.equal(running.calls() + busy.calls(), 0);
});

test('computerens filvælger er den eneste kilde, og et afbrudt valg ændrer ingenting', async t => {
  const f = await fixture(t);
  const offered = await f.invoke('chatMaterialsChooseFiles', { chat: 'samtale-1' });
  assert.equal(f.calls(), 1);
  assert.deepEqual(offered.candidates.map(item => item.name), ['noter.md']);
  assert.equal(JSON.stringify(offered).includes(f.root), false, 'stien sendes ikke tilbage til brugerfladen');
  f.cancel();
  const cancelled = await f.invoke('chatMaterialsChooseFiles', { chat: 'samtale-1' });
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(cancelled.candidates.map(item => item.name), ['noter.md'], 'det tidligere valg står uændret');
});

test('en referencemappe vælges som mappe, og tilstanden kan læses uden at ændre noget', async t => {
  const f = await fixture(t);
  const state = await f.invoke('chatMaterialsState', { chat: 'samtale-1' });
  assert.deepEqual(state.selected, []);
  assert.equal(f.calls(), 0);
  // Mappevælgeren tager kun en mappe. Gav filvælgeren en fil, afvises valget frem for at læse den.
  await assert.rejects(f.invoke('chatMaterialsChooseFolder', { chat: 'samtale-1' }), /Vælg en almindelig mappe/);
  assert.deepEqual((await f.invoke('chatMaterialsState', { chat: 'samtale-1' })).selected, []);
});
