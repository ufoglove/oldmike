import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPrivateGatewayUrl } from "../lib/openclaw.ts";
import { authConfigurationMissing } from "../lib/auth-config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const requestAuth = await read("lib/request-auth.ts");
const authConfig = await read("lib/auth-config.ts");
const authHttp = await read("lib/auth-http.ts");
const projectRoute = await read("app/api/projects/route.ts");
const chatRoute = await read("app/api/chat/route.ts");
const authRoute = await read("app/api/auth/[...all]/route.ts");
const provisioning = await read("lib/account-provisioning.ts");
const adminApi = await read("lib/admin-api.ts");

const original = {
  nodeEnv: process.env.NODE_ENV,
  values: Object.fromEntries(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "REGISTRATION_MODE", "ACCOUNT_PROVISIONING_MODE"].map((key) => [key, process.env[key]])),
};
try {
  process.env.NODE_ENV = "production";
  for (const key of Object.keys(original.values)) delete process.env[key];
  assert.equal(authConfigurationMissing(), true);
} finally {
  if (original.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.nodeEnv;
  for (const [key, value] of Object.entries(original.values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

assert.equal(isPrivateGatewayUrl("https://example.com"), false);
assert.equal(isPrivateGatewayUrl("http://localhost:18789"), true);
assert.equal(isPrivateGatewayUrl("http://127.0.0.1:18789"), true);
assert.equal(isPrivateGatewayUrl("http://service-0123456789abcdef01234567:18789"), true);
assert.match(requestAuth, /, 503\)/);
assert.match(requestAuth, /, 401\)/);
assert.match(requestAuth, /password_change_required/);
assert.match(authConfig, /AUTH_ENV_KEYS/);
assert.match(authConfig, /admin_only/);
assert.doesNotMatch(authHttp, /new Map/);
assert.doesNotMatch(authHttp, /x-forwarded-for/);
assert.match(authRoute, /guardAuthRequest/);
assert.match(provisioning, /hashPassword/);
assert.match(provisioning, /verifyPassword/);
assert.match(provisioning, /portal_administrator/);
assert.match(adminApi, /isAdministrator/);
assert.match(projectRoute, /tenantProjectRepository/);
assert.doesNotMatch(projectRoute, /await callOpenClaw/);
assert.match(chatRoute, /loadAuthorizedProjectTaskContext/);
assert.match(chatRoute, /getServerTaskGateway/);
assert.doesNotMatch(chatRoute, /callOpenClaw|tools\/invoke|chat\/completions/);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute)); else files.push(absolute);
  }
  return files;
}
const staticRoot = path.join(root, ".next", "static");
try { await access(staticRoot); } catch { throw new Error("client bundle missing; run pnpm build before pnpm test:security"); }
for (const file of await walk(staticRoot)) {
  const content = await readFile(file, "utf8");
  assert.doesNotMatch(content, /DATABASE_URL|BETTER_AUTH_SECRET|OPENCLAW_GATEWAY_TOKEN|PGPASSWORD|AUTH_E2E_CONTROLLED_EMAIL|run-controlled-auth-e2e|bootstrap-portal-administrator/);
}

console.log("security: PASS (auth/admin fail-closed, server-side password hashing, singleton authorization, origin/rate-limit guards, tenant ownership gate, client secret scan)");
