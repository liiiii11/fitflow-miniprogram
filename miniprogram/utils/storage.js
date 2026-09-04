// utils/storage.js - 本地存储封装，等价原版《为了变帅》的 localStorage 多 key 逻辑
const KEYS = {
  STATE: 'STORAGE_KEY',        // 主数据：完整 app state（等价原版 fitflow_data_v2）
  FOOD_CACHE: 'FOOD_CACHE_KEY',// 食物热量缓存 { name: { name, cal, sub } }
  BURN_CACHE: 'BURN_CACHE_KEY',// 训练消耗缓存 { 动作名|重量|组数: kcal }
  GROWTH: 'GROWTH_CACHE_KEY'   // 成长分析缓存 { date, text }
};

function get(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return (v === '' || v === undefined || v === null) ? fallback : v;
  } catch (e) { return fallback; }
}

function set(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) {}
}

// 主数据（整个 app state）
function loadAppState() {
  return get(KEYS.STATE, null);
}
function saveAppState(state) { set(KEYS.STATE, state); }

// 食物热量缓存
function getFoodCache() { return get(KEYS.FOOD_CACHE, {}); }
function setFoodCache(c) { set(KEYS.FOOD_CACHE, c); }

// 消耗缓存
function getBurnCache() { return get(KEYS.BURN_CACHE, {}); }
function setBurnCache(c) { set(KEYS.BURN_CACHE, c); }

// 成长分析缓存
function getGrowth() { return get(KEYS.GROWTH, null); }
function setGrowth(obj) { set(KEYS.GROWTH, obj); }

function clearAll() {
  try { wx.clearStorageSync(); } catch (e) {}
}

module.exports = {
  KEYS, get, set,
  loadAppState, saveAppState,
  getFoodCache, setFoodCache,
  getBurnCache, setBurnCache,
  getGrowth, setGrowth,
  clearAll
};
