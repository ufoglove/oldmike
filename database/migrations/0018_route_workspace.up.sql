-- 0018: Route Workspace — 三路線研究與計畫工作室（Phase 6）
-- 國際期刊研究規劃／國科會計畫書／教學實踐計畫書＋共用 Section Writing Workspace
-- 所有表皆 tenant-scoped（workspace_id, project_id）＋ append-only 版本化
BEGIN;

-- 0. 擴充 human gate 類型
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE'));

-- 1. route_workspaces — 每 research_project＋route 一筆（PRIMARY/SECONDARY）
CREATE TABLE route_workspaces (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('JOURNAL_PLANNING', 'NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  workspace_role text NOT NULL DEFAULT 'SECONDARY' CHECK (workspace_role IN ('PRIMARY', 'SECONDARY', 'FUTURE_OUTPUT', 'NOT_SELECTED')),
  status text NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'NOT_STARTED', 'DRAFT', 'EVIDENCE_INCOMPLETE', 'INTERNAL_REVIEW_READY', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED')),
  source_design_version integer NOT NULL DEFAULT 0,
  source_design_version_id text,
  current_version_number integer NOT NULL DEFAULT 0,
  source_hash text,
  gate_state jsonb NOT NULL DEFAULT '{}',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_workspaces_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT route_workspaces_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, route)
);

-- 2. route_workspace_versions — append-only 快照（含三路線完整 payload）
CREATE TABLE route_workspace_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route_workspace_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_workspace_versions_ws_fk FOREIGN KEY (route_workspace_id) REFERENCES route_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT route_workspace_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES route_workspace_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, route_workspace_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER route_workspace_versions_append_only
  BEFORE UPDATE OR DELETE ON route_workspace_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. route_workspace_sections — 共用 Section Writing Workspace（三路線共用）
CREATE TABLE route_workspace_sections (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route_workspace_id text NOT NULL,
  section_id text NOT NULL,
  title text NOT NULL,
  objective text,
  outline jsonb NOT NULL DEFAULT '[]',
  draft_content text NOT NULL DEFAULT '',
  evidence_links jsonb NOT NULL DEFAULT '[]',
  citation_sources jsonb NOT NULL DEFAULT '[]',
  zotero_items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'OUTLINE_READY', 'DRAFT', 'CITATION_NEEDED', 'EVIDENCE_INCOMPLETE', 'USER_REVIEW_REQUIRED', 'APPROVED', 'OUTDATED')),
  user_approved boolean NOT NULL DEFAULT false,
  version_number integer NOT NULL DEFAULT 0,
  source_hash text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_workspace_sections_ws_fk FOREIGN KEY (route_workspace_id) REFERENCES route_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT route_workspace_sections_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, route_workspace_id, section_id)
);

-- 4. route_workspace_section_versions — section append-only
CREATE TABLE route_workspace_section_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  section_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rws_section_versions_section_fk FOREIGN KEY (section_id) REFERENCES route_workspace_sections(id) ON DELETE CASCADE,
  CONSTRAINT rws_section_versions_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES route_workspace_section_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, section_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER route_workspace_section_versions_append_only
  BEFORE UPDATE OR DELETE ON route_workspace_section_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 5. route_workspace_gates — 三路線 Gate 紀錄
CREATE TABLE route_workspace_gates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route_workspace_id text NOT NULL,
  route_workspace_version_id text,
  gate_type text NOT NULL CHECK (gate_type IN ('JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE')),
  checks jsonb NOT NULL DEFAULT '{}',
  decision text NOT NULL CHECK (decision IN ('LOCKED', 'APPROVED', 'REJECTED')),
  human_gate_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_workspace_gates_ws_fk FOREIGN KEY (route_workspace_id) REFERENCES route_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT route_workspace_gates_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 6. course_research_alignment_items — 教學實踐課程—研究一致性矩陣
CREATE TABLE course_research_alignment_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route_workspace_id text NOT NULL,
  course_objective text NOT NULL,
  teaching_problem text,
  intervention text,
  learning_outcome text,
  assessment text,
  research_question text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'STUDENT_LEARNING_OUTCOME_MISSING', 'COURSE_RESEARCH_MISALIGNMENT', 'ALIGNED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_ws_fk FOREIGN KEY (route_workspace_id) REFERENCES route_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT cra_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 7. route_workspace_outdated_marks — OUTDATED 自動標記紀錄
CREATE TABLE route_workspace_outdated_marks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route_workspace_id text NOT NULL,
  source_table text NOT NULL,
  source_id text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rwom_ws_fk FOREIGN KEY (route_workspace_id) REFERENCES route_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT rwom_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 8. 建立各 route workspace 的索引
CREATE INDEX idx_route_workspaces_tenant ON route_workspaces (workspace_id, project_id);
CREATE INDEX idx_rw_sections_tenant ON route_workspace_sections (workspace_id, project_id, route_workspace_id);
CREATE INDEX idx_cra_tenant ON course_research_alignment_items (workspace_id, project_id);

COMMIT;
