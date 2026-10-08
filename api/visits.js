// POST /api/visits —— 记录访问日志（任何人可写）
// GET  /api/visits —— 仅管理员可查看
// DELETE 永远 403：日志不可删除
const { roleFromReq } = require('./_lib/auth');
const { readBody, sendJson, allowRequest } = require('./_lib/http');
const { cloudRequest } = require('./_lib/cloud');
const MAX_VISIT_BYTES = 8192;

function parseUA(ua) {
  const s = String(ua || '').toLowerCase();
  let os = 'other', browser = 'other';
  if (s.indexOf('windows') >= 0) os = 'Windows';
  else if (s.indexOf('macintosh') >= 0 || s.indexOf('mac os') >= 0) os = 'macOS';
  else if (s.indexOf('linux') >= 0) os = 'Linux';
  else if (s.indexOf('android') >= 0) os = 'Android';
  else if (s.indexOf('iphone') >= 0 || s.indexOf('ipad') >= 0) os = 'iOS';
  if (s.indexOf('edg') >= 0) browser = 'Edge';
  else if (s.indexOf('firefox') >= 0) browser = 'Firefox';
  else if (s.indexOf('chrome') >= 0) browser = 'Chrome';
  else if (s.indexOf('safari') >= 0) browser = 'Safari';
  return { os: os, browser: browser };
}

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
}

async function ipRegion(ip) {
  if (!ip || ip.startsWith('127.') || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return '本地/内网';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 2500);
    const r = await fetch('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,city,country,regionName', { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return '';
    const j = await r.json();
    if (j.status !== 'success') return '';
    return [j.country, j.regionName, j.city].filter(Boolean).join(' · ');
  } catch (e) { return ''; }
}

async function insertVisit(payload) {
  return await cloudRequest('/.cloud/database/rest/visits', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: payload
  });
}

module.exports = async function (req, res) {
  const role = roleFromReq(req) || 'visitor';

  if (req.method === 'GET' || req.method === 'get') {
    if (role !== 'admin') return sendJson(res, 403, { error: '需要管理员权限' });
    const qs = new URLSearchParams();
    qs.set('select', '*');
    qs.set('order', 'created_at.desc');
    qs.set('limit', '200');
    const r = await cloudRequest('/.cloud/database/rest/visits?' + qs.toString(), { method: 'GET', headers: {} });
    if (r.status < 200 || r.status >= 300) {
      const msg = (r.data && r.data.error && (r.data.error.message || r.data.error)) || ('云端返回 ' + r.status);
      return sendJson(res, r.status || 500, { error: String(msg) });
    }
    return sendJson(res, 200, { data: r.data || [] });
  }

  if (req.method === 'POST') {
    if (!allowRequest(req, res, 'POST')) return;
    if (Number(req.headers['content-length']) > MAX_VISIT_BYTES) return sendJson(res, 413, { error: '访问记录过大' });
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(res, 400, { error: '无效访问记录' });
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_VISIT_BYTES) return sendJson(res, 413, { error: '访问记录过大' });
    if (body.note_id != null && !(
      (Number.isSafeInteger(body.note_id) && body.note_id > 0) ||
      (typeof body.note_id === 'string' && /^[1-9]\d{0,18}$/.test(body.note_id))
    )) return sendJson(res, 400, { error: '无效笔记编号' });
    const ip = getIp(req);
    const ua = String(req.headers['user-agent'] || '');
    const parsed = parseUA(ua);
    const region = await ipRegion(ip);
    const payload = {
      role: role,
      ip: ip,
      region: region,
      ua: ua.slice(0, 400),
      os: parsed.os,
      browser: parsed.browser,
      path: String(body.path || req.headers.referer || '').slice(0, 200),
      note_id: body.note_id || null,
      note_title: String(body.note_title || '').slice(0, 200),
      duration: Math.min(2147483647, Math.max(0, parseInt(body.duration || 0, 10) || 0))
    };
    const r = await insertVisit(payload);
    if (r.status < 200 || r.status >= 300) {
      const msg = (r.data && r.data.error && (r.data.error.message || r.data.error)) || ('云端返回 ' + r.status);
      return sendJson(res, r.status || 500, { error: String(msg) });
    }
    return sendJson(res, 201, { ok: true });
  }

  if (req.method === 'DELETE' || req.method === 'delete') {
    return sendJson(res, 403, { error: '访问日志不可删除' });
  }

  return sendJson(res, 405, { error: 'Method Not Allowed' });
};
