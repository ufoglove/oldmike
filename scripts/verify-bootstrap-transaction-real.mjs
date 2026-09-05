import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const operatorPath = process.env.BOOTSTRAP_OPERATOR_PATH
  ? path.resolve(process.env.BOOTSTRAP_OPERATOR_PATH)
  : path.join(root, ".next", "standalone", "operator", "bootstrap-portal-administrator.mjs");

if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.error("DISPOSABLE_OPERATOR_CONTRACT=FAIL");
  console.error("ERROR_CATEGORY=DISPOSABLE_DATABASE_REQUIRED");
  process.exit(2);
}

const pool = new Pool({ connectionString: databaseUrl, max: 16 });
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
const record = (name, passed) => results.set(name, passed ? "PASS" : "FAIL");
const migrationSql = async (name) => readFile(path.join(root, "database", "migrations", name), "utf8");

async function resetSchema(version = 6) {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const file of migrationFiles.slice(0, version)) await pool.query(await migrationSql(file));
}

function fixture(suffix = "base") {
  return {
    email: `bootstrap-${suffix}@fixture.invalid`,
    name: `Bootstrap Fixture ${suffix}`,
    temporaryPassword: `Fixture-Bootstrap-${suffix}-Password-741!`,
    idempotencyKey: `bootstrap-${suffix}-idempotency-0001`,
  };
}

