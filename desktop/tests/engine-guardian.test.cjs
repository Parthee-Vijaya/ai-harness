const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

// Rigtige processer med syntetiske Node-programmer i stedet for OpenCode. Ingen app, nøgle eller udbyder.
const guardian = path.resolve(__dirname, '../core/engine-guardian.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const posix = { skip: process.platform === 'win32', timeout: 15000 };

test('når ejeren dræbes med SIGKILL, lukkes den private forbindelse, og motoren stopper', posix, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vagt-'));
  const marker = path.join(directory, 'motor.json'), fixture = path.join(directory, 'motor.cjs');
  await fs.writeFile(fixture, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`);
  const owner = spawn(process.execPath, ['-e', `const {spawn}=require('node:child_process');const p=spawn(process.execPath,[${JSON.stringify(guardian)},process.execPath,${JSON.stringify(fixture)}],{stdio:['ignore','ignore','ignore','ipc']});p.on('exit',()=>process.exit());`], { stdio: 'ignore' });
  let engine;
  t.after(async () => { if (alive(owner.pid)) owner.kill('SIGKILL'); if (engine && alive(engine)) process.kill(engine, 'SIGKILL'); await fs.rm(directory, { recursive: true, force: true }); });
  for (let i = 0; i < 100; ++i) { try { engine = JSON.parse(await fs.readFile(marker, 'utf8')).pid; break; } catch { await pause(30); } }
  assert.ok(engine && alive(engine));
  owner.kill('SIGKILL');
  for (let i = 0; i < 100 && alive(engine); ++i) await pause(30);
  assert.equal(alive(engine), false, 'motoren må ikke overleve sin ejer');
});

test('stopper motoren uventet, stopper processer i motorens egen gruppe også', posix, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vagt-gruppe-'));
  const marker = path.join(directory, 'gruppe.json'), engine = path.join(directory, 'motor.cjs'), command = path.join(directory, 'kommando.cjs');
  // Kommandoen bliver i motorens procesgruppe og ignorerer SIGTERM.
  await fs.writeFile(command, `process.on('SIGTERM',()=>{});process.send({ready:true,pid:process.pid});setInterval(()=>{},1000);`);
  await fs.writeFile(engine, `const {spawn}=require('node:child_process');const p=spawn(process.execPath,[${JSON.stringify(command)}],{stdio:['ignore','ignore','ignore','ipc']});p.once('message',m=>{if(m.ready)require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({engine:process.pid,command:m.pid}));});setInterval(()=>{},1000);`);
  const owned = spawn(process.execPath, [guardian, process.execPath, engine], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let group;
  t.after(async () => {
    if (owned.exitCode === null && owned.signalCode === null) owned.kill('SIGTERM');
    if (group?.engine) { try { process.kill(-group.engine, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    await fs.rm(directory, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) { try { group = JSON.parse(await fs.readFile(marker, 'utf8')); break; } catch { await pause(30); } }
  assert.ok(group?.engine && group?.command && alive(group.engine) && alive(group.command));
  const exited = new Promise(resolve => owned.once('exit', resolve));
  process.kill(group.engine, 'SIGKILL');
  await exited;
  for (let i = 0; i < 100 && alive(group.command); i++) await pause(30);
  assert.equal(alive(group.command), false, 'en proces i motorens gruppe må ikke overleve et uventet motorstop');
});

test('en almindelig lukning stopper motoren, og motoren arver ikke Electrons Node-tilstand', posix, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vagt-normal-'));
  const marker = path.join(directory, 'motor.json'), fixture = path.join(directory, 'motor.cjs');
  await fs.writeFile(fixture, `require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,electronNodeMode:process.env.ELECTRON_RUN_AS_NODE??null}));setInterval(()=>{},1000);`);
  const owned = spawn(process.execPath, [guardian, process.execPath, fixture], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const reported = new Promise(resolve => owned.once('message', resolve));
  let engine;
  t.after(async () => {
    if (owned.exitCode === null && owned.signalCode === null) owned.kill('SIGTERM');
    if (engine?.pid) { try { process.kill(-engine.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    await fs.rm(directory, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) { try { engine = JSON.parse(await fs.readFile(marker, 'utf8')); break; } catch { await pause(30); } }
  assert.ok(engine?.pid && alive(engine.pid));
  assert.equal(engine.electronNodeMode, null, 'motoren og dens kommandoer må ikke køre i Electrons Node-tilstand');
  assert.deepEqual(await reported, { type: 'engine', pid: engine.pid }, 'ejeren får motorens PID');
  const closed = new Promise(resolve => owned.once('exit', resolve));
  owned.kill('SIGTERM'); await closed;
  for (let i = 0; i < 100 && alive(engine.pid); i++) await pause(30);
  assert.equal(alive(engine.pid), false, 'en almindelig lukning skal stoppe motoren');
});

test('vagtprocessen nægter at starte uden ejerforbindelse eller med et ukendt programnavn', { skip: process.platform === 'win32', timeout: 10000 }, async () => {
  for (const [args, stdio] of [[[process.execPath, '-e', '0'], 'ignore'], [['opencode-dev', 'serve'], ['ignore', 'ignore', 'ignore', 'ipc']]]) {
    const child = spawn(process.execPath, [guardian, ...args], { stdio });
    const code = await new Promise(resolve => child.once('exit', resolve));
    assert.equal(code, 1);
  }
});

test('dør ejeren, mens vagtprocessen starter, efterlades ingen motor', posix, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-vagt-start-'));
  const marker = path.join(directory, 'motor.json'), fixture = path.join(directory, 'motor.cjs');
  await fs.writeFile(fixture, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`);
  t.after(async () => {
    try { const { pid } = JSON.parse(await fs.readFile(marker, 'utf8')); process.kill(-pid, 'SIGKILL'); } catch { /* Ingen motor at rydde op. */ }
    await fs.rm(directory, { recursive: true, force: true });
  });
  // Ejeren starter vagtprocessen og afslutter med det samme, før vagten når at melde motorens PID.
  const owner = spawn(process.execPath, ['-e', `const {spawn}=require('node:child_process');spawn(process.execPath,[${JSON.stringify(guardian)},process.execPath,${JSON.stringify(fixture)}],{detached:true,stdio:['ignore','ignore','ignore','ipc']});process.exit(0);`], { stdio: 'ignore' });
  await new Promise(resolve => owner.once('exit', resolve));
  await pause(3000);
  let engine = null; try { engine = JSON.parse(await fs.readFile(marker, 'utf8')).pid; } catch { /* Vagten nåede ikke at starte motoren. */ }
  assert.ok(!engine || !alive(engine), 'en motor startet af en vagt uden ejer må ikke blive kørende');
});
