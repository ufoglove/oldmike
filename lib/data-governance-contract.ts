/**
 * Data Governance, Cleaning & Analysis Dataset Contract (V3-U13-FULL)
 * Spec: docs/stage13/spec-v3-4.0.md §1, §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §17, §18, §19, §24, §26
 *
 * Implements:
 * 1. Intake of Stage 12 FormalExecutionSnapshot (zero re-entry)
 * 2. Multi-tier data isolation:
 *    - Identity Vault: encrypted PII & real IDs (never sent to LLM/analysis)
 *    - Raw: append-only immutable original logs & surveys with SHA-256 seal
 *    - Staging/Quarantine: parsing, format verification & adjudication
 *    - Clean/Derived: verified clean records from approved rules & scoring
 *    - Analysis Dataset: cohort-filtered, analysis-ready release
 * 3. Canonical Data Dictionary & Source Field Mapping
 * 4. Deterministic Cleaning Pipeline (Missing-first, safe reversal, no arbitrary eval)
 * 5. Data Quality Report & Data Lineage (W3C PROV-O inspired)
 * 6. Educational research (MOE_TPR non-participant isolation) & AI Data Leakage prevention (fold-safe fit)
 * 7. DataGovernanceSnapshot immutable handoff contract for Stage 14 (analysis-execution)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type FormalExecutionSnapshot } from "./formal-execution-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const DATA_GOVERNANCE_CONTRACT_VERSION = "data-governance/1.0.0" as const;

// -------------------------------------------------------------
// §4 Governance Operational Modes
// -------------------------------------------------------------
export type GovernanceOperationalMode =
  | "PLANNING_ONLY"
  | "DEVELOPMENT_FIXTURE"
  | "STAGING_QA_DURING_COLLECTION"
  | "FORMAL_DATA_PREPARATION";

// -------------------------------------------------------------
// §5 Data Tiers & Storage Namespaces
// -------------------------------------------------------------
export type StorageNamespace =
  | "IDENTITY_VAULT"
  | "RAW_IMMUTABLE"
  | "STAGING_QUARANTINE"
  | "CLEAN_DERIVED"
  | "ANALYSIS_RELEASE"
  | "EXPORT_SHARING";

// -------------------------------------------------------------
// §7 Canonical Data Dictionary & Field Mapping
// -------------------------------------------------------------
export type DataVariableType =
  | "STRING_ID"
  | "INTEGER_COUNT"
  | "FLOAT_CONTINUOUS"
  | "ORDINAL_SCALE"
  | "NOMINAL_CATEGORY"
  | "BOOLEAN_FLAG"
  | "DATETIME_ISO";

export type MissingReasonCode =
  | "NOT_COLLECTED"
  | "DEVICE_FAILURE"
  | "SKIPPED_BY_DESIGN"
  | "NOT_APPLICABLE"
  | "REFUSED"
  | "LOST_TO_FOLLOWUP"
  | "INVALID_READING"
  | "BELOW_DETECTION_LIMIT"
  | "UNKNOWN";

export type CanonicalDataVariable = {
  variableId: string;
  canonicalName: string; // e.g. "RT_MS_T0", "NASA_TLX_SCORE_T1"
  labelZh: string;
  labelEn: string;
  targetRqRefs: string[];
  constructRef: string;
  variableType: DataVariableType;
  measurementUnit: string; // e.g. "ms", "score"
  scaleRange?: [number, number];
  sentinelMissingCodes: number[]; // e.g. [99, -9]
  privacyLevel: "DE_IDENTIFIED" | "RESTRICTED_METADATA" | "SENSITIVE_PROTECTED";
  roleInAnalysis: "PRIMARY_OUTCOME" | "SECONDARY_OUTCOME" | "BASELINE_COVARIATE" | "SUBGROUP_MODERATOR";
  timePointLabel: string;
};

export type SourceFieldMapping = {
  mappingId: string;
  targetVariableId: string;
  sourceFieldName: string;
  sourceInstrumentVersion: string;
  transformationType: "DIRECT_COPY" | "SAFE_REVERSE_CODING" | "UNIT_CONVERSION" | "DERIVED_AGGREGATION";
  conversionFormula?: string;
  localePreservationRules: string; // e.g. "Preserve leading zeros for IDs (0012); dot decimal separator"
  isApproved: boolean;
};

// -------------------------------------------------------------
// §8 Cleaning Rule Registry
// -------------------------------------------------------------
export type CleaningRuleType =
  | "MECHANICAL_NORMALIZATION"
  | "SOURCE_CORRECTION"
  | "MISSING_CODE_INTERCEPTION"
  | "SCORING_REVERSAL_DERIVATION"
  | "OUTLIER_FLAGGING"
  | "COHORT_INCLUSION_EXCLUSION";

export type CleaningRule = {
  ruleId: string;
  ruleType: CleaningRuleType;
  targetVariableId: string;
  description: string;
  executionStage: "STAGING_TO_CLEAN" | "CLEAN_TO_ANALYSIS";
  inputParameters: Record<string, any>;
  isPostDataDecision: boolean; // Flagged if established after viewing data!
  isApprovedByGovernance: boolean;
  isLocked: boolean;
};

// -------------------------------------------------------------
// §13 Clean & Derived Record Entity
// -------------------------------------------------------------
export type CleanRecord = {
  recordId: string;
  studyUnitPseudonym: string; // e.g. "P-001"
  variableId: string;
  numericValue: number | null;
  stringValue?: string;
  isMissing: boolean;
  missingReason?: MissingReasonCode;
  isOutlierFlagged: boolean;
  provenanceSourceRawId: string;
  lineageRunId: string;
  qualityStatus: "CLEAN_VALID" | "FLAGGED_RETAINED" | "EXCLUDED_BY_RULE";
};

// -------------------------------------------------------------
// §17 Analysis Scope & Analysis Dataset Release
// -------------------------------------------------------------
export type AnalysisScope = {
  scopeId: string;
  targetRqRef: string;
  analysisRole: "PRIMARY" | "SECONDARY" | "SENSITIVITY" | "EXPLORATORY";
  targetCohortName: string; // e.g. "Per-Protocol Complete T0-T1 Cohort"
  includedStudyUnitPseudonyms: string[];
  excludedStudyUnitPseudonyms: string[];
  requiredVariables: string[];
  missingDataHandlingObligation: string; // Passed to Stage 14!
  status: "LOCKED_FOR_ANALYSIS" | "DRAFT_SCOPE";
};

export type AnalysisDatasetRelease = {
  releaseId: string;
  releaseVersion: string; // e.g. "v1.0-formal-analysis"
  associatedScopeIds: string[];
  totalRecordsCount: number;
  totalUnitsCount: number;
  contentHashSha256: string;
  storagePath: string;
  isLocked: boolean;
  releasedAt: string;
  approvedByRole: string;
};

// -------------------------------------------------------------
// §19 Data Quality Report & Lineage
// -------------------------------------------------------------
export type DataQualitySummary = {
  totalRawRecordsCount: number;
  totalCleanRecordsCount: number;
  validValuesPercentage: number;
  missingValuesCount: number;
  outliersFlaggedCount: number;
  piiLeakageRiskDetected: boolean;
  foldSafeFitConfirmed: boolean;
  isDataPreparationDeterministicConfirmed: boolean;
  diagnosticsBadge: "DATA_PREPARATION_DIAGNOSTIC";
};

export type LineageEdge = {
  edgeId: string;
  derivedRecordId: string;
  sourceRawRecordId: string;
  ruleId: string;
  pipelineRunId: string;
  appliedTimestamp: string;
};

// -------------------------------------------------------------
// §24 Gate Readiness Statuses
// -------------------------------------------------------------
export type GovernanceGateStatus =
  | "DATA_GOVERNANCE_INPUT_AND_RULES_READY"
  | "CLEAN_DATASET_SCOPE_VALIDATED"
  | "ANALYSIS_DATASET_LOCKED_AND_HANDOFF_READY"
  | "REVALIDATION_REQUIRED"
  | "GOVERNANCE_BLOCKED";

// -------------------------------------------------------------
// §4 & §27 Complete Data Governance Workspace
// -------------------------------------------------------------
export type DataGovernanceWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceFormalExecutionSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;
  operationalMode: GovernanceOperationalMode;

  // Gate Status
  gateStatus: GovernanceGateStatus;

  // Semantics & Rules
  dataDictionary: CanonicalDataVariable[];
  sourceMappings: SourceFieldMapping[];
  cleaningRules: CleaningRule[];

  // Clean & Analysis Datasets
  cleanRecords: CleanRecord[];
  analysisScopes: AnalysisScope[];
  analysisRelease?: AnalysisDatasetRelease;

  // Lineage & Quality Report
  qualitySummary: DataQualitySummary;
  lineageEdges: LineageEdge[];

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "ANALYSIS_DATASET_LOCKED_AND_HANDOFF_READY" | "CLEAN_DATASET_SCOPE_VALIDATED" | "DATA_GOVERNANCE_INPUT_AND_RULES_READY";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §26 DataGovernanceSnapshot (Immutable handoff to Stage 14)
// -------------------------------------------------------------
export type DataGovernanceSnapshot = {
  snapshotId: string; // e.g. "dgsnap_<uuid>"
  schemaVersion: "data-governance/1.0.0";
  stageKey: "V3-U13";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "data-governance";
  nextStageId: "analysis-execution"; // Stage 14: 分析實驗室 Execution Mode、研究結果與圖表
  sourceFormalExecutionSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  governanceRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    operationalMode: GovernanceOperationalMode;
  };

  // Source & Freeze Checksums
  sourceScopeManifestHash: string;
  analysisDatasetVersion: string;
  analysisDatasetContentHashSha256: string;
  totalUnitsCount: number;
  totalAnalysisRecordsCount: number;

  // Quality & Diagnostic Summary
  dataQualitySummary: DataQualitySummary;

  // Analysis Scopes & Deferred Obligations (Passed to Stage 14)
  analysisScopeRefs: string[];
  deferredStatisticalProcessing: Array<{
    targetVariableId: string;
    plannedObligation: string; // e.g. "MULTIPLE_IMPUTATION_IN_STAGE_14", "LMM_MISSING_HANDLING"
    dueStage: "STAGE_14";
  }>;

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
