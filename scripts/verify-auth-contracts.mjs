import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authConfigurationMissing } from "../lib/auth-config.ts";
import { assertReleaseVersionMatch, readReleaseContract } from "./release-identity-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const source = await read("lib/better-auth.ts");
const authConfig = await read("lib/auth-config.ts");
const authHttp = await read("lib/auth-http.ts");
const registerRoute = await read("app/api/account/register/route.ts");
const forgotRoute = await read("app/api/account/forgot-password/route.ts");
const provisioning = await read("lib/account-provisioning.ts");
const requestAuth = await read("lib/request-auth.ts");
const rateLimit = await read("lib/persistent-rate-limit.ts");
const env = await read(".env.example");
const packageJson = JSON.parse(await read("package.json"));
const releaseContract = await readReleaseContract(path.join(root, "release-identity.json"));

for (const page of [
  "app/login/page.tsx",
  "app/register/page.tsx",
  "app/forgot-password/page.tsx",
  "app/account/page.tsx",
  "app/account/change-password/page.tsx",
  "app/admin/accounts/page.tsx",
]) await read(page);

assert.equal(assertReleaseVersionMatch(releaseContract, packageJson.version, "AUTH_PACKAGE_JSON"), releaseContract.version);
assert.match(packageJson.dependencies["better-auth"], /1\.6\.29/);
assert.match(packageJson.dependencies.pg, /8\.23\.0/);
assert.equal(packageJson.dependencies.resend, undefined);
for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "REGISTRATION_MODE", "ACCOUNT_PROVISIONING_MODE", "LEGACY_AUTH_ENABLED"]) {
  assert.match(env, new RegExp(`^${key}=`, "m"));
}
assert.match(env, /^REGISTRATION_MODE=closed$/m);
assert.match(env, /^ACCOUNT_PROVISIONING_MODE=admin_only$/m);
assert.doesNotMatch(env, /^RESEND_/m);

assert.match(authConfig, /value === "closed" \? "closed" : null/);
assert.match(authConfig, /ACCOUNT_PROVISIONING_MODES = \["admin_only"\]/);
assert.match(authConfig, /registrationEnabled: false/);
assert.match(source, /requireEmailVerification: false/);
assert.doesNotMatch(source, /sendVerificationEmail|sendResetPassword/);
assert.match(source, /revokeSessionsOnPasswordReset: true/);
assert.match(source, /storage: "database"/);
assert.match(source, /isSessionCreationAllowed/);
assert.match(authHttp, /ADMIN_PROVISIONING_BLOCKED_PATHS/);
assert.match(authHttp, /\/sign-up\/email/);
assert.match(authHttp, /\/request-password-reset/);
assert.match(authHttp, /\/reset-password/);
assert.match(registerRoute, /registration_unavailable/);
assert.doesNotMatch(registerRoute, /signUpEmail|reserveRegistrationInvite|persistRegistrationConsent/);
assert.match(forgotRoute, /contact_administrator/);
assert.doesNotMatch(forgotRoute, /sendResetPassword|sendAuthEmail/);
assert.match(provisioning, /hashPassword/);
assert.match(provisioning, /verifyPassword/);
assert.match(provisioning, /emailVerified[\s\S]*false/);
assert.match(requestAuth, /password_change_required/);
assert.match(requestAuth, /status === "DISABLED"/);
assert.match(rateLimit, /portal_rate_limits/);
assert.match(rateLimit, /irreversibleIdentifier/);

const original = {
  nodeEnv: process.env.NODE_ENV,
  keys: Object.fromEntries(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "REGISTRATION_MODE", "ACCOUNT_PROVISIONING_MODE"].map((key) => [key, process.env[key]])),
};
try {
  process.env.NODE_ENV = "production";
  for (const key of Object.keys(original.keys)) delete process.env[key];
  assert.equal(authConfigurationMissing(), true);
} finally {
  if (original.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.nodeEnv;
  for (const [key, value] of Object.entries(original.keys)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute)); else files.push(absolute);
  }
  return files;
}
for (const file of await walk(path.join(root, "components"))) {
  const content = await readFile(file, "utf8");
  assert.doesNotMatch(content, /DATABASE_URL|BETTER_AUTH_SECRET|OPENCLAW_GATEWAY_TOKEN/);
}

console.log("auth contracts: PASS (closed registration, admin-only provisioning, first-login gate, no Email delivery/reset dependency, server-side credential boundary)");
