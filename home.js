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
    setText('homeScope', Auth.role === 'admin' ? '管理员视角 · 包含私密笔记与草稿' : '访客视角 · 已通过访问密码验证');
    setText('footTip', Auth.role === 'admin' ? '管理全部积累' : '公开分享 · 持续积累');
    renderRecent();
    renderYearOptions();
    renderActivity();
  }
  function renderRecent() {
    const notes = currentNotes.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3);
    $('recentNotes').innerHTML = notes.length ? notes.map(function (note) {
      const badge = note.status === 'draft' ? '草稿' : note.visibility === 'private' ? '私密' : '';
      const tags = Array.isArray(note.tags) ? note.tags.slice(0, 2).join(' / ') : '';
      return '<a class="recent-note" href="notes.html#n' + encodeURIComponent(note.id) + '">' +
        '<div class="note-row-meta"><span>' + esc(tags || '解题记录') + (badge ? '<span class="recent-badge">' + badge + '</span>' : '') + '</span><time>' + esc(AN.fmtDate(note.updated_at || note.created_at)) + '</time></div>' +
        '<h3>' + esc(note.title || '未命名笔记') + '</h3><p>' + esc(note.summary || '打开笔记，回到当时的思考。') + '</p></a>';
    }).join('') : '<p class="empty-state">' + (Auth.role === 'admin' ? '从一道值得复盘的题开始。<a href="notes.html">写下第一篇笔记 →</a>' : '第一篇公开笔记正在路上。<a href="wordbook.html">先翻翻题面词汇 →</a>') + '</p>';
    const words = currentWords.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
    $('recentWords').innerHTML = words.length ? words.map(function (word) {
      return '<a class="word-row" href="wordbook.html?q=' + encodeURIComponent(word.word || '') + '"><div class="word-row-main"><b>' + esc(word.word) + ' <small>' + esc(word.pos || '') + '</small></b><p>' + esc(word.meaning || '查看词条') + '</p></div><span aria-hidden="true">↗</span></a>';
    }).join('') : '<p class="empty-state">从题面中的第一个陌生词开始。</p>';
    const counts = new Map();
    currentNotes.forEach(note => (Array.isArray(note.tags) ? [...new Set(note.tags)] : []).forEach(tag => {
      if (typeof tag === 'string' && tag.trim()) counts.set(tag.trim(), (counts.get(tag.trim()) || 0) + 1);
    }));
    const topics = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).slice(0, 8);
    $('topicLinks').innerHTML = topics.length ? topics.map(([tag, count]) => '<a href="notes.html?q=' + encodeURIComponent(tag) + '">' + esc(tag) + '<span>' + count + '</span></a>').join('') : '<span class="muted small">笔记的主题标签会出现在这里。</span>';
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
    ['recentWords', 'recentNotes', 'topicLinks', 'activityGrid', 'activityMonths', 'activityYear'].forEach(function (id) { $(id).replaceChildren(); });
    setText('entryWords', '—'); setText('entryNotes', '—');
  });
  $('todayLabel').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !event.target.closest('input,textarea,select,[contenteditable="true"]') && !document.querySelector('.modal:not([hidden]),#gate')) {
      event.preventDefault(); $('homeQuery').focus();
    }
  });
  $('homeSearch').addEventListener('submit', function (event) {
    $('homeQuery').value = $('homeQuery').value.trim();
    if (!$('homeQuery').value) { event.preventDefault(); $('homeQuery').focus(); }
  });

  const PROFILE_KEY = 'an_platform_profiles_v1', COMPETITIVE_CACHE = 'an_competitive_cache_v1';
  let competitiveData = null;
  function labels(key) { return window.ANI18n ? ANI18n.t(key) : key; }
  function readProfiles() {
    const base = Object.assign({ codeforces: '', atcoder: '', luogu: '' }, (AN.cfg && AN.cfg.platforms) || {});
    try { return Object.assign(base, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { return base; }
  }
  function safeHandle(value) { value = String(value || '').trim(); return /^[A-Za-z0-9_.-]{1,40}$/.test(value) ? value : ''; }
  function platformUrl(name, handle) {
    if (name === 'codeforces') return handle ? 'https://codeforces.com/profile/' + encodeURIComponent(handle) : 'https://codeforces.com/';
    if (name === 'atcoder') return handle ? 'https://atcoder.jp/users/' + encodeURIComponent(handle) : 'https://atcoder.jp/';
    return handle ? 'https://www.luogu.com.cn/user/' + encodeURIComponent(handle) : 'https://www.luogu.com.cn/';
  }
  function renderPlatforms(data) {
    const profiles = readProfiles();
    const defs = [
      { key: 'codeforces', name: 'Codeforces', color: '#4da6ff' },
      { key: 'atcoder', name: 'AtCoder', color: '#e4a853' },
      { key: 'luogu', name: '洛谷', color: '#34c58d' }
    ];
    $('platformCards').innerHTML = defs.map(function (def) {
      const handle = safeHandle(profiles[def.key]);
      const stats = data && data[def.key];
      const today = stats ? stats.todayAccepted : '—';
      const accuracy = stats ? stats.acceptance + '%' : '—';
      const extra = stats && def.key === 'codeforces' && stats.rating ? ' · rating ' + stats.rating : '';
      return '<article class="platform-card" style="--platform-color:' + def.color + '">' +
        '<a class="platform-name" href="' + platformUrl(def.key, handle) + '" target="_blank" rel="noopener"><i></i><span>' + def.name + '<small class="platform-handle">' + esc(handle ? '@' + handle + extra : labels('home.unconfigured')) + '</small></span></a>' +
        '<div class="platform-metrics"><div class="platform-metric"><b>' + today + '</b><span>' + labels('home.today') + '</span></div><div class="platform-metric"><b>' + accuracy + '</b><span>' + labels('home.accuracy') + '</span></div></div>' +
        '<a class="platform-link" href="' + platformUrl(def.key, handle) + '" target="_blank" rel="noopener">' + (handle ? labels('home.live') : labels('home.configure')) + '</a></article>';
    }).join('');
  }
  function renderContests(rows) {
    rows = Array.isArray(rows) ? rows : [];
    $('contestList').innerHTML = rows.length ? rows.slice(0, 5).map(function (contest) {
      const date = new Date(contest.startTimeSeconds * 1000);
      const md = new Intl.DateTimeFormat(ANI18n && ANI18n.language === 'en' ? 'en' : 'zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(date);
      const time = new Intl.DateTimeFormat(ANI18n && ANI18n.language === 'en' ? 'en' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(date);
      const hours = Math.round(contest.durationSeconds / 360) / 10;
      return '<a class="contest-item" href="' + esc(contest.url) + '" target="_blank" rel="noopener"><span class="contest-date">' + esc(md) + '<br>' + esc(time) + '</span><span class="contest-copy"><b>' + esc(contest.name) + '</b><span>Codeforces · UTC+8</span></span><span class="contest-duration">' + hours + 'h</span></a>';
    }).join('') : '<p class="empty-state">' + labels('home.noContest') + '</p>';
  }
  async function loadCompetitive(force) {
    if (!force) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(COMPETITIVE_CACHE) || 'null');
        if (cached && Date.now() - cached.time < 600000) { competitiveData = cached.data; renderPlatforms(competitiveData); renderContests(competitiveData.contests); }
      } catch (e) {}
    }
    const profiles = readProfiles();
    try {
      const query = new URLSearchParams({ cf: safeHandle(profiles.codeforces), atcoder: safeHandle(profiles.atcoder) });
      const response = await ANRequest('/api/competitive?' + query.toString(), { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      competitiveData = await response.json();
      sessionStorage.setItem(COMPETITIVE_CACHE, JSON.stringify({ time: Date.now(), data: competitiveData }));
      renderPlatforms(competitiveData); renderContests(competitiveData.contests);
    } catch (e) {
      if (!competitiveData) { renderPlatforms(null); renderContests([]); }
    }
  }
  function openProfiles() {
    const profiles = readProfiles();
    $('profileCodeforces').value = profiles.codeforces || '';
    $('profileAtcoder').value = profiles.atcoder || '';
    $('profileLuogu').value = profiles.luogu || '';
    $('profileSettings').hidden = false; $('profileCodeforces').focus();
  }
  $('openProfileSettings').addEventListener('click', openProfiles);
  $('refreshPlatforms').addEventListener('click', function () { loadCompetitive(true); });
  document.querySelectorAll('[data-close="profileSettings"]').forEach(function (button) { button.addEventListener('click', function () { $('profileSettings').hidden = true; }); });
  $('profileSettingsForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const value = { codeforces: safeHandle($('profileCodeforces').value), atcoder: safeHandle($('profileAtcoder').value), luogu: safeHandle($('profileLuogu').value) };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
    sessionStorage.removeItem(COMPETITIVE_CACHE); $('profileSettings').hidden = true; loadCompetitive(true);
  });
  window.addEventListener('an:language', function () { renderPlatforms(competitiveData); renderContests(competitiveData && competitiveData.contests); });
  renderPlatforms(null);
  window.whenAuthed(function () { loadStats(); loadCompetitive(false); });
})();
