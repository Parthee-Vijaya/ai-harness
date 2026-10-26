// Execute the complete production UI module with synthetic DOM/IPC boundaries,
// following the existing hosting/idea UI harness. No providers or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { select, serialize } = require('../core/network-report.cjs');
const source = fs.readFileSync(path.join(__dirname, '../ui/network-report.js'), 'utf8');
const now = Date.parse('2026-10-26T19:00:00Z');
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function snapshot() {
  return { scope: 'aura-only', startedAt: '2026-10-26T18:00:00Z', dropped: 4, persistence: { status: 'unavailable' },
    coverage: [{ category: 'subprocess', status: 'unknown', note: 'Underprocesser er endnu ikke fuldt registreret.' }],
    limits: ['Ukendt dækning betyder ikke nul kald.'], records: [
      { host: 'old.example', startedAt: '2026-10-26T17:59:00Z', category: 'model', purpose: 'model-response', method: 'POST', status: 'completed', httpStatus: 200, attempt: 1 },
      { host: 'api.example', startedAt: '2026-10-26T18:58:00Z', category: 'idea', purpose: 'idea-refinement', method: 'POST', status: 'failed', httpStatus: 429, attempt: 2, headersMs: 1250, firstBodyMs: null, totalMs: 1300, sentBytes: 2000, receivedBytes: null },
      { host: '127.0.0.1', locality: 'loopback', startedAt: '2026-10-26T18:59:00Z', category: 'catalog', purpose: 'model-catalog', method: 'GET', status: 'headers', httpStatus: 200, attempt: null, headersMs: 0, firstBodyMs: null, totalMs: null, sentBytes: null, receivedBytes: null }
    ] };
}
function fixture({ value = snapshot(), read, save } = {}) {
  const nodes = new Map(), calls = [], exports = [];
  let htmlWrites = 0, document;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this._text = ''; this._value = ''; this.disabled = false; this.hidden = false; this.open = false; }
    set id(value) { this._id = value; nodes.set(value, this); } get id() { return this._id; }
    set textContent(value) { this._text = value == null ? '' : String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set value(value) { this._value = String(value); } get value() { return this._value; }
    set innerHTML(value) {
      assert.equal(this.tagName, 'dialog'); assert.equal(++htmlWrites, 1, 'Only the fixed dialog template may use HTML');
      for (const match of value.matchAll(/<(\w+)[^>]*\sid="([^"]+)"[^>]*>/g)) {
        const element = new Element(match[1]); element.id = match[2]; this.children.push(element);
      }
      nodes.get('network-period').value = 'session';
      this.closeButtons = [new Element('button'), new Element('button')];
      this.children.push(...this.closeButtons);
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; this._text = ''; if (this.tagName === 'select') this.value = children[0]?.value || ''; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatch(type) { for (const fn of this.listeners[type] || []) fn({ type }); }
    querySelectorAll(selector) { assert.equal(selector, '[data-network-close]'); return this.closeButtons; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
  }
  const opener = new Element('button'); opener.id = 'network-report-open';
  document = { body: new Element('body'), activeElement: null, createElement: tag => new Element(tag), getElementById: id => nodes.get(id) || null };
  const harness = {
    networkReport(...args) { calls.push({ method: 'read', args }); return read ? read(...args) : Promise.resolve({ ok: true, value }); },
    networkReportSave(...args) {
      calls.push({ method: 'save', args });
      const input = args[0]; exports.push(serialize(select(value, input.filters, now), input.format));
      return save ? save(...args) : Promise.resolve({ ok: true, value: true });
    }
  };
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(source, { document, window: { harness }, Date: Clock,
    Option: function (text, value) { const element = new Element('option'); element.textContent = text; element.value = value; return element; }
  }, { filename: 'network-report.js' });
  return { nodes, calls, exports, document, get: id => nodes.get(id),
    open() { opener.dispatch('click'); }, close() { nodes.get('network-report-dialog').close(); },
    change(id, value) { const element = nodes.get(id); element.value = value; element.dispatch('change'); },
    tick: () => new Promise(resolve => setImmediate(resolve)) };
}

test('report reads only main-owned metadata and filters locally without another network/report call', async () => {
  const f = fixture(); f.open(); await f.tick();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].method, 'read'); assert.equal(f.calls[0].args[0], undefined); assert.equal(f.calls[0].args[1], null);
  assert.match(f.get('network-report-summary').textContent, /^2 registrerede kald/);
  f.change('network-period', 'all'); assert.equal(f.get('network-report-rows').children.length, 3);
  f.change('network-period', '5m'); f.change('network-category', 'idea'); f.change('network-status', 'failed');
  assert.equal(f.get('network-report-rows').children.length, 1); assert.match(f.get('network-report-rows').textContent, /api\.example.*Forfin idé.*429/);
  assert.equal(f.calls.length, 1, 'Filtering must not trigger a provider call');
  f.change('network-status', 'completed'); assert.equal(f.get('network-report-empty').hidden, false);
});

