-- 0033_home_project_meta (down)

BEGIN;

ALTER TABLE projects DROP COLUMN IF EXISTS last_payload_hash;
ALTER TABLE projects DROP COLUMN IF EXISTS project_draft;
ALTER TABLE projects DROP COLUMN IF EXISTS publication_route;
ALTER TABLE projects DROP COLUMN IF EXISTS funding_route;
ALTER TABLE projects DROP COLUMN IF EXISTS primary_goal;
ALTER TABLE projects DROP COLUMN IF EXISTS current_location;
ALTER TABLE projects DROP COLUMN IF EXISTS meta_updated_by_user_id;
ALTER TABLE projects DROP COLUMN IF EXISTS meta_updated_at;
ALTER TABLE projects DROP COLUMN IF EXISTS meta_version;

COMMIT;
