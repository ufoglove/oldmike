-- 0009 down: drop Submission Navigator structured records (fail closed on data)
BEGIN;

DO $migration_0009_down_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM submission_navigator_runs)
     OR EXISTS (SELECT 1 FROM submission_journal_candidates)
     OR EXISTS (SELECT 1 FROM submission_funding_routes)
     OR EXISTS (SELECT 1 FROM submission_compliance_items)
     OR EXISTS (SELECT 1 FROM submission_evidence_items)
     OR EXISTS (SELECT 1 FROM topic_versions)
     OR EXISTS (SELECT 1 FROM submission_projects) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_0009_DOWN_BLOCKED_SUBMISSION_NAVIGATOR_DATA_PRESENT';
  END IF;
END
$migration_0009_down_guard$;

DROP TRIGGER IF EXISTS submission_navigator_runs_append_only ON submission_navigator_runs;
DROP TRIGGER IF EXISTS submission_journal_candidates_append_only ON submission_journal_candidates;
DROP TRIGGER IF EXISTS submission_funding_routes_append_only ON submission_funding_routes;
DROP TRIGGER IF EXISTS submission_compliance_items_append_only ON submission_compliance_items;
DROP TRIGGER IF EXISTS submission_evidence_items_append_only ON submission_evidence_items;
DROP TRIGGER IF EXISTS topic_versions_append_only ON topic_versions;
DROP TRIGGER IF EXISTS submission_projects_append_only ON submission_projects;

DROP TABLE IF EXISTS submission_projects;
DROP TABLE IF EXISTS topic_versions;
DROP TABLE IF EXISTS submission_evidence_items;
DROP TABLE IF EXISTS submission_compliance_items;
DROP TABLE IF EXISTS submission_funding_routes;
DROP TABLE IF EXISTS submission_journal_candidates;
DROP TABLE IF EXISTS submission_navigator_runs;

COMMIT;
