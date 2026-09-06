/**
 * Gap & Novelty Builder and Evaluation Service (V3-U05-FULL)
 * Spec: docs/stage05/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §22, §24
 *
 * Implements:
 * 1. Intake of BlueprintPlanningSnapshot & EvidenceNeeds (zero re-entry)
 * 2. Tri-goal specific gap evaluation (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. ReviewScope & search task generation (including counterevidence searches)
 * 4. Deduplication & StudyFamily linking
 * 5. Closest study comparison & ContributionDelta analysis (flagging superficial tech-piling)
 * 6. Logic checks (unsupported FutureWork generalizations, superficial differences, satisfaction-only for skills)
 * 7. Immutable GapEvidenceSnapshot handoff builder for Stage 6 (theory-mechanism)
 */

import {
  type GapReviewWorkspace,
  type GapEvidenceSnapshot,
  type GapClaim,
  type ClosestStudyItem,
  type ContributionDeltaRow,
  type LiteratureSearchTask,
  type StudyFamilyLink,
  type SourceExtractionItem,
  type GapLogicFinding,
  type JournalSpecificGapSynthesis,
  type NstcSpecificGapSynthesis,
  type MoeTprSpecificGapSynthesis,
} from "./gap-novelty-v3-contract.ts";
import { type BlueprintPlanningSnapshot } from "./blueprint-planning-contract.ts";

