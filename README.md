# algorithm-wordbook

一个专门用来积累**算法竞赛英文单词**的在线单词本。例句全部来自 Codeforces / ICPC 原题，收录的单词按**原形**存储，重复添加会自动合并例句。

- 在线地址：<https://algorithm-wordbook.app.workbuddy.host/>
- 纯前端静态站点（HTML + CSS + 原生 JS），无需后端服务器
- 数据存在云数据库，永久保存；链接发给谁谁都能查看，增删改需要密码

---

## 功能一览

| 功能 | 说明 |
| --- | --- |
| 单词卡 | 拼写、**原词**、词性、中文释义、例句（自动高亮该词）、备注 |
| 点单词查词典 | 点卡片上的单词 → 直接跳到**剑桥词典**对应词条页（新标签打开） |
| 原词 | 记录题面/笔记里的原始形式，如 `indice`（原形 `index`）、`errands`（原形 `errand`），可搜索、会导出到 Word |
| 重复自动合并 | 同一个词再添加时，新例句追加到已有词条后面，不覆盖原释义 |
| 只收原形 | 输入 `-ed / -ing / -s` 结尾会提示「建议填原形」 |
| 从句中选词 | 粘贴题面句子 → 拆成一个个词 → 点选 → 云端大模型自动给出原形 / 词性 / 中文释义，并把原句当例句 |
| 背诵模式 | 英→中 / 中→英，随机或顺序，认识 / 不认识计数（存本地），可按「只看生词」筛选；快捷键：空格 = 显示答案，1 = 不认识，2 = 认识 |
| 导出 Word | 一键生成真正的 `.docx`（表格：序号 / 单词 / 词性 / 中文 / 例句），按字母序排好 |
| 备份与导入 | JSON 导出备份；批量粘贴导入（`单词 \| 词性 \| 中文 \| 例句 \| 备注 \| 原词`） |
| 权限 | 所有人只读；点右上角「编辑模式」输密码才能增删改 |
| 主题 | 深浅色一键切换，手机浏览器做了基础适配 |

---

## 一、只想用现成的？

直接打开 <https://algorithm-wordbook.app.workbuddy.host/> 就行，不需要装任何东西、不需要注册账号，手机电脑浏览器都能开。

想增删改就点右上角**「编辑模式」**输入密码。

---

## 二、自己跑一份（本地 / 自己的服务器）

### 1. 准备文件

```bash
git clone https://github.com/noorenduddy32-cpu/algorithm-wordbook.git
cd algorithm-wordbook
```

### 2. 生成配置文件

仓库里**故意不带** `config.js`（里面有密码和站点密钥），只给了模板：

```bash
# macOS / Linux
cp config.example.js config.js

# Windows（CMD 或 PowerShell）
copy config.example.js config.js
```

然后打开 `config.js`，填三项：

```js
window.APP_CONFIG = {
  endpoint: "https://你的应用域名",          // 云服务给你的站点地址
  publishableKey: "wbpk_xxxxxxxxxxxx",     // 云服务的公开密钥（publishableKey）
  editPassword: "改成你自己的密码",           // 解锁编辑模式的密码
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",
  docTitle: "algorithm-wordbook"
};
```

`endpoint` 和 `publishableKey` 来自云服务创建应用后生成的 `publicConfig`，直接复制粘贴即可。

### 3. 起一个静态服务器

> ⚠️ **不要直接双击 `index.html`**。`file://` 协议下云服务 SDK 的跨域请求会被浏览器拦掉，页面会一直卡在「正在连接词库…」。必须走 `http://`。

任选一种：

```bash
# Python（自带，推荐）
python -m http.server 8080

# Node.js
npx serve -l 8080
# 或
npx http-server -p 8080

# VS Code：装 Live Server 插件，右键 index.html → Open with Live Server
```

然后浏览器打开 <http://localhost:8080>。

### 4. 建数据库表

在你自己的云数据库（PostgreSQL）里**逐条**执行 `db/schema.sql` 里的语句——它会建出 `words` 表并配好读写策略。

字段含义：

| 字段 | 说明 |
| --- | --- |
| `word` | 原形，唯一键，重复即触发例句合并 |
| `origin` | 原词（题面/笔记里的原始形式），可为空 |
| `pos` | 词性 |
| `meaning` | 中文释义 |
| `examples` | `jsonb` 数组，例句列表 |
| `note` | 备注 |

