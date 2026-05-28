# 遗韵养生微信小程序

“遗韵养生”是一款基于微信小程序原生开发和微信云开发能力实现的非遗养生内容应用。项目当前包含内容浏览、健康打卡、AI 问答、个人资料、收藏、反馈、协议展示等核心模块，适合继续进行真机联调、审核准备与版本维护。

## 1. 这个项目能做什么

当前版本的核心能力如下：

- 首页读取云端活动内容与推荐内容。
- 分类页按 `传统体育 / 传统饮食 / 传统医药 / 传统音乐` 展示内容。
- 详情页支持图文信息、收藏、视频播放入口。
- 健康打卡支持按日期记录项目、时长、体重与目标。
- AI 问答支持快捷提问、自由提问、问答收藏。
- 个人中心支持真实微信身份登录、昵称修改、头像上传。
- 设置页支持通知偏好、本地缓存清理。
- 反馈页支持提交问题与联系信息。
- 协议页支持查看《隐私政策》《用户协议》《AI 使用说明》。

## 2. 技术方案

### 2.1 前端

- 原生微信小程序
- `WXML` 负责页面结构
- `WXSS` 负责页面样式
- `JavaScript` 负责页面逻辑

### 2.2 云能力

- 微信云开发
- 云数据库
- 云存储
- 云函数

### 2.3 当前云函数

- `login`：获取当前用户 `openid`，并读取用户基础信息。
- `aiChat`：代理 AI 模型请求，统一做提示词和基础风控。
- `migrateLegacyData`：用于旧数据补齐与迁移。

### 2.4 当前云环境

- 默认云环境：`cloud2-d5gq377icbed53c7e`
- 初始化位置：`app.js`

## 3. 页面结构

当前 `app.json` 中注册的页面如下：

```text
pages/
├── index/        首页
├── agreement/    协议页
├── checkin/      健康打卡
├── ai/           AI 问答
├── profile/      个人中心
├── video-play/   视频播放
├── category/     分类页
├── detail/       详情页
├── account/      账号信息
├── favorites/    内容收藏
├── message/      AI 收藏
├── feedback/     帮助与反馈
└── settings/     设置
```

底部 `TabBar` 页面：

- 首页
- 健康打卡
- AI 问答
- 个人中心

## 4. 目录说明

```text
.
├── app.js                        小程序启动与云环境初始化
├── app.json                      页面注册与全局窗口配置
├── pages/                        页面目录
├── cloudfunctions/               云函数目录
├── utils/                        通用工具与数据同步逻辑
├── images/                       本地保留图标资源
├── README.md                     项目总说明
├── 真机验证清单.md               真机检查清单
├── 用户协议.md                   用户协议文档
├── 隐私政策.md                   隐私政策文档
├── AI使用说明.md                 AI 使用说明文档
├── function.md                   当前功能现状与上线收口说明
├── 功能需求.md                   当前版本功能范围说明
├── teach.md                      新手部署与维护指南
├── legacy-data-migration.md      旧数据迁移说明
├── history.md                    文档与版本整理记录
└── debug-account-delete.md       账号注销问题归档说明
```

## 5. 数据库集合说明

### 5.1 集合作用

- `users`：保存用户基础资料。
- `user_settings`：保存用户设置项和健康打卡目标。
- `checkin_records`：保存用户每天的打卡记录和统计结果。
- `content_favorites`：保存用户收藏的内容详情。
- `ai_favorites`：保存用户收藏的 AI 问答。
- `campaign_contents`：保存首页活动、宣传内容和轮播候选数据。
- `heritage_contents`：保存分类、详情、推荐和打卡项目来源内容。
- `user_feedback`：保存用户在反馈页提交的问题和联系方式。

### 5.2 关键字段含义

