import { randomBytes } from "node:crypto";

export const AUTHORITATIVE_CONFIG_PROVIDER_CONTRACT_VERSION = "1.5.13";

export const AUTH_CONFIG_KEYS = Object.freeze({
  registrationMode: "REGISTRATION_MODE",
  controlledEmail: "AUTH_E2E_CONTROLLED_EMAIL",
  externalSearch: "OPENCLAW_EXTERNAL_SEARCH",
  generation: "AUTH_E2E_CONFIG_GENERATION",
});

export const CONFIG_ERROR_CATEGORIES = Object.freeze([
  "CONFIG_MUTATION_REJECTED",
  "CONFIG_READBACK_NOT_FOUND",
  "CONFIG_READBACK_STALE",
  "CONFIG_SCOPE_MISMATCH",
  "CONFIG_DUPLICATE_KEY",
  "CONFIG_VALUE_NOT_REPLACED",
  "CONFIG_GENERATION_MISMATCH",
  "RESTART_NOT_REQUESTED",
  "POST_RESTART_RUNTIME_NOT_READY",
  "RUNTIME_GENERATION_MISMATCH",
  "RUNTIME_POLICY_NOT_APPLIED",
  "PUBLIC_POLICY_NOT_APPLIED",
  "CONFIG_CONVERGENCE_TIMEOUT",
]);

const TARGET_KEYS = Object.freeze(Object.values(AUTH_CONFIG_KEYS));
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{32,64}$/u;

