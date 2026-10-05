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
      { key: 'wordbook', label: '词汇', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '文章', href: 'notes.html', icon: AN.ICONS.pen },
      { key: 'visits', label: '访问记录', href: 'visits.html', icon: AN.ICONS.file, adminOnly: true }
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

        renderActivityHome(words, notes);
      } catch (e) {
        setText('hsWords', '—'); setText('hsEx', '—');
        setText('hsNotes', '—');
        setText('footTip', '读取失败：' + (e && e.message ? e.message : e));
      }
    })();
  }

  /* ---------------- 活跃度热力图（首页，按自然年 1月→12月 左→右） ---------------- */

  function dayKey(d) {
    const p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function actLevel(n) {
    if (!n) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    if (n <= 10) return 3;
    return 4;
  }

  function renderActivityHome(words, notes) {
    const grid = $('activityGrid');
    if (!grid) return;

    // 汇总每天活跃量：云端单词/文章的创建与更新 + 本机背诵/编辑次数
    const map = {};
    const add = function (iso, n) {
      const d = String(iso || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      map[d] = (map[d] || 0) + n;
    };
    (words || []).forEach(function (w) {
      add(w.created_at, 1);
      if (String(w.updated_at || '').slice(0, 10) !== String(w.created_at || '').slice(0, 10)) add(w.updated_at, 1);
    });
    (notes || []).forEach(function (x) {
      add(x.created_at, 1);
      if (String(x.updated_at || '').slice(0, 10) !== String(x.created_at || '').slice(0, 10)) add(x.updated_at, 1);
    });
    const local = AN.getLocalActivity();
    Object.keys(local).forEach(function (k) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) map[k] = (map[k] || 0) + (Number(local[k]) || 0);
    });

    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    // 对齐到整周（周一为行首），左→右跨月
    const start = new Date(yearStart);
    start.setDate(start.getDate() - ((yearStart.getDay() + 6) % 7));
    const end = new Date(yearEnd);
    end.setDate(end.getDate() + (6 - ((yearEnd.getDay() + 6) % 7)));

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const months = [];
    let cells = '';
    let activeDays = 0, totalOps = 0, lastMonth = -1;
    const cur = new Date(start);
    const colOf = function (d) { return Math.floor((d - start) / 86400000 / 7); };

    while (cur <= end) {
      const m = cur.getMonth();
      if (cur >= yearStart && cur <= yearEnd && m !== lastMonth) {
        months.push({ label: monthNames[m], col: colOf(cur) });
        lastMonth = m;
      }
      const inYear = cur >= yearStart && cur <= yearEnd;
      const key = dayKey(cur);
      const n = inYear ? (map[key] || 0) : 0;
      if (inYear && n) { activeDays++; totalOps += n; }
      const lv = actLevel(n);
      cells += '<i class="act-day lv' + lv + (inYear ? '' : ' blank') +
        '" data-date="' + key + '" title="' + key + (inYear ? '：' + (n ? n + ' 次' : '无记录') : '') + '"></i>';
      cur.setDate(cur.getDate() + 1);
    }

    grid.innerHTML = cells;

    // 让月份标签与格子严格对齐：按实际周数动态设置列数
    const totalDays = Math.round((end - start) / 86400000) + 1;
    const cols = Math.ceil(totalDays / 7);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

    const seen = {};
    $('activityMonths').innerHTML = months.filter(function (mm) {
      if (seen[mm.label]) return false;
      seen[mm.label] = 1;
      return true;
    }).map(function (mm) {
      // 月份标签左对齐到该月首列左边界，避免相邻标签重叠
      const leftPct = ((mm.col / cols) * 100).toFixed(2);
      return '<span style="left:' + leftPct + '%">' + esc(mm.label) + '</span>';
    }).join('');

    let streak = 0;
    const walk = new Date(yearEnd > new Date() ? new Date() : yearEnd);
    while (map[dayKey(walk)]) { streak++; walk.setDate(walk.getDate() - 1); }

    $('actStreak').textContent = streak;
    $('actTotal').textContent = totalOps;
    $('actDays').textContent = activeDays;
    $('activitySum').textContent = year + ' 年 ' + activeDays + ' 天有记录 · 连续 ' + streak + ' 天';

    // 悬停提示
    if (!$('activityTip')) {
      const tip = document.createElement('div');
      tip.id = 'activityTip';
      tip.className = 'act-tip';
      document.body.appendChild(tip);
    }
    grid.onmousemove = function (e) {
      const cell = e.target.closest('.act-day');
      const tip = $('activityTip');
      if (!cell || !tip) return;
      tip.textContent = cell.getAttribute('title');
      tip.style.display = 'block';
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 10) + 'px';
      tip.style.top = (e.clientY - 34) + 'px';
    };
    grid.onmouseleave = function () { const t = $('activityTip'); if (t) t.style.display = 'none'; };
  }

  window.whenAuthed(loadStats);
})();
