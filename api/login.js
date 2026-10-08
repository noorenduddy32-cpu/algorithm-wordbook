// POST /api/login  { password }  ->  校验 VISITOR/ADMIN 密码，Set-Cookie 签名角色
const { sign, setCookie, sessionSecret } = require('./_lib/auth');
const { readBody, sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  const vp = process.env.VISITOR_PASSWORD;
  const ap = process.env.ADMIN_PASSWORD;
  if (!vp || !ap || vp === ap) return sendJson(res, 503, { error: '请配置不同的访客密码和管理员密码' });
  try { sessionSecret(); } catch (e) { return sendJson(res, 503, { error: e.message }); }
  const body = await readBody(req);
  const pw = (body && body.password) || '';
  let role = null;
  if (pw && pw === ap) role = 'admin';
  else if (pw && pw === vp) role = 'visitor';
  if (!role) return sendJson(res, 401, { error: '密码不正确' });
  if (body.role === 'admin' && role !== 'admin') return sendJson(res, 403, { error: '请输入管理员密码' });
  setCookie(res, sign(role));
  return sendJson(res, 200, { role: role });
};
