# v1.4.18 Single-Invite Auth E2E Runbook

This document is packaged only to validate the v1.4.x operator contract. It is not an authorization to execute Auth E2E. Keep registration closed, use disposable PostgreSQL only for local verification, and never print Email, URL, token, credential or secret material.

The v1.4.18 candidate is derived from v1.4.17 and retains migrations 0001 through 0004. It contains no Phase 2/0005 implementation. Deployment, online migration, restore, invitation creation and project-init are NOT_EXECUTED.

Artifact state machine: `NOT_CREATED` → `DB_ROW_TRACKED` → `ARTIFACT_VALIDATED` → `READY_FOR_PRIVATE_DOWNLOAD` → `DOWNLOADED_LOCAL_SECURE` → `REMOTE_REMOVED` → `INVITE_CONSUMED_OR_REVOKED` → `LOCAL_REMOVED`. No other transition is legal.

The artifact is a single JSON object with `additionalProperties=false`. Its atomic writer uses a same-directory temporary file, `fsync`, close and atomic rename; the parent is mode 700 and the artifact is mode 600. A symlink, traversal, oversized, control-character and second-URL inputs fail closed.

normal success preserves the artifact at READY_FOR_PRIVATE_DOWNLOAD for Private Files. The recovery ledger uses the exact tuple and affected-row count; a transaction begins with `BEGIN TRANSACTION READ ONLY` for read gates, and active-unused count must return to baseline. Failure or signal cleanup is separate from normal success and removes the artifact safely.

The fixed runtime path is `.next/standalone/operator/run-controlled-invite.sh`. Email is read from stdin, not argv and not environment; it is never logged or placed in the artifact. Private Files is the only handoff channel.

Historical records: `ATTEMPT10=SAFE_ABORTED_AND_ROLLED_BACK`; `ATTEMPT11=NOT_EXECUTED`. This release itself is local-only and does not authorize Auth E2E.
