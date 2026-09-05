import assert from "node:assert/strict";

import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import {
  V2_ALPHA8_CORE_SECTIONS,
  alpha8Hash,
  parseV2Alpha8CreateRequest,
  validateV2Alpha8StageA,
  validateV2Alpha8Workspace,
} from "../lib/v2-alpha8/contracts.ts";
import {
  applyAlpha8ContinuedDraft,
  createSyntheticV2Alpha8Workspace,
  createV2Alpha8Coordinator,
  undoAlpha8ContinuedDraft,
} from "../lib/v2-alpha8/runtime.ts";

let assertions = 0;
const results = [];
const equal = (...arguments_) => { assertions += 1; assert.equal(...arguments_); };
const deepEqual = (...arguments_) => { assertions += 1; assert.deepEqual(...arguments_); };
const ok = (...arguments_) => { assertions += 1; assert.ok(...arguments_); };
const match = (...arguments_) => { assertions += 1; assert.match(...arguments_); };
const doesNotMatch = (...arguments_) => { assertions += 1; assert.doesNotMatch(...arguments_); };
const throws = (...arguments_) => { assertions += 1; assert.throws(...arguments_); };
const rejects = async (...arguments_) => { assertions += 1; await assert.rejects(...arguments_); };
const group = async (name, run) => {
  await run();
  results.push({ name, status: "PASS" });
};

