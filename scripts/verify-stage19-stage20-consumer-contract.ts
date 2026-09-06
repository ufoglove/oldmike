/**
 * Stage 20 Consumer Contract Test (V3-U19-FULL → V3-U20 receiver)
 * Spec: docs/stage19/spec-v3-4.0.md §9
 *
 * Validates SubmissionTrackingSnapshot:
 *   1. schema / stageKey / nextStageId stable (V3-U19 → post-acceptance)
 *   2. carries upstream FinalSubmissionPackageSnapshot id + hash
 *   3. work order with round/route/status
 *   4. attempts (reservation → dispatch → OUTCOME_UNKNOWN → receipt) without
 *      auto re-dispatch; active-submission guard not bypassable
 *   5. events/receipts real sources only (USER_REPORTED ≠ official)
 *   6. external review isolated from simulated; per-item response matrix
 *   7. upstream revision refs with return locators
 *   8. R1 resubmission requires new locked package + new authorization
 *   9. formal decision only from verified sources
 *  10. Stage 20 receiver builds (non-empty fallback); accepted/granted gates
 *
 * Pure consumer contract test — no DB calls.
 */

import {
  buildSubmissionWorkspaceFromStage18,
  authorizeSubmissionAttempt,
  markAttemptDispatched,
  markAttemptOutcomeUnknown,
  verifyAttemptReceipt,
  assertNoActiveSubmission,
  addSubmissionEvent,
  verifyReceipt,
  addExternalReview,
  addReviewItem,
  updateReviewItemResponse,
  createUpstreamRevisionRef,
  authorizeResubmission,
  recordFormalDecision,
  buildSubmissionTrackingSnapshot,
  buildStage20ReceiverState,
} from "../lib/submission-tracking-v3-service.ts";
import { type FinalSubmissionPackageSnapshot } from "../lib/final-submission-v3-contract.ts";

let pass = 0;
let fail = 0;
function report(id: string, cond: boolean, note: string): void {
  if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); }
  else { fail++; console.error(`[FAIL] ${id} - ${note}`); }
}

const pkg: FinalSubmissionPackageSnapshot = {
  snapshotId: "fspsnap_consumer_u19",
  schemaVersion: "final-submission/1.0.0",
  stageKey: "V3-U18",
  workspaceId: "ws_st_consumer",
  projectId: "proj_u19_consumer",
  workOrderId: "wfc_consumer",
  stageId: "final-compliance",
  nextStageId: "submission-tracking",
  sourceLanguageQualitySnapshotId: "lqsnap_consumer",
  sourceLanguageQualitySnapshotHash: "a".repeat(64),
  goalContextRevision: 1,
  primaryGoal: "JOURNAL_SCI_SSCI",
  documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
  decision: "READY_FOR_AUTHOR_SUBMISSION",
  decisionRationale: "consumer fixture",
  submissionExecutionAuthorized: false,
  submissionStatus: "NOT_SUBMITTED_BY_THIS_STAGE",
  route: "JOURNAL_SCI_SSCI",
  profile: { profileId: "jp", route: "JOURNAL_SCI_SSCI", targetJournal: "TBD", articleType: "TBD", requirements: [], reportingGuideline: "", anonymizationRequired: true, coverLetterRequired: true, titlePageRequired: true },
  ruleSnapshots: [],
  packageState: "LOCKED_READY",
  readyForAction: "READY_FOR_AUTHOR_SUBMISSION",
  workOrder: {} as any,
  fieldMap: { mapId: "fm", target: "JOURNAL_INITIAL_SUBMISSION", fields: [] },
  visibilityManifest: [],
  externalBundle: { manifestId: "ext", bundleKind: "EXTERNAL_SUBMISSION_BUNDLE", files: [], requiredFileReconciliationPassed: false, createdAt: "" },
  internalEvidencePackage: { manifestId: "int", bundleKind: "INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE", files: [], requiredFileReconciliationPassed: false, createdAt: "" },
  documents: [],
  approvalSubjectManifest: { manifestId: "asm", projectId: "p", documents: [], contentHash: "h".repeat(64), createdById: "u", createdAt: "" },
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
  checksum: "chk_fs_consumer",
  createdAt: new Date().toISOString(),
};

