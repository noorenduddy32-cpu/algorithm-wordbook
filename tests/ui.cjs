// 可选浏览器回归：安装 Playwright 后运行 node tests/ui.cjs。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createFixtureCloud } = require('./fixture-cloud.cjs');
const { createServer } = require('../server');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
(async function () {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const fixture = createFixtureCloud(); await listen(fixture.server);
  process.env.CLOUD_ENDPOINT = 'http://127.0.0.1:' + fixture.server.address().port;
  process.env.CLOUD_KEY = 'fixture-only';
  process.env.SESSION_SECRET = 'fixture-session-secret-'.repeat(3);
  process.env.ADMIN_PASSWORD = 'test-admin'; process.env.VISITOR_PASSWORD = 'test-visitor';
  const server = createServer(); await listen(server);
  const base = 'http://127.0.0.1:' + server.address().port;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  if (process.env.UI_ASSET_DIR) await context.route('https://cdn.jsdelivr.net/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const file = name === 'jszip.min.js' ? path.join(__dirname, '../vendor/jszip.min.js') : path.join(process.env.UI_ASSET_DIR, name);
    if (fs.existsSync(file)) await route.fulfill({ path: file }); else await route.abort();
  });
  const page = await context.newPage();
  const output = process.env.UI_OUTPUT_DIR || path.join(__dirname, '../test-results');
  fs.mkdirSync(output, { recursive: true });
  async function login(password) {
    await page.locator('#gatePw').fill(password);
    await page.locator('#gateForm button').click();
    await page.locator('#gate').waitFor({ state: 'detached' });
  }
  async function ready(selector) { await page.locator(selector).first().waitFor(); }
  async function noOverflow() {
    const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    assert.ok(dims.scroll <= dims.width + 1, JSON.stringify(dims));
  }
  try {
    await page.goto(base);
    await page.evaluate(() => localStorage.setItem('wb_notes_cache', JSON.stringify([{ title: 'LEGACY_PRIVATE_SENTINEL', status: 'published', visibility: 'private' }])));
    await page.reload();
    await login('test-visitor');
    await page.waitForFunction(() => document.getElementById('entryNotes').textContent === '3');
    assert.equal(await page.locator('[data-admin]:visible').count(), 0);
    await page.screenshot({ path: path.join(output, 'home-desktop.png'), fullPage: true });
    await noOverflow();
    console.log('PASS 访客首页仅统计公开笔记');

    fixture.db.notes[0].content += '<img src="/missing-test-image" onerror="window.XSS_SENTINEL=1">';
    await page.goto(base + '/notes.html'); await ready('.note-card');
    assert.equal(await page.locator('.note-card').count(), 3);
    await page.locator('.note-card[data-id="1"]').click();
    await ready('#edPreview');
    assert.equal(await page.locator('#gate').count(), 0);
    assert.equal(await page.locator('#edBody').getAttribute('contenteditable'), 'false');
    assert.equal(await page.locator('#publishBtn').isVisible(), false);
    assert.match(await page.locator('#edPreview').innerText(), /不变量/);
    assert.equal(await page.evaluate(() => window.XSS_SENTINEL), undefined);
    assert.equal(await page.locator('#edPreview [onerror]').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('wb_notes_cache')), null);
    await page.screenshot({ path: path.join(output, 'reader-desktop.png'), fullPage: true });
    await page.goto(base + '/notes.html#n3'); await ready('.note-card');
    assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE_NOTE_SENTINEL|DRAFT_NOTE_SENTINEL/);
    console.log('PASS 访客直接阅读；私密链接不可读');

    await page.locator('.role-tag').click(); await login('test-admin');
    await page.waitForFunction(() => document.querySelectorAll('.note-card').length === 4);
    // hash 指向私密笔记，管理员登录后允许打开；返回列表再验证新建与模板。
    if (await page.locator('#editView').isVisible()) await page.locator('#edBack').click();
    assert.equal(await page.locator('#newNoteBtn').isVisible(), true);
    await page.locator('#newNoteBtn').click();
    await page.locator('[data-template="problem"]').click();
    await page.locator('#edTitle').fill('测试：题目复盘');
    await page.locator('#saveDraftBtn').click();
    await page.locator('#listView').waitFor({ state: 'visible' });
    assert.ok(fixture.db.notes.some(n => n.title === '测试：题目复盘' && n.visibility === 'private' && n.status === 'draft'));
    console.log('PASS 管理员新建私密草稿与复盘模板');

    const other = await context.newPage();
    await other.goto(base + '/notes.html#n3'); await other.locator('#editView').waitFor({ state: 'visible' });
    await page.locator('.role-tag').click();
    await page.waitForFunction(() => document.documentElement.dataset.auth === 'visitor');
    await other.waitForFunction(() => document.documentElement.dataset.auth === 'visitor');
    assert.doesNotMatch(await other.locator('body').innerText(), /PRIVATE_NOTE_SENTINEL/);
    assert.equal(await other.locator('#edTitle').inputValue(), '');
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('an_cache:')).length), 0);
    await other.close();
    console.log('PASS 身份切换清理私密正文、会话缓存及其他标签页');

    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of ['index.html', 'notes.html', 'wordbook.html']) {
        await page.goto(base + '/' + file);
        await page.waitForFunction(() => document.documentElement.dataset.auth === 'visitor');
        if (file === 'wordbook.html') await ready('#cardGrid .card');
        await noOverflow();
        await page.screenshot({ path: path.join(output, file.replace('.html', '') + '-' + width + '.png'), fullPage: true });
      }
    }
    console.log('PASS 手机和平板三个主页面无水平溢出');
    await page.goto(base + '/wordbook.html?q=permutation'); await ready('#cardGrid .card');
    assert.equal(await page.locator('#searchInput').inputValue(), 'permutation');
    await page.locator('.role-logout').click(); await ready('#gate');
    assert.equal(await page.locator('#cardGrid').innerText(), '');
    assert.deepEqual(errors, []);
    console.log('PASS 词汇深链、退出清理和无浏览器脚本异常');
  } catch (e) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    console.error('Browser errors:', errors);
    throw e;
  } finally {
    await browser.close();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => fixture.server.close(resolve))]);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
