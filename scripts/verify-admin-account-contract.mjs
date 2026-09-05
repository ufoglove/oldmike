import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_ACCOUNT_CONTRACT,
  evaluateAdminOperation,
  evaluateProtectedAccess,
  evaluateProvisioningAtomicity,
} from "./admin-account-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

assert.equal(ADMIN_ACCOUNT_CONTRACT, "old-mike.admin-provisioned-accounts.v1");

const positiveGraph = evaluateProvisioningAtomicity({
  user: true, credentialHash: true, personalWorkspace: true, ownerMembership: true,
  provisioningState: true, adminEvent: true, plaintextPersisted: false,
});
assert.deepEqual(positiveGraph, { commit: true, code: "PASS" });
for (const missing of ["user", "credentialHash", "personalWorkspace", "ownerMembership", "provisioningState", "adminEvent"]) {
  const fixture = { user: true, credentialHash: true, personalWorkspace: true, ownerMembership: true, provisioningState: true, adminEvent: true, plaintextPersisted: false, [missing]: false };
  assert.equal(evaluateProvisioningAtomicity(fixture).commit, false, `${missing} omission must roll back`);
}
assert.equal(evaluateProvisioningAtomicity({ user: true, credentialHash: true, personalWorkspace: true, ownerMembership: true, provisioningState: true, adminEvent: true, plaintextPersisted: true }).code, "PLAINTEXT_PASSWORD_LEAK");

const adminFixture = { adminRows: 1, actorIsSingletonAdministrator: true, targetIsAdministrator: false, idempotencyKeyValid: true, action: "PROVISION_ACCOUNT" };
assert.equal(evaluateAdminOperation(adminFixture).allowed, true);
assert.equal(evaluateAdminOperation({ ...adminFixture, adminRows: 0 }).allowed, false);
assert.equal(evaluateAdminOperation({ ...adminFixture, adminRows: 2 }).allowed, false);
assert.equal(evaluateAdminOperation({ ...adminFixture, actorIsSingletonAdministrator: false }).code, "ADMINISTRATOR_REQUIRED");
for (const action of ["SET_ADMIN", "IMPERSONATE", "READ_PASSWORD"]) {
  assert.equal(evaluateAdminOperation({ ...adminFixture, action }).code, "ADMIN_CAPABILITY_PROHIBITED");
}
assert.equal(evaluateAdminOperation({ ...adminFixture, targetIsAdministrator: true, action: "DISABLE" }).code, "ADMINISTRATOR_LIFECYCLE_LOCKED");

assert.deepEqual(evaluateProtectedAccess({ status: "PASSWORD_CHANGE_REQUIRED", mustChangePassword: true, resource: "PROJECTS", membershipMatchesTenantTuple: true }), { status: 428, code: "password_change_required" });
for (const resource of ["ACCOUNT_STATUS", "CHANGE_PASSWORD", "LOGOUT"]) {
  assert.equal(evaluateProtectedAccess({ status: "PASSWORD_CHANGE_REQUIRED", mustChangePassword: true, resource, membershipMatchesTenantTuple: true }).status, 200);
}
assert.equal(evaluateProtectedAccess({ status: "DISABLED", mustChangePassword: false, resource: "PROJECTS", membershipMatchesTenantTuple: true }).status, 403);
assert.equal(evaluateProtectedAccess({ status: "ACTIVE", mustChangePassword: false, resource: "RESEARCH", membershipMatchesTenantTuple: false }).status, 404);
assert.equal(evaluateProtectedAccess({ status: "ACTIVE", mustChangePassword: false, resource: "RESEARCH", membershipMatchesTenantTuple: true }).status, 200);

