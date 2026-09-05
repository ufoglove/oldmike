-- 0019: zotero_connections sync_status 放寬至與 research_projects 一致
-- 背景：v1.7.3 開放 env 模式 Sync/Export 後，markZoteroSynced 寫入 'SYNCED' 違反
-- zotero_connections_sync_status_check（原僅 CONNECTED/SYNCING/ERROR/DISCONNECTED）
-- → sync 完成時整筆請求報錯、狀態卡 SYNCING。
-- 修法：與 research_projects.zotero_sync_status_check 使用相同 6 值語彙。
BEGIN;

ALTER TABLE zotero_connections DROP CONSTRAINT zotero_connections_sync_status_check;
ALTER TABLE zotero_connections ADD CONSTRAINT zotero_connections_sync_status_check
  CHECK (sync_status = ANY (ARRAY['NOT_LINKED'::text, 'CONNECTED'::text, 'SYNCING'::text, 'SYNCED'::text, 'SYNC_CONFLICT'::text, 'SYNC_ERROR'::text]));

COMMIT;
