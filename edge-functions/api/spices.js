import { json, corsHeaders } from '../_lib/cors.js';
import { getSpices, saveSpices, getSpice } from '../_lib/kv.js';
import { requireAdmin } from '../_lib/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// 公开：列表+模糊查询 ?q=八角
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  let list = await getSpices();

  if (q) {
    list = list.filter(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.botanical || '').toLowerCase().includes(q)
    );
  }
  return json(list);
}

// 管理：新增（需登录）
export async function onRequestPost(context) {
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);
  const { request } = context;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'JSON无效' }, 400); }

  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'name必填' }, 400);

  const list = await getSpices();
  if (list.some(x => x.name === name)) return json({ error: '已存在同名' }, 409);

  list.push({
    name,
    botanical: String(body.botanical || ''),
    part: String(body.part || ''),
    std12729: String(body.std12729 || '表1收录'),
    std21725: String(body.std21725 || '')
  });
  await saveSpices(list);
  return json({ ok: true, count: list.length }, 201);
}

// 管理：按?name=修改
export async function onRequestPut(context) {
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);
  const { request } = context;
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return json({ error: 'name参数必填' }, 400);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'JSON无效' }, 400); }

  const list = await getSpices();
  const idx = list.findIndex(x => x.name === name);
  if (idx < 0) return json({ error: '未找到' }, 404);

  list[idx] = {
    name: body.name && String(body.name).trim() ? String(body.name).trim() : name,
    botanical: String(body.botanical ?? list[idx].botanical),
    part: String(body.part ?? list[idx].part),
    std12729: String(body.std12729 ?? list[idx].std12729),
    std21725: String(body.std21725 ?? list[idx].std21725)
  };
  await saveSpices(list);
  return json({ ok: true });
}

// 管理：按?name=删除
export async function onRequestDelete(context) {
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);
  const { request } = context;
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return json({ error: 'name参数必填' }, 400);

  const list = await getSpices();
  const next = list.filter(x => x.name !== name);
  if (next.length === list.length) return json({ error: '未找到' }, 404);
  await saveSpices(next);
  return json({ ok: true, count: next.length });
}
