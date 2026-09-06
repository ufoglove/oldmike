/**
 * Stage 18 Consumer Contract Test (V3-U17-FULL → V3-U18 receiver)
 * Spec: docs/stage17/spec-v3-4.0.md §8-9
 *
 * Validates LanguageQualitySnapshot:
 *   1. schema / stageKey / nextStageId stable (V3-U17 → final-compliance)
 *   2. carries upstream ScientificReviewSnapshot id + hash + release state
 *   3. scope separation: full vs partial language allowed (never auto-upgrade)
 *   4. fidelity checks beyond token counts (direction/denominator/negation/
 *      causal strength/confirmatory-exploratory)
 *   5. terminology check honors locked term bindings
 *   6. QA flags propagate (numeric/citation/terminology/semantic)
 *   7. provider capability manifest honest (NOT_CONFIGURED/UNSUPPORTED)
 *   8. Stage 18 receiver builds (non-empty fallback)
 *   9. re-entry back to U17 (no circular gate)
 *  10. checksum unique per build
 *
 * Pure consumer contract test — no DB calls.
 */

import {
  buildLanguageWorkspaceFromStage16,
  assertLanguageScopeAuthorized,
  segmentByParagraphs,
  runFidelityChecks,
  runTerminologyCheck,
  buildProviderCapabilityManifest,
  runLanguageQa,
  buildLanguageQualitySnapshot,
  buildStage18ReceiverState,
} from "../lib/language-quality-v3-service.ts";
import { type TermBinding } from "../lib/language-quality-v3-contract.ts";
import { type ScientificReviewSnapshot } from "../lib/scientific-review-v3-contract.ts";

let pass = 0;
let fail = 0;
function report(id: string, cond: boolean, note: string): void {
  if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); }
  else { fail++; console.error(`[FAIL] ${id} - ${note}`); }
}

const sourceSnapshot: ScientificReviewSnapshot = {
  snapshotId: "srsnap_stage18_consumer",
  schemaVersion: "scientific-review/1.0.0",
  stageKey: "V3-U16",
  workspaceId: "ws_lq_consumer",
  projectId: "proj_stage18_consumer",
  reviewRunId: "srr_consumer",
  workOrderId: "wrev_consumer",
  stageId: "scientific-review",
  nextStageId: "translation-polish",
  sourceManuscriptWritingSnapshotId: "mwsnap_consumer",
  sourceManuscriptWritingSnapshotHash: "a".repeat(64),
  sourceManuscriptWritingDecision: "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW",
  goalContextRevision: 1,
  primaryGoal: "JOURNAL_SCI_SSCI",
  reviewRound: 1,
  decision: "SCIENTIFICALLY_APPROVED",
  decisionRationale: "consumer fixture",
  scope: {
    workingTitleZh: "Stage 18 Consumer Test",
    workingTitleEn: "Stage 18 Consumer Test",
    coverageSections: ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"],
    totalWordCount: 4205,
  },
  findingRefs: [],
  openFindingRefs: [],
  blockerFindingRefs: [],
  resolvedFindingRefs: [],
  revisionProposalRefs: [],
  reReviewRefs: [],
  meaningConstraintRefs: ["mc_1", "mc_2", "mc_3"],
  upstreamRequestRefs: [],
  authorResponseMatrixRef: "matrix_consumer",
  adjudicationRefs: [],
  coverageMatrixRef: "coverage_consumer",
  capabilityManifestRef: "capability_consumer",
  roleRunRefs: ["role_run_consumer"],
  reviewer2ReportRef: "reviewer2_consumer",
  analysisReviewRequestRefs: [],
  sourceUpdateAdoptionRefs: [],
  scientificReviewPackageRef: "srvp_consumer",
  languageHandoffPackageRef: "langpack_consumer",
  scientificReleaseState: "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE",
  fullManuscriptLanguageAllowed: true,
  languageAllowedScopeRefs: ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"],
  acceptedLimitations: [],
  requiredSpecialistReviewDispositions: [],
  laterStageRequirements: [],
  mechanicalQaPassed: true,
  reviewer2ChallengeProvided: true,
  allSimulated: true,
  meaningConstraintsHeld: true,
  noFabricatedFindings: true,
  authorDisagreementRespectCount: 0,
  limitations: [],
  checksum: "chk_sr_consumer",
  createdAt: new Date().toISOString(),
};

