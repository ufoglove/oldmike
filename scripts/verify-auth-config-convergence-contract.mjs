import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readReleaseContract, releaseIdentity } from "./release-identity-contract.mjs";
import {
  AUTH_CONFIG_KEYS,
  createOpaqueConfigGeneration,
  planAuthoritativeConfigReplace,
  readAuthoritativeDesiredConfig,
} from "./auth-config-authoritative-provider.mjs";
import {
  AUTH_CONFIG_CONVERGENCE_CONTRACT_VERSION,
  CAPABILITY_NOT_AVAILABLE,
  CLOSED_PUBLIC_POLICY_CONTRACT,
  DEPLOYMENT_BOUND_RUNTIME_LOGS,
  EXACT_DEPLOYMENT_QUERY,
  INVITE_ONLY_PUBLIC_POLICY_CONTRACT,
  acknowledgeAuthConfigUpdate,
  acknowledgeClosedConfigUpdate,
  acknowledgeControlledEmailRemoval,
  createAuthConfigConvergence,
  createAuthE2eOneShotLatch,
  createClosedRecoveryConvergence,
  createControlledEmailRemovalConvergence,
  markControlledEmailBridgeExecution,
  markInvitationCreate,
  observeAuthoritativeConfigReadback,
  reconcileAuthConfigConvergence,
  reconcileClosedRecoveryConvergence,
  reconcileControlledEmailRemoval,
  requestAuthRuntimeRestart,
  requestClosedRecoveryRestart,
  requestControlledEmailRemovalRestart,
} from "./auth-config-convergence-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeSource = fs.readFileSync(path.join(root, "app", "api", "account", "register", "route.ts"), "utf8");
const consentSource = fs.readFileSync(path.join(root, "lib", "consent-contract.ts"), "utf8");
const contractSource = fs.readFileSync(new URL("./auth-config-convergence-contract.mjs", import.meta.url), "utf8");
const providerSource = fs.readFileSync(new URL("./auth-config-authoritative-provider.mjs", import.meta.url), "utf8");

assert.equal(AUTH_CONFIG_CONVERGENCE_CONTRACT_VERSION, "1.5.13");
assert.deepEqual(INVITE_ONLY_PUBLIC_POLICY_CONTRACT, {
  method: "POST",
  path: "/api/account/register",
  body: {},
  status: 400,
  code: "invalid_name",
  writes: 0,
});
assert.deepEqual(CLOSED_PUBLIC_POLICY_CONTRACT, {
  method: "POST",
  path: "/api/account/register",
  body: {},
  status: 503,
  code: "registration_unavailable",
  writes: 0,
});
assert.match(routeSource, /registration_unavailable/);
assert.doesNotMatch(routeSource, /parseRegistrationInput/);
assert.match(consentSource, /registrationMode === "closed"/);
assert.match(consentSource, /code: "registration_unavailable"[\s\S]*status: 503/);
assert.match(consentSource, /name\.length < 1[\s\S]*invalidRegistration\("invalid_name"\)/);

const releaseContract = await readReleaseContract(path.join(root, "release-identity.json"));
const expectedVersion = releaseContract.version;
const expectedReleaseIdentity = releaseIdentity(releaseContract);
const deploymentID = "immutable-v1515";
const scope = Object.freeze({
  level: "SERVICE",
  projectID: "project-fixture",
  environmentID: "environment-fixture",
  serviceID: "research-portal-fixture",
});
const controlledInput = "OPAQUE_CONTROLLED_INPUT";
const attemptGeneration = createOpaqueConfigGeneration(() => Buffer.alloc(24, 11));
const recoveryGeneration = createOpaqueConfigGeneration(() => Buffer.alloc(24, 13));
const entry = (key, value, entryScope = scope, updatedAt = 10) => ({ key, value, scope: entryScope, updatedAt });
const baseEntries = [
  entry(AUTH_CONFIG_KEYS.registrationMode, "closed"),
  entry(AUTH_CONFIG_KEYS.controlledEmail, controlledInput),
  entry(AUTH_CONFIG_KEYS.externalSearch, "false"),
  entry("UNRELATED_RUNTIME_SETTING", "OPAQUE_UNRELATED_VALUE"),
];

function target({ mode = "invite_only", email = "PRESENT", generation = attemptGeneration } = {}) {
  return Object.freeze({
    registrationMode: mode,
    controlledEmailPresence: email,
    controlledEmailValid: true,
    externalSearch: false,
    generation,
  });
}

