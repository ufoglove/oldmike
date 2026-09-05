-- 0022: Phase 8 — Measurement, Instrument & Protocol Studio
-- 研究工具、量表與 Study Protocol 工作室（全表 tenant-scoped；catalog 為 workspace 級 canonical；版本表 append-only）
BEGIN;

-- 0. 擴充 human gate（Phase 8 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY', 'INSTRUMENTS_AND_PROTOCOL_APPROVED'));

-- 1. instrument_catalog_items — 全站（workspace 級）canonical 工具庫
CREATE TABLE instrument_catalog_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  catalog_key text NOT NULL,
  name text NOT NULL,
  instrument_type text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]',
  year integer,
  original_source text,
  source_url text,
  doi text,
  instrument_status text NOT NULL DEFAULT 'DRAFT' CHECK (instrument_status IN ('DRAFT', 'READY', 'OUTDATED')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, catalog_key)
);

-- 2. instrument_catalog_versions — append-only
CREATE TABLE instrument_catalog_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  catalog_item_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT icv_item_fk FOREIGN KEY (catalog_item_id) REFERENCES instrument_catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT icv_supersedes_fk FOREIGN KEY (workspace_id, supersedes_version_id) REFERENCES instrument_catalog_versions(workspace_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, catalog_item_id, logical_id, version_number),
  UNIQUE (workspace_id, id)
);
CREATE TRIGGER instrument_catalog_versions_append_only
  BEFORE UPDATE OR DELETE ON instrument_catalog_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 3. project_instrument_links — Project 使用實例（不複製 metadata；關聯 catalog）
CREATE TABLE project_instrument_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  catalog_item_id text,
  instrument_name text NOT NULL,
  instrument_type text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  construct_id text,
  construct_name text,
  requirement_id text,
  rq_id text,
  hypothesis_id text,
  variable_role text,
  purpose text,
  language text NOT NULL DEFAULT 'zh-TW',
  time_points jsonb NOT NULL DEFAULT '[]',
  data_type text,
  objective_or_subjective text,
  primary_or_secondary text,
  readiness_status text NOT NULL DEFAULT 'REQUIREMENT_DEFINED' CHECK (readiness_status IN ('REQUIREMENT_DEFINED', 'CANDIDATE_NEEDED', 'CANDIDATE_FOUND', 'EVIDENCE_INCOMPLETE', 'PERMISSION_REQUIRED', 'TRANSLATION_REQUIRED', 'SELECTED', 'READY_FOR_PROTOCOL', 'BLOCKED')),
  permission_status text NOT NULL DEFAULT 'UNKNOWN',
  translation_status text NOT NULL DEFAULT 'NOT_REQUIRED',
  scoring_status text NOT NULL DEFAULT 'NOT_DEFINED' CHECK (scoring_status IN ('NOT_DEFINED', 'DRAFT', 'REVIEW_REQUIRED', 'FINALIZED')),
  fit jsonb NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('REQUIREMENT_ONLY', 'CANDIDATE', 'SELECTED', 'PERMISSION_PENDING', 'TRANSLATION_PENDING', 'DRAFT', 'READY_FOR_PILOT', 'PILOT_REVISION_REQUIRED', 'FINALIZED', 'OUTDATED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pil_catalog_fk FOREIGN KEY (catalog_item_id) REFERENCES instrument_catalog_items(id) ON DELETE SET NULL,
  CONSTRAINT pil_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 4. project_instrument_versions — append-only
CREATE TABLE project_instrument_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT piv_link_fk FOREIGN KEY (link_id) REFERENCES project_instrument_links(id) ON DELETE CASCADE,
  CONSTRAINT piv_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES project_instrument_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, link_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER project_instrument_versions_append_only
  BEFORE UPDATE OR DELETE ON project_instrument_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 5. instrument_evidence_links — 工具 ↔ 文獻/引用/Zotero（僅 ID 關聯）
CREATE TABLE instrument_evidence_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  literature_id text,
  citation_source_id text,
  zotero_item_key text,
  role text NOT NULL DEFAULT 'MEASUREMENT' CHECK (role IN ('MEASUREMENT', 'METHOD')),
  reading_status text NOT NULL DEFAULT 'ABSTRACT_REVIEWED' CHECK (reading_status IN ('ABSTRACT_REVIEWED', 'FULLTEXT_REVIEWED')),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED')),
  supported_claim text,
  note text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iel_link_fk FOREIGN KEY (link_id) REFERENCES project_instrument_links(id) ON DELETE CASCADE,
  CONSTRAINT iel_literature_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE SET NULL,
  CONSTRAINT iel_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 6. instrument_permissions — Permission Center
CREATE TABLE instrument_permissions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text NOT NULL,
  copyright_owner text,
  license_type text,
  permission_required boolean NOT NULL DEFAULT true,
  permitted_uses jsonb NOT NULL DEFAULT '[]',
  prohibited_uses jsonb NOT NULL DEFAULT '[]',
  modification_allowed boolean,
  translation_allowed boolean,
  digital_administration_allowed boolean,
  commercial_use_allowed boolean,
  fee text,
  request_date timestamptz,
  response_date timestamptz,
  permission_document text,
  expiry_date timestamptz,
  status text NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('UNKNOWN', 'PUBLIC_DOMAIN', 'OPEN_LICENSE', 'PERMISSION_NOT_REQUIRED', 'PERMISSION_REQUIRED', 'REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'RESTRICTION_APPLIES')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iperm_link_fk FOREIGN KEY (link_id) REFERENCES project_instrument_links(id) ON DELETE CASCADE,
  CONSTRAINT iperm_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, link_id)
);

