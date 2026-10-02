-- algorithm-wordbook 数据库结构（PostgreSQL）
-- 说明：本文件供「自己搭一套」时参考。在 WorkBuddy 云数据库的 SQL 控制台里请**逐条**执行
--      （单次只能跑一条语句）。建表 + RLS 是两道独立的门，GRANT 和 CREATE POLICY 缺一不可。

CREATE TABLE IF NOT EXISTS words (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word        TEXT        NOT NULL UNIQUE,              -- 原形：小写、去多余空格，唯一键
  origin      TEXT        NOT NULL DEFAULT '',          -- 原词：题面 / 笔记里的原始形式（indice / errands / proceeds / subtracted）
  pos         TEXT        NOT NULL DEFAULT '',          -- 词性：n. v. adj. adv. prep. conj. num. pron. phr.
  meaning     TEXT        NOT NULL DEFAULT '',          -- 中文释义
  examples    JSONB       NOT NULL DEFAULT '[]'::jsonb, -- 例句数组
  note        TEXT        NOT NULL DEFAULT '',          -- 备注：不规则复数、常见搭配、比赛语境提示
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE words IS 'algorithm-wordbook：拼写 / 原词 / 词性 / 中文释义 / 例句，word 唯一，重复单词自动合并例句';

-- 公开只读：任何人打开网页都能看到词库；写操作由前端密码兜底（见 config.js 的 editPassword）
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.words TO authenticated, anon;

CREATE POLICY words_read_all   ON words FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY words_insert_all ON words FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY words_update_all ON words FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY words_delete_all ON words FOR DELETE TO authenticated, anon USING (true);
