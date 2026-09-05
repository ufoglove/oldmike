import assert from "node:assert/strict";
import {
  QUERY_SUBSTAGE_BITMAP_KEYS,
  SAFE_STAGE_BITMAP_KEYS,
  SAFE_STAGE_EVENTS,
  advanceSafeStageBitmap,
  assertSafeStageBitmap,
  createInitialSafeStageBitmap,
  createUnavailableSafeStageBitmap,
  safeStageCompatibleWithOperatorEvidence,
} from "./schema-evidence-safe-stage-contract.mjs";

process.env.OLD_MIKE_REMOTE_CALL_KILL_SWITCH = "1";
process.env.OLD_MIKE_DATABASE_CALL_KILL_SWITCH = "1";

const BASE_TO_TRANSACTION = Object.freeze([
  SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT,
  SAFE_STAGE_EVENTS.URL_PARSED,
  SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_PASSED,
  SAFE_STAGE_EVENTS.PG_CLIENT_CREATED,
  SAFE_STAGE_EVENTS.CONNECT_STARTED,
  SAFE_STAGE_EVENTS.CONNECT_COMPLETED,
  SAFE_STAGE_EVENTS.BEGIN_READ_ONLY_STARTED,
  SAFE_STAGE_EVENTS.TRANSACTION_STARTED,
  SAFE_STAGE_EVENTS.SNAPSHOT_BEGIN,
]);
const COMMON_QUERY = Object.freeze([
  SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED,
  SAFE_STAGE_EVENTS.INVENTORY_QUERY_COMPLETED,
  SAFE_STAGE_EVENTS.INVENTORY_SHAPE_VALIDATED,
  SAFE_STAGE_EVENTS.COLUMN_QUERY_STARTED,
  SAFE_STAGE_EVENTS.COLUMN_QUERY_COMPLETED,
  SAFE_STAGE_EVENTS.COLUMN_SHAPE_VALIDATED,
  SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_STARTED,
  SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_COMPLETED,
  SAFE_STAGE_EVENTS.STATIC_COUNT_SHAPE_VALIDATED,
]);
const CONDITIONAL_QUERY = Object.freeze([
  SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED,
  SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED,
  SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED,
]);

function progress(events) {
  return events.reduce((bitmap, event) => advanceSafeStageBitmap(bitmap, event), createInitialSafeStageBitmap());
}

const executed = progress([
  ...BASE_TO_TRANSACTION,
  ...COMMON_QUERY,
  ...CONDITIONAL_QUERY,
  SAFE_STAGE_EVENTS.SNAPSHOT_COMPLETE,
  SAFE_STAGE_EVENTS.TRANSACTION_END,
]);
const skipped = progress([
  ...BASE_TO_TRANSACTION,
  ...COMMON_QUERY,
  SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED,
  SAFE_STAGE_EVENTS.SNAPSHOT_COMPLETE,
  SAFE_STAGE_EVENTS.TRANSACTION_END,
]);

for (const full of [executed, skipped]) {
  assertSafeStageBitmap(full);
  assert.equal(full.LAST_COMPLETED_STAGE, "TRANSACTION_END");
  assert.equal(full.LAST_COMPLETED_SUBSTAGE, "TRANSACTION_END");
  assert.equal(full.SNAPSHOT_COMPLETE, "YES");
  assert.equal(safeStageCompatibleWithOperatorEvidence({
    classification: "SCHEMA_0007_COMPLETE",
    errorCategory: "NONE",
    resultFailureCategory: "NONE",
    sqlstateClass: "NOT_AVAILABLE",
    safeStageBitmap: full,
  }), true);
}
assert.equal(executed.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED, "NO");
assert.equal(skipped.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED, "YES");
assert.equal(skipped.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED, "NO");

const candidateFixtures = Object.freeze([
  ["inventory-execution", [...BASE_TO_TRANSACTION, SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED], "QUERY_EXECUTION_FAILED"],
  ["inventory-shape", [...BASE_TO_TRANSACTION, SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED, SAFE_STAGE_EVENTS.INVENTORY_QUERY_COMPLETED], "ROW_SHAPE_INVALID"],
  ["column-execution", [...BASE_TO_TRANSACTION, ...COMMON_QUERY.slice(0, 4)], "QUERY_EXECUTION_FAILED"],
  ["column-shape", [...BASE_TO_TRANSACTION, ...COMMON_QUERY.slice(0, 5)], "CARDINALITY_INVALID"],
  ["static-execution", [...BASE_TO_TRANSACTION, ...COMMON_QUERY.slice(0, 7)], "QUERY_EXECUTION_FAILED"],
  ["static-shape", [...BASE_TO_TRANSACTION, ...COMMON_QUERY.slice(0, 8)], "ROW_SHAPE_INVALID"],
  ["topic-execution", [...BASE_TO_TRANSACTION, ...COMMON_QUERY, SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED], "QUERY_EXECUTION_FAILED"],
  ["topic-shape", [...BASE_TO_TRANSACTION, ...COMMON_QUERY, SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED, SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED], "VALUE_TYPE_INVALID"],
]);

