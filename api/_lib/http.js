// 通用 HTTP 辅助：读 body、发 JSON、解析 cookie。兼容 Vercel Node 运行时与本地 dev 服务器。
function parseCookies(req) {
  const c = req && req.headers && req.headers.cookie;
  if (!c) return {};
  const out = {};
  c.split(';').forEach(function (s) {
    const i = s.indexOf('=');
    if (i < 0) return;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch (e) { /* 忽略无效 Cookie */ } }
  });
  return out;
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (Object.hasOwn(req, 'body')) {
      try {
        if (typeof req.body === 'string') return resolve(req.body ? JSON.parse(req.body) : {});
        return resolve(req.body);
      } catch (e) { return resolve({}); }
    }
    let d = '';
    let done = false;
    function finish() { if (done) return; done = true; try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve({}); } }
    try {
      req.on('data', function (c) { d += c; });
      req.on('end', finish);
      req.on('error', finish);
    } catch (e) { finish(); }
  });
}

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

function allowRequest(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    sendJson(res, 405, { error: '请求方法不支持' });
    return false;
  }
  if (method !== 'GET') {
    const origin = req.headers.origin;
    let sameOrigin = true;
    if (origin) {
      try { sameOrigin = new URL(origin).host === req.headers.host; }
      catch (e) { sameOrigin = false; }
    }
    if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
      sendJson(res, 403, { error: '仅允许本站请求' });
      return false;
    }
  }
  return true;
}

module.exports = { parseCookies: parseCookies, readBody: readBody, sendJson: sendJson, allowRequest: allowRequest };
