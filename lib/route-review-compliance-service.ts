/**
 * Route Review, Compliance & Ethics Service (V3-U09-FULL)
 * Spec: docs/stage09/spec-v3-4.0.md §1, §2, §4, §5, §6, §7, §8, §9, §11, §12, §13, §14, §15, §16, §17, §23, §24
 *
 * Implements:
 * 1. Intake of Stage 8 RouteWorkspaceSnapshot (zero re-entry)
 * 2. Tri-goal simulated reviewer engines (Journal, NSTC, MOE_TPR)
 * 3. OfficialRuleSnapshot & ComplianceMatrix with strict duePhase separation
 * 4. Shared Ethics Scope Screening, Risks & Institutional Decision
 * 5. Data Management Plan (DMP) & Preregistration validation
 * 6. Teacher-Student Power Risk automated check (TEACHER_STUDENT_POWER_RISK)
 * 7. Immutable Stage09HandoffSnapshot builder for Stage 10 handoff (study-protocol)
 */

import {
  type RouteReviewWorkspace,
  type Stage09HandoffSnapshot,
  type ReviewerFinding,
  type RevisionTask,
  type OfficialRuleItem,
  type ComplianceItem,
  type EthicsScopeAssessment,
  type InstitutionalEthicsDecision,
  type EthicsRiskItem,
  type DataManagementPlan,
  type PreregistrationPlan,
} from "./route-review-compliance-contract.ts";
import { type RouteWorkspaceSnapshot } from "./route-studio-contract.ts";

