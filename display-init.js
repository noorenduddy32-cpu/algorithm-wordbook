// Apply the reading preferences before the first paint.
(function () {
  'use strict';
  var root = document.documentElement;
  var choice = 'system', size = 16;
  var legacy = { glass: 'dark', ink: 'dark', 'glass-light': 'light', 'eye-green': 'eye' };
  try {
    choice = localStorage.getItem('wb_theme_v2') || 'system';
    choice = legacy[choice] || choice;
    if (['system', 'light', 'dark', 'eye'].indexOf(choice) < 0) choice = 'system';
    var saved = localStorage.getItem('wb_reading_size');
    if (saved !== null) size = Number(saved);
    else {
      var old = Number(localStorage.getItem('wb_font_scale'));
      if (old >= 1 && old <= 100) size = Math.round(old <= 50 ? 14 + (old - 1) * 2 / 49 : 16 + (old - 50) * 4 / 50);
    }
  } catch (e) { /* Preferences are optional in private browsing. */ }
  if (!Number.isFinite(size)) size = 16;
  size = Math.max(14, Math.min(20, size));
  var theme = choice === 'system' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  root.dataset.theme = theme;
  root.dataset.themeChoice = choice;
  root.style.setProperty('--content-font-size', size + 'px');
  root.style.setProperty('--content-scale', String(size / 16));
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
})();
