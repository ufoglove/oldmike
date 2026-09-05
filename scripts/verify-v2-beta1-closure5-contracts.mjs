import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
});

const [contracts, runtime, history, evidence, anchors, lineage, assist, client, observations] = await Promise.all([
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/history-authority.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/evidence-anchors.ts"),
  import("../lib/v2-beta1/journey-lineage.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/typed-observation-authority.ts"),
]);

const failures = [];
const groups = [];
async function check(name, callback) {
  try { await callback(); groups.push(name); }
  catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure5_contract_failure" }); }
}

const material = (kind, content, id = kind.toLowerCase(), title = kind) => ({ materialId: `material-${id}`, kind, title, content, contentHash: contracts.beta1Hash(content), evidenceState: "OBSERVED" });
const requestMaterial = ({ materialId, kind, title, content }) => ({ materialId, kind, title, content });
const postEnvelope = (snapshot, replayed = false) => ({ ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: snapshot.effectReceipts.at(-1)?.generatedArtifactHash ?? null, snapshot, replayed, effectSubmissionCount: replayed ? 0 : 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 });

await check("CONTRACT_1_3_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.3.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot("fixture-workspace-v2:closure5-version");
  for (const staleVersion of ["old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) {
    const staleCore = { ...initial, contractVersion: staleVersion };
    const stale = { ...staleCore, contentHash: contracts.beta1Hash(Object.fromEntries(Object.entries(staleCore).filter(([key]) => key !== "contentHash"))) };
    assert.throws(() => contracts.validateProjectTruthSnapshot(stale), /beta1_snapshot_invalid/u);
  }
});

await check("TRUSTED_TRANSITION_SCOPE_AND_CLIENT_POST", async () => {
  const scope = "fixture-workspace-v2:closure5-trusted";
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(scope);
  const request = runtime.createV2Beta1ImportRequest(initial, runtime.createSyntheticBeta1Insight("可信範圍與歷史 transition 驗證"), "closure5-trusted");
  const completed = await coordinator.importInsight(request, scope);
  assert.equal(history.validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: completed.snapshot, completionClass: "COMPLETE", generatedArtifactHash: null }).status, "PASS");
  assert.ok(client.parseV2Beta1PostResponse(postEnvelope(completed.snapshot), { trustedScope: scope, previousSnapshot: initial, submittedRequest: request }));

  const forgedScope = "fixture-workspace-v2:closure5-forged";
  const intent = history.createV2Beta1HistoryIntent({ scope: forgedScope, request });
  const pair = history.createV2Beta1HistoryEntry({ intent, completionClass: "UNKNOWN", sequence: 1 });
  const { contentHash: _contentHash, ...initialCore } = initial;
  const forged = contracts.createProjectTruthSnapshot({ ...initialCore, revision: 2, timeline: [pair.event], effectReceipts: [pair.receipt] });
  assert.equal(contracts.validateProjectTruthSnapshot(forged).revision, 2);
  assert.throws(() => history.validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: forged, completionClass: "UNKNOWN", generatedArtifactHash: null }), /beta1_transition_history_authority_invalid/u);
  assert.equal(client.parseV2Beta1PostResponse(postEnvelope(forged), { trustedScope: scope, previousSnapshot: initial, submittedRequest: request }), null);
});

await check("UNKNOWN_NO_RESEND_AND_UNRELATED_LINEAGE", async () => {
  let attempts = 0;
  const scope = "fixture-workspace-v2:closure5-unknown";
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { attempts += 1; return attempts === 1 ? "UNKNOWN" : "COMPLETE"; } });
  const initial = coordinator.getSnapshot(scope);
  const firstInsight = runtime.createSyntheticBeta1Insight("第一條 completion unknown 洞見");
  const first = runtime.createV2Beta1ImportRequest(initial, firstInsight, "closure5-unknown-a");
  await assert.rejects(coordinator.importInsight(first, scope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(coordinator.importInsight(first, scope), /beta1_completion_unknown_no_resend/u);
  const afterUnknown = coordinator.getSnapshot(scope);
  await assert.rejects(coordinator.importInsight(runtime.createV2Beta1ImportRequest(afterUnknown, firstInsight, "closure5-unknown-new-key"), scope), /beta1_completion_unknown_no_resend/u);
  assert.equal(attempts, 1);
  const unrelated = runtime.createSyntheticBeta1Insight("第二條互不相關且可完成的洞見");
  await coordinator.importInsight(runtime.createV2Beta1ImportRequest(afterUnknown, unrelated, "closure5-unrelated"), scope);
  assert.equal(attempts, 2);
});

