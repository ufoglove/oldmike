-- 0011_submission_navigator_document_type.down.sql
-- 還原：移除 'NAVIGATOR_ROUTE'（僅在確無 NAVIGATOR_ROUTE 資料時可執行）
ALTER TABLE research_documents DROP CONSTRAINT research_documents_document_type_check;
ALTER TABLE research_documents ADD CONSTRAINT research_documents_document_type_check CHECK (
  document_type IN ('RESEARCH_PLAN', 'MANUSCRIPT', 'RESPONSE_TO_REVIEWERS')
);
