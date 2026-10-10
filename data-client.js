/* Browser transport. Credentials stay in HttpOnly cookies and on the server. */
(function () {
  'use strict';
  let sessionVersion = 0;
  const requests = new Set(), reads = new Map();
  window.addEventListener('an:session-reset', function () {
    sessionVersion++;
    requests.forEach(controller => controller.abort());
    reads.clear();
  });
  async function timedFetch(url, options) {
    options = options || {};
    const controller = new AbortController();
    const suppliedSignal = options.signal;
    const cancel = () => controller.abort();
    if (suppliedSignal) { if (suppliedSignal.aborted) cancel(); else suppliedSignal.addEventListener('abort', cancel, { once: true }); }
    const timeout = setTimeout(cancel, options.timeoutMs || 10000);
    const fetchOptions = Object.assign({}, options, { signal: controller.signal });
    delete fetchOptions.timeoutMs;
    requests.add(controller);
    try { return await fetch(url, fetchOptions); }
    catch (error) {
      throw new Error(error.name === 'AbortError' ? '连接超时，请重试' : '无法连接，请检查网络后重试');
    } finally {
      clearTimeout(timeout); requests.delete(controller);
      if (suppliedSignal) suppliedSignal.removeEventListener('abort', cancel);
    }
  }
  window.ANRequest = timedFetch;
  const DB = (function () {
    function build(table) {
      const op = { table: table || null, action: null, columns: '*', filters: {}, order: null, limit: null, data: null, single: false };
      const a = {
        from: function (t) { op.table = t; return a; },
        select: function (c) {
          // 链式：insert/update/delete 之后的 .select() 表示“返回写入后的行”（Supabase 语义），
          // 不能把 action 覆盖成 select。
          if (op.action && op.action !== 'select') {
            op.returning = true;
            if (c) op.columns = c;
            return a;
          }
          op.action = 'select'; op.columns = (c || '*'); return a;
        },
        insert: function (rows) { op.action = 'insert'; op.data = rows; return a; },
        update: function (o) { op.action = 'update'; op.data = o; return a; },
        delete: function () { op.action = 'delete'; return a; },
        eq: function (k, v) { op.filters[k] = v; return a; },
        order: function (c, o) { op.order = c + '.' + (o && o.ascending === false ? 'desc' : 'asc'); return a; },
        limit: function (n) { op.limit = n; return a; },
        maybeSingle: function () { op.single = true; return a; },
        single: function () { op.single = true; return a; },
        then: function (res, rej) {
          // Identical concurrent reads share one round trip; mutations always run.
          const snapshot = Object.assign({}, op, { filters: Object.assign({}, op.filters) });
          const key = sessionVersion + ':' + JSON.stringify(snapshot);
          if (op.action !== 'select') return call(snapshot).then(res, rej);
          if (!reads.has(key)) {
            const pending = call(snapshot).finally(() => { if (reads.get(key) === pending) reads.delete(key); });
            reads.set(key, pending);
          }
          return reads.get(key).then(res, rej);
        }
      };
      return a;
    }
    async function call(op) {
      const version = sessionVersion;
      let r;
      try {
        r = await timedFetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          timeoutMs: op.action === 'select' ? 9000 : 15000,
          body: JSON.stringify(op)
        });
      } catch (e) {
        if (version !== sessionVersion) return { data: null, error: { message: '登录身份已改变，请重新加载' } };
        return { data: null, error: { message: '网络错误：' + (e && e.message ? e.message : e) } };
      }
      let json = {};
      try { json = await r.json(); } catch (e) { json = {}; }
      if (version !== sessionVersion) return { data: null, error: { message: '登录身份已改变，请重新加载' } };
      if (r.status === 401) window.dispatchEvent(new CustomEvent('an:session-expired'));
      if (!r.ok) return { data: null, error: { message: (json && json.error) || ('HTTP ' + r.status) } };
      let data = json.data;
      if (op.single && Array.isArray(data)) data = data[0] || null;
      return { data: data, error: null };
    }
    return { from: function (t) { return build(t); } };
  })();
  window.DB = DB;

  // SSE allows CRLF, multiple data lines, and a final event without a blank line.
  function parseEvent(event) {
    const payload = event.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n').trim();
    if (!payload || payload === '[DONE]') return null;
    try {
      const data = JSON.parse(payload), delta = data.choices?.[0]?.delta;
      return delta ? { choices: [{ delta: { content: delta.content || '', reasoning_content: delta.reasoning_content || '' } }] } : null;
    } catch { return null; }
  }
  async function* streamCompletion(options) {
    const version = sessionVersion;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    window.addEventListener('an:session-reset', cancel);
    let reader;
    try {
      const response = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(options), signal: controller.signal
      });
      if (!response.ok || !response.body) {
        let data = {}; try { data = await response.json(); } catch {}
        throw new Error(data.error || 'AI 服务暂时不可用，请稍后重试');
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        if (version !== sessionVersion) return;
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        let match;
        while ((match = /\r?\n\r?\n/.exec(buffer))) {
          const event = parseEvent(buffer.slice(0, match.index));
          buffer = buffer.slice(match.index + match[0].length);
          if (event) yield event;
        }
        if (chunk.done) {
          const last = parseEvent(buffer); if (last) yield last;
          break;
        }
      }
    } catch (error) {
      if (controller.signal.aborted && version !== sessionVersion) return;
      throw error;
    } finally {
      window.removeEventListener('an:session-reset', cancel);
      if (reader) { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    }
  }
  window.ANCloud = { llm: {
    models: { list: () => Promise.resolve([{ id: 'auto', name: 'Auto', disabled: false }]) },
    chat: { completions: { create: streamCompletion } }
  } };
})();
