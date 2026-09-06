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

  route: SubmissionRoute;
  profile: RouteProfile;
  ruleSnapshots: OfficialRuleSnapshot[];

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
// §8 Error codes
// -------------------------------------------------------------
export const FINAL_SUBMISSION_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "SOURCE_HASH_MISMATCH",
  "COMPLIANCE_SCOPE_NOT_AUTHORIZED",
  "SOURCE_STALE",
  "RULE_SOURCE_UNAVAILABLE",
  "ROUTE_PROFILE_NOT_FOUND",
  "RENDERER_UNAVAILABLE",
  "DOCUMENT_HASH_MISMATCH",
  "APPROVAL_NOT_VERIFIED",
  "APPROVAL_SCOPE_MISMATCH",
  "FREEZE_NOT_CONFIRMED",
  "PACKAGE_LOCKED",
  "PACKAGE_NOT_LOCKED",
  "ANONYMIZATION_QA_FAILED",
  "SENSITIVE_CONTENT_DETECTED",
  "EXPORT_FORMAT_UNSUPPORTED",
  "HANDOFF_SAVE_FAILED",
] as const;

export type FinalSubmissionErrorCode = (typeof FINAL_SUBMISSION_ERROR_CODES)[number];