function plannedEntries({
  entries = baseEntries,
  desired = target(),
  now = 100,
  revision = "revision-before",
} = {}) {
  return planAuthoritativeConfigReplace({
    entries,
    scope,
    expectedRevision: revision,
    updateRequestedAt: now,
    target: desired,
    controlledEmailValue: desired.controlledEmailPresence === "PRESENT" ? controlledInput : undefined,
  }).nextEntries;
}

function readback({
  entries,
  desired = target(),
  revision = "revision-after",
  at,
  requestedAt,
} = {}) {
  return readAuthoritativeDesiredConfig({
    entries,
    scope,
    revision,
    readbackAt: at,
    updateRequestedAt: requestedAt,
    target: desired,
  });
}

function runtime({
  readyAt = 400,
  logCursor = 40,
  deployment = deploymentID,
  cursorAdvanced = true,
  podIdentityCapability = CAPABILITY_NOT_AVAILABLE,
  podIdentity,
} = {}) {
  return {
    deploymentID: deployment,
    evidenceSource: DEPLOYMENT_BOUND_RUNTIME_LOGS,
    queryBinding: EXACT_DEPLOYMENT_QUERY,
    serverReady: true,
    readyAt,
    logCursor,
    cursorAdvanced,
    podIdentityCapability,
    podIdentity,
  };
}

function runtimePolicy({
  mode = "invite_only",
  emailPresent = true,
  generationPresent = true,
  generationMatches = true,
} = {}) {
  return {
    registrationMode: mode,
    controlledEmailKeyPresent: emailPresent,
    externalSearchDisabled: true,
    configGenerationPresent: generationPresent,
    configGenerationMatches: generationMatches,
    sensitiveValuesExposed: false,
  };
}

function publicPolicy({ registrationStatus = 400, registrationCode = "invalid_name" } = {}) {
  return {
    healthStatus: 200,
    healthVersion: expectedVersion,
    healthMode: "connected",
    releaseIdentity: expectedReleaseIdentity,
    cacheBust: true,
    requestNoCache: true,
    responseNoStore: true,
    projectsStatus: 401,
    registrationStatus,
    registrationCode,
  };
}

function createAttempt({ latch = createAuthE2eOneShotLatch(), now = 100, timeout = 1_000 } = {}) {
  const context = createAuthConfigConvergence({
    now,
    latch,
    deploymentID,
    expectedVersion,
    expectedReleaseIdentity,
    expectedGeneration: attemptGeneration,
    previousRuntimeReadyAt: 50,
    previousRuntimeLogCursor: 5,
    convergenceTimeoutMs: timeout,
  });
  acknowledgeAuthConfigUpdate(context, { now: now + 10, mutationAccepted: true });
  return { context, latch, requestedAt: now };
}

function stabilizeReadback(context, { entries, desired, requestedAt, firstAt = 120, secondAt = 130, revision = "revision-after" }) {
  const firstResult = observeAuthoritativeConfigReadback(context, {
    now: firstAt,
    readback: readback({ entries, desired, revision, at: firstAt, requestedAt }),
  });
  assert.equal(firstResult.outcome, "WAIT");
  const secondResult = observeAuthoritativeConfigReadback(context, {
    now: secondAt,
    readback: readback({ entries, desired, revision, at: secondAt, requestedAt }),
  });
  assert.equal(secondResult.context.state, "AUTHORITATIVE_READBACK_STABLE");
  return secondResult;
}

// 1-2. ACK alone is not convergence; old desired config may be observed and
// then replaced, but restart remains forbidden until two stable readbacks.
{
  const { context, requestedAt } = createAttempt();
  const unchanged = observeAuthoritativeConfigReadback(context, {
    now: 120,
    readback: readback({ entries: baseEntries, at: 120, requestedAt }),
  });
  assert.equal(unchanged.outcome, "WAIT");
  assert.equal(unchanged.errorCategory, "CONFIG_READBACK_NOT_FOUND");
  assert.throws(() => requestAuthRuntimeRestart(context, { now: 125 }), /RESTART_NOT_REQUESTED/);
  const applied = plannedEntries({ now: requestedAt });
  stabilizeReadback(context, { entries: applied, desired: target(), requestedAt, firstAt: 130, secondAt: 140 });
  requestAuthRuntimeRestart(context, { now: 150 });
  assert.equal(context.state, "RUNTIME_RESTART_REQUESTED");
}

