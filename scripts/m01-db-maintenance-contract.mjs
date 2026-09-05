import { createHash } from "node:crypto";

export const CONTRACT_VERSION = "old-mike.m01-db-maintenance.v1";
export const READONLY_ROLE = "readonly_auditor";
export const MIGRATION_ROLE = "migration_runner";
export const MIGRATION_UP_SHA256 = "8dce3d2ef516be42e676c4643a14c253de167469e80f7e86cdf8d20f7f80d815";
export const MIGRATION_DOWN_SHA256 = "0cbb2231c3fe294da4234d56094d881bcea1706866003a3bfb3a881b15baa03d";
export const ADVISORY_LOCK_KEY = 1_527_007;

export const TIMEOUTS = Object.freeze({
  connectMs: 5_000,
  lockMs: 3_000,
  statementMs: 15_000,
  idleTransactionMs: 18_000,
  overallMs: 24_000,
});

export const SCHEMA_STATES = Object.freeze({
  PRE_0007: "SCHEMA_0006_PRE_0007",
  COMPLETE: "SCHEMA_0007_COMPLETE",
  PARTIAL: "SCHEMA_PARTIAL_OR_INVALID",
  UNAVAILABLE: "EVIDENCE_INSUFFICIENT",
});

const BASE_0006_TABLES = Object.freeze([
  "user", "session", "account", "verification", "rateLimit", "workspaces",
  "workspace_members", "projects", "project_artifacts", "user_consents",
  "audit_events", "portal_rate_limits", "registration_invites", "research_studies",
  "research_datasets", "research_analysis_plans", "research_analysis_runs",
  "research_evidence_sources", "research_claims", "research_claim_evidence",
  "research_documents", "research_human_gates", "research_workflow_events",
  "portal_administrator", "account_provisioning_state", "account_admin_events",
]);

const TOPIC_TABLES = Object.freeze([
  "research_topic_lab_runs",
  "research_topic_lab_promotions",
]);

