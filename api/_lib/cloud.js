// 服务端代理到 WorkBuddy 云端（keyless）。
// 数据库走 REST（header: x-wb-webapp-access-key），大模型走 /_cloud/llm/chat/completions（SSE）。
const ENDPOINT = process.env.CLOUD_ENDPOINT || 'https://algorithm-wordbook.app.workbuddy.host';
const KEY = process.env.CLOUD_KEY || '';

async function cloudRequest(path, opts) {
  const url = ENDPOINT + path;
  const headers = Object.assign({ 'x-wb-webapp-access-key': KEY, 'Content-Type': 'application/json' }, opts.headers || {});
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text || null; }
  return { status: r.status, data: data };
}

// 把前端链式 builder 序列化出的 op 转成 supabase 风格 REST 请求
function buildQs(op) {
  const p = new URLSearchParams();
  if (op.action === 'select') {
    p.set('select', op.columns || '*');
    if (op.order) p.set('order', op.order);
    if (op.limit != null) p.set('limit', String(op.limit));
  }
  const filters = op.filters || {};
  Object.keys(filters).forEach(function (k) { p.set(k, 'eq.' + filters[k]); });
  if (Array.isArray(op.and) && op.and.length) {
    p.set('and', '(' + op.and.map(function (c) { return c.col + '.' + (c.op || 'eq') + '.' + c.val; }).join(',') + ')');
  }
  return p.toString();
}

async function handleDb(op, role) {
  if (!role) return { status: 401, error: '请先登录' };
  const isWrite = op.action === 'insert' || op.action === 'update' || op.action === 'delete';

  // 访客只能读取已发布且公开的文章
  if (role === 'visitor' && op.action === 'select' && op.table === 'notes') {
    op.and = op.and || [];
    op.and.push({ col: 'status', op: 'eq', val: 'published' });
    op.and.push({ col: 'visibility', op: 'eq', val: 'public' });
  }

  if (isWrite && role !== 'admin') {
    // 阅读量自增例外：任意已登录角色都允许（纯副作用，不改内容），照常执行
    const viewsOnly = op.action === 'update' && op.table === 'notes' &&
      (function () { const ks = Object.keys(op.data || {}); return ks.length === 1 && ks[0] === 'views'; })();
    if (!viewsOnly) return { status: 403, error: '需要管理员权限' };
  }

  const method = { select: 'GET', insert: 'POST', update: 'PATCH', delete: 'DELETE' }[op.action];
  const qs = buildQs(op);
  const path = '/.cloud/database/rest/' + op.table + (qs ? ('?' + qs) : '');
  const headers = {};
  if (isWrite) headers['Prefer'] = 'return=representation';
  const body = (op.action === 'insert' || op.action === 'update') ? op.data : undefined;
  const r = await cloudRequest(path, { method: method, headers: headers, body: body });
  if (r.status < 200 || r.status >= 300) {
    const msg = (r.data && r.data.error && (r.data.error.message || r.data.error)) ||
      ('云端返回 ' + r.status);
    return { status: r.status, error: String(msg) };
  }
  return { status: r.status, data: r.data };
}

// 大模型：流式代理。供管理员使用（编辑辅助）。
async function streamLlm(body, res) {
  if (!body.model) body.model = 'auto';
  body.stream = true;
  const cr = await fetch(ENDPOINT + '/.cloud/llm/chat/completions', {
    method: 'POST',
    headers: { 'x-wb-webapp-access-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!cr.ok || !cr.body) {
    let t = '';
    try { t = await cr.text(); } catch (e) {}
    return { status: cr.status, error: t.slice(0, 200) || ('HTTP ' + cr.status) };
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });
  const dec = new TextDecoder();
  for await (const chunk of cr.body) {
    res.write(dec.decode(chunk, { stream: true }));
  }
  res.end();
  return null;
}

module.exports = { cloudRequest: cloudRequest, handleDb: handleDb, streamLlm: streamLlm, ENDPOINT: ENDPOINT, KEY: KEY };
