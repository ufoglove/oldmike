import { createHash } from "node:crypto";
import {
  assertErrorEvidenceBitmap,
  assertSafeStageBitmap,
  errorEvidenceCompatibleWithOperatorEvidence,
  safeStageCompatibleWithOperatorEvidence,
} from "./schema-evidence-safe-stage-contract.mjs";

export const FIXED_OPERATOR_PATH = ".next/standalone/operator/verify-online-schema-state.mjs";
export const EXPECTED_RELEASE_IDENTITY =
  "old-mike-research-portal/1.5.27/01a949e3e18a6d59169b9ffaf39e15fe168da3e370475bdd1abf164aba952f2b";

export const TRANSPORT_CATEGORIES = Object.freeze([
  "SUCCESS",
  "SUBMISSION_ERROR",
  "GRAPHQL_ERROR",
  "NULL_RESULT",
  "MISSING_RESULT",
  "REMOTE_NONZERO_EXIT",
  "OUTPUT_COLLECTION_FAILURE",
  "OUTPUT_TRUNCATED",
  "OUTPUT_ENCODING_FAILURE",
  "CLIENT_TIMEOUT",
  "CONTROL_PLANE_TIMEOUT",
  "RESULT_SHAPE_INVALID",
]);

const OPERATOR_KEYS = Object.freeze([
  "activeDeploymentPointerProven", "base0006Signature", "classification",
  "constraintsValidated", "contractVersion", "counts", "errorCategory",
  "errorEvidenceBitmap",
  "expected0007Columns", "expected0007TableCount", "indexesValidReady",
  "observed0007Columns", "observed0007TableCount", "operatorIdentity",
  "operatorSourceSha256", "publicTableCount", "readOnlyTransaction", "releaseIdentity",
  "resultFailureCategory", "safeStageBitmap", "sqlstateClass",
]);
const COUNT_KEYS = Object.freeze([
  "accountCount", "activeUnusedInviteCount", "administratorCount",
  "currentSessionCount", "inviteTotalCount", "membershipCount",
  "phase2FormalRowCount", "projectArtifactCount", "projectCount",
  "topicLabFormalRowCount", "userCount", "workspaceCount",
]);
const SCHEMA_STATES = new Set([
  "SCHEMA_0006_PRE_0007", "SCHEMA_0007_COMPLETE",
  "SCHEMA_PARTIAL_OR_INVALID", "DATABASE_UNAVAILABLE",
]);
const OPERATOR_ERROR_CATEGORIES = new Set([
  "NONE", "RESULT_SHAPE_INVALID", "SCHEMA_SIGNATURE_MISMATCH", "OPERATOR_IDENTITY_MISMATCH",
  "DATABASE_ENV_INVALID", "DATABASE_PRIVATE_HOST_POLICY_FAIL", "DATABASE_TIMEOUT",
  "DATABASE_QUERY_UNAVAILABLE", "RUNTIME_DEPENDENCY_UNAVAILABLE", "OPERATOR_RUNTIME_FAILURE",
  "ARGUMENTS_FORBIDDEN",
]);
const RESULT_FAILURE_CATEGORIES = new Set([
  "NONE", "QUERY_EXECUTION_FAILED", "ROW_SHAPE_INVALID", "VALUE_TYPE_INVALID",
  "CARDINALITY_INVALID", "SCHEMA_SIGNATURE_INVALID", "NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED",
]);
const SQLSTATE_CLASSES = new Set([
  "CONNECTION", "AUTHENTICATION_OR_AUTHORIZATION", "TRANSACTION_STATE",
  "SYNTAX_OR_ACCESS_RULE", "RESOURCE_LIMIT", "QUERY_CANCELED_OR_TIMEOUT",
  "DATA_OR_CARDINALITY", "INTERNAL_OR_SYSTEM", "NOT_AVAILABLE", "UNKNOWN_FAIL_CLOSED",
]);

function exactKeys(value, expected) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()));
}

export function createFixedCommandRequest() {
  return Object.freeze({
    command: Object.freeze(["node", FIXED_OPERATOR_PATH]),
    shell: false,
    stdin: "FORBIDDEN",
    fileApi: "FORBIDDEN",
    websocket: "FORBIDDEN",
  });
}

