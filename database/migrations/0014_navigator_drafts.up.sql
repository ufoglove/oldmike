-- 0014: Navigator draft persistence — server-side auto-save of the submission navigator form
BEGIN;

CREATE TABLE navigator_drafts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  draft_type text NOT NULL DEFAULT 'navigator_form' CHECK (draft_type IN ('navigator_form')),
  payload jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT navigator_drafts_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, draft_type)
);

CREATE INDEX navigator_drafts_project_idx ON navigator_drafts(workspace_id, project_id);

COMMIT;
