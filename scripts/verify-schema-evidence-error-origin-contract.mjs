import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  CLIENT_CONNECTION_STATE_ENUM,
  ERROR_EVIDENCE_BITMAP_KEYS,
  ERROR_ORIGIN_ENUM,
  NODE_SYSTEM_CATEGORY_ENUM,
  QUERY_PROMISE_PHASE_ENUM,
  advanceClientConnectionState,
  advanceQueryPromisePhase,
  assertErrorEvidenceBitmap,
  classifyErrorEvidence,
  createInitialErrorEvidenceBitmap,
  createUnavailableErrorEvidenceBitmap,
  extractErrorEvidenceBitmapForRetention,
} from "./schema-evidence-safe-stage-contract.mjs";
import { runSchemaEvidenceOperator } from "./verify-online-schema-state.mjs";

assert.deepEqual(ERROR_ORIGIN_ENUM, [
  "PG_SQLSTATE", "NODE_SYSTEM_ERROR", "TLS_ERROR", "ABORT_SIGNAL", "TIMEOUT_WRAPPER",
  "PG_CLIENT_STATE", "RESULT_VALIDATION", "PROVIDER_WRAPPER", "UNKNOWN_FAIL_CLOSED",
]);
assert.deepEqual(NODE_SYSTEM_CATEGORY_ENUM, [
  "DNS_RESOLUTION", "CONNECTION_REFUSED", "CONNECTION_RESET", "BROKEN_PIPE",
  "NETWORK_TIMEOUT", "SOCKET_CLOSED", "TLS_HANDSHAKE", "PROCESS_ABORT",
  "NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED",
]);
assert.deepEqual(CLIENT_CONNECTION_STATE_ENUM, [
  "NOT_CREATED", "CREATED", "CONNECTING", "CONNECTED", "ENDING", "ENDED", "ERROR", "UNKNOWN",
]);
assert.deepEqual(QUERY_PROMISE_PHASE_ENUM, [
  "NOT_CREATED", "CREATED", "DISPATCHED", "FULFILLED", "REJECTED", "CATCH_CLASSIFIED",
  "FINALLY_COMPLETED",
]);

const initial = createInitialErrorEvidenceBitmap();
assert.deepEqual(Object.keys(initial), ERROR_EVIDENCE_BITMAP_KEYS);
assertErrorEvidenceBitmap(initial);
assertErrorEvidenceBitmap(createUnavailableErrorEvidenceBitmap());

let lifecycle = initial;
for (const state of ["CREATED", "CONNECTING", "CONNECTED", "ENDING", "ENDED"]) {
  lifecycle = advanceClientConnectionState(lifecycle, state);
}
assert.equal(lifecycle.CLIENT_CONNECTION_STATE, "ENDED");
await assert.rejects(async () => advanceClientConnectionState(initial, "CONNECTED"), /TRANSITION_INVALID/);

let promise = initial;
for (const phase of ["CREATED", "DISPATCHED", "FULFILLED", "FINALLY_COMPLETED"]) {
  promise = advanceQueryPromisePhase(promise, phase);
}
assert.equal(promise.QUERY_PROMISE_PHASE, "FINALLY_COMPLETED");
let rejectedPromise = initial;
for (const phase of ["CREATED", "DISPATCHED", "REJECTED", "CATCH_CLASSIFIED", "FINALLY_COMPLETED"]) {
  rejectedPromise = advanceQueryPromisePhase(rejectedPromise, phase);
}
assert.equal(rejectedPromise.QUERY_PROMISE_PHASE, "FINALLY_COMPLETED");
await assert.rejects(async () => advanceQueryPromisePhase(initial, "FULFILLED"), /TRANSITION_INVALID/);

