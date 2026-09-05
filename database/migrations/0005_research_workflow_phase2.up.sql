-- v1.5.3 Research Workflow Phase 2. This migration is disposable-only in this release.
BEGIN;

CREATE OR REPLACE FUNCTION research_append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
BEGIN
  IF old_row ? 'locked_at'
     AND old_row->>'locked_at' IS NULL
     AND new_row->>'locked_at' IS NOT NULL
     AND (old_row - 'locked_at' - 'locked_by_user_id') = (new_row - 'locked_at' - 'locked_by_user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'research_append_only_record';
END;
$$;

CREATE TABLE research_studies (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  lifecycle_contract_version text NOT NULL DEFAULT '1.5.3',
  stage_detail text NOT NULL DEFAULT 'S1_DESIGN_DRAFT',
  design_payload jsonb NOT NULL,
  locked_at timestamptz,
  locked_by_user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  CONSTRAINT research_studies_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_studies_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_studies(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_studies_lock_pair CHECK ((locked_at IS NULL) = (locked_by_user_id IS NULL)),
  UNIQUE (workspace_id, project_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_datasets (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  artifact_id text NOT NULL,
  artifact_path text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  schema_summary jsonb NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_datasets_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, artifact_id),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_analysis_plans (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL CHECK (method IN ('DESCRIPTIVE_STATISTICS', 'MISSING_VALUE_SUMMARY', 'CORRELATION', 'TWO_GROUP_COMPARISON')),
  parameters jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  engine text NOT NULL,
  engine_version text NOT NULL,
  locked_at timestamptz,
  locked_by_user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  CONSTRAINT research_analysis_plans_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_analysis_plans_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_analysis_plans(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_analysis_plans_lock_pair CHECK ((locked_at IS NULL) = (locked_by_user_id IS NULL)),
  UNIQUE (workspace_id, project_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_analysis_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dataset_id text NOT NULL,
  analysis_plan_id text NOT NULL,
  idempotency_key text NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  method text NOT NULL,
  engine text NOT NULL,
  engine_version text NOT NULL,
  result_hash text NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  result_payload jsonb NOT NULL,
  provenance jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('COMPLETED', 'REJECTED')),
  CONSTRAINT research_analysis_runs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_analysis_runs_dataset_fk FOREIGN KEY (workspace_id, project_id, dataset_id) REFERENCES research_datasets(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_analysis_runs_plan_fk FOREIGN KEY (workspace_id, project_id, analysis_plan_id) REFERENCES research_analysis_plans(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, idempotency_key)
);

CREATE TABLE research_evidence_sources (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_identity_status text NOT NULL CHECK (source_identity_status IN ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  source_identity text NOT NULL,
  source_version text NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  verification_method text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  excerpt text NOT NULL,
  page_section_locator text NOT NULL,
  verification_actor text NOT NULL,
  CONSTRAINT research_evidence_sources_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_claims (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claim_text text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  source_identity_status text NOT NULL CHECK (source_identity_status IN ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  claim_support_status text NOT NULL CHECK (claim_support_status IN ('UNVERIFIED', 'AI_PROPOSED', 'SUPPORTED', 'UNSUPPORTED')),
  locked_at timestamptz,
  locked_by_user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  CONSTRAINT research_claims_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_claims_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_claims(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_claims_lock_pair CHECK ((locked_at IS NULL) = (locked_by_user_id IS NULL)),
  UNIQUE (workspace_id, project_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_claim_evidence (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claim_version_id text NOT NULL,
  evidence_source_id text NOT NULL,
  support_status text NOT NULL CHECK (support_status IN ('UNVERIFIED', 'AI_PROPOSED', 'SUPPORTED', 'UNSUPPORTED')),
  CONSTRAINT research_claim_evidence_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_claim_evidence_claim_fk FOREIGN KEY (workspace_id, project_id, claim_version_id) REFERENCES research_claims(workspace_id, project_id, id) ON DELETE CASCADE,
  CONSTRAINT research_claim_evidence_source_fk FOREIGN KEY (workspace_id, project_id, evidence_source_id) REFERENCES research_evidence_sources(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (claim_version_id, evidence_source_id)
);

CREATE TABLE research_documents (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  document_type text NOT NULL CHECK (document_type IN ('RESEARCH_PLAN', 'MANUSCRIPT', 'RESPONSE_TO_REVIEWERS')),
  title text NOT NULL,
  body text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  stage_detail text NOT NULL,
  locked_at timestamptz,
  locked_by_user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  CONSTRAINT research_documents_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_documents_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_documents(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_documents_lock_pair CHECK ((locked_at IS NULL) = (locked_by_user_id IS NULL)),
  UNIQUE (workspace_id, project_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_human_gates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  gate_type text NOT NULL CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE')),
  artifact_type text NOT NULL,
  artifact_version_id text NOT NULL,
  approved_content_hash text NOT NULL CHECK (approved_content_hash ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'REVOKED')),
  approver_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL,
  rationale text,
  CONSTRAINT research_human_gates_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_workflow_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  stage_detail text,
  lifecycle_contract_version text NOT NULL DEFAULT '1.5.3',
  artifact_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  human_gate_id text,
  event_hash text NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT research_workflow_events_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_workflow_events_gate_fk FOREIGN KEY (workspace_id, project_id, human_gate_id) REFERENCES research_human_gates(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_workflow_events_stage_check CHECK (from_stage ~ '^S[0-9](_[A-Z0-9_]+)?$' AND to_stage ~ '^S[0-9](_[A-Z0-9_]+)?$')
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['research_studies','research_datasets','research_analysis_plans','research_analysis_runs','research_evidence_sources','research_claims','research_claim_evidence','research_documents','research_human_gates','research_workflow_events'] LOOP
    EXECUTE format('CREATE TRIGGER %I_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION research_append_only_guard()', table_name, table_name);
  END LOOP;
END $$;

CREATE INDEX research_studies_tenant_idx ON research_studies(workspace_id, project_id, logical_id, version_number DESC);
CREATE INDEX research_datasets_tenant_idx ON research_datasets(workspace_id, project_id, registered_at DESC);
CREATE INDEX research_analysis_plans_tenant_idx ON research_analysis_plans(workspace_id, project_id, logical_id, version_number DESC);
CREATE INDEX research_analysis_runs_tenant_idx ON research_analysis_runs(workspace_id, project_id, created_at DESC);
CREATE INDEX research_evidence_sources_tenant_idx ON research_evidence_sources(workspace_id, project_id, retrieved_at DESC);
CREATE INDEX research_claims_tenant_idx ON research_claims(workspace_id, project_id, logical_id, version_number DESC);
CREATE INDEX research_documents_tenant_idx ON research_documents(workspace_id, project_id, logical_id, version_number DESC);
CREATE INDEX research_human_gates_tenant_idx ON research_human_gates(workspace_id, project_id, artifact_version_id, approved_at DESC);
CREATE INDEX research_workflow_events_tenant_idx ON research_workflow_events(workspace_id, project_id, created_at ASC);

COMMIT;
