import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices, saveSpices } from '../../_lib/kv.js';
import { requireAdmin } from '../../_lib/auth.js';

// ============ 常量 ============
const MAX_ITEMS = 500;        // 单次导入最大条数（防超出 KV 限制）
const MAX_NAME_LEN = 100;
const MAX_BOT_LEN = 300;
const MAX_PART_LEN = 100;
const MAX_STD_LEN = 100;

// ============ POST - 导入覆盖 ============
export async function onRequestPost(context) {
  // 1. 鉴权
  if (!(await requireAdmin(context.request))) {
    return json({ error: '需要登录' }, 401, corsHeaders());
  }

  // 2. 解析请求体
  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return json({ error: 'JSON 无效，请检查格式' }, 400, corsHeaders());
  }

  // 3. 校验数组
  if (!Array.isArray(body)) {
    return json({ error: '请求体必须为 JSON 数组' }, 400, corsHeaders());
  }

  // 4. 防止空数组清空数据库
  if (body.length === 0) {
    return json({ 
      error: '导入数据不能为空数组（此操作会清空数据库，已被阻止）' 
    }, 400, corsHeaders());
  }

  // 5. 数量限制
  if (body.length > MAX_ITEMS) {
    return json({ 
      error: `单次导入不能超过 ${MAX_ITEMS} 条，当前 ${body.length} 条` 
    }, 400, corsHeaders());
  }

  // 6. 数据清洗与校验
  const seenNames = new Map();  // 检测导入数据内部重名
  const clean = [];
  let skippedNoName = 0;

  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    const name = String(item.name || '').trim().slice(0, MAX_NAME_LEN);

    // 跳过无名称条目
    if (!name) {
      skippedNoName++;
      continue;
    }

    // 检查导入数据内部是否重名
    if (seenNames.has(name)) {
      const prevIndex = seenNames.get(name) + 1;
      return json({ 
        error: `导入数据内部存在重复名称「${name}」（第 ${prevIndex} 条与第 ${i + 1} 条）`,
        code: 'DUPLICATE_IN_IMPORT'
      }, 400, corsHeaders());
    }
    seenNames.set(name, i);

    // 清洗各字段
    clean.push({
      name,
      botanical: String(item.botanical || '').trim().slice(0, MAX_BOT_LEN),
      part: String(item.part || '').trim().slice(0, MAX_PART_LEN),
      std12729: String(item.std12729 || '表1收录').trim().slice(0, MAX_STD_LEN),
      std21725: String(item.std21725 || '').trim().slice(0, MAX_STD_LEN)
    });
  }

  // 清洗后无有效数据
  if (clean.length === 0) {
    return json({ 
      error: '清洗后无有效数据（所有条目均缺少 name 字段）' 
    }, 400, corsHeaders());
  }

  // 7. 写入 KV（带错误处理）
  try {
    // 可选：备份原数据到内存（如需回滚机制可存到另一个 KV key）
    // const backup = await getSpices();
    
    await saveSpices(clean);
    
    return json({ 
      ok: true, 
      count: clean.length,
      skipped: skippedNoName,
      message: `成功导入 ${clean.length} 条香辛料数据${
        skippedNoName ? `，跳过 ${skippedNoName} 条无效数据` : ''
      }`
    }, 200, corsHeaders());
  } catch (err) {
    console.error('Import save error:', err);
    return json({ 
      error: '数据写入失败，请重试',
      detail: err.message 
    }, 500, corsHeaders());
  }
}
