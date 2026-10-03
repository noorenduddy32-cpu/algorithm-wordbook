// POST /api/logout  ->  清除登录 Cookie
const { clearCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  clearCookie(res);
  return sendJson(res, 200, { ok: true });
};
