-- 0021 down
BEGIN;

ALTER TABLE route_workspace_sections DROP COLUMN IF EXISTS provenance;

COMMIT;
