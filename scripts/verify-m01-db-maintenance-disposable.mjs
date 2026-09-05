import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import {
  MIGRATION_DOWN_SHA256,
  MIGRATION_UP_SHA256,
  runMigration,
  runReadonlyAudit,
} from "./m01-db-maintenance-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationRoot = path.join(portalRoot, "database", "migrations");
const migrationNames = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];
const up = await readFile(path.join(migrationRoot, "0007_topic_lab_frontier_radar.up.sql"));
const down = await readFile(path.join(migrationRoot, "0007_topic_lab_frontier_radar.down.sql"));
const migrationUrl = process.env.INTEGRATION_DATABASE_URL;
const readonlyUrl = process.env.INTEGRATION_READONLY_DATABASE_URL;
if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || !migrationUrl || !readonlyUrl) {
  process.stdout.write("M01_DISPOSABLE_GATE=FAIL_CLOSED_DISPOSABLE_MARKER_REQUIRED\n");
  process.exit(2);
}

const factory = (configuration) => new Client(configuration);
const admin = new Client({ connectionString: migrationUrl, connectionTimeoutMillis: 5_000 });

async function applyBase0006() {
  for (const name of migrationNames) await admin.query(await readFile(path.join(migrationRoot, name), "utf8"));
  await admin.query("GRANT USAGE ON SCHEMA public TO readonly_auditor");
  await admin.query("GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_auditor");
  await admin.query("ALTER DEFAULT PRIVILEGES FOR ROLE migration_runner IN SCHEMA public GRANT SELECT ON TABLES TO readonly_auditor");
}

async function resetTo0006() {
  await admin.query("DROP SCHEMA public CASCADE");
  await admin.query("CREATE SCHEMA public AUTHORIZATION migration_runner");
  await applyBase0006();
}

