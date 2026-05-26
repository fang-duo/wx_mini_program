# 遗韵养生说明

项目主题聚焦“非遗文化 + 健康养生”，当前代码形态已从纯静态页面演示升级为“微信小程序原生前端 + 微信云开发 + 云函数 AI 代理”的可联调版本。

## 项目概览

- 前端：微信小程序原生开发，使用 `WXML`、`WXSS`、`JavaScript`
- 后端能力：微信云开发
- 数据层：云数据库 + 云存储
- 云函数：`login`、`aiChat`、`migrateLegacyData`
- 当前状态：核心页面、打卡、收藏、资料同步、AI 问答主流程已完成，适合继续联调和上线收口

## 仓库结构

本仓库存在一层外层目录和一层实际小程序目录：

```text
.
├── README.md                    # 当前仓库说明
├── project.config.json          # 外层项目配置
└── feiyi+jiankang/              # 实际小程序工程目录
    ├── README.md                # 小程序详细说明
    ├── app.js
    ├── app.json
    ├── app.wxss
    ├── pages/
    ├── cloudfunctions/
    ├── images/
    ├── utils/
    ├── AI使用说明.md
    ├── function.md
    ├── legacy-data-migration.md
    ├── 用户协议.md
    └── 隐私政策.md
```

## 实际导入目录

如果你要在微信开发者工具中运行本项目，建议优先导入下面这个目录：

```text
feiyi+jiankang/
```

也就是仓库内层的实际小程序目录，而不是只看外层 README 所在目录。

## 当前功能状态

- 首页：支持轮播、推荐、分类入口，已具备云端内容读取和本地兜底
- 分类与详情：支持按内容类型展示非遗内容、活动内容和视频链接
- 健康打卡：支持按日记录体重、项目、时长，并同步打卡目标与历史记录
- AI 问答：前端已接入 `aiChat` 云函数，支持推荐问题与问答收藏
- 个人中心：支持头像昵称管理、收藏查看、反馈入口、设置入口
- 数据同步：收藏、用户设置、打卡记录支持本地缓存与云端同步

## 相关文档

- `feiyi+jiankang/README.md`：小程序详细说明
- `feiyi+jiankang/function.md`：当前完成度、差距与后续推进建议
- `feiyi+jiankang/AI使用说明.md`：AI 使用说明与免责声明
- `feiyi+jiankang/legacy-data-migration.md`：旧数据迁移方案
- `feiyi+jiankang/用户协议.md`：用户协议
- `feiyi+jiankang/隐私政策.md`：隐私政策

## 快速开始

1. 安装并打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择“导入项目”
3. 项目目录选择仓库中的 `feiyi+jiankang/`
4. 使用已有 `AppID`，或先用测试号进行本地调试
5. 打开后确认云开发环境、云函数和数据库配置是否可用

## 注意事项

- 项目已在代码中初始化云环境，联调前需要确认开发者工具中的云开发权限正常
- AI 问答依赖 `aiChat` 云函数与外部模型接口配置，未部署时页面无法正常返回回答
- 如果数据库中仍存在旧结构数据，建议先阅读 `legacy-data-migration.md` 再进行正式联调

## 建议阅读顺序

1. 先看本文件，确认仓库结构
2. 再看 `feiyi+jiankang/README.md`，了解小程序功能与运行方式
3. 联调前阅读 `function.md` 和 `legacy-data-migration.md`
4. 提审前核对 `AI使用说明.md`、`用户协议.md`、`隐私政策.md`
