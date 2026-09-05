-- 0031_v3u01_soft_delete_zotero_bindings_agent_jobs
-- V3-U01：回收筒（軟刪除）、Zotero 專案綁定、持久任務底座（AgentJob）、Evidence Note
-- 原則：全部 additive；不刪除、不改名既有欄位；正式環境套用前須於隔離環境完成 up/down roundtrip。

BEGIN;

-- 0) projects 軟刪除欄位（回收筒）。status 不變（避免擴充 CHECK）；trashed_at 非空＝回收筒
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trashed_by_user_id text;
CREATE INDEX IF NOT EXISTS projects_trashed_idx ON projects (workspace_id, trashed_at) WHERE trashed_at IS NOT NULL;

-- 1) Zotero Project–Collection binding（與 zotero_connections 的使用者層連線分開保存）
CREATE TABLE IF NOT EXISTS zotero_project_bindings (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  library_type text NOT NULL CHECK (library_type IN ('user','group')),
  library_id text NOT NULL,
  collection_key text NOT NULL,
  collection_name text,
  binding_status text NOT NULL DEFAULT 'NEEDS_CONFIGURATION' CHECK (binding_status IN ('NEEDS_CONFIGURATION','CONFIGURED','CONNECTED','SYNCING','SYNCED','SYNC_FAILED','DISABLED')),
  item_version integer,
  library_version integer,
  last_successful_sync_at timestamptz,
  last_error text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, project_id, library_type, library_id, collection_key)
);
CREATE INDEX IF NOT EXISTS zotero_project_bindings_project_idx ON zotero_project_bindings (workspace_id, project_id);

-- 2) AgentJob：持久任務底座（spec：job_id/project_id/requester/task_type/input_snapshot/idempotency_key/status/checkpoint/attempt/provider_request_id/usage/error_code/result_reference）
CREATE TABLE IF NOT EXISTS agent_jobs (
  job_id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  requester_user_id text NOT NULL,
  task_type text NOT NULL,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','PARTIAL','SUCCEEDED','FAILED','CANCELLED','REQUIRES_ACTION')),
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt integer NOT NULL DEFAULT 0,
  provider_request_id text,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  result_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  cancel_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, project_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS agent_jobs_queue_idx ON agent_jobs (status, created_at) WHERE status IN ('QUEUED','RUNNING');
CREATE INDEX IF NOT EXISTS agent_jobs_project_idx ON agent_jobs (workspace_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_job_events (
  event_id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES agent_jobs(job_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_job_events_job_idx ON agent_job_events (job_id, created_at);

-- 3) Evidence Note（spec 八：專案、來源 ID、Claim/RQ、頁碼/段落、用途、分析人與時間）
CREATE TABLE IF NOT EXISTS evidence_notes (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  literature_id text REFERENCES literature_items(id) ON DELETE CASCADE,
  citation_source_id text REFERENCES citation_sources(id) ON DELETE CASCADE,
  claim_ref text,
  rq_ref text,
  page_or_paragraph text,
  research_purpose text,
  note_text text NOT NULL,
  reading_level text NOT NULL DEFAULT 'ABSTRACT_LEVEL' CHECK (reading_level IN ('ABSTRACT_LEVEL','FULLTEXT_LEVEL')),
  analyzed_by_user_id text,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_notes_project_idx ON evidence_notes (workspace_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS evidence_notes_literature_idx ON evidence_notes (literature_id) WHERE literature_id IS NOT NULL;

COMMIT;
