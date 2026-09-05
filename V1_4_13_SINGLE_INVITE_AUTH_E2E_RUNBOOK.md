# v1.4.13 Single-Invite Auth E2E Runbook

## Release boundary

v1.4.13 is a local runtime-integrity patch. It is not deployed by this
change. Production remains on the previously verified Portal, with
`REGISTRATION_MODE=closed`, zero online database writes, and Auth E2E not
executed.

The v1.4.12 incident was a false negative: the running process used UID 0
while packaged files were owned by UID 1000. Packaged artifact integrity and
runtime-private-directory integrity are separate contracts. A packaged file
does not need to be owned by the runtime UID.

## Integrity contracts

### Packaged artifacts

For the fixed controlled runner and Operator CLI, the verifier requires:

- an exact allowlisted path and exact `realpath`;
- a regular file, not a symlink, with link count 1;
- the exact SHA-256 and size recorded in the runtime manifest;
- no group/other write permission;
- every packaged parent directory in the checked path is a real directory,
  not a symlink, and is not group/other writable.

The packaged parent directory is not required to be mode 700. No UID or
username is hard-coded for packaged files. This gate is reported as
`PACKAGED_ARTIFACT_INTEGRITY`.

### Runtime-private data

Only dynamic run data is owner-bound. A fresh private directory must be
created by the current runtime UID and be mode 700. Dynamic output must be a
regular, non-symlink file owned by that UID, mode 600, link count 1, and
inside the current run directory. The helper rejects path traversal and
cross-directory rename. After atomic rename it rechecks realpath, mode,
owner and SHA-256. Failure and signal cleanup remove temporary data safely.

This gate is reported separately as `RUNTIME_PRIVATE_DIRECTORY_INTEGRITY` and
the policy summary as `RUNTIME_OWNER_POLICY`. It must never be merged with
packaged-file ownership.

## Attempt 10 record

`ATTEMPT10=SAFE_ABORTED_AND_ROLLED_BACK` at the v1.4.12 controlled-runner
pre-execution owner gate. `CONTROLLED_RUNNER_OWNER=FAIL` was caused by
`PACKAGED_OPERATOR_OWNER_POLICY_MISMATCH`: runtime UID 0 differed from the
packaged file UID 1000. No Email was entered, no invitation or artifact was
created, no database row changed, and recovery returned the existing Portal
to closed registration with health 200 and unauthenticated projects 401.

## Phase 0 for a future authorized E2E

Before any `invite_only` change, verify health/version/connected, unauthenticated
401, the closed-registration 503 policy, runtime dependency closure, the
read-only PostgreSQL inventory, 0004 schema, backup evidence, and both split
integrity gates. The online gate must report, without secrets:

```text
PACKAGED_ARTIFACT_INTEGRITY=PASS
RUNTIME_OWNER_POLICY=PASS
DATABASE_WRITES=0
REGISTRATION_MODE=closed
```

If v1.4.13 is not deployed, its new online gate is not executable; do not
infer it from the v1.4.12 runtime.

## E2E restrictions

No `invite_only` switch, controlled Email input, invitation creation, email,
registration, password reset, project creation, project-init, migration,
restore, or Auth E2E is part of this patch. A future E2E requires a separate
human approval and must preserve the existing artifact lifecycle, current-Pod
pre-execution checks, no-Email-output contract, exact revoke ledger, and
closed recovery gate.

## Preserved artifact lifecycle contract

The legal states remain:

`NOT_CREATED -> DB_ROW_TRACKED -> ARTIFACT_VALIDATED -> READY_FOR_PRIVATE_DOWNLOAD -> DOWNLOADED_LOCAL_SECURE -> REMOTE_REMOVED -> INVITE_CONSUMED_OR_REVOKED -> LOCAL_REMOVED`.

The artifact is a strict JSON object with `additionalProperties=false`, one
HTTPS origin/path/credential, single use, no Email, atomic same-directory
temporary write, fsync, close, rename, symlink rejection, mode 700 parent,
mode 600 file and bounded size. The private recovery ledger stores only the
exact tuple identifiers needed for revoke and keeps the active-unused count
recoverable. Normal success preserves the artifact at
`READY_FOR_PRIVATE_DOWNLOAD` for Private Files; failure and signal cleanup
are separate from that success path. Email is passed by stdin, not argv or
environment, and never appears in output, artifact or ledger.

Any future production E2E must verify `BEGIN TRANSACTION READ ONLY` in Phase 0,
the current Pod, fixed runtime path
`.next/standalone/operator/run-controlled-invite.sh`, and the exact closed
recovery gate. The attempt remains `ATTEMPT11=NOT_EXECUTED` until separately
approved.

The exact revoke contract requires an affected-row count of one and verifies
the active-unused count after the transaction. In the formal contract,
normal success preserves the artifact; the Email is not argv and not
environment, and is not environment data exposed to the process.