test('unknown measurements remain visibly unknown; localhost, missing persistence and coverage stay explicit', async () => {
  const f = fixture(); f.open(); await f.tick();
  const local = f.get('network-report-rows').children[0], cells = local.children;
  assert.match(local.textContent, /Lokal transportadresse/); assert.match(local.textContent, /Svar startet · 200/);
  assert.equal(cells[4].textContent, '0 s', 'A measured zero is distinct from unknown');
  for (const index of [5, 6, 7]) assert.equal(cells[index].textContent, 'Ikke målt');
  assert.equal(cells[8].textContent, 'Ikke måltIkke målt');
  assert.match(f.get('network-report-retention').textContent, /4 ældre registreringer/);
  assert.match(f.get('network-report-retention').textContent, /Lokal lagring fejlede/);
  assert.match(f.get('network-coverage-list').textContent, /Ukendt dækning betyder ikke nul kald/);
});

test('closing and reopening ignores a late earlier read, including earlier failures', async () => {
  for (const fail of [false, true]) {
    const earlier = deferred(), current = deferred(); let reads = 0;
    const f = fixture({ read: () => (++reads === 1 ? earlier : current).promise });
    f.open(); assert.equal(f.get('network-report-json').disabled, true); f.close();
    assert.equal(f.document.activeElement, f.get('network-report-open'));
    f.open(); current.resolve({ ok: true, value: snapshot() }); await f.tick();
    const before = f.get('network-report-rows').textContent;
    if (fail) earlier.reject(Error('private raw error')); else earlier.resolve({ ok: true, value: { ...snapshot(), records: [] } });
    await f.tick(); assert.equal(f.get('network-report-rows').textContent, before);
    assert.equal(f.get('network-report-feedback').textContent, ''); assert.equal(f.get('network-report-json').disabled, false);
  }
});

test('export sends only format and active filters, uses main data, and preserves unknowns and coverage', async () => {
  const f = fixture(); f.open(); await f.tick(); f.change('network-period', 'all'); f.change('network-category', 'idea');
  await f.get('network-report-json').onclick();
  const sent = f.calls.find(call => call.method === 'save');
  assert.deepEqual(Object.keys(sent.args[0]).sort(), ['filters', 'format']); assert.equal(sent.args[1], null);
  const json = JSON.parse(f.exports[0]); assert.equal(json.records.length, 1); assert.equal(json.records[0].firstBodyMs, null); assert.equal(json.coverage[0].status, 'unknown');
  assert.match(f.get('network-report-feedback').textContent, /gemt lokalt/);
  await f.get('network-report-csv').onclick(); assert.match(f.exports[1], /Ukendt dækning betyder ikke nul kald/);
  assert.equal(f.get('network-report-csv').disabled, false); assert.equal(f.get('network-report-json').disabled, false);
});

test('late export success/failure cannot overwrite the reopened report or keep its controls disabled', async () => {
  for (const fail of [false, true]) {
    const pending = deferred(), f = fixture({ save: () => pending.promise }); f.open(); await f.tick();
    const exportOperation = f.get('network-report-json').onclick(); assert.equal(f.get('network-report-json').disabled, true);
    f.close(); f.open(); await f.tick();
    if (fail) pending.reject(Error('private file path')); else pending.resolve({ ok: true, value: true });
    await exportOperation; assert.equal(f.get('network-report-feedback').textContent, ''); assert.equal(f.get('network-report-json').disabled, false);
  }
});

test('read/save failures show bounded messages and report content is always plain text', async () => {
  const badRead = fixture({ read: async () => ({ ok: false, error: '<script>private</script>' }) }); badRead.open(); await badRead.tick();
  assert.equal(badRead.get('network-report-json').disabled, true); assert.match(badRead.get('network-report-feedback').textContent, /kunne ikke læses/);
  assert.doesNotMatch(badRead.get('network-report-feedback').textContent, /script|private/);
  const value = snapshot(); value.records[1].host = '<img src=x onerror=private()> '; value.coverage[0].note = '<script>private()</script>';
  const f = fixture({ value, save: async () => ({ ok: false, error: '/private/path' }) }); f.open(); await f.tick();
  assert.match(f.get('network-report-rows').textContent, /<img src=x onerror=private\(\)>/);
  assert.match(f.get('network-coverage-list').textContent, /<script>private\(\)<\/script>/);
  await f.get('network-report-json').onclick(); assert.match(f.get('network-report-feedback').textContent, /kunne ikke gemmes/); assert.doesNotMatch(f.get('network-report-feedback').textContent, /private/);
  assert.equal(f.get('network-report-json').disabled, false);
});
