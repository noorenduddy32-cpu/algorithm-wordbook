// GET /api/me -> { role }；任何人可公开浏览，只有有效签名会话能获得管理员权限。
const { roleFromReq } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'GET')) return;
  const role = roleFromReq(req) || 'visitor';
  return sendJson(res, 200, { role: role });
};
