import { json } from '../../_lib/cors.js';
import { clearCookieHeaders } from '../../_lib/auth.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, clearCookieHeaders());
}
