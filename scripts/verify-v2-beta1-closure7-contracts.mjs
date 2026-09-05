import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
  BETTER_AUTH_URL: "http://beta1.local",
});

const [contracts, runtime, history, evidence, clauses, assist, client, adapters, routes, scopeAuthority] = await Promise.all([
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/history-authority.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/evidence-anchors.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/journey-adapters.ts"),
  import("../lib/v2-beta1/route-handlers.ts"),
  import("../lib/v2-beta1/scope-authority.ts"),
]);

const failures = [];
const groups = [];
async function check(name, callback) {
  try { await callback(); groups.push(name); }
  catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure7_contract_failure" }); }
}

const scope = scopeAuthority.V2_BETA1_LOCAL_TRUSTED_SCOPE;
function rehashSnapshot(snapshot) {
  const { contentHash: _oldHash, ...core } = snapshot;
  snapshot.contentHash = contracts.beta1Hash(core);
  return snapshot;
}
function assistParent(direction, journey) {
  return {
    direction: {
      lane: direction.lane,
      directionHash: direction.directionHash,
      inputBundleHash: direction.inputBundleHash,
      title: direction.title,
      researchQuestion: direction.researchQuestion,
      mechanism: direction.mechanism,
      contribution: direction.contribution,
      method: direction.method,
      s0: direction.s0,
    },
    domain: { label: journey.researchDomain.label, selectionHash: journey.researchDomain.selectionHash },
    outputTarget: journey.outputTarget,
  };
}
function routeRequest(body) {
  return new Request("http://beta1.local/api/v2-beta1/project-truth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://beta1.local",
      "x-old-mike-v2-workspace": scopeAuthority.V2_BETA1_LOCAL_WORKSPACE_AUTHORITY,
    },
    body: JSON.stringify(body),
  });
}

await check("CONTRACT_1_4_AND_OLDER_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.4.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const initial = runtime.createV2Beta1Coordinator().getSnapshot(`${scope}:closure7-version`);
  for (const staleVersion of ["old-mike-v2-beta1/1.3.0", "old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) {
    const { contentHash: _oldHash, ...core } = { ...initial, contractVersion: staleVersion };
    assert.throws(() => contracts.validateProjectTruthSnapshot({ ...core, contentHash: contracts.beta1Hash(core) }), /beta1_snapshot_invalid/u);
  }
});

