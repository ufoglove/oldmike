-- 0020: Phase 7 — 研究倫理／IRB中心＋國科會／教學實踐審查與合規＋計畫申請包
-- 全站唯一倫理管理中心；所有表 tenant-scoped（workspace_id, project_id）；append-only 版本化
BEGIN;

-- 0. 擴充 human gate 類型（Phase 7 新增 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY'));

-- 1. research_ethics_assessments — 每專案一筆倫理評估（全站唯一倫理管理中心）
CREATE TABLE research_ethics_assessments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'REVIEW_LIKELY_REQUIRED', 'EXEMPTION_MAY_APPLY', 'NON_HUMAN_RESEARCH', 'SECONDARY_DATA_REVIEW_REQUIRED', 'INSTITUTIONAL_CONFIRMATION_REQUIRED', 'INSUFFICIENT_INFORMATION', 'OUTDATED')),
  screening_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (screening_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  judgment_status text NOT NULL DEFAULT 'INSUFFICIENT_INFORMATION' CHECK (judgment_status IN ('REVIEW_LIKELY_REQUIRED', 'EXEMPTION_MAY_APPLY', 'NON_HUMAN_RESEARCH', 'SECONDARY_DATA_REVIEW_REQUIRED', 'INSTITUTIONAL_CONFIRMATION_REQUIRED', 'INSUFFICIENT_INFORMATION')),
  teacher_power_status text NOT NULL DEFAULT 'NOT_CHECKED' CHECK (teacher_power_status IN ('NOT_CHECKED', 'CLEARED', 'TEACHER_STUDENT_POWER_RISK')),
  teacher_power_severity text,
  summary jsonb NOT NULL DEFAULT '{}',
  source_fingerprint text,
  gate_state jsonb NOT NULL DEFAULT '{}',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rea_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT rea_research_project_fk FOREIGN KEY (research_project_id) REFERENCES research_projects(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, project_id)
);

-- 2. ethics_scope_items — Ethics Scope Screening（25 項）
CREATE TABLE ethics_scope_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  item_key text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL DEFAULT 'UNKNOWN' CHECK (answer IN ('YES', 'NO', 'UNKNOWN')),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'ANSWERED', 'NEEDS_RESEARCHER')),
  evidence text,
  risk_level text NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  required_action text,
  unresolved_question text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esi_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT esi_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id, item_key)
);

-- 3. ethics_risk_items — Ethics Risk Register（15 類風險）
CREATE TABLE ethics_risk_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  risk_key text NOT NULL,
  risk_title text NOT NULL,
  likelihood text NOT NULL DEFAULT 'UNLIKELY' CHECK (likelihood IN ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN')),
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('NEGLIGIBLE', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE')),
  affected_population text,
  mitigation text,
  monitoring text,
  responsible_person text,
  residual_risk text NOT NULL DEFAULT 'UNASSESSED',
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MITIGATED', 'ACCEPTED', 'MONITORING')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eri_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT eri_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id, risk_key)
);

-- 4. institutional_ethics_decisions — 正式機構倫理判定（只有真實文件才可 APPROVED）
CREATE TABLE institutional_ethics_decisions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  institution text NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('EXEMPT', 'EXPEDITED_REVIEW', 'FULL_REVIEW', 'NON_HUMAN', 'SECONDARY_DATA_APPROVED', 'NOT_APPROVED', 'OTHER')),
  application_number text,
  approval_number text,
  decision_date timestamptz,
  expiry_date timestamptz,
  approved_documents jsonb NOT NULL DEFAULT '[]',
  conditions jsonb NOT NULL DEFAULT '[]',
  verified_by_user boolean NOT NULL DEFAULT false,
  file_reference text,
  approval_status text NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ied_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT ied_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 5. ethics_documents — IRB／倫理文件工作區（20 類；狀態由真實操作驅動）
CREATE TABLE ethics_documents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'USER_REVIEW_REQUIRED', 'INSTITUTION_REVIEW_REQUIRED', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED', 'EXPIRED')),
  version_number integer NOT NULL DEFAULT 0,
  source_hash text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ed_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT ed_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id, document_type)
);

-- 6. data_management_plans — 全站共用 Research Data Management Plan（jsonb 段落）
CREATE TABLE data_management_plans (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'REVIEW_REQUIRED', 'COMPLETE', 'OUTDATED')),
  version_number integer NOT NULL DEFAULT 0,
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dmp_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT dmp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id)
);