-- 7. instrument_translations — 翻譯與文化調適工作流
CREATE TABLE instrument_translations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text NOT NULL,
  source_version text,
  translator_role text,
  forward_a text,
  forward_b text,
  reconciliation text,
  back_translation text,
  cultural_changes jsonb NOT NULL DEFAULT '[]',
  item_mapping jsonb NOT NULL DEFAULT '[]',
  target_language text NOT NULL DEFAULT 'zh-TW',
  status text NOT NULL DEFAULT 'PERMISSION_REQUIRED' CHECK (status IN ('NOT_REQUIRED', 'PERMISSION_REQUIRED', 'IN_PROGRESS', 'EXPERT_REVIEW', 'COGNITIVE_TEST_REQUIRED', 'PILOT_REQUIRED', 'DRAFT_COMPLETE', 'VALIDATION_PENDING', 'FINALIZED')),
  version text NOT NULL DEFAULT 'v0.1',
  user_approval boolean NOT NULL DEFAULT false,
  machine_translated boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itr_link_fk FOREIGN KEY (link_id) REFERENCES project_instrument_links(id) ON DELETE CASCADE,
  CONSTRAINT itr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, link_id)
);

-- 8. instrument_scoring_specs — 計分與資料轉換規則
CREATE TABLE instrument_scoring_specs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  min_score numeric,
  max_score numeric,
  missing_item_rule text,
  completion_threshold text,
  higher_score_meaning text,
  interpretation_limit text,
  analysis_variable_name text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('NOT_DEFINED', 'DRAFT', 'REVIEW_REQUIRED', 'FINALIZED')),
  content_hash text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isc_link_fk FOREIGN KEY (link_id) REFERENCES project_instrument_links(id) ON DELETE CASCADE,
  CONSTRAINT isc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, link_id)
);

-- 9. test_blueprints — Knowledge Test 藍圖（Table of Specifications）
CREATE TABLE test_blueprints (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  name text NOT NULL,
  table_of_specifications jsonb NOT NULL DEFAULT '[]',
  supported_item_types jsonb NOT NULL DEFAULT '[]',
  related_rq text,
  related_outcome text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'EXPERT_REVIEW_REQUIRED', 'PILOT_REQUIRED', 'FINALIZED')),
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tb_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 10. assessment_items — 測驗題項（僅存使用者輸入；受保護題項不得未授權公開）
CREATE TABLE assessment_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  blueprint_id text NOT NULL,
  item_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  difficulty_status text NOT NULL DEFAULT 'NOT_YET_TESTED',
  discrimination_status text NOT NULL DEFAULT 'NOT_YET_TESTED',
  content_validity_status text NOT NULL DEFAULT 'NOT_REVIEWED',
  exposure_risk text NOT NULL DEFAULT 'LOW',
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_blueprint_fk FOREIGN KEY (blueprint_id) REFERENCES test_blueprints(id) ON DELETE CASCADE,
  CONSTRAINT ai_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, blueprint_id, item_key)
);

-- 11. skill_assessments — 技能／行為評量（rubric 錨點）
CREATE TABLE skill_assessments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  name text NOT NULL,
  task text,
  criteria jsonb NOT NULL DEFAULT '[]',
  assessor_role text,
  assessor_training text,
  blinding text,
  scoring_rule text,
  inter_rater_plan text,
  evidence_source text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'EXPERT_REVIEW_REQUIRED', 'PILOT_REQUIRED', 'FINALIZED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sa_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 12. qualitative_instruments — 訪談／觀察／反思工具
