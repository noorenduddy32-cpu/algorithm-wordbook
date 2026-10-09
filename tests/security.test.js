const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SESSION_SECRET = 'test-secret-'.repeat(5);
process.env.VISITOR_PASSWORD = 'test-visitor';
process.env.ADMIN_PASSWORD = 'test-admin';
const auth = require('../api/_lib/auth');
const { handleDb } = require('../api/_lib/cloud');
const http = require('../api/_lib/http');
const originalFetch = global.fetch;
let calls;
beforeEach(function () {
  calls = [];
  global.fetch = async function (url, options) {
    calls.push({ url: new URL(url), options });
    return { status: 200, text: async function () { return '[{"id":1}]'; } };
  };
});
afterEach(function () { global.fetch = originalFetch; });
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(data) { this.body = data ? JSON.parse(data) : null; } };
}
function request(method, body, role) {
  return { method, body, headers: { host: 'localhost', cookie: role ? 'an_sess=' + auth.sign(role) : '' } };
}

test('未登录不能读取数据；访客只能读取共享词汇与公开笔记', async function () {
  assert.equal((await handleDb({ table: 'words', action: 'select' }, null)).status, 401);
  assert.equal((await handleDb({ table: 'notes', action: 'select' }, null)).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await handleDb({ table: 'words', action: 'select' }, 'visitor')).status, 200);
  assert.equal(calls[0].url.searchParams.has('and'), false);
  assert.equal((await handleDb({ table: 'notes', action: 'select' }, 'visitor')).status, 200);
  assert.equal(calls[1].url.searchParams.get('and'), '(status.eq.published,visibility.eq.public)');
  assert.equal((await handleDb({ table: 'notes', action: 'select' }, 'owner')).status, 401);
  assert.equal(calls.length, 2);
});
test('匿名和访客所有写入均被拒绝，包括阅读量更新', async function () {
  for (const table of ['words', 'notes']) for (const action of ['insert', 'update', 'delete']) {
    assert.equal((await handleDb({ table, action, data: { views: 99 }, filters: { id: 2 } }, null)).status, 401);
    assert.equal((await handleDb({ table, action, data: { views: 99 }, filters: { id: 2 } }, 'visitor')).status, 403);
  }
  assert.equal(calls.length, 0);
});
test('访客请求强制同时限制 published 与 public，且不修改原请求', async function () {
  const op = { table: 'notes', action: 'select', columns: 'id,title', filters: { id: 2, visibility: 'private' } };
  assert.equal((await handleDb(op, 'visitor')).status, 200);
  assert.equal(calls[0].url.searchParams.get('and'), '(status.eq.published,visibility.eq.public)');
  assert.equal(calls[0].url.searchParams.get('visibility'), 'eq.private');
  assert.equal(op.and, undefined);
});
test('数据库接口要求签名会话并忽略伪造角色', async function () {
  const db = require('../api/db');
  const req = request('POST', { table: 'notes', action: 'select', role: 'admin' });
  req.headers.cookie = 'an_sess=forged.admin';
  let res = response(); await db(req, res);
  assert.equal(res.statusCode, 401);
  req.headers.cookie = 'an_sess=' + auth.sign('visitor');
  res = response(); await db(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url.searchParams.get('and'), '(status.eq.published,visibility.eq.public)');
  req.body = { table: 'notes', action: 'delete', filters: { id: 1 }, role: 'admin' };
  res = response(); await db(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1);
});
test('禁止通过表名、投影、筛选、逻辑表达式和排序绕过数据边界', async function () {
  for (const change of [
    { table: 'visits' }, { table: '../visits' }, { table: '__proto__' }, { action: 'rpc' },
    { columns: '*,visits(*)' }, { columns: 'notes:notes(*)' }, { filters: { select: '*' } },
    { filters: { or: '(visibility.eq.private)' } }, { and: [{ col: 'id', val: 1 }] },
    { order: 'id.desc,visits(id)' }, { limit: -1 }, { data: null, action: 'insert' }
  ]) {
    const result = await handleDb(Object.assign({ table: 'notes', action: 'select' }, change), 'admin');
    assert.ok(result.status >= 400, JSON.stringify(change));
  }
  assert.equal(calls.length, 0);
});
test('管理员能读取全部笔记及按 id 编辑，不能误操作整张表', async function () {
  assert.equal((await handleDb({ table: 'notes', action: 'select' }, 'admin')).status, 200);
  assert.equal(calls[0].url.searchParams.has('and'), false);
  assert.equal((await handleDb({ table: 'notes', action: 'update', data: { title: '新标题' }, filters: { id: 2 } }, 'admin')).status, 200);
  assert.equal(calls[1].options.method, 'PATCH');
  assert.equal((await handleDb({ table: 'notes', action: 'delete' }, 'admin')).status, 400);
});
test('签名 Cookie 防篡改、限定角色、拒绝过期时间与默认密钥', function () {
  assert.equal(auth.verify(auth.sign('admin')), 'admin');
  assert.equal(auth.verify(auth.sign('visitor') + 'x'), null);
  const secret = process.env.SESSION_SECRET;
  for (const payload of [{ role: 'owner', exp: Date.now() + 10000 }, { role: 'admin', exp: 'forever' }, { role: 'admin', exp: Date.now() - 1 }]) {
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(p).digest('base64url');
    assert.equal(auth.verify(p + '.' + sig), null);
  }
  delete process.env.SESSION_SECRET;
  try { assert.throws(() => auth.sign('admin')); assert.equal(auth.verify('a.b'), null); }
  finally { process.env.SESSION_SECRET = secret; }
});
test('访客与管理员密码分别签发只匹配对应角色的 HttpOnly Cookie', async function () {
  const login = require('../api/login');
  let res = response(); await login(request('POST', { password: 'test-admin', role: 'admin' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.role, 'admin');
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  assert.match(res.headers['Cache-Control'], /no-store/);
  res = response(); await login(request('POST', { password: 'test-visitor', role: 'visitor' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.role, 'visitor');
  assert.equal(auth.verify(res.headers['Set-Cookie'].split(';')[0].slice('an_sess='.length)), 'visitor');
  for (const [role, password] of [['admin', 'test-visitor'], ['visitor', 'test-admin'], ['visitor', ''], ['admin', 'wrong-password']]) {
    res = response(); await login(request('POST', { password, role }), res);
    assert.equal(res.statusCode, 401); assert.equal(res.headers['Set-Cookie'], undefined);
  }
});
test('缺少身份密码或会话密钥时关闭相应登录', async function () {
  const login = require('../api/login');
  const visitorPassword = process.env.VISITOR_PASSWORD;
  delete process.env.VISITOR_PASSWORD;
  try {
    const res = response(); await login(request('POST', { password: 'test-visitor', role: 'visitor' }), res);
    assert.equal(res.statusCode, 503);
  } finally { process.env.VISITOR_PASSWORD = visitorPassword; }
  for (const key of ['ADMIN_PASSWORD', 'SESSION_SECRET']) {
    const value = process.env[key]; delete process.env[key];
    try {
      const res = response(); await login(request('POST', { password: 'test-admin', role: 'admin' }), res);
      assert.equal(res.statusCode, 503); assert.equal(res.headers['Set-Cookie'], undefined);
    } finally { process.env[key] = value; }
  }
});
test('拒绝错误请求方法和跨站写入；无效 Cookie 不导致崩溃', async function () {
  const login = require('../api/login');
  const wrongMethod = response(); await login(request('GET', {}), wrongMethod); assert.equal(wrongMethod.statusCode, 405);
  const req = request('POST', { password: 'test-admin', role: 'admin' }); req.headers.origin = 'https://untrusted.example';
  const crossSite = response(); await login(req, crossSite); assert.equal(crossSite.statusCode, 403);
  assert.deepEqual(http.parseCookies({ headers: { cookie: 'an_sess=%' } }), {});
});
test('未登录或会话密钥失效时没有访问身份', async function () {
  const me = require('../api/me');
  const secret = process.env.SESSION_SECRET;
  const adminRequest = request('GET', {}, 'admin');
  let res = response(); await me(adminRequest, res); assert.equal(res.body.role, 'admin');
  delete process.env.SESSION_SECRET;
  try {
    for (const req of [request('GET', {}), adminRequest]) {
      res = response(); await me(req, res);
      assert.equal(res.statusCode, 200); assert.equal(res.body.role, null);
      assert.equal(res.headers['Set-Cookie'], undefined);
    }
  } finally { process.env.SESSION_SECRET = secret; }
});
test('只有已登录管理员能切换访客视角，并签发访客 Cookie', async function () {
  const visitor = require('../api/visitor');
  for (const role of [null, 'visitor']) {
    const res = response(); await visitor(request('POST', {}, role), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers['Set-Cookie'], undefined);
  }
  const res = response(); await visitor(request('POST', {}, 'admin'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.role, 'visitor');
  assert.equal(auth.verify(res.headers['Set-Cookie'].split(';')[0].slice('an_sess='.length)), 'visitor');
});
test('公开访问不能使用 AI 或读取访问日志', async function () {
  const ai = require('../api/ai');
  const visits = require('../api/visits');
  let res = response(); await ai(request('POST', {}), res); assert.equal(res.statusCode, 401);
  res = response(); await visits(request('GET', {}), res); assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 0);
});
test('匿名访问只记录现有字段，服务端指定访客身份且不返回日志数据', async function () {
  const visits = require('../api/visits');
  const req = request('POST', {
    role: 'admin', ip: 'forged-ip', path: 'x'.repeat(300), note_id: 7,
    note_title: 'n'.repeat(300), duration: -10, extra: 'ignored'
  });
  req.headers.origin = 'http://localhost'; req.headers['user-agent'] = 'a'.repeat(500);
  const res = response(); await visits(req, res);
  assert.equal(res.statusCode, 201); assert.deepEqual(res.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/.cloud/database/rest/visits');
  assert.equal(calls[0].options.headers.Prefer, 'return=minimal');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(payload).sort(), ['role', 'ip', 'region', 'ua', 'os', 'browser', 'path', 'note_id', 'note_title', 'duration'].sort());
  assert.equal(payload.role, 'visitor'); assert.equal(payload.ip, '');
  assert.equal(payload.path.length, 200); assert.equal(payload.note_title.length, 200);
  assert.equal(payload.ua.length, 400); assert.equal(payload.note_id, 7); assert.equal(payload.duration, 0);
});
test('访问记录拒绝跨站请求、错误方法、超大数据和无效字段', async function () {
  const visits = require('../api/visits');
  const requests = [
    [Object.assign(request('POST', {}), { headers: { host: 'localhost', origin: 'https://untrusted.example' } }), 403],
    [request('PUT', {}), 405],
    [Object.assign(request('POST', {}), { headers: { host: 'localhost', 'content-length': '9000' } }), 413],
    [request('POST', { path: 'x'.repeat(9000) }), 413],
    [request('POST', { note_id: { injected: true } }), 400],
    [request('POST', null), 400]
  ];
  for (const [req, status] of requests) {
    const res = response(); await visits(req, res); assert.equal(res.statusCode, status);
  }
  assert.equal(calls.length, 0);
});