// ---- 1. Intake from Stage 18
const ws = buildSubmissionWorkspaceFromStage18({ workspaceId: "ws_st_consumer", projectId: "proj_u19_consumer", packageSnapshot: pkg });
report("S20-C01", ws.sourceSnapshotId === pkg.snapshotId, "workspace points to source FinalSubmissionPackageSnapshot");
report("S20-C02", ws.sourceSnapshotHash.length === 64, "source hash is sha256");
report("S20-C03", ws.route === "JOURNAL_SCI_SSCI", "journal route selected");
report("S20-C04", ws.submissionExecutionAuthorized === false, "submission_execution_authorized never auto-true");
report("S20-C05", ws.packageLocked === true, "package locked carried from U18");

// ---- 2. Attempt lifecycle
const wo = { workOrderId: "wst_consumer", projectId: "proj_u19_consumer", packageSnapshotId: pkg.snapshotId, documentPurpose: pkg.documentPurpose, route: "JOURNAL_SCI_SSCI" as const, target: "TBD", round: 1, status: "AUTHORIZED_ATTEMPT" as const };
const auth = authorizeSubmissionAttempt({ workOrder: wo, packageLocked: true, contentHash: "c".repeat(64), authorizedBy: "user_a", validUntil: "2099-01-01" });
report("S20-A1", auth.ok === true && auth.attempt.reservationStatus === "RESERVED", "attempt reserved before dispatch");
const authNoLock = authorizeSubmissionAttempt({ workOrder: wo, packageLocked: false, contentHash: "c".repeat(64), authorizedBy: "u", validUntil: "2099-01-01" });
report("S20-A2", authNoLock.ok === false && authNoLock.code === "PACKAGE_NOT_LOCKED", "unlocked package blocks attempt");
if (auth.ok) {
  const dispatched = markAttemptDispatched({ attempt: auth.attempt, dispatchedAt: new Date().toISOString() });
  report("S20-A3", dispatched.reservationStatus === "DISPATCHED", "attempt dispatched");
  const unknown = markAttemptOutcomeUnknown({ attempt: dispatched });
  report("S20-A4", unknown.outcome === "OUTCOME_UNKNOWN", "timeout ⇒ OUTCOME_UNKNOWN (no auto re-dispatch)");
  const verified = verifyAttemptReceipt({ attempt: unknown, receiptReference: "MSP-2026-000123" });
  report("S20-A5", verified.ok === true && verified.attempt.outcome === "RECEIPT_VERIFIED", "valid receipt reference verifies attempt");
  const fakeRcpt = verifyAttemptReceipt({ attempt: unknown, receiptReference: "abc" });
  report("S20-A6", fakeRcpt.ok === false && fakeRcpt.code === "RECEIPT_NOT_VERIFIED", "fake/invalid receipt reference rejected");
}

// ---- 3. Active-submission guard
const noActive = assertNoActiveSubmission({ workOrder: wo, activeEvent: null });
report("S20-G1", noActive.ok === true, "no active submission allows new attempt");
const activeEvent = addSubmissionEvent({ workOrderId: "wst_consumer", timestamp: new Date().toISOString(), eventType: "RECEIPT", sourceTier: "OFFICIAL_RECEIPT", sourceRef: "ref", description: "under review" });
const hasActive = assertNoActiveSubmission({ workOrder: wo, activeEvent });
report("S20-G2", hasActive.ok === false && hasActive.code === "ACTIVE_SUBMISSION_GUARD", "active submission guard blocks (not bypassable)");

