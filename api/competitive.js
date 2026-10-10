const { roleFromReq } = require('./_lib/auth');
const { sendJson, allowRequest } = require('./_lib/http');
const { fetchCompetitive, cleanHandle } = require('./_lib/competitive');
module.exports = async function (req, res) {
  if (!allowRequest(req, res, 'GET')) return;
  if (!roleFromReq(req)) return sendJson(res, 401, { error: '请先输入访问密码' });
  const url = new URL(req.url, 'http://localhost');
  const cf = cleanHandle(url.searchParams.get('cf'));
  const atcoder = cleanHandle(url.searchParams.get('atcoder'));
  try { return sendJson(res, 200, await fetchCompetitive({ cf, atcoder, only: url.searchParams.get('only') })); }
  catch (e) { return sendJson(res, 502, { error: '竞赛平台数据暂时不可用' }); }
};
