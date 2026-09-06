/**
 * Route Review, Compliance Preparation & Research Ethics Contract (V3-U09-FULL)
 * Spec: docs/stage09/spec-v3-4.0.md §1, §4, §5, §6, §7, §8, §9, §11, §12, §13, §14, §15, §16, §17, §23, §24, §26
 *
 * Implements:
 * 1. Intake of Stage 8 RouteWorkspaceSnapshot (zero re-entry)
 * 2. Tri-goal specific simulated reviewer engines:
 *    - JOURNAL: PRE_STUDY_JOURNAL_REVIEW & MANUSCRIPT_READINESS_REVIEW
 *    - NSTC_GENERAL: Discipline/Science, Methodology/Feasibility, PI/Resources
 *    - MOE_TPR: Pedagogical Problem, Intervention/Learning, Methods/Ethics/Teacher-Student Power
 * 3. OfficialRuleSnapshot & ComplianceMatrix (CURRENT_STAGE_REQUIRED vs LATER_STAGE_REQUIRED)
 * 4. Shared Research Ethics & IRB Center (Scope Screening, Institutional Decisions, Risk Register)
 * 5. Data Management Plan (DMP) & Preregistration Plan
 * 6. RevisionTask workflow (OPEN, IN_PROGRESS, RESOLVED)
 * 7. Stage09HandoffSnapshot immutable handoff contract for Stage 10 (study-protocol)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type RouteWorkspaceSnapshot } from "./route-studio-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const ROUTE_REVIEW_COMPLIANCE_CONTRACT_VERSION = "route-review-compliance/1.0.0" as const;

// -------------------------------------------------------------
// §5, §6, §7 Reviewer Finding Types & Roles
// -------------------------------------------------------------
export type ReviewerSeverity = "FATAL" | "MAJOR" | "MINOR" | "SUGGESTION";

export type ReviewerFinding = {
  findingId: string;
  sourceReviewerRole: string; // e.g. "Journal Scope Reviewer", "NSTC Scientific Discipline Reviewer", "MOE Pedagogical Reviewer"
  severity: ReviewerSeverity;
  ruleCode: string;
  targetSection: string;
  targetFieldRef?: string;
  issueDescription: string;
  scientificRationale: string;
  suggestedAction: string;
  suggestedRewriteCandidate?: string;
  isResolved: boolean;
  resolutionNote?: string;
};

// -------------------------------------------------------------
// §8 Official Rules & Compliance Matrix
// -------------------------------------------------------------
export type OfficialRuleType = "JOURNAL" | "NSTC_GENERAL" | "MOE_TPR" | "INSTITUTION_INTERNAL";

export type OfficialRuleItem = {
  ruleId: string;
  authority: string;
  targetYear: string;
  documentTitle: string;
  ruleType: OfficialRuleType;
  section: string;
  requirementDescription: string;
  sourceUrl: string;
  retrievedAt: string;
  effectiveDate: string;
  verificationStatus: "VERIFIED_CURRENT" | "VERIFIED_PREVIOUS_YEAR" | "PENDING_NEW_ANNOUNCEMENT" | "SOURCE_UNAVAILABLE" | "UNVERIFIED";
  appliesTo: string;
  currentProjectStatus: string;
  requiredAction: string;
};

export type ComplianceItem = {
  complianceId: string;
  projectId: string;
  route: string;
  targetYear: string;
  authority: string;
  requirement: string;
  status: "MET" | "PARTIAL" | "MISSING" | "NOT_APPLICABLE" | "AWAITING_OFFICIAL_RULE" | "UNVERIFIED";
  evidenceNotes: string;
  missingItemDescription?: string;
  requiredAction: string;
  severity: ReviewerSeverity;
  duePhase: "CURRENT_STAGE_REQUIRED" | "LATER_STAGE_REQUIRED" | "SUBMISSION_ONLY" | "EXECUTION_ONLY";
  blocksAction: string; // e.g. "SUBMIT_PROPOSAL", "START_DATA_COLLECTION"
  owner: string;
  verifiedAt: string;
};

// -------------------------------------------------------------
// §11 & §12 Shared Research Ethics & IRB Center
// -------------------------------------------------------------
export type EthicsScopeResult =
  | "REVIEW_LIKELY_REQUIRED"
  | "EXEMPTION_MAY_APPLY"
  | "NON_HUMAN_RESEARCH"
  | "SECONDARY_DATA_REVIEW_REQUIRED"
  | "INSTITUTIONAL_CONFIRMATION_REQUIRED"
  | "INSUFFICIENT_INFORMATION";

export type EthicsScopeAssessment = {
  assessmentId: string;
  hasHumanParticipants: boolean;
  hasStudentOrSubordinateVulnerability: boolean;
  hasMinors: boolean;
  hasHealthOrBiometricData: boolean;
  hasAudioVideoRecording: boolean;
  hasSensoryEyeTrackingWearable: boolean;
  hasLocationOrBehaviorTracking: boolean;
  hasThirdPartyAiOrCloud: boolean;
  hasLearningPlatformLmsLogs: boolean;
  hasSecondaryData: boolean;
  hasPublicData: boolean;
  hasSensitivePii: boolean;
  hasCrossBorderDataTransfer: boolean;
  hasCompensationOrGradingBonus: boolean;
  hasPotentialAdverseEvents: boolean;
  overallScopeResult: EthicsScopeResult;
  rationale: string;
  assessedAt: string;
};

export type InstitutionalEthicsDecision = {
  institution: string;
  decisionType: "EXPEDITED_REVIEW" | "FULL_BOARD_REVIEW" | "EXEMPTION_CONFIRMED" | "PENDING_SUBMISSION";
  applicationNumber?: string;
  approvalNumber?: string;
  decisionDate?: string;
  expiryDate?: string;
  protocolVersionRef?: string;
  approvedDocuments: string[];
  conditions: string[];
  fileReference?: string;
  verifiedByUser: boolean;
  status: "NOT_YET_SUBMITTED" | "SUBMITTED" | "APPROVED" | "EXEMPT_CONFIRMED";
};

// -------------------------------------------------------------
// §14 & §15 Ethics Risk Register & Data Management Plan (DMP)
// -------------------------------------------------------------
export type EthicsRiskCategory =
  | "PHYSICAL"
  | "PSYCHOLOGICAL"
  | "PRIVACY"
  | "DATA_SECURITY"
  | "TEACHER_STUDENT_POWER"
  | "UNDUE_INFLUENCE"
  | "RE_IDENTIFICATION"
  | "ALGORITHMIC_BIAS"
  | "THIRD_PARTY_PLATFORM"
  | "ADVERSE_EVENT";

export type EthicsRiskItem = {
  riskId: string;
  category: EthicsRiskCategory;
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  severity: "NEGLIGIBLE" | "MODERATE" | "SEVERE";
  affectedPopulation: string;
  mitigationStrategy: string;
  monitoringPlan: string;
  owner: string;
  residualRisk: "LOW" | "MEDIUM";
  status: "IDENTIFIED" | "MITIGATED" | "RESIDUAL_ACCEPTED";
};

export type DataManagementPlan = {
  dmpId: string;
  dataTypesAndSources: string[];
  identifiersHandling: "FULLY_ANONYMIZED" | "CODED_DE_IDENTIFIED" | "PSEUDONYMIZED_KEY_SEPARATE";
  codingKeyStorageLocation: string;
  accessControlAndEncryption: string;
  storageAndBackupStrategy: string;
  transferProtocols: string;
  thirdPartyAiUsageRestrictions: string;
  dataRetentionPeriodYears: number;
  destructionPlan: string;
  repositoryForSharingCandidate?: string;
  sensitiveRestrictions: string[];
  responsiblePersonRole: string;
};

// -------------------------------------------------------------
// §16 Preregistration & Open Science Planning
// -------------------------------------------------------------
export type PreregistrationPlan = {
  applicable: boolean;
  registrationType: "STUDY_PROTOCOL" | "REGISTERED_REPORT_STAGE_1" | "ANALYSIS_PLAN_PREREGISTRATION" | "NOT_APPLICABLE";
  platformCandidate: "OSF" | "ASPREDICTED" | "CLINICALTRIALS_GOV" | "NONE";
  primaryOutcomeConstruct: string;
  secondaryOutcomeConstruct: string;
  hypothesesSummary: string;
  samplePlanReference: string;
  exclusionRules: string[];
  stoppingRule: string;
  missingDataStrategy: string;
  mainAnalysisMethod: string;
  status: "NOT_STARTED" | "PLANNED" | "DRAFT_READY" | "REGISTERED" | "NOT_APPLICABLE";
  registrationUrlOrId?: string;
};

// -------------------------------------------------------------
// §17 Revision Tasks System
// -------------------------------------------------------------
export type RevisionTask = {
  taskId: string;
  sourceFindingId: string;
  affectedWorkspace: string;
  targetSection: string;
  targetFieldRef?: string;
  severity: ReviewerSeverity;
  requiredAction: string;
  owner: string;
  duePhase: "CURRENT_STAGE_REQUIRED" | "LATER_STAGE_REQUIRED";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ACCEPTED_RISK";
  resolutionNote?: string;
};

// -------------------------------------------------------------
// §3 & §26 Complete Route Review & Compliance Workspace
// -------------------------------------------------------------
export type RouteReviewWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceRouteSnapshotId: string;
  sourceDesignSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Review Runs & Findings
  reviewerFindings: ReviewerFinding[];
  revisionTasks: RevisionTask[];

  // Compliance & Rules
  officialRules: OfficialRuleItem[];
  complianceItems: ComplianceItem[];

  // Shared Ethics & IRB Center
  ethicsScope: EthicsScopeAssessment;
  institutionalDecision: InstitutionalEthicsDecision;
  ethicsRisks: EthicsRiskItem[];

  // DMP & Preregistration
  dataManagementPlan: DataManagementPlan;
  preregistrationPlan: PreregistrationPlan;

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "PLANNING_REVIEW_COMPLETE" | "CONDITIONAL_HANDOFF_READY" | "RETURN_FOR_PROPOSAL_REVISION" | "BLOCKED_BY_FATAL_FINDING";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §24 Stage09HandoffSnapshot (Immutable handoff to Stage 10)
// -------------------------------------------------------------
export type Stage09HandoffSnapshot = {
  snapshotId: string; // e.g. "s9snap_<uuid>"
  schemaVersion: "stage09-handoff/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "ethics-review";
  nextStageId: "study-protocol"; // Stage 10: 研究工具、量表與 Study Protocol
  sourceRouteSnapshotId: string;
  sourceDesignSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  reviewRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    primaryRoute: string;
  };

  // Review & Compliance Summary
  totalFindingsCount: number;
  unresolvedFatalCount: number;
  complianceMetRate: number; // e.g. 0.85 (85%)

  // Ethics & IRB Summary
  ethicsScopeResult: EthicsScopeResult;
  institutionalDecisionStatus: string;
  isTeacherStudentPowerRiskIdentified: boolean;

  // Next Stage Instrument & Protocol Needs (Handed off to Stage 10)
  instrumentRequirementsSummary: string[];
  protocolNeedsSummary: string[];

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};