想导入本项目自带的 44 个初始单词，再执行 `seed/seed.sql`（来源：CSDN 博客《单词积累！》，已整理成原形 + 例句）。想改种子内容就编辑 `seed/seed.py` 后重新运行：

```bash
python seed/seed.py    # 重新生成 seed.sql
```

### 5. 发布上线

任何静态托管都能放：GitHub Pages、Vercel、Netlify、腾讯云 COS 静态网站、对象存储……把整个目录传上去即可。

注意发布目录要**包含 `config.js`**（本地那份），并且站点域名要和 `config.js` 里的 `endpoint` 一致，否则读不到数据。

---

## 三、日常怎么用

### 加单词的三种方式

**① 手动添加**：点「+ 添加单词」，填拼写 / 原词 / 词性 / 中文 / 例句。

**② 从句中选词（推荐）**：

1. 点「从句中选词」，粘贴题面里的英文句子
2. 点「拆分」，句子被拆成一个个词（默认隐藏 the/of/and 这类基础词；已收录的会标出来）
3. 点选你要收集的词
4. 点「识别」→ 自动给出原形 / 词性 / 中文释义，并把原句当例句；你在句子里点的原始形式会自动记到「原词」
5. 结果是一张可编辑的表，改完点「确认加入」

**③ 批量粘贴**：点「批量添加」，每行一个单词：

```
submit | v. | 提交 | He submitted the code at 1:59.
greedy | adj. | 贪心的 | a greedy algorithm
indices | n. | 索引（复数） | all indices 1<=j<i |  | index
```

最后一列是「原词」，`indices` 的原形是 `index`，这样填就不会重复建词条。

### 权限

- **所有人**：查看、搜索、背诵、导出 Word（不需要密码）
- **只有你**：添加 / 编辑 / 删除 / 导入 —— 点右上角「编辑模式」输入 `config.js` 里的 `editPassword`

> 前端密码校验是「防君子不防小人」——密码写在前端文件里，理论上别人查看网页源码能看到。这是纯前端项目的固有限制。想更严格就自己加一个后端鉴权。

### 改密码

改 `config.js` 里的 `editPassword` 一行，重新发布即可。

### 换词典

改 `config.js` 里的 `dictUrl`，例如换成有道：

```js
dictUrl: "https://dict.youdao.com/result?word=",
dictUrl: "https://www.collinsdictionary.com/zh/search/english-chinese-simplified/?q=",
```

站点会自动在后面拼上 URL 编码后的单词。

---

## 四、目录结构

```
.
├── index.html            # 页面结构（单词本 / 背诵 / 各种弹窗）
├── styles.css            # 样式（含深色主题、移动端适配）
├── app.js                # 全部前端逻辑：增删改查、搜索、背诵、AI 选词
├── docx.js               # 纯前端生成 .docx（OOXML + JSZip，无服务器）
├── config.js             # 站点配置（含密码，不入库）
├── config.example.js     # 配置模板
├── vendor/
│   └── jszip.min.js      # 打包 .docx 用的依赖（已本地化，离线可用）
├── db/
│   └── schema.sql        # 建表语句（含 RLS 策略）
└── seed/
    ├── seed.py           # 生成初始词库 SQL 的脚本
    └── seed.sql          # 44 个初始单词（来自 CSDN《单词积累！》）
```

依赖只有两个：JSZip（已放进 `vendor/`，离线可用）和 WorkBuddy 云服务 SDK（CDN 引入，用于读写云数据库和调用大模型）。

---

## 五、常见问题

**Q：页面一直显示「正在连接词库…」**
A：检查 `config.js` 的 `endpoint` 和 `publishableKey` 对不对、站点域名是否一致；再确认是用 `http://` 打开的而不是双击 `file://`。

**Q：点了「添加单词」没反应 / 弹窗关不掉**
A：新版已修复（`[hidden]` 全局兜底规则）。如果遇到，先刷新页面。

**Q：导出 Word 打不开**
A：确认 `vendor/jszip.min.js` 存在且能被访问到（404 会导出失败）。

**Q：「从句中选词」点识别报错**
A：这个功能调用的是应用绑定的云端大模型。自建时需要在云服务里为该应用开启 LLM 能力；没开就只能用手动添加和批量添加。

**Q：数据丢了怎么恢复**
A：「备份」按钮会导出 `wordbook-backup.json`，用「导入」可以整份导回。建议每隔一段时间备份一次。

---

## License

MIT
