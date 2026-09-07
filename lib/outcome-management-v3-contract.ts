/**
 * Outcome / Post-Acceptance & Award Management Contract (V3-U20-FULL, R2)
 * Spec: docs/stage20/spec-v3-4.0.md（完整 36 節，SHA-256 d056eade…，2026-09-07）
 *
 * 承接 U19 SubmissionTrackingSnapshot → 上游 Gate DECISION_VERIFIED_AND_OUTCOME_HANDOFF_READY。
 * 下游 OutcomeManagementSnapshot（無臆造第 21 階段）。本輪提供：三路線異步狀態、
 * proof/queries 校樣、rights/APC、award/finance、執行回流、成果報告、ResearchOutput、
 * deposit/public release、closeout/archive，與 9 個 Gate＋17 個錯誤碼（§32/§33 官方）。
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";

export const OUTCOME_MANAGEMENT_CONTRACT_VERSION = "outcome-management/2.0.0" as const;

// ───────────── §32 官方錯誤碼（17）─────────────
export const OUTCOME_MANAGEMENT_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "DECISION_UNVERIFIED",
  "SCOPE_DENIED",
  "SOURCE_STALE",
  "PROOF_ANCHOR_STALE",
  "SCIENTIFIC_CHANGE_REVIEW_REQUIRED",
  "RIGHTS_UNRESOLVED",
  "PAYEE_UNVERIFIED",
  "BUDGET_SOURCE_MISMATCH",
  "FINANCIAL_RECONCILIATION_INCOMPLETE",
  "EXECUTION_AUTH_REQUIRED",
  "PUBLIC_RELEASE_BLOCKED",
  "APPROVAL_DIGEST_STALE",
  "OUTCOME_UNKNOWN",
  "LOCK_CONFLICT",
  "PROVIDER_UNSUPPORTED",
  "ARCHIVE_INCOMPLETE",
] as const;
export type OutcomeManagementErrorCode = (typeof OUTCOME_MANAGEMENT_ERROR_CODES)[number];

// R1/R2 old→official aliases（相容保留）
export const LEGACY_OM_ERROR_ALIASES: Record<string, OutcomeManagementErrorCode> = {
  HANDOFF_NOT_READY: "DECISION_UNVERIFIED",
  SCOPE_NOT_ALLOWED: "SCOPE_DENIED",
  EXTERNAL_ACTION_UNAUTHORIZED: "SCOPE_DENIED",
  PROOF_VERSION_MISMATCH: "PROOF_ANCHOR_STALE",
  LOCATION_NOT_RENDERED: "PROOF_ANCHOR_STALE",
  QUERY_EVIDENCE_MISSING: "SOURCE_STALE",
  FINANCE_SOURCE_UNVERIFIED: "BUDGET_SOURCE_MISMATCH",
  FINANCE_DOUBLE_COUNT: "FINANCIAL_RECONCILIATION_INCOMPLETE",
  CLAIM_WITHOUT_EXECUTION_EVIDENCE: "EXECUTION_AUTH_REQUIRED",
  REPORT_PENDING_DATA: "SOURCE_STALE",
  RIGHTS_SCOPE_DENIED: "RIGHTS_UNRESOLVED",
  EMBARGO_PENDING_RECHECK: "PUBLIC_RELEASE_BLOCKED",
  ORCID_SYNC_NOT_VERIFIED: "SOURCE_STALE",
  ZOTERO_WRITE_UNAUTHORIZED: "SCOPE_DENIED",
  ARCHIVE_INTEGRITY_FAULT: "ARCHIVE_INCOMPLETE",
  LATE_OUTPUT_REJECTED: "LOCK_CONFLICT",
  OUTCOME_SAVE_FAILED: "HANDOFF_SCHEMA_UNSUPPORTED",
};

// ───────────── §2/§31 route & scopes ─────────────
export type OutcomeRoute = "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
export type OutcomeScopeKind = "PUBLICATION_DELIVERABLE" | "GRANT_ADMIN" | "REPORT_ROUND" | "RESEARCH_PROJECT" | "SINGLE_GOAL";

// ───────────── §4 多維度狀態（不只一個 Completed）─────────────
export type AcceptanceDimension = "ACCEPTED" | "ACCEPTED_SUBJECT_TO_CONDITIONS" | "NOT_ACCEPTED";
export type ProductionDimension = "NOT_PRODUCTION" | "PRODUCTION_INITIATED" | "PROOF_ROUND" | "PROOF_RETURNED" | "VOR_PENDING" | "VOR_PUBLISHED_ONLINE" | "ISSUE_ASSIGNED";
export type PublicationVisibility = "AM_ONLINE" | "VOR_ONLINE" | "PUBLISHED_IN_ISSUE" | "NOT_VISIBLE";
export type IndexingDimension = "NOT_INDEXED_CHECKED" | "INDEXED" | "INDEXING_PENDING" | "UNVERIFIED";
export type FundingDimension =
  | "NOT_AWARDED"
  | "AWARD_VERIFIED"
  | "CONDITION_SATISFIED"
  | "CONTRACT_IN_PROCESS"
  | "CONTRACT_SIGNED"
  | "DISBURSED"
  | "EXPENSE_RECORDED"
  | "RECONCILED"
  | "CLOSED_EXTERNAL";

export type OutcomeStageFlags = {
  acceptance: AcceptanceDimension;
  production: ProductionDimension;
  visibility: PublicationVisibility;
  indexing: IndexingDimension;
  funding: FundingDimension;
};

// ───────────── §2/§32 entity models ─────────────
export type ProofRoundEntity = {
  proofId: string;
  caseId: string;
  round: number;
  bytesDigest: string;
  acceptedVersionRef: string | null;
  source: "PDF" | "HTML" | "XML" | "LATEX" | "MANUAL";
  pageLineLocator: string;
  status: "RECEIVED" | "CHECKED" | "CORRECTIONS_PENDING" | "RETURNED" | "INVALIDATED_BY_NEWER";
  createdAt: string;
};

export type ProofIssueEntity = {
  issueId: string;
  proofId: string;
  field: "TYPE" | "METADATA" | "NUMERIC" | "SCIENTIFIC" | "AUTHOR" | "RIGHTS_3RD_PARTY" | "SUPPLEMENT" | "OTHER";
  original: string;
  proposed: string;
  location: string;
  reason: string;
  supportSourceRef?: string;
  changesScience: boolean;
  status: "PENDING_CONFIRM" | "CANDIDATE" | "ACCEPTED_AS_CORRECTION" | "RETURN_TO_U14_16";
};

export type PublisherQueryEntity = {
  queryId: string;
  proofId: string;
  externalId: string | null;
  sourceType: "PUBLISHER_PRODUCTION_QUERY";
  rawText: string;
  hasRealReply: boolean;
  actionPatchOrArtifactRefs: string[]; // 「已更正/已補檔」需真採用patch/artifact
  status: "PENDING_REPLY" | "REPLY_DRAFTED" | "ACTION_EVIDENCE_MISSING" | "REPLY_VERIFIED";
};

export type ProofCorrectionPackage = {
  packageId: string;
  proofId: string;
  acceptedSourceRef: string;
  queriesCoverage: string[]; // 已答 queryId
  appliedCorrectionsRefs: string[];
  replacedArtifactsRefs: string[];
  humanConfirmations: string[];
  digest: string;
  status: "BUILDING" | "READY_TO_RETURN_PROOF" | "SENT";
};

export type AcceptedArtifactBaseline = {
  baselineId: string;
  acceptedVersionRef: string | null;
  versionResolved: boolean; // AC = false 標 ACCEPTED_VERSION_UNRESOLVED
  sourceRef: string;
};

// ───────────── §13/§14 rights & invoice ─────────────
export type PublicationRightsProfile = {
  rightsId: string;
  artifactVersionRef: string;
  licence: string | null;
  usageScope: string;
  publicTiming: string | null;
  embargoUntil: string | null;
  thirdPartyMaterialsOk: boolean;
  funderInstitutionConditionsRefs: string[];
  status: "ACTIVE" | "RIGHTS_RECONCILIATION_REQUIRED" | "RESOLVED";
};

export type InvoiceObservation = {
  invoiceId: string;
  invoiceNo: string | null;
  publisherVendorRef: string;
  caseOrArticleId: string;
  currency: string;
  amountMinor: string | null; // null=未知，不是 0
  sourceFileHash: string | null;
  dueRuleRef: string | null;
  financeOwnerRef: string;
  payeeVerification: "OK" | "PAYEE_VERIFICATION_REQUIRED";
  status: "QUOTE" | "INVOICE_ISSUED" | "WAIVER_GRANTED" | "PAYMENT_EVIDENCE" | "PUBLISHER_CONFIRMED";
};

// ───────────── §17/§19 award & finance ─────────────
export type GrantAwardBaseline = {
  awardId: string;
  authority: string;
  programType: string;
  callYear: string;
  applicationId: string;
  awardIdOfficial: string | null;
  piRef: string;
  institutionRef: string | null;
  fullOrStagedAward: "FULL" | "STAGED_YEARLY";
  approvedStart: string | null;
  approvedEnd: string | null;
  amountMinor: string;
  currency: string;
  awardDocumentHash: string;
  status: "REQUESTED" | "PREAPPROVED" | "AWARDED" | "CONTRACTED" | "DISBURSED" | "EXPENSE_RECORDED" | "RECONCILED";
};

export type FinancialObservation = {
  obsId: string;
  awardId: string;
  kind: "COMMITMENT" | "INVOICE" | "PAYMENT" | "EXPENSE" | "ADJUSTMENT" | "CLAIM";
  amountMinor: string;
  currency: string;
  counterpartKey?: string; // 去重（同一實際付款只算一次支出）
  sourceVerified: boolean;
  sourceRef: string;
};

// ───────────── §18 ExecutionReentryRequest ─────────────
export type ExecutionReentryRequest = {
  reentryId: string;
  projectId: string;
  awardRef: string | null;
  cycleRef: string;
  scope: { destinationStages: Array<"data-governance" | "analysis-execution" | "tooling" | "ethics">; requestedItems: string[] };
  conditionsImpactAssessed: boolean;
  humanActivityBlockingRefs: string[]; // 若 U09/U12 阻擋則列出
  status: "DRAFT" | "AUTHORIZED" | "RETURNED_TO_U09_14" | "BLOCKED_BY_CONDITIONS";
};

// ───────────── §22/§23 report ─────────────
export type OutcomeReportRound = {
  reportRoundId: string;
  purpose: "GRANT_PROGRESS" | "GRANT_FINAL" | "FINANCIAL_RECONCILIATION_PREP" | "TEACHING_OUTCOME" | "TRAVEL" | "OTHER_APPLICABLE";
  awardOrCycleRef: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  evidenceRefs: string[];
  fieldSkeletonOnly: boolean; // 未有真欄位=骨架
  status: "SKELETON" | "PENDING_DATA" | "HAS_EVIDENCE" | "PACKAGE_READY" | "SUBMITTED" | "RECEIVED_CONFIRMED";
};

// ───────────── §25/§27 ResearchOutput & deposit ─────────────
export type OutputKind = "JOURNAL_ARTICLE" | "CONFERENCE" | "DATASET" | "CODE_SOFTWARE_MODEL" | "PROTOCOL_INSTRUMENT" | "TEACHING_MATERIAL" | "REPORT" | "TECHNICAL_DELIVERABLE" | "OTHER_VERIFIED";
export type ResearchOutputRecord = {
  registerId: string;
  familyId: string; // OutputFamily：實質成果
  kind: OutputKind;
  status: "INTERNAL_RECORD" | "VERIFIED_PUBLICATION" | "ACCEPTED_RECEIVED" | "PUBLICLY_AVAILABLE";
  identifiers: Array<{ type: "DOI" | "PUBLICATION_ID" | "CODE_TAG" | "OTHER"; value: string }>;
  visibility: "PRIVATE" | "PUBLIC";
  evidenceRefs: string[];
};
export type DepositWorkOrder = {
  depositId: string;
  outputVersionRef: string;
  destination: string;
  licence: string | null;
  embargoUntil: string | null;
  status: "PRIVATE_DRAFT" | "DEPOSIT_REQUESTED" | "DEPOSIT_VERIFIED" | "EMBARGOED" | "PUBLIC_RELEASE_READY" | "PUBLICLY_AVAILABLE_VERIFIED";
};

// ───────────── §24/§29 Closeout & archive ─────────────
export type CloseoutScope = {
  scopeId: string;
  kind: OutcomeScopeKind;
  requiredObligations: string[];
  evidenceRefs: string[];
  lateObligationsCustodianRefs: string[];
  formalDisposition: "INTERNAL_COMPLETION" | "EXTERNALLY_CONFIRMED_CLOSEOUT" | "DISPOSITION_VERIFIED" | "REQUIRES_CONFIRMATION";
};
export type ArchiveManifest = {
  archiveId: string;
  sourceRefs: string[];
  filesHashes: string[];
  aclScope: string;
  retention: string;
  futureObligationsRefs: string[];
  restoreRecipe: string;
  restoreVerified: boolean; // 隔離驗證
  noReplayableSecrets: boolean;
};

// ───────────── §31 Assist / Lock ─────────────
export type AutomationPolicyLock = { state: "AUTOMATION_POLICY_LOCKED_DRAFT"; lockedBy: "ai" };
export type HumanConfirmedState = { state: "HUMAN_APPROVED"; by: string; at: string };

// ───────────── §33 Gates ─────────────
export type OutcomeGate =
  | "POST_DECISION_INTAKE_VERIFIED"
  | "POST_DECISION_PLAN_BASELINE_READY"
  | "PROOF_CORRECTION_PACKAGE_READY"
  | "AWARD_EXECUTION_REENTRY_READY"
  | "OUTCOME_REPORT_PACKAGE_READY"
  | "OUTPUT_RECORD_VERIFIED"
  | "PUBLIC_RELEASE_READY"
  | "OUTCOME_SCOPE_CLOSURE_READY"
  | "OUTCOME_ARCHIVE_VERIFIED";
export const OUTCOME_GATES: OutcomeGate[] = [
  "POST_DECISION_INTAKE_VERIFIED",
  "POST_DECISION_PLAN_BASELINE_READY",
  "PROOF_CORRECTION_PACKAGE_READY",
  "AWARD_EXECUTION_REENTRY_READY",
  "OUTCOME_REPORT_PACKAGE_READY",
  "OUTPUT_RECORD_VERIFIED",
  "PUBLIC_RELEASE_READY",
  "OUTCOME_SCOPE_CLOSURE_READY",
  "OUTCOME_ARCHIVE_VERIFIED",
];

export type NextActionToken =
  | { route: "outcome-management"; action: "outcome-overview" }
  | { route: "submission-tracking" } // 回 U19（報告送審/決策修正）
  | { route: "research-execution"; action: "reentry" }
  | { route: "close-archive" }
  | { route: "new-research-seed" };

// ───────────── §34 OutcomeManagementSnapshot（完整 schema）─────────────
export type OutcomeManagementSnapshot = {
  snapshotId: string;
  schemaVersion: "outcome-management/2.0.0";
  stageKey: "V3-U20";
  workspaceId: string;
  projectId: string;
  outcomeScopeId: string;
  caseId: string;
  caseRevision: number;
  documentId: string;
  manuscriptId: string | null;
  documentPurpose: string;
  goalContextRevision: number;
  fundingRoute: string;
  publicationRoute: string;
  inputSubmissionTrackingSnapshotRefs: string[];
  inputSubmissionTrackingSnapshotHashes: string[];
  verifiedDecisionRefs: string[];
  decisionConditions: string[];
  targetProfileRef: string | null;
  postDecisionProcessingAllowed: boolean;
  postDecisionAllowedScopeRefs: string[];
  acceptedOrAwardedBaselineRefs: string[];
  policySnapshotRefs: string[];
  obligationManifestRef: string | null;
  deadlineExtensionRefs: string[];
  ownerAssignments: string[];
  proofRoundRefs: string[];
  comparisonRefs: string[];
  queryResponseRefs: string[];
  proofCorrectionPackageRefs: string[];
  authorConfirmationRefs: string[];
  proofReceiptRefs: string[];
  publicationRightsRefs: string[];
  agreementObservationRefs: string[];
  invoiceAndPaymentSummaryRefs: string[];
  financialVisibilityPolicyRef: string | null;
  publicationRecordRefs: string[];
  versionAndNoticeRelations: string[];
  indexingObservationRefs: string[];
  awardBaselineRefs: string[];
  awardChangeRefs: string[];
  financialReconciliationRefs: string[];
  executionReentryRefs: string[];
  executionCycleRefs: string[];
  reportRoundRefs: string[];
  reportEvidenceManifestRef: string | null;
  submittedReportPackageRefs: string[];
  reportReceiptRefs: string[];
  outputRegistryRefs: string[];
  contributionMappingRefs: string[];
  citationManifestRef: string | null;
  zoteroManifestRef: string | null;
  publicProfileUpdateObservations: string[];
  depositWorkOrderRefs: string[];
  releaseManifestRefs: string[];
  depositReceiptRefs: string[];
  closureScopeRefs: string[];
  externalCloseoutEvidenceRefs: string[];
  archiveManifestRefs: string[];
  restoreVerificationRefs: string[];
  retentionObligationRefs: string[];
  scientificMeaningConstraintsRefs: string[];
  resultReleaseRefs: string[];
  sourceDependencies: string[];
  sourceManifestHash: string;
  locksManifest: string[];
  privacyAccessConstraints: string[];
  unresolvedIssueRefs: string[];
  futureObligations: string[];
  permittedActions: string[];
  readyGates: OutcomeGate[];
  flags: OutcomeStageFlags;
  nextAction: NextActionToken;
  nextExternalActionAuthorized: false; // §3 硬 false，不重放
  createdAt: string;
};

export function isAcceptedOrGranted(decision: string): boolean {
  return decision === "ACCEPTED" || decision === "GRANTED";
}

/** 上游 Gate（§33 POST_DECISION_INTAKE）：decision 源核＋scope 匹配。 */
export function intakeVerified(params: { decision: string; sourceVerified: boolean; postDecisionProcessingAllowed: boolean }): boolean {
  return params.sourceVerified && params.postDecisionProcessingAllowed && isAcceptedOrGranted(params.decision);
}
