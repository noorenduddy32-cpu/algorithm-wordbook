// POST /api/logout  ->  清除登录 Cookie
const { clearCookie } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  clearCookie(res);
  return sendJson(res, 200, { ok: true });
};