// ---- 1. Intake from Stage 16 (full allowed)
const ws = buildLanguageWorkspaceFromStage16({ workspaceId: "ws_lq_consumer", projectId: "proj_stage18_consumer", scientificReviewSnapshot: sourceSnapshot });
report("S18-C01", ws.sourceSnapshotId === sourceSnapshot.snapshotId, "workspace points to source ScientificReviewSnapshot");
report("S18-C02", ws.sourceSnapshotHash.length === 64, "source hash is sha256");
report("S18-C03", ws.fullManuscriptLanguageAllowed === true, "full manuscript language allowed carried from U16");
report("S18-C04", ws.workOrder.task === "TRANSLATE_ZH_EN", "journal goal defaults to ZH→EN translation");

// ---- 2. Partial scope (never auto-upgrade)
const partialSnapshot: ScientificReviewSnapshot = {
  ...sourceSnapshot,
  snapshotId: "srsnap_partial",
  scientificReleaseState: "PARTIAL_REVIEW_COMPLETE",
  fullManuscriptLanguageAllowed: false,
  languageAllowedScopeRefs: ["RESULTS", "DISCUSSION"],
};
const wsPartial = buildLanguageWorkspaceFromStage16({ workspaceId: "ws_lq_partial", projectId: "proj_stage18_consumer", scientificReviewSnapshot: partialSnapshot });
report("S18-S1", wsPartial.fullManuscriptLanguageAllowed === false, "partial snapshot stays partial (no auto-upgrade)");
report("S18-S2", wsPartial.languageAllowedScopeRefs.length === 2 && wsPartial.languageAllowedScopeRefs.includes("RESULTS"), "partial scope limited to allowed refs");
const scopeOk = assertLanguageScopeAuthorized({ workOrder: wsPartial.workOrder, sectionRef: "RESULTS" });
const scopeBlocked = assertLanguageScopeAuthorized({ workOrder: wsPartial.workOrder, sectionRef: "INTRODUCTION" });
report("S18-S3", scopeOk.ok === true, "allowed section passes scope check");
report("S18-S4", scopeBlocked.ok === false && scopeBlocked.code === "LANGUAGE_SCOPE_NOT_AUTHORIZED", "out-of-scope section blocked (never auto-upgrade)");

// ---- 3. Segmentation with UTF-8 bytes
const { segments, overLimitSegments } = segmentByParagraphs({
  sections: [
    { sectionRef: "RESULTS", paragraphRef: "p1", text: "組間差值 -913.1 毫秒（N = 6，T0 基線、T1 後測）" },
    { sectionRef: "DISCUSSION", paragraphRef: "p2", text: "本研究實證數據支持假說 H1；T2 延宕遷移尚待驗證。" },
  ],
});
report("S18-SEG1", segments.length === 2, "two segments built");
report("S18-SEG2", segments.every((s) => s.sourceUtf8Bytes > 0), "segments carry UTF-8 byte counts");
report("S18-SEG3", overLimitSegments.length === 0, "no over-limit segments in fixture");

// ---- 4. Fidelity beyond token counts
// 4a. direction swap must be FATAL
const dirSwap = runFidelityChecks({
  sectionRef: "RESULTS",
  sourceText: "組間差值 -913.1 毫秒（N = 6）",
  targetText: "組間差值 +913.1 毫秒（N = 6）",
});
report("S18-F1", dirSwap.issues.some((i) => (i.kind === "COMPARISON_DIRECTION_CHANGED" || i.kind === "TOKEN_MODIFIED") && i.severity === "FATAL"), "direction/number swap detected as FATAL");

