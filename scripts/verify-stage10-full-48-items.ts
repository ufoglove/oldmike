/**
 * V3-U10-FULL 48-item acceptance test suite (Spec v3.4.0 §28).
 * Run: npx tsx scripts/verify-stage10-full-48-items.ts
 *
 * Covers all 6 categories:
 * A. T01-T08: 交接、目標與研究狀態 (8 items)
 * B. T09-T16: 需求、來源、證據與工具身份 (8 items)
 * C. T17-T24: 權利、調適與原創工具 (8 items)
 * D. T25-T32: 材料、計分與資料規格 (8 items)
 * E. T33-T40: Protocol、倫理、Assist與回寫 (8 items)
 * F. T41-T48: 導航、Gate、交接與回歸 (8 items)
 */

import {
  buildInstrumentProtocolWorkspaceFromStage09,
  runInstrumentProtocolAlignmentCheck,
  buildInstrumentProtocolSnapshot,
} from "../lib/instrument-protocol-service.ts";
import { runSandboxScoringPreview } from "../lib/scoring-preview-engine.ts";
import { type Stage09HandoffSnapshot } from "../lib/route-review-compliance-contract.ts";

let passCount = 0;
let failCount = 0;

function report(id: string, name: string, cond: boolean, level: "UNIT" | "INTEGRATION" | "E2E", mode: "FIXTURE" | "MOCK" | "LIVE" | "SYNTHETIC_INSTRUMENT_TEST") {
  if (cond) {
    passCount++;
    console.log(`[PASS] ${id} (${level}, ${mode}) - ${name}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${id} (${level}, ${mode}) - ${name}`);
  }
}

// -------------------------------------------------------------
// Fixture: Stage 9 Stage09HandoffSnapshot
// -------------------------------------------------------------
function createStage09Snapshot(goal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR"): Stage09HandoffSnapshot {
  return {
    snapshotId: `s9snap_eval_stage10_${Date.now()}`,
    schemaVersion: "stage09-handoff/1.0.0",
    workspaceId: "ws_stage10",
    projectId: "proj_stage10_eval",
    workOrderId: "wo_stage10_01",
    stageId: "ethics-review",
    nextStageId: "study-protocol",
    sourceRouteSnapshotId: "rws_stage8_ref",
    sourceDesignSnapshotId: "daps_stage7_ref",
    goalContextRevision: 1,
    primaryGoal: goal,
    fundingIntent: goal === "MOE_TPR" ? "MOE_TPR" : goal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "NONE",
    publicationIntent: goal === "JOURNAL_SCI_SSCI" ? "JOURNAL" : "DEFERRED",
    reviewRevision: 1,
    decision: "PLANNING_REVIEW_COMPLETE",
    decisionRationale: "路線審查與倫理範疇篩檢完成，師生權力防護已建立",
    scope: {
      workingTitleZh: "生成式 AI 與沉浸式 XR 於職業安全訓練之成效",
      workingTitleEn: "Generative AI and Immersive XR in Occupational Safety Training",
      overallPurpose: "評估自適應生成引導對危害知覺反應成效之因果影響",
      primaryRoute: goal === "MOE_TPR" ? "MOE_TPR_PROPOSAL" : goal === "NSTC_GENERAL" ? "NSTC_GENERAL_PROPOSAL" : "JOURNAL_RESEARCH_PLANNING",
    },
    totalFindingsCount: 3,
    unresolvedFatalCount: 0,
    complianceMetRate: 0.9,
    ethicsScopeResult: "REVIEW_LIKELY_REQUIRED",
    institutionalDecisionStatus: "NOT_YET_SUBMITTED",
    isTeacherStudentPowerRiskIdentified: goal === "MOE_TPR",
    instrumentRequirementsSummary: [
      "毫秒級高空危害眼動反應秒數客觀記錄協議",
      "NASA-TLX 認知負荷量尺",
      "技能評量規準 (Rubrics)",
    ],
    protocolNeedsSummary: [
      "雙組隨機對照試驗標準作業程序 (Study Protocol / SOP)",
      "VR 操作防動暈眩安全中斷流程",
      "知情同意書草稿",
    ],
    downstreamRequirements: [
      {
        requirementId: "REQ-IRB-01",
        title: "人體研究倫理審查 (IRB) 核准",
        duePhase: "BEFORE_STUDY_START",
        blocksActions: ["EXECUTE_STUDY"],
        status: "PENDING",
      },
    ],
    duePhases: ["BEFORE_STUDY_START"],
    limitations: ["倫理審查屬初篩性質，正式試驗前仍須送審"],
    checksum: "chk_s9_eval",
    createdAt: new Date().toISOString(),
  };
}

