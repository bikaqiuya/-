import { json, corsHeaders } from '../_lib/cors.js';
import { getSpices, saveSpices } from '../_lib/kv.js';
import { requireAdmin } from '../_lib/auth.js';

// ============ 工具函数 ============

// 字符串清理：去除首尾空格，限制长度，防基础 XSS
function sanitizeString(val, maxLen = 200) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

// 验证必填字段
function validateSpiceInput(body, isUpdate = false) {
  const name = sanitizeString(body.name, 100);
  if (!isUpdate && !name) return { error: 'name 必填', code: 400 };
  if (name && name.length > 100) return { error: 'name 不能超过 100 字符', code: 400 };
  
  return {
    data: {
      name,
      botanical: sanitizeString(body.botanical, 300),
      part: sanitizeString(body.part, 100),
      std12729: sanitizeString(body.std12729 || '表1收录', 100),
      std21725: sanitizeString(body.std21725, 100)
    }
  };
}

// ============ 路由处理 ============

// OPTIONS - 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// GET - 公开查询
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  let q = (url.searchParams.get('q') || '').trim().toLowerCase();
  
  // 限制查询词长度，防止超长正则/字符串匹配消耗
  if (q.length > 100) q = q.slice(0, 100);

  try {
    let list = await getSpices();

    if (q) {
      list = list.filter(x =>
        (x.name || '').toLowerCase().includes(q) ||
        (x.botanical || '').toLowerCase().includes(q) ||
        (x.part || '').toLowerCase().includes(q)
      );
    }
    
    // 返回时附加 CORS 头，确保跨域可用
    return json(list, 200, corsHeaders());
  } catch (err) {
    console.error('GET /api/spices error:', err);
    return json({ error: '数据读取失败' }, 500, corsHeaders());
  }
}

// POST - 新增（需登录）
export async function onRequestPost(context) {
  if (!(await requireAdmin(context.request))) {
    return json({ error: '需要登录' }, 401, corsHeaders());
  }
  
  const { request } = context;
  let body;
  try { 
    body = await request.json(); 
  } catch (_) { 
    return json({ error: 'JSON 无效' }, 400, corsHeaders()); 
  }

  // 校验输入
  const validated = validateSpiceInput(body, false);
  if (validated.error) return json({ error: validated.error }, validated.code, corsHeaders());
  const { name, botanical, part, std12729, std21725 } = validated.data;

  try {
    const list = await getSpices();
    
    // 检查重名
    if (list.some(x => x.name === name)) {
      return json({ error: `已存在同名香辛料「${name}」` }, 409, corsHeaders());
    }

    list.push({ name, botanical, part, std12729, std21725 });
    await saveSpices(list);
    
    return json({ ok: true, count: list.length, name }, 201, corsHeaders());
  } catch (err) {
    console.error('POST /api/spices error:', err);
    return json({ error: '保存失败，请重试' }, 500, corsHeaders());
  }
}

// PUT - 修改（需登录）
export async function onRequestPut(context) {
  if (!(await requireAdmin(context.request))) {
    return json({ error: '需要登录' }, 401, corsHeaders());
  }
  
  const { request } = context;
  const url = new URL(request.url);
  const originalName = sanitizeString(url.searchParams.get('name'), 100);
  if (!originalName) {
    return json({ error: 'name 参数必填（URL 中 ?name=原名）' }, 400, corsHeaders());
  }

  let body;
  try { 
    body = await request.json(); 
  } catch (_) { 
    return json({ error: 'JSON 无效' }, 400, corsHeaders()); 
  }

  // 校验输入（允许 name 为空表示不改名）
  const validated = validateSpiceInput(body, true);
  if (validated.error) return json({ error: validated.error }, validated.code, corsHeaders());
  const { name: newName, botanical, part, std12729, std21725 } = validated.data;

  try {
    const list = await getSpices();
    const idx = list.findIndex(x => x.name === originalName);
    if (idx < 0) {
      return json({ error: '未找到该香辛料' }, 404, corsHeaders());
    }

    // 如果改了名字，检查新名字是否与其他条目冲突
    if (newName && newName !== originalName) {
      const nameExists = list.some((x, i) => x.name === newName && i !== idx);
      if (nameExists) {
        return json({ error: `已存在同名香辛料「${newName}」，无法重命名` }, 409, corsHeaders());
      }
    }

    // 更新数据
    const finalName = newName || originalName;
    list[idx] = {
      name: finalName,
      botanical: botanical || list[idx].botanical,
      part: part || list[idx].part,
      std12729: std12729 || list[idx].std12729,
      std21725: std21725 || list[idx].std21725
    };

    await saveSpices(list);
    return json({ ok: true, name: finalName }, 200, corsHeaders());
  } catch (err) {
    console.error('PUT /api/spices error:', err);
    return json({ error: '更新失败，请重试' }, 500, corsHeaders());
  }
}

// DELETE - 删除（需登录）
export async function onRequestDelete(context) {
  if (!(await requireAdmin(context.request))) {
    return json({ error: '需要登录' }, 401, corsHeaders());
  }
  
  const { request } = context;
  const url = new URL(request.url);
  const name = sanitizeString(url.searchParams.get('name'), 100);
  if (!name) {
    return json({ error: 'name 参数必填（URL 中 ?name=要删除的名称）' }, 400, corsHeaders());
  }

  try {
    const list = await getSpices();
    const originalLength = list.length;
    const next = list.filter(x => x.name !== name);
    
    if (next.length === originalLength) {
      return json({ error: '未找到该香辛料' }, 404, corsHeaders());
    }
    
    await saveSpices(next);
    return json({ ok: true, count: next.length, deleted: originalLength - next.length }, 200, corsHeaders());
  } catch (err) {
    console.error('DELETE /api/spices error:', err);
    return json({ error: '删除失败，请重试' }, 500, corsHeaders());
  }
}
