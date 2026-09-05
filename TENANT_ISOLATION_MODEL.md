# Tenant Isolation Model - v1.4.3

PostgreSQL is the system of record for user ownership, workspace membership,
consent, audit events and the project index. A server Better Auth session
supplies `userId`; every route resolves membership before project access.

Client-supplied `userId`, `workspaceId`, email, path, conversation ID and
Project ID are never authorization claims. Cross-tenant records return the
same generic not-found result. `projects` has
`UNIQUE(workspace_id, project_id)` and `project_artifacts` has a composite
foreign key to that pair, so a project ID cannot be combined with another
workspace.

The shared OpenClaw filesystem and global memory are not tenant boundaries.
New project storage remains fail-closed. Multi-user chat is also fail-closed
with 503 until a restricted agent/tool allowlist and tenant-safe context
adapter are implemented and tested. Prompts cannot replace this gate.

`vr-63bc7bcef3` remains `LEGACY_UNCLAIMED`; only a future one-time,
human-confirmed claim migration could associate it.