export function verifyFixedCommandRequest(request) {
  return exactKeys(request, ["command", "fileApi", "shell", "stdin", "websocket"]) &&
    Array.isArray(request.command) && request.command.length === 2 &&
    request.command[0] === "node" && request.command[1] === FIXED_OPERATOR_PATH &&
    request.shell === false && request.stdin === "FORBIDDEN" &&
    request.fileApi === "FORBIDDEN" && request.websocket === "FORBIDDEN";
}

export async function executeFixedCommandProvider(provider) {
  if (!provider || typeof provider.executeCommand !== "function" || Object.keys(provider).some((key) => key !== "executeCommand")) {
    throw new Error("EXECUTE_COMMAND_PROVIDER_INVALID");
  }
  return provider.executeCommand(createFixedCommandRequest());
}

export function classifyCommandTransport(evidence) {
  const base = {
    category: "RESULT_SHAPE_INVALID",
    submissionAcknowledged: "NOT_PROVEN",
    controlPlaneAccepted: "NOT_PROVEN",
    remoteExecutionStarted: "NOT_PROVEN",
    remoteExitCodeStatus: "NOT_AVAILABLE",
    resultPresent: "NOT_PROVEN",
    resultShapeValid: "FAIL",
    graphqlErrorsPresent: "NOT_PROVEN",
    outputCollected: "NOT_PROVEN",
    outputEncodingStatus: "NOT_PROVEN",
    timeoutLayer: "NONE",
  };
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return base;
  if (evidence.timeoutLayer === "CLIENT") return { ...base, category: "CLIENT_TIMEOUT", timeoutLayer: "CLIENT" };
  if (evidence.timeoutLayer === "CONTROL_PLANE") return { ...base, category: "CONTROL_PLANE_TIMEOUT", timeoutLayer: "CONTROL_PLANE" };
  if (evidence.submissionError === true) return { ...base, category: "SUBMISSION_ERROR" };
  const submission = evidence.submissionAcknowledged === true ? "PROVEN" : "NOT_PROVEN";
  const accepted = evidence.controlPlaneAccepted === true ? "PROVEN" : "NOT_PROVEN";
  if (evidence.graphqlErrorsPresent === true) return {
    ...base, category: "GRAPHQL_ERROR", submissionAcknowledged: submission,
    controlPlaneAccepted: accepted, graphqlErrorsPresent: "YES",
  };
  if (evidence.resultPresent === false && evidence.result === null) return {
    ...base, category: "NULL_RESULT", submissionAcknowledged: submission,
    controlPlaneAccepted: accepted, resultPresent: "NO", graphqlErrorsPresent: "NO",
  };
  if (evidence.resultPresent === false) return {
    ...base, category: "MISSING_RESULT", submissionAcknowledged: submission,
    controlPlaneAccepted: accepted, resultPresent: "NO", graphqlErrorsPresent: "NO",
  };
  const started = evidence.remoteExecutionStarted === true ? "PROVEN" : "NOT_PROVEN";
  const common = {
    ...base, submissionAcknowledged: submission, controlPlaneAccepted: accepted,
    remoteExecutionStarted: started, resultPresent: "YES", graphqlErrorsPresent: "NO",
  };
  if (evidence.outputCollectionFailure === true) return { ...common, category: "OUTPUT_COLLECTION_FAILURE" };
  if (evidence.outputTruncated === true) return { ...common, category: "OUTPUT_TRUNCATED", outputCollected: "PROVEN" };
  if (evidence.outputEncoding === "INVALID") return {
    ...common, category: "OUTPUT_ENCODING_FAILURE", outputCollected: "PROVEN", outputEncodingStatus: "FAIL",
  };
  if (!Number.isSafeInteger(evidence.remoteExitCode) || typeof evidence.output !== "string") return common;
  const exitStatus = evidence.remoteExitCode === 0 ? "PRESENT_ZERO" : "PRESENT_NONZERO";
  if (evidence.remoteExitCode !== 0) return {
    ...common, category: "REMOTE_NONZERO_EXIT", remoteExitCodeStatus: exitStatus,
    outputCollected: "PROVEN", outputEncodingStatus: "UTF8",
  };
  return {
    ...common, category: "SUCCESS", remoteExitCodeStatus: exitStatus,
    outputCollected: "PROVEN", outputEncodingStatus: "UTF8", resultShapeValid: "PASS",
  };
}

function safeCount(value) {
  return value === "NOT_AVAILABLE" || (Number.isSafeInteger(value) && value >= 0);
}

