/**
 * Stage 17 Consumer Contract Test (V3-U16-FULL → V3-U17 receiver)
 * Spec: docs/stage16/spec-v3-4.0.md §7
 *
 * Validates that ScientificReviewSnapshot:
 *   1. schema / stageKey / nextStageId are stable (V3-U16 → translation-polish)
 *   2. carries upstream ManuscriptWritingSnapshot id + hash
 *   3. carries findings (refs, open, blockers, resolved) + response matrix
 *   4. meaning constraints are held & protected values enumerated
 *   5. all AI review is flagged SIMULATED
 *   6. author disagreement is respected (no forced PASS)
 *   7. Stage 17 receiver state builds (non-empty fallback, no blank page)
 *   8. re-entry point points back to U16 (no circular gate)
 *   9. checksum is unique per build
 *
 * Pure consumer contract test — no DB calls.
 */

import {
  generateReviewer2Challenges,
  deduplicateFindings,
  buildAuthorResponseMatrix,
  decideReReview,
  buildMeaningConstraints,
  checkMeaningConstraintsHeld,
  buildScientificReviewSnapshot,
  buildStage17ReceiverState,
  runScientificMechanicalQa,
  buildScientificReviewWorkspaceFromStage15,
} from "../lib/scientific-review-v3-service.ts";
import {
  type ScientificFinding,
  type RevisionProposal,
  type UpstreamReviewRequest,
} from "../lib/scientific-review-v3-contract.ts";
import { type ManuscriptWritingSnapshot } from "../lib/manuscript-writing-contract.ts";

let pass = 0;
let fail = 0;
function report(id: string, cond: boolean, note: string): void {
  if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); }
  else { fail++; console.error(`[FAIL] ${id} - ${note}`); }
}

const sourceSnapshot: ManuscriptWritingSnapshot = {
  snapshotId: "mwsnap_stage17_consumer",
  schemaVersion: "manuscript-writing/1.0.0",
  stageKey: "V3-U15",
  workspaceId: "ws_sr_consumer",
  projectId: "proj_stage17_consumer",
  workOrderId: "worder_ms_consumer",
  stageId: "results-writing",
  nextStageId: "scientific-review",
  sourceAnalysisSnapshotId: "arsnap_consumer",
  sourceAnalysisSnapshotContentHashSha256: "a".repeat(64),
  goalContextRevision: 1,
  primaryGoal: "JOURNAL_SCI_SSCI",
  fundingIntent: "NONE",
  publicationIntent: "JOURNAL",
  manuscriptRevision: 1,
  decision: "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW",
  decisionRationale: "consumer fixture",
  scope: {
    workingTitleZh: "Stage 17 Consumer Test",
    workingTitleEn: "Stage 17 Consumer Test",
    overallPurpose: "test",
    writingMode: "FORMAL_SCIENTIFIC_DRAFT",
    totalWordCount: 4205,
  },
  sectionRefs: ["sec_results", "sec_discussion"],
  boundResultFactIds: ["fact_rt_t1_diff_mean", "fact_rt_t1_cohens_d", "fact_ancova_treatment_effect"],
  boundCitationSourceRefs: ["cit_chen2024", "cit_hart1988"],
  embeddedTableRefs: ["tab_01_t1_results"],
  embeddedFigureRefs: ["fig_01_reaction_time_interaction"],
  isNumericDataVerifiablyBound: true,
  hasDiscussionGhostDataAvoided: true,
  hasNonSignificantOutcomesIncludedHonesty: true,
  evidencePackageId: "mevp_consumer",
  evidencePackageContentHashSha256: "b".repeat(64),
  downstreamRequirements: [],
  duePhases: [],
  limitations: [],
  checksum: "chk_mw_consumer",
  createdAt: new Date().toISOString(),
};

// ---- 1. Intake from Stage 15
const ws = buildScientificReviewWorkspaceFromStage15({
  workspaceId: "ws_sr_consumer",
  projectId: "proj_stage17_consumer",
  manuscriptWritingSnapshot: sourceSnapshot,
});
report("S17-C01", ws.sourceSnapshotId === sourceSnapshot.snapshotId, "workspace points to source ManuscriptWritingSnapshot");
report("S17-C02", ws.sourceSnapshotHash.length === 64, "source hash is sha256");
report("S17-C03", ws.workOrder.reviewRound === 1, "review round starts at 1");
report("S17-C04", ws.workOrder.coverageSections.length >= 6, "coverage spans all manuscript sections");
report("S17-C05", ws.boundResultFactIds.length === 3, "bound result facts carried forward");