function assertTimestamp(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_${label}`);
}

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`INVALID_${label}`);
}

function assertScope(scope) {
  if (!scope || scope.level !== "SERVICE") throw new Error("CONFIG_SCOPE_MISMATCH");
  for (const key of ["projectID", "environmentID", "serviceID"]) {
    assertNonEmpty(scope[key], `CONFIG_SCOPE_${key.toUpperCase()}`);
  }
}

function sameScope(left, right) {
  return left?.level === "SERVICE" &&
    right?.level === "SERVICE" &&
    left.projectID === right.projectID &&
    left.environmentID === right.environmentID &&
    left.serviceID === right.serviceID;
}

function exactEntries(entries, scope, key) {
  return entries.filter((entry) => entry?.key === key && sameScope(entry.scope, scope));
}

function foreignTargetEntries(entries, scope) {
  return entries.filter((entry) => TARGET_KEYS.includes(entry?.key) && !sameScope(entry.scope, scope));
}

function classifyCardinality(entries, scope, expected) {
  const counts = Object.fromEntries(TARGET_KEYS.map((key) => [key, exactEntries(entries, scope, key).length]));
  if (foreignTargetEntries(entries, scope).length > 0) {
    return { pass: false, errorCategory: "CONFIG_SCOPE_MISMATCH", counts };
  }
  if (Object.values(counts).some((count) => count > 1)) {
    return { pass: false, errorCategory: "CONFIG_DUPLICATE_KEY", counts };
  }
  for (const [key, count] of Object.entries(expected)) {
    if (counts[key] !== count) {
      return { pass: false, errorCategory: "CONFIG_READBACK_NOT_FOUND", counts };
    }
  }
  return { pass: true, errorCategory: null, counts };
}

function assertTarget(target) {
  if (!target || !["closed", "invite_only"].includes(target.registrationMode)) {
    throw new Error("CONFIG_VALUE_NOT_REPLACED");
  }
  if (!['PRESENT', 'ABSENT'].includes(target.controlledEmailPresence)) {
    throw new Error("CONFIG_VALUE_NOT_REPLACED");
  }
  if (target.externalSearch !== false) throw new Error("CONFIG_VALUE_NOT_REPLACED");
  if (target.generation !== null && !GENERATION_PATTERN.test(target.generation ?? "")) {
    throw new Error("CONFIG_GENERATION_MISMATCH");
  }
  if (target.controlledEmailPresence === "PRESENT" && target.controlledEmailValid !== true) {
    throw new Error("CONFIG_VALUE_NOT_REPLACED");
  }
}

export function createOpaqueConfigGeneration(source = randomBytes) {
  const marker = source(24).toString("base64url");
  if (!GENERATION_PATTERN.test(marker)) throw new Error("CONFIG_GENERATION_MISMATCH");
  return marker;
}

export function inspectAuthoritativeConfigScope({ entries, scope } = {}) {
  if (!Array.isArray(entries)) throw new Error("CONFIG_READBACK_NOT_FOUND");
  assertScope(scope);
  const expected = {
    [AUTH_CONFIG_KEYS.registrationMode]: 1,
    [AUTH_CONFIG_KEYS.externalSearch]: 1,
  };
  const cardinality = classifyCardinality(entries, scope, expected);
  if (!cardinality.pass) return Object.freeze(cardinality);
  return Object.freeze({
    pass: true,
    errorCategory: null,
    cardinality: Object.freeze({ ...cardinality.counts }),
    scope: "EXACT_SERVICE_SCOPE",
  });
}

export function planAuthoritativeConfigReplace({
  entries,
  scope,
  expectedRevision,
  updateRequestedAt,
  target,
  controlledEmailValue,
} = {}) {
  if (!Array.isArray(entries)) throw new Error("CONFIG_READBACK_NOT_FOUND");
  assertScope(scope);
  assertNonEmpty(expectedRevision, "CONFIG_REVISION");
  assertTimestamp(updateRequestedAt, "CONFIG_UPDATE_REQUESTED_AT");
  assertTarget(target);

  const scopeInspection = inspectAuthoritativeConfigScope({ entries, scope });
  if (!scopeInspection.pass) throw new Error(scopeInspection.errorCategory);
  for (const key of [AUTH_CONFIG_KEYS.controlledEmail, AUTH_CONFIG_KEYS.generation]) {
    if (exactEntries(entries, scope, key).length > 1) throw new Error("CONFIG_DUPLICATE_KEY");
  }
  if (target.controlledEmailPresence === "PRESENT") {
    assertNonEmpty(controlledEmailValue, "CONTROLLED_EMAIL_INPUT");
  }

  const unrelatedEntries = entries.filter(
    (entry) => !TARGET_KEYS.includes(entry?.key) || !sameScope(entry.scope, scope),
  );
  const nextEntries = [...unrelatedEntries];
  const add = (key, value) => nextEntries.push(Object.freeze({
    key,
    value,
    scope: Object.freeze({ ...scope }),
    updatedAt: updateRequestedAt,
  }));
  add(AUTH_CONFIG_KEYS.registrationMode, target.registrationMode);
  add(AUTH_CONFIG_KEYS.externalSearch, "false");
  if (target.controlledEmailPresence === "PRESENT") {
    add(AUTH_CONFIG_KEYS.controlledEmail, controlledEmailValue);
  }
  if (target.generation !== null) add(AUTH_CONFIG_KEYS.generation, target.generation);

  return Object.freeze({
    operation: "COMPARE_AND_SWAP_REPLACE",
    scope: "EXACT_SERVICE_SCOPE",
    expectedRevision,
    updateRequestedAt,
    targetKeyCount: nextEntries.filter((entry) => TARGET_KEYS.includes(entry.key)).length,
    preservedUnrelatedCount: unrelatedEntries.length,
    nextEntries: Object.freeze(nextEntries),
    outputPolicy: "REDACTED_TARGET_VALUES",
  });
}

function matchedEntry(entries, scope, key) {
  return exactEntries(entries, scope, key)[0] ?? null;
}

function safeSnapshot({
  revision,
  readbackAt,
  target,
  cardinality,
  registrationMode,
  controlledEmailPresent,
  externalSearchDisabled,
  generationPresent,
  generationMatches,
}) {
  const stabilityKey = JSON.stringify({
    revision,
    registrationMode,
    controlledEmailPresent,
    externalSearchDisabled,
    generationPresent,
    generationMatches,
    cardinality,
  });
  return Object.freeze({
    matched: true,
    errorCategory: null,
    readbackAt,
    revision,
    registrationMode,
    controlledEmailPresent,
    externalSearchDisabled,
    generationPresent,
    generationMatches,
    targetModeMatches: registrationMode === target.registrationMode,
    cardinality: Object.freeze({ ...cardinality }),
    scope: "EXACT_SERVICE_SCOPE",
    stabilityKey,
    sensitiveValuesExposed: false,
  });
}

export function readAuthoritativeDesiredConfig({
  entries,
  scope,
  revision,
  readbackAt,
  updateRequestedAt,
  target,
} = {}) {
  if (!Array.isArray(entries)) {
    return Object.freeze({ matched: false, errorCategory: "CONFIG_READBACK_NOT_FOUND" });
  }
  assertScope(scope);
  assertTarget(target);
  assertNonEmpty(revision, "CONFIG_REVISION");
  assertTimestamp(readbackAt, "CONFIG_READBACK_AT");
  assertTimestamp(updateRequestedAt, "CONFIG_UPDATE_REQUESTED_AT");
  if (readbackAt <= updateRequestedAt) {
    return Object.freeze({ matched: false, errorCategory: "CONFIG_READBACK_STALE", readbackAt });
  }

  const expected = {
    [AUTH_CONFIG_KEYS.registrationMode]: 1,
    [AUTH_CONFIG_KEYS.controlledEmail]: target.controlledEmailPresence === "PRESENT" ? 1 : 0,
    [AUTH_CONFIG_KEYS.externalSearch]: 1,
    [AUTH_CONFIG_KEYS.generation]: target.generation === null ? 0 : 1,
  };
  const cardinality = classifyCardinality(entries, scope, expected);
  if (!cardinality.pass) {
    return Object.freeze({ matched: false, errorCategory: cardinality.errorCategory, readbackAt });
  }

  const registrationMode = matchedEntry(entries, scope, AUTH_CONFIG_KEYS.registrationMode)?.value;
  const controlledEmailPresent = Boolean(matchedEntry(entries, scope, AUTH_CONFIG_KEYS.controlledEmail));
  const externalSearchDisabled = matchedEntry(entries, scope, AUTH_CONFIG_KEYS.externalSearch)?.value === "false";
  const generationEntry = matchedEntry(entries, scope, AUTH_CONFIG_KEYS.generation);
  const generationPresent = Boolean(generationEntry);
  const generationMatches = target.generation === null
    ? !generationPresent
    : generationEntry?.value === target.generation;

  if (!generationMatches) {
    return Object.freeze({ matched: false, errorCategory: "CONFIG_GENERATION_MISMATCH", readbackAt });
  }
  if (
    registrationMode !== target.registrationMode ||
    controlledEmailPresent !== (target.controlledEmailPresence === "PRESENT") ||
    !externalSearchDisabled
  ) {
    return Object.freeze({ matched: false, errorCategory: "CONFIG_VALUE_NOT_REPLACED", readbackAt });
  }
  return safeSnapshot({
    revision,
    readbackAt,
    target,
    cardinality: cardinality.counts,
    registrationMode,
    controlledEmailPresent,
    externalSearchDisabled,
    generationPresent,
    generationMatches,
  });
}

export function stableAuthoritativeReadbacks(first, second) {
  if (!first?.matched || !second?.matched) return false;
  return second.readbackAt > first.readbackAt &&
    second.stabilityKey === first.stabilityKey &&
    second.sensitiveValuesExposed === false &&
    first.sensitiveValuesExposed === false;
}
