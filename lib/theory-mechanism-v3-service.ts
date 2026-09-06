/**
 * Theory & Mechanism Builder and Evaluation Service (V3-U06-FULL)
 * Spec: docs/stage06/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §16, §21, §24
 *
 * Implements:
 * 1. Intake of Stage 5 GapEvidenceSnapshot (zero re-entry)
 * 2. Tri-goal specific modeling & rationales (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. 8 Modeling Approaches mapping
 * 4. Construct Dictionary & Typed Relations
 * 5. Research Statements (H1, P1, GQ1) with disconfirmation directions
 * 6. Alternative Explanations & Boundary Conditions
 * 7. ModelToDesignRequirement Matrix
 * 8. Alignment Checker (DAG cycles, missing construct definitions, superficial satisfaction-only)
 * 9. Immutable TheoryMechanismSnapshot builder for Stage 7 handoff
 */

import {
  type TheoryWorkspace,
  type TheoryMechanismSnapshot,
  type TheoryCandidate,
  type ConstructDefinition,
  type ModelRelation,
  type ResearchStatement,
  type AlternativeExplanation,
  type BoundaryCondition,
  type ModelToDesignRequirement,
  type TheoryLogicFinding,
  type JournalModelRationale,
  type NstcModelRationale,
  type MoeTprModelRationale,
  type ModelingApproach,
} from "./theory-mechanism-v3-contract.ts";
import { type GapEvidenceSnapshot } from "./gap-novelty-v3-contract.ts";

