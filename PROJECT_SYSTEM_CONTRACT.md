# Project System Contract - v1.4.3

PostgreSQL is the ownership index for new multi-user projects. The request
must obtain `userId` from Better Auth server session and resolve
`workspace_members` before list/get/create/update/chat/export. Client identity,
workspace, path and Project ID values are untrusted.

Project creation and shared OpenClaw writes remain 503 until tenant-safe
storage is reviewed. `vr-63bc7bcef3` remains `LEGACY_UNCLAIMED` and is never
auto-claimed. Multi-user chat is 503 until a restricted agent and context
adapter exists; a system prompt cannot enforce tenant isolation.

S0 preview still requires deterministic hash and explicit human confirmation.
Existing v1.3 evidence/legacy compatibility remains visible and is never
written back to live projects.
