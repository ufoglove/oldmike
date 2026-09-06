/**
 * Blueprint Builder Service (V3-U04-FULL)
 * Spec: v3.4.0 §3, §4, §5, §6, §7, §8, §9, §11, §12, §18, §20
 *
 * Implements:
 * 1. Intake from SubmissionNavigationSnapshot with zero re-entry
 * 2. Tri-goal blueprint initialization (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. Objective - RQ - Evidence planning matrix generation
 * 4. Work packages, relative timelines & resource assumptions
 * 5. EvidenceNeed generation connecting to existing literature center
 * 6. Rule snapshots & downstream requirements preservation
 * 7. Logic checking (no cyclic DAG, no TAM-only for skills, no forced 3-year NSTC)
 * 8. BlueprintPlanningSnapshot builder for Stage 5 handoff
 */

import {
  type BlueprintWorkspace,
  type BlueprintPlanningSnapshot,
  type FieldEnvelope,
  type RqPlanningRow,
  type ResearchObjectiveItem,
  type WorkPackagePlan,
  type MilestonePlan,
  type ResourceAssumption,
  type EvidenceNeed,
  type DownstreamRequirementItem,
  type BlueprintLogicFinding,
  type JournalSpecificBlueprint,
  type NstcSpecificBlueprint,
  type MoeTprSpecificBlueprint,
} from "./blueprint-planning-contract.ts";
import {
  type SubmissionNavigationSnapshot,
  type JournalCandidate,
  type NstcRouteCandidate,
  type MoeTprRouteCandidate,
  type OfficialRuleSnapshot,
} from "./submission-navigation-engines-contract.ts";
import { type SubmissionFingerprintVersion } from "./submission-fingerprint-contract.ts";
import { type PrimaryGoalId } from "./research-goal-registry.ts";

function createField<T>(
  fieldRef: string,
  value: T,
  origin: FieldEnvelope<T>["origin"] = "SOURCE_SNAPSHOT",
  temporalStatus: FieldEnvelope<T>["temporalStatus"] = "PROPOSED_BEFORE_STUDY"
): FieldEnvelope<T> {
  const valueType = Array.isArray(value)
    ? "array"
    : typeof value === "object" && value !== null
      ? "object"
      : (typeof value as any);
  return {
    fieldRef,
    value,
    valueType,
    origin,
    sourceRefs: [],
    temporalStatus,
    assumptions: [],
    fieldRevision: 1,
    isLocked: false,
    reviewState: "DRAFT",
    lastModifiedAt: new Date().toISOString(),
  };
}