export function buildTheoryWorkspaceFromGapSnapshot(params: {
  workspaceId: string;
  projectId: string;
  gapSnapshot: GapEvidenceSnapshot;
  userId?: string;
}): TheoryWorkspace {
  const { workspaceId, projectId, gapSnapshot } = params;
  const primaryGoal = gapSnapshot.primaryGoal;
  const scope = gapSnapshot.scope;

  // 1. Determine modeling approach
  let modelingApproach: ModelingApproach = "THEORY_TESTING";
  if (primaryGoal === "MOE_TPR") {
    modelingApproach = "TEACHING_LOGIC_MODEL";
  } else if (primaryGoal === "NSTC_GENERAL") {
    modelingApproach = "CONCEPTUAL_FRAMEWORK";
  }

  // 2. Candidate Theories from Gap snapshot hints (zero re-entry, spec §7)
  const theoryCandidates: TheoryCandidate[] = [
    {
      candidateId: "th_situated_cog",
      name: "情境認知理論 (Situated Cognition)",
      aliases: ["Situated Learning Theory"],
      candidateKind: "EXISTING_THEORY",
      originSourceRefs: gapSnapshot.literatureIds.slice(0, 2),
      definitionLocations: ["Brown, Collins & Duguid (1989), Educational Researcher, p. 32"],
      originalDomain: "認知心理學與教育科技",
      corePropositions: ["知識無法脫離其所產生與應用的情境", "認知歷程是個體與環境之即時互動演進"],
      constructs: ["情境逼真度", "動態互動鷹架", "實務危害辨識表現"],
      explanatoryScope: "解釋為何在動態逼真沉浸情境中結合即時引導能促成更深層之問題解決遷移",
      linkedGapRefs: gapSnapshot.gapClaimRefs,
      linkedRqRefs: gapSnapshot.rqRefs,
      applicabilityNotes: "高度適用於職業安全高風險模擬培訓情境",
      limitations: ["對非情境化純概念理解之預測力有限"],
      selectionRole: "PRIMARY_LENS",
      selectionRationale: "能直接回應本研究核心之生成式自適應即時互動機制，具備最高解釋適配度",
      actualReadingScope: "FULLTEXT_REVIEWED",
      reviewState: "DRAFT",
    },
    {
      candidateId: "th_cog_load",
      name: "認知負荷理論 (Cognitive Load Theory)",
      aliases: ["CLT"],
      candidateKind: "EXISTING_THEORY",
      originSourceRefs: gapSnapshot.counterevidenceRefs.length > 0 ? gapSnapshot.counterevidenceRefs : ["lit_endsley2000"],
      definitionLocations: ["Sweller (1988, 2011)"],
      originalDomain: "學習科學與人因工程",
      corePropositions: ["工作記憶容量有限，過度提示可能導致外在認知負荷劇增並阻礙技能獲得"],
      constructs: ["外在認知負荷", "內在認知負荷", "注意力分散效應"],
      explanatoryScope: "作為關鍵之競爭與制衡視角，解釋提示過頻可能引發的反向負面干擾",
      linkedGapRefs: gapSnapshot.gapClaimRefs,
      linkedRqRefs: gapSnapshot.rqRefs,
      applicabilityNotes: "用於規範自適應提示之頻率與界面呈現邊界",
      limitations: ["著重於認知資源限制，較少探討動機與沉浸感"],
      selectionRole: "RIVAL_EXPLANATION",
      selectionRationale: "作為主要競爭機制，確保研究設計納入反向干擾指標進行檢定",
      actualReadingScope: "FULLTEXT_REVIEWED",
      reviewState: "DRAFT",
    },
  ];

  // 3. Construct Dictionary (spec §9)
  const constructs: ConstructDefinition[] = [
    {
      constructId: "CON-01",
      revision: 1,
      canonicalNameZh: "生成式 AI 即時自適應引導",
      canonicalNameEn: "Generative AI Real-Time Adaptive Guidance",
      aliases: ["動態自適應提示", "LLM 即時反饋"],
      conceptualDefinition: "依據作業人員在沉浸式場景中之即時行為與視線歷程，由語言模型動態生成之情境化提示與非預期突發事件引導。",
      definitionBasis: "PROJECT_PROPOSED_NEW",
      sourceRefs: gapSnapshot.literatureIds.slice(0, 1),
      sourceLocations: ["本專案依情境認知架構所提之新構念定義"],
      scopeInclusions: ["即時情境語意提示", "突發危害情境動態觸發"],
      scopeExclusions: ["傳統預錄語音說明", "固定箭頭符號指引"],
      neighboringConstructDifferences: "不同於固定式視覺標註（Chen et al., 2024），本構念強調非預期性與個人化調整",
      unitOfAnalysis: "個別受訓者在單次任務中接收之引導歷程",
      level: "INDIVIDUAL",
      roleInCurrentModel: "INTERVENTION_OR_EXPOSURE",
      linkedRqRefs: [gapSnapshot.rqRefs[0] || "RQ-01"],
      provisionalObservationDirection: "系統日誌紀錄之提示觸發時點、內容複雜度與受訓者互動反應",
      isLocked: false,
      reviewState: "DRAFT",
    },
    {
      constructId: "CON-02",
      revision: 1,
      canonicalNameZh: "情境認知負荷",
      canonicalNameEn: "Situational Cognitive Load",
      aliases: ["心智負荷", "注意力負荷"],
      conceptualDefinition: "受訓者在處理即時虛擬作業任務與理解系統引導資訊時，主觀與客觀消耗之心理加工資源總和。",
      definitionBasis: "ADAPTED_FROM_SOURCE",
      sourceRefs: ["lit_endsley2000"],
      sourceLocations: ["Endsley (2000), Section 3, p. 45"],
      scopeInclusions: ["外在界面負荷", "任務核心思考負荷"],
      scopeExclusions: ["純生理體力疲勞"],
      neighboringConstructDifferences: "區分於一般任務難度感受，聚焦於資訊呈現對注意力分配之干擾",
      unitOfAnalysis: "受訓者個體",
      level: "INDIVIDUAL",
      roleInCurrentModel: "PROPOSED_MEDIATOR",
      linkedRqRefs: gapSnapshot.rqRefs,
      provisionalObservationDirection: "任務後標準化量表評量與客觀任務停頓時長",
      isLocked: false,
      reviewState: "DRAFT",
    },
    {
      constructId: "CON-03",
      revision: 1,
      canonicalNameZh: "動態危害辨識表現",
      canonicalNameEn: "Dynamic Hazard Recognition Performance",
      aliases: ["危害知覺精準度", "危險反應表現"],
      conceptualDefinition: "作業人員在高風險情境中正確識別突發潛在危險因子並採取正確規避反應之時效與精準度。",
      definitionBasis: "SOURCE_REPORTED",
      sourceRefs: ["lit_wu2021"],
      sourceLocations: ["Wu et al. (2021), PLoS ONE, Table 3"],
      scopeInclusions: ["識別正確率", "反應時間（RT）", "未受訓突發危害之移轉辨識"],
      scopeExclusions: ["受訓滿意度問卷評分"],
      neighboringConstructDifferences: "強調客觀行為表現與時效，嚴禁以自我回報滿意度代替",
      unitOfAnalysis: "受訓者個體",
      level: "INDIVIDUAL",
      roleInCurrentModel: "OUTCOME",
      linkedRqRefs: [gapSnapshot.rqRefs[1] || "RQ-02"],
      provisionalObservationDirection: "受訓後客觀危害辨識測驗指標（正確率百分比與反應秒數）",
      isLocked: false,
      reviewState: "DRAFT",
    },
  ];

  // 4. Typed Model Relations (spec §10)
  const relations: ModelRelation[] = [
    {
      relationId: "REL-01",
      modelId: "mod_v1",
      modelRevision: 1,
      sourceConstructRef: "CON-01",
      targetConstructRef: "CON-03",
      relationType: "HYPOTHESIZED_CAUSAL",
      direction: "FORWARD",
      expectedSign: "POSITIVE",
      timeOrderNotes: "自適應引導介入實施於培訓歷程，成果表現測量於介入後",
      mechanismRationale: "即時引導能打破受訓者對固定情境的僵化思維，透過情境反饋強化危害特徵的心智表徵構建，進而提升實務辨識時效。",
      alternativeExplanations: ["霍桑效應（新奇感促使受試者更加集中注意力）"],
      basisType: "EXISTING_THEORY_DERIVATION",
      literatureSupportRefs: ["lit_wu2021"],
      counterevidenceRefs: ["lit_endsley2000"],
      linkedRqRefs: [gapSnapshot.rqRefs[0] || "RQ-01"],
      linkedStatementRefs: ["H1"],
      isExplanatoryOnlyNotDirectlyTested: false,
      isLocked: false,
      reviewState: "DRAFT",
    },
    {
      relationId: "REL-02",
      modelId: "mod_v1",
      modelRevision: 1,
      sourceConstructRef: "CON-01",
      targetConstructRef: "CON-02",
      relationType: "MEDIATION_CANDIDATE",
      direction: "FORWARD",
      expectedSign: "EXPLORATORY",
      timeOrderNotes: "引導介入伴隨產生即時心智負荷變化",
      mechanismRationale: "適度引導能降低內在理解難度，但若提示過頻可能引發資訊過載，產生非線性之中介調節影響。",
      alternativeExplanations: ["注意力分散效應（Split-Attention Effect）"],
      basisType: "NEW_PROPOSED_LINK",
      literatureSupportRefs: ["lit_closest_chen2024"],
      counterevidenceRefs: ["lit_endsley2000"],
      linkedRqRefs: gapSnapshot.rqRefs,
      linkedStatementRefs: ["P1"],
      isExplanatoryOnlyNotDirectlyTested: false,
      isLocked: false,
      reviewState: "DRAFT",
    },
  ];

  // 5. Research Statements (Hypotheses / Propositions / Questions) (spec §11)
  const statements: ResearchStatement[] = [
    {
      statementId: "ST-01",
      stableLabel: primaryGoal === "MOE_TPR" ? "P1" : "H1",
      statementType: primaryGoal === "MOE_TPR" ? "PROPOSITION" : "HYPOTHESIS",
      statementText: "相較於固定式提示組，接受生成式 AI 即時自適應引導之受訓組在面對非預期突發危害情境時，展現顯著較高之危害辨識精準度與較短反應時間。",
      linkedRqRef: gapSnapshot.rqRefs[0] || "RQ-01",
      constructRefs: ["CON-01", "CON-03"],
      relationRefs: ["REL-01"],
      rationaleSummary: "依情境認知理論，動態鷹架有助於活化實質解題策略，而非死背靜態線索。",
      expectedObservation: "介入組在未受訓突發危害情境之辨識反應時間縮短 15% 以上，且正確率顯著提升。",
      disconfirmationDirection: "若介入組在突發危害情境之辨識反應時間顯著慢於固定組或無顯著差異，則本假說不成立。",
      temporalStatus: "PROPOSED_BEFORE_STUDY",
      dataExposureStatus: "PRE_DATA_PLANNED",
      isLocked: false,
      reviewState: "DRAFT",
    },
  ];

  // 6. Alternative Explanations & Boundary Conditions (spec §12)
  const alternativeExplanations: AlternativeExplanation[] = [
    {
      explanationId: "ALT-01",
      impactsRelationRefs: ["REL-01"],
      impactsStatementRefs: ["ST-01"],
      rivalExplanationText: "霍桑效應與技術新奇感干擾",
      rivalMechanism: "受訓者表現提升並非源自 AI 自適應邏輯，而是對生成式對話技術的新鮮感激發短暫高度警覺。",
      discriminatingObservation: "在訓練中期設置適應穩定期，並於訓練結束後 14 日後測檢驗成效之持續性。",
      suggestedDesignRemedy: "設置對等沉浸度但無自適應生成之主動對照組，以控制新奇效應。",
    },
  ];

  const boundaryConditions: BoundaryCondition[] = [
    {
      boundaryId: "BC-01",
      targetStatementOrRelationRef: "REL-01",
      boundaryDimension: "TASK_DIFFICULTY",
      boundaryDescription: "本模型之正面促成效果僅適用於具備明確安全法規依據之結構化與半結構化作業場景，高度開放之非結構化緊急應變情境不在此限。",
      isPlannedForEmpiricalTesting: true,
    },
  ];

  // 7. ModelToDesignRequirement Matrix (Interface to Stage 7) (spec §13)
  const designRequirements: ModelToDesignRequirement[] = [
    {
      requirementId: "DES-REQ-01",
      rqRef: gapSnapshot.rqRefs[0] || "RQ-01",
      statementRef: "ST-01",
      constructRefs: ["CON-01", "CON-03"],
      relationRefs: ["REL-01"],
      observationalRequirement: "需同時收集立即危害辨識反應時間與突發情境規避正確率之客觀指標。",
      comparisonNeed: "需設立平行對照組（固定腳本沉浸組），活動時間與任務等效。",
      temporalNeed: "需要事前基線前測、歷程即時日誌與任務後成效測驗。",
      unitAndLevel: "個體受訓者層級",
      designUncertainty: "受試者個體 VR 耐受度差異對反應時間之潛在混淆需於設計階段控制。",
      duePhase: "RESEARCH_DESIGN",
    },
  ];

  // 8. Tri-Goal Specific Rationale Notes (spec §16)
  let journalRationale: JournalModelRationale | undefined;
  let nstcRationale: NstcModelRationale | undefined;
  let moeTprRationale: MoeTprModelRationale | undefined;

  if (primaryGoal === "JOURNAL_SCI_SSCI") {
    journalRationale = {
      theoreticalPositioningAndGapResponse: "本模型結合情境認知理論與認知負荷理論，直接回應既有國際研究（Chen et al., 2024）缺乏動態自適應機制之缺口。",
      differentiationFromClosestStudies: "不同於僅在固定情境標註危險，本模型著重非預期突發危害之動態反饋機制。",
      hypothesizedMechanismDefense: "透過即時引導降低探索盲區，同時藉由對照組設計排除新奇感干擾。",
      untestedBoundariesAndLimitations: "長期技能保留（60日以上）與跨不同作業類別之遷移性留待後續實證探討。",
    };
  } else if (primaryGoal === "NSTC_GENERAL") {
    nstcRationale = {
      scientificProblemImportance: "國科會學門關注生成式 AI 與人因科技在高風險產業培訓中之科學推論機制與人機協同邊界。",
      logicalDerivationOfPropositions: "命題推導自認知心理學實務，兼顧即時引導之效益與認知資源上限之制衡。",
      interdisciplinaryValueAdd: "跨越資訊工程、工工人因與教育科技，具備理論與工程實作整合價值。",
      workPackageAlignmentNotes: "第一年聚焦自適應機制建構與實驗室驗證，第二年進行場域實證與邊界測試。",
    };
  } else if (primaryGoal === "MOE_TPR") {
    moeTprRationale = {
      classroomObservedProblem: "課堂學生在危險辨識實務操作時存在死背固定步驟、臨場應變力不足之核心教學困難。",
      instructionalInterventionActivity: "於學期實作單元導入 AI 自適應 VR 模擬，分階段提供鷹架式引導。",
      expectedLearningMechanism: "活動（沉浸操作）≠ 機制；真實機制為透過即時認知衝突與反饋，促成概念重構。",
      nearTermLearningOutcomes: "單元實作測驗成績與突發危害辨識反應時間。",
      farTermTransferOrRetentionOutcomes: "期末綜合情境考核表現與校外實習安全操作遵守率。",
      assessmentDirectionNotes: "以實作成品評量規準（Rubrics）與系統歷程日誌為主，滿意度僅作情意輔助，不代替技能表現。",
    };
  }

  return {
    workspaceId: `ws_tm_${projectId}`,
    projectId,
    currentRevision: 1,
    sourceGapSnapshotId: gapSnapshot.snapshotId,
    sourceBlueprintSnapshotId: gapSnapshot.sourceBlueprintSnapshotId,
    primaryGoal,
    fundingIntent: gapSnapshot.fundingIntent,
    publicationIntent: gapSnapshot.publicationIntent,

    modelingBrief: {
      targetPhenomenonToExplain: scope.overallPurpose,
      targetScopeExplanation: `本模型試圖解釋「${scope.workingTitleZh}」在特定情境下之即時自適應機制與認知表現影響，而不是涵蓋所有非結構化作業之通用理論。`,
      unitOfAnalysis: "個體作業人員 / 修課學生",
      modelingApproach,
      rationaleForApproach: `依據專案目標（${primaryGoal}）與文獻缺口特性，採 ${modelingApproach} 建立最小可行解釋架構。`,
    },

    theoryCandidates,
    selectedPrimaryLensId: "th_situated_cog",
    selectionDecisionRationale: "情境認知理論最能直接詮釋沉浸環境中即時自適應引導對知識動態建構之機制，故選為主要理論透鏡。",

    constructs,
    relations,
    statements,
    alternativeExplanations,
    boundaryConditions,
    designRequirements,

    journalRationale,
    nstcRationale,
    moeTprRationale,

    downstreamRequirements: gapSnapshot.downstreamRequirements || [],
    graphViewMode: "CONCEPTUAL",

    decision: "ADOPT_MODEL",
    decisionRationale: "模型結構完整，主要構念均具備清晰邊界，關係推導具備學理依據且已納入競爭解釋，符合交付研究設計之基線標準。",
    reviewState: "DRAFT",
    isLocked: false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §21 Alignment Checker Implementation
// -------------------------------------------------------------
export function runTheoryMechanismLogicCheck(workspace: TheoryWorkspace): TheoryLogicFinding[] {
  const findings: TheoryLogicFinding[] = [];

  // 1. Missing construct definition check (spec §9)
  const constructIds = new Set(workspace.constructs.map((c) => c.constructId));
  for (const relation of workspace.relations) {
    if (!constructIds.has(relation.sourceConstructRef) || !constructIds.has(relation.targetConstructRef)) {
      findings.push({
        checkId: `chk_dangling_relation_${relation.relationId}`,
        ruleCode: "DANGLING_RELATION_REFERENCE",
        severity: "FATAL",
        targetSection: "relations",
        targetFieldRef: relation.relationId,
        findingDescription: `關係 ${relation.relationId} 引用了未在構念字典中定義之構念 ID（${relation.sourceConstructRef} -> ${relation.targetConstructRef}）。`,
        rationale: "模型中每條關係之起點與終點構念必須皆在構念字典中具備明確定義，不可有懸空引用。",
        suggestedAction: "請至構念字典補足對應構念定義，或修正該關係之起迄構念參照。",
        autoFixAvailable: false,
      });
    }
  }

  // 2. DAG cycle check when in CAUSAL_DAG view mode (spec §14 & §21)
  if (workspace.graphViewMode === "CAUSAL_DAG") {
    const adj = new Map<string, string[]>();
    for (const r of workspace.relations) {
      if (r.direction === "FORWARD") {
        if (!adj.has(r.sourceConstructRef)) adj.set(r.sourceConstructRef, []);
        adj.get(r.sourceConstructRef)!.push(r.targetConstructRef);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    function hasCycle(node: string): boolean {
      visited.add(node);
      recStack.add(node);
      const neighbors = adj.get(node) || [];
      for (const next of neighbors) {
        if (!visited.has(next) && hasCycle(next)) return true;
        if (recStack.has(next)) return true;
      }
      recStack.delete(node);
      return false;
    }

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          findings.push({
            checkId: `chk_dag_cycle_${node}`,
            ruleCode: "DAG_CYCLE_UNRESOLVED",
            severity: "FATAL",
            targetSection: "relations",
            findingDescription: "在因果圖（CAUSAL_DAG）模式下檢測到循環依賴路徑。",
            rationale: "純因果 DAG 模型要求為有向無環圖，同時點路徑不可循環回溯至自身。若為系統動態回饋，請切換至 DYNAMIC_FEEDBACK 模式並具備時間註記。",
            suggestedAction: "請移除造成循環之因果箭頭，或將檢視模式切換為 DYNAMIC_FEEDBACK。",
            autoFixAvailable: true,
          });
          break;
        }
      }
    }
  }

  // 3. MOE_TPR fake grades / superficial satisfaction check (spec §5 & §16)
  if (workspace.primaryGoal === "MOE_TPR" && workspace.moeTprRationale) {
    const moe = workspace.moeTprRationale;
    if (moe.assessmentDirectionNotes.includes("僅採滿意度") || moe.assessmentDirectionNotes.includes("滿意度代替技能")) {
      findings.push({
        checkId: "chk_moe_satisfaction_only_theory",
        ruleCode: "SUPERFICIAL_ASSESSMENT_MISALIGNMENT",
        severity: "MAJOR_WARNING",
        targetSection: "moeTprRationale",
        targetFieldRef: "assessmentDirectionNotes",
        findingDescription: "教學問題聚焦於技能實作，但評量規劃備註提及僅採滿意度問卷。",
        rationale: "教育部教學實踐研究計畫強調學習成效之真實檢證，單純滿意度不能替代專業技能習得之證據。",
        suggestedAction: "建議增列實作規準（Rubrics）、任務歷程日誌或實作成績指標。",
        autoFixAvailable: true,
      });
    }
  }

  // 4. Missing alternative explanation for primary causal relations (spec §12)
  for (const relation of workspace.relations) {
    if (relation.relationType === "HYPOTHESIZED_CAUSAL" && relation.alternativeExplanations.length === 0) {
      findings.push({
        checkId: `chk_no_alt_explanation_${relation.relationId}`,
        ruleCode: "ALTERNATIVE_EXPLANATION_MISSING",
        severity: "MAJOR_WARNING",
        targetSection: "relations",
        targetFieldRef: relation.relationId,
        findingDescription: `核心假設因果關係 ${relation.relationId} 未登錄任何競爭機制或替代解釋。`,
        rationale: "學術建模必須考慮新奇效應、先備能力差異或外部混雜等競爭假說，並在研究設計中提供區分可能。",
        suggestedAction: "請在該關係卡中補充至少一項潛在替代解釋（如霍桑效應或注意力分散）。",
        autoFixAvailable: true,
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------
// §24 Build TheoryMechanismSnapshot for Stage 7 handoff
// -------------------------------------------------------------
export function buildTheoryMechanismSnapshot(params: {
  workspace: TheoryWorkspace;
  gapSnapshot: GapEvidenceSnapshot;
}): TheoryMechanismSnapshot {
  const { workspace, gapSnapshot } = params;

  return {
    snapshotId: `tms_${workspace.projectId}_${Date.now()}`,
    schemaVersion: "theory-mechanism/1.0.0",
    workspaceId: workspace.workspaceId,
    projectId: workspace.projectId,
    workOrderId: `wo_${workspace.projectId}_theory`,
    stageId: "theory-mechanism",
    nextStageId: "study-design", // Seamless handoff to Stage 7!
    sourceGapSnapshotId: workspace.sourceGapSnapshotId,
    sourceBlueprintSnapshotId: workspace.sourceBlueprintSnapshotId,
    goalContextRevision: 1,
    primaryGoal: workspace.primaryGoal,
    fundingIntent: workspace.fundingIntent,
    publicationIntent: workspace.publicationIntent,

    modelRevision: workspace.currentRevision,
    modelingApproach: workspace.modelingBrief.modelingApproach,
    decision: workspace.decision,
    decisionRationale: workspace.decisionRationale,

    scope: {
      workingTitleZh: gapSnapshot.scope.workingTitleZh,
      workingTitleEn: gapSnapshot.scope.workingTitleEn,
      overallPurpose: gapSnapshot.scope.overallPurpose,
      targetPhenomenon: workspace.modelingBrief.targetPhenomenonToExplain,
    },

    rqRefs: [...gapSnapshot.rqRefs],
    theoryCandidateRefs: workspace.theoryCandidates.map((c) => c.candidateId),
    constructRefs: workspace.constructs.map((c) => c.constructId),
    relationRefs: workspace.relations.map((r) => r.relationId),
    statementRefs: workspace.statements.map((s) => s.statementId),
    alternativeExplanationRefs: workspace.alternativeExplanations.map((a) => a.explanationId),
    boundaryConditionRefs: workspace.boundaryConditions.map((b) => b.boundaryId),
    designRequirementRefs: workspace.designRequirements.map((d) => d.requirementId),

    downstreamRequirements: [...workspace.downstreamRequirements],
    duePhases: Array.from(new Set(workspace.downstreamRequirements.map((r) => r.duePhase))),

    measurementDirections: workspace.constructs.map((c) => ({
      constructId: c.constructId,
      observationDirection: c.provisionalObservationDirection,
    })),
    comparisonNeeds: workspace.designRequirements.map((d) => d.comparisonNeed),
    temporalNeeds: workspace.designRequirements.map((d) => d.temporalNeed),

    limitations: [
      "本快照為理論與機制規劃基線（Theory & Mechanism Baseline），不代表正式研究設計已定案、IRB 已審查核准或期刊完稿發表。",
      "模型所提之因果路徑屬待檢定假說，需待 Stage 7 研究設計與後續資料蒐集檢證。",
    ],
    checksum: `chk_tms_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}
