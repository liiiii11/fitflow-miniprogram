// app.js - 《为了变帅》小程序全局逻辑
App({
  globalData: {
    // 云开发环境 ID（微信开发者工具 → 云开发 → 环境设置）
    env: 'cloud1-d6gysp8rq6bab7e52'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请使用 2.2.3 及以上的基础库');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    });
  }
});
