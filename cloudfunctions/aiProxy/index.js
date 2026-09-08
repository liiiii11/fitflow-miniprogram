// cloudfunctions/aiProxy/index.js
// 代理智谱 GLM-4-Flash。Key 存于云函数环境变量 ZHIPU_API_KEY，前端永不接触 key。
// actions: test | foodCalAI | queryMet | calibrateBurn | analyzeGrowth | chat
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
// 免费档主力型号优先；老型号作回退（glm-4.5-flash 已下线，任一候选可用即通）
const MODEL_CANDIDATES = ['glm-4.7-flash', 'glm-4-flash', 'glm-4-flash-250414'];
const DEFAULT_MODEL = process.env.ZHIPU_MODEL || MODEL_CANDIDATES[0];

// 通用 JSON POST（云函数环境用内置 https，无需额外依赖）
function postJSON(url, data, headers, timeout) {
  const ms = timeout || 9000;
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      timeout: ms,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }, headers)
    }, res => {
      res.setTimeout(ms);
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

// 单次调用（指定模型）。fatal=true 表示换模型也没用（key/限流/网络），modelErr=true 表示换型号可重试
async function callOnce(model, messages, opts, key) {
  try {
    const r = await postJSON(ENDPOINT, {
      model: model,
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : 0.6,
      max_tokens: opts.max_tokens || 300
    }, { 'Authorization': 'Bearer ' + key }, opts.timeout || 9000);

    if (r.status === 200 && r.body && r.body.choices && r.body.choices[0]) {
      return { ok: true, model: model, text: String(r.body.choices[0].message.content || '').trim() };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, fatal: true, msg: 'Key 无权限/未实名（HTTP ' + r.status + '），去 bigmodel.cn 处理' };
    }
    if (r.status === 429) {
      // 限流是模型级的（实测 glm-4.7-flash 429 时 glm-4-flash 正常），换下一个型号而不是放弃
      return { ok: false, modelErr: true, msg: '请求过于频繁（限流 429），换模型重试' };
    }
    const errStr = r.body && r.body.error ? JSON.stringify(r.body.error) : '';
    return {
      ok: false,
      status: r.status,
      modelErr: r.status === 404 || /model|模型/i.test(errStr),
      msg: '智谱返回 ' + r.status + (errStr ? ' ' + errStr : '')
    };
  } catch (e) {
    return { ok: false, fatal: true, msg: '请求失败: ' + (e && e.message ? e.message : String(e)) };
  }
}

// 上次成功的型号（云函数热实例间保留），下次直接优先用它，省掉逐个试错的前置耗时
let LAST_GOOD_MODEL = null;

