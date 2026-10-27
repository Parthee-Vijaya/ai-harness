const { test } = require('node:test');
const assert = require('node:assert/strict');
const display = require('../ui/context-display.js');
const selected = { connectionID: 'lokal', modelID: 'model-a', routeID: '' };
const snapshot = (over = {}) => ({ known: true, inputTokens: 100000, limitTokens: 200000, percentage: 50, at: 1, reason: null, binding: { ...selected, engineID: 'opencode@1.18.33', sessionID: 'session-1' }, ...over });

test('detaljerne nævner altid, at tallet er det seneste kald og ikke samtalens forbrug', () => {
  const text = display.describe(snapshot(), selected);
  assert.match(text.detail, /100\.000 af 200\.000 tokens kontekst/);
  assert.match(text.detail, /50 %/);
  assert.match(text.detail, /senest afsluttede kald, ikke samtalens samlede forbrug/);
  assert.equal(text.warning, '', 'halvvejs er ikke nær grænsen');
});

test('advarslen i første lag kommer først nær grænsen', () => {
  assert.equal(display.describe(snapshot({ inputTokens: 158000, percentage: 79 }), selected).warning, '');
  const near = display.describe(snapshot({ inputTokens: 160000, percentage: 80 }), selected);
  assert.match(near.warning, /80 % af grænsen på 200\.000 tokens/);
  assert.match(near.warning, /Gør den kortere/);
});

test('en måling for en anden model eller rute vises ikke som den valgtes', () => {
  for (const other of [{ modelID: 'model-b' }, { connectionID: 'anden' }, { routeID: 'rute' }]) {
    const text = display.describe(snapshot(), { ...selected, ...other });
    assert.match(text.detail, /ikke målt for den valgte AI/); assert.equal(text.warning, '');
  }
  assert.match(display.describe(snapshot({ binding: null }), selected).detail, /måles, når det første modelkald er afsluttet/);
  assert.match(display.describe(null, selected).detail, /måles, når det første modelkald er afsluttet/);
});

test('ukendte tal står som ukendte, aldrig som nul eller et gæt', () => {
  assert.match(display.describe(snapshot({ known: false, inputTokens: null, percentage: null, reason: 'unknown-input' }), selected).detail, /oplyste ikke, hvor meget kontekst/);
  const limitless = display.describe(snapshot({ limitTokens: null, percentage: null, reason: 'unknown-limit' }), selected);
  assert.match(limitless.detail, /100\.000 tokens kontekst/); assert.match(limitless.detail, /Grænsen er ikke oplyst/);
  assert.equal(limitless.warning, '');
});
