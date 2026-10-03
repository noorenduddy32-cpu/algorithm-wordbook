/* ============================================================
   common.js —— 三个页面共用：主题 / toast / 弹窗 / 编辑密码 / 导航图标 / 顶栏渲染
   依赖：config.js（window.APP_CONFIG）
   ============================================================ */
(function () {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  // 与单词本原有 key 保持一致，这样三个页面共用同一份主题 / 解锁状态
  const LS_THEME = 'wb_theme_v2';
  const LS_LOCK = 'wb_edit_unlocked';

  const THEMES = [
    { id: 'dark', name: '夜间深色', swatch: 'linear-gradient(135deg,#161a22,#0e1116)' },
    { id: 'light', name: '日间亮色', swatch: 'linear-gradient(135deg,#ffffff,#e9eef7)' },
    { id: 'glass', name: '玻璃拟态（深）', swatch: 'linear-gradient(135deg,#6d5cff,#00b0ff)' },
    { id: 'glass-light', name: '玻璃拟态（亮）', swatch: 'linear-gradient(135deg,#f6f8ff,#a8c4ff)' },
    { id: 'eye', name: '护眼米黄', swatch: 'linear-gradient(135deg,#f2ecd6,#e8e2c9)' },
    { id: 'eye-green', name: '护眼豆绿', swatch: 'linear-gradient(135deg,#e6efe0,#d8e3d0)' },
    { id: 'ink', name: '墨绿复古', swatch: 'linear-gradient(135deg,#2a323b,#14181c)' }
  ];

  const $ = function (id) { return document.getElementById(id); };

  /* ---------------- 图标 ---------------- */

  const ICONS = {
    theme: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    home: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 10.5 12 3.4l8.8 7.1"/><path d="M5.4 9.4V20h13.2V9.4"/><path d="M9.8 20v-5.6h4.4V20"/></svg>',
    lockOpen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.4"/></svg>',
    lockShut: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></svg>',
    pen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20.2h4.2L20 8.4 15.8 4.2 4 16z"/><path d="M14.2 5.8 18.4 10"/></svg>',
    book: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.6h6a2.6 2.6 0 0 1 2 2.4v12a2 2 0 0 0-2-1.6H4z"/><path d="M20 4.6h-6a2.6 2.6 0 0 0-2 2.4v12a2 2 0 0 1 2-1.6h6z"/></svg>',
    file: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/><path d="M8.6 13.4h6.8M8.6 16.6h4.6"/></svg>'
  };

  /* ---------------- 主题 ---------------- */

  function applyTheme(name) {
    const t = THEMES.some(function (x) { return x.id === name; }) ? name : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
    const btn = $('themeBtn');
    if (btn) {
      const ic = $('themeIcon');
      if (ic) ic.innerHTML = ICONS.theme;
      btn.title = '主题：' + ((THEMES.find(function (x) { return x.id === t; }) || {}).name || '');
    }
    const lbl = $('lockLabel');
    if (lbl) lbl.textContent = unlocked ? '已解锁' : '编辑';
    const li = $('lockIcon');
    if (li) li.innerHTML = unlocked ? ICONS.lockOpen : ICONS.lockShut;
  }

  function buildThemeMenu() {
    const menu = $('themeMenu');
    if (!menu) return;
    menu.innerHTML = THEMES.map(function (x) {
      return '<button type="button" data-theme-id="' + x.id + '">' +
        '<i style="background:' + x.swatch + '"></i><span>' + x.name + '</span></button>';
    }).join('');
    menu.addEventListener('click', function (e) {
      const b = e.target.closest('[data-theme-id]');
      if (!b) return;
      applyTheme(b.dataset.themeId);
      menu.hidden = true;
    });
  }

  function initTheme() {
    let saved = 'dark';
    try { saved = localStorage.getItem(LS_THEME) || 'dark'; } catch (e) {}
    applyTheme(saved);
    buildThemeMenu();
    const btn = $('themeBtn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const m = $('themeMenu');
        if (m) m.hidden = !m.hidden;
      });
    }
    document.addEventListener('click', function (e) {
      const m = $('themeMenu');
      if (m && !m.hidden && !e.target.closest('.theme-wrap')) m.hidden = true;
    });
  }

  /* ---------------- 玻璃主题：缓慢游走的光晕 ---------------- */

  function initAurora() {
    const box = document.querySelector('.aurora-bg');
    if (!box) return;
    const seeds = [
      { x: 12, y: -8, s: 520, c: 'rgba(124,92,255,.42)' },
      { x: 88, y: 4, s: 460, c: 'rgba(0,176,255,.34)' },
      { x: 30, y: 82, s: 480, c: 'rgba(255,92,168,.26)' },
      { x: 74, y: 74, s: 420, c: 'rgba(77,212,160,.24)' }
    ];
    box.innerHTML = seeds.map(function (s, i) {
      return '<div class="aurora a' + (i + 1) + '" style="width:' + s.s + 'px;height:' + s.s +
        'px;background:' + s.c + ';left:' + s.x + '%;top:' + s.y + '%"></div>';
    }).join('');
    function tick() {
      const els = box.querySelectorAll('.aurora');
      for (let i = 0; i < els.length; i++) {
        const dx = (Math.random() * 26 - 13).toFixed(1);
        const dy = (Math.random() * 20 - 10).toFixed(1);
        const sc = (0.82 + Math.random() * 0.42).toFixed(2);
        const op = (0.34 + Math.random() * 0.34).toFixed(2);
        els[i].style.transform = 'translate(' + dx + '%,' + dy + '%) scale(' + sc + ')';
        els[i].style.opacity = op;
      }
      setTimeout(tick, 5200 + Math.random() * 4200);
    }
    setTimeout(tick, 900);
  }

  /* ---------------- toast ---------------- */

  let toastTimer = null;
  function toast(msg, isErr) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------------- 弹窗通用关闭 ---------------- */

  function initModals() {
    document.addEventListener('click', function (e) {
      const c = e.target.closest('[data-close]');
      if (c) {
        const m = c.closest('.modal');
        if (m) m.hidden = true;
      }
      if (e.target.classList && e.target.classList.contains('modal')) e.target.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const open = document.querySelectorAll('.modal:not([hidden])');
      for (let i = 0; i < open.length; i++) open[i].hidden = true;
    });
  }

  /* ---------------- 编辑密码 ---------------- */

  let unlocked = false;
  try { unlocked = localStorage.getItem(LS_LOCK) === '1'; } catch (e) {}

  function askPassword(cb) {
    if (unlocked) { cb(); return; }
    const modal = $('passModal');
    const input = $('passInput');
    if (!modal) { cb(); return; }
    input.value = '';
    modal.hidden = false;
    setTimeout(function () { input.focus(); }, 40);
    const form = $('passForm');
    if (form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const v = input.value.trim();
        if (v === (cfg.editPassword || '')) {
          unlocked = true;
          try { localStorage.setItem(LS_LOCK, '1'); } catch (err) {}
          modal.hidden = true;
          applyTheme(document.documentElement.getAttribute('data-theme'));
          toast('已解锁，可以编辑了');
          cb && cb();
        } else {
          toast('密码不对', true);
          input.value = '';
          input.focus();
        }
      });
    }
  }

  function initLock() {
    const btn = $('lockBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (unlocked) {
        unlocked = false;
        try { localStorage.removeItem(LS_LOCK); } catch (e) {}
        applyTheme(document.documentElement.getAttribute('data-theme'));
        toast('已锁定');
      } else {
        askPassword(function () {});
      }
    });
  }

  /* ---------------- 顶栏 ---------------- */

  // nav: [{href,label,key,icon}]
  function renderTopbar(o) {
    const host = $('topbar');
    if (!host) return;
    const links = (o.nav || []).map(function (n) {
      return '<a class="top-link' + (n.key === o.active ? ' active' : '') + '" href="' + n.href + '">' +
        (n.icon || '') + '<span>' + n.label + '</span></a>';
    }).join('');

    host.innerHTML =
      '<a class="brand" href="index.html">' +
        '<span class="logo"><img src="assets/logo.png" alt="logo" draggable="false"></span>' +
        '<span class="brand-text"><h1>' + (o.title || '算法学习笔记本') + '</h1>' +
        '<p>' + (o.subtitle || '') + '</p></span>' +
      '</a>' +
      '<nav class="top-nav">' + links + '</nav>' +
      '<div class="top-actions">' +
        '<div class="theme-wrap">' +
          '<button id="themeBtn" class="icon-btn" title="切换主题"><span id="themeIcon"></span></button>' +
          '<div id="themeMenu" class="theme-menu" hidden></div>' +
        '</div>' +
        (o.lock === false ? '' :
          '<button id="lockBtn" class="icon-btn" title="编辑模式"><span id="lockIcon"></span><span id="lockLabel">编辑模式</span></button>') +
      '</div>';
  }

  /* ---------------- 云端（keyless） ---------------- */

  let cloud = null, db = null;
  function initCloud() {
    const c = cfg.cloud;
    if (!c || !c.endpoint || !c.publishableKey) return false;
    if (typeof WorkBuddyCloud === 'undefined') return false;
    try {
      cloud = WorkBuddyCloud.createWorkBuddyCloud({ endpoint: c.endpoint, publishableKey: c.publishableKey });
      db = cloud.database;
      return !!db;
    } catch (e) { cloud = null; db = null; return false; }
  }

  /* ---------------- 工具 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function relTime(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const day = 86400000;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < day) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < day * 30) return Math.floor(diff / day) + ' 天前';
    return fmtDate(s);
  }

  function countWords(md) {
    const s = String(md || '').trim();
    if (!s) return 0;
    return s.replace(/\s+/g, ' ').length;
  }

  function autoSummary(md, n) {
    n = n || 90;
    const s = String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*`_\-|~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------------- 启动 ---------------- */

  function boot(opts) {
    opts = opts || {};
    if (opts.topbar !== false) renderTopbar(opts);
    initTheme();
    initAurora();
    initModals();
    initLock();
    initCloud();
  }

  window.AN = {
    $: $,
    cfg: cfg,
    ICONS: ICONS,
    THEMES: THEMES,
    applyTheme: applyTheme,
    toast: toast,
    askPassword: askPassword,
    isUnlocked: function () { return unlocked; },
    setUnlocked: function (v) {
      unlocked = !!v;
      try {
        if (unlocked) localStorage.setItem(LS_LOCK, '1');
        else localStorage.removeItem(LS_LOCK);
      } catch (e) {}
      applyTheme(document.documentElement.getAttribute('data-theme'));
    },
    boot: boot,
    esc: esc,
    fmtDate: fmtDate,
    relTime: relTime,
    countWords: countWords,
    autoSummary: autoSummary,
    getDb: function () { return db; },
    getCloud: function () { return cloud; }
  };
})();
