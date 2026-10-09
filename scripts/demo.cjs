// A local, in-memory notebook for trying the UI without credentials or cloud data.
const { randomBytes } = require('node:crypto');
const { createFixtureCloud } = require('../tests/fixture-cloud.cjs');
const listen = (server, port) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
(async () => {
  const fixture = createFixtureCloud();
  await listen(fixture.server, 0);
  process.env.CLOUD_ENDPOINT = 'http://127.0.0.1:' + fixture.server.address().port;
  process.env.CLOUD_KEY = 'local-demo-only';
  process.env.ADMIN_PASSWORD = 'demo-admin';
  process.env.VISITOR_PASSWORD = 'icpc';
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'development';
  fixture.db.notes.find(note => note.id === 3).title = '待整理：线段树的合并逻辑';
  fixture.db.notes.find(note => note.id === 3).summary = '一篇用于演示权限边界的私密笔记。';
  fixture.db.notes.find(note => note.id === 4).title = '复盘草稿：从枚举到动态规划';
  const { createServer } = require('../server');
  const server = createServer();
  await listen(server, Number(process.env.DEMO_PORT || 8788));
  console.log('算法手记演示：http://127.0.0.1:' + server.address().port);
  console.log('演示管理员密码：demo-admin（仅此演示；数据关闭后清空）');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(); fixture.server.close();
  });
})().catch(error => { console.error(error.message); process.exit(1); });
