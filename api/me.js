// GET /api/me -> { role }；未登录时返回 null。
const { roleFromReq } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'GET')) return;
  const role = roleFromReq(req);
  return sendJson(res, 200, { role: role });
};
