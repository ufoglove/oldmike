-- 0016: Theory & Mechanism Lab — candidate pool, mechanism model, construct dictionary, hypotheses/propositions, competing explanations, boundary conditions, conceptual model, alignment, gate
BEGIN;

-- 0. 擴充 human gate 類型（理論與機制鎖定 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE'));

-- 1. theory_mechanism_analyses — 每 research_project 一筆
CREATE TABLE theory_mechanism_analyses (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  source_blueprint_version integer NOT NULL,
  source_blueprint_version_id text,
  source_gap_analysis_id text,
  status text NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'DRAFT', 'THEORY_SEARCH_REQUIRED', 'EVIDENCE_INCOMPLETE', 'MODEL_IN_PROGRESS', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED')),
  primary_route text CHECK (primary_route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE', 'GENERAL')),
  selection_mode text CHECK (selection_mode IN ('FORMAL_THEORY', 'CONCEPTUAL_FRAMEWORK_ONLY')),
  current_version_number integer NOT NULL DEFAULT 0,
  source_hash text,
  section_state jsonb NOT NULL DEFAULT '{}',
  gate_state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theory_mechanism_analyses_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT theory_mechanism_analyses_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. theory_mechanism_versions — append-only 快照
CREATE TABLE theory_mechanism_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theory_mechanism_versions_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  CONSTRAINT theory_mechanism_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES theory_mechanism_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, analysis_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER theory_mechanism_versions_append_only
  BEFORE UPDATE OR DELETE ON theory_mechanism_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. theory_candidates — 候選理論池
CREATE TABLE theory_candidates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  theory_key text NOT NULL,
  theory_name text NOT NULL,
  theory_type text,
  original_domain text,
  core_constructs jsonb NOT NULL DEFAULT '[]',
  explanatory_mechanism text,
  related_rq_keys jsonb NOT NULL DEFAULT '[]',
  related_gap_ids jsonb NOT NULL DEFAULT '[]',
  fit_breakdown jsonb NOT NULL DEFAULT '{}',
  fit_score integer CHECK (fit_score BETWEEN 0 AND 100),
  fit_rationale text,
  selection_status text NOT NULL DEFAULT 'CANDIDATE' CHECK (selection_status IN ('CANDIDATE', 'CORE', 'SUPPORTING', 'COMPETING', 'REJECTED', 'INSUFFICIENT_EVIDENCE')),
  selection_reason text,
  limitations text,
  route_fit text,
  fulltext_evidence_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (fulltext_evidence_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED', 'INSUFFICIENT_EVIDENCE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theory_candidates_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, theory_key)
);

-- 4. theory_evidence_links — 理論/構念/機制/假設 ↔ 既有文獻（僅 ID 關聯，不複製文獻）
CREATE TABLE theory_evidence_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('THEORY', 'CONSTRUCT', 'MECHANISM', 'HYPOTHESIS', 'COMPETING')),
  target_ref text NOT NULL,
  literature_id text,
  citation_source_id text,
  zotero_item_key text,
  source_location text,
  reading_status text NOT NULL DEFAULT 'ABSTRACT_REVIEWED' CHECK (reading_status IN ('ABSTRACT_REVIEWED', 'FULLTEXT_REVIEWED')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theory_evidence_links_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  CONSTRAINT theory_evidence_links_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE SET NULL
);

-- 5. mechanism_paths — 作用機制鏈
CREATE TABLE mechanism_paths (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  path_id text NOT NULL,
  source_construct text NOT NULL,
  target_construct text NOT NULL,
  relationship_type text,
  expected_direction text NOT NULL DEFAULT 'POSITIVE' CHECK (expected_direction IN ('POSITIVE', 'NEGATIVE', 'UNSPECIFIED')),
  mechanism_explanation text,
  theory_key text,
  related_rq_key text,
  supporting_evidence jsonb NOT NULL DEFAULT '[]',
  conflicting_evidence jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONFLICTING', 'INSUFFICIENT_EVIDENCE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mechanism_paths_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, path_id)
);