async function runBootstrap(input) {
  const child = spawn(process.execPath, [operatorPath], {
    cwd: path.dirname(operatorPath),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "bootstrap-transaction-disposable-secret-32",
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(`${JSON.stringify(input)}\n`);
  const [code, signal] = await once(child, "close");
  const combined = `${stdout}\n${stderr}`;
  for (const sensitive of [input.email, input.temporaryPassword, input.idempotencyKey]) {
    assert.equal(combined.includes(sensitive), false, "operator output leaked private input");
  }
  await pool.query("SELECT 1");
  return { code, signal, stdout, stderr };
}

async function counts() {
  const result = {};
  for (const table of graphTables) {
    const quoted = `"${table.replaceAll('"', '""')}"`;
    result[table] = (await pool.query(`SELECT count(*)::int AS count FROM ${quoted}`)).rows[0].count;
  }
  result.session = (await pool.query('SELECT count(*)::int AS count FROM "session"')).rows[0].count;
  return result;
}

function graphIsEmpty(value) {
  return graphTables.every((table) => value[table] === 0) && value.session === 0;
}

async function installRaiseTrigger(table, functionName) {
  const quoted = `"${table.replaceAll('"', '""')}"`;
  await pool.query(`
    CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FIXTURE_WRITE_FAILURE'; END;
    $$;
    CREATE TRIGGER ${functionName}_trigger BEFORE INSERT ON ${quoted}
    FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);
}

async function installSuppressTrigger(table, functionName) {
  const quoted = `"${table.replaceAll('"', '""')}"`;
  await pool.query(`
    CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RETURN NULL; END;
    $$;
    CREATE TRIGGER ${functionName}_trigger BEFORE INSERT ON ${quoted}
    FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);
}

try {
  await resetSchema();
  const happy = await runBootstrap(fixture("happy"));
  const happyCounts = await counts();
  record("BEGIN_TRANSACTION", happy.code === 0);
  record("ALL_WRITES_SINGLE_TRANSACTION", graphTables.every((table) => happyCounts[table] === 1));
  record("CONNECTION_FINALLY_RELEASE", happy.signal === null);

  let faultRollbackPass = true;
  for (const [index, table] of graphTables.entries()) {
    await resetSchema();
    await installRaiseTrigger(table, `fixture_raise_${index}`);
    const failed = await runBootstrap(fixture(`fault-${index}`));
    const after = await counts();
    faultRollbackPass &&= failed.code !== 0 && graphIsEmpty(after);
  }
  record("ROLLBACK_ON_FAILURE", faultRollbackPass);

  await resetSchema();
  const concurrent = await Promise.all([
    runBootstrap(fixture("concurrent-a")),
    runBootstrap(fixture("concurrent-b")),
  ]);
  const concurrentCounts = await counts();
  record(
    "CONCURRENT_BOOTSTRAP_ONE_WINNER",
    concurrent.map((item) => item.code).sort().join(",") === "0,2"
      && graphTables.every((table) => concurrentCounts[table] === 1),
  );
  record("ADMIN_SINGLETON_LOCK", results.get("CONCURRENT_BOOTSTRAP_ONE_WINNER") === "PASS");

  const existingAttempt = await runBootstrap(fixture("existing-admin"));
  const existingCounts = await counts();
  record(
    "EXISTING_ADMIN_FAIL_CLOSED",
    existingAttempt.code !== 0 && graphTables.every((table) => existingCounts[table] === 1),
  );

  await resetSchema(5);
  const schema0005 = await runBootstrap(fixture("schema-0005"));
  const schema0005Counts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM "user") AS users,
      (SELECT count(*)::int FROM account) AS accounts,
      (SELECT count(*)::int FROM workspaces) AS workspaces,
      (SELECT count(*)::int FROM workspace_members) AS memberships
  `);
  record(
    "SCHEMA_0006_PRECONDITION",
    schema0005.code !== 0 && Object.values(schema0005Counts.rows[0]).every((value) => value === 0),
  );

  const partialFixtures = [
    {
      name: "user",
      prepare: () => pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('partial-user', 'Partial User', 'partial-user@fixture.invalid', false)`),
    },
    {
      name: "account",
      prepare: async () => {
        await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('partial-account-user', 'Partial Account', 'partial-account@fixture.invalid', false)`);
        await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ('partial-account', 'partial-account-user', 'credential', 'partial-account-user', 'fixture-hash')`);
      },
    },
    {
      name: "workspace",
      prepare: async () => {
        await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('partial-workspace-user', 'Partial Workspace', 'partial-workspace@fixture.invalid', false)`);
        await pool.query(`INSERT INTO workspaces (id, name, owner_user_id) VALUES ('partial-workspace', 'Partial Workspace', 'partial-workspace-user')`);
      },
    },
  ];
  let cardinalityPass = true;
  for (const partial of partialFixtures) {
    await resetSchema();
    await partial.prepare();
    const before = await counts();
    const attempt = await runBootstrap(fixture(`partial-${partial.name}`));
    const after = await counts();
    cardinalityPass &&= attempt.code !== 0 && JSON.stringify(before) === JSON.stringify(after);
  }
  record("CARDINALITY_PRECHECK_IN_TRANSACTION", cardinalityPass);

  await resetSchema();
  const duplicate = fixture("duplicate-email");
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('duplicate-user', 'Duplicate', $1, false)`,
    [duplicate.email],
  );
  const duplicateBefore = await counts();
  const duplicateAttempt = await runBootstrap(duplicate);
  const duplicateAfter = await counts();
  record(
    "DUPLICATE_EMAIL_FAIL_CLOSED",
    duplicateAttempt.code !== 0 && JSON.stringify(duplicateBefore) === JSON.stringify(duplicateAfter),
  );

  await resetSchema();
  await installSuppressTrigger("account_admin_events", "fixture_suppress_admin_event");
  const suppressed = await runBootstrap(fixture("suppressed-row"));
  const suppressedCounts = await counts();
  record(
    "AFFECTED_ROW_ASSERTIONS",
    suppressed.code !== 0 && graphIsEmpty(suppressedCounts),
  );

  record(
    "ORPHAN_ROWS_AFTER_FAILURE",
    results.get("ROLLBACK_ON_FAILURE") === "PASS"
      && results.get("CARDINALITY_PRECHECK_IN_TRANSACTION") === "PASS"
      && results.get("AFFECTED_ROW_ASSERTIONS") === "PASS",
  );
  record("SCHEMA_PRECHECK_IN_TRANSACTION", results.get("SCHEMA_0006_PRECONDITION") === "PASS");

  const required = [
    "BEGIN_TRANSACTION",
    "SCHEMA_PRECHECK_IN_TRANSACTION",
    "CARDINALITY_PRECHECK_IN_TRANSACTION",
    "ADMIN_SINGLETON_LOCK",
    "ALL_WRITES_SINGLE_TRANSACTION",
    "AFFECTED_ROW_ASSERTIONS",
    "ROLLBACK_ON_FAILURE",
    "CONCURRENT_BOOTSTRAP_ONE_WINNER",
    "ORPHAN_ROWS_AFTER_FAILURE",
  ];
  record("DISPOSABLE_OPERATOR_CONTRACT", required.every((name) => results.get(name) === "PASS"));
} catch (error) {
  console.error("DISPOSABLE_OPERATOR_CONTRACT=FAIL");
  console.error(`ERROR_CATEGORY=${error?.code || error?.name || "ASSERTION"}`);
  process.exitCode = 2;
} finally {
  for (const [name, value] of results) console.log(`${name}=${value}`);
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public").catch(() => undefined);
  const retained = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'").catch(() => ({ rows: [{ count: -1 }] }));
  console.log(`DATABASE_WRITES_DISPOSABLE_RETAINED=${retained.rows[0].count === 0 ? 0 : retained.rows[0].count}`);
  await pool.end();
}

if (results.get("DISPOSABLE_OPERATOR_CONTRACT") !== "PASS") process.exitCode = 2;
