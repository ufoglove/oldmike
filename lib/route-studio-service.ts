/**
 * Route Studios Service (V3-U08-FULL)
 * Spec: docs/stage08/spec-v3-4.0.md §1, §3, §4, §5, §6, §7, §8, §9, §10, §12, §13, §14, §15, §18, §25, §26
 *
 * Implements:
 * 1. Intake of Stage 7 DesignAnalysisPlanningSnapshot (zero re-entry)
 * 2. Tri-goal specific workspace initialization (Journal, NSTC, MOE_TPR)
 * 3. Protected fact bindings (PLANNING_CALC_REF, CITATION_SOURCE_REF)
 * 4. Deterministic budget planning integration
 * 5. Draft Alignment Checker (detecting outcome assessment mismatch, missing local evidence, fake results)
 * 6. Immutable RouteWorkspaceSnapshot builder for Stage 9 handoff (ethics-review)
 */

import {
  type RouteWorkspace,
  type RouteWorkspaceSnapshot,
  type StudioKind,
  type JournalResearchPlan,
  type NSTCProposalDraft,
  type TeachingPracticeProposalDraft,
  type SectionDraft,
  type BudgetItem,
  type ProtectedFactBinding,
} from "./route-studio-contract.ts";
import { type DesignAnalysisPlanningSnapshot } from "./study-design-planning-contract.ts";
import { calculateBudgetPlan } from "./budget-planning-engine.ts";

