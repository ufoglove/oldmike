/**
 * Study Design & Analysis Planning Contract (V3-U07-FULL)
 * Spec: docs/stage07/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §17, §22, §25, §26
 *
 * Implements:
 * 1. Intake of Stage 6 TheoryMechanismSnapshot (zero re-entry)
 * 2. Tri-goal specific design views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. Multi-component study structures & design candidates
 * 4. InferenceTarget (descriptive, associational, causal, predictive, exploratory, interpretative)
 * 5. StudyStructure (population, units: allocation/observation/analysis, arms, timepoints)
 * 6. SampleJustification & PlanningCalculationRecord (real deterministic calculations)
 * 7. MeasurementRequirement & MeasurementSchedule (definitions, observation direction, NOT fake scales)
 * 8. RQ - Design - Data - Analysis Matrix
 * 9. AnalysisLab Planning Mode (primary/secondary/exploratory, missingness, multiplicity)
 * 10. DesignAnalysisPlanningSnapshot immutable handoff contract for Stage 8 (route-studio)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type TheoryMechanismSnapshot } from "./theory-mechanism-v3-contract.ts";
import { type DownstreamRequirementItem, type TemporalStatus } from "./blueprint-planning-contract.ts";
import { type CalculationResultOutput } from "./planning-calculation-engine.ts";

export const STUDY_DESIGN_PLANNING_CONTRACT_VERSION = "study-design-planning/1.0.0" as const;

// -------------------------------------------------------------
// §5 & §6 Study Design Types & Candidates
// -------------------------------------------------------------
export const RESEARCH_DESIGN_TYPES = [
  "RANDOMIZED_CONTROLLED_TRIAL",       // 隨機對照試驗 (RCT)
  "CLUSTER_RANDOMIZED_TRIAL",          // 群集隨機試驗 (CRT)
  "QUASI_EXPERIMENTAL_PRE_POST",       // 準實驗前後測
  "LONGITUDINAL_OBSERVATIONAL",        // 縱貫追蹤觀察
  "CROSS_SECTIONAL_OBSERVATIONAL",     // 橫斷調查
  "QUALITATIVE_CASE_STUDY",            // 質性質化個案研究
  "QUALITATIVE_INTERVIEW_AND_THEMATIC",// 質性深度訪談與主題分析
  "MIXED_METHODS_CONVERGENT",          // 混合方法平行設計
  "DESIGN_SCIENCE_RESEARCH",           // 設計科學研究
  "TECHNICAL_BENCHMARK_EVALUATION",    // 技術基準評估
  "SECONDARY_DATA_ANALYSIS",           // 二手資料分析
] as const;
export type ResearchDesignType = (typeof RESEARCH_DESIGN_TYPES)[number];

export type DesignCandidate = {
  candidateId: string;
  designName: string;
  designType: ResearchDesignType;
  targetRqRefs: string[];
  primaryInferenceTarget: string;
  unitStructureSummary: string;
  comparisonStructureSummary: string;
  requiredAssumptions: string[];
  keyStrengths: string[];
  knownLimitations: string[];
  resourceFeasibilityNotes: string;
  selectionRole: "SELECTED" | "ALTERNATIVE" | "REJECTED";
  selectionRationale?: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §7 Inference Target (What information is being sought)
// -------------------------------------------------------------
export const INFERENCE_TARGET_TYPES = [
  "DESCRIPTIVE",
  "ASSOCIATIONAL",
  "CAUSAL",
  "PREDICTIVE",
  "EXPLORATORY",
  "INTERPRETIVE",
  "DESIGN_EVALUATION",
] as const;
export type InferenceTargetType = (typeof INFERENCE_TARGET_TYPES)[number];

export type InferenceTarget = {
  targetId: string;
  rqRef: string;
  statementRef?: string;
  targetType: InferenceTargetType;
  targetPopulation: string;
  unitOfAnalysis: string; // Analysis unit != Sampling unit
  contrastOrComparisonDescription: string;
  primaryOutcomeConstructRef: string;
  primaryOutcomeMetricName: string;
  estimandSummary: string; // Clear plain-text definition of target quantity/meaning
  minimalMeaningfulDifference: string;
};

// -------------------------------------------------------------
// §8 Study Structure (Arms, Units, Allocation, Timepoints)
// -------------------------------------------------------------
export type StudyArm = {
  armId: string;
  armName: string; // e.g. "AI 即時引導介入組", "傳統靜態對照組"
  armType: "INTERVENTION" | "ACTIVE_CONTROL" | "PLACEBO_OR_SHAM" | "STANDARD_CARE_OR_USUAL_INSTRUCTION";
  interventionDescription: string;
  dosageOrExposureTimeline: string;
  burdenNotes: string;
};

export type StudyTimePoint = {
  timePointId: string;
  label: string; // e.g. "T0 (基線前測)", "T1 (介入立即後測)", "T2 (14日延宕追蹤)"
  relativeTiming: string; // e.g. "介入前一週", "介入完畢當日", "介入後 14 日"
  isFollowUpRetention: boolean;
  purposeDescription: string;
};

export type StudyStructure = {
  samplingUnit: string; // e.g. "修課班級"
  allocationUnit: string; // e.g. "受試者個人" or "班級群集"
  observationUnit: string; // e.g. "每次危險情境之反應紀錄"
  analysisUnit: string; // e.g. "個別作業人員 / 學生"
  targetPopulation: string;
  accessiblePopulation: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  allocationMethod: "INDIVIDUAL_RANDOM" | "CLUSTER_RANDOM" | "STRATIFIED_RANDOM" | "QUASI_EXPERIMENTAL_MATCHED" | "NATURAL_COHORT";
  maskingBlindingFeasibility: "DOUBLE_BLIND" | "SINGLE_BLIND_EVALUATOR" | "OPEN_LABEL_NOT_FEASIBLE";
  arms: StudyArm[];
  timePoints: StudyTimePoint[];
};

// -------------------------------------------------------------
// §9 & §10 Sample Justification & Calculation Records
// -------------------------------------------------------------
export const SAMPLE_JUSTIFICATION_STRATEGIES = [
  "A_PRIORI_POWER",
  "PRECISION_PLANNING",
  "DETECTABLE_EFFECT_SCENARIOS",
  "SIMULATION_BASED_DESIGN",
  "RESOURCE_CONSTRAINED",
  "FIXED_DATASET_OR_CENSUS",
  "QUALITATIVE_INFORMATION_RATIONALE",
  "TECHNICAL_REPLICATION_COVERAGE",
] as const;
export type SampleJustificationStrategy = (typeof SAMPLE_JUSTIFICATION_STRATEGIES)[number];

export type SampleJustification = {
  justificationId: string;
  strategy: SampleJustificationStrategy;
  targetRqRef: string;
  inferenceTargetRef: string;
  effectSizeBasis: "LITERATURE_REPORTED" | "CLOSEST_STUDY_EXTRACTED" | "ASSUMPTION_BASED_MINIMAL_MEANINGFUL" | "RESOURCE_BOUNDED";
  effectSizeValue: number;
  effectSizeMetric: "COHENS_D" | "PEARSON_R" | "ODDS_RATIO" | "ETA_SQUARED" | "DETECTABLE_DELTA";
  sourceLiteratureRef?: string;
  planningCalculationRef?: string; // Refers to CalculationResultOutput
  nPerArmEstimated: number;
  totalAnalyzableNEstimated: number;
  expectedAttritionRate: number; // e.g. 0.15 (15%)
  recruitmentTargetN: number;
  justificationNarrative: string;
  limitations: string[];
  isLocked: boolean;
};

// -------------------------------------------------------------
// §11 Measurement Requirements & Schedule
// -------------------------------------------------------------
export type DesignMeasurementRequirement = {
  measurementId: string; // e.g. "M-01"
  constructRef: string;
  metricLabel: string;
  dataType: "CONTINUOUS_RATIO" | "ORDINAL_SCORE" | "BINARY_FLAG" | "QUALITATIVE_TEXT" | "SYSTEM_LOG_TIMESTAMP";
  measurementRole: "PRIMARY_OUTCOME" | "SECONDARY_OUTCOME" | "MEDIATOR_METRIC" | "MODERATOR_METRIC" | "BASELINE_COVARIATE" | "PROCESS_FIDELITY";
  sourceOrInstrumentDirection: string; // Direction only, NOT fake scales!
  targetTimePointRefs: string[]; // references StudyTimePoint.timePointId
  targetArmRefs: string[];
  validityReliabilityRequirements: string;
  responsibleRole: string;
  isLocked: boolean;
};

// -------------------------------------------------------------
// §12 Core RQ - Design - Data - Analysis Matrix
// -------------------------------------------------------------
export type RqDesignDataAnalysisRow = {
  matrixRowId: string; // e.g. "MAT-01"
  rqRef: string;
  researchStatementRef: string;
  inferenceTargetRef: string;
  selectedDesignRef: string;
  analysisUnit: string;
  comparatorSummary: string;
  measurementRefs: string[];
  timePointRefs: string[];
  plannedAnalysisMethod: string;
  targetEstimateOrOutput: string;
  sampleJustificationRef: string;
  primaryBiasRemedyNotes: string;
  status: "COMPLETE" | "PROVISIONAL" | "UNRESOLVED_GAP";
  isLocked: boolean;
};

// -------------------------------------------------------------
// §13 Analysis Lab Planning Mode (Analysis Plan)
// -------------------------------------------------------------
export type AnalysisPlanItem = {
  analysisPlanId: string; // e.g. "AP-01"
  targetRqRef: string;
  analysisRole: "PRIMARY" | "SECONDARY" | "SENSITIVITY" | "PRE_PLANNED_EXPLORATORY";
  targetEstimandDescription: string;
  modelOrStrategy: string; // e.g. "ANCOVA 控制前測與受訓時間", "線性混合效應模型 (LMM)"
  dependentVariableMetric: string;
  independentVariables: string[];
  covariatesAndRationale: string[];
  missingDataHandlingStrategy: "COMPLETE_CASE_ANALYSIS" | "MULTIPLE_IMPUTATION" | "FIML" | "SENSITIVITY_BOUNDS";
  multiplicityCorrectionPlan?: string;
  modelDiagnosticsAndAssumptions: string[];
  softwareOrEnvironmentPlanned: string;
  isLocked: boolean;
};

// -------------------------------------------------------------
// §15 Bias & Validity Risk Assessment
// -------------------------------------------------------------
export type DesignValidityRisk = {
  riskId: string;
  biasType: "SELECTION_BIAS" | "ARM_SITE_CONFOUNDING" | "ATTRITION_BIAS" | "CONTAMINATION" | "HAWTHORNE_OR_NOVELTY" | "TESTING_OR_FATIGUE" | "DATA_LEAKAGE";
  impactsRqOrArmRefs: string[];
  riskDescription: string;
  preventiveDesignRemedy: string;
  sensitivityAnalysisRemedy: string;
  residualLimitation: string;
};

// -------------------------------------------------------------
// §5 & §17 Tri-Goal Specific Design Rationales
// -------------------------------------------------------------
export type JournalDesignRationale = {
  articleTypeAndMethodAlignment: string;
  evidenceStrengthForInternationalAudience: string;
  reportingGuidelineCandidate: string; // e.g. "CONSORT 2025" / "EQUATOR Checklist"
  unresolvedEmpiricalLimitations: string;
};

export type NstcDesignRationale = {
  scientificMethodFeasibility: string;
  workPackageAndMilestoneAlignment: string;
  personnelAndEquipmentAllocationReason: string;
  multiYearContinuationJustification: string;
};

export type MoeTprDesignRationale = {
  courseNameAndSemesterRef: string;
  pedagogicalProblemAndOutcomeAlignment: string;
  classroomArmConfoundingRemedy: string; // Explicit check for teacher/class confounding!
  studentAssessmentFeasibility: string; // Rubrics + logs, not satisfaction alone!
  studentConsentAndGradeSeparationPlan: string;
};

// -------------------------------------------------------------
// §6 & §19 Complete Research Design & Analysis Workspace
// -------------------------------------------------------------
export type StudyDesignWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceTheorySnapshotId: string;
  sourceBlueprintSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Design Brief (§6)
  designBrief: {
    coreQuestionSummary: string;
    targetInformationGoal: string;
    availableResourceContext: string;
    constraintsAndBoundaries: string;
  };

  // Candidates & Selection (§6)
  designCandidates: DesignCandidate[];
  selectedDesignId: string;

  // Inference Targets (§7)
  inferenceTargets: InferenceTarget[];

  // Study Structure (§8)
  studyStructure: StudyStructure;

  // Sample Justification & Calculations (§9 & §10)
  sampleJustifications: SampleJustification[];
  planningCalculations: CalculationResultOutput[];

  // Measurement Requirements (§11)
  measurementRequirements: DesignMeasurementRequirement[];

  // RQ - Design - Data - Analysis Matrix (§12)
  matrixRows: RqDesignDataAnalysisRow[];

  // Analysis Plan (Planning Mode) (§13)
  analysisPlans: AnalysisPlanItem[];

  // Validity & Bias Risks (§15)
  validityRisks: DesignValidityRisk[];

  // Tri-Goal Specific Rationales (§5 & §17)
  journalRationale?: JournalDesignRationale;
  nstcRationale?: NstcDesignRationale;
  moeTprRationale?: MoeTprDesignRationale;

  // Downstream Requirements carried forward without cyclic gate
  downstreamRequirements: DownstreamRequirementItem[];

  // Overall Decision & Baseline Status (§25)
  decision: "ADOPT_DESIGN" | "ADOPT_WITH_DECLARED_ASSUMPTIONS" | "USE_EXPLORATORY_OR_TECHNICAL_DESIGN" | "RETURN_FOR_MODEL_OR_SCOPE_REVISION" | "NEEDS_CORE_DESIGN_INFORMATION";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §26 DesignAnalysisPlanningSnapshot (Immutable handoff to Stage 8)
// -------------------------------------------------------------
export type DesignAnalysisPlanningSnapshot = {
  snapshotId: string; // e.g. "daps_<uuid>"
  schemaVersion: "study-design-planning/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "study-design";
  nextStageId: "route-studio"; // Stage 8: 三路線研究與計畫工作室
  sourceTheorySnapshotId: string;
  sourceGapSnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  designRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    selectedDesignName: string;
    selectedDesignType: ResearchDesignType;
  };

  // References & Identifiers
  rqRefs: string[];
  designCandidateRefs: string[];
  inferenceTargetRefs: string[];
  armRefs: string[];
  timePointRefs: string[];
  measurementRefs: string[];
  matrixRowRefs: string[];
  analysisPlanRefs: string[];

  // Sample Justification & Real Computation Evidence
  sampleJustificationRefs: string[];
  planningCalculationRefs: string[];
  recruitmentTargetTotalN: number;
  totalAnalyzableN: number;

  // Downstream Requirements (carried forward)
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // Route Workspace Intents (handed off to Stage 8)
  routeWorkspaceIntents: {
    isJournalManuscriptPlanned: boolean;
    isNstcProposalPlanned: boolean;
    isMoeTprProposalPlanned: boolean;
  };

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §23 Alignment Findings
// -------------------------------------------------------------
export type DesignLogicFinding = {
  checkId: string;
  ruleCode: string;
  severity: "FATAL" | "MAJOR_WARNING" | "SUGGESTION";
  targetSection: string;
  targetFieldRef?: string;
  findingDescription: string;
  rationale: string;
  suggestedAction: string;
  autoFixAvailable: boolean;
};
