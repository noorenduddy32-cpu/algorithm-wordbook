/* 首页：内容入口、积累日历与最近记录。 */
(function () {
  'use strict';
  const $ = AN.$, esc = AN.esc;
  let currentWords = [], currentNotes = [];
  AN.boot({ active: 'home' });

  function setText(id, text) { const node = $(id); if (node) node.textContent = text; }
  function visibleNotes(notes) {
    return notes.filter(function (n) { return Auth.role === 'admin' || (n.status === 'published' && n.visibility === 'public'); });
  }
  function renderStats(words, notes) {
    currentWords = words;
    currentNotes = visibleNotes(notes);
    setText('entryWords', words.length);
    setText('entryNotes', currentNotes.length);
    setText('homeScope', Auth.role === 'admin' ? '管理员视角 · 包含私密笔记与草稿' : '公开笔记，随时翻阅。欢迎一起积累。');
    setText('footTip', Auth.role === 'admin' ? '管理全部积累' : '公开分享 · 持续积累');
    renderRecent();
    renderYearOptions();
    renderActivity();
  }
  function renderRecent() {
    const notes = currentNotes.slice().sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); }).slice(0, 4);
    $('recentNotes').innerHTML = notes.length ? notes.map(function (n) {
      const badge = n.status === 'draft' ? '草稿' : n.visibility === 'private' ? '私密' : '';
      const tags = Array.isArray(n.tags) ? n.tags.slice(0, 2).join(' · ') : '';
      return '<a class="recent-row" href="notes.html#n' + encodeURIComponent(n.id) + '">' +
        '<div class="recent-main"><b>' + esc(n.title || '未命名笔记') + '</b>' +
        '<span>' + esc(tags || n.summary || '查看笔记') + '</span></div>' +
        '<div class="recent-side">' + (badge ? '<span class="recent-badge">' + badge + '</span>' : '') +
        '<time>' + esc(AN.fmtDate(n.updated_at || n.created_at)) + '</time></div></a>';
    }).join('') : '<p class="recent-empty">' + (Auth.role === 'admin' ? '还没有笔记，从一道值得复盘的题开始。' : '暂时还没有公开笔记。') + '</p>';
    const words = currentWords.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 4);
    $('recentWords').innerHTML = words.length ? words.map(function (w) {
      return '<a class="recent-row" href="wordbook.html?q=' + encodeURIComponent(w.word || '') + '">' +
        '<div class="recent-main"><b class="mono">' + esc(w.word) + '</b><span>' + esc(w.meaning || '查看词条') + '</span></div>' +
        '<div class="recent-side"><span>' + esc(w.pos || '') + '</span><time>' + esc(AN.fmtDate(w.created_at)) + '</time></div></a>';
    }).join('') : '<p class="recent-empty">还没有词汇，从题面中的第一个陌生词开始。</p>';
  }
  async function loadStats() {
    const cached = NoteCache.get('home');
    if (cached) renderStats(cached.words, cached.notes);
    const role = Auth.role;
    const [w, n] = await Promise.all([
      DB.from('words').select('id,word,pos,meaning,created_at,updated_at'),
      DB.from('notes').select('id,title,summary,tags,status,visibility,created_at,updated_at').order('updated_at', { ascending: false })
    ]);
    if (Auth.role !== role) return;
    if (w.error || n.error) {
      setText('footTip', '暂时无法同步，请刷新重试');
      if (!cached) {
        setText('homeScope', '数据暂时无法加载，请刷新重试');
        setText('activitySum', '数据暂不可用');
        setText('recentNotes', '笔记加载失败，请刷新重试');
        setText('recentWords', '词汇加载失败，请刷新重试');
      }
      return;
    }
    NoteCache.set('home', { words: w.data || [], notes: n.data || [] });
    renderStats(w.data || [], n.data || []);
  }

  function dayKey(d) { return AN.fmtDate(d); }
  function activityMap() {
    const map = {};
    currentWords.concat(currentNotes).forEach(function (row) {
      const created = dayKey(row.created_at), updated = dayKey(row.updated_at);
      if (created) map[created] = (map[created] || 0) + 1;
      if (updated && updated !== created) map[updated] = (map[updated] || 0) + 1;
    });
    return map;
  }
  function renderYearOptions() {
    const nowYear = new Date().getFullYear();
    const years = new Set([nowYear]);
    Object.keys(activityMap()).forEach(function (key) { const y = Number(key.slice(0, 4)); if (y <= nowYear) years.add(y); });
    const selected = Number($('activityYear').value) || nowYear;
    $('activityYear').innerHTML = Array.from(years).sort(function (a, b) { return b - a; }).map(function (year) {
      return '<option value="' + year + '"' + (year === selected ? ' selected' : '') + '>' + year + ' 年</option>';
    }).join('');
  }
  function renderActivity() {
    const year = Number($('activityYear').value) || new Date().getFullYear();
    const map = activityMap(), start = new Date(year, 0, 1), end = new Date(year, 11, 31);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    end.setDate(end.getDate() + (6 - (end.getDay() + 6) % 7));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cur = new Date(start), months = [];
    let cells = '', index = 0, days = 0, total = 0, run = 0, longest = 0;
    while (cur <= end) {
      const inYear = cur.getFullYear() === year, future = cur > today;
      const key = dayKey(cur), count = inYear && !future ? (map[key] || 0) : 0;
      if (inYear && cur.getDate() === 1) months.push({ month: cur.getMonth() + 1, col: Math.floor(index / 7) });
      if (count) { days++; total += count; run++; longest = Math.max(longest, run); } else run = 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      const title = key + (future ? '：尚未到来' : '：' + count + ' 条记录');
      cells += '<i class="act-day lv' + level + (inYear ? '' : ' blank') + (future ? ' future' : '') +
        (key === dayKey(today) ? ' today' : '') + '" title="' + title + '" aria-hidden="true"></i>';
      index++; cur.setDate(cur.getDate() + 1);
    }
    const cols = index / 7;
    $('activityGrid').innerHTML = cells;
    $('activityGrid').style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    $('activityMonths').innerHTML = months.map(function (m) { return '<span style="left:' + (m.col / cols * 100) + '%">' + m.month + '月</span>'; }).join('');
    setText('actStreak', longest); setText('actTotal', total); setText('actDays', days);
    setText('activitySum', year + ' 年 · ' + days + ' 天有积累');
    $('activityGrid').setAttribute('role', 'img');
    $('activityGrid').setAttribute('aria-label', year + ' 年，' + days + ' 天有积累，共 ' + total + ' 条记录，最长连续 ' + longest + ' 天');
  }
  $('activityYear').addEventListener('change', renderActivity);
  window.addEventListener('an:session-reset', function () {
    currentWords = []; currentNotes = [];
    ['recentWords', 'recentNotes', 'activityGrid', 'activityMonths', 'activityYear'].forEach(function (id) { $(id).replaceChildren(); });
    setText('entryWords', '—'); setText('entryNotes', '—');
  });
  window.whenAuthed(loadStats);
})();
