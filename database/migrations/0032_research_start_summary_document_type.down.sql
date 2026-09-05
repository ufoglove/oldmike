-- 0032_research_start_summary_document_type (down)
-- 移除 RESEARCH_START_SUMMARY 值（若已有該型別文件，正式環境應先處理再降版）。

BEGIN;

ALTER TABLE research_documents DROP CONSTRAINT research_documents_document_type_check;
ALTER TABLE research_documents ADD CONSTRAINT research_documents_document_type_check
  CHECK (document_type IN ('RESEARCH_PLAN', 'MANUSCRIPT', 'RESPONSE_TO_REVIEWERS', 'NAVIGATOR_ROUTE'));

COMMIT;
