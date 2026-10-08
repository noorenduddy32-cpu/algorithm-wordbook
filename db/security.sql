-- 现有库加固；本文件不会自动执行。
-- 执行前：确认 CLOUD_KEY 对应服务端专用受信任角色，并能在撤销 anon/authenticated 后访问这些表。
-- 如果云平台只提供公开角色的 key，请先配置服务端身份或在平台关闭数据库的公网直连。
-- 不要通过重新开放 anon 权限解决服务端凭据问题。
BEGIN;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.words, public.notes, public.visits FROM anon, authenticated;
DROP POLICY IF EXISTS words_read_all ON public.words;
DROP POLICY IF EXISTS words_insert_all ON public.words;
DROP POLICY IF EXISTS words_update_all ON public.words;
DROP POLICY IF EXISTS words_delete_all ON public.words;
DROP POLICY IF EXISTS notes_read_all ON public.notes;
DROP POLICY IF EXISTS notes_insert_all ON public.notes;
DROP POLICY IF EXISTS notes_update_all ON public.notes;
DROP POLICY IF EXISTS notes_delete_all ON public.notes;
DROP POLICY IF EXISTS visits_read_all ON public.visits;
DROP POLICY IF EXISTS visits_insert_all ON public.visits;
DROP POLICY IF EXISTS visits_delete_deny ON public.visits;
COMMIT;
