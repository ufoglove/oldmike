import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
});

const [{ createBuiltinDomainSelection }, contracts, runtime, evidence, history, client] = await Promise.all([
  import("../lib/v2-alpha3/contracts.ts"),
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/history-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
]);

const failures = [];
const groups = [];
async function check(name, callback) {
  try {
    await callback();
    groups.push(name);
  } catch (error) {
    failures.push({ name, code: error instanceof Error ? error.message : "closure4_contract_failure" });
  }
}

const scope = "fixture-workspace-v2:fixture-user-v2";
const domain = createBuiltinDomainSelection("ai-education");
const raw = (kind, content, id = kind.toLowerCase(), title = kind) => ({
  materialId: `material-${id}`,
  kind,
  title,
  content,
  contentHash: contracts.beta1Hash(content),
  evidenceState: "OBSERVED",
});
const requestMaterial = ({ materialId, kind, title, content }) => ({ materialId, kind, title, content });

function completeMaterials(results) {
  return [
    raw("ABSTRACT", "本研究檢驗生成式回饋、證據校準與任務表現，所有結論受來源界線限制。"),
    raw("INTRODUCTION", "既有研究尚未釐清生成式回饋、證據校準與任務表現之間的機制。"),
    raw("METHODS", "本研究採準實驗混合方法，事前界定樣本、量測、分析與替代解釋。"),
    ...results,
    raw("NOTE", "討論依已觀察結果解釋可能機制，且不超越樣本、場域及量測限制。", "discussion", "Discussion"),
    raw("NOTE", "結論僅涵蓋現有觀察，正式引用與可重現性仍須獨立稽核。", "conclusion", "Conclusion"),
    raw("CITATION", "[1] 僅作本機可追溯契約，存在性、詮釋與脈絡須獨立稽核。", "citation"),
  ];
}

function request(snapshot, suffix, materials) {
  return runtime.createV2Beta1JourneyRequest(snapshot, {
    suffix,
    entryMode: "PARTIAL_MATERIAL",
    outputTarget: "SSCI",
    researchDirection: "生成式回饋、證據校準與學習任務表現",
    researchDomain: domain,
    materials: materials.map(requestMaterial),
  });
}

await check("CONTRACT_VERSION_SINGLE_AUTHORITY_1_2_0", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.2.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
});

