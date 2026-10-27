// Statuspanelet i opsætningen. Grønt må kun stå, når en kontrol af netop den forbindelse faktisk er lykkedes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('../ui/setup-status.js');

const ok = { status: 'ok', count: 3 };

test('panelet er tomt og roligt, før man har valgt noget', () => {
  const view = describe();
  assert.equal(view.state, 'none');
  assert.equal(view.provider, 'Ingen udbyder valgt endnu');
  assert.equal(view.connection, 'Dit næste valg.');
  assert.match(view.note, /forbinder ikke og sender ikke noget/);
  assert.deepEqual(view.active, [true, false, false]);
});

test('en udbyder, musen hviler på, er en forhåndsvisning og ikke et valg', () => {
  const view = describe({ kind: 'corti', name: 'Corti', preview: true });
  assert.equal(view.state, 'preview');
  assert.equal(view.provider, 'Corti');
  assert.match(view.connection, /Forhåndsvisning/);
  assert.match(view.note, /Du kigger kun/);
  assert.deepEqual(view.active, [true, true, false]);
});

test('grønt kræver en gemt forbindelse, dens egen kontrol og mindst én model', () => {
  const grøn = describe({ kind: 'anthropic', name: 'Anthropic API', saved: true, verified: true, check: ok });
  assert.equal(grøn.state, 'checked');
  assert.equal(grøn.connection, 'Kontrolleret i denne session.');
  assert.equal(grøn.model, 'Vælges i projektet.');
  assert.deepEqual(grøn.active, [true, true, true]);
  // Hver enkelt forudsætning, der mangler, fjerner det grønne igen.
  const uden = [
    ['ingen gemt forbindelse', { saved: false, verified: true, check: ok }],
    ['kontrollen hører til en anden forbindelse', { saved: true, verified: false, check: ok }],
    ['ingen kontrol i denne session', { saved: true, verified: true, check: null }],
    ['kataloget svarede uden modeller', { saved: true, verified: true, check: { status: 'ok', count: 0 } }]
  ];
  for (const [hvorfor, input] of uden) {
    const view = describe({ kind: 'anthropic', name: 'Anthropic API', ...input });
    assert.notEqual(view.state, 'checked', hvorfor);
    assert.equal(view.active[2], false, hvorfor);
    assert.equal(view.model, 'Vælges, når forbindelsen svarer.', hvorfor);
  }
});

test('en gemt forbindelse uden kontrol siger det selv', () => {
  const view = describe({ kind: 'mistral', name: 'Mistral API', saved: true });
  assert.equal(view.state, 'saved');
  assert.equal(view.connection, 'Gemt lokalt.');
  assert.match(view.note, /ikke kontrolleret i denne session/);
});

test('en kontrol i gang og en fejl går forud for alt andet', () => {
  const igang = describe({ kind: 'corti', name: 'Corti', saved: true, verified: true, check: { status: 'checking' } });
  assert.equal(igang.state, 'pending');
  assert.match(igang.note, /Der sendes ingen projektfiler/);
  const fejl = describe({ kind: 'corti', name: 'Corti', saved: true, verified: true, check: { status: 'error', detail: 'HTTP 401' } });
  assert.equal(fejl.state, 'error');
  assert.match(fejl.note, /Dine valg er bevaret/);
  assert.equal(fejl.active[2], false);
  // Udbyderens egen fejltekst hører hjemme i formularen, ikke i det rolige panel.
  assert.ok(!JSON.stringify(fejl).includes('HTTP 401'));
});

test('en gemt forbindelse vinder over en forhåndsvisning, og alt er almindelig tekst', () => {
  const view = describe({ kind: 'anthropic', name: 'Anthropic API', saved: true, preview: true });
  assert.equal(view.connection, 'Gemt lokalt.');
  for (const state of ['none', 'preview', 'saved', 'checked', 'pending', 'error']) {
    const input = { none: {}, preview: { kind: 'corti', preview: true }, saved: { kind: 'corti', saved: true },
      checked: { kind: 'corti', saved: true, verified: true, check: ok },
      pending: { kind: 'corti', saved: true, check: { status: 'checking' } },
      error: { kind: 'corti', saved: true, check: { status: 'error' } } }[state];
    const result = describe(input);
    assert.equal(result.state, state);
    for (const text of [result.provider, result.connection, result.model, result.note])
      assert.ok(typeof text === 'string' && text && !/[<>&]/.test(text), `${state}: ${text}`);
  }
});
