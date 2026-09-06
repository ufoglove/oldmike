/**
 * Pilot, Instrument Pretest & Protocol Validation Contract (V3-U11-FULL)
 * Spec: docs/stage11/spec-v3-4.0.md §1, §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §17, §21, §22, §25
 *
 * Implements:
 * 1. Intake of Stage 10 InstrumentProtocolSnapshot (zero re-entry)
 * 2. Strict Data Tiering (SYNTHETIC_TEST, INTERNAL_DRY_RUN, COGNITIVE_PRETEST, PILOT_RESEARCH_DATA, FORMAL_RESEARCH_DATA)
 * 3. PilotReadinessAssessment & PilotExecutionPermission (Human vs Non-human isolation)
 * 4. Multi-modal Pilot modules:
 *    - CognitiveInterviewRecord (item comprehension & response mapping)
 *    - RaterCalibrationRun (deterministic Cohen's Kappa / agreement calculation)
 *    - TechnicalPilotRecord & AIResearchSystemValidation (latency, packet loss, sync)
 *    - ProtocolDryRun & PilotProtocolDeviation (step duration, feasibility)
 * 5. Pilot Data Quality Dashboard & PilotRevisionProposal (ETHICS_AMENDMENT_MAY_BE_REQUIRED)
 * 6. FormalStudyReadinessAssessment (does not automatically pass on pilot completion)
 * 7. PilotValidationSnapshot immutable handoff contract for Stage 12 (formal-execution)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type InstrumentProtocolSnapshot } from "./instrument-protocol-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const PILOT_VALIDATION_CONTRACT_VERSION = "pilot-validation/1.0.0" as const;

// -------------------------------------------------------------
// §3 Strict Data Tiering
// -------------------------------------------------------------
export const RESEARCH_DATA_TIERS = [
  "SYNTHETIC_TEST",           // 沙盒合成測試資料
  "INTERNAL_DRY_RUN",        // 研究團隊內部流程預演資料
  "COGNITIVE_PRETEST",        // 認知訪談題目理解性紀錄
  "PILOT_RESEARCH_DATA",      // 小型受控 Pilot 實地資料 (標記 PILOT_DIAGNOSTIC)
  "FORMAL_RESEARCH_DATA",     // 正式研究試驗資料 (Stage 12 專屬)
] as const;
export type ResearchDataTier = (typeof RESEARCH_DATA_TIERS)[number];

// -------------------------------------------------------------
// §4 & §21 Pilot Readiness & Execution Permission
// -------------------------------------------------------------
export type PilotReadinessStatus =
  | "READY_FOR_INTERNAL_DRY_RUN"
  | "READY_FOR_HUMAN_PILOT"
  | "CONDITIONALLY_READY"
  | "BLOCKED";

export type PilotExecutionPermissionType =
  | "INTERNAL_NON_HUMAN"
  | "HUMAN_PILOT"
  | "TECHNICAL_SYSTEM_ONLY";

export type PilotExecutionPermissionStatus =
  | "ALLOWED"
  | "BLOCKED"
  | "PENDING_INSTITUTIONAL_CONFIRMATION"
  | "PENDING_RIGHTS"
  | "PENDING_SITE_ACCESS";

export type PilotExecutionPermission = {
  permissionType: PilotExecutionPermissionType;
  status: PilotExecutionPermissionStatus;
  conditions: string[];
  authorizedRoles: string[];
  verifiedProofNotes: string;
};

export type PilotReadinessAssessment = {
  readinessStatus: PilotReadinessStatus;
  isInstrumentVersionLocked: boolean;
  isProtocolVersionLocked: boolean;
  isScoringSpecExecutable: boolean;
  isDataCaptureSchemaReady: boolean;
  isRightsScopePermitted: boolean;
  isHumanEthicsSatisfied: boolean;
  isRiskMitigationInPlace: boolean;
  stopCriteriaDefined: boolean;
  blockers: string[];
  assessedAt: string;
};

// -------------------------------------------------------------
// §5 Pilot Plan
// -------------------------------------------------------------
export type PilotKind =
  | "INTERNAL_DRY_RUN"
  | "COGNITIVE_PRETEST"
  | "SMALL_SCALE_PILOT"
  | "TECHNICAL_PILOT"
  | "RATER_CALIBRATION"
  | "DATA_PIPELINE_PILOT";

export type PilotPlan = {
  pilotId: string;
  pilotTitle: string;
  pilotKind: PilotKind;
  purpose: string;
  targetComponents: string[];
  plannedN: number; // Planned N != Actual N!
  actualN?: number;
  samplingRationale: string;
  inclusionExclusion: string;
  environment: string;
  durationMinutes: number;
  dataTier: ResearchDataTier;
  successCriteria: string[];
  stopCriteria: string[];
  adverseEventActionPlan: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "HALTED";
};

// -------------------------------------------------------------
// §7 Cognitive Interview / Comprehension Check
// -------------------------------------------------------------
export type CognitiveInterviewRecord = {
  interviewId: string;
  targetInstrumentVersionId: string;
  targetItemId: string;
  participantProfile: string; // Anonymous, e.g. "三年級工程系修課學生 P1"
  comprehensionIssue: string;
  interpretationVariance: string;
  retrievalOrRecallIssue?: string;
  judgmentIssue?: string;
  responseMappingIssue?: string;
  suggestedRevision: string;
  severity: "MINOR" | "MODERATE" | "SEVERE";
  actionTaken: "ITEM_REVISED" | "INSTRUCTION_CLARIFIED" | "RETAINED_AS_IS";
};

// -------------------------------------------------------------
// §8 Rater Calibration & Inter-rater Agreement
// -------------------------------------------------------------
export type RaterCalibrationRun = {
  calibrationId: string;
  rubricVersionRef: string;
  ratersCount: number;
  calibrationCasesCount: number;
  agreementMetric: "COHENS_KAPPA" | "PERCENT_AGREEMENT";
  calculatedAgreementValue: number; // Real calculation, never AI hallucinated!
  disagreementsSummary: string;
  adjudicationRule: string;
  isCalibrationAcceptable: boolean; // e.g. Kappa >= 0.70
  revisionNeeded: boolean;
};

// -------------------------------------------------------------
// §9 & §10 Technical Pilot & AI System Validation
// -------------------------------------------------------------
export type TechnicalPilotRecord = {
  techRecordId: string;
  deviceOrModuleName: string;
  samplingFrequencyHz: number;
  averageInferenceLatencyMs: number;
  packetLossRate: number; // e.g. 0.01 (1%)
  sensorDriftObserved: boolean;
  timeSyncAccuracyMs: number;
  loggingCompletenessRate: number; // e.g. 0.99
  localFallbackAvailable: boolean;
  technicalStatus: "TECHNICAL_OK" | "TECHNICAL_REVISION_REQUIRED";
  diagnosticsNotes: string;
};

export type AIResearchSystemValidation = {
  aiValidationId: string;
  modelIdentifier: string;
  promptVersion: string;
  isDeterministicSeedSet: boolean;
  leakageRiskProtected: boolean;
  thirdPartyDataRetentionClosed: boolean;
  humanOverrideMechanismActive: boolean;
  status: "VALIDATED_FOR_PILOT" | "REVALIDATION_REQUIRED";
};

// -------------------------------------------------------------
// §11 & §12 Protocol Dry Run & Deviation Log
// -------------------------------------------------------------
export type ProtocolDryRunStep = {
  stepId: string;
  stepName: string; // e.g. "入組與知情同意", "VR 體驗第一階段 (20m)", "防動暈休息 (10m)"
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  deviationObserved: boolean;
  issuesNotes?: string;
};

export type ProtocolDryRun = {
  dryRunId: string;
  protocolVersionRef: string;
  steps: ProtocolDryRunStep[];
  totalPlannedDuration: number;
  totalActualDuration: number;
  adverseEventOccurred: boolean;
  dryRunOutcome: "PROTOCOL_FEASIBLE" | "PROTOCOL_DEVIATION_HIGH";
};

export type PilotProtocolDeviation = {
  deviationId: string;
  protocolStep: string;
  expectedBehavior: string;
  actualBehavior: string;
  rootCause: string;
  safetyImpact: "NONE" | "POTENTIAL_RISK" | "ADVERSE_TRIGGER";
  dataImpact: "NONE" | "PARTIAL_MISSING" | "INVALIDATED";
  correctiveAction: string;
};

// -------------------------------------------------------------
// §13 & §15 Quality Dashboard & Revision Impact Analysis
// -------------------------------------------------------------
export type PilotDataQualityMetric = {
  metricId: string;
  metricLabel: string;
  value: string;
  diagnosticNote: string;
  dataTier: "PILOT_DIAGNOSTIC";
};

export type PilotRevisionProposal = {
  proposalId: string;
  affectedEntity: "INSTRUMENT" | "MATERIAL" | "PROTOCOL" | "SCORING" | "DATA_SCHEMA";
  currentVersion: string;
  proposedChange: string;
  scientificImpact: string;
  participantImpact: string;
  ethicsImpact: "NO_ETHICS_CHANGE" | "ETHICS_AMENDMENT_MAY_BE_REQUIRED";
  requiresReapproval: boolean;
  status: "PROPOSED" | "ADOPTED_IN_NEXT_VERSION" | "REJECTED";
};

// -------------------------------------------------------------
// §22 Formal Study Readiness Assessment
// -------------------------------------------------------------
export type FormalStudyReadinessAssessment = {
  readinessStatus: "READY_FOR_FORMAL_EXECUTION" | "CONDITIONALLY_READY" | "BLOCKED";
  isPilotValidationComplete: boolean;
  areCriticalDeviationsResolved: boolean;
  isFormalEthicsApprovalVerified: boolean;
  isDataCapturePipelineTested: boolean;
  pendingPrerequisites: string[];
  assessedAt: string;
};

// -------------------------------------------------------------
// §4 & §27 Complete Pilot Validation Workspace
// -------------------------------------------------------------
export type PilotValidationWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceInstrumentSnapshotId: string;
  sourceStage09SnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Readiness & Permissions
  pilotReadiness: PilotReadinessAssessment;
  executionPermissions: PilotExecutionPermission[];

  // Plans & Runs
  pilotPlans: PilotPlan[];
  cognitiveInterviews: CognitiveInterviewRecord[];
  raterCalibrations: RaterCalibrationRun[];
  technicalPilots: TechnicalPilotRecord[];
  aiValidation?: AIResearchSystemValidation;
  protocolDryRuns: ProtocolDryRun[];
  protocolDeviations: PilotProtocolDeviation[];

  // Quality Dashboard & Revisions
  qualityMetrics: PilotDataQualityMetric[];
  revisionProposals: PilotRevisionProposal[];

  // Formal Study Readiness
  formalStudyReadiness: FormalStudyReadinessAssessment;

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "PILOT_VALIDATION_COMPLETE" | "PILOT_CONDITIONALLY_COMPLETE" | "PILOT_REVISION_REQUIRED";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §25 PilotValidationSnapshot (Immutable handoff to Stage 12)
// -------------------------------------------------------------
export type PilotValidationSnapshot = {
  snapshotId: string; // e.g. "pvsnap_<uuid>"
  schemaVersion: "pilot-validation/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "pilot-validation";
  nextStageId: "formal-execution"; // Stage 12: 正式研究執行與資料蒐集
  sourceInstrumentSnapshotId: string;
  sourceStage09SnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  pilotRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    pilotRunsCount: number;
  };

  // References & Identifiers
  testedInstrumentVersionRefs: string[];
  testedProtocolVersionRefs: string[];
  technicalPilotRefs: string[];
  revisionProposalRefs: string[];

  // Pilot Findings & Readiness Conclusions
  isProtocolFeasibleConfirmed: boolean;
  raterKappaAchieved: number;
  averageInferenceLatencyMs: number;
  formalExecutionReadinessStatus: string;

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
