-- 0020 down: Phase 7 — 研究倫理／IRB中心＋審查合規＋計畫申請包
BEGIN;

DROP TABLE IF EXISTS grant_decision_records;
DROP TABLE IF EXISTS proposal_submission_records;
DROP TABLE IF EXISTS proposal_package_files;
DROP TABLE IF EXISTS proposal_application_packages;
DROP TABLE IF EXISTS compliance_items;
DROP TABLE IF EXISTS official_rule_snapshots;
DROP TABLE IF EXISTS revision_tasks;
DROP TABLE IF EXISTS reviewer_findings;
DROP TABLE IF EXISTS route_review_runs;
DROP TABLE IF EXISTS journal_study_readiness_reviews;
DROP TABLE IF EXISTS preregistration_amendments;
DROP TABLE IF EXISTS preregistration_versions;
DROP TABLE IF EXISTS preregistration_plans;
DROP TABLE IF EXISTS data_management_plans;
DROP TABLE IF EXISTS ethics_documents;
DROP TABLE IF EXISTS institutional_ethics_decisions;
DROP TABLE IF EXISTS ethics_risk_items;
DROP TABLE IF EXISTS ethics_scope_items;
DROP TABLE IF EXISTS research_ethics_assessments;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE', 'JOURNAL_RESEARCH_PLAN_RELEASE', 'NSTC_PROPOSAL_DRAFT_RELEASE', 'MOE_TPR_PROPOSAL_DRAFT_RELEASE'));

COMMIT;