await check("CANONICAL_HISTORY_DERIVED_FIELDS_RECOMPUTED", async () => {
  const intent = {
    scope: `${scope}:history`,
    projectId: "project-beta1-closure4",
    operation: "IMPORT_CHAT_INSIGHT",
    requestId: "request-closure4-history",
    idempotencyKey: "idempotency-closure4-history",
    requestHash: contracts.beta1Hash({ request: "closure4" }),
    payloadHash: contracts.beta1Hash({ insight: "closure4" }),
    baseRevision: 1,
    baseContentHash: contracts.beta1Hash({ state: "initial" }),
  };
  const pair = history.createV2Beta1HistoryEntry({ intent, completionClass: "UNKNOWN", sequence: 1 });
  assert.equal(pair.receipt.scopeAuthority, contracts.beta1Hash({ authority: "PROJECT_TRUTH_SCOPE", scope: intent.scope, projectId: intent.projectId }));
  assert.equal("insightHash" in pair.receipt, false);
  assert.deepEqual(history.validateV2Beta1History({ projectId: intent.projectId, revision: 2, timeline: [pair.event], effectReceipts: [pair.receipt] }), { timeline: [pair.event], effectReceipts: [pair.receipt], trustClass: "INTERNAL_CONSISTENCY_ONLY" });

  for (const mutate of [
    (draft) => { draft.receipt.scopeHash = "0".repeat(64); draft.event.scopeHash = draft.receipt.scopeHash; },
    (draft) => { draft.receipt.effectLineageHash = "1".repeat(64); draft.event.effectLineageHash = draft.receipt.effectLineageHash; },
    (draft) => { draft.receipt.lineageHash = "2".repeat(64); draft.event.lineageHash = draft.receipt.lineageHash; },
    (draft) => { draft.receipt.effectId = "effect:tampered-authority"; draft.event.receiptId = draft.receipt.effectId; },
    (draft) => { draft.event.eventId = "event:tampered-authority"; },
  ]) {
    const coordinated = structuredClone(pair);
    mutate(coordinated);
    const { receiptHash: _receiptHash, ...receiptCore } = coordinated.receipt;
    const { eventHash: _eventHash, ...eventCore } = coordinated.event;
    coordinated.receipt.receiptHash = contracts.beta1Hash(receiptCore);
    coordinated.event.eventHash = contracts.beta1Hash(eventCore);
    assert.throws(() => history.validateV2Beta1History({ projectId: intent.projectId, revision: 2, timeline: [coordinated.event], effectReceipts: [coordinated.receipt] }), /beta1_history_derived_invalid/u);
  }

  let unknownAttempts = 0;
  const unknownCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { unknownAttempts += 1; return "UNKNOWN"; } });
  const unknownScope = `${scope}:unknown`;
  const initial = unknownCoordinator.getSnapshot(unknownScope);
  const insight = runtime.createSyntheticBeta1Insight("未知完成狀態必須維持同一洞見譜系且不得重送");
  const unknownRequest = runtime.createV2Beta1ImportRequest(initial, insight, "closure4-unknown");
  await assert.rejects(unknownCoordinator.importInsight(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  const afterUnknown = unknownCoordinator.getSnapshot(unknownScope);
  assert.equal(afterUnknown.effectReceipts.length, 1);
  assert.equal(afterUnknown.timeline.length, 1);
  await assert.rejects(unknownCoordinator.importInsight(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(unknownCoordinator.importInsight(runtime.createV2Beta1ImportRequest(afterUnknown, insight, "closure4-unknown-new-key"), unknownScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(unknownAttempts, 1);

  let concurrentAttempts = 0;
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  const concurrent = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { concurrentAttempts += 1; await hold; return "COMPLETE"; } });
  const concurrentScope = `${scope}:concurrent`;
  const concurrentInitial = concurrent.getSnapshot(concurrentScope);
  const concurrentInsight = runtime.createSyntheticBeta1Insight("兩個不同鍵不得讓同一洞見譜系進入兩次效果");
  const firstRequest = runtime.createV2Beta1ImportRequest(concurrentInitial, concurrentInsight, "closure4-concurrent-a");
  const first = concurrent.importInsight(firstRequest, concurrentScope);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(concurrent.importInsight(runtime.createV2Beta1ImportRequest(concurrentInitial, concurrentInsight, "closure4-concurrent-b"), concurrentScope), /beta1_completion_unknown_no_resend/u);
  release();
  await first;
  assert.equal(concurrentAttempts, 1);
  assert.equal((await concurrent.importInsight(firstRequest, concurrentScope)).replayed, true);
});

await check("METRIC_AWARE_EVIDENCE_CLASSIFICATION", async () => {
  const single = evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180，p<.001，95% CI [76%, 88%]；[1]。"),
  ]);
  assert.equal(single.classification, "OBSERVED");
  assert.equal(single.consistencyProven, false);
  assert.equal(single.traceable, true);

  const differentMetrics = evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180，p<.001，95% CI [76%, 88%]；[1]。"),
    raw("STATISTICS", "metricId=workload; cohortId=A; timepoint=post; analysisId=primary。工作負荷為 61%，N=180，p=.20，95% CI [55%, 67%]；[2]。", "different-metric"),
  ]);
  assert.equal(differentMetrics.classification, "OBSERVED");
  assert.equal(differentMetrics.consistencyProven, false);

  const pConflict = evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180，p<.001，95% CI [76%, 88%]；[1]。"),
    raw("STATISTICS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180，p=.20，95% CI [76%, 88%]；[1]。", "p-conflict"),
  ]);
  assert.equal(pConflict.classification, "CONFLICT");
  const differentCohorts = evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +6.5 分，N=90，p<.001，95% CI [2.1, 10.9]；[1]。"),
    raw("STATISTICS", "metricId=learning; cohortId=B; timepoint=post; analysisId=primary。學習表現下降 -3.2 分，N=90，p=.20，95% CI [-6.1, -0.3]；[2]。", "different-cohort"),
  ]);
  assert.equal(differentCohorts.classification, "OBSERVED");
  assert.equal(differentCohorts.consistencyProven, false);
  for (const conflict of [
    raw("STATISTICS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +8.5 分，N=180，p<.001，95% CI [2.1, 10.9]；[1]。", "effect-conflict"),
    raw("STATISTICS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +6.5 分，N=180，p<.001，95% CI [1.0, 9.0]；[1]。", "ci-conflict"),
  ]) assert.equal(evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +6.5 分，N=180，p<.001，95% CI [2.1, 10.9]；[1]。"),
    conflict,
  ]).classification, "CONFLICT");
  assert.equal(evidence.classifyV2Beta1ResultEvidence([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180；[1]。"),
    raw("STATISTICS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。預期學習表現為 82%，N=180；[1]。", "mixed-planned"),
  ]).classification, "PLANNED");
  assert.equal(evidence.classifyV2Beta1ResultEvidence([raw("RESULTS", "N=180，觀察已完成；[1]。")]).classification, "OBSERVED");
  assert.equal(evidence.classifyV2Beta1ResultEvidence([raw("RESULTS", "n=?；分析尚未完成。")]).classification, "MISSING");
});

