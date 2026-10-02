/* 站点配置 */
window.APP_CONFIG = {
  /* 词库所在仓库：增删改单词 = 往这个仓库的 words.json 提一个 commit */
  github: {
    owner: "noorenduddy32-cpu",
    repo: "algorithm-wordbook",
    branch: "main",
    path: "words.json"
  },

  /* 留空则读同目录下的 words.json；想让别的站点共用同一份词库，可以填
     https://cdn.jsdelivr.net/gh/noorenduddy32-cpu/algorithm-wordbook@main/words.json */
  dataUrl: "",

  /* 编辑模式密码：解锁后才能添加 / 编辑 / 删除 / 导入。改这一行即可 */
  editPassword: "yqx",

  /* 点击单词跳转的在线词典（默认剑桥词典 · 英汉简体） */
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",

  /* 导出 Word 时的标题 */
  docTitle: "algorithm-wordbook",

  /* 大模型（可选）：留空就在「设置」里由使用者自己填，不会写进仓库 */
  llm: { endpoint: "", model: "" }
};
