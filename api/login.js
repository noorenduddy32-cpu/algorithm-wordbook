// POST /api/login  { password }  ->  校验 VISITOR/ADMIN 密码，Set-Cookie 签名角色
const { sign, setCookie } = require('./_lib/auth');
const { readBody, sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  const body = await readBody(req);
  const pw = (body && body.password) || '';
  const vp = process.env.VISITOR_PASSWORD;
  const ap = process.env.ADMIN_PASSWORD;
  let role = null;
  if (pw && pw === ap) role = 'admin';
  else if (pw && pw === vp) role = 'visitor';
  if (!role) return sendJson(res, 401, { error: '密码不正确' });
  setCookie(res, sign(role));
  return sendJson(res, 200, { role: role });
};
