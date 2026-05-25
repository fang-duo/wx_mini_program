# 项目开发记录 (History)

## 项目信息

- **项目名称**: 非遗健康养生小程序
- **开发时间**: 2026-05-10 至 2026-05-11
- **开发者**: Loyce.C 及团队

---

## 开发历程

### 第一阶段：活动详情页优化 (2026-05-10)

#### 问题背景

用户反馈活动详情页的"活动介绍"和"温馨提示"显示的是占位文字，无法显示真实内容。

#### 解决方案

1. **分析数据结构**
   
   - 找到文章存储集合：`campaign_contents`（活动内容）和 `heritage_contents`（非遗内容）
   - 分析详情页代码逻辑

2. **修改 detail.js**
   
   - 让程序优先读取云数据库中的 `introduction` 和 `tips` 字段
   - 如果数据库中没有，则使用默认占位文字

3. **云开发数据库操作**
   
   - 在 `campaign_contents` 集合中手动添加 `introduction` 和 `tips` 字段
   - 字段类型：String（字符串）
   - 字段名必须严格匹配：`introduction` 和 `tips`

4. **CMS 后台配置**
   
   - 在云开发 CMS 的模型管理中添加这两个字段
   - 确保 CMS 后台也能看到并编辑这两个字段

#### 完成的文件

- `pages/detail/detail.js` - 修改了数据读取逻辑

---

### 第二阶段：个人中心页面优化 (2026-05-10 至 2026-05-11)

#### 问题背景

个人中心页面的头像和昵称无法正确保存和显示，切换页面后会变回默认值。

#### 解决方案

##### 1. 头像和昵称获取功能

- **头像获取**：使用 `<button open-type="chooseAvatar">`
- **昵称获取**：使用 `<input type="nickname">`
- 符合微信小程序最新规范

##### 2. 本地缓存方案

- 使用 `wx.setStorageSync` 和 `wx.getStorageSync`
- 存储键名：`local_user_info`
- 存储内容：`{ nickname, avatarUrl }`

##### 3. 云开发存储方案

- 集合名称：`users`
- 字段：`nickname`（昵称）、`avatarUrl`（头像）、`createTime`、`updateTime`
- 权限设置：所有用户可读，仅创建者可写

##### 4. 头像上传云存储

- 选择头像后，自动上传到云开发存储
- 存储路径：`avatars/{时间戳}-{随机字符串}.jpg`
- 保存 fileID 到数据库

##### 5. UI 样式优化

- 头像改为圆形（100rpx × 100rpx）
- 调整头像和昵称之间的间距（30rpx）
- 占位文字加粗黑色显示

#### 遇到的问题及解决

| 问题              | 原因          | 解决方案                                       |
| --------------- | ----------- | ------------------------------------------ |
| 昵称点击没反应         | 事件绑定错误      | 从 `bind:nickname` 改为 `bind:chooseNickname` |
| 切换页面昵称变回默认      | 数据读取逻辑复杂    | 简化逻辑，只读取本地缓存                               |
| 昵称显示"undefined" | 初始值问题       | 初始化时设为空字符串                                 |
| 按钮组件样式问题        | button 默认样式 | 用 `::after` 和 `!important` 强制覆盖            |

#### 完成的文件

- `pages/profile/profile.js` - 头像昵称获取、保存逻辑
- `pages/profile/profile.wxml` - UI 结构
- `pages/profile/profile.wxss` - 样式优化
- `app.js` - 应用启动时读取用户信息

---

### 第三阶段：云开发云函数部署 (2026-05-11)

#### 问题背景

需要获取用户的唯一标识（openid），确保每个用户只有一条记录。

#### 解决方案

1. **创建 login 云函数**
   
   - 位置：`cloudfunctions/login/`
   - 功能：获取用户 openid

2. **部署云函数**
   
   - 右键点击 `cloudfunctions/login` 文件夹
   - 选择"上传并部署：云端安装依赖"
   - 等待部署成功提示

#### 完成的文件

- `cloudfunctions/login/index.js` - 云函数入口
- `cloudfunctions/login/config.json` - 云函数配置
- `cloudfunctions/login/package.json` - 依赖配置

---