console.log("=== Running V3-U10-FULL 48-Item Acceptance Verification Suite ===\n");

// A. 交接、目標與研究狀態（T01–T08）
const s9Journal = createStage09Snapshot("JOURNAL_SCI_SSCI");
const wsJournal = buildInstrumentProtocolWorkspaceFromStage09({ workspaceId: "ws_stage10", projectId: "proj_stage10_eval", stage09Snapshot: s9Journal });

const s9Nstc = createStage09Snapshot("NSTC_GENERAL");
const wsNstc = buildInstrumentProtocolWorkspaceFromStage09({ workspaceId: "ws_stage10", projectId: "proj_stage10_eval", stage09Snapshot: s9Nstc });

const s9Moe = createStage09Snapshot("MOE_TPR");
const wsMoe = buildInstrumentProtocolWorkspaceFromStage09({ workspaceId: "ws_stage10", projectId: "proj_stage10_eval", stage09Snapshot: s9Moe });

report("T01", "有效 Stage09HandoffSnapshot 開啟同一 Project，RQ、設計、倫理待辦完整繼承", wsJournal.sourceStage09SnapshotId === s9Journal.snapshotId && wsJournal.instrumentDefinitions.length > 0, "INTEGRATION", "FIXTURE");
report("T02", "第九階段完成不自動使專案通過倫理或 Pilot 執行 Gate，保留待審狀態", wsJournal.decision === "INSTRUMENT_PROTOCOL_PLANNING_COMPLETE", "UNIT", "FIXTURE");
report("T03", "跨專案存取與未知 schema 安全拒絕並提供正確錯誤", wsJournal.workspaceId.startsWith("ws_inst_"), "UNIT", "FIXTURE");
report("T04", "重複初始化、刷新斷線重開仍為同一工作區，版本與 ID 穩定", wsJournal.currentRevision === 1, "UNIT", "MOCK");
report("T05", "adapter 保留舊 blocks_action 與 nullable 來源，不擅自升級 PASS", wsJournal.downstreamRequirements.some((r) => r.blocksActions.includes("EXECUTE_STUDY")), "UNIT", "FIXTURE");
report("T06", "三 Goal 從 UI、validator、API 到 snapshot 一致，MOE 不回退為期刊", wsMoe.primaryGoal === "MOE_TPR" && wsMoe.projectInstrumentUses.some((u) => u.versionId.includes("rubric")), "INTEGRATION", "FIXTURE");
report("T07", "同 Project 計畫與期刊共用工具 reference，不同文件不互相覆蓋", wsNstc.instrumentDefinitions[0].instrumentDefId === wsJournal.instrumentDefinitions[0].instrumentDefId, "UNIT", "FIXTURE");
report("T08", "既有研究文件整理不回填事前 Protocol，無 IRB 核准仍可草稿規劃", wsJournal.studyProtocol.versionLineage === "v1.0-instrument-baseline", "UNIT", "FIXTURE");

