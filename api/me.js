// GET /api/me  ->  { role }；无会话时返回 401，不自动降级为访客（避免免密即可查看全部内容）
const { roleFromReq } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  const role = roleFromReq(req);
  if (!role) return sendJson(res, 401, { role: null });
  return sendJson(res, 200, { role: role });
};
