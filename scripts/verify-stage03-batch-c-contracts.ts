/**
 * Batch C contract tests: tri-route navigation engines + submission fingerprint + handoff snapshot.
 * Run: node --experimental-strip-types scripts/verify-stage03-batch-c-contracts.ts
 * No keys, no network, no DB.
 */
import {
  buildFingerprintFromTopicSnapshot,
  computeMatchScore,
  type RubricDimension,
} from "../lib/submission-fingerprint-contract.ts";
import {
  buildSubmissionNavigationSnapshot,
  type JournalCandidate,
  type MoeTprRouteCandidate,
  type NstcRouteCandidate,
  type OfficialRuleSnapshot,
} from "../lib/submission-navigation-engines-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Build fingerprint from TopicSelectionSnapshot without re-asking
const mockTopic: TopicSelectionSnapshot = {
  projectId: "proj_t1",
  topicId: "top_01",
  topicTitle: "AI×職安教育訓練",
  topicTitleEn: "AI Safety Training",
  conceptAbstract: "摘要",
  researchQuestion: "RQ: LLM-VR 介入是否降低失誤？",
  gapStatement: "現有研究缺乏即時反饋",
  methodologyOverview: "RCT",
  expectedContribution: "貢獻 25%",
  knownLimitations: ["限製造業"],
  assumptions: ["頭顯熟悉"],
  risks: ["暈眩"],
  literatureIds: ["lit_1"],
  citationSourceIds: ["cit_1"],
  sourceSnapshotIds: [],
  selectedBy: "user_1",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: "2026-09-06T00:00:00Z",
  handoffLimitations: ["新穎性待驗"],
  downstreamOpenRequirements: ["確認發表期刊"],
  lockManifest: [{ fieldRef: "research_question", lockVersion: 1 }],
};

const fp = buildFingerprintFromTopicSnapshot("ws_1", mockTopic, {
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
});
check("fingerprint_title_carried", fp.titleZh === mockTopic.topicTitle);
check("fingerprint_rq_carried", fp.researchQuestion === mockTopic.researchQuestion);
check("fingerprint_limitations_carried", fp.knownLimitations.length === 1);
check("fingerprint_researcher_status_unknown", fp.researcherProfileRefs.status === "UNKNOWN");
check("fingerprint_two_independent_axes", fp.fundingIntent === "NSTC_GENERAL" && fp.publicationIntent === "JOURNAL");

// 2. Match score rubric calculation (spec §13: sum of weights = 100, UNKNOWN is not 0, coverage explicit)
const dimensions: RubricDimension[] = [
  { dimensionKey: "scope", label: "Scope", weight: 25, rating: 4 }, // 25 * 4/5 = 20
  { dimensionKey: "contribution", label: "Contribution", weight: 20, rating: 5 }, // 20 * 5/5 = 20
  { dimensionKey: "recent_articles", label: "Recent Articles", weight: 20, rating: null }, // UNKNOWN -> not counted
  { dimensionKey: "method", label: "Method", weight: 15, rating: 3 }, // 15 * 3/5 = 9
  { dimensionKey: "readership", label: "Readership", weight: 10, rating: null }, // UNKNOWN
  { dimensionKey: "submission_conditions", label: "Conditions", weight: 10, rating: 5 }, // 10 * 5/5 = 10
];
const scoreRes = computeMatchScore(dimensions, "journal_fit_v1");
check("score_total_weight_100", scoreRes.totalWeight === 100);
check("score_assessed_weight_70", scoreRes.assessedWeight === 70, `got ${scoreRes.assessedWeight}`);
check("score_coverage_70_pct", Math.round(scoreRes.coverage * 100) === 70);
check("score_observed_points_59", scoreRes.observedPoints === 59, `got ${scoreRes.observedPoints}`);
check("score_display_contains_coverage", scoreRes.displayScore.includes("覆蓋 70%"));
check("score_not_fake_100", !scoreRes.isComplete);

// complete score (100% coverage)
const completeDims = dimensions.map((d) => ({ ...d, rating: d.rating ?? 3 }));
const completeRes = computeMatchScore(completeDims, "journal_fit_v1");
check("score_complete_display", completeRes.isComplete && completeRes.displayScore.includes("/ 100"));

