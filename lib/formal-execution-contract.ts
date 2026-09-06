/**
 * Formal Research Execution & Data Collection Contract (V3-U12-FULL)
 * Spec: docs/stage12/spec-v3-4.0.md §1, §2, §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §17, §18, §19, §20, §21, §22, §28, §30
 *
 * Implements:
 * 1. Intake of Stage 11 PilotValidationSnapshot (zero re-entry)
 * 2. FormalExecutionGate & ExecutionAuthorization (Human vs Non-human, strict ethics verification)
 * 3. IdentityMappingVault (Strict PII isolation, never sent to LLM or analysis dataset)
 * 4. StudyUnit & Recruitment / Enrollment / Eligibility / Consent tracking
 * 5. StudySession & ProtocolFidelityRecord (Planned, Started, Completed, Deviations)
 * 6. FormalDataCaptureService & Immutable RawDataRecord / RawDataObject (append-only, checksums)
 * 7. ProtocolDeviation, SafetyEvent & Hardware / AI System Provenance tracking
 * 8. StudyOperationsDashboard & ExecutionQualityCheck (QA)
 * 9. FormalExecutionSnapshot immutable handoff contract for Stage 13 (data-governance)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type PilotValidationSnapshot } from "./pilot-validation-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const FORMAL_EXECUTION_CONTRACT_VERSION = "formal-execution/1.0.0" as const;

// -------------------------------------------------------------
// §2 & §3 Formal Execution Gate & Authorization
// -------------------------------------------------------------
export type FormalExecutionGateStatus =
  | "NOT_READY"
  | "CONDITIONALLY_READY"
  | "READY"
  | "PAUSED"
  | "STOPPED";

export type ExecutionType =
  | "FORMAL_HUMAN_RESEARCH"
  | "FORMAL_NON_HUMAN_RESEARCH"
  | "FORMAL_SECONDARY_DATA"
  | "FORMAL_TECHNICAL_EXPERIMENT"
  | "FORMAL_COURSE_RESEARCH";

export type ExecutionAuthorization = {
  authorizationId: string;
  projectId: string;
  executionType: ExecutionType;
  authorizedProtocolVersion: string;
  authorizedInstrumentVersions: string[];
  authorizedSite: string;
  authorizedPopulation: string;
  authorizedDateRange: [string, string];
  authorizedBy: string; // e.g. "校內研究倫理委員會核准函文號 REC-115-089"
  basis: string;
  status: "AUTHORIZED" | "PROVISIONAL" | "BLOCKED" | "REVOKED";
  restrictions: string[];
  sourceRefs: string[];
};

export type FormalExecutionGate = {
  gateStatus: FormalExecutionGateStatus;
  isFormalStudyReadinessPassed: boolean;
  isInstitutionalEthicsVerified: boolean;
  isProtocolVersionMatched: boolean;
  isConsentMaterialsReady: boolean;
  isDataCaptureConfigured: boolean;
  isSiteReadinessConfirmed: boolean;
  activeBlockers: string[];
  assessedAt: string;
};

// -------------------------------------------------------------
// §5 & §6 Study Unit & Identity Mapping Vault (PII Separation)
// -------------------------------------------------------------
export type StudyUnitType =
  | "HUMAN_PARTICIPANT"
  | "STUDENT"
  | "EMPLOYEE"
  | "CLASS_SECTION"
  | "TECHNICAL_DEVICE"
  | "MACHINE_PROCESS_RUN"
  | "SECONDARY_DATASET";

export type StudyUnit = {
  studyUnitId: string;
  projectId: string;
  unitType: StudyUnitType;
  pseudonymousId: string; // e.g. "P-001", "P-002" (Never direct PII!)
  enrollmentStatus: "IDENTIFIED" | "ELIGIBLE" | "ENROLLED" | "COMPLETED" | "WITHDRAWN";
  eligibilityStatus: "MET" | "NOT_MET" | "UNKNOWN";
  enrolledAt: string;
  withdrawnAt?: string;
  withdrawalReasonCode?: string;
  siteId: string;
  armId: string; // e.g. "ARM-01" (AI 引導組) vs "ARM-02" (主動對照組)
  sourceSystem: string;
};

export type IdentityMappingRecord = {
  pseudonymousId: string;
  encryptedRealIdentityHash: string; // Stored only in vault, inaccessible to general LLM
  vaultStorageLocation: string;
  accessAuditedAt: string;
};

// -------------------------------------------------------------
// §7, §8 & §9 Recruitment, Eligibility & Consent
// -------------------------------------------------------------
export type RecruitmentStatus =
  | "IDENTIFIED"
  | "CONTACTED"
  | "SCREENING"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "INVITED"
  | "DECLINED"
  | "ENROLLED"
  | "WITHDRAWN";

export type RecruitmentRecord = {
  recruitmentId: string;
  studyUnitPseudonym: string;
  recruitmentSource: string; // e.g. "合作產學工會推介"
  recruitmentMaterialVersion: string;
  contactChannel: string;
  contactedAt: string;
  status: RecruitmentStatus;
  exclusionReasonCode?: string;
  isGradingSeparationAffirmed?: boolean; // Required for education/student studies
};

export type EligibilityAssessment = {
  assessmentId: string;
  studyUnitPseudonym: string;
  criteriaEvaluations: Array<{ criterionId: string; status: "MET" | "NOT_MET" | "UNKNOWN" }>;
  overallEligibility: "ELIGIBLE" | "INELIGIBLE" | "UNKNOWN";
  assessedBy: string;
  assessedAt: string;
};

export type ConsentRecord = {
  consentId: string;
  studyUnitPseudonym: string;
  consentType: "WRITTEN_INFORMED_CONSENT" | "STUDENT_ASSENT_WITH_PARENT" | "EXEMPTION_CONFIRMED";
  documentVersion: string;
  language: "ZH_TW" | "EN";
  presentedAt: string;
  signedAt?: string; // Stored only if verified real signed document exists
  status: "PENDING" | "CONSENTED" | "DECLINED" | "WITHDRAWN";
  sourceFileRef?: string;
  consentedOptionalComponents: string[]; // e.g. ["LONGITUDINAL_FOLLOW_UP", "EYE_LOG_DATA_SHARE"]
};

// -------------------------------------------------------------
// §10, §11 & §12 Sessions, Fidelity & Protocol Deviations
// -------------------------------------------------------------
export type SessionType =
  | "PRE_TEST"
  | "INTERVENTION_UNIT"
  | "POST_TEST"
  | "FOLLOW_UP_RETENTION"
  | "TECHNICAL_CALIBRATION";

export type StudySession = {
  sessionId: string;
  studyUnitPseudonym: string;
  sessionType: SessionType;
  protocolVersion: string;
  instrumentVersions: string[];
  scheduledAt: string;
  startedAt: string;
  endedAt: string;
  status: "PLANNED" | "STARTED" | "COMPLETED" | "PARTIAL" | "MISSED" | "CANCELLED";
  operator: string;
  site: string;
  armId: string;
  deviceConfig: string;
  deviationsRecorded: boolean;
  notes: string;
};

export type ProtocolFidelityRecord = {
  fidelityId: string;
  sessionId: string;
  intendedInterventionDoseMinutes: number;
  deliveredInterventionDoseMinutes: number;
  adherenceRate: number; // e.g. delivered / intended
  breakProtocolObserved: boolean; // Must observe 10m break after 20m VR!
  fidelityStatus: "COMPLETE" | "MINOR_DEVIATION" | "MAJOR_DEVIATION";
  evaluator: string;
};

export type ProtocolDeviation = {
  deviationId: string;
  sessionId: string;
  protocolVersion: string;
  category: "VISIT_WINDOW" | "DEVICE_CALIBRATION_DELAY" | "UNPLANNED_BREAK" | "INCOMPLETE_MEASURE";
  description: string;
  occurredAt: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  impact: string;
  correctiveAction: string;
  requiresEthicsNotification: boolean;
  status: "LOGGED" | "RESOLVED" | "FLAGGED_FOR_AUDIT";
};

// -------------------------------------------------------------
// §13 Safety Events / Adverse Events
// -------------------------------------------------------------
export type SafetyEvent = {
  safetyEventId: string;
  studyUnitPseudonym: string;
  eventType: "VR_SIMULATOR_SICKNESS_DIZZINESS" | "PHYSICAL_TRIP_SLIP" | "PSYCHOLOGICAL_DISTRESS" | "NONE";
  severity: "MILD" | "MODERATE" | "SEVERE";
  relatedness: "RELATED_TO_INTERVENTION" | "PROBABLE" | "UNLIKELY" | "NOT_RELATED";
  onsetTimestamp: string;
  resolutionTimestamp?: string;
  actionTaken: string; // e.g. "立即中止 VR 配戴，引導至舒緩休息區靜坐 15 分鐘，症狀完全緩解"
  isReportedToRec: boolean;
  status: "RESOLVED" | "UNDER_OBSERVATION";
};

// -------------------------------------------------------------
// §14 & §15 Formal Data Capture & Immutable Raw Data Layer
// -------------------------------------------------------------
export type RawDataRecord = {
  recordId: string;
  projectId: string;
  studyUnitPseudonym: string;
  sessionId: string;
  variableCode: string; // e.g. "RT_MS_T0", "NASA_TLX_TOTAL_T1"
  rawStringValue: string; // String representation of original acquisition value
  unit: string; // e.g. "ms", "score"
  sourceType: "DEVICE_SENSOR_LOG" | "MANUAL_SURVEY_FORM" | "RUBRIC_ASSESSMENT";
  sourceId: string;
  capturedAt: string;
  receivedAt: string;
  schemaVersion: string;
  checksumSha256: string; // Immutable data integrity seal!
  qualityFlag: "RAW_VALID" | "OUTLIER_FLAGGED" | "DEVICE_TIMESTAMP_SUSPECT";
};

export type DataCorrectionRecord = {
  correctionId: string;
  targetRawRecordId: string;
  originalValue: string;
  proposedCorrectedValue: string;
  reason: string;
  authorizedBy: string;
  timestamp: string;
};

// -------------------------------------------------------------
// §17 Hardware Sensor & AI Provenance
// -------------------------------------------------------------
export type HardwareAndAIProvenance = {
  provenanceId: string;
  deviceModel: string; // e.g. "HTC Vive Pro Eye"
  firmwareVersion: string;
  samplingRateHz: number; // 90 Hz
  timeSyncAccuracyMs: number; // 2.1 ms
  clockSyncProtocol: "NTP_LOCAL_SUBNET";
  aiModelProvider: string; // "deepseek-v4-pro-0813"
  aiPromptVersion: string;
  aiInferenceConfig: {
    temperature: number;
    seed: number;
    maxTokens: number;
  };
  modelVersionChangedDuringStudy: boolean; // Flagged if changed mid-study!
};

// -------------------------------------------------------------
// §4 & §22 Study Operations Dashboard & Execution Quality Check
// -------------------------------------------------------------
export type StudyOperationsMetrics = {
  targetPlannedN: number;
  enrolledN: number;
  completedN: number;
  withdrawnN: number;
  totalSessionsCompleted: number;
  totalRawDataRecordsCaptured: number;
  openDeviationsCount: number;
  openSafetyEventsCount: number;
  dataSyncErrorCount: number;
  formalExecutionStatus: "ACTIVE_DATA_COLLECTION" | "COLLECTION_PAUSED" | "DATA_COLLECTION_COMPLETE";
};

export type ExecutionQualityCheck = {
  checkId: string;
  ruleCode: string;
  status: "PASS" | "WARNING" | "FAIL";
  description: string;
  remedyAction?: string;
};

// -------------------------------------------------------------
// §4 & §28 Complete Formal Execution Workspace
// -------------------------------------------------------------
export type FormalExecutionWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourcePilotSnapshotId: string;
  sourceInstrumentSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Gate & Authorization
  formalExecutionGate: FormalExecutionGate;
  executionAuthorization: ExecutionAuthorization;

  // Operations Dashboard
  operationsMetrics: StudyOperationsMetrics;
  qualityChecks: ExecutionQualityCheck[];

  // Participants & Identity Vault Reference
  studyUnits: StudyUnit[];
  recruitmentRecords: RecruitmentRecord[];
  eligibilityAssessments: EligibilityAssessment[];
  consentRecords: ConsentRecord[];
  identityVaultRef: string; // Stored securely in separate vault!

  // Sessions, Fidelity, Deviations & Safety
  studySessions: StudySession[];
  fidelityRecords: ProtocolFidelityRecord[];
  protocolDeviations: ProtocolDeviation[];
  safetyEvents: SafetyEvent[];

  // Immutable Raw Data Layer
  rawDataRecords: RawDataRecord[];
  dataCorrections: DataCorrectionRecord[];
  provenanceInfo: HardwareAndAIProvenance;

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "FORMAL_DATA_COLLECTION_ACTIVE" | "FORMAL_DATA_COLLECTION_COMPLETE" | "EXECUTION_BLOCKED";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §30 FormalExecutionSnapshot (Immutable handoff to Stage 13)
// -------------------------------------------------------------
export type FormalExecutionSnapshot = {
  snapshotId: string; // e.g. "fesnap_<uuid>"
  schemaVersion: "formal-execution/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "formal-execution";
  nextStageId: "data-governance"; // Stage 13: 資料治理、清理與 Analysis Dataset
  sourcePilotSnapshotId: string;
  sourceInstrumentSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  executionRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    authorizedExecutionType: ExecutionType;
  };

  // Participant & Enrollment Summary
  targetPlannedN: number;
  enrolledTotalN: number;
  completedTotalN: number;
  withdrawnTotalN: number;

  // Execution & Raw Data Manifest
  totalSessionsCompleted: number;
  totalRawRecordsCaptured: number;
  rawDataManifestChecksumSha256: string;
  identityVaultRef: string; // Vault reference only, NEVER PII!

  // Deviations & Safety Summary
  totalDeviationsCount: number;
  totalSafetyEventsCount: number;
  hasUnresolvedCriticalSafety: boolean;

  // Provenance & Hardware
  hardwareAndAIProvenanceRef: string;

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
