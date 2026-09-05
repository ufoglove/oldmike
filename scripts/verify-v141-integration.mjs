import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { createEmailVerificationToken } from "better-auth/api";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, ".next", "standalone");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const researchSchema = process.env.INTEGRATION_RESEARCH_SCHEMA ?? "0004";
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.error("REAL_DATABASE_UNAVAILABLE: set INTEGRATION_DATABASE_URL to a disposable PostgreSQL database and INTEGRATION_DATABASE_DISPOSABLE=1; no fixture fallback is allowed.");
  process.exit(2);
}
if (!new Set(["0004", "0005"]).has(researchSchema)) {
  console.error("INVALID_RESEARCH_SCHEMA_FIXTURE");
  process.exit(2);
}

const pool = new Pool({ connectionString: databaseUrl, max: 8 });
const migration = async (file) => pool.query(await readFile(path.join(root, file), "utf8"));
const port = await new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.unref();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    const selected = typeof address === "object" && address ? address.port : null;
    listener.close((error) => error ? reject(error) : resolve(selected));
  });
});
assert.equal(Number.isSafeInteger(port), true);
const baseURL = `http://127.0.0.1:${port}`;
const testSecret = "integration-only-better-auth-secret-32-chars";
const emailVerificationExpiresIn = 60 * 60;

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await migration("database/migrations/0001_better_auth_core.up.sql");
await migration("database/migrations/0002_old_mike_tenant.up.sql");
await migration("database/migrations/0003_registration_invites.up.sql");
await migration("database/migrations/0004_registration_invite_revocation.up.sql");
if (researchSchema === "0005") await migration("database/migrations/0005_research_workflow_phase2.up.sql");

const inviteDigest = (namespace, value) => createHmac("sha256", testSecret).update(`${namespace}\0${value}`, "utf8").digest("hex");
async function seedInvite(email, { createdAt = new Date(), expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000) } = {}) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO registration_invites (id, token_key, email_key, role, expires_at, created_at, created_by_key) VALUES ($1,$2,$3,'owner',$4,$5,$6)",
    [randomUUID(), inviteDigest("old-mike-registration-invite-token-v1", token), inviteDigest("old-mike-registration-invite-email-v1", email.toLowerCase()), expiresAt, createdAt, inviteDigest("old-mike-registration-invite-operator-v1", "integration")],
  );
  return token;
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: runtimeRoot,
  windowsHide: true,
  stdio: "ignore",
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    // `next start` runs the production runtime; fixture eligibility is guarded
    // by explicit flags and loopback-only URLs, not by NODE_ENV.
    NODE_ENV: "production",
    INTEGRATION_TEST_MODE: "1",
    TEST_FIXTURE: "1",
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: baseURL,
    RESEND_API_KEY: "integration-fixture-key",
    RESEND_FROM_EMAIL: "Old Mike Integration <no-reply@example.test>",
    REGISTRATION_MODE: "invite_only",
    LEGACY_AUTH_ENABLED: "false",
    OPENCLAW_EXTERNAL_SEARCH: "false",
  },
});

