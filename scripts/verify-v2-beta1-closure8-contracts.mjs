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
  catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure8_contract_failure" }); }
}

const scope = scopeAuthority.V2_BETA1_LOCAL_TRUSTED_SCOPE;
const structured = (effect = "β = −0.31", scopeText = "結果並不支持無條件因果主張", citation = "Wang et al. (2024)") => `metricId=engagement cohortId=A timepoint=post analysisId=main；${effect}，N=180，p≤.05，95% CI [−0.52, −0.10]，${scopeText}，${citation}。`;
const citationMaterial = (content) => ({ materialId: "citation-authority", kind: "CITATION", title: "引用", content });
const resultMaterial = (content, materialId = "result-authority") => ({ materialId, kind: "RESULTS", title: "結果", content });

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

await check("CONTRACT_1_5_AND_OLDER_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.5.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const initial = runtime.createV2Beta1Coordinator().getSnapshot(`${scope}:closure8-version`);
  for (const staleVersion of ["old-mike-v2-beta1/1.4.0", "old-mike-v2-beta1/1.3.0", "old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) {
    const { contentHash: _oldHash, ...core } = { ...initial, contractVersion: staleVersion };
    assert.throws(() => contracts.validateProjectTruthSnapshot({ ...core, contentHash: contracts.beta1Hash(core) }), /beta1_snapshot_invalid/u);
  }
});

await check("CLAUSE_SCOPED_PLANNED_STATE_BIDIRECTIONAL", async () => {
  for (const value of [
    "結果預計於九月完成分析。",
    "統計分析仍待完成。",
    "資料分析仍未完成。",
    "分析尚在進行中。",
    "Analysis remains pending.",
    "Statistical analysis remains in progress.",
    "Analysis remains incomplete.",
    "Analysis has yet to be completed.",
    "Preliminary analysis is pending completion.",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), true, value);
  for (const value of [
    "預期結果與實際觀察一致，N=180。",
    "未完成作業組的實際觀察為82%，N=180。",
    "預期焦慮量表的觀察值為82%，N=180。",
    "Future orientation was observed at 82%, N=180.",
  ]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), false, value);
});

await check("CITATION_IDENTITY_DISJOINT_FROM_CI", async () => {
  const ciOnly = [resultMaterial("metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，95% CI [2,8]，結果顯示有限關聯。"), citationMaterial("")];
  assert.equal(evidence.classifyV2Beta1ResultEvidence(ciOnly).traceable, false);
  assert.equal(evidence.assessV2Beta1PublicationReadiness(ciOnly).publicationUsable, false);
  const emptyCitation = [resultMaterial(structured("β = −0.31", "結果顯示有限關聯", "")), citationMaterial("   ")];
  assert.equal(evidence.classifyV2Beta1ResultEvidence(emptyCitation).traceable, false);
  for (const content of [
    "doi:10.1000/example",
    "Wang et al. (2024)",
    "arXiv:2401.01234",
  ]) assert.equal(evidence.classifyV2Beta1ResultEvidence([resultMaterial(structured("β = −0.31", "結果顯示有限關聯", content)), citationMaterial(content)]).traceable, true, content);
  const boundNumeric = [resultMaterial(structured("β = −0.31", "結果顯示有限關聯", "[2]")), citationMaterial("[2] Wang et al. (2024), doi:10.1000/example")];
  assert.equal(evidence.classifyV2Beta1ResultEvidence(boundNumeric).traceable, true);
  const record = anchors.extractV2Beta1StructuredEvidenceRecords("metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，95% CI [2,8]，結果顯示有限關聯。").records[0];
  assert.deepEqual(record.citationSpans, []);
});

await check("STRUCTURED_RECORD_BIJECTION", async () => {
  const source = structured();
  const valid = `在 ${source.slice(0, -1)}；此完整觀察支持有限且可追溯的學術命題，推論仍受既定證據界線約束。`;
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, valid), true);
  const extra = `${valid} metricId=retention cohortId=B timepoint=post analysisId=secondary；OR = 1.80，N=90，p=.01，結果顯示額外效果，Wang et al. (2024)。`;
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, extra), false);
  const duplicate = `${valid} ${valid}`;
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, duplicate), false);
  const contradictory = `${valid} metricId=engagement cohortId=A timepoint=post analysisId=main；β = 0.45，N=180，p≤.05，95% CI [0.20, 0.70]，結果顯示正向效果，Wang et al. (2024)。`;
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, contradictory), false);
});

await check("PER_EFFECT_SCOPE_BINDING", async () => {
  const source = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，結果並不支持無條件因果主張；OR = 1.40，結果可能支持有限關聯；N=180，p≤.05，Wang et al. (2024)。";
  const valid = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 的觀察中，β = −0.31 所對應的結果並不支持無條件因果主張，而 OR = 1.40 所對應的結果可能支持有限關聯；N=180、p≤.05 與 Wang et al. (2024) 共同界定此審慎命題。";
  const relocated = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 的觀察中，β = −0.31 所對應的結果可能支持有限關聯，而 OR = 1.40 所對應的結果並不支持無條件因果主張；N=180、p≤.05 與 Wang et al. (2024) 共同界定此審慎命題。";
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, valid), true);
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, relocated), false);
});

