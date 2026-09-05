-- 0023 down: Phase 9 — Pilot Study, Instrument Pretest & Protocol Validation Center
BEGIN;

DROP TABLE IF EXISTS team_training_records;
DROP TABLE IF EXISTS formal_study_readiness_assessments;
DROP TABLE IF EXISTS protocol_validation_items;
DROP TABLE IF EXISTS pilot_reports;
DROP TABLE IF EXISTS pilot_decisions;
DROP TABLE IF EXISTS ethics_amendment_requirements;
DROP TABLE IF EXISTS material_change_assessments;
DROP TABLE IF EXISTS pilot_revision_tasks;
DROP TABLE IF EXISTS pilot_issues;
DROP TABLE IF EXISTS pilot_adverse_events;
DROP TABLE IF EXISTS pilot_protocol_deviations;
DROP TABLE IF EXISTS pilot_analysis_runs;
DROP TABLE IF EXISTS pilot_recruitment_summaries;
DROP TABLE IF EXISTS intervention_pilot_results;
DROP TABLE IF EXISTS ai_model_pilot_results;
DROP TABLE IF EXISTS log_validation_results;
DROP TABLE IF EXISTS sensor_pilot_results;
DROP TABLE IF EXISTS technical_pilot_runs;
DROP TABLE IF EXISTS pilot_pretest_results;
DROP TABLE IF EXISTS expert_content_reviews;
DROP TABLE IF EXISTS cognitive_interview_records;
DROP TABLE IF EXISTS pilot_datasets;
DROP TABLE IF EXISTS pilot_sessions;
DROP TABLE IF EXISTS pilot_execution_authorizations;
DROP TABLE IF EXISTS pilot_success_criteria;
DROP TABLE IF EXISTS pilot_components;
DROP TABLE IF EXISTS pilot_study_versions;
DROP TABLE IF EXISTS pilot_studies;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY', 'INSTRUMENTS_AND_PROTOCOL_APPROVED'));

COMMIT;
