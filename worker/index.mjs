// Web-standard hosting adapter. Database access rules are shared with the Node API.
import cloud from '../api/_lib/cloud.js';
const { handleDb, cloudRequest } = cloud;
const assets = typeof __STATIC_ASSETS__ === 'undefined' ? {} : __STATIC_ASSETS__;
const encoder = new TextEncoder();
const SESSION = 'an_sess', MAX_AGE = 604800;
const securityHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...extra } });
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function unb64(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
async function key(secret) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
function validSecret(env) { return typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32; }
export async function signAdmin(env) {
  if (!validSecret(env)) throw new Error('Missing session secret');
  const payload = b64(encoder.encode(JSON.stringify({ role: 'admin', exp: Date.now() + MAX_AGE * 1000 })));
  return payload + '.' + b64(new Uint8Array(await crypto.subtle.sign('HMAC', await key(env.SESSION_SECRET), encoder.encode(payload))));
}
export async function roleOf(request, env) {
  if (!validSecret(env)) return 'visitor';
  const match = (request.headers.get('cookie') || '').match(/(?:^|;\s*)an_sess=([^;]*)/);
  if (!match) return 'visitor';
  try {
    const parts = decodeURIComponent(match[1]).split('.');
    if (parts.length !== 2) return 'visitor';
    if (!await crypto.subtle.verify('HMAC', await key(env.SESSION_SECRET), unb64(parts[1]), encoder.encode(parts[0]))) return 'visitor';
    const value = JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    return value.role === 'admin' && Number.isFinite(value.exp) && value.exp > Date.now() ? 'admin' : 'visitor';
  } catch { return 'visitor'; }
}
function cookie(value, maxAge = MAX_AGE) { return SESSION + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge; }
function guard(request, method) {
  if (request.method !== method) return json(405, { error: '请求方法不支持' }, { Allow: method });
  if (method === 'GET') return null;
  const origin = request.headers.get('origin');
  try {
    if ((origin && new URL(origin).origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: '仅允许本站请求' });
  } catch { return json(403, { error: '仅允许本站请求' }); }
  return null;
}
async function readObject(request, limit = 5 * 1024 * 1024) {
  if (Number(request.headers.get('content-length')) > limit) throw { status: 413, message: '请求内容过大' };
  let size = 0, raw = '';
  if (request.body) {
    const reader = request.body.getReader(), decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw { status: 413, message: '请求内容过大' }; }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  let value;
  try { value = raw ? JSON.parse(raw) : {}; } catch { throw { status: 400, message: '无效 JSON' }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw { status: 400, message: '请求内容必须是对象' };
  return value;
}
async function equalPassword(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y); let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
function clientInfo(ua) {
  const s = ua.toLowerCase();
  return { os: /android/.test(s) ? 'Android' : /iphone|ipad/.test(s) ? 'iOS' : /windows/.test(s) ? 'Windows' : /macintosh|mac os/.test(s) ? 'macOS' : /linux/.test(s) ? 'Linux' : 'other', browser: /edg/.test(s) ? 'Edge' : /firefox/.test(s) ? 'Firefox' : /chrome/.test(s) ? 'Chrome' : /safari/.test(s) ? 'Safari' : 'other' };
}
export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(400, { error: '无效地址' }); }
  if (!pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: '请求方法不支持' }, { Allow: 'GET, HEAD' });
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    const asset = Object.hasOwn(assets, name) ? assets[name] : null;
    if (!asset) return new Response('Not Found', { status: 404, headers: securityHeaders });
    const content = asset.binary ? Uint8Array.from(atob(asset.content), c => c.charCodeAt(0)) : asset.content;
    return new Response(request.method === 'HEAD' ? null : content, { headers: { ...securityHeaders, 'Content-Type': asset.type, 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  }
  const name = pathname.slice(5);
  if (!['me', 'login', 'logout', 'visitor', 'db', 'ai', 'visits'].includes(name)) return json(404, { error: 'Not Found' });
  const method = name === 'me' || (name === 'visits' && request.method === 'GET') ? 'GET' : 'POST';
  const denied = guard(request, method); if (denied) return denied;
  const role = await roleOf(request, env);
  const config = { endpoint: (env.CLOUD_ENDPOINT || 'https://algorithm-wordbook.app.workbuddy.host').replace(/\/$/, ''), key: env.CLOUD_KEY || '' };
  try {
    if (name === 'me') return json(200, { role });
    if (name === 'logout' || name === 'visitor') return json(200, { role: 'visitor' }, { 'Set-Cookie': cookie('', 0) });
    if (name === 'login') {
      if (!env.ADMIN_PASSWORD || !validSecret(env)) return json(503, { error: '管理员登录尚未配置' });
      const body = await readObject(request, 8192);
      if (typeof body.password !== 'string' || !await equalPassword(body.password, env.ADMIN_PASSWORD)) return json(401, { error: '管理员密码不正确' });
      return json(200, { role: 'admin' }, { 'Set-Cookie': cookie(await signAdmin(env)) });
    }
    if (name === 'db') {
      const result = await handleDb(await readObject(request), role, config);
      return json(result.status, result.error ? { error: result.error } : { data: result.data });
    }
    if (name === 'ai') {
      if (role !== 'admin') return json(403, { error: '需要管理员权限' });
      const body = await readObject(request);
      body.model ||= 'auto'; body.stream = true;
      const result = await fetch(config.endpoint + '/.cloud/llm/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wb-webapp-access-key': config.key }, body: JSON.stringify(body) });
      if (!result.ok || !result.body) return json(502, { error: 'AI 服务暂时不可用，请稍后重试' });
      return new Response(result.body, { headers: { ...securityHeaders, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } });
    }
    if (name === 'visits' && method === 'GET') {
      if (role !== 'admin') return json(403, { error: '需要管理员权限' });
      const result = await cloudRequest('/.cloud/database/rest/visits?select=*&order=created_at.desc&limit=200', { method: 'GET' }, config);
      return result.status >= 200 && result.status < 300 ? json(200, { data: result.data || [] }) : json(502, { error: '访问记录暂时无法加载' });
    }
    if (name === 'visits') {
      const body = await readObject(request, 8192);
      if (body.note_id != null && !((Number.isSafeInteger(body.note_id) && body.note_id > 0) || (typeof body.note_id === 'string' && /^[1-9]\d{0,18}$/.test(body.note_id)))) return json(400, { error: '无效笔记编号' });
      const ua = (request.headers.get('user-agent') || '').slice(0, 400);
      const payload = { role, ip: request.headers.get('cf-connecting-ip') || '', region: [request.cf?.country, request.cf?.region, request.cf?.city].filter(Boolean).join(' · '), ua, ...clientInfo(ua), path: String(body.path || '').slice(0, 200), note_id: body.note_id || null, note_title: String(body.note_title || '').slice(0, 200), duration: Math.min(2147483647, Math.max(0, parseInt(body.duration || 0, 10) || 0)) };
      const result = await cloudRequest('/.cloud/database/rest/visits', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: payload }, config);
      return result.status >= 200 && result.status < 300 ? json(201, { ok: true }) : json(502, { error: '访问记录暂时无法保存' });
    }
  } catch (error) { return json(error.status || 502, { error: error.status ? error.message : '服务暂时不可用，请稍后重试' }); }
  return json(404, { error: 'Not Found' });
}
export default { fetch: handleRequest };
