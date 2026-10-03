# 算法学习笔记本

个人算法学习用的在线笔记本，两块内容：

1. **算法词汇本** —— Codeforces / ICPC 高频词，按原形收录，配词性、中文释义和原题例句
2. **我的文章** —— 仿 CSDN 的写作体验，写题解、思路复盘、模板与踩坑记录

在线地址（部署到 Vercel 后由你分享）：**只有拿到链接 + 输入访问密码才能进**。
GitHub 仓库保持 **Private**，源码不公开。

---

## 架构

```
浏览器 ──(同源)──> Vercel Serverless (/api/*) ──(服务端, 带密钥)──> WorkBuddy 云数据库
   │                        │
   │  登录态走 HttpOnly 签名 Cookie，前端只看得到「visitor / admin」角色
   │  密码 / 云端密钥只在服务端环境变量，前端零敏感信息
```

- 前端是纯静态（HTML + CSS + 原生 JS），不再直连云端数据库，所有读写都走 `/api/*`
- `/api/*` 是 Vercel Serverless 函数（Node），在服务端用 `CLOUD_ENDPOINT` + `CLOUD_KEY` 连云库
- 浏览器只和自己的同源域名通信，**彻底绕开**了云端数据库「只允许同源 `*.app.workbuddy.host`」的 CORS 限制

### 两级密码权限

| 角色 | 密码（环境变量） | 权限 |
| --- | --- | --- |
| 访客 visitor | `icpc`（`VISITOR_PASSWORD`） | 可查看所有笔记 / 搜索 / 分类 / 打开；**不能**增删改 |
| 管理员 admin | `yqx`（`ADMIN_PASSWORD`） | 查看 + 新增 + 修改 + 删除 + AI 辅助 |

安全要求落实方式：

- 密码只存服务端环境变量，**绝不在前端源码里硬编码**
- 登录时前端把密码 POST `/api/login`，服务端比对后下发 **HttpOnly + signed** Cookie（`an_role`）
- 前端据此只做「隐藏写按钮」的 UI 收敛；真正的权限校验在服务端：`/api/db` 的写操作（insert/update/delete）**先校验角色是否为 admin**，访客甚至直接 curl 也会被 403
- 登录态用安全会话保持，刷新页面不丢；退出清空 Cookie 回登录页
- 阅读量自增这类纯副作用允许任意已登录角色

---

## 目录结构

```
.
├── index.html            # 主页：密码门 + 站名 + 两个入口 + 统计 + 最近文章
├── base.css              # 公共层：主题变量、顶栏、登录门、角色栏、按钮、卡片
├── common.js             # 公共层：主题切换 / toast / 弹窗 / 顶栏渲染
├── api.js                # 前端数据层：DB builder → /api/db；登录门；角色 UI；云端 LLM 代理
├── home.css / home.js    # 主页样式与逻辑
│
├── wordbook.html         # 单词本（原 index.html，功能未改动，只加了返回主页导航）
├── styles.css            # 单词本样式（方块/列表、活跃度热力图、移动端适配）
├── app.js                # 单词本逻辑：增删改查、搜索排序、背诵、AI 查中文
├── docx.js               # 纯前端生成 .docx（OOXML + JSZip）
│
├── notes.html            # 文章模块：列表 / 阅读 / 编辑器（同一页切换视图）
├── notes.css / notes.js  # 文章模块样式与逻辑（CRUD、Markdown 渲染、工具栏、AI 辅助）
│
├── assets/logo.png       # 站点图标
├── config.js             # 站点配置（仅展示项，gitignore）
├── config.example.js     # 配置模板（入库，不含任何密钥/密码）
├── db/schema.sql         # 建表 SQL 参考（words + notes）
├── vendor/jszip.min.js   # 打包 .docx 依赖（已本地化）
│
├── api/                  # Vercel Serverless 函数（不入库敏感信息）
│   ├── login.js  me.js  logout.js  db.js  ai.js
│   └── _lib/            # auth.js（cookie 签名）/ cloud.js（云库代理）/ http.js
├── vercel.json           # Vercel 配置（静态 + 函数，/api 禁缓存）
└── .env.local            # 本地开发环境变量（gitignore，绝不入库）
```

三个页面共用 `base.css` / `common.js` / `api.js`，主题选择存在同一份 localStorage。

---

## 一、词汇本

