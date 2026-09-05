# AI Assist Contract v1.4.3

## Server and tenant boundary

The browser calls Portal `/api/assist/*` only. Each assist request must first
obtain the Better Auth server session and, for project-scoped work, verify the
PostgreSQL workspace membership. The Portal calls OpenClaw server-side through
the private allowlist; OpenClaw is not a tenant boundary. Assist output is
never written to a project, `MEMORY.md` or the shared workspace.

## Modes

- `AI_CONCEPT` remains available without external search and returns concepts
  marked `AI_PROPOSED` / `UNVERIFIED`. It must not claim recent, hot, frontier,
  novel or literature-supported results.
- `FRESH_VERIFIED` requires genuine retrieval through the fixed Crossref
  allowlist. It remains separate from `AI_CONCEPT` and fails closed when
  retrieval is unavailable.
- S0 drafts can consume either mode, but evidence remains `UNVERIFIED` and a
  Human Gate is required.

## Evidence contract

`sourceIdentityStatus` and `claimSupportStatus` are separate. Metadata that
matches a trusted Crossref response can be `SOURCE_METADATA_VERIFIED`; it
cannot become `CLAIM_VERIFIED` without a locator and reliable server-side or
human claim-to-source review. Model output cannot promote itself to any
verified state.

## Auth and project writes

Missing production auth/database/email configuration returns 503; a valid
configuration without a session returns 401. Project list/get/create/chat
must derive identity from the server session and workspace membership. New
project creation remains fail-closed until a tenant-safe storage backend is
approved, so no user request can trigger `project-init` in this candidate.
