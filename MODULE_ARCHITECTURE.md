# Module Architecture v1.4.3

```text
Browser
  -> Better Auth browser endpoints (same-origin only)
  -> Portal server route
       -> server session
       -> PostgreSQL workspace membership
       -> TenantProjectGateway / ProjectRepository
       -> optional OpenClaw context (derived conversation ID only)
```

`app/page.tsx` renders `GuidedResearchCenter`, which retains the v1.3 topic,
radar, evidence and S0 workflows. Authentication screens are separate App
Router pages and contain no server secrets.

PostgreSQL is the system of record for new account ownership and project
indexes. The Better Auth database owns users, sessions, accounts and
verifications. `workspace_id` is required on projects and artifacts. A client
cannot choose `userId`, `workspaceId`, a project path or an OpenClaw
conversation ID as authorization input.

The shared OpenClaw filesystem and global memory are not tenant boundaries.
Until safe tenant storage is approved, project creation and shared-filesystem
writes fail closed. Legacy `vr-63bc7bcef3` stays unclaimed and is not visible
to new users.

Research OS remains the routing authority. The Portal does not add a second
research orchestrator; future modules remain explicit navigation contracts
until their artifacts and human gates exist.
