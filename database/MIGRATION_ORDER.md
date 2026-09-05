# Portal 1.5.24 migration order

The reviewed migrations are fixed to Better Auth `1.6.29`. The Portal never
runs migrations at request time or startup.

1. `migrations/0001_better_auth_core.up.sql`
2. `migrations/0002_old_mike_tenant.up.sql`
3. `migrations/0003_registration_invites.up.sql`
4. `migrations/0004_registration_invite_revocation.up.sql`
5. `migrations/0005_research_workflow_phase2.up.sql`
6. `migrations/0006_admin_provisioned_accounts.up.sql`
7. `migrations/0007_topic_lab_frontier_radar.up.sql`

Migration 0004 adds HMAC-only attempt correlation and explicit revocation
state. It stores neither the raw invitation credential nor recipient Email.

Migration 0005 introduces the Phase 2 research workflow. Migration 0006 adds
the singleton administrator provisioning contract. Migration 0007 adds the
append-only Topic Lab candidate, provenance, `RESEARCH_DIRECTION` Human Gate,
and exact promotion ledger required before creating an S1 design draft.

Rollback order is 0007 through 0001 using the matching down files, only after
a backup and separate human approval. `npx auth@latest migrate` is prohibited.
`migration-manifest.json` pins every delivered SQL checksum.

Migrations 0005 through 0007 never run at startup. Their down migrations fail
closed when formal data would be destroyed. Migration 0007 up/down,
formal-data fail-closed behavior, and N-1 compatibility must be verified only
against a disposable PostgreSQL 18 instance unless a separate online migration
approval is granted.
