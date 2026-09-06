/**
 * Instruments, Scales, Materials & Study Protocol Contract (V3-U10-FULL)
 * Spec: docs/stage10/spec-v3-4.0.md §2, §3, §5, §6, §7, §9, §10, §11, §12, §13, §14, §15, §16, §17, §18, §21, §24
 *
 * Implements:
 * 1. Intake of Stage 9 Stage09HandoffSnapshot (zero re-entry)
 * 2. InstrumentDefinition, InstrumentVersion & ProjectInstrumentUse separation
 * 3. PermissionRecord & TranslationAdaptationPlan (strict permissions, no fake validation)
 * 4. Measurement Requirement Map & Multi-modal instrument support:
 *    - VR Eye-tracking & Log specifications
 *    - NASA-TLX Scale metadata
 *    - Skill performance Rubrics (for MOE TPR)
 *    - SOP / Intervention Materials & Schedule of Activities
 * 5. Deterministic Sandbox Scoring Engine Contract (missing-first, safe reversal, no eval)
 * 6. Study Protocol Assembly Baseline
 * 7. InstrumentProtocolSnapshot immutable handoff contract for Stage 11 (pilot-validation)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type Stage09HandoffSnapshot } from "./route-review-compliance-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const INSTRUMENT_PROTOCOL_CONTRACT_VERSION = "instrument-protocol/1.0.0" as const;

// -------------------------------------------------------------
// §5 Instrument Definition & Versioning
// -------------------------------------------------------------
export type InstrumentCategory =
  | "STANDARDIZED_PSYCHOMETRIC_SCALE"
  | "CUSTOM_SURVEY_OR_TEST"
  | "PERFORMANCE_RUBRIC"
  | "QUALITATIVE_INTERVIEW_GUIDE"
  | "SENSOR_AND_SYSTEM_LOG"
  | "AI_EVALUATION_SPEC"
  | "SECONDARY_DATA_EXTRACTION";

export type InstrumentDefinition = {
  instrumentDefId: string;
  canonicalName: string;
  constructRef: string;
  originalAuthors: string[];
  originalYear?: number;
  category: InstrumentCategory;
  primaryLiteratureRef?: string;
  description: string;
};

export type InstrumentVersion = {
  versionId: string;
  instrumentDefId: string;
  versionLabel: string; // e.g. "Chinese Revised 6-item", "v1.0 Millisecond Eye-log"
  language: "ZH_TW" | "EN" | "MULTILINGUAL";
  administrationMode: "DIGITAL_VR_LOG" | "PAPER_OR_ONLINE_FORM" | "OBSERVATION_RUBRIC";
  totalItemCount: number;
  responseFormat: string; // e.g. "1-5 Likert", "Continuous Milliseconds", "4-Level Rubric"
  isNewlyDevelopedDraft: boolean;
  scoringSpecificationRef?: string;
  validationStatus: "SOURCE_REPORTED_ONLY" | "NEWLY_DEVELOPED_DRAFT" | "READY_FOR_PILOT_VALIDATION";
};

export type ProjectInstrumentUse = {
  usageId: string;
  projectId: string;
  versionId: string;
  targetRqRefs: string[];
  measurementRequirementRef: string;
  targetTimePointRefs: string[];
  selectionRationale: string;
  adaptationNotes?: string;
  isLocked: boolean;
};

// -------------------------------------------------------------
// §9 & §10 Permissions & Translation / Adaptation
// -------------------------------------------------------------
export type InstrumentActionPermission =
  | "VIEW_METADATA"
  | "VIEW_RESTRICTED_CONTENT"
  | "PRIVATE_PROCESSING"
  | "TRANSLATE"
  | "ADAPT"
  | "DIGITAL_ADMINISTRATION"
  | "PRINT_ADMINISTRATION"
  | "EXPORT_ITEMS";

export type PermissionRecord = {
  permissionId: string;
  versionId: string;
  rightsholder: string;
  licenseType: "PUBLIC_DOMAIN_OPEN" | "ACADEMIC_FREE_USE" | "COMMERCIAL_RESTRICTED" | "AUTHOR_PERMISSION_PENDING";
  permittedActions: InstrumentActionPermission[];
  verificationProofNotes: string;
  status: "VERIFIED_SCOPE" | "REQUEST_PENDING" | "RESTRICTED";
};

export type TranslationAdaptationPlan = {
  adaptationId: string;
  versionId: string;
  sourceLanguage: string;
  targetLanguage: string;
  adaptationStrategy: "EXPERT_TRANSLATION_WITH_CULTURAL_MODIFICATION" | "MACHINE_DRAFT_PENDING_EXPERT_REVIEW" | "ORIGINAL_UNTRANSLATED";
  cognitiveInterviewStatus: "NOT_STARTED_PENDING_STAGE_11";
  itemsMapping: Array<{
    sourceItemId: string;
    translatedItemText: string;
    culturalAdjustmentNotes: string;
  }>;
};

// -------------------------------------------------------------
// §13 & §14 Materials & Schedule of Activities
// -------------------------------------------------------------
export type ActivityScheduleItem = {
  activityId: string;
  studyComponentRef: string;
  purpose: string;
  timePointLabel: string; // e.g. "T0 (前測)", "第 4 週 (單元介入)", "T2 (延宕測量)"
  relativeTiming: string;
  targetArmRef: string;
  instrumentVersionRefs: string[];
  estimatedBurdenMinutes: number;
  assignedStaffRole: string;
  isLocked: boolean;
};

// -------------------------------------------------------------
// §15 Deterministic Sandbox Scoring Specification
// -------------------------------------------------------------
export type ScoringItemRule = {
  itemId: string;
  itemLabel: string;
  validRange: [number, number]; // e.g. [1, 5]
  isReverseScored: boolean; // if true: lower + upper - x
  missingCodes: number[]; // e.g. [99, -9]
};

export type ScoringSpecification = {
  specId: string;
  versionId: string;
  aggregationMethod: "SUM" | "MEAN" | "WEIGHTED_SUM" | "RUBRIC_SCORE_SUM";
  itemRules: ScoringItemRule[];
  minValidItemsRequired: number; // if answered items < min, output null (missing)
  scoreOutputRange: [number, number];
  cutOffPoints?: Array<{ label: string; minScore: number }>;
  interpretationRules: string[];
};

export type ScoringPreviewOutput = {
  calculationId: string;
  status: "COMPUTED" | "CALCULATION_INVALID_INPUT" | "UNSUPPORTED_SCORING_METHOD";
  transformedItemValues: Array<{ itemId: string; rawValue: any; scoredValue: number | null }>;
  totalScore: number | null;
  meanScore: number | null;
  missingItemCount: number;
  warnings: string[];
  executionTimestamp: string;
  testMode: "SYNTHETIC_INSTRUMENT_TEST"; // Never enters Raw Data or Result Facts
};

// -------------------------------------------------------------
// §16 Data Capture Schema (Variable Mapping)
// -------------------------------------------------------------
export type DataCaptureField = {
  fieldId: string;
  variableCode: string;
  labelZh: string;
  constructRef: string;
  rqRefs: string[];
  dataType: "CONTINUOUS_MILLISECOND" | "ORDINAL_LIKERT" | "RUBRIC_LEVEL" | "BOOLEAN_FLAG";
  sourceInstrumentVersionId: string;
  timePointLabel: string;
  validRange: string;
  missingPolicy: string;
  storageClassification: "DE_IDENTIFIED_ANALYSIS" | "CODING_KEY_ENCRYPTED";
};

// -------------------------------------------------------------
// §17 Study Protocol Assembly Baseline
// -------------------------------------------------------------
export type ProtocolSection = {
  sectionId: string;
  titleZh: string;
  purpose: string;
  contentDraft: string;
  linkedEvidenceIds: string[];
  isLocked: boolean;
};

export type StudyProtocolDocument = {
  protocolId: string;
  protocolTitle: string;
  versionLineage: string; // e.g. "v1.0-instrument-baseline"
  sections: ProtocolSection[];
  reportingProfileCandidate: string; // e.g. "CONSORT 2025 / SPIRIT 2025"
  ethicsVersionCoverage: string;
};

// -------------------------------------------------------------
// §4 & §26 Complete Instrument Protocol Workspace
// -------------------------------------------------------------
export type InstrumentProtocolWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceStage09SnapshotId: string;
  sourceRouteSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Instrument definitions & uses
  instrumentDefinitions: InstrumentDefinition[];
  instrumentVersions: InstrumentVersion[];
  projectInstrumentUses: ProjectInstrumentUse[];

  // Permissions & Adaptation
  permissionRecords: PermissionRecord[];
  adaptationPlans: TranslationAdaptationPlan[];

  // Procedures & Activities
  scheduleOfActivities: ActivityScheduleItem[];

  // Scoring & Sandbox
  scoringSpecifications: ScoringSpecification[];
  latestScoringPreview?: ScoringPreviewOutput;

  // Data Capture Schema
  dataCaptureFields: DataCaptureField[];

  // Protocol Document
  studyProtocol: StudyProtocolDocument;

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "INSTRUMENT_PROTOCOL_PLANNING_COMPLETE" | "INSTRUMENT_PROTOCOL_PLANNING_PROVISIONAL" | "PLANNING_REVISION_REQUIRED";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §24 InstrumentProtocolSnapshot (Immutable handoff to Stage 11)
// -------------------------------------------------------------
export type InstrumentProtocolSnapshot = {
  snapshotId: string; // e.g. "ipsnap_<uuid>"
  schemaVersion: "instrument-protocol/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "study-protocol";
  nextStageId: "pilot-validation"; // Stage 11: Pilot／工具預試與 Protocol 驗證
  sourceStage09SnapshotId: string;
  sourceRouteSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  protocolRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    primaryInstrumentCount: number;
  };

  // References & Identifiers
  rqRefs: string[];
  instrumentDefinitionRefs: string[];
  instrumentVersionRefs: string[];
  scoringSpecRefs: string[];
  dataCaptureFieldRefs: string[];

  // Pilot & Validation Needs (Handed off to Stage 11)
  pilotValidationNeeds: string[];
  pilotApplicabilityHints: string[];

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
