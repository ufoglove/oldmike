-- Old Mike tenant index and immutable consent/audit records.
-- PostgreSQL is the ownership system of record. No OpenClaw path is stored
-- as an authorization claim.
BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_idx ON workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  project_id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'LEGACY_UNCLAIMED')),
  legacy boolean NOT NULL DEFAULT false,
  storage_backend text NOT NULL CHECK (storage_backend IN ('POSTGRES_INDEX_PENDING_SAFE_STORAGE', 'OPENCLAW_CONTROLLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (legacy = false OR status = 'LEGACY_UNCLAIMED'),
  CONSTRAINT projects_workspace_project_unique UNIQUE (workspace_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_artifacts (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  workspace_id text NOT NULL,
  artifact_type text NOT NULL,
  content_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_artifacts_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_consents (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL,
  user_agent_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION reject_consent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'user_consents_are_immutable';
END;
$$;
DROP TRIGGER IF EXISTS user_consents_immutable_update ON user_consents;
CREATE TRIGGER user_consents_immutable_update BEFORE UPDATE OR DELETE ON user_consents FOR EACH ROW EXECUTE FUNCTION reject_consent_mutation();

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_artifacts_tenant_idx ON project_artifacts(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS audit_events_tenant_idx ON audit_events(workspace_id, created_at DESC);

COMMIT;
