# algorithm-wordbook

一个专门用来积累**算法竞赛英文单词**的在线单词本。例句全部来自 Codeforces / ICPC 原题，收录的单词按**原形**存储，重复添加会自动合并例句。

- 在线地址：<https://noorenduddy32-cpu.github.io/algorithm-wordbook/>
  （旧地址 <https://algorithm-wordbook.app.workbuddy.host/> 也还能开）
- 纯静态站点（HTML + CSS + 原生 JS + 一个 `words.json`），**没有后端、没有数据库**
- 词库就是仓库里的 `words.json`，每次增删改 = 往仓库提一个 commit（有完整的版本历史，随时可回滚）
- 任何人打开链接都能看；增删改需要「编辑模式」密码 + 一次 GitHub Token

---

## 功能一览

| 功能 | 说明 |
| --- | --- |
| 单词卡 | 拼写、**原词**、词性、中文释义、例句（自动高亮该词）、备注 |
| 点单词查词典 | 点卡片上的单词 → 直接跳到**剑桥词典**对应词条页（新标签打开） |
| 原词 | 记录题面/笔记里的原始形式，如 `indice`（原形 `index`）、`errands`（原形 `errand`），可搜索、会导出到 Word |
| 重复自动合并 | 同一个词再添加时，新例句追加到已有词条后面，不覆盖原释义 |
| 只收原形 | 输入 `-ed / -ing / -s` 结尾会提示「建议填原形」 |
| 粘贴自动去换行 | 从 PDF / 题面复制的句子常带一堆换行，粘贴时会自动并成一行（单词被连字符截断也会接回去） |
| 从句中选词 | 粘贴题面句子 → 拆成一个个词 → 点选 → 大模型自动给出原形 / 词性 / 中文释义，并把原句当例句 |
| 背诵模式 | 英→中 / 中→英，随机或顺序，认识 / 不认识计数（存本地），可按「只看生词」筛选；快捷键：空格 = 显示答案，1 = 不认识，2 = 认识 |
| **排序** | 最近添加 / 最早添加 / **频率降序（例句最多的排最前）** / 字典序 / 随机 |
| **两种排版** | 「方块」多列卡片，或「列表」一行一个单词（单词、词性、释义、例句摘要挤在一行，一屏能看更多词） |
| **隐藏中文 / 例句** | 工具栏上两个开关，点一下就把中文或例句遮住（中文是「藏起来」不是删掉，卡片高度不变），适合快速过词 |
| **收起导航栏** | 右上角「收起」把标题和统计栏折起来，只留一条细导航，屏幕一下子多出约 130px |
| **导出 Word** | 弹窗可选：范围（当前列表 / 全部 / 只生词）、排序（字典序 / 频率 / 时间 / 最近更新 / 随机）、**双栏速记**（省纸，不带例句）或单栏完整版，还能逐项勾要不要词性 / 备注 / 例句 / 原词 / 序号 |
| 备份与导入 | JSON 导出备份；批量粘贴导入（`单词 \| 词性 \| 中文 \| 例句 \| 备注 \| 原词`） |
| 权限 | 所有人只读；点右上角「编辑模式」输密码才能增删改 |
| **主题** | 7 套：夜间深色、日间亮色、**玻璃拟态（深/亮）**、**护眼米黄**、**护眼豆绿**、墨绿复古；右上角「主题」按钮里挑，记住你的选择 |

---

## 一、只想用现成的？

打开 <https://noorenduddy32-cpu.github.io/algorithm-wordbook/> 即可，不用装东西、不用注册。

要增删改：点右上角**「编辑模式」**输密码 → 再点**「设置」**填一次 GitHub Token（只存你本机浏览器）→ 之后就能正常增删改了。

---

## 二、自己搭一份

### 1. 准备文件

```bash
git clone https://github.com/noorenduddy32-cpu/algorithm-wordbook.git
cd algorithm-wordbook
cp config.example.js config.js      # Windows: copy config.example.js config.js
```

### 2. 改 `config.js`

```js
window.APP_CONFIG = {
  github: {
    owner: "你的 GitHub 用户名",      // 词库放哪个仓库
    repo: "你的仓库名",
    branch: "main",
    path: "words.json"
  },
  dataUrl: "",                       // 留空 = 读同目录下的 words.json
  editPassword: "改成你自己的密码",     // 解锁编辑模式的密码
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",
  docTitle: "algorithm-wordbook",
  llm: { endpoint: "", model: "" }   // 可选，见下
};
```

`dataUrl` 留空时读同目录的 `words.json`。想让多个站点共用同一份词库，可以填 jsDelivr 地址：

```js
dataUrl: "https://cdn.jsdelivr.net/gh/用户名/仓库名@main/words.json"
```

### 3. 起一个静态服务器

> ⚠️ **不要直接双击 `index.html`**。`file://` 下 `fetch` 读不到 `words.json`，页面会一直卡在「正在加载词库…」。必须走 `http://`。

```bash
python -m http.server 8080        # 或 npx serve -l 8080
```

然后浏览器打开 <http://localhost:8080>。

### 4. 发布上线

任何静态托管都行：**GitHub Pages**、Vercel、Netlify、对象存储……把整个目录传上去即可（记得带上 `config.js` 和 `words.json`）。

GitHub Pages 的做法：仓库 Settings → Pages → Source 选 `main` 分支根目录 → 等一两分钟，地址就是
`https://<用户名>.github.io/<仓库名>/`。想用自己的域名，在 Pages 设置里填 Custom domain，再到域名商加一条 CNAME 记录即可。

---

## 三、日常怎么用

### 加单词的三种方式

**① 手动添加**：点「+ 添加单词」，填拼写 / 原词 / 词性 / 中文 / 例句。

