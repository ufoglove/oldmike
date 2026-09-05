INSERT INTO "user" (id, name, email, "emailVerified")
VALUES ('fixture-user-v2', 'Fixture Alpha2', 'fixture-alpha2-browser@example.invalid', true);

INSERT INTO workspaces (id, name, owner_user_id)
VALUES ('fixture-workspace-v2', 'Alpha2 Browser', 'fixture-user-v2');

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('fixture-workspace-v2', 'fixture-user-v2', 'owner');
