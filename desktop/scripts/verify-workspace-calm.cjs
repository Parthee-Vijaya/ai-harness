// Native rendering/interaction checks with synthetic local files. No external AI or credentials.
const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const ui = require('./ui-test-helpers.cjs');
const http = require('node:http');
(async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-calm-')));
  const output = path.resolve(process.env.AURA_FLOW_EVIDENCE || path.join(root, 'evidence'));
  await fs.mkdir(output, { recursive: true });
  const errors = [], failures = [], checks = [], layouts = [];
  let app, page;
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'calm-test',name:'Syntetisk model'}]}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const check = (name, value) => { assert(value, name); checks.push(name); };
  const shot = async name => { await page.waitForTimeout(300); return page.screenshot({ path: path.join(output, name + '.png'), scale: 'css' }); };
  const size = async (width,height) => {
    await app.evaluate(({ BrowserWindow }, size) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setMinimumSize(320,400); w.setContentSize(...size); }, [width,height]);
    await page.waitForTimeout(200);
  };
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--user-data-dir=' + path.join(root, 'profile')], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
    page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith('harness://app/') && r.status() >= 400) failures.push({url:r.url(),status:r.status()}); });
    await ui.skipIntroduction(page); await ui.isolateDocuments(app, root); await size(1440,900);
    await page.evaluate(async baseURL=>{const r=await window.harness.saveConnection({kind:'compatible',name:'Syntetisk lokal prøve',baseURL});if(!r.ok)throw Error(r.error);},`http://127.0.0.1:${server.address().port}/v1`);
    await page.reload();await ui.skipIntroduction(page);
    const onboardingColor = await page.locator('#onboarding').evaluate(e => getComputedStyle(e).backgroundColor);
    await page.fill('#name', 'Borgermøder'); await page.fill('#purpose', 'En side med kommende borgermøder og tilmelding.'); await page.click('#create');
    await page.waitForSelector('body.workspace-calm #workspace:not([hidden])');
    check('Dark workspace by default', await page.locator('body').getAttribute('data-workspace-theme') === 'dark');
    await ui.taskOptions(page);const connectionID=await page.locator('#connection-select option').nth(1).getAttribute('value');await page.selectOption('#connection-select',connectionID);await page.locator('#model-catalog').evaluate(e=>e.open=true);await page.selectOption('#model-select','calm-test');await ui.closeTaskOptions(page);
    const project = await page.evaluate(() => current.root);
    // Ordinary local project content, deliberately unrelated to the host UI.
    await fs.writeFile(path.join(project, 'public/index.html'), '<!doctype html><html lang="da"><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:36px;background:#f0f0e7;color:#213d31;font:15px system-ui}h1{font-size:clamp(30px,6vw,54px);letter-spacing:-.04em}header{border-bottom:1px solid #ccd5c7;padding-bottom:25px}main{padding:30px 0}article{padding:24px 0;border-top:1px solid #ccd5c7}input{padding:12px;border:1px solid #a6baa8;border-radius:6px;max-width:100%}small{color:#56725c}</style><header>FÆLLES OM BYEN · SYNTETISK PRØVE</header><main><small>DIN BY. DIN STEMME.</small><h1>Vi mødes om<br>det næste skridt.</h1><p>Find et borgermøde, og tag del i samtalen.</p><article><h2>Sammen om bymidten</h2><p>Torsdag · 17.00–19.00 · Biblioteket</p></article><article><h2>Et grønnere fællesskab</h2><p>Tirsdag · 18.00–20.00 · Kulturhuset</p></article><label>Prøvens formulardata <input id="kept" value="Bevar mig"></label></main></html>');
    await page.frameLocator('#preview').locator('#kept').waitFor({timeout:20000}); await page.waitForTimeout(2000);
    await page.frameLocator('#preview').locator('#kept').fill('Formular bevares');
    await page.evaluate(() => {
      $('#prompt').value = '';
      appendMessage('Byg en enkel side til borgermøder. Man skal kunne se de næste møder og tilmelde sig.', 'user');
      appendMessage('Jeg bygger videre på din godkendte plan. Først samler jeg mødeoversigten og tilmeldingen i en rolig, overskuelig side.', 'assistant');
      setRunning(true, 'Arbejder'); setStatusDetail('Tilpasser tilmeldingen');
    });
    await page.locator('#preview-work-veil').waitFor(); await shot('working-desktop');
    const frameURL = await page.locator('#preview').getAttribute('src');
    await page.click('#preview-work-reveal');
    check('Reveal does not stop the run', await page.isVisible('#stop'));
    check('Reveal removes preview keyboard block', await page.locator('#preview-surface').evaluate(e=>!e.inert));
    check('Preview value survives reveal', await page.frameLocator('#preview').locator('#kept').inputValue() === 'Formular bevares');
    await shot('preview-revealed');
    await page.click('#tab-plan'); await page.click('#tab-preview');
    check('Tab switch preserves iframe URL', await page.locator('#preview').getAttribute('src') === frameURL);
    check('Tab switch preserves form', await page.frameLocator('#preview').locator('#kept').inputValue() === 'Formular bevares');
    check('Reveal choice survives status update', await page.locator('#preview-work-veil').isHidden());
    await page.click('#preview-work-status');
    check('Work overlay can be reopened', await page.isVisible('#preview-work-veil'));
    check('Covered iframe is inert', await page.locator('#preview-surface').evaluate(e=>e.inert));
    await page.evaluate(() => {
      const box=node('div',undefined,'approval');box.id='synthetic-wait';const b=node('button','Svar på prøvespørgsmål');b.id='synthetic-answer';box.append(b);$('#approvals').append(box);waitFor('synthetic','Hvem skal bruge siden?',box);
    });
    check('Waiting has a static status', await page.locator('.calm-preview-area').getAttribute('data-state') === 'waiting');
    await page.click('#preview-work-waiting'); check('Waiting action focuses actual question', await page.locator('#synthetic-answer').evaluate(e=>e===document.activeElement));
    await shot('waiting-desktop');
    await page.evaluate(()=>{ doneWaiting('synthetic'); $('#synthetic-wait').remove(); window.calmTestOriginal=view; const other=makeView('synthetic-other'); mountView(other); });
    check('Another conversation has no overlay', await page.locator('#preview-work-veil').isHidden());
    check('Another conversation has no glow', await page.locator('#chat-form').getAttribute('data-metal-state') === 'idle');
    await page.evaluate(()=>mountView(window.calmTestOriginal));
    check('Original conversation keeps running state', await page.isVisible('#preview-work-veil'));
    for (const [w,h] of [[1440,900],[1280,800],[980,720],[900,700],[720,650],[390,844],[320,568]]) {
      await size(w,h);
      if (w <= 720) await page.click('#workspace-chat');
      const m = await page.evaluate(()=>({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,promptBottom:$('#chat-form').getBoundingClientRect().bottom,promptRight:$('#chat-form').getBoundingClientRect().right,stopRight:$('#stop').getBoundingClientRect().right})); layouts.push(m);
      check(`Page fits ${w}x${h}`, m.pageWidth <= m.width && m.pageHeight <= m.height);
      check(`Composer fits ${w}`, m.promptBottom < m.height && m.promptRight <= m.width && m.stopRight <= m.width);
      if ([1440,980,390,320].includes(w)) await shot('chat-'+w);
      if (w <= 720) {
        await page.click('#workspace-surface'); check(`Surface visible ${w}`, await page.isVisible('#work-surface'));
        check(`Hidden chat inert ${w}`, await page.locator('#chat-panel').evaluate(e=>e.inert));
        if(await page.isVisible('#preview-work-reveal')) await page.click('#preview-work-reveal'); check(`Preview reachable ${w}`, await page.isVisible('#preview'));
        if (w===390) await shot('preview-mobile');
        await page.click('#workspace-chat');
      }
      if (w<=900) {
        await page.click('#workspace-navigation'); check(`Sidebar reachable ${w}`,await page.isVisible('#project-list'));
        await page.keyboard.press('Escape'); check(`Sidebar closed ${w}`,await page.locator('#sidebar').evaluate(e=>e.inert));
      }
    }
    await size(1440,900); await page.evaluate(()=>setRunning(false,'Klar'));
    check('Completion removes overlay',await page.locator('#preview-work-veil').isHidden());
    check('Completion removes glow',await page.locator('#chat-form').getAttribute('data-metal-state')==='idle');
    await page.evaluate(()=>setRunning(true,'Ny opgave'));check('A new run resets preview disclosure',await page.isVisible('#preview-work-veil'));await page.evaluate(()=>setRunning(false,'Klar'));
    await page.click('#chat-materials-plus'); check('One plus retains all attachment routes',await page.locator('#chat-materials-menu button').count()===4); await shot('plus-menu');await page.keyboard.press('Escape');
    await page.click('#model-chip'); check('Existing model controls remain available',await page.isVisible('#task-dialog'));check('Model visualization uses workspace theme',await page.locator('#task-dialog .onboarding-b-visual').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(36, 39, 43)'));check('Model search readable in dark theme',await page.locator('#model-search').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(25, 27, 30)'&&getComputedStyle(e).color==='rgb(232, 234, 237)'));await shot('model-settings');await page.click('[data-close="task-dialog"]');
    await page.click('#tab-preview');await page.focus('#tab-preview');await page.keyboard.press('ArrowRight');check('Keyboard tab navigation retained',await page.locator('#tab-plan').getAttribute('aria-selected')==='true');
    await page.click('#tab-preview');await page.click('#project-menu-toggle');await page.click('#workspace-theme');await page.keyboard.press('Escape');check('Light theme selectable',await page.locator('body').getAttribute('data-workspace-theme')==='light');await shot('light-desktop');
    await page.reload();await ui.skipIntroduction(page);await page.waitForSelector('body.workspace-calm');check('Theme persists across reload',await page.locator('body').getAttribute('data-workspace-theme')==='light');
    await page.click('#project-menu-toggle');await page.click('#workspace-theme');await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>setRunning(true,'Arbejder'));
    check('Reduced motion stops work edge',await page.locator('#chat-form').evaluate(e=>getComputedStyle(e,'::before').animationName==='none'));
    check('Reduced motion stops preview orbit',await page.locator('.calm-work-orbit').evaluate(e=>getComputedStyle(e,'::before').animationName==='none'));
    await page.emulateMedia({forcedColors:'active'});check('Forced colors retains work indication',await page.locator('#chat-form').evaluate(e=>getComputedStyle(e).borderTopWidth==='2px'));
    await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
    await page.evaluate(()=>setRunning(false,'Fejl'));check('Error never remains covered',await page.locator('#preview-work-veil').isHidden());
    await size(390,844);await page.click('#workspace-navigation');await page.locator('.chat-row[aria-current="true"]').click();check('Selecting a conversation closes the drawer',!await page.locator('body').evaluate(e=>e.classList.contains('calm-sidebar-open')));await size(1440,900);
    await page.click('#new');await page.waitForSelector('#onboarding:not([hidden])');check('Onboarding outside workspace theme',!await page.locator('body').evaluate(e=>e.classList.contains('workspace-calm')));
    check('Onboarding color unchanged',await page.locator('#onboarding').evaluate(e=>getComputedStyle(e).backgroundColor)===onboardingColor);
    await ui.openSetup(page);check('Onboarding B visualization preserved',await page.isVisible('#setup-visual'));await shot('onboarding-preserved');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,checks,layouts,errors,assetFailures:failures,externalModelCalls:0},null,2));
    console.log(JSON.stringify({passed:true,checks:checks.length,output}));
  } catch (error) { if(page) await shot('failure').catch(()=>{}); console.error(JSON.stringify({errors,failures}));throw error; }
  finally { if(app)await app.close();server.closeAllConnections();server.close();if(!output.startsWith(root+path.sep))await fs.rm(root,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1});
