# 旧数据迁移说明

本文档用于处理历史云数据库数据与当前代码查询逻辑不一致的问题，适合在以下场景使用：

- 老数据只有系统 `_openid`，没有业务字段 `openid`
- 收藏记录缺少 `favoriteKey`
- 同一用户存在重复设置、重复收藏、重复打卡记录
- 新代码已经按 `openid` 查询，但历史数据仍停留在旧结构

## 一、会影响到的集合

- `users`
- `user_settings`
- `checkin_records`
- `ai_favorites`
- `content_favorites`

## 二、迁移目标

### 1. `users`

补齐或统一以下字段：

- `openid`
- `nickname`
- `avatarUrl`
- `createTime`
- `updateTime`

### 2. `user_settings`

确保每个用户只有一条配置记录，并包含：

- `openid`
- `appPreferences`
- `checkinGoals`
- `createTime`
- `updateTime`

### 3. `checkin_records`

确保按 `openid + date` 唯一，并包含：

- `openid`
- `date`
- `weight`
- `projects`
- `durations`
- `calories`
- `health`
- `cultivation`
- `createTime`
- `updateTime`

### 4. `ai_favorites`

确保按 `openid + favoriteKey` 唯一，并包含：

- `openid`
- `favoriteKey`
- `question`
- `answer`
- `source`
- `createTime`

### 5. `content_favorites`

确保按 `openid + favoriteKey` 唯一，并包含：

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

## 三、迁移前一定先做的事

1. 导出备份相关集合。
2. 确认当前代码已是最新版本。
3. 确认 `migrateLegacyData` 云函数已部署。
4. 确认数据库权限不是临时放开的状态。

## 四、推荐执行顺序

1. 备份数据
2. 上传并部署 `migrateLegacyData`
3. 执行 `dryRun`
4. 检查输出结果
5. 再执行正式迁移
6. 迁移后重新验证收藏、打卡、设置读取

## 五、如何执行预演

在云函数测试面板中执行：

```json
{
  "dryRun": true
}
```

如果只想先检查单个集合，可以这样：

```json
{
  "dryRun": true,
  "collections": ["user_settings"]
}
```

## 六、如何正式执行

```json
{
  "dryRun": false
}
```

执行前请确认：

- 已备份
- 已看过 `dryRun` 结果
- 当前环境是正确环境

## 七、建议补的索引

推荐建立以下索引：

- `users.openid`
- `user_settings.openid`
- `checkin_records.openid + date`
- `ai_favorites.openid + favoriteKey`
- `content_favorites.openid + favoriteKey`

## 八、迁移后怎么验收

至少确认下面这些：

- 同一用户能读到历史打卡
- 内容收藏仍能显示
- AI 收藏仍能显示
- 设置项仍能加载
- 不同账号之间不会串数据

## 九、当前建议

如果线上历史数据量很小，建议仍然按“先备份、再预演、再迁移”的顺序做，不要直接跳过。