CREATE TABLE qualitative_instruments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  kind text NOT NULL CHECK (kind IN ('INTERVIEW_GUIDE', 'FOCUS_GROUP_GUIDE', 'OBSERVATION_PROTOCOL', 'REFLECTION_LOG', 'OPEN_QUESTIONNAIRE', 'DOCUMENT_REVIEW_GUIDE')),
  title text NOT NULL,
  guide jsonb NOT NULL DEFAULT '[]',
  templates jsonb NOT NULL DEFAULT '{}',
  sensitive_item_ids jsonb NOT NULL DEFAULT '[]',
  ethics_note text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ETHICS_REVIEW_REQUIRED', 'FINALIZED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qi_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 13. digital_event_definitions — System Log 字典
CREATE TABLE digital_event_definitions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  event_id text NOT NULL,
  event_name text NOT NULL,
  definition text,
  trigger_condition text,
  source_system text,
  participant_id_policy text,
  timestamp_format text,
  value_type text,
  unit text,
  valid_range text,
  missing_rule text,
  related_construct text,
  related_rq text,
  time_point text,
  privacy_level text NOT NULL DEFAULT 'LOW',
  retention_policy text,
  planned_analysis text,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ded_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, event_id)
);

-- 14. sensor_specifications — 多模態感測器規格
CREATE TABLE sensor_specifications (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  link_id text,
  sensor_key text NOT NULL,
  device text,
  manufacturer text,
  model text,
  measured_signal text,
  sampling_rate text,
  unit text,
  sensor_placement text,
  calibration text,
  sync_method text,
  timestamp_reference text,
  baseline_period text,
  collection_duration text,
  artifact_sources jsonb NOT NULL DEFAULT '[]',
  quality_threshold text,
  missing_signal_rule text,
  preprocessing_direction text,
  safety_requirement text,
  participant_burden text,
  related_rq text,
  related_construct text,
  device_status text NOT NULL DEFAULT 'PLANNED' CHECK (device_status IN ('PLANNED', 'PROCURED', 'TESTED', 'READY', 'RETIRED')),
  status text NOT NULL DEFAULT 'DRAFT',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ss_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, sensor_key)
);

-- 15. annotation_guidelines — AI 模型與標註工具
CREATE TABLE annotation_guidelines (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ag_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 16. intervention_materials — 介入與控制材料登錄
CREATE TABLE intervention_materials (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  material_type text NOT NULL CHECK (material_type IN ('INTERVENTION', 'CONTROL')),
  name text NOT NULL,
  objective text,
  theoretical_mechanism text,
  components jsonb NOT NULL DEFAULT '[]',
  session_count integer,
  duration text,
  delivery_method text,
  instructor_role text,
  technology text,
  participant_task text,
  feedback text,
  adaptation_rule text,
  fidelity_measure text,
  prohibited_co_intervention jsonb NOT NULL DEFAULT '[]',
  related_rq text,
  related_outcome text,
  control_kind text,
  confounding_risk text NOT NULL DEFAULT 'NONE' CHECK (confounding_risk IN ('NONE', 'CONTROL_CONDITION_CONFOUNDING_RISK')),
  version text NOT NULL DEFAULT 'v1.0',
  status text NOT NULL DEFAULT 'DRAFT',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT im_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 17. fidelity_plans — 介入忠實度計畫
CREATE TABLE fidelity_plans (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  material_id text,
  intervention_manual text,
  instructor_training text,
  delivery_checklist jsonb NOT NULL DEFAULT '[]',
  session_record text,
  adherence_measure text,
  dosage jsonb NOT NULL DEFAULT '{}',
  exposure jsonb NOT NULL DEFAULT '{}',
  contamination_check text,
  deviation_rule text,
  fidelity_threshold text,
  corrective_action text,
  moe_course_checks jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fp_material_fk FOREIGN KEY (material_id) REFERENCES intervention_materials(id) ON DELETE SET NULL,
  CONSTRAINT fp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, material_id)
);

-- 18. measurement_schedules — Schedule of Activities
CREATE TABLE measurement_schedules (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  activity_id text NOT NULL,
  activity text NOT NULL,
  study_arm text,
  time_point text,
  instrument_link_id text,
  responsible_role text,
  duration text,
  data_generated text,
  ethics_requirement text,
  participant_burden text,
  completion_rule text,
  sequence integer,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ms_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, activity_id)
);