// 调用智谱：按候选型号依次尝试，第一个可用即返回（型号下线/限流自动兼容）
async function chatZhipu(messages, opts = {}) {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) return { ok: false, fatal: true, msg: '未配置 ZHIPU_API_KEY（请在云函数环境变量中设置）' };
  const list = [].concat(opts.model ? [opts.model] : []).concat(LAST_GOOD_MODEL ? [LAST_GOOD_MODEL] : []).concat([DEFAULT_MODEL]).concat(MODEL_CANDIDATES);
  const tried = [];
  let last = { ok: false, msg: '未知错误' };
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || tried.indexOf(m) >= 0) continue;
    tried.push(m);
    const r = await callOnce(m, messages, opts, key);
    if (r.ok) { LAST_GOOD_MODEL = m; r.tried = tried; return r; }
    last = r;
    if (r.fatal || !r.modelErr) break; // key/网络问题不再试其他型号
  }
  last.tried = tried;
  return last;
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

    // 自检：返回 key 状态 + 逐个候选模型的实测结果，用于定位「AI 调用失败」的真实原因
    if (action === 'diag') {
      const key = process.env.ZHIPU_API_KEY || '';
      const out = {
        ok: true,
        keyConfigured: !!key,
        keyMasked: key ? key.slice(0, 6) + '***' + key.slice(-4) : '',
        keyFormatOK: /^[\w.-]{20,}$/.test(key),
        defaultModel: DEFAULT_MODEL,
        candidates: MODEL_CANDIDATES,
        nodeVersion: process.version,
        tests: []
      };
      for (let i = 0; i < MODEL_CANDIDATES.length; i++) {
        const m = MODEL_CANDIDATES[i];
        const t0 = Date.now();
        const r = key
          ? await callOnce(m, [{ role: 'user', content: '只回复两个字：正常' }], { temperature: 0.1, max_tokens: 10, timeout: 12000 }, key)
          : { ok: false, msg: '未配置 key，跳过实测' };
        out.tests.push({ model: m, ok: !!r.ok, ms: Date.now() - t0, msg: r.ok ? (r.text || '') : r.msg });
      }
      out.workingModel = (out.tests.filter(t => t.ok)[0] || {}).model || '';
      return out;
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

    // AI 生成训练计划（结构化输出 → 前端落地为可执行计划；失败由前端降级本地规则）
    if (action === 'generatePlan') {
      const p = event.profile || {};
      const daysCount = Math.min(6, Math.max(2, Number(p.days) || 3));
      const dur = Number(p.dur) || 60;
      const exMax = dur <= 30 ? 5 : (dur <= 45 ? 6 : (dur <= 60 ? 7 : 8));
      const exMin = Math.max(3, exMax - 2);
      const r = await chatZhipu([{
        role: 'user',
        content: `你是资深健身教练。请为用户设计一份可以直接执行的训练计划。

用户情况：
- 性别：${p.gender || '男'}，年龄：${p.age || 25} 岁
- 身高：${p.height || 172} cm，体重：${p.weight || 70} kg
- 训练经验：${p.years || '新手'}
- 场地/器械：${p.place || '健身房'}
- 每周可练：${daysCount} 天，单次时长：${dur} 分钟
- 目标：${p.goal || '增肌'}
- 伤病/限制：${p.injury || '无'}

要求：
1. 恰好 ${daysCount} 个训练日，每个训练日有名称（如 推日/拉日/腿日/上肢日/下肢日/全身日）
2. 每个训练日 ${exMin}~${exMax} 个动作，数量与 ${dur} 分钟匹配
3. 动作名用中文标准名（如"杠铃卧推""引体向上""高脚杯深蹲"），不含英文、品牌、组次
4. 动作必须能在"${p.place}"条件下完成，不要安排用户没有的器械
5. 不要写组次/重量（系统按目标统一给出），每个动作只给名称
6. 有伤病限制时避开相关部位动作
7. 计划名不超过 12 字，desc 一句话不超过 30 字

只输出 JSON（可用 \`\`\`json 包裹），不要任何解释文字：
{"name":"计划名","desc":"一句话简介","days":[{"name":"推日","exercises":[{"name":"杠铃卧推"}]}]}`
      }], { temperature: 0.4, max_tokens: 1000, timeout: 25000 });
      if (!r.ok) return r;
      const raw = r.text || '';
      const obj = parseJSON(raw);
      if (!obj || !Array.isArray(obj.days) || !obj.days.length) return { ok: false, msg: 'AI 返回无法解析', raw: raw.slice(0, 200) };
      const cleanStr = (s, max) => String(s == null ? '' : s).replace(/[\r\n]/g, ' ').trim().slice(0, max);
      // 组次统一由系统按目标给出（AI 不再输出，省 token 且各档一致）；AI 若仍给了则沿用
      const goal = p.goal || '增肌';
      const defMeta = /增力/.test(goal) ? '5×5' : ((/减脂|塑形/.test(goal)) ? '4×12-15' : '4×8-12');
      const days = [];
      obj.days.slice(0, 7).forEach(d => {
        if (!d || !Array.isArray(d.exercises)) return;
        const used = {};
        const exs = [];
        d.exercises.slice(0, 8).forEach(x => {
          if (!x) return;
          const nm = cleanStr(x.name, 20);
          if (!nm || used[nm]) return;
          used[nm] = 1;
          let meta = cleanStr(x.meta, 12);
          if (!/组|×|x/i.test(meta)) meta = defMeta;
          exs.push({ name: nm, meta: meta });
        });
        if (exs.length) days.push({ name: cleanStr(d.name, 10) || '训练日', exercises: exs });
      });
      if (!days.length) return { ok: false, msg: 'AI 未给出有效动作', raw: raw.slice(0, 200) };
      return {
        ok: true,
        source: 'ai',
        name: cleanStr(obj.name, 12) || (p.goal || '增肌') + '计划',
        desc: cleanStr(obj.desc, 40),
        days: days
      };
    }

    if (action === 'chat') {
      return await chatZhipu([{ role: 'user', content: prompt || '' }]);
    }

    return { ok: false, msg: '未知 action: ' + action };
  } catch (e) {
    return { ok: false, msg: '云函数执行异常: ' + (e && e.message ? e.message : String(e)), stack: e && e.stack ? e.stack.split('\n').slice(0,3).join('; ') : '' };
  }
};