function requestFixture(suffix, options = {}) {
  const materials = options.materials ?? [
    { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要與研究構想", content: "本研究探討生成式工具介入大學教師備課後，信任校準、課程判斷與學習設計之間的關係。" },
    { materialId: "material-introduction", kind: "INTRODUCTION", title: "前言", content: "教師採用生成式工具的速度很快，但目前仍不清楚哪些可核對證據會改變教師信任與課程決策。" },
    { materialId: "material-methods", kind: "METHODS", title: "方法", content: "研究採混合方法準實驗設計，包含前後測、決策信心量表、訪談與課程文件分析。" },
    { materialId: "material-results", kind: "RESULTS", title: "初步結果", content: "介入後決策信心呈現改善，訪談顯示受試者在看見可核對證據時較願意修正原判斷。" },
    { materialId: "material-survey", kind: "SURVEY_DATA", title: "問卷摘要", content: "五點量尺問卷已有有效樣本與信度描述，原始版本和排除規則仍需在正式分析前核對。" },
  ];
  const statistics = options.statistics ?? [
    { statisticId: "stat-n", label: "有效樣本數", value: "118", unit: "人", sourceMaterialId: "material-survey", consistency: "CONSISTENT_REPORTED", note: "使用者提供的同一版清理後資料摘要。" },
    { statisticId: "stat-alpha", label: "量表內部一致性", value: "0.86", unit: "alpha", sourceMaterialId: "material-survey", consistency: "CONSISTENT_REPORTED", note: "僅作描述值，仍需由分析紀錄核對。" },
  ];
  return {
    contractVersion: "old-mike-v2-alpha8/1.0.0",
    requestId: `alpha8-request-${suffix}`,
    idempotencyKey: `alpha8-idempotency-${suffix}`,
    focusDomain: options.focusDomain ?? { kind: "BUILTIN", domainId: "ai-education", label: "AI應用於教育" },
    goal: "JOURNAL_MANUSCRIPT",
    resultReadiness: options.resultReadiness ?? "OBSERVED_RESULTS_AVAILABLE",
    materials,
    statistics,
  };
}

await group("A_COMPLETE_PARTIAL_DRAFT_TO_PROFESSIONAL_WORKSPACE", () => {
  const input = requestFixture("complete");
  const original = structuredClone(input);
  const workspace = createSyntheticV2Alpha8Workspace(input);
  deepEqual(input, original);
  equal(workspace.sourcePreserved, true);
  equal(workspace.status, "READY");
  equal(workspace.stageA.directions.length, 3);
  equal(new Set(workspace.stageA.directions.map((item) => item.lane)).size, 3);
  equal(new Set(workspace.stageA.directions.map((item) => item.title)).size, 3);
  equal(workspace.stageA.directions.filter((item) => item.recommended).length, 1);
  equal(workspace.stageA.directions.find((item) => item.recommended)?.lane, "BALANCED_RECOMMENDED");
  for (const direction of workspace.stageA.directions) {
    const grounded = `${direction.title}\n${direction.researchQuestion}\n${direction.expectedContribution}`;
    match(grounded, /生成式工具/u);
    match(grounded, /大學教師/u);
    match(grounded, /信任校準|課程判斷|學習設計/u);
    doesNotMatch(grounded, /現有半成品|既有材料|使用者提供/u);
  }
  match(workspace.stageA.directions.find((item) => item.recommended)?.title ?? "", /混合方法準實驗研究/u);
  deepEqual(Object.keys(workspace.stageB.s0).sort(), [...S0_FIELD_NAMES].sort());
  equal(S0_FIELD_NAMES.every((field) => workspace.stageB.s0[field].value.trim().length > 0), true);
  deepEqual(workspace.stageB.continuedDraft.map((item) => item.sectionId), V2_ALPHA8_CORE_SECTIONS);
  equal(workspace.stageB.continuedDraft.every((item) => item.mode !== "PLAN_ONLY"), true);
  for (const section of workspace.stageB.continuedDraft) {
    doesNotMatch(section.text, /現有半成品|既有材料|使用者提供|本機(?:草稿|概念模式)/u);
    doesNotMatch(section.text, /。；|；。|。。|；；/u);
  }
  doesNotMatch(workspace.stageB.continuedDraft.find((section) => section.sectionId === "METHODS")?.text ?? "", /研究設計以[「『]?以研究問題/u);
  equal(workspace.stageB.resultsNarrativeAllowed, true);
  equal(workspace.stageB.analysisWorkPackages.length >= 1, true);
  equal(workspace.syntheticGenerationStageCount, 2);
  equal(workspace.liveProviderSubmissionCount, 0);
  equal(workspace.cardSwitchProviderSubmissionCount, 0);
  equal(workspace.formalResearchWriteCount, 0);
  equal(workspace.onlineDatabaseWriteCount, 0);
  equal(workspace.externalMutationCount, 0);
  equal(workspace.humanGate.required, true);
  equal(workspace.humanGate.confirmed, false);
  equal(S0_FIELD_NAMES.every((field) => workspace.stageB.s0Alternatives[field].length === 3), true);
  equal(S0_FIELD_NAMES.every((field) => new Set(workspace.stageB.s0Alternatives[field].map((item) => item.value)).size === 3), true);
  equal(S0_FIELD_NAMES.every((field) => workspace.stageB.s0Alternatives[field].filter((item) => item.recommended)[0]?.strategy === "BALANCED_RECOMMENDED"), true);
});

await group("B_MISSING_RESULTS_NEVER_FABRICATES_FINDINGS", () => {
  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("missing-results", {
    materials: [
      { materialId: "material-abstract", kind: "ABSTRACT", title: "部分摘要", content: "本研究構想聚焦於職業安全訓練中的沉浸式決策回饋，目前只有研究目的與初步設計。" },
      { materialId: "material-methods", kind: "METHODS", title: "方法草稿", content: "預計採情境實驗與訪談，但尚未完成收案、資料清理或統計分析。" },
    ],
    statistics: [],
    resultReadiness: "RESULTS_NOT_AVAILABLE",
  }));
  equal(workspace.status, "READY_WITH_GAPS");
  equal(workspace.stageB.resultsNarrativeAllowed, false);
  equal(workspace.stageB.blockedReasons.includes("RESULTS_MISSING_ANALYSIS_PLAN_ONLY"), true);
  for (const sectionId of ["ABSTRACT", "RESULTS", "DISCUSSION", "CONCLUSION"]) {
    const section = workspace.stageB.continuedDraft.find((item) => item.sectionId === sectionId);
    equal(section?.mode, "PLAN_ONLY");
    equal(section?.statisticIds.length, 0);
  }
  equal(workspace.stageB.analysisWorkPackages.some((item) => item.claimPolicy === "ANALYSIS_PLAN_ONLY"), true);
});

