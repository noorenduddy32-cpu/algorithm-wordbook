/* ============================================================
   api.js —— 前端数据层 + 登录门 + 角色控制（无密钥、无密码）
   - DB：链式 builder 序列化后 POST /api/db（服务端再连云端，密钥只在服务端）
   - Auth：登录态走 HttpOnly Cookie，前端只看得到角色
   - 访客：只读；管理员：增删改 + AI
   必须在本文件之前加载 config.js，之后加载各页面脚本。
   ============================================================ */
(function () {
  'use strict';

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

  /* ---------------- 登录态 ---------------- */

  const Auth = {
    role: null,
    async me() {
      try {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.ok) { const j = await r.json(); this.role = j.role; }
        else this.role = null;
      } catch (e) { this.role = null; }
      return this.role;
    },
    async login(pw) {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ password: pw })
      });
      if (!r.ok) {
        let m = '密码不正确';
        try { m = (await r.json()).error || m; } catch (e) {}
        throw new Error(m);
      }
      const j = await r.json();
      this.role = j.role;
      return this.role;
    },
    async logout() {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
      this.role = null;
    },
    // 免密建立只读访客会话（写入 visitor Cookie），读权限才生效
    async visitor() {
      let role = 'visitor';
      try {
        const r = await fetch('/api/visitor', { method: 'POST', credentials: 'include' });
        if (r.ok) { const j = await r.json(); if (j && j.role) role = j.role; }
      } catch (e) { /* 后端不可达时退回前端只读视图 */ }
      this.role = role;
      return role;
    }
  };
  window.Auth = Auth;

  // 等登录态就绪后再加载数据；未登录则等登录成功后触发
  window.whenAuthed = function (cb) {
    if (Auth.role) cb();
    else window.addEventListener('an:authed', function () { cb(); }, { once: true });
  };

  /* ---------------- 登录门 ---------------- */

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function buildGate() {
    if (document.getElementById('gate')) return;
    const g = el(
      '<div id="gate">' +
        '<div class="gate-card">' +
          '<h1>算法竞赛笔记</h1>' +
          '<p class="muted">输入访问密码以进入</p>' +
          '<form id="gateForm" autocomplete="off">' +
            '<input id="gatePw" type="password" placeholder="访问密码" autocomplete="current-password">' +
            '<button type="submit" class="btn primary">进入笔记</button>' +
          '</form>' +
          '<p id="gateErr" class="err" hidden></p>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(g);
    const form = g.querySelector('#gateForm');
    const input = g.querySelector('#gatePw');
    const err = g.querySelector('#gateErr');
    setTimeout(function () { input.focus(); }, 60);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      err.hidden = true;
      try {
        const role = await Auth.login(input.value);
        onAuthed(role, true);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        input.value = '';
        input.focus();
      }
    });
    document.body.style.overflow = 'hidden';
  }

  function onAuthed(role, backendMode) {
    const g = document.getElementById('gate');
    if (g) { g.remove(); document.body.style.overflow = ''; }
    // 从访问门进入默认按本地后端处理；明确传 false 才走纯静态分支
    applyRole(role, backendMode !== false);
    window.AN_ROLE = role;
    window.dispatchEvent(new CustomEvent('an:authed', { detail: { role: role } }));
    if (role === 'admin') window.dispatchEvent(new CustomEvent('an:admin', { detail: { role: role } }));
  }

  function applyRole(role, backendMode) {
    role = role || Auth.role;
    const admin = role === 'admin';
    // 有后端（本地 _dev.js）才按角色隐藏管理按钮；纯静态部署没有角色徽标，
    // 仍靠编辑密码弹窗控制写权限
    if (backendMode) {
      document.querySelectorAll('[data-admin]').forEach(function (n) {
        n.style.display = admin ? '' : 'none';
      });
    }
    // 角色徽标只在本地有后端时显示；纯静态站点没有登录态，不显示访客/管理员标签
    if (!backendMode) {
      const bar = document.getElementById('roleBar');
      if (bar) bar.remove();
      return;
    }
    // 右上角角色徽标 + 退出登录
    let bar = document.getElementById('roleBar');
    if (!bar) {
      bar = el('<div class="role-bar" id="roleBar"></div>');
      const host = document.querySelector('.top-actions') || document.querySelector('.topbar');
      if (host) host.appendChild(bar);
    }
    if (bar) {
      bar.innerHTML =
        '<span class="role-tag ' + (admin ? 'admin' : 'visitor') + '" title="' + (admin ? '点击切换为访客模式（只读）' : '点击输入管理员密码进入管理模式') + '">' + (admin ? '管理' : '访客') + '</span>' +
        '<button type="button" class="role-logout" title="退出登录（回到访问门）">退出</button>';
      bar.classList.remove('clickable');
      const tag = bar.querySelector('.role-tag');
      const logoutBtn = bar.querySelector('.role-logout');
      tag.onclick = admin
        ? function () { switchToVisitor(); }
        : function () { if (window.reopenGate) window.reopenGate(); else location.reload(); };
      logoutBtn.onclick = function () { doLogout(); };
    }
  }

  // 管理模式 -> 访客模式：免密建立只读会话，立即刷新 UI（无刷新、无访问门）
  async function switchToVisitor() {
    try { await Auth.visitor(); } catch (e) {}
    window.AN_ROLE = 'visitor';
    applyRole('visitor', true);
    window.dispatchEvent(new CustomEvent('an:authed', { detail: { role: 'visitor' } }));
    window.dispatchEvent(new CustomEvent('an:visitor', { detail: { role: 'visitor' } }));
    if (window.AN && window.AN.toast) window.AN.toast('已切换为访客模式（只读）');
  }

  // 主动退出：清除签名会话 Cookie，回到访问门（之后站内跳转 / 刷新将再次要求输密码）
  async function doLogout() {
    try { await Auth.logout(); } catch (e) {}
    window.AN_ROLE = null;
    window.Auth.role = null;
    const bar = document.getElementById('roleBar');
    if (bar) bar.remove();
    document.querySelectorAll('[data-admin]').forEach(function (n) { n.style.display = 'none'; });
    buildGate();
  }

  async function init() {
    // 先探测后端 / 会话，决定角色与加载方式
    let resp = null;
    try { resp = await fetch('/api/me', { credentials: 'include' }); } catch (e) { resp = null; }
    const hasBackend = !!(resp && resp.status !== 404);
    window.AN_HAS_BACKEND = hasBackend;

    // 纯静态部署（WorkBuddy）没有 /api/me，不卡访问门，由 lockBtn 编辑模式控制写权限
    if (!resp || resp.status === 404) {
      applyRole(null, false);
      return;
    }

    // 有后端：已有会话（visitor/admin）直接静默恢复，切换/刷新都不弹门、不闪
    let role = null;
    try { const j = await resp.json(); role = j && j.role; } catch (e) {}
    if (role === 'visitor' || role === 'admin') {
      Auth.role = role;
      onAuthed(role, true);
      return;
    }

    // 无会话：自动以访客身份只读进入（无需手输密码），数据照常可看；
    // 需要写时再点角色徽标/写按钮，弹门输管理员密码升级。
    const v = await Auth.visitor();
    onAuthed(v, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 暴露给页面脚本：重新弹出访问门（本地有后端时，点编辑模式按钮用它升级为管理员）
  window.reopenGate = function () { buildGate(); };

  // 暴露给页面脚本：用已设置的角色 cookie 刷新 UI（本地有后端时，
  // 在解锁编辑模式弹窗里输管理员密码升级后，调用它让角色门 / 添加按钮即时生效）
  window.syncRole = async function () {
    const r = await Auth.me();
    if (r) onAuthed(r, true);
    return r;
  };
})();
