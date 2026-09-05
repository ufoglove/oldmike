-- Fail closed before dropping any Beta2 object when any durable row exists.
BEGIN;

DO $$
DECLARE
  relation_name text;
  populated boolean;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'beta2_operation_intents',
    'beta2_project_events',
    'beta2_project_snapshots',
    'beta2_generation_receipts',
    'beta2_generation_jobs'
  ] LOOP
    IF to_regclass('public.' || relation_name) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I LIMIT 1)', relation_name) INTO populated;
      IF populated THEN
        RAISE EXCEPTION 'beta2_down_refuses_nonempty:%', relation_name;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA old_mike_beta2_private FROM old_mike_beta2_app;
REVOKE USAGE ON SCHEMA old_mike_beta2_private FROM old_mike_beta2_app;
DROP SCHEMA old_mike_beta2_private CASCADE;
REVOKE ALL ON TABLE beta2_operation_intents, beta2_project_events, beta2_project_snapshots, beta2_generation_receipts, beta2_generation_jobs FROM old_mike_beta2_app, old_mike_beta2_owner;
REVOKE SELECT ON projects, workspace_members FROM old_mike_beta2_app, old_mike_beta2_owner;
DROP TABLE beta2_operation_intents;
DROP TABLE beta2_project_events;
DROP TABLE beta2_project_snapshots;
DROP TABLE beta2_generation_receipts;
DROP TABLE beta2_generation_jobs;
DROP FUNCTION beta2_guard_snapshot_insert();
DROP FUNCTION beta2_guard_job_insert();
DROP FUNCTION beta2_guard_job_mutation();
DROP FUNCTION beta2_guard_operation_intent_mutation();
DROP FUNCTION beta2_reject_append_mutation();
DROP FUNCTION beta2_guard_receipt_insert();
DROP FUNCTION beta2_guard_event_insert();
DROP FUNCTION beta2_validate_job_receipt_pair();
DROP FUNCTION beta2_validate_snapshot_event_pair();
DROP ROLE old_mike_beta2_owner;

COMMIT;
