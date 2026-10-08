const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
test('启动入口可运行，静态白名单保护源文件与数据', async function (t) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/')).status, 200);
  for (const name of ['.env.local', 'server.js', 'db/schema.sql', 'seed/seed.sql', 'words.json', 'api/_lib/auth.js']) {
    assert.equal((await fetch(base + '/' + name)).status, 404, name);
  }
  const me = await fetch(base + '/api/me');
  assert.equal(me.status, 401); assert.match(me.headers.get('cache-control'), /no-store/);
  assert.equal((await fetch(base + '/api/db')).status, 405);
  assert.equal((await fetch(base + '/api/db', { method: 'POST', body: '{' })).status, 400);
});
