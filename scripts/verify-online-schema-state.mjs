import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  SAFE_STAGE_EVENTS,
  advanceClientConnectionState,
  advanceQueryPromisePhase,
  advanceSafeStageBitmap,
  classifyErrorEvidence,
  createInitialErrorEvidenceBitmap,
  createInitialSafeStageBitmap,
} from "./schema-evidence-safe-stage-contract.mjs";

export const OPERATOR_CONTRACT_VERSION = "old-mike.schema-evidence-operator.v4";
export const EMBEDDED_RELEASE_IDENTITY =
  "old-mike-research-portal/1.5.27/01a949e3e18a6d59169b9ffaf39e15fe168da3e370475bdd1abf164aba952f2b";
export const OPERATOR_NORMALIZED_SHA256 = "f5c6983ee4b9be65b5446394cbaeefb0b5635a8c7b1160033a22dc901232ef2e";

export const BUDGET = Object.freeze({
  connectMs: 5_000,
  lockMs: 3_000,
  statementMs: 15_000,
  idleTransactionMs: 18_000,
  overallMs: 22_000,
});

export const SCHEMA_STATES = Object.freeze({
  PRE_0007: "SCHEMA_0006_PRE_0007",
  COMPLETE: "SCHEMA_0007_COMPLETE",
  PARTIAL: "SCHEMA_PARTIAL_OR_INVALID",
  UNAVAILABLE: "DATABASE_UNAVAILABLE",
});

export const RESULT_FAILURE_CATEGORIES = Object.freeze([
  "NONE",
  "QUERY_EXECUTION_FAILED",
  "ROW_SHAPE_INVALID",
  "VALUE_TYPE_INVALID",
  "CARDINALITY_INVALID",
  "SCHEMA_SIGNATURE_INVALID",
  "NOT_AVAILABLE",
  "UNKNOWN_FAIL_CLOSED",
]);

export const SQLSTATE_CLASSES = Object.freeze([
  "CONNECTION",
  "AUTHENTICATION_OR_AUTHORIZATION",
  "TRANSACTION_STATE",
  "SYNTAX_OR_ACCESS_RULE",
  "RESOURCE_LIMIT",
  "QUERY_CANCELED_OR_TIMEOUT",
  "DATA_OR_CARDINALITY",
  "INTERNAL_OR_SYSTEM",
  "NOT_AVAILABLE",
  "UNKNOWN_FAIL_CLOSED",
]);

const BASE_0006_TABLES = Object.freeze([
  "user", "session", "account", "verification", "rateLimit", "workspaces",
  "workspace_members", "projects", "project_artifacts", "user_consents",
  "audit_events", "portal_rate_limits", "registration_invites", "research_studies",
  "research_datasets", "research_analysis_plans", "research_analysis_runs",
  "research_evidence_sources", "research_claims", "research_claim_evidence",
  "research_documents", "research_human_gates", "research_workflow_events",
  "portal_administrator", "account_provisioning_state", "account_admin_events",
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

const TOPIC_TABLES = Object.freeze([
  "research_topic_lab_runs",
  "research_topic_lab_promotions",
]);

const COUNT_KEYS = Object.freeze([
  "projectCount", "projectArtifactCount", "phase2FormalRowCount",
  "administratorCount", "userCount", "accountCount", "workspaceCount",
  "membershipCount", "currentSessionCount", "inviteTotalCount",
  "activeUnusedInviteCount", "topicLabFormalRowCount",
]);

function integer(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

export function classifySqlstateClass(code) {
  if (code === undefined || code === null || code === "") return "NOT_AVAILABLE";
  if (typeof code !== "string" || !/^[0-9A-Z]{5}$/.test(code)) return "UNKNOWN_FAIL_CLOSED";
  if (code === "57014") return "QUERY_CANCELED_OR_TIMEOUT";
  const prefix = code.slice(0, 2);
  if (prefix === "08") return "CONNECTION";
  if (prefix === "28") return "AUTHENTICATION_OR_AUTHORIZATION";
  if (prefix === "25") return "TRANSACTION_STATE";
  if (prefix === "42") return "SYNTAX_OR_ACCESS_RULE";
  if (["53", "54"].includes(prefix)) return "RESOURCE_LIMIT";
  if (["21", "22", "23"].includes(prefix)) return "DATA_OR_CARDINALITY";
  if (["57", "58", "XX"].includes(prefix)) return "INTERNAL_OR_SYSTEM";
  return "UNKNOWN_FAIL_CLOSED";
}

function evidenceFailure(category) {
  if (!["ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID", "CARDINALITY_INVALID"].includes(category)) {
    throw new Error("EVIDENCE_FAILURE_CATEGORY_INVALID");
  }
  return Object.assign(new Error("SANITIZED_EVIDENCE_FAILURE"), {
    code: "OLD_MIKE_EVIDENCE_FAILURE",
    resultFailureCategory: category,
  });
}

function assertQueryResult(result, cardinality) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !Array.isArray(result.rows)) {
    throw evidenceFailure("ROW_SHAPE_INVALID");
  }
  if (cardinality !== null && result.rows.length !== cardinality) {
    throw evidenceFailure("CARDINALITY_INVALID");
  }
  if (!result.rows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))) {
    throw evidenceFailure("ROW_SHAPE_INVALID");
  }
  return result;
}

