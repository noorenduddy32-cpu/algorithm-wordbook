/* 站点配置
   ---------------------------------------------------------------------------
   本文件是**入库**的配置，GitHub Pages 版直接用它就能连上云端数据库并编辑。
   页面会先尝试加载 config.js（已 gitignore，不入库），取不到就用本文件兜底。 */
window.APP_CONFIG = {
  /* 编辑模式密码：解锁后才能添加 / 编辑 / 删除 / 发布文章。
     词库和文章都存在云端数据库（public.words / public.notes），
     增删改只需这个密码，无需 GitHub Token / API Key。 */
  editPassword: "yqx",

  /* 点击单词跳转的在线词典（默认剑桥词典 · 英汉简体） */
  dictUrl: "https://dictionary.cambridge.org/zhs/搜索/英语-汉语-简体/direct/?q=",

  /* 导出 Word 时的标题 */
  docTitle: "算法学习笔记本",

  /* WorkBuddy 云端能力（keyless，无需自备 API Key / Token）：
     - database：词库读写（public.words），GitHub Pages 版也能跨域直连；
     - llm：「AI 查中文」按钮 +「从句中选词」自动识别，都走云端大模型。
     下面的是 algorithm-wordbook 这个应用自带的云端配置，publishableKey 可公开；
     直接部署即可用，无需修改。 */
  cloud: {
    endpoint: "https://algorithm-wordbook.app.workbuddy.host",
    publishableKey: "wbpk_FjheAsGmlutOmbmgXfuE7B_2C9ZJU2MsnUqVjYC1FW9OYt790zY7VBK"
  }
};