await check("STATISTICAL_EVIDENCE_GRAMMAR_AND_4D_KEYS", async () => {
  for (const text of ["樣本 N=180，分析已完成。", "樣本 n = 180，分析已完成。", "樣本 Ｎ=180，分析已完成。"]) assert.equal(evidence.hasV2Beta1MissingResultMarker(text), false, text);
  for (const text of ["樣本 n=?", "樣本 N=待填", "樣本數 TBD", "樣本數 XXX"]) assert.equal(evidence.hasV2Beta1MissingResultMarker(text), true, text);
  for (const text of ["Results are not-yet available.", "Results are not–yet available.", "結果尚未完成。", "預計將進行分析。"] ) assert.equal(evidence.hasV2Beta1PlannedResultMarker(text), true, text);
  const compatible = evidence.classifyV2Beta1ResultEvidence([
    material("RESULTS", "metricId=engagement cohortId=A timepoint=post analysisId=main；結果顯示 N=180，p < .05，[1]。", "p1"),
    material("STATISTICS", "metricId=engagement cohortId=A timepoint=post analysisId=main；observed n=180，p≤.01，[1]。", "p2"),
  ]);
  assert.deepEqual([compatible.classification, compatible.consistencyProven], ["OBSERVED", true]);
  const conflict = evidence.classifyV2Beta1ResultEvidence([
    material("RESULTS", "metricId=engagement cohortId=A timepoint=post analysisId=main；結果顯示 N=180，p<.001，[1]。", "p3"),
    material("STATISTICS", "metricId=engagement cohortId=A timepoint=post analysisId=main；observed n=180，p = .20，[1]。", "p4"),
  ]);
  assert.equal(conflict.classification, "CONFLICT");
  const differentKey = evidence.classifyV2Beta1ResultEvidence([
    material("RESULTS", "metricId=engagement cohortId=A timepoint=post analysisId=main；結果顯示 N=180，p<.001，[1]。", "p5"),
    material("STATISTICS", "metricId=engagement cohortId=B timepoint=post analysisId=main；observed n=180，p=.20，[1]。", "p6"),
  ]);
  assert.deepEqual([differentKey.classification, differentKey.consistencyProven], ["OBSERVED", false]);
  const single = evidence.classifyV2Beta1ResultEvidence([material("RESULTS", "metricId=engagement；結果顯示 N=180，p<.05，[1]。", "single")]);
  assert.deepEqual([single.classification, single.consistencyProven], ["OBSERVED", false]);
});

await check("REVISION_RAW_EVIDENCE_ANCHORS", async () => {
  const source = "結果並不支持無條件外推；β = −0.31，N=180，p≤.05，95% CI [−0.52, −0.10]，DOI:10.1000/example，[2]，（王等，2024）。";
  const found = anchors.extractV2Beta1EvidenceAnchors(source);
  const required = ["β = −0.31", "N=180", "p≤.05", "95% CI [−0.52, −0.10]", "10.1000/example", "[2]", "（王等，2024）", "並不支持無條件外推"];
  for (const token of required) assert.equal(found.includes(token), true, token);
  const validRevision = `在證據限制下，${found.join("；")} 均維持原始形式，且結論仍受樣本與設計約束。`;
  assert.equal(anchors.validateV2Beta1RevisionAnchors(source, validRevision), true);
  for (const token of required) assert.equal(anchors.validateV2Beta1RevisionAnchors(source, validRevision.split(token).join("")), false, `deleted:${token}`);
});

await check("JOURNEY_LINEAGE_RECOMPUTATION_AND_FORGED_HASH", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const scope = "fixture-workspace-v2:closure5-lineage";
  const initial = coordinator.getSnapshot(scope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure5-lineage", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準如何影響高等教育學習者的任務表現", materials: [] });
  const result = await coordinator.runJourney(request, scope);
  for (const direction of result.snapshot.journey.directions) assert.equal(direction.inputBundleHash, lineage.deriveV2Beta1JourneyInputBundleHash({ ...request, observationEffectLineageHash: observations.deriveV2Beta1ObservationEffectLineageHash(request.observationConfirmation), selectedLane: direction.lane }, direction.directionHash));
  const forged = structuredClone(result.snapshot.journey);
  forged.directions[0].inputBundleHash = "f".repeat(64);
  assert.throws(() => contracts.parseV2Beta1JourneyArtifact(forged));
});

await check("ASSIST_39_PER_DIRECTION_SERVER_CLIENT_PARITY", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const scope = "fixture-workspace-v2:closure5-assist";
  const initial = coordinator.getSnapshot(scope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure5-assist", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準如何影響高等教育學習者的任務表現", materials: [] });
  const outcome = await coordinator.runJourney(request, scope);
  const directions = outcome.snapshot.journey.directions;
  const options = directions.flatMap((direction) => Object.values(direction.fieldAssist).flat());
  assert.deepEqual(directions.map((direction) => Object.values(direction.fieldAssist).flat().length), [39, 39, 39]);
  assert.equal(options.length, 117);
  assert.equal(new Set(options.map((option) => option.optionId)).size, 117);
  assert.equal(options.filter((option) => option.field !== "domain" && option.field !== "outputTrack").length, 99);
  assert.equal(options.every((option) => assist.validateV2Beta1AssistOptionContent(option)), true);
  assert.ok(client.parseV2Beta1PostResponse(postEnvelope(outcome.snapshot), { trustedScope: scope, previousSnapshot: initial, submittedRequest: request }));
  const option = structuredClone(options.find((item) => item.field === "methodIdea"));
  option.risk = "一般風險";
  const { optionHash: _hash, ...optionCore } = option;
  option.optionHash = contracts.beta1Hash(optionCore);
  assert.equal(assist.validateV2Beta1AssistOptionContent(option), false);
  const crossField = { ...options[0], field: "methodIdea" };
  assert.equal(assist.validateV2Beta1AssistOptionContent(crossField), false);
  const authorityFields = options.filter((option) => option.field === "domain" || option.field === "outputTrack");
  assert.equal(authorityFields.every((option) => option.field === "domain" ? option.applyValue === outcome.snapshot.journey.researchDomain.label : option.applyValue === outcome.snapshot.journey.outputTarget), true);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 7);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
