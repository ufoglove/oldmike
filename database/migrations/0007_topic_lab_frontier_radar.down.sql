BEGIN;

DO $migration_0007_down_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM research_topic_lab_runs)
     OR EXISTS (SELECT 1 FROM research_topic_lab_promotions)
     OR EXISTS (SELECT 1 FROM research_human_gates WHERE gate_type = 'RESEARCH_DIRECTION') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_0007_DOWN_BLOCKED_TOPIC_LAB_DATA_PRESENT';
  END IF;
END
$migration_0007_down_guard$;

DROP TRIGGER research_topic_lab_promotions_append_only ON research_topic_lab_promotions;
DROP TRIGGER research_topic_lab_runs_append_only ON research_topic_lab_runs;
DROP TABLE research_topic_lab_promotions;
DROP TABLE research_topic_lab_runs;

ALTER TABLE research_human_gates
  DROP CONSTRAINT research_human_gates_gate_type_check;
ALTER TABLE research_human_gates
  ADD CONSTRAINT research_human_gates_gate_type_check
  CHECK (gate_type IN ('EVIDENCE_VERIFICATION', 'CLAIM_SUPPORT', 'RESULTS_RELEASE', 'DOCUMENT_RELEASE', 'ARCHIVE_RELEASE'));

COMMIT;