export const EXPECTED_TOPIC_COLUMNS = Object.freeze([
  ["research_topic_lab_runs", "id", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "logical_id", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "version_number", "int4", "NO", "NONE"],
  ["research_topic_lab_runs", "supersedes_version_id", "text", "YES", "NONE"],
  ["research_topic_lab_runs", "workspace_id", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "project_id", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "created_by_user_id", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "created_at", "timestamptz", "NO", "NOW"],
  ["research_topic_lab_runs", "input_hash", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "result_hash", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "scoring_version", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "source_policy", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "evidence_status", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "idempotency_key", "text", "NO", "NONE"],
  ["research_topic_lab_runs", "request_payload", "jsonb", "NO", "NONE"],
  ["research_topic_lab_runs", "result_payload", "jsonb", "NO", "NONE"],
  ["research_topic_lab_runs", "source_provenance", "jsonb", "NO", "NONE"],
  ["research_topic_lab_promotions", "id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "workspace_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "project_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "created_by_user_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "created_at", "timestamptz", "NO", "NOW"],
  ["research_topic_lab_promotions", "run_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "candidate_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "candidate_hash", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "human_gate_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "study_version_id", "text", "NO", "NONE"],
  ["research_topic_lab_promotions", "idempotency_key", "text", "NO", "NONE"],
]);

const SQL = Object.freeze({
  beginReadonly: "BEGIN READ ONLY",
  beginMigration: "BEGIN",
  rollback: "ROLLBACK",
  commit: "COMMIT",
  timeouts: `SET LOCAL lock_timeout = '${TIMEOUTS.lockMs}ms'; SET LOCAL statement_timeout = '${TIMEOUTS.statementMs}ms'; SET LOCAL idle_in_transaction_session_timeout = '${TIMEOUTS.idleTransactionMs}ms'`,
  role: "SELECT current_user AS current_role",
  advisoryLock: "SELECT true AS acquired FROM pg_advisory_xact_lock($1)",
  xid: "SELECT pg_current_xact_id_if_assigned() IS NULL AS no_xid_assigned",
  inventory: `SELECT
    (current_setting('server_version_num')::int / 10000)::int AS postgres_major,
    current_setting('transaction_read_only') = 'on' AS transaction_read_only,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS public_table_count,
    (SELECT count(*)::int FROM unnest($1::text[]) expected(name) WHERE to_regclass('public.' || quote_ident(expected.name)) IS NOT NULL) AS base_table_count,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($2::text[])) AS topic_table_count,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY($2::text[]) AND c.contype <> 'n') AS topic_constraint_count,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY($2::text[]) AND c.contype <> 'n' AND c.convalidated) AS topic_validated_constraint_count,
    (SELECT count(*)::int FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY($2::text[])) AS topic_index_count,
    (SELECT count(*)::int FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY($2::text[]) AND i.indisvalid AND i.indisready) AS topic_valid_ready_index_count`,
  columns: `SELECT table_name,column_name,udt_name,is_nullable,column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=ANY($1::text[])
    ORDER BY table_name,ordinal_position`,
  topicRows: "SELECT ((SELECT count(*) FROM research_topic_lab_runs) + (SELECT count(*) FROM research_topic_lab_promotions))::int AS topic_formal_rows",
});

export const FIXED_SQL_SHA256 = createHash("sha256")
  .update(Object.values(SQL).join("\n-- fixed-boundary --\n"))
  .update(JSON.stringify({ BASE_0006_TABLES, TOPIC_TABLES, EXPECTED_TOPIC_COLUMNS }))
  .digest("hex");

function integer(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function exactColumns(rows) {
  if (!Array.isArray(rows) || rows.length !== EXPECTED_TOPIC_COLUMNS.length) return false;
  const actual = new Set(rows.map((column) => {
    if (!column || typeof column !== "object" || Array.isArray(column)) return "INVALID";
    const defaultKind = column.column_default === "now()" ? "NOW" : column.column_default == null ? "NONE" : "OTHER";
    return [column.table_name, column.column_name, column.udt_name, column.is_nullable, defaultKind].join("\u0000");
  }));
  return EXPECTED_TOPIC_COLUMNS.every((expected) => actual.has(expected.join("\u0000")));
}

function oneRow(result) {
  if (!result || typeof result !== "object" || !Array.isArray(result.rows) || result.rows.length !== 1 ||
      !result.rows[0] || typeof result.rows[0] !== "object" || Array.isArray(result.rows[0])) {
    throw new Error("RESULT_SHAPE_INVALID");
  }
  return result.rows[0];
}

function privateHostname(hostname, allowDisposable) {
  const value = hostname.toLowerCase();
  if (allowDisposable && ["localhost", "127.0.0.1", "::1"].includes(value)) return true;
  if (/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(value)) return true;
  if (value.endsWith(".internal") || value.endsWith(".private")) return true;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) && !value.includes(".") && value !== "localhost";
}

export function validatePrivateDatabaseTarget(databaseUrl, { allowDisposable = false } = {}) {
  try {
    const parsed = new URL(databaseUrl);
    const protocolPass = ["postgres:", "postgresql:"].includes(parsed.protocol);
    const hostPass = privateHostname(parsed.hostname, allowDisposable);
    const credentialsPresent = Boolean(parsed.username);
    return Object.freeze({
      protocol: protocolPass ? "PASS" : "FAIL",
      privateHostPolicy: hostPass ? "PASS" : "FAIL",
      credentialsPresent: credentialsPresent ? "PRESENT" : "MISSING",
      publicDatabasePortExposed: "NOT_USED",
      pass: protocolPass && hostPass && credentialsPresent,
    });
  } catch {
    return Object.freeze({
      protocol: "FAIL",
      privateHostPolicy: "FAIL",
      credentialsPresent: "NOT_AVAILABLE",
      publicDatabasePortExposed: "NOT_USED",
      pass: false,
    });
  }
}

export function hashMigration(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function unwrapHashLockedMigration(bytes, expectedHash) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes);
  if (hashMigration(Buffer.from(text, "utf8")) !== expectedHash) throw new Error("MIGRATION_HASH_MISMATCH");
  const normalized = text.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("BEGIN;\n\n") || !normalized.endsWith("\nCOMMIT;\n")) {
    throw new Error("MIGRATION_TRANSACTION_ENVELOPE_INVALID");
  }
  const body = normalized.slice("BEGIN;\n\n".length, -"\nCOMMIT;\n".length);
  if (!body.trim() || /\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i.test(body)) throw new Error("MIGRATION_BODY_INVALID");
  return body;
}