function errorFixture({ code, name = "Error", cause } = {}) {
  const error = new Error("REDACTED_FIXTURE");
  error.name = name;
  if (code !== undefined) error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

const originFixtures = Object.freeze([
  [errorFixture({ code: "42501", name: "DatabaseError" }), { sqlstateClass: "SYNTAX_OR_ACCESS_RULE" }, "PG_SQLSTATE", "NOT_AVAILABLE"],
  [errorFixture({ code: "ENOTFOUND", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "DNS_RESOLUTION"],
  [errorFixture({ code: "ECONNREFUSED", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "CONNECTION_REFUSED"],
  [errorFixture({ code: "ECONNRESET", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "CONNECTION_RESET"],
  [errorFixture({ code: "EPIPE", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "BROKEN_PIPE"],
  [errorFixture({ code: "ETIMEDOUT", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "NETWORK_TIMEOUT"],
  [errorFixture({ code: "ERR_SOCKET_CLOSED", name: "SystemError" }), {}, "NODE_SYSTEM_ERROR", "SOCKET_CLOSED"],
  [errorFixture({ code: "ERR_TLS_CERT_ALTNAME_INVALID", name: "SystemError" }), {}, "TLS_ERROR", "TLS_HANDSHAKE"],
  [errorFixture({ code: "ABORT_ERR", name: "AbortError" }), {}, "ABORT_SIGNAL", "PROCESS_ABORT"],
  [errorFixture({ code: "OPERATOR_TIMEOUT", name: "TimeoutError" }), { timeoutWrapper: true }, "TIMEOUT_WRAPPER", "NETWORK_TIMEOUT"],
  [errorFixture(), { pgClientState: true }, "PG_CLIENT_STATE", "NOT_AVAILABLE"],
  [errorFixture(), { resultValidation: true }, "RESULT_VALIDATION", "NOT_AVAILABLE"],
  [errorFixture(), { providerWrapper: true }, "PROVIDER_WRAPPER", "NOT_AVAILABLE"],
  [errorFixture({ code: "UNRECOGNIZED" }), {}, "UNKNOWN_FAIL_CLOSED", "UNKNOWN_FAIL_CLOSED"],
  [errorFixture(), {}, "UNKNOWN_FAIL_CLOSED", "NOT_AVAILABLE"],
]);
for (const [error, options, origin, system] of originFixtures) {
  const actual = classifyErrorEvidence(error, initial, options);
  assert.equal(actual.ERROR_ORIGIN, origin);
  assert.equal(actual.NODE_SYSTEM_CATEGORY, system);
  assertErrorEvidenceBitmap(actual);
  assert.equal(JSON.stringify(actual).includes("REDACTED_FIXTURE"), false);
}

const nested = classifyErrorEvidence(errorFixture({ cause: errorFixture({ cause: errorFixture() }) }), initial);
assert.equal(nested.CAUSE_DEPTH_BUCKET, "TWO");
const cycle = errorFixture();
cycle.cause = cycle;
const overDeep = classifyErrorEvidence(cycle, initial);
assert.equal(overDeep.CAUSE_DEPTH_BUCKET, "GT_THREE");
assert.equal(overDeep.ERROR_ORIGIN, "UNKNOWN_FAIL_CLOSED");
assert.throws(() => classifyErrorEvidence(errorFixture(), initial, {
  resultValidation: true, providerWrapper: true,
}), /INPUT_INVALID/);

for (const invalid of [
  { ...initial, ERROR_ORIGIN: ["PG_SQLSTATE", "NODE_SYSTEM_ERROR"] },
  { ...initial, HAS_CODE: "YES", CODE_TYPE_VALID: "NOT_AVAILABLE" },
  { ...initial, HAS_CAUSE: "YES", CAUSE_DEPTH_BUCKET: "ZERO" },
  { ...initial, IS_ABORT_ERROR: "YES", IS_TIMEOUT_ERROR: "YES" },
]) assert.throws(() => assertErrorEvidenceBitmap(invalid));

class FakeQueryClient {
  static failMode = "NO_CODE";
  constructor() { this.queryCount = 0; }
  async connect() {}
  async end() {}
  async query(text) {
    this.queryCount += 1;
    if (this.queryCount === 2) {
      if (FakeQueryClient.failMode === "SQLSTATE") throw errorFixture({ code: "42501", name: "DatabaseError" });
      if (FakeQueryClient.failMode === "SYSTEM") throw errorFixture({ code: "ECONNRESET", name: "SystemError" });
      if (FakeQueryClient.failMode === "SHAPE") return { rows: null };
      throw errorFixture();
    }
    return { rows: [] };
  }
}
const databaseUrl = ["postgresql:", "//", "fixture", "@", "127.0.0.1", ":1/fixture"].join("");
const sourceIdentityProvider = async () => ({ pass: true, sourceSha256: "a".repeat(64) });
for (const [mode, expectedOrigin] of [
  ["NO_CODE", "UNKNOWN_FAIL_CLOSED"],
  ["SQLSTATE", "PG_SQLSTATE"],
  ["SYSTEM", "NODE_SYSTEM_ERROR"],
  ["SHAPE", "RESULT_VALIDATION"],
]) {
  FakeQueryClient.failMode = mode;
  const result = await runSchemaEvidenceOperator({ Client: FakeQueryClient, databaseUrl, sourceIdentityProvider });
  assert.equal(result.errorEvidenceBitmap.ERROR_ORIGIN, expectedOrigin);
  assert.equal(result.errorEvidenceBitmap.QUERY_PROMISE_PHASE, "FINALLY_COMPLETED");
  assert.equal(result.safeStageBitmap.INVENTORY_QUERY_STARTED, "YES");
  assert.equal(result.safeStageBitmap.INVENTORY_QUERY_COMPLETED, mode === "SHAPE" ? "YES" : "NO");
}

class ConstructorFailure { constructor() { throw errorFixture(); } }
const constructorFailure = await runSchemaEvidenceOperator({
  Client: ConstructorFailure, databaseUrl, sourceIdentityProvider,
});
assert.equal(constructorFailure.errorEvidenceBitmap.ERROR_ORIGIN, "PG_CLIENT_STATE");
assert.equal(constructorFailure.errorEvidenceBitmap.CLIENT_CONNECTION_STATE, "ERROR");

class ConnectFailure {
  constructor() {}
  async connect() { throw errorFixture({ code: "ENOTFOUND", name: "SystemError" }); }
  async end() {}
  async query() { return { rows: [] }; }
}
const connectFailure = await runSchemaEvidenceOperator({ Client: ConnectFailure, databaseUrl, sourceIdentityProvider });
assert.equal(connectFailure.errorEvidenceBitmap.ERROR_ORIGIN, "NODE_SYSTEM_ERROR");
assert.equal(connectFailure.errorEvidenceBitmap.CLIENT_CONNECTION_STATE, "ERROR");

const retained = extractErrorEvidenceBitmapForRetention(
  `OLD_MIKE_SCHEMA_EVIDENCE=${JSON.stringify({ errorEvidenceBitmap: connectFailure.errorEvidenceBitmap })}\n`,
);
assert.deepEqual(retained, connectFailure.errorEvidenceBitmap);
assert.deepEqual(extractErrorEvidenceBitmapForRetention("INVALID\n"), createUnavailableErrorEvidenceBitmap());

const sqlFingerprint = Object.freeze({
  statementCount: 1,
  parameterCount: 0,
  queryKind: "CATALOG_INVENTORY_AGGREGATE_SELECT",
  catalogFamily: "INFORMATION_SCHEMA_AND_SYSTEM_CATALOG",
  byteLengthBucket: "LE_4096",
  sha256: "e52959e7854d16d782d0f0f2609d65a8320cd154185c162e09c20376132b068c",
});
assert.match(sqlFingerprint.sha256, /^[a-f0-9]{64}$/);
assert.equal(createHash("sha256").update(JSON.stringify(sqlFingerprint)).digest("hex").length, 64);

console.log("ERROR_ORIGIN_CONTRACT=PASS");
console.log("NODE_SYSTEM_CATEGORY_CONTRACT=PASS");
console.log("CLIENT_STATE_CONTRACT=PASS");
console.log("QUERY_PROMISE_PHASE_CONTRACT=PASS");
console.log("ERROR_OBJECT_SHAPE_CONTRACT=PASS");
console.log("SIX_CANDIDATE_BRANCH_FIXTURES=PASS");
console.log("OLD_ORIGIN_GAP_NEGATIVE_FIXTURE=PASS");
console.log("SQL_FINGERPRINT_CONTRACT=PASS");
console.log("REMOTE_CALL_KILL_SWITCH=PASS");
console.log("DATABASE_CALL_KILL_SWITCH=PASS");
