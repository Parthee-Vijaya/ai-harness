const { test } = require('node:test');
const assert = require('node:assert/strict');
const { render, cells, linkURL } = require('../ui/markdown.js');
const { externalURL } = require('../core/external-links.cjs');

// Et lille DOM i hukommelsen: textContent bliver altid til tekst og aldrig til HTML.
function element(tag = 'div') {
  const doc = { createElement: name => make(name) };
  function make(name) {
    return {
      tagName: name.toUpperCase(), ownerDocument: doc, children: [], classList: { add() {} }, setAttribute() {},
      append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = [...items]; },
      get textContent() { return this.children.map(x => typeof x === 'string' ? x : x.textContent).join(''); },
      set textContent(text) { this.children = [String(text)]; }
    };
  }
  return make(tag);
}
const all = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.filter(c => typeof c === 'object').flatMap(c => all(c, tag))];

test('tabeller viser sikker tekst og | i kode, og uafsluttet kode forbliver kode under streaming', () => {
  assert.deepEqual(cells('| A\\|B | `x|y` |'), ['A|B', '`x|y`']);
  const el = element();
  render(el, '| Navn | Status |\n| --- | --- |\n| <img src=x onerror=alert(1)> | **Klar** |\n\n```js\nconst x = "<script>";');
  assert.equal(all(el, 'TABLE').length, 1); assert.equal(all(el, 'TH').length, 2);
  assert.equal(all(el, 'IMG').length, 0); assert.equal(all(el, 'SCRIPT').length, 0);
  assert.match(all(el, 'TD')[0].textContent, /<img/); assert.match(all(el, 'CODE').at(-1).textContent, /const x/);
  render(el, '**Færdig**\n\n- Punkt\n\n```js\nvalue();\n```');
  assert.equal(all(el, 'TABLE').length, 0); assert.equal(all(el, 'UL').length, 1); assert.equal(all(el, 'STRONG').length, 1);
});

test('kopiering og links sker kun ved et klik, og linket viser sit værtsnavn', async () => {
  const el = element(), copies = [], opens = [], source = 'Læs [vejledning](https://example.org/docs).\n\n```js\nconst x = 1;\n```';
  render(el, source, { copy: async text => copies.push(text), openLink: async url => opens.push(url) });
  assert.deepEqual(copies, []); assert.deepEqual(opens, []);
  const buttons = all(el, 'BUTTON');
  await buttons.find(b => b.textContent === 'Kopiér kode').onclick();
  await buttons.find(b => b.textContent === 'Kopiér tekst').onclick();
  assert.deepEqual(copies, ['const x = 1;', source]);
  const link = buttons.find(b => b.textContent.startsWith('vejledning'));
  assert.equal(link.textContent, 'vejledning (example.org)', 'adressens vært står synligt');
  await link.onclick(); assert.deepEqual(opens, ['https://example.org/docs']);
});

test('et link med parenteser åbner hele adressen', async () => {
  const el = element(), opens = [];
  render(el, 'Se [Kalundborg](https://da.wikipedia.org/wiki/Kalundborg_(by)) for mere.', { openLink: async url => opens.push(url) });
  const link = all(el, 'BUTTON')[0];
  await link.onclick(); assert.deepEqual(opens, ['https://da.wikipedia.org/wiki/Kalundborg_(by)']);
  assert.match(el.textContent, /for mere\.$/, 'ingen løs parentes bagefter');
});

test('under streaming er der ingen kopiknapper; de kommer, når svaret er færdigt', () => {
  const el = element(), options = { copy: async () => {} };
  render(el, 'Svar\n\n```\nkode\n```', { ...options, complete: false });
  assert.equal(all(el, 'BUTTON').length, 0);
  render(el, 'Svar\n\n```\nkode\n```', { ...options, complete: true });
  assert.deepEqual(all(el, 'BUTTON').map(b => b.textContent), ['Kopiér kode', 'Kopiér tekst']);
});

test('rendereren og hovedprocessen afviser farlige adresser, loginoplysninger, kontroltegn og ekstra felter', () => {
  for (const url of ['file:///tmp/x', 'java' + 'script:alert(1)', 'data:text/html,x', 'vscode://command/x', 'https://user:password@example.org', 'https://example.org/%0aevil', 'https://example.org/\nevil']) {
    assert.equal(linkURL(url), null); assert.throws(() => externalURL({ url }));
  }
  assert.equal(externalURL({ url: 'https://example.org/path?q=1' }), 'https://example.org/path?q=1');
  assert.throws(() => externalURL({ url: 'https://example.org', command: 'exec' }));
  const el = element();
  render(el, '[usikker](file:///tmp/x) <script>alert(1)</script>', { openLink() { throw Error('må ikke åbnes'); } });
  assert.equal(all(el, 'BUTTON').length, 0); assert.equal(all(el, 'SCRIPT').length, 0);
});

test('kopiering af kode bevarer tomme linjer og afhænger ikke af pyntet visning', async () => {
  const el = element(), copies = [];
  render(el, '```txt\n\n  behold\n\n```', { copy: async text => copies.push(text), decorate: target => { all(target, 'CODE')[0].textContent = 'pyntet tekst'; } });
  await all(el, 'BUTTON').find(b => b.textContent === 'Kopiér kode').onclick();
  assert.deepEqual(copies, ['\n  behold\n']);
});

test('et kort svar på én linje får ingen Kopiér tekst, et langt svar gør', () => {
  const el = element(), options = { copy: async () => {} };
  render(el, 'Ja, det er gjort.', options);
  assert.equal(all(el, 'BUTTON').length, 0);
  render(el, 'Et langt svar. '.repeat(20), options);
  assert.deepEqual(all(el, 'BUTTON').map(b => b.textContent), ['Kopiér tekst']);
});

test('linkets tekst kan ikke vende eller efterligne værtsnavnet', () => {
  const el = element(), options = { openLink: async () => {} };
  render(el, '[kd.grobdnulak‮](https://kd.grobdnulak.live.ai/)', options);
  const button = all(el, 'BUTTON')[0];
  assert.equal(button.textContent.includes('‮'), false, 'retningstegn er fjernet');
  assert.deepEqual(button.children.filter(c => typeof c === 'object').map(c => c.tagName), ['BDI', 'SPAN']);
  assert.equal(button.children.at(-1).textContent, '(kd.grobdnulak.live.ai)', 'den rigtige vært står for sig');
  render(el, '[Kalundborg Kommune (kalundborg.dk)](https://evil.example/)', options);
  assert.equal(all(el, 'BUTTON')[0].children.at(-1).textContent, '(evil.example)');
});

test('løse adresser og <adresser> kan klikkes uden afsluttende tegnsætning', async () => {
  const el = element(), opens = [];
  render(el, 'Se https://docs.python.org/3/. Og <https://example.org/a>, samt https://da.wikipedia.org/wiki/Kalundborg_(by).', { openLink: async url => opens.push(url) });
  for (const button of all(el, 'BUTTON')) await button.onclick();
  assert.deepEqual(opens, ['https://docs.python.org/3/', 'https://example.org/a', 'https://da.wikipedia.org/wiki/Kalundborg_(by)']);
  assert.match(el.textContent, /3\/\. Og /); assert.match(el.textContent, /\(by\)\.$/);
  const code = element(); render(code, '`https://inde-i-kode.example/`', { openLink: async () => {} });
  assert.equal(all(code, 'BUTTON').length, 0, 'en adresse i kode forbliver kode');
});
