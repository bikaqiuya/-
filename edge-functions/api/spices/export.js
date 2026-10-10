import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices } from '../../_lib/kv.js';
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const { request } = context;

  // 1. 鉴权
  if (!(await requireAdmin(request))) {
    return json({ error: '需要登录' }, 401, corsHeaders());
  }

  // 2. 读取数据（带错误处理）
  let list;
  try {
    list = await getSpices();
  } catch (err) {
    console.error('Export getSpices error:', err);
    return json({ error: '数据读取失败' }, 500, corsHeaders());
  }

  // 3. 检查是否有 download 参数（增强直接访问体验）
  const url = new URL(request.url);
  const shouldDownload = url.searchParams.get('download') === '1';

  // 4. 构建响应头
  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // 如果请求下载模式，设置 Content-Disposition 触发文件保存
  if (shouldDownload) {
    const filename = `spices_${new Date().toISOString().slice(0, 10)}.json`;
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  // 5. 返回纯数组（保持与 admin.html 前端兼容）
  return new Response(JSON.stringify(list, null, 2), {
    status: 200,
    headers
  });
}