// 4b. denominator change must be FATAL
const denomChange = runFidelityChecks({
  sectionRef: "RESULTS",
  sourceText: "N = 6",
  targetText: "N = 60",
});
report("S18-F2", denomChange.issues.some((i) => i.kind === "DENOMINATOR_CHANGED" && i.severity === "FATAL"), "denominator change detected as FATAL");

// 4c. negation flip must be FATAL
const negationFlip = runFidelityChecks({
  sectionRef: "RESULTS",
  sourceText: "次要指標未顯著",
  targetText: "次要指標顯著提升",
});
report("S18-F3", negationFlip.issues.some((i) => i.kind === "NEGATION_CHANGED" && i.severity === "FATAL"), "negation flip detected as FATAL");

// 4d. causal strength escalation must be FATAL
const causalUp = runFidelityChecks({
  sectionRef: "DISCUSSION",
  sourceText: "機制可能反映認知負荷降低",
  targetText: "機制已證實反映認知負荷降低",
});
report("S18-F4", causalUp.issues.some((i) => i.kind === "CAUSAL_STRENGTH_CHANGED" && i.severity === "FATAL"), "may→proved escalation detected as FATAL");

// 4e. timepoint loss must be flagged
const timepointLoss = runFidelityChecks({
  sectionRef: "RESULTS",
  sourceText: "T0 基線、T1 後測",
  targetText: "後測",
});
report("S18-F5", timepointLoss.issues.some((i) => i.kind === "TIMEPOINT_CHANGED"), "timepoint loss flagged");

// 4f. exploratory classification loss
const exploreLoss = runFidelityChecks({
  sectionRef: "DISCUSSION",
  sourceText: "探索性分析顯示",
  targetText: "分析顯示",
});
report("S18-F6", exploreLoss.issues.some((i) => i.kind === "CONFIRMATORY_OR_EXPLORATORY_CHANGED"), "exploratory classification loss flagged");

// ---- 5. Terminology check with locked bindings
const termBindings: TermBinding[] = [
  { termId: "term_1", canonicalId: "RT_MS", sourceTerm: "反應時間", targetTerm: "reaction time (RT)", sourceLanguage: "zh-TW", targetLanguage: "en-US", isLocked: true, note: "primary outcome" },
];
const termOk = runTerminologyCheck({ termBindings, targetText: "reaction time (RT) improved" });
const termBad = runTerminologyCheck({ termBindings, targetText: "response speed improved" });
report("S18-T1", termOk.passed === true, "locked terminology honored");
report("S18-T2", termBad.passed === false && termBad.issues.some((i) => i.kind === "TERMINOLOGY_MISMATCH"), "terminology mismatch flagged");

// ---- 6. QA aggregation
const qa = runLanguageQa({
  fidelityIssues: dirSwap.issues,
  terminologyIssues: [],
  numericTokensHeld: false,
  citationRefsHeld: true,
});
report("S18-Q1", qa.numericQaPassed === false, "numeric QA fails on direction swap");
report("S18-Q2", qa.citationQaPassed === true, "citation QA passes when refs held");
report("S18-Q3", qa.openFatalCount >= 1, "fatal count > 0 on swap");

// ---- 7. Provider capability honesty
const caps = buildProviderCapabilityManifest();
report("S18-P1", caps.some((c) => c.providerId === "DEEPL_TRANSLATE" && c.status === "NOT_CONFIGURED"), "DeepL Translate honestly NOT_CONFIGURED (no fake LIVE)");
report("S18-P2", caps.some((c) => c.providerId === "OLD_MIKE_SEMANTIC" && c.status === "MOCK"), "Old Mike semantic honestly MOCK (deterministic)");
report("S18-P3", caps.some((c) => c.providerId === "GOOGLE_FALLBACK" && c.status === "UNSUPPORTED"), "Google fallback honestly UNSUPPORTED");

