import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const oldPortalRoot = process.env.N_MINUS_ONE_PORTAL_ROOT;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || !oldPortalRoot) {
  console.error("N_MINUS_ONE_PRECONDITION=FAIL");
  process.exit(2);
}

const currentRoot = path.resolve(import.meta.dirname, "..");
const migrations = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const reset = () => pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
const port = await new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    listener.close(() => resolve(address.port));
  });
});
const baseURL = `http://127.0.0.1:${port}`;
let server;
let stage = "INITIALIZE";

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error("N_MINUS_ONE_SERVER_EXITED");
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("N_MINUS_ONE_SERVER_TIMEOUT");
}

try {
  stage = "MIGRATION_0001_TO_0006";
  await reset();
  for (const filename of migrations) {
    const source = await readFile(path.join(currentRoot, "database", "migrations", filename), "utf8");
    await pool.query(source);
  }
  const tableCount = (await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count;
  stage = `TABLE_COUNT_${tableCount}`;
  assert.equal(tableCount, 26);

  stage = "N_MINUS_ONE_SERVER_START";
  server = spawn(process.execPath, [path.join(oldPortalRoot, ".next", "standalone", "server.js")], {
    cwd: path.join(oldPortalRoot, ".next", "standalone"),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "n-minus-one-disposable-secret-32-characters",
      BETTER_AUTH_URL: baseURL,
      RESEND_API_KEY: "re_n_minus_one_disposable",
      RESEND_FROM_EMAIL: "N Minus One <no-reply@example.test>",
      REGISTRATION_MODE: "closed",
      LEGACY_AUTH_ENABLED: "false",
      OPENCLAW_EXTERNAL_SEARCH: "false",
      OPENCLAW_BASE_URL: "http://127.0.0.1:1",
      OPENCLAW_GATEWAY_TOKEN: "n-minus-one-disposable-gateway-fixture",
      INTEGRATION_TEST_MODE: "1",
      TEST_FIXTURE: "1",
    },
  });
  server.stdout.resume();
  server.stderr.resume();
  stage = "N_MINUS_ONE_SERVER_READY";
  const healthResponse = await waitForServer();
  const health = await healthResponse.json();
  stage = `N_MINUS_ONE_HEALTH_VERSION_${String(health.version).replace(/[^A-Z0-9_.-]/gi, "_")}`;
  assert.equal(health.version, "1.5.14");
  stage = `N_MINUS_ONE_HEALTH_MODE_${String(health.mode).replace(/[^A-Z0-9_.-]/gi, "_")}`;
  assert.equal(health.mode, "connected");
  stage = "N_MINUS_ONE_PROJECTS_401";
  assert.equal((await fetch(`${baseURL}/api/projects`)).status, 401);
  stage = "N_MINUS_ONE_REGISTRATION_CLOSED";
  const closed = await fetch(`${baseURL}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL },
    body: "{}",
  });
  assert.equal(closed.status, 503);
  stage = "N_MINUS_ONE_REGISTRATION_CODE";
  assert.equal((await closed.json()).code, "registration_unavailable");
  stage = "N_MINUS_ONE_0006_ROWS_EMPTY";
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM account_provisioning_state")).rows[0].count, 0);
  console.log("N_MINUS_ONE_V1514_ON_0006=PASS");
} catch (error) {
  console.error("N_MINUS_ONE_V1514_ON_0006=FAIL");
  console.error(`FAILED_STAGE=${stage}`);
  console.error(`ERROR_CATEGORY=${error?.code || error?.name || "OTHER"}`);
  process.exitCode = 2;
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "close"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
  }
  await reset().catch(() => undefined);
  const retained = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'").catch(() => ({ rows: [{ count: -1 }] }));
  console.log(`DATABASE_WRITES_DISPOSABLE_RETAINED=${retained.rows[0].count === 0 ? 0 : retained.rows[0].count}`);
  await pool.end();
}
