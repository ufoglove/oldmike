/**
 * Literature Deepening and Gap / Novelty Verification Contract (V3-U05-FULL)
 * Spec: docs/stage05/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §20, §24, §25
 *
 * Implements:
 * 1. Intake of Stage 4 BlueprintPlanningSnapshot & EvidenceNeeds (zero re-entry)
 * 2. Tri-goal specific evaluation (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. ReviewScope & LiteratureSearchTask definition (Search Log, query, filters, truncation)
 * 4. Deduplication & StudyFamily relationships (VERSION_OF, EXTENDS, REPORTS_SAME_STUDY)
 * 5. Reading coverage separation (MACHINE_PROCESSED_PARTIAL vs FULLTEXT_REVIEWED)
 * 6. GapClaim Registry (claims, validation status, supporting & counterevidence)
 * 7. ClosestStudyMatrix & ContributionDelta (concrete differences, not mere technology piling)
 * 8. ReviewDecision (RETAIN_DIRECTION, REFINE_WITH_ACCEPTED_CHANGES, PROVISIONAL_EXPLORATION, RECONSIDER_TOPIC, INSUFFICIENT_EVIDENCE)
 * 9. BlueprintChangeProposal (non-destructive proposals back to blueprint)
 * 10. GapEvidenceSnapshot immutable handoff contract for Stage 6 (theory-mechanism)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import {
  type BlueprintPlanningSnapshot,
  type EvidenceNeed,
  type DownstreamRequirementItem,
  type TemporalStatus,
} from "./blueprint-planning-contract.ts";

export const GAP_EVIDENCE_CONTRACT_VERSION = "gap-evidence/1.0.0" as const;

// -------------------------------------------------------------
// §13 Gap Claim Categories & Validation Statuses
// -------------------------------------------------------------
export const STAGE05_GAP_TYPES = [
  "THEORETICAL",
  "MECHANISM",
  "EMPIRICAL",
  "METHOD",
  "DATA",
  "MEASUREMENT",
  "TEMPORAL",
  "POPULATION",
  "CONTEXT",
  "IMPLEMENTATION",
  "TEACHING_PRACTICE",
  "REPLICATION",
  "CROSS_DOMAIN",
] as const;
export type Stage05GapType = (typeof STAGE05_GAP_TYPES)[number];

export const GAP_CLAIM_KINDS = [
  "LACK_OF_RESEARCH",
  "INCONSISTENT_RESULTS",
  "METHODOLOGICAL_LIMITATION",
  "UNKNOWN_MECHANISM",
  "LONGITUDINAL_TRANSFER_UNKNOWN",
  "IMPLEMENTATION_CONTEXT_NEED",
] as const;
export type GapClaimKind = (typeof GAP_CLAIM_KINDS)[number];

export const GAP_ASSESSMENT_STATUSES = [
  "PROPOSED",
  "SUPPORTED_WITHIN_SCOPE",
  "PARTIALLY_SUPPORTED",
  "CONFLICTING",
  "REFUTED_WITHIN_SCOPE",
  "INSUFFICIENT_EVIDENCE",
  "NOT_APPLICABLE",
] as const;
export type GapAssessmentStatus = (typeof GAP_ASSESSMENT_STATUSES)[number];

// -------------------------------------------------------------
// §10 StudyFamily & Publication Relationships
// -------------------------------------------------------------
export const PUBLICATION_RELATIONSHIPS = [
  "VERSION_OF",
  "EXTENDS",
  "REPORTS_SAME_STUDY",
  "CORRECTION_OF",
  "REPLICATION_OF",
] as const;
export type PublicationRelationship = (typeof PUBLICATION_RELATIONSHIPS)[number];

export type StudyFamilyLink = {
  studyFamilyId: string;
  primaryLiteratureId: string;
  relatedLiteratureIds: string[];
  relationship: PublicationRelationship;
  sampleSharedConfidence: "CONFIRMED" | "POSSIBLE" | "UNKNOWN";
  notes?: string;
};

// -------------------------------------------------------------
// §11 Reading Coverage & Extraction Statuses
// -------------------------------------------------------------
export const MACHINE_PROCESSING_SCOPES = [
  "NOT_PROCESSED",
  "ABSTRACT_PROCESSED",
  "SECTIONS_PROCESSED",
  "FULLTEXT_PROCESSED",
  "EXTRACTION_FAILED",
] as const;
export type MachineProcessingScope = (typeof MACHINE_PROCESSING_SCOPES)[number];

export const HUMAN_READING_SCOPES = [
  "UNREAD",
  "ABSTRACT_REVIEWED",
  "PARTIAL_REVIEWED",
  "FULLTEXT_REVIEWED",
] as const;
export type HumanReadingScope = (typeof HUMAN_READING_SCOPES)[number];

export type SourceExtractionItem = {
  extractionId: string;
  literatureId: string;
  sourceLocation: string; // e.g. "Section 3.2, p. 104"
  exactScope: "ABSTRACT" | "FULL_TEXT" | "SECTION";
  variableOrConstruct: string;
  reportedValue: string; // If not reported in text, must be "NOT_REPORTED", never fake "0" or "none"
  isNotReported: boolean;
  temporalStatus: TemporalStatus;
  reviewedByHuman: boolean;
};

// -------------------------------------------------------------
// §7 & §9 Literature Search Task & Search Log Snapshot
// -------------------------------------------------------------
export type LiteratureSearchTask = {
  taskId: string;
  evidenceNeedId: string;
  targetRqId?: string;
  searchPurpose: string;
  role: string;
  queryMode: "BROAD" | "PRECISE" | "COUNTEREVIDENCE";
  keywordGroups: string[][];
  executedQuery: string;
  databases: ("CONSENSUS" | "SEMANTIC_SCHOLAR" | "OPEN_ALEX" | "CROSSREF" | "AI4SCHOLAR")[];
  dateWindow: { fromYear?: number; toYear?: number };
  retrievalBudgetCap: number;
  status: "PLANNED" | "EXECUTED" | "PARTIAL" | "FAILED";
  retrievedCount: number;
  uniqueRecordsCount: number;
  truncationReason?: string;
  executedAt?: string;
};

export type SearchSnapshot = {
  searchRunId: string;
  projectId: string;
  evidenceNeedIds: string[];
  provider: string;
  executedQuery: string;
  searchedAt: string;
  providerReportedTotal: number | null;
  retrievedRecords: number;
  uniqueRecords: number;
  studyFamilyCount: number;
  retrievalStatus: "SUCCESS" | "PARTIAL_RETRIEVAL" | "RATE_LIMITED" | "EMPTY_RESULT" | "FAILED";
};

// -------------------------------------------------------------
// §13 Gap Claim Representation
// -------------------------------------------------------------
export type GapClaim = {
  claimId: string; // e.g. "GC-01"
  sourceEvidenceNeedRef?: string;
  relatedRqIds: string[];
  claimText: string;
  claimKind: GapClaimKind;
  gapType: Stage05GapType;
  scopeAndBoundaries: string;
  asOfDate: string;
  supportingEvidenceRefs: string[]; // literatureIds
  counterevidenceRefs: string[]; // literatureIds presenting conflicting/null findings
  closestStudyRefs: string[];
  qualitySummary: string;
  missingScope: string[];
  assessmentStatus: GapAssessmentStatus;
  confidenceBasis: string;
  isLocked: boolean;
  lockPolicy?: "MANUAL" | "AUTOMATION_POLICY";
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §14 Closest Study Matrix & Contribution Delta
// -------------------------------------------------------------
export type ClosestStudyItem = {
  closestStudyId: string;
  literatureId: string;
  title: string;
  year: number;
  authorsSummary: string;
  coreProblemAddressed: string;
  theoryOrMechanismUsed: string;
  methodologyOverview: string;
  dataAndPopulationContext: string;
  keyFindings: string;
  reportedLimitations: string;
  relevanceDegree: "DIRECT_COMPETITOR" | "METHODOLOGICAL_ANALOGUE" | "CONCEPTUAL_NEIGHBOR";
};

export type ContributionDeltaRow = {
  deltaId: string;
  closestStudyRef: string; // refers to closestStudyId
  currentStudyFeature: string;
  closestStudyFeature: string;
  differenceNature: "PROBLEM" | "THEORY" | "METHOD" | "DATA" | "OUTCOME_METRIC" | "TEMPORAL" | "CONTEXT" | "IMPLEMENTATION";
  potentialValueRationale: string; // Why this difference is valuable (cannot just be technology piling!)
  howToEmpiricallyValidate: string; // How this difference can be tested
  isTechnologyPilingOnly: boolean; // Flagged if adding LLM/XR without theoretical justification
  status: "ESTABLISHED_DELTA" | "PROVISIONAL_DELTA" | "SUPERFICIAL_DIFFERENCE";
};

// -------------------------------------------------------------
// §22 Review Decision
// -------------------------------------------------------------
export const REVIEW_DECISIONS = [
  "RETAIN_DIRECTION",
  "REFINE_WITH_ACCEPTED_CHANGES",
  "PROVISIONAL_EXPLORATION",
  "RECONSIDER_TOPIC",
  "INSUFFICIENT_EVIDENCE",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

// -------------------------------------------------------------
// §23 Blueprint Change Proposal (Non-destructive update candidate)
// -------------------------------------------------------------
export type BlueprintChangeProposal = {
  proposalId: string;
  projectId: string;
  targetFieldRef: string; // e.g. "coreProblemAndScope.problemStatement"
  originalValue: string;
  proposedValue: string;
  changeReason: string;
  supportedByLiteratureIds: string[];
  counterevidenceConsidered: string[];
  status: "PENDING_ADOPTION" | "ADOPTED" | "REJECTED";
  proposedAt: string;
  adoptedAt?: string;
};

// -------------------------------------------------------------
// §5 Tri-Goal Specific Synthesis Notes
// -------------------------------------------------------------
export type JournalSpecificGapSynthesis = {
  internationalLiteratureLandscape: string;
  defensibleTheoreticalContribution: string;
  closestInternationalCompetitors: string[];
  methodologicalRigorEvaluation: string;
  sampleArticleSuggestionsReview: string;
};

export type NstcSpecificGapSynthesis = {
  scientificProblemImportance: string;
  noveltyComparedToDomesticAndGlobal: string;
  continuityWithPiPastWork: string;
  interdisciplinaryValue: string;
};

export type MoeTprSpecificGapSynthesis = {
  classroomObservedProblemValidation: string;
  instructionalInterventionBasis: string;
  pedagogicalMechanismSupport: string;
  studentOutcomeAssessmentFeasibility: string;
  transferablePedagogicalKnowledge: string;
  classroomBaselineNotice: string; // UNKNOWN preserved, never fake grades!
};

// -------------------------------------------------------------
// §6 & §17 Complete Gap Review Workspace
// -------------------------------------------------------------
export type GapReviewWorkspace = {
  reviewId: string;
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceBlueprintSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Review Scope (§6)
  reviewScope: {
    targetProblem: string;
    populationContext: string;
    interventionOrConcept: string;
    comparatorDirection: string;
    timeHorizon: string;
    languageCoverage: string[];
    stoppingCriteriaNotes: string;
  };

  // Search Tasks & Search Logs (§7 & §9)
  searchTasks: LiteratureSearchTask[];
  searchLogs: SearchSnapshot[];

  // Deduplication & Literature Center Links (§10 & §11)
  literatureIds: string[];
  studyFamilies: StudyFamilyLink[];
  extractions: SourceExtractionItem[];

  // Gap Claims Registry (§13)
  gapClaims: GapClaim[];

  // Closest Study Matrix & Contribution Delta (§14)
  closestStudies: ClosestStudyItem[];
  contributionDeltas: ContributionDeltaRow[];

  // Route-Specific Synthesis (§5)
  journalSynthesis?: JournalSpecificGapSynthesis;
  nstcSynthesis?: NstcSpecificGapSynthesis;
  moeTprSynthesis?: MoeTprSpecificGapSynthesis;

  // Change Proposals & Requirements (§12, §21, §23)
  changeProposals: BlueprintChangeProposal[];
  downstreamRequirements: DownstreamRequirementItem[];

  // Overall Evaluation & Decision (§15 & §22)
  overallDecision: ReviewDecision;
  decisionRationale: string;
  evidenceSufficiency: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  noveltyAssessment: "HIGH_DIFFERENTIATION" | "MODERATE_DIFFERENTIATION" | "NEEDS_REFINEMENT" | "REDUNDANT";
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §24 GapEvidenceSnapshot (Immutable handoff to Stage 6)
// -------------------------------------------------------------
export type GapEvidenceSnapshot = {
  snapshotId: string; // e.g. ges_<uuid>
  schemaVersion: "gap-evidence/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "gap-novelty";
  nextStageId: "theory-mechanism"; // Stage 6: 理論與機制
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  reviewId: string;
  reviewRevision: number;
  reviewDecision: ReviewDecision;
  decisionRationale: string;
  evidenceSufficiency: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  noveltyAssessment: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
  };

  // References & Identifiers
  rqRefs: string[];
  evidenceNeedRefs: string[];
  fulfilledNeedRefs: string[];
  literatureIds: string[];
  studyFamilyRefs: string[];
  gapClaimRefs: string[];
  closestStudyRefs: string[];
  contributionDeltaRefs: string[];
  counterevidenceRefs: string[];

  // Downstream Requirements (carried forward without cyclic gate)
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // Theory hints handed off to Stage 6
  theoryEvidenceNeedRefs: string[];
  candidateTheories: string[];
  competingExplanationHints: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §22 Logic Findings for Gap & Novelty
// -------------------------------------------------------------
export type GapLogicFinding = {
  checkId: string;
  ruleCode: string;
  severity: "FATAL" | "MAJOR_WARNING" | "SUGGESTION";
  targetSection: string;
  targetFieldRef?: string;
  findingDescription: string;
  rationale: string;
  suggestedAction: string;
  autoFixAvailable: boolean;
};
