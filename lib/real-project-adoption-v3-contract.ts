/**
 * Real Project Adoption & First Delivery Contract (V3-R03-FULL)
 * Spec: docs/operations/V3-R03/spec-v3-4.0.md
 *
 * 定位：真實科研專案導入、首件成果交付與小版本改善，非科研第 21 階段；
 * 不加入研究進度分母，不覆寫真實研究事實，不重複部署已正常運行之生產站點。
 */

export const REAL_PROJECT_ADOPTION_CONTRACT_VERSION = "real-project-adoption/3.4.0" as const;

// ─────────────────────────────────────────
// §3 權限與工作模式
// ─────────────────────────────────────────
export type R03WorkMode =
  | "NORMAL_RESEARCH_USE"
  | "SCOPED_SERVICE_OBSERVATION"
  | "ISOLATED_PRODUCT_REPAIR";

export type DeliveryIntent =
  | "RESEARCH_PLANNING_BASELINE"
  | "NSTC_PROPOSAL_SCIENTIFIC_DRAFT"
  | "MOE_TPR_PROPOSAL_SCIENTIFIC_DRAFT"
  | "MANUSCRIPT_SCIENTIFIC_DRAFT"
  | "SCIENTIFIC_REVISION"
  | "LANGUAGE_EDITION"
  | "SUBMISSION_PACKAGE"
  | "INDEPENDENT_DOCUMENT_TASK";

export type ProjectWorkAuthorization = {
  authorizationId: string;
  projectId: string;
  documentPurpose: string;
  targetDeliverable: DeliveryIntent;
  allowedSourcesScope: string[];
  allowedOperations: string[];
  maxExpenseCapUsd: number;
  validUntil: string;
  isRevoked: boolean;
};

// ─────────────────────────────────────────
// §5 成果工作單 (AdoptionWorkOrder)
// ─────────────────────────────────────────
export type AdoptionWorkOrderStatus =
  | "PREPARING"
  | "READY_FOR_PROJECT_SELECTION"
  | "READY_FOR_SCOPE_CONFIRMATION"
  | "RUNNING"
  | "WAITING_REQUIRED_INPUT"
  | "NEEDS_USER_REVIEW"
  | "PARTIAL_DELIVERY"
  | "DELIVERED_PENDING_ACCEPTANCE"
  | "ACCEPTED_FOR_STATED_PURPOSE"
  | "CANCELLED";

export type AdoptionWorkOrder = {
  workOrderId: string;
  deliverableId: string;
  projectId: string;
  chosenGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  documentPurpose: string;
  deliveryIntent: DeliveryIntent;
  sourceScope: string[];
  allowedOperations: string[];
  status: AdoptionWorkOrderStatus;
  isScopeReducedSilently: false; // 嚴格禁止偷改小目標換取 PASS
  createdAt: string;
};

// ─────────────────────────────────────────
// §7 前置檢查與缺失分流
// ─────────────────────────────────────────
export type RequirementIssueType =
  | "USER_DATA_REQUIRED"
  | "SOURCE_EVIDENCE_REQUIRED"
  | "SCIENCE_DECISION_REQUIRED"
  | "RIGHTS_OR_AUTHORIZATION_REQUIRED"
  | "PROVIDER_LIMITATION"
  | "SOFTWARE_DEFECT"
  | "EXPECTED_FUTURE_WORK";

export type R03RequirementIssue = {
  issueId: string;
  issueType: RequirementIssueType;
  severity: "CURRENT_TASK_REQUIRED" | "LATER_RESEARCH" | "SUBMISSION_ONLY" | "EXECUTION_ONLY";
  description: string;
  deepLinkTarget: { projectId: string; documentId?: string; tab?: string; field?: string };
  isResolved: boolean;
};

// ─────────────────────────────────────────
// §11 首件成果清冊 (FirstDeliverableManifest)
// ─────────────────────────────────────────
export type FirstDeliverableManifest = {
  manifestId: string;
  workOrderId: string;
  targetDeliverable: DeliveryIntent;
  outputArtifacts: Array<{
    filename: string;
    format: "MARKDOWN" | "JSON" | "DOCX" | "PDF";
    bytes: number;
    sha256: string;
    storageRef: string;
  }>;
  qualityStatus: "DRAFT" | "SCIENTIFICALLY_REVIEWED" | "LANGUAGE_QA_PASSED" | "PACKAGE_READY";
  userAcceptanceRecorded: boolean;
  unresolvedIssueCount: number;
  completedAt?: string;
};

