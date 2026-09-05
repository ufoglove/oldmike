-- 0019 rollback: 還原 zotero_connections sync_status 原 constraint
BEGIN;

ALTER TABLE zotero_connections DROP CONSTRAINT zotero_connections_sync_status_check;
ALTER TABLE zotero_connections ADD CONSTRAINT zotero_connections_sync_status_check
  CHECK (sync_status = ANY (ARRAY['CONNECTED'::text, 'SYNCING'::text, 'ERROR'::text, 'DISCONNECTED'::text]));

COMMIT;
