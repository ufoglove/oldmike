-- 0013: Research Blueprint — structured master plan with versioning, evidence links, gate
BEGIN;

-- 0. 擴充 human gate 類型以支援研究藍圖核准
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE'));

-- 1. research_blueprints — 每 research_project 一筆
CREATE TABLE research_blueprints (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'EVIDENCE_INCOMPLETE', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED')),
  primary_route text CHECK (primary_route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE', 'GENERAL')),
  secondary_publication_route text CHECK (secondary_publication_route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE')),
  current_version_number integer NOT NULL DEFAULT 0,
  evidence_readiness text NOT NULL DEFAULT 'UNVERIFIED' CHECK (evidence_readiness IN ('SUPPORTED', 'PARTIALLY_SUPPORTED', 'MISSING', 'CONFLICTING', 'UNVERIFIED')),
  section_state jsonb NOT NULL DEFAULT '{}',
  gate_state jsonb NOT NULL DEFAULT '{}',
  source_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprints_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_blueprints_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. research_blueprint_versions — append-only 全量快照
CREATE TABLE research_blueprint_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_versions_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  CONSTRAINT research_blueprint_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_blueprint_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, blueprint_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER research_blueprint_versions_append_only
  BEFORE UPDATE OR DELETE ON research_blueprint_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. research_blueprint_objectives
CREATE TABLE research_blueprint_objectives (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  objective_key text NOT NULL,
  title text NOT NULL,
  description text,
  rq_keys jsonb NOT NULL DEFAULT '[]',
  workpackage_keys jsonb NOT NULL DEFAULT '[]',
  evidence_link_ids jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'PROVISIONAL', 'CONFIRMED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_objectives_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, objective_key)
);

-- 4. research_blueprint_questions
CREATE TABLE research_blueprint_questions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  rq_key text NOT NULL,
  question text NOT NULL,
  objective_key text,
  gap_key text,
  expected_data text,
  proposed_analysis text,
  status text NOT NULL DEFAULT 'PROVISIONAL' CHECK (status IN ('PROVISIONAL', 'CONFIRMED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_questions_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, rq_key)
);

-- 5. research_blueprint_hypotheses
CREATE TABLE research_blueprint_hypotheses (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  hypothesis_key text NOT NULL,
  statement text,
  status text NOT NULL DEFAULT 'PROVISIONAL' CHECK (status IN ('PROVISIONAL', 'CONFIRMED', 'NOT_APPLICABLE')),
  rq_key text,
  theory_ref text,
  variables jsonb NOT NULL DEFAULT '[]',
  expected_direction text,
  supporting_literature jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_hypotheses_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, hypothesis_key)
);

-- 6. research_blueprint_variables
CREATE TABLE research_blueprint_variables (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  variable_key text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('IV', 'DV', 'MEDIATOR', 'MODERATOR', 'CONTROL', 'CONSTRUCT')),
  operational_definition_status text NOT NULL DEFAULT 'MISSING' CHECK (operational_definition_status IN ('DEFINED', 'PARTIAL', 'MISSING')),
  related_rq_keys jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_variables_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, variable_key)
);

-- 7. research_blueprint_workpackages
CREATE TABLE research_blueprint_workpackages (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  wp_key text NOT NULL,
  year integer,
  title text NOT NULL,
  objective_key text,
  method_direction text,
  milestone_keys jsonb NOT NULL DEFAULT '[]',
  dependency jsonb NOT NULL DEFAULT '[]',
  risk_keys jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_workpackages_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, wp_key)
);

-- 8. research_blueprint_milestones
CREATE TABLE research_blueprint_milestones (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  milestone_key text NOT NULL,
  title text NOT NULL,
  due_year integer,
  due_quarter integer CHECK (due_quarter BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'PROVISIONAL', 'ACHIEVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_milestones_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, milestone_key)
);

-- 9. research_blueprint_outputs
CREATE TABLE research_blueprint_outputs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  output_key text NOT NULL,
  route text NOT NULL CHECK (route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE', 'GENERAL')),
  type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'PROVISIONAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_outputs_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, output_key)
);

-- 10. research_blueprint_risks
CREATE TABLE research_blueprint_risks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  risk_key text NOT NULL,
  risk_type text NOT NULL CHECK (risk_type IN ('LITERATURE', 'NOVELTY', 'SAMPLE', 'METHOD', 'DATA', 'ETHICS', 'TECHNOLOGY', 'TIMELINE', 'SUBMISSION')),
  risk_level text NOT NULL DEFAULT 'UNVERIFIED' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'UNVERIFIED')),
  reason text,
  mitigation text,
  owner text,
  status text NOT NULL DEFAULT 'PROVISIONAL' CHECK (status IN ('PROVISIONAL', 'CONFIRMED', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_risks_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  UNIQUE (blueprint_id, risk_key)
);

-- 11. research_blueprint_evidence_links — 藍圖 ↔ 文獻/引用 連結
CREATE TABLE research_blueprint_evidence_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  evidence_link_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('GAP', 'THEORY', 'METHOD', 'MEASUREMENT', 'SIMILAR_STUDY', 'CONTRIBUTION', 'PROBLEM_IMPORTANCE', 'TEACHING_PROBLEM')),
  target_ref text,
  literature_id text,
  citation_source_id text,
  zotero_item_key text,
  supported_section text,
  supported_claim text,
  citation_status text NOT NULL DEFAULT 'PLANNED' CHECK (citation_status IN ('PLANNED', 'CITED', 'VERIFIED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_blueprint_evidence_links_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES research_blueprints(id) ON DELETE CASCADE,
  CONSTRAINT research_blueprint_evidence_links_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX research_blueprints_project_idx ON research_blueprints(workspace_id, project_id);
CREATE INDEX research_blueprint_versions_blueprint_idx ON research_blueprint_versions(workspace_id, project_id, blueprint_id);
CREATE INDEX research_blueprint_evidence_links_blueprint_idx ON research_blueprint_evidence_links(workspace_id, project_id, blueprint_id);

COMMIT;
