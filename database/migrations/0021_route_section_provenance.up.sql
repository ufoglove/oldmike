-- 0021: route_workspace_sections 加 provenance（AI 草稿 → 使用者確認轉正式版本）
BEGIN;

ALTER TABLE route_workspace_sections
  ADD COLUMN provenance text NOT NULL DEFAULT 'USER_PROVIDED'
  CHECK (provenance IN ('USER_PROVIDED', 'AI_PROPOSED', 'USER_REVIEWED'));

COMMIT;
