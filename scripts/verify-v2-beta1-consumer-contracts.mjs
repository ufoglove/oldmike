import assert from "node:assert/strict";

const [{ parseV2Beta1GetResponse, parseV2Beta1PostResponse: parsePostRaw }, runtime, contracts, sharedAuthority, alpha3] = await Promise.all([
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-alpha3/contracts.ts"),
]);

const snapshot = runtime.createSyntheticBeta1Project("fixture-workspace-v2:fixture-user-v2");
const previewInsight = runtime.createSyntheticBeta1Insight();
const baseGet = { ok: true, contractVersion: snapshot.contractVersion, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot, previewInsight, effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
const request = runtime.createV2Beta1ImportRequest(snapshot, previewInsight, "consumer-0001");
const coordinator = runtime.createV2Beta1Coordinator();
const imported = (await coordinator.importInsight(request, "fixture-workspace-v2:fixture-user-v2")).snapshot;
const secondInsight = runtime.createSyntheticBeta1Insight("哪些作用機制能解釋證據校準與學習遷移的差異？");
const twiceImported = (await coordinator.importInsight(runtime.createV2Beta1ImportRequest(imported, secondInsight, "consumer-0002"), "fixture-workspace-v2:fixture-user-v2")).snapshot;
const basePost = { ok: true, contractVersion: imported.contractVersion, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: null, snapshot: imported, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
const journeyScope = "fixture-workspace-v2:journey-consumer";
const journeyCoordinator = runtime.createV2Beta1Coordinator();
const journeyInitial = journeyCoordinator.getSnapshot(journeyScope);
const journeyRequest = runtime.createV2Beta1JourneyRequest(journeyInitial, { suffix: "consumer-journey", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準與自我調節學習", materials: [] });
const journeySnapshot = (await journeyCoordinator.runJourney(journeyRequest, journeyScope)).snapshot;
const journeyPost = { ...basePost, contractVersion: journeySnapshot.contractVersion, generatedArtifactHash: journeySnapshot.effectReceipts.at(-1).generatedArtifactHash, snapshot: journeySnapshot };
const partialScope = "fixture-workspace-v2:partial-consumer";
const partialCoordinator = runtime.createV2Beta1Coordinator();
const partialInitial = partialCoordinator.getSnapshot(partialScope);
const partialRequest = runtime.createV2Beta1JourneyRequest(partialInitial, { suffix: "consumer-partial", entryMode: "PARTIAL_MATERIAL", outputTarget: "SCI", researchDirection: "觀察結果的證據校準", materials: [{ materialId: "material-results-1", kind: "RESULTS", title: "結果", content: "主要指標實際觀察為82%，但樣本與信賴區間仍待核對。" }] });
const partialSnapshot = (await partialCoordinator.runJourney(partialRequest, partialScope)).snapshot;
const partialPost = { ...basePost, contractVersion: partialSnapshot.contractVersion, generatedArtifactHash: partialSnapshot.effectReceipts.at(-1).generatedArtifactHash, snapshot: partialSnapshot };
const exactInsightRuns = [];
for (const evidenceBoundary of ["OBSERVED_PARTIAL", "ASSUMPTION"]) {
  const exactInsight = alpha3.createInsightCard({
    kind: "direction",
    title: `${evidenceBoundary} 證據邊界`,
    researchQuestion: "如何維持證據邊界的共享解析一致性？",
    mechanism: "以同一共享權威限制伺服器與瀏覽器投影。",
    value: "拒絕寬鬆私有解析造成的狀態漂移。",
    domainFit: "適用於本地 Beta1 專案真相快照。",
    evidenceBoundary,
    assumptions: ["僅驗證結構與雜湊一致性。"],
    nextAction: "維持人工專業審查待辦。",
  });
  const exactScope = `fixture-workspace-v2:shared-snapshot-${evidenceBoundary.toLocaleLowerCase()}`;
  const exactCoordinator = runtime.createV2Beta1Coordinator();
  const exactInitial = exactCoordinator.getSnapshot(exactScope);
  const exactRequest = runtime.createV2Beta1ImportRequest(exactInitial, exactInsight, `shared-snapshot-${evidenceBoundary.toLocaleLowerCase()}`);
  const exactSnapshot = (await exactCoordinator.importInsight(exactRequest, exactScope)).snapshot;
  exactInsightRuns.push({ evidenceBoundary, exactInsight, exactScope, exactInitial, exactRequest, exactSnapshot });
}
const importContext = { trustedScope: "fixture-workspace-v2:fixture-user-v2", previousSnapshot: snapshot, submittedRequest: request };
const journeyContext = { trustedScope: journeyScope, previousSnapshot: journeyInitial, submittedRequest: journeyRequest };
const partialContext = { trustedScope: partialScope, previousSnapshot: partialInitial, submittedRequest: partialRequest };
const parseV2Beta1PostResponse = (value) => parsePostRaw(value, value?.snapshot?.projectId === journeyInitial.projectId ? journeyContext : importContext);
const cases = [];
const gate = (name, callback) => { callback(); cases.push(name); };

gate("GET_EXACT_CONSUMED_FIELDS", () => assert.ok(parseV2Beta1GetResponse(baseGet)));
gate("POST_EXACT_CONSUMED_FIELDS", () => assert.ok(parseV2Beta1PostResponse(basePost)));
gate("CONTRACT_1_7_17_AND_OLDER_FAIL_CLOSED", () => {
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.17" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.16" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.15" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.13" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.14" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.12" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.11" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.10" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.9" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.8" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.7" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.6" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.5" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.4" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.3" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.2" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.1" }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: "old-mike-v2-beta1/1.7.0" }), null);
});
gate("PROJECT_ID_SHARED_EXACT_ACROSS_EMPTY_HISTORY_GET_NEW_AND_REPLAY", () => {
  assert.equal(sharedAuthority.parseV2Beta1ProjectId("project1"), "project1");
  const rehash = (value) => { const { contentHash: _contentHash, ...core } = value; return { ...core, contentHash: contracts.snapshotContentHash(core) }; };
  for (const unsafeProjectId of ["x", "p".repeat(181), " project1", "project1 ", "project/unsafe"]) {
    assert.throws(() => sharedAuthority.parseV2Beta1ProjectId(unsafeProjectId), /beta1_project_id_invalid/);
    const emptyHistory = rehash({ ...structuredClone(snapshot), projectId: unsafeProjectId });
    const nonemptyHistory = rehash({ ...structuredClone(imported), projectId: unsafeProjectId });
    const journeyHistory = rehash({ ...structuredClone(journeySnapshot), projectId: unsafeProjectId });
    assert.throws(() => contracts.validateProjectTruthSnapshot(emptyHistory), /beta1_project_id_invalid|beta1_history/u);
    assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: emptyHistory }), null);
    assert.equal(parsePostRaw({ ...basePost, snapshot: nonemptyHistory }, importContext), null);
    assert.equal(parsePostRaw({ ...journeyPost, snapshot: journeyHistory }, journeyContext), null);
    assert.equal(parsePostRaw({ ...journeyPost, snapshot: journeyHistory, replayed: true, effectSubmissionCount: 0 }, journeyContext), null);
    assert.throws(() => contracts.parseV2Beta1ImportChatInsightRequest({ ...request, projectId: unsafeProjectId }), /beta1_project_id_invalid/);
    assert.throws(() => contracts.parseV2Beta1JourneyRequest({ ...journeyRequest, projectId: unsafeProjectId }), /beta1_project_id_invalid/);
  }
});
gate("DECLARED_OUTER_EXTENSION_ONLY", () => {
  assert.ok(parseV2Beta1GetResponse({ ...baseGet, extensions: { ignored: true } }));
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, futureField: { ignored: true } }), null);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: { ...snapshot, futureSnapshotField: "ignored" } }), null);
});
gate("FOCUS_DOMAIN_LABEL_REQUIRED", () => assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: { ...snapshot, focusDomain: { ...snapshot.focusDomain, label: 7 } } }), null));
gate("DOMAIN_SELECTION_BUILTIN_CUSTOM_VALID_CONTROLS", () => {
  const custom = alpha3.createCustomDomainSelection({ profileId: "consumer-custom-domain", version: 1, name: "自訂研究領域", contentHash: "a".repeat(64) });
  assert.equal(sharedAuthority.hasV2Beta1ExactDomainSelectionKeys(snapshot.focusDomain), true);
  assert.equal(sharedAuthority.hasV2Beta1ExactDomainSelectionKeys(custom), true);
  assert.deepEqual(contracts.parseV2Beta1JourneyRequest({ ...journeyRequest, researchDomain: custom }).researchDomain, custom);
});
gate("SHARED_SNAPSHOT_LEAF_AUTHORITY_LEGAL_BOUNDARIES", () => {
  for (const run of exactInsightRuns) {
    assert.deepEqual(contracts.parseV2Beta1SnapshotInsight(run.exactInsight), run.exactInsight, run.evidenceBoundary);
    assert.ok(parseV2Beta1GetResponse({ ...baseGet, previewInsight: run.exactInsight }), run.evidenceBoundary);
    const post = { ...basePost, contractVersion: run.exactSnapshot.contractVersion, snapshot: run.exactSnapshot };
    const context = { trustedScope: run.exactScope, previousSnapshot: run.exactInitial, submittedRequest: run.exactRequest };
    assert.ok(parsePostRaw(post, context), `${run.evidenceBoundary}:new`);
    assert.ok(parsePostRaw({ ...post, replayed: true, effectSubmissionCount: 0 }, context), `${run.evidenceBoundary}:replay`);
  }
});
gate("SHARED_SNAPSHOT_LEAF_AUTHORITY_INVALID_PARITY", () => {
  const rehash = (value) => { const { contentHash: _contentHash, ...core } = value; return { ...core, contentHash: contracts.snapshotContentHash(core) }; };
  const builtinBinding = { kind: "BUILTIN", domainId: "unregistered-domain", label: "未登錄領域", profileId: null, profileVersion: null, profileContentHash: null };
  const customNameBinding = { kind: "CUSTOM", domainId: null, label: "自".repeat(121), profileId: "custom-name-overflow", profileVersion: 1, profileContentHash: "a".repeat(64) };
  const customIdBinding = { kind: "CUSTOM", domainId: null, label: "合法名稱", profileId: "p".repeat(121), profileVersion: 1, profileContentHash: "b".repeat(64) };
  const mutations = [
    (value) => ({ ...value, focusDomain: { ...builtinBinding, selectionHash: contracts.beta1Hash(builtinBinding) } }),
    (value) => ({ ...value, focusDomain: { ...customNameBinding, selectionHash: contracts.beta1Hash(customNameBinding) } }),
    (value) => ({ ...value, focusDomain: { ...customIdBinding, selectionHash: contracts.beta1Hash(customIdBinding) } }),
    (value) => ({ ...value, s0Summary: { ...value.s0Summary, workingTitle: "W".repeat(5000) } }),
  ];
  for (const [index, mutate] of mutations.entries()) {
    const bad = rehash(mutate(structuredClone(imported)));
    assert.throws(() => contracts.validateProjectTruthSnapshot(bad), `server:${index}`);
    assert.equal(parseV2Beta1GetResponse({ ...baseGet, contractVersion: bad.contractVersion, snapshot: bad }), null, `get:${index}`);
    assert.equal(parsePostRaw({ ...basePost, snapshot: bad }, importContext), null, `post:${index}`);
    assert.equal(parsePostRaw({ ...basePost, snapshot: bad, replayed: true, effectSubmissionCount: 0 }, importContext), null, `replay:${index}`);
  }
});
gate("FOCUS_DOMAIN_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(snapshot); bad.focusDomain.__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /domain_selection_invalid/);
  assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: bad }), null);
});
gate("CHAT_INSIGHT_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(imported); bad.chatInsights[0].__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /insight_card_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: bad }), null);
});
gate("TIMELINE_CONSUMED_FIELDS_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: { ...imported, timeline: [{ ...imported.timeline[0], sequence: "1" }] } }), null));
gate("TIMELINE_INSIGHT_LINEAGE_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: { ...imported, timeline: [{ ...imported.timeline[0], insightHash: "invalid" }] } }), null));
gate("RECEIPT_INSIGHT_LINEAGE_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: { ...imported, effectReceipts: [{ ...imported.effectReceipts[0], completionClass: "MAYBE" }] } }), null));
gate("REVISION_HISTORY_INVARIANT", () => assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: { ...snapshot, revision: 999 } }), null));
gate("CHAT_INSIGHT_COMPLETE_HISTORY_REQUIRED", () => assert.equal(parseV2Beta1GetResponse({ ...baseGet, snapshot: { ...snapshot, chatInsights: [previewInsight] } }), null));
gate("CHAT_INSIGHT_DUPLICATE_REJECTED", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: { ...twiceImported, chatInsights: [twiceImported.chatInsights[0], twiceImported.chatInsights[0]] } }), null));
gate("COMPLETE_HISTORY_ORDER_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, snapshot: { ...twiceImported, chatInsights: [...twiceImported.chatInsights].reverse() } }), null));
gate("REPLAYED_BOOLEAN_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, replayed: "false" }), null));
gate("EFFECT_COUNT_NUMBER_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, effectSubmissionCount: "1" }), null));
gate("LIVE_PROVIDER_COUNT_EXACT_ZERO", () => assert.equal(parseV2Beta1PostResponse({ ...basePost, liveProviderCallCount: 1 }), null));
gate("MISSING_CONSUMED_FIELD_REJECTED", () => { const value = { ...basePost }; delete value.replayed; assert.equal(parseV2Beta1PostResponse(value), null); });
gate("MALFORMED_PAYLOAD_REJECTED", () => assert.equal(parseV2Beta1GetResponse({ ok: true }), null));
gate("JOURNEY_ALL_CONSUMED_FIELDS_PASS", () => assert.ok(parseV2Beta1PostResponse(journeyPost)?.snapshot.journey));
gate("JOURNEY_RESEARCH_DOMAIN_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.researchDomain.__EXTRA__ = "rejected";
  bad.journeys.at(-1).researchDomain.__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /domain_selection_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("PARTIAL_MATERIAL_EXACT_KEYS_SERVER_CLIENT", () => {
  assert.ok(parsePostRaw(partialPost, partialContext)?.snapshot.journey?.sourceMaterials[0]);
  const bad = structuredClone(partialSnapshot);
  bad.journey.sourceMaterials[0].__EXTRA__ = "rejected";
  bad.journeys.at(-1).sourceMaterials[0].__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /beta1_material_invalid/);
  assert.equal(parsePostRaw({ ...partialPost, snapshot: bad }, partialContext), null);
});
gate("JOURNEY_DIRECTION_FIELD_REQUIRED", () => {
  const directions = structuredClone(journeySnapshot.journey.directions);
  delete directions[0].method;
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: { ...journeySnapshot, journey: { ...journeySnapshot.journey, directions } } }), null);
});
gate("JOURNEY_TARGET_TYPE_STRICT", () => assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: { ...journeySnapshot, journey: { ...journeySnapshot.journey, outputTarget: 7 } } }), null));
gate("JOURNEY_CROSS_TARGET_REJECTED", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.journal.target = "SCI";
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_RECOMPUTED_INPUT_HASH_REQUIRED", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.inputBundleHash = "a".repeat(64);
  bad.journey.directions[1].inputBundleHash = "a".repeat(64);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_ASSIST_EXACT_THREE_REQUIRED", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[0].fieldAssist.workingTitle.pop();
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_PROJECTION_CONTEXT_STRICT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[0].professionalProjection.outputTarget = "SCI";
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_PREVIEW_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[0].preview.futurePreviewField = "rejected";
  bad.journeys.at(-1).directions[0].preview.futurePreviewField = "rejected";
  assert.throws(() => contracts.parseV2Beta1JourneyArtifact(bad.journey), /beta1_preview_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_PREVIEW_SECTIONS_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[0].preview.sections.FUTURE = "rejected";
  bad.journeys.at(-1).directions[0].preview.sections.FUTURE = "rejected";
  assert.throws(() => contracts.parseV2Beta1JourneyArtifact(bad.journey), /beta1_preview_sections_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_STAGE_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.stages[0].__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /beta1_stage_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_HUMAN_GATE_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.humanGate.__EXTRA__ = "rejected";
  bad.journeys.at(-1).humanGate.__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /beta1_human_gate_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_SHARED_ASSIST_OPTION_EXACT_KEYS_SERVER_CLIENT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[0].fieldAssist.workingTitle[0].__EXTRA__ = "rejected";
  bad.journeys.at(-1).directions[0].fieldAssist.workingTitle[0].__EXTRA__ = "rejected";
  assert.throws(() => contracts.validateProjectTruthSnapshot(bad), /beta1_assist_option_invalid/);
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_EVIDENCE_AUTHORITY_STRICT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.evidenceAuthority.summary.resultState = "OBSERVED";
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_HUMAN_DRAFT_HASH_STRICT", () => {
  const bad = structuredClone(journeySnapshot);
  bad.journey.directions[1].selectionArtifact.humanDraft.humanDraft += "未授權變更";
  assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: bad }), null);
});
gate("JOURNEY_NESTED_ADDITIVE_REJECTED", () => assert.equal(parseV2Beta1PostResponse({ ...journeyPost, snapshot: { ...journeySnapshot, journey: { ...journeySnapshot.journey, futureField: "ignored" } } }), null));

console.log(JSON.stringify({ status: "PASS", cases: cases.length, caseNames: cases, coercionsAccepted: 0, additiveUnrelatedFields: "DECLARED_OUTER_EXTENSION_ONLY", malformedSiblingIsolation: "NOT_APPLICABLE_SINGLE_SNAPSHOT", liveProviderCalls: 0 }));
