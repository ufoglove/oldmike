/**
 * Controlled Production Launch & Operations Contract (V3-R02-FULL)
 * Spec: docs/release/V3-R02/spec-v3-4.0.md
 *
 * 定位：工程發布任務，非科研第 21 階段，不加入研究進度分母。
 * 承接 R01 ReleaseReadinessSnapshot，定義發布模式、環境、發布核准、
 * 6 大工程門禁與 ProductionLaunchSnapshot (schema v3.4.0)。
 */

export const PRODUCTION_LAUNCH_CONTRACT_VERSION = "production-launch/3.4.0" as const;

// ─────────────────────────────────────────
// §3 上線模式與環境
// ─────────────────────────────────────────
export type LaunchMode =
  | "FIRST_PRODUCTION_LAUNCH"
  | "UPDATE_EXISTING_PRODUCTION"
  | "VERIFY_EXISTING_RELEASE"
  | "PREPARATION_ONLY";

export type EnvironmentManifest = {
  environmentId: string;
  targetEnvironment: "staging" | "production";
  platformProjectId: string;
  platformServiceId: string;
  deploymentBranch: string;
  publicDomain: string;
  isVolumeAttached: boolean;
  dbIdentityHash: string;
  isProductionDualVerified: boolean;
  createdAt: string;
};

// ─────────────────────────────────────────
// §6 發布核准與操作範圍
// ─────────────────────────────────────────
export type ReleaseAudienceScope =
  | "OWNER_ONLY"
  | "TRUSTED_INVITE_ONLY"
  | "EXPLICIT_PUBLIC_RELEASE";

export type ProductionReleaseAuthorization = {
  authorizationId: string;
  authorizedBy: string;
  authorizedRole: "PLATFORM_OWNER" | "DEVOPS_LEAD";
  releaseManifestDigest: string;
  targetEnvironment: "production";
  allowedAudience: ReleaseAudienceScope;
  allowedOperations: string[];
  blockedOperations: string[];
  maxExpenseCapUsd: number;
  validUntil: string;
  isRevoked: boolean;
  approvedAt: string;
};

// ─────────────────────────────────────────
// §15 ReleaseAttempt 生命週期
// ─────────────────────────────────────────
export type ReleaseAttemptStatus =
  | "RESERVED"
  | "DEPLOYING"
  | "DEPLOYED_PENDING_VERIFICATION"
  | "DEPLOYMENT_OUTCOME_UNKNOWN"
  | "VERIFIED"
  | "ROLLBACK_REQUIRED"
  | "ROLLED_BACK"
  | "FAILED";

export type ReleaseAttempt = {
  attemptId: string;
  releaseCandidateId: string;
  targetEnvironment: string;
  status: ReleaseAttemptStatus;
  reservationIdempotencyKey: string;
  dispatchedAt?: string;
  verifiedAt?: string;
  note: string;
};

// ─────────────────────────────────────────
// §30 工程 Gates
// ─────────────────────────────────────────
export type ProductionLaunchGate =
  | "R02_RELEASE_INPUT_VERIFIED"
  | "R02_DEPLOYMENT_REHEARSAL_PASSED"
  | "R02_PRODUCTION_CHANGE_AUTHORIZED"
  | "R02_PRODUCTION_RELEASE_VERIFIED"
  | "R02_ROLLOUT_OBSERVATION_PASSED"
  | "R02_OPERATIONS_HANDOFF_ACCEPTED";

export const PRODUCTION_LAUNCH_GATES: ProductionLaunchGate[] = [
  "R02_RELEASE_INPUT_VERIFIED",
  "R02_DEPLOYMENT_REHEARSAL_PASSED",
  "R02_PRODUCTION_CHANGE_AUTHORIZED",
  "R02_PRODUCTION_RELEASE_VERIFIED",
  "R02_ROLLOUT_OBSERVATION_PASSED",
  "R02_OPERATIONS_HANDOFF_ACCEPTED",
];

// ─────────────────────────────────────────
// §31 ProductionLaunchSnapshot
// ─────────────────────────────────────────
export type ProductionLaunchSnapshot = {
  schemaVersion: "production-launch/3.4.0";
  snapshotId: string;
  engineeringTaskKey: "V3-R02";

  upstreamReleaseReadinessRef: string;
  upstreamReleaseReadinessHash: string;
  releaseManifestRef: string;
  releaseManifestHash: string;

  launchMode: LaunchMode;
  launchScopeRef: string;
  allowedAudience: ReleaseAudienceScope;
  allowedCapabilities: string[];

  environmentIdentityRef: string;
  platformProjectEnvironmentServiceRefs: string[];

  repositoryCommit: string;
  observedDeploymentRefs: string[];
  actualArtifactDigests: string[];

  configRevisionRefs: string[];
  secretVersionRefs: string[];
  featureFlagRevision: string;

  schemaBefore: string;
  schemaAfter: string;
  migrationPlanRef: string;
  migrationRunRefs: string[];

  approvalRef: string | null;
  approvalScopeDigest: string | null;
  authorizedOperations: string[];
  authorizationExpiry: string | null;

  releaseAttemptRefs: string[];
  deploymentLockAndReconciliationRefs: string[];

  backupRecoveryManifestRef: string;
  restoreCompatibilityEvidenceRefs: string[];

  queueSchedulerTransitionRef: string;
  externalSideEffectLedgerCheckpointRef: string;

  networkAuthValidationRefs: string[];
  healthReadinessRefs: string[];

  productionSmokeManifestRef: string;
  perCaseModesAndOutcomes: Array<{ caseId: string; mode: string; outcome: string }>;

  goalWorkflowChecks: string[];
  actualProviderOperationEvidenceRefs: string[];

  rolloutWaveRefs: string[];
  observationPolicyRef: string;
  observedWindowAndSampleRefs: string[];

  incidentRefs: string[];
  recoveryActionRefs: string[];
  unresolvedIssueRefs: string[];

  userAcceptanceRef: string | null;
  operationsAcceptanceRef: string | null;
  roleAssignmentRefs: string[];

  runbookRefs: string[];
  alertsAndBackupActivationEvidenceRefs: string[];
  laterOpsTasks: string[];

  measuredRpoRtoRefs: { rpoObservedMin: number; rtoObservedMin: number };
  serviceHealthSummary: string;
  readinessDecision:
    | "BLOCKED_BY_R01_EVIDENCE"
    | "RELEASE_READY_AWAITING_OWNER_APPROVAL"
    | "AUTHORIZED_AWAITING_OPERATOR"
    | "DEPLOYMENT_OUTCOME_UNKNOWN"
    | "DEPLOYED_PENDING_VERIFICATION"
    | "LIMITED_ROLLOUT_PENDING_OBSERVATION"
    | "PRODUCTION_OPERATIONAL_HANDOFF_COMPLETE";

  productionReleaseVerified: boolean;
  releaseAudienceScope: ReleaseAudienceScope;
  createdBy: string;
  createdAt: string;

  // 嚴格安全約束：永久禁止自動越權
  researchStateMutationAuthorized: false;
  submissionPaymentPublicationAuthorized: false;
  nextUnspecifiedExternalActionAuthorized: false;
};
