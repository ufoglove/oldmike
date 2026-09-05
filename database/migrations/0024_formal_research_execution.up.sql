-- 0024: Phase 10 — Formal Research Execution, Recruitment & Data Collection Center
-- 全表 tenant-scoped；Raw Data 不可變；Pilot/Synthetic 與 Formal 分離
BEGIN;

-- 0. 擴充 human gate（Phase 10 四個 Gate）
ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY', 'INSTRUMENTS_AND_PROTOCOL_APPROVED', 'PILOT_EXECUTION_AUTHORIZED', 'PILOT_AND_PROTOCOL_VALIDATED', 'FORMAL_STUDY_EXECUTION_READY', 'FORMAL_STUDY_ACTIVATED', 'RECRUITMENT_AND_DATA_COLLECTION_OPEN', 'FORMAL_DATA_ACQUISITION_OPEN', 'FORMAL_DATA_COLLECTION_COMPLETE', 'RAW_DATA_LOCKED_AND_HANDOFF_READY'));

-- 1. formal_studies — 正式研究主檔（單一來源）
CREATE TABLE formal_studies (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  research_project_id text,
  study_title text,
  execution_mode text NOT NULL DEFAULT 'HUMAN_PARTICIPANT_STUDY',
  protocol_version text,
  research_design_version text,
  analysis_plan_version text,
  preregistration_version text,
  ethics_decision_id text,
  ethics_expiry_date timestamptz,
  primary_site text,
  target_sample_size integer,
  maximum_enrollment integer,
  study_start_date timestamptz,
  planned_end_date timestamptz,
  recruitment_start_date timestamptz,
  recruitment_end_date timestamptz,
  principal_investigator text,
  study_coordinator text,
  data_manager text,
  safety_contact text,
  status text NOT NULL DEFAULT 'NOT_ACTIVATED' CHECK (status IN ('NOT_ACTIVATED', 'ACTIVATION_REVIEW', 'ACTIVATED', 'RECRUITING', 'ACTIVE_DATA_COLLECTION', 'FOLLOW_UP', 'PAUSED', 'SUSPENDED', 'DATA_COLLECTION_CLOSING', 'DATA_COLLECTION_CLOSED', 'RAW_DATA_FROZEN', 'RAW_DATA_LOCKED', 'TERMINATED_EARLY', 'ARCHIVED')),
  execution_snapshot_status text NOT NULL DEFAULT 'NOT_CREATED',
  created_by_user_id text NOT NULL,
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id)
);

-- 2. study_activation_records — 啟動檢查與核准（20 項）
CREATE TABLE study_activation_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'NOT_READY' CHECK (status IN ('NOT_READY', 'ACTIVATION_REVIEW', 'BLOCKED_BY_ETHICS', 'BLOCKED_BY_PERMISSION', 'BLOCKED_BY_GRANT_ACTIVATION', 'BLOCKED_BY_SITE', 'BLOCKED_BY_TRAINING', 'BLOCKED_BY_PROTOCOL', 'ACTIVATION_APPROVED', 'ACTIVATED', 'PAUSED', 'SUSPENDED', 'CLOSED')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sar_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT sar_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id)
);

