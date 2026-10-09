/* ============================================================
   common.js —— 三个页面共用：主题 / toast / 弹窗 / 编辑密码 / 导航图标 / 顶栏渲染
   依赖：config.example.js（window.APP_CONFIG）
   ============================================================ */
(function () {
  'use strict';

  // 只读取已加载的公开展示配置，服务端凭据不会发送到浏览器。
  const cfg = window.APP_CONFIG || {};
  // 与单词本原有 key 保持一致，这样三个页面共用同一份主题 / 解锁状态
  const LS_THEME = 'wb_theme_v2';
  const LS_FS = 'wb_reading_size';
  const LS_FS_LEGACY = 'wb_font_scale';

  const THEMES = [
    { id: 'system', name: '跟随系统', swatch: 'linear-gradient(90deg,#f6f7fb 50%,#1c2030 50%)' },
    { id: 'light', name: '日间 · 雾白', swatch: '#f6f7fb' },
    { id: 'dark', name: '夜间 · 靛墨', swatch: '#1c2030' },
    { id: 'eye', name: '柔和 · 青叶', swatch: '#e7eee5' }
  ];
  const systemTheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let themeChoice = 'system';

  const $ = function (id) { return document.getElementById(id); };

  /* ---------------- 图标 ---------------- */

  const ICONS = {
    theme: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    home: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 10.5 12 3.4l8.8 7.1"/><path d="M5.4 9.4V20h13.2V9.4"/><path d="M9.8 20v-5.6h4.4V20"/></svg>',
    pen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20.2h4.2L20 8.4 15.8 4.2 4 16z"/><path d="M14.2 5.8 18.4 10"/></svg>',
    book: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.6h6a2.6 2.6 0 0 1 2 2.4v12a2 2 0 0 0-2-1.6H4z"/><path d="M20 4.6h-6a2.6 2.6 0 0 0-2 2.4v12a2 2 0 0 1 2-1.6h6z"/></svg>',
    file: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/><path d="M8.6 13.4h6.8M8.6 16.6h4.6"/></svg>'
  };

  /* ---------------- 主题与设置浮层 ---------------- */

  function normalizeTheme(value) {
    const aliases = { glass: 'dark', ink: 'dark', 'glass-light': 'light', 'eye-green': 'eye' };
    value = aliases[value] || value;
    return THEMES.some(function (x) { return x.id === value; }) ? value : 'system';
  }
  function readTheme() {
    try { return normalizeTheme(localStorage.getItem(LS_THEME)); } catch (e) { return 'system'; }
  }
  function applyTheme(name, persist) {
    themeChoice = normalizeTheme(name);
    const resolved = themeChoice === 'system' ? (systemTheme && systemTheme.matches ? 'dark' : 'light') : themeChoice;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.themeChoice = themeChoice;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.content = resolved === 'dark' ? '#141722' : resolved === 'eye' ? '#edf1eb' : '#f6f7fb';
    });
    if (persist !== false) {
      try { localStorage.setItem(LS_THEME, themeChoice); } catch (e) {}
    }
    const theme = THEMES.find(function (x) { return x.id === themeChoice; });
    const btn = $('themeBtn'), icon = $('themeIcon');
    if (icon) icon.innerHTML = ICONS.theme;
    if (btn) { btn.title = '外观：' + theme.name; btn.setAttribute('aria-label', btn.title); }
    buildThemeMenu();
  }
  function buildThemeMenu() {
    const menu = $('themeMenu');
    if (!menu) return;
    menu.innerHTML = '<p class="menu-caption">笔记本外观</p>' + THEMES.map(function (x) {
      const active = x.id === themeChoice;
      return '<button type="button" data-theme-id="' + x.id + '" aria-pressed="' + active + '"' +
        (active ? ' class="active"' : '') + '><i aria-hidden="true" style="background:' + x.swatch +
        '"></i><span>' + x.name + '</span></button>';
    }).join('');
  }
  function placePopup(menuId, buttonId) {
    const menu = $(menuId), button = $(buttonId);
    if (!menu || !button) return;
    const box = button.getBoundingClientRect();
    menu.style.left = Math.max(16, Math.min(box.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 16)) + 'px';
    menu.style.top = Math.max(12, Math.min(box.bottom + 10, window.innerHeight - menu.offsetHeight - 12)) + 'px';
  }
  function closePopup(menuId, buttonId, restoreFocus) {
    const menu = $(menuId), button = $(buttonId);
    if (menu) menu.hidden = true;
    if (button) { button.setAttribute('aria-expanded', 'false'); if (restoreFocus) button.focus(); }
  }
  function bindPopup(menuId, buttonId, wrapper) {
    const menu = $(menuId), button = $(buttonId);
    if (!menu || !button) return;
    button.addEventListener('click', function (e) {
      e.stopPropagation();
      const opening = menu.hidden;
      closePopup('themeMenu', 'themeBtn'); closePopup('fsMenu', 'fsBtn');
      if (!opening) return;
      menu.hidden = false; button.setAttribute('aria-expanded', 'true');
      placePopup(menuId, buttonId);
      const first = menu.querySelector('.active, input, button');
      if (first) first.focus();
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !e.target.closest(wrapper)) closePopup(menuId, buttonId);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        closePopup(menuId, buttonId, menu.contains(document.activeElement));
      }
    });
    window.addEventListener('resize', function () { if (!menu.hidden) placePopup(menuId, buttonId); });
    window.addEventListener('scroll', function () { if (!menu.hidden) placePopup(menuId, buttonId); }, true);
  }
  function initTheme() {
    applyTheme(readTheme(), false);
    bindPopup('themeMenu', 'themeBtn', '.theme-wrap');
    const menu = $('themeMenu');
    if (menu) {
      menu.addEventListener('click', function (e) {
        const button = e.target.closest('[data-theme-id]');
        if (!button) return;
        applyTheme(button.dataset.themeId);
        closePopup('themeMenu', 'themeBtn', true);
      });
      menu.addEventListener('keydown', function (e) {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const buttons = Array.from(menu.querySelectorAll('button'));
        const current = buttons.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 :
          (current + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        e.preventDefault(); buttons[next].focus();
      });
    }
    const onSystemChange = function () { if (themeChoice === 'system') applyTheme('system', false); };
    if (systemTheme) {
      if (systemTheme.addEventListener) systemTheme.addEventListener('change', onSystemChange);
      else if (systemTheme.addListener) systemTheme.addListener(onSystemChange);
    }
    window.addEventListener('storage', function (e) {
      if (e.key === LS_THEME || e.key === null) applyTheme(readTheme(), false);
    });
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
    let activeDialog = null;
    let lastOutside = document.activeElement;
    const openers = new WeakMap();
    const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
    function candidates(dialog) {
      return Array.from(dialog.querySelectorAll(focusable)).filter(node => node.getClientRects().length && !node.closest('[hidden]'));
    }
    function syncDialog() {
      const open = Array.from(document.querySelectorAll('.modal:not([hidden]),#gate'));
      const next = open[open.length - 1] || null;
      if (next === activeDialog) return;
      const previous = activeDialog;
      activeDialog = next;
      if (next) {
        openers.set(next, lastOutside);
        next.setAttribute('role', 'dialog'); next.setAttribute('aria-modal', 'true'); next.tabIndex = -1;
        const title = next.querySelector('h1,h2');
        if (title && !next.hasAttribute('aria-labelledby')) {
          if (!title.id) title.id = next.id + 'Title';
          next.setAttribute('aria-labelledby', title.id);
        }
        if (!next.contains(document.activeElement)) (candidates(next)[0] || next).focus();
      } else if (previous) {
        const opener = openers.get(previous);
        if (opener && opener.isConnected && opener.getClientRects().length) opener.focus();
      }
    }
    document.addEventListener('focusin', function (event) {
      if (!event.target.closest('.modal,#gate')) lastOutside = event.target;
    });
    new MutationObserver(syncDialog).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('click', function (e) {
      const c = e.target.closest('[data-close]');
      if (c) {
        const m = c.closest('.modal');
        if (m) m.hidden = true;
      }
      if (e.target.classList && e.target.classList.contains('modal')) e.target.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && activeDialog) {
        const items = candidates(activeDialog);
        const first = items[0] || activeDialog, last = items[items.length - 1] || activeDialog;
        if (e.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
      if (e.key !== 'Escape') return;
      const gateCancel = $('gateCancel');
      if (gateCancel && !gateCancel.disabled) gateCancel.click();
      const open = document.querySelectorAll('.modal:not([hidden])');
      for (let i = 0; i < open.length; i++) open[i].hidden = true;
    });
  }

  /* ---------------- 编辑密码 ---------------- */

  function askPassword(cb) {
    if (window.AN_ROLE === 'admin') { if (cb) cb(); return; }
    if (cb) window.addEventListener('an:admin', cb, { once: true });
    if (window.reopenGate) window.reopenGate();
  }

  /* ---------------- 顶栏 ---------------- */

  // nav: [{href,label,key,icon,adminOnly}]
  function renderTopbar(o) {
    const host = $('topbar');
    if (!host) return;
    const links = (o.nav || []).map(function (n) {
      return '<a class="top-link' + (n.key === o.active ? ' active' : '') + '"' + (n.adminOnly ? ' data-admin' : '') + (n.key === o.active ? ' aria-current="page"' : '') + ' href="' + n.href + '">' +
        (n.icon || '') + '<span>' + n.label + '</span></a>';
    }).join('');

    // 移动端抽屉导航：与 .top-nav 同源，点开后在顶栏下方铺开
    const mnLinks = (o.nav || []).map(function (n) {
      return '<a class="mn-link' + (n.key === o.active ? ' active' : '') + '"' + (n.adminOnly ? ' data-admin' : '') + (n.key === o.active ? ' aria-current="page"' : '') + ' href="' + n.href + '">' +
        (n.icon || '') + '<span>' + n.label + '</span></a>';
    }).join('');

    host.innerHTML =
      '<a class="brand" href="index.html">' +
        '<span class="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5-5 7 5 7m8-14 5 7-5 7m-3-16-2 20"/></svg></span>' +
        '<span class="brand-text"><span class="brand-name">' + (o.title || '算法手记') + '</span>' +
        '<p>ALGORITHM FIELDNOTES</p></span>' +
      '</a>' +
      '<p class="nav-caption">NOTEBOOK / 笔记本</p>' +
      '<nav class="top-nav" aria-label="主导航">' + links + '</nav>' +
      '<nav class="mobile-nav" id="mobileNav" aria-label="移动端导航">' + mnLinks + '</nav>' +
      '<div class="rail-note"><span class="rail-formula">think. solve. repeat.</span><p>读懂题意，拆解问题。<br>把每次思考，留给下一次。</p><a class="rail-source" href="https://github.com/noorenduddy32-cpu/algorithm-wordbook" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div>' +
      '<div class="top-actions">' +
        '<button id="navToggle" class="icon-btn nav-toggle" type="button" title="菜单" aria-label="打开菜单" aria-expanded="false" aria-controls="mobileNav">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
        '</button>' +
        '<div class="theme-wrap">' +
          '<button id="themeBtn" class="icon-btn" type="button" title="笔记本外观" aria-label="笔记本外观" aria-controls="themeMenu" aria-expanded="false"><span id="themeIcon"></span></button>' +
          '<div id="themeMenu" class="theme-menu" role="group" aria-label="笔记本外观" hidden></div>' +
        '</div>' +
        '<div class="fs-wrap">' +
          '<button id="fsBtn" class="icon-btn" title="阅读字号" aria-label="阅读字号" aria-controls="fsMenu" aria-expanded="false" type="button">' +
            '<span class="reading-icon" aria-hidden="true">Aa</span>' +
          '</button>' +
          '<div id="fsMenu" class="fs-menu" role="group" aria-label="阅读字号" hidden></div>' +
        '</div>' +
      '</div>';

    // Navigation remains keyboard-accessible in the compact layout.
    const navToggle = host.querySelector('#navToggle');
    const mnav = host.querySelector('#mobileNav');
    if (navToggle && mnav) {
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !document.body.classList.contains('nav-open')) return;
        document.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      });
      navToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const open = document.body.classList.toggle('nav-open');
        navToggle.setAttribute('aria-expanded', String(open));
      });
      mnav.addEventListener('click', function (e) {
        if (e.target.closest('a')) { document.body.classList.remove('nav-open'); navToggle.setAttribute('aria-expanded', 'false'); }
      });
      document.addEventListener('click', function (e) {
        if (!document.body.classList.contains('nav-open')) return;
        if (e.target.closest('#mobileNav') || e.target.closest('#navToggle')) return;
        document.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    }
  }

  /* ---------------- 工具 ---------------- */

  // 活跃度：本地背诵/编辑次数（与单词本同键，跨页共享）
  const LS_ACT = 'wb_activity_v1';
  function dayKeyOf(d) {
    const p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function bumpActivity(n) {
    const d = dayKeyOf(new Date());
    let o = {};
    try { o = JSON.parse(localStorage.getItem(LS_ACT) || '{}'); } catch (e) {}
    o[d] = (o[d] || 0) + (n || 1);
    try { localStorage.setItem(LS_ACT, JSON.stringify(o)); } catch (e) {}
  }
  function getLocalActivity() {
    try { return JSON.parse(localStorage.getItem(LS_ACT) || '{}'); } catch (e) { return {}; }
  }

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

  /* ---------------- 正文字号：14–20 px，不缩放导航与按钮 ---------------- */

  const FS_MIN = 14, FS_MAX = 20, FS_DEFAULT = 16;
  function getFontScale() {
    try {
      const current = Number(localStorage.getItem(LS_FS));
      if (current >= FS_MIN && current <= FS_MAX) return Math.round(current);
      const raw = localStorage.getItem(LS_FS_LEGACY);
      if (raw === null) return FS_DEFAULT;
      let previous = Number(raw);
      if (!Number.isFinite(previous)) return FS_DEFAULT;
      if (previous > 0 && previous < 2 && raw.indexOf('.') >= 0) return Math.max(FS_MIN, Math.min(FS_MAX, Math.round(16 * previous)));
      previous = Math.max(1, Math.min(100, previous));
      return Math.round(previous <= 50 ? 14 + (previous - 1) * 2 / 49 : 16 + (previous - 50) * 4 / 50);
    } catch (e) { return FS_DEFAULT; }
  }
  function applyFontScale(value, persist) {
    const size = Math.max(FS_MIN, Math.min(FS_MAX, Math.round(Number(value) || FS_DEFAULT)));
    const root = document.documentElement;
    root.style.removeProperty('zoom');
    root.style.setProperty('--content-font-size', size + 'px');
    root.style.setProperty('--content-scale', String(size / 16));
    if (persist !== false) {
      try { localStorage.setItem(LS_FS, String(size)); } catch (e) {}
    }
    const range = $('fsRange'), label = $('fsVal');
    if (range) { range.value = size; range.setAttribute('aria-valuetext', size + ' 像素'); }
    if (label) label.textContent = size + ' px';
  }
  function buildFontMenu() {
    const menu = $('fsMenu');
    if (!menu) return;
    const current = getFontScale();
    menu.innerHTML =
      '<div class="fs-row"><label for="fsRange">阅读字号</label><output id="fsVal" for="fsRange">' + current + ' px</output></div>' +
      '<input id="fsRange" type="range" min="' + FS_MIN + '" max="' + FS_MAX + '" step="1" value="' + current + '" aria-valuetext="' + current + ' 像素">' +
      '<p class="fs-hint">调整词汇与笔记正文的大小</p>' +
      '<button type="button" class="link-btn fs-reset" id="fsReset">恢复标准字号</button>';
  }
  function initFontScale() {
    buildFontMenu();
    applyFontScale(getFontScale(), false);
    bindPopup('fsMenu', 'fsBtn', '.fs-wrap');
    const menu = $('fsMenu');
    if (menu) {
      menu.addEventListener('input', function (e) { if (e.target.id === 'fsRange') applyFontScale(e.target.value); });
      menu.addEventListener('click', function (e) { if (e.target.closest('#fsReset')) applyFontScale(FS_DEFAULT); });
    }
    window.addEventListener('storage', function (e) {
      if (e.key === LS_FS || e.key === LS_FS_LEGACY || e.key === null) applyFontScale(getFontScale(), false);
    });
  }

  /* ---------------- 启动 ---------------- */

  function boot(opts) {
    opts = Object.assign({}, opts || {}, {
      title: '算法手记',
      subtitle: '题面词汇 · 题解与算法',
      nav: [
        { key: 'home', label: '学习工作台', href: 'index.html', icon: ICONS.home },
        { key: 'wordbook', label: '题面词汇', href: 'wordbook.html', icon: ICONS.book },
        { key: 'notes', label: '题解笔记', href: 'notes.html', icon: ICONS.pen },
        { key: 'visits', label: '访问记录', href: 'visits.html', icon: ICONS.file, adminOnly: true }
      ]
    });
    if (opts.topbar !== false) renderTopbar(opts);
    const main = document.querySelector('main');
    if (main && !document.querySelector('.skip-link')) {
      if (!main.id) main.id = 'mainContent';
      main.tabIndex = -1;
      const skip = document.createElement('a');
      skip.className = 'skip-link'; skip.href = '#' + main.id; skip.textContent = '跳到主要内容';
      document.body.prepend(skip);
    }
    if (opts.theme !== false) initTheme();
    if (opts.modals !== false) initModals();
    if (opts.fontScale !== false) initFontScale();
  }

  window.AN = {
    $: $,
    cfg: cfg,
    ICONS: ICONS,
    THEMES: THEMES,
    applyTheme: applyTheme,
    toast: toast,
    askPassword: askPassword,
    isUnlocked: function () { return window.AN_ROLE === 'admin'; },
    boot: boot,
    esc: esc,
    bumpActivity: bumpActivity,
    getLocalActivity: getLocalActivity,
    fmtDate: fmtDate,
    relTime: relTime,
    countWords: countWords,
    autoSummary: autoSummary,
    // 数据层改走 /api 代理（api.js 提供 window.DB / window.ANCloud），
    // 云端密钥与密码只在服务端，前端零敏感信息。
    getDb: function () { return window.DB || null; },
    getCloud: function () { return window.ANCloud || null; }
  };
})();