const INVENTORY_COUNT_FIELDS = Object.freeze([
  "postgres_major", "public_table_count", "topic_table_count", "topic_constraint_count",
  "topic_validated_constraint_count", "topic_index_count", "topic_valid_ready_index_count",
  "topic_trigger_count", "research_direction_gate_count",
]);
const STATIC_COUNT_FIELDS = Object.freeze([
  "project_count", "project_artifact_count", "phase2_formal_row_count", "administrator_count",
  "user_count", "account_count", "workspace_count", "membership_count", "current_session_count",
  "invite_total_count", "active_unused_invite_count",
]);

function assertInventoryValueTypes(row) {
  if (INVENTORY_COUNT_FIELDS.some((key) => integer(row[key]) === null) ||
      typeof row.database_identity_present !== "boolean" || typeof row.read_only !== "boolean" ||
      typeof row.base_0006_signature !== "boolean") throw evidenceFailure("VALUE_TYPE_INVALID");
}

function assertColumnValueTypes(rows) {
  for (const row of rows) {
    if (![row.table_name, row.column_name, row.udt_name, row.is_nullable].every((value) => typeof value === "string") ||
        !(row.column_default === null || typeof row.column_default === "string")) {
      throw evidenceFailure("VALUE_TYPE_INVALID");
    }
  }
}

function assertStaticCountValueTypes(row) {
  if (STATIC_COUNT_FIELDS.some((key) => integer(row[key]) === null)) {
    throw evidenceFailure("VALUE_TYPE_INVALID");
  }
}

function fixedUnavailable(
  errorCategory,
  identity = { pass: false, sourceSha256: "NOT_AVAILABLE" },
  safeStageBitmap = createInitialSafeStageBitmap(),
  {
    resultFailureCategory = "NOT_AVAILABLE",
    sqlstateClass = "NOT_AVAILABLE",
    errorEvidenceBitmap = createInitialErrorEvidenceBitmap(),
  } = {},
) {
  return {
    contractVersion: OPERATOR_CONTRACT_VERSION,
    releaseIdentity: EMBEDDED_RELEASE_IDENTITY,
    operatorSourceSha256: identity.sourceSha256,
    operatorIdentity: identity.pass ? "PASS" : "FAIL",
    classification: SCHEMA_STATES.UNAVAILABLE,
    errorCategory,
    resultFailureCategory,
    sqlstateClass,
    readOnlyTransaction: "FAIL",
    base0006Signature: "NOT_EXECUTED",
    expected0007TableCount: 2,
    observed0007TableCount: "NOT_AVAILABLE",
    expected0007Columns: 28,
    observed0007Columns: "NOT_AVAILABLE",
    constraintsValidated: "NOT_EXECUTED",
    indexesValidReady: "NOT_EXECUTED",
    publicTableCount: "NOT_AVAILABLE",
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, "NOT_AVAILABLE"])),
    safeStageBitmap,
    errorEvidenceBitmap,
    activeDeploymentPointerProven: false,
  };
}

