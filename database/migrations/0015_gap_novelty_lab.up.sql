-- 0015: Gap & Novelty Lab — validated gap claims, search tasks/snapshots, closest studies, contribution delta, novelty/saturation, gate
BEGIN;

-- 0. 擴充 blueprint status：高度重複時要求重新考慮題目
ALTER TABLE research_blueprints DROP CONSTRAINT research_blueprints_status_check;
ALTER TABLE research_blueprints ADD CONSTRAINT research_blueprints_status_check
  CHECK (status IN ('DRAFT', 'EVIDENCE_INCOMPLETE', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED', 'TOPIC_RECONSIDERATION_REQUIRED'));

-- 0b. 擴充 human gate 類型
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE'));

-- 1. gap_novelty_analyses — 每 research_project 一筆
CREATE TABLE gap_novelty_analyses (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  source_blueprint_version integer NOT NULL,
  blueprint_version_id text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SEARCH_PLANNED', 'SEARCH_IN_PROGRESS', 'EVIDENCE_INCOMPLETE', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'VALIDATED', 'OUTDATED', 'REVALIDATION_REQUIRED')),
  primary_route text CHECK (primary_route IN ('JOURNAL', 'NSTC', 'MOE_TEACHING_PRACTICE', 'GENERAL')),
  novelty_confidence text NOT NULL DEFAULT 'UNVERIFIED' CHECK (novelty_confidence IN ('HIGH', 'MODERATE', 'LOW', 'UNVERIFIED')),
  duplication_risk text NOT NULL DEFAULT 'UNVERIFIED' CHECK (duplication_risk IN ('NONE', 'LOW', 'MEDIUM', 'HIGH_DUPLICATION_RISK', 'UNVERIFIED')),
  saturation_status text NOT NULL DEFAULT 'INSUFFICIENT_DATA' CHECK (saturation_status IN ('LOW_SATURATION', 'EMERGING', 'GROWING', 'MATURE', 'HIGHLY_SATURATED', 'INSUFFICIENT_DATA')),
  novelty_score integer CHECK (novelty_score BETWEEN 0 AND 100),
  current_version_number integer NOT NULL DEFAULT 0,
  last_search_at timestamptz,
  zotero_sync_status text NOT NULL DEFAULT 'NOT_LINKED',
  source_hash text,
  section_state jsonb NOT NULL DEFAULT '{}',
  gate_state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_novelty_analyses_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT gap_novelty_analyses_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. gap_novelty_versions — append-only 快照
CREATE TABLE gap_novelty_versions (
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
  CONSTRAINT gap_novelty_versions_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  CONSTRAINT gap_novelty_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES gap_novelty_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, analysis_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER gap_novelty_versions_append_only
  BEFORE UPDATE OR DELETE ON gap_novelty_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. gap_claims — 正式 Gap Claim（15 類 taxonomy）
CREATE TABLE gap_claims (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  gap_id text NOT NULL,
  gap_type text NOT NULL CHECK (gap_type IN ('THEORETICAL_GAP', 'EMPIRICAL_GAP', 'METHODOLOGICAL_GAP', 'POPULATION_GAP', 'CONTEXT_GAP', 'TECHNOLOGY_GAP', 'DATA_GAP', 'TEMPORAL_GAP', 'MEASUREMENT_GAP', 'IMPLEMENTATION_GAP', 'HUMAN_AI_GAP', 'REPLICATION_GAP', 'POLICY_PRACTICE_GAP', 'TEACHING_PRACTICE_GAP', 'CROSS_DOMAIN_GAP')),
  claim text NOT NULL,
  scope text,
  population text,
  context text,
  time_boundary text,
  evidence_strength text CHECK (evidence_strength IN ('STRONG', 'MODERATE', 'WEAK', 'UNVERIFIED')),
  validation_status text NOT NULL DEFAULT 'PROPOSED' CHECK (validation_status IN ('PROPOSED', 'PARTIALLY_SUPPORTED', 'SUPPORTED', 'CONFLICTING', 'NOT_SUPPORTED', 'UNVERIFIED')),
  reviewer_notes text,
  user_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_claims_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, gap_id)
);

-- 4. gap_evidence_links — Gap ↔ 文獻/引用（僅 ID 關聯）
CREATE TABLE gap_evidence_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  gap_id text NOT NULL,
  literature_id text,
  citation_source_id text,
  zotero_item_key text,
  source_location text,
  reading_status text NOT NULL DEFAULT 'ABSTRACT_REVIEWED' CHECK (reading_status IN ('ABSTRACT_REVIEWED', 'FULLTEXT_REVIEWED')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED')),
  supported_claim text,
  usable_for_introduction boolean NOT NULL DEFAULT false,
  usable_for_theory boolean NOT NULL DEFAULT false,
  usable_for_methods boolean NOT NULL DEFAULT false,
  usable_for_discussion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_evidence_links_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  CONSTRAINT gap_evidence_links_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE SET NULL
);

-- 5. literature_search_tasks
CREATE TABLE literature_search_tasks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  task_id text NOT NULL,
  research_question_ids jsonb NOT NULL DEFAULT '[]',
  gap_type text,
  search_purpose text,
  keyword_groups jsonb NOT NULL DEFAULT '[]',
  synonyms jsonb NOT NULL DEFAULT '[]',
  boolean_query text,
  databases jsonb NOT NULL DEFAULT '[]',
  year_range text,
  inclusion_criteria text,
  exclusion_criteria text,
  search_status text NOT NULL DEFAULT 'PLANNED' CHECK (search_status IN ('PLANNED', 'RUNNING', 'COMPLETED', 'UNAVAILABLE', 'PENDING_CONNECTION')),
  last_run_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  screened_count integer NOT NULL DEFAULT 0,
  included_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT literature_search_tasks_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, task_id)
);

-- 6. search_snapshots — 可重現
CREATE TABLE search_snapshots (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  task_id text NOT NULL,
  database_or_source text NOT NULL,
  exact_query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  date_searched timestamptz NOT NULL DEFAULT now(),
  result_count integer NOT NULL DEFAULT 0,
  screening_status text NOT NULL DEFAULT 'NOT_SCREENED',
  included_literature_ids jsonb NOT NULL DEFAULT '[]',
  excluded_literature_ids jsonb NOT NULL DEFAULT '[]',
  exclusion_reasons jsonb NOT NULL DEFAULT '{}',
  performed_by text NOT NULL,
  search_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_snapshots_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE
);

-- 7. closest_studies — 最相近研究（僅 ID 關聯 literature_items）
CREATE TABLE closest_studies (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  literature_id text NOT NULL,
  similarity_profile jsonb NOT NULL DEFAULT '{}',
  overall_similarity integer CHECK (overall_similarity BETWEEN 0 AND 100),
  duplication_risk text NOT NULL DEFAULT 'NONE' CHECK (duplication_risk IN ('NONE', 'LOW', 'MEDIUM', 'HIGH_DUPLICATION_RISK')),
  fulltext_status text NOT NULL DEFAULT 'ABSTRACT_REVIEWED' CHECK (fulltext_status IN ('ABSTRACT_REVIEWED', 'FULLTEXT_REVIEWED')),
  zotero_status text NOT NULL DEFAULT 'NOT_LINKED',
  comparison_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closest_studies_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  CONSTRAINT closest_studies_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE CASCADE,
  UNIQUE (analysis_id, literature_id)
);

-- 8. contribution_deltas
CREATE TABLE contribution_deltas (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  closest_study_id text NOT NULL,
  delta_type text NOT NULL CHECK (delta_type IN ('PROBLEM', 'THEORY', 'MECHANISM', 'METHOD', 'DATA', 'POPULATION', 'CONTEXT', 'TECHNOLOGY', 'TEMPORAL', 'OUTCOME', 'IMPLEMENTATION')),
  delta_description text NOT NULL,
  evidence_link_id text,
  direction text NOT NULL DEFAULT 'ADD' CHECK (direction IN ('ADD', 'DIFFER', 'EXTEND')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contribution_deltas_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  CONSTRAINT contribution_deltas_study_fk FOREIGN KEY (closest_study_id) REFERENCES closest_studies(id) ON DELETE CASCADE
);

-- 9. novelty_profiles
CREATE TABLE novelty_profiles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  dimension_states jsonb NOT NULL DEFAULT '{}',
  confidence text NOT NULL DEFAULT 'UNVERIFIED' CHECK (confidence IN ('HIGH', 'MODERATE', 'LOW', 'UNVERIFIED')),
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT novelty_profiles_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id)
);

