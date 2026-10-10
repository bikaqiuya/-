import { json, corsHeaders } from './cors.js';

// ============ 常量 ============
const COOKIE_NAME = 'spice_admin';
const DEFAULT_TTL = 28800; // 8 小时
const SECRET_FALLBACK = 'dev-secret-change-me';

// ============ 内部状态缓存 ============
let _secretKey = null;      // 缓存 importKey 结果
let _secretRaw = null;      // 缓存原始 secret 字符串，用于检测变更

// ============ 工具函数 ============

function getSecret() {
  return (typeof AUTH_SECRET !== 'undefined' && AUTH_SECRET) || SECRET_FALLBACK;
}

function getTtl() {
  if (typeof SESSION_SECONDS === 'undefined') return DEFAULT_TTL;
  const n = parseInt(SESSION_SECONDS, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL;
}

function getAdminPassword() {
  return (typeof ADMIN_PASSWORD !== 'undefined' && ADMIN_PASSWORD) || '';
}

// ============ HMAC 签名（带 key 缓存） ============

async function getCachedKey() {
  const secret = getSecret();
  // secret 变更时重新 import（开发环境热更新场景）
  if (_secretKey && _secretRaw === secret) {
    return _secretKey;
  }
  _secretRaw = secret;
  _secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return _secretKey;
}

async function hmac(msg) {
  const key = await getCachedKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  // 返回 Uint8Array 而非 hex 字符串，方便后续做恒定时间比较
  return new Uint8Array(sig);
}

// 恒定时间比较（字节数组）
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// ============ Token 管理 ============

export async function makeToken() {
  const exp = Math.floor(Date.now() / 1000) + getTtl();
  // 加入随机 nonce 防止同一秒内签发相同 token
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const nonceHex = [...nonce].map(b => b.toString(16).padStart(2, '0')).join('');
  const body = `${exp}.${nonceHex}`;
  const sig = await hmac(body);
  const sigHex = [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${body}.${sigHex}`;
}

export async function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false; // exp.nonce.sig

  const [expStr, nonce, sigHex] = parts;

  // 验证过期时间
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;

  // 重新计算签名并与 token 中的签名做恒定时间比较
  const body = `${expStr}.${nonce}`;
  const expectedSig = await hmac(body);
  const expectedHex = [...expectedSig].map(b => b.toString(16).padStart(2, '0')).join('');

  // 长度不一致直接返回 false（不泄露信息，因为 hex 长度是固定的 64 字符）
  if (expectedHex.length !== sigHex.length) return false;

  // 恒定时间比较 hex 字符串
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ sigHex.charCodeAt(i);
  }
  return diff === 0;
}

// ============ Cookie 操作 ============

export function getCookieToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  // 更健壮的 cookie 解析（处理 cookie 值中可能包含 = 的情况）
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const c of cookies) {
    if (c.startsWith(COOKIE_NAME + '=')) {
      return decodeURIComponent(c.slice(COOKIE_NAME.length + 1));
    }
  }
  return '';
}

export function setCookieHeaders(token) {
  const ttl = getTtl();
  const secure = typeof ENVIRONMENT !== 'undefined' && ENVIRONMENT === 'production' 
    ? 'Secure; ' : '';
  return {
    'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${ttl}; HttpOnly; ${secure}SameSite=Lax`
  };
}

export function clearCookieHeaders() {
  return {
    'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  };
}

// ============ 鉴权中间件 ============

export async function requireAdmin(request) {
  const token = getCookieToken(request);
  return await verifyToken(token);
}

export function authFailedResponse(msg = '未登录或登录失效') {
  return json({ error: msg }, 401, corsHeaders());
}

// ============ 密码验证（恒定时间） ============

export async function checkPassword(password) {
  const want = getAdminPassword();
  if (!want) return false;

  const a = new TextEncoder().encode(password || '');
  const b = new TextEncoder().encode(want);

  // 恒定时间比较：即使长度不同也走完循环
  const maxLen = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < maxLen; i++) {
    const ab = i < a.length ? a[i] : 0;
    const bb = i < b.length ? b[i] : 0;
    diff |= ab ^ bb;
  }

  // 额外比较长度（恒定时间，因为上面的循环已经消耗了时间）
  diff |= (a.length ^ b.length);

  return diff === 0;
}
