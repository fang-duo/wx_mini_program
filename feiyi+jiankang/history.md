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

## 待完成任务

### 高优先级

- [x] 帮助与反馈云存储 ✅
- [ ] 完善打卡记录的用户过滤（只显示当前用户的记录）
- [ ] 测试云函数 login 是否正常工作
- [ ] 测试打卡记录的云端存储

### 中优先级

- [ ] AI 问答历史云存储
- [ ] 收藏功能云存储
- [ ] 历史记录查看页面

### 低优先级

- [ ] 活动报名功能
- [ ] 用户数据统计
- [ ] 数据导出功能

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

## 总结

这段时间主要完成了：

1. ✅ 活动详情页数据读取优化
2. ✅ 个人中心头像昵称获取和保存
3. ✅ 本地缓存方案实现
4. ✅ 云开发用户信息存储
5. ✅ login 云函数部署
6. ✅ 打卡页面云存储支持（已有）

项目核心功能已经基本完善，可以进行测试和演示了！

---

*最后更新时间：2026-05-11 22:30*