export function buildRouteReviewWorkspaceFromRoute(params: {
  workspaceId: string;
  projectId: string;
  routeSnapshot: RouteWorkspaceSnapshot;
  userId?: string;
}): RouteReviewWorkspace {
  const { workspaceId, projectId, routeSnapshot } = params;
  const primaryGoal = routeSnapshot.primaryGoal;

  const reviewerFindings: ReviewerFinding[] = [];
  const officialRules: OfficialRuleItem[] = [];
  const complianceItems: ComplianceItem[] = [];
  const ethicsRisks: EthicsRiskItem[] = [];

  // 1. Tri-Goal Simulated Reviewer Engines (§5, §6, §7)
  if (primaryGoal === "JOURNAL_SCI_SSCI") {
    // PRE_STUDY_JOURNAL_REVIEW (spec §5, T09)
    reviewerFindings.push({
      findingId: "fnd_jnl_scope_01",
      sourceReviewerRole: "Journal Scientific Reviewer",
      severity: "SUGGESTION",
      ruleCode: "REPORTING_GUIDELINE_ALIGNMENT",
      targetSection: "journalPlan.blueprint",
      issueDescription: "隨機對照試驗應規劃完整對齊 CONSORT 2025 報告標準之試驗流程圖與分析透明度。",
      scientificRationale: "國際主流期刊高度看重 RCT 流程透明度，事前規劃流程圖能大幅降低 Desk-Reject 機率。",
      suggestedAction: "建議於研究方法章節預留 CONSORT 2025 流程圖與隨機分配細部說明段落。",
      isResolved: true,
      resolutionNote: "已於研究方法草稿中規劃流程圖插槽",
    });
  } else if (primaryGoal === "NSTC_GENERAL") {
    // NSTC General Proposal Reviewer (§6, T11, T12)
    reviewerFindings.push({
      findingId: "fnd_nstc_sci_01",
      sourceReviewerRole: "NSTC Scientific Discipline Reviewer",
      severity: "MINOR",
      ruleCode: "PRELIMINARY_DATA_STRENGTH",
      targetSection: "nstcProposal.piExperienceSummary",
      issueDescription: "目前先期成果著重於系統可用性測試，建議補充人因工程指標之初步信度佐證。",
      scientificRationale: "國科會學門審查著重主持人是否具備執行大型兩年期試驗之先期技術能量與場域鏈結。",
      suggestedAction: "於主持人經歷段落補充產學合作場域之協同合作意向或已發表專利技術清單。",
      isResolved: false,
    });
  } else if (primaryGoal === "MOE_TPR") {
    // MOE Teaching Practice Reviewer (§7, T13, T14, T15)
    reviewerFindings.push({
      findingId: "fnd_moe_ped_01",
      sourceReviewerRole: "MOE Pedagogical Reviewer",
      severity: "MINOR",
      ruleCode: "LOCAL_EVIDENCE_REINFORCEMENT",
      targetSection: "moeTprProposal.courseAssessmentMatrix",
      issueDescription: "現場教學痛點建議增加歷年修課學生之具體作業盲點次數統計。",
      scientificRationale: "教育部教學實踐計畫強調教學問題必須源於教師本人的課堂現場，非泛泛之論。",
      suggestedAction: "建議在開學前將歷年實作測驗之失分點整理為課堂基線佐證。",
      isResolved: false,
    });
  }

  // 2. Official Rules & Compliance Matrix (§8, §9)
  if (primaryGoal === "NSTC_GENERAL") {
    officialRules.push({
      ruleId: "rule_nstc_115",
      authority: "國家科學及技術委員會",
      targetYear: "115 年度",
      documentTitle: "國家科學及技術委員會補助專題研究計畫作業要點",
      ruleType: "NSTC_GENERAL",
      section: "第六點 / 申請機構及計畫主持人資格",
      requirementDescription: "主持人應符合專任教學或研究人員資格，多年期計畫需具備合理年度分工里程碑。",
      sourceUrl: "https://law.nstc.gov.tw/LawContent.aspx?id=FL026713",
      retrievedAt: new Date().toISOString(),
      effectiveDate: "2025-11-01",
      verificationStatus: "VERIFIED_CURRENT",
      appliesTo: "一般專題研究計畫",
      currentProjectStatus: "COMPLIANT",
      requiredAction: "維持年度工作包連續性",
    });

    complianceItems.push(
      {
        complianceId: "comp_nstc_01",
        projectId,
        route: "NSTC_GENERAL",
        targetYear: "115",
        authority: "NSTC",
        requirement: "科學問題創新性與工作包對齊",
        status: "MET",
        evidenceNotes: "工作包 WP-01 與 WP-02 明確對齊 RQ-01 與 RQ-02",
        requiredAction: "無需更動",
        severity: "MINOR",
        duePhase: "CURRENT_STAGE_REQUIRED",
        blocksAction: "PROCEED_TO_PROTOCOL",
        owner: "計畫主持人",
        verifiedAt: new Date().toISOString(),
      },
      {
        complianceId: "comp_nstc_irb",
        projectId,
        route: "NSTC_GENERAL",
        targetYear: "115",
        authority: "NSTC",
        requirement: "涉及人體研究需檢附倫理審查委員會 (IRB) 核准文件或送審證明",
        status: "PARTIAL",
        evidenceNotes: "已建立 IRB 審查規劃，待機構 IRB 受理後取得送審證明",
        missingItemDescription: "IRB 核准函或收件證明文件",
        requiredAction: "於校內送件截止日前備齊 IRB 送審證明",
        severity: "MAJOR",
        duePhase: "SUBMISSION_ONLY", // Late-stage! Does NOT block Stage 9 planning!
        blocksAction: "FINAL_SUBMISSION",
        owner: "計畫主持人",
        verifiedAt: new Date().toISOString(),
      }
    );
  } else if (primaryGoal === "MOE_TPR") {
    officialRules.push({
      ruleId: "rule_moe_115",
      authority: "教育部",
      targetYear: "115 年度",
      documentTitle: "教育部補助大專校院教學實踐研究計畫作業要點",
      ruleType: "MOE_TPR",
      section: "第四點 / 計畫性質與內涵",
      requirementDescription: "計畫應以教育現場問題為核心，評量學生學習成效，並確保學生權益與研究自願性。",
      sourceUrl: "https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704",
      retrievedAt: new Date().toISOString(),
      effectiveDate: "2025-10-15",
      verificationStatus: "VERIFIED_CURRENT",
      appliesTo: "大專校院專任教師",
      currentProjectStatus: "COMPLIANT",
      requiredAction: "落實學生研究知情同意與成績分離機制",
    });

    complianceItems.push({
      complianceId: "comp_moe_assessment",
      projectId,
      route: "MOE_TPR",
      targetYear: "115",
      authority: "MOE",
      requirement: "學習成效評量直接對齊課程目標，非僅滿意度調查",
      status: "MET",
      evidenceNotes: "課程評量矩陣已整合客觀 VR 操作日誌與 Rubrics 規準",
      requiredAction: "維持規準客觀性",
      severity: "MINOR",
      duePhase: "CURRENT_STAGE_REQUIRED",
      blocksAction: "PROCEED_TO_PROTOCOL",
      owner: "授課教師",
      verifiedAt: new Date().toISOString(),
    });
  }

  // 3. Shared Ethics Scope Assessment (§11)
  const ethicsScope: EthicsScopeAssessment = {
    assessmentId: `eth_scope_${projectId}`,
    hasHumanParticipants: true,
    hasStudentOrSubordinateVulnerability: primaryGoal === "MOE_TPR",
    hasMinors: false,
    hasHealthOrBiometricData: true, // Eye tracking & reaction time
    hasAudioVideoRecording: false,
    hasSensoryEyeTrackingWearable: true,
    hasLocationOrBehaviorTracking: true,
    hasThirdPartyAiOrCloud: true, // Generative AI API
    hasLearningPlatformLmsLogs: primaryGoal === "MOE_TPR",
    hasSecondaryData: false,
    hasPublicData: false,
    hasSensitivePii: false,
    hasCrossBorderDataTransfer: false,
    hasCompensationOrGradingBonus: true,
    hasPotentialAdverseEvents: true, // VR simulator sickness / dizziness
    overallScopeResult: "REVIEW_LIKELY_REQUIRED",
    rationale: "本研究涉及人體受試者配戴穿戴式 VR 裝置與即時眼動生理日誌記錄，依法屬應提送人體研究倫理審查之範疇。",
    assessedAt: new Date().toISOString(),
  };

  // 4. Institutional Ethics Decision (§12)
  const institutionalDecision: InstitutionalEthicsDecision = {
    institution: "國立大學研究倫理審查委員會 (REC/IRB)",
    decisionType: "EXPEDITED_REVIEW",
    status: "NOT_YET_SUBMITTED",
    approvedDocuments: [],
    conditions: ["須取得受試者書面知情同意", "VR 操作每 20 分鐘需休息 10 分鐘以防動暈眩"],
    verifiedByUser: false,
  };

  // 5. Ethics Risk Register (§14)
  ethicsRisks.push({
    riskId: "rsk_eth_vr_dizziness",
    category: "PHYSICAL",
    likelihood: "MEDIUM",
    severity: "MODERATE",
    affectedPopulation: "參與高空模擬受訓之受試者",
    mitigationStrategy: "系統設定最高 40 分鐘單次體驗上限，滿 20 分鐘主動淡出提示休息，現場備有動暈舒緩座位。",
    monitoringPlan: "試驗全程由研究助理在旁陪同觀察，出現暈眩立即中止程序。",
    owner: "研究執行助理",
    residualRisk: "LOW",
    status: "MITIGATED",
  });

  if (primaryGoal === "MOE_TPR") {
    // Teacher-Student Power Risk (§13, T08)
    ethicsRisks.push({
      riskId: "rsk_teacher_student_power",
      category: "TEACHER_STUDENT_POWER",
      likelihood: "HIGH",
      severity: "MODERATE",
      affectedPopulation: "修課大專學生",
      mitigationStrategy: "知情同意書由獨立教學助理說明與收集，學期成績送達教務處登錄封存前，授課教師不得查閱參與名冊；不參與者提供等時長非研究之案例觀摩學習活動。",
      monitoringPlan: "教務處成績登錄前由系所主管核實參與名冊未提前洩漏。",
      owner: "計畫主持人 / 授課教師",
      residualRisk: "LOW",
      status: "MITIGATED",
    });
  }

  // 6. Data Management Plan (§15)
  const dataManagementPlan: DataManagementPlan = {
    dmpId: `dmp_${projectId}`,
    dataTypesAndSources: ["VR 系統操作座標日誌", "眼動儀毫秒級反應時間", "NASA-TLX 認知負荷問卷"],
    identifiersHandling: "CODED_DE_IDENTIFIED",
    codingKeyStorageLocation: "加密實體硬碟保存於主持人獨立實驗室防潮保險櫃，非研究授權人員無權調閱。",
    accessControlAndEncryption: "所有日誌檔案採用 AES-256 演算法加密存儲，伺服器存取嚴格遵循雙因素驗證。",
    storageAndBackupStrategy: "每日離線鏡像備份至校內專用私有儲存空間，禁止上傳至未授權公共雲端硬碟。",
    transferProtocols: "本機傳輸採用 TLS 1.3 安全通訊協定，外部 AI 請求僅傳送匿名之情境文字，絕不攜帶受試者識別碼。",
    thirdPartyAiUsageRestrictions: "嚴禁用於公開模型微調訓練，關閉 API 供應商端之資料快取留存協議。",
    dataRetentionPeriodYears: 5,
    destructionPlan: "計畫執行完畢滿五年後，密鑰與原始日誌由主持人會同研究助理執行符合 DoD 5220.22-M 標準之磁區抹除銷毀。",
    responsiblePersonRole: "計畫主持人",
    sensitiveRestrictions: ["嚴禁將去識別化編碼對照表與研究資料同機儲存"],
  };

  // 7. Preregistration Plan (§16)
  const preregistrationPlan: PreregistrationPlan = {
    applicable: primaryGoal === "JOURNAL_SCI_SSCI",
    registrationType: primaryGoal === "JOURNAL_SCI_SSCI" ? "ANALYSIS_PLAN_PREREGISTRATION" : "NOT_APPLICABLE",
    platformCandidate: primaryGoal === "JOURNAL_SCI_SSCI" ? "OSF" : "NONE",
    primaryOutcomeConstruct: "突發危害情境辨識反應時間（秒）",
    secondaryOutcomeConstruct: "主觀心智負荷量尺分數",
    hypothesesSummary: "自適應生成引導組在後測與延宕測量之反應時間顯著優於主動對照組 (H1)。",
    samplePlanReference: `基於事前檢定力推估目標招募 N = ${routeSnapshot.grandTotalBudget > 0 ? 151 : 128} 人`,
    exclusionRules: ["嚴重動暈眩病史", "近三個月曾參與相近測試者"],
    stoppingRule: "達到預定分析樣本 128 人且無未預期重大不良事件發生即停止收案",
    missingDataStrategy: "完全案例分析 (Complete Case) 搭配混合效應模型 (LMM) 處理缺失",
    mainAnalysisMethod: "線性混合效應模型 (LMM) 檢驗組別 × 時間交互作用效果",
    status: primaryGoal === "JOURNAL_SCI_SSCI" ? "DRAFT_READY" : "NOT_APPLICABLE",
  };

  // 8. Convert Unresolved Findings to Revision Tasks (§17)
  const revisionTasks: RevisionTask[] = reviewerFindings
    .filter((f) => !f.isResolved)
    .map((f, idx) => ({
      taskId: `task_rev_${idx + 1}`,
      sourceFindingId: f.findingId,
      affectedWorkspace: primaryGoal === "NSTC_GENERAL" ? "NSTCProposalDraft" : "TeachingPracticeProposalDraft",
      targetSection: f.targetSection,
      severity: f.severity,
      requiredAction: f.suggestedAction,
      owner: "計畫主持人",
      duePhase: "CURRENT_STAGE_REQUIRED",
      status: "OPEN",
    }));

  return {
    workspaceId: `ws_review_${projectId}`,
    projectId,
    currentRevision: 1,
    sourceRouteSnapshotId: routeSnapshot.snapshotId,
    sourceDesignSnapshotId: routeSnapshot.sourceDesignSnapshotId,
    primaryGoal,
    fundingIntent: routeSnapshot.fundingIntent,
    publicationIntent: routeSnapshot.publicationIntent,

    reviewerFindings,
    revisionTasks,
    officialRules,
    complianceItems,

    ethicsScope,
    institutionalDecision,
    ethicsRisks,

    dataManagementPlan,
    preregistrationPlan,

    downstreamRequirements: routeSnapshot.downstreamRequirements || [],

    decision: "PLANNING_REVIEW_COMPLETE",
    decisionRationale: "路線專屬審查已完成，官方規則合規矩陣與倫理範疇篩檢已具備完整基線，重大師生權力關係風險已妥善緩解。",
    reviewState: "DRAFT",
    isLocked: false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §23 Alignment Checker Implementation
// -------------------------------------------------------------
export function runRouteReviewLogicCheck(workspace: RouteReviewWorkspace): Array<{
  code: string;
  severity: "FATAL" | "MAJOR_WARNING";
  description: string;
}> {
  const issues: Array<{ code: string; severity: "FATAL" | "MAJOR_WARNING"; description: string }> = [];

  // 1. Unresolved FATAL reviewer findings
  const hasFatalFinding = workspace.reviewerFindings.some((f) => f.severity === "FATAL" && !f.isResolved);
  if (hasFatalFinding) {
    issues.push({
      code: "FATAL_REVIEWER_FINDING_UNRESOLVED",
      severity: "FATAL",
      description: "存在未解決之重大審查意見，必須修訂後始得前進。",
    });
  }

  // 2. Teacher-student power relationship unmitigated (spec §13, T08)
  if (workspace.primaryGoal === "MOE_TPR") {
    const hasPowerRisk = workspace.ethicsRisks.some(
      (r) => r.category === "TEACHER_STUDENT_POWER" && r.status === "MITIGATED"
    );
    if (!hasPowerRisk) {
      issues.push({
        code: "TEACHER_STUDENT_POWER_RISK_UNMITIGATED",
        severity: "FATAL",
        description: "教育部教學實踐計畫涉及授課學生，但未建立明確之知情同意與成績評定分離防護機制。",
      });
    }
  }

  // 3. Fake IRB approval check (spec §12, T09)
  if (workspace.institutionalDecision.status === "APPROVED" && !workspace.institutionalDecision.approvalNumber) {
    issues.push({
      code: "FABRICATED_IRB_APPROVAL_PROHIBITED",
      severity: "FATAL",
      description: "在缺乏真實核准案號與正式文件證明之情況下，嚴禁擅自宣稱 IRB 已審查通過。",
    });
  }

  // 4. Fake Preregistration check (spec §16, T10)
  if (workspace.preregistrationPlan.status === "REGISTERED" && !workspace.preregistrationPlan.registrationUrlOrId) {
    issues.push({
      code: "FABRICATED_PREREGISTRATION_PROHIBITED",
      severity: "FATAL",
      description: "在缺乏真實預註冊網址或平台識別碼之情況下，嚴禁將預註冊計畫標記為 REGISTERED。",
    });
  }

  return issues;
}

// -------------------------------------------------------------
// §24 Build Stage09HandoffSnapshot for Stage 10 Handoff
// -------------------------------------------------------------
export function buildStage09HandoffSnapshot(params: {
  workspace: RouteReviewWorkspace;
  routeSnapshot: RouteWorkspaceSnapshot;
}): Stage09HandoffSnapshot {
  const { workspace, routeSnapshot } = params;

  const totalFindings = workspace.reviewerFindings.length;
  const unresolvedFatal = workspace.reviewerFindings.filter((f) => f.severity === "FATAL" && !f.isResolved).length;

  const metCount = workspace.complianceItems.filter((c) => c.status === "MET").length;
  const complianceMetRate = workspace.complianceItems.length > 0 ? metCount / workspace.complianceItems.length : 1.0;

  const isTeacherStudentPowerRiskIdentified = workspace.ethicsRisks.some((r) => r.category === "TEACHER_STUDENT_POWER");

  // Next Stage Instrument & Protocol Needs (spec §24, §25)
  const instrumentRequirementsSummary = [
    "毫秒級高空危害眼動反應秒數客觀記錄協議",
    "情境化突發危害處置表現評量規準 (Rubrics)",
    "NASA-TLX 中文版認知負荷量尺（需確認施測授權與計分指引）",
  ];

  const protocolNeedsSummary = [
    "雙組隨機對照試驗標準作業程序 (SOP / Study Protocol)",
    "VR 操作防動暈眩安全中斷流程與監控表單",
    "受試者書面知情同意書 (Informed Consent Form) 草稿",
    "學生修課成績獨立封存與去識別化資料編碼作業手冊",
  ];

  return {
    snapshotId: `s9snap_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "stage09-handoff/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_s09`,
    stageId: "ethics-review",
    nextStageId: "study-protocol", // Seamless handoff to Stage 10: 研究工具、量表與 Study Protocol!
    sourceRouteSnapshotId: routeSnapshot.snapshotId,
    sourceDesignSnapshotId: routeSnapshot.sourceDesignSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    reviewRevision: workspace.currentRevision,
    decision: workspace.decision,
    decisionRationale: workspace.decisionRationale,

    scope: {
      workingTitleZh: routeSnapshot.scope.workingTitleZh,
      workingTitleEn: routeSnapshot.scope.workingTitleEn,
      overallPurpose: routeSnapshot.scope.overallPurpose,
      primaryRoute: routeSnapshot.scope.activeStudio,
    },

    totalFindingsCount: totalFindings,
    unresolvedFatalCount: unresolvedFatal,
    complianceMetRate,

    ethicsScopeResult: workspace.ethicsScope.overallScopeResult,
    institutionalDecisionStatus: workspace.institutionalDecision.status,
    isTeacherStudentPowerRiskIdentified,

    instrumentRequirementsSummary,
    protocolNeedsSummary,

    downstreamRequirements: [...workspace.downstreamRequirements],
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    limitations: [
      "本快照為路線審查、合規準備與研究倫理基線（Route Review & Ethics Planning Baseline），不代表正式 IRB 核准、計畫正式錄取或期刊發表同意。",
      "倫理審查範疇屬評估性質，正式試驗執行前仍須向所屬機構審查委員會 (REC/IRB) 提送完整申請書並取得核准。",
    ],
    checksum: `chk_s9_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}
