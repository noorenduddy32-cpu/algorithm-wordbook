// POST /api/login { password } -> 仅管理员登录；公开阅读不需要密码。
const { sign, setCookie, sessionSecret } = require('./_lib/auth');
const { readBody, sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  const ap = process.env.ADMIN_PASSWORD;
  if (!ap) return sendJson(res, 503, { error: '管理员登录尚未配置' });
  try { sessionSecret(); } catch (e) { return sendJson(res, 503, { error: e.message }); }
  const body = await readBody(req);
  const pw = (body && body.password) || '';
  if (typeof pw !== 'string' || pw !== ap) return sendJson(res, 401, { error: '管理员密码不正确' });
  setCookie(res, sign('admin'));
  return sendJson(res, 200, { role: 'admin' });
};
