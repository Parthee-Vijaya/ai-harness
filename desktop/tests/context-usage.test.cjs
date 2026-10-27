const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ContextUsage } = require('../core/context-usage.cjs');
const binding = { connectionID: 'lokal', modelID: 'model-a', routeID: '', engineID: 'opencode@1.18.33', sessionID: 'session-1', limit: 200000 };
const step = (input, cacheRead = 0, cacheWrite = 0) => ({ type: 'step-finish', tokens: { input, cache: { read: cacheRead, write: cacheWrite } } });

test('målingen er hele kaldets input mod Auras grænse, ikke samtalens samlede forbrug', () => {
  const usage = new ContextUsage({ now: () => 1000 });
  assert.equal(usage.bind(binding).reason, 'unmeasured');
  const snapshot = usage.observe(step(50000, 30000, 20000));
  assert.equal(snapshot.inputTokens, 100000); assert.equal(snapshot.limitTokens, 200000);
  assert.equal(snapshot.percentage, 50); assert.equal(snapshot.known, true); assert.equal(snapshot.reason, null);
  assert.equal(snapshot.at, 1000);
  // Et nyt kald erstatter målingen; den lægges ikke oven i den forrige.
  assert.equal(usage.observe(step(10000)).inputTokens, 10000);
});

test('et manglende eller ugyldigt tal gør konteksten ukendt i stedet for at gætte', () => {
  for (const tokens of [{ input: 1000 }, { input: 1000, cache: { read: null, write: 0 } }, { input: -1, cache: { read: 0, write: 0 } }, { input: 1.5, cache: { read: 0, write: 0 } }, { input: '1000', cache: { read: 0, write: 0 } }]) {
    const usage = new ContextUsage(); usage.bind(binding);
    const snapshot = usage.observe({ type: 'step-finish', tokens });
    assert.equal(snapshot.known, false); assert.equal(snapshot.inputTokens, null);
    assert.equal(snapshot.percentage, null); assert.equal(snapshot.reason, 'unknown-input');
  }
});

test('en oplyst måling uden grænse giver ingen procent', () => {
  const usage = new ContextUsage(); usage.bind({ ...binding, limit: 0 });
  const snapshot = usage.observe(step(1000));
  assert.equal(snapshot.inputTokens, 1000); assert.equal(snapshot.limitTokens, null);
  assert.equal(snapshot.percentage, null); assert.equal(snapshot.reason, 'unknown-limit');
});

test('en måling følger sin egen forbindelse, model, rute, motor og modelsession', () => {
  for (const change of [{ connectionID: 'anden' }, { modelID: 'model-b' }, { routeID: 'rute' }, { engineID: 'opencode@1.19.0' }, { sessionID: 'session-2' }]) {
    const usage = new ContextUsage(); usage.bind(binding); usage.observe(step(100000));
    const snapshot = usage.bind({ ...binding, ...change });
    assert.equal(snapshot.known, false); assert.equal(snapshot.inputTokens, null); assert.equal(snapshot.reason, 'binding-changed');
  }
  // Samme binding igen bevarer målingen, fx når brugerfladen henter tilstanden på ny.
  const usage = new ContextUsage(); usage.bind(binding); usage.observe(step(100000));
  assert.equal(usage.bind({ ...binding }).inputTokens, 100000);
});

test('uden binding måles intet, og en ugyldig binding afvises', () => {
  const usage = new ContextUsage();
  assert.equal(usage.observe(step(1000)).known, false);
  for (const value of [null, {}, { modelID: 'model-a' }, { modelID: 'model-a', sessionID: '' }, { modelID: 'model-a', sessionID: 'session-1', routeID: 'linje\nskift' }, { modelID: 'model-a', sessionID: 'session-1', engineID: 'x'.repeat(301) }]) {
    assert.equal(usage.bind(value).binding, null);
  }
  usage.bind(binding);
  // Kun motorens step-finish tæller som en måling.
  for (const part of [null, { type: 'text' }, { type: 'tool', tokens: { input: 5, cache: { read: 0, write: 0 } } }]) assert.equal(usage.observe(part).known, false);
});
