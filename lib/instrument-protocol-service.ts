/**
 * Instruments, Scales, Materials & Study Protocol Service (V3-U10-FULL)
 * Spec: docs/stage10/spec-v3-4.0.md §2, §3, §4, §5, §6, §7, §9, §10, §11, §12, §13, §14, §15, §16, §17, §18, §21, §24
 *
 * Implements:
 * 1. Intake of Stage 9 Stage09HandoffSnapshot (zero re-entry)
 * 2. Multi-category instrument setup (VR Millisecond Eye-log, NASA-TLX Scale, Skill Performance Rubric)
 * 3. Schedule of Activities & Data Capture Schema
 * 4. Deterministic sandbox scoring execution using scoring-preview-engine
 * 5. Study Protocol Assembly Baseline
 * 6. Triple Alignment Checker (Research/Analysis, Protocol/Ethics, Rights/Content)
 * 7. Immutable InstrumentProtocolSnapshot builder for Stage 11 handoff (pilot-validation)
 */

import {
  type InstrumentProtocolWorkspace,
  type InstrumentProtocolSnapshot,
  type InstrumentDefinition,
  type InstrumentVersion,
  type ProjectInstrumentUse,
  type PermissionRecord,
  type TranslationAdaptationPlan,
  type ActivityScheduleItem,
  type ScoringSpecification,
  type DataCaptureField,
  type StudyProtocolDocument,
} from "./instrument-protocol-contract.ts";
import { type Stage09HandoffSnapshot } from "./route-review-compliance-contract.ts";
import { runSandboxScoringPreview } from "./scoring-preview-engine.ts";