### 第四阶段：打卡页面云存储 (2026-05-11)

#### 当前状态

打卡页面代码已经支持云存储：

- 集合名称：`checkin_records`
- 功能：保存打卡记录、读取打卡记录
- 双重备份：同时存本地和云端

#### 数据结构

```javascript
// checkin_records 集合
{
  _id: "...",
  _openid: "...", // 用户唯一标识
  date: "2026-05-11",
  weight: 65,
  projectIds: ["s1", "s2"],
  durations: { s1: 30, s2: 20 },
  calories: 150,
  health: 3,
  cultivation: 2,
  createTime: "...",
  updateTime: "..."
}
```

#### 完成的文件

- `pages/checkin/checkin.js` - 打卡逻辑（已有云存储支持）

---

### 第五阶段：帮助与反馈云存储 (2026-05-12)

#### 问题背景

用户提交的反馈只在本地模拟，没有保存到云端，后台看不到。

#### 解决方案

1. **创建集合**
   
   - 集合名称：`user_feedback`
   - 权限设置：所有用户可读，仅创建者可写

2. **修改 feedback.js**
   
   - 提交反馈时保存到云数据库
   - 字段：content（内容）、contact（联系方式）、status（状态）
   - 状态默认值："待处理"

3. **CMS 后台配置（可选）**
   
   - 在模型管理中添加用户反馈模型
   - 字段：反馈内容、联系方式、状态
   - 在内容库中查看和管理反馈

#### 数据结构

```javascript
// user_feedback 集合
{
  _id: "...",
  _openid: "...",
  content: "建议增加更多非遗项目",
  contact: "138xxxx8888",
  status: "待处理",
  createTime: "...",
  updateTime: "..."
}
```

#### 完成的文件

- `pages/feedback/feedback.js` - 修改了提交逻辑

---

### 第六阶段：账号隔离与云端同步架构收口 (2026-05-20)

#### 阶段目标

前面项目已经有了用户资料、打卡、收藏等功能，但数据存储策略不统一，存在下面几个问题：

- 一部分数据只存在本地，换设备或清缓存后会丢失
- 一部分页面虽然接了云开发，但没有统一按用户身份隔离
- 账号切换、退出登录、清缓存时，用户相关本地数据没有系统化清理

这一阶段的核心目标，不是继续堆新页面，而是把“用户级数据”真正整理成可持续维护的结构。

#### 本阶段完成内容

##### 1. 明确当前身份方案

- 项目正式以微信小程序 `openid` 作为用户身份主键
- 旧的“手机号 + 密码”页面仍保留界面，但不再代表真实可上线的账号体系
- 新增/统一了代码里对 `openid` 的显式读取与缓存逻辑

##### 2. 新增统一数据同步工具

- 新增 `utils/dataSync.js`
- 统一封装了以下能力：
  - 获取当前用户 `openid`
  - 用户资料加载
  - 设置项加载/保存
  - 打卡目标加载/保存
  - 打卡记录加载/保存
  - 内容收藏加载/保存/取消
  - AI 收藏加载/保存/删除
  - 应用缓存统计与清理

##### 3. 数据策略升级为“云端为主，本地为缓存”

- 统一原则：主数据优先落云端，本地只做缓存和兜底
- 已纳入该策略的核心数据包括：
  - `content_favorites`
  - `ai_favorites`
  - `user_settings`
  - `checkin_records`

##### 4. 打卡功能完成云端同步闭环

- 打卡目标已支持同步到 `user_settings.checkinGoals`
- 打卡记录已支持按 `openid + date` 写入 `checkin_records`
- 月份切换时会从云端重新拉取当月记录并刷新日历
- 本地缓存依然保留，用于弱网或云端失败时兜底

##### 5. 收藏体系拆分并完成云端化

- 内容收藏单独存储到 `content_favorites`
- AI 问答收藏单独存储到 `ai_favorites`
- 收藏键 `favoriteKey` 已统一，便于查重和取消收藏
- 收藏页和 AI 收藏页都已改为“本地先展示、云端再刷新”的方式

##### 6. 设置页完成真正的缓存管理与云同步

