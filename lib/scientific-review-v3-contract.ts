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
// §5 Review Coverage Matrix & §7 Capability Manifest
// -------------------------------------------------------------
export type CoverageStatus =
  | "CHECKED_NO_ISSUE_FOUND"
  | "FINDINGS_PENDING"
  | "NOT_ASSESSED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type ReviewCoverageRow = {
  coverageId: string;
  reviewRunId: string;
  sectionRef: string; // semanticSectionId or claim key
  itemType: "SECTION" | "CLAIM" | "RESULT" | "METHOD" | "CITATION" | "TABLE" | "FIGURE" | "ETHICS";
  required: boolean;
  applicable: boolean;
  sourceAvailable: boolean;
  reviewMethod: "DETERMINISTIC_CHECK" | "MODEL_ASSISTED_REVIEW" | "HUMAN_SPECIALIST_REVIEW";
  checkedVersion: string;
  role: string;
  status: CoverageStatus;
  reason: string;
  findingRefs: string[];
};

export type ReviewCoverageMatrix = {
  matrixRef: string;
  reviewRunId: string;
  rows: ReviewCoverageRow[];
};

// §7 ReviewCapabilityManifest: which rules actually run vs suggestions vs unsupported
export type CapabilityKind = "RULE_EXECUTED" | "SUGGESTION_ONLY" | "NEEDS_EXTERNAL_TOOL" | "NEEDS_SPECIALIST" | "UNSUPPORTED";

export type ReviewCapabilityEntry = {
  capabilityId: string;
  label: string;
  kind: CapabilityKind;
  lastResult: "PASSED" | "FAILED" | "WARNING" | "NOT_ASSESSED" | "UNSUPPORTED";
  note: string;
};

export type ReviewCapabilityManifest = {
  manifestRef: string;
  reviewRunId: string;
  entries: ReviewCapabilityEntry[];
};

// -------------------------------------------------------------
// §8 Role library (9 review roles)
// -------------------------------------------------------------
export type ReviewRoleId =
  | "EDITOR_TRIAGE"
  | "DOMAIN_REVIEWER"
  | "THEORY_MECHANISM_REVIEWER"
  | "METHODS_REPRODUCIBILITY_REVIEWER"
  | "STATISTICAL_RESULTS_REVIEWER"
  | "EVIDENCE_CITATION_REVIEWER"
  | "ETHICS_INTEGRITY_REVIEWER"
  | "PRACTICE_APPLICATION_REVIEWER"
  | "REVIEWER_2_CHALLENGER";

export type ReviewRoleSpec = {
  roleId: ReviewRoleId;
  task: string;
  mustNot: string[];
  requiredSources: string[];
  outputSchema: string;
  minimumCapability: CapabilityKind;
  enabledForArticleTypes: string[];
};

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
export type FindingVerificationStatus = "DETECTED_CANDIDATE" | "CONFIRMED_BY_RULE" | "SUPPORTED_BY_SOURCE" | "NEEDS_HUMAN_REVIEW" | "NOT_SUPPORTED_BY_EVIDENCE" | "UNVERIFIED" | "VERIFIED" | "DUPLICATE_OF" | "NEEDS_SOURCE" | "NOT_APPLICABLE" | "RESOLVED";
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
  reviewerRole: ReviewRoleId;
  simulated: true; // All AI review is SIMULATED REVIEW
  findingOrigin: "DETERMINISTIC_RULE" | "MODEL_ASSISTED" | "HUMAN_ENTRY" | "REVIEWER_2_GENERATOR";
  issueType: string;
  category: "LOGIC" | "NOVELTY" | "THEORY" | "METHOD" | "STATISTICS" | "REPORTING" | "CITATION" | "ETHICS_PRIVACY" | "OVERLAP" | "TARGET_FIT" | "SOURCE_ACCESS" | "LANGUAGE_MEANING";
  severity: FindingSeverity;
  title: string;
  description: string;
  basis: {
    reviewedVersion: string;
    sourceHash?: string;
    sectionRef: string; // semanticSectionId or sectionId
    paragraphRef?: string;
    claimId?: string;
    typedNodeId?: string;
    tableOrFigureId?: string;
    resultFactId?: string;
    citationRef?: string;
    upstreamSourceRefs?: string[];
  };
  sourceExcerptRef?: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  rationale: string;
  alternativeExplanation?: string; // Reviewer #2 constructive challenge requirement
  minimalRevisionPath?: string; // Reviewer #2 must offer minimal path
  verificationStatus: FindingVerificationStatus;
  confidenceExplanation?: string;
  coverageLimit?: string;
  duplicateOfFindingId?: string;
  impact: string;
  impactScope: string;
  correctionOptions: string[];
  requiredAction: string;
  owner: string;
  blocksActions: string[];
  dueStage?: string;
  returnTarget: { route: string; sectionRef?: string; paragraphRef?: string };
  status: "OPEN" | "ASSIGNED" | "IN_REVISION" | "RESOLVED" | "CLOSED";
  disposition?: FindingDisposition;
  resolutionEvidenceRefs?: string[];
  recheckRefs?: string[];
  decision: FindingDecision;
  authorResponse?: string;
  authorCanDisagreeWithReason: boolean; // authors may disagree with justification
  adjudicatedBy?: string;
  adoptedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FindingDisposition =
  | "ACCEPT_AND_REVISE"
  | "PARTIAL_ACCEPT"
  | "DISAGREE_WITH_EVIDENCE"
  | "REQUEST_CLARIFICATION"
  | "NEEDS_SPECIALIST"
  | "OUT_OF_SCOPE_WITH_REASON"
  | "ACCEPT_LIMITATION_WITH_DISCLOSURE"
  | "INVALID_FINDING";

