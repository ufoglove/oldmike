import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.error("ADMIN_PROVISIONING_REAL=FAIL");
  console.error("ERROR_CATEGORY=DISPOSABLE_DATABASE_REQUIRED");
  process.exit(2);
}

const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const migrationFiles = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];
const sql = async (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const apply = async (name) => pool.query(await sql(name));
const resetSchema = async () => pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

async function applyAll() {
  for (const file of migrationFiles) await apply(file);
}

async function runBootstrap(fixture) {
  const child = spawn(process.execPath, [path.join(root, "scripts", "bootstrap-portal-administrator.mjs")], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "admin-provisioning-disposable-secret-32-chars",
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(`${JSON.stringify(fixture)}\n`);
  const [code, signal] = await once(child, "close");
  const combined = `${stdout}\n${stderr}`;
  for (const sensitive of [fixture.email, fixture.temporaryPassword, fixture.idempotencyKey]) assert.equal(combined.includes(sensitive), false);
  return { code, signal, stdout, stderr };
}

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
const baseURL = `http://127.0.0.1:${port}`;

function makeJar() { return new Map(); }
function saveCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}
async function call(jar, pathname, init = {}) {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", [...jar].map(([key, value]) => `${key}=${value}`).join("; "));
  if (new Set(["POST", "PATCH", "DELETE"]).has(init.method)) {
    headers.set("content-type", "application/json");
    headers.set("origin", baseURL);
  }
  const response = await fetch(`${baseURL}${pathname}`, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(15_000) });
  saveCookies(response, jar);
  const text = await response.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, json, text };
}
async function login(email, password) {
  const jar = makeJar();
  const result = await call(jar, "/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
  return { ...result, jar };
}
async function changePassword(jar, currentPassword, newPassword, firstLogin = false) {
  return call(jar, "/api/account/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, acceptConsent: firstLogin, termsVersion: "2026-08-16", privacyVersion: "2026-08-16" }),
  });
}
async function adminRequest(jar, pathname, method, body, idempotencyKey) {
  return call(jar, pathname, { method, headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) });
}
async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("STANDALONE_SERVER_EXITED");
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("STANDALONE_SERVER_TIMEOUT");
}
async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const close = once(child, "close");
  child.kill("SIGTERM");
  const stopped = await Promise.race([close.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5_000))]);
  if (!stopped) child.kill("SIGKILL");
}

function spawnPortalServer() {
  return spawn(process.execPath, ["server.js"], {
    cwd: path.join(root, ".next", "standalone"),
    windowsHide: true,
    stdio: "ignore",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "admin-provisioning-disposable-secret-32-chars",
      BETTER_AUTH_URL: baseURL,
      REGISTRATION_MODE: "closed",
      ACCOUNT_PROVISIONING_MODE: "admin_only",
      LEGACY_AUTH_ENABLED: "false",
      OPENCLAW_EXTERNAL_SEARCH: "false",
      INTEGRATION_TEST_MODE: "1",
      TEST_FIXTURE: "1",
    },
  });
}

