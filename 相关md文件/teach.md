# 新手部署与维护指南

本文档给第一次接手“遗韵养生”的同学使用。目标是让你不看历史对话，也能知道这个项目如何跑起来、如何排错、如何继续维护。

## 1. 你先要知道的三件事

1. 这是一个原生微信小程序项目，不是 UniApp、Vue 或 React 项目。
2. 项目依赖微信云开发，很多功能只有连上正确云环境后才会正常。
3. 当前真实工程目录是内层 `feiyi+jiankang/`，导入开发者工具时要选这一层。

## 2. 第一次导入怎么做

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 选择目录 `feiyi+jiankang/`。
4. 使用当前项目对应的 `AppID`。
5. 导入后先确认 `app.js` 中的云环境是否为当前使用环境。

## 3. 这个项目最重要的入口文件

- `app.js`：小程序启动与云环境初始化。
- `app.json`：页面注册、窗口配置、TabBar 配置。
- `utils/dataSync.js`：大部分用户数据同步逻辑。
- `utils/access.js`：隐私选择与访问控制逻辑。
- `cloudfunctions/login/index.js`：登录云函数。
- `cloudfunctions/aiChat/index.js`：AI 云函数。

## 4. 首次联调建议顺序

### 4.1 检查云环境

先确认：

- 开发者工具当前环境正确
- `app.js` 中 `env` 正确
- 当前微信号有该环境权限

### 4.2 检查云函数

至少部署：

- `login`
- `aiChat`
- `migrateLegacyData`

部署方式：

1. 在开发者工具左侧找到 `cloudfunctions`。
2. 右键具体云函数目录。
3. 选择“上传并部署：云端安装依赖”。

### 4.3 检查 AI 环境变量

进入云函数详情，确认：

- `DEEPSEEK_API_KEY` 已配置

### 4.4 检查数据库集合

至少确认以下集合存在：

- `users`
- `user_settings`
- `checkin_records`
- `content_favorites`
- `ai_favorites`
- `campaign_contents`
- `heritage_contents`
- `user_feedback`

## 5. 常见功能是谁在读写数据

### 首页

- 读 `campaign_contents`
- 读 `heritage_contents`

### 分类页

- 读 `heritage_contents`

### 详情页

- 读 `campaign_contents` 或 `heritage_contents`
- 写 `content_favorites`

### 打卡页

- 读 `heritage_contents` 作为项目来源
- 读写 `checkin_records`
- 读写 `user_settings`

### AI 页

- 调用 `aiChat`
- 读写 `ai_favorites`

### 个人中心

- 调用 `login`
- 读写 `users`

### 反馈页

- 写 `user_feedback`

## 6. 最容易出问题的地方

### 6.1 首页空白

优先检查：

- `campaign_contents` 是否有数据
- `heritage_contents` 是否有数据
- 当前环境是否正确
- 内容 `status` 是否开启

### 6.2 AI 不返回

优先检查：

- `aiChat` 是否已部署
- `DEEPSEEK_API_KEY` 是否存在
- 云函数日志是否报错
- 网络是否正常

### 6.3 登录失败

优先检查：

- `login` 是否已部署
- 当前微信号是否可调用云函数
- `users` 集合权限是否合理

### 6.4 打卡没有项目

优先检查：

- `heritage_contents` 是否存在可识别 `category` 的数据
- 记录是否带 `title`
- `status` 是否为可用状态

## 7. 新手接手时最推荐的检查顺序

1. 先读 `README.md`
2. 再读 `真机验证清单.md`
3. 然后部署云函数并检查环境变量
4. 再查看数据库集合和权限
5. 最后用真机逐页走流程

## 8. 提审前最后要检查什么

- 代码质量是否重新扫描
- 协议与页面是否一致
- AI 问答是否有越界回答
- 真机是否完整通过
- 截图、名称、简介是否与当前程序一致

## 9. 文档索引

- `README.md`：总说明
- `function.md`：项目现状与上线收口
- `真机验证清单.md`：手动验收清单
- `legacy-data-migration.md`：旧数据迁移说明
- `用户协议.md`：用户协议
- `隐私政策.md`：隐私政策
- `AI使用说明.md`：AI 使用说明
