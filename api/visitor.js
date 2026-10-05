// POST /api/visitor  ->  无密码建立「访客（只读）」会话，Set-Cookie 签名角色 visitor
// 说明：访客只能读已发布且公开的内容，属只读，故允许免密登录；
//       写操作（insert/update/delete）仍需管理员密码，服务端二次校验，访客直接调用也会被拒。
const { sign, setCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  setCookie(res, sign('visitor'));
  return sendJson(res, 200, { role: 'visitor' });
};
