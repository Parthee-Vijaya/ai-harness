// Nøglevinduet: egen session, egne filer, afsenderkontrol, oprydning og Gem alligevel. Electron er erstattet af
// attrapper, så vinduets regler kan afprøves uden en grafisk session. Alle nøgler her er opdigtede.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { KeyWindow, connectionPurpose, githubPurpose, SCHEME, PAGE } = require('../core/key-window.cjs');

const UI = path.join(__dirname, '..', 'ui');
const ORIGIN = PAGE.replace('/index.html', '');
const SECRET = 'sk-proj-SYNTETISK0123456789abcdefSYNTETISK';
const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };

class FakeContents {
  constructor() { this.mainFrame = { url: PAGE }; this.events = new Map(); this.openHandler = null; }
  on(event, fn) { push(this.events, event, fn); return this; }
  setWindowOpenHandler(fn) { this.openHandler = fn; }
  // Giver sandt, når mindst én lytter standsede hændelsen.
  fire(event) { let stopped = false; for (const fn of this.events.get(event) || []) fn({ preventDefault: () => { stopped = true; } }); return stopped; }
}
class FakeWindow {
  constructor(options = {}) { Object.assign(this, { options, destroyed: false, shown: false, size: null, menuRemoved: false, protection: null, loaded: [], events: new Map(), webContents: new FakeContents() }); }
  on(event, fn) { push(this.events, event, fn); return this; }
  once(event, fn) { push(this.events, event, fn); return this; }
  fire(event) { for (const fn of this.events.get(event) || []) fn(); }
  isDestroyed() { return this.destroyed; }
  show() { this.shown = true; }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.fire('closed'); }
  removeMenu() { this.menuRemoved = true; }
  setContentProtection(value) { this.protection = value; }
  setContentSize(width, height) { this.size = [width, height]; }
  loadURL(url) { this.loaded.push(url); return Promise.resolve(); }
}
class FakeSession {
  constructor(partition, options) {
    Object.assign(this, { partition, options, permissionRequest: null, permissionCheck: null, downloadHandlers: [], spellcheck: null, filter: null, protocols: new Map() });
    this.webRequest = { onBeforeRequest: fn => { this.filter = fn; } };
    this.protocol = { handle: (scheme, fn) => this.protocols.set(scheme, fn) };
  }
  setPermissionRequestHandler(fn) { this.permissionRequest = fn; }
  setPermissionCheckHandler(fn) { this.permissionCheck = fn; }
  setSpellCheckerEnabled(value) { this.spellcheck = value; }
  on(event, fn) { if (event === 'will-download') this.downloadHandlers.push(fn); }
}

