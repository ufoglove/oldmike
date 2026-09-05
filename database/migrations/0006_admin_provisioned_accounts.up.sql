BEGIN;

CREATE TABLE portal_administrator (
  singleton_key smallint PRIMARY KEY DEFAULT 1,
  user_id text NOT NULL UNIQUE REFERENCES "user" (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_administrator_singleton CHECK (singleton_key = 1)
);

CREATE TABLE account_provisioning_state (
  user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE RESTRICT,
  status text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  temporary_password_expires_at timestamptz,
  password_version integer NOT NULL DEFAULT 1,
  password_changed_at timestamptz,
  created_by_admin_id text REFERENCES portal_administrator (user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_provisioning_state_status_check CHECK (
    status IN ('ACTIVE', 'PASSWORD_CHANGE_REQUIRED', 'DISABLED')
  ),
  CONSTRAINT account_provisioning_state_password_version_check CHECK (password_version >= 1),
  CONSTRAINT account_provisioning_state_temporary_password_check CHECK (
    (must_change_password AND temporary_password_expires_at IS NOT NULL)
    OR (NOT must_change_password AND temporary_password_expires_at IS NULL)
  ),
  CONSTRAINT account_provisioning_state_required_status_check CHECK (
    status <> 'PASSWORD_CHANGE_REQUIRED' OR must_change_password
  )
);

CREATE INDEX account_provisioning_state_status_idx
  ON account_provisioning_state (status, updated_at DESC);

CREATE TABLE account_admin_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_admin_id text NOT NULL REFERENCES portal_administrator (user_id) ON DELETE RESTRICT,
  target_user_key char(64) NOT NULL,
  event_kind text NOT NULL,
  idempotency_key char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_admin_events_target_key_check CHECK (target_user_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT account_admin_events_idempotency_key_check CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT account_admin_events_kind_check CHECK (
    event_kind IN (
      'ADMIN_BOOTSTRAPPED',
      'ACCOUNT_PROVISIONED',
      'TEMPORARY_PASSWORD_RESET',
      'ACCOUNT_DISABLED',
      'ACCOUNT_ENABLED',
      'SESSIONS_REVOKED',
      'PASSWORD_CHANGED'
    )
  )
);

CREATE INDEX account_admin_events_actor_created_idx
  ON account_admin_events (actor_admin_id, created_at DESC);
CREATE INDEX account_admin_events_target_created_idx
  ON account_admin_events (target_user_key, created_at DESC);

CREATE FUNCTION account_admin_events_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $account_admin_events_are_append_only$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'ACCOUNT_ADMIN_EVENTS_APPEND_ONLY';
END;
$account_admin_events_are_append_only$;

CREATE TRIGGER account_admin_events_are_append_only
BEFORE UPDATE OR DELETE ON account_admin_events
FOR EACH ROW EXECUTE FUNCTION account_admin_events_are_append_only();

COMMIT;
