/* ============================================================
   notes.js —— 我的文章：列表 / 阅读 / Markdown 编辑器 / AI 辅助
   依赖：common.js(AN)、marked、DOMPurify、highlight.js
   ============================================================ */
(function () {
  'use strict';

  const $ = AN.$;
  const esc = AN.esc;

  AN.boot({
    title: '我的文章',
    subtitle: '题解 · 思路复盘 · 模板 · 踩坑记录',
    active: 'notes',
    nav: [
      { key: 'home', label: '首页', href: 'index.html', icon: AN.ICONS.home },
      { key: 'wordbook', label: '词汇本', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '文章', href: 'notes.html', icon: AN.ICONS.pen }
    ]
  });

  const LS_DRAFT = 'an_note_draft_v1';
  const LS_MODE = 'an_note_mode_v1';

  let all = [];
  let editing = null;      // 正在编辑的记录（对象）
  let mode = 'split';
  let tagFilter = '';

  /* ---------------- Markdown 渲染 ---------------- */

  const md = window.marked || null;

  marked_useRenderer();

  function marked_useRenderer() {
    if (!md) return;
    md.setOptions({
      gfm: true,
      breaks: false,
      headerIds: true,
      mangle: false
    });
    const r = new md.Renderer();
    // 代码块交给 highlight.js
    r.code = function (code, lang) {
      let c = String(code || '');
      let l = (lang || '').match(/\S*/);
      l = l && l[0] ? l[0] : '';
      let hl = '';
      try {
        if (window.hljs && l && hljs.getLanguage(l)) {
          hl = hljs.highlight(c, { language: l, ignoreIllegals: true }).value;
        } else if (window.hljs) {
          hl = hljs.highlightAuto(c).value;
        } else {
          hl = AN.esc(c);
        }
      } catch (e) { hl = AN.esc(c); }
      return '<pre class="md-code"><div class="code-lang">' + AN.esc(l || 'code') + '</div><code class="hljs">' + hl + '</code></pre>';
    };
    r.image = function (href, title, text) {
      const u = AN.esc(href || '');
      return '<img class="md-img" src="' + u + '" alt="' + AN.esc(text || '') + '"' +
        (title ? ' title="' + AN.esc(title) + '"' : '') + ' loading="lazy">';
    };
    md.use({ renderer: r });
  }

  function renderMd(src) {
    const text = String(src || '');
    if (!md) return '<p class="muted">Markdown 渲染库未加载</p>';
    let html = '';
    try {
      html = md.parse(text, { gfm: true, breaks: false });
    } catch (e) {
      return '<p class="muted">解析失败</p>';
    }
    // 标题自动加锚点 id，方便目录跳转
    html = String(html).replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, function (all_, lv, inner) {
      const plain = inner.replace(/<[^>]+>/g, '');
      const id = 'h-' + Math.abs(hash(plain)).toString(36);
      return '<h' + lv + ' id="' + id + '">' + inner + '</h' + lv + '>';
    });
    if (window.DOMPurify) {
      return DOMPurify.sanitize(html, {
        ADD_ATTR: ['id', 'loading', 'target', 'align'],
        FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
        FORBID_ATTR: ['style', 'onerror', 'onload']
      });
    }
    return html;
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
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
    if (error) {
      $('notesSub').textContent = '读取失败：' + (error.message || '');
      return;
    }
    all = data || [];
    updateSub();
    renderList();
    renderTagFilter();
  }

  function updateSub() {
    const el = $('notesSub');
    if (!el) return;
    if (!AN.getDb()) return;
    el.textContent = '一共 ' + all.length + ' 篇 · 题解、思路复盘、模板与踩坑记录，都存在云端。';
  }

  /* ---------------- 列表 ---------------- */

  function renderList() {
    updateSub();
    const kw = ($('noteSearch').value || '').trim().toLowerCase();
    let list = all;
    if (tagFilter) list = list.filter(function (x) { return arr(x.tags).indexOf(tagFilter) >= 0; });
    if (kw) {
      list = list.filter(function (x) {
        return (x.title || '').toLowerCase().indexOf(kw) >= 0 ||
          (x.summary || '').toLowerCase().indexOf(kw) >= 0 ||
          (x.content || '').toLowerCase().indexOf(kw) >= 0 ||
          arr(x.tags).join(' ').toLowerCase().indexOf(kw) >= 0;
      });
    }

    const box = $('noteList');
    if (!list.length) {
      box.innerHTML = '';
      $('notesEmpty').hidden = !(all.length === 0);
      if (all.length) box.innerHTML = '<p class="muted" style="padding:26px 0">没有匹配的文章</p>';
      return;
    }
    $('notesEmpty').hidden = true;
    box.innerHTML = list.map(function (x) {
      const tags = arr(x.tags);
      const sum = x.summary || AN.autoSummary(x.content);
      return '<article class="note-card" data-id="' + x.id + '">' +
        '<h3 class="note-title">' + esc(x.title || '无标题') + '</h3>' +
        (sum ? '<p class="note-sum">' + esc(sum) + '</p>' : '') +
        '<div class="note-meta">' +
          '<span class="nm-time">' + AN.relTime(x.updated_at || x.created_at) + '</span>' +
          '<span class="nm-words">' + AN.countWords(x.content) + ' 字</span>' +
          (x.category ? '<span class="nm-cat">' + esc(x.category) + '</span>' : '') +
        '</div>' +
        (tags.length ? '<div class="note-tags">' + tags.map(function (t) {
          return '<span class="ntag" data-tag="' + esc(t) + '"># ' + esc(t) + '</span>';
        }).join('') + '</div>' : '') +
      '</article>';
    }).join('');
  }

  function renderTagFilter() {
    const cnt = {};
    all.forEach(function (x) {
      arr(x.tags).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; });
    });
    const keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    const box = $('tagFilter');
    if (!keys.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<button class="fbtn' + (tagFilter ? '' : ' active') + '" data-tag="">全部 ' + all.length + '</button>' +
      keys.map(function (k) {
        return '<button class="fbtn' + (tagFilter === k ? ' active' : '') + '" data-tag="' + esc(k) + '"># ' + esc(k) + ' ' + cnt[k] + '</button>';
      }).join('');
  }

  function arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
    return [];
  }

  /* ---------------- 视图切换 ---------------- */

  function show(which) {
    $('listView').hidden = which !== 'list';
    $('readView').hidden = which !== 'read';
    $('editView').hidden = which !== 'edit';
    window.scrollTo(0, 0);
  }

  /* ---------------- 阅读 ---------------- */

  function openRead(id) {
    const x = all.find(function (n) { return String(n.id) === String(id); });
    if (!x) { AN.toast('文章不存在', true); return; }
    $('rTitle').textContent = x.title || '无标题';
    $('rContent').innerHTML = renderMd(x.content);
    $('rMeta').innerHTML =
      '<span>更新于 ' + AN.fmtDate(x.updated_at || x.created_at) + '</span>' +
      '<span>' + AN.countWords(x.content) + ' 字</span>' +
      '<span>阅读 ' + (x.views || 0) + '</span>' +
      (x.category ? '<span>' + esc(x.category) + '</span>' : '');
    const tags = arr(x.tags);
    $('rTags').innerHTML = tags.map(function (t) {
      return '<span class="ntag"># ' + esc(t) + '</span>';
    }).join('');
    $('rTags').hidden = !tags.length;
    $('readerActions').hidden = !AN.isUnlocked();
    $('readerActions').dataset.id = x.id;
    current = x;
    show('read');
    history.replaceState(null, '', '#n' + x.id);
    bumpView(x.id);
  }

  let current = null;

  async function bumpView(id) {
    const db = AN.getDb();
    if (!db) return;
    try {
      const x = all.find(function (n) { return String(n.id) === String(id); });
      const nv = (x && x.views ? x.views : 0) + 1;
      await db.from('notes').update({ views: nv }).eq('id', id);
      if (x) x.views = nv;
    } catch (e) {}
  }

  /* ---------------- 编辑器 ---------------- */

  function openEditor(rec) {
    editing = rec || null;
    $('edTitle').value = rec ? (rec.title || '') : '';
    $('edSummary').value = rec ? (rec.summary || '') : '';
    $('edTags').value = rec ? arr(rec.tags).join(', ') : '';
    $('edBody').value = rec ? (rec.content || '') : '';
    $('edStatus').textContent = rec ? ('编辑 · ' + (AN.fmtDate(rec.updated_at) || '旧文章')) : '新文章';
    if (!rec) restoreDraft();
    setMode(localStorage.getItem(LS_MODE) || 'split');
    updatePreview();
    show('edit');
    if (!rec) setTimeout(function () { $('edTitle').focus(); }, 60);
  }

  function setMode(m) {
    mode = m;
    $('edPanes').className = 'ed-panes mode-' + m;
    const btns = document.querySelectorAll('#edMode .seg-btn');
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.mode === m);
    }
    try { localStorage.setItem(LS_MODE, m); } catch (e) {}
  }

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null');
      if (d && d.content) {
        $('edTitle').value = d.title || '';
        $('edSummary').value = d.summary || '';
        $('edTags').value = d.tags || '';
        $('edBody').value = d.content || '';
        $('edStatus').textContent = '草稿（已恢复上次没写完的）';
      }
    } catch (e) {}
  }

  function saveDraftLocal() {
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        title: $('edTitle').value,
        summary: $('edSummary').value,
        tags: $('edTags').value,
        content: $('edBody').value
      }));
    } catch (e) {}
  }

  function parseTags() {
    return String($('edTags').value || '')
      .split(/[,，、\s]+/)
      .map(function (s) { return s.trim().replace(/^#/, ''); })
      .filter(Boolean)
      .slice(0, 8);
  }

  function updatePreview() {
    $('edPreview').innerHTML = renderMd($('edBody').value);
    $('edWords').textContent = AN.countWords($('edBody').value);
    saveDraftLocal();
  }

  /* ---------------- 工具栏插入 ---------------- */

  function surround(before, after) {
    const ta = $('edBody');
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const sel = v.slice(s, e);
    ta.value = v.slice(0, s) + before + sel + after + v.slice(e);
    const p = s + before.length;
    ta.focus();
    ta.setSelectionRange(p, p + sel.length);
    updatePreview();
  }

  function prefixLines(prefix) {
    const ta = $('edBody');
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    const le = v.indexOf('\n', e) === -1 ? v.length : v.indexOf('\n', e);
    const block = v.slice(ls, le) || '';
    const out = block.split('\n').map(function (l, i) {
      if (prefix === '1. ') return (i + 1) + '. ' + l.replace(/^\s*\d+\.\s*/, '');
      return prefix + l;
    }).join('\n');
    ta.value = v.slice(0, ls) + out + v.slice(le);
    ta.focus();
    ta.setSelectionRange(ls, ls + out.length);
    updatePreview();
  }

  function insertBlock(text, caretBack) {
    const ta = $('edBody');
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const nlBefore = s === 0 || v[s - 1] === '\n' ? '' : '\n';
    const body = nlBefore + text;
    ta.value = v.slice(0, s) + body + v.slice(e);
    const p = s + body.length - (caretBack || 0);
    ta.focus();
    ta.setSelectionRange(p, p);
    updatePreview();
  }

  const TABLE_TPL = '\n| 左列 | 中列 | 右列 |\n| --- | --- | --- |\n|  |  |  |\n';

  const CMDS = {
    h2: function () { prefixLines('## '); },
    h3: function () { prefixLines('### '); },
    bold: function () { surround('**', '**'); },
    italic: function () { surround('*', '*'); },
    strike: function () { surround('~~', '~~'); },
    code: function () { surround('`', '`'); },
    codeblock: function () {
      const ta = $('edBody');
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel) surround('\n```cpp\n', '\n```\n');
      else insertBlock('\n```cpp\n\n```\n', 9);
    },
    ul: function () { prefixLines('- '); },
    ol: function () { prefixLines('1. '); },
    quote: function () { prefixLines('> '); },
    table: function () { insertBlock(TABLE_TPL); },
    hr: function () { insertBlock('\n---\n'); },
    formula: function () { surround('$', '$'); },
    link: function () { askLink('link'); },
    image: function () { askLink('image'); }
  };

  function askLink(kind) {
    const ta = $('edBody');
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    $('linkTitle').textContent = kind === 'image' ? '插入图片' : '插入链接';
    $('linkUrl').value = '';
    $('linkText').value = sel;
    $('linkModal').dataset.kind = kind;
    $('linkModal').dataset.range = s + ',' + e;
    $('linkModal').hidden = false;
    setTimeout(function () { $('linkUrl').focus(); }, 40);
  }

  function doLinkInsert() {
    const modal = $('linkModal');
    const kind = modal.dataset.kind || 'link';
    const url = $('linkUrl').value.trim();
    if (!url) { AN.toast('地址不能为空', true); return; }
    const text = $('linkText').value.trim();
    const range = String(modal.dataset.range || '0,0').split(',');
    const s = +range[0], e = +range[1];
    const ta = $('edBody');
    const v = ta.value;
    const md2 = kind === 'image'
      ? '![' + (text || '图片') + '](' + url + ')'
      : '[' + (text || url) + '](' + url + ')';
    ta.value = v.slice(0, s) + md2 + v.slice(e);
    const p = s + md2.length;
    ta.focus();
    ta.setSelectionRange(p, p);
    modal.hidden = true;
    updatePreview();
  }

  const TPL = [
    '## 题目描述',
    '',
    '在这里粘贴题面，或者用一两句话概括。',
    '',
    '## 思路',
    '',
    '1. 观察条件…',
    '2. 转化问题…',
    '3. 贪心 / DP / 图论…',
    '',
    '## 正确性说明',
    '',
    '简要说明为什么这样做是对的。',
    '',
    '## 复杂度',
    '',
    '- 时间复杂度：O(...)',
    '- 空间复杂度：O(...)',
    '',
    '## C++17 代码',
    '',
    '```cpp',
    '#include <iostream>',
    'using namespace std;',
    '',
    'int main() {',
    '\tosync_with_stdio(0); cin.tie(0);',
    '\treturn 0;',
    '}',
    '```',
    '',
    '## 踩坑记录',
    '',
    '- '
  ].join('\n');

  /* ---------------- 保存 / 发布 ---------------- */

  async function saveNote(publish) {
    const db = AN.getDb();
    if (!db) { AN.toast('云端未连接，无法保存', true); return; }
    const title = $('edTitle').value.trim();
    const content = $('edBody').value;
    if (!title) { AN.toast('先起个标题', true); $('edTitle').focus(); return; }
    if (publish && !content.trim()) { AN.toast('正文还是空的', true); return; }

    const btn = publish ? $('publishBtn') : $('saveDraftBtn');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '保存中…';

    const rec = {
      title: title,
      content: content,
      summary: $('edSummary').value.trim() || AN.autoSummary(content),
      tags: parseTags(),
      updated_at: new Date().toISOString()
    };

    try {
      if (editing && editing.id) {
        const { error } = await db.from('notes').update(rec).eq('id', editing.id);
        if (error) throw new Error(error.message || '更新失败');
        rec.id = editing.id;
        rec.created_at = editing.created_at;
        rec.views = editing.views;
      } else {
        const { data, error } = await db.from('notes').insert(rec).select();
        if (error) throw new Error(error.message || '写入失败');
        rec.id = data[0].id;
        rec.created_at = data[0].created_at;
        rec.views = 0;
      }
      const i = all.findIndex(function (n) { return String(n.id) === String(rec.id); });
      if (i >= 0) all[i] = rec; else all.push(rec);
      all.sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
      try { localStorage.removeItem(LS_DRAFT); } catch (e) {}
      AN.toast(publish ? '已发布' : '草稿已保存');
      editing = null;
      renderList();
      renderTagFilter();
      openRead(rec.id);
    } catch (e) {
      AN.toast('保存失败：' + (e && e.message ? e.message : e), true);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  async function delNote() {
    if (!current) return;
    if (!confirm('确定删除《' + (current.title || '无标题') + '》？删了就找不回来了。')) return;
    const db = AN.getDb();
    if (!db) return;
    const { error } = await db.from('notes').delete().eq('id', current.id);
    if (error) { AN.toast('删除失败：' + (error.message || ''), true); return; }
    all = all.filter(function (n) { return String(n.id) !== String(current.id); });
    AN.toast('已删除');
    current = null;
    history.replaceState(null, '', 'notes.html');
    renderList();
    renderTagFilter();
    show('list');
  }

  /* ---------------- AI 辅助 ---------------- */

  let aiAct = null;
  let ctx = '';

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
    btn.disabled = true;
    btn.textContent = '生成中…';
    $('aiHint').textContent = '';
    $('aiHint').classList.remove('err');
    const ta = $('edBody');
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    const body = $('edBody').value || ($('edTitle').value || '(还没有正文)');

    if (aiAct === 'continue') {
      $('aiHint').textContent = '取正文最后 1200 字作为上下文…';
      ctx = body.slice(-1200);
    } else if (aiAct === 'title') {
      ctx = (($('edTitle').value ? $('edTitle').value + '\n' : '') + body.slice(0, 1200));
    } else {
      ctx = sel || body.slice(0, 1500);
      if (!sel && aiAct !== 'summary') $('aiHint').textContent = '没选中文字，将使用正文开头部分…';
    }

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
      btn.disabled = false;
      btn.textContent = '开始';
      return;
    }

    applyAI(out.trim());
    btn.disabled = false;
    btn.textContent = '开始';
  }

  function applyAI(out) {
    if (!out) { AN.toast('AI 没返回内容', true); return; }
    if (aiAct === 'title') {
      const lines = out.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length < 60; }).slice(0, 5);
      if (!lines.length) { AN.toast('没拿到标题', true); return; }
      AN.toast('标题建议：' + lines[0]);
      $('edTitle').value = lines[0].replace(/^[\d.、\s]+/, '');
      $('aiModal').hidden = true;
      saveDraftLocal();
      return;
    }
    if (aiAct === 'summary') {
      $('edSummary').value = out.replace(/^["'「\s]+|["'」\s]+$/g, '');
      $('aiModal').hidden = true;
      saveDraftLocal();
      AN.toast('摘要已填好');
      return;
    }
    if (aiAct === 'improve' || aiAct === 'explain') {
      const ta = $('edBody');
      const s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e) { insertBlock('\n' + out + '\n'); }
      else {
        ta.value = ta.value.slice(0, s) + out + ta.value.slice(e);
        const p = s + out.length;
        ta.focus();
        ta.setSelectionRange(p, p);
      }
      $('aiModal').hidden = true;
      updatePreview();
      return;
    }
    // continue / outline：追加到正文末尾
    const ta = $('edBody');
    const v = ta.value.replace(/\s+$/, '');
    ta.value = v + '\n\n' + out + '\n';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    $('aiModal').hidden = true;
    updatePreview();
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    $('noteSearch').addEventListener('input', renderList);

    $('tagFilter').addEventListener('click', function (e) {
      const b = e.target.closest('[data-tag]');
      if (!b) return;
      tagFilter = b.dataset.tag || '';
      renderTagFilter();
      renderList();
    });

    $('newNoteBtn').addEventListener('click', function () {
      AN.askPassword(function () { openEditor(null); });
    });

    $('noteList').addEventListener('click', function (e) {
      const tag = e.target.closest('.ntag');
      if (tag) {
        tagFilter = tag.dataset.tag || '';
        renderTagFilter();
        renderList();
        return;
      }
      const card = e.target.closest('.note-card');
      if (card) openRead(card.dataset.id);
    });

    $('backToList').addEventListener('click', function () {
      history.replaceState(null, '', 'notes.html');
      show('list');
    });

    $('editNoteBtn').addEventListener('click', function () {
      const id = $('readerActions').dataset.id;
      const x = all.find(function (n) { return String(n.id) === String(id); });
      if (x) openEditor(x);
    });

    $('delNoteBtn').addEventListener('click', function () {
      AN.askPassword(function () { delNote(); });
    });

    $('edBack').addEventListener('click', function () {
      if ($('edBody').value.trim() && !editing) {
        if (!confirm('还没发布，确定离开吗？（内容会留在草稿里）')) return;
      }
      show('list');
    });

    $('publishBtn').addEventListener('click', function () {
      AN.askPassword(function () { saveNote(true); });
    });
    $('saveDraftBtn').addEventListener('click', function () { saveNote(false); });

    // 视图切换
    $('edMode').addEventListener('click', function (e) {
      const b = e.target.closest('[data-mode]');
      if (b) setMode(b.dataset.mode);
    });

    // 工具栏
    $('edToolbar').addEventListener('click', function (e) {
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      const fn = CMDS[b.dataset.cmd];
      if (fn) fn();
    });

    $('insertTplBtn').addEventListener('click', function () {
      const ta = $('edBody');
      if (ta.value.trim() && !confirm('当前正文会被模板替换，继续？')) return;
      ta.value = TPL;
      ta.focus();
      updatePreview();
    });

    // 编辑联动
    ['edBody'].forEach(function (id) {
      $(id).addEventListener('input', updatePreview);
      $(id).addEventListener('scroll', function () {
        if (mode !== 'split') return;
        // 分栏滚动同步
        const pv = $('edPreview');
        const ratio = $(id).scrollTop / Math.max(1, $(id).scrollHeight - $(id).clientHeight);
        pv.scrollTop = ratio * Math.max(0, pv.scrollHeight - pv.clientHeight);
      });
    });
    $('edTitle').addEventListener('input', saveDraftLocal);

    // 快捷键
    $('edBody').addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); surround('**', '**'); }
      else if (k === 'i') { e.preventDefault(); surround('*', '*'); }
      else if (k === 'k') { e.preventDefault(); askLink('link'); }
      else if (k === 's') { e.preventDefault(); AN.askPassword(function () { saveNote(false); }); }
    });

    // 链接弹窗
    $('linkOk').addEventListener('click', doLinkInsert);
    $('linkUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLinkInsert(); });

    // AI
    $('aiBtn').addEventListener('click', function () {
      aiAct = 'continue';
      document.querySelectorAll('[data-ai]').forEach(function (b) { b.classList.remove('active'); });
      document.querySelector('[data-ai="continue"]').classList.add('active');
      $('aiRun').disabled = false;
      $('aiHint').textContent = '';
      $('aiModal').hidden = false;
    });
    $('aiModal').addEventListener('click', function (e) {
      const b = e.target.closest('[data-ai]');
      if (!b) return;
      aiAct = b.dataset.ai;
      document.querySelectorAll('[data-ai]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      $('aiRun').disabled = false;
      $('aiHint').textContent = '';
    });
    $('aiRun').addEventListener('click', runAI);

    // 文章内锚点跳转 + 阅读时目录
    $('rContent').addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (a) { e.preventDefault(); location.hash = a.getAttribute('href'); }
    });
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    bind();
    loadAll();
    // 支持 notes.html#n12 直达
    if (location.hash) {
      const m = location.hash.match(/#n(\d+)/);
      if (m) {
        const tryOpen = function () {
          if (all.length) openRead(m[1]);
        };
        setTimeout(tryOpen, 400);
        setTimeout(tryOpen, 1400);
      }
    }
    window.addEventListener('beforeunload', function (e) {
      if (!$('editView').hidden && $('edBody').value.trim()) {
        saveDraftLocal();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