export function classifySnapshot(inventory, columns, topicFormalRows = 0) {
  const required = [
    "postgres_major", "public_table_count", "base_table_count", "topic_table_count",
    "topic_constraint_count", "topic_validated_constraint_count", "topic_index_count",
    "topic_valid_ready_index_count",
  ];
  const values = Object.fromEntries(required.map((key) => [key, integer(inventory?.[key])]));
  if (Object.values(values).some((value) => value === null) || typeof inventory?.transaction_read_only !== "boolean") {
    return { schemaState: SCHEMA_STATES.UNAVAILABLE, resultShape: "FAIL" };
  }
  const basePass = values.base_table_count === BASE_0006_TABLES.length;
  const exactColumnPass = exactColumns(columns);
  let schemaState = SCHEMA_STATES.PARTIAL;
  if (basePass && values.public_table_count === 26 && values.topic_table_count === 0 && columns.length === 0) {
    schemaState = SCHEMA_STATES.PRE_0007;
  } else if (basePass && values.public_table_count === 28 && values.topic_table_count === 2 && exactColumnPass &&
      values.topic_constraint_count === 24 && values.topic_validated_constraint_count === 24 &&
      values.topic_index_count === 10 && values.topic_valid_ready_index_count === 10 && topicFormalRows >= 0) {
    schemaState = SCHEMA_STATES.COMPLETE;
  }
  return {
    schemaState,
    resultShape: "PASS",
    postgresMajor: values.postgres_major,
    base0006Signature: basePass ? "PASS" : "FAIL",
    publicTableCount: values.public_table_count,
    expected0007TableCount: 2,
    observed0007TableCount: values.topic_table_count,
    expected0007ColumnCount: 28,
    observed0007ColumnCount: columns.length,
    constraintsValidated: values.topic_constraint_count === 24 && values.topic_validated_constraint_count === 24 ? "PASS" : "FAIL",
    indexesValidReady: values.topic_index_count === 10 && values.topic_valid_ready_index_count === 10 ? "PASS" : "FAIL",
    topicLabFormalRowCount: topicFormalRows,
  };
}

async function fixedSnapshot(client) {
  const inventory = oneRow(await client.query(SQL.inventory, [BASE_0006_TABLES, TOPIC_TABLES]));
  const columnResult = await client.query(SQL.columns, [TOPIC_TABLES]);
  if (!columnResult || !Array.isArray(columnResult.rows)) throw new Error("RESULT_SHAPE_INVALID");
  const topicCount = integer(inventory.topic_table_count);
  let topicFormalRows = 0;
  if (topicCount === 2) topicFormalRows = integer(oneRow(await client.query(SQL.topicRows)).topic_formal_rows);
  if (topicFormalRows === null) throw new Error("RESULT_SHAPE_INVALID");
  return classifySnapshot(inventory, columnResult.rows, topicFormalRows);
}