-- 10. saturation_assessments
CREATE TABLE saturation_assessments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('LOW_SATURATION', 'EMERGING', 'GROWING', 'MATURE', 'HIGHLY_SATURATED', 'INSUFFICIENT_DATA')),
  analysis_payload jsonb NOT NULL DEFAULT '{}',
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saturation_assessments_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE,
  UNIQUE (analysis_id)
);

-- 11. gap_validation_decisions — Gate 決策
CREATE TABLE gap_validation_decisions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  analysis_id text NOT NULL,
  analysis_version_id text,
  checks jsonb NOT NULL DEFAULT '[]',
  decision text NOT NULL CHECK (decision IN ('VALIDATED', 'REVISION_REQUIRED', 'REJECTED')),
  blueprint_v2_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_validation_decisions_analysis_fk FOREIGN KEY (analysis_id) REFERENCES gap_novelty_analyses(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX gap_novelty_analyses_project_idx ON gap_novelty_analyses(workspace_id, project_id);
CREATE INDEX gap_claims_analysis_idx ON gap_claims(workspace_id, project_id, analysis_id);
CREATE INDEX literature_search_tasks_analysis_idx ON literature_search_tasks(workspace_id, project_id, analysis_id);
CREATE INDEX search_snapshots_task_idx ON search_snapshots(workspace_id, project_id, task_id);
CREATE INDEX closest_studies_analysis_idx ON closest_studies(workspace_id, project_id, analysis_id);

COMMIT;
