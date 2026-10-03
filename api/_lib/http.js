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
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body != null) {
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
  res.end(JSON.stringify(obj));
}

module.exports = { parseCookies: parseCookies, readBody: readBody, sendJson: sendJson };
