export const SAFE_STAGE_CONTRACT_VERSION =
  "old-mike.schema-evidence-safe-stage.v3";

export const ERROR_ORIGIN_ENUM = Object.freeze([
  "PG_SQLSTATE",
  "NODE_SYSTEM_ERROR",
  "TLS_ERROR",
  "ABORT_SIGNAL",
  "TIMEOUT_WRAPPER",
  "PG_CLIENT_STATE",
  "RESULT_VALIDATION",
  "PROVIDER_WRAPPER",
  "UNKNOWN_FAIL_CLOSED",
]);

export const NODE_SYSTEM_CATEGORY_ENUM = Object.freeze([
  "DNS_RESOLUTION",
  "CONNECTION_REFUSED",
  "CONNECTION_RESET",
  "BROKEN_PIPE",
  "NETWORK_TIMEOUT",
  "SOCKET_CLOSED",
  "TLS_HANDSHAKE",
  "PROCESS_ABORT",
  "NOT_AVAILABLE",
  "UNKNOWN_FAIL_CLOSED",
]);

export const CLIENT_CONNECTION_STATE_ENUM = Object.freeze([
  "NOT_CREATED",
  "CREATED",
  "CONNECTING",
  "CONNECTED",
  "ENDING",
  "ENDED",
  "ERROR",
  "UNKNOWN",
]);

export const QUERY_PROMISE_PHASE_ENUM = Object.freeze([
  "NOT_CREATED",
  "CREATED",
  "DISPATCHED",
  "FULFILLED",
  "REJECTED",
  "CATCH_CLASSIFIED",
  "FINALLY_COMPLETED",
]);

export const ERROR_EVIDENCE_BITMAP_KEYS = Object.freeze([
  "ERROR_ORIGIN",
  "NODE_SYSTEM_CATEGORY",
  "CLIENT_CONNECTION_STATE",
  "QUERY_PROMISE_PHASE",
  "HAS_CODE",
  "CODE_TYPE_VALID",
  "HAS_NAME",
  "NAME_ALLOWLIST_CATEGORY",
  "HAS_CAUSE",
  "CAUSE_DEPTH_BUCKET",
  "IS_ABORT_ERROR",
  "IS_TIMEOUT_ERROR",
]);

export const QUERY_SUBSTAGE_BITMAP_KEYS = Object.freeze([
  "SNAPSHOT_BEGIN",
  "INVENTORY_QUERY_STARTED",
  "INVENTORY_QUERY_COMPLETED",
  "INVENTORY_SHAPE_VALIDATED",
  "COLUMN_QUERY_STARTED",
  "COLUMN_QUERY_COMPLETED",
  "COLUMN_SHAPE_VALIDATED",
  "STATIC_COUNT_QUERY_STARTED",
  "STATIC_COUNT_QUERY_COMPLETED",
  "STATIC_COUNT_SHAPE_VALIDATED",
  "CONDITIONAL_TOPIC_COUNT_QUERY_STARTED",
  "CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED",
  "CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED",
  "CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED",
  "SNAPSHOT_COMPLETE",
  "TRANSACTION_END",
]);

export const SAFE_STAGE_BITMAP_KEYS = Object.freeze([
  "DATABASE_URL_PRESENCE",
  "URL_PARSE_STATUS",
  "PRIVATE_HOST_POLICY_STATUS",
  "PG_CLIENT_CREATED",
  "CONNECT_STARTED",
  "CONNECT_COMPLETED",
  "QUERY_STARTED",
  "TRANSACTION_STARTED",
  "LAST_COMPLETED_STAGE",
  ...QUERY_SUBSTAGE_BITMAP_KEYS,
  "LAST_COMPLETED_SUBSTAGE",
]);

export const SAFE_STAGE_EVENTS = Object.freeze({
  DATABASE_URL_MISSING: "DATABASE_URL_MISSING",
  DATABASE_URL_PRESENT: "DATABASE_URL_PRESENT",
  URL_PARSE_FAILED: "URL_PARSE_FAILED",
  URL_PARSED: "URL_PARSED",
  PRIVATE_HOST_POLICY_FAILED: "PRIVATE_HOST_POLICY_FAILED",
  PRIVATE_HOST_POLICY_PASSED: "PRIVATE_HOST_POLICY_PASSED",
  PG_CLIENT_CREATE_FAILED: "PG_CLIENT_CREATE_FAILED",
  PG_CLIENT_CREATED: "PG_CLIENT_CREATED",
  CONNECT_STARTED: "CONNECT_STARTED",
  CONNECT_FAILED: "CONNECT_FAILED",
  CONNECT_COMPLETED: "CONNECT_COMPLETED",
  BEGIN_READ_ONLY_STARTED: "BEGIN_READ_ONLY_STARTED",
  TRANSACTION_STARTED: "TRANSACTION_STARTED",
  SNAPSHOT_BEGIN: "SNAPSHOT_BEGIN",
  INVENTORY_QUERY_STARTED: "INVENTORY_QUERY_STARTED",
  INVENTORY_QUERY_COMPLETED: "INVENTORY_QUERY_COMPLETED",
  INVENTORY_SHAPE_VALIDATED: "INVENTORY_SHAPE_VALIDATED",
  COLUMN_QUERY_STARTED: "COLUMN_QUERY_STARTED",
  COLUMN_QUERY_COMPLETED: "COLUMN_QUERY_COMPLETED",
  COLUMN_SHAPE_VALIDATED: "COLUMN_SHAPE_VALIDATED",
  STATIC_COUNT_QUERY_STARTED: "STATIC_COUNT_QUERY_STARTED",
  STATIC_COUNT_QUERY_COMPLETED: "STATIC_COUNT_QUERY_COMPLETED",
  STATIC_COUNT_SHAPE_VALIDATED: "STATIC_COUNT_SHAPE_VALIDATED",
  CONDITIONAL_TOPIC_COUNT_QUERY_STARTED: "CONDITIONAL_TOPIC_COUNT_QUERY_STARTED",
  CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED: "CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED",
  CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED: "CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED",
  CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED: "CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED",
  SNAPSHOT_COMPLETE: "SNAPSHOT_COMPLETE",
  TRANSACTION_END: "TRANSACTION_END",
});

