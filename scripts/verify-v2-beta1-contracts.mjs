import assert from "node:assert/strict";

import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import {
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_EFFECT_BOUNDARY,
  V2_BETA1_OPERATION,
  V2_BETA1_PERSISTENCE_CLASS,
  beta1Hash,
  normalizeBeta1StatisticalProse,
  parseV2Beta1ImportChatInsightRequest,
  parseV2Beta1JourneyRequest,
  parseV2Beta1ProjectId,
  validateProjectTruthSnapshot,
} from "../lib/v2-beta1/contracts.ts";
import { resolveV2Beta1Principal } from "../lib/v2-beta1/auth.ts";
import { v2Beta1PrototypeEnabled } from "../lib/v2-beta1/page-authority.ts";
import {
  createSyntheticBeta1Insight,
  createV2Beta1Coordinator,
  createV2Beta1ImportRequest,
  createV2Beta1JourneyRequest,
} from "../lib/v2-beta1/runtime.ts";

let assertions = 0;
let groups = 0;
function equal(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message); }
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function throws(operation, pattern, message) { assertions += 1; assert.throws(operation, pattern, message); }
async function rejects(operation, pattern, message) { assertions += 1; await assert.rejects(operation, pattern, message); }

groups += 1;
equal(normalizeBeta1StatisticalProse("指標=82%"), "指標為 82%", "statistical notation becomes readable prose");
equal(normalizeBeta1StatisticalProse("p = 0.031"), "p為 0.031", "statistical symbols retain exact numeric value");
equal(V2_BETA1_EFFECT_BOUNDARY, {
  operations: ["IMPORT_CHAT_INSIGHT", "RUN_RESEARCH_JOURNEY"],
  persistenceClass: "PROCESS_LOCAL_LOCAL_PROTOTYPE",
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  externalMutations: 0,
  blindResendAfterUnknown: false,
}, "effect boundary is exact and local only");

