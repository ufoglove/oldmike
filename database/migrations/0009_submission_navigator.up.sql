-- 0009: Submission Navigator structured records
-- SubmissionNavigatorRun -> JournalCandidate / FundingRoute / ComplianceItem / EvidenceItem
-- plus topic_versions (original / nstc_v1 / moe_tpr_v1 / journal_v1) and submission_projects.
-- All tables are append-only and tenant-scoped, mirroring research_* conventions.

BEGIN;

CREATE TABLE submission_navigator_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  run_type text NOT NULL CHECK (run_type IN ('QUICK', 'DEEP')),
  target_year text NOT NULL CHECK (target_year ~ '^[0-9]{4}$'),
  target_mode text NOT NULL CHECK (target_mode IN ('auto', 'journal', 'nstc', 'moe_tpr', 'compare_all')),
  source_run_id text,
  source_study_version_id text,
  topic_snapshot jsonb NOT NULL,
  researcher_snapshot jsonb NOT NULL DEFAULT '{}',
  fit_summary jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED')),
  idempotency_key text NOT NULL,
  CONSTRAINT submission_navigator_runs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, idempotency_key),
  UNIQUE (workspace_id, project_id, id)
);

CREATE TABLE submission_journal_candidates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  journal_name text NOT NULL,
  publisher text,
  fit_score integer CHECK (fit_score BETWEEN 0 AND 100),
  desk_reject_risk text,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_journal_candidates_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_journal_candidates_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, journal_name)
);

CREATE TABLE submission_funding_routes (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  route_type text NOT NULL CHECK (route_type IN ('NSTC', 'MOE_TPR')),
  route_name text NOT NULL,
  fit_score integer CHECK (fit_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'PROPOSED',
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_funding_routes_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_funding_routes_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, route_type, route_name)
);

CREATE TABLE submission_compliance_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  route text NOT NULL,
  requirement_id text NOT NULL,
  requirement text NOT NULL,
  status text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('fatal', 'major', 'minor')),
  official_source text,
  missing_item text,
  required_action text,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_compliance_items_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_compliance_items_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT
);

CREATE TABLE submission_evidence_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  route text NOT NULL,
  evidence_id text NOT NULL,
  source_type text,
  title text,
  authority text,
  doi text,
  url text,
  retrieved_at timestamptz,
  verified_at timestamptz,
  used_for text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_evidence_items_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_evidence_items_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT
);

CREATE TABLE topic_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  version_key text NOT NULL CHECK (version_key IN ('ORIGINAL', 'NSTC_V1', 'MOE_TPR_V1', 'JOURNAL_V1')),
  title_zh text NOT NULL,
  title_en text,
  gap text,
  contribution text,
  method text,
  outcomes jsonb NOT NULL DEFAULT '[]',
  abstract text,
  keywords jsonb NOT NULL DEFAULT '[]',
  snapshot jsonb NOT NULL DEFAULT '{}',
  supersedes_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_versions_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT topic_versions_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT topic_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES topic_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, version_key)
);

CREATE TABLE submission_projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('NSTC', 'MOE_TEACHING_PRACTICE', 'JOURNAL_MANUSCRIPT')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_projects_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_projects_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, project_type)
);

CREATE TRIGGER submission_navigator_runs_append_only
  BEFORE UPDATE OR DELETE ON submission_navigator_runs
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_journal_candidates_append_only
  BEFORE UPDATE OR DELETE ON submission_journal_candidates
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_funding_routes_append_only
  BEFORE UPDATE OR DELETE ON submission_funding_routes
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_compliance_items_append_only
  BEFORE UPDATE OR DELETE ON submission_compliance_items
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_evidence_items_append_only
  BEFORE UPDATE OR DELETE ON submission_evidence_items
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER topic_versions_append_only
  BEFORE UPDATE OR DELETE ON topic_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_projects_append_only
  BEFORE UPDATE OR DELETE ON submission_projects
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

CREATE INDEX submission_navigator_runs_tenant_idx
  ON submission_navigator_runs(workspace_id, project_id, created_at DESC);
CREATE INDEX submission_journal_candidates_run_idx
  ON submission_journal_candidates(workspace_id, project_id, run_id);
CREATE INDEX submission_funding_routes_run_idx
  ON submission_funding_routes(workspace_id, project_id, run_id);
CREATE INDEX submission_compliance_items_run_idx
  ON submission_compliance_items(workspace_id, project_id, run_id);
CREATE INDEX submission_evidence_items_run_idx
  ON submission_evidence_items(workspace_id, project_id, run_id);
CREATE INDEX topic_versions_run_idx
  ON topic_versions(workspace_id, project_id, run_id);
CREATE INDEX submission_projects_run_idx
  ON submission_projects(workspace_id, project_id, run_id);

COMMIT;
