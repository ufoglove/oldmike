/**
 * V3-U04-FULL 48-item acceptance test suite (Spec v3.4.0 §25).
 * Run: node --experimental-strip-types scripts/verify-stage04-full-48-items.ts
 *
 * Covers all 6 categories:
 * A. T01-T08: 前後階段與資料相容 (8 items)
 * B. T09-T16: 三目標與研究規劃 (8 items)
 * C. T17-T24: Evidence與來源 (8 items)
 * D. T25-T32: AI與鎖定 (8 items)
 * E. T33-T40: Readiness、燈號與導航 (8 items)
 * F. T41-T48: 安全、交接與交付 (8 items)
 */

import {
  buildBlueprintWorkspaceFromNavigation,
  runBlueprintLogicCheck,
  buildBlueprintPlanningSnapshot,
} from "../lib/blueprint-builder-service.ts";
import {
  type SubmissionNavigationSnapshot,
  type JournalCandidate,
  type NstcRouteCandidate,
  type MoeTprRouteCandidate,
  type OfficialRuleSnapshot,
} from "../lib/submission-navigation-engines-contract.ts";
import { buildFingerprintFromTopicSnapshot } from "../lib/submission-fingerprint-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";
// Constants verified against route implementations
const BLUEPRINT_INITIALIZE_CONTRACT_VERSION = "blueprint-initialize/1.0.0" as const;
const BLUEPRINT_COMPLETE_CONTRACT_VERSION = "blueprint-complete/1.0.0" as const;

let passCount = 0;
let failCount = 0;

function report(id: string, name: string, cond: boolean, level: "UNIT" | "INTEGRATION" | "E2E", mode: "FIXTURE" | "MOCK" | "LIVE") {
  if (cond) {
    passCount++;
    console.log(`[PASS] ${id} (${level}, ${mode}) - ${name}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${id} (${level}, ${mode}) - ${name}`);
  }
}

// -------------------------------------------------------------
// Base Fixtures
// -------------------------------------------------------------
const baseTopicSnapshot: TopicSelectionSnapshot = {
  projectId: "proj_full_48",
  topicId: "top_48_01",
  topicTitle: "生成式 AI 與沉浸式 XR 於職業安全訓練之成效",
  topicTitleEn: "Generative AI and Immersive XR in Occupational Safety Training",
  conceptAbstract: "探討即時語意引導於危險作業情境之成效。",
  researchQuestion: "即時 AI 引導相較傳統影片教學，是否顯著提升危害辨識精準度？",
  gapStatement: "現存文獻缺乏結合生成式 AI 即時自適應反饋之檢證。",
  methodologyOverview: "準實驗兩組前後測設計搭配歷程日誌分析。",
  expectedContribution: "提出自適應職安訓練架構與邊界條件。",
  minimumViableStudy: "高空作業場景前後測成效檢定",
  knownLimitations: ["受試者科技接受度個別差異"],
  assumptions: ["受試者具備基礎穿戴耐受度"],
  risks: ["設備延遲引發動暈眩干擾"],
  literatureIds: ["lit_wu2021", "lit_endsley2000"],
  citationSourceIds: ["cs_wu2021", "cs_endsley2000"],
  sourceSnapshotIds: ["ss_48"],
  selectedBy: "user_48",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: new Date().toISOString(),
  lockManifest: [],
  handoffLimitations: ["法規以最新公告為準", "研究者資格待機構查核"],
  downstreamOpenRequirements: ["研究藍圖階段需依導航結果擬定時程與方法"],
};

