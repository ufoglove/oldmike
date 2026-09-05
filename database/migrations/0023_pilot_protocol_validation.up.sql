-- 0023: Phase 9 — Pilot Study, Instrument Pretest & Protocol Validation Center
-- 全表 tenant-scoped；版本表 append-only；Pilot 資料與正式研究分離
BEGIN;

-- 0. 擴充 human gate（Phase 9 三個 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY', 'INSTRUMENTS_AND_PROTOCOL_APPROVED', 'PILOT_EXECUTION_AUTHORIZED', 'PILOT_AND_PROTOCOL_VALIDATED', 'FORMAL_STUDY_EXECUTION_READY'));

-- 1. pilot_studies — 每專案單一 Pilot Study 主檔
CREATE TABLE pilot_studies (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  protocol_version_id text,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'PLANNING', 'AUTHORIZATION_REQUIRED', 'READY_TO_START', 'IN_PROGRESS', 'PAUSED', 'PAUSED_FOR_SAFETY_REVIEW', 'DATA_REVIEW', 'REVISION_REQUIRED', 'REPEAT_REQUIRED', 'COMPLETED', 'WAIVED', 'CANCELLED', 'OUTDATED')),
  applicability jsonb NOT NULL DEFAULT '{}',
  combination_status text NOT NULL DEFAULT 'SEPARATE' CHECK (combination_status IN ('SEPARATE', 'ELIGIBLE_FOR_COMBINATION_REVIEW', 'APPROVED_FOR_COMBINATION', 'NOT_ELIGIBLE', 'UNDETERMINED')),
  source_fingerprint text,
  current_version_number integer NOT NULL DEFAULT 0,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. pilot_study_versions — append-only 計畫快照
CREATE TABLE pilot_study_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psv_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT psv_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES pilot_study_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, pilot_study_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER pilot_study_versions_append_only
  BEFORE UPDATE OR DELETE ON pilot_study_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. pilot_components — 多個 Pilot 類型組件（統整於同一計畫）
CREATE TABLE pilot_components (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  pilot_type text NOT NULL,
  name text NOT NULL,
  human_participant boolean NOT NULL DEFAULT false,
  objectives jsonb NOT NULL DEFAULT '[]',
  participant_type text,
  proposed_sample_rationale text,
  inclusion_criteria text,
  exclusion_criteria text,
  recruitment_method text,
  procedures text,
  measures jsonb NOT NULL DEFAULT '[]',
  technical_checks jsonb NOT NULL DEFAULT '[]',
  feasibility_metrics jsonb NOT NULL DEFAULT '[]',
  safety_metrics jsonb NOT NULL DEFAULT '[]',
  decision_rules text,
  responsible_roles jsonb NOT NULL DEFAULT '[]',
  timeline text,
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'AUTHORIZATION_REQUIRED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'WAIVED', 'CANCELLED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pc_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id, pilot_type)
);

