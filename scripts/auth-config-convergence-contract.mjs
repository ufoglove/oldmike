import {
  CONFIG_ERROR_CATEGORIES,
  stableAuthoritativeReadbacks,
} from "./auth-config-authoritative-provider.mjs";

export const AUTH_CONFIG_CONVERGENCE_CONTRACT_VERSION = "1.5.13";

export const AUTH_CONFIG_CONVERGENCE_STATES = Object.freeze([
  "CONFIG_UPDATE_REQUESTED",
  "CONFIG_UPDATE_ACKNOWLEDGED",
  "AUTHORITATIVE_READBACK_PENDING",
  "AUTHORITATIVE_READBACK_MATCHED",
  "AUTHORITATIVE_READBACK_STABLE",
  "RUNTIME_RESTART_REQUESTED",
  "POST_RESTART_RUNTIME_READY",
  "RUNTIME_GENERATION_MATCHED",
  "RUNTIME_POLICY_CONFIRMED",
  "PUBLIC_POLICY_CONFIRMED",
  "CONFIG_CONVERGENCE_PROVEN",
]);

export const CLOSED_RECOVERY_STATES = AUTH_CONFIG_CONVERGENCE_STATES;
export const CONTROLLED_EMAIL_REMOVAL_STATES = AUTH_CONFIG_CONVERGENCE_STATES;
export { CONFIG_ERROR_CATEGORIES };

export const DEPLOYMENT_BOUND_RUNTIME_LOGS = "DEPLOYMENT_BOUND_RUNTIME_LOGS";
export const EXACT_DEPLOYMENT_QUERY = "EXACT";
export const CAPABILITY_AVAILABLE = "AVAILABLE";
export const CAPABILITY_NOT_AVAILABLE = "NOT_AVAILABLE";

export const INVITE_ONLY_PUBLIC_POLICY_CONTRACT = Object.freeze({
  method: "POST",
  path: "/api/account/register",
  body: Object.freeze({}),
  status: 400,
  code: "invalid_name",
  writes: 0,
});

export const CLOSED_PUBLIC_POLICY_CONTRACT = Object.freeze({
  method: "POST",
  path: "/api/account/register",
  body: Object.freeze({}),
  status: 503,
  code: "registration_unavailable",
  writes: 0,
});

const ONE_SHOT_OPERATIONS = Object.freeze([
  "ATTEMPT_CONFIG_MUTATION",
  "ATTEMPT_RUNTIME_RESTART",
  "BRIDGE",
  "INVITE_CREATE",
  "RECOVERY_CONFIG_MUTATION",
  "RECOVERY_RUNTIME_RESTART",
  "GENERATION_REMOVAL_CONFIG_MUTATION",
  "GENERATION_REMOVAL_RUNTIME_RESTART",
]);

const HARD_READBACK_FAILURES = new Set([
  "CONFIG_SCOPE_MISMATCH",
  "CONFIG_DUPLICATE_KEY",
]);

