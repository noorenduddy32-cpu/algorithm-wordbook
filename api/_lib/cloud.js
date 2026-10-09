// 服务端代理到 WorkBuddy 云端（keyless）。
// 数据库走 REST（header: x-wb-webapp-access-key），大模型走 /_cloud/llm/chat/completions（SSE）。
const runtimeEnv = typeof process !== 'undefined' && process.env ? process.env : {};
const ENDPOINT = runtimeEnv.CLOUD_ENDPOINT || 'https://algorithm-wordbook.app.workbuddy.host';
const KEY = runtimeEnv.CLOUD_KEY || '';

async function cloudRequest(path, opts, config) {
  const url = (config ? config.endpoint : ENDPOINT) + path;
  const headers = Object.assign({ 'x-wb-webapp-access-key': config ? config.key : KEY, 'Content-Type': 'application/json' }, opts.headers || {});
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

const TABLE_COLUMNS = {
  words: ['id', 'word', 'pos', 'meaning', 'examples', 'note', 'created_at', 'updated_at'],
  notes: ['id', 'title', 'content', 'summary', 'tags', 'category', 'cover', 'views', 'top', 'status', 'visibility', 'created_at', 'updated_at']
};
const isObject = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

async function handleDb(input, role, config) {
  // 访客与管理员都必须通过服务端签名会话登录。
  if (role == null) return { status: 401, error: '请先输入访问密码' };
  if (role !== 'admin' && role !== 'visitor') return { status: 401, error: '请先登录' };
  if (!isObject(input)) return { status: 400, error: '无效查询' };
  // 不允许访问日志、任意表路径、关联查询或用户提供的 PostgREST 表达式。
  if (!Object.hasOwn(TABLE_COLUMNS, input.table)) return { status: 403, error: '不允许访问此数据表' };
  if (!['select', 'insert', 'update', 'delete'].includes(input.action)) return { status: 400, error: '无效操作' };
  const isWrite = input.action !== 'select';
  if (isWrite && role !== 'admin') return { status: 403, error: '需要管理员权限' };
  const columns = TABLE_COLUMNS[input.table];
  const projection = input.columns || '*';
  if (typeof projection !== 'string' || (projection !== '*' && !projection.split(',').every(function (c) { return columns.includes(c); }))) {
    return { status: 400, error: '无效字段' };
  }
  if (input.and != null || (input.filters != null && !isObject(input.filters))) return { status: 400, error: '无效筛选' };
  const filters = input.filters || {};
  if (!Object.keys(filters).every(function (k) {
    return columns.includes(k) && ['string', 'number', 'boolean'].includes(typeof filters[k]) && String(filters[k]).length <= 1000;
  })) return { status: 400, error: '无效筛选' };
  if (input.order != null && (typeof input.order !== 'string' || !columns.some(function (c) {
    return input.order === c + '.asc' || input.order === c + '.desc';
  }))) return { status: 400, error: '无效排序' };
  if (input.limit != null && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10000)) return { status: 400, error: '无效数量' };
  if (['update', 'delete'].includes(input.action) && !Object.keys(filters).length) return { status: 400, error: '修改或删除必须指定记录' };
  if (['insert', 'update'].includes(input.action)) {
    const rows = input.action === 'insert' && Array.isArray(input.data) ? input.data : [input.data];
    if (!rows.length || rows.length > 1000 || !rows.every(function (row) {
      return isObject(row) && Object.keys(row).length && Object.keys(row).every(function (k) { return columns.includes(k); }) &&
        (!Object.hasOwn(row, 'status') || ['draft', 'published'].includes(row.status)) &&
        (!Object.hasOwn(row, 'visibility') || ['private', 'public'].includes(row.visibility));
    })) return { status: 400, error: '无效记录' };
  }
  const op = Object.assign({}, input, { columns: projection, filters: filters });
  // 服务端强制追加条件，访客既看不到草稿，也看不到已发布的私密笔记。
  if (role === 'visitor' && op.table === 'notes') {
    op.and = [{ col: 'status', val: 'published' }, { col: 'visibility', val: 'public' }];
  }

  const method = { select: 'GET', insert: 'POST', update: 'PATCH', delete: 'DELETE' }[op.action];
  const qs = buildQs(op);
  const path = '/.cloud/database/rest/' + op.table + (qs ? ('?' + qs) : '');
  const headers = {};
  if (isWrite) headers['Prefer'] = 'return=representation';
  const body = (op.action === 'insert' || op.action === 'update') ? op.data : undefined;
  const r = await cloudRequest(path, { method: method, headers: headers, body: body }, config);
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
