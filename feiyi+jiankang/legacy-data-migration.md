# 旧数据迁移处理方案

## 1. 目标

本方案用于把历史云数据库数据迁移到当前新的“按 `openid` 显式隔离”的实现上，解决以下问题：

- `user_settings`、`checkin_records`、`ai_favorites`、`content_favorites` 旧文档只有系统 `_openid`，没有业务字段 `openid`
- `ai_favorites`、`content_favorites` 的旧文档可能缺少 `favoriteKey`
- `checkin_records`、`ai_favorites`、`content_favorites`、`user_settings` 可能已经存在重复文档
- 新代码已经按 `openid` 字段查询，如果不迁移，旧数据可能不会被读到

本次方案同时覆盖：

- 迁移前备份
- 迁移前预演
- 正式迁移
- 重复数据处理
- 迁移后验收
- 回滚思路

## 2. 影响集合

### `users`

目标字段：

- `_openid`：系统自动字段，保留
- `openid`：新增业务字段，用于代码显式查询
- `nickname`
- `avatarUrl`
- `createTime`
- `updateTime`

说明：

- `users` 旧数据通常还能被 `login` 云函数通过 `_openid` 读到
- 这个集合优先级相对较低，但建议统一补齐 `openid`

### `user_settings`

目标字段：

- `openid`
- `appPreferences`
- `checkinGoals`
- `createTime`
- `updateTime`

说明：

- 每个用户只应保留一条配置记录

### `checkin_records`

目标字段：

- `openid`
- `date`
- `weight`
- `projectIds`
- `durations`
- `calories`
- `health`
- `cultivation`
- `createTime`
- `updateTime`

说明：

- 唯一性目标为 `openid + date`

### `ai_favorites`

目标字段：

- `openid`
- `favoriteKey`
- `question`
- `answer`
- `source`
- `createTime`
- `updateTime`

说明：

- 唯一性目标为 `openid + favoriteKey`
- `favoriteKey` 规则：`question::answer`

### `content_favorites`

目标字段：

- `openid`
- `favoriteKey`
- `contentId`
- `contentType`
- `detailId`
- `title`
- `cover`
- `tag`
- `date`
- `intro`
- `createTime`
- `updateTime`

说明：

- 唯一性目标为 `openid + favoriteKey`
- `favoriteKey` 规则：`contentType::contentId/detailId/title`

## 3. 推荐执行顺序

1. 备份云数据库
2. 确认新代码已经上传
3. 上传并部署 `migrateLegacyData` 云函数
4. 先执行 `dryRun`
5. 核对预演结果
6. 再执行正式迁移
7. 验收新代码与新数据
8. 保留备份至少 7 天

## 4. 迁移前准备

### 4.1 先做备份

在微信云开发控制台导出以下集合：

- `users`
- `user_settings`
- `checkin_records`
- `ai_favorites`
- `content_favorites`

建议导出格式：

- JSON
- CSV

建议命名：

- `users-backup-before-openid-migration.json`
- `user_settings-backup-before-openid-migration.json`
- `checkin_records-backup-before-openid-migration.json`
- `ai_favorites-backup-before-openid-migration.json`
- `content_favorites-backup-before-openid-migration.json`

### 4.2 确认数据库权限

建议至少保证下面几类集合为“仅创建者可读写”或等效安全权限：

- `users`
- `user_settings`
- `checkin_records`
- `ai_favorites`
- `content_favorites`

如果你当前为了迁移方便临时放宽权限，迁移完成后要立即恢复。

### 4.3 建议补索引

建议在云开发控制台为以下组合建立索引：

- `users.openid`
- `user_settings.openid`
- `checkin_records.openid + date`
- `ai_favorites.openid + favoriteKey`
- `ai_favorites.openid + createTime`
- `content_favorites.openid + favoriteKey`
- `content_favorites.openid + createTime`

## 5. 已补充的迁移工具

项目里已新增一次性迁移云函数：