- `openid`：用户业务主标识，用来区分不同用户的数据。
- `nickname`：用户昵称。
- `avatarUrl`：用户头像地址，可能是云存储文件地址。
- `appPreferences`：应用设置项，例如通知偏好。
- `checkinGoals`：健康打卡目标设置。
- `date`：记录对应的日期。
- `weight`：用户填写的体重数据。
- `projects`：当天选择的打卡项目列表。
- `durations`：各个打卡项目对应的时长或数量。
- `calories`：打卡计算出的卡路里结果。
- `health`：打卡计算出的健康值。
- `cultivation`：打卡计算出的修养值。
- `favoriteKey`：收藏去重用的唯一键。
- `contentId`：内容记录的业务 ID。
- `contentType`：内容类型，例如活动内容或非遗内容。
- `detailId`：用于详情页跳转或内容关联的 ID。
- `title`：内容标题。
- `summary`：内容摘要或简要说明。
- `intro`：详情页使用的正文简介。
- `cover`：封面图地址。
- `question`：AI 问答中的提问内容。
- `answer`：AI 问答中的回答内容。
- `source`：数据来源标记，例如 AI 问答来源。
- `category` / `categoryId`：内容所属分类，例如传统体育、传统饮食、传统医药、传统音乐。
- `section1Title`：详情页第一模块标题。
- `section1Content`：详情页第一模块内容。
- `section2Title`：详情页第二模块标题。
- `section2Content`：详情页第二模块内容。
- `videoUrl`：视频地址，通常用于详情页播放。
- `isDailyRecommend`：是否作为今日推荐内容。
- `showOnHome`：是否显示在首页推荐区域。
- `status`：内容状态，通常用于控制是否展示或是否可用。
- `sort`：通用排序字段，数值越小通常越靠前。
- `showInBanner`：是否出现在首页轮播区。
- `bannerSort`：轮播区专用排序字段。
- `content`：用户反馈正文。
- `contact`：用户填写的联系方式。
- `createTime`：记录创建时间。
- `updateTime`：记录最后更新时间。

### 5.3 这些集合分别会被哪些模块使用

- 首页：`campaign_contents`、`heritage_contents`
- 分类页：`heritage_contents`
- 详情页：`campaign_contents`、`heritage_contents`、`content_favorites`
- 打卡页：`heritage_contents`、`checkin_records`、`user_settings`
- AI 页：`ai_favorites`
- 个人中心：`users`
- 反馈页：`user_feedback`

## 6. 本地缓存说明

项目并不是所有数据都只存在云端，以下内容会在本地缓存：

- `local_user_info`
- `app_preferences`
- `favorites`
- `checkin_goals`
- `checkin_history`
- `ai_exit_remind_disabled`
- `logs`
- `privacy_state`

主要用途：

- 提高页面打开速度
- 减少重复请求
- 支持部分离线体验
- 保存用户的隐私选择与偏好

## 7. 新手如何跑起来

如果你是第一次接手这个项目，建议按下面顺序操作。

### 第一步：导入项目

1. 安装微信开发者工具。
2. 导入目录 `feiyi+jiankang/`。
3. 使用当前小程序对应的 `AppID` 打开项目。

### 第二步：检查云环境

1. 打开 `app.js`。
2. 确认 `wx.cloud.init` 中的 `env` 正确。
3. 在开发者工具中确认当前绑定的是同一个云环境。

### 第三步：检查云函数

至少确认以下云函数已经上传部署：

- `login`
- `aiChat`
- `migrateLegacyData`

其中 `aiChat` 还要确认环境变量：

- `DEEPSEEK_API_KEY`

### 第四步：检查数据库

至少确认以下集合存在且权限合理：

- `users`
- `user_settings`
- `checkin_records`
- `content_favorites`
- `ai_favorites`
- `campaign_contents`
- `heritage_contents`
- `user_feedback`

推荐权限：

- 用户私有数据集合：`仅创建者可读写`
- 公共内容集合：`所有用户可读，仅创建者可读写`

### 第五步：真机验证

执行 `真机验证清单.md` 中的所有检查项。

## 8. 上线前重点关注

### 8.1 内容合规

- 页面文案不要出现“开发中”“敬请期待”“演示数据”等表述。
- 公共内容尽量来自真实云端数据。
- 视频、图片、文字内容要有明确来源和使用授权。

### 8.2 AI 合规

- AI 只适合做传统养生与一般健康科普。
- 不要让 AI 提供诊断、处方、剂量、急救处理方案。
- 页面和协议要保留必要免责声明。

### 8.3 隐私与账号

- 登录方式以微信身份为准。
- 协议文案要和页面展示一致。
- 用户反馈、收藏、打卡等集合要保证隔离。

## 9. 常见问题

### Q1：为什么首页没有内容？

通常是以下原因之一：

- `campaign_contents` 没有正式数据
- `heritage_contents` 没有正式数据
- 云环境不一致
- 当前数据 `status` 未开启

### Q2：为什么 AI 不返回？

优先检查：

- `aiChat` 是否已部署
- `DEEPSEEK_API_KEY` 是否存在
- 云函数日志是否报错
- 网络是否正常

### Q3：为什么打卡页没有项目？

打卡页项目来自 `heritage_contents`，需要满足：

- 有 `title`
- 有可识别的 `category` 或 `categoryId`
- `status` 为可用状态

## 10. 推荐阅读顺序

如果你是第一次看这个仓库，建议按下面顺序阅读：

1. `README.md`
2. `真机验证清单.md`
3. `teach.md`
4. `function.md`
5. `legacy-data-migration.md`
6. `用户协议.md`
7. `隐私政策.md`
8. `AI使用说明.md`