- 设置页的通知开关已改为可持久化
- 设置项已同步到 `user_settings.appPreferences`
- 清缓存时会明确区分“清本地缓存”和“云端数据仍保留”
- 退出登录/切换账号时开始清理用户相关本地缓存，降低串号风险

#### 本阶段涉及文件

- `utils/dataSync.js` - 统一数据同步能力
- `pages/checkin/checkin.js` - 打卡目标/记录云同步
- `pages/favorites/favorites.js` - 内容收藏云端读取
- `pages/message/message.js` - AI 收藏云端读取与删除
- `pages/settings/settings.js` - 设置云同步与缓存管理
- `pages/profile/profile.js` - 用户资料云端读取与退出逻辑

---

### 第七阶段：AI 问答会话策略调整与收藏闭环 (2026-05-20)

#### 问题背景

AI 问答原先更偏向“本地长期保留全部聊天记录”的思路，但在实际小程序场景下，这会带来两个问题：

- 聊天内容越来越多，状态管理会越来越重
- 真正有价值的通常不是整段历史，而是用户想保留下来的少数回答

#### 本阶段关键决策

1. **AI 历史不做长期云端保存**
   
   - 当前会话只保留在当前页面生命周期内
   - 用户离开 AI 页面后，未收藏内容默认清空

2. **AI 收藏才做正式持久化**
   
   - 用户可对问答对进行多选
   - 选中的问答保存到 `ai_favorites`
   - 收藏页单独查看和管理

3. **离开页面前增加提醒**
   
   - 如果当前会话存在未收藏问答，会提示用户先收藏
   - 用户也可以手动关闭此提醒

#### 本阶段完成内容

- `pages/ai/ai.js` 已支持：
  - 推荐提问
  - 调用 `aiChat` 云函数
  - 问答对批量选择
  - 批量收藏到云端
  - 离开页面前提醒
  - 页面卸载后重置当前会话
- `pages/message/message.js` 已支持：
  - AI 收藏列表读取
  - 单条删除
  - 批量删除

#### 和早期方案的区别

- 早期 `history.md` 中“AI 问答历史云存储”属于旧待办
- 当前阶段已经明确：**不做完整聊天历史持久化，改为“临时会话 + 云端收藏”**

---

### 第八阶段：首页内容云端化与旧数据迁移准备 (2026-05-20)

#### 1. 首页与详情页的内容读取能力继续完善

- 首页已支持优先从云端读取：
  - `campaign_contents`
  - `heritage_contents` / `heritage_content`
- 本地静态数据仍保留兜底，保证云端为空时页面不至于白屏
- 详情页已支持按内容类型读取活动/非遗内容，并兼容：
  - `introduction`
  - `tips`
  - `videoUrl`
  - `showInBanner`
  - `isDailyRecommend`
  - `showOnHome`

#### 2. 补充旧数据迁移方案与迁移云函数

- 新增迁移说明文档：`legacy-data-migration.md`
- 新增迁移云函数：`cloudfunctions/migrateLegacyData`
- 迁移工具支持：
  - 补齐 `openid`
  - 补齐 `favoriteKey`
  - 合并重复用户设置/用户资料
  - 清理重复打卡记录和收藏记录
  - `dryRun` 预演和正式执行两种模式

#### 3. 本阶段价值

这一阶段不是“用户可见的新功能”，但对后续正式上线非常关键：

- 为多设备数据一致性打底
- 为老数据升级到新结构提供工具
- 为后续账号收口、权限校验、索引建立提供清晰路径

---

### 第九阶段：登录体系正式闭环与个人中心优化 (2026-05-23)

#### 问题背景

登录页面仍是模拟登录，只在本地设置状态，未真正接入云函数；个人中心选择昵称后没有立即保存，切换页面后会丢失；用户信息保存时 openid 字段查询逻辑不统一。

#### 本阶段完成内容

##### 1. 登录页面接入云函数

- 修改 `pages/login/login.js` 的 `handleLogin` 函数
- 调用 `login` 云函数获取用户 openid
- 登录成功后：
  - 保存 openid 到全局变量
  - 如果云端有用户信息，加载并保存到全局和本地存储
  - 如果是新用户，自动在 `users` 集合创建记录
- 添加登录加载状态和错误处理