function exactColumns(actualColumns) {
  if (!Array.isArray(actualColumns) || actualColumns.length !== EXPECTED_TOPIC_COLUMNS.length) return false;
  const actual = new Set(actualColumns.map((column) => {
    if (!column || typeof column !== "object") return "INVALID";
    const defaultKind = column.column_default === "now()" ? "NOW" : column.column_default == null ? "NONE" : "OTHER";
    return [column.table_name, column.column_name, column.udt_name, column.is_nullable, defaultKind].join("\u0000");
  }));
  return EXPECTED_TOPIC_COLUMNS.every((column) => actual.has(column.join("\u0000")));
}

export function classifySchemaSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {
      classification: SCHEMA_STATES.PARTIAL,
      errorCategory: "RESULT_SHAPE_INVALID",
      resultFailureCategory: "ROW_SHAPE_INVALID",
      sqlstateClass: "NOT_AVAILABLE",
    };
  }
  const numericKeys = [
    "postgresMajor", "publicTableCount", "topicTableCount", "topicConstraintCount",
    "topicValidatedConstraintCount", "topicIndexCount", "topicValidReadyIndexCount",
    "topicTriggerCount", "researchDirectionGateCount",
  ];
  const numeric = Object.fromEntries(numericKeys.map((key) => [key, integer(snapshot[key])]));
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, integer(snapshot.counts?.[key])]));
  if (Object.values(numeric).some((value) => value === null) ||
      Object.values(counts).some((value) => value === null) ||
      typeof snapshot.readOnly !== "boolean" || typeof snapshot.databaseIdentityPresent !== "boolean" ||
      typeof snapshot.base0006Signature !== "boolean" || !Array.isArray(snapshot.topicColumns)) {
    return {
      classification: SCHEMA_STATES.PARTIAL,
      errorCategory: "RESULT_SHAPE_INVALID",
      resultFailureCategory: "VALUE_TYPE_INVALID",
      sqlstateClass: "NOT_AVAILABLE",
    };
  }

  const columnCount = snapshot.topicColumns.length;
  const baseValid = snapshot.readOnly && snapshot.databaseIdentityPresent &&
    numeric.postgresMajor === 18 && snapshot.base0006Signature;
  const complete = baseValid && numeric.publicTableCount === 28 &&
    numeric.topicTableCount === 2 && columnCount === 28 && exactColumns(snapshot.topicColumns) &&
    numeric.topicConstraintCount === 24 && numeric.topicValidatedConstraintCount === 24 &&
    numeric.topicIndexCount === 10 && numeric.topicValidReadyIndexCount === 10 &&
    numeric.topicTriggerCount === 2 && numeric.researchDirectionGateCount === 1 &&
    counts.topicLabFormalRowCount === 0;
  const absent = baseValid && numeric.publicTableCount === 26 &&
    numeric.topicTableCount === 0 && columnCount === 0 &&
    numeric.topicConstraintCount === 0 && numeric.topicValidatedConstraintCount === 0 &&
    numeric.topicIndexCount === 0 && numeric.topicValidReadyIndexCount === 0 &&
    numeric.topicTriggerCount === 0 && numeric.researchDirectionGateCount === 0 &&
    counts.topicLabFormalRowCount === 0;

  return {
    classification: complete ? SCHEMA_STATES.COMPLETE : absent ? SCHEMA_STATES.PRE_0007 : SCHEMA_STATES.PARTIAL,
    errorCategory: complete || absent ? "NONE" : "SCHEMA_SIGNATURE_MISMATCH",
    resultFailureCategory: complete || absent ? "NONE" : "SCHEMA_SIGNATURE_INVALID",
    sqlstateClass: "NOT_AVAILABLE",
    observed0007TableCount: numeric.topicTableCount,
    observed0007Columns: columnCount,
    constraintsValidated: numeric.topicConstraintCount === 24 && numeric.topicValidatedConstraintCount === 24 ? "PASS" : "FAIL",
    indexesValidReady: numeric.topicIndexCount === 10 && numeric.topicValidReadyIndexCount === 10 ? "PASS" : "FAIL",
    publicTableCount: numeric.publicTableCount,
    counts,
  };
}

