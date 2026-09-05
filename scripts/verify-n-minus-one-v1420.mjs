import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { access, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { extractZipBuffer } from "../../scripts/release-archive-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archive = process.env.N_MINUS_ONE_PORTAL_ZIP;
const expectedArchiveHash = "e513ffe9a013b8b953ef03c4b5928b5e4522344e577e6f7385467bd75177e069";
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const migrationUp = path.join(portalRoot, "database", "migrations", "0005_research_workflow_phase2.up.sql");
const migrationDown = path.join(portalRoot, "database", "migrations", "0005_research_workflow_phase2.down.sql");

function emit(label, value) {
  console.log(`${label}=${value}`);
}

if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || !archive) {
  emit("N_MINUS_ONE_V1420", "FAIL");
  emit("FAILED_STAGE", "CONFIGURATION");
  emit("EXIT_CODE", 2);
  process.exit(2);
}
const parsed = new URL(databaseUrl);
assert.equal(parsed.protocol, "postgresql:");
assert.ok(parsed.hostname === "localhost" || parsed.hostname === "::1" || parsed.hostname.startsWith("127."));

const archiveBytes = await readFile(archive);
assert.equal(createHash("sha256").update(archiveBytes).digest("hex"), expectedArchiveHash);
const temporaryRoot = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "oldmike-v1420-n-minus-one-")));
const extractedRoot = path.join(temporaryRoot, "portal");
let child = null;
let exitCode = 2;
let failedStage = "EXTRACT";

function commandEnvironment(extra = {}) {
  return Object.fromEntries(Object.entries({
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    ...extra,
  }).filter(([, value]) => typeof value === "string" && value.length > 0));
}

function runPnpm(args, cwd) {
  const command = process.platform === "win32" ? process.execPath : "pnpm";
  const pnpmArgs = process.platform === "win32"
    ? [path.join(process.env.APPDATA, "npm", "node_modules", "pnpm", "bin", "pnpm.mjs"), ...args]
    : args;
  return spawnSync(command, pnpmArgs, {
    cwd,
    env: commandEnvironment({ CI: "true" }),
    stdio: "ignore",
    windowsHide: true,
    timeout: 10 * 60 * 1000,
  });
}

async function choosePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const close = once(child, "close");
  child.kill("SIGTERM");
  const stopped = await Promise.race([close.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5000))]);
  if (!stopped) {
    const forced = once(child, "close");
    child.kill("SIGKILL");
    await Promise.race([forced, new Promise((_, reject) => setTimeout(() => reject(new Error("n-minus-one shutdown timeout")), 5000))]);
  }
}

async function snapshot(pool) {
  const tables = ["user", "session", "account", "verification", "rateLimit", "workspaces", "workspace_members", "projects", "project_artifacts", "user_consents", "audit_events", "portal_rate_limits", "registration_invites"];
  const result = {};
  for (const table of tables) {
    const quoted = `"${table.replaceAll('"', '""')}"`;
    result[table] = Number((await pool.query(`SELECT count(*)::bigint AS count FROM ${quoted}`)).rows[0]?.count);
  }
  return result;
}

async function smoke(pool, expectedSchema) {
  const before = await snapshot(pool);
  const port = await choosePort();
  assert.ok(Number.isSafeInteger(port));
  const baseUrl = `http://127.0.0.1:${port}`;
  const standaloneRoot = path.join(extractedRoot, ".next", "standalone");
  const standaloneServer = path.join(standaloneRoot, "server.js");
  await access(standaloneRoot);
  await access(standaloneServer);
  child = spawn(process.execPath, [standaloneServer], {
    cwd: standaloneRoot,
    env: commandEnvironment({
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "n-minus-one-disposable-secret-32-characters",
      BETTER_AUTH_URL: baseUrl,
      RESEND_API_KEY: "n-minus-one-fixture-key",
      RESEND_FROM_EMAIL: "N Minus One <no-reply@example.test>",
      REGISTRATION_MODE: "closed",
      LEGACY_AUTH_ENABLED: "false",
      OPENCLAW_EXTERNAL_SEARCH: "false",
      OPENCLAW_BASE_URL: "http://127.0.0.1:9",
      OPENCLAW_GATEWAY_TOKEN: "n-minus-one-fixture-token",
      INTEGRATION_TEST_MODE: "1",
      TEST_FIXTURE: "1",
    }),
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => {});

  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(ready, true);
  const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
  const healthJson = await health.json();
  assert.equal(health.status, 200);
  assert.equal(healthJson.version, "1.4.20");
  assert.equal(healthJson.mode, "connected");
  assert.equal((await fetch(`${baseUrl}/login`, { redirect: "manual" })).status, 200);
  assert.ok([200, 302, 303, 307, 308].includes((await fetch(`${baseUrl}/`, { redirect: "manual" })).status));
  assert.equal((await fetch(`${baseUrl}/api/projects`, { redirect: "manual" })).status, 401);
  const closed = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: "{}",
    redirect: "manual",
  });
  assert.equal(closed.status, 503);
  assert.equal((await closed.json()).code, "registration_unavailable");
  await stopChild();
  child = null;
  const after = await snapshot(pool);
  assert.deepEqual(after, before);
  emit(`V1420_ON_${expectedSchema}`, "PASS");
}

try {
  extractZipBuffer(archiveBytes, extractedRoot);
  const packageJson = JSON.parse(await readFile(path.join(extractedRoot, "package.json"), "utf8"));
  assert.equal(packageJson.version, "1.4.20");

  failedStage = "FROZEN_INSTALL";
  assert.equal(runPnpm(["install", "--frozen-lockfile"], extractedRoot).status, 0);
  failedStage = "PRODUCTION_BUILD";
  assert.equal(runPnpm(["build"], extractedRoot).status, 0);

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const schema = await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='registration_invites' AND column_name = ANY($1::text[])", [["attempt_key", "revoked_at", "revoked_by_key"]]);
    assert.equal(schema.rows[0]?.count, 3);
    failedStage = "V1420_ON_0004";
    await smoke(pool, "0004");

    failedStage = "MIGRATION_0005_UP";
    await pool.query(await readFile(migrationUp, "utf8"));
    assert.equal(Number((await pool.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'research_%'")).rows[0]?.count), 10);
    failedStage = "V1420_ON_0005";
    await smoke(pool, "0005");

    failedStage = "MIGRATION_0005_DOWN";
    await pool.query(await readFile(migrationDown, "utf8"));
    assert.equal(Number((await pool.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'research_%'")).rows[0]?.count), 0);
    failedStage = "V1420_AFTER_0005_DOWN";
    await smoke(pool, "0005_DOWN_0004");
    exitCode = 0;
    failedStage = "NONE";
  } finally {
    await stopChild().catch(() => {});
    await pool.end();
  }
} catch {
  exitCode = 2;
} finally {
  await stopChild().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}

emit("V1420_ARCHIVE_SHA256", "PASS");
emit("V1420_ON_0004", exitCode === 0 ? "PASS" : "FAIL");
emit("V1420_ON_0005", exitCode === 0 ? "PASS" : "FAIL");
emit("V1420_AFTER_0005_DOWN", exitCode === 0 ? "PASS" : "FAIL");
emit("V1420_DATABASE_WRITES", exitCode === 0 ? 0 : "UNKNOWN");
emit("N_MINUS_ONE_V1420", exitCode === 0 ? "PASS" : "FAIL");
emit("FAILED_STAGE", failedStage);
emit("EXIT_CODE", exitCode);
process.exit(exitCode);