// 3-6. Duplicate/scope/precedence/stale readbacks fail closed or remain
// blocked with an exact category before any restart can be requested.
{
  const { context, requestedAt } = createAttempt();
  const applied = plannedEntries({ now: requestedAt });
  const duplicate = readback({
    entries: [...applied, entry(AUTH_CONFIG_KEYS.registrationMode, "invite_only")],
    at: 120,
    requestedAt,
  });
  const failure = observeAuthoritativeConfigReadback(context, { now: 120, readback: duplicate });
  assert.equal(failure.outcome, "FAIL_CLOSED");
  assert.equal(failure.errorCategory, "CONFIG_DUPLICATE_KEY");
}
{
  const wrongScope = { ...scope, environmentID: "other-environment" };
  const { context, requestedAt } = createAttempt();
  const applied = plannedEntries({ now: requestedAt }).map((item) => item.key === AUTH_CONFIG_KEYS.registrationMode
    ? { ...item, scope: wrongScope }
    : item);
  const failure = observeAuthoritativeConfigReadback(context, {
    now: 120,
    readback: readback({ entries: applied, at: 120, requestedAt }),
  });
  assert.equal(failure.errorCategory, "CONFIG_SCOPE_MISMATCH");
}
{
  const sharedScope = { ...scope, level: "SHARED" };
  const { context, requestedAt } = createAttempt();
  const applied = plannedEntries({ now: requestedAt });
  const failure = observeAuthoritativeConfigReadback(context, {
    now: 120,
    readback: readback({
      entries: [...applied, entry(AUTH_CONFIG_KEYS.registrationMode, "closed", sharedScope)],
      at: 120,
      requestedAt,
    }),
  });
  assert.equal(failure.errorCategory, "CONFIG_SCOPE_MISMATCH");
}
{
  const { context, requestedAt } = createAttempt();
  const applied = plannedEntries({ now: requestedAt });
  const stale = observeAuthoritativeConfigReadback(context, {
    now: 120,
    readback: readback({ entries: applied, at: requestedAt, requestedAt }),
  });
  assert.equal(stale.errorCategory, "CONFIG_READBACK_STALE");
}

// 7. Two individually matching readbacks with different revisions are not a
// stable authoritative snapshot.
{
  const { context, requestedAt } = createAttempt();
  const applied = plannedEntries({ now: requestedAt });
  observeAuthoritativeConfigReadback(context, {
    now: 120,
    readback: readback({ entries: applied, revision: "revision-a", at: 120, requestedAt }),
  });
  const inconsistent = observeAuthoritativeConfigReadback(context, {
    now: 130,
    readback: readback({ entries: applied, revision: "revision-b", at: 130, requestedAt }),
  });
  assert.equal(inconsistent.outcome, "WAIT");
  assert.equal(inconsistent.errorCategory, "CONFIG_VALUE_NOT_REPLACED");
  assert.equal(context.authoritativeReadbackStableAt, null);
}

// 8. Restart before stable readback is prohibited by the consumer contract.
{
  const { context } = createAttempt();
  assert.throws(() => requestAuthRuntimeRestart(context, { now: 120 }), /RESTART_NOT_REQUESTED/);
}

function readyAttempt() {
  const attempt = createAttempt();
  const applied = plannedEntries({ now: attempt.requestedAt });
  stabilizeReadback(attempt.context, {
    entries: applied,
    desired: target(),
    requestedAt: attempt.requestedAt,
  });
  requestAuthRuntimeRestart(attempt.context, { now: 200 });
  return attempt;
}

// 9. A new ready runtime carrying the old generation remains blocked.
{
  const { context } = readyAttempt();
  const pending = reconcileAuthConfigConvergence(context, {
    now: 400,
    runtime: runtime(),
    runtimePolicy: runtimePolicy({ generationMatches: false }),
    publicPolicy: publicPolicy(),
  });
  assert.equal(pending.outcome, "WAIT");
  assert.equal(pending.errorCategory, "RUNTIME_GENERATION_MISMATCH");
  assert.equal(context.state, "POST_RESTART_RUNTIME_READY");
}