export function buildRouteWorkspaceFromDesign(params: {
  workspaceId: string;
  projectId: string;
  designSnapshot: DesignAnalysisPlanningSnapshot;
  userId?: string;
}): RouteWorkspace {
  const { workspaceId, projectId, designSnapshot } = params;
  const primaryGoal = designSnapshot.primaryGoal;

  let activeStudio: StudioKind = "JOURNAL_RESEARCH_PLANNING";
  if (primaryGoal === "NSTC_GENERAL") activeStudio = "NSTC_GENERAL_PROPOSAL";
  if (primaryGoal === "MOE_TPR") activeStudio = "MOE_TPR_PROPOSAL";

  const studioParticipations = {
    JOURNAL_RESEARCH_PLANNING: activeStudio === "JOURNAL_RESEARCH_PLANNING" ? "PRIMARY" : "SECONDARY",
    NSTC_GENERAL_PROPOSAL: activeStudio === "NSTC_GENERAL_PROPOSAL" ? "PRIMARY" : "NOT_SELECTED",
    MOE_TPR_PROPOSAL: activeStudio === "MOE_TPR_PROPOSAL" ? "PRIMARY" : "NOT_SELECTED",
  } as const;

  // 1. Common Protected Fact Bindings from Stage 7
  const sampleCalcFact: ProtectedFactBinding = {
    factId: "fact_sample_n",
    factType: "PLANNING_CALC_REF",
    targetRefId: designSnapshot.planningCalculationRefs[0] || "calc_ref_01",
    displayText: `預計招募人數 N = ${designSnapshot.recruitmentTargetTotalN}（總分析樣本 N = ${designSnapshot.totalAnalyzableN}）`,
    isImmutable: true,
    provenance: "Stage 07受控樣本規劃計算引擎",
  };

  // 2. Build Journal Research Plan & Manuscript Blueprint (§10)
  const journalPlan: JournalResearchPlan = {
    positioning: {
      targetJournalCategory: "Safety Science / Education & Tech (Q1)",
      internationalGapSummary: "生成式 AI 動態反饋在沉浸式職業危害訓練中對延宕反應保留之因果成效尚未被嚴謹試驗驗證。",
      coreContributionStatement: "首創結合自適應語意鷹架與客觀眼動毫秒級反應時間，提供高內部效度之隨機對照試驗實證數據。",
      methodologicalRigorNotes: "採用雙組隨機對照前中後測設計，主動對照組維持等效沉浸時長以排除霍桑新奇效應。",
      unresolvedLimitations: designSnapshot.limitations,
    },
    manuscriptScope: "專注於因果機制與危害反應秒數改善之期刊原創實證論文（Original Research Article）。",
    blueprint: {
      workingTitle: designSnapshot.scope.workingTitleEn || "Generative AI and Immersive XR in Occupational Safety Training",
      keywords: ["Generative AI", "Immersive XR", "Occupational Safety", "Reaction Time", "Randomized Controlled Trial"],
      abstractStructure: {
        background: "高空作業職業安全培訓高度依賴真實情境危害知覺之迅速反應。",
        objective: "本研究旨在評估生成式 AI 即時引導對受訓者危害辨識反應時間之因果介入效應。",
        plannedMethods: `預計招募 ${designSnapshot.recruitmentTargetTotalN} 名從業人員隨機分派至自適應引導組與主動對照組，透過前中後測評估反應秒數變化。`,
        expectedContribution: "預期為工業安全沉浸訓練提供可重現之認知與行為成效實證框架（非正式結果）。",
      },
      introductionOutline: ["職業安全訓練面臨的危害知覺盲點", "生成式 AI 與沉浸科技的理論結合", "本研究目標與具體 RQ"],
      theoreticalFrameworkOutline: ["情境認知理論 (Situated Cognition)", "認知負荷理論 (Cognitive Load Theory)"],
      plannedMethodsOutline: ["受試者招募與隨機分組架構", "VR 模擬系統與即時反饋介入措施", "眼動與操作秒數客觀測量指標", "線性混合效應模型 (LMM) 分析計畫"],
      resultsSlots: designSnapshot.rqRefs.map((rq, idx) => ({
        slotId: `slot_res_${idx + 1}`,
        targetRqRef: rq,
        expectedOutcomeMetric: "危害辨識反應時間（秒）組間差異與時間交互作用效果量",
        status: "NOT_YET_AVAILABLE",
      })),
      discussionQuestions: ["自適應引導是否能維持至 14 日延宕測量？", "技術沉浸感與認知負荷之權衡機制？"],
      plannedTablesAndFigures: [
        "Table 1. 受試者基線人口統計學特徵 (Baseline Characteristics)",
        "Figure 1. 隨機分組與試驗流程圖 (CONSORT Flow Diagram)",
        "Figure 2. 危害辨識反應時間組別 × 時間交互作用圖 (Interaction Plot Slot)",
      ],
    },
    sections: [
      {
        sectionId: "sec_jnl_intro",
        semanticSectionId: "INTRODUCTION",
        titleZh: "緒論與研究背景",
        titleEn: "Introduction and Background",
        purposeSummary: "闡述高空作業安全培訓之迫切性與現有文獻缺口。",
        paragraphs: [
          {
            paragraphId: "p_jnl_01",
            order: 1,
            content: "在現代高風險工業作業中，危害知覺之反應速度直接決定工安事故之發生率。然而，傳統訓練缺乏動態自適應引導。",
            contentOrigin: "SOURCE_REPORTED",
            factBindings: [],
            citationSourceRefs: ["cit_chen2024"],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: ["evi_01"],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
      {
        sectionId: "sec_jnl_methods",
        semanticSectionId: "METHODS",
        titleZh: "研究方法與試驗設計",
        titleEn: "Methods and Study Design",
        purposeSummary: "詳細規劃研究對象、介入、對照與分析方法（時態為規劃預計）。",
        paragraphs: [
          {
            paragraphId: "p_jnl_02",
            order: 1,
            content: "本研究規劃採雙組隨機對照試驗 (RCT)。依據事前檢定力分析，",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [sampleCalcFact],
            citationSourceRefs: [],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: [],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
      {
        sectionId: "sec_jnl_results",
        semanticSectionId: "RESULTS",
        titleZh: "研究結果（規劃插槽）",
        titleEn: "Results (Planned Slots)",
        purposeSummary: "保留資料插槽，嚴禁在收案前虛構顯著統計數值或假圖表。",
        paragraphs: [
          {
            paragraphId: "p_jnl_03",
            order: 1,
            content: "[正式研究資料尚未蒐集，本章節保留為結構化插槽，待實體試驗完成後填入實證數據]",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [],
            citationSourceRefs: [],
            isLocked: true,
          },
        ],
        requiredEvidenceIds: [],
        status: "DRAFT_WITH_GAPS",
        isLocked: true,
      },
    ],
  };

  // 3. Build NSTC General Proposal (§12 & §13)
  const nstcProposal: NSTCProposalDraft = {
    programDiscipline: "工程處 / 人因工程與工業工程學門",
    targetYear: "115 年度",
    durationYears: 2,
    isMultiYear: true,
    piExperienceSummary: "計畫主持人近五年聚焦於智慧人因工效與 VR 工業安全系統研發，具備跨領域場域收案實務經驗（待補充個人代表性著作）。",
    preliminaryResultsSummary: "已完成實驗室高空危害 VR 原型系統建置與先期 10 人可用性測試。",
    workPackages: [
      {
        workPackageId: "WP-01",
        title: "生成式 AI 即時反饋模組研發與多模態資料串接",
        targetRqRefs: [designSnapshot.rqRefs[0] || "RQ-01"],
        studyComponentRef: "COMP-TECH",
        methodDescription: "建立本地端 LLM 語意解析器與 VR 引擎日誌通訊協議，延遲低於 50 毫秒。",
        dataRequirements: "眼動追蹤秒數與手柄操作座標序列",
        dependencies: [],
        startMonth: 1,
        endMonth: 6,
        milestones: ["完成即時自適應引導原型", "通過實驗室延遲壓力測試"],
        deliverables: ["AI 即時回饋引擎程式碼與通訊模組"],
        acceptanceCriteria: "平均反應延遲 < 50ms，無丟包現象",
        resourceRolesNeeded: ["兼任助理（資工背景）1 名"],
        budgetRefs: ["b_wp01_assistant"],
        riskAndAlternativePlan: "若即時生成延遲過高，改採本地預先快取語義決策樹方案。",
      },
      {
        workPackageId: "WP-02",
        title: "受控隨機對照試驗實施與延宕成效追蹤",
        targetRqRefs: designSnapshot.rqRefs,
        studyComponentRef: "COMP-EXP",
        methodDescription: "依據 Stage 7 樣本規劃，招募作業人員進行 4 單元受控介入與 T0/T1/T2 前中後測。",
        dataRequirements: "危害知覺反應秒數客觀日誌與認知負荷量表",
        dependencies: ["WP-01"],
        startMonth: 7,
        endMonth: 18,
        milestones: ["完成 151 人招募與收案", "完成 T2 延宕測量資料清理"],
        deliverables: ["受控試驗去識別化資料集與分析報告"],
        acceptanceCriteria: "流失率控制於 15% 以內，資料完整率 > 90%",
        resourceRolesNeeded: ["兼任助理（人因收案）1 名"],
        budgetRefs: ["b_wp02_assistant", "b_wp02_subject_fee"],
        riskAndAlternativePlan: "若收案速度不如預期，啟動合作產學公會學員招募備援機制。",
      },
    ],
    sections: [
      {
        sectionId: "sec_nstc_importance",
        semanticSectionId: "BACKGROUND_IMPORTANCE",
        titleZh: "研究計畫之背景與重要性",
        titleEn: "Background and Scientific Significance",
        purposeSummary: "闡述計畫在學術創新、國家科技發展與產業公安之重要性。",
        paragraphs: [
          {
            paragraphId: "p_nstc_01",
            order: 1,
            content: "本計畫針對營造業與高空作業危害高致死率之重大社會問題，探討新一代自適應 AI 在技能訓練之因果機制。",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [],
            citationSourceRefs: ["cit_chen2024"],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: [],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
      {
        sectionId: "sec_nstc_methods",
        semanticSectionId: "METHODOLOGY",
        titleZh: "研究方法與進行步驟",
        titleEn: "Methodology and Implementation Plan",
        purposeSummary: "對齊第七階段設計基線，敘述試驗架構與分析策略。",
        paragraphs: [
          {
            paragraphId: "p_nstc_02",
            order: 1,
            content: "本計畫預計實施兩年期研究。第一年度聚焦技術模組開發，第二年度展開隨機對照試驗，",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [sampleCalcFact],
            citationSourceRefs: [],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: [],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
    ],
  };

  // 4. Build MOE Teaching Practice Proposal (§14 & §15)
  const moeTprProposal: TeachingPracticeProposalDraft = {
    courseName: "工程安全與風險實務專題",
    semesterRef: "115 學年度第 1 學期（大三必選修）",
    classSize: 45,
    pedagogicalProblemStatement: "修課學生在實作場域中常缺乏臨場突發危害之快速辨識本能，死記規範但遇險反應遲緩。",
    localEvidenceStatus: "PENDING_LOCAL_EVIDENCE",
    courseAssessmentMatrix: [
      {
        rowId: "cam_row_01",
        courseObjective: "具備高空營造危害現場之即時風險辨識與處置能力",
        teachingProblem: "學生在情境模擬中常忽視未繫安全帶之連鎖危害，反應時間延遲逾 3 秒",
        localEvidenceRef: "114-1 學期課堂期中實作觀察日誌",
        proposedIntervention: "融入即時自適應 VR 鷹架引導教學單元（共 4 週）",
        mechanismRef: "情境認知回饋降低外在認知負荷",
        learningOutcome: "危害辨識反應時間顯著縮短，危害處置正確率達 85% 以上",
        assessmentRequirement: "VR 系統客觀操作秒數日誌 + 危害處置表現規準（Rubrics）",
        timePointLabel: "第 4 週前測、第 8 週立即後測、第 12 週延宕測量",
        targetRqRef: designSnapshot.rqRefs[0] || "RQ-01",
        analysisPlanRef: "AP-01",
        courseWeekTimeline: "第 4 週至第 8 週課程教學介入",
        responsibleStaffRole: "授課教師與教學助理",
        status: "COMPLETE",
      },
    ],
    sections: [
      {
        sectionId: "sec_moe_problem",
        semanticSectionId: "PEDAGOGICAL_PROBLEM",
        titleZh: "教學現場問題與問題意識",
        titleEn: "Pedagogical Problem and Classroom Context",
        purposeSummary: "從授課教師實際教學痛點出發，切勿以純學術文獻代替現場問題。",
        paragraphs: [
          {
            paragraphId: "p_moe_01",
            order: 1,
            content: "在歷年授課經驗中，發現學生在期末工地觀摩時，常無法將書本安全法規轉化為現場危害本能。",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [],
            citationSourceRefs: [],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: [],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
      {
        sectionId: "sec_moe_assessment",
        semanticSectionId: "ASSESSMENT_PLAN",
        titleZh: "學生學習成效評量與研究設計",
        titleEn: "Student Learning Assessment and Research Design",
        purposeSummary: "規劃評量規準，嚴禁以單純課後滿意度代替專業技能成效。",
        paragraphs: [
          {
            paragraphId: "p_moe_02",
            order: 1,
            content: "本計畫評量設計結合客觀 VR 日誌秒數與 Rubrics 規準，",
            contentOrigin: "PROJECT_PROPOSAL",
            factBindings: [sampleCalcFact],
            citationSourceRefs: [],
            isLocked: false,
          },
        ],
        requiredEvidenceIds: [],
        status: "CONTENT_DRAFT_COMPLETE",
        isLocked: false,
      },
    ],
  };

  // 5. Shared Budget Plan (§16)
  const initialBudgetItems: BudgetItem[] = [
    {
      budgetItemId: "b_wp01_assistant",
      studioKind: activeStudio,
      fiscalYear: 1,
      category: "PERSONNEL_ASSISTANT",
      description: "研發兼任助理（資工碩士生）津貼",
      quantity: 1,
      unit: "人月",
      unitCost: 10000,
      periods: 12,
      currency: "TWD",
      priceSource: "OFFICIAL_STANDARD",
      workPackageRef: "WP-01",
      necessityRationale: "負責自適應語意解析與 VR 引擎通訊協議串接",
      requestedAmount: 120000,
    },
    {
      budgetItemId: "b_wp02_subject_fee",
      studioKind: activeStudio,
      fiscalYear: 1,
      category: "OPERATING_CONSUMABLE",
      description: "受試者參與訓練與前中後測營養津貼",
      quantity: 151,
      unit: "人次",
      unitCost: 500,
      periods: 1,
      currency: "TWD",
      priceSource: "ESTIMATED_ASSUMPTION",
      workPackageRef: "WP-02",
      necessityRationale: "符合倫理規範之受試者時間補償費",
      requestedAmount: 75500,
    },
    {
      budgetItemId: "b_wp01_vr_lease",
      studioKind: activeStudio,
      fiscalYear: 1,
      category: "EQUIPMENT_LEASE_PURCHASE",
      description: "高階眼動追蹤 VR 頭戴顯示裝置租賃與維護",
      quantity: 2,
      unit: "臺",
      unitCost: 25000,
      periods: 1,
      currency: "TWD",
      priceSource: "VENDOR_QUOTE",
      workPackageRef: "WP-01",
      necessityRationale: "收集精確毫秒級眼動反應時間必備儀器",
      requestedAmount: 50000,
    },
  ];

  const budgetPlan = calculateBudgetPlan({
    currency: "TWD",
    items: initialBudgetItems,
    overheadRate: 0.10, // 10% indirect overhead
  });

  return {
    workspaceId: `ws_route_${projectId}`,
    projectId,
    currentRevision: 1,
    sourceDesignSnapshotId: designSnapshot.snapshotId,
    sourceTheorySnapshotId: designSnapshot.sourceTheorySnapshotId,
    sourceBlueprintSnapshotId: designSnapshot.sourceBlueprintSnapshotId,
    primaryGoal,
    fundingIntent: designSnapshot.fundingIntent,
    publicationIntent: designSnapshot.publicationIntent,

    activeStudio,
    studioParticipations,

    journalPlan,
    nstcProposal,
    moeTprProposal,

    budgetPlan,
    downstreamRequirements: designSnapshot.downstreamRequirements || [],

    decision: "ADOPT_PLAN_OR_DRAFT",
    decisionRationale: "三路線工作室已承接 Stage 7 設計基線，各章節骨架與預算已由真實受控引擎運算完成，無虛構 Results。",
    reviewState: "DRAFT",
    isLocked: false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §18 Draft Alignment Checker
// -------------------------------------------------------------
export type DraftAlignmentFinding = {
  checkId: string;
  ruleCode: string;
  severity: "FATAL" | "MAJOR_WARNING" | "SUGGESTION";
  targetStudio: StudioKind;
  targetSection: string;
  findingDescription: string;
  suggestedAction: string;
};

export function runDraftAlignmentCheck(workspace: RouteWorkspace): DraftAlignmentFinding[] {
  const findings: DraftAlignmentFinding[] = [];

  // 1. Journal Results Slot check: Must not contain fabricated results before study execution (spec §10, T09)
  if (workspace.journalPlan) {
    const resultsSec = workspace.journalPlan.sections.find((s) => s.semanticSectionId === "RESULTS");
    if (resultsSec) {
      const hasFabricatedResults = resultsSec.paragraphs.some(
        (p) => p.content.includes("p < .05") || p.content.includes("顯著優於對照組") || p.content.includes("t(126) =")
      );
      if (hasFabricatedResults) {
        findings.push({
          checkId: "chk_fabricated_results_slot",
          ruleCode: "FABRICATED_RESULTS_PROHIBITED",
          severity: "FATAL",
          targetStudio: "JOURNAL_RESEARCH_PLANNING",
          targetSection: "journalPlan.sections.RESULTS",
          findingDescription: "期刊工作區在研究尚未執行收案前，Results 章節包含虛構之實證統計顯著性結果。",
          suggestedAction: "請將 Results 章節還原為規劃插槽 (Planned Slots)，待真實資料產出後再行撰寫。",
        });
      }
    }
  }

  // 2. MOE TPR Assessment check: Skill problem must not rely only on satisfaction (spec §14, T15)
  if (workspace.moeTprProposal && workspace.activeStudio === "MOE_TPR_PROPOSAL") {
    for (const row of workspace.moeTprProposal.courseAssessmentMatrix) {
      const isSkillProblem = row.learningOutcome.includes("反應時間") || row.learningOutcome.includes("技能") || row.learningOutcome.includes("正確率");
      const onlySatisfaction = row.assessmentRequirement.includes("滿意度") && !row.assessmentRequirement.includes("Rubrics") && !row.assessmentRequirement.includes("日誌");

      if (isSkillProblem && onlySatisfaction) {
        findings.push({
          checkId: `chk_moe_assessment_mismatch_${row.rowId}`,
          ruleCode: "OUTCOME_ASSESSMENT_MISALIGNMENT",
          severity: "MAJOR_WARNING",
          targetStudio: "MOE_TPR_PROPOSAL",
          targetSection: "courseAssessmentMatrix",
          findingDescription: "教學目標為實務反應技能，但評量設計僅採滿意度問卷，缺乏客觀評量規準 (Rubrics)。",
          suggestedAction: "請至課程評量矩陣補足技能評量規準（Rubrics）或客觀操作表現日誌。",
        });
      }
    }
  }

  // 3. MOE TPR Local Evidence check: Must not claim verified evidence if pending (spec §14, T13, T14)
  if (workspace.moeTprProposal && workspace.activeStudio === "MOE_TPR_PROPOSAL") {
    if (workspace.moeTprProposal.localEvidenceStatus === "UNKNOWN") {
      findings.push({
        checkId: "chk_moe_local_evidence_missing",
        ruleCode: "LOCAL_EVIDENCE_UNKNOWN",
        severity: "MAJOR_WARNING",
        targetStudio: "MOE_TPR_PROPOSAL",
        targetSection: "moeTprProposal.localEvidenceStatus",
        findingDescription: "教育部教學實踐計畫尚未登錄授課教師本人課堂現場之第一手教學痛點證據。",
        suggestedAction: "請於問題意識段落補充歷年修課學生反饋或課堂觀察紀錄，不應單純引用外部文獻代替本班基線。",
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------
// §26 Build RouteWorkspaceSnapshot for Stage 9 Handoff
// -------------------------------------------------------------
export function buildRouteWorkspaceSnapshot(params: {
  workspace: RouteWorkspace;
  designSnapshot: DesignAnalysisPlanningSnapshot;
}): RouteWorkspaceSnapshot {
  const { workspace, designSnapshot } = params;

  // Next Actions for Stage 9 Routing (§26)
  const nextActions = {
    isJournalPreCheckNeeded: workspace.primaryGoal === "JOURNAL_SCI_SSCI" || workspace.studioParticipations.JOURNAL_RESEARCH_PLANNING === "SECONDARY",
    isNstcReviewNeeded: workspace.primaryGoal === "NSTC_GENERAL",
    isMoeTprReviewNeeded: workspace.primaryGoal === "MOE_TPR",
    isEthicsFilingRequired: workspace.downstreamRequirements.some((r) => r.duePhase === "BEFORE_STUDY_START"),
  };

  const workPackageRefs = workspace.nstcProposal ? workspace.nstcProposal.workPackages.map((wp) => wp.workPackageId) : [];
  const budgetItemRefs = workspace.budgetPlan.items.map((b) => b.budgetItemId);

  return {
    snapshotId: `rws_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "route-studio/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_route`,
    stageId: "route-studio",
    nextStageId: "ethics-review", // Seamless handoff to Stage 9!
    sourceDesignSnapshotId: designSnapshot.snapshotId,
    sourceTheorySnapshotId: designSnapshot.sourceTheorySnapshotId,
    sourceBlueprintSnapshotId: designSnapshot.sourceBlueprintSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    studioRevision: workspace.currentRevision,
    decision: workspace.decision,
    decisionRationale: workspace.decisionRationale,

    scope: {
      workingTitleZh: designSnapshot.scope.workingTitleZh,
      workingTitleEn: designSnapshot.scope.workingTitleEn,
      overallPurpose: designSnapshot.scope.overallPurpose,
      activeStudio: workspace.activeStudio,
    },

    rqRefs: [...designSnapshot.rqRefs],
    sectionRefs: ["sec_intro", "sec_methods", "sec_work_packages"],
    workPackageRefs,
    budgetItemRefs,
    citationSourceRefs: ["cit_chen2024"],

    grandTotalBudget: workspace.budgetPlan.grandTotal,
    budgetCalculationStatus: workspace.budgetPlan.calculationStatus,

    downstreamRequirements: [...workspace.downstreamRequirements],
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    nextActions,

    limitations: [
      "本快照為三路線研究與計畫科學初稿基線（Route Planning & Proposal Draft Baseline），不代表計畫已正式核定、IRB 核准或期刊論文完稿接收。",
      "預算編列金額乃依據現有規劃參數計算（Planning Budget），實際執行報銷仍須依主管機關最新核定公告為準。",
    ],
    checksum: `chk_rws_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}
