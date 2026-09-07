/**
 * Stage 20 / v1.1 Consumer Contract Test (V3-U19-FULL R2 → V3-U20 receiver)
 * Spec: docs/stage19/spec-v3-4.0.md §32
 *
 * R2 對照：SubmissionTrackingSnapshot v1.1 + Stage20 receiver。
 * 驗證：
 *   1. schema / stageKey / nextStageId（V3-U19 → post-acceptance）+ intakeMode
 *   2. Case (SubmissionCase) / DestinationLeg(排) / SubmissionRound(排) 分離
 *   3. Provider capability（three modes）+ ActionIntent/ExecutionAuthorization
 *   4. attempts（reservation → dispatch → OUTCOME_UNKNOWN → reconcile）
 *   5. receipt 7-tier evidence、ID_PENDING、錯 case 拒絕
 *   6. DecisionRecord（原文＋category＋Decision in Process≠Accept）
 *   7. Reviewed WorkOrder 回應（PLANNED/ACTION_VERIFIED）
 *   8. accepted/granted gate；post_decision_processing／nextExternalAction 為 false 除非真接受
 *   9. 無作假宣稱（PUBLISHED/FUNDS… 不自動）。
 * Pure consumer — 無 DB。
 */

import {
  buildSubmissionWorkspaceFromStage18,
  createSubmissionCase,
  standardDestinationLegs,
  openRound,
  registerProviderCapability,
  resolveProviderMode,
  createActionIntent,
  confirmActionIntent,
  authorizeSubmissionAttempt,
  markAttemptDispatched,
  markAttemptOutcomeUnknown,
  reconcileAttempt,
  verifyAttemptReceipt,
  addSubmissionEvent,
  verifyReceipt,
  projectStatus,
  mapStatusText,
  addExternalReview,
  addReviewItem,
  updateReviewItemResponse,
  recordFormalDecision,
  recordDecisionRecord,
  createUpstreamRevisionRef,
  authorizeResubmission,
  buildSubmissionTrackingSnapshot,
  buildStage20ReceiverState,
} from "../lib/submission-tracking-v3-service.ts";
import { type FinalSubmissionPackageSnapshot } from "../lib/final-submission-v3-contract.ts";
import { type PrimaryGoalId } from "../lib/research-goal-registry.ts";

let pass = 0;
let fail = 0;
const report = (id: string, cond: boolean, note: string): void => {
  if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); }
  else { fail++; console.error(`[FAIL] ${id} - ${note}`); }
};

const pkg: FinalSubmissionPackageSnapshot = {
  snapshotId: "fspsnap_consumer_v11",
  schemaVersion: "final-submission/1.0.0",
  stageKey: "V3-U18",
  workspaceId: "ws_st_consumer",
  projectId: "proj_u19_r2_consumer",
  workOrderId: "wfc_consumer",
  stageId: "final-compliance",
  nextStageId: "submission-tracking",
  sourceLanguageQualitySnapshotId: "lqsnap",
  sourceLanguageQualitySnapshotHash: "b".repeat(64),
  goalContextRevision: 1,
  primaryGoal: "JOURNAL_SCI_SSCI" as PrimaryGoalId,
  documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
  decision: "READY_FOR_AUTHOR_SUBMISSION",
  decisionRationale: "consumer",
  submissionExecutionAuthorized: false,
  submissionStatus: "NOT_SUBMITTED_BY_THIS_STAGE",
  route: "JOURNAL_SCI_SSCI",
  profile: { profileId: "j", route: "JOURNAL_SCI_SSCI", targetJournal: "T", articleType: "A", requirements: [], reportingGuideline: "", anonymizationRequired: true, coverLetterRequired: true, titlePageRequired: true } as unknown as FinalSubmissionPackageSnapshot["profile"],
  ruleSnapshots: [],
  packageState: "LOCKED_READY",
  readyForAction: "READY_FOR_AUTHOR_SUBMISSION",
  workOrder: ({} as FinalSubmissionPackageSnapshot["workOrder"]),
  fieldMap: { mapId: "fm", target: "JOURNAL_INITIAL_SUBMISSION", fields: [] },
  visibilityManifest: [],
  externalBundle: { manifestId: "ext", bundleKind: "EXTERNAL_SUBMISSION_BUNDLE", files: [], requiredFileReconciliationPassed: false, createdAt: "" },
  internalEvidencePackage: { manifestId: "int", bundleKind: "INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE", files: [], requiredFileReconciliationPassed: false, createdAt: "" },
  documents: [],
  approvalSubjectManifest: { manifestId: "asm", projectId: "proj", documents: [], contentHash: "d".repeat(64), createdById: "u", createdAt: "" },
  authorApprovals: [],
  requiredAuthorApprovals: 0,
  pendingAuthorApprovals: 0,
  anonymizationQaPassed: true,
  referencesQaPassed: true,
  renderQaPassed: true,
  freezeConfirmed: true,
  packageLocked: true,
  sensitiveContentExcluded: true,
  unresolvedIssueRefs: [],
  laterStageRequirements: [],
  limitations: [],
  checksum: "chk",
  createdAt: new Date().toISOString(),
};

