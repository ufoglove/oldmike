-- 0010 down: drop Phase 2 tables (fail closed on data)
BEGIN;

DO $migration_0010_down_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM submission_rule_snapshots)
     OR EXISTS (SELECT 1 FROM submission_journal_details)
     OR EXISTS (SELECT 1 FROM submission_journal_marks) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_0010_DOWN_BLOCKED_SUBMISSION_NAVIGATOR_PHASE2_DATA_PRESENT';
  END IF;
END
$migration_0010_down_guard$;

DROP TRIGGER IF EXISTS submission_rule_snapshots_append_only ON submission_rule_snapshots;
DROP TRIGGER IF EXISTS submission_journal_details_append_only ON submission_journal_details;
DROP TRIGGER IF EXISTS submission_journal_marks_append_only ON submission_journal_marks;

DROP TABLE IF EXISTS submission_journal_marks;
DROP TABLE IF EXISTS submission_journal_details;
DROP TABLE IF EXISTS submission_rule_snapshots;

COMMIT;