// ---- 2. Mechanical QA
const mech = runScientificMechanicalQa({ snapshot: sourceSnapshot });
report("S17-M01", mech.passed === true, "mechanical QA passes on well-formed snapshot");
report("S17-M02", mech.checks.length >= 6, "mechanical QA covers all deterministic checks");

// ---- 3. Reviewer #2 challenges
const raw = generateReviewer2Challenges({ snapshot: sourceSnapshot });
report("S17-R1", raw.length >= 3, "reviewer #2 produces ≥3 constructive challenges");
report("S17-R2", raw.every((f) => f.reviewerRole === "REVIEWER_2" && f.simulated === true), "all challenges are SIMULATED REVIEW");
report("S17-R3", raw.every((f) => f.alternativeExplanation && f.minimalRevisionPath), "each challenge has alternative explanation + minimal revision path");
report("S17-R4", raw.every((f) => f.severity === "MAJOR" || f.severity === "MINOR"), "challenges are constructive, none demand large-N RCT");

// ---- 4. De-dup
const withIds = raw.map((f, i) => ({
  ...f,
  findingId: `tmp_${i}`,
  reviewRunId: "tmp_run",
  createdAt: "",
  updatedAt: "",
  decision: "OPEN" as const,
  authorResponse: "",
  authorCanDisagreeWithReason: true,
}));
const deduped = deduplicateFindings({ findings: withIds });
report("S17-D1", deduped.length === withIds.length, "de-dup keeps all distinct challenges");

// ---- 5. Author response matrix
const matrix = buildAuthorResponseMatrix({ findings: withIds });
report("S17-A1", matrix.rows.length === withIds.length, "response matrix has one row per finding");
report("S17-A2", matrix.matrixRef.startsWith("author_response_matrix_"), "matrix ref present");

// ---- 6. Re-review decision
const rr1 = decideReReview({ findings: withIds, round: 1, maxRounds: 3 });
report("S17-RR1", rr1.decision === "SCIENTIFICALLY_APPROVED" || rr1.decision === "RE_REVIEW_REQUIRED", "re-review decision is valid");
const closedFindings = withIds.map((f) => ({ ...f, decision: "IN_REVISION" as const, severity: "BLOCKER" as const }));
const rr2 = decideReReview({ findings: closedFindings, round: 3, maxRounds: 3 });
report("S17-RR2", rr2.decision === "CLOSED_WITH_UNRESOLVED", "round cap keeps unresolved blockers, does not force PASS");

// ---- 7. Meaning constraints
const constraints = buildMeaningConstraints({ snapshot: sourceSnapshot });
report("S17-MC1", constraints.length >= 5, "meaning constraints cover numbers/N/causal/timepoint/hypothesis");
const held = checkMeaningConstraintsHeld({
  constraints,
  revisedTextBySection: {
    RESULTS: "N = 6，組間差值 -913.1 毫秒，T0 基線、T1 後測",
    DISCUSSION: "H1 獲得支持；T2 延宕遷移尚待驗證",
    TITLE_ABSTRACT: "分析樣本 N = 6",
  },
});
report("S17-MC2", held.held === true, "protected values held when text preserves them");
const violated = checkMeaningConstraintsHeld({
  constraints,
  revisedTextBySection: { RESULTS: "組間差值 -200 毫秒", DISCUSSION: "已證實長期降低事故率" },
});
report("S17-MC3", violated.held === false && violated.violations.length > 0, "violations detected when numbers/causal claims change");