-- 3. research_sites
CREATE TABLE research_sites (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  site_code text NOT NULL,
  site_name text NOT NULL,
  institution text,
  site_role text,
  local_investigator text,
  ethics_document text,
  site_permission text,
  data_transfer_agreement text,
  enrollment_target integer,
  current_enrollment integer NOT NULL DEFAULT 0,
  activation_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (activation_status IN ('NOT_STARTED', 'DOCUMENTS_INCOMPLETE', 'TRAINING_REQUIRED', 'READY_FOR_ACTIVATION', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED')),
  activation_date timestamptz,
  expiry_date timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rs_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT rs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, site_code)
);

-- 4. study_team_assignments — 角色與最小權限
CREATE TABLE study_team_assignments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  role text NOT NULL,
  assigned_user text,
  site_id text,
  responsibilities text,
  completed_training boolean NOT NULL DEFAULT false,
  authorization_start timestamptz,
  authorization_end timestamptz,
  unblinded_access boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ta_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ta_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 5. recruitment_campaigns
CREATE TABLE recruitment_campaigns (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  channel text NOT NULL,
  material_version text,
  ethics_approval_reference text,
  target_population text,
  site_id text,
  recruitment_period text,
  responsible_person text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVAL_REQUIRED', 'APPROVED_FOR_USE', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rc_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT rc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 6. eligibility_screenings — Potential/Screened（不含正式研究資料）
CREATE TABLE eligibility_screenings (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  screening_code text NOT NULL,
  candidate_source text,
  eligibility_status text NOT NULL DEFAULT 'NOT_SCREENED' CHECK (eligibility_status IN ('NOT_SCREENED', 'SCREENING_IN_PROGRESS', 'ELIGIBLE', 'INELIGIBLE', 'PENDING_CONFIRMATION', 'WITHDRAWN_BEFORE_ENROLLMENT')),
  exclusion_reason_category text,
  screening_date timestamptz,
  retention_rule text,
  assessed_by text,
  criteria jsonb NOT NULL DEFAULT '[]',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT es_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT es_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, screening_code)
);

-- 7. consent_records
CREATE TABLE consent_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  screening_id text,
  participant_code text,
  consent_document_version text,
  consent_method text,
  consent_date timestamptz,
  consent_administered_by text,
  comprehension_confirmed boolean NOT NULL DEFAULT false,
  optional_components jsonb NOT NULL DEFAULT '[]',
  audio_consent boolean,
  video_consent boolean,
  sensor_consent boolean,
  data_sharing_consent boolean,
  future_use_consent boolean,
  signed_document_reference text,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'INFORMATION_PROVIDED', 'QUESTIONS_PENDING', 'CONSENTED', 'DECLINED', 'WITHDRAWN', 'RECONSENT_REQUIRED', 'INVALID', 'EXPIRED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT cr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 8. participant_study_records — Enrolled（僅同意後建立）
CREATE TABLE participant_study_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  site_code text,
  cohort_code text,
  consent_id text,
  study_arm_code text,
  status text NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('POTENTIAL', 'SCREENING', 'ELIGIBLE', 'INELIGIBLE', 'CONSENTED', 'ENROLLED', 'ALLOCATED', 'ACTIVE', 'FOLLOW_UP', 'COMPLETED', 'WITHDRAWN', 'LOST_TO_FOLLOW_UP', 'DISCONTINUED', 'INVALID')),
  enrollment_date timestamptz,
  allocation_date timestamptz,
  completion_date timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT psr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, participant_code)
);

-- 9. participant_identity_vault — PII 隔離（最小必要；獨立於研究資料）
CREATE TABLE participant_identity_vault (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  legal_name_encrypted text,
  contact_encrypted text,
  consent_reference text,
  compensation_reference text,
  access_scope text NOT NULL DEFAULT 'RESTRICTED',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pv_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT pv_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, participant_code)
);

-- 10. allocation_records — 隨機化/分組（不可任意重生成）
CREATE TABLE allocation_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  allocation_method text NOT NULL,
  algorithm_version text,
  seed_policy text,
  allocation_sequence text,
  assignment text NOT NULL,
  concealment_method text,
  assigned_at timestamptz,
  assigned_by text,
  override_status text NOT NULL DEFAULT 'NONE' CHECK (override_status IN ('NONE', 'OVERRIDDEN')),
  original_assignment text,
  override_reason text,
  override_authorized_by text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ar_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, participant_code)
);

-- 11. blinding_records
CREATE TABLE blinding_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  role text NOT NULL,
  blinding_status text NOT NULL DEFAULT 'OPEN_LABEL' CHECK (blinding_status IN ('BLINDED', 'UNBLINDED', 'PARTIAL', 'OPEN_LABEL', 'NOT_APPLICABLE')),
  unblinding_reason text,
  unblinding_authorized_by text,
  unblinding_at timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT br_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT br_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 12. study_sessions
CREATE TABLE study_sessions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  site_id text,
  study_arm text,
  time_point text,
  scheduled_time timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  protocol_version text,
  instrument_versions jsonb NOT NULL DEFAULT '[]',
  system_version text,
  device_versions jsonb NOT NULL DEFAULT '[]',
  responsible_staff text,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'CHECK_IN', 'CONSENT_REQUIRED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'PARTIALLY_COMPLETED', 'RESCHEDULED', 'MISSED', 'WITHDRAWN', 'INVALID', 'PAUSED_FOR_SAFETY')),
  completion_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (completion_status IN ('NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETE')),
  safety_status text NOT NULL DEFAULT 'OK',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ss_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ss_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 13. session_activities（承接 Schedule of Activities）