// ─────────────────────────────────────────
// §26 六大操作門禁 (R03 Gates)
// ─────────────────────────────────────────
export type R03AdoptionGate =
  | "R03_OPERATIONAL_INPUT_VERIFIED"
  | "R03_REAL_WORK_SCOPE_AUTHORIZED"
  | "R03_DELIVERABLE_QUALITY_CHECKED"
  | "R03_USER_DELIVERABLE_ACCEPTANCE_RECORDED"
  | "R03_HIGH_PRIORITY_ISSUES_DISPOSITIONED"
  | "R03_ADOPTION_EVIDENCE_SAVED";

export const R03_ADOPTION_GATES: R03AdoptionGate[] = [
  "R03_OPERATIONAL_INPUT_VERIFIED",
  "R03_REAL_WORK_SCOPE_AUTHORIZED",
  "R03_DELIVERABLE_QUALITY_CHECKED",
  "R03_USER_DELIVERABLE_ACCEPTANCE_RECORDED",
  "R03_HIGH_PRIORITY_ISSUES_DISPOSITIONED",
  "R03_ADOPTION_EVIDENCE_SAVED",
];

// ─────────────────────────────────────────
// §27 RealProjectDeliverySnapshot
// ─────────────────────────────────────────
export type RealProjectDeliverySnapshot = {
  schemaVersion: "real-project-delivery/3.4.0";
  snapshotId: string;
  taskKey: "V3-R03";

  upstreamProductionLaunchRef: string;
  upstreamProductionLaunchDigest: string;
  observedReleaseRefs: string[];

  launchScopeRef: string;
  allowedAudience: string;
  activeCapabilitiesRefs: string[];

  projectId: string;
  goalContextRef: string;
  documentPurpose: string;
  documentRefs: string[];

  workOrderRef: string;
  workOrderRevision: number;
  projectWorkAuthorizationRef: string;
  inputManifestDigest: string;

  deliverableTarget: DeliveryIntent;
  acceptanceCriteriaRef: string;
  explicitScopeChangeRefs: string[];

  executionMode: "MANUAL" | "AUTOMATED_LOCAL" | "LIVE_PROVIDER" | "MOCK_PROVIDER" | "FIXTURE";
  allowedSources: string[];
  providerOperationScopeRefs: string[];

  jobAndCheckpointRefs: string[];
  sourceAdoptionRefs: string[];
  artifactManifestRef: string;
  artifactManifestDigest: string;

  qualityCheckRefs: string[];
  factCitationIntegrityRefs: string[];
  exportOpenEvidenceRefs: string[];

  usageEventManifestRef: string;
  metricDefinitionVersion: string;
  observationWindowRef: string;

  knownDataCoverage: string;
  incompleteAttemptRefs: string[];
  supportAssistanceMode: string;

  costActualRefs: string[];
  costEstimateRefs: string[];
  unreconciledCostRefs: string[];

  userFeedbackRefs: string[];
  userAcceptanceRef: string | null;
  acceptanceActorAndArtifactDigest: string | null;

  productIssueRefs: string[];
  issueDispositionRefs: string[];
  regressionTestRefs: string[];

  patchManifestRefs: string[];
  patchReleaseStatus:
    | "NO_FIX_REQUIRED"
    | "REPRODUCED"
    | "STAGING_FIXED"
    | "REGRESSION_PASSED"
    | "PATCH_READY_AWAITING_RELEASE_APPROVAL"
    | "DEPLOYED_PENDING_VERIFICATION"
    | "VERIFIED_RELEASE";
  patchReleaseEvidenceRefs: string[];

  currentUsabilityStatus: string;
  unresolvedScientificOrRightsIssueRefs: string[];

  remainingResearchActions: string[];
  scopeCompletionStatus: "PARTIAL" | "DELIVERED_PENDING_ACCEPTANCE" | "FIRST_REAL_DELIVERABLE_ACCEPTED_AND_ADOPTION_REVIEW_COMPLETE";
  operationsOwnerRef: string;

  sourceAndLockManifestRef: string;
  auditRefs: string[];
  createdBy: string;
  createdAt: string;

  // 嚴格安全約束：永久禁止自動越權
  engineeringProgressNotInResearchDenominator: true;
  submissionPaymentPublicationAuthorized: false;
  unspecifiedProductionChangeAuthorized: false;
  rawResearchFactMutationAuthorized: false;
};