// 10-12. Generation, runtime mode and public policy are independent gates.
{
  const { context } = readyAttempt();
  const pending = reconcileAuthConfigConvergence(context, {
    now: 400,
    runtime: runtime(),
    runtimePolicy: runtimePolicy({ mode: "closed" }),
    publicPolicy: publicPolicy(),
  });
  assert.equal(pending.errorCategory, "RUNTIME_POLICY_NOT_APPLIED");
  assert.equal(context.state, "RUNTIME_GENERATION_MATCHED");
}
{
  const { context } = readyAttempt();
  const pending = reconcileAuthConfigConvergence(context, {
    now: 400,
    runtime: runtime(),
    runtimePolicy: runtimePolicy(),
    publicPolicy: publicPolicy({ registrationStatus: 503, registrationCode: "registration_unavailable" }),
  });
  assert.equal(pending.errorCategory, "PUBLIC_POLICY_NOT_APPLIED");
  assert.equal(context.state, "RUNTIME_POLICY_CONFIRMED");
}
{
  const { context } = readyAttempt();
  const pending = reconcileAuthConfigConvergence(context, {
    now: 400,
    runtime: runtime(),
    runtimePolicy: runtimePolicy({ generationMatches: false }),
    publicPolicy: publicPolicy(),
  });
  assert.equal(pending.errorCategory, "RUNTIME_GENERATION_MISMATCH");
  assert.equal(context.publicPolicyVerifiedAt, null);
}

// 13. The immutable deployment may stay the same when exact deployment-bound
// logs and the new opaque runtime generation both match.
const sharedLatch = createAuthE2eOneShotLatch();
const successfulAttempt = createAttempt({ latch: sharedLatch });
const appliedAttemptEntries = plannedEntries({ now: successfulAttempt.requestedAt });
stabilizeReadback(successfulAttempt.context, {
  entries: appliedAttemptEntries,
  desired: target(),
  requestedAt: successfulAttempt.requestedAt,
});
requestAuthRuntimeRestart(successfulAttempt.context, { now: 200 });
const attemptPass = reconcileAuthConfigConvergence(successfulAttempt.context, {
  now: 400,
  runtime: runtime(),
  runtimePolicy: runtimePolicy(),
  publicPolicy: publicPolicy(),
});
assert.equal(attemptPass.outcome, "PASS");
assert.equal(attemptPass.context.state, "CONFIG_CONVERGENCE_PROVEN");
assert.equal(markControlledEmailBridgeExecution(sharedLatch, { now: 410, convergence: successfulAttempt.context }), true);
assert.equal(markInvitationCreate(sharedLatch, { now: 420, convergence: successfulAttempt.context }), true);

// 14-15. Closed recovery atomically removes controlled Email, installs a new
// recovery generation, and converges through runtime/public closed policy.
const recoveryTarget = target({ mode: "closed", email: "ABSENT", generation: recoveryGeneration });
const recovery = createClosedRecoveryConvergence({
  now: 500,
  latch: sharedLatch,
  deploymentID,
  expectedVersion,
  expectedReleaseIdentity,
  expectedGeneration: recoveryGeneration,
  previousRuntimeReadyAt: 400,
  previousRuntimeLogCursor: 40,
  convergenceTimeoutMs: 1_000,
});
acknowledgeClosedConfigUpdate(recovery, { now: 510, mutationAccepted: true });
const recoveryEntries = plannedEntries({
  entries: appliedAttemptEntries,
  desired: recoveryTarget,
  now: 500,
  revision: "attempt-revision",
});
stabilizeReadback(recovery, {
  entries: recoveryEntries,
  desired: recoveryTarget,
  requestedAt: 500,
  firstAt: 520,
  secondAt: 530,
  revision: "recovery-revision",
});
requestClosedRecoveryRestart(recovery, { now: 540 });
const recoveryPass = reconcileClosedRecoveryConvergence(recovery, {
  now: 700,
  runtime: runtime({ readyAt: 700, logCursor: 70 }),
  runtimePolicy: runtimePolicy({ mode: "closed", emailPresent: false }),
  publicPolicy: publicPolicy({ registrationStatus: 503, registrationCode: "registration_unavailable" }),
});
assert.equal(recoveryPass.outcome, "PASS");
assert.equal(recoveryPass.context.state, "CONFIG_CONVERGENCE_PROVEN");

