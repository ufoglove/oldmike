-- 0016 down: Theory & Mechanism Lab
BEGIN;

DROP TABLE IF EXISTS theory_mechanism_gates;
DROP TABLE IF EXISTS conceptual_models;
DROP TABLE IF EXISTS boundary_conditions;
DROP TABLE IF EXISTS competing_explanations;
DROP TABLE IF EXISTS formal_hypotheses;
DROP TABLE IF EXISTS research_constructs;
DROP TABLE IF EXISTS mechanism_paths;
DROP TABLE IF EXISTS theory_evidence_links;
DROP TABLE IF EXISTS theory_candidates;
DROP TABLE IF EXISTS theory_mechanism_versions;
DROP TABLE IF EXISTS theory_mechanism_analyses;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE'));

COMMIT;
