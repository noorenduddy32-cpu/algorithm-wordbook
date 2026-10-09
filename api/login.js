// POST /api/login { password, role } -> 验证访客或管理员密码。
const { sign, setCookie, sessionSecret } = require('./_lib/auth');
const { readBody, sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  const body = await readBody(req);
  const role = body && body.role;
  if (role !== 'admin' && role !== 'visitor') return sendJson(res, 400, { error: '请选择访客或管理员身份' });
  const expected = role === 'admin' ? process.env.ADMIN_PASSWORD : process.env.VISITOR_PASSWORD;
  if (!expected) return sendJson(res, 503, { error: role === 'admin' ? '管理员登录尚未配置' : '访客访问尚未配置' });
  try { sessionSecret(); } catch (e) { return sendJson(res, 503, { error: e.message }); }
  const pw = (body && body.password) || '';
  if (typeof pw !== 'string' || pw !== expected) return sendJson(res, 401, { error: '密码不正确，请重试' });
  setCookie(res, sign(role));
  return sendJson(res, 200, { role: role });
};
