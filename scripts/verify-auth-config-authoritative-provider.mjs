import assert from "node:assert/strict";
import {
  AUTHORITATIVE_CONFIG_PROVIDER_CONTRACT_VERSION,
  AUTH_CONFIG_KEYS,
  createOpaqueConfigGeneration,
  inspectAuthoritativeConfigScope,
  planAuthoritativeConfigReplace,
  readAuthoritativeDesiredConfig,
  stableAuthoritativeReadbacks,
} from "./auth-config-authoritative-provider.mjs";

assert.equal(AUTHORITATIVE_CONFIG_PROVIDER_CONTRACT_VERSION, "1.5.13");

const scope = Object.freeze({
  level: "SERVICE",
  projectID: "project-fixture",
  environmentID: "environment-fixture",
  serviceID: "research-portal-fixture",
});
const otherScope = Object.freeze({
  level: "SERVICE",
  projectID: "project-fixture",
  environmentID: "other-environment",
  serviceID: "research-portal-fixture",
});
const sharedScope = Object.freeze({
  level: "SHARED",
  projectID: "project-fixture",
  environmentID: "environment-fixture",
  serviceID: "research-portal-fixture",
});
const entry = (key, value, entryScope = scope, updatedAt = 10) => ({
  key,
  value,
  scope: entryScope,
  updatedAt,
});
const controlledInput = "OPAQUE_CONTROLLED_INPUT";
const generation = createOpaqueConfigGeneration(() => Buffer.alloc(24, 7));
const target = Object.freeze({
  registrationMode: "invite_only",
  controlledEmailPresence: "PRESENT",
  controlledEmailValid: true,
  externalSearch: false,
  generation,
});
const base = [
  entry(AUTH_CONFIG_KEYS.registrationMode, "closed"),
  entry(AUTH_CONFIG_KEYS.controlledEmail, controlledInput),
  entry(AUTH_CONFIG_KEYS.externalSearch, "false"),
  entry("UNRELATED_RUNTIME_SETTING", "OPAQUE_UNRELATED_VALUE"),
];

const scopeInspection = inspectAuthoritativeConfigScope({ entries: base, scope });
assert.equal(scopeInspection.pass, true);
assert.equal(scopeInspection.scope, "EXACT_SERVICE_SCOPE");

const plan = planAuthoritativeConfigReplace({
  entries: base,
  scope,
  expectedRevision: "revision-before-update",
  updateRequestedAt: 100,
  target,
  controlledEmailValue: controlledInput,
});
assert.equal(plan.operation, "COMPARE_AND_SWAP_REPLACE");
assert.equal(plan.preservedUnrelatedCount, 1);
assert.equal(plan.nextEntries.filter((item) => item.key === AUTH_CONFIG_KEYS.registrationMode).length, 1);
assert.equal(plan.nextEntries.filter((item) => item.key === AUTH_CONFIG_KEYS.controlledEmail).length, 1);
assert.equal(plan.nextEntries.filter((item) => item.key === AUTH_CONFIG_KEYS.generation).length, 1);
assert.equal(plan.nextEntries.find((item) => item.key === "UNRELATED_RUNTIME_SETTING")?.value, "OPAQUE_UNRELATED_VALUE");

// ACK is not convergence: an authoritative readback with the old value is a
// value-not-replaced result even when the API accepted the request.
const oldReadback = readAuthoritativeDesiredConfig({
  entries: base,
  scope,
  revision: "revision-before-update",
  readbackAt: 110,
  updateRequestedAt: 100,
  target,
});
assert.equal(oldReadback.matched, false);
assert.equal(oldReadback.errorCategory, "CONFIG_READBACK_NOT_FOUND");

const appliedEntries = plan.nextEntries.map((item) => ({ ...item, updatedAt: 120 }));
const first = readAuthoritativeDesiredConfig({
  entries: appliedEntries,
  scope,
  revision: "revision-after-update",
  readbackAt: 120,
  updateRequestedAt: 100,
  target,
});
const second = readAuthoritativeDesiredConfig({
  entries: appliedEntries,
  scope,
  revision: "revision-after-update",
  readbackAt: 130,
  updateRequestedAt: 100,
  target,
});
assert.equal(first.matched, true);
assert.equal(first.sensitiveValuesExposed, false);
assert.equal(stableAuthoritativeReadbacks(first, second), true);

