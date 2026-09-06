/**
 * Official Rule Snapshot & Tri-Route Navigation Engines Contract
 * Spec v3.2.0 (V3-U03-R1) — Section 6, 7, 9, 10, 11, 12, 18, 20
 *
 * Engines:
 * 1. International Journals: scope, recent articles, indexing (JCR/CiteScore/SJR distinct), APC (currency/waiver)
 * 2. NSTC General Research Grant (國科會一般研究計畫): discipline, PI eligibility, institutional deadline distinction
 * 3. MOE Teaching Practice Research (教育部教學實踐研究): course profile, instructor of record, student learning outcomes
 *
 * OfficialRuleSnapshot: source URL/file hash, applicable cycle (ROC/CE distinction),
 * status: VERIFIED_APPLICABLE | REFERENCE_ONLY | TARGET_CYCLE_UNVERIFIED | NOT_LOCATED_IN_SEARCH | PENDING_ANNOUNCEMENT | CONFLICTING_SOURCES | UNVERIFIED
 *
 * SubmissionNavigationSnapshot: immutable handoff record for research blueprint (Section 20).
 */
import {
  type EligibilityStatus,
  type FundingIntent,
  type PublicationIntent,
  type ResearchStage,
  type SubmissionFingerprintVersion,
} from "./submission-fingerprint-contract.ts";

export const NAVIGATION_ENGINES_CONTRACT = "submission-navigation-engines/1.0.0" as const;

export const RULE_STATUSES = [
  "VERIFIED_APPLICABLE",
  "REFERENCE_ONLY",
  "TARGET_CYCLE_UNVERIFIED",
  "NOT_LOCATED_IN_SEARCH",
  "PENDING_ANNOUNCEMENT",
  "CONFLICTING_SOURCES",
  "UNVERIFIED",
] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export type OfficialRuleSnapshot = {
  ruleId: string;
  snapshotId: string;
  authority: "NSTC" | "MOE" | "PUBLISHER" | "INSTITUTION";
  documentTitle: string;
  programNamespace: "NSTC_GENERAL" | "MOE_TPR" | "JOURNAL";
  targetCycle: {
    yearRoc?: number;               // 民國年 (e.g. 115)
    yearCe: number;                 // 西元年 (e.g. 2026)
    cycleLabel: string;             // e.g. "115年度教學實踐研究計畫"
  };
  disciplineOrVenueId?: string;
  sourceUrl?: string;
  sourceHash?: string;
  retrievedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  requirementText: string;
  ruleStatus: RuleStatus;
  notes?: string;
};

export type JournalCandidate = {
  candidateId: string;
  journalName: string;
  issn?: string;
  eissn?: string;
  publisher: string;
  officialUrl?: string;
  role: "BEST_FIT" | "AMBITIOUS" | "PRACTICAL";
  fitScore: number;                 // 0-100 computed via computeMatchScore
  fitCoverage: number;              // 0.0-1.0
  indexingVerified: Array<{ system: "SCIE" | "SSCI" | "SCOPUS" | "EI"; verified: boolean; source?: string }>;
  apcKnown: { currency?: string; amount?: number; isWaiverAvailable?: boolean; status: "KNOWN" | "UNKNOWN" };
  recentArticlesSample: Array<{ title: string; doi?: string; year?: number }>;
  primaryRisk: string;
  selectionStatus: "CANDIDATE" | "PROVISIONAL" | "SELECTED_FOR_PLANNING" | "REJECTED";
};

export type NstcRouteCandidate = {
  candidateId: string;
  divisionName: string;             // e.g. "人文及社會科學研究發展處"
  disciplineCode?: string;          // e.g. "H03"
  disciplineName: string;           // e.g. "教育學門"
  subDisciplineName?: string;
  fitScore: number;
  fitCoverage: number;
  eligibilityStatus: EligibilityStatus;
  eligibilityNotes: string;
  deadlines: {
    officialDeadline?: string;
    institutionalDeadline?: string; // separated from official per spec §7
    isInstitutionalKnown: boolean;
  };
  selectionStatus: "CANDIDATE" | "PROVISIONAL" | "SELECTED_FOR_PLANNING" | "REJECTED";
};

