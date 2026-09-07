/**
 * Continuous Quality, AI Regression & Maintenance Contract (V3-R04-FULL)
 * Spec: docs/operations/V3-R04/spec-v3-4.0.md
 *
 * 定位：營運品質監測、AI品質回歸與受控維護工作單，非科研第 21 階段；
 * 不加入研究進度分母，不覆寫真實研究事實，不新增重複排程系統，不預設重新部署。
 */

export const MAINTENANCE_REVIEW_CONTRACT_VERSION = "maintenance-review/3.4.0" as const;

// ─────────────────────────────────────────
// §3 權限分層與維護工作模式
// ─────────────────────────────────────────
export type R04WorkMode =
  | "SCOPED_OPERATIONAL_READ"
  | "PROJECT_QUALITY_CHECK"
  | "ISOLATED_REGRESSION"
  | "ISOLATED_REPAIR"
  | "APPROVED_PRODUCTION_CHANGE";

export type MaintenanceWorkOrder = {
  workOrderId: string;
  owner: string;
  scope: R04WorkMode;
  allowedProjectDocumentRefs: string[];
  windowStartUtc: string;
  windowEndUtc: string;
  allowedProviderOperations: string[];
  maxExpenseCapUsd: number;
  scheduleState: "DRAFT_DISABLED" | "PREPARED_NOT_ENABLED" | "ENABLED_NOT_YET_RUN" | "RUNNING" | "PAUSED" | "LAST_RUN_CONFIRMED";
  validUntil: string;
  isRevoked: boolean;
};

// ─────────────────────────────────────────
// §7/§8 品質與服務水準指標
// ─────────────────────────────────────────
export type ServiceMetricEntry = {
  metricKey: string;
  definitionVersion: string;
  eligiblePopulation: string;
  window: string;
  numerator: number;
  denominator: number;
  calculatedValue: number | null; // 分母為 0 時標記為 null (N/A)
  unknownCount: number;
  excludedCount: number;
  status: "OK" | "DEGRADED" | "MONITORING_UNKNOWN" | "INSUFFICIENT_OBSERVATION";
};

// ─────────────────────────────────────────
// §20 改善候選與修補決策
// ─────────────────────────────────────────
export type MaintenancePatchStatus =
  | "NO_CODE_CHANGE_REQUIRED"
  | "NO_ACTION_REQUIRED"
  | "MORE_EVIDENCE_NEEDED"
  | "USER_DATA_TASK"
  | "SOURCE_REVALIDATION"
  | "STAGING_FIXED"
  | "PATCH_READY_AWAITING_RELEASE_APPROVAL"
  | "DEPLOYED_PENDING_VERIFICATION"
  | "VERIFIED";

// ─────────────────────────────────────────
// §27 四大控制驗收門禁 (R04 Gates)
// ─────────────────────────────────────────
export type R04MaintenanceGate =
  | "R04_INPUT_SCOPE_AND_EVIDENCE_CHECKED"
  | "R04_QUALITY_CONTROL_PLAN_VALIDATED"
  | "R04_MAINTENANCE_REVIEW_RECORDED"
  | "R04_ISSUES_DISPOSITIONED_AND_HANDOFF_SAVED";

export const R04_MAINTENANCE_GATES: R04MaintenanceGate[] = [
  "R04_INPUT_SCOPE_AND_EVIDENCE_CHECKED",
  "R04_QUALITY_CONTROL_PLAN_VALIDATED",
  "R04_MAINTENANCE_REVIEW_RECORDED",
  "R04_ISSUES_DISPOSITIONED_AND_HANDOFF_SAVED",
];

// ─────────────────────────────────────────
// §26 MaintenanceReviewSnapshot
// ─────────────────────────────────────────
export type MaintenanceReviewSnapshot = {
  schemaVersion: "maintenance-review/3.4.0";
  snapshotId: string;
  taskKey: "V3-R04";

  upstreamRealProjectDeliveryRef: string;
  upstreamRealProjectDeliveryDigest: string;
  productionLaunchRef: string;
  observedReleaseConfigPromptRefs: string[];

  maintenanceWorkOrderRef: string;
  maintenanceWorkOrderRevision: number;
  maintenanceAuthorizationRef: string;

  allowedObservationScope: string;
  allowedProjectDocumentRefs: string[];

  windowStartUtc: string;
  windowEndUtc: string;
  sourceCutoff: string;
  eventManifestRef: string;

  coverageStatus: "FULL_COVERAGE" | "TELEMETRY_GAP" | "MONITORING_UNKNOWN" | "INSUFFICIENT_OBSERVATION";
  eligibleWorkOrderCount: number;
  unknownEventCount: number;

  metricDefinitionRefs: string[];
  serviceMetricRollupRefs: ServiceMetricEntry[];
  sloPolicyRef: string;

  researchIntegrityCheckRefs: string[];
  semanticReviewRefs: string[];
  humanAdjudicationRefs: string[];

  evaluationSuiteRef: string;
  baselineCandidateRefs: string[];
  evalDataPurpose: string;
  holdoutExposureRef: string;

  providerCapabilityRefs: string[];
  sourceChangeImpactRefs: string[];
  officialRuleCheckRefs: string[];

  costActualRefs: string[];
  costEstimateRefs: string[];
  costUnreconciledRefs: string[];

  incidentIssueRefs: string[];
  dispositionRefs: string[];
  affectedScopeRestrictions: string[];

  patchManifestRefs: string[];
  releaseStatus: MaintenancePatchStatus;
  releaseEvidenceRefs: string[];

  backupCheckRef: string;
  recoveryVerificationRef: string;
  permissionsCheckRefs: string[];

  maintenancePolicyRef: string;
  policyAdoptionRef: string;
  ownerRef: string;

  scheduleState: MaintenanceWorkOrder["scheduleState"];
  scheduleAuthorizationRef: string | null;
  actualScheduleRunRefs: string[];

  notificationScopeRef: string;
  pendingObservationItems: string[];
  remainingResearchActions: string[];

  reviewDisposition: "MAINTENANCE_REVIEW_AND_CONTROL_HANDOFF_COMPLETE" | "UPSTREAM_EVIDENCE_PENDING" | "MAINTENANCE_POLICY_READY_AWAITING_OWNER_APPROVAL";
  controlValidationStatus: "PASSED" | "INSUFFICIENT_EVIDENCE";
  operatingHealthStatus: "WITHIN_CONFIRMED_TARGET" | "DEGRADED" | "INCIDENT_OPEN" | "INSUFFICIENT_OBSERVATION" | "UNKNOWN";

  sourceLockManifestRef: string;
  auditRefs: string[];
  createdBy: string;
  createdAt: string;

  // 嚴格安全約束：永久禁止自動越權
  engineeringProgressNotInResearchDenominator: true;
  rawResearchFactMutationAuthorized: false;
  submissionPaymentPublicationAuthorized: false;
  unspecifiedProductionChangeAuthorized: false;
};
