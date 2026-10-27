const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ChatMaterials } = require('../core/chat-materials.cjs');
const { addImages } = require('../core/chat-media.cjs');
const { imageInfo } = require('../core/image-info.cjs');
// Et vedhæftet billede skrives om til PNG i hovedprocessen, vises som det sendes og bindes til netop den besked.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-billede-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  // Den rigtige omskrivning sker i Electron. Her står en kontrolleret stand-in, der svarer med et gyldigt PNG.
  let calls = 0;
  const normalizeImage = buffer => { calls++; assert.ok(Buffer.isBuffer(buffer)); return { data: PNG, mime: 'image/png' }; };
  const materials = new ChatMaterials({ normalizeImage });
  const chat = { id: 'samtale-1', project: { root }, generation: 0, running: false, sending: false, starting: false, finishing: null, prepared: null };
  const write = async (name, data) => { const file = path.join(root, name); await fs.writeFile(file, data); return file; };
  return { root, materials, chat, write, calls: () => calls };
}
const handleOf = state => ({ scope: state.scope, revision: state.revision });

test('et billede bliver et omskrevet PNG, der vises præcis som det sendes', async t => {
  const f = await fixture(t);
  const file = await f.write('skaermbillede.png', PNG);
  const offered = await f.materials.offerFiles(f.chat, [file]);
  assert.equal(offered.candidates[0].kind, 'image');
  const review = await f.materials.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] });
  const image = review.files[0];
  assert.equal(image.kind, 'image');
  assert.equal(image.mime, 'image/png');
  assert.match(image.dataURL, /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
  assert.match(image.normalizedHash, /^[0-9a-f]{64}$/);
  assert.equal(image.width, 1); assert.equal(image.height, 1);
  assert.equal(image.text, '', 'et billede giver ingen tekst; der er ikke udført OCR');
  assert.equal(f.calls(), 1, 'billedet skrives om i hovedprocessen');
  assert.equal(JSON.stringify(review).includes(f.root), false);
});

test('kun hele PNG- og JPEG-billeder kommer igennem', async t => {
  const f = await fixture(t);
  const brudt = await f.write('brudt.png', PNG.subarray(0, 20));
  const offered = await f.materials.offerFiles(f.chat, [brudt]);
  await assert.rejects(f.materials.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] }), /PNG-billedet er (ufuldstændigt|ugyldigt)|kunne ikke læses/);
  // Et PNG med en animationsblok er ikke et skærmbillede.
  assert.throws(() => imageInfo(Buffer.concat([PNG.subarray(0, 33), Buffer.from([0, 0, 0, 0]), Buffer.from('acTL'), Buffer.alloc(4), PNG.subarray(33)])), /Animerede/);
  assert.throws(() => imageInfo(Buffer.from('ikke et billede')), /kunne ikke læses|højst 8192/);
});

test('et billede lægges på brugerens seneste besked i den form, udbyderen bruger', () => {
  const image = { dataURL: `data:image/png;base64,${PNG.toString('base64')}` };
  const chat = addImages({ messages: [{ role: 'system', content: 'regler' }, { role: 'user', content: 'Se her' }] }, [image], {});
  assert.deepEqual(chat.messages[1].content, [{ type: 'text', text: 'Se her' }, { type: 'image_url', image_url: { url: image.dataURL } }]);
  assert.equal(chat.messages[0].content, 'regler', 'systembeskeden røres ikke');
  const claude = addImages({ messages: [{ role: 'user', content: 'Se her' }] }, [image], { anthropic: true });
  assert.equal(claude.messages[0].content[1].source.media_type, 'image/png');
  const responses = addImages({ input: [{ role: 'user', content: 'Se her' }] }, [image], { responses: true });
  assert.equal(responses.input[0].content[1].type, 'input_image');
  const mistral = addImages({ messages: [{ role: 'user', content: 'Se her' }] }, [image], { mistral: true });
  assert.equal(mistral.messages[0].content[1].image_url, image.dataURL);
  // Alt andet end et rent PNG afvises, og uden en brugerbesked sendes billedet ikke.
  assert.throws(() => addImages({ messages: [{ role: 'user', content: 'x' }] }, [{ dataURL: 'data:image/svg+xml;base64,AAAA' }], {}), /ændret/);
  assert.throws(() => addImages({ messages: [{ role: 'system', content: 'x' }] }, [image], {}), /mangler en brugerbesked/);
});

test('et ændret billede standser afsendelsen, og billeder tæller med i det samlede valg', async t => {
  const f = await fixture(t);
  const file = await f.write('skaermbillede.png', PNG);
  const offered = await f.materials.offerFiles(f.chat, [file]);
  const review = await f.materials.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] });
  const attached = await f.materials.attach(f.chat, { ...handleOf(review), token: review.token });
  const prepared = await f.materials.resolveSelection(f.chat, handleOf(attached));
  assert.equal(prepared.files[0].kind, 'image');
  await fs.writeFile(file, Buffer.concat([PNG, Buffer.alloc(0)]));
  await fs.writeFile(file, PNG.subarray(0, PNG.length - 1));
  await assert.rejects(f.materials.assertPrepared(f.chat, prepared), /ændret/);
});
