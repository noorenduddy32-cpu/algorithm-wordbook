// 仅测试使用的内存数据库，不读取真实云端，不包含用户数据。
const http = require('node:http');
function createFixtureCloud() {
  const year = new Date().getFullYear();
  const date = (month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T04:00:00.000Z`;
  const notes = [
    { id: 1, title: 'CF · 双指针的边界为什么这样移动？', summary: '从区间的单调性出发，梳理指针移动与答案更新的关系。', tags: ['双指针', '题目复盘'], visibility: 'public', status: 'published' },
    { id: 2, title: '并查集：维护连通关系', summary: '路径压缩与按秩合并，以及什么时候需要回滚。', tags: ['数据结构', '算法整理'], visibility: 'public', status: 'published' },
    { id: 3, title: 'PRIVATE_NOTE_SENTINEL', summary: 'PRIVATE_SUMMARY_SENTINEL', tags: [], visibility: 'private', status: 'published' },
    { id: 4, title: 'DRAFT_NOTE_SENTINEL', summary: '尚未发布', tags: [], visibility: 'public', status: 'draft' },
    { id: 5, title: '贪心证明：交换之后为什么不会变差', summary: '记录一次从直觉到证明的复盘。', tags: ['贪心', '证明'], visibility: 'public', status: 'published' }
  ].map((n, i) => ({ ...n, content: '<h2>关键思路</h2><p>先明确不变量，再考虑如何维护。</p><pre><code class="language-cpp">for (int i = 0; i &lt; n; i++)\n{\n    ans += a[i];\n}</code></pre>', category: '', views: 0, created_at: date(9, i + 1), updated_at: date(10, i + 1) }));
  const words = [
    ['distinct', 'adj.', '不同的；互不相同的'], ['permutation', 'n.', '排列'], ['consecutive', 'adj.', '连续的'],
    ['non-decreasing', 'adj.', '非递减的'], ['adjacent', 'adj.', '相邻的'], ['constraint', 'n.', '约束条件']
  ].map((w, i) => ({ id: i + 1, word: w[0], pos: w[1], meaning: w[2], examples: ['You are given a sequence of distinct integers.'], note: '', created_at: date(9, 20 + i), updated_at: date(9, 20 + i) }));
  const db = { notes, words, visits: [] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const table = url.pathname.split('/').pop();
    if (!Object.hasOwn(db, table)) { res.writeHead(404); res.end('{}'); return; }
    let rows = db[table];
    const filters = Array.from(url.searchParams.entries()).filter(([key]) => !['select', 'order', 'limit', 'and'].includes(key));
    const and = url.searchParams.get('and');
    if (and) and.slice(1, -1).split(',').forEach(c => { const [key, op, ...val] = c.split('.'); filters.push([key, op + '.' + val.join('.')]); });
    rows = rows.filter(row => filters.every(([key, val]) => String(row[key]) === val.slice(3)));
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.method === 'POST') {
      const payload = JSON.parse(body || '{}');
      const added = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: Math.max(0, ...db[table].map(r => r.id)) + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row }));
      db[table].push(...added); rows = added;
    } else if (req.method === 'PATCH') {
      const payload = JSON.parse(body || '{}'); rows.forEach(row => Object.assign(row, payload));
    } else if (req.method === 'DELETE') db[table] = db[table].filter(row => !rows.includes(row));
    const order = url.searchParams.get('order');
    if (order) { const [key, dir] = order.split('.'); rows = rows.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (dir === 'desc' ? -1 : 1)); }
    const limit = Number(url.searchParams.get('limit')); if (limit) rows = rows.slice(0, limit);
    const projection = url.searchParams.get('select');
    if (projection && projection !== '*') rows = rows.map(row => Object.fromEntries(projection.split(',').map(key => [key, row[key]])));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(rows));
  });
  return { server, db };
}
module.exports = { createFixtureCloud };