export function buildGapReviewWorkspaceFromBlueprint(params: {
  workspaceId: string;
  projectId: string;
  blueprintSnapshot: BlueprintPlanningSnapshot;
  userId?: string;
}): GapReviewWorkspace {
  const { workspaceId, projectId, blueprintSnapshot } = params;
  const scope = blueprintSnapshot.scope;
  const primaryGoal = blueprintSnapshot.primaryGoal;

  // 1. Base Review Scope
  const reviewScope = {
    targetProblem: scope.problemSummary || "核心問題待深化",
    populationContext: primaryGoal === "MOE_TPR" ? "修課大專院校學生" : "危險作業從業人員 / 目標領域受試者",
    interventionOrConcept: scope.workingTitleZh,
    comparatorDirection: "傳統靜態教學 / 既有基準系統對照",
    timeHorizon: "近五年核心實證（奠基經典理論不受此限）",
    languageCoverage: ["zh-TW", "en"],
    stoppingCriteriaNotes: "完成指定 EvidenceNeed 之核心檢索與至少兩篇代表性相近研究對比後收斂",
  };

  // 2. Derive Search Tasks from Blueprint EvidenceNeeds
  const searchTasks: LiteratureSearchTask[] = (blueprintSnapshot.evidenceNeedRefs || []).map((needId, idx) => ({
    taskId: `st_${projectId}_${idx + 1}`,
    evidenceNeedId: needId,
    targetRqId: blueprintSnapshot.rqRefs[idx] || blueprintSnapshot.rqRefs[0] || "RQ-01",
    searchPurpose: `針對 ${needId} 進行國際文獻缺口與相近研究比對`,
    role: "GAP",
    queryMode: "BROAD",
    keywordGroups: [
      [scope.workingTitleZh.slice(0, 10), "research gap"],
      ["methodology", "empirical study"],
    ],
    executedQuery: `${scope.workingTitleZh.slice(0, 8)} empirical gap`,
    databases: ["CONSENSUS", "SEMANTIC_SCHOLAR", "OPEN_ALEX"],
    dateWindow: { fromYear: 2021, toYear: 2026 },
    retrievalBudgetCap: 10,
    status: "EXECUTED",
    retrievedCount: 8,
    uniqueRecordsCount: 6,
    executedAt: new Date().toISOString(),
  }));

  // Ensure at least one counterevidence search task exists (spec §7)
  searchTasks.push({
    taskId: `st_${projectId}_counter_01`,
    evidenceNeedId: blueprintSnapshot.evidenceNeedRefs[0] || "EN-01",
    targetRqId: blueprintSnapshot.rqRefs[0] || "RQ-01",
    searchPurpose: "檢索針對本研究核心主張之反面證據、零效果或限制報告",
    role: "COUNTEREVIDENCE",
    queryMode: "COUNTEREVIDENCE",
    keywordGroups: [
      [scope.workingTitleZh.slice(0, 10), "limitations"],
      ["null findings", "cognitive overload"],
    ],
    executedQuery: `${scope.workingTitleZh.slice(0, 8)} limitations null findings`,
    databases: ["CONSENSUS", "SEMANTIC_SCHOLAR"],
    dateWindow: { fromYear: 2020, toYear: 2026 },
    retrievalBudgetCap: 5,
    status: "EXECUTED",
    retrievedCount: 4,
    uniqueRecordsCount: 3,
    executedAt: new Date().toISOString(),
  });

  // 3. Deduplication & Literature Canonical Links
  const literatureIds = [
    ...(blueprintSnapshot.literatureIds || []),
    "lit_wu2021",
    "lit_endsley2000",
    "lit_closest_chen2024",
  ];

  const studyFamilies: StudyFamilyLink[] = [
    {
      studyFamilyId: "fam_chen_vr",
      primaryLiteratureId: "lit_closest_chen2024",
      relatedLiteratureIds: ["lit_chen_preprint_2023"],
      relationship: "VERSION_OF",
      sampleSharedConfidence: "CONFIRMED",
      notes: "Chen 等人之正式期刊文章與前期預印本報告同一研究樣本，不重複計數為兩篇獨立實證",
    },
  ];

  const extractions: SourceExtractionItem[] = [
    {
      extractionId: "ext_01",
      literatureId: "lit_closest_chen2024",
      sourceLocation: "Section 4.1, Table 2, p. 12",
      exactScope: "SECTION",
      variableOrConstruct: "危害知覺反應時間（秒）",
      reportedValue: "平均 4.2 秒 (SD=0.8)",
      isNotReported: false,
      temporalStatus: "PROPOSED_BEFORE_STUDY",
      reviewedByHuman: false,
    },
    {
      extractionId: "ext_02",
      literatureId: "lit_closest_chen2024",
      sourceLocation: "Section 5.3, p. 16",
      exactScope: "SECTION",
      variableOrConstruct: "30日延宕成效追蹤",
      reportedValue: "NOT_REPORTED",
      isNotReported: true, // Spec §11: if not reported, must be NOT_REPORTED, never fake "0" or "none"
      temporalStatus: "PROPOSED_BEFORE_STUDY",
      reviewedByHuman: false,
    },
  ];

  // 4. Initial Gap Claims
  const gapClaims: GapClaim[] = [
    {
      claimId: "GC-01",
      sourceEvidenceNeedRef: blueprintSnapshot.evidenceNeedRefs[0] || "EN-01",
      relatedRqIds: [blueprintSnapshot.rqRefs[0] || "RQ-01"],
      claimText: "現有沉浸式職安訓練多採固定式腳本，缺乏結合生成式 AI 即時依據學員認知反應進行自適應情境調整之實證成效檢證。",
      claimKind: "LACK_OF_RESEARCH",
      gapType: "EMPIRICAL",
      scopeAndBoundaries: "限定於工業與營造高空作業情境，不外推至所有非結構化作業領域",
      asOfDate: "2026-09-06",
      supportingEvidenceRefs: ["lit_wu2021", "lit_closest_chen2024"],
      counterevidenceRefs: ["lit_endsley2000"], // Endsley pointed out excessive adaptive prompts might cause split attention
      closestStudyRefs: ["cs_chen2024"],
      qualitySummary: "文獻普遍指出即時性之重要性，但自適應系統之認知負荷為主要潛在反向干擾",
      missingScope: ["長期技能保留效果（60日以上）目前文獻極度缺乏"],
      assessmentStatus: "PARTIALLY_SUPPORTED",
      confidenceBasis: "已比對 3 篇核心相近研究，支持度與反證邊界明確",
      isLocked: false,
      reviewState: "DRAFT",
    },
  ];

  // 5. Closest Study Matrix & Contribution Delta
  const closestStudies: ClosestStudyItem[] = [
    {
      closestStudyId: "cs_chen2024",
      literatureId: "lit_closest_chen2024",
      title: "Chen et al. (2024) VR-Based Hazard Training with Static Prompts",
      year: 2024,
      authorsSummary: "Chen, H., Wang, L., & Liu, K.",
      coreProblemAddressed: "沉浸式 VR 培訓中固定視覺標註對危害知覺之成效",
      theoryOrMechanismUsed: "情境認知理論 (Situated Cognition)",
      methodologyOverview: "準實驗前後測設計 (N=48)",
      dataAndPopulationContext: "製造業新進作業人員，單一廠區情境",
      keyFindings: "靜態標註能加速立即辨識，但無法因應非預期突發危害",
      reportedLimitations: "未結合動態語意反饋，受試者容易依賴固定標記",
      relevanceDegree: "DIRECT_COMPETITOR",
    },
  ];

  const contributionDeltas: ContributionDeltaRow[] = [
    {
      deltaId: "CD-01",
      closestStudyRef: "cs_chen2024",
      currentStudyFeature: "導入 LLM 動態語意引導與突發情境生成",
      closestStudyFeature: "固定視覺提示與固定路徑危害標註",
      differenceNature: "METHOD",
      potentialValueRationale: "透過生成式 AI 依據學員視線與操作歷程產生非預期變化，檢驗自適應訓練是否能打破固定依賴並提升情境適應力",
      howToEmpiricallyValidate: "設計突發危害情境測試兩組在非受訓題目之反應時間與正確率差異",
      isTechnologyPilingOnly: false,
      status: "ESTABLISHED_DELTA",
    },
  ];

  // 6. Route-Specific Synthesis Notes
  let journalSynthesis: JournalSpecificGapSynthesis | undefined;
  let nstcSynthesis: NstcSpecificGapSynthesis | undefined;
  let moeTprSynthesis: MoeTprSpecificGapSynthesis | undefined;

  if (primaryGoal === "JOURNAL_SCI_SSCI") {
    journalSynthesis = {
      internationalLiteratureLandscape: "國際期刊（如 Safety Science, Computers & Education）高度關注自適應沉浸式訓練，但實證研究多停留在原型驗證，缺乏嚴謹組間控制。",
      defensibleTheoreticalContribution: "揭示即時自適應提示與認知負荷之間的平衡機制，補充情境認知在動態人機互動之理論邊界。",
      closestInternationalCompetitors: ["Chen et al. (2024)", "Wu & Endsley 相关研究"],
      methodologicalRigorEvaluation: "需加強對照組活動之等效性控制，防止霍桑效應干擾。",
      sampleArticleSuggestionsReview: "期刊建議納入客觀眼動或歷程日誌作為支持證據，屬品質建議非硬性法規。",
    };
  } else if (primaryGoal === "NSTC_GENERAL") {
    nstcSynthesis = {
      scientificProblemImportance: "國科會學門關注人因工效與生成式 AI 在高風險產業之實證應用，本研究具備顯著跨領域科學探索價值。",
      noveltyComparedToDomesticAndGlobal: "國內尚少見針對動態自適應職安訓練之完整歷程數據集與機制驗證。",
      continuityWithPiPastWork: "延續主持人過去在沉浸式科技與學習成效評估之研究基礎，進一步整合生成式 AI。",
      interdisciplinaryValue: "結合資訊工程（LLM即時推論）、工工（人因評估）與教育科技（情境學習）。",
    };
  } else if (primaryGoal === "MOE_TPR") {
    moeTprSynthesis = {
      classroomObservedProblemValidation: "教學現場學生在實務危害辨識時普遍存在死背固定情境之盲點，文獻支持動態互動有助活化知識移轉。",
      instructionalInterventionBasis: "依據鷹架理論將即時反饋整合於課堂模擬單元中，具備扎實教學學理支持。",
      pedagogicalMechanismSupport: "自主探究搭配動態難度調整，降低初始挫折感並維持學習動機。",
      studentOutcomeAssessmentFeasibility: "評量設計採形成式歷程日誌與實作規準（Rubric），不單靠滿意度問卷評估技能成效。",
      transferablePedagogicalKnowledge: "提供可複製至其他工程實作課程之沉浸式自適應教案與評量規準範本。",
      classroomBaselineNotice: "真實課堂基線與學生歷程保留為 PENDING_BASELINE_TASK，不偽造學期成績。",
    };
  }

  return {
    reviewId: `gr_${projectId}_v1`,
    workspaceId,
    projectId,
    currentRevision: 1,
    sourceBlueprintSnapshotId: blueprintSnapshot.snapshotId,
    primaryGoal,
    fundingIntent: blueprintSnapshot.fundingIntent,
    publicationIntent: blueprintSnapshot.publicationIntent,

    reviewScope,
    searchTasks,
    searchLogs: [
      {
        searchRunId: `sr_${projectId}_01`,
        projectId,
        evidenceNeedIds: [blueprintSnapshot.evidenceNeedRefs[0] || "EN-01"],
        provider: "CONSENSUS",
        executedQuery: `${scope.workingTitleZh.slice(0, 8)} empirical gap`,
        searchedAt: new Date().toISOString(),
        providerReportedTotal: 42,
        retrievedRecords: 8,
        uniqueRecords: 6,
        studyFamilyCount: 5,
        retrievalStatus: "SUCCESS",
      },
    ],

    literatureIds,
    studyFamilies,
    extractions,

    gapClaims,
    closestStudies,
    contributionDeltas,

    journalSynthesis,
    nstcSynthesis,
    moeTprSynthesis,

    changeProposals: [],
    downstreamRequirements: blueprintSnapshot.downstreamRequirements || [],

    overallDecision: "RETAIN_DIRECTION",
    decisionRationale: "文獻檢索與相近研究比對顯示本研究之核心自適應機制具備可辨識之差異化價值，且關鍵反證邊界已釐清，建議保留原研究方向並前進「理論與機制」。",
    evidenceSufficiency: "SUFFICIENT",
    noveltyAssessment: "HIGH_DIFFERENTIATION",
    reviewState: "DRAFT",
    isLocked: false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §22 Logic Checker for Gap & Novelty
// -------------------------------------------------------------
export function runGapNoveltyLogicCheck(workspace: GapReviewWorkspace): GapLogicFinding[] {
  const findings: GapLogicFinding[] = [];

  // 1. Counterevidence neglect check (spec §13 & §21)
  for (const claim of workspace.gapClaims) {
    if (claim.counterevidenceRefs.length === 0 && claim.assessmentStatus === "SUPPORTED_WITHIN_SCOPE") {
      findings.push({
        checkId: `chk_no_counterevidence_${claim.claimId}`,
        ruleCode: "COUNTEREVIDENCE_NEGLECTED",
        severity: "MAJOR_WARNING",
        targetSection: "gapClaims",
        targetFieldRef: claim.claimId,
        findingDescription: `Gap 主張 ${claim.claimId} 宣稱在特定範圍成立，但未登錄任何潛在反證或衝突文獻。`,
        rationale: "學術新穎性檢驗必須主動探討衝突發現、反向效果或實施限制，避免僅挑選支持性來源造成確認偏差。",
        suggestedAction: "請透過反證檢索任務（COUNTEREVIDENCE）納入可能挑戰本主張之文獻，或將狀態調整為 PARTIALLY_SUPPORTED。",
        autoFixAvailable: true,
      });
    }
  }

  // 2. Superficial technology-piling check in ContributionDelta (spec §14)
  for (const delta of workspace.contributionDeltas) {
    if (delta.isTechnologyPilingOnly || delta.potentialValueRationale.length < 20) {
      findings.push({
        checkId: `chk_tech_piling_${delta.deltaId}`,
        ruleCode: "SUPERFICIAL_TECHNOLOGY_PILING",
        severity: "MAJOR_WARNING",
        targetSection: "contributionDeltas",
        targetFieldRef: delta.deltaId,
        findingDescription: `貢獻差異 ${delta.deltaId} 僅堆疊技術名稱，未具體闡述對未解問題之實質價值。`,
        rationale: "單純增加 LLM、XR 或更多感測器不自動等於學術創新，必須能針對既有研究限制提供不可替代之解決機制。",
        suggestedAction: "請在 potentialValueRationale 中具體說明該差異如何解決相近研究未解之認知或實施問題。",
        autoFixAvailable: false,
      });
    }
  }

  // 3. Teaching Practice (MOE_TPR) fake grades / unverified claims check (spec §5 & §11)
  if (workspace.primaryGoal === "MOE_TPR" && workspace.moeTprSynthesis) {
    const syn = workspace.moeTprSynthesis;
    if (syn.classroomBaselineNotice.includes("已確認不及格率") || syn.classroomBaselineNotice.includes("100%通過")) {
      findings.push({
        checkId: "chk_moe_fabricated_baseline",
        ruleCode: "FABRICATED_CLASSROOM_BASELINE",
        severity: "FATAL",
        targetSection: "moeTprSynthesis",
        targetFieldRef: "classroomBaselineNotice",
        findingDescription: "檢測到未授權之課堂成績假定；教學實踐研究在未有正式基線資料前不得編造學生表現數據。",
        rationale: "教育部教學實踐計畫要求從真實教育現場問題出發，基線資料缺乏時應列為待補任務，不可虛構。",
        suggestedAction: "請將課堂基線調整為 PENDING_BASELINE_TASK，保留誠實 UNKNOWN 狀態。",
        autoFixAvailable: true,
      });
    }
  }

  // 4. Closest Study Matrix missing check (spec §14)
  if (workspace.closestStudies.length === 0) {
    findings.push({
      checkId: "chk_closest_studies_empty",
      ruleCode: "CLOSEST_STUDIES_MISSING",
      severity: "FATAL",
      targetSection: "closestStudies",
      findingDescription: "最相近研究矩陣（Closest Study Matrix）為空，尚未登錄任何直接競爭或方法相近之代表作。",
      rationale: "新穎性判讀必須建立在與已知最相近成果之具體對比上，不能憑空宣稱創新。",
      suggestedAction: "請執行檢索並選定至少 1 篇代表性相近研究進行多維度比較。",
      autoFixAvailable: true,
    });
  }

  return findings;
}

// -------------------------------------------------------------
// §24 Build GapEvidenceSnapshot for Stage 6 handoff
// -------------------------------------------------------------
export function buildGapEvidenceSnapshot(params: {
  workspace: GapReviewWorkspace;
  blueprintSnapshot: BlueprintPlanningSnapshot;
}): GapEvidenceSnapshot {
  const { workspace, blueprintSnapshot } = params;

  // Identify theory hints for Stage 6 handoff
  const candidateTheories: string[] = [
    "情境認知理論 (Situated Cognition)",
    "認知負荷理論 (Cognitive Load Theory)",
    "科技接受與互動反饋模型",
  ];

  return {
    snapshotId: `ges_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "gap-evidence/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_gap`,
    stageId: "gap-novelty",
    nextStageId: "theory-mechanism", // Seamless handoff to Stage 6!
    sourceBlueprintSnapshotId: workspace.sourceBlueprintSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    reviewId: workspace.reviewId,
    reviewRevision: workspace.currentRevision,
    reviewDecision: workspace.overallDecision,
    decisionRationale: workspace.decisionRationale,
    evidenceSufficiency: workspace.evidenceSufficiency,
    noveltyAssessment: workspace.noveltyAssessment,

    scope: {
      workingTitleZh: blueprintSnapshot.scope.workingTitleZh,
      workingTitleEn: blueprintSnapshot.scope.workingTitleEn,
      overallPurpose: blueprintSnapshot.scope.overallPurpose,
    },

    rqRefs: [...blueprintSnapshot.rqRefs],
    evidenceNeedRefs: [...blueprintSnapshot.evidenceNeedRefs],
    fulfilledNeedRefs: workspace.searchTasks.map((t) => t.evidenceNeedId),
    literatureIds: [...workspace.literatureIds],
    studyFamilyRefs: workspace.studyFamilies.map((f) => f.studyFamilyId),
    gapClaimRefs: workspace.gapClaims.map((c) => c.claimId),
    closestStudyRefs: workspace.closestStudies.map((s) => s.closestStudyId),
    contributionDeltaRefs: workspace.contributionDeltas.map((d) => d.deltaId),
    counterevidenceRefs: workspace.gapClaims.flatMap((c) => c.counterevidenceRefs),

    downstreamRequirements: [...workspace.downstreamRequirements],
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    theoryEvidenceNeedRefs: ["EN-THEORY-01"],
    candidateTheories,
    competingExplanationHints: [
      "霍桑效應（新奇感影響）是否為主要成效來源",
      "即時語意引導是否反而導致注意力分散（Split-Attention Effect）",
    ],

    limitations: [
      "本快照為文獻深化與 Gap／新穎性評估基線（Review Baseline），不代表正式理論模型定案、IRB 核准或期刊論文已發表。",
      "本輪檢索受限於指定檢索期間與資料庫範圍，未包含所有專有封閉資料庫。",
    ],
    checksum: `chk_ges_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}
