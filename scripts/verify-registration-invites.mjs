import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authConfiguration, publicAuthStatus } from "../lib/auth-config.ts";
import { generateRegistrationInviteToken, isRegistrationInviteToken, normalizeInviteEmail, registrationInviteKeys } from "../lib/registration-invite-token.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const secret = "registration-invite-compatibility-secret-at-least-32-characters";

// Legacy invitation primitives remain deterministic for exact revoke and
// historical-schema compatibility, but cannot enable public registration.
const token = generateRegistrationInviteToken();
assert.equal(token.length, 43);
assert.equal(isRegistrationInviteToken(token), true);
assert.equal(normalizeInviteEmail(" User@Example.Test "), "user@example.test");
const keys = registrationInviteKeys({ token, email: "User@Example.Test", secret });
assert.match(keys.tokenKey, /^[a-f0-9]{64}$/);
assert.match(keys.emailKey, /^[a-f0-9]{64}$/);

const originalMode = process.env.REGISTRATION_MODE;
const originalProvisioningMode = process.env.ACCOUNT_PROVISIONING_MODE;
try {
  process.env.REGISTRATION_MODE = "closed";
  process.env.ACCOUNT_PROVISIONING_MODE = "admin_only";
  assert.equal(authConfiguration().registrationMode, "closed");
  assert.equal(publicAuthStatus().registrationEnabled, false);
  assert.equal(publicAuthStatus().accountProvisioningMode, "admin_only");
  for (const unsafeMode of ["invite_only", "open", "unsafe-public-value"]) {
    process.env.REGISTRATION_MODE = unsafeMode;
    assert.equal(authConfiguration().ready, false);
    assert.ok(authConfiguration().missing.includes("VALID_REGISTRATION_MODE"));
  }
} finally {
  if (originalMode === undefined) delete process.env.REGISTRATION_MODE; else process.env.REGISTRATION_MODE = originalMode;
  if (originalProvisioningMode === undefined) delete process.env.ACCOUNT_PROVISIONING_MODE; else process.env.ACCOUNT_PROVISIONING_MODE = originalProvisioningMode;
}

const migration = await read("database/migrations/0003_registration_invites.up.sql");
const revocationMigration = await read("database/migrations/0004_registration_invite_revocation.up.sql");
const repository = await read("lib/registration-invites.ts");
const route = await read("app/api/account/register/route.ts");
const registerPage = await read("app/register/page.tsx");
const cli = await read("scripts/create-registration-invite.mjs");

assert.match(migration, /token_key text NOT NULL UNIQUE/);
assert.match(migration, /email_key text NOT NULL/);
assert.match(migration, /used_at timestamptz/);
assert.doesNotMatch(migration, /\btoken\s+text|\bemail\s+text/);
assert.match(revocationMigration, /attempt_key text/);
assert.match(revocationMigration, /revoked_at timestamptz/);
assert.match(revocationMigration, /used_or_revoked_check/);
assert.match(repository, /expires_at > now\(\)/);
assert.match(repository, /used_at IS NULL/);
assert.match(route, /registration_unavailable/);
assert.doesNotMatch(route, /finalizeInvitedRegistration|reserveRegistrationInvite|signUpEmail/);
assert.match(registerPage, /administrator/i);
assert.match(cli, /randomBytes\(32\)/);
assert.match(cli, /atomicWritePrivateJson/);
assert.doesNotMatch(cli, /RESEND_API_KEY/);

console.log("registration invitation compatibility: PASS (schema and exact-revoke operators retained; public invitation registration permanently disabled)");