-- 4. pilot_success_criteria
CREATE TABLE pilot_success_criteria (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_id text,
  criterion_key text NOT NULL,
  pilot_objective text,
  metric text NOT NULL,
  threshold text NOT NULL,
  threshold_basis text NOT NULL DEFAULT 'PROVISIONAL_THRESHOLD' CHECK (threshold_basis IN ('Literature', 'Technical Requirement', 'Institutional Requirement', 'Expert Decision', 'Prior Study', 'Project-defined Rationale', 'PROVISIONAL_THRESHOLD')),
  data_source text,
  evaluation_method text,
  severity_if_failed text NOT NULL DEFAULT 'MINOR' CHECK (severity_if_failed IN ('MINOR', 'MAJOR', 'FATAL')),
  decision_rule text,
  status text NOT NULL DEFAULT 'DEFINED' CHECK (status IN ('DEFINED', 'MET', 'PARTIALLY_MET', 'NOT_MET', 'NOT_EVALUATED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psc_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT psc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id, criterion_key)
);

-- 5. pilot_execution_authorizations — 執行授權（15 檢查）
CREATE TABLE pilot_execution_authorizations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'PLANNING_ONLY' CHECK (status IN ('PLANNING_ONLY', 'AUTHORIZATION_INCOMPLETE', 'READY_PENDING_ETHICS', 'READY_PENDING_PERMISSION', 'READY_PENDING_PROJECT_ACTIVATION', 'AUTHORIZED', 'BLOCKED', 'EXPIRED', 'AMENDMENT_REQUIRED')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pea_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pea_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id)
);

-- 6. pilot_sessions — 真實執行紀錄（需授權；technical dry run 允許 synthetic）
CREATE TABLE pilot_sessions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_id text,
  session_type text NOT NULL DEFAULT 'HUMAN' CHECK (session_type IN ('HUMAN', 'TECHNICAL')),
  synthetic boolean NOT NULL DEFAULT false,
  participant_code text,
  protocol_version text,
  instrument_versions jsonb NOT NULL DEFAULT '[]',
  session_date timestamptz,
  environment text,
  device text,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONSENT_PENDING', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE', 'WITHDRAWN', 'INVALID', 'DEVIATION_RECORDED')),
  notes text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pse_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pse_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 7. pilot_datasets — Pilot 資料（與正式研究分離；raw 不可變）
CREATE TABLE pilot_datasets (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  dataset_type text NOT NULL CHECK (dataset_type IN ('RAW', 'CLEAN', 'ANALYSIS')),
  synthetic boolean NOT NULL DEFAULT false,
  dataset_name text NOT NULL,
  checksum text,
  storage_location text,
  access_level text NOT NULL DEFAULT 'PRIVATE',
  de_identification_status text NOT NULL DEFAULT 'NOT_APPLICABLE',
  transformation_log jsonb NOT NULL DEFAULT '[]',
  data_dictionary_version text,
  source_files jsonb NOT NULL DEFAULT '[]',
  immutable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'VERIFIED', 'LOCKED', 'REJECTED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pd_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pd_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 8. cognitive_interview_records
CREATE TABLE cognitive_interview_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  session_id text,
  participant_code text,
  instrument_version text,
  item_ref text,
  comprehension_issue text,
  interpretation text,
  retrieval_issue text,
  judgment_issue text,
  response_mapping_issue text,
  cultural_issue text,
  suggested_revision text,
  interviewer_note text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('CLEAR', 'MINOR_REVISION', 'MAJOR_REVISION', 'REMOVE_ITEM', 'FURTHER_TESTING_REQUIRED')),
  decision text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ci_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT ci_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 9. expert_content_reviews
