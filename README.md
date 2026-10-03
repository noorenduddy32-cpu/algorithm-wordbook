# 算法学习笔记本

个人算法学习用的在线笔记本，两块内容：

1. **算法词汇本** —— Codeforces / ICPC 高频词，按原形收录，配词性、中文释义和原题例句
2. **我的文章** —— Markdown 编辑器写题解、思路复盘、模板与踩坑记录

纯静态站点（HTML + CSS + 原生 JS），**没有后端**。单词和文章都存在 WorkBuddy 云数据库（PostgreSQL），
任何人拿到链接都能查看；增删改需要「编辑模式」密码，**不需要 GitHub Token，也不需要任何 API Key**。

- 在线地址：<https://algorithm-wordbook.app.workbuddy.host/>
- 仓库：<https://github.com/noorenduddy32-cpu/algorithm-wordbook>

> ⚠️ **为什么主站不是 github.io**：云端数据库只允许**同源**访问
> （`Access-Control-Allow-Origin` 只放行 `https://algorithm-wordbook.app.workbuddy.host`）。
> 站点部署在 `*.github.io` 时，浏览器的 CORS 预检会被 403 拒绝，页面就显示「云端未连接」、单词数为 0。
> 所以站点本身也发布在 WorkBuddy 上，和数据库同源。GitHub Pages 版仅作源码镜像。

---

## 目录结构

```
.
├── index.html            # 主页：站名 + 两个入口（词汇本 / 文章）+ 统计 + 最近文章
├── base.css              # 公共层：7 套主题变量、顶栏、按钮、卡片、弹窗、toast
├── common.js             # 公共层：主题切换 / toast / 弹窗 / 编辑密码 / 顶栏渲染 / 云端连接
├── home.css / home.js    # 主页样式与逻辑
│
├── wordbook.html         # 单词本（原 index.html，功能未改动，只加了返回主页的导航）
├── styles.css            # 单词本样式（方块/列表两种排版、活跃度热力图、移动端适配）
├── app.js                # 单词本全部逻辑：增删改查、搜索排序、显隐、背诵、AI 选词
├── docx.js               # 纯前端生成 .docx（OOXML + JSZip）
│
├── notes.html            # 文章模块：列表 / 阅读 / 编辑器（同一页切换视图）
├── notes.css             # 文章模块样式（含 Markdown 渲染排版）
├── notes.js              # 文章模块逻辑：CRUD、Markdown 渲染、工具栏、AI 辅助
│
├── assets/logo.png       # 站点图标（ICPC 云朵 / 灯泡 / 气球，透明底）
├── config.js             # 站点配置（密码 + 词典 + 云端 endpoint，**不入库**）
├── config.example.js     # 配置模板（入库）
├── db/schema.sql         # 建表 SQL 参考（words + notes）
├── vendor/jszip.min.js   # 打包 .docx 用的依赖（已本地化，离线可用）
└── seed/                 # 初始词库种子数据
```

三个页面共用 `base.css` / `common.js`，主题选择和解锁状态存在同一份 localStorage
（`wb_theme_v2` / `wb_edit_unlocked`），在页面之间跳来跳去不会重置。

---

## 一、词汇本

| 功能 | 说明 |
| --- | --- |
| 单词卡 | 拼写、词性、中文释义、例句（自动高亮该词）、备注 |
| 点单词查词典 | 跳剑桥词典对应词条页 |
| 重复自动合并 | 同一个词再添加时，新例句追加到已有词条后，不覆盖原释义 |
| 只收原形 | 输入 `-ed / -ing / -s` 结尾会提示「建议填原形」 |
| 从句中选词 | 粘贴题面句子 → 拆词 → 点选 → 云端大模型自动给原形/词性/中文，原句当例句 |
| 背诵模式 | 英→中 / 中→英，认识/不认识计数；快捷键：空格 = 显示答案，1 = 不认识，2 = 认识 |
| 排序 | 时间 / 字典序 / 频率（例句多的排前面）/ 随机，升降序可切 |
| 两种排版 | 「方块」多列卡片，或「列表」一行一个词 |
| 隐藏中文 / 例句 | 点一下遮住（不是删掉，卡片高度不变），适合快速过词 |
| 活跃度热力图 | GitHub 贡献图那种：每天新增单词数 + 背诵次数 |
| 导出 Word | 可选范围 / 排序 / 单栏或双栏速记排版，逐项勾选要哪些列 |
| 备份与导入 | JSON 导出备份；批量粘贴导入（`单词 \| 词性 \| 中文 \| 例句 \| 备注`） |

## 二、我的文章

仿 CSDN 的写作体验，三种视图切换（分栏 / 只编辑 / 只预览）：

| 功能 | 说明 |
| --- | --- |
| Markdown 编辑器 | 源码编辑 + 实时预览，预览区代码高亮、表格、引用、公式都渲染 |
| 工具栏 | H2/H3、加粗、斜体、删除线、行内代码、代码块、有序/无序列表、引用、表格、分割线、链接、图片、公式 |
| 快捷键 | `Ctrl+B` 加粗、`Ctrl+I` 斜体、`Ctrl+K` 插链接、`Ctrl+S` 存草稿 |
| 算法笔记模板 | 「模板」按钮一键插入：题目描述 / 思路 / 正确性说明 / 复杂度 / C++17 代码 / 踩坑记录 |
| 摘要与标签 | 摘要留空会自动截取正文开头；标签逗号分隔，列表页可按标签筛选 |
| AI 辅助 | 接着往下写 / 润色选中段 / 拟提纲 / 解释选中段 / 写摘要 / 起标题，走云端大模型 |
| 草稿保护 | 编辑中内容实时存 localStorage，意外关页再回来还在 |
| 阅读数 | 打开文章自动 +1 |

---

## 三、本地跑

> ⚠️ 不要直接双击 `index.html`。`file://` 下浏览器会拦截模块加载，必须走 `http://`。

```bash
cp config.example.js config.js      # Windows: copy config.example.js config.js
python -m http.server 8080
```

然后打开 <http://localhost:8080>。

## 四、改配置

`config.js`（**不要提交到 Git**）：

```js
window.APP_CONFIG = {
  editPassword: "改成你自己的密码",   // 解锁编辑模式的密码
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",
  docTitle: "算法学习笔记本",
  cloud: {
    endpoint: "https://algorithm-wordbook.app.workbuddy.host",
    publishableKey: "wbpk_xxx"        // keyless 公开密钥，可入库
  }
};
```

- 改编辑密码：改 `editPassword`，改完重新部署
- 换词典：改 `dictUrl`，站点会自动拼上 URL 编码后的单词

## 五、数据库

`db/schema.sql` 里有完整建表语句（`words` + `notes`）。在 WorkBuddy 云数据库 SQL 控制台**逐条**执行，
顺序是：建表 → `GRANT` → `CREATE POLICY`，缺一不可（漏 `GRANT` 会得到形似策略失效的 42501）。

| 表 | 用途 |
| --- | --- |
| `words` | 词库：word(unique) / pos / meaning / examples(jsonb) / note |
| `notes` | 文章：title / content(Markdown) / summary / tags(jsonb) / category / views / top |

两张表都是公开可读、公开可写（RLS 全开），写操作靠前端密码兜底。

> ⚠️ 纯前端密码是「防君子不防小人」：密码写在 `config.js` 里，看源码就能拿到。
> 它的作用是「不让人随手改坏我的词库」，不是加密。真要严格权限得上带鉴权的后端。

---

## License

MIT
