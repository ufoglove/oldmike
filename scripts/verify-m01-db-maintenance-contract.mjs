import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_ALLOWLIST,
  EXPECTED_TOPIC_COLUMNS,
  FIXED_SQL_SHA256,
  MIGRATION_DOWN_SHA256,
  MIGRATION_UP_SHA256,
  READONLY_ROLE,
  SCHEMA_STATES,
  classifySnapshot,
  hashMigration,
  runMigration,
  runReadonlyAudit,
  sanitizeEvidence,
  unwrapHashLockedMigration,
  validatePrivateDatabaseTarget,
} from "./m01-db-maintenance-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const up = await readFile(path.join(root, "database/migrations/0007_topic_lab_frontier_radar.up.sql"));
const down = await readFile(path.join(root, "database/migrations/0007_topic_lab_frontier_radar.down.sql"));
assert.equal(hashMigration(up), MIGRATION_UP_SHA256);
assert.equal(hashMigration(down), MIGRATION_DOWN_SHA256);
assert.match(unwrapHashLockedMigration(up, MIGRATION_UP_SHA256), /CREATE TABLE research_topic_lab_runs/);
assert.match(unwrapHashLockedMigration(down, MIGRATION_DOWN_SHA256), /MIGRATION_0007_DOWN_BLOCKED_TOPIC_LAB_DATA_PRESENT/);
assert.throws(() => unwrapHashLockedMigration(Buffer.from(`${up.toString("utf8")} `), MIGRATION_UP_SHA256), /MIGRATION_HASH_MISMATCH/);
assert.match(FIXED_SQL_SHA256, /^[a-f0-9]{64}$/);

assert.equal(validatePrivateDatabaseTarget("postgresql://role@oldmike-postgres-next/database").pass, true);
assert.equal(validatePrivateDatabaseTarget("postgresql://role@127.0.0.1:5432/database", { allowDisposable: true }).pass, true);
assert.equal(validatePrivateDatabaseTarget("postgresql://role@public.example.test/database").pass, false);
assert.equal(validatePrivateDatabaseTarget("https://role@oldmike-postgres-next/database").pass, false);

function inventory({ schema = "0007", readOnly = true } = {}) {
  if (schema === "0006") return {
    postgres_major: 18,
    transaction_read_only: readOnly,
    public_table_count: 26,
    base_table_count: 26,
    topic_table_count: 0,
    topic_constraint_count: 0,
    topic_validated_constraint_count: 0,
    topic_index_count: 0,
    topic_valid_ready_index_count: 0,
  };
  if (schema === "partial") return {
    postgres_major: 18,
    transaction_read_only: readOnly,
    public_table_count: 27,
    base_table_count: 26,
    topic_table_count: 1,
    topic_constraint_count: 11,
    topic_validated_constraint_count: 11,
    topic_index_count: 4,
    topic_valid_ready_index_count: 4,
  };
  return {
    postgres_major: 18,
    transaction_read_only: readOnly,
    public_table_count: 28,
    base_table_count: 26,
    topic_table_count: 2,
    topic_constraint_count: 24,
    topic_validated_constraint_count: 24,
    topic_index_count: 10,
    topic_valid_ready_index_count: 10,
  };
}

function columnsFor(schema) {
  if (schema === "0006") return [];
  if (schema === "partial") return EXPECTED_TOPIC_COLUMNS.slice(0, 17).map(([table_name, column_name, udt_name, is_nullable, defaultKind]) => ({
    table_name, column_name, udt_name, is_nullable, column_default: defaultKind === "NOW" ? "now()" : null,
  }));
  return EXPECTED_TOPIC_COLUMNS.map(([table_name, column_name, udt_name, is_nullable, defaultKind]) => ({
    table_name, column_name, udt_name, is_nullable, column_default: defaultKind === "NOW" ? "now()" : null,
  }));
}

assert.equal(classifySnapshot(inventory({ schema: "0006" }), [], 0).schemaState, SCHEMA_STATES.PRE_0007);
assert.equal(classifySnapshot(inventory(), columnsFor("0007"), 0).schemaState, SCHEMA_STATES.COMPLETE);
assert.equal(classifySnapshot(inventory({ schema: "partial" }), columnsFor("partial"), 0).schemaState, SCHEMA_STATES.PARTIAL);
assert.equal(classifySnapshot({ public_table_count: "invalid" }, [], 0).schemaState, SCHEMA_STATES.UNAVAILABLE);

class ScriptedClient {
  constructor(steps) {
    this.steps = [...steps];
    this.queries = [];
  }
  async connect() {}
  async end() {}
  async query(text, parameters) {
    this.queries.push({ text, parameterCount: parameters?.length ?? 0 });
    const next = this.steps.shift();
    if (!next) throw new Error("UNEXPECTED_QUERY");
    if (next.throw) throw next.throw;
    return next.result ?? { rows: [] };
  }
}

const row = (value) => ({ rows: [value] });
function readonlySteps(schema = "0007", role = READONLY_ROLE) {
  const steps = [
    {}, {},
    { result: row({ current_role: role }) },
    { result: row(inventory({ schema })) },
    { result: { rows: columnsFor(schema) } },
  ];
  if (schema === "0007") steps.push({ result: row({ topic_formal_rows: 0 }) });
  steps.push({ result: row({ no_xid_assigned: true }) }, {});
  return steps;
}