await group("C_CONFLICT_AND_UNCHECKED_STATISTICS_ARE_QUARANTINED", () => {
  const conflict = requestFixture("conflict", {
    statistics: [
      { statisticId: "stat-conflict", label: "有效樣本數", value: "118 或 121", unit: "人", sourceMaterialId: "material-survey", consistency: "CONFLICT_REPORTED", note: "兩份分析表使用不同排除規則。" },
    ],
  });
  const workspace = createSyntheticV2Alpha8Workspace(conflict);
  equal(workspace.stageA.directions.every((item) => item.evidenceStatisticIds.length === 0), true);
  equal(workspace.stageB.resultsNarrativeAllowed, false);
  const reconciliation = workspace.stageB.analysisWorkPackages.find((item) => item.claimPolicy === "RECONCILIATION_ONLY");
  ok(reconciliation);
  deepEqual(reconciliation.inputStatisticIds, ["stat-conflict"]);
  equal(workspace.stageB.continuedDraft.find((item) => item.sectionId === "RESULTS")?.mode, "PLAN_ONLY");

  const unchecked = requestFixture("unchecked", {
    statistics: [
      { statisticId: "stat-unchecked", label: "效果量", value: "0.42", unit: "d", sourceMaterialId: "material-results", consistency: "UNCHECKED", note: "尚未核對模型與樣本版本。" },
    ],
  });
  const uncheckedWorkspace = createSyntheticV2Alpha8Workspace(unchecked);
  equal(uncheckedWorkspace.stageB.resultsNarrativeAllowed, false);
  equal(uncheckedWorkspace.stageB.blockedReasons.includes("STATISTICS_UNCHECKED_REQUIRES_VALIDATION"), true);
});

await group("D_NOTE_ONLY_REMAINS_A_PLAN_NOT_A_FAKE_MANUSCRIPT", () => {
  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("note-only", {
    materials: [{ materialId: "material-note", kind: "NOTE", title: "研究靈感", content: "希望探討人工智慧、環境資源管理與能源治理的跨領域研究方向，目前尚未收集實證資料。" }],
    statistics: [],
    resultReadiness: "RESULTS_NOT_AVAILABLE",
  }));
  equal(workspace.stageB.resultsNarrativeAllowed, false);
  equal(workspace.stageB.s0.targetUsers.materialIds.length, 1);
  equal(workspace.stageB.continuedDraft.filter((item) => item.mode === "PLAN_ONLY").length, 5);
  equal(workspace.stageB.continuedDraft.find((item) => item.sectionId === "METHODS")?.mode, "PLAN_ONLY");
  equal(JSON.stringify(workspace).includes("顯著提升"), false);
  equal(JSON.stringify(workspace).includes("前沿性是材料推導而非已證實趨勢"), true);
});