export function parseOperatorOutput(output) {
  if (typeof output !== "string" || output.length > 32_768 || output.includes("\r")) {
    throw new Error("OPERATOR_OUTPUT_SHAPE_INVALID");
  }
  const lines = output.trimEnd().split("\n");
  if (lines.length !== 1 || !lines[0].startsWith("OLD_MIKE_SCHEMA_EVIDENCE=")) {
    throw new Error("OPERATOR_OUTPUT_SHAPE_INVALID");
  }
  let value;
  try { value = JSON.parse(lines[0].slice("OLD_MIKE_SCHEMA_EVIDENCE=".length)); } catch {
    throw new Error("OPERATOR_OUTPUT_JSON_INVALID");
  }
  if (!exactKeys(value, OPERATOR_KEYS) || !exactKeys(value.counts, COUNT_KEYS) ||
      value.contractVersion !== "old-mike.schema-evidence-operator.v4" ||
      value.releaseIdentity !== EXPECTED_RELEASE_IDENTITY ||
      !/^(?:[a-f0-9]{64}|NOT_AVAILABLE)$/.test(value.operatorSourceSha256) ||
      !["PASS", "FAIL"].includes(value.operatorIdentity) || !SCHEMA_STATES.has(value.classification) ||
      !OPERATOR_ERROR_CATEGORIES.has(value.errorCategory) ||
      !RESULT_FAILURE_CATEGORIES.has(value.resultFailureCategory) ||
      !SQLSTATE_CLASSES.has(value.sqlstateClass) ||
      !["PASS", "FAIL"].includes(value.readOnlyTransaction) ||
      !["PASS", "FAIL", "NOT_EXECUTED"].includes(value.base0006Signature) ||
      !["PASS", "FAIL", "NOT_EXECUTED"].includes(value.constraintsValidated) ||
      !["PASS", "FAIL", "NOT_EXECUTED"].includes(value.indexesValidReady) ||
      value.expected0007TableCount !== 2 || value.expected0007Columns !== 28 ||
      !safeCount(value.observed0007TableCount) || !safeCount(value.observed0007Columns) ||
      !safeCount(value.publicTableCount) ||
      value.activeDeploymentPointerProven !== false ||
      !Object.values(value.counts).every(safeCount)) {
    throw new Error("OPERATOR_OUTPUT_CONTRACT_INVALID");
  }
  try { assertSafeStageBitmap(value.safeStageBitmap); } catch {
    throw new Error("OPERATOR_OUTPUT_CONTRACT_INVALID");
  }
  try { assertErrorEvidenceBitmap(value.errorEvidenceBitmap); } catch {
    throw new Error("OPERATOR_OUTPUT_CONTRACT_INVALID");
  }
  if (!safeStageCompatibleWithOperatorEvidence(value)) {
    throw new Error("OPERATOR_OUTPUT_CONTRACT_INVALID");
  }
  if (!errorEvidenceCompatibleWithOperatorEvidence(value)) {
    throw new Error("OPERATOR_OUTPUT_CONTRACT_INVALID");
  }
  return value;
}

export function bindPublicHealthEvidence({ health, operatorEvidence, expectedOperatorSourceSha256 }) {
  const healthMatch = Boolean(health && health.httpStatus === 200 && health.status === "ok" &&
    health.version === "1.5.27" && health.releaseIdentity === EXPECTED_RELEASE_IDENTITY &&
    ["connected", "demo"].includes(health.mode));
  const operatorMatch = Boolean(operatorEvidence && operatorEvidence.operatorIdentity === "PASS" &&
    operatorEvidence.releaseIdentity === EXPECTED_RELEASE_IDENTITY &&
    /^[a-f0-9]{64}$/.test(expectedOperatorSourceSha256) &&
    operatorEvidence.operatorSourceSha256 === expectedOperatorSourceSha256);
  return Object.freeze({
    publicHealthBinding: healthMatch && operatorMatch ? "PASS" : "FAIL",
    publicReleaseIdentityMatch: healthMatch ? "PASS" : "FAIL",
    operatorIdentityMatch: operatorMatch ? "PASS" : "FAIL",
    activeDeploymentPointerClaim: "NOT_CLAIMED",
    bindingCommitment: healthMatch && operatorMatch
      ? createHash("sha256").update(`${EXPECTED_RELEASE_IDENTITY}\n${expectedOperatorSourceSha256}`, "utf8").digest("hex")
      : "NOT_AVAILABLE",
  });
}
