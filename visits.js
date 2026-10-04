/* ============================================================
   visits.js —— 访问日志：仅管理员可见
   ============================================================ */
(function () {
  'use strict';

  const $ = AN.$;
  const esc = AN.esc;

  AN.boot({
    title: '访问记录',
    subtitle: '访问来源 · 阅读文章 · 停留时长',
    active: 'visits',
    nav: [
      { key: 'home', label: '首页', href: 'index.html', icon: AN.ICONS.home },
      { key: 'wordbook', label: '词汇本', href: 'wordbook.html', icon: AN.ICONS.book },
      { key: 'notes', label: '文章', href: 'notes.html', icon: AN.ICONS.pen }
    ]
  });

  let all = [];
  let filterRole = '';

  function fmtTime(s) {
    if (!s) return '0 秒';
    if (s < 60) return s + ' 秒';
    if (s < 3600) return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h + ' 小时 ' + m + ' 分';
  }

  function badgeClass(role) {
    if (role === 'admin') return 'admin';
    if (role === 'visitor') return 'visitor';
    return 'anon';
  }

  async function loadVisits() {
    const box = $('visitsList');
    box.innerHTML = '<p class="muted" style="padding:26px 0">读取中…</p>';
    try {
      const r = await fetch('/api/visits', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      all = j.data || [];
      render();
    } catch (e) {
      box.innerHTML = '<p class="muted" style="padding:26px 0">读取失败：' + esc(e.message || e) + '</p>';
    }
  }

  function render() {
    $('visitsSub').textContent = '共 ' + all.length + ' 条记录 · 谁在什么时间、从哪来、看了哪篇、停留多久。';
    let list = all;
    if (filterRole) list = list.filter(function (x) { return (x.role || 'anon') === filterRole; });

    const box = $('visitsList');
    if (!list.length) {
      box.innerHTML = '<p class="muted" style="padding:26px 0">没有匹配的记录</p>';
      return;
    }
    box.innerHTML = list.map(function (x) {
      return '<div class="visit-row">' +
        '<div class="visit-main">' +
          '<span class="visit-role ' + badgeClass(x.role) + '">' + esc(x.role || 'anon') + '</span>' +
          '<span class="visit-when">' + AN.fmtDate(x.created_at) + ' ' + new Date(x.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</span>' +
          '<span class="visit-duration">' + fmtTime(x.duration || 0) + '</span>' +
        '</div>' +
        '<div class="visit-where">' +
          (x.region ? '<span>' + esc(x.region) + '</span>' : '') +
          '<span>' + esc(x.ip || '-') + '</span>' +
          '<span>' + esc(x.browser || '?') + ' / ' + esc(x.os || '?') + '</span>' +
        '</div>' +
        (x.note_id ? '<div class="visit-note">看了 <a href="notes.html#n' + x.note_id + '">《' + esc(x.note_title || '无标题') + '》</a></div>' : '') +
      '</div>';
    }).join('');
  }

  function start() {
    const isAdmin = window.AN_ROLE === 'admin';
    if (!isAdmin) {
      $('visitsDeny').hidden = false;
      $('visitsBox').hidden = true;
      return;
    }
    $('visitsDeny').hidden = true;
    $('visitsBox').hidden = false;
    loadVisits();

    $('visitsFilter').addEventListener('click', function (e) {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      filterRole = b.dataset.filter;
      document.querySelectorAll('#visitsFilter .fbtn').forEach(function (x) {
        x.classList.toggle('active', x.dataset.filter === filterRole);
      });
      render();
    });
  }

  window.whenAuthed(start);
})();