const stale = readAuthoritativeDesiredConfig({
  entries: appliedEntries,
  scope,
  revision: "revision-after-update",
  readbackAt: 100,
  updateRequestedAt: 100,
  target,
});
assert.equal(stale.errorCategory, "CONFIG_READBACK_STALE");

const duplicateRegistration = readAuthoritativeDesiredConfig({
  entries: [...appliedEntries, entry(AUTH_CONFIG_KEYS.registrationMode, "invite_only")],
  scope,
  revision: "revision-duplicate",
  readbackAt: 130,
  updateRequestedAt: 100,
  target,
});
assert.equal(duplicateRegistration.errorCategory, "CONFIG_DUPLICATE_KEY");

const wrongScope = readAuthoritativeDesiredConfig({
  entries: appliedEntries.map((item) => item.key === AUTH_CONFIG_KEYS.registrationMode
    ? { ...item, scope: otherScope }
    : item),
  scope,
  revision: "revision-wrong-scope",
  readbackAt: 130,
  updateRequestedAt: 100,
  target,
});
assert.equal(wrongScope.errorCategory, "CONFIG_SCOPE_MISMATCH");

const sharedPrecedence = readAuthoritativeDesiredConfig({
  entries: [...appliedEntries, entry(AUTH_CONFIG_KEYS.registrationMode, "closed", sharedScope)],
  scope,
  revision: "revision-shared-scope",
  readbackAt: 130,
  updateRequestedAt: 100,
  target,
});
assert.equal(sharedPrecedence.errorCategory, "CONFIG_SCOPE_MISMATCH");

const inconsistent = readAuthoritativeDesiredConfig({
  entries: appliedEntries,
  scope,
  revision: "revision-changed-between-readbacks",
  readbackAt: 140,
  updateRequestedAt: 100,
  target,
});
assert.equal(stableAuthoritativeReadbacks(second, inconsistent), false);

const recoveryTarget = Object.freeze({
  registrationMode: "closed",
  controlledEmailPresence: "ABSENT",
  controlledEmailValid: true,
  externalSearch: false,
  generation: createOpaqueConfigGeneration(() => Buffer.alloc(24, 9)),
});
const recoveryPlan = planAuthoritativeConfigReplace({
  entries: appliedEntries,
  scope,
  expectedRevision: "revision-after-update",
  updateRequestedAt: 200,
  target: recoveryTarget,
});
assert.equal(recoveryPlan.nextEntries.some((item) => item.key === AUTH_CONFIG_KEYS.controlledEmail), false);
assert.equal(recoveryPlan.nextEntries.filter((item) => item.key === AUTH_CONFIG_KEYS.registrationMode).length, 1);
assert.equal(recoveryPlan.nextEntries.find((item) => item.key === "UNRELATED_RUNTIME_SETTING")?.value, "OPAQUE_UNRELATED_VALUE");

console.log("AUTHORITATIVE_CONFIG_PROVIDER=PASS");
console.log("CONFIG_SCOPE_CARDINALITY_CONTRACT=PASS");
console.log("COMPARE_AND_SWAP_REPLACE=PASS");
console.log("UNRELATED_CONFIGURATION_PRESERVED=PASS");
console.log("ACK_WITHOUT_VALUE_CHANGE_REJECTED=PASS");
console.log("STALE_READBACK_REJECTED=PASS");
console.log("DUPLICATE_KEY_REJECTED=PASS");
console.log("WRONG_SCOPE_REJECTED=PASS");
console.log("SHARED_SCOPE_PRECEDENCE_REJECTED=PASS");
console.log("TWO_STABLE_READBACKS_REQUIRED=PASS");
console.log("SENSITIVE_VALUES_EXPOSED=NO");
