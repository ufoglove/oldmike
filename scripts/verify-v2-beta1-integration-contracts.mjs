import assert from "node:assert/strict";

const originalEnvironment = { ...process.env };
Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
});

const [{ createV2Beta1RouteHandlers }, contracts, runtime] = await Promise.all([
  import("../lib/v2-beta1/route-handlers.ts"),
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
]);

const origin = "http://127.0.0.1:43101";
const goodHeaders = { "content-type": "application/json", origin, "x-old-mike-v2-workspace": "fixture-workspace-v2" };
const scenarios = [];
const checked = async (name, callback) => {
  await callback();
  scenarios.push(name);
};

function exactKeys(value, expected, label) {
  assert.equal(Boolean(value) && typeof value === "object" && !Array.isArray(value), true, `${label}_record`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_exact_keys`);
}

async function body(response, expectedKeys) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  const value = await response.json();
  if (expectedKeys) exactKeys(value, expectedKeys, `http_${response.status}`);
  return value;
}

function request(method, payload, headers = goodHeaders) {
  return new Request(`${origin}/api/v2-beta1/project`, { method, headers, ...(payload === undefined ? {} : { body: typeof payload === "string" ? payload : JSON.stringify(payload) }) });
}

const coordinator = runtime.createV2Beta1Coordinator();
const handlers = createV2Beta1RouteHandlers({ coordinator, previewInsight: runtime.createSyntheticBeta1Insight });
const successGetKeys = ["ok", "contractVersion", "trustClass", "snapshot", "previewInsight", "effectSubmissionCount", "liveProviderCallCount", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount"];
const successPostKeys = ["ok", "contractVersion", "trustClass", "generatedArtifactHash", "snapshot", "replayed", "effectSubmissionCount", "liveProviderCallCount", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount"];

const getResponse = await handlers.GET(request("GET"));
assert.equal(getResponse.status, 200);
const initial = await body(getResponse, successGetKeys);
assert.equal(initial.effectSubmissionCount, 0);
assert.equal(initial.liveProviderCallCount, 0);
const insight = initial.previewInsight;
const importRequest = {
  contractVersion: contracts.V2_BETA1_CONTRACT_VERSION,
  operation: contracts.V2_BETA1_OPERATION,
  requestId: "beta1-import:matrix-0001",
  idempotencyKey: "beta1-import-key:matrix-0001",
  projectId: initial.snapshot.projectId,
  baseRevision: initial.snapshot.revision,
  baseContentHash: initial.snapshot.contentHash,
  insight,
};

await checked("INITIAL_GET_200", async () => {
  assert.equal(initial.snapshot.revision, 1);
  assert.equal(initial.snapshot.timeline.length, 0);
});

let imported;
await checked("FIRST_IMPORT_200", async () => {
  const response = await handlers.POST(request("POST", importRequest));
  assert.equal(response.status, 200);
  imported = await body(response, successPostKeys);
  assert.equal(imported.replayed, false);
  assert.equal(imported.effectSubmissionCount, 1);
  assert.equal(imported.liveProviderCallCount, 0);
  assert.equal(imported.snapshot.revision, 2);
  assert.equal(imported.snapshot.timeline.length, 1);
});

await checked("EXACT_REPLAY_ZERO_SECOND_EFFECT", async () => {
  const response = await handlers.POST(request("POST", importRequest));
  assert.equal(response.status, 200);
  const replayed = await body(response, successPostKeys);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.effectSubmissionCount, 0);
  assert.deepEqual(replayed.snapshot, imported.snapshot);
});

await checked("IDEMPOTENCY_CONFLICT_409", async () => {
  const response = await handlers.POST(request("POST", { ...importRequest, insight: runtime.createSyntheticBeta1Insight("同一操作識別不可改送不同洞見。") }));
  assert.equal(response.status, 409);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_idempotency_conflict" });
});

await checked("STALE_REVISION_409", async () => {
  const response = await handlers.POST(request("POST", { ...importRequest, requestId: "beta1-import:matrix-stale-revision", idempotencyKey: "beta1-import-key:matrix-stale-revision" }));
  assert.equal(response.status, 409);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_stale_revision" });
});

await checked("STALE_CONTENT_HASH_409", async () => {
  const response = await handlers.POST(request("POST", { ...importRequest, requestId: "beta1-import:matrix-stale-hash", idempotencyKey: "beta1-import-key:matrix-stale-hash", baseRevision: 2, baseContentHash: "0".repeat(64) }));
  assert.equal(response.status, 409);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_stale_content_hash" });
});

await checked("CONCURRENT_STATE_CONFLICT_409", async () => {
  const conflictHandlers = createV2Beta1RouteHandlers({ coordinator: { getSnapshot: () => initial.snapshot, importInsight: async () => { throw new Error("beta1_concurrent_state_conflict"); } }, previewInsight: () => insight });
  const response = await conflictHandlers.POST(request("POST", importRequest));
  assert.equal(response.status, 409);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_concurrent_state_conflict" });
});

await checked("COMPLETION_UNKNOWN_503_NO_RESEND", async () => {
  let submissions = 0;
  const unknownCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { submissions += 1; return "UNKNOWN"; } });
  const unknownHandlers = createV2Beta1RouteHandlers({ coordinator: unknownCoordinator, previewInsight: () => insight });
  const unknownInitial = await body(await unknownHandlers.GET(request("GET")), successGetKeys);
  const unknownRequest = runtime.createV2Beta1ImportRequest(unknownInitial.snapshot, insight, "unknown-0001");
  for (let index = 0; index < 2; index += 1) {
    const response = await unknownHandlers.POST(request("POST", unknownRequest));
    assert.equal(response.status, 503);
    assert.deepEqual(await body(response, ["ok", "code", "completionClass", "generatedArtifactHash"]), { ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null });
  }
  assert.equal(submissions, 1);
  const preserved = await body(await unknownHandlers.GET(request("GET")), successGetKeys);
  assert.equal(preserved.snapshot.revision, 2);
  assert.equal(preserved.snapshot.timeline.length, 1);
  assert.equal(preserved.snapshot.timeline[0].completionClass, "UNKNOWN");
});

await checked("COMPLETION_UNKNOWN_NEW_KEY_LINEAGE_FENCED", async () => {
  let submissions = 0;
  const unknownCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { submissions += 1; return "UNKNOWN"; } });
  const unknownHandlers = createV2Beta1RouteHandlers({ coordinator: unknownCoordinator, previewInsight: () => insight });
  const firstSnapshot = (await body(await unknownHandlers.GET(request("GET")), successGetKeys)).snapshot;
  const firstRequest = runtime.createV2Beta1ImportRequest(firstSnapshot, insight, "lineage-first");
  const firstResponse = await unknownHandlers.POST(request("POST", firstRequest));
  assert.equal(firstResponse.status, 503);
  const unresolved = (await body(await unknownHandlers.GET(request("GET")), successGetKeys)).snapshot;
  const beforeRetry = structuredClone(unresolved);
  const newKeyRequest = runtime.createV2Beta1ImportRequest(unresolved, insight, "lineage-new-key");
  const fenced = await unknownHandlers.POST(request("POST", newKeyRequest));
  assert.equal(fenced.status, 503);
  assert.deepEqual(await body(fenced, ["ok", "code", "completionClass", "generatedArtifactHash"]), { ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null });
  assert.equal(submissions, 1);
  const afterFence = (await body(await unknownHandlers.GET(request("GET")), successGetKeys)).snapshot;
  assert.deepEqual(afterFence, beforeRetry);
  assert.equal(afterFence.revision, 2);
  assert.equal(afterFence.timeline.length, 1);
  assert.equal(afterFence.effectReceipts.length, 1);
});

await checked("COMPLETION_UNKNOWN_TWO_KEY_CONCURRENCY_FENCED", async () => {
  let submissions = 0;
  let enterSubmission;
  let releaseSubmission;
  const submissionEntered = new Promise((resolve) => { enterSubmission = resolve; });
  const submissionRelease = new Promise((resolve) => { releaseSubmission = resolve; });
  const concurrentCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => {
    submissions += 1;
    enterSubmission();
    await submissionRelease;
    return "UNKNOWN";
  } });
  const concurrentHandlers = createV2Beta1RouteHandlers({ coordinator: concurrentCoordinator, previewInsight: () => insight });
  const startingSnapshot = (await body(await concurrentHandlers.GET(request("GET")), successGetKeys)).snapshot;
  const firstRequest = runtime.createV2Beta1ImportRequest(startingSnapshot, insight, "lineage-race-first");
  const secondRequest = runtime.createV2Beta1ImportRequest(startingSnapshot, insight, "lineage-race-second");
  const firstResponsePromise = concurrentHandlers.POST(request("POST", firstRequest));
  await submissionEntered;
  const secondResponsePromise = concurrentHandlers.POST(request("POST", secondRequest));
  await new Promise((resolve) => setImmediate(resolve));
  releaseSubmission();
  const [firstResponse, secondResponse] = await Promise.all([firstResponsePromise, secondResponsePromise]);
  assert.equal(firstResponse.status, 503);
  assert.equal(secondResponse.status, 503);
  assert.deepEqual(await body(firstResponse, ["ok", "code", "completionClass", "generatedArtifactHash"]), { ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null });
  assert.deepEqual(await body(secondResponse, ["ok", "code", "completionClass", "generatedArtifactHash"]), { ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null });
  assert.equal(submissions, 1);
  const finalSnapshot = (await body(await concurrentHandlers.GET(request("GET")), successGetKeys)).snapshot;
  assert.equal(finalSnapshot.revision, 2);
  assert.equal(finalSnapshot.timeline.length, 1);
  assert.equal(finalSnapshot.effectReceipts.length, 1);
});

await checked("WRONG_TENANT_GET_POST_STATE_PRESERVED", async () => {
  const wrongHeaders = { ...goodHeaders, "x-old-mike-v2-workspace": "other-workspace" };
  const wrongGet = await handlers.GET(request("GET", undefined, wrongHeaders));
  assert.equal(wrongGet.status, 404);
  assert.deepEqual(await body(wrongGet, ["ok", "code"]), { ok: false, code: "workspace_not_found" });
  const wrongPost = await handlers.POST(request("POST", importRequest, wrongHeaders));
  assert.equal(wrongPost.status, 404);
  assert.deepEqual(await body(wrongPost, ["ok", "code"]), { ok: false, code: "workspace_not_found" });
  const current = await body(await handlers.GET(request("GET")), successGetKeys);
  assert.equal(current.snapshot.revision, 2);
  assert.equal(current.snapshot.timeline.length, 1);
});

await checked("INVALID_ORIGIN_403", async () => {
  const response = await handlers.POST(request("POST", importRequest, { ...goodHeaders, origin: "http://127.0.0.1:9" }));
  assert.equal(response.status, 403);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "origin_rejected" });
});

await checked("INVALID_JSON_400", async () => {
  const response = await handlers.POST(request("POST", "{invalid"));
  assert.equal(response.status, 400);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_request_invalid" });
});

await checked("OVERSIZED_BODY_413", async () => {
  const response = await handlers.POST(request("POST", "{}", { ...goodHeaders, "content-length": String(contracts.V2_BETA1_REQUEST_MAX_BYTES + 1) }));
  assert.equal(response.status, 413);
  assert.deepEqual(await body(response, ["ok", "code"]), { ok: false, code: "beta1_request_too_large" });
});

await checked("FIXTURE_SEAM_UNREACHABLE_WHEN_OFF", async () => {
  let touched = 0;
  process.env.NODE_ENV = "production";
  const offHandlers = createV2Beta1RouteHandlers({ coordinator: { getSnapshot: () => { touched += 1; return initial.snapshot; }, importInsight: async () => { touched += 1; return { snapshot: initial.snapshot, replayed: false, generatedArtifactHash: null }; }, runJourney: async () => { touched += 1; return { snapshot: initial.snapshot, replayed: false, generatedArtifactHash: null }; } }, previewInsight: () => insight });
  const response = await offHandlers.GET(request("GET"));
  assert.equal(response.status, 404);
  assert.equal(touched, 0);
  process.env.NODE_ENV = "development";
});

const resolved = scenarios;
assert.equal(new Set(resolved).size, resolved.length);
console.log(JSON.stringify({ status: "PASS", scenarios: resolved.length, scenarioNames: resolved, cacheControl: "NO_STORE_EXACT", firstEffectSubmissions: 1, replayEffectSubmissions: 0, liveProviderCalls: 0, browserObserved: false, serverExternalEffectsObserved: "NOT_INSTRUMENTED" }));
Object.assign(process.env, originalEnvironment);
