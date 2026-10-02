import { randomBytes, createHash, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto';
import { invariant, hash } from '../factory/policy.mjs';

export const random = () => randomBytes(32).toString('base64url');
export function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export function encrypt(value, key) {
  invariant(/^[a-f0-9]{64}$/i.test(key || ''), 'SESSION_ENCRYPTION_KEY must be a 32-byte hex key.', 503);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64url')).join('.');
}
export function decrypt(value, key) {
  const [iv, tag, data] = value.split('.').map(s => Buffer.from(s, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export function cookieValue(req, name) { return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1); }
export function cookie(name, value, secure, maxAge = 28800) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`; }
export function verifyWebhook(raw, signature, secret) { invariant(secret && equal(signature, `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`), 'Invalid webhook signature.', 401); }

export class Auth {
  constructor(store, config, github, fetcher = fetch) { Object.assign(this, { store, config, github, fetcher }); }
  async begin() {
    const state = random(), verifier = random();
    await this.store.put('oauth', { id: hash(state), verifier, expires: Date.now() + 600000 }, this.config.owner);
    const params = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: `${this.config.origin}/api/auth/callback`, state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    return { state, url: `https://github.com/login/oauth/authorize?${params}` };
  }
  async callback(code, state, cookieState) {
    invariant(equal(state, cookieState) && code, 'OAuth state mismatch.', 401);
    const record = await this.store.transaction(async tx => {
      const r = await tx.get('oauth', hash(state), this.config.owner);
      invariant(r.expires > Date.now(), 'OAuth state expired.', 401);
      await tx.remove('oauth', hash(state), this.config.owner); return r;
    });
    const response = await this.fetcher('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.config.clientId, client_secret: this.config.clientSecret, code, state, code_verifier: record.verifier, redirect_uri: `${this.config.origin}/api/auth/callback` }), signal: AbortSignal.timeout(20000) });
    invariant(response.ok, 'GitHub login failed.', 401);
    const token = await response.json(); invariant(token.access_token, 'GitHub did not return a login token.', 401);
    const user = await this.github.request('/user', token.access_token);
    invariant(user.login.toLowerCase() === this.config.owner.toLowerCase(), 'Only the configured owner can sign in.', 403);
    const sid = random(), csrf = random();
    await this.store.put('sessions', { id: hash(sid), owner: this.config.owner, csrf, expires: Date.now() + Math.min(token.expires_in || 28800, 28800) * 1000,
      token: encrypt(token.access_token, this.config.sessionKey) }, this.config.owner);
    return sid;
  }
  async session(req) {
    const sid = cookieValue(req, 'factory_session'); invariant(sid, 'Sign in to continue.', 401);
    let session;
    try { session = await this.store.get('sessions', hash(sid), this.config.owner); } catch { invariant(false, 'Session expired. Sign in again.', 401); }
    invariant(session.expires > Date.now(), 'Session expired. Sign in again.', 401);
    if (!['GET', 'HEAD'].includes(req.method)) {
      invariant(req.headers.origin === this.config.origin && equal(req.headers['x-csrf-token'], session.csrf), 'Request origin or CSRF token invalid.', 403);
    }
    return { owner: session.owner, csrf: session.csrf, token: decrypt(session.token, this.config.sessionKey), id: session.id };
  }
}
