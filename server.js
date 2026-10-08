// 单端口 Node 服务；只提供显式列出的前端资源，绝不暴露 API 源码、数据库脚本或环境文件。
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PUBLIC_FILES = new Set(require('./public-files.json'));
const API_NAMES = new Set(['login', 'logout', 'me', 'visitor', 'db', 'ai', 'visits']);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

function createServer() {
  return http.createServer(async function (req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (e) { res.writeHead(400); res.end('Bad Request'); return; }
    if (pathname.startsWith('/api/')) {
      const name = pathname.slice(5);
      if (!API_NAMES.has(name)) { res.writeHead(404); res.end('Not Found'); return; }
      try {
        if (req.method === 'POST') {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) { res.writeHead(413); res.end('Payload Too Large'); return; }
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString();
          try { req.body = raw ? JSON.parse(raw) : {}; }
          catch (e) { res.writeHead(400); res.end('Invalid JSON'); return; }
          if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
            res.writeHead(400); res.end('JSON body must be an object'); return;
          }
        }
        await require('./api/' + name)(req, res);
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: '服务暂时不可用，请稍后重试' }));
        } else res.end();
      }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let file = pathname === '/' ? 'index.html' : pathname.slice(1);
    // 配置仅含公开展示项；旧版 config.js 不再作为静态文件发送。
    if (file === 'config.js') file = 'config.example.js';
    if (!PUBLIC_FILES.has(file)) { res.writeHead(404); res.end('Not Found'); return; }
    try {
      const content = await fs.readFile(path.join(__dirname, file));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) { res.writeHead(404); res.end('Not Found'); }
  });
}
function start() {
  try { process.loadEnvFile(path.join(__dirname, '.env.local')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const port = Number(process.env.PORT) || 8787;
  const server = createServer();
  server.listen(port, process.env.HOST || '127.0.0.1', function () { console.log('Notebook: http://localhost:' + port); });
  return server;
}
if (require.main === module) start();
module.exports = { createServer, start };