const jar = new Map();
function saveCookies(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const value of values) jar.set(value.split(";", 1)[0].split("=", 1)[0], value.split(";", 1)[0].split("=", 2)[1]);
}
async function call(pathname, init = {}) {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; "));
  if (init.method === "POST") { headers.set("content-type", "application/json"); headers.set("origin", baseURL); }
  const response = await fetch(`${baseURL}${pathname}`, {
    ...init,
    headers,
    redirect: "manual",
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  saveCookies(response);
  const text = await response.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, json };
}
async function waitForServer() {
  for (let i = 0; i < 30; i += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("integration child server exited before readiness");
    try { const response = await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(1_000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("integration server did not become ready");
}

async function stopChildServer() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const gracefulClose = once(child, "close");
  child.kill("SIGTERM");
  const graceful = await Promise.race([
    gracefulClose.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (graceful) return;

  const forcedClose = once(child, "close");
  child.kill("SIGKILL");
  await Promise.race([
    forcedClose,
    new Promise((_, reject) => setTimeout(() => reject(new Error("integration child server did not stop")), 5_000)),
  ]);
}
async function verificationToken(email) {
  return createEmailVerificationToken(testSecret, email, undefined, emailVerificationExpiresIn);
}
async function resetToken() {
  const result = await pool.query("SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY \"createdAt\" DESC LIMIT 1");
  return result.rows[0]?.identifier?.slice("reset-password:".length);
}
async function register(email, name, inviteToken = "") {
  return call("/api/account/register", { method: "POST", body: JSON.stringify({ name, email, password: "correct-horse-battery", confirmPassword: "correct-horse-battery", consent: true, inviteToken, termsVersion: "2026-08-16", privacyVersion: "2026-08-16" }) });
}
async function verifyAndLogin(email) {
  const token = await verificationToken(email); assert.equal(typeof token, "string"); assert.equal(token.split(".").length, 3);
  const dispatches = await pool.query("SELECT metadata::text AS metadata FROM audit_events WHERE event_type='auth_email_dispatch' AND outcome='fixture'");
  for (const row of dispatches.rows) {
    assert.equal(row.metadata.includes(email), false);
    assert.equal(row.metadata.includes(token), false);
    assert.doesNotMatch(row.metadata, /https?:\/\//);
  }
  const verification = await call(`/api/auth/verify-email?token=${encodeURIComponent(token)}`); assert.ok([200, 302].includes(verification.response.status));
  return call("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password: "correct-horse-battery", callbackURL: "/" }) });
}

async function waitForVerificationDispatch() {
  for (let i = 0; i < 20; i += 1) {
    const result = await pool.query("SELECT metadata->>'kind' AS kind, metadata->>'hasUrl' AS has_url, metadata::text AS metadata FROM audit_events WHERE event_type='auth_email_dispatch' AND outcome='fixture' AND metadata->>'kind'='verification' AND metadata->>'hasUrl'='true' ORDER BY created_at DESC LIMIT 1");
    if (result.rowCount === 1) return result.rows[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("verification email dispatch audit event was not recorded");
}

let integrationStage = "SERVER_BOOT";
let integrationError = null;
try {
  await waitForServer();
  integrationStage = "DIRECT_SIGNUP_GUARD";
  const direct = await call("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Bypass", email: "bypass@example.test", password: "correct-horse-battery" }) });
  assert.equal(direct.response.status, 403);

  const aEmail = "user-a@example.test";
  const bEmail = "user-b@example.test";
  const aInvite = await seedInvite(aEmail);
  const bInvite = await seedInvite(bEmail);
  const expiredNow = Date.now();
  const expiredCreatedAt = new Date(expiredNow - 2 * 60 * 60 * 1000);
  const expiredAt = new Date(expiredNow - 60 * 60 * 1000);
  const expiredInvite = await seedInvite("expired@example.test", { createdAt: expiredCreatedAt, expiresAt: expiredAt });
  integrationStage = "INVITATION_REGISTRATION";
  assert.equal((await register("missing@example.test", "Missing")).response.status, 400);
  assert.equal((await register("wrong@example.test", "Wrong", aInvite)).response.status, 400);
  assert.equal((await register("expired@example.test", "Expired", expiredInvite)).response.status, 400);
  assert.equal((await register(aEmail, "User A", aInvite)).response.status, 200);
  assert.equal((await register(aEmail, "User A", aInvite)).response.status, 400);
  const verificationDispatch = await waitForVerificationDispatch();
  assert.equal(verificationDispatch.kind, "verification"); assert.equal(verificationDispatch.has_url, "true");
  assert.equal(verificationDispatch.metadata.includes(aEmail), false);
  assert.doesNotMatch(verificationDispatch.metadata, /https?:\/\//);
  const aUser = (await pool.query("SELECT id FROM \"user\" WHERE email=$1", [aEmail])).rows[0]; assert.ok(aUser?.id);
  const consent = await pool.query("SELECT user_id, terms_version, privacy_version, accepted_at FROM user_consents WHERE user_id=$1", [aUser.id]); assert.equal(consent.rowCount, 1); assert.equal(consent.rows[0].terms_version, "2026-08-16");
  const beforeVerify = await call("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email: aEmail, password: "correct-horse-battery" }) }); assert.notEqual(beforeVerify.response.status, 200);
  const loginA = await verifyAndLogin(aEmail); assert.equal(loginA.response.status, 200);

  integrationStage = "SECOND_USER_REGISTRATION";
  jar.clear();
  assert.equal((await register(bEmail, "User B", bInvite)).response.status, 200);
  const bUser = (await pool.query("SELECT id FROM \"user\" WHERE email=$1", [bEmail])).rows[0]; assert.ok(bUser?.id);
  const loginB = await verifyAndLogin(bEmail); assert.equal(loginB.response.status, 200);
  const users = await pool.query("SELECT id, owner_user_id FROM workspaces WHERE owner_user_id IN ($1,$2) ORDER BY owner_user_id", [aUser.id, bUser.id]); assert.equal(users.rowCount, 2);
  const wsA = users.rows.find((row) => row.owner_user_id === aUser.id).id; const wsB = users.rows.find((row) => row.owner_user_id === bUser.id).id;
  await pool.query("INSERT INTO projects (project_id, workspace_id, created_by, title, status, storage_backend) VALUES ($1,$2,$3,$4,'ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),($5,$6,$7,$8,'ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE')", ["a-project", wsA, aUser.id, "A", "b-project", wsB, bUser.id, "B"]);

  integrationStage = "TENANT_ISOLATION";
  jar.clear(); await verifyAndLogin(aEmail);
  const listA = await call("/api/projects"); assert.equal(listA.response.status, 200); assert.deepEqual(listA.json.projects.map((p) => p.projectId), ["a-project"]);
  integrationStage = researchSchema === "0004" ? "V154_0004_SCHEMA_FAIL_CLOSED" : "V154_0005_RESEARCH_HTTP";
  const researchTables = ["research_studies", "research_datasets", "research_analysis_plans", "research_analysis_runs", "research_evidence_sources", "research_claims", "research_claim_evidence", "research_documents", "research_human_gates", "research_workflow_events"];
  const countResearchRows = async () => researchSchema === "0005"
    ? (await Promise.all(researchTables.map(async (table) => Number((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count)))).reduce((sum, value) => sum + value, 0)
    : 0;
  const researchRowsBefore = await countResearchRows();
  const researchResponse = await call("/api/projects/a-project/research");
  if (researchSchema === "0004") {
    assert.equal(researchResponse.response.status, 503);
    assert.equal(researchResponse.json?.code, "research_schema_unavailable");
  } else {
    assert.equal(researchResponse.response.status, 200);
    assert.equal(researchResponse.json?.ok, true);
    assert.equal(researchResponse.json?.research?.lifecycleContractVersion, "1.5.4");
  }
  assert.equal(await countResearchRows(), researchRowsBefore);
  const getB = await call("/api/projects/b-project"); assert.equal(getB.response.status, 404);
  const chat = await call("/api/chat", { method: "POST", body: JSON.stringify({ projectId: "a-project", message: "hello", idempotencyKey: "integration-chat-0001" }) }); assert.equal(chat.response.status, 503); assert.equal(chat.json.code, "task_gateway_disabled");

  const badArtifact = await pool.query("INSERT INTO project_artifacts (id, project_id, workspace_id, artifact_type, content_ref) VALUES ('bad-artifact','a-project',$1,'test','fixture')", [wsB]).catch((error) => error); assert.equal(badArtifact.code, "23503");
  assert.equal((await pool.query("SELECT 1 FROM projects WHERE project_id='vr-63bc7bcef3'")).rowCount, 0);

  integrationStage = "PASSWORD_RESET";
  const forgotKnown = await call("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email: aEmail, redirectTo: "/reset-password" }) });
  const forgotUnknown = await call("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email: "unknown@example.test", redirectTo: "/reset-password" }) });
  assert.equal(forgotKnown.response.status, 200); assert.equal(forgotUnknown.response.status, 200); assert.deepEqual(forgotKnown.json, forgotUnknown.json);
  const resetAudit = await pool.query("SELECT 1 FROM audit_events WHERE event_type='auth_email_dispatch' AND outcome='fixture' AND metadata->>'kind'='password-reset'"); assert.ok(resetAudit.rowCount >= 1);
  const reset = await call("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: await resetToken(), newPassword: "new-correct-password" }) }); assert.equal(reset.response.status, 200);
  const oldSession = await call("/api/auth/get-session"); assert.ok(!oldSession.json?.user);

  // The custom DB limiter survives a different request context and refuses a
  // spoofed X-Forwarded-For value because that header is never a key.
  integrationStage = "PERSISTENT_RATE_LIMIT";
  jar.clear(); for (let i = 0; i < 3; i += 1) await call("/api/account/forgot-password", { method: "POST", headers: { "x-forwarded-for": `203.0.113.${i}` }, body: JSON.stringify({ email: "rate@example.test" }) });
  const rateLimited = await call("/api/account/forgot-password", { method: "POST", headers: { "x-forwarded-for": "198.51.100.99" }, body: JSON.stringify({ email: "rate@example.test" }) }); assert.equal(rateLimited.response.status, 429); assert.ok(rateLimited.response.headers.get("retry-after"));
  const raceEmail = "race@example.test";
  const raceInvite = await seedInvite(raceEmail);
  const raceBody = JSON.stringify({ name: "Race", email: raceEmail, password: "correct-horse-battery", confirmPassword: "correct-horse-battery", consent: true, inviteToken: raceInvite, termsVersion: "2026-08-16", privacyVersion: "2026-08-16" });
  const raceResponses = await Promise.all([1, 2].map(() => fetch(`${baseURL}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL },
    body: raceBody,
    signal: AbortSignal.timeout(15_000),
  })));
  assert.deepEqual(raceResponses.map((response) => response.status).sort(), [200, 400]);

  // This database is guarded as disposable. Clear invitation rows so the
  // immediately following atomic-operator real gate can prove a zero baseline
  // without touching non-disposable state or rerunning migrations.
  integrationStage = "DISPOSABLE_CLEANUP";
  await pool.query("DELETE FROM registration_invites");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM registration_invites")).rows[0].count, 0);

  console.log(`V154_ON_${researchSchema}_HTTP=PASS`);
  console.log(`v1.5.14 real PostgreSQL integration: PASS (schema ${researchSchema}, standalone production runtime, Research HTTP contract, invite-only registration, Better Auth/API, consent, tenant isolation, composite FK, chat fail-closed, persistent limiter)`);
} catch (error) {
  integrationError = error;
  const category = error?.name === "TimeoutError" || error?.name === "AbortError" ? "HTTP_TIMEOUT" : "ASSERTION_OR_RUNTIME";
  console.error(`v1.5.14 real PostgreSQL integration: FAIL stage=${integrationStage} category=${category}`);
} finally {
  await stopChildServer().catch(() => {
    integrationError ??= new Error("integration child shutdown failed");
  });
  await pool.end();
}

process.exit(integrationError ? 2 : 0);
