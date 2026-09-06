/**
 * V3-U03-FULL Batch A contract test: TopicSnapshot -> Fingerprint -> SubmissionNavigationSnapshot
 * -> stage_completion_snapshots (navigator) end-to-end on isolated PG.
 * Run: DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/v3u01_dev" node --experimental-strip-types scripts/verify-stage03-full-batch-a.ts
 */
import { StageOperationRepository } from "../lib/stage-operation-repository.ts";
import { buildFingerprintFromTopicSnapshot } from "../lib/submission-fingerprint-contract.ts";
import { buildSubmissionNavigationSnapshot, type JournalCandidate } from "../lib/submission-navigation-engines-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

const WS = "ws_test_v3u04";
const PROJECT = "proj_test_v3u04";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

const topicSnapshot: TopicSelectionSnapshot = {
  projectId: PROJECT,
  topicId: "top_v3u04_01",
  topicTitle: "AI×職安教育訓練（V3U04 測試）",
  topicTitleEn: "AI Safety Training V3U04",
  conceptAbstract: "測試摘要",
  researchQuestion: "RQ：生成式AI即時反饋是否提升VR訓練的危害辨識移轉？",
  gapStatement: "既有研究缺乏即時情境反饋實證",
  methodologyOverview: "RCT 兩組比較",
  targetPopulation: "製造業新進員工",
  expectedContribution: "提出 LLM-VR 訓練框架並驗證危害辨識",
  minimumViableStudy: "單廠區 60 人預試",
  knownLimitations: ["單一產業場域"],
  assumptions: ["學員具備頭顯操作能力"],
  risks: ["VR 暈眩"],
  literatureIds: ["lit_v3u04_1"],
  citationSourceIds: [],
  sourceSnapshotIds: [],
  selectedBy: "usr_v3u04",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: "2026-09-06T00:00:00Z",
  handoffLimitations: ["新穎性待 Stage 3 查證"],
  downstreamOpenRequirements: ["確認投稿路線"],
  lockManifest: [{ fieldRef: "research_question", lockVersion: 1 }],
};

async function main() {
  // 0. Clean any previous run rows for this project/stage (idempotent test helper)
  const pool = await import("pg").then((m) => {
    const { Pool } = m as typeof import("pg");
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  });

  await pool.query(`DELETE FROM stage_completion_snapshots WHERE workspace_id=$1 AND project_id=$2`, [WS, PROJECT]).catch(() => {});

  // 1. Save the Stage-2 topic-lab completion snapshot (simulates 選題實驗室採用)
  const topicCompletion = await StageOperationRepository.saveCompletionSnapshot({
    workspaceId: WS,
    projectId: PROJECT,
    stageId: "topic-lab",
    nextStageId: "navigator",
    snapshotData: { source: "verify-stage03-full-batch-a" },
    topicSnapshot,
    lockManifest: topicSnapshot.lockManifest,
    handoffLimitations: topicSnapshot.handoffLimitations,
    downstreamOpenRequirements: topicSnapshot.downstreamOpenRequirements,
    idempotencyKey: `topic:${PROJECT}:v3u04:1`,
  });
  check("topic_completion_saved", Boolean(topicCompletion.id), topicCompletion.id);

  // 2. Initialize: read latest topic snapshot back (what navigation/initialize does)
  const latest = await StageOperationRepository.getLatestCompletionSnapshot(WS, PROJECT, "topic-lab");
  check("get_latest_topic_snapshot_not_null", latest !== null);
  check("topic_snapshot_carried", latest?.topicSnapshot?.researchQuestion === topicSnapshot.researchQuestion, latest?.topicSnapshot?.researchQuestion);

  // 3. Build fingerprint with ZERO re-entry (spec §7)
  const fp = buildFingerprintFromTopicSnapshot(WS, latest!.topicSnapshot!, {
    fundingIntent: "NSTC_GENERAL",
    publicationIntent: "JOURNAL",
  });
  check("fingerprint_title_carried", fp.titleZh === topicSnapshot.topicTitle);
  check("fingerprint_rq_carried", fp.researchQuestion === topicSnapshot.researchQuestion);
  check("fingerprint_axes_carried", fp.fundingIntent === "NSTC_GENERAL" && fp.publicationIntent === "JOURNAL");

  // 4. Complete: build SubmissionNavigationSnapshot (what navigation/complete does)
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
  check("nav_snapshot_built", snap.snapshotId.startsWith("sns_"));
  check("nav_snapshot_route_ready", snap.planningStatus === "ROUTE_PLAN_READY");

  // 5. Persist navigator completion (stage_completion_snapshots) with idempotency
  const navCompletion = await StageOperationRepository.saveCompletionSnapshot({
    workspaceId: WS,
    projectId: PROJECT,
    stageId: "navigator",
    nextStageId: "blueprint",
    snapshotData: { navigationSnapshot: snap, planningStatus: snap.planningStatus, decisionOrigin: snap.decisionOrigin },
    lockManifest: [],
    handoffLimitations: snap.handoffLimitations,
    downstreamOpenRequirements: snap.downstreamRequirements,
    idempotencyKey: `complete:${snap.snapshotId}`,
  });
  check("nav_completion_saved", Boolean(navCompletion.id));

  // 6. Idempotency: repeat same completion returns same record (no duplicate)
  const navCompletion2 = await StageOperationRepository.saveCompletionSnapshot({
    workspaceId: WS,
    projectId: PROJECT,
    stageId: "navigator",
    nextStageId: "blueprint",
    snapshotData: { navigationSnapshot: snap, planningStatus: snap.planningStatus, decisionOrigin: snap.decisionOrigin },
    lockManifest: [],
    handoffLimitations: snap.handoffLimitations,
    downstreamOpenRequirements: snap.downstreamRequirements,
    idempotencyKey: `complete:${snap.snapshotId}`,
  });
  check("nav_completion_idempotent", navCompletion2.id === navCompletion.id, `${navCompletion2.id} vs ${navCompletion.id}`);

  // 7. Read back navigator snapshot for blueprint handoff (spec §24)
  const navLatest = await StageOperationRepository.getLatestCompletionSnapshot(WS, PROJECT, "navigator");
  const snapData = navLatest?.snapshotData as { navigationSnapshot?: SubmissionNavigationSnapshotLike } | undefined;
  check("nav_latest_readable", navLatest !== null);
  check("nav_snapshot_has_journal", snapData?.navigationSnapshot?.selectedJournalCandidate?.journalName === "Safety Science");

  // 8. Stage-4 consumption contract: snapshot exposes required fields
  const ns = snapData?.navigationSnapshot;
  check("handoff_has_blueprint_fields",
    Boolean(ns && ns.fingerprintId && ns.sourceTopicSnapshotId && ns.handoffLimitations && ns.downstreamRequirements && ns.planningStatus),
    JSON.stringify(ns && { fp: ns.fingerprintId, src: ns.sourceTopicSnapshotId, lim: ns.handoffLimitations?.length, ds: ns.downstreamRequirements?.length, ps: ns.planningStatus }));

  await pool.end();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

type SubmissionNavigationSnapshotLike = {
  fingerprintId?: string;
  sourceTopicSnapshotId?: string;
  handoffLimitations?: string[];
  downstreamRequirements?: string[];
  planningStatus?: string;
  selectedJournalCandidate?: { journalName?: string };
};

void main();