// 3. Official rule snapshot (spec §7: ROC/CE, separate authority, rule status)
const rule: OfficialRuleSnapshot = {
  ruleId: "rule_nstc_01",
  snapshotId: "snap_nstc_115",
  authority: "NSTC",
  documentTitle: "國家科學及技術委員會補助專題研究計畫作業要點",
  programNamespace: "NSTC_GENERAL",
  targetCycle: { yearRoc: 115, yearCe: 2026, cycleLabel: "115年度一般專題研究計畫" },
  retrievedAt: "2026-09-06T00:00:00Z",
  requirementText: "研究主持人之資格符合第二點規定者...",
  ruleStatus: "VERIFIED_APPLICABLE",
};
check("rule_status_verified", rule.ruleStatus === "VERIFIED_APPLICABLE");
check("rule_roc_ce_distinct", rule.targetCycle.yearRoc === 115 && rule.targetCycle.yearCe === 2026);

// 4. Tri-route candidates
const journal: JournalCandidate = {
  candidateId: "j_01",
  journalName: "Computers & Education: X Reality",
  publisher: "Elsevier",
  role: "BEST_FIT",
  fitScore: 82,
  fitCoverage: 0.85,
  indexingVerified: [{ system: "SCOPUS", verified: true }],
  apcKnown: { currency: "USD", amount: 2100, isWaiverAvailable: false, status: "KNOWN" },
  recentArticlesSample: [{ title: "VR safety training RCT", doi: "10.1016/j.cexr.2024.1", year: 2024 }],
  primaryRisk: "OA APC requires budget approval",
  selectionStatus: "SELECTED_FOR_PLANNING",
};

const nstc: NstcRouteCandidate = {
  candidateId: "nstc_01",
  divisionName: "人文及社會科學研究發展處",
  disciplineCode: "H03",
  disciplineName: "教育學門",
  fitScore: 78,
  fitCoverage: 0.9,
  eligibilityStatus: "PASS",
  eligibilityNotes: "助理教授以上專任資格待確認",
  deadlines: { officialDeadline: "2026-12-31", isInstitutionalKnown: false },
  selectionStatus: "SELECTED_FOR_PLANNING",
};

const moe: MoeTprRouteCandidate = {
  candidateId: "moe_01",
  disciplineOrProgramName: "工程學門",
  targetAcademicYearRoc: 115,
  fitScore: 74,
  fitCoverage: 0.8,
  courseFit: { courseName: "工廠安全實務", isInstructorVerified: true, creditsKnown: true, baselineEvidenceStatus: "PENDING_BASELINE" },
  eligibilityStatus: "PASS",
  selectionStatus: "CANDIDATE",
};

// 5. Build submission navigation snapshot (immutable handoff to research blueprint)
const snapshot = buildSubmissionNavigationSnapshot({
  workspaceId: "ws_1",
  projectId: "proj_t1",
  fingerprint: fp,
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
  selectedJournal: journal,
  selectedNstc: nstc,
  selectedMoeTpr: moe,
  ruleSnapshots: [rule],
  decisionOrigin: "USER_MANUAL_SELECTION",
});

check("snapshot_id_generated", snapshot.snapshotId.startsWith("sns_"));
check("snapshot_planning_status_ready", snapshot.planningStatus === "ROUTE_PLAN_READY");
check("snapshot_journal_carried", snapshot.selectedJournalCandidate?.journalName === journal.journalName);
check("snapshot_nstc_carried", snapshot.selectedNstcCandidate?.disciplineName === nstc.disciplineName);
check("snapshot_rule_carried", snapshot.ruleSnapshots.length === 1);
check("snapshot_downstream_requirements_nonempty", snapshot.downstreamRequirements.length > 0);

// provisional route plan (when no candidate chosen yet)
const provSnapshot = buildSubmissionNavigationSnapshot({
  workspaceId: "ws_1",
  projectId: "proj_t1",
  fingerprint: fp,
  fundingIntent: "UNDECIDED",
  publicationIntent: "DEFERRED",
  decisionOrigin: "AUTO_SELECTED_PROVISIONAL",
});
check("provisional_snapshot_status", provSnapshot.planningStatus === "PROVISIONAL_ROUTE_PLAN_READY");
check("provisional_snapshot_origin", provSnapshot.decisionOrigin === "AUTO_SELECTED_PROVISIONAL");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
