/* ============================================================
   notes.js —— 我的文章：列表 / 阅读 / CSDN 风格富文本编辑器 / AI 辅助
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
    title: '我的文章',
    subtitle: '题解 · 思路复盘 · 模板 · 踩坑记录',
    active: 'notes',
    nav: [
      { key: 'home', label: '首页', href: 'index.html', icon: AN.ICONS.home },
      { key: 'wordbook', label: '词汇', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '文章', href: 'notes.html', icon: AN.ICONS.pen },
      { key: 'visits', label: '访问记录', href: 'visits.html', icon: AN.ICONS.file, adminOnly: true }
    ]
  });

  const LS_DRAFT = 'an_note_draft_v2';
  const LS_MODE = 'an_note_mode_v1';

  let all = [];
  let editing = null;
  let mode = 'edit';
  let tagFilter = '';
  let listTab = 'published';   // published | draft
  let readOnly = false;

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

  // 旧文章可能是 Markdown：含块级 HTML 标签就当 HTML，含 Markdown 标记就转 HTML，否则当纯文本
  function toHtml(content) {
    const s = String(content || '');
    if (/<(p|div|h[1-6]|pre|ul|ol|table|blockquote|img|a|code|span|b|i|strong|em|br|hr|li)\b/i.test(s)) return s;
    if (/^#{1,6}\s|```|\n>\s|\n[-*]\s|\n\d+\.\s|\[[^\]]+\]\(|\n\s*\|/.test(s)) {
      return md ? md.parse(s) : '<p>' + esc(s) + '</p>';
    }
    return '<p>' + esc(s) + '</p>';
  }

  const PURIFY = {
    ADD_TAGS: ['style', 'font', 'section', 'figure', 'figcaption', 'picture', 'source', 'details', 'summary'],
    ADD_ATTR: ['style', 'target', 'align', 'loading', 'controls', 'colspan', 'rowspan', 'cellspacing', 'cellpadding'],
    FORBID_TAGS: ['script', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'contenteditable']
  };
  function sanitizeHtml(s) {
    if (window.DOMPurify) return DOMPurify.sanitize(s, PURIFY);
    return s;
  }

  // 渲染正文（HTML 消毒 + 标题锚点 + 代码块增强）
  function renderContent(html) {
    let out = sanitizeHtml(String(html || ''));
    out = out.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, function (all_, lv, inner) {
      const plain = stripHtml(inner);
      const id = 'h-' + Math.abs(hash(plain)).toString(36);
      return '<h' + lv + ' id="' + id + '">' + inner + '</h' + lv + '>';
    });
    return out;
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
      const gutter = lines.map(function (_, i) { return i + 1; }).join('\n');
      const bar = '<div class="code-bar"><span class="code-lang">' + esc(lang) + '</span>' +
        '<span class="code-btns">' +
        (lines.length > 10 ? '<button type="button" class="code-toggle">展开</button>' : '') +
        '<button type="button" class="code-wrap">换行</button></span></div>';
      const area = '<div class="code-area"><span class="ln-gutter">' + gutter + '</span>' + code.outerHTML + '</div>';
      pre.className = (pre.className + ' code-enh').trim();
      pre.innerHTML = bar + area;
      if (lines.length > 10) pre.classList.add('collapsed');
      pre.querySelectorAll('.code-toggle').forEach(function (b) {
        b.addEventListener('click', function () {
          pre.classList.toggle('expanded');
          b.textContent = pre.classList.contains('expanded') ? '收起' : '展开';
        });
      });
      pre.querySelectorAll('.code-wrap').forEach(function (b) {
        b.addEventListener('click', function () {
          pre.classList.toggle('wrapped');
          b.textContent = pre.classList.contains('wrapped') ? '不换行' : '换行';
        });
      });
    });
  }

  /* ---------------- 数据 ---------------- */

  async function loadAll() {
    const db = AN.getDb();
    if (!db) {
      $('notesSub').textContent = '云端未连接：请确认能联网加载云端 SDK';
      $('noteList').innerHTML = '<p class="muted" style="padding:30px 0">读不到数据，刷新页面重试。</p>';
      return;
    }
    const { data, error } = await db.from('notes').select('*').order('updated_at', { ascending: false });
    if (error) { $('notesSub').textContent = '读取失败：' + (error.message || ''); return; }
    all = data || [];
    $('notesTabs').hidden = !isAdmin();
    // 非管理员只看已发布
    if (!isAdmin()) listTab = 'published';
    updateSub();
    renderList();
    renderTagFilter();
  }

  function updateSub() {
    const el = $('notesSub');
    if (!el || !AN.getDb()) return;
    el.textContent = '一共 ' + all.length + ' 篇 · 题解、思路复盘、模板与踩坑记录，都存在云端。';
  }

  /* ---------------- 列表 ---------------- */

  function renderList() {
    updateSub();
    const kw = ($('noteSearch').value || '').trim().toLowerCase();
    let list = all;
    // 草稿箱仅管理员可见；访客/普通用户永远只看已发布
    if (isAdmin()) {
      list = list.filter(function (x) { return (x.status || 'draft') === listTab; });
    } else {
      list = list.filter(function (x) { return (x.status || 'draft') === 'published'; });
    }
    if (tagFilter) list = list.filter(function (x) { return arr(x.tags).indexOf(tagFilter) >= 0; });
    if (kw) {
      list = list.filter(function (x) {
        return (x.title || '').toLowerCase().indexOf(kw) >= 0 ||
          (x.summary || '').toLowerCase().indexOf(kw) >= 0 ||
          (stripHtml(x.content) || '').toLowerCase().indexOf(kw) >= 0 ||
          arr(x.tags).join(' ').toLowerCase().indexOf(kw) >= 0;
      });
    }
    const box = $('noteList');
    if (!list.length) {
      const totallyEmpty = all.filter(function (x) { return isAdmin() ? true : (x.status === 'published'); }).length === 0;
      $('notesEmpty').hidden = !totallyEmpty;
      box.innerHTML = (all.length && !totallyEmpty) ? '<p class="muted" style="padding:26px 0">没有匹配的文章</p>' : '';
      return;
    }
    $('notesEmpty').hidden = true;
    box.innerHTML = list.map(function (x) {
      const tags = arr(x.tags);
      const sum = x.summary || autoSummary(x.content);
      const isDraft = (x.status || 'draft') === 'draft';
      const isPrivate = (x.visibility || 'private') === 'private';
      return '<article class="note-card" data-id="' + x.id + '" data-status="' + (x.status || 'draft') + '">' +
        '<div class="note-title-row">' +
          '<h3 class="note-title">' + esc(x.title || '无标题') + '</h3>' +
          '<span class="note-badge ' + (isDraft ? 'draft' : isPrivate ? 'private' : 'public') + '">' +
            (isDraft ? '草稿' : isPrivate ? '私密' : '公开') +
          '</span>' +
        '</div>' +
        (sum ? '<p class="note-sum">' + esc(sum) + '</p>' : '') +
        '<div class="note-meta">' +
          '<span class="nm-time">' + AN.relTime(x.updated_at || x.created_at) + '</span>' +
          '<span class="nm-words">' + countWords(x.content) + ' 字</span>' +
          '<span class="nm-views">' + (x.views || 0) + ' 阅读</span>' +
        '</div>' +
        (tags.length ? '<div class="note-tags">' + tags.map(function (t, idx) {
          return '<span class="ntag ntag-' + tagColorIndex(t) + '" data-tag="' + esc(t) + '">' + esc(t) + '</span>';
        }).join('') + '</div>' : '') +
      '</article>';
    }).join('');
  }

  function renderTagFilter() {
    // 过滤统计只看当前 tab 下的文章
    const visible = all.filter(function (x) {
      if (!isAdmin()) return (x.status || 'draft') === 'published';
      return (x.status || 'draft') === listTab;
    });
    const cnt = {};
    visible.forEach(function (x) { arr(x.tags).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    const keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    const box = $('tagFilter');
    if (!keys.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<button class="fbtn' + (tagFilter ? '' : ' active') + '" data-tag="">全部 ' + visible.length + '</button>' +
      keys.map(function (k) {
        return '<button class="fbtn ntag-' + tagColorIndex(k) + (tagFilter === k ? ' active' : '') + '" data-tag="' + esc(k) + '">' + esc(k) + ' ' + cnt[k] + '</button>';
      }).join('');
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
    $('listView').hidden = which !== 'list';
    $('editView').hidden = which !== 'edit';
    if (which === 'list') startVisit(null);
    window.scrollTo(0, 0);
  }

  /* ---------------- 编辑器（富文本） ---------------- */

  function edBody() { return $('edBody'); }

  function getHtml() { return edBody().innerHTML; }

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
    saveDraftLocal();
  }

  function openEditor(rec, opts) {
    opts = opts || {};
    editing = rec || null;
    readOnly = !!opts.readOnly;

    $('edTitle').value = rec ? (rec.title || '') : '';
    $('edSummary').value = rec ? (rec.summary || '') : '';
    $('edTags').value = rec ? arr(rec.tags).join(', ') : '';
    $('edVisibility').value = rec ? (rec.visibility || 'private') : 'private';
    edBody().innerHTML = rec ? toHtml(rec.content) : '';
    if (readOnly) enhanceCodeBlocks(edBody());

    // 只读模式：标题、摘要、正文不可改；工具栏、保存/发布按钮隐藏
    const editable = !readOnly;
    $('edTitle').readOnly = !editable;
    $('edSummary').readOnly = !editable;
    $('edTags').readOnly = !editable;
    $('edVisibility').disabled = !editable;
    edBody().contentEditable = editable ? 'true' : 'false';
    $('edToolbar').hidden = readOnly;
    $('saveDraftBtn').hidden = readOnly;
    $('publishBtn').hidden = readOnly;
    $('delNoteBtn').hidden = readOnly || !(rec && rec.id);
    $('edMode').hidden = readOnly;
    document.body.classList.toggle('read-only', readOnly);

    if (readOnly) {
      $('edStatus').textContent = '只读预览 · ' + ((rec && rec.visibility === 'public') ? '公开文章' : '私密文章');
    } else if (rec) {
      const st = (rec.status || 'draft') === 'draft' ? '草稿' : '已发布';
      const vis = (rec.visibility || 'private') === 'public' ? '公开' : '私密';
      $('edStatus').textContent = '编辑 · ' + st + ' · ' + vis;
    } else {
      $('edStatus').textContent = '新文章';
    }

    if (!rec) restoreDraft();
    setMode(readOnly ? 'preview' : (localStorage.getItem(LS_MODE) || 'edit'));
    updatePreview();
    show('edit');
    if (rec) startVisit(rec.id, rec.title);
    else startVisit(null);
    if (!rec && !readOnly) setTimeout(function () { edBody().focus(); }, 60);
  }

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null');
      if (d && d.content) {
        $('edTitle').value = d.title || '';
        $('edSummary').value = d.summary || '';
        $('edTags').value = d.tags || '';
        edBody().innerHTML = d.content || '';
        $('edStatus').textContent = '草稿（已恢复上次没写完的）';
      }
    } catch (e) {}
  }

  function saveDraftLocal() {
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        title: $('edTitle').value, summary: $('edSummary').value,
        tags: $('edTags').value, content: getHtml()
      }));
    } catch (e) {}
  }

  function parseTags() {
    return String($('edTags').value || '')
      .split(/[,，、\s]+/).map(function (s) { return s.trim().replace(/^#/, ''); })
      .filter(Boolean).slice(0, 8);
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
    h2: function () { exec('formatBlock', 'H2'); },
    h3: function () { exec('formatBlock', 'H3'); },
    bold: function () { exec('bold'); },
    italic: function () { exec('italic'); },
    strike: function () { exec('strikeThrough'); },
    code: function () { const s = getSelText(); insertHTML('<code>' + esc(s || '代码') + '</code>'); },
    codeblock: function () {
      const s = getSelText();
      insertHTML('<pre><code class="language-cpp">' + esc(s || '// 在这里写代码') + '</code></pre><p><br></p>');
      // 把光标放进刚插入的代码块里，方便直接写代码
      const pres = edBody().querySelectorAll('pre.code-enh, pre');
      const last = pres[pres.length - 1];
      const codeEl = last && last.querySelector('code');
      if (codeEl) {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
      }
      updatePreview();
    },
    ul: function () { exec('insertUnorderedList'); },
    ol: function () { exec('insertOrderedList'); },
    quote: function () { exec('formatBlock', 'BLOCKQUOTE'); },
    table: function () { toggleTablePicker(); },
    hr: function () { insertHTML('<hr><p><br></p>'); },
    formula: function () { const s = getSelText(); insertHTML('<code class="math">$' + esc(s || '公式') + '$</code>'); },
    link: function () { askLink('link'); },
    image: function () { askLink('image'); }
  };

  function insertTable(rows, cols) {
    let ths = '', tds = '';
    for (let i = 0; i < cols; i++) { ths += '<th> </th>'; tds += '<td> </td>'; }
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
    if (readOnly) { AN.toast('只读模式不能保存', true); return; }
    const db = AN.getDb();
    if (!db) { AN.toast('云端未连接，无法保存', true); return; }
    const title = $('edTitle').value.trim();
    if (!title) { AN.toast('先起个标题', true); $('edTitle').focus(); return; }
    const content = sanitizeHtml(getHtml());
    if (publish && !stripHtml(content).trim()) { AN.toast('正文还是空的', true); return; }

    const btn = publish ? $('publishBtn') : $('saveDraftBtn');
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = '保存中…';

    const rec = {
      title: title,
      content: content,
      summary: $('edSummary').value.trim() || autoSummary(content),
      tags: parseTags(),
      status: publish ? 'published' : 'draft',
      visibility: $('edVisibility').value || 'private',
      updated_at: new Date().toISOString()
    };

    try {
      if (editing && editing.id) {
        const { error } = await db.from('notes').update(rec).eq('id', editing.id);
        if (error) throw new Error(error.message || '更新失败');
        rec.id = editing.id; rec.created_at = editing.created_at; rec.views = editing.views;
      } else {
        const { data, error } = await db.from('notes').insert(rec).select();
        if (error) throw new Error(error.message || '写入失败');
        rec.id = data[0].id; rec.created_at = data[0].created_at; rec.views = 0;
      }
      AN.bumpActivity(publish ? 2 : 1);
      const i = all.findIndex(function (n) { return String(n.id) === String(rec.id); });
      if (i >= 0) all[i] = rec; else all.push(rec);
      all.sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
      try { localStorage.removeItem(LS_DRAFT); } catch (e) {}
      AN.toast(publish ? '已发布' : '草稿已保存');
      editing = null;
      listTab = rec.status;
      document.querySelectorAll('#notesTabs .tab-btn').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === listTab); });
      renderList(); renderTagFilter();
      show('list');
    } catch (e) {
      AN.toast('保存失败：' + (e && e.message ? e.message : e), true);
    } finally {
      btn.disabled = false; btn.textContent = old;
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
    AN.toast('已删除');
    editing = null;
    history.replaceState(null, '', 'notes.html');
    renderList(); renderTagFilter();
    show('list');
  }

  /* ---------------- AI 辅助 ---------------- */

  let aiAct = null;

  const AI_PROMPTS = {
    continue: '你是算法竞赛教练。下面是用户正在写的题解笔记的末尾，请顺着往下补充 200-400 字（思路细化 / 正确性说明 / 复杂度分析）。只输出可直接插入的 Markdown 正文，不要重复已有内容，不要客套。\n\n---\n',
    improve: '请润色下面这段竞赛题解文字，让它更清晰紧凑，保持 Markdown 格式，只输出润色后的内容。\n\n---\n',
    outline: '围绕下面的内容，给出一个简洁的 Markdown 小标题提纲（用 ## 和 ###，不要正文）。\n\n---\n',
    explain: '用简洁清晰的中文解释下面这段内容，如果涉及算法请说明复杂度和适用场景。只输出解释部分。\n\n---\n',
    summary: '为下面的文章写一句 60-90 字的概括摘要，只输出摘要本身，不要引号。\n\n---\n',
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
      const models = await cloud.llm.models.list();
      const m = (models || []).find(function (x) { return x.disabled !== true; });
      if (!m) throw new Error('没有可用模型');
      const opts = {
        model: m.id,
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
    $('noteSearch').addEventListener('input', renderList);

    $('tagFilter').addEventListener('click', function (e) {
      const b = e.target.closest('[data-tag]');
      if (!b) return;
      tagFilter = b.dataset.tag || '';
      renderTagFilter(); renderList();
    });

    $('newNoteBtn').addEventListener('click', function () { openEditor(null); });

    $('noteList').addEventListener('click', function (e) {
      const tag = e.target.closest('.ntag');
      if (tag) { tagFilter = tag.dataset.tag || ''; renderTagFilter(); renderList(); return; }
      const card = e.target.closest('.note-card');
      if (!card) return;
      const id = card.dataset.id;
      const x = all.find(function (n) { return String(n.id) === String(id); });
      if (!x) return;
      // 管理员且是草稿/已发布 -> 可编辑；访客/管理员看他人公开文章 -> 只读
      const canEdit = isAdmin();
      openEditor(x, { readOnly: !canEdit });
    });

    $('notesTabs').addEventListener('click', function (e) {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      listTab = b.dataset.tab;
      document.querySelectorAll('#notesTabs .tab-btn').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === listTab); });
      tagFilter = '';
      renderTagFilter(); renderList();
    });

    $('edBack').addEventListener('click', function () {
      if (!readOnly && getHtml().trim() && !editing) {
        if (!confirm('还没发布，确定离开吗？（内容会留在草稿里）')) return;
      }
      history.replaceState(null, '', 'notes.html');
      show('list');
    });

    $('publishBtn').addEventListener('click', function () { saveNote(true); });
    $('saveDraftBtn').addEventListener('click', function () { saveNote(false); });
    $('delNoteBtn').addEventListener('click', delNote);

    $('edMode').addEventListener('click', function (e) {
      const b = e.target.closest('[data-mode]');
      if (b) setMode(b.dataset.mode);
    });

    $('edToolbar').addEventListener('click', function (e) {
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      const fn = CMDS[b.dataset.cmd];
      if (fn) fn();
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
      if (!$('tablePickerPop').hidden && !e.target.closest('#tablePickerWrap')) {
        $('tablePickerPop').hidden = true;
      }
    });

    $('insertTplBtn').addEventListener('click', function () {
      if (getHtml().trim() && !confirm('当前正文会被模板替换，继续？')) return;
      edBody().innerHTML = TPL;
      updatePreview();
    });

    // 粘贴：从剪贴板取 HTML 并消毒后原样插入（复制的题目 / 博客原原本本契合）
    edBody().addEventListener('paste', function (e) {
      e.preventDefault();
      const cd = e.clipboardData;
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

    // 编辑联动
    edBody().addEventListener('input', updatePreview);
    edBody().addEventListener('scroll', function () {
      if (mode !== 'split') return;
      const pv = $('edPreview');
      const ratio = edBody().scrollTop / Math.max(1, edBody().scrollHeight - edBody().clientHeight);
      pv.scrollTop = ratio * Math.max(0, pv.scrollHeight - pv.clientHeight);
    });
    $('edTitle').addEventListener('input', saveDraftLocal);

    // 快捷键
    edBody().addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); exec('bold'); }
      else if (k === 'i') { e.preventDefault(); exec('italic'); }
      else if (k === 'k') { e.preventDefault(); askLink('link'); }
      else if (k === 's') { e.preventDefault(); saveNote(false); }
    });

    // 导入 / 导出
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) doImport(f);
      e.target.value = '';
    });
    $('exportBtn').addEventListener('click', doExport);

    // 链接弹窗
    $('linkOk').addEventListener('click', doLinkInsert);
    $('linkUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLinkInsert(); });

    // AI
    $('aiBtn').addEventListener('click', function () {
      aiAct = 'continue';
      document.querySelectorAll('[data-ai]').forEach(function (b) { b.classList.remove('active'); });
      document.querySelector('[data-ai="continue"]').classList.add('active');
      $('aiRun').disabled = false; $('aiHint').textContent = '';
      $('aiModal').hidden = false;
    });
    $('aiModal').addEventListener('click', function (e) {
      const b = e.target.closest('[data-ai]');
      if (!b) return;
      aiAct = b.dataset.ai;
      document.querySelectorAll('[data-ai]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      $('aiRun').disabled = false; $('aiHint').textContent = '';
    });
    $('aiRun').addEventListener('click', runAI);
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    bind();
    window.whenAuthed(loadAll);
    if (location.hash) {
      const m = location.hash.match(/#n(\d+)/);
      if (m) {
        const tryOpen = function () {
          const x = all.find(function (n) { return String(n.id) === String(m[1]); });
          if (x) openEditor(x, { readOnly: !isAdmin() });
        };
        setTimeout(tryOpen, 400);
        setTimeout(tryOpen, 1400);
      }
    }
    window.addEventListener('beforeunload', function () {
      if (!$('editView').hidden && getHtml().trim() && !readOnly) saveDraftLocal();
      reportVisit(Date.now() - visitStart, visitNoteId, visitNoteTitle);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
