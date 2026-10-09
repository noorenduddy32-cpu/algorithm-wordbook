/* Lightweight interface language switch. Content written by the user is never translated. */
(function () {
  'use strict';
  const KEY = 'an_language_v1';
  const messages = {
    zh: {
      'nav.home': '备赛首页', 'nav.words': '题面词汇', 'nav.notes': '算法文章', 'nav.visits': '访问记录',
      'ui.language': '界面语言', 'ui.theme': '视觉主题', 'ui.font': '阅读字号',
      'home.kicker': 'ICPC PREP COMMAND CENTER', 'home.title': '今天，把哪一步\n练得更扎实？',
      'home.subtitle': '词汇、题解、比赛和刷题记录，汇成一张持续更新的备赛地图。',
      'home.notes': '打开算法文章', 'home.words': '复习题面词汇',
      'home.platforms': '训练平台', 'home.platformsSub': '公开数据会自动汇总；账号只保存在当前设备。',
      'home.configure': '配置账号', 'home.contests': '近期比赛', 'home.contestsSub': '来自 Codeforces 的实时公开赛程。',
      'home.refresh': '刷新数据', 'home.today': '今日通过', 'home.accuracy': '近 30 天通过率',
      'home.unconfigured': '未配置账号', 'home.live': '实时数据', 'home.noContest': '暂时没有读取到近期比赛。',
      'home.settingsTitle': '训练平台账号', 'home.settingsHint': '填写公开用户名后，首页会读取平台公开接口。洛谷目前只提供主页入口。',
      'home.saveProfiles': '保存并刷新', 'home.cancel': '取消',
      'words.kicker': 'CONTEST VOCABULARY', 'words.title': '题面词汇', 'words.subtitle': '记下题面中的陌生词，在原题语境中理解和复习。',
      'words.search': '搜索单词 / 中文 / 例句', 'words.onlyWeak': '只看生词', 'words.list': '词汇列表', 'words.quiz': '词汇自测', 'words.add': '添加单词',
      'words.total': '单词', 'words.examples': '例句', 'words.month': '本月新增', 'words.updated': '最近更新',
      'notes.kicker': 'ALGORITHM FIELDNOTES', 'notes.title': '每一道题，都有迹可循。', 'notes.subtitle': '收藏解题的突破口，整理下次用得上的思路。',
      'notes.new': '写一篇笔记', 'notes.search': '搜索题号、算法，或某个思路…', 'notes.published': '已发布', 'notes.drafts': '草稿箱'
    },
    en: {
      'nav.home': 'Prep dashboard', 'nav.words': 'Vocabulary', 'nav.notes': 'Algorithm notes', 'nav.visits': 'Visits',
      'ui.language': 'Language', 'ui.theme': 'Visual theme', 'ui.font': 'Reading size',
      'home.kicker': 'ICPC PREP COMMAND CENTER', 'home.title': 'What will you make\nmore reliable today?',
      'home.subtitle': 'Vocabulary, solutions, contests and practice history in one evolving prep map.',
      'home.notes': 'Open algorithm notes', 'home.words': 'Review vocabulary',
      'home.platforms': 'Training platforms', 'home.platformsSub': 'Public activity is summarized automatically. Handles stay on this device.',
      'home.configure': 'Configure handles', 'home.contests': 'Upcoming contests', 'home.contestsSub': 'Live public schedule from Codeforces.',
      'home.refresh': 'Refresh data', 'home.today': 'Accepted today', 'home.accuracy': '30-day acceptance',
      'home.unconfigured': 'Handle not configured', 'home.live': 'Live data', 'home.noContest': 'No upcoming contests are available right now.',
      'home.settingsTitle': 'Training platform handles', 'home.settingsHint': 'Add public handles to load public activity. Luogu currently provides a profile link only.',
      'home.saveProfiles': 'Save and refresh', 'home.cancel': 'Cancel',
      'words.kicker': 'CONTEST VOCABULARY', 'words.title': 'Problem vocabulary', 'words.subtitle': 'Save unfamiliar statement words and learn them in context.',
      'words.search': 'Search words, meanings or examples', 'words.onlyWeak': 'Weak words only', 'words.list': 'Word list', 'words.quiz': 'Review cards', 'words.add': 'Add word',
      'words.total': 'Words', 'words.examples': 'Examples', 'words.month': 'Added this month', 'words.updated': 'Last updated',
      'notes.kicker': 'ALGORITHM FIELDNOTES', 'notes.title': 'Every problem leaves a trace.', 'notes.subtitle': 'Keep the turning point, proof and implementation detail you will need again.',
      'notes.new': 'Write a note', 'notes.search': 'Search a problem, algorithm or idea…', 'notes.published': 'Published', 'notes.drafts': 'Drafts'
    }
  };
  function read() { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'zh'; } catch (e) { return 'zh'; } }
  let lang = read();
  function t(key) { return (messages[lang] && messages[lang][key]) || messages.zh[key] || key; }
  function apply(root) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    (root || document).querySelectorAll('[data-i18n]').forEach(function (node) {
      const value = t(node.dataset.i18n);
      if (value) node.textContent = value;
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(function (node) {
      const value = t(node.dataset.i18nPlaceholder);
      if (value) node.placeholder = value;
    });
  }
  function set(next) {
    lang = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(document);
    window.dispatchEvent(new CustomEvent('an:language', { detail: { language: lang } }));
  }
  window.ANI18n = { get language() { return lang; }, t: t, set: set, apply: apply, options: [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }] };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(document); });
  else apply(document);
})();