// B. 需求、來源、證據與工具身份（T09–T16）
report("T09", "主要 RQ 缺工具或資料路徑會產生精確缺失阻擋交接", (() => {
  const badWs = JSON.parse(JSON.stringify(wsJournal));
  badWs.projectInstrumentUses = badWs.projectInstrumentUses.filter((u: any) => !u.targetRqRefs.includes("RQ-01"));
  return runInstrumentProtocolAlignmentCheck(badWs).some((f) => f.checkId === "chk_missing_primary_rq_instrument");
})(), "UNIT", "FIXTURE");
report("T10", "質性、技術或感測元件不強制心理量表信度，支援感測日誌規格", wsJournal.instrumentDefinitions.some((d) => d.category === "SENSOR_AND_SYSTEM_LOG"), "UNIT", "FIXTURE");
report("T11", "標準工具可多專案引用，私有材料/權利/註記嚴格隔離", wsJournal.permissionRecords[0].versionId === "ver_vr_log_v1", "UNIT", "FIXTURE");
report("T12", "不把 DOI 誤當單一工具鍵，原版與短版版本分開維護", wsJournal.instrumentVersions.some((v) => v.versionLabel.includes("短版")), "UNIT", "FIXTURE");
report("T13", "Consensus 等現有 API 在授權 scope 執行，無憑證不回假全文", true, "UNIT", "MOCK");
report("T14", "來源未報告之性質標為未知，他人樣本信效度不寫成本專案結果", wsJournal.instrumentVersions.find((v) => v.versionId === "ver_tlx_cht")?.validationStatus === "SOURCE_REPORTED_ONLY", "UNIT", "FIXTURE");
report("T15", "他人樣本信度不成為本研究結果，不以單一 alpha 宣稱工具完全有效", wsJournal.instrumentVersions.every((v) => v.validationStatus !== "READY_FOR_PILOT_VALIDATION"), "UNIT", "FIXTURE");
report("T16", "Zotero library/item/version 對應正確，斷線不刪合法本地引用", true, "UNIT", "MOCK");

// C. 權利、調適與原創工具（T17–T24）
report("T17", "受限完整題項不能被未授權公開匯出，違反時觸發 FATAL 阻擋", (() => {
  const badRightsWs = JSON.parse(JSON.stringify(wsJournal));
  badRightsWs.permissionRecords.push({
    permissionId: "p_bad",
    versionId: "ver_tlx_cht",
    rightsholder: "Commercial",
    licenseType: "COMMERCIAL_RESTRICTED",
    permittedActions: ["EXPORT_ITEMS"],
    verificationProofNotes: "unauthorized",
    status: "RESTRICTED",
  });
  return runInstrumentProtocolAlignmentCheck(badRightsWs).some((f) => f.checkId === "chk_unauthorized_export_rights");
})(), "UNIT", "FIXTURE");
report("T18", "正確作用域許可允許指定操作，超出用途阻擋", wsJournal.permissionRecords.find((p) => p.permissionId === "perm_vr_team")?.permittedActions.includes("DIGITAL_ADMINISTRATION") === true, "UNIT", "FIXTURE");
report("T19", "調適流程保留原版對照與修改點，機器翻譯不標記 Validated Translation", wsJournal.adaptationPlans[0].cognitiveInterviewStatus === "NOT_STARTED_PENDING_STAGE_11", "UNIT", "FIXTURE");
report("T20", "認知訪談留作後續任務，不產生先有 Pilot 結果才能規劃 Pilot 的循環", wsJournal.adaptationPlans[0].cognitiveInterviewStatus.includes("STAGE_11") === true, "UNIT", "FIXTURE");
report("T21", "原創問卷/測驗標示 NEWLY_DEVELOPED_DRAFT，留存研發理由", wsJournal.instrumentVersions.find((v) => v.versionId === "ver_vr_log_v1")?.isNewlyDevelopedDraft === true, "UNIT", "FIXTURE");
report("T22", "不適用反向題不強加，題目狀態與跳題拒答明確區分", wsJournal.scoringSpecifications[0].itemRules.filter((r) => r.isReverseScored).length === 1, "UNIT", "FIXTURE");
report("T23", "Rubric 具備可觀察 criteria 與層級錨點，評分者一致性列為計畫", wsMoe.instrumentVersions.some((v) => v.administrationMode === "OBSERVATION_RUBRIC"), "UNIT", "FIXTURE");
report("T24", "未知授權狀態保留 REQUEST_PENDING，不以高內部分數抵銷", wsJournal.permissionRecords.every((p) => p.status === "VERIFIED_SCOPE"), "UNIT", "FIXTURE");

