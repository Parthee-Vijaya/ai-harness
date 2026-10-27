const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ChatMaterials } = require('../core/chat-materials.cjs');
const { pdfText } = require('../core/chat-media.cjs');
const { pdf } = require('./pdf-fixture.cjs');
// En PDF læses som ren tekst i en egen proces. Prøverne bruger den rigtige læser; teksten i prøvefilerne er ASCII,
// fordi selve prøve-PDF'en skrives med en simpel skrifttype.
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-pdf-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const materials = new ChatMaterials({});
  const chat = { id: 'samtale-1', project: { root }, generation: 0, running: false, sending: false, starting: false, finishing: null, prepared: null };
  const write = async (name, data) => { const file = path.join(root, name); await fs.writeFile(file, data); return file; };
  return { root, materials, chat, write };
}
const handleOf = state => ({ scope: state.scope, revision: state.revision });

test('den lokale PDF-laeser giver tekst med sidetal og ingen OCR', async () => {
  const result = await pdfText(pdf('Store sal koster 1200 kr.'));
  assert.deepEqual(result.pages, [{ page: 1, text: 'Store sal koster 1200 kr.' }]);
  assert.match(result.text, /^\[Side 1\]\nStore sal koster 1200 kr\.$/);
  const flere = await pdfText(pdf('Lokaleoversigt', 3));
  assert.equal(flere.pages.length, 3);
  assert.match(flere.text, /\[Side 3\]/);
});

test('en PDF uden tekst siger det i stedet for at lade som om, den blev laest', async () => {
  await assert.rejects(pdfText(pdf('', 1)), /ingen tekst, der kan udtrækkes|ikke udført OCR/);
  await assert.rejects(pdfText(Buffer.from('ikke en PDF')), /kunne ikke læses sikkert/);
});

test('en PDF bliver en vedhaeftning med sider, der kan gennemgaas', async t => {
  const f = await fixture(t);
  const file = await f.write('tilbud.pdf', pdf('Store sal koster 1200 kr.'));
  const offered = await f.materials.offerFiles(f.chat, [file]);
  assert.equal(offered.candidates[0].kind, 'pdf');
  const review = await f.materials.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] });
  const document = review.files[0];
  assert.equal(document.kind, 'pdf');
  assert.equal(document.mime, 'application/pdf');
  assert.deepEqual(document.pages, [{ page: 1, text: 'Store sal koster 1200 kr.' }]);
  assert.match(document.text, /Store sal koster 1200 kr\./);
  assert.equal(JSON.stringify(review).includes(f.root), false);
  const attached = await f.materials.attach(f.chat, { ...handleOf(review), token: review.token });
  assert.deepEqual(attached.selected.map(item => item.kind), ['pdf']);
});

test('en PDF med en mulig noegle kan ikke deles, og en aendret PDF standser afsendelsen', async t => {
  const f = await fixture(t);
  const hemmelig = await f.write('noegler.pdf', pdf('api_key = "hemmelig-vaerdi-12345678"'));
  const offered = await f.materials.offerFiles(f.chat, [hemmelig]);
  await assert.rejects(f.materials.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] }), /nøgle eller adgangskode/);
  const file = await f.write('tilbud.pdf', pdf('Store sal koster 1200 kr.'));
  const next = await f.materials.offerFiles(f.chat, [file]);
  const review = await f.materials.preview(f.chat, { ...handleOf(next), ids: [next.candidates[0].id] });
  const attached = await f.materials.attach(f.chat, { ...handleOf(review), token: review.token });
  const prepared = await f.materials.resolveSelection(f.chat, handleOf(attached));
  await fs.writeFile(file, pdf('Store sal koster 9999 kr.'));
  await assert.rejects(f.materials.assertPrepared(f.chat, prepared), /ændret/);
});

test('graenserne haandhaeves, og en laeser, der ikke kan startes, siger det', async t => {
  const f = await fixture(t);
  const file = await f.write('mange.pdf', pdf('Side', 2));
  // Prøven kan give sin egen udtrækning; så er det den, der bruges, og ikke den separate proces.
  const egen = new ChatMaterials({ extract: { extractPDF: async () => ({ pages: [{ page: 1, text: 'Erstattet' }], text: '[Side 1]\nErstattet' }) } });
  const offered = await egen.offerFiles(f.chat, [file]);
  const review = await egen.preview(f.chat, { ...handleOf(offered), ids: [offered.candidates[0].id] });
  assert.match(review.files[0].text, /Erstattet/);
  const uden = new ChatMaterials({ extract: { extractPDF: 'ikke en funktion' } });
  const next = await uden.offerFiles(f.chat, [file]);
  await assert.rejects(uden.preview(f.chat, { ...handleOf(next), ids: [next.candidates[0].id] }), /PDF-læser kunne ikke startes/);
});
