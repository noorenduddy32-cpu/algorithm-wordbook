/* ============================================================
   notes.js —— 题解与算法：列表 / 阅读 / CSDN 风格富文本编辑器 / AI 辅助
   依赖：common.js(AN)、marked、DOMPurify、highlight.js
   - 正文以 HTML 存储（不再用 Markdown 源码），仿 CSDN 所见即所得
   - 从别处复制的题面 / 博客会原样保真（拦截粘贴、消毒后插入）
   - 代码块带行号、超 10 行可收起、过宽可换行
   ============================================================ */
(function () {
  'use strict';

  const $ = AN.$;
  const esc = AN.esc;
  const isAdmin = function () { return window.AN_ROLE === 'admin'; };

  AN.boot({
    title: '题解与算法',
    subtitle: '题解 · 思路复盘 · 模板 · 踩坑记录',
    active: 'notes',
    nav: [
      { key: 'home', label: '首页', href: 'index.html', icon: AN.ICONS.home },
      { key: 'wordbook', label: '词汇', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '笔记', href: 'notes.html', icon: AN.ICONS.pen },
      { key: 'visits', label: '访问记录', href: 'visits.html', icon: AN.ICONS.file, adminOnly: true }
    ]
  });

  const LS_MODE = 'an_note_mode_v1';

  let all = [];
  let editing = null;
  let mode = 'edit';
  let listTab = 'published';   // published | draft
  let readOnly = false;
  let activeTopic = '';
  let editorEpoch = 0;
  let tocObserver = null;
  let saveInProgress = false;

  // 分栏（看板）状态
  let viewMode = localStorage.getItem('an_note_view') || 'grid';    // grid | list | board
  let colOrder = [];   // 自定义栏顺序（localStorage）
  let listCols = localStorage.getItem('an_note_cols') || 'auto';    // 方块模式每行个数
  let sortMode = localStorage.getItem('an_note_sort') || 'updated';    // time(创建) | updated(修改) | views(浏览)
  let sortDir = localStorage.getItem('an_note_sortdir') || 'desc';  // asc | desc
  const selected = new Set();     // 导出 Word 时勾选的笔记 id
  let draggedId = null;

  const LS_VIEW = 'an_note_view';
  const LS_COLS = 'an_note_column_order';
  colOrder = loadColOrder();

  /* ---------------- 内置常用标签库（新建笔记时直接点选） ---------------- */
  // 分类罗列算法竞赛常见名词：动态规划 / 图论 / 数论 / 字符串 / 数据结构 / 数学
  // 搜索枚举 / 贪心构造思维 / 博弈 / 语言实现 / 比赛难度。用户后续可自行挑选删减。
  const TAG_LIBRARY = [
    { cat: '动态规划', items: [
      '动态规划','线性DP','区间DP','树形DP','状压DP','数位DP','背包DP','背包','计数DP','概率DP','期望DP',
      '博弈DP','插头DP','轮廓线DP','斜率优化','单调队列优化','四边形不等式','矩阵加速','记忆化搜索',
      '最长上升子序列','最长公共子序列','编辑距离','序列DP','换根DP'
    ]},
    { cat: '图论', items: [
      '图论','最短路','Dijkstra','Bellman-Ford','SPFA','Floyd','最小生成树','Kruskal','Prim','次小生成树',
      '生成树','拓扑排序','差分约束','强连通分量','缩点','Tarjan','双连通分量','点双连通','边双连通',
      '割点','桥','2-SAT','LCA','树上倍增','倍增','树链剖分','重链剖分','虚树','欧拉回路','欧拉路径',
      '哈密顿回路','网络流','最大流','最小割','费用流','上下界网络流','二分图匹配','匈牙利算法','最大权匹配',
      'KM算法','二分图','一般图匹配','带花树','最短路计数','同余最短路'
    ]},
    { cat: '数论', items: [
      '数论','素数筛','埃氏筛','欧拉筛','线性筛','欧拉函数','素因数分解','同余','扩展欧几里得','裴蜀定理',
      '中国剩余定理','同余方程','逆元','费马小定理','欧拉定理','快速幂','矩阵快速幂','大步小步','BSGS',
      '原根','高斯消元','行列式','莫比乌斯反演','莫比乌斯函数','狄利克雷卷积','杜教筛','米勒拉宾','素性测试',
      'Pollard-Rho','卢卡斯定理','威尔逊定理','卡特兰数','容斥原理','整除分块','类欧几里得'
    ]},
    { cat: '字符串', items: [
      '字符串','KMP','字符串哈希','哈希','前缀函数','扩展KMP','Manacher','回文自动机','回文树','Trie',
      '字典树','AC自动机','自动机','后缀数组','后缀自动机','后缀树','Z函数','后缀LCP','字符串匹配','最小表示法'
    ]},
    { cat: '数据结构', items: [
      '数据结构','栈','队列','链表','数组','堆','优先队列','二叉堆','单调栈','单调队列','线段树','树状数组',
      '分块','莫队','平衡树','Treap','无旋Treap','Splay','红黑树','替罪羊树','主席树','可持久化',
      '可持久化线段树','并查集','线段树合并','线段树分裂','笛卡尔树','左偏树','可并堆','树套树','二维线段树',
      '猫树','二进制分组','珂朵莉树','划分树','跳跃表','ST表','根号平衡'
    ]},
    { cat: '数学', items: [
      '数学','组合数学','排列组合','二项式定理','生成函数','斯特林数','第一类斯特林数','第二类斯特林数',
      '伯努利数','多项式','FFT','NTT','FWT','快速傅里叶变换','线性代数','矩阵','概率','期望','单纯形',
      '线性规划','凸包','旋转卡壳','计算几何','向量','点积','叉积','扫描线','半平面交','辛普森积分','数值积分','几何'
    ]},
    { cat: '搜索 / 枚举', items: [
      '搜索','DFS','BFS','回溯','剪枝','迭代加深','IDA*','A*','双向搜索','启发式搜索','状态压缩','位运算','枚举'
    ]},
    { cat: '贪心 / 构造 / 思维', items: [
      '贪心','构造','思维','模拟','二分','二分答案','分治','CDQ分治','整体二分','离线','双指针','滑动窗口',
      '前缀和','差分','离散化','规律','找规律','三分'
    ]},
    { cat: '博弈', items: [
      '博弈','Nim','SG函数','巴什博弈','威佐夫博弈','阶梯博弈','公平组合游戏','博弈论'
    ]},
    { cat: '语言 / 实现', items: [
      'C++','Python','Java','模板','STL','语法','调试','输入输出','快读','高精度','对拍','随机数','构造函数'
    ]},
    { cat: '比赛 / 难度', items: [
      'Codeforces','AtCoder','ICPC','蓝桥杯','洛谷','牛客','CF','div1','div2','NOIP','NOI','省选',
      '入门','提高','普及组','提高组','CF1900','CF2100','CF2200','CF2300','CF2400'
    ]}
  ];
  // 去重：同一标签只保留首次出现的分类
  (function dedupeTagLibrary() {
    const seen = {};
    TAG_LIBRARY.forEach(function (g) {
      g.items = g.items.filter(function (t) { if (seen[t]) return false; seen[t] = true; return true; });
    });
  })();

  function loadColOrder() {
    try {
      const a = JSON.parse(localStorage.getItem(LS_COLS) || localStorage.getItem('an_note_cols') || 'null');
      return Array.isArray(a) ? a : [];
    }
    catch (e) { return []; }
  }
  function saveColOrder() { try { localStorage.setItem(LS_COLS, JSON.stringify(colOrder)); } catch (e) {} }

  /* ---------------- 访问统计 ---------------- */
  let visitStart = Date.now();
  let visitNoteId = null;
  let visitNoteTitle = '';

  function reportVisit(duration, noteId, noteTitle) {
    duration = Math.max(0, Math.round((duration || 0) / 1000));
    const payload = JSON.stringify({
      path: location.pathname + location.search,
      note_id: noteId || null,
      note_title: noteTitle || '',
      duration: duration
    });
    const url = location.origin + '/api/visits';
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
      }
    } catch (e) {}
  }

  function startVisit(noteId, noteTitle) {
    const now = Date.now();
    if (visitNoteId !== null && visitNoteId !== noteId) {
      reportVisit(now - visitStart, visitNoteId, visitNoteTitle);
    }
    visitStart = now;
    visitNoteId = noteId;
    visitNoteTitle = noteTitle || '';
  }

  const md = window.marked || null;
  if (md && md.use) {
    md.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
    const r = new md.Renderer();
    r.code = function (code, lang) {
      let c = String(code || '');
      let l = (lang || '').match(/\S*/);
      l = l && l[0] ? l[0] : '';
      let hl = '';
      try {
        if (window.hljs && l && hljs.getLanguage(l)) hl = hljs.highlight(c, { language: l, ignoreIllegals: true }).value;
        else if (window.hljs) hl = hljs.highlightAuto(c).value;
        else hl = AN.esc(c);
      } catch (e) { hl = AN.esc(c); }
      return '<pre class="md-code"><code class="hljs' + (l ? ' language-' + l : '') + '">' + hl + '</code></pre>';
    };
    md.use({ renderer: r });
  }

  /* ---------------- 内容渲染 ---------------- */

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
  }
  function stripHtml(s) {
    return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-zA-Z#0-9]+;/g, ' ');
  }
  function countWords(html) {
    const t = stripHtml(html).replace(/\s+/g, ' ').trim();
    return t ? t.length : 0;
  }
  function autoSummary(html, n) {
    n = n || 90;
    const t = stripHtml(html).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  // 旧笔记可能是 Markdown：含块级 HTML 标签就当 HTML，含 Markdown 标记就转 HTML，否则当纯文本
  function toHtml(content) {
    const s = String(content || '');
    if (/<(p|div|h[1-6]|pre|ul|ol|table|blockquote|img|a|code|span|b|i|strong|em|br|hr|li)\b/i.test(s)) return s;
    if (/^#{1,6}\s|```|\n>\s|\n[-*]\s|\n\d+\.\s|\[[^\]]+\]\(|\n\s*\|/.test(s)) {
      return md ? md.parse(s) : '<p>' + esc(s) + '</p>';
    }
    return '<p>' + esc(s) + '</p>';
  }

  const PURIFY = {
    ADD_TAGS: [ 'font', 'section', 'figure', 'figcaption', 'picture', 'source', 'details', 'summary'],
    ADD_ATTR: ['style', 'target', 'align', 'loading', 'controls', 'colspan', 'rowspan', 'cellspacing', 'cellpadding'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'contenteditable']
  };
  function sanitizeHtml(s) {
    if (window.DOMPurify) return DOMPurify.sanitize(s, PURIFY);
    return '<p>' + esc(s) + '</p>';
  }

  // 渲染正文（HTML 消毒 + 标题锚点 + 代码块增强）
  function renderContent(html) {
    return sanitizeHtml(String(html || ''));
  }

  function readingMinutes(content) {
    const plain = stripHtml(content);
    const chinese = (plain.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (plain.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
    return Math.max(1, Math.ceil(chinese / 400 + words / 220));
  }

  function stopReaderOutline() {
    if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
  }

  function updateReaderOutline() {
    stopReaderOutline();
    const outline = $('readerOutline'), nav = $('readerToc');
    nav.replaceChildren();
    const headings = Array.from($('edPreview').querySelectorAll('h1,h2,h3'));
    outline.hidden = !readOnly || !headings.length;
    if (outline.hidden) return;
    outline.open = window.innerWidth > 1100;
    headings.forEach(function (heading, index) {
      heading.id = 'note-section-' + (index + 1);
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent || '未命名章节';
      link.className = 'toc-link toc-level-' + heading.tagName.slice(1);
      if (!index) link.setAttribute('aria-current', 'location');
      link.addEventListener('click', function (e) {
        e.preventDefault();
        heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        nav.querySelectorAll('a').forEach(function (a) { a.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'location');
      });
      nav.appendChild(link);
    });
    if (window.IntersectionObserver) {
      tocObserver = new IntersectionObserver(function (entries) {
        const current = entries.find(function (entry) { return entry.isIntersecting; });
        if (!current) return;
        nav.querySelectorAll('a').forEach(function (a) {
          if (a.hash === '#' + current.target.id) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      }, { rootMargin: '-80px 0px -65% 0px' });
      headings.forEach(function (heading) { tocObserver.observe(heading); });
    }
  }

  // 把 <code>（可能含 contenteditable 产生的嵌套 div/p）还原成带换行的纯文本
  function codeText(el) {
    let out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) out += n.nodeValue || '';
      else if (n.nodeName === 'BR') out += '\n';
      else if (n.nodeType === 1) {
        const tag = n.nodeName.toLowerCase();
        const inner = codeText(n);
        out += (tag === 'div' || tag === 'p' || tag === 'li') ? (inner + '\n') : inner;
      }
    });
    return out;
  }

  // 复制文本到剪贴板（优先 navigator.clipboard 异步 API，失败降级到 execCommand）
  function copyToClipboard(text, btn) {
    const mark = function () {
      if (!btn) return;
      btn.classList.add('copied');
      btn.title = '已复制'; btn.setAttribute('aria-label', '代码已复制');
      const label = btn.querySelector('span'); if (label) label.textContent = '已复制';
      setTimeout(function () {
        btn.classList.remove('copied'); btn.title = '复制代码'; btn.setAttribute('aria-label', '复制代码');
        if (label) label.textContent = '复制';
      }, 1800);
    };
    const fallback = function () {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { if (document.execCommand('copy')) mark(); else AN.toast('复制失败，请选中代码手动复制', true); } catch (e) { AN.toast('复制失败，请选中代码手动复制', true); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(mark).catch(fallback);
    } else {
      fallback();
    }
  }

  // 代码块增强：行号 + 超 10 行收起 + 过宽换行
  function enhanceCodeBlocks(root) {
    (root || document).querySelectorAll('pre').forEach(function (pre) {
      if (pre.dataset.enh) return;
      pre.dataset.enh = '1';
      const code = pre.querySelector('code') || pre;
      const raw = codeText(code).replace(/\n+$/, '').replace(/^\n+/, '');
      code.textContent = raw;   // 规整为带换行的纯文本，配合 white-space:pre 正常显示
      const lines = raw.split('\n');
      let lang = (code.className.match(/language-([\w+-]+)/) || [])[1] ||
        (pre.className.match(/lang-([\w+-]+)/) || [])[1] || 'code';
      if (window.hljs && lang !== 'code' && !code.classList.contains('hljs')) {
        try { code.className = 'language-' + lang; window.hljs.highlightElement(code); } catch (e) {}
      }
      const gutter = lines.map(function (_, i) { return '<div class="ln">' + (i + 1) + '</div>'; }).join('');
      const codeClass = code.className || ('language-' + lang);
      const codeLines = code.innerHTML.split('\n').map(function (html) { return '<div class="code-line">' + html + '</div>'; }).join('');
      const copyIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/></svg>';
      // 自动换行开关图标：关闭状态（当前不折行）= 右箭头；打开状态（当前已折行）= 回折箭头
      const wrapOffIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14"/><path d="M20 5v14"/><path d="M8 12h8"/><path d="M14 12l-3 3"/><path d="M14 12l-3-3"/></svg>';
      const wrapOnIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14"/><path d="M20 5v14"/><path d="M16 9H9.5a2.5 2.5 0 0 0 0 5H16"/><path d="M12 7l-3 3 3 3"/></svg>';
      const chevronDown = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      const chevronUp = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
      const bar = '<div class="code-bar"><span class="code-lang">' + esc(lang) + '</span>' +
        '<span class="code-btns">' +
        '<button type="button" class="code-wrap" title="打开自动换行" aria-label="打开自动换行" contenteditable="false">' + wrapOffIcon + '</button>' +
        '<button type="button" class="code-copy" title="复制代码" aria-label="复制代码" contenteditable="false">' + copyIcon + '<span>复制</span></button>' +
        '</span></div>';
      const bottomBar = lines.length > 10 ? '<div class="code-bottom-bar"><button type="button" class="code-toggle" contenteditable="false">' +
        '<span>展开</span>' + chevronDown + '</button></div>' : '';
      const area = '<div class="code-area"><div class="ln-gutter">' + gutter + '</div><code class="' + esc(codeClass) + '">' + codeLines + '</code></div>';
      pre.className = (pre.className + ' code-enh').trim();
      pre.innerHTML = bar + area + bottomBar;
      if (lines.length > 10) pre.classList.add('collapsed');
      const toggleBtn = pre.querySelector('.code-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          pre.classList.toggle('expanded');
          const expanded = pre.classList.contains('expanded');
          toggleBtn.querySelector('span').textContent = expanded ? '收起' : '展开';
          const svg = toggleBtn.querySelector('svg');
          if (svg) svg.outerHTML = expanded ? chevronUp : chevronDown;
        });
      }
      pre.querySelectorAll('.code-wrap').forEach(function (b) {
        b.addEventListener('click', function () {
          pre.classList.toggle('wrapped');
          const wrapped = pre.classList.contains('wrapped');
          b.classList.toggle('active', wrapped);
          b.title = wrapped ? '关闭自动换行' : '打开自动换行';
          b.setAttribute('aria-label', wrapped ? '关闭自动换行' : '打开自动换行');
          b.innerHTML = wrapped ? wrapOnIcon : wrapOffIcon;
        });
      });
      pre.querySelectorAll('.code-copy').forEach(function (b) {
        b.addEventListener('click', function () {
          const text = codeText(code).replace(/\n+$/, '').replace(/^\n+/, '');
          copyToClipboard(text, b);
        });
      });
    });
  }

  /* ---------------- 数据 ---------------- */

  // 缓存显示：仅登录后触发（未登录不渲染，避免未授权泄露本地缓存）
  function renderNotesCache() {
    if (!window.Auth || !window.Auth.role) return;
    try {
      const cached = NoteCache.get('notes');
      if (cached && cached.length) {
        all = visibleRecords(cached);
        const tab = $('notesTabs'); if (tab) tab.hidden = !isAdmin();
        if (!isAdmin()) listTab = 'published';
        renderView();
      }
    } catch (e) {}
  }

  function visibleRecords(rows) {
    return rows.filter(function (x) { return isAdmin() || (x.status === 'published' && x.visibility === 'public'); });
  }

  async function loadAll() {
    const role = Auth.role;
    const db = AN.getDb();
    if (!db) {
      $('notesSub').textContent = '云端未连接：请确认能联网加载云端 SDK';
      $('noteList').innerHTML = '<p class="muted" style="padding:30px 0">读不到数据，刷新页面重试。</p>';
      return;
    }
    // 先用本地缓存秒显，消除切换页面时的一秒空白
    try {
      const cached = NoteCache.get('notes');
      if (cached && cached.length) {
        all = visibleRecords(cached);
        $('notesTabs').hidden = !isAdmin();
        if (!isAdmin()) listTab = 'published';
        renderView();
      }
    } catch (e) {}
    const { data, error } = await db.from('notes').select('*').order('updated_at', { ascending: false });
    if (Auth.role !== role) return;
    if (error) {
      $('notesResult').textContent = '笔记暂时无法加载';
      $('notesSub').textContent = '读取失败，请刷新重试。' + (error.message || '');
      return;
    }
    all = visibleRecords(data || []);
    NoteCache.set('notes', all);
    $('notesTabs').hidden = !isAdmin();
    // 非管理员只看已发布
    if (!isAdmin()) listTab = 'published';
    renderView();
    openHashNote();
  }

  function updateSub() {
    $('notesSub').textContent = isAdmin() ? '题解、模板与复盘，记录属于你的思考过程。' : '公开分享的题解与算法，留住每一次思考的线索。';
    $('publishedCount').textContent = all.filter(function (n) { return n.status === 'published'; }).length;
    $('draftCount').textContent = all.filter(function (n) { return (n.status || 'draft') === 'draft'; }).length;
    $('notesResult').textContent = getFiltered().length + ' 篇' + (activeTopic ? ' · ' + activeTopic : '笔记');
    renderTopicFilters();
  }

  function scopeNotes() {
    return all.filter(function (n) {
      return isAdmin() ? (n.status || 'draft') === listTab : n.status === 'published' && n.visibility === 'public';
    });
  }

  function renderTopicFilters() {
    const counts = new Map();
    scopeNotes().forEach(function (n) { arr(n.tags).forEach(function (tag) { counts.set(tag, (counts.get(tag) || 0) + 1); }); });
    const topics = Array.from(counts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    if (activeTopic && !topics.some(function (item) { return item[0] === activeTopic; })) topics.push([activeTopic, counts.get(activeTopic) || 0]);
    $('noteTopics').innerHTML = '<button type="button" data-topic="" aria-pressed="' + !activeTopic + '" class="topic-chip' + (!activeTopic ? ' active' : '') + '">全部主题</button>' +
      topics.map(function (item) {
        return '<button type="button" class="topic-chip' + (activeTopic === item[0] ? ' active' : '') + '" data-topic="' + esc(item[0]) + '" aria-pressed="' + (activeTopic === item[0]) + '">' + esc(item[0]) + '<span>' + item[1] + '</span></button>';
      }).join('');
  }

  function updateSearchUrl() {
    const url = new URL(location.href), query = $('noteSearch').value.trim();
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    if (activeTopic) url.searchParams.set('tag', activeTopic); else url.searchParams.delete('tag');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function renderEmptyState(list) {
    $('notesEmpty').hidden = !!list.length;
    if (list.length) return;
    const filtered = !!($('noteSearch').value.trim() || activeTopic);
    $('notesEmptyTitle').textContent = filtered ? '还没有找到这条思路。' : listTab === 'draft' && isAdmin() ? '草稿箱很清爽。' : isAdmin() ? '第一篇笔记，从一个好问题开始。' : '笔记还在整理中。';
    $('notesEmptyHint').textContent = filtered ? '试试更短的关键词，或切换一个算法标签。' : listTab === 'draft' && isAdmin() ? '未发布的想法会保存在这里，随时接着写。' : isAdmin() ? '用一篇题目复盘或算法模板，开始你的积累。' : '公开笔记发布后会出现在这里。';
    $('clearNoteFilters').hidden = !filtered;
  }

  /* ---------------- 列表 ---------------- */

  // 状态 + 搜索过滤：列表与分栏共用
  function getFiltered() {
    const kw = ($('noteSearch').value || '').trim().toLowerCase();
    let list = scopeNotes();
    if (activeTopic) list = list.filter(function (x) { return arr(x.tags).includes(activeTopic); });
    if (kw) {
      list = list.filter(function (x) {
        return (x.title || '').toLowerCase().indexOf(kw) >= 0 ||
          (x.summary || '').toLowerCase().indexOf(kw) >= 0 ||
          (x.category || '').toLowerCase().indexOf(kw) >= 0 ||
          (stripHtml(x.content) || '').toLowerCase().indexOf(kw) >= 0 ||
          arr(x.tags).join(' ').toLowerCase().indexOf(kw) >= 0;
      });
    }
    return list;
  }

  // 列表与分栏共用同一张卡片
  function cardHtml(x) {
    const tags = arr(x.tags), sum = x.summary || autoSummary(x.content);
    const isDraft = (x.status || 'draft') === 'draft', isPrivate = x.visibility !== 'public';
    const checked = selected.has(String(x.id)) ? ' checked' : '';
    return '<article tabindex="0" aria-label="阅读：' + esc(x.title || '未命名笔记') + '" class="note-card" data-id="' + esc(x.id) + '" data-status="' + (isDraft ? 'draft' : 'published') + '">' +
      '<label class="sel-check" title="选入导出 Word"><input type="checkbox" aria-label="选择笔记：' + esc(x.title || '未命名笔记') + '" data-sel="' + esc(x.id) + '"' + checked + '></label>' +
      '<div class="note-card-top"><span class="note-category">' + esc(x.category || tags[0] || '思考记录') + '</span>' +
      (isAdmin() ? '<span class="note-badge ' + (isDraft ? 'draft' : isPrivate ? 'private' : 'public') + '">' + (isDraft ? '草稿' : isPrivate ? '私密' : '公开') + '</span>' : '') + '</div>' +
      '<h2 class="note-title">' + esc(x.title || '未命名笔记') + '</h2>' +
      '<p class="note-sum">' + esc(sum || '从这篇笔记中，找回当时的思路。') + '</p>' +
      '<div class="note-tags">' + tags.slice(0, 4).map(function (tag) { return '<span class="ntag" data-tag="' + esc(tag) + '">' + esc(tag) + '</span>'; }).join('') + '</div>' +
      '<div class="note-meta"><time>' + esc(AN.fmtDate(x.updated_at || x.created_at)) + '</time><span>约 ' + readingMinutes(x.content) + ' 分钟</span><span class="note-read-arrow" aria-hidden="true">↗</span></div></article>';
  }

  function renderList() {
    updateSub();
    let list = getFiltered();
    list = sortNotes(list, sortMode, sortDir);
    const box = $('noteList');
    box.className = 'note-list layout-' + (viewMode === 'list' ? 'list' : 'grid');
    applyColsToList();
    renderEmptyState(list);
    box.innerHTML = list.map(cardHtml).join('');
    box.querySelectorAll('[data-sel]').forEach(function (cb) { cb.checked = selected.has(cb.dataset.sel); });
  }

  // 每行几个：写到 #noteList 上的 CSS 变量 + data-cols，grid 模板直接用它
  function applyColsToList() {
    const n = Number(listCols);
    const box = $('noteList');
    if (listCols === 'auto' || !n || n < 1) {
      box.style.removeProperty('--cols');
      box.removeAttribute('data-cols');
    } else {
      box.style.setProperty('--cols', String(n));
      box.setAttribute('data-cols', String(n));
    }
  }

  // 排序：时间(创建) / 修改(updated_at) / 浏览(views)，升降序
  function sortNotes(list, mode, dir) {
    const s = dir === 'asc' ? -1 : 1;
    const a = list.slice();
    if (mode === 'updated') {
      a.sort(function (x, y) { return s * String(y.updated_at || '').localeCompare(String(x.updated_at || '')); });
    } else if (mode === 'views') {
      a.sort(function (x, y) { return s * ((Number(y.views) || 0) - (Number(x.views) || 0)); });
    } else {
      a.sort(function (x, y) { return s * String(y.created_at || '').localeCompare(String(x.created_at || '')); });
    }
    return a;
  }

  // 勾选 / 取消勾选某篇（用于导出 Word）
  function toggleSel(id, on) {
    if (on) selected.add(String(id)); else selected.delete(String(id));
    updateSelCount();
  }

  // 导出选中的笔记为 Word；未勾选则导出当前视图全部
  async function exportSelected() {
    let list = getFiltered();
    list = sortNotes(list, sortMode, sortDir);
    if (selected.size) {
      const ids = selected;
      list = list.filter(function (x) { return ids.has(String(x.id)); });
    }
    if (!list.length) { AN.toast('没有可导出的笔记', true); return; }
    if (typeof DocxExport === 'undefined' || !DocxExport.exportNotesDocx) {
      AN.toast('导出模块未加载', true); return;
    }
    try {
      AN.toast('正在生成 Word…');
      const blob = await DocxExport.exportNotesDocx(list, {
        title: '算法手记 · 笔记导出',
        count: list.length,
        date: (function () {
          const d = new Date(); const p = function (n) { return n < 10 ? '0' + n : '' + n; };
          return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        })()
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '算法笔记_' + (function () {
        const d = new Date(); const p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
      })() + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      AN.toast('已导出 ' + list.length + ' 篇笔记');
    } catch (err) {
      AN.toast('导出失败：' + (err && err.message || err), true);
    }
  }

  const ARROW_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  const ARROW_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

  function updateSelCount() {
    const el = $('selCount');
    if (!el) return;
    el.textContent = selected.size ? ('已选 ' + selected.size + ' 篇') : '';
    const sa = $('selAll');
    if (sa) sa.checked = false;
  }

  // 视图调度：方块 / 列表 / 分栏
  function renderView() {
    const board = viewMode === 'board';
    $('noteList').hidden = board;
    $('boardView').hidden = !board;
    $('boardBar').hidden = !board;
    $('notesToolbar').hidden = board; // 排序 / 每行 / 全选 / 导出 只在方块·列表模式显示
    document.querySelectorAll('#viewSeg .seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === viewMode); b.setAttribute('aria-pressed', String(b.dataset.view === viewMode));
    });
    $('boardHint').textContent = isAdmin() ? (colOrder.length ? '拖动卡片到别的栏即可换栏' : '点「管理栏」创建栏目') : '按栏目浏览公开笔记';
    // 同步控件条状态
    $('noteCols').value = listCols;
    $('noteSort').value = sortMode;
    $('noteSortDirIcon').innerHTML = sortDir === 'asc' ? ARROW_UP : ARROW_DOWN;
    $('noteSortDir').title = sortDir === 'asc' ? '当前：升序，点一下换成降序' : '当前：降序，点一下换成升序';
    updateSelCount();
    if (board) renderBoard(); else renderList();
  }

  // 自定义栏的栏名与顺序：管理里定义的顺序在前，笔记里实际用到的补在后面
  function boardColumnNames() {
    const used = {};
    all.forEach(function (x) { const c = (x.category || '').trim(); if (c) used[c] = 1; });
    const names = isAdmin() ? colOrder.slice() : [];
    Object.keys(used).forEach(function (c) { if (names.indexOf(c) < 0) names.push(c); });
    return names;
  }

  // 分栏（看板）：自定义栏 或 按标签自动分栏
  function renderBoard() {
    updateSub();
    const list = sortNotes(getFiltered(), sortMode, sortDir);
    const box = $('boardView');
    renderEmptyState(list);
    if (!list.length) { box.replaceChildren(); return; }
    const names = boardColumnNames();
    let cols = names.map(function (n) {
      return { name: n, items: list.filter(function (x) { return (x.category || '').trim() === n; }) };
    });
    cols.push({
      name: '未分栏',
      items: list.filter(function (x) {
        const c = (x.category || '').trim();
        return !c || names.indexOf(c) < 0;
      }),
      uncat: true
    });
    box.innerHTML = cols.map(function (col) {
      const head = '<span class="board-col-name">' + esc(col.name) + '</span>';
      return '<div class="board-col' + (col.uncat ? ' uncat' : '') + '">' +
        '<div class="board-col-head">' + head + '<span class="board-col-count">' + col.items.length + '</span></div>' +
        '<div class="board-col-body" data-col="' + esc(col.name) + '">' + col.items.map(cardHtml).join('') + '</div>' +
      '</div>';
    }).join('');
    // 仅管理员可拖动换栏
    if (isAdmin()) {
      box.querySelectorAll('.note-card').forEach(function (c) { c.setAttribute('draggable', 'true'); });
    }
  }

  // 拖动卡片换栏：写回云端 category
  async function moveToColumn(id, col) {
    if (!isAdmin()) return;
    const db = AN.getDb();
    if (!db) { AN.toast('云端未连接，无法换栏', true); return; }
    const cat = col === '未分栏' ? '' : col;
    const { error } = await db.from('notes').update({ category: cat, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { AN.toast('换栏失败：' + (error.message || ''), true); return; }
    const x = all.find(function (n) { return String(n.id) === String(id); });
    if (x) { x.category = cat; x.updated_at = new Date().toISOString(); }
    AN.toast('已移到「' + (cat || '未分栏') + '」');
    AN.bumpActivity(1);
    renderBoard();
  }

  /* ---------------- 分栏管理 ---------------- */

  function openColModal() {
    if (!isAdmin()) return;
    renderColList();
    $('colModal').hidden = false;
    setTimeout(function () { $('colNewName').focus(); }, 40);
  }

  function renderColList() {
    const box = $('colList');
    if (!colOrder.length) {
      box.innerHTML = '<li class="muted small">还没有自定义栏，在下面输入名字添加一个</li>';
      return;
    }
    box.innerHTML = colOrder.map(function (n, i) {
      const cnt = all.filter(function (x) { return (x.category || '').trim() === n; }).length;
      return '<li class="col-item">' +
        '<span class="col-name">' + esc(n) + '</span>' +
        '<span class="col-cnt">' + cnt + ' 篇</span>' +
        '<span class="col-ops">' +
          '<button type="button" class="mini" data-act="up" data-i="' + i + '" title="上移">↑</button>' +
          '<button type="button" class="mini" data-act="down" data-i="' + i + '" title="下移">↓</button>' +
          '<button type="button" class="mini danger" data-act="del" data-i="' + i + '" title="删除该栏">×</button>' +
        '</span></li>';
    }).join('');
  }

  function addColumn() {
    const inp = $('colNewName');
    const name = (inp.value || '').trim();
    if (!name) { AN.toast('先输入栏名', true); return; }
    if (colOrder.indexOf(name) >= 0) { AN.toast('这个栏已经有了', true); return; }
    colOrder.push(name); saveColOrder();
    inp.value = '';
    renderColList(); renderBoard();
    AN.toast('已添加栏「' + name + '」');
  }

  async function delColumn(i) {
    const name = colOrder[i];
    if (!name) return;
    const cnt = all.filter(function (x) { return (x.category || '').trim() === name; }).length;
    if (!confirm('删除栏「' + name + '」？' + (cnt ? '该栏下 ' + cnt + ' 篇笔记会移回「未分栏」。' : ''))) return;
    colOrder.splice(i, 1); saveColOrder();
    if (cnt) {
      const db = AN.getDb();
      const rows = all.filter(function (x) { return (x.category || '').trim() === name; });
      if (db) {
        let failed = 0;
        for (let k = 0; k < rows.length; k++) {
          const { error } = await db.from('notes')
            .update({ category: '', updated_at: new Date().toISOString() })
            .eq('id', rows[k].id);
          if (error) failed++; else rows[k].category = '';
        }
        if (failed) AN.toast('有 ' + failed + ' 篇没能移回未分栏', true);
      } else {
        rows.forEach(function (n) { n.category = ''; });
      }
    }
    renderColList(); renderBoard();
    AN.toast('已删除栏「' + name + '」');
  }

  function moveCol(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= colOrder.length) return;
    const t = colOrder[i]; colOrder[i] = colOrder[j]; colOrder[j] = t;
    saveColOrder(); renderColList(); renderBoard();
  }

  function arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
    return [];
  }

  // 算法标签颜色：按标签名稳定映射到 0-7 色阶，对应 notes.css 的 ntag-0..7
  const TAG_SEED = 'an-tag-color-v1';
  function tagColorIndex(t) {
    let h = 0;
    for (let i = 0; i < String(t).length; i++) {
      h = ((h << 5) - h) + String(t).charCodeAt(i); h |= 0;
    }
    return Math.abs(h) % 8;
  }

  /* ---------------- 视图切换 ---------------- */

  function show(which) {
    if (which !== 'edit') { stopAutosave(); stopReaderOutline(); document.body.classList.remove('read-only'); }
    $('listView').hidden = which !== 'list';
    $('editView').hidden = which !== 'edit';
    if (which === 'list') startVisit(null);
    window.scrollTo(0, 0);
  }

  /* ---------------- 编辑器（富文本） ---------------- */

  function edBody() { return $('edBody'); }

  function getHtml() {
    // 编辑模式下代码块会被增强为带行号/工具栏的卡片；
    // 保存前还原为干净的 <pre><code class="language-xxx">文本</code></pre>，
    // 保证数据库、预览、后续重新打开都能正常高亮。
    const clone = edBody().cloneNode(true);
    clone.querySelectorAll('pre.code-enh').forEach(function (pre) {
      const code = pre.querySelector('.code-area > code');
      if (!code) return;
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1] || 'code';
      const raw = codeText(code).replace(/^\n+|\n+$/g, '');
      const clean = document.createElement('pre');
      clean.innerHTML = '<code class="language-' + lang + '">' + esc(raw) + '</code>';
      pre.parentNode.replaceChild(clean, pre);
    });
    return clone.innerHTML;
  }

  function setMode(m) {
    mode = m;
    $('edPanes').className = 'ed-panes mode-' + m;
    const btns = document.querySelectorAll('#edMode .seg-btn');
    for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.mode === m);
    try { localStorage.setItem(LS_MODE, m); } catch (e) {}
  }

  function updatePreview() {
    const html = getHtml();
    $('edPreview').innerHTML = renderContent(html);
    enhanceCodeBlocks($('edPreview'));
    $('edWords').textContent = countWords(html);
    updateReaderOutline();
    saveDraftLocal();
  }

  /* ---------------- 自动存草稿（写一半退出也进草稿箱） ---------------- */
  // autosaveId：当前正在写的「新笔记/草稿」在云端对应的笔记 id；
  // 首次自动保存时插入，之后原地更新，避免每次都新建重复草稿。
  let autosaveId = null;
  let autosaveTimer = null;
  let autosavePending = null;
  let initialEditorSnapshot = '';
  function editorSnapshot() {
    return JSON.stringify([$('edTitle').value, $('edSummary').value, $('edTags').value, $('edVisibility').value, getHtml()]);
  }
  function startAutosave() {
    stopAutosave();
    if (readOnly) return;
    // 已发布的笔记不在后台自动存成草稿（避免产生重复草稿）
    if (editing && (editing.status || 'draft') !== 'draft') return;
    autosaveTimer = setInterval(stashAutosaveDraft, 15000);
  }
  function stopAutosave() {
    if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
  }
  async function stashAutosaveDraft() {
    if (autosavePending) return autosavePending;
    if (readOnly || !isAdmin() || saveInProgress) return true;
    if (!window.DOMPurify) return false;
    if (editing && (editing.status || 'draft') !== 'draft') return true;
    const html = getHtml().trim(), db = AN.getDb();
    if (!html && !$('edTitle').value.trim()) return true;
    if (!db) return false;
    const epoch = editorEpoch, targetId = autosaveId, snapshot = editorSnapshot();
    const rec = {
      title: $('edTitle').value.trim() || '未命名草稿', content: sanitizeHtml(html),
      summary: $('edSummary').value.trim() || autoSummary(html), tags: parseTags(),
      category: (editing && editing.category) || '', status: 'draft',
      visibility: $('edVisibility').value || 'private', updated_at: new Date().toISOString()
    };
    $('editorSaveState').textContent = '正在保存草稿…';
    autosavePending = (async function () {
      try {
        const result = targetId ? await db.from('notes').update(rec).eq('id', targetId) : await db.from('notes').insert(rec).select();
        if (epoch !== editorEpoch || !isAdmin()) return;
        if (result.error) throw new Error(result.error.message || '保存失败');
        const stored = targetId ? Object.assign({}, all.find(function (n) { return String(n.id) === String(targetId); }) || {}, rec, { id: targetId }) : result.data && result.data[0];
        if (!stored) throw new Error('未收到保存结果');
        autosaveId = stored.id;
        const index = all.findIndex(function (n) { return String(n.id) === String(stored.id); });
        if (index >= 0) all[index] = stored; else all.push(stored);
        NoteCache.set('notes', all);
        initialEditorSnapshot = snapshot;
        $('editorSaveState').textContent = '草稿已保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return true;
      } catch (e) {
        if (epoch === editorEpoch) $('editorSaveState').textContent = '自动保存未成功，请点击“存草稿”重试';
        return false;
      } finally { autosavePending = null; }
    })();
    return autosavePending;
  }

  function openEditor(rec, opts) {
    opts = opts || {};
    if (!isAdmin() && (!rec || rec.status !== 'published' || rec.visibility !== 'public')) return;
    editorEpoch++;
    editing = rec || null;
    readOnly = !isAdmin() || opts.readOnly === true;
    ['readerEyebrow', 'readerMeta'].forEach(function (id) { $(id).hidden = !readOnly; });
    $('readerEditBtn').hidden = !readOnly || !isAdmin();
    $('readerSummary').hidden = !readOnly || !rec || !rec.summary;
    $('readerSummary').textContent = rec ? rec.summary || '' : '';
    $('readerEyebrow').textContent = rec ? rec.category || arr(rec.tags)[0] || 'FIELD NOTE' : 'FIELD NOTE';
    $('readerMeta').innerHTML = rec ? '<time>' + esc(AN.fmtDate(rec.updated_at || rec.created_at)) + ' 更新</time><span>约 ' + readingMinutes(rec.content) + ' 分钟阅读</span><span>' + countWords(rec.content) + ' 字</span>' : '';
    $('editorSaveState').hidden = readOnly;
    $('editorSaveState').textContent = rec && rec.status === 'published' ? '正在编辑已发布笔记，完成后点击“发布”保存更新' : '草稿会每 15 秒自动保存';

    $('edTitle').value = rec ? (rec.title || '') : '';
    $('edTitle').hidden = readOnly;
    $('readerTitle').hidden = !readOnly;
    $('readerTitle').textContent = rec ? (rec.title || '未命名笔记') : '';
    $('edSummary').value = rec ? (rec.summary || '') : '';
    $('edTags').value = rec ? arr(rec.tags).join(', ') : '';
    renderTagPicker();
    $('edVisibility').value = rec ? (rec.visibility || 'private') : 'private';
    edBody().innerHTML = rec ? sanitizeHtml(toHtml(rec.content)) : '';
    $('noteTemplateBar').hidden = !!rec || readOnly;
    // 编辑/只读模式都增强代码块，保持与预览一致的高亮、行号、工具栏
    edBody().querySelectorAll('pre[data-enh]').forEach(function (pre) { delete pre.dataset.enh; });
    enhanceCodeBlocks(edBody());

    // 只读模式：标题、摘要、正文不可改；工具栏、保存/发布按钮隐藏
    const editable = !readOnly;
    $('edTitle').readOnly = !editable;
    $('edSummary').readOnly = !editable;
    $('edTags').readOnly = !editable;
    $('edVisibility').disabled = !editable;
    // 编辑模式下让增强后的代码文本区仍可编辑，只读模式下整体不可编辑
    edBody().querySelectorAll('pre.code-enh .code-area > code').forEach(function (code) {
      code.setAttribute('contenteditable', editable ? 'true' : 'false');
    });
    edBody().contentEditable = editable ? 'true' : 'false';
    $('edToolbar').hidden = readOnly;
    $('saveDraftBtn').hidden = readOnly;
    $('publishBtn').hidden = readOnly;
    $('delNoteBtn').hidden = readOnly || !(rec && rec.id);
    $('edMode').hidden = readOnly;
    document.body.classList.toggle('read-only', readOnly);

    if (readOnly) {
      $('edStatus').textContent = '只读阅读 · ' + ((rec && rec.visibility === 'public') ? '公开笔记' : '私密笔记');
    } else if (rec) {
      const st = (rec.status || 'draft') === 'draft' ? '草稿' : '已发布';
      const vis = (rec.visibility || 'private') === 'public' ? '公开' : '私密';
      $('edStatus').textContent = '编辑 · ' + st + ' · ' + vis;
    } else {
      $('edStatus').textContent = '新笔记';
    }

    // 点「新建笔记」不再自动恢复上次没写完的本地草稿（避免一进编辑器就跳到未发布内容）；
    // 半途内容改为自动存进云端草稿箱（见 startAutosave / stashAutosaveDraft）。
    if (!rec) { autosaveId = null; }
    else { autosaveId = ((rec.status || 'draft') === 'draft') ? rec.id : null; }
    startAutosave();
    setMode(readOnly ? 'preview' : (localStorage.getItem(LS_MODE) || 'edit'));
    updatePreview();
    initialEditorSnapshot = editorSnapshot();
    show('edit');
    if (rec) startVisit(rec.id, rec.title);
    else startVisit(null);
    if (!rec && !readOnly) setTimeout(function () { edBody().focus(); }, 60);
  }

  // 先阅读，再由管理员明确进入编辑，避免打开笔记就误改正文。
  let pendingNew = false;
  function openExisting(x) {
    if (!x) return;
    openEditor(x, { readOnly: true });
    history.replaceState(null, '', '#n' + encodeURIComponent(x.id));
  }
  function openHashNote() {
    const m = location.hash.match(/^#n(\d+)$/);
    if (!m) return;
    const x = all.find(function (n) { return String(n.id) === m[1]; });
    if (x) openExisting(x);
    else {
      stopAutosave(); editing = null; readOnly = true;
      edBody().replaceChildren(); $('edPreview').replaceChildren(); $('edTitle').value = '';
      show('list'); AN.toast('这篇笔记不存在或当前不可见', true);
    }
  }
  window.addEventListener('an:admin', function () {
    if (pendingNew) {
      pendingNew = false;
      openEditor(null);
    }
  });

  function saveDraftLocal() {
    if (!isAdmin() || readOnly) return;
    NoteCache.set('draft', { title: $('edTitle').value, summary: $('edSummary').value,
      tags: $('edTags').value, content: getHtml() });
  }

  function parseTags() {
    return String($('edTags').value || '')
      .split(/[,，、\s]+/).map(function (s) { return s.trim().replace(/^#/, ''); })
      .filter(Boolean).slice(0, 8);
  }

  /* ---------------- 标签库选择器 ---------------- */
  function renderTagPicker() {
    const body = $('tagPickerBody');
    if (!body) return;
    const kw = ($('tagFilterInput').value || '').trim().toLowerCase();
    const sel = parseTags();
    const selSet = {};
    sel.forEach(function (t) { selSet[t] = true; });
    let total = 0;
    let html = '';
    TAG_LIBRARY.forEach(function (group) {
      const items = group.items.filter(function (t) { return !kw || t.toLowerCase().indexOf(kw) >= 0; });
      if (!items.length) return;
      total += items.length;
      html += '<div class="tag-group">' +
        '<div class="tag-group-head">' + esc(group.cat) + '</div>' +
        '<div class="tag-chips">' +
        items.map(function (t) {
          const on = selSet[t] ? ' on' : '';
          return '<button type="button" class="tag-chip' + on + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') +
        '</div></div>';
    });
    body.innerHTML = html || '<p class="muted small" style="padding:10px 2px">没有匹配的标签</p>';
    const cnt = $('tagPickerCount');
    if (cnt) cnt.textContent = sel.length ? ('已选 ' + sel.length + ' / 8') : '';
  }

  function toggleTag(t) {
    let cur = parseTags();
    const i = cur.indexOf(t);
    if (i >= 0) {
      cur.splice(i, 1);
    } else {
      if (cur.length >= 8) return;   // 与 parseTags 上限一致
      cur.push(t);
    }
    $('edTags').value = cur.join(', ');
    renderTagPicker();
  }

  /* ---------------- 富文本插入 ---------------- */

  function exec(cmd, val) {
    edBody().focus();
    try { document.execCommand(cmd, false, val); } catch (e) {}
    updatePreview();
  }
  function getSelText() {
    const s = window.getSelection();
    return s ? s.toString() : '';
  }
  function insertHTML(html) {
    edBody().focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = document.createRange().createContextualFragment(html);
      range.insertNode(frag);
      sel.collapseToEnd();
    } else {
      edBody().insertAdjacentHTML('beforeend', html);
    }
    updatePreview();
  }

  // 把剪贴板 / 拖拽的图片文件直接内嵌为原图（base64 data URI），不替换成链接或占位符
  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error('read error')); };
      r.readAsDataURL(file);
    });
  }
  // 在当前光标处逐个插入原图；图片以 data URI 形式写入正文 HTML，保存后持久可见、可复制
  async function embedImages(files) {
    edBody().focus();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!/^image\//.test(f.type)) continue;
      try {
        const url = await readFileAsDataUrl(f);
        insertHTML('<img src="' + url + '" alt="' + esc(f.name || '图片') + '" style="max-width:100%">');
      } catch (err) {
        AN.toast('图片读取失败', true);
      }
    }
  }

  const TPL = [
    '<h2>题目描述</h2>',
    '<p>在这里粘贴题面，或者用一两句话概括。</p>',
    '<h2>思路</h2>',
    '<ol><li>观察条件…</li><li>转化问题…</li><li>贪心 / DP / 图论…</li></ol>',
    '<h2>正确性说明</h2>',
    '<p>简要说明为什么这样做是对的。</p>',
    '<h2>复杂度</h2>',
    '<ul><li>时间复杂度：O(…)</li><li>空间复杂度：O(…)</li></ul>',
    '<h2>C++17 代码</h2>',
    '<pre><code class="language-cpp">#include &lt;iostream&gt;\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(0); cin.tie(0);\n  return 0;\n}</code></pre>',
    '<h2>踩坑记录</h2>',
    '<ul><li>…</li></ul>'
  ].join('');

  const CMDS = {
    h1: function () { exec('formatBlock', 'H1'); closeAllPickers(); },
    h2: function () { exec('formatBlock', 'H2'); closeAllPickers(); },
    h3: function () { exec('formatBlock', 'H3'); closeAllPickers(); },
    h4: function () { exec('formatBlock', 'H4'); closeAllPickers(); },
    h5: function () { exec('formatBlock', 'H5'); closeAllPickers(); },
    p: function () { exec('formatBlock', 'P'); closeAllPickers(); },
    bold: function () { exec('bold'); },
    italic: function () { exec('italic'); closeAllPickers(); },
    underline: function () { exec('underline'); closeAllPickers(); },
    strike: function () { exec('strikeThrough'); closeAllPickers(); },
    clear: function () { exec('removeFormat'); closeAllPickers(); },
    codeOpen: function () { openCodeModal(); },
    ul: function () { exec('insertUnorderedList'); closeAllPickers(); },
    ol: function () { exec('insertOrderedList'); closeAllPickers(); },
    quote: function () { exec('formatBlock', 'BLOCKQUOTE'); closeAllPickers(); },
    table: function () { toggleTablePicker(); },
    hr: function () { insertHTML('<hr><p><br></p>'); closeAllPickers(); },
    formula: function () { const s = getSelText(); insertHTML('<code class="math">$' + esc(s || '公式') + '$</code>'); closeAllPickers(); },
    link: function () { askLink('link'); closeAllPickers(); },
    image: function () { askLink('image'); closeAllPickers(); },
    undo: function () { exec('undo'); },
    redo: function () { exec('redo'); },
    history: function () { showHistory(); },
    foreColor: function (color) { exec('foreColor', color); closeAllPickers(); },
    hiliteColor: function (color) { exec('hiliteColor', color); closeAllPickers(); },
    justifyLeft: function () { applyAlign('left'); closeAllPickers(); },
    justifyCenter: function () { applyAlign('center'); closeAllPickers(); },
    justifyRight: function () { applyAlign('right'); closeAllPickers(); }
  };

  function insertTable(rows, cols) {
    let ths = '', tds = '';
    for (let i = 0; i < cols; i++) { ths += '<th>&nbsp;</th>'; tds += '<td>&nbsp;</td>'; }
    const body = [];
    for (let i = 0; i < rows - 1; i++) body.push('<tr>' + tds + '</tr>');
    insertNodes('<table class="md-table"><thead><tr>' + ths + '</tr></thead><tbody>' + body.join('') + '</tbody></table><p><br></p>');
  }

  function insertNodes(html) {
    edBody().focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = document.createRange().createContextualFragment(html);
    range.insertNode(frag);
    sel.collapseToEnd();
    updatePreview();
  }

  // 任意元素对齐：文字用 text-align，图片/表格/媒体用 margin:auto（块级才能居中）
  // 这样「文字 / 表格 / 图片 / 其他任何元素」都能左 / 中 / 右对齐
  const ALIGN_MEDIA = 'img, table, pre, figure, iframe, video';
  function rangeIntersectsNode(range, node) {
    try { if (typeof range.intersectsNode === 'function') return range.intersectsNode(node); } catch (e) {}
    const nr = document.createRange();
    nr.selectNode(node);
    return range.compareBoundaryPoints(Range.END_TO_START, nr) <= 0 &&
           range.compareBoundaryPoints(Range.START_TO_END, nr) >= 0;
  }
  function getBlockElement(node) {
    if (node && node.nodeType === 3) node = node.parentNode;
    const root = edBody();
    while (node && node !== root) {
      const tag = node.tagName;
      if (['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'TD', 'TH', 'FIGURE', 'PRE'].indexOf(tag) >= 0) return node;
      node = node.parentNode;
    }
    return null;
  }
  function setElementAlign(el, value) {
    const tag = el.tagName;
    if (ALIGN_MEDIA.toUpperCase().indexOf(tag) >= 0 || tag === 'IMG' || tag === 'TABLE' ||
        tag === 'PRE' || tag === 'FIGURE' || tag === 'IFRAME' || tag === 'VIDEO') {
      // 块级 / 媒体元素：用左右外边距居中，文字对齐作兜底
      el.style.display = (tag === 'IMG') ? 'block' : el.style.display;
      el.style.marginLeft = (value === 'right' || value === 'center') ? 'auto' : '0';
      el.style.marginRight = (value === 'left' || value === 'center') ? 'auto' : '0';
      el.style.textAlign = value;
    } else {
      // 纯文字块：用 text-align
      el.style.textAlign = value;
    }
  }
  function applyAlign(value) {
    const root = edBody();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const els = new Set();
    root.querySelectorAll(ALIGN_MEDIA).forEach(function (el) {
      if (rangeIntersectsNode(range, el)) els.add(el);
    });
    const block = getBlockElement(range.commonAncestorContainer);
    if (block) {
      if (els.size === 0) {
        // 选区没精准命中媒体：若所在块内含媒体，则对齐该媒体（方便「点一下图片/表格就居中」）
        block.querySelectorAll(ALIGN_MEDIA).forEach(function (m) { els.add(m); });
      }
      els.add(block);
    }
    if (els.size === 0) return;
    els.forEach(function (el) { setElementAlign(el, value); });
    updatePreview();
  }

  const TABLE_PICKER_ROWS = 6, TABLE_PICKER_COLS = 8;
  function toggleTablePicker() {
    const pop = $('tablePickerPop');
    pop.hidden = !pop.hidden;
    if (!pop.hidden) {
      renderTablePickerGrid();
      pop.focus();
    }
  }
  function renderTablePickerGrid() {
    const grid = $('tablePickerGrid');
    grid.innerHTML = '';
    for (let r = 1; r <= TABLE_PICKER_ROWS; r++) {
      for (let c = 1; c <= TABLE_PICKER_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'table-picker-cell';
        cell.dataset.r = r; cell.dataset.c = c;
        grid.appendChild(cell);
      }
    }
    highlightTablePicker(3, 2);
  }
  function highlightTablePicker(rows, cols) {
    const cells = document.querySelectorAll('.table-picker-cell');
    cells.forEach(function (cell) {
      const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
      cell.classList.toggle('hovered', r <= rows && c <= cols);
    });
    $('tablePickerLabel').textContent = rows + ' 行 × ' + cols + ' 列 表格';
  }

  /* ---------------- 工具栏下拉 / 颜色 / 历史 ---------------- */

  const COLOR_PRESETS = [
    '#f85149', '#ff7b72', '#ffa657', '#d29922', '#3fb950', '#56d364', '#58a6ff', '#79c0ff',
    '#a371f7', '#d2a8ff', '#f778ba', '#ff9bce', '#8b949e', '#b1bac4', '#f0f6fc', '#ffffff',
    '#21262d', '#30363d', '#484f58', '#6e7681', '#0d1117', '#000000'
  ];

  function closeAllPickers() {
    ['formatPickerPop', 'colorPickerPop', 'bgPickerPop', 'alignPickerPop',
     'tablePickerPop'].forEach(function (id) {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }
  function togglePicker(id, render) {
    const el = $(id);
    const wasOpen = el && !el.hidden;
    closeAllPickers();
    if (!wasOpen && el) {
      if (render) render();
      el.hidden = false;
    }
  }
  function toggleFormatPicker() { togglePicker('formatPickerPop'); }
  function toggleColorPicker() { togglePicker('colorPickerPop', renderColorPicker); }
  function toggleBgPicker() { togglePicker('bgPickerPop', renderBgPicker); }
  function toggleAlignPicker() { togglePicker('alignPickerPop'); }

  function renderColorGrid(gridId, cmdName) {
    const grid = $(gridId);
    if (!grid || grid.dataset.ready) return;
    grid.innerHTML = '';
    COLOR_PRESETS.forEach(function (c) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-cell';
      b.title = c;
      b.style.backgroundColor = c;
      b.dataset.color = c;
      b.dataset.cmd = cmdName;
      grid.appendChild(b);
    });
    grid.dataset.ready = '1';
  }
  function renderColorPicker() { renderColorGrid('colorPickerGrid', 'foreColor'); }
  function renderBgPicker() { renderColorGrid('bgPickerGrid', 'hiliteColor'); }

  function showHistory() {
    if (!editing) { AN.toast('新笔记，尚未保存'); return; }
    const created = editing.created_at ? new Date(editing.created_at).toLocaleString('zh-CN') : '未知';
    const updated = editing.updated_at ? new Date(editing.updated_at).toLocaleString('zh-CN') : '未知';
    AN.toast('创建：' + created + '；更新：' + updated);
  }

  /* ---------------- 插入代码弹窗（仿 CSDN：代码编辑区 + 语言列表） ---------------- */
  const LANGS = [
    ['cpp', 'C++'], ['c', 'C'], ['csharp', 'C#'], ['python', 'Python'], ['java', 'Java'],
    ['go', 'Go'], ['rust', 'Rust'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
    ['kotlin', 'Kotlin'], ['swift', 'Swift'], ['dart', 'Dart'], ['php', 'PHP'], ['ruby', 'Ruby'],
    ['perl', 'Perl'], ['sql', 'SQL'], ['bash', 'Bash/Shell'], ['json', 'JSON'], ['yaml', 'YAML'],
    ['css', 'CSS'], ['scss', 'SCSS'], ['less', 'LESS'], ['xml', 'HTML/XML'],
    ['diff', 'diff'], ['markdown', 'Markdown'], ['plaintext', '纯文本']
  ];
  let codeLang = 'cpp';

  function openCodeModal() {
    const ta = $('codeInput');
    const sel = (getSelText() || '').trim();
    ta.value = sel;
    codeLang = 'cpp';
    renderCodeLangList();
    $('codeModal').hidden = false;
    setTimeout(function () { ta.focus(); }, 40);
  }
  function closeCodeModal() { $('codeModal').hidden = true; }
  function renderCodeLangList() {
    const box = $('codeLangList');
    box.innerHTML = '';
    LANGS.forEach(function (it) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'code-lang-item' + (it[0] === codeLang ? ' active' : '');
      b.dataset.lang = it[0];
      b.textContent = it[1];
      box.appendChild(b);
    });
  }
  function insertCodeBlock(lang, text) {
    const s = (text != null) ? text : (getSelText() || '// 在这里写代码');
    const ph = (s && s.length) ? s : '// 在这里写代码';
    insertHTML('<pre><code class="language-' + lang + '">' + esc(ph) + '</code></pre><p><br></p>');
    updatePreview();
  }
  function confirmCodeInsert() {
    insertCodeBlock(codeLang, $('codeInput').value);
    closeCodeModal();
  }

  function askLink(kind) {
    const s = getSelText();
    $('linkTitle').textContent = kind === 'image' ? '插入图片' : '插入链接';
    $('linkUrl').value = '';
    $('linkText').value = s;
    $('linkModal').dataset.kind = kind;
    $('linkModal').hidden = false;
    setTimeout(function () { $('linkUrl').focus(); }, 40);
  }
  function doLinkInsert() {
    const kind = $('linkModal').dataset.kind || 'link';
    const url = $('linkUrl').value.trim();
    if (!url) { AN.toast('地址不能为空', true); return; }
    const text = $('linkText').value.trim();
    const html = kind === 'image'
      ? '<img src="' + esc(url) + '" alt="' + esc(text || '图片') + '">'
      : '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text || url) + '</a>';
    $('linkModal').hidden = true;
    insertHTML(html);
  }

  /* ---------------- 保存 / 发布 ---------------- */

  async function saveNote(publish) {
    if (saveInProgress) return;
    if (autosavePending) await autosavePending;
    if (saveInProgress) return;
    if (readOnly || !isAdmin()) { AN.toast('只读模式不能保存', true); return; }
    if (!window.DOMPurify) { AN.toast('编辑组件加载失败，请刷新后再保存', true); return; }
    const db = AN.getDb();
    if (!db) { AN.toast('云端未连接，无法保存', true); return; }
    const title = $('edTitle').value.trim();
    if (!title) { AN.toast('先起个标题', true); $('edTitle').focus(); return; }
    const content = sanitizeHtml(getHtml());
    if (publish && !stripHtml(content).trim()) { AN.toast('正文还是空的', true); return; }
    // 编辑页已去掉分栏选择器，保存时保留原有分栏（看板拖拽设置），新建笔记默认未分栏
    const category = editing && editing.category ? editing.category : '';

    const btn = publish ? $('publishBtn') : $('saveDraftBtn');
    const old = btn.textContent;
    saveInProgress = true; stopAutosave();
    $('publishBtn').disabled = true; $('saveDraftBtn').disabled = true; btn.textContent = '保存中…';

    const rec = {
      title: title,
      content: content,
      summary: $('edSummary').value.trim() || autoSummary(content),
      tags: parseTags(),
      category: category,
      status: publish ? 'published' : 'draft',
      visibility: $('edVisibility').value || 'private',
      updated_at: new Date().toISOString()
    };

    try {
      if (editing && editing.id) {
        const { error } = await db.from('notes').update(rec).eq('id', editing.id);
        if (error) throw new Error(error.message || '更新失败');
        rec.id = editing.id; rec.created_at = editing.created_at; rec.views = editing.views;
      } else if (autosaveId) {
        // 新建笔记：复用自动保存时已建好的云端草稿，原地更新为发布/草稿，避免留下重复草稿
        const { error } = await db.from('notes').update(rec).eq('id', autosaveId);
        if (error) throw new Error(error.message || '写入失败');
        rec.id = autosaveId; rec.created_at = new Date().toISOString(); rec.views = 0;
      } else {
        const { data, error } = await db.from('notes').insert(rec).select();
        if (error) throw new Error(error.message || '写入失败');
        rec.id = data[0].id; rec.created_at = data[0].created_at; rec.views = 0;
      }
      autosaveId = rec.id;
      AN.bumpActivity(publish ? 2 : 1);
      const i = all.findIndex(function (n) { return String(n.id) === String(rec.id); });
      if (i >= 0) all[i] = rec; else all.push(rec);
      all.sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
      NoteCache.set('notes', all);
      NoteCache.set('draft', null);
      AN.toast(publish ? '已发布' : '草稿已保存');
      editing = null;
      listTab = rec.status;
      document.querySelectorAll('#notesTabs .tab-btn').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === listTab); });
      renderView();
      show('list');
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      AN.toast('保存失败：' + (e && e.message ? e.message : e), true);
    } finally {
      saveInProgress = false;
      $('publishBtn').disabled = false; $('saveDraftBtn').disabled = false; btn.textContent = old;
      if (!$('editView').hidden && !readOnly) startAutosave();
    }
  }

  async function delNote() {
    const target = editing;
    if (!target || !target.id) return;
    if (readOnly) { AN.toast('只读模式不能删除', true); return; }
    if (!confirm('确定删除《' + (target.title || '无标题') + '》？删了就找不回来了。')) return;
    const db = AN.getDb();
    if (!db) return;
    const { error } = await db.from('notes').delete().eq('id', target.id);
    if (error) { AN.toast('删除失败：' + (error.message || ''), true); return; }
    all = all.filter(function (n) { return String(n.id) !== String(target.id); });
    NoteCache.set('notes', all);
    AN.toast('已删除');
    editing = null;
    history.replaceState(null, '', 'notes.html');
    renderView();
    show('list');
  }

  /* ---------------- AI 辅助 ---------------- */

  let aiAct = null;

  const AI_PROMPTS = {
    continue: '你是算法竞赛教练。下面是用户正在写的题解笔记的末尾，请顺着往下补充 200-400 字（思路细化 / 正确性说明 / 复杂度分析）。只输出可直接插入的 Markdown 正文，不要重复已有内容，不要客套。\n\n---\n',
    improve: '请润色下面这段竞赛题解文字，让它更清晰紧凑，保持 Markdown 格式，只输出润色后的内容。\n\n---\n',
    outline: '围绕下面的内容，给出一个简洁的 Markdown 小标题提纲（用 ## 和 ###，不要正文）。\n\n---\n',
    explain: '用简洁清晰的中文解释下面这段内容，如果涉及算法请说明复杂度和适用场景。只输出解释部分。\n\n---\n',
    summary: '为下面的笔记写一句 60-90 字的概括摘要，只输出摘要本身，不要引号。\n\n---\n',
    title: '为下面这篇算法题解起 5 个简洁有力的中文标题，每行一个，不要编号。\n\n---\n'
  };

  async function runAI() {
    const btn = $('aiRun');
    btn.disabled = true; btn.textContent = '生成中…';
    $('aiHint').textContent = ''; $('aiHint').classList.remove('err');
    const sel = getSelText();
    const body = getHtml() || ($('edTitle').value || '(还没有正文)');

    let ctx;
    if (aiAct === 'continue') { $('aiHint').textContent = '取正文最后 1200 字作为上下文…'; ctx = stripHtml(body).slice(-1200); }
    else if (aiAct === 'title') { ctx = ($('edTitle').value ? $('edTitle').value + '\n' : '') + stripHtml(body).slice(0, 1200); }
    else { ctx = sel || stripHtml(body).slice(0, 1500); if (!sel && aiAct !== 'summary') $('aiHint').textContent = '没选中文字，将使用正文开头部分…'; }

    let out = '';
    try {
      const cloud = AN.getCloud();
      if (!cloud) throw new Error('云端模型未就绪');
      // 全部用非思考型快速模型（hunyuan-chat 等），绝不退回 auto 思考型（会等数分钟）
      const FAST_MODELS = ['hunyuan-chat', 'hunyuan', 'deepseek', 'default'];
      let modelId = 'hunyuan-chat';
      try {
        const models = await cloud.llm.models.list();
        const ids = (models || []).map(function (x) { return x.id; }).filter(function (id) { return id && id !== 'auto'; });
        for (const f of FAST_MODELS) { if (ids.indexOf(f) >= 0) { modelId = f; break; } }
      } catch (e) {}
      const opts = {
        model: modelId,
        messages: [
          { role: 'system', content: '你是资深算法竞赛教练，输出中文 Markdown，简洁专业，不说废话。' },
          { role: 'user', content: AI_PROMPTS[aiAct] + ctx }
        ],
        stream: true
      };
      for await (const chunk of cloud.llm.chat.completions.create(opts)) {
        const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        if (d && d.content) out += d.content;
      }
    } catch (e) {
      $('aiHint').textContent = 'AI 调用失败：' + (e && e.message ? e.message : e);
      $('aiHint').classList.add('err');
      btn.disabled = false; btn.textContent = '开始';
      return;
    }

    applyAI(out.trim());
    btn.disabled = false; btn.textContent = '开始';
  }

  function applyAI(out) {
    if (!out) { AN.toast('AI 没返回内容', true); return; }
    if (aiAct === 'title') {
      const lines = out.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length < 60; }).slice(0, 5);
      if (!lines.length) { AN.toast('没拿到标题', true); return; }
      AN.toast('标题建议：' + lines[0]);
      $('edTitle').value = lines[0].replace(/^[\d.、\s]+/, '');
      $('aiModal').hidden = true; saveDraftLocal();
      return;
    }
    if (aiAct === 'summary') {
      $('edSummary').value = out.replace(/^["'「\s]+|["'」\s]+$/g, '');
      $('aiModal').hidden = true; saveDraftLocal();
      AN.toast('摘要已填好');
      return;
    }
    const html = md ? md.parse(out) : '<p>' + esc(out) + '</p>';
    if (aiAct === 'improve' || aiAct === 'explain') insertHTML(html);
    else insertHTML('<p><br></p>' + html);
    $('aiModal').hidden = true;
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function doImport(file) {
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || '');
      let html;
      if (/\.(md|markdown)$/i.test(file.name)) html = md ? md.parse(text) : '<p>' + esc(text) + '</p>';
      else html = sanitizeHtml(text);
      edBody().innerHTML = html;
      updatePreview();
      AN.toast('已导入：' + file.name);
    };
    reader.readAsText(file);
  }

  function doExport() {
    const title = $('edTitle').value || 'article';
    const safe = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>' + esc(title) + '</title><style>body{font-family:system-ui;max-width:820px;margin:2rem auto;padding:0 16px;line-height:1.8}.md-table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px}pre{background:#0e1116;color:#e6e6e6;padding:12px;border-radius:8px;overflow:auto}code{background:#f2f2f2;padding:1px 5px;border-radius:4px}img{max-width:100%}</style>' +
      '</head><body><h1>' + esc(title) + '</h1>' + sanitizeHtml(getHtml()) + '</body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safe + '.html';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    $('noteSearch').addEventListener('input', function () { updateSearchUrl(); renderView(); });
    $('noteTopics').addEventListener('click', function (e) {
      const button = e.target.closest('[data-topic]');
      if (!button) return;
      activeTopic = button.dataset.topic; selected.clear(); updateSearchUrl(); renderView();
      const current = Array.from($('noteTopics').querySelectorAll('button')).find(function (b) { return b.dataset.topic === activeTopic; });
      if (current) current.focus();
    });
    $('clearNoteFilters').addEventListener('click', function () {
      $('noteSearch').value = ''; activeTopic = ''; updateSearchUrl(); renderView(); $('noteSearch').focus();
    });
    $('readerEditBtn').addEventListener('click', function () { if (isAdmin() && editing) { openEditor(editing, { readOnly: false }); setMode('edit'); } });
    $('readerTop').addEventListener('click', function () { $('readerTitle').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });

    // 视图切换：方块 / 列表 / 分栏
    $('viewSeg').addEventListener('click', function (e) {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      viewMode = b.dataset.view;
      try { localStorage.setItem(LS_VIEW, viewMode); } catch (err) {}
      renderView();
    });

    // 排序：时间 / 修改 / 浏览
    $('noteSort').addEventListener('change', function () {
      sortMode = $('noteSort').value;
      try { localStorage.setItem('an_note_sort', sortMode); } catch (err) {}
      if (viewMode !== 'board') renderList();
    });
    // 升降序
    $('noteSortDir').addEventListener('click', function () {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      try { localStorage.setItem('an_note_sortdir', sortDir); } catch (err) {}
      $('noteSortDirIcon').innerHTML = sortDir === 'asc' ? ARROW_UP : ARROW_DOWN;
      $('noteSortDir').title = sortDir === 'asc' ? '当前：升序，点一下换成降序' : '当前：降序，点一下换成升序';
      if (viewMode !== 'board') renderList();
    });
    // 每行几个
    $('noteCols').addEventListener('change', function () {
      listCols = $('noteCols').value;
      try { localStorage.setItem('an_note_cols', listCols); } catch (err) {}
      if (viewMode !== 'board') { applyColsToList(); renderList(); }
    });
    // 全选当前视图
    $('selAll').addEventListener('change', function () {
      const on = $('selAll').checked;
      let list = getFiltered();
      list.forEach(function (x) { if (on) selected.add(String(x.id)); else selected.delete(String(x.id)); });
      renderList();
    });
    // 导出 Word
    $('exportDocxBtn').addEventListener('click', exportSelected);

    // 管理分栏
    $('manageColBtn').addEventListener('click', openColModal);
    $('colAddBtn').addEventListener('click', addColumn);
    $('colNewName').addEventListener('keydown', function (e) { if (e.key === 'Enter') addColumn(); });
    $('colList').addEventListener('click', function (e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = parseInt(b.dataset.i, 10);
      if (b.dataset.act === 'up') moveCol(i, -1);
      else if (b.dataset.act === 'down') moveCol(i, 1);
      else if (b.dataset.act === 'del') delColumn(i);
    });

    // 分栏：点卡片打开笔记
    $('boardView').addEventListener('click', function (e) {
      const card = e.target.closest('.note-card');
      if (!card) return;
      const x = all.find(function (n) { return String(n.id) === String(card.dataset.id); });
      if (!x) return;
      openExisting(x);
    });

    // 分栏：拖动卡片换栏
    const bv = $('boardView');
    bv.addEventListener('dragstart', function (e) {
      const card = e.target.closest('.note-card');
      if (!card) return;
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', draggedId); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    bv.addEventListener('dragend', function (e) {
      const card = e.target.closest('.note-card');
      if (card) card.classList.remove('dragging');
      bv.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
    });
    bv.addEventListener('dragover', function (e) {
      const body = e.target.closest('.board-col-body');
      if (!body) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
      body.classList.add('drag-over');
    });
    bv.addEventListener('dragleave', function (e) {
      const body = e.target.closest('.board-col-body');
      if (!body || body.contains(e.relatedTarget)) return;
      body.classList.remove('drag-over');
    });
    bv.addEventListener('drop', function (e) {
      const body = e.target.closest('.board-col-body');
      if (!body) return;
      e.preventDefault();
      body.classList.remove('drag-over');
      let id = draggedId;
      if (!id && e.dataTransfer) { try { id = e.dataTransfer.getData('text/plain'); } catch (err) {} }
      if (!id) return;
      moveToColumn(id, body.dataset.col || '未分栏');
    });

    $('noteTemplateBar').addEventListener('click', function (e) {
      const button = e.target.closest('[data-template]');
      if (!button || !isAdmin() || readOnly) return;
      if (getHtml().trim() && !confirm('使用模板会替换当前正文，是否继续？')) return;
      const problem = button.dataset.template === 'problem';
      const sections = problem
        ? ['题目链接与难度', '题意与关键条件', '突破口：为什么想到这个方法', '解法与正确性', '时间与空间复杂度', '实现代码', '易错点与复盘']
        : ['要解决的问题', '核心原理与适用条件', '算法步骤', '正确性与复杂度', '实现模板', '边界情况与常见错误', '相关练习'];
      edBody().innerHTML = sections.map(function (title) { return '<h2>' + title + '</h2><p><br></p>'; }).join('');
      $('edTags').value = problem ? '题目复盘' : '算法整理';
      renderTagPicker(); updatePreview();
    });
    [$('noteList'), $('boardView')].forEach(function (list) {
      list.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('note-card')) { e.preventDefault(); e.target.click(); }
      });
    });
    $('newNoteBtn').addEventListener('click', function () {
      // 访客/只读模式没有发布权限：先弹登录门升级为管理员，登录成功后再开空白编辑器
      if (!isAdmin()) {
        pendingNew = true;
        if (window.reopenGate) window.reopenGate();
        else if (window.AN && window.AN.toast) window.AN.toast('请以管理员身份登录后再新建笔记', true);
        return;
      }
      openEditor(null);
    });

    $('noteList').addEventListener('click', function (e) {
      const cb = e.target.closest('.sel-check');
      if (cb) {
        e.stopPropagation();
        const box = cb.querySelector('[data-sel]');
        if (!box) return;
        if (e.target !== box) box.checked = !box.checked; // 点到方框空白处也切换
        toggleSel(box.dataset.sel, box.checked);
        return;
      }
      const card = e.target.closest('.note-card');
      if (!card) return;
      const id = card.dataset.id;
      const x = all.find(function (n) { return String(n.id) === String(id); });
      if (!x) return;
      openExisting(x);
    });

    $('notesTabs').addEventListener('click', function (e) {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      listTab = b.dataset.tab;
      document.querySelectorAll('#notesTabs .tab-btn').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === listTab); });
      renderView();
    });

    $('edBack').addEventListener('click', async function () {
      if (saveInProgress) { AN.toast('正在保存，请稍候'); return; }
      if (!readOnly && editing && editing.status === 'published' && editorSnapshot() !== initialEditorSnapshot) {
        if (!confirm('这篇已发布笔记的修改尚未保存。确定返回吗？')) return;
      }
      const saved = await stashAutosaveDraft();
      if (saved === false && !confirm('草稿暂时未能保存。仍要离开吗？')) return;
      history.replaceState(null, '', location.pathname + location.search);
      renderView(); show('list');
    });

    $('publishBtn').addEventListener('click', function () { saveNote(true); });
    $('saveDraftBtn').addEventListener('click', function () { saveNote(false); });
    $('delNoteBtn').addEventListener('click', delNote);

    $('edMode').addEventListener('click', function (e) {
      const b = e.target.closest('[data-mode]');
      if (b) setMode(b.dataset.mode);
    });

    $('edToolbar').addEventListener('click', function (e) {
      const d = e.target.closest('[data-dropdown]');
      if (d) {
        const map = {
          format: toggleFormatPicker, color: toggleColorPicker, bg: toggleBgPicker,
          align: toggleAlignPicker, table: toggleTablePicker
        };
        const fn = map[d.dataset.dropdown];
        if (fn) fn();
        return;
      }
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      const cmd = b.dataset.cmd;
      if (cmd === 'foreColor' || cmd === 'hiliteColor') {
        const fn = CMDS[cmd];
        if (fn) fn(b.dataset.color);
      } else {
        const fn = CMDS[cmd];
        if (fn) fn();
      }
      closeAllPickers();
      e.stopPropagation();
    });

    // 表格选择器：hover 高亮，点击插入
    $('tablePickerGrid').addEventListener('mouseover', function (e) {
      const cell = e.target.closest('.table-picker-cell');
      if (!cell) return;
      highlightTablePicker(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
    });
    $('tablePickerGrid').addEventListener('click', function (e) {
      const cell = e.target.closest('.table-picker-cell');
      if (!cell) return;
      insertTable(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
      $('tablePickerPop').hidden = true;
    });
    document.addEventListener('click', function (e) {
      const inside = e.target.closest('#tablePickerWrap, #formatPickerWrap, #colorPickerWrap, #bgPickerWrap, #alignPickerWrap');
      if (!inside) { closeAllPickers(); }
    });
    // 插入代码弹窗
    $('codeLangList').addEventListener('click', function (e) {
      const b = e.target.closest('.code-lang-item');
      if (!b) return;
      codeLang = b.dataset.lang;
      renderCodeLangList();
    });
    $('codeInsertOk').addEventListener('click', function () { confirmCodeInsert(); });
    $('codeCancel').addEventListener('click', closeCodeModal);
    $('codeModal').addEventListener('click', function (e) {
      if (e.target === $('codeModal')) closeCodeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('codeModal').hidden) closeCodeModal();
    });
    // 代码编辑区：Tab 缩进而非跳焦
    $('codeInput').addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
    });

    // 粘贴：优先内嵌剪贴板里的图片（原图直出，不替换成链接/占位符）；其余按文本/HTML 原样插入
    edBody().addEventListener('paste', function (e) {
      e.preventDefault();
      const cd = e.clipboardData;
      // 1) 剪贴板含图片文件 → 直接内嵌为原图
      const items = cd ? cd.items : null;
      if (items) {
        const imgFiles = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
            const f = items[i].getAsFile();
            if (f) imgFiles.push(f);
          }
        }
        if (imgFiles.length) { embedImages(imgFiles); return; }
      }
      // 2) 兼容：部分浏览器图片以 files 形式出现
      const files = cd ? cd.files : null;
      if (files && files.length) {
        const arr = [];
        for (let i = 0; i < files.length; i++) if (/^image\//.test(files[i].type)) arr.push(files[i]);
        if (arr.length) { embedImages(arr); return; }
      }
      // 3) 文本 / HTML（原有逻辑）
      const html = cd ? cd.getData('text/html') : '';
      const text = cd ? cd.getData('text/plain') : '';
      if (html) {
        let clean = sanitizeHtml(html);
        clean = clean.replace(/\scontenteditable="[^"]*"/gi, '');
        insertHTML(clean);
      } else if (text) {
        insertHTML(esc(text).replace(/\n/g, '<br>'));
      }
    });

    // 拖拽图片：松手即内嵌原图（与粘贴同一套逻辑）
    edBody().addEventListener('dragover', function (e) {
      const dt = e.dataTransfer;
      if (dt && dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          if (dt.items[i].kind === 'file' && /^image\//.test(dt.items[i].type)) { e.preventDefault(); break; }
        }
      }
    });
    edBody().addEventListener('drop', function (e) {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      const arr = [];
      for (let i = 0; i < dt.files.length; i++) if (/^image\//.test(dt.files[i].type)) arr.push(dt.files[i]);
      if (arr.length) { e.preventDefault(); embedImages(arr); }
    });

    // 编辑联动
    edBody().addEventListener('input', updatePreview);
    edBody().addEventListener('scroll', function () {
      if (mode !== 'split') return;
      const pv = $('edPreview');
      const ratio = edBody().scrollTop / Math.max(1, edBody().scrollHeight - edBody().clientHeight);
      pv.scrollTop = ratio * Math.max(0, pv.scrollHeight - pv.clientHeight);
    });
    $('edTitle').addEventListener('input', saveDraftLocal);

    // 标签库选择器（默认收起，点「常用标签库」展开）
    $('tagPickerToggle').addEventListener('click', function () {
      $('tagPicker').classList.toggle('open');
    });
    $('tagFilterInput').addEventListener('input', renderTagPicker);
    $('edTags').addEventListener('input', renderTagPicker);   // 手输时同步高亮
    $('tagPickerBody').addEventListener('click', function (e) {
      const b = e.target.closest('[data-tag]');
      if (b) toggleTag(b.dataset.tag);
    });

    // 快捷键
    edBody().addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); exec('bold'); }
      else if (k === 'i') { e.preventDefault(); exec('italic'); }
      else if (k === 'k') { e.preventDefault(); askLink('link'); }
      else if (k === 's') { e.preventDefault(); saveNote(false); }
    });

    // 链接弹窗
    $('linkOk').addEventListener('click', doLinkInsert);
    $('linkUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLinkInsert(); });

    // (AI / 模板 / 导入 / 导出 已从工具栏移除，如需恢复请重新加回)
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    const query = new URLSearchParams(location.search);
    $('noteSearch').value = query.get('q') || '';
    activeTopic = query.get('tag') || '';
    bind();
    renderNotesCache();
    window.whenAuthed(loadAll);
    window.addEventListener('hashchange', openHashNote);
    window.addEventListener('beforeunload', function (e) {
      if (isAdmin() && !$('editView').hidden && !readOnly && editorSnapshot() !== initialEditorSnapshot) {
        e.preventDefault(); e.returnValue = '';
      }
      if (isAdmin() && !$('editView').hidden && getHtml().trim() && !readOnly) { saveDraftLocal(); stashAutosaveDraft(); }
      reportVisit(Date.now() - visitStart, visitNoteId, visitNoteTitle);
    });
  }

  window.addEventListener('an:before-session-change', function (e) {
    if (isAdmin() && !$('editView').hidden && !readOnly && editorSnapshot() !== initialEditorSnapshot) {
      if (!confirm('当前笔记有未保存的修改。切换身份会关闭编辑器，确定继续吗？')) e.preventDefault();
    }
  });
  window.addEventListener('an:session-reset', function () {
    editorEpoch++; stopAutosave(); stopReaderOutline(); all = []; selected.clear(); editing = null; autosaveId = null; readOnly = true;
    activeTopic = ''; saveInProgress = false;
    listTab = 'published';
    ['edBody', 'edPreview', 'readerTitle', 'readerMeta', 'readerSummary', 'readerEyebrow', 'readerToc', 'noteTopics', 'tagPickerBody', 'noteList', 'boardView'].forEach(function (id) { $(id).replaceChildren(); });
    ['edTitle', 'edSummary', 'edTags'].forEach(function (id) { $(id).value = ''; });
    $('readerOutline').hidden = true;
    $('notesResult').textContent = '正在读取笔记…';
    $('publishedCount').textContent = '0'; $('draftCount').textContent = '0';
    $('notesTabs').hidden = true;
    document.querySelectorAll('#notesTabs .tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'published'); });
    document.body.classList.remove('read-only');
    document.querySelectorAll('.modal').forEach(function (m) { m.hidden = true; });
    visitNoteId = null; visitNoteTitle = ''; show('list');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
