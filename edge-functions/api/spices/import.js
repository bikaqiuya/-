import { json } from '../../_lib/cors.js';
import { saveSpices } from '../../_lib/kv.js';
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);
  let body;
  try { body = await context.request.json(); } catch (_) { return json({ error: 'JSON无效' }, 400); }
  if (!Array.isArray(body)) return json({ error: '需为数组' }, 400);

  const clean = body.map(x => ({
    name: String(x.name || '').trim(),
    botanical: String(x.botanical || ''),
    part: String(x.part || ''),
    std12729: String(x.std12729 || '表1收录'),
    std21725: String(x.std21725 || '')
  })).filter(x => x.name);

  await saveSpices(clean);
  return json({ ok: true, count: clean.length });
}
