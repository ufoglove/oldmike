-- 0031_v3u01_soft_delete_zotero_bindings_agent_jobs (down)
-- 復原 V3-U01 additive 變更。順序與 up 相反。

BEGIN;

DROP TABLE IF EXISTS evidence_notes;
DROP TABLE IF EXISTS agent_job_events;
DROP TABLE IF EXISTS agent_jobs;
DROP TABLE IF EXISTS zotero_project_bindings;
ALTER TABLE projects DROP COLUMN IF EXISTS trashed_by_user_id;
ALTER TABLE projects DROP COLUMN IF EXISTS trashed_at;

COMMIT;