function harness() {
  const sessions = [], windows = [], channels = new Map(), opened = [];
  const parent = new FakeWindow();
  const electron = {
    session: { fromPartition: (partition, options) => { const session = new FakeSession(partition, options); sessions.push(session); return session; } },
    ipcMain: { handle: (channel, fn) => channels.set(channel, fn) },
    BrowserWindow: function (options) { const win = new FakeWindow(options); windows.push(win); return win; }
  };
  const keyWindow = new KeyWindow({ electron, uiDir: UI, preload: '/attrap/preload.cjs', parent: () => parent, background: () => '#ffffff', title: 'Indtast nøgle', openAccount: kind => opened.push(kind) });
  const win = () => windows.at(-1), session = () => sessions.at(-1);
  // Som siden selv kalder: rigtig afsender, rigtig ramme, rigtig adresse.
  const page = () => ({ sender: win().webContents, senderFrame: win().webContents.mainFrame });
  const call = (channel, value, event) => channels.get(channel)(event === undefined ? page() : event, value);
  const openWindow = purpose => { const done = keyWindow.open(purpose); win().fire('ready-to-show'); return done; };
  return { keyWindow, electron, sessions, windows, channels, parent, opened, win, session, page, call, openWindow };
}
// Et formål, der kan styres fra testen.
function stub(overrides = {}) {
  const calls = { submitted: [], forgotten: 0 };
  return Object.assign({
    kind: 'openai', calls,
    context: { heading: 'Indtast din nøgle til OpenAI', label: 'API-nøgle', action: 'Kontrollér og gem', checking: 'Kontrollerer …', help: true, logo: 'provider-openai.svg', recipient: 'Nøglen sendes til api.openai.com.', warning: '' },
    async submit(raw) { calls.submitted.push(raw); return { receipt: { id: 'forbindelse-1' } }; },
    forget() { calls.forgotten++; }
  }, overrides);
}
const filter = (session, url) => new Promise(resolve => session.filter({ url }, resolve));
async function server(t, handler) {
  const s = http.createServer(handler); await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  t.after(() => { s.closeAllConnections(); s.close(); });
  return `http://127.0.0.1:${s.address().port}/v1`;
}
// En port, der lige er blevet ledig, så forbindelsen afvises med det samme.
const freePort = () => new Promise(resolve => { const s = http.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test('vinduet har sin egen session, kan ikke nå internettet og kan ikke navigere væk', async () => {
  assert.deepEqual(KeyWindow.scheme(), { scheme: SCHEME, privileges: { standard: true, secure: true } });
  const h = harness();
  const done = h.openWindow(stub());
  const session = h.session(), win = h.win();
  assert.equal(session.partition, 'aura-noegle', 'uden persist: sessionen lever kun i hukommelsen');
  assert.equal(session.options.cache, false);
  assert.equal(await new Promise(resolve => session.permissionRequest(null, 'media', resolve)), false);
  assert.equal(session.permissionCheck(), false);
  let download = false; session.downloadHandlers[0]({ preventDefault: () => { download = true; } });
  assert.ok(download, 'en download skal standses');
  assert.equal(session.spellcheck, false);
  assert.ok(session.protocols.has(SCHEME));
  assert.deepEqual(await filter(session, PAGE), { cancel: false });
  for (const url of ['https://api.openai.com/v1/models', 'http://127.0.0.1:1/', 'file:///etc/passwd', 'aura-noegle://andet/index.html', 'harness://app/index.html'])
    assert.deepEqual(await filter(session, url), { cancel: true }, url);
  const prefs = win.options.webPreferences;
  assert.equal(prefs.session, session, 'vinduet skal bruge den egne session');
  for (const [key, value] of [['sandbox', true], ['contextIsolation', true], ['nodeIntegration', false], ['nodeIntegrationInSubFrames', false], ['nodeIntegrationInWorker', false], ['webviewTag', false], ['webSecurity', true], ['allowRunningInsecureContent', false], ['devTools', false], ['spellcheck', false], ['navigateOnDragDrop', false]])
    assert.equal(prefs[key], value, key);
  assert.equal(prefs.preload, '/attrap/preload.cjs');
  assert.equal(win.options.modal, true); assert.equal(win.options.parent, h.parent); assert.equal(win.options.resizable, false);
  assert.equal(win.options.backgroundColor, '#ffffff'); assert.equal(win.options.title, 'Indtast nøgle');
  assert.ok(win.menuRemoved); assert.equal(win.protection, true);
  assert.deepEqual(win.loaded, [PAGE]);
  // Vinduet vises først, når siden har sagt, hvor højt det skal være, så det ikke skifter størrelse for øjnene af en.
  assert.equal(win.shown, false, 'vinduet vises ikke, før siden har sagt sin højde');
  await h.call('key-window:resize', 300);
  assert.ok(win.shown);
  assert.deepEqual(win.size, [520, 300]);
  assert.deepEqual(win.webContents.openHandler(), { action: 'deny' });
  for (const event of ['will-navigate', 'will-redirect', 'will-frame-navigate', 'will-attach-webview'])
    assert.ok(win.webContents.fire(event), event);
  h.keyWindow.close();
  assert.equal(await done, null);

  // Svarer siden slet ikke, vises vinduet alligevel efter en kort pause.
  const quiet = harness();
  const waiting = quiet.openWindow(stub());
  assert.equal(quiet.win().shown, false);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(quiet.win().shown, 'uden svar fra siden vises vinduet alligevel');
  quiet.keyWindow.close();
  assert.equal(await waiting, null);
});

test('siden får kun sine egne filer, med CSP og uden caching', async () => {
  const h = harness();
  const done = h.openWindow(stub());
  const serve = h.session().protocols.get(SCHEME);
  const page = await serve({ url: PAGE });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const csp = page.headers.get('content-security-policy');
  for (const rule of ["default-src 'none'", "script-src 'self'", "connect-src 'none'", "frame-ancestors 'none'", "form-action 'none'"]) assert.ok(csp.includes(rule), rule);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /id="key-value"/);
  for (const name of ['key-window.js', 'styles.css', 'provider-openai.svg', 'provider-github-pages.svg'])
    assert.equal((await serve({ url: `${ORIGIN}/${name}` })).status, 200, name);
  for (const url of [`${ORIGIN}/app.js`, `${ORIGIN}/index.js`, `${ORIGIN}/../main.cjs`, `${ORIGIN}/provider-x%2f..%2f..%2fmain.cjs`, `${ORIGIN}/findes-ikke.svg`, 'aura-noegle://andet/index.html'])
    assert.equal((await serve({ url })).status, 404, url);
  h.keyWindow.close();
  await done;
});

test('kun nøglevinduets egen side må kalde kanalerne', async () => {
  const h = harness();
  const purpose = stub();
  const done = h.openWindow(purpose);
  const win = h.win(), other = new FakeContents();
  assert.deepEqual(await h.call('key-window:context'), purpose.context);
  const channels = ['key-window:context', 'key-window:submit', 'key-window:save-anyway', 'key-window:cancel', 'key-window:help', 'key-window:resize'];
  const fakes = [
    ['hovedvinduet', { sender: other, senderFrame: other.mainFrame }],
    ['en anden ramme i vinduet', { sender: win.webContents, senderFrame: { url: PAGE } }],
    ['ingen ramme', { sender: win.webContents, senderFrame: null }],
    ['en fremmed afsender med den rigtige ramme', { sender: other, senderFrame: win.webContents.mainFrame }]
  ];
  for (const channel of channels)
    for (const [hvem, event] of fakes)
      await assert.rejects(() => h.call(channel, SECRET, event), /Adgang afvist/, `${channel} fra ${hvem}`);
  // Er rammen navigeret et andet sted hen, afvises den, selv om det er den samme ramme.
  win.webContents.mainFrame.url = 'https://example.invalid/';
  for (const channel of channels) await assert.rejects(() => h.call(channel, SECRET), /Adgang afvist/, `${channel} fra en navigeret ramme`);
  win.webContents.mainFrame.url = PAGE;
  assert.deepEqual(purpose.calls.submitted, [], 'ingen af dem må have sendt noget videre');
  // Hjælp åbner udbyderens side; vinduets højde holdes inden for sine grænser.
  await h.call('key-window:help');
  assert.deepEqual(h.opened, ['openai']);
  for (const [height, expected] of [[640, 640], [1200, 720], [100, 180], ['ikke et tal', null]]) {
    win.size = null;
    await h.call('key-window:resize', height);
    assert.deepEqual(win.size, expected === null ? null : [520, expected], String(height));
  }
  h.keyWindow.close();
  await done;
});

test('der er kun ét nøglevindue ad gangen, og det ryddes op ved luk, crash og nedlukning', async () => {
  const h = harness();
  const first = stub();
  const done = h.openWindow(first);
  await assert.rejects(() => h.keyWindow.open(stub()), /allerede åbent/);
  assert.equal(h.windows.length, 1);
  // Brugeren lukker vinduet: ingen kvittering, og en ventende nøgle glemmes.
  h.win().destroy();
  assert.equal(await done, null);
  assert.equal(first.calls.forgotten, 1);
  assert.equal(h.keyWindow.win, null);
  assert.equal(h.keyWindow.current, null);

  // Siden går ned: samme oprydning, og vinduet lukkes.
  const crashed = stub();
  const second = h.openWindow(crashed);
  const win = h.win();
  win.webContents.fire('render-process-gone');
  assert.equal(await second, null);
  assert.ok(win.destroyed, 'vinduet skal lukkes, når siden går ned');
  assert.equal(crashed.calls.forgotten, 1);

  // Nedlukning af appen lukker vinduet, og et kald bagefter afvises.
  const third = stub();
  const open = h.openWindow(third);
  const event = h.page();
  h.keyWindow.close();
  assert.equal(await open, null);
  assert.equal(third.calls.forgotten, 1);
  await assert.rejects(() => h.call('key-window:submit', SECRET, event), /Adgang afvist/);
  // Sessionen og kanalerne sættes kun op én gang.
  assert.equal(h.sessions.length, 1);
  assert.equal(h.windows.length, 3);
  // Lukker hovedvinduet, kan nøglevinduet ikke åbnes.
  h.parent.destroyed = true;
  await assert.rejects(() => h.keyWindow.open(stub()), /ved at lukke/);
});

test('kvitteringen lukker vinduet, og en fejl holder det åbent uden at gentage nøglen', async () => {
  const h = harness();
  const results = [
    { error: 'Udbyderen genkender ikke nøglen.', details: `HTTP 401: Incorrect API key provided: ••••` },
    { error: 'Serveren svarer ikke.', offerSave: true },
    { receipt: { id: 'forbindelse-1', checked: true } }
  ];
  const purpose = stub({ submit: async raw => { purpose.calls.submitted.push(raw); return results.shift(); }, saveAnyway: async () => ({ id: 'forbindelse-1', checked: false }) });
  const done = h.openWindow(purpose);
  assert.deepEqual(await h.call('key-window:submit', ` ${SECRET} `), { error: 'Udbyderen genkender ikke nøglen.', details: 'HTTP 401: Incorrect API key provided: ••••', offerSave: false });
  assert.ok(!h.win().destroyed, 'vinduet bliver åbent ved en fejl');
  assert.deepEqual(await h.call('key-window:submit', SECRET), { error: 'Serveren svarer ikke.', details: '', offerSave: true });
  assert.deepEqual(await h.call('key-window:submit', SECRET), { done: true });
  assert.deepEqual(await done, { id: 'forbindelse-1', checked: true });
  assert.ok(h.win().destroyed);
  assert.deepEqual(purpose.calls.submitted, [` ${SECRET} `, SECRET, SECRET], 'nøglen sendes rå til formålet, som renser den');
});

test('Gem alligevel kræver et tilbud, og en ukendt fejl vises uden tekst fra fejlen', async () => {
  const h = harness();
  const purpose = stub({ submit: async () => { throw new Error(`fetch failed for ${SECRET}`); }, saveAnyway: async () => ({ id: 'forbindelse-1' }) });
  const done = h.openWindow(purpose);
  // Uden et tilbud om Gem alligevel afvises kaldet.
  assert.deepEqual(await h.call('key-window:save-anyway'), { error: 'Kontrollér nøglen først.' });
  const unknown = await h.call('key-window:submit', SECRET);
  assert.equal(unknown.error, 'Nøglen kunne ikke kontrolleres. Prøv igen.');
  assert.ok(!JSON.stringify(unknown).includes(SECRET), 'en ukendt fejl må ikke vises, fordi den kan nævne nøglen');
  assert.deepEqual(await h.call('key-window:save-anyway'), { error: 'Kontrollér nøglen først.' });
  h.keyWindow.close();
  await done;

  // Et tilbud gælder kun indtil næste forsøg.
  const second = harness();
  let offer = true;
  const retry = stub({ submit: async () => (offer ? { error: 'Serveren svarer ikke.', offerSave: true } : { error: 'Udbyderen genkender ikke nøglen.' }), saveAnyway: async () => ({ id: 'gemt-alligevel' }) });
  const open = second.openWindow(retry);
  assert.equal((await second.call('key-window:submit', SECRET)).offerSave, true);
  offer = false;
  assert.equal((await second.call('key-window:submit', SECRET)).offerSave, false);
  assert.deepEqual(await second.call('key-window:save-anyway'), { error: 'Kontrollér nøglen først.' });
  offer = true;
  await second.call('key-window:submit', SECRET);
  assert.deepEqual(await second.call('key-window:save-anyway'), { done: true });
  assert.deepEqual(await open, { id: 'gemt-alligevel' });
});

test('to forsøg på én gang bliver ikke sendt to gange', async () => {
  const h = harness();
  let release; const gate = new Promise(resolve => { release = resolve; });
  const purpose = stub({ submit: async raw => { purpose.calls.submitted.push(raw); await gate; return { receipt: { id: 'forbindelse-1' } }; } });
  const done = h.openWindow(purpose);
  const first = h.call('key-window:submit', SECRET);
  assert.deepEqual(await h.call('key-window:submit', SECRET), { error: 'Vent, nøglen bliver kontrolleret.' });
  release();
  assert.deepEqual(await first, { done: true });
  assert.deepEqual(purpose.calls.submitted, [SECRET]);
  await done;
});

test('en AI-forbindelse renses, kontrolleres og gemmes med kataloget fra kontrollen', async t => {
  const base = await server(t, (req, res) => {
    if (req.headers.authorization !== `Bearer ${SECRET}`) { res.statusCode = 401; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ error: { message: `Incorrect API key provided: ${req.headers.authorization?.slice(7)}` } })); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: [{ id: 'model-a', name: 'Model A' }] }));
  });
  const saved = [];
  const purpose = connectionPurpose({
    input: { kind: 'compatible', name: 'Egen server', baseURL: base },
    store: async (input, options) => { saved.push([input, options]); return 'forbindelse-1'; },
    state: async () => ({ connections: ['forbindelse-1'] }),
    accountKinds: ['openai']
  });
  assert.equal(purpose.context.heading, 'Indtast din nøgle til Egen server');
  assert.match(purpose.context.recipient, /^Nøglen sendes til 127\.0\.0\.1:\d+\.$/);
  assert.match(purpose.context.warning, /adresse, du selv har angivet/);
  assert.equal(purpose.context.help, false, 'en egen server har ingen konto hos en udbyder');
  // En afvist nøgle gemmes ikke, og svaret bag Se detaljer gentager ikke nøglen.
  const rejected = await purpose.submit(`Bearer ${SECRET}x`);
  assert.match(rejected.error, /Serveren afviste adgangen\. Udbyderen genkender ikke nøglen\./);
  assert.match(rejected.details, /^HTTP 401: Incorrect API key provided: ••••/);
  assert.equal(rejected.offerSave, false, 'en afvisning giver ikke Gem alligevel');
  assert.equal(saved.length, 0);
  assert.ok(!JSON.stringify(rejected).includes(SECRET));
  // Den rensede nøgle gemmes sammen med kataloget, så der ikke kontrolleres to gange.
  const receipt = await purpose.submit(` "${SECRET}" `);
  assert.deepEqual(receipt.receipt.changes.sort(), ['anførselstegn', 'mellemrum']);
  assert.equal(receipt.receipt.checked, true);
  assert.deepEqual(receipt.receipt.models.map(model => model.id), ['model-a']);
  assert.deepEqual(receipt.receipt.state, { connections: ['forbindelse-1'] });
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].apiKey, SECRET, 'det er den rensede nøgle, der gemmes');
  assert.deepEqual(saved[0][1].catalog.map(model => model.id), ['model-a']);
});

