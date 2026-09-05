import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bindPublicHealthEvidence,
  classifyCommandTransport,
  createFixedCommandRequest,
  executeFixedCommandProvider,
  EXPECTED_RELEASE_IDENTITY,
  parseOperatorOutput,
  verifyFixedCommandRequest,
} from "./schema-evidence-bridge-contract.mjs";
import {
  classifySchemaSnapshot,
  classifySqlstateClass,
  EXPECTED_TOPIC_COLUMNS,
  OPERATOR_CONTRACT_VERSION,
  RESULT_FAILURE_CATEGORIES,
  runSchemaEvidenceOperator,
  SCHEMA_STATES,
  SQLSTATE_CLASSES,
} from "./verify-online-schema-state.mjs";
import {
  ERROR_EVIDENCE_BITMAP_KEYS,
  SAFE_STAGE_BITMAP_KEYS,
  SAFE_STAGE_EVENTS,
  advanceClientConnectionState,
  advanceQueryPromisePhase,
  advanceSafeStageBitmap,
  createInitialErrorEvidenceBitmap,
  createInitialSafeStageBitmap,
} from "./schema-evidence-safe-stage-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const operatorSource = await readFile(path.join(root, "scripts", "verify-online-schema-state.mjs"), "utf8");
assert.equal(verifyFixedCommandRequest(createFixedCommandRequest()), true);
const fixedCommand = createFixedCommandRequest();
assert.deepEqual(fixedCommand.command, ["node", ".next/standalone/operator/verify-online-schema-state.mjs"]);
assert.equal(fixedCommand.command.some((part) => ["bash", "sh", "powershell", "cmd", "-c", "-lc", "eval"].includes(part)), false);
assert.equal(fixedCommand.command.some((part) => /[|><`]/.test(part)), false);
let capturedRequest;
const providerResult = await executeFixedCommandProvider({
  executeCommand: async (request) => { capturedRequest = request; return { accepted: true }; },
});
assert.deepEqual(providerResult, { accepted: true });
assert.equal(verifyFixedCommandRequest(capturedRequest), true);
await assert.rejects(() => executeFixedCommandProvider({ executeCommand: async () => undefined, websocket: true }), /PROVIDER_INVALID/);

const transportFixtures = [
  [{ submissionError: true }, "SUBMISSION_ERROR"],
  [{ timeoutLayer: "CLIENT" }, "CLIENT_TIMEOUT"],
  [{ timeoutLayer: "CONTROL_PLANE" }, "CONTROL_PLANE_TIMEOUT"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: true }, "GRAPHQL_ERROR"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: false, result: null }, "NULL_RESULT"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: false }, "MISSING_RESULT"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: true, remoteExecutionStarted: true, outputCollectionFailure: true }, "OUTPUT_COLLECTION_FAILURE"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: true, remoteExecutionStarted: true, outputTruncated: true }, "OUTPUT_TRUNCATED"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: true, remoteExecutionStarted: true, outputEncoding: "INVALID" }, "OUTPUT_ENCODING_FAILURE"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: true, remoteExecutionStarted: true, remoteExitCode: 7, output: "SAFE" }, "REMOTE_NONZERO_EXIT"],
  [{ submissionAcknowledged: true, controlPlaneAccepted: true, graphqlErrorsPresent: false, resultPresent: true, remoteExecutionStarted: true, remoteExitCode: 0, output: "" }, "SUCCESS"],
  [{}, "RESULT_SHAPE_INVALID"],
];
for (const [fixture, expected] of transportFixtures) assert.equal(classifyCommandTransport(fixture).category, expected);

function counts(topicLabFormalRowCount = 0) {
  return {
    projectCount: 0, projectArtifactCount: 0, phase2FormalRowCount: 0,
    administratorCount: 1, userCount: 1, accountCount: 1, workspaceCount: 1,
    membershipCount: 1, currentSessionCount: 0, inviteTotalCount: 1,
    activeUnusedInviteCount: 0, topicLabFormalRowCount,
  };
}
function snapshot(overrides = {}) {
  return {
    postgresMajor: 18, databaseIdentityPresent: true, readOnly: true,
    base0006Signature: true, publicTableCount: 28, topicTableCount: 2,
    topicColumns: EXPECTED_TOPIC_COLUMNS.map(([table_name, column_name, udt_name, is_nullable, defaultKind]) => ({
      table_name, column_name, udt_name, is_nullable,
      column_default: defaultKind === "NOW" ? "now()" : null,
    })),
    topicConstraintCount: 24, topicValidatedConstraintCount: 24,
    topicIndexCount: 10, topicValidReadyIndexCount: 10, topicTriggerCount: 2,
    researchDirectionGateCount: 1, counts: counts(), ...overrides,
  };
}
assert.equal(classifySchemaSnapshot(snapshot()).classification, SCHEMA_STATES.COMPLETE);
assert.equal(classifySchemaSnapshot(snapshot({ publicTableCount: 26, topicTableCount: 0, topicColumns: [], topicConstraintCount: 0, topicValidatedConstraintCount: 0, topicIndexCount: 0, topicValidReadyIndexCount: 0, topicTriggerCount: 0, researchDirectionGateCount: 0 })).classification, SCHEMA_STATES.PRE_0007);
for (const broken of [
  { topicTableCount: 1 }, { topicColumns: [] }, { topicConstraintCount: 23 },
  { topicValidatedConstraintCount: 23 }, { topicIndexCount: 9 },
  { topicValidReadyIndexCount: 9 }, { topicTriggerCount: 1 },
  { researchDirectionGateCount: 0 }, { counts: counts(1) },
  { publicTableCount: 29 }, { base0006Signature: false }, { postgresMajor: 17 },
]) assert.equal(classifySchemaSnapshot(snapshot(broken)).classification, SCHEMA_STATES.PARTIAL);
assert.equal(classifySchemaSnapshot(null).resultFailureCategory, "ROW_SHAPE_INVALID");
assert.equal(classifySchemaSnapshot(snapshot({ publicTableCount: "invalid" })).resultFailureCategory, "VALUE_TYPE_INVALID");
assert.equal(classifySchemaSnapshot(snapshot({ topicTableCount: 1 })).resultFailureCategory, "SCHEMA_SIGNATURE_INVALID");

const sqlstateFixtures = Object.freeze([
  [undefined, "NOT_AVAILABLE"], ["", "NOT_AVAILABLE"], ["08006", "CONNECTION"],
  ["28P01", "AUTHENTICATION_OR_AUTHORIZATION"], ["25006", "TRANSACTION_STATE"],
  ["42501", "SYNTAX_OR_ACCESS_RULE"], ["53300", "RESOURCE_LIMIT"],
  ["57014", "QUERY_CANCELED_OR_TIMEOUT"], ["22003", "DATA_OR_CARDINALITY"],
  ["XX000", "INTERNAL_OR_SYSTEM"], ["99999", "UNKNOWN_FAIL_CLOSED"],
  [["42501", "57014"], "UNKNOWN_FAIL_CLOSED"],
]);
for (const [code, expected] of sqlstateFixtures) assert.equal(classifySqlstateClass(code), expected);
assert.deepEqual(RESULT_FAILURE_CATEGORIES, [
  "NONE", "QUERY_EXECUTION_FAILED", "ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID",
  "CARDINALITY_INVALID", "SCHEMA_SIGNATURE_INVALID", "NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED",
]);
assert.deepEqual(SQLSTATE_CLASSES, [
  "CONNECTION", "AUTHENTICATION_OR_AUTHORIZATION", "TRANSACTION_STATE",
  "SYNTAX_OR_ACCESS_RULE", "RESOURCE_LIMIT", "QUERY_CANCELED_OR_TIMEOUT",
  "DATA_OR_CARDINALITY", "INTERNAL_OR_SYSTEM", "NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED",
]);

const databaseRow = Object.freeze({
  postgres_major: "18", database_identity_present: true, read_only: true,
  base_0006_signature: true, public_table_count: "28", topic_table_count: "2",
  topic_constraint_count: "24", topic_validated_constraint_count: "24",
  topic_index_count: "10", topic_valid_ready_index_count: "10", topic_trigger_count: "2",
  research_direction_gate_count: "1",
});
const databaseColumns = Object.freeze(snapshot().topicColumns.map((row) => Object.freeze({ ...row })));
const databaseCounts = Object.freeze({
  project_count: "0", project_artifact_count: "0", phase2_formal_row_count: "0",
  administrator_count: "1", user_count: "1", account_count: "1", workspace_count: "1",
  membership_count: "1", current_session_count: "0", invite_total_count: "1",
  active_unused_invite_count: "0",
});

function fakeClientFor({ failAt = 0, code = "42501", invalidAt = 0, invalidKind = "ROW" } = {}) {
  return class FakeClient {
    constructor() { this.queryCount = 0; }
    async connect() {}
    async end() {}
    async query() {
      this.queryCount += 1;
      if (this.queryCount === failAt) throw Object.assign(new Error("SANITIZED"), { code });
      if (this.queryCount === invalidAt) {
        if (invalidKind === "ROW") return { rows: null };
        if (invalidKind === "CARDINALITY") return { rows: [] };
        if (invalidKind === "COLUMN_VALUE") return { rows: [{ ...databaseColumns[0], table_name: 1 }] };
        if (invalidKind === "TOPIC_VALUE") return { rows: [{ topic_lab_formal_row_count: "invalid" }] };
      }
      if (this.queryCount === 1) return { rows: [] };
      if (this.queryCount === 2) return { rows: [databaseRow] };
      if (this.queryCount === 3) return { rows: databaseColumns };
      if (this.queryCount === 4) return { rows: [databaseCounts] };
      if (this.queryCount === 5) return { rows: [{ topic_lab_formal_row_count: "0" }] };
      return { rows: [] };
    }
  };
}

const fakeDatabaseUrl = ["postgresql:", "//", "fixture", "@", "127.0.0.1", ":1/fixture"].join("");
const identityProvider = async () => ({ pass: true, sourceSha256: "a".repeat(64) });
const queryPositionFixtures = Object.freeze([
  ["inventory", 2, "INVENTORY_QUERY_STARTED", "INVENTORY_QUERY_COMPLETED"],
  ["column", 3, "COLUMN_QUERY_STARTED", "COLUMN_QUERY_COMPLETED"],
  ["static-count", 4, "STATIC_COUNT_QUERY_STARTED", "STATIC_COUNT_QUERY_COMPLETED"],
  ["topic-count", 5, "CONDITIONAL_TOPIC_COUNT_QUERY_STARTED", "CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED"],
]);
for (const [name, failAt, startedKey, completedKey] of queryPositionFixtures) {
  const result = await runSchemaEvidenceOperator({
    Client: fakeClientFor({ failAt }), databaseUrl: fakeDatabaseUrl, sourceIdentityProvider: identityProvider,
  });
  assert.equal(result.classification, "DATABASE_UNAVAILABLE", name);
  assert.equal(result.errorCategory, "DATABASE_QUERY_UNAVAILABLE", name);
  assert.equal(result.resultFailureCategory, "QUERY_EXECUTION_FAILED", name);
  assert.equal(result.sqlstateClass, "SYNTAX_OR_ACCESS_RULE", name);
  assert.equal(result.safeStageBitmap[startedKey], "YES", name);
  assert.equal(result.safeStageBitmap[completedKey], "NO", name);
  assert.equal(result.safeStageBitmap.TRANSACTION_END, "YES", name);
}

const shapePositionFixtures = Object.freeze([
  ["inventory-row", 2, "ROW", "ROW_SHAPE_INVALID", "INVENTORY_SHAPE_VALIDATED"],
  ["column-value", 3, "COLUMN_VALUE", "VALUE_TYPE_INVALID", "COLUMN_SHAPE_VALIDATED"],
  ["static-cardinality", 4, "CARDINALITY", "CARDINALITY_INVALID", "STATIC_COUNT_SHAPE_VALIDATED"],
  ["topic-value", 5, "TOPIC_VALUE", "VALUE_TYPE_INVALID", "CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED"],
]);
for (const [name, invalidAt, invalidKind, expectedFailure, validatedKey] of shapePositionFixtures) {
  const result = await runSchemaEvidenceOperator({
    Client: fakeClientFor({ invalidAt, invalidKind }), databaseUrl: fakeDatabaseUrl,
    sourceIdentityProvider: identityProvider,
  });
  assert.equal(result.classification, "SCHEMA_PARTIAL_OR_INVALID", name);
  assert.equal(result.errorCategory, "RESULT_SHAPE_INVALID", name);
  assert.equal(result.resultFailureCategory, expectedFailure, name);
  assert.equal(result.sqlstateClass, "NOT_AVAILABLE", name);
  assert.equal(result.safeStageBitmap[validatedKey], "NO", name);
  assert.equal(result.safeStageBitmap.TRANSACTION_END, "YES", name);
}

const canceled = await runSchemaEvidenceOperator({
  Client: fakeClientFor({ failAt: 2, code: "57014" }), databaseUrl: fakeDatabaseUrl,
  sourceIdentityProvider: identityProvider,
});
assert.equal(canceled.errorCategory, "DATABASE_TIMEOUT");
assert.equal(canceled.sqlstateClass, "QUERY_CANCELED_OR_TIMEOUT");
assert.equal(canceled.resultFailureCategory, "QUERY_EXECUTION_FAILED");

const operatorEvidence = {
  activeDeploymentPointerProven: false,
  base0006Signature: "PASS",
  classification: "SCHEMA_0007_COMPLETE",
  constraintsValidated: "PASS",
  contractVersion: OPERATOR_CONTRACT_VERSION,
  counts: counts(),
  errorCategory: "NONE",
  errorEvidenceBitmap: [
    ["client", "CREATED"],
    ["client", "CONNECTING"],
    ["client", "CONNECTED"],
    ["query", "CREATED"],
    ["query", "DISPATCHED"],
    ["query", "FULFILLED"],
    ["query", "FINALLY_COMPLETED"],
    ["client", "ENDING"],
    ["client", "ENDED"],
  ].reduce((bitmap, [kind, state]) => kind === "client"
    ? advanceClientConnectionState(bitmap, state)
    : advanceQueryPromisePhase(bitmap, state), createInitialErrorEvidenceBitmap()),
  resultFailureCategory: "NONE",
  sqlstateClass: "NOT_AVAILABLE",
  expected0007Columns: 28,
  expected0007TableCount: 2,
  indexesValidReady: "PASS",
  observed0007Columns: 28,
  observed0007TableCount: 2,
  operatorIdentity: "PASS",
  operatorSourceSha256: "a".repeat(64),
  publicTableCount: 28,
  readOnlyTransaction: "PASS",
  releaseIdentity: EXPECTED_RELEASE_IDENTITY,
  safeStageBitmap: [
    SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT,
    SAFE_STAGE_EVENTS.URL_PARSED,
    SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_PASSED,
    SAFE_STAGE_EVENTS.PG_CLIENT_CREATED,
    SAFE_STAGE_EVENTS.CONNECT_STARTED,
    SAFE_STAGE_EVENTS.CONNECT_COMPLETED,
    SAFE_STAGE_EVENTS.BEGIN_READ_ONLY_STARTED,
    SAFE_STAGE_EVENTS.TRANSACTION_STARTED,
    SAFE_STAGE_EVENTS.SNAPSHOT_BEGIN,
    SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED,
    SAFE_STAGE_EVENTS.INVENTORY_QUERY_COMPLETED,
    SAFE_STAGE_EVENTS.INVENTORY_SHAPE_VALIDATED,
    SAFE_STAGE_EVENTS.COLUMN_QUERY_STARTED,
    SAFE_STAGE_EVENTS.COLUMN_QUERY_COMPLETED,
    SAFE_STAGE_EVENTS.COLUMN_SHAPE_VALIDATED,
    SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_STARTED,
    SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_COMPLETED,
    SAFE_STAGE_EVENTS.STATIC_COUNT_SHAPE_VALIDATED,
    SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED,
    SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED,
    SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED,
    SAFE_STAGE_EVENTS.SNAPSHOT_COMPLETE,
    SAFE_STAGE_EVENTS.TRANSACTION_END,
  ].reduce((bitmap, event) => advanceSafeStageBitmap(bitmap, event), createInitialSafeStageBitmap()),
};
const parsed = parseOperatorOutput(`OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify(operatorEvidence)}\n`);
assert.deepEqual(parsed, operatorEvidence);
assert.deepEqual(Object.keys(parsed.safeStageBitmap), SAFE_STAGE_BITMAP_KEYS);
assert.deepEqual(Object.keys(parsed.errorEvidenceBitmap), ERROR_EVIDENCE_BITMAP_KEYS);
const collapsed = { ...operatorEvidence };
delete collapsed.safeStageBitmap;
assert.throws(() => parseOperatorOutput(`OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify(collapsed)}\n`), /CONTRACT/);
assert.throws(() => parseOperatorOutput(`OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify({ ...operatorEvidence, token: "forbidden" })}\n`), /CONTRACT/);
assert.throws(() => parseOperatorOutput(`OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify(operatorEvidence)}\nRAW\n`), /SHAPE/);
const binding = bindPublicHealthEvidence({
  health: { httpStatus: 200, status: "ok", version: "1.5.27", mode: "connected", releaseIdentity: EXPECTED_RELEASE_IDENTITY },
  operatorEvidence,
  expectedOperatorSourceSha256: "a".repeat(64),
});
assert.equal(binding.publicHealthBinding, "PASS");
assert.equal(binding.activeDeploymentPointerClaim, "NOT_CLAIMED");
assert.equal(bindPublicHealthEvidence({ health: { httpStatus: 200 }, operatorEvidence, expectedOperatorSourceSha256: "a".repeat(64) }).publicHealthBinding, "FAIL");

for (const forbidden of ["process.argv[2]", "process.stdin", "console.log(error", "console.error(error", "shell: true"]) {
  assert.equal(operatorSource.includes(forbidden), false);
}
assert.match(operatorSource, /BEGIN READ ONLY/);
assert.match(operatorSource, /ROLLBACK/);
assert.match(operatorSource, /activeDeploymentPointerProven: false/);
assert.equal(operatorSource.includes("OLD_MIKE_SCHEMA_EVIDENCE="), true);

console.log("COMMAND_ARRAY_PROVIDER_CONTRACT=PASS");
console.log("DISCRIMINATOR_CONTRACT=PASS");
console.log("SQLSTATE_CLASS_CONTRACT=PASS");
console.log("RESULT_SHAPE_MAPPING_CONTRACT=PASS");
console.log("PUBLIC_HEALTH_BINDING_CONTRACT=PASS");
console.log("READONLY_TRANSACTION_CONTRACT=PASS");
console.log("PARTIAL_FAIL_CLOSED_FIXTURES=PASS");
console.log("SAFE_STAGE_BITMAP_CONSUMER_CONTRACT=PASS");
console.log("OLD_COLLAPSED_BEHAVIOR_NEGATIVE_FIXTURE=PASS");
console.log("SCHEMA_EVIDENCE_BRIDGE_CONTRACT=PASS");
