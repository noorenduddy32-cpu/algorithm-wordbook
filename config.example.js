/* 公开展示配置。密码和云端凭据只由服务端环境变量提供。 */
window.APP_CONFIG = {
  /* 点击单词跳转的在线词典（默认剑桥词典 · 英汉简体） */
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",

  /* 导出 Word 时的标题 */
  docTitle: "算法手记",

  /* 公开训练平台用户名。留空时管理员可在首页临时配置当前设备。 */
  platforms: {
    codeforces: "",
    atcoder: "",
    luogu: ""
  }
};
