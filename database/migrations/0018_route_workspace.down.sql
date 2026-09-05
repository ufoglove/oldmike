-- 0018 down: Route Workspace（Phase 6）
BEGIN;
DROP TABLE IF EXISTS course_research_alignment_items;
DROP TABLE IF EXISTS route_workspace_outdated_marks;
DROP TABLE IF EXISTS route_workspace_gates;
DROP TABLE IF EXISTS route_workspace_section_versions;
DROP TABLE IF EXISTS route_workspace_sections;
DROP TABLE IF EXISTS route_workspace_versions;
DROP TABLE IF EXISTS route_workspaces;

ALTER TABLE research_human_gates DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE', 'RESEARCH_DIRECTION', 'BLUEPRINT_RELEASE', 'GAP_AND_NOVELTY_RELEASE', 'THEORY_AND_MECHANISM_RELEASE', 'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE'));
COMMIT;
