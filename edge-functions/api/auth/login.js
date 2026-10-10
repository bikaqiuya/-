import { json, corsHeaders } from '../../_lib/cors.js';
import { makeToken, setCookieHeaders, checkPassword } from '../../_lib/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request } = context;
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
  const failsKey = `auth:fails:${ip}`;

  // 简单限流：读取失败次数
  let fails = parseInt(await SPICE_KV.get(failsKey) || '0');
  if (fails >= 5) {
    return json({ error: '尝试过多，稍后再试' }, 429);
  }

  const ok = await checkPassword(String(body.password || ''));
  if (!ok) {
    fails += 1;
    await SPICE_KV.put(failsKey, String(fails), { expirationTtl: 900 });
    return json({ error: '密码错误' }, 401);
  }

  await SPICE_KV.delete(failsKey);
  const token = await makeToken();
  return json({ ok: true }, 200, setCookieHeaders(token));
}
