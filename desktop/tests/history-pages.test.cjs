const { test } = require('node:test');
const assert = require('node:assert/strict');
const { takePrevious, needsRestore, PAGE_SIZE } = require('../ui/history-pages.js');

test('siderne giver alle gemte beskeder i rækkefølge uden dubletter og uden at ændre det gemte', () => {
  const messages = Object.freeze(Array.from({ length: 200 }, (_, id) => Object.freeze({ id, role: id % 2 ? 'assistant' : 'user', text: `Gemt besked ${id}` })));
  const original = JSON.stringify(messages);
  let remaining = messages, restored = [];
  while (remaining.length) {
    const page = takePrevious(remaining);
    assert.ok(page.recent.length <= PAGE_SIZE);
    assert.ok(page.older.length < remaining.length, 'hver side giver mindst én besked');
    restored = [...page.recent, ...restored]; remaining = page.older;
  }
  assert.deepEqual(restored, messages);
  assert.equal(JSON.stringify(messages), original);
});

test('lange beskeder bevares hele, og en side holder sig under cirka 60.000 tegn', () => {
  const messages = Array.from({ length: 12 }, (_, id) => ({ id, text: '🟢'.repeat(10000) }));
  const page = takePrevious(messages);
  assert.equal(page.recent.length, 3); assert.equal(page.older.length, 9);
  assert.equal(page.recent[0].text, messages[9].text);
  assert.equal(takePrevious([{ text: 'x'.repeat(70000) }]).recent.length, 1, 'en enkelt meget lang besked vises alligevel');
});

test('en tom eller kort samtale har ingen ældre side, og forkerte data afvises', () => {
  assert.deepEqual(takePrevious([]), { older: [], recent: [] });
  assert.equal(takePrevious([{ role: 'user', text: 'Eneste besked' }]).older.length, 0);
  assert.throws(() => takePrevious(null), TypeError);
});

test('en tom visning, som en hændelse oprettede, henter beskeder og plan; en allerede vist samtale gør ikke', () => {
  const empty = { historyLoaded: false, log: { children: [] } };
  assert.equal(needsRestore(false, empty), true, 'en hændelse kom før samtalen blev åbnet');
  assert.equal(needsRestore(true, empty), true);
  assert.equal(needsRestore(false, { historyLoaded: true, log: { children: [] } }), false, 'en hentet, tom samtale hentes ikke igen');
  assert.equal(needsRestore(false, { historyLoaded: false, log: { children: [{}] } }), false, 'beskeder fra en igangværende opgave bevares');
});