// 16. Removing the generation marker is a new CAS/readback/restart barrier;
// service configuration absence by itself is never sufficient.
const markerRemovalTarget = target({ mode: "closed", email: "ABSENT", generation: null });
const removal = createControlledEmailRemovalConvergence({
  recovery,
  now: 800,
  latch: sharedLatch,
  deploymentID,
  expectedVersion,
  expectedReleaseIdentity,
  previousRuntimeReadyAt: 700,
  previousRuntimeLogCursor: 70,
  convergenceTimeoutMs: 1_000,
});
acknowledgeControlledEmailRemoval(removal, { now: 810, mutationAccepted: true });
const removalEntries = plannedEntries({
  entries: recoveryEntries,
  desired: markerRemovalTarget,
  now: 800,
  revision: "recovery-revision",
});
stabilizeReadback(removal, {
  entries: removalEntries,
  desired: markerRemovalTarget,
  requestedAt: 800,
  firstAt: 820,
  secondAt: 830,
  revision: "marker-removed-revision",
});
requestControlledEmailRemovalRestart(removal, { now: 840 });
const removalPass = reconcileControlledEmailRemoval(removal, {
  now: 1_000,
  runtime: runtime({ readyAt: 1_000, logCursor: 100 }),
  runtimePolicy: runtimePolicy({
    mode: "closed",
    emailPresent: false,
    generationPresent: false,
    generationMatches: true,
  }),
  publicPolicy: publicPolicy({ registrationStatus: 503, registrationCode: "registration_unavailable" }),
});
assert.equal(removalPass.outcome, "PASS");

// 17. Timeout cannot unlock Bridge or invitation creation.
{
  const { context, latch, requestedAt } = createAttempt({ now: 2_000, timeout: 100 });
  const applied = plannedEntries({ now: requestedAt });
  stabilizeReadback(context, {
    entries: applied,
    desired: target(),
    requestedAt,
    firstAt: 2_020,
    secondAt: 2_030,
  });
  requestAuthRuntimeRestart(context, { now: 2_040 });
  const timeout = reconcileAuthConfigConvergence(context, { now: 2_140 });
  assert.equal(timeout.outcome, "FAIL_CLOSED");
  assert.equal(timeout.errorCategory, "CONFIG_CONVERGENCE_TIMEOUT");
  assert.throws(() => markControlledEmailBridgeExecution(latch, { now: 2_150, convergence: context }), /BRIDGE_BEFORE_CONFIG_CONVERGENCE/);
  assert.throws(() => markInvitationCreate(latch, { now: 2_150, convergence: context }), /INVITE_CREATE_BEFORE_CONFIG_CONVERGENCE/);
}

// 18. Mutation, restart, Bridge and invitation creation are one-shot.
assert.throws(
  () => createAuthConfigConvergence({
    now: 1_100,
    latch: sharedLatch,
    deploymentID,
    expectedVersion,
    expectedReleaseIdentity,
    expectedGeneration: attemptGeneration,
  }),
  /DUPLICATE_ATTEMPT_CONFIG_MUTATION_REQUEST/,
);
assert.throws(
  () => markControlledEmailBridgeExecution(sharedLatch, { now: 1_110, convergence: successfulAttempt.context }),
  /DUPLICATE_BRIDGE_REQUEST/,
);
assert.throws(
  () => markInvitationCreate(sharedLatch, { now: 1_120, convergence: successfulAttempt.context }),
  /DUPLICATE_INVITE_CREATE_REQUEST/,
);

// 19. Provider/consumer contract sources carry no test mailbox, URL token or
// connection string fixture. Runtime evidence is explicitly redacted.
for (const source of [contractSource, providerSource]) {
  assert.doesNotMatch(source, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  assert.doesNotMatch(source, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(source, /https?:\/\/[^\s"']*token/iu);
}
assert.ok(successfulAttempt.context.history.every((item, index) => Object.isFrozen(item) && item.sequence === index + 1));

console.log("AUTH_CONFIG_CONVERGENCE_CONTRACT=PASS");
console.log("AUTHORITATIVE_CONFIG_READBACK_CONTRACT=PASS");
console.log("CONFIG_SCOPE_CARDINALITY_CONTRACT=PASS");
console.log("RUNTIME_GENERATION_BINDING=PASS");
console.log("SAME_DEPLOYMENT_NEW_RUNTIME_GENERATION=PASS");
console.log("INVITE_ONLY_CONVERGENCE_CONTRACT=PASS");
console.log("CLOSED_RECOVERY_CONVERGENCE=PASS");
console.log("CONTROLLED_EMAIL_REMOVAL_CONVERGENCE=PASS");
console.log("GENERATION_MARKER_REMOVAL_CONVERGENCE=PASS");
console.log("NEGATIVE_FIXTURES=PASS");
console.log("ONE_SHOT_OPERATIONS=PASS");
console.log("AUTOMATIC_RETRY_BLOCKED=PASS");
console.log("SENSITIVE_OUTPUT_SCAN=PASS");
