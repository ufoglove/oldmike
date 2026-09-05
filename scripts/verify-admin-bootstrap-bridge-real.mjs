import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { Pool } from "pg";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.resolve(process.env.RUNTIME_ARTIFACT_DIR || path.join(portalRoot, ".next", "standalone"));
const providerPath = path.join(runtimeRoot, "operator", "operator", "admin-bootstrap-bridge-provider.mjs");
const operatorPath = path.join(runtimeRoot, "operator", "bootstrap-portal-administrator.mjs");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.error("ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION=FAIL");
  console.error("ERROR_CATEGORY=DISPOSABLE_DATABASE_REQUIRED");
  process.exit(2);
}

const provider = await import(pathToFileURL(providerPath).href);
const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const migrationFiles = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];
const graphTables = [
  "user",
  "account",
  "workspaces",
  "workspace_members",
  "portal_administrator",
  "account_provisioning_state",
  "account_admin_events",
];
const results = new Map();
const record = (name, pass) => results.set(name, pass ? "PASS" : "FAIL");

async function resetSchema() {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const filename of migrationFiles) {
    await pool.query(await readFile(path.join(portalRoot, "database", "migrations", filename), "utf8"));
  }
}

async function counts() {
  const output = {};
  for (const table of graphTables) {
    output[table] = Number((await pool.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
  }
  output.session = Number((await pool.query('SELECT count(*)::int AS count FROM "session"')).rows[0].count);
  return output;
}

function emptyGraph(value) {
  return graphTables.every((table) => value[table] === 0) && value.session === 0;
}

async function privateFixture(identifier) {
  const parent = await mkdtemp(path.join(os.tmpdir(), "oldmike-admin-bridge-real-"));
  const privateDirectory = path.join(parent, provider.ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY);
  await mkdir(privateDirectory, { mode: 0o700 });
  await chmod(privateDirectory, 0o700);
  const request = path.join(privateDirectory, provider.ADMIN_BOOTSTRAP_REQUEST_FILE);
  await writeFile(request, `${JSON.stringify({ adminLoginIdentifier: identifier })}\n`, { flag: "wx", mode: 0o600 });
  await chmod(request, 0o600);
  return { parent, privateDirectory };
}

async function execute(identifier, fixture = null) {
  const owned = fixture ?? await privateFixture(identifier);
  try {
    const result = await provider.runAdminBootstrapBridge({
      privateDirectory: owned.privateDirectory,
      operatorPath,
      environment: {
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_SECRET: "admin-bootstrap-bridge-disposable-secret-32",
        NODE_ENV: "test",
        UNRELATED_SECRET: "must-not-be-inherited",
      },
    });
    return { ...owned, result };
  } catch (error) {
    return { ...owned, error };
  }
}

async function installRaiseTrigger(table, suffix) {
  await pool.query(`
    CREATE FUNCTION bridge_raise_${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FIXTURE_WRITE_FAILURE'; END;
    $$;
    CREATE TRIGGER bridge_raise_${suffix}_trigger BEFORE INSERT ON "${table}"
    FOR EACH ROW EXECUTE FUNCTION bridge_raise_${suffix}();
  `);
}

async function installSuppressTrigger(table, suffix) {
  await pool.query(`
    CREATE FUNCTION bridge_suppress_${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RETURN NULL; END;
    $$;
    CREATE TRIGGER bridge_suppress_${suffix}_trigger BEFORE INSERT ON "${table}"
    FOR EACH ROW EXECUTE FUNCTION bridge_suppress_${suffix}();
  `);
}

try {
  await resetSchema();
  const happy = await execute("admin-bridge-happy@fixture.invalid");
  const happyCounts = await counts();
  const ready = await lstat(path.join(happy.privateDirectory, provider.ADMIN_BOOTSTRAP_READY_FILE)).catch(() => null);
  record("VALID_CREATE_SINGLETON_ADMIN", happy.result?.ADMIN_BOOTSTRAP === "PASS" && graphTables.every((table) => happyCounts[table] === 1));
  record("ARTIFACT_READY", Boolean(ready?.isFile() && !ready.isSymbolicLink()));
  await rm(happy.parent, { recursive: true, force: true });

  let writeFaultsPass = true;
  for (const [index, table] of graphTables.entries()) {
    await resetSchema();
    await installRaiseTrigger(table, String(index));
    const failed = await execute(`admin-bridge-fault-${index}@fixture.invalid`);
    writeFaultsPass &&= failed.error?.category === "ADMIN_BOOTSTRAP_CHILD_FAILURE"
      && emptyGraph(await counts())
      && !await lstat(path.join(failed.privateDirectory, provider.ADMIN_BOOTSTRAP_STAGING_FILE)).catch(() => null)
      && !await lstat(path.join(failed.privateDirectory, provider.ADMIN_BOOTSTRAP_READY_FILE)).catch(() => null);
    await rm(failed.parent, { recursive: true, force: true });
  }
  record("PARTIAL_WRITE_ROLLBACK", writeFaultsPass);

  await resetSchema();
  await installSuppressTrigger("account_admin_events", "zero_row");
  const zeroRow = await execute("admin-bridge-zero-row@fixture.invalid");
  record("ZERO_ROW_ROLLBACK", zeroRow.error?.category === "ADMIN_BOOTSTRAP_CHILD_FAILURE" && emptyGraph(await counts()));
  await rm(zeroRow.parent, { recursive: true, force: true });

  await resetSchema();
  const concurrentFixture = await privateFixture("admin-bridge-concurrent@fixture.invalid");
  const concurrent = await Promise.allSettled([
    execute("admin-bridge-concurrent@fixture.invalid", concurrentFixture),
    execute("admin-bridge-concurrent@fixture.invalid", concurrentFixture),
  ]);
  const concurrentCounts = await counts();
  const bridgeResults = concurrent.map((item) => item.status === "fulfilled" ? item.value : { error: item.reason });
  record(
    "CONCURRENT_BRIDGE_ONE_WINNER",
    bridgeResults.filter((item) => item.result?.ADMIN_BOOTSTRAP === "PASS").length === 1
      && bridgeResults.filter((item) => item.error?.category === "ADMIN_BOOTSTRAP_LOCK_EXISTS").length === 1
      && graphTables.every((table) => concurrentCounts[table] === 1),
  );
  await rm(concurrentFixture.parent, { recursive: true, force: true });

  await resetSchema();
  await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('partial-user', 'Partial', 'partial@fixture.invalid', false)`);
  const beforePartial = await counts();
  const partial = await execute("admin-bridge-partial@fixture.invalid");
  const afterPartial = await counts();
  record("PARTIAL_PREEXISTING_FAIL_CLOSED", partial.error?.category === "ADMIN_BOOTSTRAP_CHILD_FAILURE" && JSON.stringify(beforePartial) === JSON.stringify(afterPartial));
  await rm(partial.parent, { recursive: true, force: true });

  const required = [
    "VALID_CREATE_SINGLETON_ADMIN",
    "ARTIFACT_READY",
    "PARTIAL_WRITE_ROLLBACK",
    "ZERO_ROW_ROLLBACK",
    "CONCURRENT_BRIDGE_ONE_WINNER",
    "PARTIAL_PREEXISTING_FAIL_CLOSED",
  ];
  record("ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION", required.every((name) => results.get(name) === "PASS"));
} catch (error) {
  console.error("ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION=FAIL");
  console.error(`ERROR_CATEGORY=${error?.code || error?.name || "ASSERTION"}`);
  process.exitCode = 2;
} finally {
  for (const [name, result] of results) console.log(`${name}=${result}`);
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public").catch(() => undefined);
  const retained = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'").catch(() => ({ rows: [{ count: -1 }] }));
  console.log(`DATABASE_WRITES_DISPOSABLE_RETAINED=${retained.rows[0].count === 0 ? 0 : retained.rows[0].count}`);
  await pool.end();
}

if (results.get("ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION") !== "PASS") process.exitCode = 2;