await group("E_STRICT_INPUT_AND_SERVER_AUTHORITY", () => {
  throws(() => parseV2Alpha8CreateRequest(undefined), /alpha8_request_invalid/u);
  const extra = { ...requestFixture("extra"), evidenceState: "VERIFIED" };
  throws(() => parseV2Alpha8CreateRequest(extra), /alpha8_request_invalid/u);
  const badDomain = structuredClone(requestFixture("bad-domain"));
  badDomain.focusDomain.label = "任意替換標籤";
  throws(() => parseV2Alpha8CreateRequest(badDomain), /alpha8_focus_domain_invalid/u);
  const duplicate = structuredClone(requestFixture("duplicate"));
  duplicate.materials.push(structuredClone(duplicate.materials[0]));
  throws(() => parseV2Alpha8CreateRequest(duplicate), /alpha8_material_id_duplicate/u);
  const orphanStatistic = structuredClone(requestFixture("orphan"));
  orphanStatistic.statistics[0].sourceMaterialId = "missing-material";
  throws(() => parseV2Alpha8CreateRequest(orphanStatistic), /alpha8_statistic_source_invalid/u);
  const contradictory = structuredClone(requestFixture("contradictory"));
  contradictory.statistics.push({ statisticId: "stat-n-2", label: "有效樣本數", value: "121", unit: "人", sourceMaterialId: "material-survey", consistency: "CONSISTENT_REPORTED", note: "另一份表中的不同數值。" });
  throws(() => parseV2Alpha8CreateRequest(contradictory), /alpha8_statistic_consistency_contradiction/u);
  const whitespaceContradiction = structuredClone(requestFixture("whitespace-contradictory"));
  whitespaceContradiction.statistics[0].label = "Effective sample size";
  whitespaceContradiction.statistics[0].unit = "persons";
  whitespaceContradiction.statistics.push({ statisticId: "stat-n-2", label: "Effective\u00a0 \t sample size", value: "121", unit: "persons", sourceMaterialId: "material-survey", consistency: "CONSISTENT_REPORTED", note: "相同統計名稱僅有空白差異。" });
  throws(() => parseV2Alpha8CreateRequest(whitespaceContradiction), /alpha8_statistic_consistency_contradiction/u);
  const unitWhitespaceContradiction = structuredClone(requestFixture("unit-whitespace-contradictory"));
  unitWhitespaceContradiction.statistics[0].label = "Effective sample size";
  unitWhitespaceContradiction.statistics[0].unit = "persons per cohort";
  unitWhitespaceContradiction.statistics.push({ statisticId: "stat-n-2", label: "Effective sample size", value: "121", unit: "persons\u2003 per cohort", sourceMaterialId: "material-survey", consistency: "CONSISTENT_REPORTED", note: "相同統計單位僅有 Unicode 空白差異。" });
  throws(() => parseV2Alpha8CreateRequest(unitWhitespaceContradiction), /alpha8_statistic_consistency_contradiction/u);
  const oversized = requestFixture("oversized");
  oversized.materials = Array.from({ length: 5 }, (_, index) => ({ materialId: `material-large-${index}`, kind: "NOTE", title: `大型材料 ${index}`, content: "研".repeat(47_000) }));
  oversized.statistics = [];
  throws(() => parseV2Alpha8CreateRequest(oversized), /alpha8_request_too_large/u);

  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("stage-a-tamper"));
  const tampered = structuredClone(workspace.stageA);
  tampered.directions[0].evidenceStatisticIds = ["stat-conflict"];
  const directionCore = { ...tampered.directions[0] };
  delete directionCore.contentHash;
  tampered.directions[0].contentHash = alpha8Hash(directionCore);
  const stageCore = { ...tampered };
  delete stageCore.artifactHash;
  tampered.artifactHash = alpha8Hash(stageCore);
  throws(() => validateV2Alpha8StageA(tampered, workspace.sourceBundleHash, new Set(workspace.materials.map((item) => item.materialId)), new Set(["stat-n", "stat-alpha"])), /alpha8_direction_statistic_reference_invalid/u);

  const workspaceTampered = structuredClone(workspace);
  workspaceTampered.materials[0].content += "竄改";
  throws(() => validateV2Alpha8Workspace(workspaceTampered), /alpha8_workspace_request_hash_mismatch|alpha8_workspace_material_hash_mismatch|alpha8_workspace_source_hash_mismatch/u);
  const gateTampered = structuredClone(workspace);
  gateTampered.humanGate.required = false;
  throws(() => validateV2Alpha8Workspace(gateTampered), /alpha8_workspace_binding_invalid/u);
  const statusTampered = structuredClone(workspace);
  statusTampered.status = "READY_WITH_GAPS";
  throws(() => validateV2Alpha8Workspace(statusTampered), /alpha8_workspace_status_mismatch/u);
  const requestIdTampered = structuredClone(workspace);
  requestIdTampered.requestId = "alpha8-request-tampered";
  throws(() => validateV2Alpha8Workspace(requestIdTampered), /alpha8_workspace_request_hash_mismatch/u);
  const idempotencyTampered = structuredClone(workspace);
  idempotencyTampered.idempotencyKey = "alpha8-idempotency-tampered";
  throws(() => validateV2Alpha8Workspace(idempotencyTampered), /alpha8_workspace_request_hash_mismatch/u);

  const prefixOnly = structuredClone(workspace);
  const domainAlternative = prefixOnly.stageB.s0Alternatives.domain[0];
  domainAlternative.value = `證據整合｜${prefixOnly.stageB.s0.domain.value}`;
  const alternativeCore = { ...domainAlternative };
  delete alternativeCore.contentHash;
  domainAlternative.contentHash = alpha8Hash(alternativeCore);
  const stageBCore = { ...prefixOnly.stageB };
  delete stageBCore.artifactHash;
  prefixOnly.stageB.artifactHash = alpha8Hash(stageBCore);
  prefixOnly.humanGate.contentHash = alpha8Hash({ stageA: prefixOnly.stageA.artifactHash, stageB: prefixOnly.stageB.artifactHash });
  throws(() => validateV2Alpha8Workspace(prefixOnly), /alpha8_s0_alternative_domain_materiality_invalid/u);

  const processText = structuredClone(workspace);
  const introduction = processText.stageB.continuedDraft.find((item) => item.sectionId === "INTRODUCTION");
  introduction.text = `${introduction.text} 使用者提供的材料已完成處理。`;
  const introductionCore = { ...introduction };
  delete introductionCore.contentHash;
  introduction.contentHash = alpha8Hash(introductionCore);
  const processStageBCore = { ...processText.stageB };
  delete processStageBCore.artifactHash;
  processText.stageB.artifactHash = alpha8Hash(processStageBCore);
  processText.humanGate.contentHash = alpha8Hash({ stageA: processText.stageA.artifactHash, stageB: processText.stageB.artifactHash });
  throws(() => validateV2Alpha8Workspace(processText), /alpha8_publication_text_invalid/u);
});