await check("COMPLETED_JOURNEY_HISTORY_AND_PREFIX_IMMUTABILITY", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure7-history`);
  const requestA = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure7-history-a", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準與學習投入的可觀察關聯", materials: [] });
  const resultA = await coordinator.runJourney(requestA, `${scope}:closure7-history`);
  const receipt = resultA.snapshot.effectReceipts[0];
  const forgedIntent = {
    scope: receipt.scope,
    projectId: receipt.projectId,
    operation: receipt.operation,
    requestId: receipt.requestId,
    idempotencyKey: receipt.idempotencyKey,
    requestHash: receipt.requestHash,
    payloadHash: receipt.payloadHash,
    generatedArtifactHash: "f".repeat(64),
    baseRevision: receipt.baseRevision,
    baseContentHash: receipt.baseContentHash,
  };
  const forgedEntry = history.createV2Beta1HistoryEntry({ intent: forgedIntent, completionClass: "COMPLETE", sequence: 1 });
  const forgedSnapshot = rehashSnapshot({ ...structuredClone(resultA.snapshot), effectReceipts: [forgedEntry.receipt], timeline: [forgedEntry.event] });
  assert.throws(() => contracts.validateProjectTruthSnapshot(forgedSnapshot), /beta1_journey_history_artifact_mismatch/u);

  const requestB = runtime.createV2Beta1JourneyRequest(resultA.snapshot, { suffix: "closure7-history-b", entryMode: "KEYWORD", outputTarget: "NSTC", researchDirection: "證據校準與研究設計的可反駁機制", materials: [] });
  const generatedB = adapters.runV2Beta1ThinAdapters(requestB, requestB.researchDomain);
  const resultB = await coordinator.runJourney(requestB, `${scope}:closure7-history`);
  const rewrittenPrefix = rehashSnapshot(structuredClone(resultB.snapshot));
  rewrittenPrefix.journeys[0] = structuredClone(resultB.snapshot.journeys[1]);
  rehashSnapshot(rewrittenPrefix);
  assert.throws(() => history.validateV2Beta1AuthoritativeTransition({ trustedScope: `${scope}:closure7-history`, previousSnapshot: resultA.snapshot, submittedRequest: requestB, nextSnapshot: rewrittenPrefix, completionClass: "COMPLETE", selectedDirectionHash: generatedB.artifact.selectedDirectionHash, generatedArtifactHash: generatedB.artifact.artifactHash }), /beta1_transition_projection_invalid/u);
});

await check("REQUEST_CORRELATED_503_ARTIFACT_HASH", async () => {
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => "UNKNOWN", beforeJourneyCommit: async () => "COMPLETE" });
  const handlers = routes.createV2Beta1RouteHandlers({ coordinator, previewInsight: runtime.createSyntheticBeta1Insight });
  const initial = coordinator.getSnapshot(scope);
  const unknownRequest = runtime.createV2Beta1ImportRequest(initial, runtime.createSyntheticBeta1Insight("Closure 7 request-correlated UNKNOWN"), "closure7-correlated");
  const first = await handlers.POST(routeRequest(unknownRequest));
  assert.equal(first.status, 503);
  assert.equal((await first.json()).generatedArtifactHash, null);

  const afterUnknown = coordinator.getSnapshot(scope);
  const journeyRequest = runtime.createV2Beta1JourneyRequest(afterUnknown, { suffix: "closure7-after-unknown", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "不相關旅程不得污染前一個 UNKNOWN 回應", materials: [] });
  const completed = await handlers.POST(routeRequest(journeyRequest));
  assert.equal(completed.status, 200);

  const repeated = await handlers.POST(routeRequest(unknownRequest));
  assert.equal(repeated.status, 503);
  const repeatedBody = await repeated.json();
  assert.equal(repeatedBody.completionClass, "COMPLETION_UNKNOWN");
  assert.equal(repeatedBody.generatedArtifactHash, null);
});

await check("BOUNDED_RESULT_STATE_GRAMMAR", async () => {
  for (const value of [
    "Statistical analysis is still in progress.",
    "Results are scheduled for September analysis completion.",
    "Results will be analyzed after data lock.",
    "統計分析仍在進行。",
    "結果預定於九月完成分析。",
    "結果將於資料鎖定後分析。",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), true, value);
  for (const value of [
    "未完成作業組的觀察值為82%，N=180，[1]。",
    "預期焦慮量表的觀察值為82%，N=180，[1]。",
    "將領壓力為82%，N=180，[1]。",
    "Future orientation was observed at 82%, N=180 [1].",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), false, value);
});

await check("FOUR_DIMENSION_AND_P_CONSTRAINT_REGRESSION", async () => {
  const row = (materialId, cohortId, p) => ({ materialId, kind: "STATISTICS", title: "統計結果", content: `metricId=engagement cohortId=${cohortId} timepoint=post analysisId=main；β = −0.31，N=180，${p}，結果並不支持無條件因果主張，[1]。` });
  const compatible = evidence.classifyV2Beta1ResultEvidence([row("stat-a", "A", "p≤.05"), row("stat-b", "A", "p<.04")]);
  assert.deepEqual({ classification: compatible.classification, consistencyProven: compatible.consistencyProven }, { classification: "OBSERVED", consistencyProven: true });
  const conflict = evidence.classifyV2Beta1ResultEvidence([row("stat-c", "A", "p≤.05"), row("stat-d", "A", "p=.20")]);
  assert.equal(conflict.classification, "CONFLICT");
  const differentCohort = evidence.classifyV2Beta1ResultEvidence([row("stat-e", "A", "p≤.05"), row("stat-f", "B", "p=.20")]);
  assert.deepEqual({ classification: differentCohort.classification, consistencyProven: differentCohort.consistencyProven }, { classification: "OBSERVED", consistencyProven: false });
});

await check("STRUCTURED_EVIDENCE_RECORDS_RAW_SPANS_AND_RELOCATION", async () => {
  assert.equal(typeof clauses.extractV2Beta1StructuredEvidenceRecords, "function");
  const fullwidth = "ｍｅｔｒｉｃＩｄ＝engagement ｃｏｈｏｒｔＩｄ＝A ｔｉｍｅｐｏｉｎｔ＝post ａｎａｌｙｓｉｓＩｄ＝main；β＝−０．３１，Ｎ＝１８０，ｐ≤．０５，９５％ CI［−０．５２，−０．１０］，doi.org/10.1000/example，（王等，２０２４），結果並不支持無條件因果主張。";
  const authority = clauses.extractV2Beta1StructuredEvidenceRecords(fullwidth);
  assert.equal(authority.records.length, 1);
  assert.deepEqual(Object.keys(authority.records[0]).sort(), ["citationSpans", "confidenceIntervalSpans", "effects", "effectSpans", "observationKey", "observationKeySpans", "probabilitySpans", "raw", "rawAnchors", "recordHash", "sampleSizeSpans", "scopeSpans", "structured"].sort());
  assert.equal(authority.records[0].structured, true);
  assert.deepEqual(authority.records[0].observationKey, { metricId: "engagement", cohortId: "a", timepoint: "post", analysisId: "main" });
  for (const raw of ["β＝−０．３１", "Ｎ＝１８０", "ｐ≤．０５", "９５％ CI［−０．５２，−０．１０］", "（王等，２０２４）", "結果並不支持無條件因果主張"]) assert.equal(authority.records[0].rawAnchors.includes(raw), true, raw);

  const source = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，結果並不支持無條件外推。metricId=completion cohortId=B timepoint=post analysisId=main；OR = 1.40，N=180，p=.20，結果可能支持有限關聯。";
  const valid = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 所界定的觀察中，β = −0.31、N=180 與 p≤.05 顯示結果並不支持無條件外推，因此推論維持審慎。就 metricId=completion cohortId=B timepoint=post analysisId=main 而言，OR = 1.40、N=180 與 p=.20 顯示結果可能支持有限關聯，仍須核對替代解釋。";
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, valid), true);
  const relocated = "metricId=engagement cohortId=A timepoint=post analysisId=main 與 metricId=completion cohortId=B timepoint=post analysisId=main；OR = 1.40，N=180，p=.20，結果並不支持無條件外推。metricId=engagement cohortId=A timepoint=post analysisId=main 與 metricId=completion cohortId=B timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，結果可能支持有限關聯。";
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, relocated), false);
});

await check("UNSTRUCTURED_EVIDENCE_FAIL_CLOSED_AND_PROSE_GATE", async () => {
  const source = "結果顯示介入組表現為82%，N=180，p≤.05，[2]。";
  const tokenList = clauses.extractV2Beta1EvidenceAnchors(source).join("；");
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, tokenList), false);
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, "介入組呈現有限關聯，推論仍須審慎。N=180，p≤.05，[2]。"), false);
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, `${source} 這項可追溯觀察僅支持介入組在既定量測下的有限關聯，不能據此推論為無條件因果效果。`), true);
  const unstructured = evidence.classifyV2Beta1ResultEvidence([
    { materialId: "result-unstructured-a", kind: "RESULTS", title: "結果", content: source },
    { materialId: "result-unstructured-b", kind: "TABLE", title: "表格", content: source },
  ]);
  assert.deepEqual({ classification: unstructured.classification, consistencyProven: unstructured.consistencyProven }, { classification: "OBSERVED", consistencyProven: false });
});

await check("UNSTRUCTURED_PRODUCT_REVISION_PRESERVES_CLAUSE_NOT_TOKEN_LIST", async () => {
  const materials = [
    { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要", content: "本研究檢驗證據校準與任務表現，推論受材料界線約束。" },
    { materialId: "material-introduction", kind: "INTRODUCTION", title: "引言", content: "既有研究需說明證據校準如何連結學習策略與任務表現。" },
    { materialId: "material-methods", kind: "METHODS", title: "方法", content: "採準實驗混合方法，保留主要替代解釋。" },
    { materialId: "material-results", kind: "RESULTS", title: "結果", content: "結果顯示介入組表現為82%，N=180，p≤.05，[2]。" },
    { materialId: "material-discussion", kind: "NOTE", title: "Discussion", content: "討論只解釋已觀察差異。" },
    { materialId: "material-conclusion", kind: "NOTE", title: "Conclusion", content: "結論不超越現有結果。" },
    { materialId: "material-citation", kind: "CITATION", title: "引用", content: "[2] 仍須獨立核對存在性與脈絡。" },
  ];
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure7-unstructured-product`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure7-unstructured-product", entryMode: "PARTIAL_MATERIAL", outputTarget: "SSCI", researchDirection: "證據校準與任務表現", materials });
  const outcome = await coordinator.runJourney(request, `${scope}:closure7-unstructured-product`);
  const finding = outcome.snapshot.journey.journal.priorityFindings.find((item) => item.location === "RESULTS");
  for (const revision of finding.revisions) {
    assert.equal(revision.text.includes(finding.sourceText), true);
    assert.equal(clauses.validateV2Beta1AcademicProposition(revision.text), true);
    assert.notEqual(revision.text, clauses.extractV2Beta1EvidenceAnchors(finding.sourceText).join("；"));
  }
});