// ---- 4. Events & receipts real sources
const evUser = addSubmissionEvent({ workOrderId: "wst_consumer", timestamp: new Date().toISOString(), eventType: "ATTEMPT", sourceTier: "USER_REPORTED", sourceRef: "user-said", description: "我送出了" });
report("S20-E1", evUser.verified === false, "USER_REPORTED never auto-verified as official");
const evOfficial = addSubmissionEvent({ workOrderId: "wst_consumer", timestamp: new Date().toISOString(), eventType: "RECEIPT", sourceTier: "OFFICIAL_RECEIPT", sourceRef: "portal", description: "Under Review" });
report("S20-E2", evOfficial.verified === true, "official receipt verified");
const rcptUser = verifyReceipt({ workOrderId: "wst_consumer", caseId: "C1", receivedAt: new Date().toISOString(), verifiedAgainst: "USER_REPORTED", sourceRef: "user" });
report("S20-E3", rcptUser.verified === false, "user-reported receipt not verified");
const rcptOfficial = verifyReceipt({ workOrderId: "wst_consumer", caseId: "C1", receivedAt: new Date().toISOString(), verifiedAgainst: "OFFICIAL_PORTAL_OBSERVATION", sourceRef: "portal" });
report("S20-E4", rcptOfficial.verified === true, "official portal observation verified");

// ---- 5. External review isolated + response matrix
const review = addExternalReview({ workOrderId: "wst_consumer", round: 1, reviewerLabel: "Reviewer X", receivedAt: new Date().toISOString(), rawText: "Method concern...", sourceVerified: true });
report("S20-R1", review.rawTextHash.length === 64, "review raw text hashed");
const withItem = addReviewItem({ review, originalQuote: "請說明 sample size", locationRef: "RESULTS:p1", category: "STATISTICS" });
report("S20-R2", withItem.items.length === 1 && withItem.items[0]!.status === "PENDING", "review item added as PENDING");
const resp = updateReviewItemResponse({ review: withItem, itemId: withItem.items[0]!.itemId, decision: "ACCEPT_AND_REVISE", responseDraft: "已補充 sample size justification", actualChangeRef: "evidence:U16-finding-3", canDisagree: true });
report("S20-R3", resp.ok === true && resp.review.items[0]!.status === "RESPONDED", "response with actual change ref ⇒ RESPONDED");
const respNoEvidence = updateReviewItemResponse({ review: withItem, itemId: withItem.items[0]!.itemId, decision: "ACCEPT_AND_REVISE", responseDraft: "已新增分析（無證據）", canDisagree: true });
report("S20-R4", respNoEvidence.ok === true && respNoEvidence.review.items[0]!.status !== "RESPONDED", "no evidence ⇒ not RESPONDED (cannot pretend done)");

// ---- 6. Upstream revision ref
const upRef = createUpstreamRevisionRef({ destinationStage: "final-compliance", changeRequestRef: "cr_u18_1", workOrderId: "wst_consumer", reviewId: review.reviewId, itemId: withItem.items[0]!.itemId });
report("S20-U1", upRef.destinationStage === "final-compliance" && upRef.returnTarget.route === "submission-tracking", "upstream ref with return locator");

// ---- 7. R1 resubmission
const r1ok = authorizeResubmission({ workOrder: wo, revisedPackageLocked: true, newContentHash: "x".repeat(64), authorizedBy: "user_a" });
report("S20-RE1", r1ok.ok === true && r1ok.attempt.attemptId.startsWith("att_r"), "R1 resubmission authorized with new content hash");
const r1nolock = authorizeResubmission({ workOrder: wo, revisedPackageLocked: false, newContentHash: "x".repeat(64), authorizedBy: "u" });
report("S20-RE2", r1nolock.ok === false && r1nolock.code === "REVISION_PACKAGE_NOT_LOCKED", "R1 requires new locked package (R1 ≠ R0)");

