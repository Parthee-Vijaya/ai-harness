const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

// Et syntetisk framework, der ligesom Vite 5/6 og Astro 5 læser port 0 som standardporten 5173.
// Prøven afprøver Auras portvalg. Rigtige Vite- og Astro-projekter afprøves med npm run test:frameworks.
async function fixture(t, kind) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aura-preview-port-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const moduleRoot = path.join(root, 'node_modules', kind);
  await fs.mkdir(moduleRoot, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), '{}');
  await fs.writeFile(path.join(moduleRoot, 'package.json'), JSON.stringify({ name: kind, type: 'module', exports: './index.mjs' }));
  await fs.writeFile(path.join(moduleRoot, 'index.mjs'), `
    import http from 'node:http';
    const make = options => {
      const httpServer = http.createServer((req, res) => res.end('lokal forhåndsvisning'));
      const listen = () => new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(options.server.port || 5173, options.server.host, resolve); });
      const close = () => new Promise(resolve => httpServer.close(resolve));
      return { httpServer, listen, close, config: { base: '/' } };
    };
    export async function createServer(options) { return make(options); }
    export async function dev(options) { const server = make(options); await server.listen(); return { address: server.httpServer.address(), stop: server.close }; }
  `);
  return root;
}
async function runner(t, root, kind, env = {}) {
  const child = spawn(process.execPath, [path.join(__dirname, '../core/dev-server-runner.cjs'), root, kind], { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', value => { stderr += value; });
  t.after(async () => { if (child.exitCode !== null || child.signalCode !== null) return; const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Forhåndsvisningen blev ikke klar')), 10000);
    child.once('message', message => { clearTimeout(timer); resolve(message.url); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Forhåndsvisningen stoppede med ${code}: ${stderr}`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { child, url };
}
const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });

for (const kind of ['vite', 'astro']) {
  test(`${kind}: to arbejdsmapper får hver sin loopback-port, og Stop rammer kun den ene`, async t => {
    const first = await runner(t, await fixture(t, kind), kind);
    const second = await runner(t, await fixture(t, kind), kind);
    assert.notEqual(first.url, second.url);
    for (const { url } of [first, second]) {
      assert.equal(new URL(url).hostname, '127.0.0.1');
      assert.equal(await (await fetch(url)).text(), 'lokal forhåndsvisning');
    }
    const exited = once(second.child, 'exit'); second.child.kill('SIGTERM'); await exited;
    await assert.rejects(fetch(second.url, { signal: AbortSignal.timeout(1000) }));
    assert.equal(await (await fetch(first.url)).text(), 'lokal forhåndsvisning');
  });

  test(`${kind}: projektets huskede port bruges, når den er ledig, ellers en anden ledig port`, async t => {
    const remembered = await freePort();
    const reused = await runner(t, await fixture(t, kind), kind, { AURA_PREVIEW_PORT: String(remembered) });
    assert.equal(Number(new URL(reused.url).port), remembered, 'den huskede port genbruges, så sidens lokale data bevares');
    const fallback = await runner(t, await fixture(t, kind), kind, { AURA_PREVIEW_PORT: String(remembered) });
    assert.notEqual(Number(new URL(fallback.url).port), remembered, 'en optaget huskede port giver en anden ledig port');
    assert.equal(await (await fetch(fallback.url)).text(), 'lokal forhåndsvisning');
    const odd = await runner(t, await fixture(t, kind), kind, { AURA_PREVIEW_PORT: '80' });
    assert.notEqual(Number(new URL(odd.url).port), 80, 'en ugyldig huskede port ignoreres');
  });
}
