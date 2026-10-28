import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { PrivateStore } from './private-store.mjs';

export const endpoint = 'https://mcp.eu.apyhub.com';
export const issuer = 'https://apyhub.com';

export async function restrictedFetch(input, options = {}) {
  const url = new URL(input instanceof Request ? input.url : input);
  if (![endpoint, issuer].includes(url.origin) || url.username || url.password) throw new Error('Unapproved Apyhub origin');
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  return fetch(input, { ...options, redirect: 'error', signal });
}

export class ApyhubAuth {
  constructor(store = new PrivateStore(), { redirectUrl, onAuthorization } = {}) {
    this.store = store; this.redirectUrl = redirectUrl; this.onAuthorization = onAuthorization;
    this.expectedState = randomBytes(32).toString('base64url');
  }
  get clientMetadata() { return { client_name: 'Aura Tool Lab', redirect_uris: [this.redirectUrl], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'mcp' }; }
  state() { return this.expectedState; }
  clientInformation() { return this.store.read('client.json'); }
  saveClientInformation(value) { return this.store.write('client.json', value); }
  tokens() { return this.store.read('tokens.json'); }
  saveTokens(value) { return this.store.write('tokens.json', value); }
  saveCodeVerifier(value) { this.verifier = value; }
  codeVerifier() { if (!this.verifier) throw new Error('Start a new login'); return this.verifier; }
  async redirectToAuthorization(url) {
    if (url.origin !== issuer || url.pathname !== '/oauth/authorize') throw new Error('Unapproved authorization endpoint');
    if (!this.onAuthorization) throw new Error('Login required: run login');
    await this.onAuthorization(url);
  }
  async invalidateCredentials(scope) {
    if (['all', 'tokens'].includes(scope)) await this.store.write('tokens.json', null);
    if (['all', 'client'].includes(scope)) await this.store.write('client.json', null);
    if (['all', 'verifier'].includes(scope)) this.verifier = undefined;
  }
}

export function validCallback(url, expectedState) {
  if (url.pathname !== '/callback' || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 || url.searchParams.has('error')) return false;
  const actual = Buffer.from(url.searchParams.get('state') || '');
  const expected = Buffer.from(expectedState);
  return actual.length === expected.length && timingSafeEqual(actual, expected) && Boolean(url.searchParams.get('code'));
}

export async function login({ store = new PrivateStore(), onAuthorization, timeoutMs = 600_000 } = {}) {
  let provider, timer, complete, fail, busy = false;
  const done = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  // Mark rejection as handled until setup has completed.
  done.catch(() => {});
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('Referrer-Policy', 'no-referrer');
    const expectedHost = `127.0.0.1:${server.address().port}`;
    let url;
    try { url = new URL(request.url, `http://${expectedHost}`); } catch { response.writeHead(400); response.end('Invalid callback.'); return; }
    if (request.method !== 'GET' || request.headers.host !== expectedHost || url.origin !== `http://${expectedHost}` || !provider || !validCallback(url, provider.expectedState) || busy) { response.writeHead(400); response.end('Invalid callback. Start login again if needed.'); return; }
    busy = true;
    try {
      const result = await auth(provider, { serverUrl: endpoint, authorizationCode: url.searchParams.get('code'), fetchFn: restrictedFetch });
      if (result !== 'AUTHORIZED') throw new Error('Authorization incomplete');
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Aura Tool Lab er tilsluttet. Du kan lukke fanen.'); complete();
    } catch { response.writeHead(502); response.end('Login failed. Start login again.'); fail(new Error('Apyhub token exchange failed')); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  provider = new ApyhubAuth(store, { redirectUrl: `http://127.0.0.1:${server.address().port}/callback`, onAuthorization });
  // Dynamic redirect ports require a fresh public-client registration per login.
  provider.clientInformation = () => provider.registration;
  provider.saveClientInformation = async value => { provider.registration = value; await store.write('client.json', value); };
  try {
    timer = setTimeout(() => fail(new Error('Login timed out')), timeoutMs);
    const result = await auth(provider, { serverUrl: endpoint, scope: 'mcp', fetchFn: restrictedFetch });
    if (result !== 'AUTHORIZED') await done;
    return { connected: true, endpoint };
  } finally { clearTimeout(timer); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

export async function connect(store = new PrivateStore()) {
  const provider = new ApyhubAuth(store);
  if (!(await provider.tokens())?.access_token) throw new Error('Login required: run login');
  const client = new Client({ name: 'aura-tool-lab', version: '0.1.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), { authProvider: provider, fetch: restrictedFetch, reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 } });
  try { await client.connect(transport, { timeout: 30_000 }); return client; }
  catch (error) { await client.close(); throw error; }
}

export async function discover(client) {
  const tools = [], seen = new Set(); let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : {}, { timeout: 30_000 });
    tools.push(...page.tools);
    if (tools.length > 10_000 || page.nextCursor && seen.has(page.nextCursor)) throw new Error('Invalid tool pagination');
    cursor = page.nextCursor; seen.add(cursor);
  } while (cursor);
  return tools;
}
