/* Public platform adapters. A warm worker shares cached responses and in-flight
 * requests, while each platform can be requested independently by the browser. */
const cache = new Map(), inFlight = new Map();
const DAY = 86400, MAX_CACHE = 128;
let cfNextStart = 0, acNextStart = 0;
function cleanHandle(value) {
  value = String(value || '').trim();
  return /^[A-Za-z0-9_.-]{1,40}$/.test(value) ? value : '';
}
function pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function jsonFetch(url, platform) {
  // Respect the providers' published limits: CF once per 2 seconds; AC >1 sec.
  const now = Date.now();
  const next = platform === 'codeforces' ? cfNextStart : acNextStart;
  const start = Math.max(now, next);
  if (platform === 'codeforces') cfNextStart = start + 2100;
  else acNextStart = start + 1100;
  if (start > now) await pause(start - now);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'algorithm-fieldnotes/2.0' }, signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function startOfToday() {
  // Hosted workers usually run in UTC; the dashboard's training day is UTC+8.
  return Math.floor((Date.now() / 1000 + 8 * 3600) / DAY) * DAY - 8 * 3600;
}
function stamp(row) { return Number(row.creationTimeSeconds || row.epoch_second || 0); }
function summarize(submissions, acceptedVerdict, partial) {
  const today = startOfToday(), month = today - 29 * DAY;
  const recent = submissions.filter(s => stamp(s) >= month);
  const accepted = recent.filter(s => (s.verdict || s.result) === acceptedVerdict);
  const todayAccepted = accepted.filter(s => stamp(s) >= today);
  const key = s => s.problem ? [s.problem.contestId, s.problem.index].join('-') : String(s.problem_id || s.id || '');
  return {
    todayAccepted: new Set(todayAccepted.map(key).filter(Boolean)).size,
    accepted: accepted.length, submissions: recent.length,
    acceptance: !partial && recent.length ? Math.round(accepted.length / recent.length * 100) : null,
    partial: !!partial, periodDays: 30, timeZone: 'Asia/Shanghai'
  };
}
async function codeforces(handle) {
  if (!handle) return null;
  // A missing profile/rating response must not discard valid submission data.
  const [statusResult, infoResult] = await Promise.allSettled([
    jsonFetch('https://codeforces.com/api/user.status?handle=' + encodeURIComponent(handle) + '&from=1&count=1000', 'codeforces'),
    jsonFetch('https://codeforces.com/api/user.info?handles=' + encodeURIComponent(handle), 'codeforces')
  ]);
  if (statusResult.status !== 'fulfilled' || statusResult.value.status !== 'OK') throw new Error('Codeforces submissions unavailable');
  const rows = statusResult.value.result || [];
  const oldest = rows.length ? Math.min(...rows.map(stamp)) : 0;
  const partial = rows.length >= 1000 && oldest >= startOfToday() - 29 * DAY;
  const summary = summarize(rows, 'OK', partial);
  if (partial && oldest >= startOfToday()) summary.todayAccepted = null;
  const info = infoResult.status === 'fulfilled' && infoResult.value.status === 'OK' ? infoResult.value.result?.[0] : null;
  return Object.assign(summary, {
    rating: info?.rating ?? null, rank: info?.rank || '', handle,
    source: 'Codeforces public API', sourceUrl: 'https://codeforces.com/apiHelp',
    limit: 1000, profileUnavailable: !info
  });
}
async function atcoder(handle) {
  if (!handle) return null;
  const from = startOfToday() - 29 * DAY;
  const result = await jsonFetch('https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=' + encodeURIComponent(handle) + '&from_second=' + from, 'atcoder');
  if (!Array.isArray(result)) throw new Error('AtCoder submissions unavailable');
  // This third-party endpoint returns at most 500 rows, oldest first. A capped
  // month must not be presented as a complete 30-day acceptance percentage.
  const partial = result.length >= 500;
  const summary = summarize(result, 'AC', partial);
  if (partial) {
    summary.todayAccepted = null;
    try {
      const today = await jsonFetch('https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=' + encodeURIComponent(handle) + '&from_second=' + startOfToday(), 'atcoder');
      if (Array.isArray(today) && today.length < 500) summary.todayAccepted = summarize(today, 'AC', false).todayAccepted;
    } catch (_) { /* Preserve the partial monthly result and disclose its limit. */ }
  }
  return Object.assign(summary, {
    handle, source: 'AtCoder Problems (unofficial)',
    sourceUrl: 'https://github.com/kenkoooo/AtCoderProblems/blob/main/doc/api.md', limit: 500
  });
}
async function contests() {
  const data = await jsonFetch('https://codeforces.com/api/contest.list?gym=false', 'codeforces');
  if (data.status !== 'OK') throw new Error('Contest calendar unavailable');
  return (data.result || []).filter(c => c.phase === 'BEFORE').sort((a, b) => a.startTimeSeconds - b.startTimeSeconds).slice(0, 8).map(c => ({
    id: c.id, name: c.name, startTimeSeconds: c.startTimeSeconds, durationSeconds: c.durationSeconds,
    url: 'https://codeforces.com/contest/' + c.id
  }));
}
async function cached(key, loader, ttl) {
  const existing = cache.get(key), now = Date.now();
  if (existing && existing.expires > now) return existing;
  if (inFlight.has(key)) return inFlight.get(key);
  const pending = (async () => {
    let entry;
    try {
      entry = { value: await loader(), updatedAt: Date.now(), expires: Date.now() + ttl, error: false, stale: false };
    } catch (_) {
      const reusable = existing && existing.value != null && now - existing.updatedAt < DAY * 1000;
      entry = { value: reusable ? existing.value : null, updatedAt: reusable ? existing.updatedAt : null, expires: Date.now() + 30000, error: true, stale: !!reusable };
    }
    cache.set(key, entry);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return entry;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}
async function fetchCompetitive(params) {
  const cf = cleanHandle(params.cf), ac = cleanHandle(params.atcoder);
  const only = ['codeforces', 'atcoder', 'contests'].includes(params.only) ? params.only : null;
  const jobs = {
    codeforces: () => cached('codeforces:' + cf + ':' + startOfToday(), () => codeforces(cf), 300000),
    atcoder: () => cached('atcoder:' + ac + ':' + startOfToday(), () => atcoder(ac), 300000),
    contests: () => cached('contests', contests, 600000)
  };
  const names = only ? [only] : Object.keys(jobs);
  const results = await Promise.all(names.map(name => jobs[name]()));
  const payload = { errors: [], stale: [], updatedAt: {}, timeZone: 'Asia/Shanghai' };
  names.forEach((name, i) => {
    payload[name] = results[i].value ?? (name === 'contests' ? [] : null);
    payload.updatedAt[name] = results[i].updatedAt;
    if (results[i].error) payload.errors.push(name);
    if (results[i].stale) payload.stale.push(name);
  });
  return payload;
}
module.exports = { fetchCompetitive, cleanHandle };