async function main() {
  await admin.connect();
  await applyBase0006();

  const pre = await runReadonlyAudit({ clientFactory: factory, databaseUrl: readonlyUrl, allowDisposable: true });
  assert.equal(pre.schemaState, "SCHEMA_0006_PRE_0007");
  assert.equal(pre.readOnlyTransaction, "PASS");
  assert.equal(pre.databaseRowWrites, 0);

  const forbiddenWrite = new Client({ connectionString: readonlyUrl });
  await forbiddenWrite.connect();
  await assert.rejects(() => forbiddenWrite.query("INSERT INTO workspaces (id,name,owner_user_id) VALUES ('x','x','x')"));
  await forbiddenWrite.end();

  const concurrent = await Promise.all([
    runMigration({ clientFactory: factory, databaseUrl: migrationUrl, direction: "UP", migrationBytes: up, allowDisposable: true }),
    runMigration({ clientFactory: factory, databaseUrl: migrationUrl, direction: "UP", migrationBytes: up, allowDisposable: true }),
  ]);
  assert.deepEqual(new Set(concurrent.map((result) => result.migrationResult)), new Set(["APPLIED_0007", "ALREADY_COMPLETE"]));
  assert.equal(concurrent.every((result) => result.databaseRowWrites === 0), true);

  const complete = await runReadonlyAudit({ clientFactory: factory, databaseUrl: readonlyUrl, allowDisposable: true });
  assert.equal(complete.schemaState, "SCHEMA_0007_COMPLETE");
  assert.equal(complete.observed0007TableCount, 2);
  assert.equal(complete.observed0007ColumnCount, 28);
  assert.equal(complete.constraintsValidated, "PASS");
  assert.equal(complete.indexesValidReady, "PASS");

  const downEmpty = await runMigration({
    clientFactory: factory,
    databaseUrl: migrationUrl,
    direction: "DOWN_TEST_ONLY",
    migrationBytes: down,
    allowDisposable: true,
  });
  assert.equal(downEmpty.migrationResult, "DOWN_EMPTY_DATA_TEST_PASS");
  assert.equal(downEmpty.schemaState, "SCHEMA_0006_PRE_0007");

  const reapply = await runMigration({ clientFactory: factory, databaseUrl: migrationUrl, direction: "UP", migrationBytes: up, allowDisposable: true });
  assert.equal(reapply.migrationResult, "APPLIED_0007");
  await admin.query("DROP INDEX research_topic_lab_runs_tenant_idx");
  const partial = await runReadonlyAudit({ clientFactory: factory, databaseUrl: readonlyUrl, allowDisposable: true });
  assert.equal(partial.schemaState, "SCHEMA_PARTIAL_OR_INVALID");

  await resetTo0006();
  const formalUp = await runMigration({ clientFactory: factory, databaseUrl: migrationUrl, direction: "UP", migrationBytes: up, allowDisposable: true });
  assert.equal(formalUp.migrationResult, "APPLIED_0007");
  await admin.query(`
    INSERT INTO "user" (id,name,email) VALUES ('m01_user','Fixture','m01-fixture@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('m01_workspace','Fixture','m01_user');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend)
      VALUES ('m01_project','m01_workspace','m01_user','Fixture','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_human_gates
      (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at)
      VALUES ('m01_gate','m01_workspace','m01_project','m01_user','RESEARCH_DIRECTION','FIXTURE','fixture-version',repeat('a',64),'APPROVED','m01_user',now())
  `);
  const downBlocked = await runMigration({
    clientFactory: factory,
    databaseUrl: migrationUrl,
    direction: "DOWN_TEST_ONLY",
    migrationBytes: down,
    allowDisposable: true,
  });
  assert.equal(downBlocked.migrationResult, "NOT_APPLIED");
  assert.equal(downBlocked.transactionOutcome, "ROLLBACK_FAIL_CLOSED");
  const preserved = await admin.query("SELECT count(*)::int AS count FROM research_human_gates WHERE gate_type='RESEARCH_DIRECTION'");
  assert.equal(preserved.rows[0].count, 1);
  const afterBlocked = await runReadonlyAudit({ clientFactory: factory, databaseUrl: readonlyUrl, allowDisposable: true });
  assert.equal(afterBlocked.schemaState, "SCHEMA_0007_COMPLETE");

  const hashMismatch = await runMigration({
    clientFactory: () => { throw new Error("MUST_NOT_CONNECT"); },
    databaseUrl: migrationUrl,
    direction: "UP",
    migrationBytes: Buffer.from("altered"),
    allowDisposable: true,
  });
  assert.equal(hashMismatch.errorCategory, "MIGRATION_HASH_MISMATCH");

  await admin.query("DROP SCHEMA public CASCADE");
  await admin.query("CREATE SCHEMA public AUTHORIZATION migration_runner");
  const retained = await admin.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  assert.equal(retained.rows[0].count, 0);

  console.log(`MIGRATION_0007_UP_SHA256=${MIGRATION_UP_SHA256}`);
  console.log(`MIGRATION_0007_DOWN_SHA256=${MIGRATION_DOWN_SHA256}`);
  console.log("DISPOSABLE_0006_FIXTURE=PASS");
  console.log("DISPOSABLE_0007_FIXTURE=PASS_2_TABLES_28_COLUMNS");
  console.log("DISPOSABLE_PARTIAL_FIXTURE=PASS_FAIL_CLOSED");
  console.log("DISPOSABLE_FAILURE_FIXTURES=PASS");
  console.log("ROLE_SEPARATION_REAL_GATE=PASS");
  console.log("READONLY_ZERO_WRITES_REAL_GATE=PASS");
  console.log("MIGRATION_HASH_LOCK_REAL_GATE=PASS");
  console.log("MIGRATION_IDEMPOTENCY_CONCURRENCY=PASS");
  console.log("DOWN_EMPTY_DATA_GATE=PASS");
  console.log("DOWN_FORMAL_DATA_FAIL_CLOSED=PASS");
  console.log("DOWN_FAILURE_TRANSACTION_ROLLBACK=PASS");
  console.log("FORMAL_DATA_PRESERVED=PASS");
  console.log("DISPOSABLE_RETAINED_ROWS=0");
  console.log("M01_DISPOSABLE_GATE=PASS");
}

try {
  await main();
} catch {
  console.log("M01_DISPOSABLE_GATE=FAIL");
  process.exitCode = 2;
} finally {
  await admin.end().catch(() => undefined);
}
