/**
 * Scientific Review, Reviewer #2 Challenge & Revision Contract (V3-U16-FULL)
 * Spec: docs/stage16/spec-v3-4.0.md
 *
 * Implements (spec sections 1-7):
 * 1. Intake of Stage 15 ManuscriptWritingSnapshot (zero re-entry)
 * 2. Review Work Order & Coverage
 * 3. Mechanical QA + role-based review + Reviewer #2 constructive challenge
 * 4. Finding verification, de-duplication & adjudication
 * 5. Author Response Matrix (internal)
 * 6. Re-review loop
 * 7. Scientific Meaning Constraints (numbers, N, methods, direction, timepoint,
 *    hypothesis status, confirmatory/exploratory, uncertainty, citations,
 *    quotes, terminology, causal boundary per-claim)
 * 8. ScientificReviewSnapshot immutable handoff for Stage 17 (translation-polish)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type ManuscriptWritingSnapshot } from "./manuscript-writing-contract.ts";

export const SCIENTIFIC_REVIEW_CONTRACT_VERSION = "scientific-review/1.0.0" as const;

// -------------------------------------------------------------
// §1-2 Review Work Order & Coverage
// -------------------------------------------------------------
export type ReviewWorkOrder = {
  workOrderId: string;
  projectId: string;
  manuscriptId: string;
  reviewRound: number;
  coverageSections: string[]; // semanticSectionIds under review
  coverageGoals: PrimaryGoalId[];
  budgetFindingLimit: number;
  status: "AUTHORIZED" | "IN_PROGRESS" | "FINDINGS_READY" | "REVISION_IN_PROGRESS" | "RE_REVIEW_REQUIRED" | "SCIENTIFICALLY_APPROVED";
};

// -------------------------------------------------------------
// §4 Finding (persisted shape)
// -------------------------------------------------------------
export type FindingSeverity = "BLOCKER" | "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION";
export type FindingVerificationStatus = "UNVERIFIED" | "VERIFIED" | "DUPLICATE_OF" | "NEEDS_SOURCE" | "NOT_APPLICABLE";
export type FindingDecision =
  | "OPEN"
  | "ACCEPTED"
  | "IN_REVISION"
  | "RESOLVED_PENDING_REVIEW"
  | "VERIFIED_RESOLVED"
  | "ACCEPTED_RISK"
  | "REJECTED_WITH_JUSTIFICATION"
  | "NOT_APPLICABLE";

export type ScientificFinding = {
  findingId: string;
  reviewRunId: string;
  reviewerRole: "REVIEWER_1" | "REVIEWER_2" | "METHODS_REVIEWER" | "STATISTICS_REVIEWER" | "DOMAIN_REVIEWER" | "EDITOR";
  simulated: true; // All AI review is SIMULATED REVIEW
  issueType: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  basis: {
    reviewedVersion: string;
    sectionRef: string; // semanticSectionId or sectionId
    paragraphRef?: string;
    claimId?: string;
    resultFactId?: string;
    citationRef?: string;
  };
  alternativeExplanation?: string; // Reviewer #2 constructive challenge requirement
  minimalRevisionPath?: string; // Reviewer #2 must offer minimal path
  verificationStatus: FindingVerificationStatus;
  duplicateOfFindingId?: string;
  impact: string;
  correctionOptions: string[];
  owner: string;
  blocksActions: string[];
  returnTarget: { route: string; sectionRef?: string; paragraphRef?: string };
  decision: FindingDecision;
  authorResponse?: string;
  authorCanDisagreeWithReason: boolean; // authors may disagree with justification
  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §4 Revision & Re-review
// -------------------------------------------------------------
export type RevisionProposal = {
  revisionId: string;
  findingId: string;
  candidateText: string; // Suggested Rewrite is only a candidate
  status: "CANDIDATE" | "ADOPTED" | "REJECTED_WITH_REASON";
  adoptedLowRiskUnlocked: boolean; // authorized low-risk unlocked edits may auto-apply
  requiresHumanConfirmation: boolean;
  createdBy: string;
  createdAt: string;
};

export type ReReviewDecision =
  | "SCIENTIFICALLY_APPROVED"
  | "RE_REVIEW_REQUIRED"
  | "BLOCKED"
  | "CLOSED_WITH_UNRESOLVED";

// -------------------------------------------------------------
// §7 Scientific Meaning Constraints (meaning lock)
// -------------------------------------------------------------
export type MeaningConstraintType =
  | "NUMERIC_VALUE"
  | "N_AND_DENOMINATOR"
  | "METHOD"
  | "COMPARISON_DIRECTION"
  | "TIMEPOINT"
  | "HYPOTHESIS_STATUS"
  | "CONFIRMATORY_OR_EXPLORATORY"
  | "NECESSARY_UNCERTAINTY"
  | "LIMITATION"
  | "CITATION_INTENT"
  | "DIRECT_QUOTE"
  | "TERMINOLOGY"
  | "CAUSAL_BOUNDARY";

export type MeaningConstraint = {
  constraintId: string;
  type: MeaningConstraintType;
  sectionRef: string;
  paragraphRef?: string;
  claimId?: string;
  protectedValue: string; // the value/phrase that must not change
  rationale: string;
  isLocked: boolean;
  sourceRef?: string; // e.g. fact id or citation id
};

// -------------------------------------------------------------
// §5 Upstream Reflow (analysis / data / execution review requests)
// -------------------------------------------------------------
export type UpstreamReviewRequest = {
  requestId: string;
  kind: "ANALYSIS_REVIEW" | "DATA_OR_SCORING" | "EXECUTION" | "LITERATURE_NEED";
  destinationStage: "analysis-execution" | "data-governance" | "formal-execution" | "literature";
  findingId: string;
  requestReason: string;
  status: "PENDING" | "RESOLVED" | "BLOCKED";
  returnTarget: { route: "scientific-review"; findingId: string };
  createdAt: string;
};

// -------------------------------------------------------------
// §7 ScientificReviewSnapshot (immutable handoff to Stage 17)
// -------------------------------------------------------------
export type ScientificReviewSnapshot = {
  snapshotId: string;
  schemaVersion: "scientific-review/1.0.0";
  stageKey: "V3-U16";
  workspaceId: string;
  projectId: string;
  reviewRunId: string;
  workOrderId: string;
  stageId: "scientific-review";
  nextStageId: "translation-polish"; // Stage 17: 翻譯與學術潤稿
  sourceManuscriptWritingSnapshotId: string;
  sourceManuscriptWritingSnapshotHash: string;
  sourceManuscriptWritingDecision: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;

  reviewRound: number;
  decision: "SCIENTIFICALLY_APPROVED" | "RE_REVIEW_REQUIRED" | "BLOCKED" | "CLOSED_WITH_UNRESOLVED";
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    coverageSections: string[];
    totalWordCount: number;
  };

  // Content references
  findingRefs: string[];
  openFindingRefs: string[];
  blockerFindingRefs: string[];
  resolvedFindingRefs: string[];
  revisionProposalRefs: string[];
  reReviewRefs: string[];
  meaningConstraintRefs: string[];
  upstreamRequestRefs: string[];
  authorResponseMatrixRef: string;

  // Integrity & QA
  mechanicalQaPassed: boolean;
  reviewer2ChallengeProvided: boolean;
  allSimulated: boolean; // true: every AI review is simulated
  meaningConstraintsHeld: boolean;
  noFabricatedFindings: boolean;
  authorDisagreementRespectCount: number;

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §7 Stage 17 Receiver State (non-empty fallback if U17 not built)
// -------------------------------------------------------------
export type Stage17ReceiverState = {
  receiverVersion: "translation-polish-receiver/1.0.0";
  stageKey: "V3-U17-RECEIVER";
  workspaceId: string;
  projectId: string;
  sourceScientificReviewSnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  decision: string;
  openFindingCount: number;
  blockerFindingCount: number;
  meaningConstraintCount: number;
  readyForLanguage: boolean; // true only if meaning constraints held & no open blockers
  receiverNotes: string[];
  reEntryPoint: { route: "scientific-review"; action: "initialize"; snapshotId: string };
  createdAt: string;
};
