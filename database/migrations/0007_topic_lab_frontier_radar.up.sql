BEGIN;

ALTER TABLE research_human_gates
  DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates
  ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION'));

CREATE TABLE research_topic_lab_runs (
  id text PRIMARY KEY,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result_hash text NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  scoring_version text NOT NULL,
  source_policy text NOT NULL CHECK (source_policy IN ('NO_EXTERNAL_SOURCE', 'CONTROLLED_PUBLIC_HTTPS')),
  evidence_status text NOT NULL CHECK (evidence_status IN ('UNVERIFIED', 'INSUFFICIENT_EVIDENCE')),
  idempotency_key text NOT NULL,
  request_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  source_provenance jsonb NOT NULL,
  CONSTRAINT research_topic_lab_runs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_topic_lab_runs_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_topic_lab_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, idempotency_key),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE research_topic_lab_promotions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  candidate_id text NOT NULL,
  candidate_hash text NOT NULL CHECK (candidate_hash ~ '^[0-9a-f]{64}$'),
  human_gate_id text NOT NULL,
  study_version_id text NOT NULL,
  idempotency_key text NOT NULL,
  CONSTRAINT research_topic_lab_promotions_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_topic_lab_promotions_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES research_topic_lab_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_topic_lab_promotions_gate_fk FOREIGN KEY (workspace_id, project_id, human_gate_id) REFERENCES research_human_gates(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_topic_lab_promotions_study_fk FOREIGN KEY (workspace_id, project_id, study_version_id) REFERENCES research_studies(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, candidate_id),
  UNIQUE (workspace_id, project_id, idempotency_key),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TRIGGER research_topic_lab_runs_append_only
BEFORE UPDATE OR DELETE ON research_topic_lab_runs
FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

CREATE TRIGGER research_topic_lab_promotions_append_only
BEFORE UPDATE OR DELETE ON research_topic_lab_promotions
FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

CREATE INDEX research_topic_lab_runs_tenant_idx
  ON research_topic_lab_runs(workspace_id, project_id, logical_id, version_number DESC);
CREATE INDEX research_topic_lab_promotions_tenant_idx
  ON research_topic_lab_promotions(workspace_id, project_id, created_at DESC);

COMMIT;
