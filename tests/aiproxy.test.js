// 本地验证 aiProxy 云函数：模型回退 / key 异常 / diag 自检（mock https + wx-server-sdk）
const Module = require('module');
const origLoad = Module._load;

let router = () => ({ status: 200, body: { choices: [{ message: { content: '正常' } }] } });
let calls = [];

function httpsMock() {}
httpsMock.request = (opts, cb) => {
  let buf = '';
  const req = {
    on() { return req; },
    write(s) { buf += s; return true; },
    end() {
      let model = '';
      try { model = JSON.parse(buf).model; } catch (e) {}
      calls.push(model);
      const r = router(model);
      setImmediate(() => cb({
        statusCode: r.status,
        setTimeout() {},
        on(ev, fn) {
          const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
          if (ev === 'data') fn(body);
          else if (ev === 'end') fn();
        }
      }));
    },
    destroy() {}
  };
  return req;
};

Module._load = function (request) {
  if (request === 'wx-server-sdk') return { init() {}, DYNAMIC_CURRENT_ENV: 'env' };
  if (request === 'https') return httpsMock;
  return origLoad.apply(this, arguments);
};

const CF = require('path').resolve(__dirname, '../cloudfunctions/aiProxy/index.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function load() {
  delete require.cache[require.resolve(CF)];
  return require(CF);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 场景1：主力型号可用 → 只请求 1 次，不浪费
  console.log('场景1 主力型号可用');
  process.env.ZHIPU_API_KEY = 'testkey.abcdefghijklmnop123456';
  calls = [];
  router = m => (m === 'glm-4.7-flash'
    ? { status: 200, body: { choices: [{ message: { content: '正常' } }] } }
    : { status: 400, body: { error: { code: '1214', message: 'model not exist' } } });
  let r = await load().main({ action: 'test' });
  ok(r.ok === true, 'test 成功');
  ok(calls.length === 1 && calls[0] === 'glm-4.7-flash', '只调用主力型号 1 次（' + calls.join(',') + '）');

  // 场景2：主力型号下线(模型错误) → 自动回退到下一个可用型号
  console.log('场景2 主力型号下线自动回退');
  calls = [];
  router = m => (m === 'glm-4-flash'
    ? { status: 200, body: { choices: [{ message: { content: '正常' } }] } }
    : { status: 404, body: { error: { message: 'model not found' } } });
  r = await load().main({ action: 'test' });
  ok(r.ok === true, '回退后成功');
  ok(calls.length === 2 && calls[1] === 'glm-4-flash', '依次尝试 2 个型号后成功（' + calls.join(' → ') + '）');
  ok(r.model === 'glm-4-flash', '返回实际生效型号');

  // 场景2b：429 限流是模型级 → 换型号回退而不是放弃（diag 实测 glm-4.7-flash 429 时 glm-4-flash 正常）
  console.log('场景2b 429 限流自动回退');
  calls = [];
  router = m => (m === 'glm-4.7-flash'
    ? { status: 429, body: { error: { message: 'rate limit' } } }
    : { status: 200, body: { choices: [{ message: { content: '正常' } }] } });
  r = await load().main({ action: 'test' });
  ok(r.ok === true, '429 限流后回退成功');
  ok(calls.length === 2 && calls[0] === 'glm-4.7-flash' && calls[1] === 'glm-4-flash', '限流型号跳过后成功（' + calls.join(' → ') + '）');
  ok(r.model === 'glm-4-flash', '限流回退后 model = glm-4-flash');

  // 场景2c：LAST_GOOD_MODEL 记忆——同一热实例内，上次成功的型号下次优先（省试错耗时）
  console.log('场景2c 记住可用型号优先');
  const hot = load();
  calls = [];
  router = () => ({ status: 200, body: { choices: [{ message: { content: '正常' } }] } });
  await hot.main({ action: 'test' });
  ok(calls[0] === 'glm-4.7-flash', '首次按默认优先级（' + calls.join(',') + '）');
  calls = [];
  router = m => (m === 'glm-4.7-flash'
    ? { status: 429, body: { error: { message: 'rate limit' } } }
    : { status: 200, body: { choices: [{ message: { content: '正常' } }] } });
  await hot.main({ action: 'test' });
  ok(calls[1] === 'glm-4-flash', '限流回退到 glm-4-flash（' + calls.join(',') + '）');
  calls = [];
  router = () => ({ status: 200, body: { choices: [{ message: { content: '正常' } }] } });
  r = await hot.main({ action: 'test' });
  ok(calls[0] === 'glm-4-flash', '第三次直接优先上次成功的 glm-4-flash（' + calls.join(',') + '）');
  ok(r.ok === true, '记忆型号命中成功');

  // 场景3：key 无效 401 → fatal，不再重试其他型号（避免拖慢）
  console.log('场景3 key 无效不重试');
  calls = [];
  router = () => ({ status: 401, body: { error: { message: 'unauthorized' } } });
  r = await load().main({ action: 'test' });
  ok(r.ok === false && /Key 无权限/.test(r.msg), '返回 key 无权限提示');
  ok(calls.length === 1, '401 只请求 1 次不重试（' + calls.length + '）');

  // 场景4：未配置 key
  console.log('场景4 未配置 key');
  delete process.env.ZHIPU_API_KEY;
  r = await load().main({ action: 'test' });
  ok(r.ok === false && /未配置 ZHIPU_API_KEY/.test(r.msg), '提示未配置 key');

  // 场景5：diag 自检（key 已配，两个型号失败一个成功）
  console.log('场景5 diag 自检');
  process.env.ZHIPU_API_KEY = 'testkey.abcdefghijklmnop123456';
  router = m => (m === 'glm-4.7-flash'
    ? { status: 200, body: { choices: [{ message: { content: '正常' } }] } }
    : { status: 400, body: { error: { message: 'model not exist' } } });
  const d = await load().main({ action: 'diag' });
  ok(d.keyConfigured === true, 'diag: keyConfigured=true');
  ok(d.keyMasked === 'testke***3456', 'diag: key 脱敏为 ' + d.keyMasked);
  ok(d.keyFormatOK === true, 'diag: key 格式校验通过');
  ok(Array.isArray(d.tests) && d.tests.length === 3, 'diag: 实测 3 个候选型号');
  ok(d.workingModel === 'glm-4.7-flash', 'diag: 给出可用型号 ' + d.workingModel);
  ok(d.tests.every(t => typeof t.ms === 'number'), 'diag: 每项含耗时 ms');

  // 场景6：diag 在未配 key 时也能跑，不崩
  console.log('场景6 diag 无 key 兜底');
  delete process.env.ZHIPU_API_KEY;
  const d2 = await load().main({ action: 'diag' });
  ok(d2.keyConfigured === false && d2.workingModel === '', 'diag: 无 key 时安全返回不崩');


  console.log('\n========================================');
  console.log(fail === 0 ? ('全部通过 (' + pass + ' 用例)') : (pass + ' 通过 / ' + fail + ' 失败'));
  process.exit(fail === 0 ? 0 : 1);
})();