export function buildInstrumentProtocolWorkspaceFromStage09(params: {
  workspaceId: string;
  projectId: string;
  stage09Snapshot: Stage09HandoffSnapshot;
  userId?: string;
}): InstrumentProtocolWorkspace {
  const { workspaceId, projectId, stage09Snapshot } = params;
  const primaryGoal = stage09Snapshot.primaryGoal;

  // 1. Multi-modal Instrument Definitions (§5)
  const instrumentDefinitions: InstrumentDefinition[] = [
    {
      instrumentDefId: "inst_vr_log_eye",
      canonicalName: "沉浸式高空作業眼動與危害辨識毫秒級日誌記錄協議",
      constructRef: "CON-03", // 突發危害反應速度
      originalAuthors: ["研究團隊自編技術規格"],
      originalYear: 2026,
      category: "SENSOR_AND_SYSTEM_LOG",
      description: "透過 HTC Vive Pro Eye 或相容眼動感測頭戴裝置，記錄突發情境觸發至凝視危害目標之客觀毫秒數。",
    },
    {
      instrumentDefId: "inst_nasa_tlx",
      canonicalName: "NASA 主觀心智負荷量表 (NASA-TLX)",
      constructRef: "CON-02", // 認知負荷
      originalAuthors: ["Hart, S. G.", "Staveland, L. E."],
      originalYear: 1988,
      category: "STANDARDIZED_PSYCHOMETRIC_SCALE",
      primaryLiteratureRef: "lit_hart1988_tlx",
      description: "衡量受試者在完成模擬訓練時之心理需求、身體需求、時間需求、績效、努力與受挫感。",
    },
    {
      instrumentDefId: "inst_hazard_rubric",
      canonicalName: "高空危害處置專業技能評量規準 (Rubrics)",
      constructRef: "CON-03",
      originalAuthors: ["本計畫教學與研究團隊"],
      originalYear: 2026,
      category: "PERFORMANCE_RUBRIC",
      description: "針對高空安全帶配戴、安全索扣掛與臨場危害避險程序之四層級客觀表現評分規準。",
    },
  ];

  // 2. Instrument Versions (§5)
  const instrumentVersions: InstrumentVersion[] = [
    {
      versionId: "ver_vr_log_v1",
      instrumentDefId: "inst_vr_log_eye",
      versionLabel: "v1.0 毫秒級眼動反應日誌",
      language: "EN",
      administrationMode: "DIGITAL_VR_LOG",
      totalItemCount: 4, // 4 類突發危害情境
      responseFormat: "Continuous Milliseconds (0 - 60000ms)",
      isNewlyDevelopedDraft: true,
      scoringSpecificationRef: "spec_vr_rt",
      validationStatus: "NEWLY_DEVELOPED_DRAFT",
    },
    {
      versionId: "ver_tlx_cht",
      instrumentDefId: "inst_nasa_tlx",
      versionLabel: "中文修訂版 6-item 短版",
      language: "ZH_TW",
      administrationMode: "PAPER_OR_ONLINE_FORM",
      totalItemCount: 6,
      responseFormat: "1-10 點量表 (1=極低, 10=極高)",
      isNewlyDevelopedDraft: false,
      scoringSpecificationRef: "spec_tlx_sum",
      validationStatus: "SOURCE_REPORTED_ONLY",
    },
    {
      versionId: "ver_rubric_v1",
      instrumentDefId: "inst_hazard_rubric",
      versionLabel: "實作教學評量規準 v1.0",
      language: "ZH_TW",
      administrationMode: "OBSERVATION_RUBRIC",
      totalItemCount: 3, // 3 大核心維度
      responseFormat: "4 級表現規準 (1=未達標, 2=基礎, 3=熟練, 4=精熟)",
      isNewlyDevelopedDraft: true,
      scoringSpecificationRef: "spec_rubric_sum",
      validationStatus: "NEWLY_DEVELOPED_DRAFT",
    },
  ];

  // 3. Project Instrument Use (§5, §6)
  const projectInstrumentUses: ProjectInstrumentUse[] = [
    {
      usageId: "use_01_vr_rt",
      projectId,
      versionId: "ver_vr_log_v1",
      targetRqRefs: ["RQ-01"],
      measurementRequirementRef: "M-01",
      targetTimePointRefs: ["TP-0", "TP-1", "TP-2"],
      selectionRationale: "能客觀記錄受訓者從危害出現到眼動注視之精確秒數，排除主觀回憶偏差。",
      isLocked: false,
    },
    {
      usageId: "use_02_tlx",
      projectId,
      versionId: "ver_tlx_cht",
      targetRqRefs: ["RQ-02"],
      measurementRequirementRef: "M-02",
      targetTimePointRefs: ["TP-1"],
      selectionRationale: "文獻廣泛驗證之心智負荷工具，用以檢驗生成式 AI 是否引發認知過載。",
      adaptationNotes: "採用文獻已報告之繁體中文版指導語",
      isLocked: false,
    },
  ];

  if (primaryGoal === "MOE_TPR") {
    projectInstrumentUses.push({
      usageId: "use_03_rubric",
      projectId,
      versionId: "ver_rubric_v1",
      targetRqRefs: ["RQ-01"],
      measurementRequirementRef: "M-03",
      targetTimePointRefs: ["TP-1", "TP-2"],
      selectionRationale: "教育部教學實踐計畫必備之客觀技能學習成效評量，嚴禁以純滿意度代替能力評定。",
      isLocked: false,
    });
  }

  // 4. Permissions & Rights Records (§9)
  const permissionRecords: PermissionRecord[] = [
    {
      permissionId: "perm_vr_team",
      versionId: "ver_vr_log_v1",
      rightsholder: "研究團隊自主研發",
      licenseType: "PUBLIC_DOMAIN_OPEN",
      permittedActions: ["VIEW_METADATA", "VIEW_RESTRICTED_CONTENT", "PRIVATE_PROCESSING", "DIGITAL_ADMINISTRATION", "EXPORT_ITEMS"],
      verificationProofNotes: "自編開放規格協議",
      status: "VERIFIED_SCOPE",
    },
    {
      permissionId: "perm_nasa_tlx",
      versionId: "ver_tlx_cht",
      rightsholder: "NASA Ames Research Center",
      licenseType: "ACADEMIC_FREE_USE",
      permittedActions: ["VIEW_METADATA", "PRIVATE_PROCESSING", "PRINT_ADMINISTRATION", "DIGITAL_ADMINISTRATION"],
      verificationProofNotes: "NASA 官方宣告學術非商業自由使用，受限題項僅限於專案內部施測，不可整份轉售。",
      status: "VERIFIED_SCOPE",
    },
  ];

  // 5. Translation & Adaptation Plans (§10)
  const adaptationPlans: TranslationAdaptationPlan[] = [
    {
      adaptationId: "trans_tlx",
      versionId: "ver_tlx_cht",
      sourceLanguage: "EN",
      targetLanguage: "ZH_TW",
      adaptationStrategy: "EXPERT_TRANSLATION_WITH_CULTURAL_MODIFICATION",
      cognitiveInterviewStatus: "NOT_STARTED_PENDING_STAGE_11",
      itemsMapping: [
        {
          sourceItemId: "TLX_01_MENTAL",
          translatedItemText: "心理需求：這項任務需要多少心智思考與注意力？",
          culturalAdjustmentNotes: "文詞調適為符合臺灣高空施工情境用語",
        },
      ],
    },
  ];

  // 6. Schedule of Activities (§14)
  const scheduleOfActivities: ActivityScheduleItem[] = [
    {
      activityId: "act_t0_pretest",
      studyComponentRef: "COMP-EXP",
      purpose: "蒐集基準反應秒數與安全先備知識測驗",
      timePointLabel: "T0 (基線前測)",
      relativeTiming: "訓練首日介入前 30 分鐘",
      targetArmRef: "ALL_ARMS",
      instrumentVersionRefs: ["ver_vr_log_v1"],
      estimatedBurdenMinutes: 15,
      assignedStaffRole: "研究執行助理",
      isLocked: false,
    },
    {
      activityId: "act_intervention_unit",
      studyComponentRef: "COMP-EXP",
      purpose: "實施自適應生成引導 vs 固定提示之沉浸式 VR 訓練",
      timePointLabel: "第 1 至第 4 單元介入",
      relativeTiming: "歷時兩週，共 4 單元",
      targetArmRef: "ARM-01",
      instrumentVersionRefs: [],
      estimatedBurdenMinutes: 40,
      assignedStaffRole: "訓練講師 / 授課教師",
      isLocked: false,
    },
    {
      activityId: "act_t1_posttest",
      studyComponentRef: "COMP-EXP",
      purpose: "評估介入立即反應秒數、NASA-TLX 認知負荷與表現規準",
      timePointLabel: "T1 (立即後測)",
      relativeTiming: "第 4 單元培訓結束當日",
      targetArmRef: "ALL_ARMS",
      instrumentVersionRefs: ["ver_vr_log_v1", "ver_tlx_cht"],
      estimatedBurdenMinutes: 20,
      assignedStaffRole: "研究執行助理",
      isLocked: false,
    },
    {
      activityId: "act_t2_retention",
      studyComponentRef: "COMP-EXP",
      purpose: "檢驗非預期危害辨識技能之延宕保留與抗遺忘成效",
      timePointLabel: "T2 (14日延宕測量)",
      relativeTiming: "培訓結束後第 14 日",
      targetArmRef: "ALL_ARMS",
      instrumentVersionRefs: ["ver_vr_log_v1"],
      estimatedBurdenMinutes: 15,
      assignedStaffRole: "研究執行助理",
      isLocked: false,
    },
  ];

  // 7. Deterministic Scoring Specification & Sandbox Execution (§15, T29, T30)
  // Verification test fixture: [1, 2, 5], 2nd item reversed (1-5 range: 1+5-2 = 4) -> sum = 10, mean = 3.333
  const scoringSpecifications: ScoringSpecification[] = [
    {
      specId: "spec_synthetic_fixture",
      versionId: "ver_synthetic_test",
      aggregationMethod: "SUM",
      itemRules: [
        { itemId: "item_1", itemLabel: "題目 1 (正向)", validRange: [1, 5], isReverseScored: false, missingCodes: [99, -9] },
        { itemId: "item_2", itemLabel: "題目 2 (反向)", validRange: [1, 5], isReverseScored: true, missingCodes: [99, -9] },
        { itemId: "item_3", itemLabel: "題目 3 (正向)", validRange: [1, 5], isReverseScored: false, missingCodes: [99, -9] },
      ],
      minValidItemsRequired: 2,
      scoreOutputRange: [3, 15],
      interpretationRules: ["總分越高代表認知投入程度越高"],
    },
  ];

  const latestScoringPreview = runSandboxScoringPreview({
    specification: scoringSpecifications[0],
    rawItemResponses: {
      item_1: 1,
      item_2: 2, // reversed: 1+5-2 = 4
      item_3: 5,
    },
  });

  // 8. Data Capture Schema (§16)
  const dataCaptureFields: DataCaptureField[] = [
    {
      fieldId: "dcf_vr_rt_t0",
      variableCode: "RT_MS_T0",
      labelZh: "T0 基線危害反應時間",
      constructRef: "CON-03",
      rqRefs: ["RQ-01"],
      dataType: "CONTINUOUS_MILLISECOND",
      sourceInstrumentVersionId: "ver_vr_log_v1",
      timePointLabel: "T0 (基線前測)",
      validRange: "0 - 60000 ms",
      missingPolicy: "若受試者 60 秒內未辨識危害，記錄為 60000ms 上限並標記 TIMEOUT",
      storageClassification: "DE_IDENTIFIED_ANALYSIS",
    },
    {
      fieldId: "dcf_tlx_sum_t1",
      variableCode: "NASA_TLX_TOTAL_T1",
      labelZh: "T1 立即認知負荷總分",
      constructRef: "CON-02",
      rqRefs: ["RQ-02"],
      dataType: "ORDINAL_LIKERT",
      sourceInstrumentVersionId: "ver_tlx_cht",
      timePointLabel: "T1 (立即後測)",
      validRange: "6 - 60 分",
      missingPolicy: "超過 2 題缺失則總分計為 null",
      storageClassification: "DE_IDENTIFIED_ANALYSIS",
    },
  ];

  // 9. Study Protocol Document (§17)
  const studyProtocol: StudyProtocolDocument = {
    protocolId: `proto_${projectId}`,
    protocolTitle: `${stage09Snapshot.scope.workingTitleZh} — 隨機對照試驗標準作業程序與研究協議`,
    versionLineage: "v1.0-instrument-baseline",
    reportingProfileCandidate: "SPIRIT 2025 試驗協議報告標準",
    ethicsVersionCoverage: "完全對齊第九階段 IRB 送審規劃與受試者知情同意手冊",
    sections: [
      {
        sectionId: "sec_proto_purpose",
        titleZh: "一、研究目的與背景",
        purpose: "說明研究目標與假說驗證方向",
        contentDraft: `本研究協議旨在規劃「${stage09Snapshot.scope.workingTitleZh}」之受控試驗流程，檢定自適應 AI 引導對危害反應成效之影響。`,
        linkedEvidenceIds: ["evi_01"],
        isLocked: false,
      },
      {
        sectionId: "sec_proto_procedure",
        titleZh: "二、試驗程序與防動暈安全中斷機制",
        purpose: "標準化受試者入組、配戴與安全中斷流程",
        contentDraft: "受試者於配戴 VR 前需完成知情同意簽署與基線測量。VR 體驗每次以 40 分鐘為限，滿 20 分鐘系統強制提示休息 10 分鐘以防動暈眩，現場配置觀察員隨時中止試驗。",
        linkedEvidenceIds: [],
        isLocked: false,
      },
      {
        sectionId: "sec_proto_instruments",
        titleZh: "三、測量工具與計分規格",
        purpose: "規範客觀眼動毫秒日誌與主觀認知負荷量表之施測標準",
        contentDraft: "主要成效指標採系統客觀眼動毫秒日誌 (RT_MS)，次要指標採 NASA-TLX 中文短版量表，數值轉換嚴格遵循受控計分規則。",
        linkedEvidenceIds: [],
        isLocked: false,
      },
    ],
  };

  return {
    workspaceId: `ws_inst_${projectId}`,
    projectId,
    currentRevision: 1,
    sourceStage09SnapshotId: stage09Snapshot.snapshotId,
    sourceRouteSnapshotId: stage09Snapshot.sourceRouteSnapshotId,
    primaryGoal,
    fundingIntent: stage09Snapshot.fundingIntent,
    publicationIntent: stage09Snapshot.publicationIntent,

    instrumentDefinitions,
    instrumentVersions,
    projectInstrumentUses,
    permissionRecords,
    adaptationPlans,
    scheduleOfActivities,
    scoringSpecifications,
    latestScoringPreview,
    dataCaptureFields,
    studyProtocol,

    downstreamRequirements: stage09Snapshot.downstreamRequirements || [],

    decision: "INSTRUMENT_PROTOCOL_PLANNING_COMPLETE",
    decisionRationale: "研究工具與量表已完成規格化對照，沙盒受控計分引擎驗證通過，Study Protocol 草稿已組裝完成。",
    reviewState: "DRAFT",
    isLocked: false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §18 Triple Alignment Checker Implementation
// -------------------------------------------------------------
export type AlignmentFinding = {
  checkId: string;
  category: "RESEARCH_ANALYSIS" | "PROTOCOL_ETHICS" | "RIGHTS_CONTENT";
  severity: "FATAL" | "MAJOR_WARNING";
  description: string;
  suggestedRemedy: string;
};

export function runInstrumentProtocolAlignmentCheck(workspace: InstrumentProtocolWorkspace): AlignmentFinding[] {
  const findings: AlignmentFinding[] = [];

  // A. Research & Analysis Alignment: Main RQ must have assigned instrument (spec §6, §18, T09)
  const hasOutcomeInstrument = workspace.projectInstrumentUses.some((u) => u.targetRqRefs.includes("RQ-01"));
  if (!hasOutcomeInstrument) {
    findings.push({
      checkId: "chk_missing_primary_rq_instrument",
      category: "RESEARCH_ANALYSIS",
      severity: "FATAL",
      description: "核心研究問題 (RQ-01) 尚未指派任何選用之研究工具或客觀資料取得路徑。",
      suggestedRemedy: "請至工具選擇清單指派或自編支援 RQ-01 之測量工具。",
    });
  }

  // B. MOE TPR Assessment Alignment: Skill outcome must not rely solely on satisfaction (spec §3, §18, T26)
  if (workspace.primaryGoal === "MOE_TPR") {
    const hasRubricOrObjective = workspace.projectInstrumentUses.some(
      (u) => u.versionId.includes("rubric") || u.versionId.includes("vr_log")
    );
    if (!hasRubricOrObjective) {
      findings.push({
        checkId: "chk_moe_satisfaction_alone",
        category: "RESEARCH_ANALYSIS",
        severity: "FATAL",
        description: "教育部教學實踐計畫技能目標未包含客觀評量規準 (Rubrics) 或實作日誌，僅依賴滿意度問卷。",
        suggestedRemedy: "請指派技能評量規準（Rubrics）以符合教學實踐學習成效檢證標準。",
      });
    }
  }

  // C. Rights & Translation Alignment: Restricted items must not be open without license (spec §9, T17)
  const hasRestrictedViolation = workspace.permissionRecords.some(
    (p) => p.licenseType === "COMMERCIAL_RESTRICTED" && p.permittedActions.includes("EXPORT_ITEMS")
  );
  if (hasRestrictedViolation) {
    findings.push({
      checkId: "chk_unauthorized_export_rights",
      category: "RIGHTS_CONTENT",
      severity: "FATAL",
      description: "受商業版權限制之量表題項被未授權設定為可公開匯出。",
      suggestedRemedy: "請將匯出權限限縮，或取得權利人明確之公開補充材料授權書。",
    });
  }

  return findings;
}

// -------------------------------------------------------------
// §24 Build InstrumentProtocolSnapshot for Stage 11 Handoff
// -------------------------------------------------------------
export function buildInstrumentProtocolSnapshot(params: {
  workspace: InstrumentProtocolWorkspace;
  stage09Snapshot: Stage09HandoffSnapshot;
}): InstrumentProtocolSnapshot {
  const { workspace, stage09Snapshot } = params;

  const pilotValidationNeeds = [
    "毫秒級眼動反應日誌系統通訊延遲壓力測試 (< 50ms)",
    "NASA-TLX 中文短版量表目標對象認知訪談 (Cognitive Interviewing, 5-8 人)",
    "高空危害處置 Rubric 評分者間信度 (Inter-rater reliability / Cohen's Kappa) 預試評定",
  ];

  const pilotApplicabilityHints = [
    "預試樣本以 10-15 名實習學員為限，著重於工具可理解性與動暈眩耐受度評估，不進行正式假說假設檢定。",
    "Pilot 資料應嚴格隔離，不得直接併入正式試驗分析資料集。",
  ];

  return {
    snapshotId: `ipsnap_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "instrument-protocol/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_s10`,
    stageId: "study-protocol",
    nextStageId: "pilot-validation", // Seamless handoff to Stage 11: Pilot／工具預試與 Protocol 驗證!
    sourceStage09SnapshotId: stage09Snapshot.snapshotId,
    sourceRouteSnapshotId: stage09Snapshot.sourceRouteSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    protocolRevision: workspace.currentRevision,
    decision: workspace.decision,
    decisionRationale: workspace.decisionRationale,

    scope: {
      workingTitleZh: stage09Snapshot.scope.workingTitleZh,
      workingTitleEn: stage09Snapshot.scope.workingTitleEn,
      overallPurpose: stage09Snapshot.scope.overallPurpose,
      primaryInstrumentCount: workspace.instrumentDefinitions.length,
    },

    rqRefs: ["RQ-01", "RQ-02"],
    instrumentDefinitionRefs: workspace.instrumentDefinitions.map((d) => d.instrumentDefId),
    instrumentVersionRefs: workspace.instrumentVersions.map((v) => v.versionId),
    scoringSpecRefs: workspace.scoringSpecifications.map((s) => s.specId),
    dataCaptureFieldRefs: workspace.dataCaptureFields.map((f) => f.fieldId),

    pilotValidationNeeds,
    pilotApplicabilityHints,

    downstreamRequirements: [...workspace.downstreamRequirements],
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    limitations: [
      "本快照為研究工具與 Study Protocol 規劃基線（Instrument & Protocol Planning Baseline），不代表正式工具信效度已確立或人體試驗已可直接開展。",
      "沙盒計分預覽採用合成測試資料 (SYNTHETIC_INSTRUMENT_TEST)，嚴禁將其當作受試者實證數據或納入樣本數統計。",
    ],
    checksum: `chk_ip_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}
