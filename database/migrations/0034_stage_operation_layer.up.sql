-- 0034_stage_operation_layer.up.sql
-- Migration 0034: Stage Operation Layer, Field Locks, Requirement Issues & Completion Handoffs

CREATE TABLE IF NOT EXISTS field_locks (
  id text PRIMARY KEY DEFAULT ('flk_' || gen_random_uuid()::text),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  stage_id text NOT NULL,
  entity_id text NOT NULL DEFAULT 'default',
  field_ref text NOT NULL,
  locked_value jsonb NOT NULL,
  lock_version int NOT NULL DEFAULT 1,
  locked_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  lock_reason text,
  lock_policy text NOT NULL DEFAULT 'MANUAL' CHECK (lock_policy IN ('MANUAL', 'AUTOMATION_POLICY', 'SYSTEM_ENFORCED')),
  source_version_id text,
  is_stale boolean NOT NULL DEFAULT false,
  stale_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_locks_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT field_locks_unique_scope UNIQUE (workspace_id, project_id, stage_id, entity_id, field_ref)
);

CREATE INDEX IF NOT EXISTS field_locks_project_stage_idx
  ON field_locks(workspace_id, project_id, stage_id);

CREATE TABLE IF NOT EXISTS requirement_issues (
  id text PRIMARY KEY DEFAULT ('iss_' || gen_random_uuid()::text),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  stage_id text NOT NULL,
  requirement_id text NOT NULL,
  entity_id text NOT NULL DEFAULT 'default',
  field_ref text NOT NULL,
  status text NOT NULL DEFAULT 'MISSING' CHECK (status IN ('MISSING', 'STALE', 'INVALID', 'CONFLICT', 'SATISFIED')),
  blocks_transition boolean NOT NULL DEFAULT true,
  message text NOT NULL,
  expected_revision text,
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  assist_actions text[] NOT NULL DEFAULT ARRAY['EXPLAIN', 'DRAFT_FROM_CONTEXT']::text[],
  requires_user_fact boolean NOT NULL DEFAULT false,
  return_context_id text,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requirement_issues_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT requirement_issues_unique_scope UNIQUE (workspace_id, project_id, stage_id, requirement_id, entity_id)
);

CREATE INDEX IF NOT EXISTS requirement_issues_project_stage_idx
  ON requirement_issues(workspace_id, project_id, stage_id, blocks_transition);

CREATE TABLE IF NOT EXISTS stage_completion_snapshots (
  id text PRIMARY KEY DEFAULT ('scs_' || gen_random_uuid()::text),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  stage_id text NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'HANDOFF_READY', 'SUPERSEDED')),
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  topic_snapshot jsonb,
  lock_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  handoff_limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  downstream_open_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_stage_id text,
  created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stage_completion_snapshots_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT stage_completion_unique_idempotency UNIQUE (workspace_id, project_id, stage_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS stage_completion_snapshots_lookup_idx
  ON stage_completion_snapshots(workspace_id, project_id, stage_id, created_at DESC);
