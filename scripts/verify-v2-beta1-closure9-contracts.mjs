import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
  BETTER_AUTH_URL: "http://beta1.local",
});

const [contracts, runtime, evidence, anchors, assist, client, scopeAuthority] = await Promise.all([
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/evidence-anchors.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/scope-authority.ts"),
]);

const groups = [];
const failures = [];
async function check(name, callback) {
  try { await callback(); groups.push(name); }
  catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure9_contract_failure" }); }
}

const scope = scopeAuthority.V2_BETA1_LOCAL_TRUSTED_SCOPE;
const resultMaterial = (content, materialId = "result-authority") => ({ materialId, kind: "RESULTS", title: "結果", content });
const citationMaterial = (content, materialId = "citation-authority") => ({ materialId, kind: "CITATION", title: "引用", content });
const structured = (claim = "結果並不支持無條件因果主張", citation = "Wang et al. (2024)") => `metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，95% CI [−0.52, −0.10]，${claim}，${citation}。`;

function rehashArtifact(artifact) {
  const { artifactHash: _artifactHash, ...core } = artifact;
  return { ...core, artifactHash: contracts.beta1Hash(core) };
}

function rehashSnapshot(snapshot) {
  const { contentHash: _contentHash, ...core } = snapshot;
  return { ...core, contentHash: contracts.beta1Hash(core) };
}

await check("CONTRACT_1_6_AND_OLDER_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.6.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const initial = runtime.createV2Beta1Coordinator().getSnapshot(`${scope}:closure9-version`);
  for (const staleVersion of ["old-mike-v2-beta1/1.5.0", "old-mike-v2-beta1/1.4.0", "old-mike-v2-beta1/1.3.0", "old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) {
    const { contentHash: _oldHash, ...core } = { ...initial, contractVersion: staleVersion };
    assert.throws(() => contracts.validateProjectTruthSnapshot({ ...core, contentHash: contracts.beta1Hash(core) }), /beta1_snapshot_invalid/u);
  }
});

await check("TYPED_CLAUSE_IR_AND_ORDER_INDEPENDENT_RESULT_STATE", async () => {
  assert.equal(typeof anchors.extractV2Beta1ClaimAuthority, "function");
  for (const value of [
    "Pending remains the statistical analysis.",
    "Awaiting completion is the analysis.",
    "The preliminary results await final analysis.",
    "To be completed after data lock is the statistical analysis.",
    "待完成者為統計分析。",
    "九月才會完成的是結果分析。",
    "初步結果仍待正式分析。",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), true, value);
  for (const value of [
    "預期結果與實際觀察一致，N=180。",
    "未完成作業組的實際觀察為82%，N=180。",
    "預期焦慮量表的實際觀察值為82%，N=180。",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), false, value);
  const authority = anchors.extractV2Beta1ClaimAuthority(`${structured()} 此研究背景限定於單一場域。`);
  assert.equal(authority.clauses.length >= 2, true);
  assert.equal(authority.clauses.every((clause) => ["RESULT_STATE", "EVIDENCE_CLAIM", "CONTEXT", "NONCLAIM"].includes(clause.classification)), true);
});

await check("TYPED_CITATION_INDEX_AND_INTERVAL_DISJOINTNESS", async () => {
  for (const falseIdentity of ["研究於2024年完成。", "Model (2024)", "Table（2024）", "Wave (2024)", "研究期別（2024）"]) {
    const materials = [resultMaterial(structured("結果顯示有限關聯", falseIdentity)), citationMaterial(falseIdentity)];
    assert.equal(evidence.hasV2Beta1TraceableCitationIdentity(materials), false, falseIdentity);
  }
  for (const interval of ["CI [2,8]", "信賴區間［2，8］", "區間 (2, 8)"]) {
    const authority = anchors.extractV2Beta1CitationIdentityAuthority(interval);
    assert.deepEqual(authority.numericMarkers, [], interval);
  }
  for (const identity of ["doi:10.1000/example", "arXiv:2401.01234", "Wang et al. (2024)", "王等（2024）"]) {
    assert.equal(evidence.hasV2Beta1TraceableCitationIdentity([resultMaterial(structured("結果顯示有限關聯", identity)), citationMaterial(identity)]), true, identity);
  }
  assert.equal(evidence.hasV2Beta1TraceableCitationIdentity([resultMaterial(structured("結果顯示有限關聯", "[2]")), citationMaterial("[2] Wang et al. (2024), doi:10.1000/example")]), true);
});

