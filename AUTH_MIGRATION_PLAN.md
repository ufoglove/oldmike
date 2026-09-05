# Auth Migration Plan — v1.4.11

1. Keep the confirmed online Portal 1.4.9 as the rollback baseline.
2. Run `pnpm test:release:real` only against a loopback disposable PostgreSQL
   database with both explicit disposable-test guards enabled.
3. Back up staging and obtain separate approval before applying pinned
   migration `0004_registration_invite_revocation.up.sql`. Migrations 0001–0003
   are already part of the known staging baseline and must not be rerun.
4. Deploy only to the existing `research-portal` after migration approval;
   keep `REGISTRATION_MODE=closed` through smoke testing.
5. In a separately approved E2E window, use only the packaged atomic create,
   verifier and revoke operators. Never expose the private invitation artifact
   or recovery ledger in logs or public storage.
6. Keep Chat fail-closed 503, external search disabled, and legacy project
   `vr-63bc7bcef3` unclaimed.

No migration is executed at request time or startup. `npx auth@latest migrate`
is prohibited.