// ---- 8. Snapshot + receiver
const findings: ScientificFinding[] = raw.map((f, i) => ({
  ...f,
  findingId: `sf_consumer_${i}`,
  reviewRunId: "srr_consumer",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  decision: i === 0 ? "VERIFIED_RESOLVED" : "REJECTED_WITH_JUSTIFICATION",
  authorResponse: i === 0 ? "已修訂" : "作者有據不同意：T2 未蒐集故不以場域效果宣稱",
  authorCanDisagreeWithReason: true,
}));
const revisions: RevisionProposal[] = [{ revisionId: "rev_1", findingId: "sf_consumer_0", candidateText: "修正後文字", status: "CANDIDATE", adoptedLowRiskUnlocked: false, requiresHumanConfirmation: true, createdBy: "author", createdAt: new Date().toISOString() }];
const upstreamRequests: UpstreamReviewRequest[] = [{ requestId: "ur_1", kind: "ANALYSIS_REVIEW", destinationStage: "analysis-execution", findingId: "sf_consumer_0", requestReason: "需核對 CI 上下界", status: "PENDING", returnTarget: { route: "scientific-review", findingId: "sf_consumer_0" }, createdAt: new Date().toISOString() }];

const snapshot = buildScientificReviewSnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  reviewRunId: ws.reviewRunId,
  workOrder: ws.workOrder,
  sourceSnapshot,
  findings,
  revisions,
  reReviewDecision: "SCIENTIFICALLY_APPROVED",
  rationale: "全部 blocker 已裁決或作者已附據不同意",
  constraints,
  upstreamRequests,
  authorResponseMatrixRef: matrix.matrixRef,
  mechanicalQa: mech,
  reviewer2Provided: true,
});

report("S17-S1", snapshot.schemaVersion === "scientific-review/1.0.0", "snapshot schema version stable");
report("S17-S2", snapshot.stageKey === "V3-U16", "snapshot stageKey is V3-U16");
report("S17-S3", snapshot.nextStageId === "translation-polish", "nextStageId points to Stage 17 (translation & polish)");
report("S17-S4", snapshot.sourceManuscriptWritingSnapshotId === sourceSnapshot.snapshotId, "upstream snapshot id carried");
report("S17-S5", snapshot.sourceManuscriptWritingSnapshotHash.length === 64, "upstream hash carried");
report("S17-S6", snapshot.findingRefs.length === findings.length, "finding refs propagated");
report("S17-S7", snapshot.allSimulated === true, "all AI review flagged simulated");
report("S17-S8", snapshot.authorDisagreementRespectCount === 3, "author disagreement respected & counted");
report("S17-S9", snapshot.meaningConstraintRefs.length === constraints.length, "meaning constraint refs propagated");
report("S17-S10", snapshot.mechanicalQaPassed === true, "mechanical QA result propagated");
report("S17-S11", /^chk_sr_/.test(snapshot.checksum), "checksum has expected prefix");

const snapshot2 = buildScientificReviewSnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  reviewRunId: ws.reviewRunId,
  workOrder: ws.workOrder,
  sourceSnapshot,
  findings,
  revisions,
  reReviewDecision: "SCIENTIFICALLY_APPROVED",
  rationale: "全部 blocker 已裁決或作者已附據不同意",
  constraints,
  upstreamRequests,
  authorResponseMatrixRef: matrix.matrixRef,
  mechanicalQa: mech,
  reviewer2Provided: true,
});
report("S17-S12", snapshot.snapshotId !== snapshot2.snapshotId, "snapshot id unique per build");

const receiver = buildStage17ReceiverState({ snapshot, findings });
report("S17-RC1", receiver.receiverVersion === "translation-polish-receiver/1.0.0", "receiver version stable");
report("S17-RC2", receiver.sourceScientificReviewSnapshotId === snapshot.snapshotId, "receiver points to source snapshot");
report("S17-RC3", receiver.readyForLanguage === true, "receiver readyForLanguage when no open blockers + constraints held + approved");
report("S17-RC4", receiver.receiverNotes.length > 0, "receiver notes honest (U17 not built yet)");
report("S17-RC5", receiver.reEntryPoint.route === "scientific-review", "receiver re-entry back to U16 (no circular gate)");
report("S17-RC6", receiver.reEntryPoint.action === "initialize", "receiver re-entry action is initialize");

// No fake journal decision
report("S17-E1", !["JOURNAL_ACCEPTED", "PUBLISHED"].includes(snapshot.decision as string), "snapshot never claims journal acceptance");

console.log("");
console.log(`STAGE 17 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
