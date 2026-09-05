import assert from "node:assert/strict";

import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import { V2_BETA2_CONTRACT_VERSION, beta2Hash, createV2Beta2GenerationPayloadHash, createV2Beta2InitialHead, createV2Beta2Material, createV2Beta2RequestAuthority, createV2Beta2Source, createV2Beta2StageOutcome, parseV2Beta2SuccessEnvelope, parseV2Beta2TerminalFailureEnvelope } from "../lib/v2-beta2/contracts.ts";
import { V2Beta2RepositoryError } from "../lib/v2-beta2/repository.ts";
import { createV2Beta2RouteHandlers } from "../lib/v2-beta2/route-handlers.ts";
import { createV2Beta2ClientTransport, V2Beta2ClientError } from "../lib/v2-beta2/client-transport.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const initial = createV2Beta2InitialHead("beta2-project-01");
const source = createV2Beta2Source({ entryMode: "KEYWORD", researchDirection: "XR情境演練對職業安全教育遷移表現的影響", outputTarget: "MOE", materials: [] });
const validRequest = {
  contractVersion: V2_BETA2_CONTRACT_VERSION,
  operation: "GENERATE_DURABLE_CORE",
  projectId: "beta2-project-01",
  requestId: "beta2-route-request-0001",
  idempotencyKey: "beta2-route-idempotency-0001",
  baseRevision: 0,
  baseContentHash: initial.contentHash,
  source,
};
const pendingJobId = "beta2-job-route-0001";
const pendingReceipt = beta2Hash({ route: "pending-receipt" });
const pendingStage = createV2Beta2StageOutcome(validRequest.projectId, { jobId: pendingJobId, stageInstanceHash: beta2Hash({ route: "pending-stage" }), generationRequestId: validRequest.requestId, generationRequestHash: createV2Beta2GenerationPayloadHash(validRequest), status: "RECONCILE_REQUIRED", completionClass: "COMPLETION_UNKNOWN", providerSubmissionCount: 1, providerReceiptCommitment: pendingReceipt, providerResultHash: null, reasonCode: "COMPLETION_UNKNOWN", terminalEvent: null });
const pendingHead = { ...initial, reconciliation: { jobId: pendingJobId, status: "RECONCILE_REQUIRED" }, stageOutcome: pendingStage };
const outcome = { head: pendingHead, replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 };
let coordinatorCalls = 0;
const coordinator = {
  resume: async () => ({ head: initial, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }),
  generate: async () => { coordinatorCalls += 1; return outcome; },
  saveSelection: async () => { coordinatorCalls += 1; return outcome; },
  saveConfirmedWorkspace: async () => { coordinatorCalls += 1; return outcome; },
  reconcile: async () => { coordinatorCalls += 1; return outcome; },
};
const tenant = { workspaceId: "beta2-workspace-01", projectId: "beta2-project-01", userId: "beta2-user-01", role: "owner", projectTitle: "Beta2" };
const routes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async (_userId, projectId) => projectId === tenant.projectId ? tenant : null, coordinator: () => coordinator });

const resumed = await routes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01"), "beta2-project-01");
equal(resumed.status, 200, "authenticated existing project resumes");
equal(parseV2Beta2SuccessEnvelope(await resumed.json(), { projectId: tenant.projectId, request: null }).operation, "RESUME", "resume exact envelope with null request authority");

const generated = await routes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(validRequest) }), "beta2-project-01");
equal(generated.status, 202, "exact completion-unknown mutation accepted without false success");
const generatedBody = await generated.json();
equal(parseV2Beta2SuccessEnvelope(generatedBody, { projectId: tenant.projectId, request: validRequest }).providerSubmissionDelta, 1, "route preserves observed provider delta and current request authority");
equal(coordinatorCalls, 1, "one coordinator mutation");

const lookalike = await routes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1.evil:43120", "content-type": "application/json" }, body: JSON.stringify(validRequest) }), "beta2-project-01");
equal(lookalike.status, 403, "origin hostname lookalike rejected");
equal(coordinatorCalls, 1, "rejected origin never reaches coordinator");

const wrongProject = await routes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify({ ...validRequest, projectId: "beta2-project-02" }) }), "beta2-project-01");
equal(wrongProject.status, 404, "body project swap returns generic 404");
equal(coordinatorCalls, 1, "project swap never reaches coordinator");

const unknown = await routes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-99"), "beta2-project-99");
equal(unknown.status, 404, "unknown project generic 404");
const unsafeId = await routes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/padded"), " beta2-project-01");
equal(unsafeId.status, 404, "unsafe project id generic 404");

