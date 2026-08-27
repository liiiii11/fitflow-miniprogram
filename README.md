# FitFlow 健身追踪小程序

从 Web 版迁移而来的微信小程序，技术栈：**微信云开发 + 智谱 GLM-4-Flash**。
单页应用（`pages/index`），数据存本地 `wx.storage`，AI 调用走云函数 `aiProxy`。

## 环境要求
- 微信开发者工具（Stable 版，基础库 ≥ 2.2.3）
- 云开发环境（已建好：`cloud1-d6gysp8rq6bab7e52`）
- 智谱 API Key（仅存于云函数环境变量，**前端不接触、不入库**）

## 新成员接入步骤
1. 管理员在【微信公众平台 → 成员管理】把你加为「开发者」。
2. 克隆仓库，用微信开发者工具「导入项目」，填入本小程序 AppID：`wxee60c882737a7949`（团队统一 AppID，勿改）。
3. 开发者工具 → 云开发 → 选择环境 `cloud1-d6gysp8rq6bab7e52`。
4. 右键 `cloudfunctions/aiProxy` → 「上传并部署（云端安装依赖）」。
   > 环境变量 `ZHIPU_API_KEY` 已在云环境里配好，新成员**无需自己填 Key**，部署代码即可。

## 本地运行
直接编译即可。AI 功能依赖云函数，需联网且云环境正常。

## 云函数部署
改了 `cloudfunctions/aiProxy/index.js` 后，必须右键该目录 → 上传并部署，否则线上/他人跑的是旧代码。
（之前改过提示词但没部署，就会出现“我本地能、别人/线上不能”的问题。）

## 协作约定
- **分支**：`main` 为保护分支，开发走 `feature/xxx` 分支，提 PR 合并。
- **提交**：只提交源码；`project.private.config.json`、`node_modules` 已被 `.gitignore` 忽略。
- **AppID 统一**：所有成员共用 `wxee60c882737a7949`，不要切到自己的测试号（会破坏云环境绑定）。
- **密钥**：`ZHIPU_API_KEY` 只在云环境配置，任何人不要把它写进代码或文档。
- **发版**：在开发者工具「上传」生成体验版/正式版，由管理员提交审核发布。

## 目录
- `miniprogram/` 小程序前端（pages/index 单页）
- `cloudfunctions/aiProxy/` AI 代理云函数（持有 ZHIPU_API_KEY）
- `app.js` 全局初始化（云环境 ID 在此）
