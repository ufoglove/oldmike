/**
 * Submission Tracking & Review Cycles Service (V3-U19-FULL)
 * Spec: docs/stage19/spec-v3-4.0.md
 *
 * Implements:
 * 1. Zero re-entry intake from Stage 18 FinalSubmissionPackageSnapshot
 * 2. Pre-submit re-verification + explicit authorization (submission_execution_authorized)
 * 3. External attempt reservation → dispatch → outcome (OUTCOME_UNKNOWN on timeout;
 *    no auto re-dispatch, no auto provider switch)
 * 4. Active-submission guard (cannot be bypassed by new project / renamed title / new language)
 * 5. Events & receipts: real sources only (USER_REPORTED ≠ official receipt)
 * 6. External review isolation (real vs simulated), per-item Response Matrix
 * 7. Upstream revision refs (U14/U13/U15/U16/U17/U18) with return locators
 * 8. R1 resubmission requires new QA + confirm + lock + new authorization (R1 ≠ R0)
 * 9. Formal decision & downstream routing → SubmissionTrackingSnapshot → U20
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type SubmissionWorkOrder,
  type ExternalAttempt,
  type SubmissionEvent,
  type ReceiptVerification,
  type ExternalReview,
  type ExternalReviewItem,
  type UpstreamRevisionRef,
  type FormalDecision,
  type SubmissionTrackingSnapshot,
  type Stage20ReceiverState,
  type SubmissionRoute,
} from "./submission-tracking-v3-contract.ts";
import { type FinalSubmissionPackageSnapshot } from "./final-submission-v3-contract.ts";

function sha256(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// -------------------------------------------------------------
// §1 Zero re-entry intake from Stage 18
// -------------------------------------------------------------
export function buildSubmissionWorkspaceFromStage18(params: {
  workspaceId: string;
  projectId: string;
  packageSnapshot: FinalSubmissionPackageSnapshot;
}): {
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  sourceSnapshotId: string;
  sourceSnapshotHash: string;
  primaryGoal: import("./research-goal-registry.ts").PrimaryGoalId;
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  round: number;
  packageLocked: boolean;
  submissionExecutionAuthorized: boolean;
  createdAt: string;
} {
  const { workspaceId, projectId, packageSnapshot } = params;

  const route: SubmissionRoute =
    packageSnapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : packageSnapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR";

  return {
    workspaceId: `ws_st_${projectId}`,
    projectId,
    workOrderId: `wst_${projectId}`,
    sourceSnapshotId: packageSnapshot.snapshotId,
    sourceSnapshotHash: sha256({ id: packageSnapshot.snapshotId, decision: packageSnapshot.decision }),
    primaryGoal: packageSnapshot.primaryGoal,
    documentPurpose: packageSnapshot.documentPurpose,
    route,
    target: route === "JOURNAL_SCI_SSCI" ? "目標期刊（依已確認）" : route === "NSTC_GENERAL" ? "國科會一般研究計畫（依年度公告）" : "教育部教學實踐研究計畫（依年度公告）",
    round: 1, // R1: first actual dispatch cycle in U19 (R0 = package ready)
    packageLocked: packageSnapshot.packageLocked,
    submissionExecutionAuthorized: false, // carried from U18; never auto-true
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §2 Pre-submit re-verification + explicit authorization
// -------------------------------------------------------------
export function authorizeSubmissionAttempt(params: {
  workOrder: SubmissionWorkOrder;
  packageLocked: boolean;
  contentHash: string;
  authorizedBy: string;
  validUntil: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: string; reason: string } {
  if (!params.packageLocked) {
    return { ok: false, code: "PACKAGE_NOT_LOCKED", reason: "U18 成果包尚未 lock，不可送件。" };
  }
  if (!params.contentHash) {
    return { ok: false, code: "ATTEMPT_ALREADY_DISPATCHED", reason: "內容 hash 缺失，無法綁定送件 bytes。" };
  }
  const attempt: ExternalAttempt = {
    attemptId: `att_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    workOrderId: params.workOrder.workOrderId,
    target: params.workOrder.target,
    actorAccount: params.authorizedBy,
    operation: "SUBMIT",
    contentHash: params.contentHash,
    authorizedBy: params.authorizedBy,
    authorizedUntil: params.validUntil,
    reservationStatus: "RESERVED",
    outcome: "NOT_DISPATCHED",
    note: "Attempt 已 reservation；實際派送為人工導引（GUIDED_MANUAL），不臆造 endpoint。",
  };
  return { ok: true, attempt };
}

// -------------------------------------------------------------
// §3 Dispatch & outcome (OUTCOME_UNKNOWN on timeout; no auto re-dispatch)
// -------------------------------------------------------------
export function markAttemptDispatched(params: { attempt: ExternalAttempt; dispatchedAt: string }): ExternalAttempt {
  return { ...params.attempt, reservationStatus: "DISPATCHED", outcome: "DISPATCHED", note: "已派送；等待真實回執。timeout 可能已計費/已送出，記 OUTCOME_UNKNOWN 而非自動重送。" };
}

export function markAttemptOutcomeUnknown(params: { attempt: ExternalAttempt }): ExternalAttempt {
  return { ...params.attempt, reservationStatus: "OUTCOME_UNKNOWN", outcome: "OUTCOME_UNKNOWN", note: "timeout/worker crash/取消後可能已送出；先對帳，不自動重送、不自動換 provider。" };
}

export function verifyAttemptReceipt(params: {
  attempt: ExternalAttempt;
  receiptReference: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: "RECEIPT_NOT_VERIFIED"; reason: string } {
  if (!params.receiptReference || !/^[A-Za-z0-9_-]{4,}$/.test(params.receiptReference)) {
    return { ok: false, code: "RECEIPT_NOT_VERIFIED", reason: "回執 reference 格式無效或缺失；不得以假 ID 補造官方收件。" };
  }
  return { ok: true, attempt: { ...params.attempt, reservationStatus: "VERIFIED", outcome: "RECEIPT_VERIFIED", receiptReference: params.receiptReference } };
}

// -------------------------------------------------------------
// §4 Active-submission guard (not bypassable)
// -------------------------------------------------------------
export function assertNoActiveSubmission(params: {
  workOrder: SubmissionWorkOrder;
  activeEvent: SubmissionEvent | null;
}): { ok: true } | { ok: false; code: "ACTIVE_SUBMISSION_GUARD"; reason: string } {
  if (params.activeEvent) {
    return {
      ok: false,
      code: "ACTIVE_SUBMISSION_GUARD",
      reason: "存在 active submission（含現行審查/待回執狀態）；不得以新 Project、改題名或換語言繞過。",
    };
  }
  return { ok: true };
}

// -------------------------------------------------------------
// §5 Events & receipts (real sources only)
// -------------------------------------------------------------
export function addSubmissionEvent(params: {
  workOrderId: string;
  timestamp: string;
  eventType: SubmissionEvent["eventType"];
  sourceTier: SubmissionEvent["sourceTier"];
  sourceRef: string;
  description: string;
  rawPayload?: string;
}): SubmissionEvent {
  return {
    eventId: `ev_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    workOrderId: params.workOrderId,
    timestamp: params.timestamp,
    eventType: params.eventType,
    sourceTier: params.sourceTier,
    sourceRef: params.sourceRef,
    description: params.description,
    verified: params.sourceTier === "OFFICIAL_RECEIPT" || params.sourceTier === "OFFICIAL_PORTAL_OBSERVATION",
    rawPayloadHash: params.rawPayload ? sha256(params.rawPayload) : undefined,
  };
}

export function verifyReceipt(params: {
  workOrderId: string;
  caseId: string;
  receivedAt: string;
  verifiedAgainst: ReceiptVerification["verifiedAgainst"];
  sourceRef: string;
}): ReceiptVerification {
  const verified = params.verifiedAgainst === "OFFICIAL_RECEIPT" || params.verifiedAgainst === "OFFICIAL_PORTAL_OBSERVATION";
  return {
    receiptId: `rcpt_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    workOrderId: params.workOrderId,
    caseId: params.caseId,
    receivedAt: params.receivedAt,
    verifiedAgainst: params.verifiedAgainst,
    sourceRef: params.sourceRef,
    verified,
    note: verified
      ? "回執經官方來源核對。"
      : "僅 USER_REPORTED／DOCUMENT_CHECKED／PROVIDER_EVENT：不等於官方收件。",
  };
}

// -------------------------------------------------------------
// §7 External review (isolated from U09/U16 simulated) + Response Matrix
// -------------------------------------------------------------
export function addExternalReview(params: {
  workOrderId: string;
  round: number;
  reviewerLabel: string;
  receivedAt: string;
  rawText: string;
  sourceVerified: boolean;
}): ExternalReview {
  const reviewId = `rv_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  return {
    reviewId,
    workOrderId: params.workOrderId,
    round: params.round,
    reviewerLabel: params.reviewerLabel,
    receivedAt: params.receivedAt,
    rawTextHash: sha256(params.rawText),
    originalTextRef: `raw_review_${reviewId}`.slice(0, 64),
    items: [],
    sourceVerified: params.sourceVerified,
  };
}

export function addReviewItem(params: {
  review: ExternalReview;
  originalQuote: string;
  locationRef: string;
  category: ExternalReviewItem["category"];
}): ExternalReview {
  return {
    ...params.review,
    items: [
      ...params.review.items,
      {
        itemId: `it_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
        reviewId: params.review.reviewId,
        originalQuote: params.originalQuote,
        locationRef: params.locationRef,
        round: params.review.round,
        category: params.category,
        decision: "REQUEST_CLARIFICATION",
        responseDraft: "",
        status: "PENDING",
      },
    ],
  };
}

export function updateReviewItemResponse(params: {
  review: ExternalReview;
  itemId: string;
  decision: ExternalReviewItem["decision"];
  responseDraft: string;
  actualChangeRef?: string;
  canDisagree: boolean;
}): { ok: true; review: ExternalReview } | { ok: false; code: string; reason: string } {
  const idx = params.review.items.findIndex((i) => i.itemId === params.itemId);
  if (idx < 0) return { ok: false, code: "REVIEW_NOT_VERIFIED", reason: "item 不存在。" };
  const items = params.review.items.map((i, n) =>
    n === idx
      ? {
          ...i,
          decision: params.decision,
          responseDraft: params.responseDraft,
          actualChangeRef: params.actualChangeRef,
          status: params.actualChangeRef ? ("RESPONDED" as const) : ("DRAFTED" as const),
        }
      : i
  );
  return { ok: true, review: { ...params.review, items } };
}

// -------------------------------------------------------------
// §8 Upstream revision ref
// -------------------------------------------------------------
export function createUpstreamRevisionRef(params: {
  destinationStage: UpstreamRevisionRef["destinationStage"];
  changeRequestRef: string;
  workOrderId: string;
  reviewId?: string;
  itemId?: string;
}): UpstreamRevisionRef {
  return {
    refId: `ur_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    destinationStage: params.destinationStage,
    changeRequestRef: params.changeRequestRef,
    returnTarget: { route: "submission-tracking", workOrderId: params.workOrderId, reviewId: params.reviewId, itemId: params.itemId },
    status: "PENDING",
  };
}

// -------------------------------------------------------------
// §8 R1 resubmission (R1 ≠ R0)
// -------------------------------------------------------------
export function authorizeResubmission(params: {
  workOrder: SubmissionWorkOrder;
  revisedPackageLocked: boolean;
  newContentHash: string;
  authorizedBy: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: string; reason: string } {
  if (params.workOrder.round < 1) return { ok: false, code: "ROUND_RESUBMISSION_GUARD", reason: "尚未完成初輪，不可重送。" };
  if (!params.revisedPackageLocked) {
    return { ok: false, code: "REVISION_PACKAGE_NOT_LOCKED", reason: "修訂後包需本輪 QA、確認、lock 與新授權；原初稿 approval 或 R0 回執不能算 R1 再送成功。" };
  }
  if (!params.newContentHash) return { ok: false, code: "ATTEMPT_ALREADY_DISPATCHED", reason: "新內容 hash 缺失。" };
  const attempt: ExternalAttempt = {
    attemptId: `att_r${params.workOrder.round + 1}_${Date.now().toString(36)}`,
    workOrderId: params.workOrder.workOrderId,
    target: params.workOrder.target,
    actorAccount: params.authorizedBy,
    operation: "SUBMIT",
    contentHash: params.newContentHash,
    authorizedBy: params.authorizedBy,
    authorizedUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
    reservationStatus: "RESERVED",
    outcome: "NOT_DISPATCHED",
    note: "R1 再送需新授權；原 approval 不沿用新 bytes。",
  };
  return { ok: true, attempt };
}

// -------------------------------------------------------------
// §9 Formal decision routing
// -------------------------------------------------------------
export function recordFormalDecision(params: {
  workOrder: SubmissionWorkOrder;
  decision: FormalDecision;
  evidenceRef: string;
  sourceVerified: boolean;
}): { ok: true; decision: FormalDecision; rationale: string } | { ok: false; code: string; reason: string } {
  if (params.decision === "NOT_DECISIONED") return { ok: false, code: "EVENT_SOURCE_UNTRUSTED", reason: "決策不可為 NOT_DECISIONED。" };
  if (!params.sourceVerified) {
    return { ok: false, code: "EVENT_SOURCE_UNTRUSTED", reason: "決策須來自真實官方來源（回執/portal observation）；Reviewer recommend accept ≠ editor accept。" };
  }
  return { ok: true, decision: params.decision, rationale: `決策 ${params.decision} 已由來源 ${params.evidenceRef} 核對。` };
}

// -------------------------------------------------------------
// §9 SubmissionTrackingSnapshot builder
// -------------------------------------------------------------
export function buildSubmissionTrackingSnapshot(params: {
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  sourcePackageSnapshot: FinalSubmissionPackageSnapshot;
  workOrder: SubmissionWorkOrder;
  attempts: ExternalAttempt[];
  events: SubmissionEvent[];
  receipts: ReceiptVerification[];
  reviews: ExternalReview[];
  upstreamRefs: UpstreamRevisionRef[];
  decision: FormalDecision;
  rationale: string;
  submissionExecutionAuthorized: boolean;
  revisedPackageSnapshotId?: string;
  resubmissionAttemptId?: string;
}): SubmissionTrackingSnapshot {
  const {
    workspaceId, projectId, workOrderId, sourcePackageSnapshot, workOrder,
    attempts, events, receipts, reviews, upstreamRefs, decision, rationale,
    submissionExecutionAuthorized, revisedPackageSnapshotId, resubmissionAttemptId,
  } = params;

  const snapshotId = `stsna_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const activeGuard =
    decision === "NOT_DECISIONED" &&
    events.some((e) => e.verified && /UNDER_REVIEW|RECEIPT|REVIEW_RECEIVED|REVISION_REQUEST/.test(`${e.eventType} ${e.description}`));

  return {
    snapshotId,
    schemaVersion: "submission-tracking/1.0.0",
    stageKey: "V3-U19",
    workspaceId,
    projectId,
    workOrderId,
    stageId: "submission-tracking",
    nextStageId: "post-acceptance", // Stage 20: 接受/核定後作業與成果管理
    sourceFinalSubmissionPackageSnapshotId: sourcePackageSnapshot.snapshotId,
    sourceFinalSubmissionPackageSnapshotHash: sha256({ id: sourcePackageSnapshot.snapshotId, decision: sourcePackageSnapshot.decision }),
    goalContextRevision: 1,
    primaryGoal: sourcePackageSnapshot.primaryGoal,
    documentPurpose: sourcePackageSnapshot.documentPurpose,

    decision,
    decisionRationale: rationale,
    submissionExecutionAuthorized,
    activeSubmissionGuard: activeGuard,

    workOrder,
    attempts,
    events,
    receipts,
    externalReviews: reviews,
    responseMatrixRef: `resp_matrix_${workOrderId}`,
    upstreamRevisionRefs: upstreamRefs,

    revisedPackageSnapshotId,
    resubmissionAttemptId,

    unresolvedIssueRefs: [],
    laterStageRequirements: ["接受/核定後作業與成果管理（U20）需另授權", "正式出版/款項/人體研究授權不因本階段接受而自動成立"],
    limitations: [
      "本快照為送件與審查追蹤基線；只有真實官方來源的回執/決定才標 verified。",
      "submission_execution_authorized 預設 false；正式 commit/Post/寄信/撤回/轉投均需精確授權（target/actor/operation/content hash/有效期）。",
      "GUIDED_MANUAL：無通用投稿 API 時如實標示，不臆造 endpoint。",
      "第二十階段尚未建置；本輪提供可重開 receiver 頁，不跳空白頁。",
    ],
    checksum: `chk_st_${Date.now().toString(36)}_${sha256(snapshotId).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §9 Stage 20 receiver state
// -------------------------------------------------------------
export function buildStage20ReceiverState(params: { snapshot: SubmissionTrackingSnapshot }): Stage20ReceiverState {
  const { snapshot } = params;
  const acceptedOrGranted = snapshot.decision === "ACCEPTED" || snapshot.decision === "GRANTED";
  const notes: string[] = [];
  if (!acceptedOrGranted) notes.push("尚未有真實接受/核定；只能保存準備，不點亮 U20。");
  if (snapshot.decision === "NOT_DECISIONED") notes.push("等待審查是正常狀態，不為亮綠燈捏造接受。");
  notes.push("U20 尚未完整建置；此為可重開 receiver，可返回 U19，不生成假接受/核定。");

  return {
    receiverVersion: "post-acceptance-receiver/1.0.0",
    stageKey: "V3-U20-RECEIVER",
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    sourceSubmissionTrackingSnapshotId: snapshot.snapshotId,
    sourceSchemaVersion: snapshot.schemaVersion,
    primaryGoal: snapshot.primaryGoal,
    decision: snapshot.decision,
    round: snapshot.workOrder.round,
    activeSubmissionGuard: snapshot.activeSubmissionGuard,
    submissionExecutionAuthorized: snapshot.submissionExecutionAuthorized,
    eventCount: snapshot.events.length,
    reviewCount: snapshot.externalReviews.length,
    readyForPostAcceptance: acceptedOrGranted,
    receiverNotes: notes,
    reEntryPoint: { route: "submission-tracking", action: "initialize", snapshotId: snapshot.sourceFinalSubmissionPackageSnapshotId },
    createdAt: new Date().toISOString(),
  };
}
