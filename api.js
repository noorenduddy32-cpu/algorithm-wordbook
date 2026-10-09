/* Public reading, administrator sessions and cache isolation. Transport: data-client.js. */
(function () {
  'use strict';
  let sessionVersion = 0;
  /* ---------------- 登录态与缓存 ---------------- */

  function clearCaches() {
    // 清理旧版跨角色共用的持久缓存；私密正文只使用当前标签页会话缓存。
    try {
      ['wb_home_cache', 'wb_notes_cache', 'wb_words_cache', 'an_note_draft_v2', 'wb_edit_unlocked'].forEach(function (key) { localStorage.removeItem(key); });
      Object.keys(sessionStorage).filter(function (key) { return key.indexOf('an_cache:') === 0; })
        .forEach(function (key) { sessionStorage.removeItem(key); });
    } catch (e) {}
  }
  // 只迁移旧缓存，不影响同一管理员标签页内的快速导航。
  try {
    ['wb_home_cache', 'wb_notes_cache', 'wb_words_cache', 'an_note_draft_v2', 'wb_edit_unlocked'].forEach(function (key) { localStorage.removeItem(key); });
  } catch (e) {}

  window.NoteCache = {
    get: function (name) {
      // 访客始终读取服务端当前公开数据，避免展示后来转为私密的旧缓存。
      if (Auth.role !== 'admin') return null;
      try { return JSON.parse(sessionStorage.getItem('an_cache:admin:' + name) || 'null'); } catch (e) { return null; }
    },
    set: function (name, data) {
      if (Auth.role !== 'admin') return;
      try { sessionStorage.setItem('an_cache:admin:' + name, JSON.stringify(data)); } catch (e) {}
    }
  };

  const Auth = {
    role: null,
    async me() {
      const r = await ANRequest('/api/me', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('无法验证访问权限');
      const j = await r.json();
      return j.role === 'admin' || j.role === 'visitor' ? j.role : null;
    },
    async login(pw, requiredRole) {
      const r = await ANRequest('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ password: pw, role: requiredRole })
      });
      let j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(j.error || '登录服务暂时不可用，请稍后重试');
      if (j.role !== requiredRole) throw new Error('登录状态无效，请重试');
      return j.role;
    },
    async logout() {
      const r = await ANRequest('/api/logout', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('退出失败，请重试');
    },
    async visitor() {
      const r = await ANRequest('/api/visitor', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('切换失败，请重新登录');
      const j = await r.json();
      if (j.role !== 'visitor') throw new Error('访客状态无效');
      return j.role;
    }
  };
  window.Auth = Auth;
  window.whenAuthed = function (cb) {
    window.addEventListener('an:authed', cb);
    if (Auth.role) cb();
  };

  function resetSession() {
    sessionVersion++;
    Auth.role = null;
    window.AN_ROLE = null;
    clearCaches();
    document.documentElement.dataset.auth = 'pending';
    document.querySelectorAll('[data-admin]').forEach(function (n) { n.style.display = 'none'; });
    window.dispatchEvent(new CustomEvent('an:session-reset'));
  }
  function broadcastSession() {
    try { localStorage.setItem('an_session_changed', Date.now() + ':' + Math.random()); } catch (e) {}
  }
  function canChangeSession() {
    return window.dispatchEvent(new CustomEvent('an:before-session-change', { cancelable: true }));
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function buildGate(message, requiredRole) {
    requiredRole = requiredRole === 'admin' ? 'admin' : 'visitor';
    const existing = document.getElementById('gate');
    if (existing) {
      if (existing.dataset.role === requiredRole) {
        const error = existing.querySelector('#gateErr');
        if (message && error) { error.textContent = message; error.hidden = false; }
        return;
      }
      existing.remove();
    }
    const g = el(
      '<div id="gate" role="dialog" aria-modal="true" aria-labelledby="gateTitle">' +
        '<div class="gate-card">' +
          '<span class="gate-eyebrow">ALGORITHM FIELDNOTES · ACCESS</span>' +
          '<h1 id="gateTitle"></h1>' +
          '<p class="muted" id="gateDescription"></p>' +
          '<form id="gateForm">' +
            '<label class="sr-only" id="gatePwLabel" for="gatePw"></label>' +
            '<input id="gatePw" type="password" autocomplete="current-password" required aria-describedby="gateErr">' +
            '<button type="submit" class="btn primary" id="gateSubmit"></button>' +
          '</form>' +
          '<p class="gate-roles">访客可阅读词汇与已发布的公开笔记。管理员可编辑内容并查看私密笔记。</p>' +
          '<div class="gate-actions"><button class="btn ghost" id="gateRoleToggle" type="button"></button><button class="btn ghost" id="gateCancel" type="button" hidden>返回公开阅读</button></div>' +
          '<p id="gateErr" role="alert" hidden></p>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(g);
    const input = g.querySelector('#gatePw');
    const err = g.querySelector('#gateErr');
    const roleToggle = g.querySelector('#gateRoleToggle');
    const cancel = g.querySelector('#gateCancel');
    function updateRole() {
      const admin = requiredRole === 'admin';
      g.dataset.role = requiredRole;
      g.querySelector('#gateTitle').textContent = admin ? '管理员登录' : '输入访客密码';
      g.querySelector('#gateDescription').textContent = admin ? '进入管理空间，继续整理你的积累。' : '验证访客密码后，可阅读公开的词汇与算法笔记。';
      g.querySelector('#gatePwLabel').textContent = admin ? '管理员密码' : '访客密码';
      input.placeholder = admin ? '管理员密码' : '访客密码';
      g.querySelector('#gateSubmit').textContent = admin ? '进入管理' : '进入公开阅读';
      g.querySelector('#gateRoleToggle').textContent = admin ? '访客访问' : '管理员登录';
      cancel.hidden = !Auth.role;
      input.value = '';
      err.hidden = true;
    }
    updateRole();
    if (message) { err.textContent = message; err.hidden = false; }
    input.focus();
    cancel.onclick = function () {
      g.remove(); document.body.style.overflow = '';
    };
    roleToggle.onclick = function () {
      requiredRole = requiredRole === 'admin' ? 'visitor' : 'admin';
      updateRole(); input.focus();
    };
    g.querySelector('#gateForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const button = g.querySelector('[type="submit"]');
      button.disabled = true; cancel.disabled = true; roleToggle.disabled = true; err.hidden = true;
      try {
        const role = await Auth.login(input.value, requiredRole);
        resetSession(); broadcastSession(); onAuthed(role);
      } catch (ex) {
        err.textContent = ex.message || '连接失败，请检查网络后重试';
        err.hidden = false; input.value = ''; input.focus();
      } finally { button.disabled = false; cancel.disabled = false; roleToggle.disabled = false; }
    });
    document.body.style.overflow = 'hidden';
  }

  function onAuthed(role) {
    if (role !== 'admin' && role !== 'visitor') { buildGate('', 'visitor'); return; }
    Auth.role = role;
    window.AN_ROLE = role;
    document.documentElement.dataset.auth = role;
    const g = document.getElementById('gate');
    if (g) g.remove();
    document.body.style.overflow = '';
    applyRole(role);
    window.dispatchEvent(new CustomEvent('an:authed', { detail: { role: role } }));
    window.dispatchEvent(new CustomEvent(role === 'admin' ? 'an:admin' : 'an:visitor'));
  }

  function applyRole(role) {
    const admin = role === 'admin';
    document.querySelectorAll('[data-admin]').forEach(function (n) { n.style.display = admin ? '' : 'none'; });
    let bar = document.getElementById('roleBar');
    if (!bar) {
      bar = el('<div class="role-bar" id="roleBar"></div>');
      const host = document.querySelector('.top-actions');
      if (host) host.appendChild(bar);
    }
    bar.innerHTML =
      '<button type="button" class="role-tag ' + (admin ? 'admin' : 'visitor') + '" title="' +
      (admin ? '切换到访客视角，仅查看公开内容' : '输入管理员密码') + '">' +
      (admin ? '公开视角' : '管理员登录') + '</button>' +
      (admin ? '' : '<button type="button" class="role-logout" title="退出访客访问">退出访问</button>');
    bar.querySelector('.role-tag').onclick = admin ? switchToVisitor : function () { buildGate('', 'admin'); };
    const logout = bar.querySelector('.role-logout');
    if (logout) logout.onclick = doLogout;
  }

  async function switchToVisitor() {
    if (!canChangeSession()) return;
    try {
      await Auth.visitor();
      resetSession(); broadcastSession(); onAuthed('visitor');
      AN.toast('已返回公开浏览');
    } catch (e) { AN.toast(e.message, true); }
  }
  async function doLogout() {
    if (!canChangeSession()) return;
    try {
      await Auth.logout();
      requireLogin('已退出访问，请重新输入访客密码。');
    } catch (e) { AN.toast(e.message, true); }
  }

  function requireLogin(message) {
    resetSession();
    broadcastSession();
    buildGate(message || '访问会话已过期，请重新输入访问密码。', 'visitor');
  }

  async function init() {
    const version = sessionVersion;
    window.AN_HAS_BACKEND = true;
    try {
      const role = await Auth.me();
      if (version !== sessionVersion) return;
      if (!role) {
        resetSession();
        buildGate('', 'visitor');
        return;
      }
      if (role !== 'admin') resetSession();
      onAuthed(role);
    } catch (e) {
      if (version !== sessionVersion) return;
      requireLogin('暂时无法验证访问权限，请检查连接后重试。');
    }
  }
  window.addEventListener('an:session-expired', function () { requireLogin(); });
  window.addEventListener('storage', function (e) {
    if (e.key !== 'an_session_changed') return;
    resetSession();
    const gate = document.getElementById('gate'); if (gate) gate.remove();
    init();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { resetSession(); init(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.reopenGate = function () { buildGate('', 'admin'); };
  window.syncRole = async function () {
    const version = sessionVersion;
    let role;
    try { role = await Auth.me(); } catch (e) { role = null; }
    if (version !== sessionVersion) return Auth.role;
    if (role) { resetSession(); broadcastSession(); onAuthed(role); }
    else requireLogin('访问会话已过期，请重新输入访问密码。');
    return role;
  };
})();