// ---- 8. Formal decision only verified
const decBad = recordFormalDecision({ workOrder: wo, decision: "MINOR_REVISION", evidenceRef: "user-said", sourceVerified: false });
report("S20-D1", decBad.ok === false && decBad.code === "EVENT_SOURCE_UNTRUSTED", "unverified source cannot record official decision");
const decGood = recordFormalDecision({ workOrder: wo, decision: "MINOR_REVISION", evidenceRef: "portal-MS123", sourceVerified: true });
report("S20-D2", decGood.ok === true && decGood.decision === "MINOR_REVISION", "verified decision recorded");
const decNot = recordFormalDecision({ workOrder: wo, decision: "NOT_DECISIONED", evidenceRef: "x", sourceVerified: true });
report("S20-D3", decNot.ok === false, "NOT_DECISIONED rejected as a recorded decision");

// ---- 9. Snapshot
const attempt = auth.ok ? auth.attempt : null;
const snapshot = buildSubmissionTrackingSnapshot({
  workspaceId: ws.workspaceId,
  projectId: ws.projectId,
  workOrderId: ws.workOrderId,
  sourcePackageSnapshot: pkg,
  workOrder: wo,
  attempts: attempt ? [attempt] : [],
  events: [activeEvent],
  receipts: [rcptOfficial],
  reviews: [withItem],
  upstreamRefs: [upRef],
  decision: "NOT_DECISIONED",
  rationale: "等待真實官方來源；審查中屬正常狀態。",
  submissionExecutionAuthorized: false,
});
report("S20-S1", snapshot.schemaVersion === "submission-tracking/1.0.0", "snapshot schema version stable");
report("S20-S2", snapshot.stageKey === "V3-U19", "snapshot stageKey is V3-U19");
report("S20-S3", snapshot.nextStageId === "post-acceptance", "nextStageId points to Stage 20");
report("S20-S4", snapshot.sourceFinalSubmissionPackageSnapshotId === pkg.snapshotId, "upstream package id carried");
report("S20-S5", snapshot.submissionExecutionAuthorized === false, "authorization stays false in snapshot");
report("S20-S6", snapshot.workOrder.round === 1, "work order round carried");
report("S20-S7", snapshot.externalReviews.length === 1 && snapshot.externalReviews[0]!.sourceVerified === true, "external review carried with source verification");
report("S20-S8", Array.isArray(snapshot.upstreamRevisionRefs) && snapshot.upstreamRevisionRefs.length === 1, "upstream revision refs carried");
report("S20-S9", /^chk_st_/.test(snapshot.checksum), "checksum has expected prefix");
report("S20-S10", snapshot.activeSubmissionGuard === true, "active submission guard reflected in snapshot");

// decisioned snapshot
const decisioned = buildSubmissionTrackingSnapshot({
  workspaceId: ws.workspaceId, projectId: ws.projectId, workOrderId: ws.workOrderId,
  sourcePackageSnapshot: pkg, workOrder: { ...wo, status: "DECISIONED" },
  attempts: [], events: [evOfficial], receipts: [rcptOfficial], reviews: [], upstreamRefs: [],
  decision: "ACCEPTED", rationale: "官方接受回執已核對。", submissionExecutionAuthorized: false,
});
report("S20-D4", decisioned.decision === "ACCEPTED", "accepted decision recorded in snapshot");

// ---- 10. Stage 20 receiver
const receiver = buildStage20ReceiverState({ snapshot });
report("S20-RC1", receiver.receiverVersion === "post-acceptance-receiver/1.0.0", "receiver version stable");
report("S20-RC2", receiver.readyForPostAcceptance === false, "not decisioned ⇒ not ready for post-acceptance (no fake green)");
const receiverOk = buildStage20ReceiverState({ snapshot: decisioned });
report("S20-RC3", receiverOk.readyForPostAcceptance === true, "accepted ⇒ ready for post-acceptance");
report("S20-RC4", receiver.receiverNotes.length > 0, "receiver notes honest (U20 not built)");
report("S20-RC5", receiver.reEntryPoint.route === "submission-tracking", "receiver re-entry back to U19");

// No fake claims
report("S20-E1", !["PUBLISHED", "PAID", "HUMAN_APPROVED"].some((k) => JSON.stringify(snapshot).includes(k)), "snapshot never claims publication/payment/human approval");

console.log("");
console.log(`STAGE 20 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);