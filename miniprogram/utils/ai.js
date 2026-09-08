// utils/ai.js - 调用 AI 代理云函数（云函数持有 ZHIPU_API_KEY，前端永不暴露 key）
// 小程序 wx.request 受域名白名单限制，且 key 放前端会被反编译提取，因此统一走云函数代理。

function callAI(action, payload = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'aiProxy',
      data: Object.assign({ action }, payload),
      success: res => resolve(res.result || { ok: false, msg: '空返回' }),
      fail: err => reject(err)
    });
  });
}

// 测试 AI 连通性（用于自检）
function testAI() {
  return callAI('test');
}

// 食物每100g热量 AI 估算：返回 { ok, name, cal, sub }
function foodCalAI(name) {
  return callAI('foodCalAI', { name });
}

// 有氧项目 MET 识别：返回 { ok, met }
function queryMet(name) {
  return callAI('queryMet', { name });
}

// 力量动作批量消耗校准：items = [{name, weight, sets}]，返回 { ok, list: [{name, kcal}] }
function calibrateBurn(items, weight) {
  return callAI('calibrateBurn', { items, weight });
}

// 训练长进分析：weekly=[{label,count}], details=[字符串], progress=[动作重量进步字符串]，返回 { ok, text }
function analyzeGrowth(weekly, details, progress) {
  return callAI('analyzeGrowth', { weekly, details, progress });
}

module.exports = { callAI, testAI, foodCalAI, queryMet, calibrateBurn, analyzeGrowth };
