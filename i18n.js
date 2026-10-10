/* Lightweight interface language switch. Content written by the user is never translated. */
(function () {
  'use strict';
  const KEY = 'an_language_v1';
  const messages = {
    zh: {
      'nav.home': '学习工作台', 'nav.words': '题面词汇', 'nav.notes': '题解笔记', 'nav.visits': '访问记录',
      'ui.language': '界面语言', 'ui.theme': '主题', 'ui.font': '阅读字号',
      'home.dashboard': '学习工作台', 'home.dashboardSub': '整理知识，记录思考，让每一天的训练都有所积累。',
      'home.banner': '思考有迹可循。', 'home.bannerSub': '从读懂一道题，到写下一个解法。\n把值得留下的词汇与思路，收进你的算法手记。',
      'home.wordsHint': '在题目语境中，积累每一个词。', 'home.notesHint': '保存解法，也保存思考过程。',
      'home.recent': '最近的笔记', 'home.allNotes': '查看全部', 'home.search': '搜索题目、算法或笔记…', 'home.explore': '按算法探索',
      'home.activity': '学习轨迹', 'home.activityHint': '记录词汇复习与笔记积累', 'home.wordShelf': '词汇速览', 'home.review': '开始复习',
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
      'notes.kicker': 'ALGORITHM FIELDNOTES', 'notes.title': '题解与算法', 'notes.subtitle': '题解、算法与比赛复盘，随时查阅。',
      'notes.new': '新建笔记', 'notes.search': '搜索题号、算法，或某个思路…', 'notes.published': '已发布', 'notes.drafts': '草稿箱'
    },
    en: {
      'nav.home': 'Dashboard', 'nav.words': 'Vocabulary', 'nav.notes': 'Notes', 'nav.visits': 'Visits',
      'ui.language': 'Language', 'ui.theme': 'Theme', 'ui.font': 'Reading size',
      'home.dashboard': 'Your study workspace', 'home.dashboardSub': 'Organize knowledge, keep your thinking, and build on each day of practice.',
      'home.banner': 'Keep a trace of your thinking.', 'home.bannerSub': 'From understanding a problem to finding a solution.\nA home for the words and ideas worth keeping.',
      'home.wordsHint': 'Build vocabulary in the context of real problems.', 'home.notesHint': 'Save your solutions and the thinking behind them.',
      'home.recent': 'Recent notes', 'home.allNotes': 'View all', 'home.search': 'Search problems, algorithms or notes…', 'home.explore': 'Explore by algorithm',
      'home.activity': 'Study activity', 'home.activityHint': 'Vocabulary reviews and notebook progress', 'home.wordShelf': 'Your vocabulary', 'home.review': 'Start review',
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
      'notes.kicker': 'ALGORITHM FIELDNOTES', 'notes.title': 'Algorithms & solutions', 'notes.subtitle': 'Solutions, algorithms and contest reviews, ready to revisit.',
      'notes.new': 'New note', 'notes.search': 'Search a problem, algorithm or idea…', 'notes.published': 'Published', 'notes.drafts': 'Drafts'
    }
  };
  function read() { try { return (localStorage.getItem(KEY) || localStorage.getItem('fieldbook_lang')) === 'en' ? 'en' : 'zh'; } catch (e) { return 'zh'; } }
  let lang = read();
  // Translate interface labels only. User vocabulary, note bodies and form values are excluded.
  const labels = {
    '阅读设置与数据备份':'Reading settings & backup','导出 Word':'Export Word','导出 JSON':'Export JSON','导入 JSON':'Import JSON','从句中选词':'Pick words from a sentence','批量添加':'Batch add','手动添加':'Add manually','添加单词':'Add word',
    '收录时间':'Date added','字典序':'Alphabetical','例句数量':'Example count','最近编辑':'Recently edited','最近更新':'Last updated','随机':'Random','顺序':'Sequential',
    '▦ 卡片':'▦ Cards','☰ 列表':'☰ List','卡片':'Cards','列表':'List','分栏':'Columns','隐藏中文':'Hide meanings','隐藏例句':'Hide examples','每行':'Per row','词':'words','篇':'notes','自动':'Auto','密度':'Density','舒适':'Comfortable','紧凑':'Compact',
    '滚动时收起工具栏':'Hide toolbar while scrolling','选择当前结果':'Select current results','全选当前结果':'Select current results','清空选择':'Clear selection','导出已选单词':'Export selected words','继续加载':'Load more',
    '英 → 中':'English → Chinese','中 → 英':'Chinese → English','拼写练习':'Spelling','全部单词':'All words','当前筛选结果':'Filtered results','只看生词':'Weak words only','重新开始':'Restart',
    '写出对应的英文单词':'Type the matching English word','检查拼写':'Check spelling','显示答案':'Show answer','不认识':'Still learning','认识':'I know this','清空背诵记录':'Clear review history','美音':'US English','英音':'UK English',
    '取消':'Cancel','保存':'Save','删除':'Delete','关闭':'Close','导入':'Import','导出':'Export','全选':'Select all','清空':'Clear','识别':'Identify words','确认加入':'Add selected words','手动填写选词':'Fill selected words manually','隐藏基础词':'Hide basic words','拆分':'Split sentence','知道了':'Got it',
    '词性':'Part of speech','中文释义':'Chinese meaning','例句':'Examples','备注':'Notes','备注（可选）':'Notes (optional)','序号':'Number','AI 查中文':'AI meaning',
    '表头标题（印在左上角 Title: 后面）':'Document heading (after Title:)','导出范围':'Export scope','当前列表（搜索/筛选结果）':'Current search / filtered results','只导出生词':'Weak words only','已选单词':'Selected words','排序方式':'Sort by','排序方向':'Sort direction',
    '时间（配合下面的升降序）':'Date added','字典序 A→Z':'Alphabetical A–Z','频率（例句多的在前）':'Example count','降序（新 / 多 / 靠后的在前）':'Descending','升序（旧 / 少 / 靠前的在前）':'Ascending','排版':'Layout','经典词汇表（双栏 + 勾选框）':'Classic columns with checkboxes','单栏带例句（完整）':'Single column with full examples','每列单词数（每栏固定行数）':'Words per column','每页栏数（A4 横向并排栏数）':'Columns per A4 page','1 栏':'1 column','2 栏':'2 columns','3 栏':'3 columns','4 栏':'4 columns',
    '筛选与整理':'Find & organize','算法标签':'Algorithm tags','标题 · 标签 · 正文':'Title · tags · content','管理栏目':'Manage columns','创建时间':'Date created','阅读量':'Views','笔记库':'Library','编辑笔记':'Edit note','编辑':'Edit','分屏':'Split view','预览':'Preview','公开 · 发布后访客可见':'Public when published','私密 · 仅管理员可见':'Private · admin only','发布':'Publish','保存草稿':'Save draft',
    '题目复盘':'Problem review','算法整理':'Algorithm notes','从模板开始':'Start from a template','撤销':'Undo','重做':'Redo','历史':'History','格式':'Format','正文':'Paragraph','一级标题':'Heading 1','二级标题':'Heading 2','三级标题':'Heading 3','四级标题':'Heading 4','五级标题':'Heading 5',
    '加粗':'Bold','斜体':'Italic','下划线':'Underline','删除线':'Strikethrough','清除格式':'Clear formatting','颜色':'Color','背景':'Highlight','对齐':'Align','左对齐':'Left','居中':'Center','右对齐':'Right','引用':'Quote','代码块':'Code block','行内代码':'Inline code','表格':'Table','插入表格':'Insert table','插入':'Insert','有序列表':'Numbered list','无序列表':'Bullet list','链接':'Link','图片':'Image','公式':'Formula',
    '跟随系统':'System','极光赛场':'Aurora','纸上推演':'Paper','终场余晖':'Sunset','雨后森林':'Forest','浅樱手札':'Sakura','海盐微光':'Ocean','沙丘纸页':'Sand','曜石夜读':'Obsidian','笔记本外观':'Notebook themes','阅读字号':'Reading size','恢复标准字号':'Reset reading size','调整词汇与笔记正文的大小':'Adjust vocabulary and note text size','管理员登录':'Admin sign in','退出访问':'Sign out','退出编辑':'Leave admin mode','访客只读':'Read only','全部':'All','管理员':'Admin','访客':'Visitor','未登录':'Signed out'
  };
  const translatedNodes = new WeakMap();
  const chromeSelector = 'button,button span,label,option,summary,legend,.library-side-label,.library-filter-label,.search-hint,.menu-caption,.fs-hint,.modal-box h2';
  function applyLabels(root) {
    const nodes = (root || document).querySelectorAll(chromeSelector);
    nodes.forEach(function (element) {
      if (element.closest('[contenteditable],#richEditor,#edPreview,#noteList,#boardView,#recentNotes,#recentWords,#wordList,#pickPreview,#dExamples,[data-i18n]')) return;
      Array.from(element.childNodes).filter(node => node.nodeType === 3).forEach(function (node) {
        const current = node.textContent.trim(), previous = translatedNodes.get(node);
        const source = previous && current === previous.last ? previous.source : current;
        if (!Object.prototype.hasOwnProperty.call(labels, source)) return;
        const next = lang === 'en' ? labels[source] : source;
        translatedNodes.set(node, { source: source, last: next });
        if (current !== next) node.textContent = node.textContent.replace(current, next);
      });
    });
  }
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
    applyLabels(root);
  }
  function set(next) {
    lang = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(document);
    window.dispatchEvent(new CustomEvent('an:language', { detail: { language: lang } }));
  }
  window.ANI18n = { get language() { return lang; }, t: t, set: set, apply: apply, options: [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }] };
  function start() {
    apply(document);
    let queued = false;
    new MutationObserver(function (changes) {
      if (queued || !changes.some(change => change.type === 'childList')) return;
      queued = true;
      queueMicrotask(function () { queued = false; applyLabels(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