for (const [name, status] of [["absent", 401], ["disabled", 403], ["password_change", 428]]) {
  const rejectedRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: false, response: Response.json({ ok: false, code: name }, { status }) }), resolveTenant: async () => { throw new Error("tenant_lookup_must_not_run"); }, coordinator: () => coordinator });
  equal((await rejectedRoutes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01"), "beta2-project-01")).status, status, `${name} session rejected before tenant lookup`);
}

const oversized = await routes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json", "content-length": "131073" }, body: "{}" }), "beta2-project-01");
equal(oversized.status, 413, "declared oversized request rejected");

const nonblankMaterial = createV2Beta2Material({ materialId: "beta2-route-material-0001", kind: "ABSTRACT", title: "空白邊界", content: "保留原始內容" });
const nonblankPartialSource = createV2Beta2Source({ entryMode: "PARTIAL_MATERIAL", researchDirection: "材料空白邊界", outputTarget: "SSCI", materials: [nonblankMaterial] });
const blankMaterial = { ...nonblankMaterial, content: "\u3000", contentByteLength: 3, contentHash: beta2Hash("\u3000") };
const { sourceHash: _nonblankSourceHash, ...partialSourceCore } = nonblankPartialSource;
const blankSourceCore = { ...partialSourceCore, materials: [blankMaterial] };
const blankMaterialRequest = { ...validRequest, requestId: "beta2-route-blank-request-0001", idempotencyKey: "beta2-route-blank-key-0001", source: { ...blankSourceCore, sourceHash: beta2Hash(blankSourceCore) } };
const blankMaterialResponse = await routes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(blankMaterialRequest) }), tenant.projectId);
equal(blankMaterialResponse.status, 400, "Unicode whitespace-only material rejects at the direct route boundary");
equal((await blankMaterialResponse.json()).code, "beta2_material_content_invalid", "blank material route rejection is exact and sanitized");
equal(coordinatorCalls, 1, "blank material never reaches coordinator or provider authority");
const originalFetchForBlankMaterial = globalThis.fetch;
let blankMaterialClientFetches = 0;
try {
  globalThis.fetch = async () => { blankMaterialClientFetches += 1; throw new Error("blank_material_fetch_must_not_run"); };
  const blankMaterialClientError = await createV2Beta2ClientTransport(tenant.projectId).mutate(blankMaterialRequest).then(() => null, (error) => error);
  equal(blankMaterialClientError?.message, "beta2_material_content_invalid", "client rejects whitespace-only material with the shared contract");
  equal(blankMaterialClientFetches, 0, "client blank-material rejection performs zero network effects");
} finally {
  globalThis.fetch = originalFetchForBlankMaterial;
}

const staleRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, generate: async () => { throw new V2Beta2RepositoryError("beta2_stale_project_head", 409); } }) });
const stale = await staleRoutes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(validRequest) }), "beta2-project-01");
equal(stale.status, 409, "stale revision fail closed");
equal((await stale.json()).code, "beta2_stale_project_head", "stale reason is sanitized");

const confirmationRequest = {
  contractVersion: V2_BETA2_CONTRACT_VERSION,
  operation: "SAVE_CONFIRMED_WORKSPACE",
  projectId: tenant.projectId,
  requestId: "beta2-route-workspace-0001",
  idempotencyKey: "beta2-route-workspace-key-0001",
  baseRevision: 1,
  baseContentHash: beta2Hash({ route: "workspace-base" }),
  selectedDirectionId: "beta2-direction-route-0001",
  s0Summary: Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, field === "outputTrack" ? "SSCI" : `確認 ${field}`])),
  appliedAssistOptionIds: Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, null])),
};
const unavailableConfirmationRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, saveConfirmedWorkspace: async () => { throw new V2Beta2RepositoryError("beta2_workspace_confirmation_not_available", 409); } }) });
const unavailableConfirmation = await unavailableConfirmationRoutes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(confirmationRequest) }), tenant.projectId);
equal(unavailableConfirmation.status, 409, "confirmed workspace route fails closed when durable capability fence is unavailable");
equal((await unavailableConfirmation.json()).code, "beta2_workspace_confirmation_not_available", "confirmed workspace route preserves sanitized capability failure");

const reconcileRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: tenant.projectId, requestId: "beta2-route-reconcile-0001", jobId: pendingJobId };
const reconcilePost = (handlers, request = reconcileRequest) => handlers.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(request) }), tenant.projectId);
const exactReplayRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, reconcile: async () => ({ ...outcome, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }) }) });
const exactReplay = await reconcilePost(exactReplayRoutes);
equal(exactReplay.status, 202, "exact reconciliation pending replay returns 202");
equal((await exactReplay.json()).replayed, true, "exact reconciliation pending replay preserves zero-delta replay authority");

const pendingRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, reconcile: async () => ({ head: pendingHead, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }) }) });
const pending = await reconcilePost(pendingRoutes);
equal(pending.status, 202, "nonterminal lookup repoll remains pending");
equal((await pending.json()).eventAppendDelta, 0, "nonterminal lookup repoll reports exact zero event delta");

const rejectedGenerationRequestId = validRequest.requestId;
const rejectedGenerationRequestHash = createV2Beta2GenerationPayloadHash(validRequest);
const rejectedStage = createV2Beta2StageOutcome(tenant.projectId, { jobId: "beta2-job-route-rejected-0001", stageInstanceHash: beta2Hash({ route: "rejected-stage" }), generationRequestId: rejectedGenerationRequestId, generationRequestHash: rejectedGenerationRequestHash, status: "REJECTED", completionClass: "TERMINAL_REJECTED", providerSubmissionCount: 1, providerReceiptCommitment: beta2Hash({ route: "rejected-receipt" }), providerResultHash: null, reasonCode: "FAKE_PROVIDER_REJECTED", terminalEvent: { eventType: "GENERATION_TERMINAL_FAILURE", operation: "GENERATE_DURABLE_CORE", requestId: rejectedGenerationRequestId, requestHash: rejectedGenerationRequestHash } });
const rejectedHead = { ...initial, stageOutcome: rejectedStage };
const terminalRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, generate: async () => ({ head: rejectedHead, replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 }) }) });
const terminalResponse = await terminalRoutes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(validRequest) }), tenant.projectId);
equal(terminalResponse.status, 409, "terminal provider rejection is never a 200 success response");
const terminalBody = await terminalResponse.json();
const terminalEnvelope = parseV2Beta2TerminalFailureEnvelope(terminalBody, validRequest);
equal(terminalEnvelope.project.stageOutcome?.terminalEvent?.requestHash, rejectedGenerationRequestHash, "terminal route preserves exact durable request hash authority");
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json(terminalBody, { status: 409 });
  const clientError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
  equal(clientError instanceof V2Beta2ClientError, true, "client surfaces exact terminal rejection as a typed error");
  equal(clientError?.terminalOutcome?.project.stageOutcome?.outcomeHash, rejectedStage.outcomeHash, "client retains exact durable terminal outcome authority");
  globalThis.fetch = async () => Response.json({ ok: false, code: "beta2_provider_terminal_rejected" }, { status: 409 });
  const malformedTerminalError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
  equal(malformedTerminalError?.code, "beta2_response_invalid", "malformed terminal 409 cannot borrow rejection identity from body code");
  equal(malformedTerminalError?.terminalOutcome, null, "malformed terminal 409 carries no trusted terminal outcome");
  const differentCurrentRequest = { ...validRequest, requestId: "beta2-route-terminal-current-b", idempotencyKey: "beta2-route-terminal-key-b" };
  globalThis.fetch = async () => Response.json(terminalBody, { status: 409 });
  const staleTerminalAuthorityError = await createV2Beta2ClientTransport(tenant.projectId).mutate(differentCurrentRequest).then(() => null, (error) => error);
  equal(staleTerminalAuthorityError?.code, "beta2_response_invalid", "terminal envelope bound to original A cannot be projected for current B");
} finally {
  globalThis.fetch = originalFetch;
}
const rejectedResumeRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, resume: async () => ({ head: rejectedHead, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }) }) });
const rejectedResume = await rejectedResumeRoutes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01"), tenant.projectId);
equal(rejectedResume.status, 200, "fresh GET can resume project state without relabeling terminal outcome as operation success");
equal(parseV2Beta2SuccessEnvelope(await rejectedResume.json(), { projectId: tenant.projectId, request: null }).project.stageOutcome?.status, "REJECTED", "fresh GET preserves rejected durable outcome");
const invalidLookupRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, reconcile: async () => { throw new V2Beta2RepositoryError("beta2_provider_lookup_invalid", 503); } }) });
const invalidLookupResponse = await reconcilePost(invalidLookupRoutes);
equal(invalidLookupResponse.status, 503, "invalid provider lookup envelope maps to exact HTTP 503");
equal((await invalidLookupResponse.json()).code, "beta2_provider_lookup_invalid", "invalid lookup HTTP reason remains sanitized");

const impossibleResumeRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, resume: async () => ({ head: initial, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 0 }) }) });
const impossibleResume = await impossibleResumeRoutes.GET(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01"), tenant.projectId);
equal(impossibleResume.status, 400, "route rejects impossible success-envelope delta matrix before emission");
equal((await impossibleResume.json()).code, "beta2_response_invalid", "route success-envelope semantic rejection is exact");

for (const [name, code] of [["generation_success", "beta2_reconciliation_not_available"], ["generation_failure", "beta2_reconciliation_not_available"], ["request_mismatch", "beta2_reconciliation_replay_conflict"]]) {
  const rejectedReplayRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, reconcile: async () => { throw new V2Beta2RepositoryError(code, 409); } }) });
  const rejectedReplay = await reconcilePost(rejectedReplayRoutes);
  equal(rejectedReplay.status, 409, `${name} reconciliation replay fails closed`);
  equal((await rejectedReplay.json()).code, code, `${name} reconciliation replay exposes exact sanitized code`);
}

const rotatedRequest = { ...validRequest, requestId: "beta2-route-request-rotated", idempotencyKey: "beta2-route-idempotency-rotated" };
const rotatedRoutes = createV2Beta2RouteHandlers({ authenticate: async () => ({ ok: true, userId: tenant.userId, fixture: true }), resolveTenant: async () => tenant, coordinator: () => ({ ...coordinator, generate: async () => ({ head: pendingHead, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }) }) });
const rotatedResponse = await rotatedRoutes.POST(new Request("http://127.0.0.1:43120/api/v2-beta2/projects/beta2-project-01", { method: "POST", headers: { origin: "http://127.0.0.1:43120", "content-type": "application/json" }, body: JSON.stringify(rotatedRequest) }), tenant.projectId);
const rotatedBody = await rotatedResponse.json();
equal(rotatedResponse.status, 400, "rotated generation replay cannot borrow an earlier durable origin");
equal(rotatedBody.code, "beta2_response_invalid", "rotated generation replay fails closed before route emission");
const echoedOriginal = generatedBody;
const wrongKey = { ...rotatedRequest, idempotencyKey: "beta2-route-idempotency-wrong" };
const wrongKeyAuthority = { ...generatedBody, requestAuthority: createV2Beta2RequestAuthority(wrongKey) };
const originalFetchForCorrelation = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json(echoedOriginal, { status: 202 });
  const echoedOriginalError = await createV2Beta2ClientTransport(tenant.projectId).mutate(rotatedRequest).then(() => null, (error) => error);
  equal(echoedOriginalError?.code, "beta2_response_invalid", "original operation authority cannot be projected for a rotated key or request");
  globalThis.fetch = async () => Response.json(wrongKeyAuthority, { status: 202 });
  const wrongKeyError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
  equal(wrongKeyError?.code, "beta2_response_invalid", "correct request id with wrong idempotency and transport hash rejects");
  globalThis.fetch = async () => Response.json({ ...generatedBody, requestAuthority: { ...generatedBody.requestAuthority, extra: true } }, { status: 202 });
  const extraAuthorityError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
  equal(extraAuthorityError?.code, "beta2_response_invalid", "extra request authority field rejects");
  for (const invalidSuccessStatus of [201, 206]) {
    globalThis.fetch = async () => Response.json(generatedBody, { status: invalidSuccessStatus });
    const statusError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
    equal(statusError?.code, "beta2_response_invalid", `HTTP ${invalidSuccessStatus} cannot project a nominally valid mutation success body`);
  }
  globalThis.fetch = async () => Response.json({ ok: false, code: "beta2_provider_terminal_rejected" }, { status: 503 });
  const untypedTerminalError = await createV2Beta2ClientTransport(tenant.projectId).mutate(validRequest).then(() => null, (error) => error);
  equal(untypedTerminalError?.code, "beta2_response_invalid", "non-409 untyped rejection cannot display a provider terminal outcome");
} finally {
  globalThis.fetch = originalFetchForCorrelation;
}

console.log(JSON.stringify({ status: "PASS", groups: 16, assertions, coordinatorMutations: coordinatorCalls, genericNotFound: true, exactOrigin: true, reconciliationReplay: "EXACT_PENDING_ZERO_DELTA", requestCorrelation: "GLOBAL_EXACT_OPERATION_KEY_REQUEST_HASH_BOUND", confirmedWorkspaceRoute: "CAPABILITY_FENCED", successEnvelopeMatrix: "SERVER_AND_CLIENT_EXACT", terminalOutcome: "REJECTED_HTTP_409_CLIENT_TYPED_FRESH_GET_PRESERVED", invalidLookup: "HTTP_503" }));