await check("PER_RECORD_PROPOSITION_AND_ANCHOR_DOMINANCE", async () => {
  const source = structured();
  const tokenList = anchors.extractV2Beta1EvidenceAnchors(source).join("；");
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, tokenList), false);
  const genericPadding = "metricId=engagement；cohortId=A；timepoint=post；analysisId=main；β = −0.31；N=180；p≤.05；95% CI [−0.52, −0.10]；結果並不支持無條件因果主張；Wang et al. (2024)；結果顯示上述資訊支持有限推論，研究結果仍須審慎解讀並維持學術判斷。";
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, genericPadding), false);
  const natural = `在 ${source.slice(0, -1)}；此組完整觀察顯示介入效果方向與估計值皆受同一分析界線約束，因此僅支持審慎且可反駁的學術推論。`;
  assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, natural), true);
  const fullwidth = "ｍｅｔｒｉｃＩｄ＝engagement ｃｏｈｏｒｔＩｄ＝A ｔｉｍｅｐｏｉｎｔ＝post ａｎａｌｙｓｉｓＩｄ＝main；β＝−０．３１，Ｎ＝１８０，ｐ≤．０５，９５％ CI［−０．５２，−０．１０］，（王等，２０２４），結果並不支持無條件因果主張。";
  const record = anchors.extractV2Beta1StructuredEvidenceRecords(fullwidth).records[0];
  for (const raw of ["β＝−０．３１", "Ｎ＝１８０", "ｐ≤．０５", "９５％ CI［−０．５２，−０．１０］", "（王等，２０２４）"]) assert.equal(record.rawAnchors.includes(raw), true, raw);
});

await check("SERVER_CLIENT_SHARED_PUBLICATION_PARITY", async () => {
  const resultA = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p≤.05，95% CI [−0.52, −0.10]，結果並不支持無條件因果主張，[2]。";
  const resultB = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，N=180，p<.04，95% CI [−0.52, −0.10]，結果並不支持無條件因果主張，[2]。";
  const materials = [
    { materialId: "c8-abstract", kind: "ABSTRACT", title: "摘要", content: "本研究檢驗證據校準與任務表現，推論受材料界線約束。" },
    { materialId: "c8-introduction", kind: "INTRODUCTION", title: "引言", content: "既有研究需說明證據校準如何連結學習策略與任務表現。" },
    { materialId: "c8-methods", kind: "METHODS", title: "方法", content: "採準實驗混合方法，保留主要替代解釋。" },
    { materialId: "c8-results", kind: "RESULTS", title: "結果", content: resultA },
    { materialId: "c8-statistics", kind: "STATISTICS", title: "統計", content: resultB },
    { materialId: "c8-discussion", kind: "NOTE", title: "Discussion", content: "討論只解釋已觀察差異並保留限制。" },
    { materialId: "c8-conclusion", kind: "NOTE", title: "Conclusion", content: "結論不超越現有結果。" },
    { materialId: "c8-citation", kind: "CITATION", title: "引用", content: "[2] Wang et al. (2024), doi:10.1000/example" },
  ];
  const readiness = evidence.assessV2Beta1PublicationReadiness(materials);
  assert.deepEqual({ classification: readiness.resultEvidence.classification, consistencyProven: readiness.resultEvidence.consistencyProven, traceable: readiness.resultEvidence.traceable, publicationUsable: readiness.publicationUsable }, { classification: "OBSERVED", consistencyProven: true, traceable: true, publicationUsable: true });
  const coordinator = runtime.createV2Beta1Coordinator();
  const publicationScope = `${scope}:closure8-publication-parity`;
  const initial = coordinator.getSnapshot(publicationScope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure8-publication-parity", entryMode: "PARTIAL_MATERIAL", outputTarget: "SSCI", researchDirection: "證據校準與任務表現", materials });
  const outcome = await coordinator.runJourney(request, publicationScope);
  const journal = outcome.snapshot.journey.journal;
  assert.equal(journal.publicationUsable, true);
  for (const finding of journal.priorityFindings) for (const revision of finding.revisions) assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(finding.sourceText, revision.text), true);
  const getPayload = { ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: outcome.snapshot, previewInsight: runtime.createSyntheticBeta1Insight("Closure 8 client parity"), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  assert.notEqual(client.parseV2Beta1GetResponse(getPayload), null);
});

await check("HISTORY_UNKNOWN_CONCURRENCY_REGRESSION", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure8-history`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure8-history", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "共享證據完整性與研究推論校準", materials: [] });
  const completed = await coordinator.runJourney(request, `${scope}:closure8-history`);
  const receipt = completed.snapshot.effectReceipts[0];
  assert.equal(receipt.generatedArtifactHash, completed.snapshot.journey.artifactHash);
  assert.equal(receipt.payloadHash, completed.snapshot.journey.inputBundleHash);

  let attempts = 0;
  const unknown = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "UNKNOWN"; } });
  const unknownScope = `${scope}:closure8-unknown`;
  const unknownRequest = runtime.createV2Beta1JourneyRequest(unknown.getSnapshot(unknownScope), { suffix: "closure8-unknown", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "未知完成不得重送", materials: [] });
  await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(attempts, 1);
});

await check("ASSIST_FACTORY_117_FROZEN_REGRESSION", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure8-assist`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure8-assist", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "共享證據完整性與專業研究協作", materials: [] });
  const outcome = await coordinator.runJourney(request, `${scope}:closure8-assist`);
  const journey = outcome.snapshot.journey;
  const options = journey.directions.flatMap((direction) => Object.values(direction.fieldAssist).flat());
  assert.equal(options.length, 117);
  for (const direction of journey.directions) {
    const parent = assistParent(direction, journey);
    for (const field of contracts.S0_FIELD_NAMES) assert.deepEqual(direction.fieldAssist[field], assist.createV2Beta1AssistOptions(parent, field));
  }
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 9);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