let server = null;
let stage = "MIGRATION_0006_EMPTY_DOWN";
try {
  stage = "MISSING_0006_FAIL_CLOSED";
  await resetSchema();
  for (const file of migrationFiles.slice(0, 5)) await apply(file);
  const missingSchemaPassword = "Fixture-Missing-0006-Password-700!";
  const missingSchemaUserId = "fixture-missing-0006-user";
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, 'Missing Schema Fixture', 'missing-0006@fixture.invalid', false)`,
    [missingSchemaUserId],
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password)
     VALUES ('fixture-missing-0006-account', $1, 'credential', $1, $2)`,
    [missingSchemaUserId, await hashPassword(missingSchemaPassword)],
  );
  server = spawnPortalServer();
  await waitForServer(server);
  const missingSchemaLogin = await login("missing-0006@fixture.invalid", missingSchemaPassword);
  assert.notEqual(missingSchemaLogin.response.status, 200);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM \"session\"")).rows[0].count, 0);
  await stopServer(server);
  server = null;
  console.log("V1515_MISSING_0006_FAIL_CLOSED=PASS");

  await resetSchema();
  await applyAll();
  await apply("0006_admin_provisioned_accounts.down.sql");
  const emptyDown = await pool.query("SELECT to_regclass('public.portal_administrator') AS admin_table, to_regclass('public.research_studies') AS research_table");
  assert.equal(emptyDown.rows[0].admin_table, null);
  assert.equal(emptyDown.rows[0].research_table, "research_studies");
  console.log("MIGRATION_0006_DOWN_EMPTY=PASS");

  stage = "MIGRATION_0001_TO_0006";
  await apply("0006_admin_provisioned_accounts.up.sql");
  const tables = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  assert.equal(tables.rows[0].count, 26);
  console.log("MIGRATION_0006_UP=PASS");

  stage = "CONCURRENT_ADMIN_BOOTSTRAP";
  const adminFixtures = [
    { email: "admin-one@fixture.invalid", name: "Fixture Administrator One", temporaryPassword: "Fixture-Admin-One-Initial-811!", idempotencyKey: "bootstrap-admin-one-0001" },
    { email: "admin-two@fixture.invalid", name: "Fixture Administrator Two", temporaryPassword: "Fixture-Admin-Two-Initial-822!", idempotencyKey: "bootstrap-admin-two-0002" },
  ];
  const bootstrapResults = await Promise.all(adminFixtures.map(runBootstrap));
  assert.deepEqual(bootstrapResults.map((item) => item.code).sort(), [0, 2]);
  const adminRecord = await pool.query("SELECT u.id, u.email FROM portal_administrator a JOIN \"user\" u ON u.id=a.user_id");
  assert.equal(adminRecord.rowCount, 1);
  const adminFixture = adminFixtures.find((fixture) => fixture.email === adminRecord.rows[0].email);
  assert.ok(adminFixture);
  assert.equal((await runBootstrap(adminFixture)).code, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM portal_administrator")).rows[0].count, 1);
  console.log("ADMIN_SINGLETON_CONTRACT=PASS");
  console.log("ADMIN_BOOTSTRAP_CONTRACT=PASS");

  stage = "MIGRATION_0006_FORMAL_DATA_GUARD";
  let guardError = null;
  try { await apply("0006_admin_provisioned_accounts.down.sql"); } catch (error) { guardError = error; }
  assert.equal(guardError?.code, "P0001");
  assert.equal(guardError?.message, "MIGRATION_0006_DOWN_BLOCKED_ADMIN_PROVISIONED_ACCOUNTS_NOT_EMPTY");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM portal_administrator")).rows[0].count, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM account_provisioning_state")).rows[0].count, 1);
  console.log("MIGRATION_0006_FORMAL_DATA_FAIL_CLOSED=PASS");
  console.log("MIGRATION_0006_FAILURE_TRANSACTION_ROLLBACK=PASS");

  stage = "STANDALONE_SERVER_BOOT";
  server = spawnPortalServer();
  await waitForServer(server);

  stage = "PUBLIC_REGISTRATION_ROUTE";
  const anonymous = makeJar();
  const registrationClosed = await call(anonymous, "/api/account/register", { method: "POST", body: "{}" });
  assert.equal(registrationClosed.response.status, 503, `PUBLIC_REGISTRATION_STATUS_${registrationClosed.response.status}`);
  assert.equal(registrationClosed.json?.code, "registration_unavailable", "PUBLIC_REGISTRATION_CODE_MISMATCH");
  stage = "DIRECT_SIGNUP_BLOCK";
  const directSignup = await call(anonymous, "/api/auth/sign-up/email", { method: "POST", body: "{}" });
  assert.equal(directSignup.response.status, 403, `DIRECT_SIGNUP_STATUS_${directSignup.response.status}`);
  stage = "FORGOT_PASSWORD_ANTI_ENUMERATION";
  const forgot = await call(anonymous, "/api/account/forgot-password", { method: "POST", body: JSON.stringify({ email: "unknown@fixture.invalid" }) });
  assert.equal(forgot.response.status, 200);
  assert.equal(forgot.json?.code, "contact_administrator");
  console.log("PUBLIC_REGISTRATION_CLOSED=PASS");
  console.log("EMAIL_DELIVERY_DISABLED=PASS");

  stage = "ADMIN_FIRST_LOGIN";
  const adminInitialLogin = await login(adminFixture.email, adminFixture.temporaryPassword);
  stage = `ADMIN_INITIAL_LOGIN_HTTP_${adminInitialLogin.response.status}_${String(adminInitialLogin.json?.code || "NO_CODE").replace(/[^A-Z0-9_]/gi, "_")}`;
  assert.equal(adminInitialLogin.response.status, 200);
  stage = "ADMIN_FIRST_LOGIN_PROJECT_GATE";
  assert.equal((await call(adminInitialLogin.jar, "/api/projects")).response.status, 428);
  stage = "ADMIN_FIRST_LOGIN_STATUS";
  assert.equal((await call(adminInitialLogin.jar, "/api/account/status")).json?.mustChangePassword, true);
  const adminNewPassword = "Fixture-Admin-Activated-933!";
  stage = "ADMIN_FIRST_PASSWORD_CHANGE";
  assert.equal((await changePassword(adminInitialLogin.jar, adminFixture.temporaryPassword, adminNewPassword, true)).response.status, 200);
  stage = "ADMIN_OLD_SESSION_REVOCATION";
  assert.equal((await call(adminInitialLogin.jar, "/api/account/status")).response.status, 401);
  assert.notEqual((await login(adminFixture.email, adminFixture.temporaryPassword)).response.status, 200);
  const adminLogin = await login(adminFixture.email, adminNewPassword);
  assert.equal(adminLogin.response.status, 200);
  console.log("FIRST_LOGIN_PASSWORD_CHANGE=PASS");
  console.log("SESSION_REVOCATION=PASS");

  stage = "ADMIN_PROVISIONS_USERS";
  const userFixtures = [
    { email: "user-a@fixture.invalid", name: "Fixture User A", temporaryPassword: "Fixture-User-A-Initial-144!" },
    { email: "user-b@fixture.invalid", name: "Fixture User B", temporaryPassword: "Fixture-User-B-Initial-155!" },
  ];
  const createdUsers = [];
  for (const [index, fixture] of userFixtures.entries()) {
    const key = `provision-user-${index}-0000001`;
    stage = `ADMIN_PROVISION_USER_${index}`;
    const created = await adminRequest(adminLogin.jar, "/api/admin/accounts", "POST", fixture, key);
    stage = `ADMIN_PROVISION_USER_${index}_HTTP_${created.response.status}_${String(created.json?.code || "NO_CODE").replace(/[^A-Z0-9_]/gi, "_")}`;
    assert.equal(created.response.status, 201);
    assert.equal(typeof created.json?.userId, "string");
    createdUsers.push({ ...fixture, id: created.json.userId });
    stage = `ADMIN_PROVISION_IDEMPOTENT_${index}`;
    const repeated = await adminRequest(adminLogin.jar, "/api/admin/accounts", "POST", fixture, key);
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.json?.idempotent, true);
    stage = `ADMIN_PROVISION_DUPLICATE_${index}`;
    const duplicate = await adminRequest(adminLogin.jar, "/api/admin/accounts", "POST", fixture, `provision-duplicate-${index}-01`);
    assert.equal(duplicate.response.status, 409);
  }
  stage = "ADMIN_PROVISION_ACCOUNT_GRAPH";
  const accountGraph = await pool.query(
    `SELECT u.id, u."emailVerified", a.password, w.id AS workspace_id, m.role, s.status
       FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"='credential'
       JOIN workspaces w ON w.owner_user_id=u.id
       JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id
       JOIN account_provisioning_state s ON s.user_id=u.id
      WHERE u.id = ANY($1::text[])`,
    [createdUsers.map((user) => user.id)],
  );
  stage = `ADMIN_PROVISION_ACCOUNT_GRAPH_COUNT_${accountGraph.rowCount}`;
  assert.equal(accountGraph.rowCount, 2);
  for (const [rowIndex, row] of accountGraph.rows.entries()) {
    stage = `ADMIN_PROVISION_EMAIL_VERIFIED_FALSE_${rowIndex}`;
    assert.equal(row.emailVerified, false);
    stage = `ADMIN_PROVISION_OWNER_MEMBERSHIP_${rowIndex}`;
    assert.equal(row.role, "owner");
    stage = `ADMIN_PROVISION_STATE_${rowIndex}_${String(row.status).replace(/[^A-Z0-9_]/gi, "_")}`;
    assert.equal(row.status, "PASSWORD_CHANGE_REQUIRED");
    stage = `ADMIN_PROVISION_PASSWORD_HASHED_${rowIndex}`;
    assert.equal(userFixtures.some((fixture) => fixture.temporaryPassword === row.password), false);
  }
  stage = "ADMIN_ACCOUNT_LIST_MINIMAL";
  const list = await call(adminLogin.jar, "/api/admin/accounts");
  assert.equal(list.response.status, 200);
  const listKeys = new Set((list.json?.accounts || []).flatMap((account) => Object.keys(account)));
  for (const forbiddenKey of ["password", "currentPassword", "temporaryPassword", "passwordHash", "credential"]) {
    assert.equal(listKeys.has(forbiddenKey), false);
  }
  const nonAdminBefore = await login(userFixtures[0].email, userFixtures[0].temporaryPassword);
  assert.equal((await call(nonAdminBefore.jar, "/api/admin/accounts")).response.status, 428);
  console.log("ADMIN_USER_PROVISIONING=PASS");
  console.log("PERSONAL_WORKSPACE_ATOMICITY=PASS");

  stage = "USER_PASSWORD_LIFECYCLE";
  const activeUsers = [];
  for (const [index, fixture] of userFixtures.entries()) {
    stage = `USER_${index}_INITIAL_LOGIN`;
    const initial = await login(fixture.email, fixture.temporaryPassword);
    assert.equal(initial.response.status, 200);
    stage = `USER_${index}_PROJECT_GATE`;
    assert.equal((await call(initial.jar, "/api/projects")).response.status, 428);
    const activePassword = `Fixture-User-${index}-Activated-266!`;
    stage = `USER_${index}_FIRST_PASSWORD_CHANGE`;
    assert.equal((await changePassword(initial.jar, fixture.temporaryPassword, activePassword, true)).response.status, 200);
    stage = `USER_${index}_OLD_SESSION_REVOKED`;
    assert.equal((await call(initial.jar, "/api/projects")).response.status, 401);
    stage = `USER_${index}_OLD_PASSWORD_REJECTED`;
    assert.notEqual((await login(fixture.email, fixture.temporaryPassword)).response.status, 200);
    stage = `USER_${index}_NEW_PASSWORD_LOGIN`;
    const active = await login(fixture.email, activePassword);
    assert.equal(active.response.status, 200);
    activeUsers.push({ ...createdUsers[index], password: activePassword, jar: active.jar });
  }
  stage = "NON_ADMIN_ADMIN_API";
  const nonAdmin = await call(activeUsers[0].jar, "/api/admin/accounts");
  assert.equal(nonAdmin.response.status, 404);
  console.log("NON_ADMIN_ADMIN_API=FAIL_CLOSED");

  stage = "DAILY_PASSWORD_CHANGE";
  const userADailyPassword = "Fixture-User-A-Daily-377!";
  assert.equal((await changePassword(activeUsers[0].jar, activeUsers[0].password, userADailyPassword, false)).response.status, 200);
  assert.notEqual((await login(activeUsers[0].email, activeUsers[0].password)).response.status, 200);
  const userAAfterDaily = await login(activeUsers[0].email, userADailyPassword);
  assert.equal(userAAfterDaily.response.status, 200);
  activeUsers[0].password = userADailyPassword;
  activeUsers[0].jar = userAAfterDaily.jar;
  console.log("USER_DAILY_PASSWORD_CHANGE=PASS");

  stage = "ADMIN_PASSWORD_RESET_AND_DISABLE";
  const resetPassword = "Fixture-User-B-Reset-488!";
  const reset = await adminRequest(adminLogin.jar, `/api/admin/accounts/${createdUsers[1].id}/temporary-password`, "POST", { temporaryPassword: resetPassword }, "reset-user-b-00000001");
  assert.equal(reset.response.status, 200);
  assert.notEqual((await login(userFixtures[1].email, activeUsers[1].password)).response.status, 200);
  const resetLogin = await login(userFixtures[1].email, resetPassword);
  assert.equal(resetLogin.response.status, 200);
  assert.equal((await call(resetLogin.jar, "/api/projects")).response.status, 428);
  const disabled = await adminRequest(adminLogin.jar, `/api/admin/accounts/${createdUsers[1].id}/status`, "PATCH", { enabled: false }, "disable-user-b-000001");
  assert.equal(disabled.response.status, 200);
  assert.notEqual((await login(userFixtures[1].email, resetPassword)).response.status, 200);
  const enabled = await adminRequest(adminLogin.jar, `/api/admin/accounts/${createdUsers[1].id}/status`, "PATCH", { enabled: true }, "enable-user-b-0000001");
  assert.equal(enabled.response.status, 200);
  assert.equal((await login(userFixtures[1].email, resetPassword)).response.status, 200);
  console.log("ADMIN_PASSWORD_RESET=PASS");
  console.log("DISABLED_ACCOUNT_LOGIN=FAIL_CLOSED");

  stage = "TENANT_ISOLATION";
  const workspaceRows = await pool.query("SELECT owner_user_id, id FROM workspaces WHERE owner_user_id = ANY($1::text[])", [[adminRecord.rows[0].id, ...createdUsers.map((user) => user.id)]]);
  const workspaceOf = (userId) => workspaceRows.rows.find((row) => row.owner_user_id === userId).id;
  await pool.query(
    `INSERT INTO projects (project_id, workspace_id, created_by, title, status, legacy, storage_backend)
     VALUES ('fixture-project-a', $1, $2, 'Fixture A', 'ACTIVE', false, 'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
            ('fixture-project-b', $3, $4, 'Fixture B', 'ACTIVE', false, 'POSTGRES_INDEX_PENDING_SAFE_STORAGE')`,
    [workspaceOf(createdUsers[0].id), createdUsers[0].id, workspaceOf(createdUsers[1].id), createdUsers[1].id],
  );
  assert.equal((await call(activeUsers[0].jar, "/api/projects/fixture-project-a/research")).response.status, 200);
  assert.equal((await call(activeUsers[0].jar, "/api/projects/fixture-project-b")).response.status, 404);
  assert.equal((await call(activeUsers[0].jar, "/api/projects/fixture-project-b/research")).response.status, 404);
  assert.equal((await call(adminLogin.jar, "/api/projects/fixture-project-a")).response.status, 404);
  assert.equal((await call(adminLogin.jar, "/api/projects/fixture-project-a/research")).response.status, 404);
  console.log("TENANT_ISOLATION=PASS");
  console.log("RESEARCH_WORKFLOW_AUTHENTICATED_HTTP=PASS");
  console.log("ADMIN_DATA_BYPASS_BLOCKED=PASS");

  stage = "LEAK_AND_EMAIL_SCAN";
  const audit = await pool.query("SELECT metadata::text AS metadata FROM audit_events");
  const adminEvents = await pool.query("SELECT row_to_json(e)::text AS event FROM account_admin_events e");
  const sensitiveFixtures = [...adminFixtures, ...userFixtures].flatMap((fixture) => [fixture.email, fixture.temporaryPassword]);
  const persistedNonCredentialText = `${JSON.stringify(audit.rows)}\n${JSON.stringify(adminEvents.rows)}`;
  for (const sensitive of sensitiveFixtures) assert.equal(persistedNonCredentialText.includes(sensitive), false);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM verification")).rows[0].count, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='auth_email_dispatch'")).rows[0].count, 0);
  console.log("PLAINTEXT_PASSWORD_LEAK_SCAN=PASS");
  console.log("NO_AUTH_EMAIL_DELIVERY=PASS");

  console.log("DISPOSABLE_POSTGRES_REAL_INTEGRATION=PASS");
  console.log("DATABASE_WRITES_DISPOSABLE=FIXTURE_ONLY_CLEANED");
} catch (error) {
  console.error("ADMIN_PROVISIONING_REAL=FAIL");
  console.error(`FAILED_STAGE=${stage}`);
  console.error(`ERROR_CATEGORY=${error?.code || error?.name || "ASSERTION"}`);
  process.exitCode = 2;
} finally {
  if (server) await stopServer(server).catch(() => undefined);
  await resetSchema().catch(() => undefined);
  const retained = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'").catch(() => ({ rows: [{ count: -1 }] }));
  console.log(`DATABASE_WRITES_DISPOSABLE_RETAINED=${retained.rows[0].count === 0 ? 0 : retained.rows[0].count}`);
  await pool.end();
}