function privateDatabaseHost(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "::1" || lower.endsWith(".zeabur.internal")) return true;
  if (/^[a-z0-9][a-z0-9-]*$/i.test(lower)) return true;
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower)) return true;
  const match = /^172\.(\d{1,3})\./.exec(lower);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function sourceIdentity() {
  const filename = fileURLToPath(import.meta.url);
  const bytes = await readFile(filename);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const marker = Buffer.from(OPERATOR_NORMALIZED_SHA256, "utf8");
  const markerOffset = bytes.indexOf(marker);
  if (markerOffset < 0 || marker.length !== 64) return { pass: false, sourceSha256 };
  const normalized = Buffer.from(bytes);
  normalized.fill("0".charCodeAt(0), markerOffset, markerOffset + marker.length);
  const normalizedSha256 = createHash("sha256").update(normalized).digest("hex");
  return { pass: normalizedSha256 === OPERATOR_NORMALIZED_SHA256, sourceSha256 };
}

async function collectSnapshot(client, onSubstage) {
  onSubstage(SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED);
  const inventory = await client.query(`
    WITH base_tables(name) AS (VALUES ${BASE_0006_TABLES.map((name) => `('${name}')`).join(",")}),
    actual_public_tables AS (
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
    )
    SELECT
      (current_setting('server_version_num')::int / 10000)::text AS postgres_major,
      (current_database() IS NOT NULL AND current_database() <> '') AS database_identity_present,
      (current_setting('transaction_read_only') = 'on') AS read_only,
      ((SELECT count(*) FROM actual_public_tables) = (SELECT count(*) FROM base_tables) +
        (SELECT count(*) FROM actual_public_tables WHERE table_name IN ('research_topic_lab_runs','research_topic_lab_promotions'))
       AND NOT EXISTS (SELECT 1 FROM base_tables b LEFT JOIN actual_public_tables a ON a.table_name=b.name WHERE a.table_name IS NULL)) AS base_0006_signature,
      (SELECT count(*)::text FROM actual_public_tables) AS public_table_count,
      (SELECT count(*)::text FROM actual_public_tables WHERE table_name IN ('research_topic_lab_runs','research_topic_lab_promotions')) AS topic_table_count,
      (SELECT count(*)::text FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND c.contype <> 'n') AS topic_constraint_count,
      (SELECT count(*)::text FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND c.contype <> 'n' AND c.convalidated) AS topic_validated_constraint_count,
      (SELECT count(*)::text FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions')) AS topic_index_count,
      (SELECT count(*)::text FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND i.indisvalid AND i.indisready) AS topic_valid_ready_index_count,
      (SELECT count(*)::text FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE n.nspname='public' AND r.relname IN ('research_topic_lab_runs','research_topic_lab_promotions') AND NOT t.tgisinternal AND t.tgenabled <> 'D') AS topic_trigger_count,
      (SELECT count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
        WHERE n.nspname='public' AND c.conname='research_human_gates_gate_type_check' AND c.convalidated
          AND pg_get_constraintdef(c.oid) LIKE '%RESEARCH_DIRECTION%') AS research_direction_gate_count
  `);
  onSubstage(SAFE_STAGE_EVENTS.INVENTORY_QUERY_COMPLETED);
  assertQueryResult(inventory, 1);
  const row = inventory.rows[0];
  assertInventoryValueTypes(row);
  onSubstage(SAFE_STAGE_EVENTS.INVENTORY_SHAPE_VALIDATED);
  onSubstage(SAFE_STAGE_EVENTS.COLUMN_QUERY_STARTED);
  const columns = await client.query(`
    SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('research_topic_lab_runs','research_topic_lab_promotions')
    ORDER BY table_name, ordinal_position
  `);
  onSubstage(SAFE_STAGE_EVENTS.COLUMN_QUERY_COMPLETED);
  assertQueryResult(columns, null);
  assertColumnValueTypes(columns.rows);
  onSubstage(SAFE_STAGE_EVENTS.COLUMN_SHAPE_VALIDATED);
  onSubstage(SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_STARTED);
  const staticCounts = await client.query(`
    SELECT
      (SELECT count(*)::text FROM projects) AS project_count,
      (SELECT count(*)::text FROM project_artifacts) AS project_artifact_count,
      ((SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_datasets)+
       (SELECT count(*) FROM research_analysis_plans)+(SELECT count(*) FROM research_analysis_runs)+
       (SELECT count(*) FROM research_evidence_sources)+(SELECT count(*) FROM research_claims)+
       (SELECT count(*) FROM research_claim_evidence)+(SELECT count(*) FROM research_documents)+
       (SELECT count(*) FROM research_human_gates)+(SELECT count(*) FROM research_workflow_events))::text AS phase2_formal_row_count,
      (SELECT count(*)::text FROM portal_administrator) AS administrator_count,
      (SELECT count(*)::text FROM "user") AS user_count,
      (SELECT count(*)::text FROM account) AS account_count,
      (SELECT count(*)::text FROM workspaces) AS workspace_count,
      (SELECT count(*)::text FROM workspace_members) AS membership_count,
      (SELECT count(*)::text FROM "session") AS current_session_count,
      (SELECT count(*)::text FROM registration_invites) AS invite_total_count,
      (SELECT count(*)::text FROM registration_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) AS active_unused_invite_count
  `);
  onSubstage(SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_COMPLETED);
  assertQueryResult(staticCounts, 1);
  assertStaticCountValueTypes(staticCounts.rows[0]);
  onSubstage(SAFE_STAGE_EVENTS.STATIC_COUNT_SHAPE_VALIDATED);
  let topicLabFormalRowCount = "0";
  const topicTableCount = integer(row.topic_table_count);
  if (topicTableCount === null) throw evidenceFailure("VALUE_TYPE_INVALID");
  if (topicTableCount === 2) {
    onSubstage(SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED);
    const topic = await client.query(`SELECT
      ((SELECT count(*) FROM research_topic_lab_runs)+(SELECT count(*) FROM research_topic_lab_promotions))::text AS topic_lab_formal_row_count`);
    onSubstage(SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED);
    assertQueryResult(topic, 1);
    topicLabFormalRowCount = topic.rows[0].topic_lab_formal_row_count;
    if (integer(topicLabFormalRowCount) === null) throw evidenceFailure("VALUE_TYPE_INVALID");
    onSubstage(SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED);
  } else {
    onSubstage(SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED);
  }
  const counts = staticCounts.rows[0];
  return {
    postgresMajor: row.postgres_major,
    databaseIdentityPresent: row.database_identity_present,
    readOnly: row.read_only,
    base0006Signature: row.base_0006_signature,
    publicTableCount: row.public_table_count,
    topicTableCount: row.topic_table_count,
    topicColumns: columns.rows,
    topicConstraintCount: row.topic_constraint_count,
    topicValidatedConstraintCount: row.topic_validated_constraint_count,
    topicIndexCount: row.topic_index_count,
    topicValidReadyIndexCount: row.topic_valid_ready_index_count,
    topicTriggerCount: row.topic_trigger_count,
    researchDirectionGateCount: row.research_direction_gate_count,
    counts: {
      projectCount: counts.project_count,
      projectArtifactCount: counts.project_artifact_count,
      phase2FormalRowCount: counts.phase2_formal_row_count,
      administratorCount: counts.administrator_count,
      userCount: counts.user_count,
      accountCount: counts.account_count,
      workspaceCount: counts.workspace_count,
      membershipCount: counts.membership_count,
      currentSessionCount: counts.current_session_count,
      inviteTotalCount: counts.invite_total_count,
      activeUnusedInviteCount: counts.active_unused_invite_count,
      topicLabFormalRowCount,
    },
  };
}

