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

test('未登录不能读；未知角色也不能读', async function () {
  for (const role of [null, 'owner']) assert.equal((await handleDb({ table: 'notes', action: 'select' }, role)).status, 401);
  assert.equal(calls.length, 0);
});
test('访客所有写入均被拒绝，包括原先的阅读量更新漏洞', async function () {
  for (const action of ['insert', 'update', 'delete']) {
    assert.equal((await handleDb({ table: 'notes', action, data: { views: 99 }, filters: { id: 2 } }, 'visitor')).status, 403);
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
test('登录分配角色并设置 HttpOnly Cookie；访客密码不能升级管理员', async function () {
  const login = require('../api/login');
  for (const [password, role] of [['test-admin', 'admin'], ['test-visitor', 'visitor']]) {
    const res = response(); await login(request('POST', { password }), res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.role, role);
    assert.match(res.headers['Set-Cookie'], /HttpOnly/);
    assert.match(res.headers['Cache-Control'], /no-store/);
  }
  const res = response(); await login(request('POST', { password: 'test-visitor', role: 'admin' }), res);
  assert.equal(res.statusCode, 403); assert.equal(res.headers['Set-Cookie'], undefined);
});
test('同名密码及缺少会话密钥时关闭登录', async function () {
  const login = require('../api/login');
  const password = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = process.env.VISITOR_PASSWORD;
  try { const res = response(); await login(request('POST', { password: 'test-visitor' }), res); assert.equal(res.statusCode, 503); }
  finally { process.env.ADMIN_PASSWORD = password; }
});
test('拒绝错误请求方法和跨站写入；无效 Cookie 不导致崩溃', async function () {
  const login = require('../api/login');
  const wrongMethod = response(); await login(request('GET', {}), wrongMethod); assert.equal(wrongMethod.statusCode, 405);
  const req = request('POST', { password: 'test-admin' }); req.headers.origin = 'https://untrusted.example';
  const crossSite = response(); await login(req, crossSite); assert.equal(crossSite.statusCode, 403);
  assert.deepEqual(http.parseCookies({ headers: { cookie: 'an_sess=%' } }), {});
});
test('匿名不能降级取得访客会话，管理员能切换到访客', async function () {
  const visitor = require('../api/visitor');
  let res = response(); await visitor(request('POST', {}), res); assert.equal(res.statusCode, 401);
  res = response(); await visitor(request('POST', {}, 'admin'), res); assert.equal(res.statusCode, 200);
  assert.equal(auth.verify(res.headers['Set-Cookie'].split(';')[0].slice('an_sess='.length)), 'visitor');
});
