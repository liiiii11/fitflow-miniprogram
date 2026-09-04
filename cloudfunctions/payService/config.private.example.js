// payService 私有配置模板 —— 复制为 config.private.js 并填入真实值（config.private.js 已被 .gitignore 排除，绝不入库）
// 获取位置（mp.weixin.qq.com → 小程序后台）：
//   appId     「开发 → 开发设置」的 AppID（与 project.config.json 里一致）
//   appSecret 「开发 → 开发设置」的 AppSecret（重置后立即复制保存）
//   offerId   「支付与交易 → 虚拟支付 → 基本配置」的 OfferID
//   appKeyProd 同一页面的「现网 AppKey」（泄露 = 资金风险，发现泄露立即在后台重置）
module.exports = {
  appId: 'wxxxxxxxxxxxxxxxxx',
  appSecret: '在此填入 AppSecret',
  offerId: '在此填入 OfferID',
  appKeyProd: '在此填入现网 AppKey'
};