function fixedResult(identity, classified, snapshot, safeStageBitmap, errorEvidenceBitmap) {
  return {
    contractVersion: OPERATOR_CONTRACT_VERSION,
    releaseIdentity: EMBEDDED_RELEASE_IDENTITY,
    operatorSourceSha256: identity.sourceSha256,
    operatorIdentity: identity.pass ? "PASS" : "FAIL",
    classification: identity.pass ? classified.classification : SCHEMA_STATES.PARTIAL,
    errorCategory: identity.pass ? classified.errorCategory : "OPERATOR_IDENTITY_MISMATCH",
    resultFailureCategory: identity.pass ? classified.resultFailureCategory : "NONE",
    sqlstateClass: identity.pass ? classified.sqlstateClass : "NOT_AVAILABLE",
    readOnlyTransaction: snapshot.readOnly ? "PASS" : "FAIL",
    base0006Signature: snapshot.base0006Signature ? "PASS" : "FAIL",
    expected0007TableCount: 2,
    observed0007TableCount: classified.observed0007TableCount ?? "NOT_AVAILABLE",
    expected0007Columns: 28,
    observed0007Columns: classified.observed0007Columns ?? "NOT_AVAILABLE",
    constraintsValidated: classified.constraintsValidated ?? "FAIL",
    indexesValidReady: classified.indexesValidReady ?? "FAIL",
    publicTableCount: classified.publicTableCount ?? "NOT_AVAILABLE",
    counts: classified.counts ?? Object.fromEntries(COUNT_KEYS.map((key) => [key, "NOT_AVAILABLE"])),
    safeStageBitmap,
    errorEvidenceBitmap,
    activeDeploymentPointerProven: false,
  };
}