-- 7. preregistration_plans — 預註冊工作區
CREATE TABLE preregistration_plans (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  design_type text NOT NULL DEFAULT 'OTHER' CHECK (design_type IN ('CONFIRMATORY_EXPERIMENT', 'RCT', 'QUASI_EXPERIMENT', 'LONGITUDINAL', 'SURVEY_CONFIRMATORY', 'REGISTERED_REPORT', 'AI_ML_BENCHMARK', 'OTHER', 'NOT_APPLICABLE')),
  registration_type text,
  platform_candidate text,
  primary_outcome text,
  secondary_outcomes jsonb NOT NULL DEFAULT '[]',
  hypotheses jsonb NOT NULL DEFAULT '[]',
  sample_plan text,
  exclusion_rules text,
  stopping_rule text,
  missing_data_strategy text,
  outlier_strategy text,
  main_analysis text,
  exploratory_analysis text,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'NOT_APPLICABLE', 'PLANNED', 'DRAFT_READY', 'REGISTERED', 'EMBARGOED', 'AMENDED')),
  registration_url text,
  registration_id text,
  registered_at timestamptz,
  current_version_number integer NOT NULL DEFAULT 0,
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT pp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id)
);

-- 8. preregistration_versions — append-only 快照
CREATE TABLE preregistration_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  plan_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prv_plan_fk FOREIGN KEY (plan_id) REFERENCES preregistration_plans(id) ON DELETE CASCADE,
  CONSTRAINT prv_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES preregistration_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, plan_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER preregistration_versions_append_only
  BEFORE UPDATE OR DELETE ON preregistration_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 9. preregistration_amendments — 預註冊修訂（不覆蓋原始版本）
CREATE TABLE preregistration_amendments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  plan_id text NOT NULL,
  from_version_id text,
  to_version_id text,
  reason text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pram_plan_fk FOREIGN KEY (plan_id) REFERENCES preregistration_plans(id) ON DELETE CASCADE,
  CONSTRAINT pram_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 10. journal_study_readiness_reviews — Journal Pre-study Readiness Review
CREATE TABLE journal_study_readiness_reviews (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  assessment_id text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  overall text NOT NULL DEFAULT 'NOT_STARTED' CHECK (overall IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'NOT_READY', 'OUTDATED')),
  version text NOT NULL DEFAULT 'v1.0',
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jsrr_assessment_fk FOREIGN KEY (assessment_id) REFERENCES research_ethics_assessments(id) ON DELETE CASCADE,
  CONSTRAINT jsrr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, assessment_id)
);

-- 11. route_review_runs — Reviewer 模擬（SIMULATED REVIEW）
CREATE TABLE route_review_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('DISCIPLINE_EXPERT', 'METHODS_FEASIBILITY', 'PI_AND_OUTPUTS', 'TEACHING_PROBLEM', 'TEACHING_DESIGN_LEARNING')),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'OUTDATED')),
  simulated boolean NOT NULL DEFAULT true,
  summary jsonb NOT NULL DEFAULT '{}',
  severity_counts jsonb NOT NULL DEFAULT '{}',
  version_number integer NOT NULL DEFAULT 0,
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, route, reviewer_type)
);

-- 12. reviewer_findings — 審查發現（severity 同規格；SIMULATED）
CREATE TABLE reviewer_findings (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  review_run_id text NOT NULL,
  reviewer_type text NOT NULL,
  section_id text,
  issue text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('FATAL', 'MAJOR', 'MINOR', 'SUGGESTION')),
  rationale text,
  evidence text,
  required_revision text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ACCEPTED_RISK')),
  simulated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_run_fk FOREIGN KEY (review_run_id) REFERENCES route_review_runs(id) ON DELETE CASCADE,
  CONSTRAINT rf_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 13. revision_tasks — Reviewer Finding → Revision Task
CREATE TABLE revision_tasks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  source_reviewer_finding_id text,
  affected_section text,
  severity text NOT NULL CHECK (severity IN ('FATAL', 'MAJOR', 'MINOR', 'SUGGESTION')),
  required_action text NOT NULL,
  owner text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK', 'NOT_APPLICABLE')),
  before_version text,
  after_version text,
  resolution_note text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rt_finding_fk FOREIGN KEY (source_reviewer_finding_id) REFERENCES reviewer_findings(id) ON DELETE SET NULL,
  CONSTRAINT rt_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 14. official_rule_snapshots — 官方規範快照（當年度規則；不得寫死在程式碼）
CREATE TABLE official_rule_snapshots (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('NSTC', 'MOE_TPR')),
  target_year integer NOT NULL,
  document_title text NOT NULL,
  requirement text NOT NULL,
  effective_date timestamptz,
  source_url text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED_CURRENT', 'VERIFIED_PREVIOUS_YEAR', 'PENDING_NEW_ANNOUNCEMENT', 'CONFLICTING', 'UNVERIFIED')),
  notes text,
  content_hash text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ors_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 15. compliance_items — 共用 Compliance Matrix