- [migrateLegacyData](file:///c:/Users/29963/Desktop/项目/feiyi+jiankang/feiyi+jiankang/cloudfunctions/migrateLegacyData/index.js)

它支持两种模式：

- `dryRun: true`：只统计，不写库
- `dryRun: false`：正式执行迁移

它会自动处理：

- 补齐 `openid`
- 补齐 `favoriteKey`
- 检测并清理重复记录
- 输出每个集合的迁移摘要

## 6. 部署步骤

### 6.1 安装依赖

在微信开发者工具中右键：

- `cloudfunctions/migrateLegacyData`

选择：

- “上传并部署：云端安装依赖”

### 6.2 先执行预演

在云函数测试面板中执行：

```json
{
  "dryRun": true
}
```

如果只想先测单个集合，可以这样：

```json
{
  "dryRun": true,
  "collections": ["user_settings"]
}
```

### 6.3 正式执行迁移

确认预演结果正常后，再执行：

```json
{
  "dryRun": false
}
```

如果想分批执行，也可以按集合拆开跑：

```json
{
  "dryRun": false,
  "collections": ["user_settings", "checkin_records"]
}
```

## 7. 预演结果怎么看

云函数返回结构里重点看这些字段：

- `dryRun`
- `operationCount`
- `execution.updatedCount`
- `execution.removedCount`
- `summaries`
- `operationsPreview`

重点判断：

- `summaries[*].updateCount` 是否符合预期
- `summaries[*].removeCount` 是否只是清理重复，不是异常大数
- `warnings` 里是否出现大量“缺少 openid/date/favoriteKey”

如果你看到下面情况，先不要执行正式迁移：

- 某个集合的 `removeCount` 明显过大
- `warnings` 数量异常多
- `operationsPreview` 中有你不认可的删除动作

## 8. 各集合迁移逻辑

### 8.1 `users`

处理逻辑：

- 如果文档没有 `openid`，但有 `_openid`，回填 `openid`
- 如果同一个 `openid` 存在多条记录，保留最新一条
- 若主记录缺昵称或头像，会从旧记录补齐
- 其余重复记录删除

### 8.2 `user_settings`

处理逻辑：

- 回填 `openid`
- 同一 `openid` 只保留一条
- 保留最新记录为主记录
- 若主记录缺 `appPreferences` 或 `checkinGoals`，会从旧记录补齐
- 其余重复记录删除

### 8.3 `checkin_records`

处理逻辑：

- 回填 `openid`
- 以 `openid + date` 作为唯一键
- 若同一用户同一天有多条记录，保留最新一条
- 其余重复记录删除

### 8.4 `ai_favorites`

处理逻辑：

- 回填 `openid`
- 缺少 `favoriteKey` 时，按 `question::answer` 自动生成
- 以 `openid + favoriteKey` 作为唯一键
- 重复收藏只保留最新一条

### 8.5 `content_favorites`

处理逻辑：

- 回填 `openid`
- 缺少 `favoriteKey` 时，按 `contentType::contentId/detailId/title` 自动生成
- 以 `openid + favoriteKey` 作为唯一键
- 重复收藏只保留最新一条

## 9. 迁移后验收清单

迁移执行完后，建议按下面顺序验收：

### 9.1 用户资料

- 进入个人中心
- 检查昵称和头像是否正常回显
- 修改昵称后确认 `users` 没有新增重复文档

### 9.2 设置

- 进入设置页
- 切换消息通知
- 检查 `user_settings` 是否只保留当前用户一条记录

### 9.3 打卡

- 打开打卡页
- 检查本月历史是否回显
- 新增或覆盖当天打卡
- 检查 `checkin_records` 是否按 `openid + date` 只保留一条

### 9.4 AI 收藏

- 在 AI 页面收藏同一问答两次
- 打开 AI 收藏页
- 确认没有重复文档

### 9.5 内容收藏

- 在详情页重复收藏/取消收藏同一内容
- 确认 `content_favorites` 行为稳定

## 10. 回滚方案

如果正式迁移后发现结果异常，按下面顺序处理：

1. 停止继续写入相关集合
2. 在云开发控制台删除异常迁移后的数据
3. 重新导入迁移前备份
4. 恢复旧代码或临时关闭新查询逻辑
5. 修正迁移策略后重新执行 `dryRun`

建议不要在没有备份的情况下直接执行正式迁移。

## 11. 额外说明

### 11.1 为什么还要保留 `_openid`

- `_openid` 是微信云开发系统字段
- 不建议删除
- 新增 `openid` 是为了让前端代码显式按用户维度查询，便于维护和排查

### 11.2 哪些数据可以“自然修复”

- `users` 在用户再次进入个人中心并保存资料时，通常会自行补齐 `openid`

### 11.3 哪些数据不能等用户自然修复

- `user_settings`
- `checkin_records`
- `ai_favorites`
- `content_favorites`

这些集合如果不迁移，旧数据可能不会被新代码读取到。

## 12. 推荐实际执行方案

最推荐的方式不是一次全量盲跑，而是：

1. 先备份
2. 先对 `user_settings` 做 `dryRun`
3. 再对 `checkin_records` 做 `dryRun`
4. 再对 `ai_favorites` 和 `content_favorites` 做 `dryRun`
5. 最后全量正式执行

建议最终正式执行事件：

```json
{
  "dryRun": false,
  "collections": [
    "users",
    "user_settings",
    "checkin_records",
    "ai_favorites",
    "content_favorites"
  ]
}
```
