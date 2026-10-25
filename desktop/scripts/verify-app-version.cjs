// Native Electron UI and existing IPC. No model calls or production profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { _electron: electron } = require('playwright');
const helpers = require('./ui-test-helpers.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-version-'));
  const output = path.resolve(process.env.AURA_PR_EVIDENCE || root);
  await fs.mkdir(output, { recursive: true }); await fs.mkdir(path.join(root, 'documents'));
  const before = process.env.AURA_EXPECT_BEFORE === '1', checks = [], errors = [];
  const check = (name, value) => { assert.ok(value, name); checks.push(name); };
  let app, page;
  try {
    app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..'), '--user-data-dir=' + path.join(root, 'profile')], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
    await helpers.isolateDocuments(app, path.join(root, 'documents'));
    page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    await page.locator('#welcome-dialog[open]').waitFor();
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.unmaximize(); win.setContentSize(1280, 900); });
    const expected = require('../package.json').version;
    if (before) check('Original has no visible version label', await page.locator('[data-app-version]').count() === 0);
    else {
      await page.waitForFunction(version => [...document.querySelectorAll('[data-app-version]')].every(el => el.textContent === version), expected);
      check('Three labels show the exact running version', await page.locator('[data-app-version]').count() === 3);
      check('Version uses existing read-only IPC state', (await page.evaluate(() => window.harness.updatesState(undefined, null))).value.current === expected);
    }
    await page.locator('#welcome-dialog .welcome-header').screenshot({ path: path.join(output, before ? 'before-welcome.png' : 'after-welcome.png') });
    await helpers.skipIntroduction(page);
    await helpers.openSetup(page);
    await page.locator('.setup-topbar').screenshot({ path: path.join(output, before ? 'before-setup.png' : 'after-setup.png') });
    await page.click('#setup-local');
    if (await page.locator('#setup-features').isVisible()) await page.click('#features-all');
    await page.waitForSelector('#onboarding:not([hidden])');
    await page.locator('.brand').screenshot({ path: path.join(output, before ? 'before-sidebar.png' : 'after-sidebar.png') });
    if (!before) {
      await page.fill('#name', 'Versionsprøve'); await page.fill('#purpose', 'Kontrollér versionsmærket uden AI.');
      await page.click('#create'); await page.waitForSelector('#workspace:not([hidden])');
      check('Project creation still works', await page.locator('#workspace').isVisible());
      check('No AI task or approval was started', await page.locator('#stop').isHidden() && await page.locator('#approvals .approval').count() === 0);
      await page.click('#sidebar-toggle');
      check('Collapsed navigation hides version with brand text', !await page.locator('.brand [data-app-version]').isVisible());
      await page.click('#sidebar-toggle');
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(900, 700));
      const box = await page.locator('.brand [data-app-version]').boundingBox();
      check('Version remains inside the sidebar at smaller size', box && box.x >= 0 && box.x + box.width < 260);
      await page.locator('.brand').screenshot({ path: path.join(output, 'after-small.png') });
      await page.reload(); await page.waitForSelector('#workspace:not([hidden])');
      check('Version survives restart of the renderer', await page.locator('.brand [data-app-version]').textContent() === expected);
    }
    check('No renderer errors', errors.length === 0);
    await fs.writeFile(path.join(output, before ? 'before.json' : 'native.json'), JSON.stringify({ passed: true, version: expected, checks, errors, externalModelCalls: 0 }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, output }));
  } finally { await app?.close(); await fs.rm(path.join(root, 'profile'), { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
