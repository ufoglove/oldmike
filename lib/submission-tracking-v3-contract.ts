/**
 * Submission Tracking & Review Cycles Contract (V3-U19-FULL)
 * Spec: docs/stage19/spec-v3-4.0.md
 *
 * Implements (spec sections 1-9):
 * 1. Intake of Stage 18 FinalSubmissionPackageSnapshot (zero re-entry)
 * 2. Submission work order + pre-submit re-verification
 * 3. Human-guided / genuinely-authorized operations (GUIDED_MANUAL; no fake endpoint)
 * 4. Real receipt & case verification (USER_REPORTED vs verified sources)
 * 5. Status timeline, deadlines & notifications
 * 6. Real external review opinions (isolated from U09/U16 simulated)
 * 7. Old Mike per-item strategy, revision & response
 * 8. Reuse U14–U18; new revised package + new authorization → re-submit (R1 ≠ R0)
 * 9. Formal decision & downstream routing → SubmissionTrackingSnapshot → U20
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type FinalSubmissionPackageSnapshot } from "./final-submission-v3-contract.ts";

export const SUBMISSION_TRACKING_CONTRACT_VERSION = "submission-tracking/1.0.0" as const;

// -------------------------------------------------------------
// §1-2 Submission work order
// -------------------------------------------------------------
export type SubmissionRoute = "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";

export type SubmissionWorkOrder = {
  workOrderId: string;
  projectId: string;
  packageSnapshotId: string;
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  round: number; // R0 initial / R1 resubmission / …
  status: "DRAFT" | "PRE_SUBMIT_REVERIFY" | "AUTHORIZED_ATTEMPT" | "RECEIPT_VERIFIED" | "UNDER_REVIEW" | "REVISION_REQUIRED" | "RE_SUBMITTED" | "DECISIONED" | "CLOSED";
};

// -------------------------------------------------------------
// §3 External attempt (reservation → dispatch → outcome)
// -------------------------------------------------------------
export type AttemptOutcome =
  | "NOT_DISPATCHED"
  | "DISPATCHED"
  | "OUTCOME_UNKNOWN"
  | "RECEIPT_VERIFIED"
  | "FAILED"
  | "CANCELLED";

export type ExternalAttempt = {
  attemptId: string;
  workOrderId: string;
  target: string;
  actorAccount: string;
  operation: "SUBMIT" | "POST_REPLY" | "WITHDRAW" | "TRANSFER";
  contentHash: string; // binds to exact bytes sent
  authorizedBy: string;
  authorizedUntil: string;
  reservationStatus: "RESERVED" | "DISPATCHED" | "OUTCOME_UNKNOWN" | "VERIFIED" | "FAILED";
  outcome: AttemptOutcome;
  receiptReference?: string;
  note: string;
};

// -------------------------------------------------------------
// §5 Events & receipts (real sources only)
// -------------------------------------------------------------
export type EventSourceTier =
  | "USER_REPORTED"
  | "DOCUMENT_CHECKED"
  | "PROVIDER_EVENT"
  | "OFFICIAL_PORTAL_OBSERVATION"
  | "OFFICIAL_RECEIPT";

export type SubmissionEvent = {
  eventId: string;
  workOrderId: string;
  timestamp: string;
  eventType: "ATTEMPT" | "RECEIPT" | "STATUS_CHANGE" | "REVIEW_RECEIVED" | "DECISION" | "REVISION_REQUEST" | "DEADLINE";
  sourceTier: EventSourceTier;
  sourceRef: string;
  description: string;
  verified: boolean; // only true when official receipt/portal observation
  rawPayloadHash?: string;
};

export type ReceiptVerification = {
  receiptId: string;
  workOrderId: string;
  caseId: string;
  receivedAt: string;
  verifiedAgainst: "USER_REPORTED" | "DOCUMENT_CHECKED" | "PROVIDER_EVENT" | "OFFICIAL_PORTAL_OBSERVATION" | "OFFICIAL_RECEIPT";
  sourceRef: string;
  verified: boolean;
  note: string;
};

// -------------------------------------------------------------
// §7 External review & Response Matrix (isolated from simulated)
// -------------------------------------------------------------
export type ExternalReview = {
  reviewId: string;
  workOrderId: string;
  round: number;
  reviewerLabel: string; // real reviewer identity only when verified
  receivedAt: string;
  rawTextHash: string;
  originalTextRef: string;
  items: ExternalReviewItem[];
  sourceVerified: boolean;
};

export type ExternalReviewItem = {
  itemId: string;
  reviewId: string;
  originalQuote: string;
  locationRef: string;
  round: number;
  category: "LOGIC" | "METHOD" | "STATISTICS" | "REPORTING" | "CITATION" | "LANGUAGE" | "ETHICS" | "OTHER";
  decision: "ACCEPT_AND_REVISE" | "PARTIAL_ACCEPT" | "DISAGREE_WITH_EVIDENCE" | "REQUEST_CLARIFICATION" | "OUT_OF_SCOPE_WITH_REASON";
  responseDraft: string;
  actualChangeRef?: string; // must point to real evidence
  status: "PENDING" | "DRAFTED" | "REVISED" | "RESPONDED" | "VERIFIED";
  upstreamRequestRef?: string;
};

// -------------------------------------------------------------
// §8 Upstream reuse & revised package
// -------------------------------------------------------------
export type UpstreamRevisionRef = {
  refId: string;
  destinationStage: "analysis-execution" | "data-governance" | "manuscript" | "scientific-review" | "translation-polish" | "final-compliance";
  changeRequestRef: string;
  returnTarget: { route: "submission-tracking"; workOrderId: string; reviewId?: string; itemId?: string };
  status: "PENDING" | "RESOLVED" | "BLOCKED";
};

// -------------------------------------------------------------
// §9 SubmissionTrackingSnapshot (immutable handoff to U20)
// -------------------------------------------------------------
export type FormalDecision =
  | "NOT_DECISIONED"
  | "ACCEPTED"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECTED"
  | "TRANSFERRED"
  | "WITHDRAWN"
  | "GRANTED"
  | "NOT_GRANTED"
  | "REVIEW_REQUIRED"; // NSTC/TPR institutional phase

export type SubmissionTrackingSnapshot = {
  snapshotId: string;
  schemaVersion: "submission-tracking/1.0.0";
  stageKey: "V3-U19";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "submission-tracking";
  nextStageId: "post-acceptance"; // Stage 20: 接受/核定後作業與成果管理
  sourceFinalSubmissionPackageSnapshotId: string;
  sourceFinalSubmissionPackageSnapshotHash: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  documentPurpose: string;

  decision: FormalDecision;
  decisionRationale: string;
  submissionExecutionAuthorized: boolean; // carries U18=false; becomes true only by explicit U19 authorization
  activeSubmissionGuard: boolean;

  workOrder: SubmissionWorkOrder;
  attempts: ExternalAttempt[];
  events: SubmissionEvent[];
  receipts: ReceiptVerification[];
  externalReviews: ExternalReview[];
  responseMatrixRef: string;
  upstreamRevisionRefs: UpstreamRevisionRef[];

  // Resubmission loop (R1 ≠ R0)
  revisedPackageSnapshotId?: string;
  resubmissionAttemptId?: string;

  unresolvedIssueRefs: string[];
  laterStageRequirements: string[];
  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §9 Stage 20 receiver state
// -------------------------------------------------------------
export type Stage20ReceiverState = {
  receiverVersion: "post-acceptance-receiver/1.0.0";
  stageKey: "V3-U20-RECEIVER";
  workspaceId: string;
  projectId: string;
  sourceSubmissionTrackingSnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  decision: string;
  round: number;
  activeSubmissionGuard: boolean;
  submissionExecutionAuthorized: boolean;
  eventCount: number;
  reviewCount: number;
  readyForPostAcceptance: boolean; // only true with real accepted/granted decision
  receiverNotes: string[];
  reEntryPoint: { route: "submission-tracking"; action: "initialize"; snapshotId: string };
  createdAt: string;
};

// -------------------------------------------------------------
// §9 Error codes
// -------------------------------------------------------------
export const SUBMISSION_TRACKING_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "SOURCE_HASH_MISMATCH",
  "PACKAGE_NOT_LOCKED",
  "SUBMISSION_NOT_AUTHORIZED",
  "ACTIVE_SUBMISSION_GUARD",
  "ATTEMPT_ALREADY_DISPATCHED",
  "ATTEMPT_OUTCOME_UNKNOWN",
  "RECEIPT_NOT_VERIFIED",
  "EVENT_SOURCE_UNTRUSTED",
  "INBOUND_SIGNATURE_INVALID",
  "REVIEW_NOT_VERIFIED",
  "RESPONSE_EVIDENCE_MISSING",
  "REVISION_PACKAGE_NOT_LOCKED",
  "ROUND_RESUBMISSION_GUARD",
  "WITHDRAWAL_NOT_CONFIRMED",
  "PROJECT_ACCESS_DENIED",
  "EXTERNAL_PROCESSING_BLOCKED",
  "BUDGET_LIMIT_REACHED",
  "HANDOFF_SAVE_FAILED",
] as const;

export type SubmissionTrackingErrorCode = (typeof SUBMISSION_TRACKING_ERROR_CODES)[number];
