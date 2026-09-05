import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
});

const [{ createBuiltinDomainSelection }, contracts, runtime, { parseV2Beta1GetResponse }, { createV2Beta1RouteHandlers }] = await Promise.all([
  import("../lib/v2-alpha3/contracts.ts"),
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/route-handlers.ts"),
]);

const scope = "fixture-workspace-v2:fixture-user-v2";
const origin = "http://127.0.0.1:43101";
const headers = { "content-type": "application/json", origin, "x-old-mike-v2-workspace": "fixture-workspace-v2" };
const groups = [];
const gate = async (name, callback) => { await callback(); groups.push(name); };

const completeMaterials = (resultText = "介入後指標為 82%，高於基準；[1] 不支持因果結論，仍須檢核不確定性。") => [
  { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要", content: "本研究檢驗生成式回饋、證據校準與自我調節學習，結論受材料界線約束。" },
  { materialId: "material-introduction", kind: "INTRODUCTION", title: "Introduction", content: "既有實作需要說明回饋可操作性如何連結學習策略與任務表現。" },
  { materialId: "material-methods", kind: "METHODS", title: "方法", content: "採準實驗混合方法，記錄介入忠實度、前後測、訪談與替代解釋。" },
  { materialId: "material-results", kind: "RESULTS", title: "結果", content: resultText },
  { materialId: "material-discussion", kind: "NOTE", title: "Discussion", content: "討論僅解釋已觀察差異，並保留場域、樣本與量測限制。" },
  { materialId: "material-conclusion", kind: "NOTE", title: "Conclusion", content: "結論不超越現有結果，後續研究需檢驗可移轉性。" },
  { materialId: "material-citation", kind: "CITATION", title: "引用", content: "示例引用 [1] 僅用於本機契約，正式存在性與脈絡仍須獨立稽核。" },
];

function journeyRequest(snapshot, suffix, target, direction, materials = []) {
  return runtime.createV2Beta1JourneyRequest(snapshot, {
    suffix,
    entryMode: materials.length ? "PARTIAL_MATERIAL" : "KEYWORD",
    outputTarget: target,
    researchDirection: direction,
    researchDomain: createBuiltinDomainSelection("ai-education"),
    materials,
  });
}

function getEnvelope(snapshot) {
  return {
    ok: true,
    contractVersion: contracts.V2_BETA1_CONTRACT_VERSION,
    trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY",
    snapshot,
    previewInsight: runtime.createSyntheticBeta1Insight(),
    effectSubmissionCount: 0,
    liveProviderCallCount: 0,
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    externalMutationCount: 0,
  };
}

await gate("IMPORT_UNKNOWN_RECEIPT_TIMELINE_AND_HTTP", async () => {
  let attempts = 0;
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { attempts += 1; throw new Error("fixture_transport_after_effect_attempt"); } });
  const initial = coordinator.getSnapshot(`${scope}:import-unknown`);
  const insight = runtime.createSyntheticBeta1Insight("教育情境中的證據校準回饋如何影響自我調節學習？");
  const request = runtime.createV2Beta1ImportRequest(initial, insight, "closure2-import-unknown");
  await assert.rejects(coordinator.importInsight(request, `${scope}:import-unknown`), /beta1_completion_unknown_no_resend/u);
  const unknown = coordinator.getSnapshot(`${scope}:import-unknown`);
  assert.equal(attempts, 1);
  assert.equal(unknown.revision, 2);
  assert.equal(unknown.effectReceipts.length, 1);
  assert.equal(unknown.timeline.length, 1);
  assert.equal(unknown.effectReceipts[0].operation, "IMPORT_CHAT_INSIGHT");
  assert.equal(unknown.effectReceipts[0].completionClass, "UNKNOWN");
  assert.equal(unknown.timeline[0].eventType, "CHAT_INSIGHT_COMPLETION_UNKNOWN");
  assert.equal(unknown.timeline[0].operation, "IMPORT_CHAT_INSIGHT");
  assert.equal(unknown.timeline[0].receiptId, unknown.effectReceipts[0].effectId);
  await assert.rejects(coordinator.importInsight(request, `${scope}:import-unknown`), /beta1_completion_unknown_no_resend/u);
  const newKey = runtime.createV2Beta1ImportRequest(unknown, insight, "closure2-import-new-key");
  await assert.rejects(coordinator.importInsight(newKey, `${scope}:import-unknown`), /beta1_completion_unknown_no_resend/u);
  assert.equal(attempts, 1);

  const routeCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { throw new Error("fixture_timeout_after_attempt"); } });
  const handlers = createV2Beta1RouteHandlers({ coordinator: routeCoordinator, previewInsight: runtime.createSyntheticBeta1Insight });
  const routeInitial = routeCoordinator.getSnapshot(scope);
  const response = await handlers.POST(new Request(`${origin}/api/v2-beta1/project`, { method: "POST", headers, body: JSON.stringify(runtime.createV2Beta1ImportRequest(routeInitial, insight, "closure2-route-unknown")) }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null });
});

