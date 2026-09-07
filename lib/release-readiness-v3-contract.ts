/**
 * Release Readiness & Engineering Integration Contract (V3-R01-FULL)
 * Spec: docs/release/V3-R01/spec-v3-4.0.md
 *
 * 定位：工程整合驗收與上線準備，非科研第 21 階段；
 * 不變更研究資料，不重放未授權之外部副作用。
 */

export const RELEASE_READINESS_CONTRACT_VERSION = "release-readiness/3.4.0" as const;

// ─────────────────────────────────────────
// §3 能力與驗證狀態
// ─────────────────────────────────────────
export type ImplementationStatus =
  | "IMPLEMENTED"
  | "PARTIAL"
  | "NOT_IMPLEMENTED"
  | "UNSUPPORTED"
  | "DISABLED_BY_APPROVED_SCOPE";

export type VerificationStatus =
  | "PASS"
  | "FAIL"
  | "FLAKY"
  | "NOT_RUN"
  | "BLOCKED"
  | "NOT_APPLICABLE_WITH_REASON";

export type OperationMode =
  | "LOCAL_REAL_SERVICE"
  | "LIVE_READONLY_PROVIDER"
  | "LIVE_AUTHORIZED_SANDBOX"
  | "MOCK_PROVIDER"
  | "FIXTURE_INPUT"
  | "SYNTHETIC_E2E";

export type CapabilityEntry = {
  capabilityKey: string;
  module: string; // e.g. "U01", "U14", "CORE_NAV"
  description: string;
  implementationStatus: ImplementationStatus;
  verificationStatus: VerificationStatus;
  operationMode: OperationMode;
  environment: "local" | "dev" | "staging" | "production";
  lastTestedAt: string;
  owner: string;
  remainingRisk: string;
  evidenceRef: string;
};

export type ReleaseScopeManifest = {
  manifestId: string;
  targetEnvironment: "staging" | "production-candidate";
  supportedGoals: Array<"JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR">;
  coreCapabilities: CapabilityEntry[];
  optionalCapabilities: CapabilityEntry[];
  excludedCapabilities: Array<{ key: string; reason: string }>;
  digest: string;
  createdAt: string;
};

// ─────────────────────────────────────────
// §26 缺陷優先級
// ─────────────────────────────────────────
export type IssueSeverity = "P0" | "P1" | "P2" | "P3";

export type IntegrationIssue = {
  issueId: string;
  sourceTestId: string;
  affectedStage: string;
  affectedGoal: string;
  severity: IssueSeverity;
  expected: string;
  actual: string;
  rootCauseStatus: "CONFIRMED" | "UNCONFIRMED" | "MITIGATED";
  fixReference?: string;
  verificationStatus: VerificationStatus;
};

// ─────────────────────────────────────────
// §29 工程發布 Gates
// ─────────────────────────────────────────
export type ReleaseEngineeringGate =
  | "INTEGRATION_INVENTORY_VERIFIED"
  | "CORE_WORKFLOWS_INTEGRATION_ACCEPTED"
  | "SECURITY_RECOVERY_AND_OUTPUT_ACCEPTED"
  | "RELEASE_CANDIDATE_READY_AWAITING_OWNER_APPROVAL"
  | "PRODUCTION_RELEASE_VERIFIED"; // 僅在獲得 owner 授權且部署成功後可達

export const RELEASE_ENGINEERING_GATES: ReleaseEngineeringGate[] = [
  "INTEGRATION_INVENTORY_VERIFIED",
  "CORE_WORKFLOWS_INTEGRATION_ACCEPTED",
  "SECURITY_RECOVERY_AND_OUTPUT_ACCEPTED",
  "RELEASE_CANDIDATE_READY_AWAITING_OWNER_APPROVAL",
];

// ─────────────────────────────────────────
// §31 ReleaseReadinessSnapshot
// ─────────────────────────────────────────
export type ReleaseReadinessSnapshot = {
  schemaVersion: "release-readiness/3.4.0";
  snapshotId: string;
  engineeringTaskKey: "V3-R01";
  releaseCandidateId: string;
  releaseScopeManifestRef: string;
  releaseScopeManifestHash: string;

  environmentIdentityRef: string;
  repositoryRef: string;
  commitSha: string;
  workingTreeDigest: string;
  buildOrImageDigest: string;
  dependencyLockDigest: string;
  runtimeVersionRefs: Record<string, string>;

  configSchemaVersion: string;
  migrationPlanRef: string;
  appliedStagingMigrations: string[];

  stageRegistryVersion: string;
  goalRegistryVersion: string;
  providerRegistryVersion: string;

  inputSpecManifestRef: string;
  contractCoverageManifestRef: string;
  workflowScenarioRefs: string[];
  assistCoverageManifestRef: string;
  lockTestManifestRef: string;

  engineValidationRefs: string[];
  sourceAndCitationTestRefs: string[];
  exportValidationRefs: string[];

  providerOperationEvidenceRefs: string[];
  liveTestScopeAndConsentRefs: string[];

  securityThreatModelRef: string;
  securityVerificationRefs: string[];
  privacyReviewRef: string;

  jobRecoveryTestRefs: string[];
  externalSideEffectReconciliationTestRefs: string[];

  backupManifestRef: string;
  restoreVerificationRefs: string[];
  rpoRtoObservations: { rpoTargetMin: number; rpoObservedMin: number; rtoTargetMin: number; rtoObservedMin: number };

  performanceBaselineRef: string;
  observabilityAndAlertOwnerRefs: string[];

  testCatalogVersion: string;
  testRunManifestRef: string;
  applicabilityDecisions: string[];

  blockingIssueRefs: string[];
  remainingKnownIssueRefs: string[];
  acceptedNoncriticalRisks: string[];

  releaseDecision: "CANDIDATE_READY" | "REJECTED" | "PRIVATE_PILOT_ONLY";
  allowedAudience: string[];
  allowedCapabilities: string[];
  blockedOperations: string[];

  rollbackRunbookRef: string;
  deploymentRunbookRef: string;
  supportRunbookRef: string;

  sourceManifestHash: string;
  createdBy: string;
  createdAt: string;

  // 永遠保持 false，直到有真實 owner 簽署授權
  productionDeploymentAuthorized: false;
  researchStateMutationAuthorized: false;
  nextExternalActionAuthorized: false;
};
