// GET /api/me  ->  { role }；无会话时自动降级为访客并 Set-Cookie
const { roleFromReq, sign, setCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  let role = roleFromReq(req);
  if (!role) {
    role = 'visitor';
    setCookie(res, sign(role));
  }
  return sendJson(res, 200, { role: role });
};
