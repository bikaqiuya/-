import { json, corsHeaders } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/auth.js';

// ============ 环境变量注入（Makers 关键修复） ============
function injectEnv(context) {
  if (context && context.env) {
    if (context.env.ADMIN_PASSWORD) globalThis.ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
    if (context.env.AUTH_SECRET) globalThis.AUTH_SECRET = context.env.AUTH_SECRET;
    if (context.env.SESSION_SECONDS) globalThis.SESSION_SECONDS = context.env.SESSION_SECONDS;
    if (context.env.ENVIRONMENT) globalThis.ENVIRONMENT = context.env.ENVIRONMENT;
  }
}

export async function onRequestGet(context) {
  // ★ 关键：把 Makers env 注入到全局
  injectEnv(context);

  // 构建响应头：CORS + 防缓存
  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    const ok = await requireAdmin(context.request);

    if (ok) {
      // 已登录：返回认证状态
      return json({ authenticated: true }, 200, headers);
    } else {
      // 未登录或会话无效：返回 401 + 明确提示
      return json({ 
        authenticated: false, 
        error: '未登录或会话已过期' 
      }, 401, headers);
    }
  } catch (err) {
    // 兜底：鉴权逻辑本身出错
    console.error('Auth me error:', err);
    return json({ 
      authenticated: false, 
      error: '鉴权检查失败，请重试' 
    }, 500, headers);
  }
}
