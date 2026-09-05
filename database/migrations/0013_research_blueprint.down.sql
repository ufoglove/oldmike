-- 0013: Research Blueprint (rollback)
BEGIN;

DROP TABLE IF EXISTS research_blueprint_evidence_links;
DROP TABLE IF EXISTS research_blueprint_risks;
DROP TABLE IF EXISTS research_blueprint_outputs;
DROP TABLE IF EXISTS research_blueprint_milestones;
DROP TABLE IF EXISTS research_blueprint_workpackages;
DROP TABLE IF EXISTS research_blueprint_variables;
DROP TABLE IF EXISTS research_blueprint_hypotheses;
DROP TABLE IF EXISTS research_blueprint_questions;
DROP TABLE IF EXISTS research_blueprint_objectives;
DROP TABLE IF EXISTS research_blueprint_versions;
DROP TABLE IF EXISTS research_blueprints;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION'));

COMMIT;
