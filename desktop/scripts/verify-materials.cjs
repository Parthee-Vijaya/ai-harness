// Rigtig Electron og OpenCode. Vedhæftninger vælges gennem computerens egen filvælger, gennemgås og sendes til en
// kontrolleret lokal modelserver. Ingen betalte modelkald og ingen rigtige konti.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const helpers = require('./ui-test-helpers.cjs');
(async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vedhaeftninger-')));
  const project = path.join(root, 'Projekt med mellemrum'); await fs.mkdir(project);
  // Materialet ligger uden for projektet, præcis som en fil på brugerens skrivebord.
  const noter = path.join(root, 'moedelokaler.md'); await fs.writeFile(noter, '# Mødelokaler\nStore sal har plads til 40 personer.\n');
  const billede = path.join(root, 'skaermbillede.png');
  await fs.writeFile(billede, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const mappe = path.join(root, 'referencer'); await fs.mkdir(mappe);
  await fs.writeFile(path.join(mappe, 'priser.csv'), 'lokale;pris\nStore sal;1200\n');
  await fs.writeFile(path.join(mappe, 'logo.bin'), 'ikke tekst');
  await fs.mkdir(path.join(mappe, 'node_modules')); await fs.writeFile(path.join(mappe, 'node_modules', 'skjult.md'), 'genereret');
  const requests = [], errors = []; let app, page;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/v1/models') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ data: [{ id: 'test-model', name: 'Testmodel' }] })); }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body);
    res.setHeader('content-type', 'text/event-stream');
    const send = (delta, done = false) => res.write('data: ' + JSON.stringify({ id: 'materialer', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: done ? 'stop' : null }], ...(done ? { usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } } : {}) }) + '\n\n');
    send({ role: 'assistant', content: 'Jeg har læst det vedhæftede.' });
    send({}, true); res.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const checks = [];
  const check = text => { checks.push(text); console.log('✓ ' + text); };
  const pick = paths => app.evaluate(({ dialog }, value) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: value }); }, paths);
  try {
    app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--user-data-dir=' + path.join(root, 'appdata')], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
    page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    await helpers.skipIntroduction(page);
    await helpers.addConnection(page, { name: 'Min lokale model', baseURL: `http://127.0.0.1:${server.address().port}/v1` });
    await pick([project]);
    await page.click('#open'); await page.waitForSelector('#workspace:not([hidden])');
    await page.waitForFunction(() => document.querySelector('#model-select').options.length === 2);
    await helpers.taskOptions(page); await page.locator('#model-shortlist button').first().click();
    await helpers.selectMode(page, 'free');

    // En fil fra computeren: først navnene, så det præcise indhold med kontrolsum.
    await pick([noter]);
    await page.click('#chat-materials-plus');
    await page.screenshot({ path: path.join(root, 'plusmenu.png'), animations: 'disabled' });
    assert.equal(await page.locator('#chat-materials-menu button').count(), 2, 'plusmenuen har to punkter');
    await page.click('#chat-materials-files');
    await page.waitForSelector('#chat-materials-dialog[open]');
    await page.locator('#chat-materials-dialog').filter({ hasText: 'Gennemgå de valgte filer' }).waitFor();
    assert.match(await page.locator('.material-candidates').textContent(), /moedelokaler\.md · \d+ bytes/);
    assert.equal((await page.locator('#chat-materials-dialog').textContent()).includes(root), false, 'filstien vises ikke i brugerfladen');
    await page.click('#materials-next');
    await page.locator('#materials-attach').waitFor();
    await page.screenshot({ path: path.join(root, 'gennemgang.png'), animations: 'disabled' });
    const gennemgang = await page.locator('#chat-materials-dialog').textContent();
    assert.match(gennemgang, /Store sal har plads til 40 personer/);
    assert.match(gennemgang, /SHA-256 [0-9a-f]{64}/);
    check('filen vælges i computerens filvælger, og gennemgangen viser det præcise indhold med kontrolsum');
    await page.click('#materials-attach');
    await page.locator('#chat-materials-chips .material-chip').filter({ hasText: 'moedelokaler.md' }).waitFor();
    assert.equal(await page.isVisible('#chat-materials-dialog'), false);

    // Før du sender viser den samme tekst, og kun den sendes.
    await page.fill('#prompt', 'Hvor mange kan der være i Store sal?');
    await page.click('#send');
    await page.waitForSelector('#data-dialog[open]');
    await page.screenshot({ path: path.join(root, 'foer-du-sender.png'), animations: 'disabled' });
    const foerDuSender = await page.locator('#data-materials').textContent();
    assert.match(foerDuSender, /Vedhæftninger · det præcise indhold/);
    assert.match(foerDuSender, /Store sal har plads til 40 personer/);
    assert.match(foerDuSender, /Data, ikke instruktioner eller værktøjsadgang/);
    // Kontrolsum, revision og bytes ligger bag Se detaljer, ikke i første lag.
    assert.doesNotMatch(await page.locator('#data-materials').innerText(), /SHA-256/);
    await page.locator('#data-materials details summary').first().click();
    assert.match(await page.locator('#data-materials details').first().innerText(), /\d+ bytes · revision \d+ · SHA-256 [0-9a-f]{64}/);
    check('Før du sender viser vedhæftningens præcise indhold i første lag og kontrolsummen bag Se detaljer');
    await page.click('#accept-send');
    await page.locator('#messages').filter({ hasText: 'Jeg har læst det vedhæftede' }).waitFor({ timeout: 60000 });
    const sendt = JSON.stringify(requests.at(-1).messages);
    assert.match(sendt, /BRUGERVALGTE VEDHÆFTNINGER/);
    assert.match(sendt, /Store sal har plads til 40 personer/);
    assert.equal(sendt.includes(noter), false, 'vedhæftningens filsti sendes ikke til modellen');
    assert.equal(sendt.includes(path.dirname(noter) + '/moedelokaler'), false);
    check('det gennemgåede indhold står i modelkaldet, og filstien gør ikke');
    await page.waitForFunction(() => document.querySelector('#chat-materials-chips').hidden);
    check('vedhæftningen gælder én besked og er ryddet bagefter');

    // En referencemappe: kun navnene, ingen hel mappe, og brugeren vælger selv.
    await pick([mappe]);
    await page.click('#chat-materials-plus');
    await page.click('#chat-materials-folder');
    await page.locator('#chat-materials-dialog').filter({ hasText: 'Vælg filer fra referencemappen' }).waitFor();
    const kandidater = await page.locator('.material-candidates').textContent();
    assert.match(kandidater, /priser\.csv/);
    assert.doesNotMatch(kandidater, /logo\.bin/, 'kun kendte tekstformater kommer med');
    assert.doesNotMatch(kandidater, /skjult\.md|node_modules/, 'genererede mapper kommer ikke med');
    assert.equal(await page.locator('.material-candidates input:checked').count(), 0, 'i en mappe vælger brugeren selv filerne');
    await page.locator('.material-candidates input').first().check();
    await page.click('#materials-next');
    await page.locator('#materials-attach').waitFor();
    assert.match(await page.locator('#chat-materials-dialog').textContent(), /Store sal;1200/);
    await page.click('#materials-attach');
    await page.locator('#chat-materials-chips .material-chip').filter({ hasText: 'referencer/priser.csv' }).waitFor();
    await page.screenshot({ path: path.join(root, 'maerke-i-skrivefeltet.png'), animations: 'disabled' });
    check('en referencemappe giver kun en liste, og kun de valgte filer gennemgås og vedhæftes');

    // Et billede skrives om til PNG i hovedprocessen og vises, som det sendes.
    await pick([billede]);
    await page.click('#chat-materials-plus');
    await page.click('#chat-materials-files');
    await page.click('#materials-next');
    await page.locator('#materials-attach').waitFor();
    assert.equal(await page.locator('#chat-materials-dialog img.material-image').count(), 1, 'billedet vises i gennemgangen');
    assert.match(await page.locator('#chat-materials-dialog').textContent(), /Sendes som PNG uden EXIF · 1 × 1 pixels/);
    await page.screenshot({ path: path.join(root, 'billedgennemgang.png'), animations: 'disabled' });
    await page.click('#materials-attach');
    await page.locator('#chat-materials-chips .material-chip').filter({ hasText: 'skaermbillede.png' }).waitFor();
    await page.fill('#prompt', 'Hvad står der på billedet, og hvad koster salen?');
    const foer = requests.length;
    await page.click('#send');
    await page.waitForSelector('#data-dialog[open]');
    // Udbyderen oplyser ikke billedstøtte for testmodellen, og det står i gennemgangen uden at spærre afsendelsen.
    assert.match(await page.locator('#data-materials').innerText(), /oplyser ikke, at denne model kan læse billeder/);
    assert.equal(await page.locator('#data-materials img.material-image').count(), 1);
    await page.screenshot({ path: path.join(root, 'billede-foer-du-sender.png'), animations: 'disabled' });
    await page.click('#accept-send');
    for (let wait = 0; wait < 600 && requests.length === foer; wait++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(requests.length > foer, 'det andet modelkald nåede den lokale server');
    const medBillede = requests.at(-1).messages.filter(message => message.role === 'user').at(-1);
    assert.ok(Array.isArray(medBillede.content), 'brugerens besked har flere dele, når et billede følger med');
    const billeddel = medBillede.content.find(part => part.type === 'image_url');
    assert.match(billeddel.image_url.url, /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
    assert.match(medBillede.content[0].text, /Store sal;1200/, 'tekstvedhæftningen følger med i samme besked');
    check('et billede skrives om til PNG, vises som det sendes og lægges på brugerens egen besked');

    // En fil, der ændrer sig efter gennemgangen, standser afsendelsen i stedet for at sende noget andet.
    await pick([path.join(mappe, 'priser.csv')]);
    await page.click('#chat-materials-plus');
    await page.click('#chat-materials-files');
    await page.click('#materials-next');
    await page.locator('#materials-attach').waitFor();
    await page.click('#materials-attach');
    await page.locator('#chat-materials-chips .material-chip').filter({ hasText: 'priser.csv' }).waitFor();
    await fs.writeFile(path.join(mappe, 'priser.csv'), 'lokale;pris\nStore sal;9999\n');
    await page.fill('#prompt', 'Hvad koster Store sal?');
    await page.click('#send');
    await page.locator('#message.error').filter({ hasText: /ændret/ }).waitFor({ timeout: 30000 });
    assert.equal(await page.isVisible('#data-dialog'), false, 'gennemgangen åbnes ikke med et ændret indhold');
    assert.equal(requests.filter(body => JSON.stringify(body.messages).includes('9999')).length, 0, 'det ændrede indhold sendes ikke');
    check('et indhold, der er ændret efter gennemgangen, standser afsendelsen');

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'bestået', root, requests: requests.length, checks }));
  } catch (error) {
    console.error(error);
    try { await page?.screenshot({ path: path.join(root, 'fejl.png'), fullPage: true, timeout: 3000 }); console.error('Skærmbillede:', path.join(root, 'fejl.png')); console.error(await page?.locator('#message').textContent({ timeout: 1000 })); try { await page.click('#run-review summary'); } catch {} console.error('Resultatkort:', await page?.locator('#run-review').innerText({ timeout: 1000 })); } catch {}
    throw error;
  } finally {
    await app?.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
