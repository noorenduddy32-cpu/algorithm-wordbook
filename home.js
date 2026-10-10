/* 首页：内容入口、积累日历与最近记录。 */
(function () {
  'use strict';
  const $ = AN.$, esc = AN.esc;
  let currentWords = [], currentNotes = [];
  let statsGeneration = 0;
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
    const generation = ++statsGeneration, role = Auth.role;
    const cached = NoteCache.get('home') || { words: NoteCache.get('words') || [], notes: NoteCache.get('notes') || [] };
    currentWords = cached.words || []; currentNotes = cached.notes || [];
    renderStats(currentWords, currentNotes);
    const failures = [];
    async function update(name, query) {
      const result = await query;
      if (Auth.role !== role || generation !== statsGeneration) return;
      if (result.error) {
        failures.push(name);
        setText('footTip', '部分数据暂未同步，正在显示已保存的内容');
        return;
      }
      if (name === 'words') currentWords = result.data || [];
      else currentNotes = result.data || [];
      NoteCache.set('home', { words: currentWords, notes: currentNotes });
      renderStats(currentWords, currentNotes);
      if (failures.length) setText('footTip', '部分数据暂未同步，正在显示已保存的内容');
    }
    // Render each source as soon as it arrives; a slow note query cannot block words.
    await Promise.all([
      update('words', DB.from('words').select('id,word,pos,meaning,created_at,updated_at')),
      update('notes', DB.from('notes').select('id,title,summary,tags,status,visibility,created_at,updated_at').order('updated_at', { ascending: false }))
    ]);
  }

  function dayKey(d) {
    if (!d) return '';
    const value = new Date(d);
    if (!Number.isFinite(value.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  }
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
    const nowYear = Number(dayKey(new Date()).slice(0, 4));
    const years = new Set([nowYear]);
    Object.keys(activityMap()).forEach(function (key) { const y = Number(key.slice(0, 4)); if (y <= nowYear) years.add(y); });
    const selected = Number($('activityYear').value) || nowYear;
    $('activityYear').innerHTML = Array.from(years).sort(function (a, b) { return b - a; }).map(function (year) {
      return '<option value="' + year + '"' + (year === selected ? ' selected' : '') + '>' + year + ' 年</option>';
    }).join('');
  }
  function renderActivity() {
    const today = dayKey(new Date());
    const year = Number($('activityYear').value) || Number(today.slice(0, 4));
    // Calendar arithmetic uses UTC noon; day labels remain the Shanghai day,
    // regardless of the visitor's device timezone or daylight-saving changes.
    const map = activityMap(), start = new Date(Date.UTC(year, 0, 1, 4)), end = new Date(Date.UTC(year, 11, 31, 4));
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setUTCDate(end.getUTCDate() + (6 - (end.getUTCDay() + 6) % 7));
    const cur = new Date(start), months = [];
    let cells = '', index = 0, days = 0, total = 0, run = 0, longest = 0;
    while (cur <= end) {
      const key = dayKey(cur), inYear = cur.getUTCFullYear() === year, future = key > today;
      const count = inYear && !future ? (map[key] || 0) : 0;
      if (inYear && cur.getUTCDate() === 1) months.push({ month: cur.getUTCMonth() + 1, col: Math.floor(index / 7) });
      if (count) { days++; total += count; run++; longest = Math.max(longest, run); } else run = 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      const title = key + (future ? '：尚未到来' : '：' + count + ' 条记录');
      cells += '<i class="act-day lv' + level + (inYear ? '' : ' blank') + (future ? ' future' : '') +
        (key === today ? ' today' : '') + '" title="' + title + '" aria-hidden="true"></i>';
      index++; cur.setUTCDate(cur.getUTCDate() + 1);
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
    statsGeneration++; competitiveGeneration++;
    competitiveData = null;
    currentWords = []; currentNotes = [];
    ['recentWords', 'recentNotes', 'topicLinks', 'activityGrid', 'activityMonths', 'activityYear'].forEach(function (id) { $(id).replaceChildren(); });
    setText('entryWords', '—'); setText('entryNotes', '—');
    if ($('platformCards')) $('platformCards').replaceChildren();
    if ($('contestList')) $('contestList').replaceChildren();
  });
  $('todayLabel').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
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

  const PROFILE_KEY = 'an_platform_profiles_v1', COMPETITIVE_CACHE = 'an_competitive_cache_v2';
  let competitiveData = null, competitiveGeneration = 0;
  function labels(key) { return window.ANI18n ? ANI18n.t(key) : key; }
  function language(zh, en) { return window.ANI18n && ANI18n.language === 'en' ? en : zh; }
  function readProfiles() {
    const base = Object.assign({ codeforces: 'YTU_YangQingXi', atcoder: 'yqx123', nowcoder: '821562209', luogu: '' }, (AN.cfg && AN.cfg.platforms) || {});
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      Object.keys(base).forEach(key => { if (safeHandle(saved[key])) base[key] = safeHandle(saved[key]); });
    } catch (e) {}
    return base;
  }
  function safeHandle(value) { value = String(value || '').trim(); return /^[A-Za-z0-9_.-]{1,40}$/.test(value) ? value : ''; }
  function platformUrl(name, handle) {
    if (name === 'codeforces') return handle ? 'https://codeforces.com/profile/' + encodeURIComponent(handle) : 'https://codeforces.com/';
    if (name === 'atcoder') return handle ? 'https://atcoder.jp/users/' + encodeURIComponent(handle) : 'https://atcoder.jp/';
    if (name === 'nowcoder') return handle ? 'https://www.nowcoder.com/users/' + encodeURIComponent(handle) : 'https://ac.nowcoder.com/';
    return handle ? 'https://www.luogu.com.cn/user/' + encodeURIComponent(handle) : 'https://www.luogu.com.cn/';
  }
  function renderPlatforms(data) {
    const profiles = readProfiles();
    const defs = [
      { key: 'codeforces', name: 'Codeforces', color: '#4da6ff' },
      { key: 'atcoder', name: 'AtCoder', color: '#e4a853' },
      { key: 'nowcoder', name: language('牛客', 'Nowcoder'), color: '#8ad850' },
      { key: 'luogu', name: '洛谷', color: '#34c58d' }
    ];
    $('platformCards').innerHTML = defs.map(function (def) {
      const handle = safeHandle(profiles[def.key]);
      const stats = data && data[def.key];
      const today = stats && Number.isFinite(stats.todayAccepted) ? stats.todayAccepted : '—';
      const accuracy = stats && Number.isFinite(stats.acceptance) ? stats.acceptance + '%' : '—';
      const extra = stats && def.key === 'codeforces' && stats.rating ? ' · rating ' + stats.rating : '';
      const unavailable = data && (data.errors || []).includes(def.key);
      const stale = data && (data.stale || []).includes(def.key);
      const profileOnly = def.key === 'luogu' || def.key === 'nowcoder';
      let status = profileOnly ? language('主页入口 · 未接入统计接口', 'Profile link · statistics unavailable') : !handle ? labels('home.unconfigured') : unavailable ? language(stale ? '暂未更新 · 显示上次数据' : '平台暂不可用', stale ? 'Update unavailable · showing saved data' : 'Platform unavailable') : stats ? language('公开提交记录 · UTC+8', 'Public submissions · UTC+8') : language('正在获取公开记录…', 'Loading public activity…');
      if (stats && stats.partial) status += language(' · 近 30 天记录不完整', ' · partial 30-day history');
      if (stats && stats.submissions === 0) status += language(' · 近 30 天无提交', ' · no submissions in 30 days');
      if (def.key === 'atcoder') status += language(' · AtCoder Problems 非官方数据', ' · unofficial AtCoder Problems data');
      return '<article class="platform-card" style="--platform-color:' + def.color + '">' +
        '<a class="platform-name" href="' + platformUrl(def.key, handle) + '" target="_blank" rel="noopener"><i></i><span>' + def.name + '<small class="platform-handle">' + esc(handle ? '@' + handle + extra : labels('home.unconfigured')) + '</small></span></a>' +
        '<div class="platform-metrics"><div class="platform-metric"><b>' + today + '</b><span>' + labels('home.today') + '</span></div><div class="platform-metric"><b>' + accuracy + '</b><span>' + labels('home.accuracy') + '</span></div></div>' +
        '<p class="platform-status muted small">' + esc(status) + '</p>' +
        '<a class="platform-link" href="' + platformUrl(def.key, handle) + '" target="_blank" rel="noopener">' + language('打开平台主页 ↗', 'Open profile ↗') + '</a></article>';
    }).join('');
  }
  function renderContests(rows) {
    rows = Array.isArray(rows) ? rows : [];
    $('contestList').innerHTML = rows.length ? rows.slice(0, 5).map(function (contest) {
      const date = new Date(contest.startTimeSeconds * 1000);
      const md = new Intl.DateTimeFormat(window.ANI18n && ANI18n.language === 'en' ? 'en' : 'zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(date);
      const time = new Intl.DateTimeFormat(window.ANI18n && ANI18n.language === 'en' ? 'en' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(date);
      const hours = Math.round(contest.durationSeconds / 360) / 10;
      return '<a class="contest-item" href="' + esc(contest.url) + '" target="_blank" rel="noopener"><span class="contest-date">' + esc(md) + '<br>' + esc(time) + '</span><span class="contest-copy"><b>' + esc(contest.name) + '</b><span>Codeforces · UTC+8</span></span><span class="contest-duration">' + hours + 'h</span></a>';
    }).join('') : '<p class="empty-state">' + (competitiveData && (competitiveData.errors || []).includes('contests') ? language('赛程暂时无法同步，请稍后刷新。', 'Schedule unavailable. Refresh again later.') : competitiveData && Object.prototype.hasOwnProperty.call(competitiveData, 'contests') ? labels('home.noContest') : language('正在获取赛程…', 'Loading schedule…')) + '</p>';
    if (competitiveData && (competitiveData.stale || []).includes('contests') && rows.length) $('contestList').insertAdjacentHTML('beforeend', '<p class="muted small">' + language('赛程暂未更新，正在显示上次同步内容。', 'Showing the last saved schedule; update unavailable.') + '</p>');
  }
  async function loadCompetitive(force) {
    const generation = ++competitiveGeneration, role = Auth.role;
    const profiles = readProfiles();
    const fingerprint = [safeHandle(profiles.codeforces), safeHandle(profiles.atcoder), dayKey(new Date())].join(':');
    let cacheTime = 0;
    try {
      const cached = JSON.parse(sessionStorage.getItem(COMPETITIVE_CACHE) || 'null');
      if (cached && cached.fingerprint === fingerprint && Date.now() - cached.time < 86400000) {
        competitiveData = cached.data; cacheTime = cached.time;
      }
    } catch (e) {}
    renderPlatforms(competitiveData); renderContests(competitiveData && competitiveData.contests);
    const ttl = competitiveData && (competitiveData.errors || []).length ? 30000 : 300000;
    if (!force && cacheTime && Date.now() - cacheTime < ttl) return;
    const button = $('refreshPlatforms'); if (button) button.disabled = true;
    async function loadPlatform(name) {
      try {
        const query = new URLSearchParams({ cf: safeHandle(profiles.codeforces), atcoder: safeHandle(profiles.atcoder), only: name });
        const response = await ANRequest('/api/competitive?' + query.toString(), { credentials: 'include', cache: 'no-store', timeoutMs: 14000 });
        if (response.status === 401) { window.dispatchEvent(new CustomEvent('an:session-expired')); return; }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (generation !== competitiveGeneration || Auth.role !== role) return;
        if (!competitiveData) competitiveData = { errors: [], stale: [], updatedAt: {} };
        const failed = (result.errors || []).includes(name);
        const oldValue = competitiveData[name];
        const keepOld = failed && oldValue != null && (name !== 'contests' || oldValue.length > 0) && (result[name] == null || (name === 'contests' && !result[name].length));
        if (!keepOld) competitiveData[name] = result[name];
        competitiveData.errors = (competitiveData.errors || []).filter(key => key !== name).concat(failed ? [name] : []);
        competitiveData.stale = (competitiveData.stale || []).filter(key => key !== name).concat(keepOld || (result.stale || []).includes(name) ? [name] : []);
        competitiveData.updatedAt = Object.assign({}, competitiveData.updatedAt, result.updatedAt || {});
      } catch (e) {
        if (generation !== competitiveGeneration || Auth.role !== role) return;
        if (!competitiveData) competitiveData = { errors: [], stale: [], updatedAt: {} };
        competitiveData.errors = Array.from(new Set((competitiveData.errors || []).concat(name)));
        if (competitiveData[name] != null) competitiveData.stale = Array.from(new Set((competitiveData.stale || []).concat(name)));
      }
      if (generation !== competitiveGeneration || Auth.role !== role) return;
      renderPlatforms(competitiveData); renderContests(competitiveData.contests);
    }
    try {
      // Each card and the calendar update independently of both database queries.
      await Promise.all(['codeforces', 'atcoder', 'contests'].map(loadPlatform));
      if (generation !== competitiveGeneration || Auth.role !== role) return;
      try { sessionStorage.setItem(COMPETITIVE_CACHE, JSON.stringify({ time: Date.now(), fingerprint, data: competitiveData })); } catch (e) {}
    } finally { if (button && generation === competitiveGeneration) button.disabled = false; }
  }
  function openProfiles() {
    const profiles = readProfiles();
    $('profileCodeforces').value = profiles.codeforces || '';
    $('profileAtcoder').value = profiles.atcoder || '';
    if ($('profileNowcoder')) $('profileNowcoder').value = profiles.nowcoder || '';
    $('profileLuogu').value = profiles.luogu || '';
    $('profileSettings').hidden = false; $('profileCodeforces').focus();
  }
  $('openProfileSettings').addEventListener('click', openProfiles);
  $('refreshPlatforms').addEventListener('click', function () { loadCompetitive(true); });
  document.querySelectorAll('[data-close="profileSettings"]').forEach(function (button) { button.addEventListener('click', function () { $('profileSettings').hidden = true; }); });
  $('profileSettingsForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const value = { codeforces: safeHandle($('profileCodeforces').value), atcoder: safeHandle($('profileAtcoder').value), nowcoder: $('profileNowcoder') ? safeHandle($('profileNowcoder').value) : readProfiles().nowcoder, luogu: safeHandle($('profileLuogu').value) };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
    competitiveData = null; sessionStorage.removeItem(COMPETITIVE_CACHE); $('profileSettings').hidden = true; loadCompetitive(true);
  });
  window.addEventListener('an:language', function () { renderPlatforms(competitiveData); renderContests(competitiveData && competitiveData.contests); });
  renderPlatforms(null);
  window.whenAuthed(function () { loadStats(); loadCompetitive(false); });
})();
