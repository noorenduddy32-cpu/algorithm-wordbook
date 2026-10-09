const { test } = require('node:test');
const assert = require('node:assert/strict');
const cryptoNode = require('node:crypto');

test('线上运行适配保留公开阅读、管理员权限、Cookie 与跨站边界', async t => {
  const { handleRequest } = await import('../worker/index.mjs');
  const env = { VISITOR_PASSWORD: 'worker-fixture-visitor', ADMIN_PASSWORD: 'worker-fixture-admin', SESSION_SECRET: 'worker-fixture-secret-'.repeat(3), CLOUD_ENDPOINT: 'https://fixture.invalid', CLOUD_KEY: 'fixture-key' };
  const calls = [], realFetch = global.fetch;
  global.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return new Response(JSON.stringify([{ id: 1 }]), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  t.after(() => { global.fetch = realFetch; });
  const request = (name, body, headers = {}) => new Request('https://notebook.test/api/' + name, { method: body === undefined ? 'GET' : 'POST', headers: { ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  let adminCookie, visitorCookie;

  await t.test('访客密码签发只读会话；未登录和伪造身份都不能读取数据', async () => {
    assert.deepEqual(await (await handleRequest(request('me'), {})).json(), { role: null });
    assert.equal((await handleRequest(request('db', { table: 'notes', action: 'select', role: 'admin' }), env)).status, 401);
    const login = await handleRequest(request('login', { role: 'visitor', password: env.VISITOR_PASSWORD }), env);
    assert.equal(login.status, 200);
    visitorCookie = login.headers.get('set-cookie').split(';')[0];
    const result = await handleRequest(request('db', { table: 'notes', action: 'select' }, { Cookie: visitorCookie }), env);
    assert.equal(result.status, 200);
    const sent = new URL(calls.at(-1).url);
    assert.equal(sent.origin, env.CLOUD_ENDPOINT);
    assert.equal(sent.searchParams.get('and'), '(status.eq.published,visibility.eq.public)');
    assert.equal(calls.at(-1).opts.headers['x-wb-webapp-access-key'], env.CLOUD_KEY);
    assert.equal((await handleRequest(request('db', { table: 'words', action: 'delete', filters: { id: 1 } }, { Cookie: visitorCookie }), env)).status, 403);
    assert.equal((await handleRequest(request('visits', undefined, { Cookie: visitorCookie }), env)).status, 403);
    assert.equal((await handleRequest(request('ai', { prompt: 'test' }), env)).status, 401);
    assert.equal((await handleRequest(request('ai', { prompt: 'test' }, { Cookie: visitorCookie }), env)).status, 403);
  });
  await t.test('签名 Cookie 与 Node 端兼容；篡改、过期和退出后都没有访问身份', async () => {
    assert.equal((await handleRequest(request('login', { role: 'admin', password: env.ADMIN_PASSWORD }), {})).status, 503);
    assert.equal((await handleRequest(request('login', { role: 'admin', password: 'incorrect' }), env)).status, 401);
    const login = await handleRequest(request('login', { role: 'admin', password: env.ADMIN_PASSWORD }), env);
    assert.equal(login.status, 200);
    const header = login.headers.get('set-cookie');
    assert.match(header, /HttpOnly; Secure; SameSite=Lax/);
    adminCookie = header.split(';')[0];
    assert.deepEqual(await (await handleRequest(request('me', undefined, { Cookie: adminCookie }), env)).json(), { role: 'admin' });
    const [payload, signature] = adminCookie.slice('an_sess='.length).split('.');
    assert.equal(cryptoNode.createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url'), signature);
    assert.deepEqual(await (await handleRequest(request('me', undefined, { Cookie: adminCookie + 'tampered' }), env)).json(), { role: null });
    const expired = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() - 1 })).toString('base64url');
    const signedExpired = expired + '.' + cryptoNode.createHmac('sha256', env.SESSION_SECRET).update(expired).digest('base64url');
    assert.deepEqual(await (await handleRequest(request('me', undefined, { Cookie: 'an_sess=' + signedExpired }), env)).json(), { role: null });
    const logout = await handleRequest(request('logout', {}, { Cookie: adminCookie }), env);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    assert.deepEqual(await (await handleRequest(request('me', undefined, { Cookie: logout.headers.get('set-cookie').split(';')[0] }), env)).json(), { role: null });
  });
  await t.test('管理员读取私密内容的接口使用相同查询校验；跨站与异常请求均被阻止', async () => {
    const response = await handleRequest(request('db', { table: 'notes', action: 'select' }, { Cookie: adminCookie }), env);
    assert.equal(response.status, 200);
    assert.equal(new URL(calls.at(-1).url).searchParams.has('and'), false);
    assert.equal((await handleRequest(request('db', { table: 'visits', action: 'select' }, { Cookie: adminCookie }), env)).status, 403);
    assert.equal((await handleRequest(request('login', { password: env.ADMIN_PASSWORD }, { Origin: 'https://other.test' }), env)).status, 403);
    assert.equal((await handleRequest(request('db', {}, { 'Sec-Fetch-Site': 'cross-site' }), env)).status, 403);
    for (const body of ['null', '[]', '123', '{']) assert.equal((await handleRequest(request('db', body), env)).status, 400);
    assert.equal((await handleRequest(request('login'), env)).status, 405);
  });
});