##### 2. 个人中心昵称保存优化

- 在 `profile.wxml` 中添加 `bind:input` 事件监听
- 新增 `onNicknameInput` 函数，昵称输入时立即保存到本地
- `onNicknameBlur` 只负责触发云端保存
- 确保昵称选择后不会丢失

##### 3. 修复 openid 字段查询逻辑

- 修复 `saveUserToCloud` 函数，使用 `_.or` 同时查询 `_openid` 和 `openid` 字段
- 兼容微信云开发自动生成的 `_openid` 和代码中保存的 `openid`
- 确保能正确找到用户记录

##### 4. 优化 onShow 加载逻辑

- 从云端加载用户信息时，采用合并策略 `{ ...云端信息, ...本地信息 }`
- 本地信息优先，避免云端数据覆盖本地最新数据

##### 5. UI 优化

- 去掉个人中心的"切换账号"按钮
- 将默认头像从文字改为图片（`人.png`）
- 调整默认头像样式

#### 完成的文件

- `pages/login/login.js` - 接入云函数登录
- `pages/profile/profile.js` - 昵称即时保存、查询逻辑修复
- `pages/profile/profile.wxml` - 移除切换账号、默认头像改为图片
- `pages/profile/profile.wxss` - 头像样式优化
- `cloudfunctions/login/index.js` - 兼容 _openid/openid 查询
- `images/我.png` - 默认头像1
- `images/人.png` - 默认头像2（当前使用）

---

## 数据库集合说明

### 1. users（用户信息）

| 字段         | 类型     | 说明               |
| ---------- | ------ | ---------------- |
| _id        | String | 记录 ID            |
| _openid    | String | 用户唯一标识（自动生成）     |
| nickname   | String | 昵称               |
| avatarUrl  | String | 头像地址（云存储 fileID） |
| createTime | Date   | 创建时间             |
| updateTime | Date   | 更新时间             |

### 2. checkin_records（打卡记录）

| 字段          | 类型     | 说明               |
| ----------- | ------ | ---------------- |
| _id         | String | 记录 ID            |
| _openid     | String | 用户唯一标识（自动生成）     |
| date        | String | 打卡日期（yyyy-mm-dd） |
| weight      | Number | 体重               |
| projectIds  | Array  | 打卡项目 ID 列表       |
| durations   | Object | 各项目时长            |
| calories    | Number | 消耗卡路里            |
| health      | Number | 健康度              |
| cultivation | Number | 修养度              |
| createTime  | Date   | 创建时间             |
| updateTime  | Date   | 更新时间             |

### 3. campaign_contents（活动内容）

| 字段           | 类型      | 说明       |
| ------------ | ------- | -------- |
| _id          | String  | 记录 ID    |
| title        | String  | 标题       |
| cover        | String  | 封面图      |
| summary      | String  | 简介       |
| introduction | String  | 活动介绍（新增） |
| tips         | String  | 温馨提示（新增） |
| content      | String  | 正文内容     |
| date         | String  | 日期       |
| videoUrl     | String  | 视频链接     |
| status       | Boolean | 是否显示     |
| sort         | Number  | 排序       |

### 4. heritage_contents（非遗内容）

| 字段       | 类型     | 说明                             |
| -------- | ------ | ------------------------------ |
| _id      | String | 记录 ID                          |
| title    | String | 标题                             |
| cover    | String | 封面图                            |
| summary  | String | 简介                             |
| content  | String | 正文内容                           |
| category | String | 分类（sports/food/medicine/music） |

### 5. user_feedback（用户反馈）

| 字段         | 类型     | 说明           |
| ---------- | ------ | ------------ |
| _id        | String | 记录 ID        |
| _openid    | String | 用户唯一标识（自动生成） |
| content    | String | 反馈内容         |
| contact    | String | 联系方式（可选）     |
| status     | String | 状态（待处理/已处理）  |
| createTime | Date   | 创建时间         |
| updateTime | Date   | 更新时间         |

---

## 关键代码速查表

