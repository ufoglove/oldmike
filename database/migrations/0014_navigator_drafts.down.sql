-- 0014: Navigator draft persistence (rollback)
BEGIN;

DROP TABLE IF EXISTS navigator_drafts;

COMMIT;
