const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../data-client.js'), 'utf8');
function client(fetch) {
  const window = new EventTarget();
  vm.runInNewContext(source, { window, fetch, CustomEvent, AbortController, TextDecoder, setTimeout, clearTimeout });
  return window;
}
test('data client preserves mutation returning semantics and rejects stale identity results', async () => {
  let finish;
  let operation;
  const window = client(async (_url, options) => {
    operation = JSON.parse(options.body);
    return new Promise(resolve => { finish = () => resolve(Response.json({ data: [{ id: 7 }] })); });
  });
  const pending = window.DB.from('notes').update({ title: 'Updated' }).eq('id', 7).select('id').single().then(value => value);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(operation.action, 'update');
  assert.equal(operation.returning, true);
  window.dispatchEvent(new CustomEvent('an:session-reset'));
  finish();
  const result = await pending;
  assert.equal(result.data, null);
  assert.match(result.error.message, /身份已改变/);
});
test('SSE handles CRLF, split UTF-8 characters, and an unterminated last event', async () => {
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"世界"}}]}');
  const window = client(async () => new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
    controller.close();
  } })));
  let text = '';
  for await (const chunk of window.ANCloud.llm.chat.completions.create({ messages: [] })) text += chunk.choices[0].delta.content;
  assert.equal(text, '你好世界');
});
test('SSE stops delivering private content after a session change', async () => {
  let controller;
  const window = client(async () => new Response(new ReadableStream({ start(c) { controller = c; } })));
  const iterator = window.ANCloud.llm.chat.completions.create({ messages: [] });
  const pending = iterator.next();
  await new Promise(resolve => setImmediate(resolve));
  window.dispatchEvent(new CustomEvent('an:session-reset'));
  controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"PRIVATE_SENTINEL"}}]}\n\n'));
  assert.equal((await pending).done, true);
});