CREATE TABLE expert_content_reviews (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  expert_role text,
  expertise_domain text,
  conflict_of_interest text,
  instrument_version text,
  construct text,
  item_relevance text,
  item_clarity text,
  item_coverage text,
  cultural_fit text,
  scoring_fit text,
  comments text,
  revision_decision text,
  cvi_status text NOT NULL DEFAULT 'NOT_YET_EVALUATED',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT er_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT er_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 10. pilot_pretest_results — 工具/測驗/技能/質性預試（真實輸入；PILOT_PRELIMINARY）
CREATE TABLE pilot_pretest_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_id text,
  result_kind text NOT NULL CHECK (result_kind IN ('INSTRUMENT_PRETEST', 'KNOWLEDGE_TEST_PRETEST', 'SKILL_RUBRIC_PILOT', 'QUALITATIVE_INSTRUMENT_PILOT', 'COGNITIVE_INTERVIEW_SUMMARY', 'MANIPULATION_CHECK')),
  item_ref text,
  metric_key text NOT NULL,
  metric_value numeric,
  metric_label text,
  status text NOT NULL DEFAULT 'INSUFFICIENT_DATA' CHECK (status IN ('SUITABLE_FOR_PILOT_USE', 'REVISION_REQUIRED', 'RETEST_REQUIRED', 'NOT_SUITABLE', 'INSUFFICIENT_DATA')),
  preliminary_note text NOT NULL DEFAULT 'PILOT_PRELIMINARY（非正式心理計量驗證）',
  analysis_capability jsonb NOT NULL DEFAULT '{}',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pr_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 11. technical_pilot_runs — 系統/可用性測試（含 synthetic 標記）
CREATE TABLE technical_pilot_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_id text,
  run_kind text NOT NULL DEFAULT 'USABILITY' CHECK (run_kind IN ('USABILITY', 'TECHNICAL_DRY_RUN', 'SYSTEM_LOG_VALIDATION', 'DATA_PIPELINE_VALIDATION', 'API_TEST', 'PERMISSION_TEST')),
  synthetic boolean NOT NULL DEFAULT false,
  system_version text,
  environment text,
  device text,
  test_case text NOT NULL,
  expected_behavior text,
  observed_behavior text,
  pass_status text NOT NULL DEFAULT 'FAIL' CHECK (pass_status IN ('PASS', 'FAIL', 'PARTIAL', 'NOT_RUN')),
  issue_severity text,
  reproduction_steps text,
  resolution_status text NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tr_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT tr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 12. sensor_pilot_results
CREATE TABLE sensor_pilot_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  session_id text,
  sensor_key text NOT NULL,
  metric_key text NOT NULL,
  expected_value text,
  observed_value text,
  tolerance text,
  pass_status text NOT NULL DEFAULT 'NOT_RUN' CHECK (pass_status IN ('PASS', 'FAIL', 'PARTIAL', 'NOT_RUN', 'NOT_APPLICABLE')),
  source_file text,
  version text,
  note text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spr_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT spr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 13. log_validation_results — Event Log 驗證（expected vs observed）
CREATE TABLE log_validation_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_id text,
  event_id text NOT NULL,
  expected_trigger text,
  observed_count integer,
  expected_count integer,
  timestamp_correct boolean,
  participant_code_correct boolean,
  duration_calculable boolean,
  missing_detected boolean,
  analysis_variable_supported boolean,
  status text NOT NULL DEFAULT 'NOT_RUN' CHECK (status IN ('PASS', 'FAIL', 'PARTIAL', 'NOT_RUN')),
  issue text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lv_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT lv_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id, event_id)
);

-- 14. ai_model_pilot_results
CREATE TABLE ai_model_pilot_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  model_version text,
  input_reference text,
  output_reference text,
  source_reference text,
  human_review_status text NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (human_review_status IN ('NOT_REVIEWED', 'REVIEWED', 'OVERRODE')),
  failure_category text,
  metric_key text,
  metric_value numeric,
  latency_ms integer,
  note text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT ai_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 15. intervention_pilot_results — 介入/控制組/忠實度/操弄
CREATE TABLE intervention_pilot_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  result_kind text NOT NULL CHECK (result_kind IN ('INTERVENTION_FEASIBILITY', 'FIDELITY', 'MANIPULATION_CHECK', 'CONTROL_CONDITION')),
  material_id text,
  session_duration_ok boolean,
  instructor_workload text,
  participant_workload text,
  completion_status text,
  dose_exposure text,
  contamination_observed boolean,
  control_equivalence_note text,
  confounding_risk text NOT NULL DEFAULT 'NONE' CHECK (confounding_risk IN ('NONE', 'CONTROL_CONDITION_CONFOUNDING_RISK')),
  fidelity_metrics jsonb NOT NULL DEFAULT '{}',
  issue text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASS', 'REVISION_REQUIRED', 'FAIL')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ip_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT ip_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 16. pilot_recruitment_summaries — 招募與負擔（真實執行後）
