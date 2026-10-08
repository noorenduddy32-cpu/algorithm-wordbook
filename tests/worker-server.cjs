// Exercise the exact built hosting artifact through the existing browser regressions.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
function createServer() {
  const source = fs.readFileSync(path.join(__dirname, '../dist/server/index.js'), 'utf8');
  const module = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  return http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: req.headers, ...(['GET','HEAD'].includes(req.method) ? {} : { body }) });
      const worker = (await module).default;
      const response = await worker.fetch(request, process.env);
      res.statusCode = response.status;
      for (const [key,value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
      const cookies = response.headers.getSetCookie(); if (cookies.length) res.setHeader('Set-Cookie', cookies);
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch (error) { console.error(error.message); res.writeHead(500); res.end('Worker preview failed'); }
  });
}
module.exports = { createServer };