// -------------------------------------------------------------
// §31 Scientific Review Package & Language Polishing Handoff Package
// -------------------------------------------------------------
export type ScientificReviewPackage = {
  packageId: string;
  reviewRunId: string;
  workOrderRef: string;
  inputSourceRef: string;
  coverageMatrixRef: string;
  capabilityManifestRef: string;
  mechanicalQaRef: string;
  roleReportRefs: string[];
  reviewer2ReportRef: string;
  findingRegistryRef: string;
  adjudicationRefs: string[];
  revisionTaskRefs: string[];
  authorResponseMatrixRef: string;
  acceptedChangeManifestRef: string;
  upstreamRequestRefs: string[];
  reReviewRefs: string[];
  meaningConstraintRefs: string[];
  sourceManifestRef: string;
  aiAssistanceAuditRef: string;
  createdAt: string;
};

export type LanguagePolishingHandoffPackage = {
  packageId: string;
  reviewRunId: string;
  scientificRevisionRef: string;
  workLanguage: string;
  targetLanguage: string;
  terminologyBindingRef: string;
  meaningConstraintRefs: string[];
  protectedFactRefs: string[];
  protectedCitationRefs: string[];
  quoteUsageRefs: string[];
  necessaryQualifiers: string[];
  sectionScopeRefs: string[];
  fullManuscriptLanguageAllowed: boolean;
  languageAllowedScopeRefs: string[];
  forbiddenExternalContent: string[];
  laterFormatTodos: string[];
  createdAt: string;
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
  adjudicationRefs: string[];
  coverageMatrixRef: string;
  capabilityManifestRef: string;
  roleRunRefs: string[];
  reviewer2ReportRef: string;
  analysisReviewRequestRefs: string[];
  sourceUpdateAdoptionRefs: string[];
  scientificReviewPackageRef: string;
  languageHandoffPackageRef: string;

  // Scientific release state (spec §30)
  scientificReleaseState:
    | "DRAFT_REVIEW"
    | "REVISION_REQUIRED"
    | "WAITING_SOURCE_OR_SPECIALIST"
    | "PARTIAL_REVIEW_COMPLETE"
    | "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE"
    | "SOURCE_STALE"
    | "USE_BLOCKED";
  fullManuscriptLanguageAllowed: boolean;
  languageAllowedScopeRefs: string[];
  acceptedLimitations: string[];
  requiredSpecialistReviewDispositions: string[];
  laterStageRequirements: string[];

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
  scientificReleaseState: string;
  fullManuscriptLanguageAllowed: boolean;
  languageAllowedScopeRefs: string[];
  openFindingCount: number;
  blockerFindingCount: number;
  meaningConstraintCount: number;
  readyForLanguage: boolean; // true only if meaning constraints held & no open blockers
  receiverNotes: string[];
  reEntryPoint: { route: "scientific-review"; action: "initialize"; snapshotId: string };
  createdAt: string;
};

export const SCIENTIFIC_REVIEW_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "UPSTREAM_REFERENCE_MISSING",
  "SOURCE_HASH_MISMATCH",
  "REVIEW_SCOPE_NOT_AUTHORIZED",
  "FORMAL_RESULT_NOT_RELEASED",
  "PROJECT_ACCESS_DENIED",
  "SOURCE_STALE",
  "LOCKED_CONTENT",
  "REVISION_CONFLICT",
  "UNKNOWN_FACT_OR_CITATION",
  "READ_ONLY_RESULT_FACT",
  "QUOTE_USE_NOT_AUTHORIZED",
  "UNSUPPORTED_REVIEW_CAPABILITY",
  "SPECIALIST_REVIEW_REQUIRED",
  "UPSTREAM_REVIEW_PENDING",
  "SCIENTIFIC_RELEASE_BLOCKED",
  "EXTERNAL_PROCESSING_BLOCKED",
  "BUDGET_LIMIT_REACHED",
  "EXPORT_FORMAT_UNSUPPORTED",
  "HANDOFF_SAVE_FAILED",
] as const;

export type ScientificReviewErrorCode = (typeof SCIENTIFIC_REVIEW_ERROR_CODES)[number];
