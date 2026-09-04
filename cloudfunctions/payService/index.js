// payService 云函数 —— 《为了变帅》打赏（虚拟支付·道具直购）服务端
// 职责：
//   action=sign    用 wx.login 的 code 换 session_key，组装 signData 并完成双重签名，
//                  返回前端 wx.requestVirtualPayment 所需的全部参数
//   action=confirm 支付成功后向微信侧 query_order 对账（打赏无实物发货，对账仅作记录，
//                  失败不影响前端「已打赏」结果）
// 安全原则：
//   - OfferID / 现网 AppKey / AppSecret 全部放在 config.private.js（已被 .gitignore 排除，不进 git）
//   - paySig 必须在服务端算，前端只透传
//
// 接入前提（小程序后台一次性配置）：
//   1. 「支付与交易 → 虚拟支付」已开通（个人主体 2026-08-31 起开放，需工具类目 + 认证备案）
//   2. 「虚拟支付 → 基本配置」拿到 OfferID、现网 AppKey
//   3. 「道具管理」创建并发布 3 个道具（价格单位=分，必须与前端 tier 表严格一致）：
//        reward_3 → 300 分（¥3）   reward_8 → 800 分（¥8）   reward_18 → 1800 分（¥18）

const crypto = require('crypto');
const cloud = require('wx-server-sdk');

// 私有配置：把 config.private.example.js 复制为 config.private.js 并填入真实值
let PRIV = {};
try { PRIV = require('./config.private.js'); } catch (e) { /* 未配置时 sign 会返回明确报错 */ }

// 打赏档位表：productId / goodsPrice(分) 必须与后台「道具管理」完全一致
const TIERS = {
  r3:  { productId: 'reward_3',  goodsPrice: 300 },
  r8:  { productId: 'reward_8',  goodsPrice: 800 },
  r18: { productId: 'reward_18', goodsPrice: 1800 }
};

function hmacSha256Hex(key, msg) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
}

// jscode2session：用 wx.login 的 code 换 openid + session_key（signature 签名密钥）
function code2Session(code) {
  const url = 'https://api.weixin.qq.com/sns/jscode2session'
    + '?appid=' + encodeURIComponent(PRIV.appId)
    + '&secret=' + encodeURIComponent(PRIV.appSecret)
    + '&js_code=' + encodeURIComponent(code)
    + '&grant_type=authorization_code';
  return httpsGetJSON(url);
}

// stable_token：服务端 access_token（不互相顶号），实例内存缓存到过期前 5 分钟
let _tokenCache = { token: '', expireAt: 0 };
function getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expireAt) return Promise.resolve(_tokenCache.token);
  const body = JSON.stringify({ grant_type: 'client_credential', appid: PRIV.appId, secret: PRIV.appSecret });
  return httpsPostJSON('https://api.weixin.qq.com/cgi-bin/stable_token', body).then(res => {
    if (!res.access_token) throw new Error('get token failed: ' + JSON.stringify(res));
    _tokenCache = { token: res.access_token, expireAt: Date.now() + ((res.expires_in || 7200) - 300) * 1000 };
    return _tokenCache.token;
  });
}

// 对账：query_order（pay_sig 用 uri + '&' + body 对 AppKey 做 HMAC-SHA256）
function queryOrder(openid, outTradeNo) {
  return getAccessToken().then(token => {
    const body = JSON.stringify({ openid, out_trade_no: outTradeNo, env: 0 });
    const paySig = hmacSha256Hex(PRIV.appKeyProd, '/xpay/query_order&' + body);
    const url = 'https://api.weixin.qq.com/xpay/query_order?access_token=' + token;
    return httpsPostJSON(url, body, { pay_sig: paySig });
  });
}

function httpsGetJSON(url) {
  return httpsReq(url, null, {});
}
function httpsPostJSON(url, body, headers) {
  return httpsReq(url, body, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
}
function httpsReq(url, body, headers) {
  const http = require('https');
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, path: u.pathname + u.search, method: body ? 'POST' : 'GET',
      headers
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('bad json: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// 云函数入口
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  // ---------- sign：生成下单签名 ----------
  if (action === 'sign') {
    if (!PRIV.appId || !PRIV.appSecret || !PRIV.offerId || !PRIV.appKeyProd) {
      return { ok: false, msg: 'payService 未配置：请复制 config.private.example.js 为 config.private.js 并填入参数后重新部署' };
    }
    const tier = TIERS[event.tier];
    if (!tier) return { ok: false, msg: '未知打赏档位' };
    if (!event.code) return { ok: false, msg: '缺少 wx.login code' };

    let session;
    try { session = await code2Session(event.code); } catch (e) { return { ok: false, msg: 'code 换取失败：' + e.message }; }
    if (!session.session_key) {
      return { ok: false, msg: 'code 无效或已使用（errcode ' + (session.errcode || '?') + '）' };
    }

    // outTradeNo：8-32 位、全局唯一、不能以下划线开头
    const outTradeNo = 'FF' + Date.now() + Math.floor(Math.random() * 9000 + 1000);
    // signData 的字段值与前端拉起时完全一致（前端直接透传本字符串，保证逐字节一致）
    const signData = JSON.stringify({
      offerId: String(PRIV.offerId),
      buyQuantity: 1,
      env: 0,                       // 0=现网正式环境
      currencyType: 'CNY',
      productId: tier.productId,
      goodsPrice: tier.goodsPrice,  // 单位：分
      outTradeNo,
      attach: 'fitflow_tip_' + event.tier
    });
    const paySig = hmacSha256Hex(PRIV.appKeyProd, 'requestVirtualPayment&' + signData);
    const signature = hmacSha256Hex(session.session_key, signData);
    return { ok: true, signData, paySig, signature, mode: 'short_series_goods', outTradeNo };
  }

  // ---------- confirm：支付后对账（非阻塞，失败仅记录） ----------
  if (action === 'confirm') {
    if (!PRIV.appKeyProd || !event.outTradeNo) return { ok: false, msg: 'confirm 参数缺失' };
    try {
      const res = await queryOrder(openid, event.outTradeNo);
      // 返回结构含订单状态；打赏无发货动作，这里只把结果透传给前端记录/展示
      return { ok: true, order: res };
    } catch (e) {
      return { ok: false, msg: 'query_order 失败：' + e.message };
    }
  }

  return { ok: false, msg: '未知 action' };
};
