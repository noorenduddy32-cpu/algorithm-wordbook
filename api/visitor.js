// POST /api/visitor -> 将有效的管理员会话降级为访客会话。
const { roleFromReq, sign, setCookie } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  if (roleFromReq(req) !== 'admin') return sendJson(res, 401, { error: '请先以管理员身份登录' });
  setCookie(res, sign('visitor'));
  return sendJson(res, 200, { role: 'visitor' });
};
