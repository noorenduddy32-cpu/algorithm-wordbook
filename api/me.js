// GET /api/me  ->  { role } 或 401
const { roleFromReq } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  const role = roleFromReq(req);
  if (!role) return sendJson(res, 401, { error: '未登录' });
  return sendJson(res, 200, { role: role });
};
