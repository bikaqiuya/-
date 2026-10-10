import { json } from './cors.js';

const COOKIE = 'spice_admin';
const DEFAULT_TTL = 28800; // 8h

function getSecret() {
  return (typeof AUTH_SECRET !== 'undefined' && AUTH_SECRET) || 'dev-secret-change-me';
}
function getTtl() {
  const n = parseInt(typeof SESSION_SECONDS !== 'undefined' && SESSION_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL;
}

async function hmac(msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken() {
  const exp = Math.floor(Date.now() / 1000) + getTtl();
  const body = `${exp}`;
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [expStr, sig] = token.split('.');
  const expect = await hmac(expStr);
  if (expect.length !== sig.length) return false;
  let ok = true;
  for (let i = 0; i < expect.length; i++) if (expect[i] !== sig[i]) ok = false;
  if (!ok) return false;
  if (parseInt(expStr) * 1000 < Date.now()) return false;
  return true;
}

export function getCookieToken(request) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp(`${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function authFailedResponse(msg = '未登录或登录失效') {
  return json({ error: msg }, 401);
}

export async function requireAdmin(request) {
  const token = getCookieToken(request);
  if (!(await verifyToken(token))) return false;
  return true;
}

export function setCookieHeaders(token) {
  const ttl = getTtl();
  return {
    'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`
  };
}

export function clearCookieHeaders() {
  return {
    'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
  };
}

export async function checkPassword(password) {
  const want = (typeof ADMIN_PASSWORD !== 'undefined' && ADMIN_PASSWORD) || '';
  if (!want) return false;
  if (password.length !== want.length) return false;
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(want);
  if (a.length !== b.length) return false;
  let ok = true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) ok = false;
  return ok;
}
