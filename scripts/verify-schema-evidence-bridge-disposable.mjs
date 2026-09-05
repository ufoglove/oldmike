import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { parseOperatorOutput } from "./schema-evidence-bridge-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const operatorPath = path.join(root, "scripts", "verify-online-schema-state.mjs");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
assert.equal(process.env.INTEGRATION_DATABASE_DISPOSABLE, "1", "Disposable database marker is required");
assert.ok(databaseUrl, "Disposable database URL is required");

const migrations = [
  "0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql", "0006_admin_provisioned_accounts.up.sql",
  "0007_topic_lab_frontier_radar.up.sql",
];
const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
const q = (text, values = []) => client.query(text, values);
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;

async function resetSchema(version = "0007") {
  await q("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const limit = version === "0006" ? 6 : 7;
  for (const name of migrations.slice(0, limit)) await q(await migration(name));
}

async function runOperator(expectedState, { url = databaseUrl, expectedExit } = {}) {
  const child = spawn(process.execPath, [operatorPath], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => child.kill(), 25_000);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > 32_768) child.kill(); });
  child.stderr.on("data", (chunk) => { stderr += chunk; if (stderr.length > 4_096) child.kill(); });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearTimeout(timer);
  assert.equal(stderr, "", "Operator stderr must remain empty");
  const evidence = parseOperatorOutput(stdout);
  assert.equal(evidence.classification, expectedState, JSON.stringify({
    classification: evidence.classification,
    errorCategory: evidence.errorCategory,
    base0006Signature: evidence.base0006Signature,
    observed0007TableCount: evidence.observed0007TableCount,
    observed0007Columns: evidence.observed0007Columns,
    constraintsValidated: evidence.constraintsValidated,
    indexesValidReady: evidence.indexesValidReady,
    publicTableCount: evidence.publicTableCount,
    topicLabFormalRowCount: evidence.counts.topicLabFormalRowCount,
  }));
  assert.equal(evidence.activeDeploymentPointerProven, false);
  assert.equal(evidence.operatorIdentity, "PASS");
  assert.equal(evidence.safeStageBitmap.TRANSACTION_END, "YES");
  assert.equal(evidence.safeStageBitmap.LAST_COMPLETED_SUBSTAGE, "TRANSACTION_END");
  if (expectedState === "SCHEMA_PARTIAL_OR_INVALID") {
    assert.equal(evidence.resultFailureCategory, "SCHEMA_SIGNATURE_INVALID");
    assert.equal(evidence.sqlstateClass, "NOT_AVAILABLE");
  }
  if (expectedExit !== undefined) assert.equal(exitCode, expectedExit);
  return evidence;
}

