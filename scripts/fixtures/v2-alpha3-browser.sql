INSERT INTO "user" (id, name, email, "emailVerified")
VALUES ('fixture-user-v2', 'Fixture Alpha3', 'fixture-alpha3-browser@example.invalid', true);

INSERT INTO workspaces (id, name, owner_user_id)
VALUES ('fixture-workspace-v2', 'Alpha3 Browser', 'fixture-user-v2');

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('fixture-workspace-v2', 'fixture-user-v2', 'owner');

INSERT INTO projects (project_id,workspace_id,created_by,title,status,legacy,storage_backend)
VALUES ('fixture-project-v2','fixture-workspace-v2','fixture-user-v2','Alpha3 explicit import fixture','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE');