CREATE TABLE session_activities (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  session_id text NOT NULL,
  activity_key text NOT NULL,
  planned_time timestamptz,
  actual_time timestamptz,
  required boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  not_completed_reason text,
  data_generated text,
  responsible_person text,
  deviation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sa_session_fk FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  CONSTRAINT sa_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, session_id, activity_key)
);

-- 14. intervention_delivery_records（含 Control）
CREATE TABLE intervention_delivery_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  session_id text,
  delivery_kind text NOT NULL DEFAULT 'INTERVENTION' CHECK (delivery_kind IN ('INTERVENTION', 'CONTROL')),
  intervention_version text,
  provider text,
  session_number integer,
  planned_dose text,
  actual_dose text,
  exposure_time text,
  components_delivered jsonb NOT NULL DEFAULT '[]',
  feedback_delivered boolean,
  adaptation_events integer,
  interruptions text,
  completion_status text,
  fidelity_status text NOT NULL DEFAULT 'WITHIN_PROTOCOL' CHECK (fidelity_status IN ('WITHIN_PROTOCOL', 'MINOR_DEVIATION', 'MAJOR_DEVIATION', 'CONTAMINATION_RISK', 'NOT_ASSESSABLE')),
  adverse_event text,
  notes text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT idr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 15. instrument_administrations（施測）
CREATE TABLE instrument_administrations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  session_id text,
  instrument_id text,
  instrument_version text,
  time_point text,
  administration_mode text,
  start_time timestamptz,
  completion_time timestamptz,
  completion_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (completion_status IN ('NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETE')),
  missing_item_count integer,
  scoring_status text NOT NULL DEFAULT 'NOT_SCORED' CHECK (scoring_status IN ('NOT_SCORED', 'SCORED', 'PENDING')),
  source_file_or_response_id text,
  administered_by text,
  consent_coverage boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ia_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 16. research_form_submissions（Source Data + Correction）
CREATE TABLE research_form_submissions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  session_id text,
  form_type text NOT NULL,
  form_version text,
  payload jsonb NOT NULL DEFAULT '{}',
  submitted_by text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  correction_history jsonb NOT NULL DEFAULT '[]',
  source_status text NOT NULL DEFAULT 'SOURCE' CHECK (source_status IN ('SOURCE', 'CORRECTED', 'QUERIED', 'VALIDATED')),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfs_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT rfs_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 17. source_data_corrections — 更正不覆寫原值