-- 19. data_capture_fields — Data Capture Schema（未來資料欄位字典）
CREATE TABLE data_capture_fields (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  variable_name text NOT NULL,
  label text,
  source_instrument text,
  item_or_event_id text,
  construct text,
  data_type text,
  unit text,
  valid_range text,
  coding text,
  missing_code text,
  time_point text,
  study_arm text,
  personally_identifiable boolean NOT NULL DEFAULT false,
  sensitive_data boolean NOT NULL DEFAULT false,
  de_identification_rule text,
  storage_location text,
  analysis_plan_link text,
  mapping_history jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dcf_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, variable_name)
);

-- 20. study_protocols — Study Protocol 主檔
CREATE TABLE study_protocols (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'DRAFT', 'INSTRUMENTS_INCOMPLETE', 'ETHICS_ALIGNMENT_REQUIRED', 'ANALYSIS_ALIGNMENT_REQUIRED', 'INTERNAL_REVIEW', 'APPROVED_FOR_PILOT', 'AMENDMENT_REQUIRED', 'OUTDATED')),
  current_version_number integer NOT NULL DEFAULT 0,
  source_fingerprint text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 21. study_protocol_versions — Protocol 不可變快照（append-only）
CREATE TABLE study_protocol_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  protocol_id text NOT NULL,
  logical_id text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id text,
  version_label text NOT NULL,
  reason text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spv_protocol_fk FOREIGN KEY (protocol_id) REFERENCES study_protocols(id) ON DELETE CASCADE,
  CONSTRAINT spv_supersedes_fk FOREIGN KEY (workspace_id, project_id, supersedes_version_id) REFERENCES study_protocol_versions(workspace_id, project_id, id) ON DELETE RESTRICT,
  UNIQUE (workspace_id, project_id, protocol_id, logical_id, version_number),
  UNIQUE (workspace_id, project_id, id)
);
CREATE TRIGGER study_protocol_versions_append_only
  BEFORE UPDATE OR DELETE ON study_protocol_versions
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

-- 22. protocol_alignment_results — Ethics／Analysis Alignment 檢查結果
CREATE TABLE protocol_alignment_results (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  protocol_version_id text,
  check_type text NOT NULL CHECK (check_type IN ('ETHICS', 'ANALYSIS')),
  results jsonb NOT NULL DEFAULT '[]',
  fatal_count integer NOT NULL DEFAULT 0,
  major_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PASS' CHECK (status IN ('PASS', 'WARN', 'FAIL')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  CONSTRAINT par_version_fk FOREIGN KEY (protocol_version_id) REFERENCES study_protocol_versions(id) ON DELETE SET NULL,
  CONSTRAINT par_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 23. pilot_readiness_packages — Pilot Readiness
CREATE TABLE pilot_readiness_packages (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  overall text NOT NULL DEFAULT 'NOT_READY' CHECK (overall IN ('NOT_READY', 'CONDITIONAL', 'READY_PENDING_ETHICS', 'READY_PENDING_GRANT_ACTIVATION', 'READY', 'BLOCKED')),
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prp_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 索引
CREATE INDEX idx_ici_tenant ON instrument_catalog_items (workspace_id);
CREATE INDEX idx_pil_tenant ON project_instrument_links (workspace_id, project_id);
CREATE INDEX idx_iel_tenant ON instrument_evidence_links (workspace_id, project_id, link_id);
CREATE INDEX idx_iperm_tenant ON instrument_permissions (workspace_id, project_id);
CREATE INDEX idx_itr_tenant ON instrument_translations (workspace_id, project_id);
CREATE INDEX idx_isc_tenant ON instrument_scoring_specs (workspace_id, project_id);
CREATE INDEX idx_tb_tenant ON test_blueprints (workspace_id, project_id);
CREATE INDEX idx_ai_tenant ON assessment_items (workspace_id, project_id);
CREATE INDEX idx_sa_tenant ON skill_assessments (workspace_id, project_id);
CREATE INDEX idx_qi_tenant ON qualitative_instruments (workspace_id, project_id);
CREATE INDEX idx_ded_tenant ON digital_event_definitions (workspace_id, project_id);
CREATE INDEX idx_ss_tenant ON sensor_specifications (workspace_id, project_id);
CREATE INDEX idx_im_tenant ON intervention_materials (workspace_id, project_id);
CREATE INDEX idx_fp_tenant ON fidelity_plans (workspace_id, project_id);
CREATE INDEX idx_ms_tenant ON measurement_schedules (workspace_id, project_id);
CREATE INDEX idx_dcf_tenant ON data_capture_fields (workspace_id, project_id);
CREATE INDEX idx_sp_tenant ON study_protocols (workspace_id, project_id);
CREATE INDEX idx_par_tenant ON protocol_alignment_results (workspace_id, project_id);
CREATE INDEX idx_prp_tenant ON pilot_readiness_packages (workspace_id, project_id);

COMMIT;
