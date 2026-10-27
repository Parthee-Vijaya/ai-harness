// Rensning af indsatte nøgler og fejl fra udbyderne. Alle nøgler her er opdigtede.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { cleanKey, redact, requestJSON, normalize } = require('../core/connections.cjs');
const corti = environment => Buffer.from(`${environment}:password:testklient:testbruger:hemmelighed`).toString('base64');
const SECRET = 'sk-proj-SYNTETISK0123456789abcdefSYNTETISK';

test('rensningen fjerner det, der typisk følger med en indsat nøgle, og siger hvad', () => {
  const cases = [
    [`  ${SECRET}\n`, ['mellemrum']],
    [` ${SECRET}`, ['mellemrum']],
    [`​${SECRET}﻿`, ['usynlige tegn']],
    [`"${SECRET}"`, ['anførselstegn']],
    [`“${SECRET}”`, ['anførselstegn']],
    [`Bearer ${SECRET}`, ['Bearer foran']],
    [`Authorization: Bearer ${SECRET}`, ['Authorization foran', 'Bearer foran']],
    [`OPENAI_API_KEY=${SECRET}`, ['navn foran']],
    [`export OPENAI_API_KEY="${SECRET}"`, ['navn foran', 'anførselstegn']]
  ];
  for (const [raw, changes] of cases) {
    const result = cleanKey(raw, 'openai', { strict: true });
    assert.equal(result.key, SECRET, JSON.stringify(raw));
    assert.deepEqual(result.changes.sort(), [...changes].sort(), JSON.stringify(raw));
  }
  assert.deepEqual(cleanKey(SECRET, 'openai', { strict: true }), { key: SECRET, changes: [] });
});

test('Cortis manglende = tilføjes, og regionen følger den rensede nøgle', () => {
  const full = corti('eu-s'), short = full.replace(/=+$/, '');
  assert.notEqual(short, full, 'testnøglen skal have = til sidst');
  assert.deepEqual(cleanKey(short, 'corti', { strict: true }), { key: full, changes: ['manglende = til sidst'] });
  assert.equal(cleanKey(`CORTI_API_KEY=${short}`, 'corti', { strict: true }).key, full);
  // Bearer foran sendte tidligere en EU-S-nøgle til EU-adressen.
  assert.equal(normalize({ kind: 'corti', name: 'Corti', apiKey: `Bearer ${full}` }).baseURL, 'https://ai.eu-s.corti.app/v1');
  assert.equal(normalize({ kind: 'corti', name: 'Corti', apiKey: ` "${short}" ` }).baseURL, 'https://ai.eu-s.corti.app/v1');
  assert.throws(() => cleanKey(full.slice(0, 13), 'corti', { strict: true }), /afkortet/);
  // En base64-nøgle med = til sidst må ikke forveksles med et navn foran.
  assert.equal(cleanKey('ZXUtczpwYXNzd29yZA==', 'corti').key, 'ZXUtczpwYXNzd29yZA==');
});

test('tegn, der ikke hører til en nøgle, afvises med en besked uden nøglen', () => {
  for (const [raw, pattern] of [[`sk-proj-${'a'.repeat(12)} ${'b'.repeat(12)}`, /mellemrum inde i sig/], [`${SECRET}–x`, /ikke hører til en API-nøgle/], [`${SECRET}\u0000`, /ikke hører til en API-nøgle/], ['', /tomt/], ['   ', /tomt/], ['sk-kort', /afkortet/]]) {
    assert.throws(() => cleanKey(raw, 'openai', { strict: true }), error => pattern.test(error.message) && !error.message.includes('sk-proj') && error.reason === 'invalid', JSON.stringify(raw));
  }
  // Uden strict tåles bogstaver som ø, så ældre opdigtede testnøgler stadig virker; styretegn afvises altid.
  assert.equal(cleanKey('syntetisk-før', 'compatible').key, 'syntetisk-før');
  assert.throws(() => cleanKey('syntetisk\u0001', 'compatible'), /ikke hører til/);
  assert.throws(() => cleanKey(`ghp_${'a'.repeat(36)}`, 'mistral', { strict: true }), /ligner en GitHub-nøgle/);
  assert.throws(() => cleanKey(SECRET, 'github', { strict: true }), /ligner en API-nøgle/);
  assert.equal(cleanKey(` Bearer github_pat_${'a'.repeat(30)} `, 'github', { strict: true }).key, `github_pat_${'a'.repeat(30)}`);
});