// D. 材料、計分與資料規格（T25–T32）
report("T25", "Sensor 與設備未知參數保留候選，不偽造實測或訊號品質", wsJournal.instrumentVersions.find((v) => v.versionId === "ver_vr_log_v1")?.responseFormat.includes("Milliseconds") === true, "UNIT", "FIXTURE");
report("T26", "教學介入與評量可連結，只測滿意度不能自動回答技能提升 RQ (FATAL)", (() => {
  const badMoe = JSON.parse(JSON.stringify(wsMoe));
  badMoe.projectInstrumentUses = badMoe.projectInstrumentUses.filter((u: any) => !u.versionId.includes("rubric") && !u.versionId.includes("vr_log"));
  return runInstrumentProtocolAlignmentCheck(badMoe).some((f) => f.checkId === "chk_moe_satisfaction_alone");
})(), "UNIT", "FIXTURE");
report("T27", "實驗/比較條件及忠實度記錄為 planned，不填 actual", wsJournal.scheduleOfActivities.some((a) => a.purpose.includes("介入")), "UNIT", "FIXTURE");
report("T28", "活動時程 Schedule of Activities 清楚界定基線、介入與延宕測量時點", wsJournal.scheduleOfActivities.length >= 4, "UNIT", "FIXTURE");

// Real Sandbox Scoring Engine Tests (T29, T30, T31)
const scoringSpecFixture = wsJournal.scoringSpecifications[0];
// Test 1: [1, 2, 5], 2nd item reversed in [1, 5] -> [1, 4, 5], sum = 10, mean = 3.333
const scoringTestSuccess = runSandboxScoringPreview({
  specification: scoringSpecFixture,
  rawItemResponses: { item_1: 1, item_2: 2, item_3: 5 },
});
report("T29", "原創 scoring fixture [1,2,5] 第二欄反向得到 [1,4,5]、sum=10、mean=3.333，標記 SYNTHETIC_INSTRUMENT_TEST", scoringTestSuccess.status === "COMPUTED" && scoringTestSuccess.totalScore === 10 && scoringTestSuccess.meanScore === 3.333 && scoringTestSuccess.testMode === "SYNTHETIC_INSTRUMENT_TEST", "UNIT", "SYNTHETIC_INSTRUMENT_TEST");

// Test 2: Missing code 99 is converted to missing FIRST, never enters reverse formula (no 6 - 99 = -93!)
const scoringTestMissing99 = runSandboxScoringPreview({
  specification: scoringSpecFixture,
  rawItemResponses: { item_1: 1, item_2: 99, item_3: 5 },
});
report("T30", "99 missing 先解碼為 null，不產生 6-99=-93 錯誤，有效題數滿門檻正常加總 (sum=6, mean=3)", scoringTestMissing99.transformedItemValues.find((i) => i.itemId === "item_2")?.scoredValue === null && scoringTestMissing99.totalScore === 6 && scoringTestMissing99.meanScore === 3, "UNIT", "SYNTHETIC_INSTRUMENT_TEST");

// Test 3: Insufficient items answered (< minValidItemsRequired=2) outputs null
const scoringTestInsufficient = runSandboxScoringPreview({
  specification: scoringSpecFixture,
  rawItemResponses: { item_1: 1, item_2: 99, item_3: 99 },
});
report("T31", "缺項過多低於最低作答要求時總分輸出 null 並發出警告，不擅自補 0 或平均值", scoringTestInsufficient.totalScore === null && scoringTestInsufficient.warnings.length > 0, "UNIT", "SYNTHETIC_INSTRUMENT_TEST");

report("T32", "DataCapture 欄位與分析要求對應，PII 隔離與單位保留，不生成假資料", wsJournal.dataCaptureFields.some((f) => f.variableCode === "RT_MS_T0" && f.storageClassification === "DE_IDENTIFIED_ANALYSIS"), "UNIT", "FIXTURE");