await check("STRUCTURED_PRODUCT_FINAL_AND_REVISION_INTEGRITY", async () => {
  const resultA = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，95% CI [−0.52, −0.10]，結果並不支持無條件因果主張，[2]。";
  const resultB = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p<.04，95% CI [−0.52, −0.10]，結果並不支持無條件因果主張，[2]。";
  const materials = [
    { materialId: "structured-abstract", kind: "ABSTRACT", title: "摘要", content: "本研究檢驗證據校準與任務表現，推論受材料界線約束。" },
    { materialId: "structured-introduction", kind: "INTRODUCTION", title: "引言", content: "既有研究需說明證據校準如何連結學習策略與任務表現。" },
    { materialId: "structured-methods", kind: "METHODS", title: "方法", content: "採準實驗混合方法，保留主要替代解釋。" },
    { materialId: "structured-results", kind: "RESULTS", title: "結果", content: resultA },
    { materialId: "structured-statistics", kind: "STATISTICS", title: "統計", content: resultB },
    { materialId: "structured-discussion", kind: "NOTE", title: "Discussion", content: "討論只解釋已觀察差異並保留限制。" },
    { materialId: "structured-conclusion", kind: "NOTE", title: "Conclusion", content: "結論不超越現有結果。" },
    { materialId: "structured-citation", kind: "CITATION", title: "引用", content: "[2] 仍須獨立核對存在性與脈絡。" },
  ];
  const readiness = evidence.assessV2Beta1PublicationReadiness(materials);
  assert.deepEqual({ classification: readiness.resultEvidence.classification, consistencyProven: readiness.resultEvidence.consistencyProven, publicationUsable: readiness.publicationUsable, reviewStatus: readiness.reviewStatus }, { classification: "OBSERVED", consistencyProven: true, publicationUsable: true, reviewStatus: "FINAL_CONFIRMABLE" });
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure7-structured-product`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure7-structured-product", entryMode: "PARTIAL_MATERIAL", outputTarget: "SSCI", researchDirection: "證據校準與任務表現", materials });
  const outcome = await coordinator.runJourney(request, `${scope}:closure7-structured-product`);
  const journal = outcome.snapshot.journey.journal;
  assert.equal(journal.publicationUsable, true);
  assert.equal(journal.reviewStatus, "FINAL_CONFIRMABLE");
  const finding = journal.priorityFindings.find((item) => item.location === "RESULTS");
  for (const revision of finding.revisions) {
    assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(finding.sourceText, revision.text), true);
    assert.equal(clauses.validateV2Beta1AcademicProposition(revision.text), true);
  }
});

await check("ASSIST_FACTORY_FROZEN_REGRESSION", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure7-assist`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure7-assist", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準如何影響高等教育學習者任務表現", materials: [] });
  const outcome = await coordinator.runJourney(request, `${scope}:closure7-assist`);
  const journey = outcome.snapshot.journey;
  const options = journey.directions.flatMap((direction) => Object.values(direction.fieldAssist).flat());
  assert.equal(options.length, 117);
  assert.equal(options.filter((option) => option.field !== "domain" && option.field !== "outputTrack").length, 99);
  assert.equal(options.filter((option) => option.field === "domain" || option.field === "outputTrack").length, 18);
  for (const direction of journey.directions) {
    const parent = assistParent(direction, journey);
    for (const field of contracts.S0_FIELD_NAMES) assert.deepEqual(direction.fieldAssist[field], assist.createV2Beta1AssistOptions(parent, field));
  }
});

