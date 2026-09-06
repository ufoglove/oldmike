/**
 * Evidence-Driven Manuscript & Scientific Writing Studio Contract (V3-U15-FULL)
 * Spec: docs/stage15/spec-v3-4.0.md §1, §3, §4, §5, §6, §7, §8, §9, §10, §12, §13, §14, §16, §20, §24, §26, §29, §30
 *
 * Implements:
 * 1. Intake of Stage 14 AnalysisResultsSnapshot (zero re-entry)
 * 2. Immutable Result Facts Layer binding (ResultFact references with SHA-256 seal)
 * 3. ManuscriptWorkspace & WritingWorkOrder (modes: FORMAL_SCIENTIFIC_DRAFT, PARTIAL_EVIDENCE_DRAFT, PLANNING_OUTLINE)
 * 4. Claim–Evidence Map (BACKGROUND, GAP, THEORY, METHOD, RESULT, INTERPRETATION)
 * 5. Structured Chapter Builders (Introduction, Methods [planned vs performed], Results, Discussion, Conclusion, Abstract)
 * 6. Publication Tables & Figures embedding (Table 1 & Figure 1 bound directly to ResultFacts)
 * 7. ManuscriptEvidencePackage & ManuscriptWritingSnapshot immutable handoff for Stage 16 (scientific-review)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type AnalysisResultsSnapshot } from "./analysis-execution-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const MANUSCRIPT_WRITING_CONTRACT_VERSION = "manuscript-writing/1.0.0" as const;

// -------------------------------------------------------------
// §4 Manuscript Modes & Access Roles
// -------------------------------------------------------------
export type ManuscriptWritingMode =
  | "FORMAL_SCIENTIFIC_DRAFT"
  | "PARTIAL_EVIDENCE_DRAFT"
  | "PLANNING_OUTLINE"
  | "AUTHOR_MANUSCRIPT_IMPORT"
  | "DEVELOPMENT_FIXTURE";

export type WritingWorkOrder = {
  workOrderId: string;
  projectId: string;
  manuscriptId: string;
  targetJournalCategory: string; // e.g. "Safety Science / Education & Tech (Q1)"
  writingMode: ManuscriptWritingMode;
  formalWritingAllowed: boolean;
  includedRqRefs: string[];
  authorizedAuthorshipRoles: string[]; // e.g. ["第一作者 / 通訊作者", "共同作者"]
  budgetWordLimit: number;
  status: "AUTHORIZED" | "IN_PROGRESS" | "DRAFT_READY_FOR_REVIEW";
};

// -------------------------------------------------------------
// §9 & §10 Claim-Evidence Mapping & Typed AST Nodes
// -------------------------------------------------------------
export type ClaimType =
  | "BACKGROUND"
  | "GAP"
  | "THEORY"
  | "METHOD"
  | "RESULT"
  | "INTERPRETATION"
  | "LIMITATION"
  | "CONCLUSION";

export type ClaimEvidenceLink = {
  claimId: string;
  sectionId: string;
  claimText: string;
  claimType: ClaimType;
  boundSourceRefId: string; // e.g. Fact ID or Citation ID
  evidenceRelation: "SUPPORTS" | "PARTIAL" | "CONTRADICTS" | "BACKGROUND_ONLY";
  isVerified: boolean;
};

export type ManuscriptParagraph = {
  paragraphId: string;
  order: number;
  content: string;
  boundFactIds: string[]; // Bound to immutable ResultFact
  citationSourceRefs: string[]; // Bound to CitationSource
  isLocked: boolean;
};

export type ManuscriptSection = {
  sectionId: string;
  semanticSectionId: "TITLE_ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "DISCUSSION" | "CONCLUSION";
  titleZh: string;
  titleEn: string;
  wordCount: number;
  paragraphs: ManuscriptParagraph[];
  isLocked: boolean;
};

// -------------------------------------------------------------
// §8 Results Storyboard & Discussion Evidence Matrix
// -------------------------------------------------------------
export type StoryboardRow = {
  rqRef: string;
  hypothesisRef: string;
  boundResultFactIds: string[];
  boundTableRefs: string[];
  boundFigureRefs: string[];
  outcomeSummaryZh: string;
  isStatisticallySignificant: boolean;
};

// -------------------------------------------------------------
// §26 Manuscript Workspace
// -------------------------------------------------------------
export type ManuscriptWorkspace = {
  workspaceId: string;
  projectId: string;
  manuscriptId: string;
  currentRevision: number;
  sourceAnalysisSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;
  writingMode: ManuscriptWritingMode;

  workOrder: WritingWorkOrder;
  storyboardRows: StoryboardRow[];
  sections: ManuscriptSection[];
  claimEvidenceLinks: ClaimEvidenceLink[];

  // Embedded Table & Figure Refs from Stage 14
  embeddedTableRefs: string[];
  embeddedFigureRefs: string[];

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW" | "MANUSCRIPT_CORE_DRAFT_ASSEMBLED" | "WRITING_SCOPE_AND_SOURCES_READY";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §30 ManuscriptEvidencePackage (per spec §30 — Evidence Package)
// -------------------------------------------------------------
export type ManuscriptEvidencePackage = {
  packageId: string; // e.g. "mevp_<uuid>"
  workspaceId: string;
  projectId: string;
  manuscriptId: string;
  scopeAccounting: {
    mainText: string[];
    table: string[];
    figure: string[];
    supplement: string[];
    otherManuscriptWithDisclosure: string[];
    outOfScopeWithReason: string[];
    notPerformedWithReason: string[];
  };
  storylineRef: string;
  sectionBriefRefs: string[];
  methodsSourceMap: string[];
  resultUsageRefs: string[];
  claimEvidenceMapRefs: string[];
  quoteLocatorRefs: string[];
  tableUsageRefs: string[];
  figureUsageRefs: string[];
  citationManifestRef: string;
  bibliographyManifestRef: string;
  zoteroReferenceManifestRef: string;
  terminologyBindingRef: string;
  journalWritingProfileRef: string;
  reportingGuidelineCoverageRef: string;
  perSectionQaRefs: string[];
  approvedScopes: string[];
  unresolvedIssueRefs: string[];
  upstreamVersions: string[];
  aiWritingAuditSummaryRef: string;
  disclosureInputsRef: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §30 ManuscriptWritingSnapshot (Immutable handoff to Stage 16)
// -------------------------------------------------------------
export type ManuscriptWritingSnapshot = {
  snapshotId: string; // e.g. "mwsnap_<uuid>"
  schemaVersion: "manuscript-writing/1.0.0";
  stageKey: "V3-U15";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "results-writing";
  nextStageId: "scientific-review"; // Stage 16: 老麥科學內容審查、Reviewer #2與逐項修訂
  sourceAnalysisSnapshotId: string;
  sourceAnalysisSnapshotContentHashSha256: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  manuscriptRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    writingMode: ManuscriptWritingMode;
    totalWordCount: number;
  };

  // Content References
  sectionRefs: string[];
  boundResultFactIds: string[];
  boundCitationSourceRefs: string[];
  embeddedTableRefs: string[];
  embeddedFigureRefs: string[];

  // Integrity & QA
  isNumericDataVerifiablyBound: boolean;
  hasDiscussionGhostDataAvoided: boolean;
  hasNonSignificantOutcomesIncludedHonesty: boolean;

  // Evidence Package pointer (spec §30)
  evidencePackageId: string;
  evidencePackageContentHashSha256: string;

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §30 Stage 16 receiver-side contract (read-only consumer shape)
// -------------------------------------------------------------
export type Stage16ReceiverState = {
  receiverVersion: "scientific-review-receiver/1.0.0";
  stageKey: "V3-U16-RECEIVER";
  workspaceId: string;
  projectId: string;
  manuscriptId: string;
  sourceManuscriptWritingSnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  writingMode: ManuscriptWritingMode;
  decision: string;
  decisionRationale: string;
  boundResultFactCount: number;
  boundCitationSourceCount: number;
  embeddedTableCount: number;
  embeddedFigureCount: number;
  totalWordCount: number;
  pendingUnresolvedIssueCount: number;
  readyForReview: boolean; // false if evidence integrity missing
  receiverNotes: string[];
  reEntryPoint: {
    route: "manuscript-writing";
    action: "initialize";
    snapshotId: string;
  };
  createdAt: string;
};
