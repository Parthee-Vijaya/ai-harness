const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../ui/app-version.js'), 'utf8');
function harness(updatesState) {
  const labels = Array.from({ length: 3 }, () => ({ textContent: '', setAttribute(name, value) { this[name] = value; } }));
  const logos = [{ title: 'Aura' }];
  const pending = vm.runInNewContext(code, {
    window: { harness: { updatesState } },
    document: { querySelectorAll: selector => selector === '[data-app-version]' ? labels : logos }
  });
  return { labels, logos, pending };
}
test('the exact installed stable, beta and other prerelease versions are displayed as text', async () => {
  for (const version of ['0.6.0-beta.1', '1.0.0', '1.2.3-rc.2+arm64']) {
    let calls = 0;
    const view = harness(async (input, owner) => { calls++; assert.equal(input, undefined); assert.equal(owner, null); return { ok: true, value: { current: version } }; });
    await view.pending;
    assert.equal(calls, 1);
    for (const label of view.labels) { assert.equal(label.textContent, version); assert.equal(label['aria-label'], `Version ${version}`); }
    assert.equal(view.logos[0].title, `Aura ${version}`);
  }
});
test('missing, unsafe or unavailable metadata leaves labels alone without throwing', async () => {
  for (const result of [{ ok: false }, { ok: true, value: {} }, { ok: true, value: { current: '<img src=x onerror=alert(1)>' } }, { ok: true, value: { current: 42 } }]) {
    const view = harness(async () => result); await view.pending;
    assert.ok(view.labels.every(label => label.textContent === '')); assert.equal(view.logos[0].title, 'Aura');
  }
  const view = harness(async () => { throw Error('IPC unavailable'); }); await view.pending;
  assert.ok(view.labels.every(label => label.textContent === ''));
});
test('a pending version lookup does not block execution of the next startup script', async () => {
  let resolve;
  const view = harness(() => new Promise(done => { resolve = done; }));
  assert.ok(view.labels.every(label => label.textContent === ''));
  resolve({ ok: true, value: { current: '0.6.0-beta.1' } }); await view.pending;
  assert.equal(view.labels[0].textContent, '0.6.0-beta.1');
});