CREATE TABLE compliance_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  target_year integer NOT NULL,
  authority text NOT NULL,
  requirement text NOT NULL,
  official_source text,
  current_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (current_status IN ('MET', 'PARTIAL', 'MISSING', 'NOT_APPLICABLE', 'AWAITING_OFFICIAL_RULE', 'UNVERIFIED')),
  evidence text,
  missing_item text,
  required_action text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('FATAL', 'MAJOR', 'MINOR', 'SUGGESTION')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED_CURRENT', 'VERIFIED_PREVIOUS_YEAR', 'PENDING_NEW_ANNOUNCEMENT', 'CONFLICTING', 'UNVERIFIED')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  source_snapshot_id text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ci_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT ci_snapshot_fk FOREIGN KEY (source_snapshot_id) REFERENCES official_rule_snapshots(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, project_id, route, target_year, requirement)
);

-- 16. proposal_application_packages — 計畫申請包（國科會／教學實踐共用結構）
CREATE TABLE proposal_application_packages (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'INTERNAL_REVIEW', 'READY_FOR_INSTITUTIONAL_SUBMISSION', 'OUTDATED')),
  version_number integer NOT NULL DEFAULT 0,
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pap_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, route)
);

-- 17. proposal_package_files — 申請包內各檔案（依 Route 內容不同）
CREATE TABLE proposal_package_files (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  package_id text NOT NULL,
  file_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT 'v1.0',
  generated_at timestamptz,
  approved_by_user boolean NOT NULL DEFAULT false,
  source_sections jsonb NOT NULL DEFAULT '[]',
  evidence_links jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'USER_REVIEW_REQUIRED', 'APPROVED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ppf_package_fk FOREIGN KEY (package_id) REFERENCES proposal_application_packages(id) ON DELETE CASCADE,
  CONSTRAINT ppf_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, package_id, file_type)
);

-- 18. proposal_submission_records — 正式送件狀態管理（需使用者操作或可驗證紀錄）
CREATE TABLE proposal_submission_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  status text NOT NULL DEFAULT 'NOT_READY' CHECK (status IN ('NOT_READY', 'INTERNAL_REVIEW', 'READY_FOR_INSTITUTIONAL_SUBMISSION', 'SUBMITTED_TO_INSTITUTION', 'SUBMITTED_TO_AUTHORITY', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'NOT_APPROVED', 'WITHDRAWN')),
  evidence text,
  updated_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, route)
);

-- 19. grant_decision_records — 核定紀錄（只有真實文件才可記錄）
CREATE TABLE grant_decision_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  route text NOT NULL CHECK (route IN ('NSTC_PROPOSAL', 'MOE_TPR_PROPOSAL')),
  authority text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED', 'NOT_APPROVED', 'PENDING', 'REVISION_REQUESTED', 'WITHDRAWN')),
  decision_date timestamptz,
  amount numeric,
  application_number text,
  conditions jsonb NOT NULL DEFAULT '[]',
  file_reference text,
  verified_by_user boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gdr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_rea_tenant ON research_ethics_assessments (workspace_id, project_id);
CREATE INDEX idx_esi_tenant ON ethics_scope_items (workspace_id, project_id, assessment_id);
CREATE INDEX idx_eri_tenant ON ethics_risk_items (workspace_id, project_id, assessment_id);
CREATE INDEX idx_ied_tenant ON institutional_ethics_decisions (workspace_id, project_id);
CREATE INDEX idx_ed_tenant ON ethics_documents (workspace_id, project_id, assessment_id);
CREATE INDEX idx_dmp_tenant ON data_management_plans (workspace_id, project_id);
CREATE INDEX idx_pp_tenant ON preregistration_plans (workspace_id, project_id);
CREATE INDEX idx_prv_tenant ON preregistration_versions (workspace_id, project_id, plan_id);
CREATE INDEX idx_jsrr_tenant ON journal_study_readiness_reviews (workspace_id, project_id);
CREATE INDEX idx_rrr_tenant ON route_review_runs (workspace_id, project_id, route);
CREATE INDEX idx_rf_tenant ON reviewer_findings (workspace_id, project_id, review_run_id);
CREATE INDEX idx_rt_tenant ON revision_tasks (workspace_id, project_id);
CREATE INDEX idx_ors_tenant ON official_rule_snapshots (workspace_id, project_id, authority, target_year);
CREATE INDEX idx_ci_tenant ON compliance_items (workspace_id, project_id, route, target_year);
CREATE INDEX idx_pap_tenant ON proposal_application_packages (workspace_id, project_id, route);
CREATE INDEX idx_ppf_tenant ON proposal_package_files (workspace_id, project_id, package_id);
CREATE INDEX idx_psr_tenant ON proposal_submission_records (workspace_id, project_id, route);
CREATE INDEX idx_gdr_tenant ON grant_decision_records (workspace_id, project_id);

COMMIT;