// ---- intake + work order
const ws = buildSubmissionWorkspaceFromStage18({ workspaceId: "ws_st_consumer", projectId: pkg.projectId, packageSnapshot: pkg });
const wo = { workOrderId: ws.workOrderId, projectId: pkg.projectId, caseId: ws.caseId, packageSnapshotId: pkg.snapshotId, documentPurpose: pkg.documentPurpose, route: "JOURNAL_SCI_SSCI" as const, target: "TargetJournal", round: 1, status: "AUTHORIZED_ATTEMPT" as const };
report("C01", ws.sourceSnapshotId === pkg.snapshotId && ws.sourceSnapshotHash.length === 64, "workspace 承接 FinalSubmissionPackageSnapshot id+hash");
report("C02", ws.route === "JOURNAL_SCI_SSCI" && ws.submissionExecutionAuthorized === false, "journal route + execution=false");
report("C03", ws.caseId.startsWith("stc_") && Array.isArray(ws.legs) && ws.legs.length >= 1, "case + standard leg 建立（AUTHOR_TO_JOURNAL）");

// ---- Case / Leg / Round
const caseJ = createSubmissionCase({ scope: { workspaceId: ws.workspaceId, projectId: pkg.projectId, documentId: "doc", manuscriptId: "manuscript1" }, documentPurpose: pkg.documentPurpose, route: "JOURNAL_SCI_SSCI", target: "TargetJournal", publicationFamilyId: `fam_${pkg.documentPurpose}`, intakeMode: "FROM_U18_PACKAGE" });
const legs = standardDestinationLegs({ caseId: caseJ.caseId, route: "JOURNAL_SCI_SSCI" });
const round = openRound({ caseId: caseJ.caseId, leg: legs[0], number: 1 });
report("C04", caseJ.publicationFamilyId === `fam_${pkg.documentPurpose}` && caseJ.route === "JOURNAL_SCI_SSCI", "Case: publicationFamily/route/資料綁定");
report("C05", legs.length === 1 && legs[0]!.kind === "AUTHOR_TO_JOURNAL", "期刊 destination leg = AUTHOR_TO_JOURNAL");
report("C06", round.number === 1 && round.kind === "INITIAL", "Round INITIAL 建立");

// ---- Provider capability (three modes) + ActionIntent
const caps = [registerProviderCapability({ provider: "EditorialManager", accountRef: "acc_j", capability: "COMMIT_SUBMISSION", officialDocRef: "https://example/em-doc", testStatus: "LIVE_VERIFIED" })];
report("C07", resolveProviderMode({ registers: caps }) === "AUTHORIZED_WRITE", "COMMIT_SUBMISSION LIVE → AUTHORIZED_WRITE");
report("C08", resolveProviderMode({ registers: [] }) === "GUIDED_MANUAL", "無能力 → GUIDED_MANUAL（不臆造 endpoint）");
const intent1 = createActionIntent({ caseId: caseJ.caseId, legId: legs[0]!.legId, roundId: round.roundId, actorId: "corr_id", actorRole: "CORRESPONDING_AUTHOR", operation: "SUBMIT", target: "TargetJournal", providerAccountRef: "acc_j", packageDigest: "e".repeat(64), filesManifestRef: "bundle1", audience: "portal", policyVersion: "v1", validUntil: "2099-12-31T00:00:00Z" });
report("C09", intent1.ok === true && intent1.intent.status === "DRAFT" && intent1.intent.singleUse === true, "ActionIntent DRAFT + singleUse");
const confirm1 = intent1.ok ? confirmActionIntent({ intent: intent1.intent, route: "JOURNAL_SCI_SSCI", declarationsConfirmed: true }) : ({ ok: false as const } as const);
report("C10", confirm1.ok === true && confirm1.intent.status === "CONFIRMED" && confirm1.authEvent.scopeDigest.length === 64, "confirm → CONFIRMED + ExecutionAuthorization（digest 綁定）");
// actor role guard: CO_AUTHOR cannot SUBMIT to journal
const coAuth = createActionIntent({ caseId: caseJ.caseId, legId: legs[0]!.legId, roundId: round.roundId, actorId: "co_id", actorRole: "CO_AUTHOR", operation: "SUBMIT", target: "TargetJournal", providerAccountRef: "acc_j", packageDigest: "f".repeat(64), filesManifestRef: "f", audience: "portal", policyVersion: "v1", validUntil: "2099-12-31T00:00:00Z" });
const coConfirm = coAuth.ok ? confirmActionIntent({ intent: coAuth.intent, route: "JOURNAL_SCI_SSCI", declarationsConfirmed: true }) : ({ ok: false as const } as const);
report("C11", coConfirm.ok === false, "CO_AUTHOR 不獲期刊正式 SUBMIT 授權（ACTOR_ROLE_NOT_ALLOWED）");

