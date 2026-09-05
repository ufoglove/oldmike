-- 0022 down: Phase 8 — Measurement, Instrument & Protocol Studio
BEGIN;

DROP TABLE IF EXISTS pilot_readiness_packages;
DROP TABLE IF EXISTS protocol_alignment_results;
DROP TABLE IF EXISTS study_protocol_versions;
DROP TABLE IF EXISTS study_protocols;
DROP TABLE IF EXISTS data_capture_fields;
DROP TABLE IF EXISTS measurement_schedules;
DROP TABLE IF EXISTS fidelity_plans;
DROP TABLE IF EXISTS intervention_materials;
DROP TABLE IF EXISTS annotation_guidelines;
DROP TABLE IF EXISTS sensor_specifications;
DROP TABLE IF EXISTS digital_event_definitions;
DROP TABLE IF EXISTS qualitative_instruments;
DROP TABLE IF EXISTS skill_assessments;
DROP TABLE IF EXISTS assessment_items;
DROP TABLE IF EXISTS test_blueprints;
DROP TABLE IF EXISTS instrument_scoring_specs;
DROP TABLE IF EXISTS instrument_translations;
DROP TABLE IF EXISTS instrument_permissions;
DROP TABLE IF EXISTS instrument_evidence_links;
DROP TABLE IF EXISTS project_instrument_versions;
DROP TABLE IF EXISTS project_instrument_links;
DROP TABLE IF EXISTS instrument_catalog_versions;
DROP TABLE IF EXISTS instrument_catalog_items;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE', 'ETHICS_SCOPE_DETERMINED', 'ETHICS_PACKAGE_PREPARED', 'NSTC_INTERNAL_REVIEW_PASSED', 'NSTC_COMPLIANCE_PASSED', 'NSTC_APPLICATION_PACKAGE_READY', 'MOE_TPR_ELIGIBILITY_PASSED', 'MOE_TPR_INTERNAL_REVIEW_PASSED', 'MOE_TPR_COMPLIANCE_PASSED', 'MOE_TPR_APPLICATION_PACKAGE_READY'));

COMMIT;