| 功能 | 说明 |
| --- | --- |
| 单词卡 | 拼写、词性、中文释义、例句（自动高亮该词）、备注 |
| 点单词查词典 | 跳剑桥词典对应词条页 |
| 重复自动合并 | 同一个词再添加时，新例句追加到已有词条后，不覆盖原释义 |
| 只收原形 | 输入 `-ed / -ing / -s` 结尾会提示「建议填原形」 |
| 从句中选词 | 粘贴题面句子 → 拆词 → 点选 → 云端大模型自动给原形/词性/中文，原句当例句（管理员） |
| 背诵模式 | 英→中 / 中→英，认识/不认识计数；快捷键：空格 = 显示答案，1 = 不认识，2 = 认识 |
| 排序 | 时间 / 字典序 / 频率 / 随机，升降序可切 |
| 两种排版 | 「方块」多列卡片，或「列表」一行一个词 |
| 活跃度热力图 | GitHub 贡献图那种：每天新增单词数 + 背诵次数 |
| 导出 Word | 可选范围 / 排序 / 单栏或双栏速记排版 |
| 备份与导入 | JSON 导出；批量粘贴导入（`单词 \| 词性 \| 中文 \| 例句 \| 备注`） |
| AI 查中文 | 填单词自动查词性 + 中文释义（管理员） |

## 二、我的文章

仿 CSDN 的写作体验，三种视图切换（分栏 / 只编辑 / 只预览）：

| 功能 | 说明 |
| --- | --- |
| Markdown 编辑器 | 源码编辑 + 实时预览，预览区代码高亮、表格、引用、公式都渲染 |
| 工具栏 | H2/H3、加粗、斜体、删除线、行内代码、代码块、有序/无序列表、引用、表格、分割线、链接、图片、公式 |
| 快捷键 | `Ctrl+B` 加粗、`Ctrl+I` 斜体、`Ctrl+K` 插链接、`Ctrl+S` 存草稿 |
| 算法笔记模板 | 「模板」按钮一键插入：题目描述 / 思路 / 正确性说明 / 复杂度 / C++17 代码 / 踩坑记录 |
| 摘要与标签 | 摘要留空自动截取正文开头；标签逗号分隔，列表页可按标签筛选 |
| AI 辅助 | 接着往下写 / 润色 / 拟提纲 / 解释 / 写摘要 / 起标题，走云端大模型（管理员） |
| 草稿保护 | 编辑中内容实时存 localStorage |
| 阅读数 | 打开文章自动 +1 |

---

## 三、本地开发

```bash
# 1) 准备本地环境变量（从 .env.local 复制，或直接建一个，内容见下方「环境变量」）
# 2) 起本地服务器（托管静态文件 + 挂载 api/ 函数，模拟 Vercel）
node _dev.js            # 默认 http://127.0.0.1:8787
```

浏览器打开 <http://127.0.0.1:8787>，输入 `icpc` 进访客、`yqx` 进管理员。

---

## 四、环境变量（Vercel 上配置）

在 Vercel 项目 **Settings → Environment Variables** 里加这几项（**不要**提交进 Git）：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `VISITOR_PASSWORD` | `icpc` | 访客密码 |
| `ADMIN_PASSWORD` | `yqx` | 管理员密码 |
| `CLOUD_ENDPOINT` | `https://algorithm-wordbook.app.workbuddy.host` | 云库 endpoint |
| `CLOUD_KEY` | `wbpk_xxx` | 云库公开密钥（keyless） |
| `SESSION_SECRET` | 一段随机字符串 | 签名登录 Cookie 的密钥，请用 `openssl rand -base64 32` 生成 |

本地开发用 `.env.local`（已 gitignore），格式同上。

---

## 五、部署到 Vercel

1. 把仓库（Private）推到 GitHub
2. Vercel 里 **New Project → Import** 这个仓库
3. Framework Preset 选 **Other**（纯静态 + 函数，无需 build）
4. 在 **Environment Variables** 填好上面五项
5. Deploy。Vercel 会自动把根目录静态文件当站点、`api/*.js` 当 Serverless 函数
6. 部署完成后，把生成的 `*.vercel.app` 链接（或绑定的自定义域名）分享给别人

权限系统完全在服务端，访客拿不到也改不了任何写接口。

---

## 六、数据库

`db/schema.sql` 有完整建表语句（`words` + `notes`）。在 WorkBuddy 云数据库 SQL 控制台**逐条**执行：
建表 → `GRANT` → `CREATE POLICY`（漏 `GRANT` 会得到 42501）。

| 表 | 用途 |
| --- | --- |
| `words` | 词库：word(unique) / pos / meaning / examples(jsonb) / note |
| `notes` | 文章：title / content(Markdown) / summary / tags(jsonb) / category / views / top |

写操作现在由服务端 `/api/db` 统一入口 + RLS 双重保护；前端密码已移除，权限完全在服务端校。

---

## License

MIT
