# Old Mike Research Portal v1.5.3 Deployment Boundary

This local candidate is not authorized for deployment by this metadata patch. If later approved, update
only the existing Zeabur `research-portal`; never create a second Portal or
modify `oldmike`, `ollama-embeddings`, the OpenClaw workspace, `MEMORY.md` or
live projects.

The v1.4.11 archives are permanently disallowed. Their raw ZIP entries used
Windows `\\` separators, and Zeabur's Linux extraction could not resolve
`scripts/clean-build-artifact.mjs`. That deployment failed before application
startup, wrote no database rows and was rolled back to v1.4.10.

Before any separately authorized v1.5.3 upload, all of the following must pass against the exact
candidate archives:

```text
node scripts/verify-release-archive-contract.mjs
node scripts/verify-release-archives.mjs
```

The raw archive inventory must contain only POSIX `/` paths. The Portal must
contain the exact entry `scripts/clean-build-artifact.mjs`; the Workspace must
contain `Old_Mike_Codex_Workspace/research-portal/scripts/clean-build-artifact.mjs`.
Both archives must cleanly extract and match source content byte-for-byte.

The user-created PostgreSQL service and verified Resend domain are external
prerequisites, not deployment authorization. Migration 0004 is already applied
online; v1.4.20 adds no up migration and must not rerun 0001-0004. Begin and end
with `REGISTRATION_MODE=closed`, keep Chat fail-closed and keep
`OPENCLAW_EXTERNAL_SEARCH=false`.

The runtime artifact must pass isolated Next, React, React DOM, React DOM
server, scheduler and `pg` resolution plus standalone `/api/health`, `/login`
and home rendering. A deployment still requires separate explicit approval,
read-only smoke testing and the existing rollback boundary.
