-- 0017 down: Research Design Lab
BEGIN;

DROP TABLE IF EXISTS research_design_gates;
DROP TABLE IF EXISTS design_evidence_links;
DROP TABLE IF EXISTS design_candidates;
DROP TABLE IF EXISTS research_design_versions;
DROP TABLE IF EXISTS research_design_analyses;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE'));

COMMIT;