await gate("RECEIPT_TIMELINE_EXACT_MAPPING_SERVER_AND_CLIENT", async () => {
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => "UNKNOWN" });
  const initial = coordinator.getSnapshot(`${scope}:tamper`);
  const request = runtime.createV2Beta1ImportRequest(initial, runtime.createSyntheticBeta1Insight(), "closure2-tamper");
  await assert.rejects(coordinator.importInsight(request, `${scope}:tamper`), /beta1_completion_unknown_no_resend/u);
  const valid = coordinator.getSnapshot(`${scope}:tamper`);
  assert.ok(parseV2Beta1GetResponse(getEnvelope(valid)));
  for (const mutate of [
    (draft) => { draft.timeline[0].eventType = "CHAT_INSIGHT_IMPORTED"; },
    (draft) => { draft.timeline[0].operation = "RUN_RESEARCH_JOURNEY"; },
    (draft) => { draft.timeline[0].completionClass = "COMPLETE"; },
    (draft) => { draft.timeline[0].receiptId = "effect:tampered-receipt-authority"; },
  ]) {
    const tampered = structuredClone(valid);
    mutate(tampered);
    const event = tampered.timeline[0];
    const { eventHash: _oldEventHash, ...eventCore } = event;
    event.eventHash = contracts.beta1Hash(eventCore);
    const { contentHash: _oldSnapshotHash, ...snapshotCore } = tampered;
    tampered.contentHash = contracts.snapshotContentHash(snapshotCore);
    assert.throws(() => contracts.validateProjectTruthSnapshot(tampered));
    assert.equal(parseV2Beta1GetResponse(getEnvelope(tampered)), null);
  }
});

