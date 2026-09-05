-- 0032_research_start_summary_document_type
-- V3-U01：研究啟動摘要以 research_documents（append-only 版本鏈）保存
-- 擴充 document_type CHECK（additive：只加新值，不縮減）。

BEGIN;

ALTER TABLE research_documents DROP CONSTRAINT research_documents_document_type_check;
ALTER TABLE research_documents ADD CONSTRAINT research_documents_document_type_check
  CHECK (document_type IN ('RESEARCH_PLAN', 'MANUSCRIPT', 'RESPONSE_TO_REVIEWERS', 'NAVIGATOR_ROUTE', 'RESEARCH_START_SUMMARY'));

COMMIT;