groups += 1;
equal(v2Beta1PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), true, "all local authority flags enable prototype");
equal(v2Beta1PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), false, "production remains closed");
equal(v2Beta1PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), false, "fixture flag required");
const priorEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  TEST_FIXTURE: process.env.TEST_FIXTURE,
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: process.env.OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE,
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: process.env.OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL,
};
try {
  process.env.NODE_ENV = "development";
  process.env.TEST_FIXTURE = "1";
  process.env.OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE = "1";
  process.env.OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL = "1";
  const granted = await resolveV2Beta1Principal(new Request("http://127.0.0.1/v2-beta1", { headers: { "x-old-mike-v2-workspace": "fixture-workspace-v2" } }));
  equal(granted, { ok: true, principal: { workspaceId: "fixture-workspace-v2", userId: "fixture-user-v2", scope: "fixture-workspace-v2:fixture-user-v2" } }, "fixture principal requires exact workspace header");
  const isolated = await resolveV2Beta1Principal(new Request("http://127.0.0.1/v2-beta1", { headers: { "x-old-mike-v2-workspace": "other-workspace-v2" } }));
  equal(isolated, { ok: false, status: 404, code: "workspace_not_found" }, "other workspace is isolated");
  process.env.OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL = "0";
  equal(await resolveV2Beta1Principal(new Request("http://127.0.0.1/v2-beta1", { headers: { "x-old-mike-v2-workspace": "fixture-workspace-v2" } })), { ok: false, status: 404, code: "not_found" }, "synthetic principal needs explicit authority");
} finally {
  for (const [key, value] of Object.entries(priorEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

groups += 1;
const coordinator = createV2Beta1Coordinator();
const scope = "fixture-workspace-v2:fixture-user-v2";
const initial = coordinator.getSnapshot(scope);
equal(initial.contractVersion, V2_BETA1_CONTRACT_VERSION, "snapshot contract authority exact");
equal(initial.persistenceClass, V2_BETA1_PERSISTENCE_CLASS, "snapshot explicitly process local");
equal(initial.revision, 1, "initial revision is one");
equal(Object.keys(initial.s0Summary), S0_FIELD_NAMES, "S0 has exact ordered 13 fields");
equal(Object.values(initial.s0Summary).filter((value) => value.trim()).length, 13, "all S0 fields are nonempty");
equal(initial.stages.map((item) => item.stageId), ["DISCOVER", "BLUEPRINT", "EVIDENCE", "ANALYZE", "WRITE", "REVIEW_SUBMIT"], "six stages are exact and ordered");
equal(initial.stages.map((item) => item.status), ["COMPLETE", "ACTIVE", "PENDING", "PENDING", "PENDING", "PENDING"], "six stage status is explicit");
ok(initial.s0Summary.existingData.includes("指標為 82%"), "snapshot inherits readable statistic prose");
ok(!initial.s0Summary.existingData.includes("指標=82%"), "terse statistic syntax is absent");
equal(initial.chatInsights.length, 0, "initial project contains no imported chat insight");
equal(initial.timeline.length, 0, "initial timeline empty");
equal(initial.effectReceipts.length, 0, "initial receipts empty");
equal([initial.formalResearchWriteCount, initial.onlineDatabaseWriteCount, initial.externalMutationCount], [0, 0, 0], "all effect counters zero");
equal(validateProjectTruthSnapshot(initial), initial, "initial snapshot validates and hash binds full truth");
const detached = coordinator.getSnapshot(scope);
detached.s0Summary.workingTitle = "caller mutation";
equal(coordinator.getSnapshot(scope).s0Summary.workingTitle, initial.s0Summary.workingTitle, "read returns an isolated clone");

groups += 1;
equal(parseV2Beta1ProjectId("project1"), "project1", "eight-byte canonical project id accepted");
for (const unsafeProjectId of ["x", "p".repeat(181), " project1", "project1 ", "project/unsafe", "專案project1"]) {
  throws(() => parseV2Beta1ProjectId(unsafeProjectId), /beta1_project_id_invalid/u, `unsafe project id rejected: ${unsafeProjectId.length}`);
  throws(() => parseV2Beta1ImportChatInsightRequest({ ...createV2Beta1ImportRequest(initial, createSyntheticBeta1Insight(), `project-id-import-${unsafeProjectId.length}`), projectId: unsafeProjectId }), /beta1_project_id_invalid/u, "import project id fail closed");
  throws(() => parseV2Beta1JourneyRequest({ ...createV2Beta1JourneyRequest(initial, { suffix: `project-id-journey-${unsafeProjectId.length}`, entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "project id authority", materials: [] }), projectId: unsafeProjectId }), /beta1_project_id_invalid/u, "journey project id fail closed");
  throws(() => validateProjectTruthSnapshot({ ...initial, projectId: unsafeProjectId }), /beta1_project_id_invalid/u, "empty-history snapshot project id fail closed");
}

groups += 1;
const insight = createSyntheticBeta1Insight();
ok(/^[0-9a-f]{64}$/u.test(insight.hash), "suggested insight carries strict hash");
const request = createV2Beta1ImportRequest(initial, insight, "success-0001");
equal(request.operation, V2_BETA1_OPERATION, "only import operation is exposed");
const first = await coordinator.importInsight(request, scope);
equal(first.replayed, false, "first import is a new effect");
equal(first.snapshot.revision, 2, "successful atomic import increments revision once");
equal(first.snapshot.chatInsights, [insight], "successful import adds exactly one insight");
equal(first.snapshot.timeline.length, 1, "successful import appends exactly one timeline event");
equal(first.snapshot.effectReceipts.length, 1, "successful import appends exactly one receipt");
equal(first.snapshot.timeline[0].completionClass, "COMPLETE", "timeline marks completion");
equal(first.snapshot.effectReceipts[0].completionClass, "COMPLETE", "receipt marks completion");
equal(first.snapshot.effectReceipts[0].requestHash, beta1Hash(request), "receipt binds exact request body");
equal([first.snapshot.formalResearchWriteCount, first.snapshot.onlineDatabaseWriteCount, first.snapshot.externalMutationCount], [0, 0, 0], "import performs no formal or external write");
ok(first.snapshot.contentHash !== initial.contentHash, "full truth hash changes with revision");
equal(coordinator.getSnapshot(scope), first.snapshot, "reload returns the complete updated snapshot");

groups += 1;
const replay = await coordinator.importInsight(structuredClone(request), scope);
equal(replay.replayed, true, "same key and same body replays");
equal(replay.snapshot, first.snapshot, "replay returns the exact original result snapshot");
equal(coordinator.getSnapshot(scope).timeline.length, 1, "replay appends zero timeline effects");
equal(coordinator.getSnapshot(scope).effectReceipts.length, 1, "replay appends zero receipts");
await rejects(() => coordinator.importInsight({ ...request, requestId: "beta1-import:conflicting-body" }, scope), /beta1_idempotency_conflict/u, "same key different body conflicts");
equal(coordinator.getSnapshot(scope).timeline.length, 1, "conflict appends zero effects");

groups += 1;
const current = coordinator.getSnapshot(scope);
const anotherInsight = createSyntheticBeta1Insight("哪些設計特徵能提高智慧回饋的可操作性與證據校準？");
await rejects(() => coordinator.importInsight({ ...createV2Beta1ImportRequest(current, anotherInsight, "stale-revision"), baseRevision: current.revision - 1 }, scope), /beta1_stale_revision/u, "stale revision fails closed");
await rejects(() => coordinator.importInsight({ ...createV2Beta1ImportRequest(current, anotherInsight, "stale-hash"), baseContentHash: "0".repeat(64) }, scope), /beta1_stale_content_hash/u, "stale content hash fails closed");
equal(coordinator.getSnapshot(scope).timeline.length, 1, "stale inputs append zero effects");

groups += 1;
const otherScope = "fixture-workspace-v2:other-user-v2";
const otherInitial = coordinator.getSnapshot(otherScope);
ok(otherInitial.projectId !== initial.projectId, "scope derives a different project authority");
await rejects(() => coordinator.importInsight({ ...createV2Beta1ImportRequest(otherInitial, anotherInsight, "scope-isolation"), projectId: initial.projectId }, otherScope), /beta1_project_scope_mismatch/u, "project from another tenant scope is rejected");
equal(coordinator.getSnapshot(otherScope).revision, 1, "scope rejection preserves other snapshot");

groups += 1;
let injectedUnknownAttempts = 0;
const uncertainCoordinator = createV2Beta1Coordinator({ beforeCommit: async () => { injectedUnknownAttempts += 1; return "UNKNOWN"; } });
const uncertainScope = "fixture-workspace-v2:unknown-user-v2";
const uncertainInitial = uncertainCoordinator.getSnapshot(uncertainScope);
const uncertainRequest = createV2Beta1ImportRequest(uncertainInitial, anotherInsight, "unknown-0001");
await rejects(() => uncertainCoordinator.importInsight(uncertainRequest, uncertainScope), /beta1_completion_unknown_no_resend/u, "unknown completion is surfaced");
const uncertainSnapshot = uncertainCoordinator.getSnapshot(uncertainScope);
equal(injectedUnknownAttempts, 1, "unknown path attempts the injected effect at most once");
equal(uncertainSnapshot.revision, 2, "unknown receipt becomes durable process-local truth");
equal(uncertainSnapshot.chatInsights.length, 0, "unknown completion does not claim insight imported");
equal(uncertainSnapshot.timeline.length, 1, "unknown appends one reconcile-required event");
equal(uncertainSnapshot.timeline[0].eventType, "CHAT_INSIGHT_COMPLETION_UNKNOWN", "unknown event is explicit");
equal(uncertainSnapshot.effectReceipts[0].completionClass, "UNKNOWN", "unknown receipt retained");
await rejects(() => uncertainCoordinator.importInsight(uncertainRequest, uncertainScope), /beta1_completion_unknown_no_resend/u, "same unknown key cannot resend");
equal(injectedUnknownAttempts, 1, "unknown replay invokes no second injected effect");

groups += 1;
let lineageEffectAttempts = 0;
let enterLineageEffect = () => {};
let releaseLineageEffect = () => {};
const lineageEffectEntered = new Promise((resolve) => { enterLineageEffect = resolve; });
const lineageEffectRelease = new Promise((resolve) => { releaseLineageEffect = resolve; });
const lineageCoordinator = createV2Beta1Coordinator({ beforeCommit: async () => {
  lineageEffectAttempts += 1;
  enterLineageEffect();
  await lineageEffectRelease;
  return "UNKNOWN";
} });
const lineageScope = "fixture-workspace-v2:lineage-user-v2";
const lineageInitial = lineageCoordinator.getSnapshot(lineageScope);
const lineageFirst = createV2Beta1ImportRequest(lineageInitial, anotherInsight, "lineage-concurrent-first");
const lineageSecond = createV2Beta1ImportRequest(lineageInitial, anotherInsight, "lineage-concurrent-second");
const lineageFirstPromise = lineageCoordinator.importInsight(lineageFirst, lineageScope);
await lineageEffectEntered;
const lineageSecondPromise = lineageCoordinator.importInsight(lineageSecond, lineageScope);
releaseLineageEffect();
const lineageResults = await Promise.allSettled([lineageFirstPromise, lineageSecondPromise]);
equal(lineageEffectAttempts, 1, "different idempotency keys for one active lineage enter the effect once");
equal(lineageResults.map((item) => item.status), ["rejected", "rejected"], "unknown lineage requests both stop without resend");
equal(lineageResults.map((item) => item.status === "rejected" ? item.reason.message : ""), ["beta1_completion_unknown_no_resend", "beta1_completion_unknown_no_resend"], "both lineage outcomes use exact completion-unknown fence");
const lineageFinal = lineageCoordinator.getSnapshot(lineageScope);
equal([lineageFinal.revision, lineageFinal.timeline.length, lineageFinal.effectReceipts.length], [2, 1, 1], "concurrent lineage commits one stable unknown receipt");

groups += 1;
throws(() => validateProjectTruthSnapshot({ ...first.snapshot, contentHash: "f".repeat(64) }), /beta1_snapshot_hash_mismatch/u, "tampered truth hash rejected");
throws(() => validateProjectTruthSnapshot({ ...first.snapshot, s0Summary: { ...first.snapshot.s0Summary, existingData: "指標=82%" }, contentHash: first.snapshot.contentHash }), /beta1_s0_stat_prose_invalid/u, "terse numeric prose cannot enter project truth");
throws(() => validateProjectTruthSnapshot({ ...first.snapshot, formalResearchWriteCount: 1 }), /beta1_effect_boundary_invalid/u, "formal research write claim rejected");

console.log(`PASS V2_BETA1_CONTRACTS groups=${groups} assertions=${assertions} snapshot_revision=${first.snapshot.revision} timeline_events=${first.snapshot.timeline.length} injected_unknown_attempts=${injectedUnknownAttempts} lineage_effect_attempts=${lineageEffectAttempts} network_calls=0 formal_writes=0 online_database_writes=0 external_mutations=0`);
