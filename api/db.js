// POST /api/db  ——  前端链式 builder 的序列化入口。
// 公开读取共享词汇和已发布的公开笔记；写入需管理员，访客直调也会被拒。
const { roleFromReq } = require('./_lib/auth');
const { handleDb } = require('./_lib/cloud');
const { readBody, sendJson, allowRequest } = require('./_lib/http');

module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'POST')) return;
  const role = roleFromReq(req);
  const op = await readBody(req);
  let result;
  try { result = await handleDb(op, role); }
  catch (e) { return sendJson(res, 502, { error: '数据服务暂时不可用，请稍后重试' }); }
  if (result.error) return sendJson(res, result.status || 400, { error: result.error });
  return sendJson(res, result.status || 200, { data: result.data == null ? [] : result.data });
};