await check("CLAIM_BIJECTION_CAUSAL_GENERALIZATION_AND_SCOPE", async () => {
  const source = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31 lacks evidence for causality；OR = 1.40 appears uncertain；N=180，p≤.05，Wang et al. (2024)。";
  const valid = "For metricId=engagement cohortId=A timepoint=post analysisId=main, β = −0.31 lacks evidence for causality, whereas OR = 1.40 appears uncertain; N=180, p≤.05, and Wang et al. (2024) bind this cautious interpretation.";
  const relocated = "For metricId=engagement cohortId=A timepoint=post analysisId=main, β = −0.31 appears uncertain, whereas OR = 1.40 lacks evidence for causality; N=180, p≤.05, and Wang et al. (2024) bind this cautious interpretation.";
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, valid), true);
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, relocated), false);
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, `${valid} This result proves universal benefit across all populations.`), false);
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, `${valid} The intervention certainly causes improvement.`), false);
});

await check("TYPED_PROPOSITION_REJECTS_ANCHOR_DUMP_AND_PADDING", async () => {
  const source = structured();
  const dump = `${source.slice(0, -1)}；研究結果顯示各項數值具有一致意義，資料支持後續研究判斷，並可作為審慎推論的基礎。`;
  const natural = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 的同一觀察中，β = −0.31 與 N=180、p≤.05、95% CI [−0.52, −0.10] 共同顯示結果並不支持無條件因果主張；Wang et al. (2024) 使此有限推論可追溯且可反駁。";
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, dump), false);
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, natural), true);
});

await check("SERVER_CLIENT_EXACT_NESTED_PARITY_WITH_OUTER_EXTENSION", async () => {
  const materials = [
    { materialId: "c9-abstract", kind: "ABSTRACT", title: "摘要", content: "本研究檢驗證據校準與任務表現，推論受材料界線約束。" },
    { materialId: "c9-introduction", kind: "INTRODUCTION", title: "引言", content: "既有研究需說明證據校準如何連結學習策略與任務表現。" },
    { materialId: "c9-methods", kind: "METHODS", title: "方法", content: "採準實驗混合方法，保留主要替代解釋。" },
    { materialId: "c9-results", kind: "RESULTS", title: "結果", content: structured("結果並不支持無條件因果主張", "[2]") },
    { materialId: "c9-statistics", kind: "STATISTICS", title: "統計", content: structured("結果並不支持無條件因果主張", "[2]") },
    { materialId: "c9-discussion", kind: "NOTE", title: "Discussion", content: "討論只解釋已觀察差異並保留限制。" },
    { materialId: "c9-conclusion", kind: "NOTE", title: "Conclusion", content: "結論不超越現有結果。" },
    { materialId: "c9-citation", kind: "CITATION", title: "引用", content: "[2] Wang et al. (2024), doi:10.1000/example" },
  ];
  const coordinator = runtime.createV2Beta1Coordinator();
  const currentScope = `${scope}:closure9-parity`;
  const initial = coordinator.getSnapshot(currentScope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure9-parity", entryMode: "PARTIAL_MATERIAL", outputTarget: "SSCI", researchDirection: "證據校準與任務表現", materials });
  const outcome = await coordinator.runJourney(request, currentScope);
  const payload = { ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: outcome.snapshot, previewInsight: runtime.createSyntheticBeta1Insight("Closure 9 client parity"), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0, extensions: { fixture: "allowed-unrelated" } };
  assert.notEqual(client.parseV2Beta1GetResponse(payload), null);
  const nestedSnapshot = structuredClone(outcome.snapshot);
  nestedSnapshot.journey.journal.priorityFindings[0].revisions[0].claimIrExtension = { unsupported: true };
  nestedSnapshot.journeys[0].journal.priorityFindings[0].revisions[0].claimIrExtension = { unsupported: true };
  assert.equal(client.parseV2Beta1GetResponse({ ...payload, snapshot: nestedSnapshot }), null);
});

await check("HISTORY_UNKNOWN_CONCURRENCY_AND_ASSIST_REGRESSION", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure9-history`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure9-history", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "型別化主張與證據完整性", materials: [] });
  const completed = await coordinator.runJourney(request, `${scope}:closure9-history`);
  assert.equal(completed.snapshot.effectReceipts[0].generatedArtifactHash, completed.snapshot.journey.artifactHash);
  const journey = completed.snapshot.journey;
  const options = journey.directions.flatMap((direction) => Object.values(direction.fieldAssist).flat());
  assert.equal(options.length, 117);
  for (const option of options) assert.equal(assist.validateV2Beta1AssistOptionContent(option), true);

  let attempts = 0;
  const unknown = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "UNKNOWN"; } });
  const unknownScope = `${scope}:closure9-unknown`;
  const unknownRequest = runtime.createV2Beta1JourneyRequest(unknown.getSnapshot(unknownScope), { suffix: "closure9-unknown", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "未知完成不得重送", materials: [] });
  await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(attempts, 1);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 7);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