test('udbyderens svar står bag Se detaljer uden nøgler', () => {
  const out = redact(`fejl for ${SECRET} og Bearer abc.def og github_pat_${'x'.repeat(30)} og ${'A'.repeat(50)}`, [SECRET]);
  for (const hidden of [SECRET, 'abc.def', 'github_pat_', 'A'.repeat(50)]) assert.ok(!out.includes(hidden), hidden);
  assert.ok(redact('x'.repeat(2000)).length < 700);
});

async function server(t, handler) {
  const s = http.createServer(handler); await new Promise(resolve => s.listen(0, '127.0.0.1', resolve)); t.after(() => { s.closeAllConnections(); s.close(); });
  return `http://127.0.0.1:${s.address().port}/v1/models`;
}

test('en afvisning læser udbyderens grund, oversætter kendte mønstre og gentager aldrig nøglen', async t => {
  const url = await server(t, (req, res) => {
    res.statusCode = req.headers['x-svar'] === 'kvote' ? 429 : 401;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { message: req.url.includes('base64') ? 'API key is not valid base64' : `Incorrect API key provided: ${req.headers.authorization?.slice(7)}` } }));
  });
  const rejected = await requestJSON(url, { key: SECRET, kind: 'openai' }).catch(error => error);
  assert.equal(rejected.reason, 'rejected');
  assert.match(rejected.message, /Serveren afviste adgangen\. Udbyderen genkender ikke nøglen\./);
  assert.match(rejected.details, /^HTTP 401: Incorrect API key provided: ••••/);
  assert.ok(!rejected.message.includes(SECRET) && !rejected.details.includes(SECRET));
  const base64 = await requestJSON(url.replace('/models', '/base64'), { key: corti('eu-s'), kind: 'corti' }).catch(error => error);
  assert.match(base64.message, /Corti afviste nøglen på adressen i EU\. Udbyderen siger, at nøglen ikke er gyldig base64/);
});

test('en server, der ikke svarer, skelnes fra en afvisning; en ugyldig header viser aldrig nøglen', async t => {
  const closed = await server(t, () => {}); // Svarer aldrig.
  const timeout = await requestJSON(closed, { key: SECRET, kind: 'openai', signal: AbortSignal.timeout(200) }).catch(error => error);
  assert.equal(timeout.reason, 'timeout');
  // En port, der lige er blevet ledig, så forbindelsen afvises (port 1 er spærret i fetch og prøver noget andet).
  const free = await new Promise(resolve => { const s = http.createServer().listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
  const refused = await requestJSON(`http://127.0.0.1:${free}/v1/models`, { key: SECRET, kind: 'openai' }).catch(error => error);
  assert.equal(refused.reason, 'unreachable');
  assert.match(refused.message, /Serveren svarer ikke/);
  const header = await requestJSON(closed, { key: 'sk-HEMMELIG\u0001', kind: 'openai', signal: AbortSignal.timeout(2000) }).catch(error => error);
  assert.equal(header.reason, 'invalid');
  assert.ok(!header.message.includes('HEMMELIG') && !String(header.details).includes('HEMMELIG'));
  const redirect = await server(t, (req, res) => { res.statusCode = 302; res.setHeader('location', 'http://example.invalid/'); res.end(); });
  const moved = await requestJSON(redirect, { key: SECRET, kind: 'openai' }).catch(error => error);
  assert.match(moved.message, /omdirigering/);
  const broken = await server(t, (req, res) => { res.statusCode = 503; res.end('overbelastet'); });
  assert.equal((await requestJSON(broken, { key: SECRET, kind: 'openai' }).catch(error => error)).reason, 'server', 'en server, der svarer med 5xx, giver ikke Gem alligevel');
});