function evidenceBase(mode, targetGate) {
  return {
    contractVersion: CONTRACT_VERSION,
    mode,
    targetPolicy: targetGate.pass ? "PASS_PRIVATE_ONLY" : "FAIL_CLOSED",
    fixedSqlSha256: FIXED_SQL_SHA256,
    migrationUpSha256: MIGRATION_UP_SHA256,
    migrationDownSha256: MIGRATION_DOWN_SHA256,
    roleGate: "NOT_EXECUTED",
    readOnlyTransaction: "NOT_EXECUTED",
    advisoryLock: mode === "READONLY_AUDIT" ? "NOT_APPLICABLE" : "NOT_EXECUTED",
    transactionOutcome: "NOT_EXECUTED",
    databaseRowWrites: 0,
    schemaWrites: "NONE",
    errorCategory: "NONE",
  };
}

function sanitizedError(error) {
  const allowed = new Set([
    "TARGET_POLICY_REJECTED", "ROLE_MISMATCH", "RESULT_SHAPE_INVALID", "MIGRATION_HASH_MISMATCH",
    "MIGRATION_TRANSACTION_ENVELOPE_INVALID", "MIGRATION_BODY_INVALID", "ADVISORY_LOCK_UNAVAILABLE",
    "SCHEMA_PRECONDITION_FAILED", "SCHEMA_POSTCONDITION_FAILED", "READONLY_WRITE_PROOF_FAILED",
  ]);
  return allowed.has(error?.message) ? error.message : "DATABASE_OPERATION_FAILED";
}

async function roleGate(client, expected) {
  const row = oneRow(await client.query(SQL.role));
  if (row.current_role !== expected) throw new Error("ROLE_MISMATCH");
}

async function setTimeouts(client) {
  await client.query(SQL.timeouts);
}