await group("F_RESULT_READINESS_AUTHORITY_BLOCKS_EMPTY_DATA_SHELLS", () => {
  const shell = createSyntheticV2Alpha8Workspace(requestFixture("data-shell", {
    materials: [
      { materialId: "material-survey", kind: "SURVEY_DATA", title: "問卷工具空殼", content: "問卷尚未發放，沒有樣本、沒有分析，也沒有任何研究結果。" },
      { materialId: "material-methods", kind: "METHODS", title: "方法規劃", content: "預計未來採五點量尺與訪談，目前只是工具設計。" },
    ],
    statistics: [],
    resultReadiness: "UNCERTAIN",
  }));
  equal(shell.stageB.resultsNarrativeAllowed, false);
  equal(shell.stageB.continuedDraft.find((item) => item.sectionId === "RESULTS")?.mode, "PLAN_ONLY");
  equal(shell.stageB.blockedReasons.includes("RESULTS_MISSING_ANALYSIS_PLAN_ONLY"), true);
});

await group("G_IDEMPOTENCY_CONFLICT_AND_UNKNOWN_NO_RESEND", async () => {
  let calls = 0;
  const coordinator = createV2Alpha8Coordinator(async (request) => {
    calls += 1;
    return createSyntheticV2Alpha8Workspace(request);
  });
  const request = requestFixture("replay");
  const first = await coordinator.run(request, "fixture-workspace:fixture-user");
  const replay = await coordinator.run(request, "fixture-workspace:fixture-user");
  equal(first.replayed, false);
  equal(first.syntheticGenerationStagesAdded, 2);
  equal(first.liveProviderSubmissionsAdded, 0);
  equal(replay.replayed, true);
  equal(replay.syntheticGenerationStagesAdded, 0);
  equal(replay.liveProviderSubmissionsAdded, 0);
  equal(calls, 1);
  const conflict = structuredClone(request);
  conflict.materials[0].content += "不同內容";
  await rejects(() => coordinator.run(conflict, "fixture-workspace:fixture-user"), /alpha8_idempotency_conflict/u);

  const mismatchedResult = createV2Alpha8Coordinator(async (parsedRequest) => {
    const workspace = createSyntheticV2Alpha8Workspace(parsedRequest);
    workspace.requestId = "alpha8-request-provider-different";
    workspace.requestHash = alpha8Hash({ ...parsedRequest, requestId: workspace.requestId });
    return workspace;
  });
  await rejects(() => mismatchedResult.run(requestFixture("provider-mismatch"), "fixture-workspace:fixture-user"), /alpha8_workspace_request_binding_mismatch/u);

  const mutatingGenerator = createV2Alpha8Coordinator(async (parsedRequest) => {
    parsedRequest.materials[0].content += "生成器不應能改寫原始請求權威";
    return createSyntheticV2Alpha8Workspace(parsedRequest);
  });
  await rejects(() => mutatingGenerator.run(requestFixture("provider-mutation"), "fixture-workspace:fixture-user"), /alpha8_workspace_request_binding_mismatch/u);

  let unknownCalls = 0;
  const unknown = createV2Alpha8Coordinator(async () => {
    unknownCalls += 1;
    throw new Error("alpha8_completion_unknown");
  });
  const unknownRequest = requestFixture("unknown");
  await rejects(() => unknown.run(unknownRequest, "fixture-workspace:fixture-user"), /alpha8_completion_unknown/u);
  await rejects(() => unknown.run(unknownRequest, "fixture-workspace:fixture-user"), /alpha8_completion_unknown_no_resend/u);
  equal(unknownCalls, 1);
});

