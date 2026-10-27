// Modelstøtte: kun udbyderens egne oplysninger, og "ikke oplyst" må aldrig blive til understøttet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalogSupport } = require('../core/model-support.cjs');

test('udbyderens oplysninger gengives som de er, og alt ukendt bliver til ikke oplyst', () => {
  assert.equal(catalogSupport(null), null, 'uden en model er der intet at oplyse');
  assert.deepEqual(catalogSupport({ id: 'm' }), { checkedAt: null, model: { tools: null, images: null }, route: null });
  assert.deepEqual(catalogSupport({ capabilities: { tools: true, vision: false } }).model, { tools: true, images: false });
  // Alt andet end en boolean er ikke en oplysning: hverken en streng, et tal eller en manglende nøgle.
  for (const value of ['ja', 1, 0, '', undefined, null, {}])
    assert.deepEqual(catalogSupport({ capabilities: { tools: value, vision: value } }).model, { tools: null, images: null }, JSON.stringify(value));
});

test('den valgte rute oplyses for sig, så en rute uden støtte ikke skjules af modellens', () => {
  const model = { capabilities: { tools: true, vision: true } };
  assert.equal(catalogSupport(model).route, null, 'uden en rute vises ingen rutelinje');
  const support = catalogSupport(model, { capabilities: { tools: true, vision: false } });
  assert.deepEqual(support.model, { tools: true, images: true });
  assert.deepEqual(support.route, { tools: true, images: false });
});

test('katalogets tidspunkt følger med, men kun når det er en rigtig dato', () => {
  const model = { capabilities: { tools: true } };
  assert.equal(catalogSupport(model, null, '2026-10-27T08:00:00.000Z').checkedAt, '2026-10-27T08:00:00.000Z');
  for (const value of ['i går', '', 17, null, undefined]) assert.equal(catalogSupport(model, null, value).checkedAt, null, JSON.stringify(value));
});

test('der er intet felt til Auras egne iagttagelser', () => {
  const support = catalogSupport({ capabilities: { tools: true, vision: true } }, { capabilities: { tools: true } }, '2026-10-27T08:00:00.000Z');
  assert.deepEqual(Object.keys(support).sort(), ['checkedAt', 'model', 'route']);
  // En måling, en prøve eller et bevis må ikke kunne smugles med gennem kataloget.
  const text = JSON.stringify(catalogSupport({ capabilities: { tools: true }, measurements: [{ outcome: 'passed' }], evidence: ['bevis'] }));
  for (const word of ['measurement', 'evidence', 'passed', 'bevis']) assert.ok(!text.includes(word), word);
});
