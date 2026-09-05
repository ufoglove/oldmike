# Old Mike Research Portal v1.5.3

Local-only Research Workflow Phase 2 candidate, selectively integrated onto
the authoritative v1.4.20 source and rollback baseline. The online Portal
remains v1.4.20, connected, with registration closed. v1.5.3 is not deployed.

The v1.4.11 deployment failed before application startup and made no database
write. Its ZIP stored nested entries with Windows `\\` separators, so Linux
extraction did not create `scripts/clean-build-artifact.mjs`. It was safely
rolled back to v1.4.10. Never retry or repack the v1.4.11 archives.

Browser requests reach the Portal server, which uses Better Auth, PostgreSQL
and Resend server-side. Project authorization derives user/workspace ownership
from the server session and database membership. OpenClaw is not an
authorization boundary; tenant writes and multi-user Chat remain fail-closed.

Registration defaults to closed. Approved staging accounts use Email-bound,
expiring, one-time HMAC invitations. Invitation work requires a separately
approved runbook and is not part of this packaging patch.

Local verification:

```text
pnpm install --frozen-lockfile
pnpm test:release
pnpm test:runtime-artifact
pnpm test:release:real   # creates and removes loopback disposable PostgreSQL 18
```

Release archive verification from the Workspace root:

```text
node scripts/verify-release-archive-contract.mjs
node scripts/build-release-packages.mjs
node scripts/verify-release-archives.mjs
```

The archive contract inspects raw ZIP entry names without normalizing them,
requires POSIX `/` separators and the exact Linux build-script path, compares
every archived file to source, and performs a clean Linux-style extraction.

Tests do not send real mail. Do not deploy, claim legacy data or enable
external search from this workspace.
