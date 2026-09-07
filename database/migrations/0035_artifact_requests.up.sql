-- 0035: Artifact Request API (artifact-request/1.0.0)
-- Adoption work orders, write authorizations, and artifact request ledger.

CREATE TABLE IF NOT EXISTS adoption_work_orders (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  work_order_id text NOT NULL,
  deliverable_id text NOT NULL,
  chosen_goal text NOT NULL CHECK (chosen_goal IN ('JOURNAL_SCI_SSCI', 'NSTC_GENERAL', 'MOE_TPR')),
  document_purpose text NOT NULL,
  delivery_intent text NOT NULL,
  source_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'PREPARING' CHECK (status IN (
    'PREPARING', 'READY_FOR_PROJECT_SELECTION', 'READY_FOR_SCOPE_CONFIRMATION',
    'RUNNING', 'WAITING_REQUIRED_INPUT', 'NEEDS_USER_REVIEW', 'PARTIAL_DELIVERY',
    'DELIVERED_PENDING_ACCEPTANCE', 'ACCEPTED_FOR_STATED_PURPOSE', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adoption_work_orders_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT adoption_work_orders_unique_id UNIQUE (workspace_id, project_id, work_order_id)
);

CREATE TABLE IF NOT EXISTS project_work_authorizations (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  work_order_id text NOT NULL,
  authorization_id text NOT NULL,
  document_purpose text NOT NULL,
  target_deliverable text NOT NULL,
  allowed_sources_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_expense_cap_usd numeric NOT NULL DEFAULT 0,
  valid_until timestamptz NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_work_authorizations_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT project_work_authorizations_work_order_fk FOREIGN KEY (workspace_id, project_id, work_order_id) REFERENCES adoption_work_orders(workspace_id, project_id, work_order_id) ON DELETE CASCADE,
  CONSTRAINT project_work_authorizations_unique_id UNIQUE (workspace_id, authorization_id)
);

CREATE TABLE IF NOT EXISTS artifact_requests (
  artifact_id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  work_order_id text NOT NULL,
  authorization_id text NOT NULL,
  idempotency_key text NOT NULL,
  filename text NOT NULL,
  format text NOT NULL CHECK (format IN ('MARKDOWN', 'JSON', 'DOCX', 'PDF')),
  bytes integer NOT NULL CHECK (bytes >= 0),
  sha256 text NOT NULL,
  storage_ref text NOT NULL,
  content_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artifact_requests_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT artifact_requests_work_order_fk FOREIGN KEY (workspace_id, project_id, work_order_id) REFERENCES adoption_work_orders(workspace_id, project_id, work_order_id) ON DELETE CASCADE,
  CONSTRAINT artifact_requests_unique_idempotency UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS artifact_requests_work_order_idx
  ON artifact_requests(workspace_id, project_id, work_order_id, created_at DESC);
