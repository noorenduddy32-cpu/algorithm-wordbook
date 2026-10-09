function cleanHandle(value) {
  value = String(value || '').trim();
  return /^[A-Za-z0-9_.-]{1,40}$/.test(value) ? value : '';
}
async function jsonFetch(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || 7000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'algorithm-fieldnotes/1.0' }, signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); }
function summarize(submissions, acceptedVerdict) {
  const today = startOfToday(), month = today - 29 * 86400;
  const recent = submissions.filter(s => Number(s.creationTimeSeconds || s.epoch_second || 0) >= month);
  const accepted = recent.filter(s => (s.verdict || s.result) === acceptedVerdict);
  const todayAccepted = accepted.filter(s => Number(s.creationTimeSeconds || s.epoch_second || 0) >= today);
  const key = s => s.problem ? [s.problem.contestId, s.problem.index].join('-') : String(s.problem_id || s.id || '');
  return {
    todayAccepted: new Set(todayAccepted.map(key).filter(Boolean)).size,
    accepted: accepted.length,
    submissions: recent.length,
    acceptance: recent.length ? Math.round(accepted.length / recent.length * 100) : 0
  };
}
async function codeforces(handle) {
  if (!handle) return null;
  const [status, info] = await Promise.all([
    jsonFetch('https://codeforces.com/api/user.status?handle=' + encodeURIComponent(handle) + '&from=1&count=1000'),
    jsonFetch('https://codeforces.com/api/user.info?handles=' + encodeURIComponent(handle))
  ]);
  if (status.status !== 'OK' || info.status !== 'OK') throw new Error('Codeforces data unavailable');
  return Object.assign(summarize(status.result || [], 'OK'), { rating: info.result?.[0]?.rating || null, rank: info.result?.[0]?.rank || '', handle });
}
async function atcoder(handle) {
  if (!handle) return null;
  const from = startOfToday() - 29 * 86400;
  const rows = await jsonFetch('https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=' + encodeURIComponent(handle) + '&from_second=' + from);
  return Object.assign(summarize(Array.isArray(rows) ? rows : [], 'AC'), { handle });
}
async function contests() {
  const data = await jsonFetch('https://codeforces.com/api/contest.list?gym=false');
  if (data.status !== 'OK') throw new Error('Contest calendar unavailable');
  return (data.result || []).filter(c => c.phase === 'BEFORE').sort((a, b) => a.startTimeSeconds - b.startTimeSeconds).slice(0, 8).map(c => ({
    id: c.id, name: c.name, startTimeSeconds: c.startTimeSeconds, durationSeconds: c.durationSeconds,
    url: 'https://codeforces.com/contest/' + c.id
  }));
}
async function fetchCompetitive(params) {
  const cf = cleanHandle(params.cf), ac = cleanHandle(params.atcoder);
  const results = await Promise.allSettled([codeforces(cf), atcoder(ac), contests()]);
  return {
    codeforces: results[0].status === 'fulfilled' ? results[0].value : null,
    atcoder: results[1].status === 'fulfilled' ? results[1].value : null,
    contests: results[2].status === 'fulfilled' ? results[2].value : [],
    errors: results.map((r, i) => r.status === 'rejected' ? ['codeforces', 'atcoder', 'contests'][i] : null).filter(Boolean)
  };
}
module.exports = { fetchCompetitive, cleanHandle };
