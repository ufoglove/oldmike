BEGIN;

-- Removing the revocation/correlation columns from any invitation row would
-- destroy operator provenance or lifecycle meaning.  The downgrade is only
-- valid for an empty invitation table; do not inspect or disclose row data.
DO $migration_0004_down_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM registration_invites) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_0004_DOWN_BLOCKED_REGISTRATION_INVITES_NOT_EMPTY';
  END IF;
END
$migration_0004_down_guard$;

DROP INDEX registration_invites_available_idx;
CREATE INDEX registration_invites_available_idx
  ON registration_invites(expires_at)
  WHERE used_at IS NULL;

ALTER TABLE registration_invites
  DROP CONSTRAINT registration_invites_revoked_not_reserved_check,
  DROP CONSTRAINT registration_invites_used_or_revoked_check,
  DROP CONSTRAINT registration_invites_revocation_pair_check,
  DROP CONSTRAINT registration_invites_revoked_by_key_format_check,
  DROP CONSTRAINT registration_invites_attempt_key_unique,
  DROP CONSTRAINT registration_invites_attempt_key_format_check,
  DROP COLUMN revoked_by_key,
  DROP COLUMN revoked_at,
  DROP COLUMN attempt_key;

COMMIT;
