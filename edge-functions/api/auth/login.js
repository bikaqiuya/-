import { json, corsHeaders } from '../../_lib/cors.js';
import { makeToken, setCookieHeaders, checkPassword } from '../../_lib/auth.js';

// ============ 常量 ============
const MAX_FAILS = 5;           // 最大失败次数
const FAIL_TTL = 900;          // 限流窗口 15 分钟（秒）
const FAIL_KEY_PREFIX = '__auth_fails__';  // 限流 key 前缀（双下划线降低冲突概率）

// ============ OPTIONS 预检 ============
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ============ POST 登录 ============
export async function onRequestPost(context) {
  const { request } = context;

  // 构建基础响应头
  const baseHeaders = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // 1. 解析请求体
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '请求格式无效' }, 400, baseHeaders);
  }

  const password = String(body.password || '');
  if (!password) {
    return json({ error: '请输入密码' }, 400, baseHeaders);
  }

  // 2. 获取客户端 IP（EdgeOne 环境）
  const ip = request.headers.get('cf-connecting-ip') 
    || request.headers.get('x-forwarded-for') 
    || request.headers.get('x-real-ip') 
    || 'unknown';
  const failsKey = `${FAIL_KEY_PREFIX}${ip}`;

  // 3. 限流检查（带错误处理，KV 异常时不阻塞登录）
  try {
    let fails = 0;
    const failsVal = await SPICE_KV.get(failsKey);
    if (failsVal) {
      fails = parseInt(failsVal, 10) || 0;
    }
    if (fails >= MAX_FAILS) {
      return json({ 
        error: `登录失败次数过多，请 ${Math.ceil(FAIL_TTL / 60)} 分钟后再试` 
      }, 429, baseHeaders);
    }

    // 4. 验证密码
    const ok = await checkPassword(password);
    if (!ok) {
      // 失败次数 +1
      fails += 1;
      await SPICE_KV.put(failsKey, String(fails), { expirationTtl: FAIL_TTL });
      return json({ 
        error: '密码错误',
        remaining: MAX_FAILS - fails
      }, 401, baseHeaders);
    }

    // 5. 登录成功：清除失败计数
    try {
      await SPICE_KV.delete(failsKey);
    } catch (_) {
      // 清除失败不影响登录流程
      console.warn('Failed to clear auth fails key:', failsKey);
    }

  } catch (kvErr) {
    // KV 异常时记录日志但不阻塞登录（降级放行）
    console.error('KV operation error during login:', kvErr);
    // 如果连 checkPassword 都因为 KV 异常而失败，需要兜底
    if (!(await checkPassword(password))) {
      return json({ error: '密码错误' }, 401, baseHeaders);
    }
  }

  // 6. 生成 token 并设置 cookie
  try {
    const token = await makeToken();
    const cookieHeaders = setCookieHeaders(token);

    return new Response(JSON.stringify({ ok: true, message: '登录成功' }), {
      status: 200,
      headers: {
        ...baseHeaders,
        ...cookieHeaders,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err) {
    console.error('Token generation error:', err);
    return json({ error: '登录处理失败，请重试' }, 500, baseHeaders);
  }
}
