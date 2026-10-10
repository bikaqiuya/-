// SPICE_KV 是控制台绑定的全局变量名
const KEY = 'spices';

export async function getSpices() {
  const data = await SPICE_KV.get(KEY, 'json');
  return Array.isArray(data) ? data : [];
}

export async function saveSpices(list) {
  await SPICE_KV.put(KEY, JSON.stringify(list));
}

export async function getSpice(name) {
  const list = await getSpices();
  return list.find(x => x.name === name) || null;
}