await check("SHARED_PUBLICATION_AUTHORITY", async () => {
  assert.equal(typeof evidence.assessV2Beta1PublicationReadiness, "function");
  const observed = completeMaterials([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，N=180，p<.001，95% CI [76%, 88%]；[1]。"),
    raw("TABLE", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現為 82%，n=180，p<.001，95% CI [76%, 88%]；[1]。", "table"),
  ]);
  assert.deepEqual(evidence.assessV2Beta1PublicationReadiness(observed), {
    resultEvidence: evidence.classifyV2Beta1ResultEvidence(observed),
    requiredSectionsComplete: true,
    hasBlockingMarker: false,
    publicationUsable: true,
    reviewStatus: "FINAL_CONFIRMABLE",
  });
  const coordinator = runtime.createV2Beta1Coordinator();
  const runtimeScope = `${scope}:publication`;
  const initial = coordinator.getSnapshot(runtimeScope);
  const result = await coordinator.runJourney(request(initial, "closure4-publication", observed), runtimeScope);
  const envelope = { ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, snapshot: result.snapshot, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  assert.ok(client.parseV2Beta1PostResponse(envelope));

  const missing = completeMaterials([raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。N=?；分析尚未完成。")]);
  const missingReadiness = evidence.assessV2Beta1PublicationReadiness(missing);
  assert.equal(missingReadiness.resultEvidence.classification, "MISSING");
  assert.equal(missingReadiness.publicationUsable, false);
  assert.equal(missingReadiness.reviewStatus, "READY_WITH_GAPS");
});

await check("DIRECT_ASSIST_AND_STATISTICAL_TOKEN_PRESERVATION", async () => {
  const observed = completeMaterials([
    raw("RESULTS", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +6.5 分，N=180，p<.001，95% CI [2.1, 10.9]；[1]，且不支持無條件因果推論。"),
    raw("TABLE", "metricId=learning; cohortId=A; timepoint=post; analysisId=primary。學習表現提升 +6.5 分，n=180，p<.001，95% CI [2.1, 10.9]；[1]。", "table"),
  ]);
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:assist`);
  const runResult = await coordinator.runJourney(request(initial, "closure4-assist", observed), `${scope}:assist`);
  const artifact = runResult.snapshot.journey;
  assert.ok(artifact);
  const fieldShape = {
    workingTitle: /：/u,
    problemContext: /問題|張力|框架/u,
    targetUsers: /對象|樣本|群體/u,
    expectedContribution: /貢獻|證據鏈|機制/u,
    existingData: /現有|既有|材料|資料/u,
    availableData: /可用資料|可規劃|資料/u,
    methodIdea: /方法|設計|分析/u,
    timeline: /階段|里程碑|先導|步驟/u,
    constraints: /限制|風險/u,
    ethicsPrivacyRisks: /資料最小化|倫理|治理|知情同意/u,
    unresolvedItems: /尚待|仍須/u,
  };
  for (const direction of artifact.directions) {
    for (const field of contracts.S0_FIELD_NAMES) {
      const options = direction.fieldAssist[field];
      assert.equal(options.length, 3);
      if (field !== "domain" && field !== "outputTrack") {
        assert.equal(options.every((option) => !/(?:本欄|為基礎|只保留|重組為|建立跨域邊界|建議|請補|可加入)/u.test(option.applyValue)), true, field);
        assert.equal(options.every((option) => option.applyValue.length >= 24), true, field);
        assert.equal(options.every((option) => fieldShape[field].test(option.applyValue)), true, `field_shape_${field}`);
      } else {
        assert.equal(new Set(options.map((option) => option.applyValue)).size, 1);
        assert.equal(options.every((option) => option.applyValue === (field === "domain" ? artifact.researchDomain.label : artifact.outputTarget)), true);
      }
      assert.equal(options.every((option) => option.rationale.length >= 12 && option.risk.length >= 12), true, field);
    }
  }
  const finding = artifact.journal.priorityFindings.find((item) => item.location === "RESULTS");
  assert.ok(finding);
  for (const revision of finding.revisions) {
    for (const token of ["+6.5 分", "N=180", "p<.001", "95% CI [2.1, 10.9]", "[1]", "不支持"]) assert.equal(revision.text.includes(token), true, token);
  }
  const tampered = structuredClone(artifact);
  const tamperedOption = tampered.directions[0].fieldAssist.workingTitle[0];
  tamperedOption.optionId = "assist:tampered-context-authority";
  const { optionHash: _optionHash, ...tamperedCore } = tamperedOption;
  tamperedOption.optionHash = contracts.beta1Hash(tamperedCore);
  assert.throws(() => contracts.parseV2Beta1JourneyArtifact(tampered), /beta1_assist_option_id_invalid/u);

  const tamperedSnapshot = structuredClone(runResult.snapshot);
  tamperedSnapshot.journey = tampered;
  tamperedSnapshot.journeys[0] = tampered;
  assert.equal(client.parseV2Beta1PostResponse({ ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, snapshot: tamperedSnapshot, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 }), null);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 5);
console.log(JSON.stringify({
  status: "PASS",
  groups,
  groupCount: groups.length,
  externalNetworkCalls: 0,
  onlineDatabaseConnections: 0,
  onlineDatabaseWrites: 0,
  formalResearchWrites: 0,
  externalMutations: 0,
}));