await group("H_APPLY_UNDO_AND_STALE_HASH", () => {
  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("apply"));
  const original = Object.fromEntries(V2_ALPHA8_CORE_SECTIONS.map((sectionId) => [sectionId, `原始 ${sectionId}`]));
  const applied = applyAlpha8ContinuedDraft(original, alpha8Hash(original), workspace.stageB);
  equal(Object.values(applied.applied).every((value) => value.length > 12), true);
  deepEqual(undoAlpha8ContinuedDraft(applied), original);
  throws(() => applyAlpha8ContinuedDraft({ ...original, ABSTRACT: "已被使用者修改" }, alpha8Hash(original), workspace.stageB), /alpha8_stale_draft_hash/u);
});

await group("I_AUTHORED_PARTIAL_DRAFT_SEMANTIC_GROUNDING_AND_PUBLICATION_TEXT", () => {
  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("authored-semantic", {
    materials: [
      { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要草稿", content: "本研究探討生成式智慧回饋對高等教育學習者自我調節學習與任務表現的影響。" },
      { materialId: "material-introduction", kind: "INTRODUCTION", title: "前言草稿", content: "既有教學介入常忽略學習者如何校準證據、調節策略並把回饋轉化為任務決策。" },
      { materialId: "material-methods", kind: "METHODS", title: "方法草稿", content: "研究採準實驗混合方法設計，結合前後測、歷程紀錄與半結構訪談。" },
      { materialId: "material-results", kind: "RESULTS", title: "結果摘要", content: "初步紀錄顯示任務表現與證據校準行為均有變化，但效果量與機制仍需完整分析。" },
    ],
    statistics: [],
  }));
  for (const direction of workspace.stageA.directions) {
    const publicationText = `${direction.title}\n${direction.researchQuestion}\n${direction.expectedContribution}`;
    match(publicationText, /生成式智慧回饋/u);
    match(publicationText, /高等教育學習者/u);
    match(publicationText, /自我調節學習/u);
    match(publicationText, /任務表現/u);
    match(publicationText, /準實驗混合方法/u);
    doesNotMatch(publicationText, /現有半成品|既有材料|使用者提供|本機(?:草稿|概念模式)/u);
  }
  for (const section of workspace.stageB.continuedDraft) {
    doesNotMatch(section.text, /現有半成品|既有材料|使用者提供|本機(?:草稿|概念模式)|目前可引用|正式分析前將固定|另行確認/u);
    doesNotMatch(section.text, /。；|；。|。。|；；/u);
  }
});

await group("J_CROSS_DOMAIN_INPUT_DOES_NOT_LEAK_AI_EDUCATION_FIXTURE", () => {
  const workspace = createSyntheticV2Alpha8Workspace(requestFixture("cross-domain", {
    focusDomain: { kind: "BUILTIN", domainId: "ai-occupational-safety-training", label: "AI應用於職業安全與教育訓練" },
    materials: [
      { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要草稿", content: "本研究探討虛擬實境安全訓練對高風險作業人員危害辨識與應變決策的影響。" },
      { materialId: "material-methods", kind: "METHODS", title: "方法草稿", content: "研究採多場域叢集隨機對照試驗設計，並以事故情境任務與訪談進行評估。" },
      { materialId: "material-results", kind: "RESULTS", title: "結果摘要", content: "初步紀錄顯示危害辨識與應變決策表現出現差異，完整效果仍待模型核對。" },
    ],
    statistics: [],
  }));
  for (const direction of workspace.stageA.directions) {
    const publicationText = `${direction.title}\n${direction.researchQuestion}\n${direction.expectedContribution}`;
    match(publicationText, /虛擬實境安全訓練/u);
    match(publicationText, /高風險作業人員/u);
    match(publicationText, /危害辨識/u);
    match(publicationText, /應變決策/u);
    match(publicationText, /多場域叢集隨機對照試驗/u);
    doesNotMatch(publicationText, /生成式工具|大學教師|信任校準|課程判斷/u);
  }
});

console.log(JSON.stringify({ status: "PASS", groups: results.length, assertions, results, syntheticGenerationStagesPerNewJourney: 2, liveProviderSubmissionsPerNewJourney: 0, cardSwitchProviderSubmissions: 0, formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0 }));
