import { json } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const ok = await requireAdmin(context.request);
  return ok ? json({ authenticated: true }) : json({ authenticated: false }, 401);
}
