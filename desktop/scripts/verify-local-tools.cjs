// Real Electron/UI/IPC/OpenCode/Privacy Gate with a scripted loopback model.
// All data is synthetic; never reads the user's profile or provider credentials.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { startFakeProvider } = require('./fixtures/fake-provider.cjs');
const { launchTestApp } = require('./electron-test-launch.cjs');
const helpers = require('./ui-test-helpers.cjs');
const ids = require('../core/local-tools.cjs').ids;
const hash = value => createHash('sha256').update(value).digest('hex');

(async () => {
  const { cases, localCase, checkResult } = await import('../../tools/aura-tool-lab/cases.mjs');
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-local-tools-ui-')));
  const reports = process.env.AURA_LOCAL_TOOLS_REPORT || await fs.mkdtemp(path.join(os.tmpdir(), 'aura-local-tools-report-'));
  await fs.mkdir(reports, { recursive: true });
  console.log(JSON.stringify({ reports, status: 'starting' }));
  const contact = 'alice@example.invalid';
  const first = cases.map((fixture, index) => { const mapped = localCase(fixture); return { text: '', toolCalls: [{ id: 'local_case_' + index, name: mapped.name, arguments: JSON.stringify(mapped.args) }] }; });
  const toolStep = id => ({ text: '', toolCalls: [{ id, name: 'aura_csv_to_json', arguments: JSON.stringify({ csv: 'name\nsynthetic' }) }] });
  const provider = await startFakeProvider({ synthetic: true, model: 'fixture-tools', script: [
    ...first, { text: '', toolCalls: [{ id: 'local_sensitive_result', name: 'aura_csv_to_json', arguments: JSON.stringify({ csv: `email\n${contact}` }) }] },
    { text: 'LOCAL_TOOLS_COMPLETE' }, toolStep('local_rejected'), toolStep('local_stopped'),
    { text: '', toolCalls: [{ id: 'cloud_public', name: 'aura_csv_to_json', arguments: JSON.stringify({ csv: 'antal\n2\n0' }) }] }, { text: 'CLOUD_PUBLIC_COMPLETE' },
    { text: '', toolCalls: [{ id: 'cloud_private', name: 'aura_csv_to_json', arguments: JSON.stringify({ csv: `email\n${contact}` }) }] }
  ] });
  const front = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: provider.model, name: 'Synthetic tool model', context_window: 262144, max_input_tokens: 262144, context_length: 262144, max_output_tokens: 8192 }] })); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    try {
      const response = await fetch(provider.origin + req.url, { method: req.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` }, body: Buffer.concat(chunks) });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('Content-Type') });
      Readable.fromWeb(response.body).pipe(res);
    } catch { res.writeHead(502); res.end('{}'); }
  });
  await new Promise(resolve => front.listen(0, '127.0.0.1', resolve));
  let app, page, launch, stage = 'launch'; const events = [], errors = [], approvals = [], sharing = [], checks = [];
  const ok = result => { assert.equal(result?.ok, true, result?.error || 'Application IPC failed'); return result.value; };
  const uiFiles = ['index.html', 'styles.css', 'app.js', 'approvals.js', 'approval-view.js', 'privacy-gate.js', 'privacy-gate.css'];
  const uiHashes = Object.fromEntries(await Promise.all(uiFiles.map(async file => [file, hash(await fs.readFile(path.join(__dirname, '../ui', file)))])));
  try {
    ({ app, evidence: launch } = await launchTestApp({ electron, profile: path.join(temp, 'profile') }));
    const documents = path.join(temp, 'Documents'); await fs.mkdir(documents);
    await helpers.isolateDocuments(app, documents); page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await helpers.skipIntroduction(page);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('harness://')); window.unmaximize(); window.setContentSize(1440, 900); });
    await page.exposeFunction('observeLocalTools', event => events.push(event));
    await page.evaluate(() => window.harness.onEvent(event => window.observeLocalTools(event)));
    stage = 'connection';
    const endpoint = `http://127.0.0.1:${front.address().port}/v1`;
    const connection = await helpers.addConnection(page, { name: 'Synthetic tool model', baseURL: endpoint, apiKey: 'synthetic-tool-key' });
    stage = 'project';
    await page.fill('#name', 'Lokale tools'); await page.fill('#purpose', 'Afprøv kun lokale datafunktioner med syntetiske data.');
    await page.click('#create'); await page.waitForSelector('#workspace:not([hidden])');
    stage = 'model';
    await helpers.taskOptions(page);
    await page.locator('#model-catalog').evaluate(element => element.open = true);
    await page.waitForFunction(id => [...document.querySelector('#model-select').options].some(option => option.value === id), provider.model);
    await page.selectOption('#model-select', provider.model); await page.click('#model-done');
    stage = 'privacy';
    // Test-only trusted registry for the actual loopback fixture; never touches
    // a user profile or changes production destination resolution.
    const privateDirectory = path.join(temp, 'profile', 'harness', 'privacy'); await fs.mkdir(privateDirectory, { recursive: true, mode: 0o700 });
    const registry = locality => fs.writeFile(path.join(privateDirectory, 'destinations.json'), JSON.stringify({ [connection.id]: { endpoint, locality, revision: 'synthetic-' + locality } }), { mode: 0o600 });
    await registry('device');
    ok(await page.evaluate(() => window.harness.privacyConfigure({ scope: 'project', settings: { enabled: true, workMode: 'local', defaultClass: 'public', requireApproval: true, protectedSources: [] } })));
    const configured = ok(await page.evaluate(() => window.harness.privacyGet({ scope: 'project' })));
    assert.equal(configured.enabled, true); assert.equal(configured.capabilities.isolation, true);
    await page.screenshot({ path: path.join(reports, 'workspace-before.png'), fullPage: true });

    async function run(scenario) {
      stage = scenario;
      if (scenario !== 'allow') {
        await page.locator('.project-entry.is-current .project-add').click();
        await page.waitForFunction(() => document.querySelector('#prompt').value === '' && document.querySelector('#stop').hidden);
      }
      const start = events.length, sentBefore = provider.requests.length, handled = new Set(); let answered = 0;
      await page.fill('#prompt', 'Afprøv det faste syntetiske toolforløb. Ingen filændringer, kommandoer eller netopslag.'); await page.click('#send');
      const deadline = Date.now() + 100_000;
      while (Date.now() < deadline) {
        if (await page.locator('#data-dialog').evaluate(element => element.open)) await page.click('#accept-send');
        if (await page.locator('#privacy-sharing-dialog').evaluate(element => element.open)) {
          const body = await page.locator('#privacy-payload').textContent();
          assert.ok(body); assert.doesNotMatch(body, new RegExp(contact.replaceAll('.', '\\.')));
          sharing.push({ scenario, sha256: hash(body), sentBefore: provider.requests.length });
          if (sharing.length === 1) await page.screenshot({ path: path.join(reports, 'privacy-review.png'), fullPage: true });
          await page.locator('[data-privacy-decision="approve"]').click();
        }
        for (const box of await page.locator('#approvals .approval').all()) {
          const id = await box.getAttribute('data-id');
          if (handled.has(id)) continue;
          const request = events.slice(start).find(event => event.type === 'permission.asked' && event.properties?.id === id)?.properties;
          assert.ok(request, 'The visible approval has a real pending permission');
          assert.ok(ids.includes(request.permission), 'Only fixed local tools can execute');
          assert.equal(request.policy.persistable, false); assert.equal(request.policy.conversationEligible, false);
          assert.ok(request.policy.match?.inputHash);
          assert.equal(await box.getByRole('button', { name: 'Tillad altid i projektet', exact: true }).count(), 0);
          assert.equal(await box.getByRole('button', { name: 'Tillad og kør med YOLO …', exact: true }).count(), 0);
          if (scenario !== 'allow' || answered === 0) await page.screenshot({ path: path.join(reports, `${scenario}-approval.png`), fullPage: true });
          approvals.push({ scenario, tool: request.permission, inputBound: true, persistable: false }); answered++;
          handled.add(id);
          if (scenario === 'stop') await page.click('#stop');
          else await box.getByRole('button', { name: scenario === 'reject' ? 'Afvis' : 'Tillad én gang', exact: true }).click();
          const replay = await page.evaluate(id => window.harness.reply({ id, allow: true }), id);
          assert.equal(replay.ok, false, 'Answered permissions cannot be replayed');
        }
        const fatal = events.slice(start).find(event => ['session.error', 'engine.error'].includes(event.type));
        if (fatal && !['cloud-private', 'reject'].includes(scenario)) throw new Error('Native engine failed: ' + JSON.stringify(fatal).slice(0, 1000));
        const status = events.slice(start).find(event => event.type === 'run.status' && event.status === 'error');
        if (status && !['cloud-private', 'reject'].includes(scenario)) throw new Error('Native run failed before completion');
        if (status && ['cloud-private', 'reject'].includes(scenario) && await page.locator('#stop').isHidden()) return { events: events.slice(start), review: { status: 'error' }, answered, calls: provider.requests.length - sentBefore };
        const review = events.slice(start).find(event => event.type === 'run.review');
        if (review && await page.locator('#stop').isHidden()) return { events: events.slice(start), review, answered, calls: provider.requests.length - sentBefore };
        await page.waitForTimeout(100);
      }
      throw new Error('Native local-tools scenario timed out: ' + scenario);
    }
    const allowed = await run('allow');
    assert.equal(allowed.answered, 6); assert.equal(allowed.calls, 7);
    assert.equal(allowed.review.status, 'idle');
    const completed = allowed.events.filter(event => event.type === 'message.part.updated' && event.properties?.part?.type === 'tool' && event.properties.part.state.status === 'completed');
    for (let index = 0; index < cases.length; index++) {
      const part = completed.find(event => event.properties.part.callID.endsWith(':local_case_' + index))?.properties.part;
      assert.ok(part); const mapped = localCase(cases[index]); assert.equal(checkResult(cases[index], mapped.normalize(JSON.parse(part.state.output))), true, cases[index].id);
    }
    assert.match(provider.requests.at(-1).rawBody, new RegExp(contact.replaceAll('.', '\\.')));
    assert.equal(sharing.length, 0, 'Local-only processing needs no external sharing grant');
    checks.push('All four tools execute in the real app after six concrete approvals', 'All five shared semantic fixtures pass', 'Local-only Privacy Gate keeps sensitive tool data in the documented loopback fixture');
    const rejected = await run('reject'); assert.equal(rejected.answered, 1); assert.equal(rejected.calls, 1); assert.ok(['rejected', 'error'].includes(rejected.review.status));
    assert.equal(rejected.events.some(event => event.properties?.part?.callID?.endsWith(':local_rejected') && event.properties.part.state?.status === 'completed'), false);
    const stopped = await run('stop'); assert.equal(stopped.answered, 1); assert.equal(stopped.calls, 1); assert.equal(stopped.review.status, 'stopped');
    checks.push('Reject and Stop prevent tool completion and any subsequent model request', 'Permission replay refused through real IPC');
    await registry('cloud');
    ok(await page.evaluate(() => window.harness.privacyConfigure({ scope: 'project', settings: { enabled: true, workMode: 'cloud-controlled', defaultClass: 'public', requireApproval: true, protectedSources: [] } })));
    const cloudStart = provider.requests.length;
    const publicRun = await run('cloud-public'); assert.equal(publicRun.answered, 1); assert.equal(publicRun.calls, 2); assert.equal(publicRun.review.status, 'idle');
    assert.equal(sharing.length, 2);
    const reviewedBodies = new Set(sharing.map(item => item.sha256));
    assert.equal(provider.requests.slice(cloudStart).every(request => reviewedBodies.has(hash(request.rawBody))), true, 'Exact reviewed model/tool-result bytes reach the controlled cloud recipient');
    const privateRun = await run('cloud-private'); assert.equal(privateRun.answered, 1); assert.equal(privateRun.calls, 1); assert.equal(privateRun.review.status, 'error');
    assert.ok(privateRun.events.some(event => event.properties?.part?.callID?.endsWith(':cloud_private') && event.properties.part.state?.status === 'completed'), 'The local tool completes before Privacy Gate refuses onward sharing');
    assert.doesNotMatch(provider.requests.at(-1).rawBody, new RegExp(contact.replaceAll('.', '\\.')));
    assert.ok(privateRun.events.some(event => event.type === 'activity' && /kontrolleres sikkert|lokal behandling|Behandl det lokalt/.test(event.entry?.detail || '')));
    checks.push('Cloud recipient receives exactly reviewed public tool-result bytes', 'Sensitive tool data blocks the next cloud request instead of bypassing Privacy Gate');
    assert.deepEqual(errors, []);
    assert.deepEqual(Object.fromEntries(await Promise.all(uiFiles.map(async file => [file, hash(await fs.readFile(path.join(__dirname, '../ui', file)))]))), uiHashes);
    await page.screenshot({ path: path.join(reports, 'workspace-after.png'), fullPage: true });
    await fs.writeFile(path.join(reports, 'report.json'), JSON.stringify({ status: 'passed', launch, controlledModel: true, externalProviderCalls: 0, checks, approvals, sharing, uiHashes, errors }, null, 2));
    console.log(JSON.stringify({ status: 'passed', reports, checks, approvals: approvals.length, sharingReviews: sharing.length }));
  } catch (error) {
    await page?.screenshot({ path: path.join(reports, 'failure.png'), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(reports, 'failure.json'), JSON.stringify({ error: error.message, launch, approvals, sharing, errors, events: events.slice(-15), providerCalls: provider.requests.length }, null, 2));
    console.error(JSON.stringify({ reports, stage, error: error.message, stack: error.stack?.split('\n').slice(0, 4) })); throw error;
  } finally { await app?.close(); await provider.close(); front.closeAllConnections(); await new Promise(resolve => front.close(resolve)); await fs.rm(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
