// ============ 配置 ============
const KEY = 'spices';
const BACKUP_KEY = 'spices_backup';          // 写入前备份的 key
const MAX_VALUE_SIZE = 900 * 1024;           // 900KB 预警阈值（KV 限制 1MB）
const ENABLE_BACKUP = true;                   // 是否启用写入前备份

// ============ 工具函数 ============

/**
 * 检查 KV 绑定是否可用
 */
function getKV() {
  if (typeof SPICE_KV === 'undefined' || !SPICE_KV) {
    throw new Error('SPICE_KV 未绑定，请在 EdgeOne 控制台检查环境变量/KV 命名空间配置');
  }
  return SPICE_KV;
}

/**
 * 校验数据是否为有效数组
 */
function validateSpicesList(list) {
  if (!Array.isArray(list)) {
    throw new Error('数据必须为数组格式');
  }
  // 校验每个条目至少包含 name 字段
  for (let i = 0; i < list.length; i++) {
    if (!list[i] || typeof list[i] !== 'object') {
      throw new Error(`第 ${i + 1} 条数据不是有效对象`);
    }
    if (!list[i].name || typeof list[i].name !== 'string' || !list[i].name.trim()) {
      throw new Error(`第 ${i + 1} 条数据缺少有效 name 字段`);
    }
  }
  return true;
}

/**
 * 安全序列化
 */
function safeStringify(data) {
  try {
    const str = JSON.stringify(data);
    if (str.length > MAX_VALUE_SIZE) {
      throw new Error(`序列化后数据大小 (${Math.round(str.length / 1024)}KB) 接近 KV 单 value 限制 (1MB)`);
    }
    return str;
  } catch (err) {
    throw new Error(`数据序列化失败: ${err.message}`);
  }
}

// ============ 公开 API ============

/**
 * 读取全量香辛料列表
 * @returns {Promise<Array>} 始终返回数组，读取失败返回空数组
 */
export async function getSpices() {
  try {
    const KV = getKV();
    const data = await KV.get(KEY, 'json');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('KV getSpices error:', err.message || err);
    // 降级返回空数组，避免调用方因异常崩溃
    return [];
  }
}

/**
 * 保存全量香辛料列表（带校验 + 备份）
 * @param {Array} list - 香辛料数组
 * @param {object} options - 选项
 * @param {boolean} options.skipBackup - 是否跳过备份（批量操作时可跳过）
 */
export async function saveSpices(list, options = {}) {
  const { skipBackup = false } = options;

  // 1. 数据校验
  validateSpicesList(list);

  // 2. 序列化
  const value = safeStringify(list);

  try {
    const KV = getKV();

    // 3. 写入前备份（可选）
    if (ENABLE_BACKUP && !skipBackup) {
      try {
        const existing = await KV.get(KEY);
        if (existing) {
          await KV.put(BACKUP_KEY, existing, { expirationTtl: 3600 }); // 备份保留 1 小时
        }
      } catch (backupErr) {
        // 备份失败不阻塞主写入
        console.warn('KV backup failed:', backupErr.message);
      }
    }

    // 4. 写入数据
    await KV.put(KEY, value);
  } catch (err) {
    console.error('KV saveSpices error:', err.message || err);
    throw new Error(`数据保存失败: ${err.message}`);
  }
}

/**
 * 按名称查找单条香辛料
 * @param {string} name - 香辛料名称
 * @returns {Promise<object|null>}
 */
export async function getSpice(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  try {
    const list = await getSpices();
    const trimmed = name.trim().toLowerCase();
    return list.find(x => (x.name || '').trim().toLowerCase() === trimmed) || null;
  } catch (err) {
    console.error('KV getSpice error:', err.message || err);
    return null;
  }
}

/**
 * 批量更新（事务性操作：全部成功或全部不写）
 * @param {Function} updater - 接收当前列表，返回新列表的函数
 * @returns {Promise<Array>} 更新后的列表
 */
export async function updateSpices(updater) {
  const list = await getSpices();
  const newList = updater(list);
  await saveSpices(newList);
  return newList;
}

/**
 * 从备份恢复（紧急回滚用）
 * @returns {Promise<{ok: boolean, count: number}>}
 */
export async function restoreFromBackup() {
  try {
    const KV = getKV();
    const backup = await KV.get(BACKUP_KEY, 'json');
    if (!Array.isArray(backup)) {
      throw new Error('备份数据不存在或格式无效');
    }
    await KV.put(KEY, JSON.stringify(backup));
    return { ok: true, count: backup.length };
  } catch (err) {
    console.error('KV restoreFromBackup error:', err.message || err);
    throw new Error(`从备份恢复失败: ${err.message}`);
  }
}
