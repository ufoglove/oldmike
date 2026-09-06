/**
 * Submission Fingerprint Version & Routing Intent Contracts
 * Spec v3.2.0 (V3-U03-R1) — Section 3, 4, 13, 20
 *
 * Enforces:
 * 1. Build SubmissionFingerprintVersion from TopicSelectionSnapshot (NO re-entry of existing data).
 * 2. Source version preserved; supplements create NEW version, never overwrite topic snapshot.
 * 3. Two independent decision axes:
 *    - funding_intent: NSTC_GENERAL | MOE_TPR | NONE | UNDECIDED
 *    - publication_intent: JOURNAL | DEFERRED | NONE
 * 4. Funding candidates retain:
 *    - topic_fit, eligibility_status (PASS/FAIL/UNKNOWN/CONDITIONAL/NOT_APPLICABLE),
 *      call_status, rule_status, selection_status, application_readiness (default: NOT_ASSESSED_FINAL)
 * 5. Known FAIL eligibility cannot be shown as "currently eligible primary choice".
 * 6. Match rubrics (Section 13): 100 points total per engine, observed_points calculated
 *    from assessed_weight / coverage; UNKNOWN is NOT 0 and NOT fake 100.
 */
import { type TopicSelectionSnapshot } from "./stage-operation-contracts.ts";

export const SUBMISSION_FINGERPRINT_CONTRACT = "submission-fingerprint/1.0.0" as const;

export const FUNDING_INTENTS = ["NSTC_GENERAL", "MOE_TPR", "NONE", "UNDECIDED"] as const;
export type FundingIntent = (typeof FUNDING_INTENTS)[number];

export const PUBLICATION_INTENTS = ["JOURNAL", "DEFERRED", "NONE"] as const;
export type PublicationIntent = (typeof PUBLICATION_INTENTS)[number];

export const RESEARCH_STAGES = ["CONCEPT", "PROPOSAL", "IN_PROGRESS", "RESULTS", "MANUSCRIPT"] as const;
export type ResearchStage = (typeof RESEARCH_STAGES)[number];