function assertTimestamp(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_${label}`);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`INVALID_${label}`);
}

function timestamp(value) {
  if (Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function append(history, state, at, evidence = {}) {
  const previous = history.at(-1);
  if (previous && at < previous.at) throw new Error("NON_MONOTONIC_CONFIG_EVIDENCE");
  history.push(Object.freeze({ sequence: history.length + 1, state, at, ...evidence }));
}

function transition(context, state, at, evidence = {}) {
  context.state = state;
  append(context.history, state, at, evidence);
}

function result(context, outcome, errorCategory = null, failedSubgate = null) {
  return Object.freeze({
    context,
    outcome,
    errorCategory,
    failedSubgate,
    authoritativeReadbackGate: context.authoritativeReadbackStableAt !== null ? "PASS" : "FAIL",
    postRestartRuntimeBarrier: context.newRuntimeReadyAt !== null ? "PASS" : "FAIL",
    runtimeGenerationGate: context.runtimeGenerationVerifiedAt !== null ? "PASS" : "FAIL",
    runtimePolicyGate: context.runtimePolicyVerifiedAt !== null ? "PASS" : "FAIL",
    publicPolicyGate: context.publicPolicyVerifiedAt !== null ? "PASS" : "FAIL",
    authConfigConvergenceContract: context.state === "CONFIG_CONVERGENCE_PROVEN" ? "PASS" : "FAIL",
    automaticRetryBlocked: "PASS",
  });
}

export function createAuthE2eOneShotLatch() {
  return {
    counts: Object.fromEntries(ONE_SHOT_OPERATIONS.map((operation) => [operation, 0])),
    timestamps: Object.fromEntries(ONE_SHOT_OPERATIONS.map((operation) => [operation, null])),
  };
}

export function consumeAuthE2eOneShot(latch, operation, now) {
  if (!latch?.counts || !ONE_SHOT_OPERATIONS.includes(operation)) {
    throw new Error("INVALID_ONE_SHOT_OPERATION");
  }
  assertTimestamp(now, "ONE_SHOT_OPERATION_TIME");
  if (latch.counts[operation] !== 0) throw new Error(`DUPLICATE_${operation}_REQUEST`);
  latch.counts[operation] = 1;
  latch.timestamps[operation] = now;
  return true;
}

function operationsFor(kind) {
  if (kind === "ATTEMPT") {
    return { mutation: "ATTEMPT_CONFIG_MUTATION", restart: "ATTEMPT_RUNTIME_RESTART" };
  }
  if (kind === "RECOVERY") {
    return { mutation: "RECOVERY_CONFIG_MUTATION", restart: "RECOVERY_RUNTIME_RESTART" };
  }
  return {
    mutation: "GENERATION_REMOVAL_CONFIG_MUTATION",
    restart: "GENERATION_REMOVAL_RUNTIME_RESTART",
  };
}

function createModeConvergence({
  kind,
  now,
  latch,
  deploymentID,
  expectedVersion,
  expectedReleaseIdentity,
  expectedGeneration,
  targetMode,
  controlledEmailPresence,
  previousRuntimeReadyAt = null,
  previousRuntimeLogCursor = null,
  previousPodIdentity = null,
  convergenceTimeoutMs = 180_000,
} = {}) {
  assertTimestamp(now, "CONFIG_UPDATE_REQUESTED_AT");
  assertString(deploymentID, "DEPLOYMENT_ID");
  assertString(expectedVersion, "EXPECTED_VERSION");
  assertString(expectedReleaseIdentity, "EXPECTED_RELEASE_IDENTITY");
  if (expectedGeneration !== null) assertString(expectedGeneration, "EXPECTED_CONFIG_GENERATION");
  if (!["closed", "invite_only"].includes(targetMode)) throw new Error("CONFIG_VALUE_NOT_REPLACED");
  if (!["PRESENT", "ABSENT"].includes(controlledEmailPresence)) {
    throw new Error("CONFIG_VALUE_NOT_REPLACED");
  }
  if (!Number.isSafeInteger(convergenceTimeoutMs) || convergenceTimeoutMs <= 0) {
    throw new Error("INVALID_CONFIG_CONVERGENCE_TIMEOUT");
  }
  if (previousRuntimeReadyAt !== null) assertTimestamp(previousRuntimeReadyAt, "PREVIOUS_RUNTIME_READY_AT");
  const operations = operationsFor(kind);
  consumeAuthE2eOneShot(latch, operations.mutation, now);
  const context = {
    kind,
    state: "CONFIG_UPDATE_REQUESTED",
    deploymentID,
    expectedVersion,
    expectedReleaseIdentity,
    expectedGeneration,
    targetMode,
    controlledEmailPresence,
    convergenceTimeoutMs,
    configUpdateRequestedAt: now,
    configUpdateAcknowledgedAt: null,
    firstMatchingReadback: null,
    authoritativeReadbackMatchedAt: null,
    authoritativeReadbackStableAt: null,
    runtimeRestartRequestedAt: null,
    previousRuntimeReadyAt,
    previousRuntimeLogCursor,
    previousPodIdentity,
    newRuntimeReadyAt: null,
    newRuntimeLogCursor: null,
    runtimeReadyEvidenceSource: null,
    runtimeGenerationVerifiedAt: null,
    runtimePolicyVerifiedAt: null,
    publicPolicyVerifiedAt: null,
    history: [],
    latch,
    operations,
  };
  append(context.history, context.state, now);
  return context;
}

export function createAuthConfigConvergence(options = {}) {
  return createModeConvergence({
    ...options,
    kind: "ATTEMPT",
    targetMode: "invite_only",
    controlledEmailPresence: "PRESENT",
  });
}

export function createClosedRecoveryConvergence(options = {}) {
  return createModeConvergence({
    ...options,
    kind: "RECOVERY",
    targetMode: "closed",
    controlledEmailPresence: "ABSENT",
  });
}

export function createControlledEmailRemovalConvergence({ recovery, ...options } = {}) {
  if (recovery?.kind !== "RECOVERY" || recovery.state !== "CONFIG_CONVERGENCE_PROVEN") {
    throw new Error("GENERATION_REMOVAL_BEFORE_RECOVERY_PROVEN");
  }
  return createModeConvergence({
    ...options,
    kind: "GENERATION_REMOVAL",
    expectedGeneration: null,
    targetMode: "closed",
    controlledEmailPresence: "ABSENT",
  });
}

function acknowledgeModeUpdate(context, { now, mutationAccepted = true } = {}) {
  assertTimestamp(now, "CONFIG_UPDATE_ACKNOWLEDGED_AT");
  if (context.state !== "CONFIG_UPDATE_REQUESTED") throw new Error("CONFIG_UPDATE_ACK_OUT_OF_ORDER");
  if (now < context.configUpdateRequestedAt) throw new Error("CONFIG_UPDATE_ACK_BEFORE_REQUEST");
  if (mutationAccepted !== true) throw new Error("CONFIG_MUTATION_REJECTED");
  context.configUpdateAcknowledgedAt = now;
  transition(context, "CONFIG_UPDATE_ACKNOWLEDGED", now, { acknowledgement: "REQUEST_ACKNOWLEDGED" });
  return context;
}

export function acknowledgeAuthConfigUpdate(context, observation = {}) {
  return acknowledgeModeUpdate(context, observation);
}

export function acknowledgeClosedConfigUpdate(context, observation = {}) {
  return acknowledgeModeUpdate(context, observation);
}

export function acknowledgeControlledEmailRemoval(context, observation = {}) {
  return acknowledgeModeUpdate(context, observation);
}

function configReadbackTimeoutReached(context, now) {
  return now - context.configUpdateRequestedAt >= context.convergenceTimeoutMs;
}

export function observeAuthoritativeConfigReadback(context, { now, readback } = {}) {
  assertTimestamp(now, "AUTHORITATIVE_READBACK_OBSERVED_AT");
  if (!["CONFIG_UPDATE_ACKNOWLEDGED", "AUTHORITATIVE_READBACK_PENDING", "AUTHORITATIVE_READBACK_MATCHED"].includes(context.state)) {
    throw new Error("AUTHORITATIVE_READBACK_OUT_OF_ORDER");
  }
  if (context.state === "CONFIG_UPDATE_ACKNOWLEDGED") {
    transition(context, "AUTHORITATIVE_READBACK_PENDING", now);
  }
  if (!readback?.matched) {
    const category = CONFIG_ERROR_CATEGORIES.includes(readback?.errorCategory)
      ? readback.errorCategory
      : "CONFIG_READBACK_NOT_FOUND";
    if (HARD_READBACK_FAILURES.has(category)) return result(context, "FAIL_CLOSED", category, "AUTHORITATIVE_READBACK");
    return configReadbackTimeoutReached(context, now)
      ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", category)
      : result(context, "WAIT", category, "AUTHORITATIVE_READBACK");
  }
  if (readback.readbackAt <= context.configUpdateRequestedAt) {
    return result(context, "WAIT", "CONFIG_READBACK_STALE", "AUTHORITATIVE_READBACK");
  }
  if (!context.firstMatchingReadback) {
    context.firstMatchingReadback = readback;
    context.authoritativeReadbackMatchedAt = now;
    transition(context, "AUTHORITATIVE_READBACK_MATCHED", now, { readbackAt: readback.readbackAt });
    return result(context, "WAIT", "AUTHORITATIVE_READBACK_PENDING", "AUTHORITATIVE_READBACK_STABILITY");
  }
  if (!stableAuthoritativeReadbacks(context.firstMatchingReadback, readback)) {
    context.firstMatchingReadback = readback;
    context.authoritativeReadbackMatchedAt = now;
    return configReadbackTimeoutReached(context, now)
      ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", "CONFIG_VALUE_NOT_REPLACED")
      : result(context, "WAIT", "CONFIG_VALUE_NOT_REPLACED", "AUTHORITATIVE_READBACK_STABILITY");
  }
  context.authoritativeReadbackStableAt = now;
  transition(context, "AUTHORITATIVE_READBACK_STABLE", now, { readbackAt: readback.readbackAt });
  return result(context, "WAIT", null);
}

function requestModeRestart(context, { now } = {}) {
  assertTimestamp(now, "RUNTIME_RESTART_REQUESTED_AT");
  if (context.state !== "AUTHORITATIVE_READBACK_STABLE") throw new Error("RESTART_NOT_REQUESTED");
  consumeAuthE2eOneShot(context.latch, context.operations.restart, now);
  context.runtimeRestartRequestedAt = now;
  transition(context, "RUNTIME_RESTART_REQUESTED", now);
  return context;
}

export function requestAuthRuntimeRestart(context, observation = {}) {
  return requestModeRestart(context, observation);
}

export function requestClosedRecoveryRestart(context, observation = {}) {
  return requestModeRestart(context, observation);
}

export function requestControlledEmailRemovalRestart(context, observation = {}) {
  return requestModeRestart(context, observation);
}

function cursorAdvanced(previous, current, explicit) {
  if (previous === null || previous === undefined) return current !== null && current !== undefined;
  if (typeof previous === "number" && typeof current === "number") return current > previous;
  if (typeof previous === "string" && typeof current === "string") {
    return current !== previous && explicit === true;
  }
  return explicit === true;
}

function freshRuntimeEvidence(context, runtime) {
  if (!runtime || runtime.deploymentID !== context.deploymentID) return false;
  if (runtime.evidenceSource !== DEPLOYMENT_BOUND_RUNTIME_LOGS || runtime.queryBinding !== EXACT_DEPLOYMENT_QUERY) return false;
  if (runtime.serverReady !== true) return false;
  if (![CAPABILITY_AVAILABLE, CAPABILITY_NOT_AVAILABLE].includes(runtime.podIdentityCapability)) return false;
  const readyAt = timestamp(runtime.readyAt);
  if (readyAt === null || readyAt <= context.runtimeRestartRequestedAt) return false;
  if (context.previousRuntimeReadyAt !== null && readyAt <= context.previousRuntimeReadyAt) return false;
  if (!cursorAdvanced(context.previousRuntimeLogCursor, runtime.logCursor, runtime.cursorAdvanced)) return false;
  if (runtime.podIdentityCapability === CAPABILITY_AVAILABLE) {
    if (typeof runtime.podIdentity !== "string" || !runtime.podIdentity.trim()) return false;
    if (context.previousPodIdentity && runtime.podIdentity === context.previousPodIdentity) return false;
  }
  return true;
}

function publicHealthPass(context, policy) {
  return policy?.healthStatus === 200 &&
    policy?.healthVersion === context.expectedVersion &&
    policy?.healthMode === "connected" &&
    policy?.releaseIdentity === context.expectedReleaseIdentity &&
    policy?.cacheBust === true &&
    policy?.requestNoCache === true &&
    policy?.responseNoStore === true &&
    policy?.projectsStatus === 401;
}

function publicModePass(context, policy) {
  const expected = context.targetMode === "invite_only"
    ? INVITE_ONLY_PUBLIC_POLICY_CONTRACT
    : CLOSED_PUBLIC_POLICY_CONTRACT;
  return policy?.registrationStatus === expected.status && policy?.registrationCode === expected.code;
}

function runtimePolicyPass(context, policy) {
  return policy?.registrationMode === context.targetMode &&
    policy?.controlledEmailKeyPresent === (context.controlledEmailPresence === "PRESENT") &&
    policy?.externalSearchDisabled === true &&
    policy?.sensitiveValuesExposed === false;
}

function runtimeGenerationPass(context, policy) {
  return policy?.configGenerationMatches === true &&
    policy?.configGenerationPresent === (context.expectedGeneration !== null) &&
    policy?.sensitiveValuesExposed === false;
}

function runtimeTimeoutReached(context, now) {
  return now - context.runtimeRestartRequestedAt >= context.convergenceTimeoutMs;
}

function reconcileModeConvergence(context, observation) {
  const now = observation?.now;
  assertTimestamp(now, "CONFIG_CONVERGENCE_OBSERVATION_TIME");
  if (context.runtimeRestartRequestedAt === null) throw new Error("RESTART_NOT_REQUESTED");
  if (context.state === "RUNTIME_RESTART_REQUESTED") {
    if (!freshRuntimeEvidence(context, observation?.runtime)) {
      return runtimeTimeoutReached(context, now)
        ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", "POST_RESTART_RUNTIME_NOT_READY")
        : result(context, "WAIT", "POST_RESTART_RUNTIME_NOT_READY", "POST_RESTART_RUNTIME_READY");
    }
    context.newRuntimeReadyAt = timestamp(observation.runtime.readyAt);
    context.newRuntimeLogCursor = observation.runtime.logCursor;
    context.runtimeReadyEvidenceSource = observation.runtime.evidenceSource;
    transition(context, "POST_RESTART_RUNTIME_READY", now, {
      deploymentID: context.deploymentID,
      readyAt: context.newRuntimeReadyAt,
    });
  }
  if (context.state === "POST_RESTART_RUNTIME_READY") {
    if (!runtimeGenerationPass(context, observation?.runtimePolicy)) {
      return runtimeTimeoutReached(context, now)
        ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", "RUNTIME_GENERATION_MISMATCH")
        : result(context, "WAIT", "RUNTIME_GENERATION_MISMATCH", "RUNTIME_GENERATION_MATCHED");
    }
    context.runtimeGenerationVerifiedAt = now;
    transition(context, "RUNTIME_GENERATION_MATCHED", now);
  }
  if (context.state === "RUNTIME_GENERATION_MATCHED") {
    if (!runtimePolicyPass(context, observation?.runtimePolicy)) {
      return runtimeTimeoutReached(context, now)
        ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", "RUNTIME_POLICY_NOT_APPLIED")
        : result(context, "WAIT", "RUNTIME_POLICY_NOT_APPLIED", "RUNTIME_POLICY_CONFIRMED");
    }
    context.runtimePolicyVerifiedAt = now;
    transition(context, "RUNTIME_POLICY_CONFIRMED", now);
  }
  if (context.state === "RUNTIME_POLICY_CONFIRMED") {
    if (!publicHealthPass(context, observation?.publicPolicy) || !publicModePass(context, observation?.publicPolicy)) {
      return runtimeTimeoutReached(context, now)
        ? result(context, "FAIL_CLOSED", "CONFIG_CONVERGENCE_TIMEOUT", "PUBLIC_POLICY_NOT_APPLIED")
        : result(context, "WAIT", "PUBLIC_POLICY_NOT_APPLIED", "PUBLIC_POLICY_CONFIRMED");
    }
    context.publicPolicyVerifiedAt = now;
    transition(context, "PUBLIC_POLICY_CONFIRMED", now);
  }
  if (context.state === "PUBLIC_POLICY_CONFIRMED") transition(context, "CONFIG_CONVERGENCE_PROVEN", now);
  return result(context, context.state === "CONFIG_CONVERGENCE_PROVEN" ? "PASS" : "WAIT");
}

export function reconcileAuthConfigConvergence(context, observation) {
  if (context?.kind !== "ATTEMPT") throw new Error("INVALID_AUTH_CONFIG_CONVERGENCE");
  return reconcileModeConvergence(context, observation);
}

export function reconcileClosedRecoveryConvergence(context, observation) {
  if (context?.kind !== "RECOVERY") throw new Error("INVALID_CLOSED_RECOVERY_CONVERGENCE");
  return reconcileModeConvergence(context, observation);
}

export function reconcileControlledEmailRemoval(context, observation) {
  if (context?.kind !== "GENERATION_REMOVAL") throw new Error("INVALID_GENERATION_REMOVAL_CONVERGENCE");
  return reconcileModeConvergence(context, observation);
}

export function markControlledEmailBridgeExecution(latch, { now, convergence } = {}) {
  assertTimestamp(now, "BRIDGE_EXECUTION_AT");
  if (convergence?.kind !== "ATTEMPT" || convergence?.state !== "CONFIG_CONVERGENCE_PROVEN") {
    throw new Error("BRIDGE_BEFORE_CONFIG_CONVERGENCE");
  }
  return consumeAuthE2eOneShot(latch, "BRIDGE", now);
}

export function markInvitationCreate(latch, { now, convergence } = {}) {
  assertTimestamp(now, "INVITE_CREATE_AT");
  if (convergence?.kind !== "ATTEMPT" || convergence?.state !== "CONFIG_CONVERGENCE_PROVEN") {
    throw new Error("INVITE_CREATE_BEFORE_CONFIG_CONVERGENCE");
  }
  return consumeAuthE2eOneShot(latch, "INVITE_CREATE", now);
}
