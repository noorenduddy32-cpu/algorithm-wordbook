-- 算法学习笔记本 数据库结构（PostgreSQL）
-- 说明：本文件供「自己搭一套」时参考。在 WorkBuddy 云数据库的 SQL 控制台里请**逐条**执行
--      （单次只能跑一条语句）。现有库请另外参考 security.sql，先确认服务端角色再迁移。

-- ============================================================
-- 1. 词库：单词本用
-- ============================================================

CREATE TABLE IF NOT EXISTS words (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word        TEXT        NOT NULL UNIQUE,              -- 原形：小写、去多余空格，唯一键
  pos         TEXT        NOT NULL DEFAULT '',          -- 词性：n. v. adj. adv. prep. conj. num. pron. phr.
  meaning     TEXT        NOT NULL DEFAULT '',          -- 中文释义
  examples    JSONB       NOT NULL DEFAULT '[]'::jsonb, -- 例句数组
  note        TEXT        NOT NULL DEFAULT '',          -- 备注：不规则复数、常见搭配、比赛语境提示
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE words IS '算法学习笔记本 · 词库：拼写 / 词性 / 中文释义 / 例句，word 唯一，重复单词自动合并例句';

-- 浏览器不直连数据库；所有操作经服务端 /api 校验。
-- CLOUD_KEY 必须对应具有所需权限的服务端角色，不得使用浏览器公开凭据。
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.words FROM authenticated, anon;

-- ============================================================
-- 2. 文章：Markdown 题解 / 笔记用（notes.html）
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT        NOT NULL DEFAULT '',          -- 标题
  content     TEXT        NOT NULL DEFAULT '',          -- 正文，HTML 所见即所得
  summary     TEXT        NOT NULL DEFAULT '',          -- 摘要；留空时前端自动截取正文前 90 字
  tags        JSONB       NOT NULL DEFAULT '[]'::jsonb, -- 标签数组，如 ["图论","最短路"]
  category    TEXT        NOT NULL DEFAULT '',          -- 自定义分栏的栏名（看板「自定义栏」模式按此归类；空 = 未分栏）
  cover       TEXT        NOT NULL DEFAULT '',          -- 封面图 URL（预留）
  views       BIGINT      NOT NULL DEFAULT 0,           -- 阅读次数，打开文章时 +1
  top         BOOLEAN     NOT NULL DEFAULT false,       -- 是否置顶（预留）
  status      TEXT        NOT NULL DEFAULT 'draft',     -- 状态：draft（草稿）/ published（已发布）
  visibility  TEXT        NOT NULL DEFAULT 'private',   -- 可见性：public（访客可见）/ private（仅管理员可见）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notes IS '算法学习笔记本 · 文章：Markdown 题解 / 思路复盘 / 模板与踩坑记录';

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notes FROM authenticated, anon;

-- ============================================================
-- 3. 访问日志：谁、从哪来、看了哪篇、看了多久（仅管理员可读，登录后可记访问，不可删）
-- ============================================================

CREATE TABLE IF NOT EXISTS visits (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role        TEXT        NOT NULL DEFAULT '',          -- admin / visitor / anon
  ip          TEXT        NOT NULL DEFAULT '',          -- IP 地址
  region      TEXT        NOT NULL DEFAULT '',          -- 大致地区（由 IP 解析）
  ua          TEXT        NOT NULL DEFAULT '',          -- User-Agent 摘要
  os          TEXT        NOT NULL DEFAULT '',          -- 操作系统
  browser     TEXT        NOT NULL DEFAULT '',          -- 浏览器
  path        TEXT        NOT NULL DEFAULT '',          -- 页面路径，如 /notes.html
  note_id     BIGINT      NULL,                         -- 当前打开的文章 id
  note_title  TEXT        NOT NULL DEFAULT '',          -- 文章标题快照
  duration    INTEGER     NOT NULL DEFAULT 0,           -- 停留时长（秒）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE visits IS '算法学习笔记本 · 访问日志：不可删除，仅管理员可见';

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.visits FROM authenticated, anon;