test('en server, der ikke kan nås, kan gemmes alligevel; en nøgle i input afvises', async () => {
  assert.throws(() => connectionPurpose({ input: { kind: 'openai', name: 'OpenAI', apiKey: SECRET }, store: async () => 'id', state: async () => ({}) }), /indtastes i nøglevinduet/);
  assert.throws(() => connectionPurpose({ input: { kind: 'openai', name: 'OpenAI', secret: 'krypteret' }, store: async () => 'id', state: async () => ({}) }), /indtastes i nøglevinduet/);
  const saved = [];
  const purpose = connectionPurpose({
    input: { kind: 'compatible', name: 'Egen server', baseURL: `http://127.0.0.1:${await freePort()}/v1` },
    store: async (input, options) => { saved.push([input, options]); return 'forbindelse-1'; },
    state: async () => ({})
  });
  const failed = await purpose.submit(SECRET);
  assert.match(failed.error, /Serveren svarer ikke/);
  assert.equal(failed.offerSave, true);
  const receipt = await purpose.saveAnyway();
  assert.equal(receipt.checked, false);
  assert.equal(receipt.models, null);
  assert.equal(saved[0][0].apiKey, SECRET);
  assert.equal(saved[0][1].catalog, null, 'uden kontrol gemmes der intet katalog');
  // Tilbuddet gælder én gang.
  await assert.rejects(() => purpose.saveAnyway(), /Kontrollér nøglen først/);
  // Og det glemmes, når vinduet lukkes.
  await purpose.submit(SECRET);
  purpose.forget();
  await assert.rejects(() => purpose.saveAnyway(), /Kontrollér nøglen først/);
});