-- 6. research_constructs — 構念字典
CREATE TABLE research_constructs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  construct_id text NOT NULL,
  canonical_name text NOT NULL,
  chinese_name text,
  english_name text,
  conceptual_definition text,
  role text NOT NULL DEFAULT 'PROCESS_VARIABLE' CHECK (role IN ('INDEPENDENT_VARIABLE', 'DEPENDENT_VARIABLE', 'MEDIATOR', 'MODERATOR', 'CONTROL', 'CONTEXTUAL_FACTOR', 'PROCESS_VARIABLE', 'TECHNICAL_VARIABLE', 'LEARNING_OUTCOME')),
  theory_source text,
  unit_of_analysis text,
  temporal_position text,
  related_rq_key text,
  related_hypothesis_key text,
  operationalization_status text NOT NULL DEFAULT 'MISSING' CHECK (operationalization_status IN ('DEFINED', 'PARTIAL', 'MISSING', 'NOT_APPLICABLE')),
  measurement_status text NOT NULL DEFAULT 'NOT_SPECIFIED' CHECK (measurement_status IN ('NOT_SPECIFIED', 'PROVISIONAL_DIRECTION', 'LOCKED')),
  definition_conflict boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_constructs_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, construct_id)
);

-- 7. formal_hypotheses — 假設／命題（確認性 vs 探索性）
CREATE TABLE formal_hypotheses (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  hypothesis_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('HYPOTHESIS', 'PROPOSITION')),
  statement text NOT NULL,
  rq_key text,
  objective_key text,
  source_construct text,
  target_construct text,
  expected_direction text NOT NULL DEFAULT 'POSITIVE' CHECK (expected_direction IN ('POSITIVE', 'NEGATIVE', 'UNSPECIFIED')),
  core_theory_key text,
  mechanism_path_id text,
  supporting_literature jsonb NOT NULL DEFAULT '[]',
  conflicting_evidence jsonb NOT NULL DEFAULT '[]',
  planned_test_status text NOT NULL DEFAULT 'PLANNED' CHECK (planned_test_status IN ('PLANNED', 'PROVISIONAL', 'NOT_APPLICABLE')),
  hypothesis_not_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formal_hypotheses_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, hypothesis_key)
);

-- 8. competing_explanations
CREATE TABLE competing_explanations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  explanation_key text NOT NULL,
  explanation text NOT NULL,
  related_outcome text,
  supporting_basis text,
  control_strategy_direction text,
  unresolved_status text NOT NULL DEFAULT 'UNRESOLVED' CHECK (unresolved_status IN ('RESOLVED', 'PARTIALLY_RESOLVED', 'UNRESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competing_explanations_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, explanation_key)
);

-- 9. boundary_conditions
CREATE TABLE boundary_conditions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  boundary_key text NOT NULL,
  condition_type text,
  condition_statement text NOT NULL,
  implication text,
  related_construct_keys jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boundary_conditions_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, boundary_key)
);

-- 10. conceptual_models — 可版本化的概念模型（nodes/edges JSON）
CREATE TABLE conceptual_models (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  model_version text NOT NULL,
  model_label text NOT NULL DEFAULT 'Conceptual Model',
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  feedback_loops jsonb NOT NULL DEFAULT '[]',
  group_differences jsonb NOT NULL DEFAULT '[]',
  time_points jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conceptual_models_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, model_version)
);

-- 11. theory_mechanism_gates — 鎖定 Gate 決策
CREATE TABLE theory_mechanism_gates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  analysis_version_id text,
  checks jsonb NOT NULL DEFAULT '[]',
  decision text NOT NULL CHECK (decision IN ('LOCKED', 'REVISION_REQUIRED')),
  human_gate_id text,
  blueprint_v2_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theory_mechanism_gates_analysis_fk FOREIGN KEY (analysis_id) REFERENCES theory_mechanism_analyses(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX theory_mechanism_analyses_project_idx ON theory_mechanism_analyses(workspace_id, project_id);
CREATE INDEX theory_candidates_analysis_idx ON theory_candidates(workspace_id, project_id, analysis_id);
CREATE INDEX theory_evidence_links_analysis_idx ON theory_evidence_links(workspace_id, project_id, analysis_id);
CREATE INDEX mechanism_paths_analysis_idx ON mechanism_paths(workspace_id, project_id, analysis_id);
CREATE INDEX research_constructs_analysis_idx ON research_constructs(workspace_id, project_id, analysis_id);
CREATE INDEX formal_hypotheses_analysis_idx ON formal_hypotheses(workspace_id, project_id, analysis_id);
CREATE INDEX competing_explanations_analysis_idx ON competing_explanations(workspace_id, project_id, analysis_id);
CREATE INDEX boundary_conditions_analysis_idx ON boundary_conditions(workspace_id, project_id, analysis_id);
CREATE INDEX conceptual_models_analysis_idx ON conceptual_models(workspace_id, project_id, analysis_id);

COMMIT;
