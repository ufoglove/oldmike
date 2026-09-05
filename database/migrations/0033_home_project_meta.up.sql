-- 0033_home_project_meta
-- V3-HOME-01：首頁專案儲存／讀取 meta 欄位（additive；樂觀鎖版本 + 最後儲存紀錄 + 路線/目標/位置/草稿）
-- 各模組內容仍在各自紀錄（research_documents/各中心表）；此處只存「首頁可保存的專案層 meta」，
-- 不做第二套專案/文獻/流程/任務系統。

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS meta_version integer NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS meta_updated_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS meta_updated_by_user_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_location text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_goal text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_route text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS publication_route text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_draft jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_payload_hash text;

COMMIT;