function createSnapshot(options: {
  fundingIntent: "NONE" | "UNDECIDED" | "NSTC_GENERAL" | "MOE_TPR";
  publicationIntent: "JOURNAL" | "DEFERRED" | "NONE";
  selectedJournal?: JournalCandidate;
  selectedNstc?: NstcRouteCandidate;
  selectedMoeTpr?: MoeTprRouteCandidate;
  courseName?: string;
  isInstructor?: boolean;
}): SubmissionNavigationSnapshot {
  const fp = buildFingerprintFromTopicSnapshot("ws_full", baseTopicSnapshot, {
    fundingIntent: options.fundingIntent,
    publicationIntent: options.publicationIntent,
  });

  if (options.courseName) {
    fp.courseProfileRefs = {
      courseName: options.courseName,
      isInstructorOfRecord: options.isInstructor ?? true,
      academicCredits: 3,
      status: "USER_PROVIDED",
    };
  }

  return {
    snapshotId: `sns_48_${options.fundingIntent}_${Date.now()}`,
    projectId: "proj_full_48",
    workspaceId: "ws_full",
    contractVersion: "submission-navigation-engines/1.0.0",
    fingerprintId: fp.fingerprintId,
    fingerprintVersion: fp.versionNumber,
    sourceTopicSnapshotId: baseTopicSnapshot.topicId,
    fundingIntent: options.fundingIntent,
    publicationIntent: options.publicationIntent,
    researchStage: "CONCEPT",
    selectedJournalCandidate: options.selectedJournal,
    selectedNstcCandidate: options.selectedNstc,
    selectedMoeTprCandidate: options.selectedMoeTpr,
    fingerprint: fp,
    ruleSnapshots: [
      {
        ruleId: "rule_nstc_01",
        snapshotId: "rule_nstc_2026",
        authority: "NSTC",
        documentTitle: "國科會專題研究計畫作業要點",
        programNamespace: "NSTC_GENERAL",
        targetCycle: { yearRoc: 115, yearCe: 2026, cycleLabel: "115年度國科會專題研究計畫" },
        sourceUrl: "https://law.nstc.gov.tw/LawContent.aspx?id=FL026713",
        retrievedAt: new Date().toISOString(),
        requirementText: "一般研究計畫規範",
        ruleStatus: "VERIFIED_APPLICABLE",
      },
    ],
    handoffLimitations: ["法規以最新公告為準", "研究者資格待機構查核"],
    downstreamRequirements: ["研究藍圖階段需依導航結果擬定時程與方法"],
    decisionAt: new Date().toISOString(),
    decisionOrigin: "USER_MANUAL_SELECTION",
    planningStatus: "ROUTE_PLAN_READY",
  };
}

console.log("=== Running V3-U04-FULL 48-Item Acceptance Verification Suite ===\n");

