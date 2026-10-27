const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { Workbench } = require('../core/workbench.cjs');
// Grundreglerne sendes altid med og binder allerede afsendelsen. Prøven viser, at gennemgangen oplyser den
// præcise tekst, AI'en får, også når projektet har tilpasset den.
test('gennemgangen oplyser de faktiske grundregler, også projektets egen tilpasning', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-grundregler-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'projekt'); await fs.mkdir(root);
  const bench = new Workbench({ directory: path.join(directory, 'data'), profiles: path.join(__dirname, '../../profiles'), safeStorage: {}, emit() {} });
  t.after(() => bench.close());
  await bench.activate({ root, name: 'Grundregelprøve' });
  const saved = await bench.saveConnection({ kind: 'compatible', name: 'Lokal prøve', baseURL: 'http://127.0.0.1:1/v1' });
  const connection = await bench.connection(saved.connections[0].id);
  bench.selection = async () => ({ connection, model: { id: 'test' }, route: null });
  const input = { connectionID: connection.id, modelID: 'test', mode: 'free' };
  const first = await bench.prepare(input);
  assert.equal(first.rules, (await bench.skills.context(root)).rules);
  assert.match(first.rules, /FÆLLES-GRUNDLAG-02/);
  const customized = first.rules + '\nPRØVEREGEL: Bevar brugerens funktioner.\n';
  await bench.skills.save(root, { id: 'faelles-grundregler', content: customized });
  const second = await bench.prepare(input);
  assert.match(second.rules, /PRØVEREGEL: Bevar brugerens funktioner\./);
  assert.equal(second.rules, (await bench.skills.context(root)).rules, 'gennemgangen må ikke vise en anden tekst end den, AI’en får');
  // Reglerne indgår i fingeraftrykket, så en ændret regeltekst kræver en ny gennemgang.
  assert.notEqual(second.fingerprint, first.fingerprint);
});