export const ELIGIBILITY_STATUSES = ["PASS", "FAIL", "UNKNOWN", "CONDITIONAL", "NOT_APPLICABLE"] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const CALL_STATUSES = ["OPEN", "CLOSED", "NOT_YET_OPEN", "NOT_LOCATED", "UNVERIFIED"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const SELECTION_STATUSES = ["CANDIDATE", "PROVISIONAL", "SELECTED_FOR_PLANNING", "REJECTED"] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export type SubmissionFingerprintVersion = {
  fingerprintId: string;
  versionNumber: number;
  contractVersion: typeof SUBMISSION_FINGERPRINT_CONTRACT;
  workspaceId: string;
  projectId: string;
  sourceTopicSnapshotId?: string;
  sourceTopicVersion?: string;

  // From TopicSelectionSnapshot (carried forward, no re-entry)
  titleZh: string;
  titleEn?: string;
  conceptAbstract?: string;
  researchQuestion: string;
  gapStatement: string;
  methodologyOverview: string;
  expectedContribution: string;
  minimumViableStudy?: string;
  knownLimitations: string[];
  assumptions: string[];
  risks: string[];
  literatureIds: string[];
  citationSourceIds: string[];

  // Navigation additions (with evidence origin: USER_PROVIDED / SOURCE_SUPPORTED / PROPOSED / UNKNOWN)
  researchStage: ResearchStage;
  fundingIntent: FundingIntent;
  publicationIntent: PublicationIntent;

  researcherProfileRefs: {
    institutionAffiliation?: string;
    academicRank?: string;
    status: "USER_PROVIDED" | "UNKNOWN";
  };

  courseProfileRefs?: {
    courseName?: string;
    isInstructorOfRecord?: boolean;
    academicCredits?: number;
    status: "USER_PROVIDED" | "UNKNOWN";
  };

  userConstraints: {
    targetYear?: number;
    oaPreference?: "ANY" | "GOLD_OA" | "NO_APC";
    budgetApcLimitUsd?: number;
    excludedJournals?: string[];
    indexRequirements?: Array<"SCIE" | "SSCI" | "TSSCI" | "THCI" | "EI" | "SCOPUS">;
  };

  createdAt: string;
  updatedAt: string;
};

export type RubricDimension = {
  dimensionKey: string;
  label: string;
  weight: number;                   // sum of weights = 100
  rating: number | null;            // 0-5 integer, or null if UNKNOWN
  rationale?: string;
  sourceIds?: string[];
};

export type MatchScoreResult = {
  rubricVersion: string;
  dimensions: RubricDimension[];
  totalWeight: 100;
  assessedWeight: number;           // sum of weights for non-null dimensions
  coverage: number;                 // assessedWeight / 100 (0.0 to 1.0)
  observedPoints: number;           // sum(weight * rating / 5) for assessed dimensions
  isComplete: boolean;              // coverage === 1.0
  displayScore: string;             // e.g. "76分（覆蓋率 80%）" or "暫定" if coverage < threshold
};

/** Build initial fingerprint directly from TopicSelectionSnapshot (spec §3: NO re-asking). */
export function buildFingerprintFromTopicSnapshot(
  workspaceId: string,
  snapshot: TopicSelectionSnapshot,
  options: {
    fingerprintId?: string;
    versionNumber?: number;
    researchStage?: ResearchStage;
    fundingIntent?: FundingIntent;
    publicationIntent?: PublicationIntent;
  } = {},
): SubmissionFingerprintVersion {
  const now = new Date().toISOString();
  return {
    fingerprintId: options.fingerprintId || `sfp_${snapshot.projectId.slice(0, 8)}_${Date.now()}`,
    versionNumber: options.versionNumber || 1,
    contractVersion: SUBMISSION_FINGERPRINT_CONTRACT,
    workspaceId,
    projectId: snapshot.projectId,
    sourceTopicSnapshotId: snapshot.topicId,
    titleZh: snapshot.topicTitle,
    titleEn: snapshot.topicTitleEn,
    conceptAbstract: snapshot.conceptAbstract,
    researchQuestion: snapshot.researchQuestion,
    gapStatement: snapshot.gapStatement,
    methodologyOverview: snapshot.methodologyOverview,
    expectedContribution: snapshot.expectedContribution,
    minimumViableStudy: snapshot.minimumViableStudy,
    knownLimitations: [...snapshot.knownLimitations],
    assumptions: [...snapshot.assumptions],
    risks: [...snapshot.risks],
    literatureIds: [...snapshot.literatureIds],
    citationSourceIds: [...snapshot.citationSourceIds],
    researchStage: options.researchStage || "CONCEPT",
    fundingIntent: options.fundingIntent || "UNDECIDED",
    publicationIntent: options.publicationIntent || "JOURNAL",
    researcherProfileRefs: { status: "UNKNOWN" },
    userConstraints: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Compute match score according to Spec §13 (sum of weights = 100, UNKNOWN ≠ 0). */
export function computeMatchScore(dimensions: RubricDimension[], rubricVersion: string): MatchScoreResult {
  const totalWeight = 100;
  let assessedWeight = 0;
  let observedPoints = 0;

  for (const dim of dimensions) {
    if (dim.rating !== null && dim.rating !== undefined) {
      assessedWeight += dim.weight;
      observedPoints += (dim.weight * Math.max(0, Math.min(5, dim.rating))) / 5;
    }
  }

  const coverage = totalWeight > 0 ? assessedWeight / totalWeight : 0;
  const isComplete = coverage >= 0.999;
  const roundedPoints = Math.round(observedPoints * 10) / 10;
  const displayScore = isComplete
    ? `${roundedPoints} / 100`
    : `已評 ${roundedPoints} 分（已評權重 ${assessedWeight}；覆蓋 ${Math.round(coverage * 100)}%）`;

  return { rubricVersion, dimensions, totalWeight, assessedWeight, coverage, observedPoints: roundedPoints, isComplete, displayScore };
}