// ---- 8. Snapshot
const goodSegments = segments.map((s) => ({ ...s, targetText: s.sourceText, status: "TRANSLATED" as const }));
const snapshot = buildLanguageQualitySnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  reviewRunId: ws.reviewRunId,
  workOrder: ws.workOrder,
  sourceSnapshot,
  segments: goodSegments,
  fidelityIssues: [],
  terminologyIssues: [],
  termBindings,
  providerCapabilities: caps,
  qa: runLanguageQa({ fidelityIssues: [], terminologyIssues: [], numericTokensHeld: true, citationRefsHeld: true }),
});

report("S18-S5", snapshot.schemaVersion === "language-quality/1.0.0", "snapshot schema version stable");
report("S18-S6", snapshot.stageKey === "V3-U17", "snapshot stageKey is V3-U17");
report("S18-S7", snapshot.nextStageId === "final-compliance", "nextStageId points to Stage 18 (final compliance)");
report("S18-S8", snapshot.sourceScientificReviewSnapshotId === sourceSnapshot.snapshotId, "upstream snapshot id carried");
report("S18-S9", snapshot.sourceScientificReviewSnapshotHash.length === 64, "upstream hash carried");
report("S18-S10", snapshot.decision === "LANGUAGE_READY", "decision LANGUAGE_READY when all segments processed + no fatal");
report("S18-S11", snapshot.scope.totalSegments === 2 && snapshot.scope.totalSegmentsTranslatedOrEdited === 2, "segment counts propagate");
report("S18-S12", snapshot.termBindingRefs.length === 1, "term binding refs propagate");
report("S18-S13", snapshot.meaningConstraintRefs.length === 3, "meaning constraint refs carried from U16");
report("S18-S14", snapshot.providerCapabilityRefs.length === caps.length, "provider capability refs propagate");
report("S18-S15", /^chk_lq_/.test(snapshot.checksum), "checksum has expected prefix");

// Blocked case: FATAL fidelity → decision BLOCKED
const blockedSnapshot = buildLanguageQualitySnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  reviewRunId: ws.reviewRunId,
  workOrder: ws.workOrder,
  sourceSnapshot,
  segments: goodSegments,
  fidelityIssues: dirSwap.issues,
  terminologyIssues: [],
  termBindings,
  providerCapabilities: caps,
  qa: runLanguageQa({ fidelityIssues: dirSwap.issues, terminologyIssues: [], numericTokensHeld: false, citationRefsHeld: true }),
});
report("S18-S16", blockedSnapshot.decision === "BLOCKED" && blockedSnapshot.fatalFidelityIssueCount >= 1, "FATAL fidelity → BLOCKED (numbers never silently fixed)");

// unique id
const snapshot2 = buildLanguageQualitySnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  reviewRunId: ws.reviewRunId,
  workOrder: ws.workOrder,
  sourceSnapshot,
  segments: goodSegments,
  fidelityIssues: [],
  terminologyIssues: [],
  termBindings,
  providerCapabilities: caps,
  qa: runLanguageQa({ fidelityIssues: [], terminologyIssues: [], numericTokensHeld: true, citationRefsHeld: true }),
});
report("S18-S17", snapshot.snapshotId !== snapshot2.snapshotId, "snapshot id unique per build");

// ---- 9. Stage 18 receiver
const receiver = buildStage18ReceiverState({ snapshot });
report("S18-R1", receiver.receiverVersion === "final-compliance-receiver/1.0.0", "receiver version stable");
report("S18-R2", receiver.sourceLanguageQualitySnapshotId === snapshot.snapshotId, "receiver points to source snapshot");
report("S18-R3", receiver.readyForCompliance === true, "receiver readyForCompliance when LANGUAGE_READY + no fatal");
report("S18-R4", receiver.receiverNotes.length > 0, "receiver notes honest (U18 not built)");
report("S18-R5", receiver.reEntryPoint.route === "translation-polish", "receiver re-entry back to U17");
report("S18-R6", receiver.reEntryPoint.action === "initialize", "receiver re-entry action is initialize");

// No fake claims
report("S18-E1", !["SUBMITTED", "ACCEPTED", "PUBLISHED"].includes(snapshot.decision as string), "snapshot never claims submission/journal acceptance");

console.log("");
console.log(`STAGE 18 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
