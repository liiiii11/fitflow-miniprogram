// cloudfunctions/aiProxy/index.js
// 代理智谱 GLM-4-Flash。Key 存于云函数环境变量 ZHIPU_API_KEY，前端永不接触 key。
// actions: test | foodCalAI | queryMet | calibrateBurn | analyzeGrowth | chat
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4-flash';

// 通用 JSON POST（云函数环境用内置 https，无需额外依赖）
function postJSON(url, data, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      timeout: 9000,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }, headers)
    }, res => {
      res.setTimeout(9000);
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('智谱请求超时')); });
    req.write(bodyStr);
    req.end();
  });
}

// 调用智谱
async function chatZhipu(messages, opts = {}) {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) return { ok: false, msg: '未配置 ZHIPU_API_KEY（请在云函数环境变量中设置）' };
  try {
    const r = await postJSON(ENDPOINT, {
      model: MODEL,
      messages,
      temperature: opts.temperature != null ? opts.temperature : 0.6,
      max_tokens: opts.max_tokens || 300
    }, { 'Authorization': 'Bearer ' + key });

    if (r.status === 200 && r.body && r.body.choices) {
      return { ok: true, text: r.body.choices[0].message.content.trim() };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, msg: 'Key 无权限/未实名，去 bigmodel.cn 处理' };
    }
    if (r.status === 429) {
      return { ok: false, msg: '请求过于频繁，稍后再试' };
    }
    return { ok: false, msg: '智谱返回 ' + r.status + (r.body && r.body.error ? ' ' + JSON.stringify(r.body.error) : '') };
  } catch (e) {
    return { ok: false, msg: '请求失败: ' + e.message };
  }
}

// 从 AI 文本中解析 JSON（兼容 ```json 包裹、前后废话、花括号区间）
function parseJSON(str) {
  if (!str) return null;
  let s = str.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  try { return JSON.parse(s); } catch (e) {
    const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e2) {} }
    const a = s.indexOf('['); const b = s.lastIndexOf(']');
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e3) {} }
    return null;
  }
}

exports.main = async (event) => {
  try {
    const { action, name, items, prompt, weight, weekly, details, progress } = event || {};

    if (action === 'test') {
    return await chatZhipu([{ role: 'user', content: '只回复两个字：正常' }], { temperature: 0.1, max_tokens: 10 });
  }

  // 食物每100g热量估算（对应原版 queryFoodCalAI）
  if (action === 'foodCalAI') {
    if (!name) return { ok: false, msg: '缺少食物名' };
    const r = await chatZhipu([{
      role: 'user',
      content: `你是营养师。请估算"${name}"每100克的热量（kcal）。请根据食材组成和常见烹饪方式给出一个合理估算数字，不要返回0。只输出JSON对象，不要输出任何其他文字，格式：{"name":"${name}","cal":每100克热量数字（整数）,"sub":"约100g"}`
    }], { temperature: 0.1, max_tokens: 300 });
    if (!r.ok) return r;
    const p = parseJSON(r.text);
    if (!p || !p.cal || p.cal <= 0) return { ok: false, msg: 'AI 未识别出有效热量', raw: (r.text || '').slice(0, 120) };
    return { ok: true, name: name, cal: Number(p.cal) || 0, sub: p.sub || '约100g' };
  }

  // 有氧项目 MET 识别（对应原版 queryMetAI）
  if (action === 'queryMet') {
    if (!name) return { ok: false, msg: '缺少项目名' };
    const r = await chatZhipu([{
      role: 'user',
      content: `你是运动科学专家。请判断运动项目「${name}」对应的 MET 值（代谢当量，1 MET ≈ 1 kcal/kg/h，跑步约9.8、快走约4.3、瑜伽约2.5）。只输出JSON对象，不要输出任何其他文字：{"met":数字}`
    }], { temperature: 0.1, max_tokens: 100 });
    if (!r.ok) return r;
    const p = parseJSON(r.text);
    const met = p && p.met != null ? Number(p.met) : NaN;
    if (!isFinite(met) || met <= 0.5 || met >= 25) return { ok: false, msg: 'AI 未识别出有效 MET' };
    return { ok: true, met: met };
  }

  // 力量动作批量消耗校准（对应原版 aiCalibrateBurn）
  if (action === 'calibrateBurn') {
    if (!items || !items.length) return { ok: false, msg: '缺少动作' };
    const bw = weight || 70;
    const r = await chatZhipu([{
      role: 'user',
      content: `你是运动科学专家。请估算以下力量训练动作各完成全部组数后的总消耗（kcal）。用户体重 ${bw} kg。请结合动作类型（深蹲/硬拉/卧推/推举/划船/引体等大肌群复合动作消耗高，孤立动作如弯举/侧平举消耗低）、负重重量（weight）、组数（sets）与每组次数（reps）来估算。单动作总消耗应在 3~250 kcal 之间。严格按输入顺序返回JSON数组，不要输出任何其他文字：[{"name":"动作原名","kcal":整数}]。输入：${JSON.stringify(items)}`
    }], { temperature: 0.2, max_tokens: 500 });
    if (!r.ok) return r;
    const arr = parseJSON(r.text);
    if (!Array.isArray(arr) || !arr.length) return { ok: false, msg: 'AI 返回无法解析' };
    const out = arr.map(item => ({
      name: item && item.name,
      kcal: (item && isFinite(Number(item.kcal)) && Number(item.kcal) > 0) ? Math.round(Math.min(Number(item.kcal), 400)) : null
    })).filter(x => x.kcal != null);
    return { ok: true, list: out };
  }

  // 训练长进 AI 分析（对应原版 analyzeGrowth）
  if (action === 'analyzeGrowth') {
    const wText = (weekly || []).map(w => w.label + ':' + w.count + '天').join('，');
    const dText = (details || []).join('\n');
    const pText = (progress && progress.length) ? '\n\n同动作重量变化（按时间先后）:\n' + progress.join('\n') : '';
    const r = await chatZhipu([{
      role: 'user',
      content: `你是健身教练。用户近8周每周训练天数：${wText}。最近训练明细：\n${dText}${pText}\n请用80字内中文分析训练频率趋势、动作重量进步、部位均衡，给1条建议。直接输出，不要markdown。`
    }], { temperature: 0.6, max_tokens: 200 });
    if (!r.ok) return r;
    const clean = (r.text || '').replace(/```[\s\S]*?```/g, '').replace(/[*_#>]/g, '').trim();
    return { ok: true, text: clean };
  }

  if (action === 'chat') {
    return await chatZhipu([{ role: 'user', content: prompt || '' }]);
  }

    return { ok: false, msg: '未知 action: ' + action };
  } catch (e) {
    return { ok: false, msg: '云函数执行异常: ' + (e && e.message ? e.message : String(e)), stack: e && e.stack ? e.stack.split('\n').slice(0,3).join('; ') : '' };
  }
};