export async function runSchemaEvidenceOperator({ Client, databaseUrl, sourceIdentityProvider = sourceIdentity } = {}) {
  const identity = await sourceIdentityProvider().catch(() => ({ pass: false, sourceSha256: "NOT_AVAILABLE" }));
  let safeStageBitmap = createInitialSafeStageBitmap();
  let errorEvidenceBitmap = createInitialErrorEvidenceBitmap();
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.DATABASE_URL_MISSING);
    return fixedUnavailable("DATABASE_ENV_INVALID", identity, safeStageBitmap, { errorEvidenceBitmap });
  }
  safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT);
  let parsed;
  try {
    parsed = new URL(databaseUrl);
    safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.URL_PARSED);
  } catch {
    safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.URL_PARSE_FAILED);
    return fixedUnavailable("DATABASE_ENV_INVALID", identity, safeStageBitmap, { errorEvidenceBitmap });
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !privateDatabaseHost(parsed.hostname)) {
    safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_FAILED);
    return fixedUnavailable("DATABASE_PRIVATE_HOST_POLICY_FAIL", identity, safeStageBitmap, { errorEvidenceBitmap });
  }
  safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_PASSED);
  let client;
  let transactionStarted = false;
  let timer;
  let pendingResult;
  let errorCaptured = false;
  try {
    try {
      client = new Client({
        connectionString: databaseUrl,
        application_name: "old_mike_schema_evidence_operator_v1527",
        connectionTimeoutMillis: BUDGET.connectMs,
        options: `-c statement_timeout=${BUDGET.statementMs} -c lock_timeout=${BUDGET.lockMs} -c idle_in_transaction_session_timeout=${BUDGET.idleTransactionMs}`,
      });
      errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "CREATED");
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.PG_CLIENT_CREATED);
    } catch (error) {
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.PG_CLIENT_CREATE_FAILED);
      errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "ERROR");
      throw error;
    }
    const operation = (async () => {
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.CONNECT_STARTED);
      errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "CONNECTING");
      try {
        await client.connect();
      } catch (error) {
        errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "ERROR");
        throw error;
      }
      errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "CONNECTED");
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.CONNECT_COMPLETED);
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.BEGIN_READ_ONLY_STARTED);
      await client.query("BEGIN READ ONLY");
      transactionStarted = true;
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.TRANSACTION_STARTED);
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.SNAPSHOT_BEGIN);
      errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "CREATED");
      errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "DISPATCHED");
      let snapshot;
      try {
        snapshot = await collectSnapshot(client, (event) => {
          safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, event);
        });
        if (errorEvidenceBitmap.QUERY_PROMISE_PHASE === "DISPATCHED") {
          errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "FULFILLED");
        }
      } catch (error) {
        if (errorEvidenceBitmap.QUERY_PROMISE_PHASE === "DISPATCHED") {
          errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "REJECTED");
        }
        throw error;
      }
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.SNAPSHOT_COMPLETE);
      const classified = classifySchemaSnapshot(snapshot);
      return { classified, snapshot };
    })();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("TIMEOUT"), { code: "OPERATOR_TIMEOUT" })), BUDGET.overallMs);
    });
    const completed = await Promise.race([operation, timeout]);
    pendingResult = fixedResult(identity, completed.classified, completed.snapshot, safeStageBitmap, errorEvidenceBitmap);
  } catch (error) {
    if (safeStageBitmap.CONNECT_STARTED === "YES" &&
        safeStageBitmap.CONNECT_COMPLETED === "NOT_STARTED" &&
        safeStageBitmap.QUERY_STARTED === "NOT_STARTED") {
      safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.CONNECT_FAILED);
    }
    const resultFailureCategory = RESULT_FAILURE_CATEGORIES.includes(error?.resultFailureCategory)
      ? error.resultFailureCategory : null;
    if (errorEvidenceBitmap.QUERY_PROMISE_PHASE === "DISPATCHED") {
      errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "REJECTED");
    }
    const code = typeof error?.code === "string" ? error.code.toUpperCase() : error?.code;
    const sqlstateClass = code === "OPERATOR_TIMEOUT" ? "NOT_AVAILABLE" : classifySqlstateClass(code);
    const timedOut = code === "OPERATOR_TIMEOUT" || sqlstateClass === "QUERY_CANCELED_OR_TIMEOUT";
    errorEvidenceBitmap = classifyErrorEvidence(error, errorEvidenceBitmap, {
      sqlstateClass,
      resultValidation: ["ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID", "CARDINALITY_INVALID"].includes(resultFailureCategory),
      timeoutWrapper: code === "OPERATOR_TIMEOUT",
      pgClientState: !client || errorEvidenceBitmap.CLIENT_CONNECTION_STATE === "ERROR",
    });
    if (errorEvidenceBitmap.QUERY_PROMISE_PHASE === "REJECTED") {
      errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "CATCH_CLASSIFIED");
    }
    errorCaptured = true;
    if (["ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID", "CARDINALITY_INVALID"].includes(resultFailureCategory)) {
      pendingResult = fixedUnavailable("RESULT_SHAPE_INVALID", identity, safeStageBitmap, {
        resultFailureCategory,
        sqlstateClass: "NOT_AVAILABLE",
        errorEvidenceBitmap,
      });
      pendingResult.classification = SCHEMA_STATES.PARTIAL;
      pendingResult.readOnlyTransaction = transactionStarted ? "PASS" : "FAIL";
    } else {
      pendingResult = fixedUnavailable(
        timedOut ? "DATABASE_TIMEOUT" : "DATABASE_QUERY_UNAVAILABLE",
        identity,
        safeStageBitmap,
        {
          resultFailureCategory: safeStageBitmap.QUERY_STARTED === "SNAPSHOT"
            ? "QUERY_EXECUTION_FAILED" : "NOT_AVAILABLE",
          sqlstateClass,
          errorEvidenceBitmap,
        },
      );
      pendingResult.readOnlyTransaction = transactionStarted ? "PASS" : "FAIL";
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (client) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
          safeStageBitmap = advanceSafeStageBitmap(safeStageBitmap, SAFE_STAGE_EVENTS.TRANSACTION_END);
        } catch (error) {
          const code = typeof error?.code === "string" ? error.code.toUpperCase() : error?.code;
          const sqlstateClass = classifySqlstateClass(code);
          errorEvidenceBitmap = classifyErrorEvidence(error, errorEvidenceBitmap, {
            sqlstateClass,
            timeoutWrapper: code === "OPERATOR_TIMEOUT",
            pgClientState: errorEvidenceBitmap.CLIENT_CONNECTION_STATE === "ERROR",
          });
          errorCaptured = true;
          pendingResult = fixedUnavailable(
            sqlstateClass === "QUERY_CANCELED_OR_TIMEOUT" ? "DATABASE_TIMEOUT" : "DATABASE_QUERY_UNAVAILABLE",
            identity,
            safeStageBitmap,
            { resultFailureCategory: "QUERY_EXECUTION_FAILED", sqlstateClass, errorEvidenceBitmap },
          );
          pendingResult.readOnlyTransaction = "PASS";
        }
      }
      try {
        if (!errorCaptured && errorEvidenceBitmap.CLIENT_CONNECTION_STATE === "CONNECTED") {
          errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "ENDING");
        }
        await client.end();
        if (!errorCaptured && errorEvidenceBitmap.CLIENT_CONNECTION_STATE === "ENDING") {
          errorEvidenceBitmap = advanceClientConnectionState(errorEvidenceBitmap, "ENDED");
        }
      } catch (error) {
        if (!errorCaptured) {
          errorEvidenceBitmap = classifyErrorEvidence(error, errorEvidenceBitmap, { pgClientState: true });
          errorCaptured = true;
          pendingResult = fixedUnavailable("DATABASE_QUERY_UNAVAILABLE", identity, safeStageBitmap, {
            resultFailureCategory: "QUERY_EXECUTION_FAILED",
            sqlstateClass: "NOT_AVAILABLE",
            errorEvidenceBitmap,
          });
          pendingResult.readOnlyTransaction = transactionStarted ? "PASS" : "FAIL";
        }
      }
    }
    if (["FULFILLED", "CATCH_CLASSIFIED"].includes(errorEvidenceBitmap.QUERY_PROMISE_PHASE)) {
      errorEvidenceBitmap = advanceQueryPromisePhase(errorEvidenceBitmap, "FINALLY_COMPLETED");
    }
    if (pendingResult) {
      pendingResult.safeStageBitmap = safeStageBitmap;
      pendingResult.errorEvidenceBitmap = errorEvidenceBitmap;
    }
  }
  return pendingResult;
}

function output(result) {
  process.stdout.write(`OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify(result)}\n`);
}

async function main() {
  if (process.argv.length !== 2) {
    output(fixedUnavailable("ARGUMENTS_FORBIDDEN"));
    process.exitCode = 64;
    return;
  }
  let Client;
  try { ({ Client } = await import("pg")); } catch {
    output(fixedUnavailable("RUNTIME_DEPENDENCY_UNAVAILABLE"));
    process.exitCode = 69;
    return;
  }
  const result = await runSchemaEvidenceOperator({ Client, databaseUrl: process.env.DATABASE_URL });
  output(result);
  process.exitCode = result.classification === SCHEMA_STATES.PRE_0007 || result.classification === SCHEMA_STATES.COMPLETE
    ? 0
    : result.classification === SCHEMA_STATES.PARTIAL ? 2 : 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main().catch(() => {
    output(fixedUnavailable("OPERATOR_RUNTIME_FAILURE"));
    process.exitCode = 70;
  });
}