export type MoeTprRouteCandidate = {
  candidateId: string;
  disciplineOrProgramName: string;  // e.g. "教育學門" or "專案計畫（技術實作）"
  targetAcademicYearRoc: number;    // e.g. 115
  fitScore: number;
  fitCoverage: number;
  courseFit: {
    courseName?: string;
    isInstructorVerified: boolean;
    creditsKnown: boolean;
    baselineEvidenceStatus: "PROVIDED" | "PENDING_BASELINE" | "MISSING";
  };
  eligibilityStatus: EligibilityStatus;
  selectionStatus: "CANDIDATE" | "PROVISIONAL" | "SELECTED_FOR_PLANNING" | "REJECTED";
};

export type SubmissionNavigationSnapshot = {
  snapshotId: string;
  projectId: string;
  workspaceId: string;
  contractVersion: typeof NAVIGATION_ENGINES_CONTRACT;
  fingerprintId: string;
  fingerprintVersion: number;
  sourceTopicSnapshotId?: string;

  fundingIntent: FundingIntent;
  publicationIntent: PublicationIntent;
  researchStage: ResearchStage;

  selectedJournalCandidate?: JournalCandidate;
  selectedNstcCandidate?: NstcRouteCandidate;
  selectedMoeTprCandidate?: MoeTprRouteCandidate;

  ruleSnapshots: OfficialRuleSnapshot[];
  handoffLimitations: string[];
  downstreamRequirements: string[]; // for research blueprint stage

  decisionAt: string;
  decisionOrigin: "USER_MANUAL_SELECTION" | "AUTO_SELECTED_PROVISIONAL";
  planningStatus: "ROUTE_PLAN_READY" | "PROVISIONAL_ROUTE_PLAN_READY" | "REVISION_REQUIRED";
};

/** Create immutable handoff snapshot to research blueprint (spec §20). */
export function buildSubmissionNavigationSnapshot(input: {
  workspaceId: string;
  projectId: string;
  fingerprint: SubmissionFingerprintVersion;
  fundingIntent: FundingIntent;
  publicationIntent: PublicationIntent;
  selectedJournal?: JournalCandidate;
  selectedNstc?: NstcRouteCandidate;
  selectedMoeTpr?: MoeTprRouteCandidate;
  ruleSnapshots?: OfficialRuleSnapshot[];
  handoffLimitations?: string[];
  downstreamRequirements?: string[];
  decisionOrigin?: "USER_MANUAL_SELECTION" | "AUTO_SELECTED_PROVISIONAL";
}): SubmissionNavigationSnapshot {
  const isProvisional = !input.selectedJournal && !input.selectedNstc && !input.selectedMoeTpr;
  const planningStatus = isProvisional ? "PROVISIONAL_ROUTE_PLAN_READY" : "ROUTE_PLAN_READY";

  return {
    snapshotId: `sns_${input.projectId.slice(0, 8)}_${Date.now()}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    contractVersion: NAVIGATION_ENGINES_CONTRACT,
    fingerprintId: input.fingerprint.fingerprintId,
    fingerprintVersion: input.fingerprint.versionNumber,
    sourceTopicSnapshotId: input.fingerprint.sourceTopicSnapshotId,
    fundingIntent: input.fundingIntent,
    publicationIntent: input.publicationIntent,
    researchStage: input.fingerprint.researchStage,
    selectedJournalCandidate: input.selectedJournal,
    selectedNstcCandidate: input.selectedNstc,
    selectedMoeTprCandidate: input.selectedMoeTpr,
    ruleSnapshots: input.ruleSnapshots || [],
    handoffLimitations: input.handoffLimitations || ["目標年度規則尚待公告", "研究者資格待機構核實"],
    downstreamRequirements: input.downstreamRequirements || ["研究藍圖階段需依本導航結果擬定方法與期程"],
    decisionAt: new Date().toISOString(),
    decisionOrigin: input.decisionOrigin || "USER_MANUAL_SELECTION",
    planningStatus,
  };
}
