/* A small, deterministic binary-search exercise. No data is sent or stored. */
(function () {
  'use strict';
  const values = [3, 8, 14, 21, 29, 34, 42, 57];
  const cells = document.getElementById('labCells');
  if (!cells) return;
  const targetInput = document.getElementById('labTarget');
  const next = document.getElementById('labNext');
  const status = document.getElementById('labStatus');
  let low, high, probe, steps, done, found, message;

  function render() {
    cells.replaceChildren(...values.map(function (value, index) {
      const cell = document.createElement('span');
      cell.className = 'lab-cell' + (index < low || index > high ? ' excluded' : '') +
        (index === probe ? ' probe' : '') + (index === probe && found ? ' found' : '');
      const number = document.createElement('span'); number.textContent = value;
      const label = document.createElement('small'); label.textContent = index === probe ? 'mid' : '[' + index + ']';
      cell.append(number, label);
      cell.setAttribute('aria-label', '索引 ' + index + '，值 ' + value + (index === probe ? '，本次中点' : ''));
      return cell;
    }));
    status.textContent = message;
    next.disabled = done;
    next.textContent = done ? (found ? '已找到 ✓' : '查找结束') : '下一步 →';
  }
  function reset() {
    low = 0; high = values.length - 1; probe = -1; steps = 0; done = false; found = false;
    message = '目标 ' + targetInput.value + ' · 从整个有序数组开始。';
    render();
  }
  next.addEventListener('click', function () {
    if (done) return;
    const target = Number(targetInput.value);
    probe = low + Math.floor((high - low) / 2);
    steps++;
    if (values[probe] === target) {
      found = done = true;
      message = '第 ' + steps + ' 次比较：找到 ' + target + '，索引为 ' + probe + '。';
    } else {
      const smaller = values[probe] < target;
      if (smaller) low = probe + 1; else high = probe - 1;
      done = low > high;
      message = '第 ' + steps + ' 次：' + values[probe] + (smaller ? ' < ' : ' > ') + target + '，' +
        (done ? '区间已为空，目标不在数组中。' : '继续查找' + (smaller ? '右' : '左') + '侧 [' + low + ', ' + high + ']。');
    }
    render();
  });
  targetInput.addEventListener('change', reset);
  document.getElementById('labReset').addEventListener('click', reset);
  reset();
})();
