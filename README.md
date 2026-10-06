# 算法学习笔记本

个人算法竞赛用的在线笔记本，两块内容：**算法词汇本**（Codeforces / ICPC 高频词，按原形收录，配词性、中文释义和原题例句）和**我的文章**（所见即所得富文本，写题解、复盘、模板与踩坑）。

线上站点：**https://algorithm-wordbook.app.workbuddy.host/**（手机 / 电脑 / 任意网络直接打开，访客只读、管理员可写）

## 最近更新

- 主页精简：移除统计数字与词汇/文章入口卡片，仅保留 hero 与活跃度热力图
- 全局字号调节：顶栏字号按钮（小 / 标准 / 大 / 特大，默认标准，localStorage 持久，跨页同步生效）
- 文章编辑器体验：工具栏全部平铺常驻（撤销/重做/历史/格式/加粗/颜色/背景/对齐/水平线/块引用/代码/表格）；写文章必须选分栏（移除「未分栏/未分类」）；摘要占位简化为「摘要」；可见性选项改为「公开/私密」；粘贴图片直接内嵌原图
- 主题选择改为 fixed 浮层弹出，主体不再下移
- 顶栏升级为三页全局公共组件：图标常驻、样式统一

---

## 架构

```
浏览器 ──同源──> Node 服务 (_dev.js, 单端口)
                  ├── 静态文件 (index / wordbook / notes / visits)
                  └── /api/* 函数 (login / db / ai / me / visitor / visits / logout)
                          │
                          └── 服务端用 CLOUD_ENDPOINT + CLOUD_KEY 连 WorkBuddy 云数据库
```

- 前端纯静态（HTML + CSS + 原生 JS），所有读写都走同源 `/api/*`
- 密码和云库密钥只在**服务端环境变量**，前端零敏感信息
- 登录态走 HttpOnly 签名 Cookie，前端只看得到「visitor / admin」角色

## 权限（两级密码）

| 角色 | 进入方式 | 权限 |
| --- | --- | --- |
| 访客 visitor | 输入访客密码 | 查看 / 搜索 / 分类 / 打开；**不能**增删改 |
| 管理员 admin | 输入管理员密码 | 查看 + 新增 + 修改 + 删除 + AI 辅助 |

密码只存服务端、前端不硬编码；写接口由服务端二次校验，访客直调写接口返回 403。

## 功能

**词汇本**
- 单词卡：拼写 / 词性 / 中文释义 / 例句 / 备注；重复词自动合并例句
- 从句中选词、AI 查中文（管理员）：粘贴题面自动识别原形 + 释义
- 背诵模式（英↔中）、多种排序、方块 / 列表排版、导出 Word、JSON 导入

**我的文章**
- 所见即所得富文本（粘贴保真），代码块行号 / 折叠 / 高亮
- 方块 / 列表 / 分栏看板三视图；标签、摘要、公开 / 私密、草稿箱
- AI 辅助（续写 / 润色 / 提纲，管理员）；导出 Word、导入 md / html

**主页活跃度**
- GitHub 风格活跃度热力图（1–12 月），颜色越深当天操作越多

**访问记录**（仅管理员）：来访者角色 / IP / 设备 / 浏览文章 / 停留时长

## 目录结构

```
.
├── index.html              主页（密码门 + 入口 + 统计 + 活跃度）
├── wordbook.html / styles.css / app.js    词汇本
├── notes.html  / notes.css  / notes.js     文章模块（列表 / 看板 / 编辑器）
├── visits.html  / visits.css / visits.js    访问记录（仅管理员）
├── base.css / common.js / api.js           公共层 + 前端数据层
├── docx.js / notes_docx.js                 前端生成 .docx
├── config.js / config.example.js           站点配置（无密钥，config.js 不入库）
├── db/schema.sql                           words + notes 建表参考
├── vendor/                                  jszip 等本地依赖
├── api/                    后端函数（login / db / ai / me / visitor / visits / logout + _lib）
├── _dev.js                 本地与线上共用的单端口 Node 服务（静态 + /api）
└── .env.local              本地环境变量（gitignore）
```

## 本地开发

```bash
node _dev.js          # 默认 http://127.0.0.1:8787
```

浏览器打开地址，输入访问密码即可进入（访客只读、管理员可写）。

## 环境变量（服务端，勿入库）

| 变量 | 说明 |
| --- | --- |
| `VISITOR_PASSWORD` | 访客密码 |
| `ADMIN_PASSWORD` | 管理员密码 |
| `CLOUD_ENDPOINT` | 云库 endpoint |
| `CLOUD_KEY` | 云库密钥 |
| `SESSION_SECRET` | 签名登录 Cookie 的随机串（`openssl rand -base64 32` 生成）|

## 部署

仓库作为 WorkBuddy 应用发布（单端口 Node 服务，`node _dev.js`），配好上面五项环境变量即上线；数据库为 WorkBuddy 云数据库，结构见 `db/schema.sql`。

## 数据库

| 表 | 用途 |
| --- | --- |
| `words` | 词库：word(unique) / pos / meaning / examples(jsonb) / note |
| `notes` | 文章：title / content(HTML) / summary / tags(jsonb) / category / views / top / status / visibility |

## License

MIT