// ---- attempts lifecycle + reconcile
const a1 = authorizeSubmissionAttempt({ workOrder: wo, packageLocked: true, contentHash: "g".repeat(64), authorizedBy: "corr_id", validUntil: "2099-12-31T00:00:00Z" });
report("C12", a1.ok === true && a1.attempt.reservationStatus === "RESERVED", "attempt reserved");
const aNoLock = authorizeSubmissionAttempt({ workOrder: wo, packageLocked: false, contentHash: "g".repeat(64), authorizedBy: "u", validUntil: "x" });
report("C13", aNoLock.ok === false && aNoLock.code === "PACKAGE_STALE", "unlocked → PACKAGE_STALE");
if (a1.ok) {
  const disp = markAttemptDispatched({ attempt: a1.attempt, dispatchedAt: new Date().toISOString() });
  report("C14", disp.state === "DISPATCHING", "attempt dispatched (DISPATCHING)");
  const unk = markAttemptOutcomeUnknown({ attempt: disp });
  report("C15", unk.outcome === "OUTCOME_UNKNOWN" && unk.state === "OUTCOME_UNKNOWN", "timeout/crash → OUTCOME_UNKNOWN（不自動重送）");
  const ver = verifyAttemptReceipt({ attempt: unk, receiptReference: "MS-2026-09-001" });
  report("C16", ver.ok === true && ver.attempt.outcome === "RECEIPT_VERIFIED", "回執確認 → RECEIPT_VERIFIED");
  const verFake = verifyAttemptReceipt({ attempt: unk, receiptReference: "a" });
  report("C17", verFake.ok === false, "假回執格式拒絕");
}
// reconcile requires OUTCOME_UNKNOWN — handled above via C15/C19
if (a1.ok) {
  const ui = markAttemptOutcomeUnknown({ attempt: a1.attempt });
  const rec = reconcileAttempt({ attempt: ui, reconciled: "NOT_SUBMITTED", evidenceRef: "manual-ref", note: "機關確認未收到" });
  report("C19", rec.ok === true && rec.attempt.outcome === "RECONCILED_NOT_SUBMITTED", "人工核對未送出 → RECONCILED_NOT_SUBMITTED（可安全重開）");
}

// ---- receipt evidence tiers + projection
const rcvUser = verifyReceipt({ workOrderId: wo.workOrderId, caseId: caseJ.caseId, receivedAt: new Date().toISOString(), verifiedAgainst: "USER_REPORTED", sourceRef: "user" });
report("C20", rcvUser.verified === false && rcvUser.evidenceTier === "USER_REPORTED", "USER_REPORTED（7-tier）非官方");
const rcvOfficial = verifyReceipt({ workOrderId: wo.workOrderId, caseId: caseJ.caseId, receivedAt: new Date().toISOString(), verifiedAgainst: "OFFICIAL_PORTAL_OBSERVATION", sourceRef: "portal" });
report("C21", rcvOfficial.verified === true && (rcvOfficial.idStatus === "KNOWN" || rcvOfficial.idStatus === "ID_PENDING"), "官方 portal observation verified");

