-- One-time, email-bound invitations for controlled account creation.
-- Raw invitation tokens and plaintext recipient addresses are never stored.
BEGIN;

CREATE TABLE IF NOT EXISTS registration_invites (
  id text PRIMARY KEY,
  token_key text NOT NULL UNIQUE CHECK (token_key ~ '^[a-f0-9]{64}$'),
  email_key text NOT NULL CHECK (email_key ~ '^[a-f0-9]{64}$'),
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  expires_at timestamptz NOT NULL,
  reserved_at timestamptz,
  reservation_id text UNIQUE,
  used_at timestamptz,
  used_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_key text NOT NULL CHECK (created_by_key ~ '^[a-f0-9]{64}$'),
  CHECK (expires_at > created_at),
  CHECK ((reservation_id IS NULL) = (reserved_at IS NULL)),
  CHECK ((used_at IS NULL) = (used_by_user_id IS NULL))
);

CREATE INDEX IF NOT EXISTS registration_invites_email_idx ON registration_invites(email_key, expires_at DESC);
CREATE INDEX IF NOT EXISTS registration_invites_available_idx ON registration_invites(expires_at) WHERE used_at IS NULL;

COMMIT;