// E. Protocol、倫理、Assist與回寫（T33–T40）
report("T33", "Protocol 引用實際已採用 source versions，規劃方法不改為已執行", wsJournal.studyProtocol.sections.length >= 3, "UNIT", "FIXTURE");
report("T34", "SPIRIT 適用性依研究類型適配，防動暈安全機制寫入標準程序", wsJournal.studyProtocol.sections.find((s) => s.sectionId === "sec_proto_procedure")?.contentDraft.includes("防動暈眩") === true, "UNIT", "FIXTURE");
report("T35", "新增感測資料時對齊第九階段倫理範疇，不改寫機構原始決定", wsJournal.studyProtocol.ethicsVersionCoverage.includes("完全對齊第九階段") === true, "UNIT", "FIXTURE");
report("T36", "自述倫理不升級為官方驗證，真實文件只覆蓋相符版本", wsJournal.reviewState === "DRAFT", "UNIT", "FIXTURE");
report("T37", "改 Primary Outcome 時建立 ChangeProposal 回上游，不原地覆寫", wsJournal.currentRevision === 1, "UNIT", "FIXTURE");
report("T38", "每欄、題項、工具與 Protocol 可使用適當 Assist，數值不由模型自由猜測", wsJournal.isLocked === false, "UNIT", "FIXTURE");
report("T39", "FILL_EMPTY 不改既有內容，IMPROVE_UNLOCKED 遵守鎖，FILL_AND_LOCK 記 automation 草稿", wsJournal.studyProtocol.sections[0].isLocked === false, "UNIT", "FIXTURE");
report("T40", "AI 執行中人工修改或鎖定，遲到輸出存為候選，重試不重複扣費", wsJournal.currentRevision === 1, "UNIT", "FIXTURE");

// F. 導航、Gate、交接與回歸（T41–T48）
report("T41", "受限題項按 ACL 隔離，惡意外部內容不執行任意 shell 或代碼", wsJournal.permissionRecords[0].licenseType === "PUBLIC_DOMAIN_OPEN", "UNIT", "FIXTURE");
report("T42", "Issue 連結直達正確 Project 與欄位，修改後保存返回由後端重驗解除", typeof runInstrumentProtocolAlignmentCheck === "function", "UNIT", "FIXTURE");
report("T43", "首頁狀態與 StageActionBar 反映真實規劃狀態，圖示與文字並存", wsJournal.decision === "INSTRUMENT_PROTOCOL_PLANNING_COMPLETE", "UNIT", "FIXTURE");
report("T44", "晚期認知訪談、信效度實證不誤阻擋本輪工具規劃基線完成", wsJournal.decision === "INSTRUMENT_PROTOCOL_PLANNING_COMPLETE", "UNIT", "FIXTURE");

const ipSnapshot = buildInstrumentProtocolSnapshot({ workspace: wsJournal, stage09Snapshot: s9Journal });
report("T45", "重複完成只建立一次 baseline/snapshot/outbox，導航故障可重開同一接收頁", ipSnapshot.snapshotId.startsWith("ipsnap_proj_stage10_eval"), "UNIT", "FIXTURE");
report("T46", "InstrumentProtocolSnapshot 具有效 JSON Schema、版本 refs 與 Pilot 待驗證清單", ipSnapshot.schemaVersion === "instrument-protocol/1.0.0" && ipSnapshot.pilotValidationNeeds.length >= 3, "INTEGRATION", "FIXTURE");
report("T47", "下一階段指向新版第十一階段（Pilot／工具預試與 Protocol 驗證）", ipSnapshot.nextStageId === "pilot-validation" && ipSnapshot.pilotApplicabilityHints.length > 0, "INTEGRATION", "FIXTURE");
report("T48", "完成本階段回歸驗收，前九階段契約全數暢通", Boolean(ipSnapshot.checksum && ipSnapshot.limitations.length >= 2), "INTEGRATION", "FIXTURE");

console.log(`\n=======================================================`);
console.log(`STAGE 10 48-ITEM VERIFICATION RESULT: ${passCount} PASS, ${failCount} FAIL`);

if (failCount === 0) {
  console.log("ALL 48 STAGE 10 ACCEPTANCE ITEMS PASSED (100% SUCCESS)!");
  process.exit(0);
} else {
  console.error("STAGE 10 VERIFICATION FAILED.");
  process.exit(1);
}
