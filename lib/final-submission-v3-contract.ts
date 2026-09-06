/**
 * Final Compliance, Submission Package & Deliverables Contract (V3-U18-FULL)
 * Spec: docs/stage18/spec-v3-4.0.md
 *
 * Implements (spec sections 1-8):
 * 1. Intake of Stage 17 LanguageQualitySnapshot (zero re-entry)
 * 2. Target journal / call / institution rule re-verification
 * 3. Three-route applicable requirements matrix
 * 4. Target-format derived documents
 * 5. Statements, citations, authors/PI & attachment verification
 * 6. Anonymization, rights, privacy & real export QA
 * 7. Candidate Freeze → human confirmation on fixed file version → Package Lock
 * 8. FinalSubmissionPackageSnapshot immutable handoff for Stage 19
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type LanguageQualitySnapshot } from "./language-quality-v3-contract.ts";

export const FINAL_SUBMISSION_CONTRACT_VERSION = "final-submission/1.0.0" as const;

// -------------------------------------------------------------
// §4 FinalPackageWorkOrder & target options
// -------------------------------------------------------------
export type TargetOption =
  | "JOURNAL_INITIAL_SUBMISSION"
  | "NSTC_GENERAL_APPLICATION"
  | "MOE_TPR_APPLICATION"
  | "LOCAL_PREFLIGHT";

export type FinalPackageWorkOrder = {
  workOrderId: string;
  projectId: string;
  documentId: string;
  documentPurpose: string;
  route: SubmissionRoute;
  target: TargetOption;
  targetJournalOrProgram: string;
  targetYearOrCall: string;
  institution: string;
  submissionDestination: string;
  allowedScopeRefs: string[];
  outputFormats: string[];
  audience: string[];
  excludedAssets: string[];
  wordCountScope: string;
  templateVersionRef: string;
  externalProcessingAuthorized: boolean;
  budget: number;
  retryLimit: number;
  approvalPolicyRef: string;
  status: "DRAFT" | "BUILDING" | "CANDIDATE_BUILT" | "QA_ISSUES" | "QA_PASSED" | "FROZEN_FOR_APPROVAL" | "APPROVAL_PENDING" | "READY_FOR_RELEASE" | "LOCKED_READY";
};

// -------------------------------------------------------------
// §5 Official Rule Resolver (7 verification statuses)
// -------------------------------------------------------------
export type RuleVerificationStatus =
  | "VERIFIED_APPLICABLE"
  | "PREVIOUS_YEAR_REFERENCE"
  | "PENDING_OFFICIAL_ANNOUNCEMENT"
  | "SOURCE_UNAVAILABLE"
  | "CONFLICTING"
  | "UNVERIFIED"
  | "SUPERSEDED";

export type RequirementOrigin = "OFFICIAL_REQUIREMENT" | "INTERNAL_POLICY" | "AUTHOR_PREFERENCE" | "AI_SUGGESTION";

export type RequirementStatus =
  | "MET"
  | "PARTIAL"
  | "MISSING"
  | "NOT_APPLICABLE_WITH_REASON"
  | "UNKNOWN"
  | "UNVERIFIED"
  | "CONFLICTING"
  | "FAILED"
  | "STALE"
  | "AWAITING_THIRD_PARTY";

// -------------------------------------------------------------
// §8 SubmissionFieldMap
// -------------------------------------------------------------
export type SubmissionFieldMap = {
  mapId: string;
  target: TargetOption;
  fields: Array<{
    fieldRef: string;
    label: string;
    officialSourceRef: string;
    fieldType: string;
    lengthLimit: number;
    countingConvention: string;
    valueSourceRef: string;
    requiresHumanDeclaration: boolean;
    preparationState: "NOT_READY" | "PREPARED" | "READY";
    outputLocation: string;
  }>;
};

// -------------------------------------------------------------
// §13 / §28 Visibility & bundle split
// -------------------------------------------------------------
export type AudienceVisibility =
  | "REVIEWER_VISIBLE"
  | "EDITOR_ONLY"
  | "INSTITUTION_ONLY"
  | "AUTHORITY_SUBMISSION"
  | "INTERNAL_AUDIT"
  | "PUBLICATION_CANDIDATE";

export type BundleKind = "EXTERNAL_SUBMISSION_BUNDLE" | "INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE";

export type BundleFile = {
  fileId: string;
  logicalRole: string;
  recipientAudience: AudienceVisibility;
  sourceEditionRef: string;
  sourceHash: string;
  exportHash: string;
  filename: string;
  mime: string;
  byteLength: number;
  pageCountOrWordCount: string;
  renderer: string;
  anonymizationApplied: boolean;
  permissionRef: string;
  privacyStatus: string;
  required: boolean;
  ruleRefs: string[];
  qualityState: "CANDIDATE" | "QA_PASSED" | "FROZEN" | "LOCKED";
  downloadAccess: string;
  reviewerVisibility: AudienceVisibility;
};

export type BundleManifest = {
  manifestId: string;
  bundleKind: BundleKind;
  files: BundleFile[];
  requiredFileReconciliationPassed: boolean;
  createdAt: string;
};

// -------------------------------------------------------------
// §29 Package state machine
// -------------------------------------------------------------
export type PackageState =
  | "DRAFT"
  | "BUILDING"
  | "CANDIDATE_BUILT"
  | "QA_ISSUES"
  | "QA_PASSED"
  | "FROZEN_FOR_APPROVAL"
  | "APPROVAL_PENDING"
  | "READY_FOR_RELEASE"
  | "LOCKED_READY"
  | "PARTIAL_PREFLIGHT"
  | "BLOCKED"
  | "STALE"
  | "SUPERSEDED"
  | "WITHDRAWN_FROM_RELEASE";

// -------------------------------------------------------------
// §30 ready_for_action (three-route precise)
// -------------------------------------------------------------
export type ReadyForAction =
  | "READY_FOR_AUTHOR_SUBMISSION"
  | "READY_FOR_INSTITUTIONAL_REVIEW"
  | "READY_FOR_INSTITUTIONAL_SUBMISSION"
  | "PREFLIGHT_ONLY"
  | "DRAFT_PACKAGE_WITH_GAPS";

// -------------------------------------------------------------
// §1-3 Submission purpose & three-route profiles
// -------------------------------------------------------------
export type SubmissionRoute = "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";

export type JournalProfile = {
  profileId: string;
  route: "JOURNAL_SCI_SSCI";
  targetJournal: string;
  articleType: string;
  requirements: string[];
  reportingGuideline: string;
  anonymizationRequired: boolean;
  coverLetterRequired: boolean;
  titlePageRequired: boolean;
};

export type NstcProfile = {
  profileId: string;
  route: "NSTC_GENERAL";
  targetYear: string;
  discipline: string;
  projectType: string;
  eligibility: string[];
  sections: string[];
  budgetWorkPackages: string[];
  institutionalReviewRequired: boolean;
  institutionalSubmissionRequired: boolean;
};

export type MoeTprProfile = {
  profileId: string;
  route: "MOE_TPR";
  mainCourse: string;
  teachingProblem: string;
  studentOutcomes: string;
  assessmentPlan: string;
  budget: string;
  statements: string[];
  ethicsOrCooperationDocs: string[];
  institutionalProcedure: string;
};

export type RouteProfile = JournalProfile | NstcProfile | MoeTprProfile;

// -------------------------------------------------------------
// §4 Rules with sources
// -------------------------------------------------------------
export type OfficialRuleSnapshot = {
  ruleId: string;
  route: SubmissionRoute;
  source: string;
  clause: string;
  applicableYearOrPhase: string;
  version: string;
  hash: string;
  note: string;
};

// -------------------------------------------------------------
// §5 ApprovalSubjectManifest & Candidate Freeze / Package Lock
// -------------------------------------------------------------
export type PackageDocument = {
  documentId: string;
  kind: "MAIN_TEXT" | "TITLE_PAGE" | "COVER_LETTER" | "REPORTING_CHECKLIST" | "REFERENCES" | "STATEMENTS" | "ATTACHMENT" | "APPROVAL_RECORD";
  filename: string;
  contentHash: string;
  byteSize: number;
  format: "markdown" | "docx" | "pdf" | "latex" | "json";
  status: "CANDIDATE" | "FROZEN" | "LOCKED";
  approvalDigest?: string;
};

export type ApprovalSubjectManifest = {
  manifestId: string;
  projectId: string;
  documents: PackageDocument[];
  contentHash: string; // hash of the frozen byte-set (no approval events inside)
  createdById: string;
  createdAt: string;
};

export type AuthorApprovalRecord = {
  approvalId: string;
  subjectManifestId: string;
  documentDigest: string; // binds to specific frozen bytes
  approverType: "HUMAN" | "VERIFIED_OFFLINE";
  approverLabel: string;
  verifiedOfflineRef?: string;
  approvedAt: string;
};

// -------------------------------------------------------------
// §7 Package release & U19 receiver
// -------------------------------------------------------------
export type PackageReadiness =
  | "READY_FOR_AUTHOR_SUBMISSION" // journal
  | "READY_FOR_INSTITUTIONAL_REVIEW" // NSTC/TPR pre-review
  | "READY_FOR_INSTITUTIONAL_SUBMISSION" // NSTC/TPR ready
  | "NOT_READY";

export type FinalSubmissionPackageSnapshot = {
  snapshotId: string;
  schemaVersion: "final-submission/1.0.0";
  stageKey: "V3-U18";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "final-compliance";
  nextStageId: "submission-tracking"; // Stage 19: 正式送件與審查追蹤
  sourceLanguageQualitySnapshotId: string;
  sourceLanguageQualitySnapshotHash: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  documentPurpose: string;

  decision: PackageReadiness;
  decisionRationale: string;
  submissionExecutionAuthorized: false; // always false this round
  submissionStatus: "NOT_SUBMITTED_BY_THIS_STAGE";

  route: SubmissionRoute;
  profile: RouteProfile;
  ruleSnapshots: OfficialRuleSnapshot[];

  // Full-spec §29 state machine & §30 ready_for_action
  packageState: PackageState;
  readyForAction: ReadyForAction;

  // §4 work order / §8 field map / §13 visibility / §28 bundles
  workOrder: FinalPackageWorkOrder;
  fieldMap: SubmissionFieldMap;
  visibilityManifest: Array<{ fileId: string; audience: AudienceVisibility }>;
  externalBundle: BundleManifest;
  internalEvidencePackage: BundleManifest;

  documents: PackageDocument[];
  approvalSubjectManifest: ApprovalSubjectManifest;
  authorApprovals: AuthorApprovalRecord[];
  requiredAuthorApprovals: number;
  pendingAuthorApprovals: number;

  // QA & integrity
  anonymizationQaPassed: boolean;
  referencesQaPassed: boolean;
  renderQaPassed: boolean;
  freezeConfirmed: boolean;
  packageLocked: boolean;
  sensitiveContentExcluded: boolean;

  unresolvedIssueRefs: string[];
  laterStageRequirements: string[];
  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §7 Stage 19 receiver state
// -------------------------------------------------------------
export type Stage19ReceiverState = {
  receiverVersion: "submission-tracking-receiver/1.0.0";
  stageKey: "V3-U19-RECEIVER";
  workspaceId: string;
  projectId: string;
  sourceFinalSubmissionPackageSnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  decision: string;
  readiness: PackageReadiness;
  documentCount: number;
  locked: boolean;
  submissionExecutionAuthorized: boolean;
  readyForSubmissionTracking: boolean;
  receiverNotes: string[];
  reEntryPoint: { route: "final-compliance"; action: "initialize"; snapshotId: string };
  createdAt: string;
};

// -------------------------------------------------------------
// §8 Error codes (18 per full spec §32)
// -------------------------------------------------------------
export const FINAL_SUBMISSION_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "SOURCE_SCOPE_NOT_ALLOWED",
  "SOURCE_HASH_MISMATCH",
  "SOURCE_STALE",
  "RULE_SOURCE_UNAVAILABLE",
  "RULE_CONFLICT",
  "TARGET_DEADLINE_EXPIRED",
  "REQUIRED_EVIDENCE_MISSING",
  "MEANING_CHANGED",
  "AUTHOR_CONFIRMATION_MISSING",
  "APPROVAL_DIGEST_STALE",
  "RIGHTS_BLOCKED",
  "ANONYMIZATION_FAILED",
  "REQUIRED_RENDERER_UNSUPPORTED",
  "FILE_MANIFEST_MISMATCH",
  "PACKAGE_VERSION_CONFLICT",
  "EXTERNAL_PROCESSING_BLOCKED",
  "BUDGET_LIMIT_REACHED",
  "HANDOFF_SAVE_FAILED",
] as const;

export type FinalSubmissionErrorCode = (typeof FINAL_SUBMISSION_ERROR_CODES)[number];