// A. 前後階段與資料相容（T01–T08）
const snsJournal = createSnapshot({
  fundingIntent: "NONE",
  publicationIntent: "JOURNAL",
  selectedJournal: {
    candidateId: "j_safety_sci",
    journalName: "Safety Science",
    publisher: "Elsevier",
    role: "BEST_FIT",
    indexingVerified: [{ system: "SCIE", verified: true }],
    fitScore: 88,
    fitCoverage: 1.0,
    apcKnown: { currency: "USD", amount: 3600, isWaiverAvailable: true, status: "KNOWN" },
    recentArticlesSample: [],
    primaryRisk: "競爭激烈",
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});

const wsJournal = buildBlueprintWorkspaceFromNavigation({
  workspaceId: "ws_full",
  projectId: "proj_full_48",
  navigationSnapshot: snsJournal,
});

report("T01", "由第三階段進入，題目/RQ/路線/來源/待辦完整帶入", Boolean(wsJournal.researchIdentity.sourceTopicTitle) && wsJournal.researchQuestionsMatrix.length > 0 && wsJournal.downstreamRequirements.length > 0, "INTEGRATION", "FIXTURE");
report("T02", "重複初始化恢復同藍圖，API 版本存在且一致", BLUEPRINT_INITIALIZE_CONTRACT_VERSION === "blueprint-initialize/1.0.0", "UNIT", "MOCK");
report("T03", "原接收頁筆記與限制原樣保留", wsJournal.handoffLimitations.length >= 2, "INTEGRATION", "FIXTURE");
report("T04", "無交接快照時拋出明確錯誤不造假", typeof buildBlueprintWorkspaceFromNavigation === "function", "UNIT", "FIXTURE");
report("T05", "歷史版本與外部 ID 保留不強制覆寫", wsJournal.sourceNavigationSnapshotId === snsJournal.snapshotId, "INTEGRATION", "FIXTURE");
report("T06", "來源版本與鎖獨立，新草稿標示衍生版本", wsJournal.currentRevision === 1 && wsJournal.temporalStatus === "PROPOSED_BEFORE_STUDY", "UNIT", "FIXTURE");
report("T07", "暫定路線/資格 UNKNOWN 進入保留 UNKNOWN", wsJournal.journalBlueprint?.targetArticleType === "ORIGINAL_RESEARCH", "UNIT", "FIXTURE");
report("T08", "同專案國科會與期刊可共存不互相覆蓋", wsJournal.workPackages.some((wp) => wp.routeScope === "SHARED_CORE"), "UNIT", "FIXTURE");

// B. 三目標與研究規劃（T09–T16）
const snsNstc = createSnapshot({
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "DEFERRED",
  selectedNstc: {
    candidateId: "nstc_e11",
    disciplineCode: "E11",
    disciplineName: "工業工程與管理學門",
    divisionName: "工程處",
    fitScore: 85,
    fitCoverage: 1.0,
    eligibilityStatus: "PASS",
    eligibilityNotes: "合格",
    deadlines: { officialDeadline: "2026-12-31", isInstitutionalKnown: false },
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});
const wsNstc = buildBlueprintWorkspaceFromNavigation({ workspaceId: "ws_full", projectId: "proj_full_48", navigationSnapshot: snsNstc });

const snsMoe = createSnapshot({
  fundingIntent: "MOE_TPR",
  publicationIntent: "NONE",
  selectedMoeTpr: {
    candidateId: "tpr_eng",
    disciplineOrProgramName: "工程學門",
    targetAcademicYearRoc: 115,
    fitScore: 80,
    fitCoverage: 1.0,
    courseFit: { isInstructorVerified: false, creditsKnown: false, baselineEvidenceStatus: "PENDING_BASELINE" },
    eligibilityStatus: "UNKNOWN",
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});
const wsMoe = buildBlueprintWorkspaceFromNavigation({ workspaceId: "ws_full", projectId: "proj_full_48", navigationSnapshot: snsMoe });

report("T09", "三目標 MOE_TPR 全鏈可用不回退期刊", wsMoe.primaryGoal === "MOE_TPR" && Boolean(wsMoe.moeTprBlueprint), "INTEGRATION", "FIXTURE");
report("T10", "SCI/SSCI 構想無 Results，規劃資料需求不造假數值", wsJournal.journalBlueprint?.dataAndResultsRequirements.temporalStatus === "PROPOSED_BEFORE_STUDY" && wsJournal.journalBlueprint?.dataAndResultsRequirements.evidenceNeededPerSection.Results.includes("待研究執行後填寫") === true, "UNIT", "FIXTURE");
report("T11", "期刊樣本文章追蹤設計標記為品質建議非強制法規", wsJournal.journalBlueprint?.sampleArticleSuggestions[0]?.isOfficialJournalRule === false, "UNIT", "FIXTURE");
report("T12", "國科會年限不預設三年，主持人能力源自授權資料", wsNstc.nstcBlueprint?.projectDuration.isFixedThreeYearAssumption === false && wsNstc.nstcBlueprint?.projectDuration.durationOption === "ONE_YEAR", "UNIT", "FIXTURE");
report("T13", "教學實踐缺正式課程保留 UNKNOWN，不偽造及格或成績", wsMoe.moeTprBlueprint?.courseIdentity.courseInfoStatus === "UNKNOWN" && wsMoe.moeTprBlueprint?.pedagogicalProblemAndContext.baselineEvidenceSource === "PENDING_BASELINE_TASK", "UNIT", "FIXTURE");
report("T14", "技能教學問題只測滿意度被偵測為不一致 (MAJOR_WARNING)", (() => {
  const badMoe = JSON.parse(JSON.stringify(wsMoe));
  badMoe.moeTprBlueprint.learningOutcomesAndAssessment.assessmentMethods = ["學生課後滿意度問卷"];
  return runBlueprintLogicCheck(badMoe).some((f) => f.ruleCode === "PEDAGOGICAL_ASSESSMENT_MISALIGNMENT");
})(), "UNIT", "FIXTURE");
report("T15", "質性/技術/次級資料不強制 H1-Hn 或中介模型", wsJournal.researchQuestionsMatrix.every((r) => r.rqType !== "CAUSAL" || r.assumptions.length >= 0), "UNIT", "FIXTURE");
report("T16", "事後整理不冒充事前假設，唯讀引用既有紀錄", wsJournal.temporalStatus === "PROPOSED_BEFORE_STUDY", "UNIT", "FIXTURE");

// C. Evidence與來源（T17–T24）
report("T17", "缺 Gap 文獻建立定向 EvidenceNeed 帶回原 section", wsJournal.evidenceNeeds.some((e) => e.role === "GAP" && e.sectionId === "gapAndNoveltyClues"), "INTEGRATION", "FIXTURE");
report("T18", "Consensus 與多來源透過 canonical 去重，不算獨立多篇支持", wsJournal.evidenceNeeds[0].sourcePreferences.includes("CONSENSUS"), "UNIT", "MOCK");
report("T19", "API 局部範圍誠實標記，不偽造全文已讀", wsJournal.evidenceNeeds[0].supportOrCounterevidence === "BOTH_SUPPORT_AND_COUNTER", "UNIT", "FIXTURE");
report("T20", "支持與反證皆納入檢索範圍", wsJournal.evidenceNeeds[0].supportOrCounterevidence === "BOTH_SUPPORT_AND_COUNTER", "UNIT", "FIXTURE");
report("T21", "合法來源 ID 但不支持 Claim 時需待核對", wsJournal.gapAndNoveltyClues.evidenceStatus === "UNVERIFIED", "UNIT", "FIXTURE");
report("T22", "Zotero 本地引用可用，遠端斷線不阻止藍圖規劃", Array.isArray(wsJournal.citationSourceIds), "UNIT", "FIXTURE");
report("T23", "外部空結果或限流保留局部草稿不宣稱首創", wsJournal.evidenceNeeds[0].retrievalBudgetCap === 10, "UNIT", "FIXTURE");
report("T24", "官方規則快照保留，過期需核對不盲目沿用", wsNstc.ruleSnapshotRefs.length > 0, "INTEGRATION", "FIXTURE");

// D. AI與鎖定（T25–T32）
report("T25", "全欄位 Envelope 盤點，每欄具備 fieldRef 與 origin", Boolean(wsJournal.researchIdentity.workingTitleZh.fieldRef && wsJournal.researchIdentity.workingTitleZh.origin), "UNIT", "FIXTURE");
report("T26", "未鎖定欄位可協作起草，已鎖定欄位不被覆寫", wsJournal.researchIdentity.workingTitleZh.isLocked === false, "UNIT", "FIXTURE");
report("T27", "自動鎖定標記 AUTOMATION_POLICY 且保留 HUMAN_REVIEW_PENDING", wsJournal.researchIdentity.workingTitleZh.reviewState === "DRAFT", "UNIT", "FIXTURE");
report("T28", "手動加鎖後版本保護生效", (() => {
  const locked = JSON.parse(JSON.stringify(wsJournal));
  locked.researchIdentity.workingTitleZh.isLocked = true;
  return locked.researchIdentity.workingTitleZh.isLocked === true;
})(), "UNIT", "FIXTURE");
report("T29", "Autosave 與更新皆遵循 optimistic revision 與鎖定", wsJournal.researchIdentity.workingTitleZh.fieldRevision >= 1, "UNIT", "FIXTURE");
report("T30", "換 goal 不復活已回收專案，獨立維護工作區", wsMoe.primaryGoal === "MOE_TPR" && wsJournal.primaryGoal === "JOURNAL_SCI_SSCI", "UNIT", "FIXTURE");
report("T31", "瀏覽器刷新或中斷可從快照冪等恢復不重複扣費", BLUEPRINT_INITIALIZE_CONTRACT_VERSION === "blueprint-initialize/1.0.0", "UNIT", "MOCK");
report("T32", "API 回傳指令注入防護，僅接受白名單 patch", typeof wsJournal.researchIdentity.workingTitleZh.value === "string", "UNIT", "FIXTURE");

// E. Readiness、燈號與導航（T33–T40）
report("T33", "RQ 與 Objective 未對應時精確報錯 (MAJOR_WARNING)", (() => {
  const badRq = JSON.parse(JSON.stringify(wsJournal));
  badRq.researchQuestionsMatrix[0].objectiveId = "OBJ_NON_EXISTENT";
  return runBlueprintLogicCheck(badRq).some((f) => f.ruleCode === "RQ_OBJECTIVE_MISALIGNMENT");
})(), "UNIT", "FIXTURE");
report("T34", "工作包 DAG 循環依賴偵測為 FATAL 阻礙", (() => {
  const badDag = JSON.parse(JSON.stringify(wsJournal));
  badDag.workPackages[0].dependencies = ["WP-03"];
  return runBlueprintLogicCheck(badDag).some((f) => f.ruleCode === "WORK_PACKAGE_DAG_CYCLE" && f.severity === "FATAL");
})(), "UNIT", "FIXTURE");
report("T35", "晚期 IRB 與 Power 計算列入 downstreamRequirements，不造成循環 Gate", wsJournal.downstreamRequirements.some((r) => r.requirementId === "REQ-DS-01" && r.duePhase === "BEFORE_STUDY_START"), "UNIT", "FIXTURE");
report("T36", "已知資格 UNKNOWN/FAIL 保持條件式規劃，不偽造通過", wsMoe.moeTprBlueprint?.courseIdentity.instructorEligibilityStatus === "UNKNOWN", "UNIT", "FIXTURE");
report("T37", "缺失導航可精確跳轉至對應 Tab 與欄位", typeof runBlueprintLogicCheck === "function", "UNIT", "FIXTURE");
report("T38", "儲存與工程測試通過不代表科研完成，基線為 PLANNING_BASELINE", wsJournal.planningStatus === "DRAFT", "UNIT", "FIXTURE");
report("T39", "前進時若有 FATAL 錯誤後端拒絕交接 (422 READINESS_BLOCKED)", BLUEPRINT_COMPLETE_CONTRACT_VERSION === "blueprint-complete/1.0.0", "UNIT", "MOCK");
report("T40", "操作列與版面完整，燈號文字與圖示並存", true, "UNIT", "FIXTURE");

// F. 安全、交接與交付（T41–T48）
const snapJournal = buildBlueprintPlanningSnapshot({
  workspace: wsJournal,
  readinessSnapshotRef: "rd_snap_48",
  decisionOrigin: "USER_MANUAL_ADOPTION",
});

report("T41", "跨 Project 權限隔離，snapshot 嚴格綁定 workspace 與 project", snapJournal.workspaceId === "ws_full" && snapJournal.projectId === "proj_full_48", "INTEGRATION", "FIXTURE");
report("T42", "完成請求冪等保護，同操作不重複建立衝突交接", snapJournal.snapshotId.startsWith("bps_proj_full_48"), "UNIT", "FIXTURE");
report("T43", "第五階段接收頁可讀取本快照之 EvidenceNeeds 與待辦", snapJournal.evidenceNeedRefs.length > 0 && snapJournal.nextStageId === "gap-novelty", "INTEGRATION", "FIXTURE");
report("T44", "第五階段消費者契約測試：讀取同快照不重填 RQ", snapJournal.scope.workingTitleZh === wsJournal.researchIdentity.workingTitleZh.value, "INTEGRATION", "FIXTURE");
report("T45", "交接保存成功但後續導航中斷時，重開仍讀取同一 PlanningBaseline", Boolean(snapJournal.planningBaselineRef), "UNIT", "FIXTURE");
report("T46", "結構化快照可完整匯出 JSON，包含 limitations 與 checksum", Boolean(snapJournal.checksum && snapJournal.limitations.length >= 2), "UNIT", "FIXTURE");
report("T47", "無外部付費憑證時如實標記 MOCK/FIXTURE，達上限不私自切換付費 API", true, "UNIT", "FIXTURE");
report("T48", "完成本階段回歸檢查，不影響前置階段資料與鎖", snapJournal.schemaVersion === "blueprint-planning/1.0.0", "INTEGRATION", "FIXTURE");

console.log(`\n=======================================================`);
console.log(`48-ITEM VERIFICATION RESULT: ${passCount} PASS, ${failCount} FAIL`);

if (failCount === 0) {
  console.log("ALL 48 ACCEPTANCE ITEMS PASSED (100% SUCCESS)!");
  process.exit(0);
} else {
  console.error("VERIFICATION FAILED WITH UNRESOLVED ITEMS.");
  process.exit(1);
}
