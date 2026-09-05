-- 0015: Gap & Novelty Lab (rollback)
BEGIN;

DROP TABLE IF EXISTS gap_validation_decisions;
DROP TABLE IF EXISTS saturation_assessments;
DROP TABLE IF EXISTS novelty_profiles;
DROP TABLE IF EXISTS contribution_deltas;
DROP TABLE IF EXISTS closest_studies;
DROP TABLE IF EXISTS search_snapshots;
DROP TABLE IF EXISTS literature_search_tasks;
DROP TABLE IF EXISTS gap_evidence_links;
DROP TABLE IF EXISTS gap_claims;
DROP TABLE IF EXISTS gap_novelty_versions;
DROP TABLE IF EXISTS gap_novelty_analyses;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE'));

ALTER TABLE research_blueprints DROP CONSTRAINT research_blueprints_status_check;
ALTER TABLE research_blueprints ADD CONSTRAINT research_blueprints_status_check
  CHECK (status IN ('DRAFT', 'EVIDENCE_INCOMPLETE', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'OUTDATED'));

COMMIT;
