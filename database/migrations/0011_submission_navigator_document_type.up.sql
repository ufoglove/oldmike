-- 0011_submission_navigator_document_type.up.sql
-- 修正：0009_submission_navigator 漏更新 research_documents.document_type CHECK constraint，
-- 導致 submission-navigator 存檔（document_type='NAVIGATOR_ROUTE'）被拒。
-- 新增 'NAVIGATOR_ROUTE' 至允許值（其餘值不變）。
ALTER TABLE research_documents DROP CONSTRAINT research_documents_document_type_check;
ALTER TABLE research_documents ADD CONSTRAINT research_documents_document_type_check CHECK (
  document_type IN ('RESEARCH_PLAN', 'MANUSCRIPT', 'RESPONSE_TO_REVIEWERS', 'NAVIGATOR_ROUTE')
);
