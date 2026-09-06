/**
 * V3-U03-FULL Batch A PURE chain test (no DB):
 * TopicSelectionSnapshot -> SubmissionFingerprintVersion -> SubmissionNavigationSnapshot
 * This is the exact logic invoked by navigation/initialize + navigation/complete routes.
 */
import { buildFingerprintFromTopicSnapshot } from "../lib/submission-fingerprint-contract.ts";
import { buildSubmissionNavigationSnapshot, type JournalCandidate } from "../lib/submission-navigation-engines-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

const WS = "ws_test_v3u04";
const PROJECT = "proj_test_v3u04";

const topicSnapshot: TopicSelectionSnapshot = {
  projectId: PROJECT,
  topicId: "top_v3u04_01",
  topicTitle: "AI×職安教育訓練（V3U04 測試）",
  topicTitleEn: "AI Safety Training V3U04",
  researchQuestion: "RQ：生成式AI即時反饋是否提升VR訓練的危害辨識移轉？",
  gapStatement: "既有研究缺乏即時情境反饋實證",
  methodologyOverview: "RCT 兩組比較",
  expectedContribution: "提出 LLM-VR 訓練框架並驗證危害辨識",
  knownLimitations: ["單一產業場域"],
  assumptions: ["學員具備頭顯操作能力"],
  risks: ["VR 暈眩"],
  literatureIds: ["lit_v3u04_1"],
  citationSourceIds: [],
  sourceSnapshotIds: [],
  selectedBy: "usr_v3u04",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: "2026-09-06T00:00:00Z",
  handoffLimitations: ["新穎性待查證"],
  downstreamOpenRequirements: ["確認投稿路線"],
  lockManifest: [{ fieldRef: "research_question", lockVersion: 1 }],
};

// 1. Fingerprint with ZERO re-entry (initialize route logic)
const fp = buildFingerprintFromTopicSnapshot(WS, topicSnapshot, {
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
});
check("fingerprint_title_carried", fp.titleZh === topicSnapshot.topicTitle);
check("fingerprint_rq_carried", fp.researchQuestion === topicSnapshot.researchQuestion);
check("fingerprint_gap_carried", fp.gapStatement === topicSnapshot.gapStatement);
check("fingerprint_method_carried", fp.methodologyOverview === topicSnapshot.methodologyOverview);
check("fingerprint_limitations_carried", fp.knownLimitations.length === 1 && fp.knownLimitations[0] === "單一產業場域");
check("fingerprint_axes_carried", fp.fundingIntent === "NSTC_GENERAL" && fp.publicationIntent === "JOURNAL");
check("fingerprint_no_fabricated_researcher", fp.researcherProfileRefs.status === "UNKNOWN");

// 2. SubmissionNavigationSnapshot (complete route logic)
const journal: JournalCandidate = {
  candidateId: "j_v3u04_1",
  journalName: "Safety Science",
  publisher: "Elsevier",
  role: "BEST_FIT",
  fitScore: 80,
  fitCoverage: 0.8,
  indexingVerified: [{ system: "SCIE", verified: true }],
  apcKnown: { status: "KNOWN", currency: "USD", amount: 3050 },
  recentArticlesSample: [],
  primaryRisk: "APC 預算需確認",
  selectionStatus: "SELECTED_FOR_PLANNING",
};
const snap = buildSubmissionNavigationSnapshot({
  workspaceId: WS,
  projectId: PROJECT,
  fingerprint: fp,
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
  selectedJournal: journal,
  decisionOrigin: "USER_MANUAL_SELECTION",
});
check("nav_snapshot_id", snap.snapshotId.startsWith("sns_"));
check("nav_snapshot_route_ready", snap.planningStatus === "ROUTE_PLAN_READY");
check("nav_snapshot_fp_ref", snap.fingerprintId === fp.fingerprintId);
check("nav_snapshot_topic_ref", snap.sourceTopicSnapshotId === topicSnapshot.topicId);
check("nav_snapshot_journal", snap.selectedJournalCandidate?.journalName === "Safety Science");
check("nav_snapshot_limitations", Array.isArray(snap.handoffLimitations) && snap.handoffLimitations.length > 0);
check("nav_snapshot_downstream", Array.isArray(snap.downstreamRequirements) && snap.downstreamRequirements.length > 0);

// 3. Blueprint handoff contract fields (spec §24: consumer must read without re-entry)
check("handoff_has_all_blueprint_fields",
  Boolean(snap.snapshotId && snap.fingerprintId && snap.sourceTopicSnapshotId && snap.planningStatus && snap.ruleSnapshots && snap.handoffLimitations && snap.downstreamRequirements && snap.decisionAt));

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS (pure chain, DB persistence BLOCKED by env)");
process.exit(failures ? 1 : 0);
