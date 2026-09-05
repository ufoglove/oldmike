# data-contracts.md — V3-U01 資料契約（草案，依實際 schema 命名）

原則：沿用既有表，不重複建同義表；公開書目 metadata 與私人筆記/使用狀態分開；owner/workspace/project_id/id/version/provenance 為共同欄位；所有寫入伺服器驗證 tenant scope。

## 概念 → 既有/新增
- User/Workspace/ProjectMembership → "user"/workspaces/workspace_members（既有）
- Project → projects（既有）＋新增：trashed_at timestamptz NULL（軟刪）；meta 編輯欄位待定（title 已有；domain/keywords 待定位存放，稽核 projects/artifact 存放處）
- ResearchProject（正式研究鏈）→ research_projects（既有）
- Artifact/版本 → project_artifacts＋research_documents（既有 append-only/版本鏈）；研究啟動摘要建議存 research_documents document_type='RESEARCH_START_SUMMARY'＋stage_detail 版本
- Stage 登錄 → 既有 stageDefinitions（前端 lib）＋本階段若需持久：module_registry/stage_state 表（新增，待 scope 確認）
- LiteratureItem/ProjectLiteratureLink/EvidenceNote/CitationSource → literature_items/project_literature_links 既有；evidence_notes 待稽核（可能以 research_documents/note 形式）
- IntegrationConnection/ExternalItemLink → 新增：zotero_bindings（project_id, library_type, library_id, collection_key, binding_state, item_version, library_version, last_successful_sync_at, created_by, created_at, updated_at；UNIQUE(project_id, collection_key)）
- AgentJob/JobEvent → 新增：agent_jobs（job_id text PK, project_id, requester_user_id, task_type, input_snapshot jsonb, idempotency_key, status, checkpoint jsonb, attempt int, provider_request_id, usage jsonb, error_code, result_reference, lease_until, created_at, updated_at）；agent_job_events（event_id, job_id, event_type, detail jsonb, created_at）
- Audit → audit_events（既有）

## 狀態列舉（沿用規範）
agent_jobs.status: QUEUED|RUNNING|PARTIAL|SUCCEEDED|FAILED|CANCELLED|REQUIRES_ACTION
project 回收：trashed_at IS NOT NULL＝回收筒；restore＝清空。
zotero binding_state: NEEDS_CONFIGURATION|CONFIGURED|CONNECTED|SYNCING|SYNCED|SYNC_FAILED|DISABLED

## 版本/衝突
research_documents 已 append-only＋supersedes；編輯一律新版本；樂觀鎖以 content_hash/locked_at 既有機制。
