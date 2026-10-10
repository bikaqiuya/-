import { json } from '../../_lib/cors.js';
import { getSpices } from '../../_lib/kv.js';
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);
  const list = await getSpices();
  return json(list);
}