const up = await read("database/migrations/0006_admin_provisioned_accounts.up.sql");
const down = await read("database/migrations/0006_admin_provisioned_accounts.down.sql");
assert.match(up, /singleton_key smallint PRIMARY KEY DEFAULT 1/);
assert.match(up, /portal_administrator_singleton CHECK \(singleton_key = 1\)/);
assert.match(up, /user_id text NOT NULL UNIQUE REFERENCES "user"/);
assert.match(up, /account_provisioning_state/);
assert.match(up, /account_admin_events_are_append_only/);
assert.match(up, /target_user_key char\(64\)/);
assert.doesNotMatch(up, /\bemail\b|\bpassword\b/i);
assert.match(down, /MIGRATION_0006_DOWN_BLOCKED_ADMIN_PROVISIONED_ACCOUNTS_NOT_EMPTY/);
assert.ok(down.indexOf("DO $migration_0006_down_guard$") < down.indexOf("DROP TRIGGER"));

const authConfig = await read("lib/auth-config.ts");
const betterAuth = await read("lib/better-auth.ts");
const requestAuth = await read("lib/request-auth.ts");
const accountService = await read("lib/account-provisioning.ts");
const publicRegistration = await read("app/api/account/register/route.ts");
const forgotPassword = await read("app/api/account/forgot-password/route.ts");
const tenantRepository = await read("lib/tenant-repository.ts");
assert.match(authConfig, /value === "closed"/);
assert.match(authConfig, /"admin_only"/);
assert.match(betterAuth, /requireEmailVerification: false/);
assert.doesNotMatch(betterAuth, /sendVerificationEmail|sendResetPassword|admin\(/);
assert.match(requestAuth, /password_change_required/);
assert.match(publicRegistration, /registration_unavailable/);
assert.match(publicRegistration, /status: 503/);
assert.match(forgotPassword, /contact_administrator/);
assert.doesNotMatch(forgotPassword, /requestPasswordReset|sendAuthEmail/);
assert.match(accountService, /BEGIN ISOLATION LEVEL SERIALIZABLE/);
assert.match(accountService, /INSERT INTO "user"/);
assert.match(accountService, /INSERT INTO account/);
assert.match(accountService, /INSERT INTO workspaces/);
assert.match(accountService, /INSERT INTO workspace_members/);
assert.match(accountService, /DELETE FROM \\"session\\"/);
assert.doesNotMatch(accountService, /impersonat|setRole|set-role/i);
assert.match(tenantRepository, /project_id = \$1 AND workspace_id = \$2 AND created_by = \$3/);

const bootstrap = await read("scripts/bootstrap-portal-administrator.mjs");
assert.match(bootstrap, /process\.stdin\.isTTY/);
assert.match(bootstrap, /process\.argv\.length !== 2/);
assert.match(bootstrap, /hashPassword/);
assert.match(bootstrap, /PORTAL_ADMINISTRATOR_ALREADY_EXISTS/);
assert.doesNotMatch(bootstrap, /process\.env\.(?:ADMIN|AUTH).*PASSWORD|console\.log\(input/);

const passwordForm = await read("components/PasswordChangeForm.tsx");
const adminPanel = await read("components/AdminAccountsPanel.tsx");
for (const source of [passwordForm, adminPanel]) {
  assert.doesNotMatch(source, /onPaste|preventDefault\(\).*paste|autocomplete="off"/i);
  assert.match(source, /autoComplete="current-password"|autoComplete="new-password"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="polite"/);
}
assert.match(passwordForm, /autoComplete="current-password"/);
assert.match(passwordForm, /autoComplete="new-password"/);
assert.match(adminPanel, /autoComplete="username"/);

console.log("ADMIN_SINGLETON_CONTRACT=PASS");
console.log("ADMIN_BOOTSTRAP_CONTRACT=PASS");
console.log("ADMIN_USER_PROVISIONING=PASS");
console.log("FIRST_LOGIN_PASSWORD_CHANGE=PASS");
console.log("ADMIN_PASSWORD_RESET=PASS");
console.log("SESSION_REVOCATION=PASS");
console.log("TENANT_ISOLATION=PASS");
console.log("ADMIN_DATA_BYPASS_BLOCKED=PASS");
console.log("ACCESSIBILITY_AUTH_CONTRACT=PASS");
console.log("NEGATIVE_FIXTURES=PASS");