const BASE_VALUE_ALLOWLIST = Object.freeze({
  DATABASE_URL_PRESENCE: new Set(["NOT_CHECKED", "MISSING", "PRESENT", "NOT_AVAILABLE"]),
  URL_PARSE_STATUS: new Set(["NOT_STARTED", "PASS", "FAIL", "NOT_AVAILABLE"]),
  PRIVATE_HOST_POLICY_STATUS: new Set(["NOT_STARTED", "PASS", "FAIL", "NOT_AVAILABLE"]),
  PG_CLIENT_CREATED: new Set(["NOT_STARTED", "PASS", "FAIL", "NOT_AVAILABLE"]),
  CONNECT_STARTED: new Set(["NO", "YES", "NOT_AVAILABLE"]),
  CONNECT_COMPLETED: new Set(["NOT_STARTED", "PASS", "FAIL", "NOT_AVAILABLE"]),
  QUERY_STARTED: new Set(["NOT_STARTED", "BEGIN_READ_ONLY", "SNAPSHOT", "NOT_AVAILABLE"]),
  TRANSACTION_STARTED: new Set(["NO", "YES", "NOT_AVAILABLE"]),
  LAST_COMPLETED_STAGE: new Set([
    "NONE",
    "DATABASE_URL_PRESENT",
    "URL_PARSED",
    "PRIVATE_HOST_POLICY_PASSED",
    "PG_CLIENT_CREATED",
    "CONNECT_COMPLETED",
    "TRANSACTION_STARTED",
    "SNAPSHOT_COLLECTED",
    "TRANSACTION_END",
    "NOT_AVAILABLE",
  ]),
});

const RESULT_FAILURE_CATEGORIES = new Set([
  "NONE",
  "QUERY_EXECUTION_FAILED",
  "ROW_SHAPE_INVALID",
  "VALUE_TYPE_INVALID",
  "CARDINALITY_INVALID",
  "SCHEMA_SIGNATURE_INVALID",
  "NOT_AVAILABLE",
  "UNKNOWN_FAIL_CLOSED",
]);