**② 从句中选词（推荐）**：

1. 点「从句中选词」，粘贴题面里的英文句子（换行会自动清掉）
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

### 权限与 Token

- **所有人**：查看、搜索、背诵、导出 Word（不需要密码）
- **只有你**：添加 / 编辑 / 删除 / 导入 —— 需要「编辑模式」密码 + 一个 GitHub Token

Token 在站点右上角**「设置」**里填，只存在你这台机器的浏览器 localStorage 里，**不会**写进仓库、不会上传。生成方式：
<https://github.com/settings/personal-access-tokens> → Fine-grained token → 只选这一个仓库 → 权限勾 **Contents: Read and write**。

> 前端密码是「防君子不防小人」：密码写在 `config.js` 里，别人看源码能看到。但即便知道密码，没有你的 GitHub Token 也改不动词库——真正的写权限在 Token 手里。

### 大模型（可选）

「从句中选词」的自动识别需要一个 OpenAI 兼容接口。在**「设置」**里填 API 地址 / 模型名 / API Key（同样只存本机浏览器），例如：

| 服务商 | API 地址 | 模型 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1/chat/completions` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash` |

不填也能用：手动添加、批量添加都正常，只是「识别」按钮会提示未配置。

### 排版、显隐与主题

- **方块 / 列表**：工具栏中间的「方块」「列表」切换。列表模式一行一个单词，例句只显示第一条摘要，想细看再切回方块。
- **隐藏中文 / 例句**：点一下就把那块内容遮住，再点恢复。藏中文时卡片高度不变（用 `visibility` 实现的），翻页不跳。
- **收起导航栏**：右上角「收起」，统计栏和站名都会折叠，只留操作按钮。
- **主题**：右上角「主题」下拉，7 套任选。玻璃拟态用了渐变背景 + `backdrop-filter` 毛玻璃，护眼两套是低对比米黄/豆绿，长时间看更舒服。

这几个选择都存在浏览器 localStorage 里，下次打开还在。

### 导出 Word

点「导出 Word」会先弹出选项：

| 选项 | 可选值 |
| --- | --- |
| 导出范围 | 当前列表（搜索/筛选结果）、全部单词、只导出生词 |
| 排序方式 | 字典序、频率降序、最近添加、最早添加、最近更新、随机 |
| 排版 | **双栏速记**（词+词性+释义，省纸）、单栏完整版 |
| 包含内容 | 中文释义、词性、备注、例句、原词、序号（逐项勾选） |

双栏模式默认不带例句，适合贴在墙上/打印出来快速扫；单栏带例句适合完整复习。文件名会带日期和「双栏」标记，例如 `algorithm-wordbook-20261002-双栏.docx`。

### 改密码 / 换词典

- 改密码：`config.js` 的 `editPassword`
- 换词典：`config.js` 的 `dictUrl`，站点会自动拼上 URL 编码后的单词，例如有道 `https://dict.youdao.com/result?word=`

---

## 四、数据结构（`words.json`）

```json
{
  "updated": "2026-10-02T12:00:00.000Z",
  "words": [
    {
      "id": 1,
      "word": "index",
      "pos": "n.",
      "meaning": "索引，下标（复数 indices / indexes）",
      "origin": "indice",
      "examples": ["there exists an index i such that ..."],
      "note": "原题笔记里写成 indice",
      "created_at": "2026-10-02T09:44:11.797Z"
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `word` | 原形，重复即触发例句合并 |
| `origin` | 原词（题面/笔记里的原始形式），可为空 |
| `pos` | 词性 |
| `meaning` | 中文释义 |
| `examples` | 例句数组 |
| `note` | 备注 |

---

## 五、目录结构

```
.
├── index.html            # 页面结构（单词本 / 背诵 / 各种弹窗）
├── styles.css            # 样式（7 套主题变量、方块/列表两种排版、移动端适配）
├── app.js                # 全部前端逻辑：增删改查、搜索排序、显隐与主题、背诵、AI 选词
├── docx.js               # 纯前端生成 .docx（OOXML + JSZip，支持单栏/双栏与可选列）
├── words.json            # 词库本体（增删改就是改这个文件）
├── config.js             # 站点配置（仓库 + 密码 + 词典）
├── config.example.js     # 配置模板
├── vendor/
│   └── jszip.min.js      # 打包 .docx 用的依赖（已本地化，离线可用）
└── seed/
    ├── seed.py           # 生成初始词库 SQL 的脚本
    └── seed.sql          # 初始单词（来自 CSDN《单词积累！》）
```

依赖只有一个：JSZip（已放进 `vendor/`，离线可用）。读写词库用的是浏览器原生 `fetch` + GitHub Contents API。

---

## 六、常见问题

**Q：页面一直显示「正在加载词库…」**
A：确认是用 `http://` 打开的（不是双击 `file://`）；再确认 `words.json` 和页面在同一个目录下、能被访问到。

**Q：点了保存提示 Token 没权限**
A：Token 需要**这一个仓库**的 **Contents: Read and write**（Fine-grained token 最容易漏勾 Write）。重新生成一个，在「设置」里覆盖填一次。

**Q：「从句中选词」点识别报错**
A：没配大模型。在「设置」里填 API 地址 / 模型名 / Key，或者手动填释义。

**Q：数据丢了怎么恢复**
A：词库在 Git 里，直接看仓库的 commit 历史就能回滚；另外「备份」按钮会导出 `wordbook-backup.json`，用「导入」可以整份导回。

**Q：导出 Word 打不开**
A：确认 `vendor/jszip.min.js` 存在且能访问到（404 会导出失败）。

---

## License

MIT