await check("UNKNOWN_REPLAY_NEW_KEY_AND_CONCURRENCY_NO_RESEND", async () => {
  let unknownAttempts = 0;
  const unknownCoordinator = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { unknownAttempts += 1; return "UNKNOWN"; } });
  const unknownScope = `${scope}:closure7-unknown-regression`;
  const initial = unknownCoordinator.getSnapshot(unknownScope);
  const first = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure7-unknown-a", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "同一研究譜系不得在未知完成後重送", materials: [] });
  await assert.rejects(unknownCoordinator.runJourney(first, unknownScope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(unknownCoordinator.runJourney(first, unknownScope), /beta1_completion_unknown_no_resend/u);
  const current = unknownCoordinator.getSnapshot(unknownScope);
  const newKey = runtime.createV2Beta1JourneyRequest(current, { suffix: "closure7-unknown-b", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "同一研究譜系不得在未知完成後重送", materials: [] });
  await assert.rejects(unknownCoordinator.runJourney(newKey, unknownScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(unknownAttempts, 1);

  let release;
  let entered;
  const enteredPromise = new Promise((resolve) => { entered = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  let concurrentAttempts = 0;
  const concurrentCoordinator = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { concurrentAttempts += 1; entered(); await releasePromise; return "COMPLETE"; } });
  const concurrentScope = `${scope}:closure7-concurrency`;
  const concurrentInitial = concurrentCoordinator.getSnapshot(concurrentScope);
  const requestA = runtime.createV2Beta1JourneyRequest(concurrentInitial, { suffix: "closure7-concurrent-a", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "第一個同版研究旅程", materials: [] });
  const requestB = runtime.createV2Beta1JourneyRequest(concurrentInitial, { suffix: "closure7-concurrent-b", entryMode: "KEYWORD", outputTarget: "NSTC", researchDirection: "第二個同版研究旅程", materials: [] });
  const running = concurrentCoordinator.runJourney(requestA, concurrentScope);
  await enteredPromise;
  await assert.rejects(concurrentCoordinator.runJourney(requestB, concurrentScope), /beta1_concurrent_state_conflict/u);
  release();
  await running;
  assert.equal(concurrentAttempts, 1);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 11);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
