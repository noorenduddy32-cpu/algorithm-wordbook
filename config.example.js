/* 站点配置模板：复制为 config.js 后改成你自己的仓库和密码 */
window.APP_CONFIG = {
  /* 词库所在仓库：增删改单词 = 往这个仓库的 words.json 提一个 commit */
  github: {
    owner: "你的 GitHub 用户名",
    repo: "你的仓库名",
    branch: "main",
    path: "words.json"
  },

  /* 留空则读同目录下的 words.json */
  dataUrl: "",

  /* 编辑模式密码：解锁后才能添加 / 编辑 / 删除 / 导入 */
  editPassword: "change-me",

  /* 点击单词跳转的在线词典（默认剑桥词典 · 英汉简体） */
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",

  /* 导出 Word 时的标题 */
  docTitle: "algorithm-wordbook",

  /* 大模型（可选，留空则由使用者在「设置」里自己填） */
  llm: { endpoint: "", model: "" }
};
