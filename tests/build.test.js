const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('部署产物包含页面所需本地资源，不发布源码与私有数据', () => {
  const root = path.resolve(__dirname, '..');
  execFileSync(process.execPath, ['scripts/build-static.js'], { cwd: root });
  const output = path.join(root, 'public');
  for (const name of ['.env.local', 'api/_lib/auth.js', 'db/schema.sql', 'csdn_articles.json', 'words.json', 'server.js', 'tests/security.test.js', 'package.json']) {
    assert.equal(fs.existsSync(path.join(output, name)), false, name);
  }
  for (const page of ['index.html', 'notes.html', 'wordbook.html', 'visits.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|png))"/g)) {
      assert.equal(/^https?:/.test(match[1]), false, 'Required resources must be available without third-party CDN: ' + match[1]);
      assert.equal(fs.existsSync(path.join(output, match[1])), true, page + ': ' + match[1]);
    }
  }
});
