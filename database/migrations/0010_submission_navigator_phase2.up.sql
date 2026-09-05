-- 0010: Submission Navigator Phase 2 — official rule snapshots, journal deep details, journal marks
BEGIN;

CREATE TABLE submission_rule_snapshots (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('journal', 'nstc', 'moe_tpr', 'institution')),
  target_year text NOT NULL,
  document_title text NOT NULL,
  source_url text,
  source_type text,
  verification_status text NOT NULL DEFAULT 'unverified',
  applicable_requirement text,
  effective_date timestamptz,
  retrieved_at timestamptz,
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_rule_snapshots_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_rule_snapshots_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, authority, target_year, document_title)
);

CREATE TABLE submission_journal_details (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  journal_name text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  verification_status text NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_journal_details_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_journal_details_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, journal_name)
);

CREATE TABLE submission_journal_marks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  run_id text NOT NULL,
  journal_name text NOT NULL,
  mark_type text NOT NULL CHECK (mark_type IN ('CANDIDATE', 'TARGET', 'COMPARE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_journal_marks_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT submission_journal_marks_run_fk FOREIGN KEY (workspace_id, project_id, run_id) REFERENCES submission_navigator_runs(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, run_id, journal_name, mark_type)
);

CREATE TRIGGER submission_rule_snapshots_append_only
  BEFORE UPDATE OR DELETE ON submission_rule_snapshots
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_journal_details_append_only
  BEFORE UPDATE OR DELETE ON submission_journal_details
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER submission_journal_marks_append_only
  BEFORE UPDATE OR DELETE ON submission_journal_marks
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

CREATE INDEX submission_rule_snapshots_run_idx ON submission_rule_snapshots(workspace_id, project_id, run_id);
CREATE INDEX submission_journal_details_run_idx ON submission_journal_details(workspace_id, project_id, run_id);
CREATE INDEX submission_journal_marks_run_idx ON submission_journal_marks(workspace_id, project_id, run_id);

COMMIT;
