-- 0017: Research Design Lab & Analysis Planning — design candidates, sampling/power, measurement requirements, RQ-Data-Analysis matrix, analysis plan (planning mode), validity/bias register, alignment, gate, blueprint v3 writeback
BEGIN;

-- 0. 擴充 human gate 類型（研究設計與分析計畫鎖定 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE'));

-- 1. research_design_analyses — 每 research_project 一筆
CREATE TABLE research_design_analyses (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  source_blueprint_version integer NOT NULL,
  source_blueprint_version_id text,
  source_theory_analysis_id text,
  status text NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'DRAFT', 'DESIGN_SEARCH_REQUIRED', 'EVIDENCE_INCOMPLETE', 'MODEL_IN_PROGRESS', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED')),
  primary_route text CHECK (primary_route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE', 'GENERAL')),
  selected_design_key text,
  current_version_number integer NOT NULL DEFAULT 0,
  source_hash text,
  section_state jsonb NOT NULL DEFAULT '{}',
  gate_state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_design_analyses_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_design_analyses_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. research_design_versions — append-only 快照
CREATE TABLE research_design_versions (
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
  CONSTRAINT research_design_versions_analysis_fk FOREIGN KEY (analysis_id) REFERENCES research_design_analyses(id) ON DELETE CASCADE,
  CONSTRAINT research_design_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES research_design_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, analysis_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER research_design_versions_append_only
  BEFORE UPDATE OR DELETE ON research_design_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. design_candidates — 研究設計候選方案池
CREATE TABLE design_candidates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  design_key text NOT NULL,
  design_name text NOT NULL,
  design_type text,
  answers_rq_keys jsonb NOT NULL DEFAULT '[]',
  cannot_answer_rq_keys jsonb NOT NULL DEFAULT '[]',
  causal_inference_capability text,
  sample_and_site_requirements text,
  required_time text,
  execution_difficulty text,
  ethics_risks text,
  data_requirements text,
  method_strengths jsonb NOT NULL DEFAULT '[]',
  method_limitations jsonb NOT NULL DEFAULT '[]',
  route_fit text,
  method_evidence_count integer NOT NULL DEFAULT 0,
  fit_breakdown jsonb NOT NULL DEFAULT '{}',
  fit_score integer CHECK (fit_score BETWEEN 0 AND 100),
  fit_rationale text,
  selection_status text NOT NULL DEFAULT 'CANDIDATE' CHECK (selection_status IN ('CANDIDATE', 'RECOMMENDED', 'ALTERNATIVE', 'NOT_RECOMMENDED', 'SELECTED', 'REJECTED')),
  selection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_candidates_analysis_fk FOREIGN KEY (analysis_id) REFERENCES research_design_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, design_key)
);

-- 4. design_evidence_links — 設計/樣本/測量/分析 ↔ 既有文獻（僅 ID 關聯）
CREATE TABLE design_evidence_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('DESIGN', 'SAMPLING', 'POWER', 'MEASUREMENT', 'ANALYSIS', 'EFFECT_SIZE')),
  target_ref text NOT NULL,
  literature_id text,
  citation_source_id text,
  zotero_item_key text,
  source_location text,
  reading_status text NOT NULL DEFAULT 'ABSTRACT_REVIEWED' CHECK (reading_status IN ('ABSTRACT_REVIEWED', 'FULLTEXT_REVIEWED')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_evidence_links_analysis_fk FOREIGN KEY (analysis_id) REFERENCES research_design_analyses(id) ON DELETE CASCADE,
  CONSTRAINT design_evidence_links_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE SET NULL
);

-- 5. research_design_gates — 鎖定 Gate 決策
CREATE TABLE research_design_gates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  analysis_version_id text,
  checks jsonb NOT NULL DEFAULT '[]',
  decision text NOT NULL CHECK (decision IN ('LOCKED', 'REVISION_REQUIRED')),
  human_gate_id text,
  blueprint_v3_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_design_gates_analysis_fk FOREIGN KEY (analysis_id) REFERENCES research_design_analyses(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX research_design_analyses_project_idx ON research_design_analyses(workspace_id, project_id);
CREATE INDEX design_candidates_analysis_idx ON design_candidates(workspace_id, project_id, analysis_id);
CREATE INDEX design_evidence_links_analysis_idx ON design_evidence_links(workspace_id, project_id, analysis_id);

COMMIT;