export async function runReadonlyAudit({ clientFactory, databaseUrl, allowDisposable = false }) {
  const target = validatePrivateDatabaseTarget(databaseUrl, { allowDisposable });
  const evidence = evidenceBase("READONLY_AUDIT", target);
  if (!target.pass) return { ...evidence, errorCategory: "TARGET_POLICY_REJECTED", schemaState: SCHEMA_STATES.UNAVAILABLE };
  const client = clientFactory({ connectionString: databaseUrl, connectionTimeoutMillis: TIMEOUTS.connectMs });
  try {
    await client.connect();
    await client.query(SQL.beginReadonly);
    evidence.readOnlyTransaction = "PASS";
    await setTimeouts(client);
    await roleGate(client, READONLY_ROLE);
    evidence.roleGate = "PASS_READONLY_AUDITOR";
    const snapshot = await fixedSnapshot(client);
    const noXid = oneRow(await client.query(SQL.xid)).no_xid_assigned;
    if (noXid !== true) throw new Error("READONLY_WRITE_PROOF_FAILED");
    await client.query(SQL.rollback);
    evidence.transactionOutcome = "ROLLBACK_READ_ONLY";
    return { ...evidence, ...snapshot };
  } catch (error) {
    await client.query(SQL.rollback).catch(() => undefined);
    return { ...evidence, schemaState: SCHEMA_STATES.UNAVAILABLE, transactionOutcome: "ROLLBACK_FAIL_CLOSED", errorCategory: sanitizedError(error) };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function runMigration({
  clientFactory,
  databaseUrl,
  direction,
  migrationBytes,
  allowDisposable = false,
}) {
  const target = validatePrivateDatabaseTarget(databaseUrl, { allowDisposable });
  const mode = direction === "UP" ? "MIGRATION_0007_UP" : direction === "DOWN_TEST_ONLY" ? "MIGRATION_0007_DOWN_TEST_ONLY" : "INVALID";
  const evidence = evidenceBase(mode, target);
  if (mode === "INVALID" || !target.pass) return { ...evidence, errorCategory: "TARGET_POLICY_REJECTED", schemaState: SCHEMA_STATES.UNAVAILABLE };
  const expectedHash = direction === "UP" ? MIGRATION_UP_SHA256 : MIGRATION_DOWN_SHA256;
  let migrationBody;
  try {
    migrationBody = unwrapHashLockedMigration(migrationBytes, expectedHash);
  } catch (error) {
    return { ...evidence, errorCategory: sanitizedError(error), schemaState: SCHEMA_STATES.UNAVAILABLE };
  }
  const client = clientFactory({ connectionString: databaseUrl, connectionTimeoutMillis: TIMEOUTS.connectMs });
  try {
    await client.connect();
    await client.query(SQL.beginMigration);
    await setTimeouts(client);
    await roleGate(client, MIGRATION_ROLE);
    evidence.roleGate = "PASS_MIGRATION_RUNNER";
    const acquired = oneRow(await client.query(SQL.advisoryLock, [ADVISORY_LOCK_KEY])).acquired;
    if (acquired !== true) throw new Error("ADVISORY_LOCK_UNAVAILABLE");
    evidence.advisoryLock = "PASS_EXCLUSIVE_XACT";
    const before = await fixedSnapshot(client);
    if (direction === "UP" && before.schemaState === SCHEMA_STATES.COMPLETE) {
      await client.query(SQL.rollback);
      return { ...evidence, ...before, transactionOutcome: "ROLLBACK_IDEMPOTENT_ALREADY_COMPLETE", migrationResult: "ALREADY_COMPLETE" };
    }
    const requiredState = direction === "UP" ? SCHEMA_STATES.PRE_0007 : SCHEMA_STATES.COMPLETE;
    if (before.schemaState !== requiredState) throw new Error("SCHEMA_PRECONDITION_FAILED");
    await client.query(migrationBody);
    const after = await fixedSnapshot(client);
    const expectedState = direction === "UP" ? SCHEMA_STATES.COMPLETE : SCHEMA_STATES.PRE_0007;
    if (after.schemaState !== expectedState) throw new Error("SCHEMA_POSTCONDITION_FAILED");
    await client.query(SQL.commit);
    return {
      ...evidence,
      ...after,
      transactionOutcome: "COMMIT_EXACT_MIGRATION",
      migrationResult: direction === "UP" ? "APPLIED_0007" : "DOWN_EMPTY_DATA_TEST_PASS",
      schemaWrites: direction === "UP" ? "0007_ONLY" : "0007_DOWN_TEST_ONLY",
    };
  } catch (error) {
    await client.query(SQL.rollback).catch(() => undefined);
    return {
      ...evidence,
      schemaState: SCHEMA_STATES.UNAVAILABLE,
      transactionOutcome: "ROLLBACK_FAIL_CLOSED",
      migrationResult: "NOT_APPLIED",
      errorCategory: sanitizedError(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export const CONTRACT_ALLOWLIST = Object.freeze([
  "contractVersion", "mode", "targetPolicy", "fixedSqlSha256", "migrationUpSha256",
  "migrationDownSha256", "roleGate", "readOnlyTransaction", "advisoryLock",
  "transactionOutcome", "databaseRowWrites", "schemaWrites", "errorCategory",
  "schemaState", "resultShape", "postgresMajor", "base0006Signature", "publicTableCount",
  "expected0007TableCount", "observed0007TableCount", "expected0007ColumnCount",
  "observed0007ColumnCount", "constraintsValidated", "indexesValidReady",
  "topicLabFormalRowCount", "migrationResult",
]);

export function sanitizeEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) throw new Error("EVIDENCE_SHAPE_INVALID");
  const output = {};
  for (const key of CONTRACT_ALLOWLIST) if (Object.hasOwn(evidence, key)) output[key] = evidence[key];
  if (Object.keys(evidence).some((key) => !CONTRACT_ALLOWLIST.includes(key))) throw new Error("EVIDENCE_KEY_NOT_ALLOWLISTED");
  const serialized = JSON.stringify(output);
  if (/(?:postgres(?:ql)?:\/\/|@[^\s]+|password|secret|token|email|hostname|connection.?string)/i.test(serialized)) {
    throw new Error("EVIDENCE_SENSITIVE_CONTENT_REJECTED");
  }
  return Object.freeze(output);
}