const eNewR = addSubmissionEvent({ workOrderId: wo.workOrderId, caseId: caseJ.caseId, timestamp: "t2", effectiveAt: "2026-09-05T00:00:00Z", eventType: "STATUS_CHANGE", sourceTier: "OFFICIAL_PORTAL_OBSERVATION", evidenceTier: "OFFICIAL_PORTAL_OBSERVATION", normalizedLabel: "IN_REVIEW", sourceRef: "portal", description: "Under Review" });
const eOldX = addSubmissionEvent({ workOrderId: wo.workOrderId, caseId: caseJ.caseId, timestamp: "t1", effectiveAt: "2026-08-28T00:00:00Z", eventType: "STATUS_CHANGE", sourceTier: "USER_REPORTED", normalizedLabel: "DECISION_RECORDED", sourceRef: "stale", description: "old decision (late arrival)" });
const proj = projectStatus({ caseId: caseJ.caseId, events: [eOldX, eNewR] });
report("C22", proj.lastConfirmedLabel === "IN_REVIEW" && proj.lastConfirmedEventId === eNewR.eventId, "projection：舊信晚到不覆蓋新決定（effective 時點）");
report("C23", mapStatusText({ text: "Decision in Process" }).label === "DECISION_PENDING", "Decision in Process 不 mapping 成 Accept");

// ---- external review + response (isolated from simulated)
const review = addExternalReview({ workOrderId: wo.workOrderId, round: 1, reviewerLabel: "Reviewer X", receivedAt: "t", rawText: "樣本說明不足", sourceVerified: true });
report("C24", review.rawTextHash.length === 64 && review.sourceVerified === true, "ExternalReview（未與 U09/U16 模擬混）");
const withItem = addReviewItem({ review, originalQuote: "請說明樣本", locationRef: "M", category: "STATISTICS" });
report("C25", withItem.items.length === 1 && withItem.items[0]!.status === "PENDING", "review item PENDING");
const respNoEv = updateReviewItemResponse({ review: withItem, itemId: withItem.items[0]!.itemId, decision: "ACCEPT_AND_REVISE", responseDraft: "已新增分析（無證據）", canDisagree: true });
report("C26", respNoEv.ok === true && respNoEv.review.items[0]!.responseKind === "PLANNED_RESPONSE" && respNoEv.review.items[0]!.status !== "RESPONDED", "無證據 → PLANNED_RESPONSE（不 pretend done）");
const respWithEv = updateReviewItemResponse({ review: withItem, itemId: withItem.items[0]!.itemId, decision: "ACCEPT_AND_REVISE", responseDraft: "已補 sample size justification", actionEvidenceRefs: ["evidence:u16-4"], canDisagree: true });
report("C27", respWithEv.ok === true && respWithEv.review.items[0]!.responseKind === "ACTION_VERIFIED_RESPONSE" && respWithEv.review.items[0]!.status === "RESPONDED", "有證據 → ACTION_VERIFIED");

// ---- decision（原文＋category；Decision in Process 不 Accept；accept≠publish/funds）
const decBad = recordFormalDecision({ workOrder: wo, decision: "ACCEPTED", evidenceRef: "reviewer recommend", sourceVerified: false });
report("C28", decBad.ok === false, "未核來源不可記正式接受（Reviewer≠editor）");
const decRec = recordDecisionRecord({ caseId: caseJ.caseId, round: 1, issuingParty: "JournalEdOffice", wording: "We are pleased to inform you your manuscript has been accepted for publication", officialVerified: true });
report("C29", decRec.category === "ACCEPTED" && decRec.categorySourceVerified === true, "DecisionRecord：Accept 原文→category ACCEPTED（來源已核）");
const decStatusOnly = recordDecisionRecord({ caseId: caseJ.caseId, round: 1, issuingParty: "EM", wording: "Required reviews completed; decision in process", officialVerified: true });
report("C30", projectStatusNoDecision(decStatusOnly), "Decision in Process status 不產 ACCEPTED decision category");

// ---- R1 resubmission (new round, new authorization)
const r1 = authorizeResubmission({ workOrder: { ...wo, round: 1 }, revisedPackageLocked: true, newContentHash: "j".repeat(64), authorizedBy: "user_a" });
report("C31", r1.ok === true && r1.attempt.round === 2, "R1 resubmission → attempt round 2（R1 ≠ R0）");
const r1NoLock = authorizeResubmission({ workOrder: { ...wo, round: 1 }, revisedPackageLocked: false, newContentHash: "j".repeat(64), authorizedBy: "u" });
report("C32", r1NoLock.ok === false && r1NoLock.code === "PACKAGE_STALE", "R1 需新 lock 包");