test('en 5xx-fejl og en ugyldig nøgle giver ikke Gem alligevel', async t => {
  const base = await server(t, (req, res) => { res.statusCode = 503; res.end('overbelastet'); });
  const purpose = connectionPurpose({ input: { kind: 'compatible', name: 'Egen server', baseURL: base }, store: async () => 'id', state: async () => ({}) });
  const broken = await purpose.submit(SECRET);
  assert.equal(broken.offerSave, false, 'en server, der svarer med 5xx, er ikke uden for rækkevidde');
  await assert.rejects(() => purpose.saveAnyway(), /Kontrollér nøglen først/);
  // Rensningen kaster, før der sendes noget; beskeden nævner aldrig nøglen.
  await assert.rejects(() => purpose.submit(`${SECRET}–x`), error => error.reason === 'invalid' && !error.message.includes('sk-proj'));
  await assert.rejects(() => purpose.submit('   '), /tomt/);
});

test('en Corti-nøgle navngives og sendes efter sit eget miljø', async () => {
  const saved = [];
  const purpose = connectionPurpose({ input: { kind: 'corti', name: 'Corti S1 · EU' }, store: async input => { saved.push(input); return 'id'; }, state: async () => ({}), accountKinds: ['corti'] });
  assert.match(purpose.context.recipient, /Corti i EU, EU-S eller Frankrig/);
  assert.equal(purpose.context.warning, '', 'Cortis egen adresse er ikke en, brugeren har angivet');
  assert.equal(purpose.context.help, true);
  // Nøglen hører til EU-S, så navnet og adressen følger med. Kontrollen fejler, fordi der ikke er net i testen.
  const key = Buffer.from('eu-s:password:testklient:testbruger:hemmelighed').toString('base64');
  const result = await purpose.submit(` ${key} `);
  assert.ok(result.error, 'uden net kan nøglen ikke kontrolleres');
  assert.ok(!JSON.stringify(result).includes(key));
  // En nøgle fra et miljø, Aura ikke bruger, siger hvorfor i stedet for en generel fejl.
  const us = Buffer.from('us:password:testklient:testbruger:hemmelighed').toString('base64');
  await assert.rejects(() => purpose.submit(us), error => /amerikanske miljø/.test(error.message) && error.reason === 'invalid');
  assert.deepEqual(saved, []);
});