await gate("THREE_DIRECTION_COMPLETE_SELECTION_ARTIFACTS", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:directions`);
  const result = await coordinator.runJourney(journeyRequest(initial, "closure2-directions", "SSCI", "生成式回饋的證據校準與自我調節學習", completeMaterials()), `${scope}:directions`);
  const artifact = result.snapshot.journey;
  assert.equal(artifact.directions.length, 3);
  assert.equal(new Set(artifact.directions.map((item) => item.selectionArtifact.wholeArtifactHash)).size, 3);
  assert.equal(new Set(artifact.directions.map((item) => item.selectionArtifact.humanGateHash)).size, 3);
  for (const key of ["researchQuestion", "mechanism", "method", "contribution"]) assert.equal(new Set(artifact.directions.map((item) => item[key])).size, 3, `${key}_must_differ`);
  assert.equal(new Set(artifact.directions.map((item) => contracts.beta1Hash(item.s0))).size, 3);
  assert.equal(new Set(artifact.directions.map((item) => item.selectionArtifact.journal.proposedSnapshot.contentHash)).size, 3);
  for (const direction of artifact.directions) {
    assert.equal(direction.selectionArtifact.selectedDirectionHash, direction.directionHash);
    assert.equal(direction.selectionArtifact.inputBundleHash, direction.inputBundleHash);
    assert.equal(direction.selectionArtifact.journal.target, "SSCI");
    assert.equal(direction.selectionArtifact.taiwanProposal, null);
  }
  const recommended = artifact.directions.find((item) => item.recommended);
  assert.equal(artifact.humanGate.contentHash, recommended.selectionArtifact.humanGateHash);
});

await gate("JOURNAL_SOURCE_DEPENDENCE_AND_READINESS", async () => {
  async function run(label, materials) {
    const coordinator = runtime.createV2Beta1Coordinator();
    const localScope = `${scope}:journal:${label}`;
    const initial = coordinator.getSnapshot(localScope);
    return (await coordinator.runJourney(journeyRequest(initial, `closure2-${label}`, "SSCI", "生成式回饋與任務表現的證據界線", materials), localScope)).snapshot.journey;
  }
  const positive = await run("positive", completeMaterials("介入後指標為 82%，高於基準；[1] 不支持因果結論，仍須檢核不確定性。"));
  const negative = await run("negative", completeMaterials("介入後指標為 61%，低於基準；[1] 不支持因果結論，仍須檢核不確定性。"));
  const positiveJournal = positive.directions[1].selectionArtifact.journal;
  const negativeJournal = negative.directions[1].selectionArtifact.journal;
  assert.equal(positiveJournal.publicationUsable, false);
  assert.equal(positiveJournal.reviewStatus, "READY_WITH_GAPS");
  assert.notEqual(positiveJournal.sourceSnapshot.contentHash, negativeJournal.sourceSnapshot.contentHash);
  assert.notEqual(positiveJournal.proposedSnapshot.contentHash, negativeJournal.proposedSnapshot.contentHash);
  assert.notDeepEqual(positiveJournal.priorityFindings.map((item) => item.revisions.map((revision) => revision.text)), negativeJournal.priorityFindings.map((item) => item.revisions.map((revision) => revision.text)));
  completeMaterials().forEach((material) => assert.equal(Object.values(positiveJournal.sourceSnapshot.sections).includes(material.content), true));

  assert.equal((await run("keyword", [])).journal.publicationUsable, false);
  for (const [index, placeholder] of ["待整理", "待填", "尚未提供", "missing", "TBD", "XXX", "N=", "結果？", "〈稍後欄位〉", "稍後補", "planned results"].entries()) {
    assert.equal((await run(`placeholder-${index}`, completeMaterials(`${placeholder}；此結果不得進入終稿。`))).journal.publicationUsable, false);
  }
  assert.equal((await run("numeric-contradiction", completeMaterials("同一指標在相同樣本中同時記為 82% 與 61%。"))).journal.reviewStatus, "BLOCKED_EVIDENCE_OR_INTEGRITY");
  assert.equal((await run("missing-methods", completeMaterials().filter((item) => item.kind !== "METHODS"))).journal.publicationUsable, false);
  const resultFinding = positiveJournal.priorityFindings.find((item) => item.location === "RESULTS");
  for (const revision of resultFinding.revisions) {
    assert.equal(revision.text.includes(resultFinding.sourceText), false);
    for (const token of ["82%", "[1]", "不", "仍須"]) assert.equal(revision.text.includes(token), true, `preserve_${token}`);
  }
});

await gate("TAIWAN_TARGET_DIFFERENTIATION_AND_LINKED_BUDGET", async () => {
  async function run(target) {
    const coordinator = runtime.createV2Beta1Coordinator();
    const localScope = `${scope}:proposal:${target}`;
    const initial = coordinator.getSnapshot(localScope);
    return (await coordinator.runJourney(journeyRequest(initial, `closure2-${target.toLowerCase()}`, target, "生成式回饋支持教育現場的證據校準與能力遷移"), localScope)).snapshot.journey;
  }
  const nstcJourney = await run("NSTC");
  const moeJourney = await run("MOE");
  const nstc = nstcJourney.taiwanProposal;
  const moe = moeJourney.taiwanProposal;
  assert.notDeepEqual(nstc.narrativeSections, moe.narrativeSections);
  assert.notDeepEqual(nstc.workPackages, moe.workPackages);
  assert.notDeepEqual(nstc.kpis, moe.kpis);
  assert.notDeepEqual(nstc.attachments, moe.attachments);
  const withoutLabels = (value) => JSON.stringify(value).replaceAll("NSTC", "").replaceAll("MOE", "").replaceAll("國科會", "").replaceAll("教育部", "");
  assert.notEqual(withoutLabels({ narratives: nstc.narrativeSections, workPackages: nstc.workPackages, kpis: nstc.kpis, attachments: nstc.attachments }), withoutLabels({ narratives: moe.narrativeSections, workPackages: moe.workPackages, kpis: moe.kpis, attachments: moe.attachments }));
  for (const proposal of [nstc, moe]) {
    assert.equal(proposal.budget.totalTwd > 0, true);
    assert.equal(proposal.budget.authority, "LOCAL_SYNTHETIC_UNVERIFIED");
    assert.equal(proposal.budget.allocations.reduce((sum, item) => sum + item.amountTwd, 0), proposal.budget.totalTwd);
    assert.equal(proposal.budget.allocations.every((item) => proposal.workPackages.some((workPackage) => workPackage.workPackageId === item.workPackageId)), true);
    assert.equal(proposal.kpis.every((item) => proposal.workPackages.some((workPackage) => workPackage.workPackageId === item.workPackageId)), true);
  }
  const selected = nstcJourney.directions.find((item) => item.recommended);
  const selection = selected.selectionArtifact;
  const { wholeArtifactHash, humanGateHash, ...selectionCore } = selection;
  const whole = contracts.v2Beta1WholeArtifactValue(selected, selectionCore);
  for (const mutate of [
    (draft) => { draft.taiwanProposal.kpis[0].target += " 本機編修"; },
    (draft) => { draft.taiwanProposal.budget.allocations[0].amountTwd += 1; },
    (draft) => { draft.taiwanProposal.attachments[0].status += " 本機編修"; },
    (draft) => { draft.taiwanProposal.priorityFindings[0].revisions[1].text += " 本機編修"; },
  ]) { const changed = structuredClone(whole); mutate(changed); assert.notEqual(contracts.beta1Hash(changed), wholeArtifactHash); }
});

await gate("INPUT_BOUND_ASSIST_AND_WHOLE_GATE", async () => {
  const message = "能源管理中的生成式回饋如何影響操作決策與風險校準？";
  const educationInsight = runtime.createSyntheticBeta1Insight(message, createBuiltinDomainSelection("ai-education"));
  const energyInsight = runtime.createSyntheticBeta1Insight(message, createBuiltinDomainSelection("ai-energy-management"));
  for (const key of ["title", "mechanism", "value", "domainFit", "nextAction"]) assert.notEqual(educationInsight[key], energyInsight[key], `chat_${key}_domain_bound`);
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:assist`);
  const result = await coordinator.runJourney(journeyRequest(initial, "closure2-assist", "SCI", "XR 安全訓練中的回饋可信度與技能遷移", completeMaterials()), `${scope}:assist`);
  const artifact = result.snapshot.journey;
  for (const direction of artifact.directions) {
    assert.match(direction.researchQuestion, /XR 安全訓練/u);
    assert.match(direction.mechanism, /AI應用於教育|XR 安全訓練/u);
    for (const [field, options] of Object.entries(direction.fieldAssist)) {
      assert.equal(options.length, 3);
      assert.equal(new Set(options.map((item) => item.text)).size, 3);
      assert.equal(options.every((item) => typeof item.applyValue === "string" && item.applyValue.length > 0), true);
      assert.equal(options.every((item) => item.rationale.trim().length >= 12 && item.risk.trim().length >= 12), true, `${field}_rubric_bound`);
      if (field === "domain") assert.equal(options.every((item) => item.applyValue === artifact.researchDomain.label), true);
      if (field === "outputTrack") assert.equal(options.every((item) => item.applyValue === artifact.outputTarget), true);
    }
    const whole = direction.selectionArtifact;
    const { wholeArtifactHash, humanGateHash, ...selectionCore } = whole;
    assert.equal(wholeArtifactHash, contracts.beta1Hash(contracts.v2Beta1WholeArtifactValue(direction, selectionCore)));
    assert.equal(whole.humanGateHash, contracts.beta1Hash({ scope: "WHOLE_ARTIFACT", wholeArtifactHash: whole.wholeArtifactHash }));
    const wholeValue = contracts.v2Beta1WholeArtifactValue(direction, selectionCore);
    const mutations = [
      (draft) => { draft.selectedDirectionHash = "0".repeat(64); },
      (draft) => { draft.s0.problemContext += " 本機編修"; },
      (draft) => { draft.preview.sections.ABSTRACT += " 本機編修"; },
      (draft) => { draft.evidenceGapMap[0].statement += " 本機編修"; },
      (draft) => { draft.analysisWorkPackages[0].objective += " 本機編修"; },
      (draft) => { draft.sourceBundleHash = "1".repeat(64); },
    ];
    if (wholeValue.journal) mutations.push((draft) => { draft.journal.priorityFindings[0].revisions[1].text += " 本機編修"; });
    if (wholeValue.taiwanProposal) mutations.push(
      (draft) => { draft.taiwanProposal.kpis[0].target += " 本機編修"; },
      (draft) => { draft.taiwanProposal.budget.allocations[0].amountTwd += 1; },
      (draft) => { draft.taiwanProposal.attachments[0].status += " 本機編修"; },
    );
    for (const mutate of mutations) { const changed = structuredClone(wholeValue); mutate(changed); assert.notEqual(contracts.beta1Hash(changed), whole.wholeArtifactHash); }
  }
  for (const direction of artifact.directions) assert.equal(Object.values(direction.fieldAssist).flat().length, 39);
  assert.equal(new Set(artifact.directions.flatMap((direction) => Object.values(direction.fieldAssist).flatMap((options) => options.map((option) => option.optionId)))).size, 117);
});

assert.equal(groups.length, 6);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, networkCalls: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
