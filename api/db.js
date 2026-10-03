// POST /api/db  ——  前端链式 builder 的序列化入口。
// 读（select）需登录；写（insert/update/delete）需管理员。后端二次校验，访客直接调用也会被拒。
const { roleFromReq } = require('./_lib/auth');
const { handleDb } = require('./_lib/cloud');
const { readBody, sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  const role = roleFromReq(req);
  const op = await readBody(req);
  console.error('[db]', op.action, op.table, 'role=' + role);
  const result = await handleDb(op, role);
  if (result.error) return sendJson(res, result.status || 400, { error: result.error });
  return sendJson(res, result.status || 200, { data: result.data == null ? [] : result.data });
};