test('en GitHub-nøgle kontrolleres hos GitHub og gemmes aldrig alligevel', async () => {
  const tokens = [];
  const purpose = githubPurpose({ github: { connectToken: async token => { tokens.push(token); if (token.endsWith('x')) throw new Error('GitHub genkender ikke nøglen.'); return { connected: true, login: 'tester' }; } }, target: 'backup' });
  assert.equal(purpose.context.heading, 'Indtast din GitHub-nøgle');
  assert.equal(purpose.context.recipient, 'Nøglen sendes til api.github.com.');
  assert.match(purpose.context.warning, /læse og skrive/);
  assert.equal(purpose.context.help, false);
  assert.equal(purpose.saveAnyway, undefined, 'GitHub har aldrig Gem alligevel');
  const token = `github_pat_${'a'.repeat(30)}`;
  const failed = await purpose.submit(`${token}x`);
  assert.deepEqual(failed, { error: 'GitHub genkender ikke nøglen.', details: '' });
  const receipt = await purpose.submit(` Bearer ${token} `);
  assert.deepEqual(receipt.receipt.github, { connected: true, login: 'tester' });
  assert.deepEqual(receipt.receipt.changes.sort(), ['Bearer foran', 'mellemrum']);
  assert.deepEqual(tokens, [`${token}x`, token]);
  // Udgiv beskriver en anden adgang end Sikkerhedskopi.
  assert.match(githubPurpose({ github: {}, target: 'publish' }).context.warning, /GitHub Actions/);
  await assert.rejects(() => purpose.submit(SECRET), /ligner en API-nøgle/);
});

