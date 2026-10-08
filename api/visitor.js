// POST /api/visitor -> 清除管理员会话，返回无需登录的公开浏览模式。
const { clearCookie } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  clearCookie(res);
  return sendJson(res, 200, { role: 'visitor' });
};
