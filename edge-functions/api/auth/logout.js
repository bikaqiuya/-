import { json, corsHeaders } from '../../_lib/cors.js';
import { clearCookieHeaders } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  // 合并所有响应头：CORS + 防缓存 + 清除 Cookie
  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...clearCookieHeaders()
  };

  try {
    return new Response(JSON.stringify({ ok: true, message: '已退出登录' }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err) {
    console.error('Logout error:', err);
    // 即使出错也尝试清 cookie，登出操作应尽量保证完成
    return new Response(JSON.stringify({ ok: true, message: '已退出登录' }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
}
