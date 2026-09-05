# PostgreSQL Schema — v1.4.11

Apply fixed migrations in this order after backup and explicit approval:

1. `0001_better_auth_core.up.sql`: Better Auth 1.6.29 core tables.
2. `0002_old_mike_tenant.up.sql`: workspaces, memberships, projects,
   composite-key artifacts, immutable consent, audit and durable rate limits.
3. `0003_registration_invites.up.sql`: HMAC-only invitation keys, expiry,
   atomic reservation and single-use consumption.
4. `0004_registration_invite_revocation.up.sql`: unique HMAC attempt
   correlation, explicit revocation state and unused-only availability index.

The invitation table never stores a raw token or plaintext recipient. The
v1.4.11 retains the v1.4.10 private recovery ledger, which stores only hashed stable identifiers and is
not a database table. Projects use `UNIQUE(workspace_id, project_id)` and
artifacts reference that composite key. Rollback uses matching down files in
reverse order only after backup and separate approval.