CREATE TABLE source_data_corrections (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  original_record_id text,
  incorrect_value text,
  corrected_value text,
  reason text,
  source_confirmation text,
  corrected_by text,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  approval text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdc_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT sdc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 18. qualitative_collection_records
CREATE TABLE qualitative_collection_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  session_id text,
  guide_version text,
  interviewer text,
  collection_date timestamptz,
  duration text,
  recording_consent boolean,
  audio_reference text,
  video_reference text,
  field_note_reference text,
  transcript_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (transcript_status IN ('NOT_STARTED', 'AUTOMATED_DRAFT', 'HUMAN_REVIEW_REQUIRED', 'VERIFIED', 'DE_IDENTIFIED', 'LOCKED')),
  transcript_reference text,
  de_identification_status text,
  incident_notes text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qc_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT qc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 19. sensor_collection_records
CREATE TABLE sensor_collection_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  session_id text,
  sensor_key text NOT NULL,
  sensor_spec_version text,
  device_serial text,
  firmware_version text,
  sampling_rate text,
  calibration_status text,
  start_time timestamptz,
  end_time timestamptz,
  raw_file_reference text,
  file_size bigint,
  checksum text,
  packet_loss_record text,
  quality_flag text,
  operator text,
  incident text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT scr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 20. event_log_batches
CREATE TABLE event_log_batches (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  session_id text,
  application_version text,
  event_dictionary_version text,
  start_time timestamptz,
  end_time timestamptz,
  event_count integer,
  raw_log_reference text,
  checksum text,
  ingestion_status text NOT NULL DEFAULT 'RECEIVED' CHECK (ingestion_status IN ('RECEIVED', 'VALIDATION_PENDING', 'VALIDATED_AS_RECEIVED', 'QUARANTINED', 'CORRECTION_LINKED', 'FROZEN', 'LOCKED')),
  missing_event_alert text,
  duplicate_event_alert text,
  timestamp_alert text,
  schema_validation_status text NOT NULL DEFAULT 'PENDING' CHECK (schema_validation_status IN ('PENDING', 'PASS', 'FAIL', 'QUARANTINED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elb_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT elb_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 21. ai_experiment_runs
CREATE TABLE ai_experiment_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  run_id text NOT NULL,
  model_version text,
  code_version text,
  environment_version text,
  dataset_version text,
  split_manifest text,
  random_seed text,
  configuration text,
  prompt_version text,
  training_log_reference text,
  inference_log_reference text,
  prediction_file_reference text,
  error_log_reference text,
  run_status text NOT NULL DEFAULT 'CREATED' CHECK (run_status IN ('CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'QUARANTINED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ae_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ae_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, run_id)
);

-- 22. data_ingestion_batches
CREATE TABLE data_ingestion_batches (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  source_type text NOT NULL,
  source_files jsonb NOT NULL DEFAULT '[]',
  protocol_version text,
  data_schema_version text,
  imported_by text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer,
  file_count integer,
  checksum text,
  validation_status text NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALIDATED', 'QUARANTINED', 'REJECTED')),
  duplicate_status text NOT NULL DEFAULT 'UNKNOWN',
  error_count integer NOT NULL DEFAULT 0,
  quarantine_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dib_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT dib_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 23. raw_data_assets（Raw Data 不可變）
CREATE TABLE raw_data_assets (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  data_type text NOT NULL,
  data_layer text NOT NULL DEFAULT 'RESEARCH_RAW' CHECK (data_layer IN ('IDENTITY', 'RESEARCH_RAW', 'SENSOR_RAW', 'SYSTEM_LOG_RAW', 'QUALITATIVE_RAW', 'FIELD_RAW', 'AI_RAW', 'ADMIN', 'CONSENT_ETHICS', 'OPERATIONAL')),
  source text NOT NULL,
  participant_or_unit_scope text,
  site text,
  file_name text,
  file_format text,
  file_size bigint,
  checksum text,
  storage_location text,
  access_level text NOT NULL DEFAULT 'RESTRICTED',
  encryption_status text,
  de_identification_status text,
  ingestion_batch_id text,
  status text NOT NULL DEFAULT 'CAPTURING' CHECK (status IN ('CAPTURING', 'RECEIVED', 'VALIDATION_PENDING', 'VALIDATED_AS_RECEIVED', 'QUARANTINED', 'CORRECTION_LINKED', 'FROZEN', 'LOCKED', 'ARCHIVED')),
  synthetic boolean NOT NULL DEFAULT false,
  pilot_origin boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT ra_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 24. raw_data_manifest_entries
CREATE TABLE raw_data_manifest_entries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  asset_id text,
  data_type text NOT NULL,
  date_range text,
  protocol_version text,
  completeness_status text NOT NULL DEFAULT 'PENDING',
  correction_links jsonb NOT NULL DEFAULT '[]',
  query_status text NOT NULL DEFAULT 'NONE' CHECK (query_status IN ('NONE', 'OPEN', 'RESOLVED')),
  lock_status text NOT NULL DEFAULT 'UNLOCKED' CHECK (lock_status IN ('UNLOCKED', 'FROZEN', 'LOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rme_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT rme_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 25. follow_up_records
CREATE TABLE follow_up_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  planned_time_point text NOT NULL,
  allowable_window text,
  scheduled_date timestamptz,
  reminder_status text,
  contact_attempts integer NOT NULL DEFAULT 0,
  completion_date timestamptz,
  completion_status text NOT NULL DEFAULT 'PENDING' CHECK (completion_status IN ('PENDING', 'COMPLETED', 'MISSED', 'RESCHEDULED', 'WITHDRAWN')),
  missing_reason text,
  data_captured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fu_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT fu_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id, participant_code, planned_time_point)
);

-- 26. participant_withdrawals
CREATE TABLE participant_withdrawals (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text NOT NULL,
  withdrawal_date timestamptz,
  reason_category text,
  participant_requested_data_removal boolean NOT NULL DEFAULT false,
  permitted_data_retention text,
  safety_followup_required boolean NOT NULL DEFAULT false,
  impact_on_study text,
  consent_terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pw_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT pw_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 27. protocol_deviations_formal
CREATE TABLE protocol_deviations_formal (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  session_id text,
  protocol_version text,
  affected_section text,
  planned_action text,
  actual_action text,
  cause text,
  detected_at timestamptz,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  participant_impact text,
  data_impact text,
  safety_impact text,
  corrective_action text,
  preventive_action text,
  ethics_report_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'ACCEPTED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT pdf_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 28. adverse_events_formal
CREATE TABLE adverse_events_formal (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  participant_code text,
  event_date timestamptz,
  event_type text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MODERATE', 'SEVERE', 'SERIOUS')),
  expectedness text NOT NULL DEFAULT 'UNEXPECTED',
  relatedness_assessment text,
  immediate_action text,
  referral text,
  study_interruption text,
  reporting_deadline timestamptz,
  reported_to_institution boolean NOT NULL DEFAULT false,
  report_reference text,
  resolution text,
  reviewer text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED')),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aef_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT aef_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 29. data_queries
CREATE TABLE data_queries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  source_record text,
  issue text NOT NULL,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  assigned_to text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  response text,
  supporting_evidence text,
  resolved_at timestamptz,
  resolution_status text NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_AS_IS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dq_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT dq_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 30. study_amendments + 31. study_pause_records
CREATE TABLE study_amendments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  change_request text NOT NULL,
  scientific_reason text,
  operational_reason text,
  affected_documents jsonb NOT NULL DEFAULT '[]',
  ethics_impact text,
  preregistration_impact text,
  statistical_impact text,
  approval_status text NOT NULL DEFAULT 'DRAFT' CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  effective_date timestamptz,
  reconsent_required boolean NOT NULL DEFAULT false,
  retraining_required boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sam_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT sam_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);
CREATE TABLE study_pause_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  pause_type text NOT NULL,
  reason text NOT NULL,
  authority text,
  pause_date timestamptz NOT NULL DEFAULT now(),
  affected_participants text,
  required_action text,
  restart_conditions text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT spr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 32. data_collection_closeouts + 33. raw_data_freeze/lock + 34. data_collection_reports + 35. data_availability_checks + 36. execution_snapshots
CREATE TABLE data_collection_closeouts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'CLOSEOUT_NOT_STARTED' CHECK (status IN ('CLOSEOUT_NOT_STARTED', 'CLOSEOUT_IN_PROGRESS', 'OPEN_QUERIES', 'SAFETY_REVIEW_REQUIRED', 'DATA_RECONCILIATION_REQUIRED', 'READY_FOR_CLOSEOUT', 'DATA_COLLECTION_CLOSED')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dcc_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT dcc_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id)
);
CREATE TABLE raw_data_lock_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('FREEZE', 'LOCK')),
  checks jsonb NOT NULL DEFAULT '[]',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  CONSTRAINT rdl_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT rdl_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);
CREATE TABLE data_collection_reports (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}',
  version text NOT NULL DEFAULT 'v1.0',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dcr_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT dcr_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, formal_study_id)
);
CREATE TABLE data_availability_checks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASS', 'FAIL', 'WARN')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL,
  CONSTRAINT dac_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT dac_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);
CREATE TABLE research_execution_snapshots (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  formal_study_id text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  payload jsonb NOT NULL DEFAULT '{}',
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT res_study_fk FOREIGN KEY (formal_study_id) REFERENCES formal_studies(id) ON DELETE CASCADE,
  CONSTRAINT res_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_fs_tenant ON formal_studies (workspace_id, project_id);
CREATE INDEX idx_psr_t ON participant_study_records (workspace_id, project_id, formal_study_id);
CREATE INDEX idx_ss_t ON study_sessions (workspace_id, project_id, formal_study_id);
CREATE INDEX idx_ra_t ON raw_data_assets (workspace_id, project_id, formal_study_id);
CREATE INDEX idx_pdf_t ON protocol_deviations_formal (workspace_id, project_id, formal_study_id);
CREATE INDEX idx_aef_t ON adverse_events_formal (workspace_id, project_id, formal_study_id);
CREATE INDEX idx_dq_t ON data_queries (workspace_id, project_id, formal_study_id);

COMMIT;