CREATE TABLE pilot_recruitment_summaries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  contacted_count integer,
  eligible_count integer,
  consent_count integer,
  completion_count integer,
  withdrawal_count integer,
  main_refusal_reasons jsonb NOT NULL DEFAULT '[]',
  recruitment_time text,
  session_duration text,
  follow_up_feasibility text,
  participant_burden text,
  compensation_issue text,
  scheduling_issue text,
  accessibility_issue text,
  population_generalization_limit text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rs_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT rs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id)
);

-- 17. pilot_analysis_runs — Pilot Mode 分析紀錄（PILOT／PRELIMINARY；使用者輸入）
CREATE TABLE pilot_analysis_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  run_kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  pilot_label text NOT NULL DEFAULT 'PILOT／PRELIMINARY',
  confirmatory_disclaimer boolean NOT NULL DEFAULT true,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT par_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT par_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 18. pilot_protocol_deviations
CREATE TABLE pilot_protocol_deviations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  session_id text,
  protocol_section text,
  planned_action text,
  actual_action text,
  reason text,
  participant_impact text,
  data_impact text,
  ethics_impact text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  corrective_action text,
  amendment_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'ACCEPTED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pd_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pd_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 19. pilot_adverse_events — 安全紀錄
CREATE TABLE pilot_adverse_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  event_type text NOT NULL,
  event_date timestamptz,
  participant_code text,
  description text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MODERATE', 'SEVERE', 'SERIOUS')),
  expected_or_unexpected text NOT NULL DEFAULT 'UNEXPECTED',
  related_to_study text,
  immediate_action text,
  follow_up text,
  reporting_requirement text,
  reported_to_institution boolean NOT NULL DEFAULT false,
  report_reference text,
  resolution_status text NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'IN_REVIEW', 'RESOLVED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ae_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT ae_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 20. pilot_issues + 21. pilot_revision_tasks
CREATE TABLE pilot_issues (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  issue_category text NOT NULL,
  issue text NOT NULL,
  evidence text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL', 'FATAL')),
  affected_version text,
  protocol_section text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pi_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pi_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

CREATE TABLE pilot_revision_tasks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  source_issue_id text,
  task_type text NOT NULL,
  recommended_action text NOT NULL,
  owner text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK', 'NOT_APPLICABLE')),
  before_version text,
  after_version text,
  verification_required boolean NOT NULL DEFAULT true,
  resolution_note text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prt_issue_fk FOREIGN KEY (source_issue_id) REFERENCES pilot_issues(id) ON DELETE SET NULL,
  CONSTRAINT prt_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT prt_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 22. material_change_assessments
CREATE TABLE material_change_assessments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  change_type text NOT NULL,
  description text NOT NULL,
  trigger_flags jsonb NOT NULL DEFAULT '[]',
  requires_review text NOT NULL DEFAULT 'NONE' CHECK (requires_review IN ('NONE', 'THEORY_MODEL_REVIEW_REQUIRED', 'RESEARCH_DESIGN_REVIEW_REQUIRED', 'POWER_ANALYSIS_REVISION_REQUIRED', 'ANALYSIS_PLAN_AMENDMENT_REQUIRED', 'PREREGISTRATION_AMENDMENT_REQUIRED', 'ETHICS_AMENDMENT_REQUIRED', 'INSTRUMENT_REVALIDATION_REQUIRED')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'ACCEPTED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT mc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 23. ethics_amendment_requirements
CREATE TABLE ethics_amendment_requirements (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  affected_document text,
  affected_protocol_section text,
  change_description text,
  risk_change text,
  consent_change text,
  data_management_change text,
  recruitment_change text,
  amendment_status text NOT NULL DEFAULT 'REQUIRED' CHECK (amendment_status IN ('REQUIRED', 'SUBMITTED', 'CONFIRMED', 'REJECTED')),
  institutional_reference text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ea_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT ea_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 24. pilot_decisions
CREATE TABLE pilot_decisions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('PROCEED_WITHOUT_CHANGE', 'PROCEED_WITH_MINOR_REVISION', 'MAJOR_REVISION_REQUIRED', 'REPEAT_PILOT_REQUIRED', 'PARTIAL_PILOT_REPEAT_REQUIRED', 'STOP_AND_REDESIGN', 'PILOT_INCONCLUSIVE', 'PILOT_WAIVED_WITH_JUSTIFICATION')),
  rationale text,
  success_criteria_summary jsonb NOT NULL DEFAULT '{}',
  user_approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdec_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pdec_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id)
);

