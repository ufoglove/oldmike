/**
 * Analysis Execution Mode, Results & Publication Displays Contract (V3-U14-FULL)
 * Spec: docs/stage14/spec-v3-4.0.md §1, §3, §4, §5, §6, §7, §8, §9, §10, §12, §15, §20, §21, §26, §27, §29, §30
 *
 * Implements:
 * 1. Intake of Stage 13 DataGovernanceSnapshot (zero re-entry)
 * 2. Immutable Result Facts Layer (ResultRecord & ResultFact with SHA-256 seal)
 * 3. Analysis Work Order & RQ Execution Registry
 * 4. Deterministic Statistical Engine outputs:
 *    - Sample flow & Descriptive statistics
 *    - Independent / Welch two-sample t-test, Cohen's d, 95% CI
 *    - Linear Model / ANCOVA with baseline covariate control (T0 -> T1)
 *    - Multiplicity corrections (Holm-Bonferroni & FDR)
 *    - Non-significant results handling without bias
 * 5. Publication Table & Figure Studio (direct ResultFact binding, no generative fake plots)
 * 6. Result Evidence Package & AnalysisResultsSnapshot immutable handoff for Stage 15 (results-writing)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type DataGovernanceSnapshot } from "./data-governance-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const ANALYSIS_EXECUTION_CONTRACT_VERSION = "analysis-execution/1.0.0" as const;

// -------------------------------------------------------------
// §4 & §5 Analysis Work Order & Operational Mode
// -------------------------------------------------------------
export type AnalysisExecutionMode =
  | "PLANNING_ONLY"
  | "DEVELOPMENT_FIXTURE"
  | "PILOT_DIAGNOSTIC"
  | "FORMAL_ANALYSIS"
  | "AUTHORIZED_INTERIM_ANALYSIS";

export type AnalysisWorkOrder = {
  workOrderId: string;
  projectId: string;
  goalContextRevision: number;
  datasetVersionRef: string;
  datasetContentHashSha256: string;
  authorizedExecutionMode: AnalysisExecutionMode;
  authorizedRqRefs: string[];
  authorizedAnalysisRoles: string[]; // e.g. ["PRIMARY", "SECONDARY"]
  signoffRole: string; // e.g. "計畫主持人 / 統計分析負責人"
  status: "AUTHORIZED" | "IN_PROGRESS" | "COMPLETED";
};

// -------------------------------------------------------------
// §9 Analysis Run Ledger & Compute Provenance
// -------------------------------------------------------------
export type StatisticalEngineType = "DETERMINISTIC_ENGINE_V1" | "SCIPY_STATSMODELS_ADAPTER";

export type AnalysisRun = {
  runId: string;
  parentRunId?: string;
  targetRqRef: string;
  methodName: string; // e.g. "Two-Sample Welch t-test", "ANCOVA Linear Model"
  engineType: StatisticalEngineType;
  inputDatasetHash: string;
  analyzedSampleN: number;
  degreesOfFreedom: number;
  testStatisticValue: number; // e.g. t, F
  pValueRaw: number;
  pValueAdjusted?: number;
  confidenceInterval: [number, number]; // e.g. [lower, upper]
  confidenceLevel: number; // 0.95
  effectSizeEstimate: number; // Cohen's d or Partial Eta Squared
  effectSizeMetric: "COHENS_D" | "PARTIAL_ETA_SQUARED" | "UNSTANDARDIZED_DIFF";
  runStatus: "COMPUTED" | "VALIDATED" | "NOT_ESTIMABLE";
  executionTimestamp: string;
};

// -------------------------------------------------------------
// §20 Immutable Result Facts Layer
// -------------------------------------------------------------
export type ResultFactValueType = "NUMERIC_FLOAT" | "NUMERIC_INTEGER" | "CONFIDENCE_INTERVAL" | "TEXT_STATUS";

export type ResultFact = {
  factId: string; // e.g. "fact_ate_cohens_d", "fact_t1_diff_p_val"
  targetRqRef: string;
  runIdRef: string;
  metricLabel: string;
  valueType: ResultFactValueType;
  primaryNumericValue: number | null;
  intervalBounds?: [number, number];
  formattedDisplayText: string; // e.g. "d = 0.584, 95% CI [0.125, 1.043], p = .014"
  measurementUnit: string;
  isStatisticallySignificant: boolean;
  factHashSha256: string; // Immutable cryptographic seal!
  isImmutable: boolean;
};

export type ResultRecord = {
  resultId: string;
  targetRqRef: string;
  primaryHypothesisRef: string; // e.g. "H1"
  estimandSummary: string;
  inferenceConclusion: "SUPPORTED_WITH_LIMITATIONS" | "NOT_SUPPORTED_NON_SIGNIFICANT" | "INCONCLUSIVE";
  scientificRationale: string;
  associatedFactIds: string[];
  reviewDecision: "VALIDATED" | "NEEDS_SENSITIVITY_CHECK";
};

// -------------------------------------------------------------
// §21 Publication Table & Figure Studio
// -------------------------------------------------------------
export type TableCellBinding = {
  rowKey: string;
  columnKey: string;
  cellText: string;
  boundFactId?: string;
};

export type PublicationTable = {
  tableId: string;
  tableNumber: string; // e.g. "Table 1", "Table 2"
  titleZh: string;
  titleEn: string;
  tableHeaders: string[];
  cells: TableCellBinding[];
  notes: string;
  sourceDatasetVersion: string;
};

export type PublicationFigure = {
  figureId: string;
  figureNumber: string; // e.g. "Figure 1", "Figure 2"
  titleZh: string;
  titleEn: string;
  plotType: "INTERACTION_PLOT_WITH_CI" | "BAR_DIFFERENCE_WITH_ERROR_BAR" | "SAMPLE_DISTRIBUTION_BOX";
  dataPoints: Array<{ label: string; meanValue: number; ciLower: number; ciUpper: number }>;
  associatedFactIds: string[];
  figureExportPathSvg: string;
  figureExportPathPng: string;
  renderEngine: "DATA_DRIVEN_SVG_RENDERER_V1"; // NOT AI generative fake plots!
};

// -------------------------------------------------------------
// §22 Old Mike Result Interpretation
// -------------------------------------------------------------
export type ScientificInterpretationCard = {
  cardId: string;
  targetRqRef: string;
  plainLanguageSummary: string;
  statisticalInterpretation: string;
  causalBoundaryWarning: string;
  practicalSignificanceNotes: string;
  nextOperationalRecommendations: string[];
};

// -------------------------------------------------------------
// §4 & §27 Complete Analysis Execution Workspace
// -------------------------------------------------------------
export type AnalysisExecutionWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceDataGovernanceSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;
  operationalMode: AnalysisExecutionMode;

  workOrder: AnalysisWorkOrder;
  analysisRuns: AnalysisRun[];
  resultFacts: ResultFact[];
  resultRecords: ResultRecord[];
  publicationTables: PublicationTable[];
  publicationFigures: PublicationFigure[];
  interpretationCards: ScientificInterpretationCard[];

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "ANALYSIS_RESULTS_READY_FOR_MANUSCRIPT" | "ANALYSIS_RESULTS_VALIDATED_AND_RELEASED" | "ANALYSIS_EXECUTION_AUTHORIZED";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §29 AnalysisResultsSnapshot (Immutable handoff to Stage 15)
// -------------------------------------------------------------
export type AnalysisResultsSnapshot = {
  snapshotId: string; // e.g. "arsnap_<uuid>"
  schemaVersion: "analysis-results/1.0.0";
  stageKey: "V3-U14";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "analysis-execution";
  nextStageId: "results-writing"; // Stage 15: 研究結果整合與證據驅動全文寫作
  sourceDataGovernanceSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  resultsRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    executionMode: AnalysisExecutionMode;
  };

  // Dataset provenance
  sourceDatasetVersion: string;
  sourceDatasetContentHashSha256: string;

  // Facts & Results manifests
  resultRecordRefs: string[];
  immutableResultFactManifestRef: string[];
  totalResultFactsCount: number;

  // Publication displays
  tableRefs: string[];
  figureRefs: string[];

  // Methodological integrity & Multiplicity
  isMultiplicityCorrected: boolean;
  hasNonSignificantOutcomesReportedHonesty: boolean;

  // Scope accounting (spec §3 / §14): unperformed analyses & reasons
  unperformedAnalysisReasons: string[];

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
