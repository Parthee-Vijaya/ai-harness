// Nøglevinduet i den rigtige app: AI-nøgler og GitHub-nøgler indtastes kun i et eget vindue med sin egen session.
// Prøven bruger sin egen lokale server i stedet for udbyderne. Alle nøgler her er opdigtede.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const helpers = require('./ui-test-helpers.cjs');

const KEY = 'sk-ant-SYNTETISK0123456789abcdefSYNTETISK';
const TOKEN = `github_pat_${'a'.repeat(30)}`;
const PAGE = 'aura-noegle://vindue/index.html';

(async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'harness-noeglevindue-')));
  const project = path.join(root, 'Projekt'); await fs.mkdir(path.join(project, 'public'), { recursive: true });
  await fs.writeFile(path.join(project, 'public/index.html'), '<!doctype html><html lang="da"><meta charset="utf-8"><title>Nøgleprøve</title><h1>Nøgleprøve</h1></html>');
  let models = 0, users = 0;
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/user')) {
      ++users;
      if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.statusCode = 401; return res.end(JSON.stringify({ message: 'Bad credentials' })); }
      return res.end(JSON.stringify({ login: 'testbruger' }));
    }
    ++models;
    // Nøglen står i udbyderens eget svar. Appen må aldrig vise den videre.
    if (req.headers['x-api-key'] !== KEY) { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: `Incorrect API key provided: ${req.headers['x-api-key']}` } })); }
    res.end(JSON.stringify({ data: [{ id: 'claude-proeve', display_name: 'Claude Prøve' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const errors = [];
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--user-data-dir=' + path.join(root, 'appdata')], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
  try {
    // Udbyderne erstattes af prøvens egen server. Intet kald forlader maskinen.
    await app.evaluate(({}, port) => {
      const original = globalThis.fetch;
      globalThis.fetch = (url, options) => {
        const value = String(url);
        const local = value.replace('https://api.anthropic.com', `http://127.0.0.1:${port}`).replace('https://api.github.com', `http://127.0.0.1:${port}`);
        if (!local.startsWith(`http://127.0.0.1:${port}`)) throw new Error('Prøven tillader kun sin egen server: ' + value);
        return original(local, options);
      };
    }, port);
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await helpers.skipIntroduction(page);
    await helpers.openExistingProject(app, page, project);

    // ---------- Formularen har intet felt til nøglen ----------
    await helpers.openSetup(page); await page.click('#setup-add-provider');
    assert.equal(await page.locator('#provider-cards button').count(), 4, 'fire udbydere i første lag');
    // Det rolige statuspanel: intet valgt endnu, og en forhåndsvisning, når musen hviler på et kort.
    assert.equal(await page.isVisible('#setup-status'), true, 'statuspanelet står til højre i opsætningen');
    // Musen kan stadig hvile på et kort efter forrige klik, så den flyttes væk, før det tomme panel måles.
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('#setup-status-note').dataset.state === 'none');
    await page.hover('#provider-cards [data-kind="corti"]');
    await page.waitForFunction(() => document.querySelector('#setup-status-note').dataset.state === 'preview');
    assert.equal(await page.locator('#setup-status-provider').textContent(), 'Corti');
    assert.match(await page.locator('#setup-status-connection').textContent(), /Forhåndsvisning/);
    assert.match(await page.locator('#setup-status-note').textContent(), /Du kigger kun/);
    await page.click('#provider-cards [data-kind="anthropic"]');
    await helpers.assertNoKeyFields(page);
    assert.equal(await page.isVisible('#save-connection'), false, 'en ny forbindelse hos en udbyder gemmes kun med en kontrolleret nøgle');
    assert.equal(await page.locator('#enter-key').textContent(), 'Indtast nøgle');
    assert.match(await page.locator('#key-state').textContent(), /separat vindue/);

    // ---------- Vinduet er lukket inde ----------
    await page.click('#enter-key');
    const key = await helpers.keyWindow(app);
    key.on('pageerror', error => errors.push('nøglevindue: ' + error.message));
    assert.equal(await key.locator('#key-heading').textContent(), 'Indtast din nøgle til Anthropic');
    assert.equal(await key.locator('#key-recipient').textContent(), 'Nøglen sendes til api.anthropic.com.');
    assert.equal(await key.locator('#key-value').getAttribute('type'), 'password');
    assert.equal(await key.locator('#key-save-anyway').isVisible(), false);
    assert.equal(await key.locator('#key-help').isVisible(), true, 'Anthropic har en side med nøgler');
    assert.deepEqual(await key.evaluate(() => Object.keys(window.keyWindow).sort()), ['cancel', 'context', 'help', 'resize', 'saveAnyway', 'submit']);
    assert.deepEqual(await key.evaluate(() => [typeof window.harness, typeof window.require, typeof process]), ['undefined', 'undefined', 'undefined']);
    assert.equal(await key.evaluate(() => document.cookie), '', 'ingen cookies fra hovedvinduet');
    assert.equal(await key.evaluate(async () => { try { await fetch('http://example.invalid/'); return 'hentede'; } catch { return 'blokeret'; } }), 'blokeret');

    // ---------- En afvist nøgle gemmes ikke ----------
    await key.fill('#key-value', `${KEY}x`);
    await key.click('#key-submit');
    await key.locator('#key-error:not([hidden])').waitFor();
    assert.match(await key.locator('#key-error-text').textContent(), /Serveren afviste adgangen\. Udbyderen genkender ikke nøglen\./);
    assert.match(await key.locator('#key-details-text').textContent(), /^HTTP 401: Incorrect API key provided: ••••/);
    assert.equal((await key.locator('#key-details-text').textContent()).includes('sk-ant'), false, 'svaret må ikke gentage nøglen');
    assert.equal(await key.locator('#key-save-anyway').isVisible(), false, 'en afvisning giver ikke Gem alligevel');
    assert.equal((await page.evaluate(() => window.harness.connectionState())).value.connections.length, 0, 'intet gemt');
    assert.equal(models, 1);

    // ---------- Den rigtige nøgle renses, kontrolleres og gemmes ----------
    await key.fill('#key-value', ` "Bearer ${KEY}" `);
    await key.click('#key-submit');
    await page.waitForFunction(() => document.querySelector('#setup').dataset.step === 'saved');
    assert.equal(models, 2, 'nøglen kontrolleres én gang, når den gemmes');
    assert.match(await page.locator('#connection-feedback').textContent(), /Nøglen er kontrolleret og gemt krypteret\./);
    assert.match(await page.locator('#connection-feedback').textContent(), /mellemrum|anførselstegn|Bearer foran/);
    await page.locator('#setup-continue:not([hidden])').waitFor();
    assert.equal(await page.isDisabled('#setup-continue'), false, 'kataloget fra kontrollen gælder som kontrollen');
    // Grønt står først her, hvor en kontrol faktisk er lykkedes.
    assert.equal(await page.locator('#setup-status-note').getAttribute('data-state'), 'checked');
    assert.match(await page.locator('#setup-status-note').textContent(), /Modelkataloget svarer/);
    assert.equal(await page.locator('#setup-status-connection').textContent(), 'Kontrolleret i denne session.');
    assert.equal(models, 2, 'forbindelsen kontrolleres ikke igen');
    const state = (await page.evaluate(() => window.harness.connectionState())).value;
    assert.equal(state.connections.length, 1); assert.equal(state.connections[0].hasKey, true);
    assert.equal(JSON.stringify(state).includes('sk-ant'), false, 'nøglen findes ikke i hovedvinduets tilstand');
    assert.equal(await page.evaluate(() => document.documentElement.innerHTML.includes('sk-ant')), false);
    assert.equal(await page.evaluate(() => typeof window.harness.hostingToken), 'undefined', 'kanalen med et råt GitHub-token findes ikke længere');
    const refused = await page.evaluate(value => window.harness.saveConnection(value), { kind: 'anthropic', name: 'Forsøg med nøgle', apiKey: KEY });
    assert.equal(refused.ok, false); assert.match(refused.error, /nøglevinduet/);
    await page.click('#setup-continue'); await page.waitForSelector('#setup', { state: 'hidden' });

    // ---------- Rediger: Indtast ny nøgle, og Escape ændrer ingenting ----------
    await helpers.menuClick(page, '#connections-button');
    await page.click('#saved-connections .saved-connection button');
    await page.waitForSelector('#connection-edit:not([hidden])');
    assert.equal(await page.locator('#enter-key').textContent(), 'Indtast ny nøgle');
    assert.equal(await page.isVisible('#clear-key-row'), true, 'en gemt nøgle kan fjernes');
    assert.equal(await page.locator('#save-connection').textContent(), 'Gem forbindelse');
    const before = models;
    await page.click('#enter-key');
    await helpers.enterCredential(app, 'sk-ant-en-helt-anden-syntetisk-noegle', { button: 'escape' });
    await page.locator('#connection-feedback').filter({ hasText: 'blev ikke indtastet' }).waitFor();
    assert.equal(models, before, 'Escape sender ingenting');
    await page.click('[data-close="connections-dialog"]');

    // ---------- GitHub-nøglen går samme vej ----------
    // Sikkerhedskopi ligger bag funktionen Deling, som prøven slår til. Siden indlæses forfra.
    await helpers.enableSharing(page);
    await page.waitForSelector('#workspace:not([hidden])');
    await helpers.menuClick(page, '#publish-button');
    await page.locator('#hosting-dialog').waitFor({ state: 'visible' });
    await page.locator('#hosting-auth details > summary').click();
    await page.click('#hosting-key');
    const github = await helpers.keyWindow(app);
    assert.equal(await github.locator('#key-heading').textContent(), 'Indtast din GitHub-nøgle');
    assert.equal(await github.locator('#key-recipient').textContent(), 'Nøglen sendes til api.github.com.');
    assert.equal(await github.locator('#key-help').isVisible(), false);
    await github.fill('#key-value', KEY);
    await github.click('#key-submit');
    await github.locator('#key-error:not([hidden])').waitFor();
    assert.match(await github.locator('#key-error-text').textContent(), /ligner en API-nøgle til en AI-udbyder/);
    assert.equal(users, 0, 'en nøgle, der er renset væk, sendes ikke til GitHub');
    await github.fill('#key-value', `  ${TOKEN}  `);
    await github.click('#key-submit');
    await page.locator('#hosting-status').filter({ hasText: 'testbruger' }).waitFor();
    assert.equal(users, 1);
    assert.equal(await page.evaluate(() => document.documentElement.innerHTML.includes('github_pat_')), false);
    await helpers.assertNoKeyFields(page);
    await page.click('[data-close="hosting-dialog"]');

    assert.deepEqual(errors, []);
    console.log(`Nøglevinduet bestod. Modelkald: ${models}, GitHub-kald: ${users}. Prøvemappe: ${root}`);
  } finally { await app.close(); server.closeAllConnections(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
