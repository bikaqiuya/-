// ============ 配置 ============
// 允许的源列表（环境变量 ALLOWED_ORIGINS 逗号分隔，如 "https://a.com,https://b.com"）
const ALLOWED_ORIGINS = (typeof ALLOWED_ORIGINS !== 'undefined' && ALLOWED_ORIGINS)
  ? ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['*'];

// ============ JSON 响应 ============
/**
 * 创建标准化 JSON 响应
 * @param {any} data - 要序列化的数据
 * @param {number} status - HTTP 状态码，默认 200
 * @param {object} extraHeaders - 额外响应头（可覆盖默认值，但 Content-Type 受保护）
 * @param {object} options - 选项
 * @param {boolean} options.noStore - 是否强制 no-store 缓存控制，默认 true
 */
export function json(data, status = 200, extraHeaders = {}, options = {}) {
  const { noStore = true } = options;

  // 序列化（带容错）
  let body;
  try {
    body = JSON.stringify(data);
  } catch (err) {
    body = JSON.stringify({ error: '响应数据序列化失败' });
    status = 500;
  }

  // 构建头：默认头 → 调用者头 → 保护关键头不被覆盖
  const headers = new Headers();

  // 默认头
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (noStore) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
  }
  headers.set('X-Content-Type-Options', 'nosniff');

  // 合并调用者传入的头
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  // 强制保护：确保 Content-Type 不被意外覆盖为错误值
  if (!headers.get('Content-Type')?.includes('application/json')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(body, { status, headers });
}

// ============ CORS 头 ============
/**
 * 生成 CORS 响应头
 * @param {Request|string} [reqOrOrigin] - Request 对象或指定 origin 字符串
 * @param {object} options - 选项
 * @param {boolean} options.allowCredentials - 是否允许凭证（默认 false）
 * @param {number} options.maxAge - 预检请求缓存时间（秒），默认 86400
 */
export function corsHeaders(reqOrOrigin, options = {}) {
  const { allowCredentials = false, maxAge = 86400 } = options;

  // 确定 origin
  let origin = '*';
  if (typeof reqOrOrigin === 'string') {
    origin = reqOrOrigin;
  } else if (reqOrOrigin && typeof reqOrOrigin.headers?.get === 'function') {
    const reqOrigin = reqOrOrigin.headers.get('Origin');
    if (reqOrigin) {
      // 校验是否在允许列表中
      if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(reqOrigin)) {
        origin = reqOrigin;
      }
      // 不在列表中则保持 '*'（浏览器会拦截，但至少不泄露配置）
    }
  }

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': String(maxAge)
  };

  if (allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // 动态 origin 时告知 CDN/浏览器根据 Origin 变化缓存不同版本
  if (origin !== '*') {
    headers['Vary'] = 'Origin';
  }

  return headers;
}
