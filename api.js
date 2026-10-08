/* ============================================================
   api.js —— 前端数据层 + 公开浏览 + 管理员登录（无密钥、无密码）
   - DB：链式 builder 序列化后 POST /api/db（服务端再连云端，密钥只在服务端）
   - Auth：登录态走 HttpOnly Cookie，前端只看得到角色
   - 访客：只读；管理员：增删改 + AI
   必须在本文件之前加载 config.js，之后加载各页面脚本。
   ============================================================ */
(function () {
  'use strict';
  let sessionVersion = 0;

  /* ---------------- 云端数据库代理（链式 builder） ---------------- */

  const DB = (function () {
    function build(table) {
      const op = { table: table || null, action: null, columns: '*', filters: {}, order: null, limit: null, data: null, single: false };
      const a = {
        from: function (t) { op.table = t; return a; },
        select: function (c) {
          // 链式：insert/update/delete 之后的 .select() 表示“返回写入后的行”（Supabase 语义），
          // 不能把 action 覆盖成 select。
          if (op.action && op.action !== 'select') {
            op.returning = true;
            if (c) op.columns = c;
            return a;
          }
          op.action = 'select'; op.columns = (c || '*'); return a;
        },
        insert: function (rows) { op.action = 'insert'; op.data = rows; return a; },
        update: function (o) { op.action = 'update'; op.data = o; return a; },
        delete: function () { op.action = 'delete'; return a; },
        eq: function (k, v) { op.filters[k] = v; return a; },
        order: function (c, o) { op.order = c + '.' + (o && o.ascending === false ? 'desc' : 'asc'); return a; },
        limit: function (n) { op.limit = n; return a; },
        maybeSingle: function () { op.single = true; return a; },
        single: function () { op.single = true; return a; },
        then: function (res, rej) { return call(op).then(res, rej); }
      };
      return a;
    }
    async function call(op) {
      const version = sessionVersion;
      let r;
      try {
        r = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(op)
        });
      } catch (e) {
        return { data: null, error: { message: '网络错误：' + (e && e.message ? e.message : e) } };
      }
      let json = {};
      try { json = await r.json(); } catch (e) { json = {}; }
      if (version !== sessionVersion) return { data: null, error: { message: '登录身份已改变，请重新加载' } };
      if (r.status === 401) { resetSession(); onAuthed('visitor'); }
      if (!r.ok) return { data: null, error: { message: (json && json.error) || ('HTTP ' + r.status) } };
      let data = json.data;
      if (op.single && Array.isArray(data)) data = data[0] || null;
      return { data: data, error: null };
    }
    return { from: function (t) { return build(t); } };
  })();
  window.DB = DB;

  /* ---------------- 云端大模型代理（SSE 流式，供编辑器 AI 辅助） ---------------- */

  const ANCloud = {
    llm: {
      models: { list: function () { return Promise.resolve([{ id: 'auto', name: 'Auto', disabled: false }]); } },
      chat: {
        completions: {
          async *create(opts) {
            let r;
            try {
              r = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(opts)
              });
            } catch (e) { throw new Error('网络错误：' + (e && e.message ? e.message : e)); }
            if (!r.ok || !r.body) {
              let t = ''; try { t = await r.text(); } catch (e) {}
              throw new Error('AI 接口异常：' + (t.slice(0, 120) || ('HTTP ' + r.status)));
            }
            const dec = new TextDecoder();
            let buf = '';
            for await (const chunk of r.body) {
              buf += dec.decode(chunk, { stream: true });
              let idx;
              while ((idx = buf.indexOf('\n\n')) >= 0) {
                const raw = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                const line = raw.split('\n').find(function (l) { return l.indexOf('data:') === 0; });
                if (!line) continue;
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') continue;
                let o; try { o = JSON.parse(payload); } catch (e) { continue; }
                const d = o.choices && o.choices[0] && o.choices[0].delta;
                if (d) {
                  yield { choices: [{ delta: { content: d.content || '', reasoning_content: d.reasoning_content || '' } }] };
                }
              }
            }
          }
        }
      }
    }
  };
  window.ANCloud = ANCloud;

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
      const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
      const j = r.ok ? await r.json() : {};
      return j.role === 'admin' ? 'admin' : 'visitor';
    },
    async login(pw, requiredRole) {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ password: pw, role: requiredRole })
      });
      let j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(j.error || '登录服务暂时不可用，请稍后重试');
      if (j.role !== 'admin') throw new Error('管理员登录状态无效，请重试');
      return j.role;
    },
    async logout() {
      const r = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('退出失败，请重试');
    },
    async visitor() {
      const r = await fetch('/api/visitor', { method: 'POST', credentials: 'include' });
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

  function buildGate(message) {
    if (document.getElementById('gate')) return;
    const g = el(
      '<div id="gate" role="dialog" aria-modal="true" aria-labelledby="gateTitle">' +
        '<div class="gate-card">' +
          '<span class="gate-eyebrow">ACM / ICPC · PERSONAL NOTEBOOK</span>' +
          '<h1 id="gateTitle">管理员登录</h1>' +
          '<p class="muted">输入管理员密码，继续整理你的积累。</p>' +
          '<form id="gateForm">' +
            '<label class="sr-only" for="gatePw">管理员密码</label>' +
            '<input id="gatePw" type="password" placeholder="管理员密码" autocomplete="current-password" required aria-describedby="gateErr">' +
            '<button type="submit" class="btn primary">进入管理</button>' +
          '</form>' +
          '<p class="gate-roles">公开内容无需登录。管理员可整理词汇、编辑笔记与查看私密内容。</p>' +
          '<button class="btn ghost" id="gateCancel" type="button">继续公开浏览</button>' +
          '<p id="gateErr" role="alert" hidden></p>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(g);
    const input = g.querySelector('#gatePw');
    const err = g.querySelector('#gateErr');
    if (message) { err.textContent = message; err.hidden = false; }
    input.focus();
    const cancel = g.querySelector('#gateCancel');
    cancel.onclick = function () {
      g.remove(); document.body.style.overflow = '';
      if (!Auth.role) onAuthed('visitor');
    };
    g.querySelector('#gateForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const button = g.querySelector('[type="submit"]');
      button.disabled = true; cancel.disabled = true; err.hidden = true;
      try {
        const role = await Auth.login(input.value, 'admin');
        resetSession(); broadcastSession(); onAuthed(role);
      } catch (ex) {
        err.textContent = ex.message || '连接失败，请检查网络后重试';
        err.hidden = false; input.value = ''; input.focus();
      } finally { button.disabled = false; cancel.disabled = false; }
    });
    document.body.style.overflow = 'hidden';
  }

  function onAuthed(role) {
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
      (admin ? '管理员 · 返回公开浏览' : '管理员登录') + '</button>' +
      (admin ? '<button type="button" class="role-logout" title="退出管理并继续公开浏览">退出管理</button>' : '');
    bar.querySelector('.role-tag').onclick = admin ? switchToVisitor : function () { buildGate(); };
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
      resetSession(); broadcastSession(); onAuthed('visitor');
      AN.toast('已退出管理，继续公开浏览');
    } catch (e) { AN.toast(e.message, true); }
  }

  async function init() {
    const version = sessionVersion;
    window.AN_HAS_BACKEND = true;
    try {
      const role = await Auth.me();
      if (version !== sessionVersion) return;
      if (role !== 'admin') resetSession();
      onAuthed(role);
    } catch (e) {
      if (version !== sessionVersion) return;
      resetSession(); onAuthed('visitor');
    }
  }
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
  window.reopenGate = function () { buildGate(); };
  window.syncRole = async function () {
    const version = sessionVersion;
    let role;
    try { role = await Auth.me(); } catch (e) { role = 'visitor'; }
    if (version !== sessionVersion) return Auth.role;
    if (role) { resetSession(); broadcastSession(); onAuthed(role); }
    return role;
  };
})();