let client;
const audit = await runReadonlyAudit({
  clientFactory: () => (client = new ScriptedClient(readonlySteps())),
  databaseUrl: "postgresql://readonly_auditor@127.0.0.1:5432/disposable",
  allowDisposable: true,
});
assert.equal(audit.schemaState, SCHEMA_STATES.COMPLETE);
assert.equal(audit.roleGate, "PASS_READONLY_AUDITOR");
assert.equal(audit.readOnlyTransaction, "PASS");
assert.equal(audit.databaseRowWrites, 0);
assert.equal(client.steps.length, 0);
assert.equal(client.queries[0].text, "BEGIN READ ONLY");
assert.equal(client.queries.at(-1).text, "ROLLBACK");
assert.equal(client.queries.some(({ text }) => /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|COPY|CALL)\b/i.test(text)), false);

const roleFailure = await runReadonlyAudit({
  clientFactory: () => new ScriptedClient(readonlySteps("0007", "migration_runner").slice(0, 4)),
  databaseUrl: "postgresql://readonly_auditor@127.0.0.1:5432/disposable",
  allowDisposable: true,
});
assert.equal(roleFailure.schemaState, SCHEMA_STATES.UNAVAILABLE);
assert.equal(roleFailure.errorCategory, "ROLE_MISMATCH");

function migrationSteps(before, after, { lock = true } = {}) {
  const steps = [
    {}, {},
    { result: row({ current_role: "migration_runner" }) },
    { result: row({ acquired: lock }) },
    { result: row(inventory({ schema: before, readOnly: false })) },
    { result: { rows: columnsFor(before) } },
  ];
  if (before === "0007") steps.push({ result: row({ topic_formal_rows: 0 }) });
  if (before === "0007" && after === "0007") return [...steps, {}];
  steps.push({});
  steps.push({ result: row(inventory({ schema: after, readOnly: false })) });
  steps.push({ result: { rows: columnsFor(after) } });
  if (after === "0007") steps.push({ result: row({ topic_formal_rows: 0 }) });
  steps.push({});
  return steps;
}

let migrationClient;
const migration = await runMigration({
  clientFactory: () => (migrationClient = new ScriptedClient(migrationSteps("0006", "0007"))),
  databaseUrl: "postgresql://migration_runner@127.0.0.1:5432/disposable",
  direction: "UP",
  migrationBytes: up,
  allowDisposable: true,
});
assert.equal(migration.migrationResult, "APPLIED_0007");
assert.equal(migration.schemaState, SCHEMA_STATES.COMPLETE);
assert.equal(migration.advisoryLock, "PASS_EXCLUSIVE_XACT");
assert.equal(migration.databaseRowWrites, 0);
assert.equal(migrationClient.queries.filter(({ text }) => text === "COMMIT").length, 1);

const idempotent = await runMigration({
  clientFactory: () => new ScriptedClient(migrationSteps("0007", "0007")),
  databaseUrl: "postgresql://migration_runner@127.0.0.1:5432/disposable",
  direction: "UP",
  migrationBytes: up,
  allowDisposable: true,
});
assert.equal(idempotent.migrationResult, "ALREADY_COMPLETE");
assert.equal(idempotent.transactionOutcome, "ROLLBACK_IDEMPOTENT_ALREADY_COMPLETE");

const lockFailure = await runMigration({
  clientFactory: () => new ScriptedClient(migrationSteps("0006", "0007", { lock: false }).slice(0, 6)),
  databaseUrl: "postgresql://migration_runner@127.0.0.1:5432/disposable",
  direction: "UP",
  migrationBytes: up,
  allowDisposable: true,
});
assert.equal(lockFailure.errorCategory, "ADVISORY_LOCK_UNAVAILABLE");
assert.equal(lockFailure.migrationResult, "NOT_APPLIED");

const hashFailure = await runMigration({
  clientFactory: () => { throw new Error("CLIENT_MUST_NOT_BE_CREATED"); },
  databaseUrl: "postgresql://migration_runner@127.0.0.1:5432/disposable",
  direction: "UP",
  migrationBytes: Buffer.from("altered"),
  allowDisposable: true,
});
assert.equal(hashFailure.errorCategory, "MIGRATION_HASH_MISMATCH");

const safe = sanitizeEvidence(audit);
assert.deepEqual(Object.keys(safe), Object.keys(audit));
assert.equal(Object.keys(safe).every((key) => CONTRACT_ALLOWLIST.includes(key)), true);
assert.throws(() => sanitizeEvidence({ ...audit, rawValue: "forbidden" }), /EVIDENCE_KEY_NOT_ALLOWLISTED/);
assert.throws(() => sanitizeEvidence({ errorCategory: "postgresql:\/\/role@host/database" }), /EVIDENCE_SENSITIVE_CONTENT_REJECTED/);

for (const source of [
  await readFile(path.join(root, "scripts/m01-db-maintenance-contract.mjs"), "utf8"),
  await readFile(path.join(root, "scripts/m01-db-maintenance-readonly.mjs"), "utf8"),
  await readFile(path.join(root, "scripts/m01-db-maintenance-migrate-0007.mjs"), "utf8"),
]) {
  assert.doesNotMatch(source, /executeCommand|WebSocket|Computer Use|console\.log\(.*(?:DATABASE_URL|password|secret|token|email|hostname|connection)/i);
}

console.log("M01_MAINTENANCE_PROVIDER_CONTRACT=PASS");
console.log("M01_MAINTENANCE_CONSUMER_CONTRACT=PASS");
console.log("ROLE_SEPARATION_CONTRACT=PASS");
console.log("FIXED_SQL_HASH_CONTRACT=PASS");
console.log("MIGRATION_HASH_LOCK_CONTRACT=PASS");
console.log("READONLY_ZERO_WRITE_CONTRACT=PASS");
console.log("ADVISORY_LOCK_CONTRACT=PASS");
console.log("IDEMPOTENCY_CONTRACT=PASS");
console.log("PRIVATE_NETWORK_ONLY_CONTRACT=PASS");
console.log("SANITIZED_EVIDENCE_CONTRACT=PASS");
