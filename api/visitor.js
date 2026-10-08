// POST /api/visitor  ->  已有会话时降级为「访客（只读）」会话（供管理员主动切换为只读）。
// 注意：不再允许免密公开建立会话，否则任何人都能直接 POST 拿到读权限、密码形同虚设。
const { roleFromReq, sign, setCookie } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  const role = roleFromReq(req);
  if (!role) return sendJson(res, 401, { error: '请先登录' });
  setCookie(res, sign('visitor'));
  return sendJson(res, 200, { role: 'visitor' });
};