// ---- SubmissionTrackingSnapshot v1.1
const activeEv = addSubmissionEvent({ workOrderId: wo.workOrderId, caseId: caseJ.caseId, timestamp: "t", eventType: "RECEIPT", sourceTier: "OFFICIAL_RECEIPT", evidenceTier: "OFFICIAL_PORTAL_OBSERVATION", sourceRef: "portal", description: "Under Review" });
const snap = buildSubmissionTrackingSnapshot({
  workspaceId: ws.workspaceId, projectId: ws.projectId, workOrderId: ws.workOrderId,
  sourcePackageSnapshot: pkg, workOrder: wo,
  submissionCase: caseJ, destinationLegs: legs, rounds: [round],
  providerCapabilities: [{ provider: "EM", accountRef: "acc_j", mode: "AUTHORIZED_WRITE", capabilities: caps, note: "fixture" }],
  actionIntentRefs: confirm1.ok ? [confirm1.intent.intentId] : [],
  executionAuthorizationEventRefs: confirm1.ok ? [confirm1.authEvent.authEventId] : [],
  attempts: a1.ok ? [a1.attempt] : [],
  events: [activeEv], receipts: [rcvOfficial], reviews: [withItem], upstreamRefs: [createUpstreamRevisionRef({ destinationStage: "final-compliance", changeRequestRef: "cr", workOrderId: wo.workOrderId, reviewId: review.reviewId })],
  decision: "NOT_DECISIONED", rationale: "等待真實官方來源；審查中屬正常狀態。", submissionExecutionAuthorized: false,
});
report("S1", snap.schemaVersion === "submission-tracking/1.1.0", "schema v1.1");
report("S2", snap.stageKey === "V3-U19" && snap.nextStageId === "post-acceptance", "stageKey → nextStage post-acceptance");
report("S3", snap.submissionCase.caseId === caseJ.caseId && snap.destinationLegs.length === 1 && snap.rounds.length === 1, "case/leg/round 載入 snapshot");
report("S4", snap.providerCapabilities.length === 1 && snap.actionIntentRefs.length === (confirm1.ok ? 1 : 0), "provider + ActionIntent refs");
report("S5", snap.intakeMode === "FROM_U18_PACKAGE" && snap.submissionExecutionAuthorized === false, "intake + authorization=false");
report("S6", snap.statusMappingVersion.length > 0 && Array.isArray(snap.upstreamRevisionRefs) && snap.upstreamRevisionRefs.length === 1, "statusMapping + upstream refs");
report("S7", /^chk_st_/.test(snap.checksum) && snap.activeSubmissionGuard === true, "checksum + active guard 反映");
const receiver = buildStage20ReceiverState({ snapshot: snap });
report("S8", receiver.readyForPostAcceptance === false && receiver.postDecisionProcessingAllowed === false, "not decision → 不 ready U20");

// decisioned + accepted
const decisioned = buildSubmissionTrackingSnapshot({
  workspaceId: ws.workspaceId, projectId: ws.projectId, workOrderId: ws.workOrderId,
  sourcePackageSnapshot: pkg, workOrder: { ...wo, status: "DECISIONED" },
  submissionCase: caseJ, destinationLegs: legs, rounds: [round],
  attempts: [], events: [], receipts: [], reviews: [], upstreamRefs: [],
  decisionRecords: [decRec], decision: "ACCEPTED", rationale: "官方接受回執已核對。", submissionExecutionAuthorized: false,
});
const receiverAcc = buildStage20ReceiverState({ snapshot: decisioned });
report("S9", receiverAcc.readyForPostAcceptance === true && receiverAcc.postDecisionProcessingAllowed === true, "真接受 → ready U20");
report("S10", receiverAcc.nextExternalActionAuthorized === false, "接收 snapshot 不會自動付費/簽約/上 Proof（hard=false）");
report("S11", !JSON.stringify(decisioned).includes('"PUBLISHED"') && !JSON.stringify(decisioned).includes('"FUNDS_RECEIVED"'), "Accept 未自動升成 Published/Funds（分離 outcome）");
report("S12", receiver.receiverNotes.length > 0 && receiver.reEntryPoint.route === "submission-tracking", "receiver honest notes + re-entry");

// no fake claims anywhere
report("T-INTEGRITY", !["HUMAN_APPROVED", "HAS_BEEN_SUBMITTED_LIVE"].some((k) => JSON.stringify(snap).includes(k)), "snapshot 從不宣稱 live 送出/真人核准/出版/付款");

function projectStatusNoDecision(record: { category: string }): boolean {
  return record.category !== "ACCEPTED" && record.category !== "ACCEPTED_SUBJECT_TO_EXPLICIT_CONDITIONS";
}
void projectStatus;

console.log("");
console.log(`SUBTRACKING v1.1 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