let retainedRows = -1;
let tableFixtures = 0;
let columnFixtures = 0;
let constraintFixtures = 0;
let indexFixtures = 0;
try {
  await client.connect();

  await resetSchema("0006");
  const pre0007 = await runOperator("SCHEMA_0006_PRE_0007", { expectedExit: 0 });
  assert.equal(pre0007.base0006Signature, "PASS");
  assert.equal(pre0007.publicTableCount, 26);

  await q(await migration(migrations[6]));
  const observedShape = (await q(`SELECT
    (SELECT count(*) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND c.contype <> 'n')::int AS constraints,
    (SELECT count(*) FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions'))::int AS indexes,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND NOT t.tgisinternal)::int AS triggers`)).rows[0];
  console.log(`DISPOSABLE_SCHEMA_SHAPE=${observedShape.constraints}/${observedShape.indexes}/${observedShape.triggers}`);
  const complete = await runOperator("SCHEMA_0007_COMPLETE", { expectedExit: 0 });
  assert.equal(complete.observed0007TableCount, 2);
  assert.equal(complete.observed0007Columns, 28);
  assert.equal(complete.constraintsValidated, "PASS");
  assert.equal(complete.indexesValidReady, "PASS");

  const tables = (await q(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('research_topic_lab_runs','research_topic_lab_promotions')
    ORDER BY table_name`)).rows.map((row) => row.table_name);
  assert.equal(tables.length, 2);
  for (const table of tables) {
    await resetSchema();
    await q(`DROP TABLE ${quote(table)} CASCADE`);
    await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });
    tableFixtures += 1;
  }

  await resetSchema();
  const columns = (await q(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('research_topic_lab_runs','research_topic_lab_promotions')
    ORDER BY table_name,ordinal_position`)).rows;
  assert.equal(columns.length, 28);
  for (const { table_name: table, column_name: column } of columns) {
    await resetSchema();
    await q(`ALTER TABLE ${quote(table)} DROP COLUMN ${quote(column)} CASCADE`);
    await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });
    columnFixtures += 1;
  }

  await resetSchema();
  const constraints = (await q(`SELECT r.relname AS table_name,c.conname
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND c.contype <> 'n'
    ORDER BY r.relname,c.conname`)).rows;
  assert.equal(constraints.length, 24);
  for (const { table_name: table, conname } of constraints) {
    await resetSchema();
    await q(`ALTER TABLE ${quote(table)} DROP CONSTRAINT ${quote(conname)} CASCADE`);
    await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });
    constraintFixtures += 1;
  }

  await resetSchema();
  const indexes = (await q(`SELECT r.relname AS table_name,idx.relname AS index_name,con.conname
    FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_class idx ON idx.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace LEFT JOIN pg_constraint con ON con.conindid=i.indexrelid AND con.contype IN ('p','u')
    WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions')
    ORDER BY r.relname,idx.relname`)).rows;
  assert.equal(indexes.length, 10);
  for (const { table_name: table, index_name: index, conname } of indexes) {
    await resetSchema();
    if (conname) await q(`ALTER TABLE ${quote(table)} DROP CONSTRAINT ${quote(conname)} CASCADE`);
    else await q(`DROP INDEX ${quote(index)}`);
    await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });
    indexFixtures += 1;
  }

  await resetSchema();
  await q(`ALTER TABLE research_topic_lab_runs ADD CONSTRAINT disposable_unvalidated CHECK (true) NOT VALID`);
  await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });

  await resetSchema();
  const disposableIndex = (await q(`SELECT i.indexrelid FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'
      AND r.relname='research_topic_lab_runs' AND NOT i.indisprimary ORDER BY i.indexrelid LIMIT 1`)).rows[0].indexrelid;
  await q("UPDATE pg_index SET indisvalid=false WHERE indexrelid=$1", [disposableIndex]);
  await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });

  await resetSchema();
  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('bridge_u','Bridge Fixture','bridge-fixture@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('bridge_w','Bridge','bridge_u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('bridge_w','bridge_u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend)
      VALUES ('bridge_p','bridge_w','bridge_u','Bridge','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_studies (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,content_hash,design_payload)
      VALUES ('bridge_s','bridge_l',1,'bridge_w','bridge_p','bridge_u',repeat('a',64),'{}');
  `);
  const staticRows = await runOperator("SCHEMA_0007_COMPLETE", { expectedExit: 0 });
  assert.equal(staticRows.counts.userCount, 1);
  assert.equal(staticRows.counts.workspaceCount, 1);
  assert.equal(staticRows.counts.projectCount, 1);
  assert.equal(staticRows.counts.phase2FormalRowCount, 1);
  await q(`INSERT INTO research_topic_lab_runs
    (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,input_hash,result_hash,scoring_version,source_policy,evidence_status,idempotency_key,request_payload,result_payload,source_provenance)
    VALUES ('bridge_run','bridge_run',1,'bridge_w','bridge_p','bridge_u',repeat('b',64),repeat('c',64),'fixture-v1','NO_EXTERNAL_SOURCE','UNVERIFIED','bridge-idempotency','{}','{}','[]')`);
  const formalRows = await runOperator("SCHEMA_PARTIAL_OR_INVALID", { expectedExit: 2 });
  assert.equal(formalRows.counts.topicLabFormalRowCount, 1);

  await resetSchema();
  await q("CREATE ROLE bridge_query_failure LOGIN");
  const deniedUrl = new URL(databaseUrl);
  deniedUrl.username = "bridge_query_failure";
  deniedUrl.password = "";
  const queryFailure = await runOperator("DATABASE_UNAVAILABLE", { url: deniedUrl.href, expectedExit: 3 });
  assert.equal(queryFailure.errorCategory, "DATABASE_QUERY_UNAVAILABLE");
  assert.equal(queryFailure.resultFailureCategory, "QUERY_EXECUTION_FAILED");
  assert.equal(queryFailure.sqlstateClass, "SYNTAX_OR_ACCESS_RULE");
  assert.equal(queryFailure.safeStageBitmap.INVENTORY_SHAPE_VALIDATED, "YES");
  assert.equal(queryFailure.safeStageBitmap.COLUMN_SHAPE_VALIDATED, "YES");
  assert.equal(queryFailure.safeStageBitmap.STATIC_COUNT_QUERY_STARTED, "YES");
  assert.equal(queryFailure.safeStageBitmap.STATIC_COUNT_QUERY_COMPLETED, "NO");
  await q("DROP ROLE bridge_query_failure");

  await resetSchema();
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => runOperator("SCHEMA_0007_COMPLETE", { expectedExit: 0 })));
  assert.equal(concurrent.every((item) => item.readOnlyTransaction === "PASS"), true);

  await resetSchema();
  retainedRows = (await q(`SELECT (
    (SELECT count(*) FROM research_topic_lab_runs)+(SELECT count(*) FROM research_topic_lab_promotions)+
    (SELECT count(*) FROM projects)+(SELECT count(*) FROM project_artifacts)+
    (SELECT count(*) FROM research_studies)+(SELECT count(*) FROM "user")+
    (SELECT count(*) FROM account)+(SELECT count(*) FROM workspaces)+
    (SELECT count(*) FROM workspace_members)+(SELECT count(*) FROM registration_invites)
  )::int AS count`)).rows[0].count;
  assert.equal(retainedRows, 0);

  console.log("SCHEMA_0006_FIXTURE=PASS");
  console.log("SCHEMA_0007_FIXTURE=PASS");
  console.log(`MISSING_TABLE_FIXTURES=${tableFixtures}`);
  console.log(`MISSING_COLUMN_FIXTURES=${columnFixtures}`);
  console.log(`MISSING_CONSTRAINT_FIXTURES=${constraintFixtures}`);
  console.log(`MISSING_INDEX_FIXTURES=${indexFixtures}`);
  console.log("INVALID_INDEX_FIXTURE=PASS");
  console.log("UNVALIDATED_CONSTRAINT_FIXTURE=PASS");
  console.log("FORMAL_STATIC_ROWS_FIXTURE=PASS");
  console.log("QUERY_FAILURE_FIXTURE=PASS");
  console.log("CONCURRENCY_FIXTURE=PASS");
  console.log("PARTIAL_FAIL_CLOSED_FIXTURES=PASS");
  console.log("DISPOSABLE_PG18_GATE=PASS");
} catch (error) {
  console.log("DISPOSABLE_PG18_GATE=FAIL");
  throw error;
} finally {
  console.log(`DISPOSABLE_RETAINED_ROWS=${retainedRows}`);
  await client.end().catch(() => undefined);
}