test('hovedvinduet har intet felt, en nøgle kan skrives i, og ingen kanal, der bærer en', () => {
  const fs = require('node:fs');
  const ui = path.join(__dirname, '..', 'ui');
  const html = fs.readFileSync(path.join(ui, 'index.html'), 'utf8');
  for (const pattern of [/type="password"/, /id="api-key"/, /id="hosting-token"/, /id="deployment-token"/])
    assert.equal(pattern.test(html), false, `hovedvinduets side har ${pattern}`);
  // Nøglevinduets egen side har feltet, og kun den.
  assert.match(fs.readFileSync(path.join(ui, 'key-window.html'), 'utf8'), /id="key-value" type="password"/);
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.cjs'), 'utf8');
  assert.equal(/hosting:token/.test(preload), false, 'kanalen med et råt GitHub-token findes ikke længere');
  // Hovedprocessen afviser en nøgle fra hovedvinduet, og nøglevinduets kanaler er med.
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
  assert.match(main, /'apiKey' in value \|\| 'secret' in value/);
  for (const channel of ['key:connection', 'key:github', 'key:cancel']) assert.ok(main.includes(`'${channel}'`) && preload.includes(`'${channel}'`), channel);
  assert.equal(/hosting:token/.test(main), false);
  // Nøglevinduets side må ikke stå i listen over filer, hovedvinduet kan hente.
  const uiFiles = require('../core/ui-files.cjs');
  for (const file of ['key-window.html', 'key-window.js']) assert.equal(uiFiles.has(file), false, file);
});