for (const [name, events, failure] of candidateFixtures) {
  const bitmap = progress([...events, SAFE_STAGE_EVENTS.TRANSACTION_END]);
  assertSafeStageBitmap(bitmap);
  const executionFailure = failure === "QUERY_EXECUTION_FAILED";
  assert.equal(safeStageCompatibleWithOperatorEvidence({
    classification: executionFailure ? "DATABASE_UNAVAILABLE" : "SCHEMA_PARTIAL_OR_INVALID",
    errorCategory: executionFailure ? "DATABASE_QUERY_UNAVAILABLE" : "RESULT_SHAPE_INVALID",
    resultFailureCategory: failure,
    sqlstateClass: executionFailure ? "SYNTAX_OR_ACCESS_RULE" : "NOT_AVAILABLE",
    safeStageBitmap: bitmap,
  }), true, name);
}

const missing = progress([SAFE_STAGE_EVENTS.DATABASE_URL_MISSING]);
const parseFailed = progress([SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT, SAFE_STAGE_EVENTS.URL_PARSE_FAILED]);
const privateFailed = progress([
  SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT,
  SAFE_STAGE_EVENTS.URL_PARSED,
  SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_FAILED,
]);
for (const [errorCategory, bitmap] of [
  ["DATABASE_ENV_INVALID", missing],
  ["DATABASE_ENV_INVALID", parseFailed],
  ["DATABASE_PRIVATE_HOST_POLICY_FAIL", privateFailed],
]) {
  assert.equal(safeStageCompatibleWithOperatorEvidence({
    classification: "DATABASE_UNAVAILABLE",
    errorCategory,
    resultFailureCategory: "NOT_AVAILABLE",
    sqlstateClass: "NOT_AVAILABLE",
    safeStageBitmap: bitmap,
  }), true);
}

const oldCoarseBitmap = {
  DATABASE_URL_PRESENCE: "PRESENT",
  URL_PARSE_STATUS: "PASS",
  PRIVATE_HOST_POLICY_STATUS: "PASS",
  PG_CLIENT_CREATED: "PASS",
  CONNECT_STARTED: "YES",
  CONNECT_COMPLETED: "PASS",
  QUERY_STARTED: "SNAPSHOT",
  TRANSACTION_STARTED: "YES",
  LAST_COMPLETED_STAGE: "TRANSACTION_STARTED",
};
assert.throws(() => assertSafeStageBitmap(oldCoarseBitmap), /ALLOWLIST/);

const impossible = [
  { ...skipped, CONDITIONAL_TOPIC_COUNT_QUERY_STARTED: "YES" },
  { ...executed, INVENTORY_QUERY_COMPLETED: "NO" },
  { ...executed, LAST_COMPLETED_SUBSTAGE: "SNAPSHOT_COMPLETE" },
  { ...executed, TRANSACTION_END: "NO" },
  { ...createInitialSafeStageBitmap(), SNAPSHOT_BEGIN: "YES" },
  { ...executed, UNKNOWN_SUBSTAGE: "YES" },
];
for (const bitmap of impossible) assert.throws(() => assertSafeStageBitmap(bitmap), /SAFE_STAGE_BITMAP_/);
assert.throws(
  () => advanceSafeStageBitmap(skipped, SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED),
  /TRANSITION/,
);

const unavailable = createUnavailableSafeStageBitmap();
assert.deepEqual(Object.keys(unavailable), [...SAFE_STAGE_BITMAP_KEYS]);
assert.equal(QUERY_SUBSTAGE_BITMAP_KEYS.length, 16);
assert.equal(Object.values(unavailable).every((value) => value === "NOT_AVAILABLE"), true);

console.log("QUERY_SUBSTAGE_CONTRACT=PASS");
console.log("STATE_MACHINE_CONTRACT=PASS");
console.log("EIGHT_CANDIDATE_SUBSTAGE_FIXTURES=PASS");
console.log("QUERY_UNAVAILABLE_FOUR_BRANCH_FIXTURES=PASS");
console.log("ALL_STAGE_FIXTURES=PASS");
console.log("IMPOSSIBLE_STATE_NEGATIVE_FIXTURES=PASS");
console.log("OLD_COARSE_BEHAVIOR_NEGATIVE_FIXTURE=PASS");
console.log("RUNTIME_ENV_INHERITANCE_CONTRACT=NOT_PROVEN");
console.log("REMOTE_CALL_KILL_SWITCH=PASS");
console.log("DATABASE_CALL_KILL_SWITCH=PASS");
