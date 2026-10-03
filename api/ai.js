// POST /api/ai  { model, messages, ... }  ->  SSE 流式转发到云端大模型（仅管理员）
const { roleFromReq } = require('./_lib/auth');
const { streamLlm } = require('./_lib/cloud');
const { readBody, sendJson } = require('./_lib/http');

module.exports = async function (req, res) {
  const role = roleFromReq(req);
  if (!role) return sendJson(res, 401, { error: '请先登录' });
  if (role !== 'admin') return sendJson(res, 403, { error: '需要管理员权限' });
  const body = await readBody(req);
  const r = await streamLlm(body, res);
  if (r && r.error) return sendJson(res, r.status || 400, { error: r.error });
};
