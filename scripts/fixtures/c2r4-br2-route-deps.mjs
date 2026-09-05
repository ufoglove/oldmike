const state = {
  authenticated: true,
  runs: new Map(),
  repositoryBoundaryCalls: 0,
};

export function resetBr2RouteFixture() {
  state.authenticated = true;
  state.runs.clear();
  state.repositoryBoundaryCalls = 0;
}

export function setBr2Authenticated(value) {
  state.authenticated = value === true;
}

export function br2RouteFixtureSnapshot() {
  return { authenticated: state.authenticated, retainedRuns: state.runs.size, repositoryBoundaryCalls: state.repositoryBoundaryCalls };
}

export function originAllowed() { return true; }
export async function guardSensitiveAuthRateLimit() { return null; }

export async function requireAuthenticatedUser() {
  if (!state.authenticated) return { ok: false, response: Response.json({ ok: false, code: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  return { ok: true, session: { user: { id: "fixture-user" } }, policy: { status: "ACTIVE", mustChangePassword: false } };
}

export class ResearchStorageUnavailable extends Error {}
export async function resolveResearchTenant(userId, projectId) {
  return userId === "fixture-user" && projectId === "fixture-project"
    ? { userId, workspaceId: "fixture-workspace", projectId, role: "owner" }
    : null;
}

export class TopicLabStorageUnavailable extends Error {}
export class TopicLabRepositoryError extends Error {
  constructor(code, status = 409) { super(code); this.name = "TopicLabRepositoryError"; this.code = code; this.status = status; }
}

export async function findTopicLabRunByIdempotency(_tenant, idempotencyKey) {
  return state.runs.get(idempotencyKey) ?? null;
}

export async function getLatestTopicLabRun() {
  return [...state.runs.values()].at(-1) ?? null;
}

export async function saveTopicLabAnalysis(input) {
  state.repositoryBoundaryCalls += 1;
  const prior = state.runs.get(input.request.idempotencyKey);
  if (prior) {
    if (prior.inputHash !== input.analysis.inputHash || prior.resultHash !== input.analysis.resultHash) throw new TopicLabRepositoryError("idempotency_payload_conflict");
    return { ...prior, idempotent: true };
  }
  const stored = {
    id: "fixture-topic-run",
    versionNumber: 1,
    inputHash: input.analysis.inputHash,
    resultHash: input.analysis.resultHash,
    resultPayload: input.analysis,
    idempotencyKey: input.request.idempotencyKey,
    idempotent: false,
  };
  state.runs.set(input.request.idempotencyKey, stored);
  return stored;
}

export async function approveTopicLabCandidate() { throw new TopicLabRepositoryError("fixture_operation_not_allowed", 422); }
export async function promoteTopicLabCandidate() { throw new TopicLabRepositoryError("fixture_operation_not_allowed", 422); }