export function buildBlueprintWorkspaceFromNavigation(params: {
  workspaceId: string;
  projectId: string;
  navigationSnapshot: SubmissionNavigationSnapshot;
  fingerprint?: SubmissionFingerprintVersion;
  userId?: string;
}): BlueprintWorkspace {
  const { workspaceId, projectId, navigationSnapshot } = params;
  const fp = params.fingerprint || navigationSnapshot.fingerprint;
  if (!fp) {
    throw new Error("FINGERPRINT_MISSING: SubmissionNavigationSnapshot requires associated fingerprint for blueprint intake.");
  }

  // Resolve primary goal from navigation snapshot funding & publication intents
  const primaryGoal: PrimaryGoalId =
    navigationSnapshot.fundingIntent === "MOE_TPR"
      ? "MOE_TPR"
      : navigationSnapshot.fundingIntent === "NSTC_GENERAL"
        ? "NSTC_GENERAL"
        : "JOURNAL_SCI_SSCI";

  // Base Objectives (at least 2 distinct objectives derived from RQ & Gap)
  const obj1: ResearchObjectiveItem = {
    objectiveId: "OBJ-01",
    statement: `針對「${fp.titleZh || "研究主題"}」之現存缺口（${fp.gapStatement || "尚未充分驗證之機制"}），建立核心分析與實施架構。`,
    correspondsToGap: fp.gapStatement || "待補強研究線索",
    expectedDeliverables: ["核心架構與概念對照表", "實證或評估資料收集方案"],
    associatedRqIds: ["RQ-01"],
    isLocked: false,
  };

  const obj2: ResearchObjectiveItem = {
    objectiveId: "OBJ-02",
    statement: `檢驗主要介入或方法在目標場域下的成效與關鍵指標表現。`,
    correspondsToGap: "實證成效與回饋機制缺乏系統性檢證",
    expectedDeliverables: ["成效評估矩陣", "反思與限制分析報告"],
    associatedRqIds: ["RQ-02"],
    isLocked: false,
  };

  // Base Research Questions Matrix
  const rq1: RqPlanningRow = {
    rqId: "RQ-01",
    objectiveId: "OBJ-01",
    questionText: fp.researchQuestion || "核心研究問題待深化",
    rqType: "DESCRIPTIVE",
    unitOfAnalysis: primaryGoal === "MOE_TPR" ? "修課學生個體與班級" : "目標場域作業人員/研究個案",
    targetSubjectOrConstruct: "核心行為與系統互動構念",
    requiredEvidenceDirection: "基線現況、需求指標與現有文獻基準",
    preliminaryMethodDirection: fp.methodologyOverview || "前置觀察與文獻分析",
    associatedWorkPackageIds: ["WP-01"],
    expectedContributionDirection: "釐清關鍵情境與架構定義",
    temporalStatus: "PROPOSED_BEFORE_STUDY",
    status: "DRAFT",
    isLocked: false,
    assumptions: ["目標對象具備基礎操作能力"],
    pendingItems: [],
  };

  const rq2: RqPlanningRow = {
    rqId: "RQ-02",
    objectiveId: "OBJ-02",
    questionText: `在此架構下，介入措施對於目標指標（成效、學習或安全表現）產生何種具體影響？`,
    rqType: primaryGoal === "MOE_TPR" ? "DESIGN_EVALUATION" : "RELATIONAL",
    unitOfAnalysis: primaryGoal === "MOE_TPR" ? "學生學習歷程與成果表現" : "介入組與對照表現",
    targetSubjectOrConstruct: "介入成效與關鍵構念變化",
    requiredEvidenceDirection: "前後測數據、質性回饋或系統操作記錄",
    preliminaryMethodDirection: "準實驗設計或歷程評量",
    associatedWorkPackageIds: ["WP-02", "WP-03"],
    expectedContributionDirection: "驗證介入之有效性與邊界條件",
    temporalStatus: "PROPOSED_BEFORE_STUDY",
    status: "DRAFT",
    isLocked: false,
    assumptions: ["介入期間情境維持穩定"],
    pendingItems: ["需在研究設計階段確認具體評量工具"],
  };

  // Base Work Packages & DAG
  const wp1: WorkPackagePlan = {
    packageId: "WP-01",
    title: "文獻深化、架構設計與研究工具準備",
    objectiveRefs: ["OBJ-01"],
    rqRefs: ["RQ-01"],
    tasks: ["系統性梳理關鍵文獻", "確認研究構念與評量維度", "完成初步工具設計"],
    deliverables: ["文獻檢索與對照矩陣", "研究設計規格書初稿"],
    acceptanceCriteria: "完成至少 15 篇相關核心文獻比對並確立量測指標",
    dependencies: [],
    responsibleRole: "主持人 / 主要研究者",
    requiredResources: ["學術資料庫", "文獻管理工具"],
    estimatedRelativeDuration: "M1-M2",
    risks: ["文獻收斂耗時超出預期"],
    routeScope: "SHARED_CORE",
    status: "PLANNED",
  };

  const wp2: WorkPackagePlan = {
    packageId: "WP-02",
    title: "場域實施、介入執行與歷程資料收集",
    objectiveRefs: ["OBJ-02"],
    rqRefs: ["RQ-02"],
    tasks: ["場域/課堂導入介入方案", "收集歷程與互動資料", "實施階段性評量"],
    deliverables: ["原始歷程數據集", "實施紀錄日誌"],
    acceptanceCriteria: "達成規劃收案/修課人數之完整歷程追蹤",
    dependencies: ["WP-01"],
    responsibleRole: "研究執行團隊 / 授課教師",
    requiredResources: ["教學/實施場域", "系統設備"],
    estimatedRelativeDuration: "M3-M5",
    risks: ["學員/受試者流失或出席不穩定"],
    routeScope: "SHARED_CORE",
    status: "PLANNED",
  };

  const wp3: WorkPackagePlan = {
    packageId: "WP-03",
    title: "資料分析、成效檢證與成果報告撰寫",
    objectiveRefs: ["OBJ-02"],
    rqRefs: ["RQ-02"],
    tasks: ["數據清理與統計/質性編碼", "撰寫研究成果報告", "擬定後續精進方案"],
    deliverables: ["成效分析完整報告", "成果發表或申請稿件初稿"],
    acceptanceCriteria: "完成所有 RQ 之證據回答並揭示限制",
    dependencies: ["WP-02"],
    responsibleRole: "全體研究團隊",
    requiredResources: ["分析軟體", "運算資源"],
    estimatedRelativeDuration: "M5-M6",
    risks: ["部分指標效果量未達預期，需補做替代分析"],
    routeScope: "SHARED_CORE",
    status: "PLANNED",
  };

  // Base Milestones
  const milestones: MilestonePlan[] = [
    {
      milestoneId: "MS-01",
      title: "研究架構與工具定稿",
      relativePeriod: "M2 結尾",
      associatedWorkPackageIds: ["WP-01"],
      verificationEvidence: "工具規格審查紀錄與文獻矩陣",
    },
    {
      milestoneId: "MS-02",
      title: "場域介入實施完畢",
      relativePeriod: "M5 結尾",
      associatedWorkPackageIds: ["WP-02"],
      verificationEvidence: "收案與資料收整查核表",
    },
    {
      milestoneId: "MS-03",
      title: "藍圖規劃驗證與結案報告完成",
      relativePeriod: "M6 結尾",
      associatedWorkPackageIds: ["WP-03"],
      verificationEvidence: "完整研究規劃報告書",
    },
  ];

  // Base Resource Assumptions
  const resourceAssumptions: ResourceAssumption[] = [
    {
      resourceId: "RES-01",
      name: "研究場域與受試對象取用",
      category: "FIELD_SITE",
      status: primaryGoal === "MOE_TPR" ? "PROPOSED" : "OWNED",
      availabilityTimeline: "實施介入前（M2 結尾）需完成取得同意",
      contingencyPlan: "若原訂場域調整，切換至備用合作單位/班級",
    },
    {
      resourceId: "RES-02",
      name: "運算與系統設備資源",
      category: "TOOL_EQUIPMENT",
      status: "OWNED",
      availabilityTimeline: "M1 起即可投入",
    },
  ];

  // Targeted EvidenceNeeds (sent to existing literature center)
  const evidenceNeeds: EvidenceNeed[] = [
    {
      needId: "EN-01",
      projectId,
      blueprintRevision: 1,
      sectionId: "gapAndNoveltyClues",
      claimId: "CLM-GAP-01",
      rqId: "RQ-01",
      purpose: "驗證本研究主張之研究缺口於近三年文獻中的討論現況",
      role: "GAP",
      whatMustBeVerified: `確認「${fp.gapStatement || "核心缺口"}」在國際文獻中是否已有高完成度解決方案或相近比較`,
      supportOrCounterevidence: "BOTH_SUPPORT_AND_COUNTER",
      keywordGroups: [
        [fp.titleZh || "主題", "research gap"],
        ["methodology", "evaluation"],
      ],
      suggestedQuery: `${fp.titleZh || ""} ${fp.gapStatement || "gap"}`,
      sourcePreferences: ["CONSENSUS", "SEMANTIC_SCHOLAR", "OPEN_ALEX"],
      retrievalBudgetCap: 10,
      existingEvidenceRefs: fp.literatureIds || [],
      acceptanceCriteria: "找到至少 3 篇具代表性近五年文獻並評估支持或衝突",
      status: "PENDING",
      returnContextId: "sec_gap",
      createdIso: new Date().toISOString(),
    },
  ];

  // Tri-Route Specific Blueprint Customization
  let journalBlueprint: JournalSpecificBlueprint | undefined;
  let nstcBlueprint: NstcSpecificBlueprint | undefined;
  let moeTprBlueprint: MoeTprSpecificBlueprint | undefined;

  // A. Journal
  if (navigationSnapshot.selectedJournalCandidate || primaryGoal === "JOURNAL_SCI_SSCI") {
    const jCand: JournalCandidate | undefined = navigationSnapshot.selectedJournalCandidate;
    journalBlueprint = {
      targetJournalName: jCand?.journalName || "目標 SCI/SSCI 期刊（待指定）",
      targetPublisher: jCand?.publisher || null,
      targetIndexingVerified: jCand?.indexingVerified?.filter((i) => i.verified).map((i) => i.system) || ["SCIE_OR_SSCI"],
      targetArticleType: "ORIGINAL_RESEARCH",
      journalAudienceContext: "國際教育科技、工程或跨領域應用研究社群",
      internationalGapStatement: fp.gapStatement || "國際文獻缺乏針對特定情境之實證比較",
      primaryTheoreticalContribution: fp.expectedContribution || "提供新方法在特定情境下的實證數據與理論對照",
      methodologyOverview: fp.methodologyOverview || "實證研究設計",
      dataAndResultsRequirements: {
        requiredVariablesOrMetrics: ["主要成效指標", "歷程滿意度或操作表現", "混雜變項控制"],
        analysisPlanDirection: "依研究設計進行組間差異檢定或回歸模型分析",
        evidenceNeededPerSection: {
          Introduction: "國際問題重要性與最新文獻缺口",
          Methods: "研究對象、工具信效度與分析步驟",
          Results: "【待研究執行後填寫，事前規劃禁止編造數值】",
          Discussion: "與相近研究之理論意涵對照",
        },
        temporalStatus: "PROPOSED_BEFORE_STUDY",
      },
      sampleArticleSuggestions: [
        {
          suggestionText: "近期相近文章多採多重指標評估，建議納入歷程客觀數據作為補充佐證。",
          isOfficialJournalRule: false, // Quality recommendation, NOT a hard rule!
        },
      ],
      apcFundingPlan: {
        currency: jCand?.apcKnown?.currency || "USD",
        amount: jCand?.apcKnown?.amount || null,
        isWaiverAvailable: jCand?.apcKnown?.isWaiverAvailable || false,
        budgetSourceDirection: "計畫經費支應或作者單位補助",
      },
    };
  }

  // B. NSTC General
  if (navigationSnapshot.selectedNstcCandidate || primaryGoal === "NSTC_GENERAL") {
    const nCand: NstcRouteCandidate | undefined = navigationSnapshot.selectedNstcCandidate;
    nstcBlueprint = {
      disciplineCode: nCand?.disciplineCode || "待確認",
      disciplineName: nCand?.disciplineName || "教育學門 / 跨領域學門",
      divisionName: nCand?.divisionName || "人文及社會科學研究發展處",
      scientificQuestionImportance: `本計畫聚焦「${fp.titleZh || "科學問題"}」，探討關鍵機制並具備跨領域實用價值。`,
      noveltyAndInnovation: fp.gapStatement ? `突破以往侷限，針對「${fp.gapStatement}」提出創新架構` : "具原創性研究切入點",
      principalInvestigatorCapabilityEvidence: {
        source: "AUTHORIZED_PROFILE",
        qualificationStatement: "主持人過去具備相關領域研究與執行能力（依 Profile 帶入）",
      },
      projectDuration: {
        durationOption: "ONE_YEAR", // Never force 3 years!
        multiYearContinuationRationale: "如擬規劃多年期，需有連續性問題與遞進里程碑",
        isFixedThreeYearAssumption: false,
      },
      workPackagesAndMilestones: [wp1, wp2, wp3],
      resourceAndBudgetDirection: {
        personnelDirection: ["兼任研究助理 1-2 名（協助收案與數據整理）"],
        equipmentDirection: ["視實驗需求編列耗材或感測裝置租借"],
        travelOrFieldDirection: ["國內場域差旅與調查訪視費"],
        unknownItems: ["管理費依學校法規核實計算"],
      },
    };
  }

  // C. MOE TPR
  if (navigationSnapshot.selectedMoeTprCandidate || primaryGoal === "MOE_TPR") {
    const mCand: MoeTprRouteCandidate | undefined = navigationSnapshot.selectedMoeTprCandidate;
    const hasCourseData = Boolean(fp.courseProfileRefs?.courseName);
    moeTprBlueprint = {
      courseIdentity: {
        courseName: fp.courseProfileRefs?.courseName || "目標專業或實作課程（待確認課程資料）",
        courseSemesterOrYear: "115 學年度",
        targetStudents: "修課學生群體（待確認）",
        creditsAndType: fp.courseProfileRefs?.academicCredits ? `${fp.courseProfileRefs.academicCredits} 學分` : "待確認",
        courseInfoStatus: hasCourseData ? "USER_PROVIDED" : "UNKNOWN",
        instructorEligibilityStatus: mCand?.eligibilityStatus === "PASS" ? "PASS" : "UNKNOWN", // Keep UNKNOWN if unverified!
      },
      pedagogicalProblemAndContext: {
        observedLearningDifficulties: "學生在複雜概念或實務操作上面臨整合障礙，傳統講述教學成效有限。",
        baselineEvidenceSource: "PENDING_BASELINE_TASK", // No fake failing grades!
        probableRootCauseHypothesis: "缺乏即時回饋機制與主動實作鷹架，致使認知負荷過高。",
      },
      instructionalIntervention: {
        interventionDescription: "導入互動式引導與分階段實作任務，強化反思與實作表現。",
        theoreticalMechanism: "鷹架理論與自主學習反饋機制",
        implementationTimeline: "學期第 4 週至第 14 週",
      },
      learningOutcomesAndAssessment: {
        alignedLearningOutcomes: ["能熟練應用核心概念於情境解題", "提升專業技能實作評量表現"],
        assessmentMethods: ["實作成品規準評分（Rubric）", "單元學習表現檢核", "學習歷程檔案"],
        isSatisfactionOnlySurvey: false, // Strict: cannot claim mastery via satisfaction!
        evaluationDataNeeds: ["學期初基準檢測", "實作成績評定紀錄", "質性學習反思日誌"],
      },
      ethicsAndConsentDirection: {
        studentConsentPlan: "於開學第一週說明研究目的，採知情同意書並確保不影響評分成績",
        institutionalReviewDirection: "教學研究免審或簡易審查送件規劃",
        duePhase: "BEFORE_STUDY_START",
      },
    };
  }

  // Downstream Requirements (with due phases, preserving non-blocking nature)
  const downstreamRequirements: DownstreamRequirementItem[] = [
    {
      requirementId: "REQ-DS-01",
      title: "倫理審查（IRB / REC）送審與知情同意書定稿",
      duePhase: "BEFORE_STUDY_START",
      blocksActions: ["EXECUTE_STUDY"],
      status: "PENDING",
      allowedDeferralReason: "研究藍圖規劃期無需先行取得 IRB 審查編號",
    },
    {
      requirementId: "REQ-DS-02",
      title: "精確文獻深化與 Gap 正式驗證",
      duePhase: "GAP_VALIDATION", // Handed off to Stage 5!
      blocksActions: ["COMPLETE_BLUEPRINT"],
      status: "DEFERRED",
      allowedDeferralReason: "由新版第五階段承接 EvidenceNeed 進行深度檢索",
    },
    {
      requirementId: "REQ-DS-03",
      title: "量表信效度檢驗或正式樣本數 Power 計算",
      duePhase: "RESEARCH_DESIGN",
      blocksActions: ["EXECUTE_STUDY"],
      status: "PENDING",
      allowedDeferralReason: "屬於後續研究設計階段之專業統計工作",
    },
  ];

  return {
    blueprintId: `bp_${projectId}_v1`,
    workspaceId,
    projectId,
    currentRevision: 1,
    sourceNavigationSnapshotId: navigationSnapshot.snapshotId,
    sourceTopicSelectionSnapshotId: navigationSnapshot.sourceTopicSnapshotId || "",
    primaryGoal,
    fundingIntent: navigationSnapshot.fundingIntent,
    publicationIntent: navigationSnapshot.publicationIntent,
    planningStatus: "DRAFT",
    temporalStatus: "PROPOSED_BEFORE_STUDY",

    researchIdentity: {
      workingTitleZh: createField("researchIdentity.workingTitleZh", fp.titleZh || "研究主題工作標題"),
      workingTitleEn: createField("researchIdentity.workingTitleEn", fp.titleEn || "Working Title in English"),
      sourceTopicTitle: fp.titleZh || "",
      targetAudienceOrDiscipline: createField("researchIdentity.targetAudienceOrDiscipline", primaryGoal),
      currentResearchStage: "CONCEPT_PLANNING",
    },

    coreProblemAndScope: {
      problemStatement: createField("coreProblemAndScope.problemStatement", fp.conceptAbstract || "核心問題待描述"),
      targetSystemOrPopulation: createField("coreProblemAndScope.targetSystemOrPopulation", "目標場域對象群體"),
      contextAndImportance: createField("coreProblemAndScope.contextAndImportance", "本研究情境之重要性與急迫性"),
      inScopeAndOutScope: createField("coreProblemAndScope.inScopeAndOutScope", "納入核心機制探討；非適用範圍予以界定"),
    },

    gapAndNoveltyClues: {
      preliminaryGapStatement: createField("gapAndNoveltyClues.preliminaryGapStatement", fp.gapStatement || "初步文獻缺口線索"),
      similarStudiesContrast: createField("gapAndNoveltyClues.similarStudiesContrast", "與目前已知代表性研究之主要差異"),
      hypothesizedValueAdd: createField("gapAndNoveltyClues.hypothesizedValueAdd", fp.expectedContribution || "預期新增價值"),
      evidenceStatus: "UNVERIFIED",
    },

    purposeAndObjectives: {
      overallPurpose: createField("purposeAndObjectives.overallPurpose", `本研究之總體目的在於針對「${fp.titleZh || "核心主題"}」，發展整合性方案並評估其成效與機制。`),
      objectives: [obj1, obj2],
    },

    researchQuestionsMatrix: [rq1, rq2],

    preliminaryTheoryAndLogic: {
      candidateTheories: createField("preliminaryTheoryAndLogic.candidateTheories", ["情境學習理論", "科技接受與互動反饋模型"]),
      whyItMightWork: createField("preliminaryTheoryAndLogic.whyItMightWork", "透過即時反饋與分層引導，降低認知負擔並強化主動參與機制。"),
      coreConstructs: createField("preliminaryTheoryAndLogic.coreConstructs", ["介入支持度", "歷程參與感", "學習/操作表現"]),
      alternativeExplanations: createField("preliminaryTheoryAndLogic.alternativeExplanations", ["霍桑效應（新奇感影響）", "先前經驗差異"]),
      theoreticalBoundaryConditions: createField("preliminaryTheoryAndLogic.theoreticalBoundaryConditions", "主要適用於結構化任務情境，高度非結構化任務需另行調適。"),
    },

    methodAndDataDirection: {
      preliminaryMethodology: createField("methodAndDataDirection.preliminaryMethodology", fp.methodologyOverview || "混合研究法（準實驗搭配歷程日誌分析）"),
      observationOrComparisonUnit: createField("methodAndDataDirection.observationOrComparisonUnit", "個別學習者/受試者在任務中的前後表現"),
      dataSourceTypes: createField("methodAndDataDirection.dataSourceTypes", ["測驗表現", "系統歷程數據", "半結構化訪談"]),
      requiredEvidenceTypes: createField("methodAndDataDirection.requiredEvidenceTypes", ["定量成效指標", "質性經驗回饋"]),
      feasibilityNotes: createField("methodAndDataDirection.feasibilityNotes", "場域與工具均在預計取得與調用範圍內，可行性良好。"),
    },

    workPackages: [wp1, wp2, wp3],
    milestones,
    resourceAssumptions,
    evidenceNeeds,
    evidenceLinks: [],

    journalBlueprint,
    nstcBlueprint,
    moeTprBlueprint,

    risksAndAssumptions: [
      {
        riskId: "RSK-01",
        statement: "場域合作或學員收案進度不如預期",
        isAssumption: false,
        impactsRqOrWp: ["WP-02", "RQ-02"],
        likelihood: "MEDIUM",
        severity: "HIGH",
        mitigationStrategy: "提早於 M1 與場域主管定案，並準備第二備用場域",
      },
    ],

    // Upstream handoff preservation (spec §3)
    handoffLimitations: [...(navigationSnapshot.handoffLimitations || [])],
    literatureIds: [...(fp.literatureIds || [])],
    citationSourceIds: [...(fp.citationSourceIds || [])],
    ruleSnapshotRefs: (navigationSnapshot.ruleSnapshots || []).map((r) => r.snapshotId),

    downstreamRequirements,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §18 Logic Checker Implementation
// -------------------------------------------------------------
export function runBlueprintLogicCheck(workspace: BlueprintWorkspace): BlueprintLogicFinding[] {
  const findings: BlueprintLogicFinding[] = [];

  // 1. Objective - RQ alignment check
  const objIds = new Set(workspace.purposeAndObjectives.objectives.map((o) => o.objectiveId));
  for (const rq of workspace.researchQuestionsMatrix) {
    if (!objIds.has(rq.objectiveId)) {
      findings.push({
        checkId: `chk_rq_obj_${rq.rqId}`,
        ruleCode: "RQ_OBJECTIVE_MISALIGNMENT",
        severity: "MAJOR_WARNING",
        targetSection: "researchQuestionsMatrix",
        targetFieldRef: rq.rqId,
        findingDescription: `研究問題 ${rq.rqId} 關聯的 Objective ID (${rq.objectiveId}) 未在正式 Objectives 清單中找到。`,
        rationale: "每個研究問題必須能追溯至至少一項核心研究目標。",
        suggestedAction: "請將該 RQ 映射至現有的 OBJ-01 或 OBJ-02，或新增對應 Objective。",
        autoFixAvailable: true,
      });
    }
  }

  // 2. Work Package DAG cycle detection
  const wpMap = new Map<string, WorkPackagePlan>();
  workspace.workPackages.forEach((wp) => wpMap.set(wp.packageId, wp));
  
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(wpId: string): boolean {
    visited.add(wpId);
    recStack.add(wpId);

    const wp = wpMap.get(wpId);
    if (wp) {
      for (const dep of wp.dependencies) {
        if (!visited.has(dep) && hasCycle(dep)) return true;
        if (recStack.has(dep)) return true;
      }
    }
    recStack.delete(wpId);
    return false;
  }

  for (const wp of workspace.workPackages) {
    if (!visited.has(wp.packageId)) {
      if (hasCycle(wp.packageId)) {
        findings.push({
          checkId: `chk_dag_cycle_${wp.packageId}`,
          ruleCode: "WORK_PACKAGE_DAG_CYCLE",
          severity: "FATAL",
          targetSection: "workPackages",
          targetFieldRef: wp.packageId,
          findingDescription: `工作包依賴關係中檢測到循環依賴（涉及 ${wp.packageId}）。`,
          rationale: "工作排程必須為有向無環圖（DAG），前置依賴不可回溯至自身。",
          suggestedAction: "請檢查工作包的前置 dependencies 設置，移除造成循環的依賴項。",
          autoFixAvailable: false,
        });
        break;
      }
    }
  }

  // 3. Teaching Practice (MOE_TPR) Skill vs Satisfaction check
  if (workspace.primaryGoal === "MOE_TPR" && workspace.moeTprBlueprint) {
    const moe = workspace.moeTprBlueprint;
    const isSkillProblem = moe.pedagogicalProblemAndContext.observedLearningDifficulties.includes("操作") ||
      moe.pedagogicalProblemAndContext.observedLearningDifficulties.includes("技能") ||
      moe.pedagogicalProblemAndContext.observedLearningDifficulties.includes("困難");
    
    const onlySatisfactionAssessment = moe.learningOutcomesAndAssessment.assessmentMethods.length === 1 &&
      moe.learningOutcomesAndAssessment.assessmentMethods[0].includes("滿意度");

    if (isSkillProblem && onlySatisfactionAssessment) {
      findings.push({
        checkId: "chk_moe_satisfaction_only",
        ruleCode: "PEDAGOGICAL_ASSESSMENT_MISALIGNMENT",
        severity: "MAJOR_WARNING",
        targetSection: "moeTprBlueprint",
        targetFieldRef: "learningOutcomesAndAssessment.assessmentMethods",
        findingDescription: "教學問題聚焦於技能與學習困難，但評量方式僅包含滿意度調查。",
        rationale: "教育部教學實踐研究計畫強調成效檢證需對應學習成效，滿意度不能代替專業技能的學習成效證據。",
        suggestedAction: "建議增列規準評分（Rubric）、前後測實作表現檢核或學習歷程成果。",
        autoFixAvailable: true,
      });
    }
  }

  // 4. NSTC General multi-year justification check
  if (workspace.primaryGoal === "NSTC_GENERAL" && workspace.nstcBlueprint) {
    const nstc = workspace.nstcBlueprint;
    if (nstc.projectDuration.durationOption === "THREE_YEAR" && !nstc.projectDuration.multiYearContinuationRationale) {
      findings.push({
        checkId: "chk_nstc_multi_year_rationale",
        ruleCode: "NSTC_MULTI_YEAR_RATIONALE_MISSING",
        severity: "MAJOR_WARNING",
        targetSection: "nstcBlueprint",
        targetFieldRef: "projectDuration.multiYearContinuationRationale",
        findingDescription: "計畫設定為三年期，但未提供多年期連續性問題與遞進里程碑之說明。",
        rationale: "國科會多年期計畫需具備清晰之分年遞進研究目標，不可僅將一年工作量放大填滿三年。",
        suggestedAction: "請填寫多年期研究問題的延續性說明，或改為一年期計畫進行規劃。",
        autoFixAvailable: true,
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------
// §20 Build BlueprintPlanningSnapshot for Stage 5 handoff
// -------------------------------------------------------------
export function buildBlueprintPlanningSnapshot(params: {
  workspace: BlueprintWorkspace;
  readinessSnapshotRef: string;
  decisionOrigin?: "USER_MANUAL_ADOPTION" | "AUTO_PLANNING_BASELINE";
}): BlueprintPlanningSnapshot {
  const { workspace, readinessSnapshotRef, decisionOrigin = "USER_MANUAL_ADOPTION" } = params;

  return {
    snapshotId: `bps_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "blueprint-planning/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_bp`,
    stageId: "blueprint",
    nextStageId: "gap-novelty",
    sourceNavigationSnapshotId: workspace.sourceNavigationSnapshotId,
    sourceTopicSelectionSnapshotId: workspace.sourceTopicSelectionSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    blueprintId: workspace.blueprintId,
    blueprintRevision: workspace.currentRevision,
    planningBaselineRef: workspace.planningBaselineRef || `base_${workspace.blueprintId}_rev${workspace.currentRevision}`,
    planningStatus: workspace.planningStatus === "BASELINED" ? "BASELINED" : "BASELINED_PROVISIONAL",
    researchStage: "CONCEPT_PLANNING",
    temporalStatus: workspace.temporalStatus,

    scope: {
      workingTitleZh: workspace.researchIdentity.workingTitleZh.value,
      workingTitleEn: workspace.researchIdentity.workingTitleEn.value,
      problemSummary: workspace.coreProblemAndScope.problemStatement.value,
      overallPurpose: workspace.purposeAndObjectives.overallPurpose.value,
    },
    objectiveRefs: workspace.purposeAndObjectives.objectives.map((o) => o.objectiveId),
    rqRefs: workspace.researchQuestionsMatrix.map((r) => r.rqId),
    methodAndDataPlanRefs: [workspace.methodAndDataDirection.preliminaryMethodology.fieldRef],
    workPackageRefs: workspace.workPackages.map((w) => w.packageId),
    milestoneRefs: workspace.milestones.map((m) => m.milestoneId),
    resourceAssumptionsCount: workspace.resourceAssumptions.length,

    literatureIds: [...workspace.literatureIds],
    evidenceIds: [],
    citationSourceIds: [...workspace.citationSourceIds],
    zoteroBindings: [],
    evidenceNeedRefs: workspace.evidenceNeeds.map((e) => e.needId),
    searchTaskRefs: [],

    handoffLimitations: [...workspace.handoffLimitations],

    ruleSnapshotRefs: [...workspace.ruleSnapshotRefs],
    downstreamRequirements: workspace.downstreamRequirements,
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    lockManifest: [],
    sourceManifest: [{ sourceId: workspace.sourceNavigationSnapshotId, sourceVersion: 1 }],
    reviewState: "DRAFT",
    decisionOrigin,
    readinessSnapshotRef,
    completionBasis: workspace.planningStatus === "BASELINED" ? "PLANNING_BASELINE_COMMITTED" : "PROVISIONAL_PLANNING_BASELINE",
    limitations: [
      "本快照為研究藍圖規劃基線（Planning Baseline），不代表研究正式執行、IRB 審查核准或期刊完稿接受。",
      "文獻缺口由 Stage 5 文獻與證據中心承接 EvidenceNeed 進行深度實證驗證。",
    ],
    createdAt: new Date().toISOString(),
    checksum: `chk_${Date.now().toString(36)}`,
  };
}