const SQLSTATE_CLASSES = new Set([
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

const COMMON_QUERY_SEQUENCE = Object.freeze([
  "SNAPSHOT_BEGIN",
  "INVENTORY_QUERY_STARTED",
  "INVENTORY_QUERY_COMPLETED",
  "INVENTORY_SHAPE_VALIDATED",
  "COLUMN_QUERY_STARTED",
  "COLUMN_QUERY_COMPLETED",
  "COLUMN_SHAPE_VALIDATED",
  "STATIC_COUNT_QUERY_STARTED",
  "STATIC_COUNT_QUERY_COMPLETED",
  "STATIC_COUNT_SHAPE_VALIDATED",
]);

const CONDITIONAL_QUERY_SEQUENCE = Object.freeze([
  "CONDITIONAL_TOPIC_COUNT_QUERY_STARTED",
  "CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED",
  "CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function allValues(bitmap, value) {
  return SAFE_STAGE_BITMAP_KEYS.every((key) => bitmap[key] === value);
}

function querySubstageInitial(bitmap) {
  return QUERY_SUBSTAGE_BITMAP_KEYS.every((key) => bitmap[key] === "NO") &&
    bitmap.LAST_COMPLETED_SUBSTAGE === "NONE";
}

function prefixValid(bitmap, sequence) {
  let seenNo = false;
  for (const key of sequence) {
    if (bitmap[key] === "NO") seenNo = true;
    else if (bitmap[key] === "YES" && seenNo) return false;
    else if (bitmap[key] !== "YES") return false;
  }
  return true;
}

function querySubstageStateValid(bitmap) {
  const skipped = bitmap.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED === "YES";
  const conditionalStarted = bitmap.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED === "YES";
  if (skipped && conditionalStarted) return false;
  if (skipped && [
    "CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED",
    "CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED",
  ].some((key) => bitmap[key] !== "NO")) return false;

  let sequence = [...COMMON_QUERY_SEQUENCE];
  if (skipped) {
    sequence.push("CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED", "SNAPSHOT_COMPLETE");
  } else if (conditionalStarted ||
      bitmap.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED === "YES" ||
      bitmap.CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED === "YES") {
    sequence.push(...CONDITIONAL_QUERY_SEQUENCE, "SNAPSHOT_COMPLETE");
  } else if (bitmap.SNAPSHOT_COMPLETE === "YES") {
    return false;
  }

  if (!prefixValid(bitmap, sequence)) return false;
  const sequenceSet = new Set(sequence);
  for (const key of QUERY_SUBSTAGE_BITMAP_KEYS) {
    if (key === "TRANSACTION_END" || sequenceSet.has(key)) continue;
    if (bitmap[key] !== "NO") return false;
  }

  const completed = sequence.filter((key) => bitmap[key] === "YES");
  const expectedLast = bitmap.TRANSACTION_END === "YES"
    ? "TRANSACTION_END"
    : completed.at(-1) ?? "NONE";
  return bitmap.LAST_COMPLETED_SUBSTAGE === expectedLast;
}

function downstreamInitial(bitmap, fromKey) {
  const expected = {
    URL_PARSE_STATUS: "NOT_STARTED",
    PRIVATE_HOST_POLICY_STATUS: "NOT_STARTED",
    PG_CLIENT_CREATED: "NOT_STARTED",
    CONNECT_STARTED: "NO",
    CONNECT_COMPLETED: "NOT_STARTED",
    QUERY_STARTED: "NOT_STARTED",
    TRANSACTION_STARTED: "NO",
  };
  const start = SAFE_STAGE_BITMAP_KEYS.indexOf(fromKey);
  return SAFE_STAGE_BITMAP_KEYS.slice(start).every((key) =>
    key === "LAST_COMPLETED_STAGE" || key === "LAST_COMPLETED_SUBSTAGE" ||
    !Object.hasOwn(expected, key) || bitmap[key] === expected[key]) && querySubstageInitial(bitmap);
}

function stateMachineValid(bitmap) {
  if (allValues(bitmap, "NOT_AVAILABLE")) return true;
  if (SAFE_STAGE_BITMAP_KEYS.some((key) => bitmap[key] === "NOT_AVAILABLE")) return false;
  if (!querySubstageStateValid(bitmap)) return false;

  if (bitmap.DATABASE_URL_PRESENCE === "NOT_CHECKED" || bitmap.DATABASE_URL_PRESENCE === "MISSING") {
    return downstreamInitial(bitmap, "URL_PARSE_STATUS") && bitmap.LAST_COMPLETED_STAGE === "NONE";
  }
  if (bitmap.DATABASE_URL_PRESENCE !== "PRESENT") return false;

  if (["NOT_STARTED", "FAIL"].includes(bitmap.URL_PARSE_STATUS)) {
    return downstreamInitial(bitmap, "PRIVATE_HOST_POLICY_STATUS") &&
      bitmap.LAST_COMPLETED_STAGE === "DATABASE_URL_PRESENT";
  }
  if (bitmap.URL_PARSE_STATUS !== "PASS") return false;

  if (["NOT_STARTED", "FAIL"].includes(bitmap.PRIVATE_HOST_POLICY_STATUS)) {
    return downstreamInitial(bitmap, "PG_CLIENT_CREATED") && bitmap.LAST_COMPLETED_STAGE === "URL_PARSED";
  }
  if (bitmap.PRIVATE_HOST_POLICY_STATUS !== "PASS") return false;

  if (["NOT_STARTED", "FAIL"].includes(bitmap.PG_CLIENT_CREATED)) {
    return downstreamInitial(bitmap, "CONNECT_STARTED") &&
      bitmap.LAST_COMPLETED_STAGE === "PRIVATE_HOST_POLICY_PASSED";
  }
  if (bitmap.PG_CLIENT_CREATED !== "PASS") return false;

  if (bitmap.CONNECT_STARTED === "NO") {
    return bitmap.CONNECT_COMPLETED === "NOT_STARTED" && bitmap.QUERY_STARTED === "NOT_STARTED" &&
      bitmap.TRANSACTION_STARTED === "NO" && bitmap.LAST_COMPLETED_STAGE === "PG_CLIENT_CREATED" &&
      querySubstageInitial(bitmap);
  }
  if (bitmap.CONNECT_STARTED !== "YES") return false;

  if (["NOT_STARTED", "FAIL"].includes(bitmap.CONNECT_COMPLETED)) {
    return bitmap.QUERY_STARTED === "NOT_STARTED" && bitmap.TRANSACTION_STARTED === "NO" &&
      bitmap.LAST_COMPLETED_STAGE === "PG_CLIENT_CREATED" && querySubstageInitial(bitmap);
  }
  if (bitmap.CONNECT_COMPLETED !== "PASS") return false;

  if (bitmap.QUERY_STARTED === "NOT_STARTED") {
    return bitmap.TRANSACTION_STARTED === "NO" && bitmap.LAST_COMPLETED_STAGE === "CONNECT_COMPLETED" &&
      querySubstageInitial(bitmap);
  }
  if (bitmap.QUERY_STARTED === "BEGIN_READ_ONLY") {
    if (bitmap.TRANSACTION_STARTED === "NO") {
      return bitmap.LAST_COMPLETED_STAGE === "CONNECT_COMPLETED" && querySubstageInitial(bitmap);
    }
    if (bitmap.TRANSACTION_STARTED !== "YES") return false;
    if (bitmap.TRANSACTION_END === "YES") return bitmap.LAST_COMPLETED_STAGE === "TRANSACTION_END";
    return bitmap.LAST_COMPLETED_STAGE === "TRANSACTION_STARTED" && querySubstageInitial(bitmap);
  }
  if (bitmap.QUERY_STARTED !== "SNAPSHOT" || bitmap.TRANSACTION_STARTED !== "YES" ||
      bitmap.SNAPSHOT_BEGIN !== "YES") return false;
  if (bitmap.TRANSACTION_END === "YES") return bitmap.LAST_COMPLETED_STAGE === "TRANSACTION_END";
  if (bitmap.SNAPSHOT_COMPLETE === "YES") return bitmap.LAST_COMPLETED_STAGE === "SNAPSHOT_COLLECTED";
  return bitmap.LAST_COMPLETED_STAGE === "TRANSACTION_STARTED";
}

export function assertSafeStageBitmap(bitmap) {
  if (!exactKeys(bitmap, SAFE_STAGE_BITMAP_KEYS)) throw new Error("SAFE_STAGE_BITMAP_ALLOWLIST_INVALID");
  for (const [key, allowed] of Object.entries(BASE_VALUE_ALLOWLIST)) {
    if (!allowed.has(bitmap[key])) throw new Error(`SAFE_STAGE_BITMAP_${key}_INVALID`);
  }
  for (const key of QUERY_SUBSTAGE_BITMAP_KEYS) {
    if (!["NO", "YES", "NOT_AVAILABLE"].includes(bitmap[key])) {
      throw new Error(`SAFE_STAGE_BITMAP_${key}_INVALID`);
    }
  }
  if (!["NONE", ...QUERY_SUBSTAGE_BITMAP_KEYS, "NOT_AVAILABLE"].includes(bitmap.LAST_COMPLETED_SUBSTAGE)) {
    throw new Error("SAFE_STAGE_BITMAP_LAST_COMPLETED_SUBSTAGE_INVALID");
  }
  if (!stateMachineValid(bitmap)) throw new Error("SAFE_STAGE_BITMAP_STATE_MACHINE_INVALID");
  return bitmap;
}

export function createInitialSafeStageBitmap() {
  return Object.freeze(assertSafeStageBitmap({
    DATABASE_URL_PRESENCE: "NOT_CHECKED",
    URL_PARSE_STATUS: "NOT_STARTED",
    PRIVATE_HOST_POLICY_STATUS: "NOT_STARTED",
    PG_CLIENT_CREATED: "NOT_STARTED",
    CONNECT_STARTED: "NO",
    CONNECT_COMPLETED: "NOT_STARTED",
    QUERY_STARTED: "NOT_STARTED",
    TRANSACTION_STARTED: "NO",
    LAST_COMPLETED_STAGE: "NONE",
    ...Object.fromEntries(QUERY_SUBSTAGE_BITMAP_KEYS.map((key) => [key, "NO"])),
    LAST_COMPLETED_SUBSTAGE: "NONE",
  }));
}

export function createUnavailableSafeStageBitmap() {
  return Object.freeze(assertSafeStageBitmap(Object.fromEntries(
    SAFE_STAGE_BITMAP_KEYS.map((key) => [key, "NOT_AVAILABLE"]),
  )));
}

function expectState(bitmap, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (bitmap[key] !== value) throw new Error("SAFE_STAGE_TRANSITION_INVALID");
  }
}

function advanceQuerySubstage(next, bitmap, key) {
  if (!QUERY_SUBSTAGE_BITMAP_KEYS.includes(key) || bitmap[key] !== "NO" || bitmap.TRANSACTION_END !== "NO") {
    throw new Error("SAFE_STAGE_TRANSITION_INVALID");
  }
  next[key] = "YES";
  next.LAST_COMPLETED_SUBSTAGE = key;
}

export function advanceSafeStageBitmap(bitmap, event) {
  assertSafeStageBitmap(bitmap);
  if (allValues(bitmap, "NOT_AVAILABLE")) throw new Error("SAFE_STAGE_TRANSITION_INVALID");
  const next = { ...bitmap };
  switch (event) {
    case SAFE_STAGE_EVENTS.DATABASE_URL_MISSING:
      expectState(bitmap, createInitialSafeStageBitmap());
      next.DATABASE_URL_PRESENCE = "MISSING";
      break;
    case SAFE_STAGE_EVENTS.DATABASE_URL_PRESENT:
      expectState(bitmap, createInitialSafeStageBitmap());
      next.DATABASE_URL_PRESENCE = "PRESENT";
      next.LAST_COMPLETED_STAGE = "DATABASE_URL_PRESENT";
      break;
    case SAFE_STAGE_EVENTS.URL_PARSE_FAILED:
      expectState(bitmap, { DATABASE_URL_PRESENCE: "PRESENT", URL_PARSE_STATUS: "NOT_STARTED" });
      next.URL_PARSE_STATUS = "FAIL";
      break;
    case SAFE_STAGE_EVENTS.URL_PARSED:
      expectState(bitmap, { DATABASE_URL_PRESENCE: "PRESENT", URL_PARSE_STATUS: "NOT_STARTED" });
      next.URL_PARSE_STATUS = "PASS";
      next.LAST_COMPLETED_STAGE = "URL_PARSED";
      break;
    case SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_FAILED:
      expectState(bitmap, { URL_PARSE_STATUS: "PASS", PRIVATE_HOST_POLICY_STATUS: "NOT_STARTED" });
      next.PRIVATE_HOST_POLICY_STATUS = "FAIL";
      break;
    case SAFE_STAGE_EVENTS.PRIVATE_HOST_POLICY_PASSED:
      expectState(bitmap, { URL_PARSE_STATUS: "PASS", PRIVATE_HOST_POLICY_STATUS: "NOT_STARTED" });
      next.PRIVATE_HOST_POLICY_STATUS = "PASS";
      next.LAST_COMPLETED_STAGE = "PRIVATE_HOST_POLICY_PASSED";
      break;
    case SAFE_STAGE_EVENTS.PG_CLIENT_CREATE_FAILED:
      expectState(bitmap, { PRIVATE_HOST_POLICY_STATUS: "PASS", PG_CLIENT_CREATED: "NOT_STARTED" });
      next.PG_CLIENT_CREATED = "FAIL";
      break;
    case SAFE_STAGE_EVENTS.PG_CLIENT_CREATED:
      expectState(bitmap, { PRIVATE_HOST_POLICY_STATUS: "PASS", PG_CLIENT_CREATED: "NOT_STARTED" });
      next.PG_CLIENT_CREATED = "PASS";
      next.LAST_COMPLETED_STAGE = "PG_CLIENT_CREATED";
      break;
    case SAFE_STAGE_EVENTS.CONNECT_STARTED:
      expectState(bitmap, { PG_CLIENT_CREATED: "PASS", CONNECT_STARTED: "NO" });
      next.CONNECT_STARTED = "YES";
      break;
    case SAFE_STAGE_EVENTS.CONNECT_FAILED:
      expectState(bitmap, { CONNECT_STARTED: "YES", CONNECT_COMPLETED: "NOT_STARTED", QUERY_STARTED: "NOT_STARTED" });
      next.CONNECT_COMPLETED = "FAIL";
      break;
    case SAFE_STAGE_EVENTS.CONNECT_COMPLETED:
      expectState(bitmap, { CONNECT_STARTED: "YES", CONNECT_COMPLETED: "NOT_STARTED", QUERY_STARTED: "NOT_STARTED" });
      next.CONNECT_COMPLETED = "PASS";
      next.LAST_COMPLETED_STAGE = "CONNECT_COMPLETED";
      break;
    case SAFE_STAGE_EVENTS.BEGIN_READ_ONLY_STARTED:
      expectState(bitmap, { CONNECT_COMPLETED: "PASS", QUERY_STARTED: "NOT_STARTED", TRANSACTION_STARTED: "NO" });
      next.QUERY_STARTED = "BEGIN_READ_ONLY";
      break;
    case SAFE_STAGE_EVENTS.TRANSACTION_STARTED:
      expectState(bitmap, { QUERY_STARTED: "BEGIN_READ_ONLY", TRANSACTION_STARTED: "NO" });
      next.TRANSACTION_STARTED = "YES";
      next.LAST_COMPLETED_STAGE = "TRANSACTION_STARTED";
      break;
    case SAFE_STAGE_EVENTS.SNAPSHOT_BEGIN:
      expectState(bitmap, { QUERY_STARTED: "BEGIN_READ_ONLY", TRANSACTION_STARTED: "YES", SNAPSHOT_BEGIN: "NO" });
      next.QUERY_STARTED = "SNAPSHOT";
      advanceQuerySubstage(next, bitmap, "SNAPSHOT_BEGIN");
      break;
    case SAFE_STAGE_EVENTS.INVENTORY_QUERY_STARTED:
    case SAFE_STAGE_EVENTS.INVENTORY_QUERY_COMPLETED:
    case SAFE_STAGE_EVENTS.INVENTORY_SHAPE_VALIDATED:
    case SAFE_STAGE_EVENTS.COLUMN_QUERY_STARTED:
    case SAFE_STAGE_EVENTS.COLUMN_QUERY_COMPLETED:
    case SAFE_STAGE_EVENTS.COLUMN_SHAPE_VALIDATED:
    case SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_STARTED:
    case SAFE_STAGE_EVENTS.STATIC_COUNT_QUERY_COMPLETED:
    case SAFE_STAGE_EVENTS.STATIC_COUNT_SHAPE_VALIDATED:
    case SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_STARTED:
    case SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_COMPLETED:
    case SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_QUERY_SKIPPED:
    case SAFE_STAGE_EVENTS.CONDITIONAL_TOPIC_COUNT_SHAPE_VALIDATED:
      advanceQuerySubstage(next, bitmap, event);
      break;
    case SAFE_STAGE_EVENTS.SNAPSHOT_COMPLETE:
      advanceQuerySubstage(next, bitmap, "SNAPSHOT_COMPLETE");
      next.LAST_COMPLETED_STAGE = "SNAPSHOT_COLLECTED";
      break;
    case SAFE_STAGE_EVENTS.TRANSACTION_END:
      expectState(bitmap, { TRANSACTION_STARTED: "YES", TRANSACTION_END: "NO" });
      advanceQuerySubstage(next, bitmap, "TRANSACTION_END");
      next.LAST_COMPLETED_STAGE = "TRANSACTION_END";
      break;
    default:
      throw new Error("SAFE_STAGE_EVENT_INVALID");
  }
  return Object.freeze(assertSafeStageBitmap(next));
}

const ERROR_ORIGIN_VALUES = new Set(ERROR_ORIGIN_ENUM);
const NODE_SYSTEM_CATEGORY_VALUES = new Set(NODE_SYSTEM_CATEGORY_ENUM);
const CLIENT_CONNECTION_STATE_VALUES = new Set(CLIENT_CONNECTION_STATE_ENUM);
const QUERY_PROMISE_PHASE_VALUES = new Set(QUERY_PROMISE_PHASE_ENUM);
const NAME_ALLOWLIST_CATEGORIES = new Set([
  "ERROR",
  "ABORT_ERROR",
  "TIMEOUT_ERROR",
  "DATABASE_ERROR",
  "SYSTEM_ERROR",
  "TYPE_ERROR",
  "NOT_AVAILABLE",
  "UNKNOWN_FAIL_CLOSED",
]);
const CAUSE_DEPTH_BUCKETS = new Set(["ZERO", "ONE", "TWO", "THREE", "GT_THREE"]);
const NODE_SYSTEM_CODE_CATEGORY = Object.freeze({
  ENOTFOUND: "DNS_RESOLUTION",
  EAI_AGAIN: "DNS_RESOLUTION",
  ECONNREFUSED: "CONNECTION_REFUSED",
  ECONNRESET: "CONNECTION_RESET",
  EPIPE: "BROKEN_PIPE",
  ETIMEDOUT: "NETWORK_TIMEOUT",
  ERR_SOCKET_CLOSED: "SOCKET_CLOSED",
  ERR_STREAM_PREMATURE_CLOSE: "SOCKET_CLOSED",
  ERR_STREAM_DESTROYED: "SOCKET_CLOSED",
  ABORT_ERR: "PROCESS_ABORT",
});
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

const CLIENT_STATE_TRANSITIONS = Object.freeze({
  NOT_CREATED: new Set(["CREATED", "ERROR"]),
  CREATED: new Set(["CONNECTING", "ERROR"]),
  CONNECTING: new Set(["CONNECTED", "ERROR"]),
  CONNECTED: new Set(["ENDING", "ERROR"]),
  ENDING: new Set(["ENDED", "ERROR"]),
  ENDED: new Set(),
  ERROR: new Set(),
  UNKNOWN: new Set(),
});

const QUERY_PHASE_TRANSITIONS = Object.freeze({
  NOT_CREATED: new Set(["CREATED"]),
  CREATED: new Set(["DISPATCHED"]),
  DISPATCHED: new Set(["FULFILLED", "REJECTED"]),
  FULFILLED: new Set(["FINALLY_COMPLETED"]),
  REJECTED: new Set(["CATCH_CLASSIFIED"]),
  CATCH_CLASSIFIED: new Set(["FINALLY_COMPLETED"]),
  FINALLY_COMPLETED: new Set(),
});

function classifyName(name) {
  if (typeof name !== "string") return "NOT_AVAILABLE";
  return ({
    Error: "ERROR",
    AbortError: "ABORT_ERROR",
    TimeoutError: "TIMEOUT_ERROR",
    DatabaseError: "DATABASE_ERROR",
    SystemError: "SYSTEM_ERROR",
    TypeError: "TYPE_ERROR",
  })[name] ?? "UNKNOWN_FAIL_CLOSED";
}

function causeDepthBucket(error) {
  if (!isRecord(error) || !Object.hasOwn(error, "cause")) return "ZERO";
  const seen = new Set([error]);
  let depth = 0;
  let current = error;
  while (isRecord(current) && Object.hasOwn(current, "cause")) {
    depth += 1;
    current = current.cause;
    if (!isRecord(current)) break;
    if (seen.has(current) || depth > 3) return "GT_THREE";
    seen.add(current);
  }
  return depth === 1 ? "ONE" : depth === 2 ? "TWO" : depth === 3 ? "THREE" : "GT_THREE";
}

function errorShape(error) {
  const record = isRecord(error);
  const hasCode = record && Object.hasOwn(error, "code");
  const hasName = record && Object.hasOwn(error, "name");
  const hasCause = record && Object.hasOwn(error, "cause");
  const code = hasCode && typeof error.code === "string" && error.code.length <= 64
    ? error.code.toUpperCase() : null;
  const nameCategory = hasName ? classifyName(error.name) : "NOT_AVAILABLE";
  return Object.freeze({
    HAS_CODE: hasCode ? "YES" : "NO",
    CODE_TYPE_VALID: hasCode ? (code ? "PASS" : "FAIL") : "NOT_AVAILABLE",
    HAS_NAME: hasName ? "YES" : "NO",
    NAME_ALLOWLIST_CATEGORY: nameCategory,
    HAS_CAUSE: hasCause ? "YES" : "NO",
    CAUSE_DEPTH_BUCKET: causeDepthBucket(error),
    IS_ABORT_ERROR: nameCategory === "ABORT_ERROR" || code === "ABORT_ERR" ? "YES" : "NO",
    IS_TIMEOUT_ERROR: nameCategory === "TIMEOUT_ERROR" || ["ETIMEDOUT", "OPERATOR_TIMEOUT"].includes(code)
      ? "YES" : "NO",
  });
}

export function assertErrorEvidenceBitmap(bitmap) {
  if (!exactKeys(bitmap, ERROR_EVIDENCE_BITMAP_KEYS)) throw new Error("ERROR_EVIDENCE_BITMAP_ALLOWLIST_INVALID");
  if (!ERROR_ORIGIN_VALUES.has(bitmap.ERROR_ORIGIN) ||
      !NODE_SYSTEM_CATEGORY_VALUES.has(bitmap.NODE_SYSTEM_CATEGORY) ||
      !CLIENT_CONNECTION_STATE_VALUES.has(bitmap.CLIENT_CONNECTION_STATE) ||
      !QUERY_PROMISE_PHASE_VALUES.has(bitmap.QUERY_PROMISE_PHASE) ||
      !["YES", "NO"].includes(bitmap.HAS_CODE) ||
      !["PASS", "FAIL", "NOT_AVAILABLE"].includes(bitmap.CODE_TYPE_VALID) ||
      !["YES", "NO"].includes(bitmap.HAS_NAME) ||
      !NAME_ALLOWLIST_CATEGORIES.has(bitmap.NAME_ALLOWLIST_CATEGORY) ||
      !["YES", "NO"].includes(bitmap.HAS_CAUSE) ||
      !CAUSE_DEPTH_BUCKETS.has(bitmap.CAUSE_DEPTH_BUCKET) ||
      !["YES", "NO"].includes(bitmap.IS_ABORT_ERROR) ||
      !["YES", "NO"].includes(bitmap.IS_TIMEOUT_ERROR)) {
    throw new Error("ERROR_EVIDENCE_BITMAP_ENUM_INVALID");
  }
  if ((bitmap.HAS_CODE === "NO") !== (bitmap.CODE_TYPE_VALID === "NOT_AVAILABLE") ||
      (bitmap.HAS_NAME === "NO") !== (bitmap.NAME_ALLOWLIST_CATEGORY === "NOT_AVAILABLE") ||
      (bitmap.HAS_CAUSE === "NO") !== (bitmap.CAUSE_DEPTH_BUCKET === "ZERO")) {
    throw new Error("ERROR_EVIDENCE_BITMAP_SHAPE_CONFLICT");
  }
  if (bitmap.CAUSE_DEPTH_BUCKET === "GT_THREE" && bitmap.ERROR_ORIGIN !== "UNKNOWN_FAIL_CLOSED") {
    throw new Error("ERROR_EVIDENCE_BITMAP_CAUSE_DEPTH_INVALID");
  }
  if (bitmap.IS_ABORT_ERROR === "YES" && bitmap.IS_TIMEOUT_ERROR === "YES") {
    throw new Error("ERROR_EVIDENCE_BITMAP_SIGNAL_CONFLICT");
  }
  if (bitmap.ERROR_ORIGIN === "NODE_SYSTEM_ERROR" &&
      ["NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED", "TLS_HANDSHAKE", "PROCESS_ABORT"].includes(bitmap.NODE_SYSTEM_CATEGORY)) {
    throw new Error("ERROR_EVIDENCE_BITMAP_NODE_CATEGORY_INVALID");
  }
  if (bitmap.ERROR_ORIGIN === "TLS_ERROR" && bitmap.NODE_SYSTEM_CATEGORY !== "TLS_HANDSHAKE") {
    throw new Error("ERROR_EVIDENCE_BITMAP_TLS_CATEGORY_INVALID");
  }
  if (bitmap.ERROR_ORIGIN === "ABORT_SIGNAL" && bitmap.NODE_SYSTEM_CATEGORY !== "PROCESS_ABORT") {
    throw new Error("ERROR_EVIDENCE_BITMAP_ABORT_CATEGORY_INVALID");
  }
  if (bitmap.ERROR_ORIGIN === "TIMEOUT_WRAPPER" && bitmap.NODE_SYSTEM_CATEGORY !== "NETWORK_TIMEOUT") {
    throw new Error("ERROR_EVIDENCE_BITMAP_TIMEOUT_CATEGORY_INVALID");
  }
  if (["PG_SQLSTATE", "PG_CLIENT_STATE", "RESULT_VALIDATION", "PROVIDER_WRAPPER"].includes(bitmap.ERROR_ORIGIN) &&
      bitmap.NODE_SYSTEM_CATEGORY !== "NOT_AVAILABLE") {
    throw new Error("ERROR_EVIDENCE_BITMAP_ORIGIN_CONFLICT");
  }
  return bitmap;
}

export function createInitialErrorEvidenceBitmap() {
  return Object.freeze(assertErrorEvidenceBitmap({
    ERROR_ORIGIN: "UNKNOWN_FAIL_CLOSED",
    NODE_SYSTEM_CATEGORY: "NOT_AVAILABLE",
    CLIENT_CONNECTION_STATE: "NOT_CREATED",
    QUERY_PROMISE_PHASE: "NOT_CREATED",
    HAS_CODE: "NO",
    CODE_TYPE_VALID: "NOT_AVAILABLE",
    HAS_NAME: "NO",
    NAME_ALLOWLIST_CATEGORY: "NOT_AVAILABLE",
    HAS_CAUSE: "NO",
    CAUSE_DEPTH_BUCKET: "ZERO",
    IS_ABORT_ERROR: "NO",
    IS_TIMEOUT_ERROR: "NO",
  }));
}

export function createUnavailableErrorEvidenceBitmap() {
  return Object.freeze(assertErrorEvidenceBitmap({
    ...createInitialErrorEvidenceBitmap(),
    NODE_SYSTEM_CATEGORY: "UNKNOWN_FAIL_CLOSED",
    CLIENT_CONNECTION_STATE: "UNKNOWN",
  }));
}

export function advanceClientConnectionState(bitmap, nextState) {
  assertErrorEvidenceBitmap(bitmap);
  if (!CLIENT_CONNECTION_STATE_VALUES.has(nextState) ||
      !CLIENT_STATE_TRANSITIONS[bitmap.CLIENT_CONNECTION_STATE]?.has(nextState)) {
    throw new Error("CLIENT_CONNECTION_STATE_TRANSITION_INVALID");
  }
  return Object.freeze(assertErrorEvidenceBitmap({ ...bitmap, CLIENT_CONNECTION_STATE: nextState }));
}

export function advanceQueryPromisePhase(bitmap, nextPhase) {
  assertErrorEvidenceBitmap(bitmap);
  if (!QUERY_PROMISE_PHASE_VALUES.has(nextPhase) ||
      !QUERY_PHASE_TRANSITIONS[bitmap.QUERY_PROMISE_PHASE]?.has(nextPhase)) {
    throw new Error("QUERY_PROMISE_PHASE_TRANSITION_INVALID");
  }
  return Object.freeze(assertErrorEvidenceBitmap({ ...bitmap, QUERY_PROMISE_PHASE: nextPhase }));
}

export function classifyErrorEvidence(error, bitmap, {
  sqlstateClass = "NOT_AVAILABLE",
  resultValidation = false,
  providerWrapper = false,
  timeoutWrapper = false,
  pgClientState = false,
} = {}) {
  assertErrorEvidenceBitmap(bitmap);
  if (!SQLSTATE_CLASSES.has(sqlstateClass) ||
      [resultValidation, providerWrapper, timeoutWrapper, pgClientState].filter(Boolean).length > 1) {
    throw new Error("ERROR_EVIDENCE_CLASSIFICATION_INPUT_INVALID");
  }
  const shape = errorShape(error);
  const code = shape.CODE_TYPE_VALID === "PASS" ? error.code.toUpperCase() : null;
  let errorOrigin = "UNKNOWN_FAIL_CLOSED";
  let nodeCategory = "NOT_AVAILABLE";
  if (shape.CAUSE_DEPTH_BUCKET === "GT_THREE" || shape.CODE_TYPE_VALID === "FAIL" ||
      shape.NAME_ALLOWLIST_CATEGORY === "UNKNOWN_FAIL_CLOSED" ||
      (shape.IS_ABORT_ERROR === "YES" && shape.IS_TIMEOUT_ERROR === "YES")) {
    nodeCategory = "UNKNOWN_FAIL_CLOSED";
  } else if (resultValidation) {
    errorOrigin = "RESULT_VALIDATION";
  } else if (providerWrapper) {
    errorOrigin = "PROVIDER_WRAPPER";
  } else if (timeoutWrapper || code === "OPERATOR_TIMEOUT") {
    errorOrigin = "TIMEOUT_WRAPPER";
    nodeCategory = "NETWORK_TIMEOUT";
  } else if (sqlstateClass !== "NOT_AVAILABLE" && sqlstateClass !== "UNKNOWN_FAIL_CLOSED") {
    errorOrigin = "PG_SQLSTATE";
  } else if (shape.IS_ABORT_ERROR === "YES") {
    errorOrigin = "ABORT_SIGNAL";
    nodeCategory = "PROCESS_ABORT";
  } else if (code?.startsWith("ERR_TLS_") || TLS_CODES.has(code) || shape.NAME_ALLOWLIST_CATEGORY === "SYSTEM_ERROR" && code?.startsWith("TLS_")) {
    errorOrigin = "TLS_ERROR";
    nodeCategory = "TLS_HANDSHAKE";
  } else if (code && Object.hasOwn(NODE_SYSTEM_CODE_CATEGORY, code)) {
    errorOrigin = code === "ABORT_ERR" ? "ABORT_SIGNAL" : "NODE_SYSTEM_ERROR";
    nodeCategory = NODE_SYSTEM_CODE_CATEGORY[code];
  } else if (pgClientState) {
    errorOrigin = "PG_CLIENT_STATE";
  } else if (code || sqlstateClass === "UNKNOWN_FAIL_CLOSED") {
    nodeCategory = "UNKNOWN_FAIL_CLOSED";
  }
  return Object.freeze(assertErrorEvidenceBitmap({
    ...bitmap,
    ...shape,
    ERROR_ORIGIN: errorOrigin,
    NODE_SYSTEM_CATEGORY: nodeCategory,
  }));
}

export function errorEvidenceCompatibleWithOperatorEvidence({
  classification,
  errorCategory,
  resultFailureCategory = "NOT_AVAILABLE",
  sqlstateClass = "NOT_AVAILABLE",
  safeStageBitmap,
  errorEvidenceBitmap,
} = {}) {
  try {
    assertSafeStageBitmap(safeStageBitmap);
    assertErrorEvidenceBitmap(errorEvidenceBitmap);
  } catch {
    return false;
  }
  if (!SQLSTATE_CLASSES.has(sqlstateClass)) return false;
  const success = ["SCHEMA_0006_PRE_0007", "SCHEMA_0007_COMPLETE"].includes(classification);
  if (success) {
    return errorCategory === "NONE" && resultFailureCategory === "NONE" &&
      errorEvidenceBitmap.ERROR_ORIGIN === "UNKNOWN_FAIL_CLOSED" &&
      errorEvidenceBitmap.QUERY_PROMISE_PHASE === "FINALLY_COMPLETED" &&
      errorEvidenceBitmap.CLIENT_CONNECTION_STATE === "ENDED" &&
      errorEvidenceBitmap.HAS_CODE === "NO" && errorEvidenceBitmap.HAS_NAME === "NO";
  }
  if (errorCategory === "RESULT_SHAPE_INVALID") {
    return errorEvidenceBitmap.ERROR_ORIGIN === "RESULT_VALIDATION" &&
      errorEvidenceBitmap.QUERY_PROMISE_PHASE === "FINALLY_COMPLETED";
  }
  if (errorCategory === "DATABASE_TIMEOUT") {
    return ["TIMEOUT_WRAPPER", "PG_SQLSTATE", "NODE_SYSTEM_ERROR"].includes(errorEvidenceBitmap.ERROR_ORIGIN) &&
      errorEvidenceBitmap.IS_TIMEOUT_ERROR === "YES";
  }
  if (errorCategory === "DATABASE_QUERY_UNAVAILABLE") {
    const beforeSnapshot = safeStageBitmap.SNAPSHOT_BEGIN === "NO" &&
      errorEvidenceBitmap.QUERY_PROMISE_PHASE === "NOT_CREATED";
    const afterSnapshot = safeStageBitmap.SNAPSHOT_BEGIN === "YES" &&
      ["CATCH_CLASSIFIED", "FINALLY_COMPLETED"].includes(errorEvidenceBitmap.QUERY_PROMISE_PHASE);
    return !["RESULT_VALIDATION", "PROVIDER_WRAPPER"].includes(errorEvidenceBitmap.ERROR_ORIGIN) &&
      (beforeSnapshot || afterSnapshot);
  }
  if (["DATABASE_ENV_INVALID", "DATABASE_PRIVATE_HOST_POLICY_FAIL", "RUNTIME_DEPENDENCY_UNAVAILABLE",
    "OPERATOR_RUNTIME_FAILURE", "ARGUMENTS_FORBIDDEN", "OPERATOR_IDENTITY_MISMATCH",
    "SCHEMA_SIGNATURE_MISMATCH"].includes(errorCategory)) {
    return errorEvidenceBitmap.ERROR_ORIGIN === "UNKNOWN_FAIL_CLOSED";
  }
  return classification === "SCHEMA_PARTIAL_OR_INVALID" &&
    errorEvidenceBitmap.ERROR_ORIGIN === "UNKNOWN_FAIL_CLOSED";
}

export function safeStageCompatibleWithOperatorEvidence({
  classification,
  errorCategory,
  resultFailureCategory = "NOT_AVAILABLE",
  sqlstateClass = "NOT_AVAILABLE",
  safeStageBitmap,
} = {}) {
  try { assertSafeStageBitmap(safeStageBitmap); } catch { return false; }
  if (!RESULT_FAILURE_CATEGORIES.has(resultFailureCategory) || !SQLSTATE_CLASSES.has(sqlstateClass)) return false;
  const stage = safeStageBitmap;
  const transactionClosed = stage.TRANSACTION_STARTED === "YES" && stage.TRANSACTION_END === "YES";
  if (["SCHEMA_0006_PRE_0007", "SCHEMA_0007_COMPLETE"].includes(classification)) {
    return errorCategory === "NONE" && resultFailureCategory === "NONE" &&
      sqlstateClass === "NOT_AVAILABLE" && stage.SNAPSHOT_COMPLETE === "YES" && transactionClosed;
  }
  if (classification === "SCHEMA_PARTIAL_OR_INVALID") {
    if (errorCategory === "RESULT_SHAPE_INVALID") {
      return ["ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID", "CARDINALITY_INVALID"].includes(resultFailureCategory) &&
        sqlstateClass === "NOT_AVAILABLE" && stage.SNAPSHOT_BEGIN === "YES" && transactionClosed;
    }
    return ["SCHEMA_SIGNATURE_MISMATCH", "OPERATOR_IDENTITY_MISMATCH"].includes(errorCategory) &&
      ["SCHEMA_SIGNATURE_INVALID", "NONE"].includes(resultFailureCategory) &&
      sqlstateClass === "NOT_AVAILABLE" && stage.SNAPSHOT_COMPLETE === "YES" && transactionClosed;
  }
  if (classification !== "DATABASE_UNAVAILABLE") return false;
  if (["RUNTIME_DEPENDENCY_UNAVAILABLE", "OPERATOR_RUNTIME_FAILURE", "ARGUMENTS_FORBIDDEN"].includes(errorCategory)) {
    return resultFailureCategory === "NOT_AVAILABLE" && sqlstateClass === "NOT_AVAILABLE" &&
      ["NOT_CHECKED", "NOT_AVAILABLE"].includes(stage.DATABASE_URL_PRESENCE);
  }
  if (errorCategory === "DATABASE_ENV_INVALID") {
    return resultFailureCategory === "NOT_AVAILABLE" && sqlstateClass === "NOT_AVAILABLE" &&
      (stage.DATABASE_URL_PRESENCE === "MISSING" ||
       (stage.DATABASE_URL_PRESENCE === "PRESENT" && stage.URL_PARSE_STATUS === "FAIL"));
  }
  if (errorCategory === "DATABASE_PRIVATE_HOST_POLICY_FAIL") {
    return resultFailureCategory === "NOT_AVAILABLE" && sqlstateClass === "NOT_AVAILABLE" &&
      stage.PRIVATE_HOST_POLICY_STATUS === "FAIL";
  }
  if (errorCategory === "DATABASE_TIMEOUT") {
    return ["NOT_AVAILABLE", "QUERY_EXECUTION_FAILED"].includes(resultFailureCategory) &&
      ["NOT_AVAILABLE", "QUERY_CANCELED_OR_TIMEOUT"].includes(sqlstateClass) &&
      stage.PG_CLIENT_CREATED === "PASS" && stage.CONNECT_STARTED === "YES";
  }
  if (errorCategory !== "DATABASE_QUERY_UNAVAILABLE") return false;
  const beforeTransaction = stage.TRANSACTION_STARTED === "NO";
  const afterTransaction = stage.TRANSACTION_STARTED === "YES" && stage.TRANSACTION_END === "YES";
  return ["NOT_AVAILABLE", "QUERY_EXECUTION_FAILED"].includes(resultFailureCategory) &&
    sqlstateClass !== "QUERY_CANCELED_OR_TIMEOUT" && (beforeTransaction || afterTransaction);
}

export function extractSafeStageBitmapForRetention(output) {
  if (typeof output !== "string" || output.length > 32_768 || output.includes("\r") ||
      !output.endsWith("\n") || output.slice(0, -1).includes("\n")) {
    return createUnavailableSafeStageBitmap();
  }
  const prefix = "OLD_MIKE_SCHEMA_EVIDENCE=";
  const line = output.slice(0, -1);
  if (!line.startsWith(prefix)) return createUnavailableSafeStageBitmap();
  try {
    const parsed = JSON.parse(line.slice(prefix.length));
    if (!isRecord(parsed) || !Object.hasOwn(parsed, "safeStageBitmap")) {
      return createUnavailableSafeStageBitmap();
    }
    return Object.freeze({ ...assertSafeStageBitmap(parsed.safeStageBitmap) });
  } catch {
    return createUnavailableSafeStageBitmap();
  }
}

export function extractErrorEvidenceBitmapForRetention(output) {
  if (typeof output !== "string" || output.length > 32_768 || output.includes("\r") ||
      !output.endsWith("\n") || output.slice(0, -1).includes("\n")) {
    return createUnavailableErrorEvidenceBitmap();
  }
  const prefix = "OLD_MIKE_SCHEMA_EVIDENCE=";
  const line = output.slice(0, -1);
  if (!line.startsWith(prefix)) return createUnavailableErrorEvidenceBitmap();
  try {
    const parsed = JSON.parse(line.slice(prefix.length));
    if (!isRecord(parsed) || !Object.hasOwn(parsed, "errorEvidenceBitmap")) {
      return createUnavailableErrorEvidenceBitmap();
    }
    return Object.freeze({ ...assertErrorEvidenceBitmap(parsed.errorEvidenceBitmap) });
  } catch {
    return createUnavailableErrorEvidenceBitmap();
  }
}
