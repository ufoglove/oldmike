BEGIN;

DO $migration_0006_down_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM portal_administrator)
    OR EXISTS (SELECT 1 FROM account_provisioning_state)
    OR EXISTS (SELECT 1 FROM account_admin_events)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_0006_DOWN_BLOCKED_ADMIN_PROVISIONED_ACCOUNTS_NOT_EMPTY';
  END IF;
END;
$migration_0006_down_guard$;

DROP TRIGGER account_admin_events_are_append_only ON account_admin_events;
DROP FUNCTION account_admin_events_are_append_only();
DROP TABLE account_admin_events;
DROP TABLE account_provisioning_state;
DROP TABLE portal_administrator;

COMMIT;