| 功能       | 文件           | 位置                |
| -------- | ------------ | ----------------- |
| 应用启动读取用户 | `app.js`     | `onLaunch`        |
| 头像获取     | `profile.js` | `chooseAvatar`    |
| 昵称获取     | `profile.js` | `onNicknameBlur`  |
| 保存用户信息   | `profile.js` | `saveUserToCloud` |
| 打卡保存     | `checkin.js` | `submitRecord`    |
| 打卡加载     | `checkin.js` | `loadData`        |
| 活动详情数据   | `detail.js`  | `loadContent`     |

---

## 当前待完成任务

### 高优先级

- [x] 完成真实登录闭环：当前 `pages/login/login` 仍是前端模拟登录，尚未切换到正式的微信身份接入方案
- [x] 联调并验证 `login` 云函数、`users` 集合与用户资料页之间的完整链路
- [ ] 联调并验证 `aiChat` 云函数的正式可用性，包括环境变量、超时、异常返回和审核文案
- [ ] 在真实云环境完成一次全量验证：`content_favorites`、`ai_favorites`、`user_settings`、`checkin_records`
- [ ] 根据旧库实际情况执行 `migrateLegacyData` 的 `dryRun` 与正式迁移

### 中优先级

- [ ] 统一 `profile` 页与 `account` 页的资料编辑逻辑，避免一页存云、一页只存全局变量
- [ ] 完成首页运营字段和 CMS/云数据库实际内容的补齐，形成稳定的内容维护流程
- [ ] 为核心集合补索引、补权限校验、补上线前验收清单
- [ ] 补充正式的隐私政策、用户协议、AI 使用说明和用户提示文案

### 低优先级

- [ ] 活动报名功能
- [ ] 用户数据统计
- [ ] 数据导出功能
- [ ] 勋章、激励、运营活动等扩展功能

---

## 重要注意事项

### 1. 版权问题

- ❌ **不要下载 B 站视频传到自己的云存储**（侵权风险）
- ✅ **只放跳转链接**，让用户去 B 站看
- ✅ **明确标注来源**

### 2. 云开发容量

- 免费版 3GB 容量完全够用
- 文字数据几乎不占空间
- 图片建议压缩后上传
- 视频只放链接，不上传

### 3. 数据库权限

- 所有集合建议设置为：**所有用户可读，仅创建者可写**
- 确保每个人只能看到和修改自己的数据

### 4. 本地缓存

- 用户信息优先存本地缓存
- 云端作为备份和同步
- 避免频繁请求云端，提升体验

---

## 技术栈

- **前端框架**: 微信小程序原生
- **后端服务**: 微信云开发
- **数据库**: 云开发文档型数据库
- **存储**: 云开发云存储
- **云函数**: Node.js

---

## 后续开发建议

### 1. 先完善核心功能

- 确保打卡记录能正确存云端
- 确保用户信息能正确保存
- 确保切换页面数据不丢失

### 2. 再添加新功能

- 历史记录查看
- 数据统计
- 用户反馈

### 3. 最后优化体验

- 性能优化
- UI 优化
- 错误处理

---

## 阶段总结

这段时间已经从“页面功能开发”进入到“上线前基础能力收口”阶段，主要完成了：

1. ✅ 活动详情页数据读取优化
2. ✅ 个人中心头像昵称获取和保存
3. ✅ 本地缓存方案实现
4. ✅ 云开发用户信息存储
5. ✅ login 云函数部署
6. ✅ 打卡页面云存储支持（已有）
7. ✅ 数据策略升级为“云端优先，本地缓存”
8. ✅ 打卡目标、打卡记录、内容收藏、AI 收藏、设置项统一纳入云同步体系
9. ✅ AI 问答改为“临时会话 + 云端收藏”模式
10. ✅ 首页/详情页进一步兼容云端内容读取
11. ✅ 旧数据迁移文档与迁移云函数准备完成
12. ✅ 登录体系正式接入云函数，完成身份闭环
13. ✅ 个人中心昵称即时保存、修复 openid 查询逻辑、默认头像优化

目前项目已经**适合继续做联调、验收和上线准备**，核心的登录和用户体系已经闭环。剩余关键待完成项：

- AI 云函数、云数据库集合、旧数据迁移还需要在真实环境完成验证
- 小程序正式发布所需的审核、协议、隐私、类目和运营材料还未收口

---

*最后更新时间：2026-05-23*
