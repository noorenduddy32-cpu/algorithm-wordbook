/* ============================================================
   home.js —— 主页：统计数字 + 最近文章
   ============================================================ */
(function () {
  'use strict';

  const $ = AN.$;
  const esc = AN.esc;

  AN.boot({
    title: '算法学习笔记本',
    subtitle: '算法竞赛词汇本 · 题目笔记与题解',
    active: 'home',
    nav: [
      { key: 'home', label: '首页', href: 'index.html', icon: AN.ICONS.home },
      { key: 'wordbook', label: '词汇本', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '文章', href: 'notes.html', icon: AN.ICONS.pen }
    ]
  });

  const LS_ACT = 'wb_activity_counts_v1';

  function setText(id, v) { const e = $(id); if (e) e.textContent = v; }

  function activeDays() {
    let obj = {};
    try { obj = JSON.parse(localStorage.getItem(LS_ACT) || '{}'); } catch (e) { obj = {}; }
    return Object.keys(obj).filter(function (k) { return (obj[k] || 0) > 0; }).length;
  }

  function loadStats() {
    const db = AN.getDb();
    if (!db) {
      setText('hsWords', '—'); setText('hsEx', '—');
      setText('hsNotes', '—'); setText('hsDays', String(activeDays()));
      setText('entryWords', '—'); setText('entryNotes', '—');
      setText('footTip', '云端未连接，数字暂不可用');
      return;
    }
    (async function () {
      try {
        const [w, n] = await Promise.all([
          db.from('words').select('id,examples,created_at'),
          db.from('notes').select('id,title,summary,tags,created_at,updated_at,views')
            .order('updated_at', { ascending: false })
        ]);
        const words = w.data || [];
        const notes = n.data || [];

        let ex = 0;
        const days = {};
        words.forEach(function (x) {
          if (Array.isArray(x.examples)) ex += x.examples.length;
          if (x.created_at) days[String(x.created_at).slice(0, 10)] = 1;
        });
        try {
          const act = JSON.parse(localStorage.getItem(LS_ACT) || '{}');
          Object.keys(act).forEach(function (k) { if ((act[k] || 0) > 0) days[k] = 1; });
        } catch (e) {}
        notes.forEach(function (x) { if (x.updated_at) days[String(x.updated_at).slice(0, 10)] = 1; });

        setText('hsWords', String(words.length));
        setText('hsEx', String(ex));
        setText('hsNotes', String(notes.length));
        setText('hsDays', String(Object.keys(days).length));
        setText('entryWords', String(words.length));
        setText('entryNotes', String(notes.length));
        setText('footTip', '数据来自云端数据库 · 随时可写');

        renderRecent(notes);
      } catch (e) {
        setText('hsWords', '—'); setText('hsEx', '—');
        setText('hsNotes', '—');
        setText('footTip', '读取失败：' + (e && e.message ? e.message : e));
      }
    })();
  }

  function renderRecent(notes) {
    if (!notes.length) return;
    const list = notes.slice(0, 3);
    const box = $('recentList');
    if (!box) return;
    box.innerHTML = list.map(function (x) {
      const tags = Array.isArray(x.tags) ? x.tags : [];
      return '<a class="recent-card" href="notes.html#n' + x.id + '">' +
        '<h4>' + esc(x.title || '无标题') + '</h4>' +
        '<p>' + esc(x.summary || '（还没有摘要）') + '</p>' +
        '<div class="recent-meta">' +
          '<span>' + AN.relTime(x.updated_at || x.created_at) + '</span>' +
          (tags.length ? '<span class="tag"># ' + esc(tags.join(' # ')) + '</span>' : '') +
        '</div></a>';
    }).join('');
    const wrap = $('recentWrap');
    if (wrap) wrap.hidden = false;
  }

  loadStats();
})();
