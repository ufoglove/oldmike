-- Exact operator-attempt correlation and explicit revocation for private invitations.
-- Raw invitation credentials and recipient addresses remain absent from the database.
BEGIN;

ALTER TABLE registration_invites
  ADD COLUMN attempt_key text,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by_key text;

ALTER TABLE registration_invites
  ADD CONSTRAINT registration_invites_attempt_key_format_check
    CHECK (attempt_key IS NULL OR attempt_key ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT registration_invites_attempt_key_unique UNIQUE (attempt_key),
  ADD CONSTRAINT registration_invites_revoked_by_key_format_check
    CHECK (revoked_by_key IS NULL OR revoked_by_key ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT registration_invites_revocation_pair_check
    CHECK ((revoked_at IS NULL) = (revoked_by_key IS NULL)),
  ADD CONSTRAINT registration_invites_used_or_revoked_check
    CHECK (NOT (used_at IS NOT NULL AND revoked_at IS NOT NULL)),
  ADD CONSTRAINT registration_invites_revoked_not_reserved_check
    CHECK (revoked_at IS NULL OR (reserved_at IS NULL AND reservation_id IS NULL));

DROP INDEX registration_invites_available_idx;
CREATE INDEX registration_invites_available_idx
  ON registration_invites(expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

COMMIT;