-- 25. pilot_reports — Pilot Study Report v1.0（aggregate jsonb）
CREATE TABLE pilot_reports (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}',
  version text NOT NULL DEFAULT 'v1.0',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prp_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT prp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id)
);

-- 26. protocol_validation_items — Protocol Validation Matrix
CREATE TABLE protocol_validation_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  component_key text NOT NULL,
  pilot_evidence text,
  status text NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (status IN ('VALIDATED_FOR_FORMAL_STUDY', 'VALIDATED_WITH_REVISION', 'RETEST_REQUIRED', 'NOT_VALIDATED', 'NOT_APPLICABLE', 'INSUFFICIENT_EVIDENCE')),
  issue text,
  revision text,
  final_version text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pvi_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT pvi_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id, component_key)
);

-- 27. formal_study_readiness_assessments — Formal Study Readiness
CREATE TABLE formal_study_readiness_assessments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'NOT_READY' CHECK (status IN ('NOT_READY', 'BLOCKED_BY_ETHICS', 'BLOCKED_BY_GRANT_ACTIVATION', 'BLOCKED_BY_PERMISSION', 'BLOCKED_BY_PROTOCOL', 'BLOCKED_BY_SAFETY', 'CONDITIONAL', 'READY_FOR_FINAL_APPROVAL', 'APPROVED_FOR_FORMAL_STUDY', 'OUTDATED')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsr_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT fsr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, pilot_study_id)
);

-- 28. team_training_records — Research Team Readiness
CREATE TABLE team_training_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  pilot_study_id text NOT NULL,
  role text NOT NULL,
  trainings jsonb NOT NULL DEFAULT '{}',
  training_date timestamptz,
  competency_check text,
  authorization_status text NOT NULL DEFAULT 'PENDING' CHECK (authorization_status IN ('PENDING', 'AUTHORIZED', 'NOT_REQUIRED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tt_study_fk FOREIGN KEY (pilot_study_id) REFERENCES pilot_studies(id) ON DELETE CASCADE,
  CONSTRAINT tt_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_ps_tenant ON pilot_studies (workspace_id, project_id);
CREATE INDEX idx_pc_tenant ON pilot_components (workspace_id, project_id);
CREATE INDEX idx_psc_tenant ON pilot_success_criteria (workspace_id, project_id);
CREATE INDEX idx_pse_tenant ON pilot_sessions (workspace_id, project_id);
CREATE INDEX idx_pd_tenant ON pilot_datasets (workspace_id, project_id);
CREATE INDEX idx_ci_tenant ON cognitive_interview_records (workspace_id, project_id);
CREATE INDEX idx_pr_tenant ON pilot_pretest_results (workspace_id, project_id);
CREATE INDEX idx_tr_tenant ON technical_pilot_runs (workspace_id, project_id);
CREATE INDEX idx_lv_tenant ON log_validation_results (workspace_id, project_id);
CREATE INDEX idx_pd2_tenant ON pilot_protocol_deviations (workspace_id, project_id);
CREATE INDEX idx_ae_tenant ON pilot_adverse_events (workspace_id, project_id);
CREATE INDEX idx_pi_tenant ON pilot_issues (workspace_id, project_id);
CREATE INDEX idx_prt_tenant ON pilot_revision_tasks (workspace_id, project_id);
CREATE INDEX idx_pvi_tenant ON protocol_validation_items (workspace_id, project_id);

COMMIT;
