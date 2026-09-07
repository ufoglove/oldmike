/**
 * Submission Tracking & Review Cycles Service (V3-U19-FULL, R2)
 * Spec: docs/stage19/spec-v3-4.0.md（完整 36 節版）
 *
 * R1 函式簽名保留相容（route/consumer 不回改）。R2 規格補強集中在本檔：
 * §3  … provider capability registry（三模式）
 * §4  … SubmissionCase / DestinationLeg / SubmissionRound
 * §6  … ActionIntent + ExecutionAuthorization（單次、綁 digest、角色、聲明）
 * §7  … ActiveSubmissionGuard（publication family）分離 R1 函式
 * §8  … Attempt 狀態機（reconcile / cancel 未 dispatch）
 * §10 … 7-tier evidence、ID_PENDING、錯 case/round 拒絕
 * §11 … status event projection（衝突保留、原文）
 * §16 … DecisionRecord 分流（Decision in Process 不→Accept）
 * §17 … external review 拆分、source complete、conflict disposition
 * §18 … ReviewResponseWorkOrder＋PLANNED/ACTION_VERIFIED＋ReplyClaimChecker
 * §14 … 入站驗簽（raw body）、HTML sanitize、敏感外傳護欄
 * §15 … deadline（DATE_ONLY/timezone）、extension、reminder 草稿
 * §23 … withdrawal / transfer / appeal eligibility
 * §24 … Accept≠Publish、Award≠Funds/Exec、條件式
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type ExternalAttempt,
} from "./submission-tracking-v3-contract.ts";
import {
  type ActionIntent,
  type ActorRole,
  type AttemptOutcome,
  type DecisionCategory,
  type DecisionRecord,
  type DestinationLeg,
  type DestinationLegKind,
  type EvidenceTier,
  type ExecutionAuthorizationEvent,
  type ExternalOperation,
  type ExternalReview,
  type ExternalReviewItem,
  type FormalDecision,
  type IntakeMode,
  type NormalizedStatusLabel,
  type ProviderCapabilities,
  type ProviderCapability,
  type ProviderCapabilityEntry,
  type ProviderMode,
  type ReceiptVerification,
  type ReviewResponseWorkOrder,
  type Stage20ReceiverState,
  type StatusProjection,
  type SubmissionCase,
  type SubmissionEvent,
  type SubmissionRound,
  type SubmissionRoundKind,
  type SubmissionRoute,
  type SubmissionTrackingSnapshot,
  type SubmissionWorkOrder,
  type UpstreamRevisionRef,
  SUBMISSION_TRACKING_ERROR_CODES,
  STATUS_MAPPING_VERSION,
} from "./submission-tracking-v3-contract.ts";
import { type FinalSubmissionPackageSnapshot } from "./final-submission-v3-contract.ts";

type ErrCode = (typeof SUBMISSION_TRACKING_ERROR_CODES)[number];

function sha256(input: unknown): string {
  return createHash("sha256")
    .update(typeof input === "string" ? input : JSON.stringify(input))
    .digest("hex");
}

const err = (code: ErrCode, reason: string) => ({ ok: false as const, code, reason });

// =========================================================================
// §1 R1 相容：承接 U18（回傳案件雛形 + work order 基礎）
// =========================================================================
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
  caseId: string;
  intakeMode: IntakeMode;
  legs: DestinationLeg[];
  createdAt: string;
} {
  const { workspaceId, projectId, packageSnapshot } = params;
  const route: SubmissionRoute =
    packageSnapshot.primaryGoal === "JOURNAL_SCI_SSCI"
      ? "JOURNAL_SCI_SSCI"
      : packageSnapshot.primaryGoal === "NSTC_GENERAL"
        ? "NSTC_GENERAL"
        : "MOE_TPR";
  const caseId = `stc_${projectId}`;
  const legs = standardDestinationLegs({ caseId, route });
  return {
    workspaceId: `ws_st_${projectId}`,
    projectId,
    workOrderId: `wst_${projectId}`,
    sourceSnapshotId: packageSnapshot.snapshotId,
    sourceSnapshotHash: sha256({ id: packageSnapshot.snapshotId, decision: packageSnapshot.decision }),
    primaryGoal: packageSnapshot.primaryGoal,
    documentPurpose: packageSnapshot.documentPurpose,
    route,
    target: route === "JOURNAL_SCI_SSCI" ? "目標期刊（依已確認）" : route === "NSTC_GENERAL" ? "國科會一般研究計畫（依公告）" : "教育部教學實踐研究計畫（依公告）",
    round: 1,
    packageLocked: packageSnapshot.packageLocked,
    submissionExecutionAuthorized: false, // 恆定 U18=false
    caseId,
    intakeMode: "FROM_U18_PACKAGE",
    legs,
    createdAt: new Date().toISOString(),
  };
}

// =========================================================================
// §8 R1 相容 attempt（ret 形狀不變；內部走 R2 態）
// =========================================================================
export function authorizeSubmissionAttempt(params: {
  workOrder: SubmissionWorkOrder;
  packageLocked: boolean;
  contentHash: string;
  authorizedBy: string;
  validUntil: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: ErrCode; reason: string } {
  if (!params.packageLocked) return err("PACKAGE_STALE", "U18 成果包尚未 lock，不可送件。");
  if (!params.contentHash) return err("EXECUTION_AUTH_REQUIRED", "內容 hash 缺失，無法綁定送件 bytes。");
  const attempt: ExternalAttempt = {
    attemptId: `att_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    caseId: params.workOrder.caseId ?? `stc_${params.workOrder.projectId}`,
    workOrderId: params.workOrder.workOrderId,
    round: params.workOrder.round,
    target: params.workOrder.target,
    actorAccount: params.authorizedBy,
    operation: "SUBMIT",
    idempotencyKey: `idem_${sha256(params.contentHash).slice(0, 12)}`,
    contentHash: params.contentHash,
    authorizedBy: params.authorizedBy,
    authorizedUntil: params.validUntil,
    state: "DISPATCH_RESERVED",
    reservationStatus: "RESERVED",
    outcome: "NOT_DISPATCHED",
    note: "Attempt 已 reservation；實際派送為人工導引（GUIDED_MANUAL），不臆造 endpoint。",
  };
  return { ok: true, attempt };
}

export function markAttemptDispatched(params: { attempt: ExternalAttempt; dispatchedAt: string }): ExternalAttempt {
  return { ...params.attempt, state: "DISPATCHING", reservationStatus: "DISPATCHED", outcome: "DISPATCHED", note: "已派送；等待真實回執。" };
}

export function markAttemptOutcomeUnknown(params: { attempt: ExternalAttempt }): ExternalAttempt {
  return { ...params.attempt, state: "OUTCOME_UNKNOWN", reservationStatus: "OUTCOME_UNKNOWN", outcome: "OUTCOME_UNKNOWN", note: "timeout/worker crash/取消後可能已送出；保留 active reservation，先對帳，不自動重送/換 provider。" };
}

export function verifyAttemptReceipt(params: {
  attempt: ExternalAttempt;
  receiptReference: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: ErrCode; reason: string } {
  if (!params.receiptReference || !/^[A-Za-z0-9_-]{4,}$/.test(params.receiptReference)) {
    return err("RECEIPT_CASE_MISMATCH", "回執 reference 格式無效；不得以假 ID 補造官方收件。");
  }
  return { ok: true, attempt: { ...params.attempt, state: "CONFIRMED", reservationStatus: "VERIFIED", outcome: "RECEIPT_VERIFIED", receiptReference: params.receiptReference } };
}

export function reconcileAttempt(params: {
  attempt: ExternalAttempt;
  reconciled: "CONFIRMED_SUBMITTED" | "NOT_SUBMITTED";
  evidenceRef: string;
  note: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: ErrCode; reason: string } {
  if (params.attempt.state !== "OUTCOME_UNKNOWN" && params.attempt.state !== "RECONCILIATION_REQUIRED") {
    return err("LOCK_CONFLICT", "只有 OUTCOME_UNKNOWN / RECONCILIATION_REQUIRED 才可 reconcile。");
  }
  const confirmed = params.reconciled === "CONFIRMED_SUBMITTED";
  return {
    ok: true,
    attempt: {
      ...params.attempt,
      state: confirmed ? "CONFIRMED" : "CANCELLED_BEFORE_DISPATCH",
      outcome: confirmed ? "RECONCILED_CONFIRMED" : "RECONCILED_NOT_SUBMITTED",
      reconciliationEvidenceRef: params.evidenceRef,
      note: params.note,
    },
  };
}

export function reserveAttemptIfAbsent(params: { attempt: ExternalAttempt; existing: ExternalAttempt[] }): { ok: true; attempt: ExternalAttempt } | { ok: false; code: ErrCode; reason: string } {
  const dup = params.existing.find(
    (a) => a.caseId === params.attempt.caseId && a.round === params.attempt.round && a.operation === params.attempt.operation && a.contentHash === params.attempt.contentHash && (a.outcome === "NOT_DISPATCHED" || a.outcome === "OUTCOME_UNKNOWN" || a.outcome === "DISPATCHED")
  );
  if (dup) return err("DUPLICATE_ACTIVE_SUBMISSION", "已有 active/未定 attempt reservation，雙擊/多 worker 不會造成兩次 external commit。");
  return { ok: true, attempt: params.attempt };
}

export function cancelLocalAttempt(params: { attempt: ExternalAttempt; evidenceDispatched: boolean }): { ok: true; attempt: ExternalAttempt; note: string } | { ok: false; code: ErrCode; reason: string } {
  // 未 dispatch → 可安全取消；已 dispatch → 本地取消 ≠ 撤回外部
  if (params.evidenceDispatched || params.attempt.state === "DISPATCHING") {
    return err("OUTCOME_UNKNOWN", "外部動作可能已開始；本地取消≠撤回。已請停止本地工作，外部結果待核對。");
  }
  return {
    ok: true,
    attempt: { ...params.attempt, state: "CANCELLED_BEFORE_DISPATCH", outcome: "CANCELLED", note: "未 dispatch，可安全取消；新初稿需新授權。" },
    note: "未 dispatch，可安全取消。",
  };
}

// =========================================================================
// §7 Active guard（R1 相容：assertNoActiveSubmission）
// =========================================================================
export function assertNoActiveSubmission(params: { workOrder: SubmissionWorkOrder; activeEvent: SubmissionEvent | null }): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  if (params.activeEvent) return err("DUPLICATE_ACTIVE_SUBMISSION", "存在 active submission（含現行審查/待回執）；不得以新 Project/改題名/換語言繞過。");
  return { ok: true };
}

/** family+target 精確 guard；同稿不同合法稿件不動輒全擋。 */
export function assertNoDuplicateForFamily(params: {
  familyActive: { target?: string; outcome: AttemptOutcome }[] | null;
  currentTarget: string;
  sameFamilyDifferentTargetAllowed: boolean;
}): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  if (!params.familyActive || params.familyActive.length === 0) return { ok: true };
  if (params.sameFamilyDifferentTargetAllowed) return { ok: true };
  const stillActive = params.familyActive.some((a) => a.outcome === "OUTCOME_UNKNOWN" || a.outcome === "DISPATCHED" || a.outcome === "NOT_DISPATCHED");
  if (!stillActive) return { ok: true };
  return err("DUPLICATE_ACTIVE_SUBMISSION", `publication family 已有 active submission（target=${params.familyActive[0]!.target ?? "?"}）；未確定撤回/結果不明保留 guard；同稿修訂在同 Case 新 Round。`);
}

// =========================================================================
// §1/§10 R1 相容 events & receipts（ret 形狀不變）；R2 富版在 ingestReceipt….
// =========================================================================
export function addSubmissionEvent(params: {
  workOrderId: string;
  caseId?: string;
  round?: number;
  timestamp: string;
  effectiveAt?: string;
  providerSequence?: number | null;
  eventType: SubmissionEvent["eventType"];
  sourceTier: SubmissionEvent["sourceTier"];
  evidenceTier?: EvidenceTier;
  officialStatusText?: string;
  normalizedLabel?: NormalizedStatusLabel;
  statusMappingConfidence?: SubmissionEvent["statusMappingConfidence"];
  sourceRef: string;
  description: string;
  rawPayload?: string;
}): SubmissionEvent {
  const isOfficial = params.sourceTier === "OFFICIAL_RECEIPT" || params.sourceTier === "OFFICIAL_PORTAL_OBSERVATION" || params.evidenceTier === "OFFICIAL_PORTAL_OBSERVATION";
  return {
    eventId: `ev_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    caseId: params.caseId,
    workOrderId: params.workOrderId,
    round: params.round,
    timestamp: params.timestamp,
    effectiveAt: params.effectiveAt ?? params.timestamp,
    providerSequence: params.providerSequence ?? null,
    eventType: params.eventType,
    sourceTier: params.sourceTier,
    evidenceTier: params.evidenceTier ?? (isOfficial ? "OFFICIAL_PORTAL_OBSERVATION" : "USER_REPORTED"),
    officialStatusText: params.officialStatusText,
    normalizedLabel: params.normalizedLabel,
    statusMappingConfidence: params.statusMappingConfidence,
    statusMappingVersion: STATUS_MAPPING_VERSION,
    sourceRef: params.sourceRef,
    description: params.description,
    verified: isOfficial,
    rawPayloadHash: params.rawPayload ? sha256(params.rawPayload) : undefined,
  };
}

/** 依 caller 所選已查核來源給 7-tier 證據層級。 */
export function receiptEvidenceTier(params: { verifiedAgainst: ReceiptVerification["verifiedAgainst"]; verified: boolean }): EvidenceTier {
  if (params.verified) return "OFFICIAL_PORTAL_OBSERVATION";
  if (params.verifiedAgainst === "PROVIDER_EVENT") return "AUTHENTICATED_PROVIDER_EVENT";
  if (params.verifiedAgainst === "DOCUMENT_CHECKED") return "IMPORTED_DOCUMENT";
  if (params.verifiedAgainst === "USER_REPORTED") return "USER_REPORTED";
  return "UNVERIFIED";
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
    caseId: params.caseId,
    workOrderId: params.workOrderId,
    receivedAt: params.receivedAt,
    verifiedAgainst: params.verifiedAgainst,
    evidenceTier: receiptEvidenceTier({ verifiedAgainst: params.verifiedAgainst, verified }),
    sourceRef: params.sourceRef,
    verified,
    idStatus: verified ? "KNOWN" : "ID_PENDING",
    note: verified ? "回執經官方來源核對。" : "僅 USER_REPORTED／DOCUMENT_CHECKED／PROVIDER_EVENT：不等於官方收件。",
  };
}

/** R2 富版回執導入：錯 case/round 拒絕、ID_PENDING、delivered≠受理。 */
export function ingestReceiptForCase(params: {
  workOrderId: string;
  caseId: string;
  caseRound: number;
  expectedTarget: string; // 案件驗證後目標
  sourceTarget: string | null; // 來源目標；比對避免張冠李戴（未知時允許 pending）
  sourceRound: number | null;
  receivedAt: string;
  verifiedAgainst: ReceiptVerification["verifiedAgainst"];
  sourceRef: string;
  officialId?: string | null;
  allowPendingTarget?: boolean;
}): { ok: true; receipt: ReceiptVerification } | { ok: false; code: ErrCode; reason: string } {
  if (params.sourceRound !== null && params.sourceRound !== params.caseRound) {
    return err("RECEIPT_CASE_MISMATCH", `回執 round(${params.sourceRound}) 與案件 round(${params.caseRound}) 不符；R0 receipt 不能算 R1 已提交。`);
  }
  if (params.sourceTarget && params.expectedTarget && params.sourceTarget !== params.expectedTarget && !params.allowPendingTarget) {
    return err("RECEIPT_CASE_MISMATCH", "回執 target 與案件目標不符：不綁錯案件；改走候選核對。");
  }
  const verified = params.verifiedAgainst === "OFFICIAL_RECEIPT" || params.verifiedAgainst === "OFFICIAL_PORTAL_OBSERVATION";
  return {
    ok: true,
    receipt: {
      receiptId: `rcpt_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
      caseId: params.caseId,
      workOrderId: params.workOrderId,
      receivedAt: params.receivedAt,
      verifiedAgainst: params.verifiedAgainst,
      evidenceTier: receiptEvidenceTier({ verifiedAgainst: params.verifiedAgainst, verified }),
      sourceRef: params.sourceRef,
      verified,
      idStatus: params.officialId ? "KNOWN" : verified ? "KNOWN" : "ID_PENDING",
      note: verified ? `收件核對通過${params.officialId ? `（external id=${params.officialId}）` : "；官方 ID 待核對（ID_PENDING），不自行編號。"}` : "未達官方確認層級：email delivered/本地下載/portal draft ID 不算已受理。",
    },
  };
}

// =========================================================================
// §17 審查（R1 相容 + 拆分 + source complete）
// =========================================================================
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
    originalTextRef: `raw_review_${reviewId}`,
    items: [],
    sourceVerified: params.sourceVerified,
  };
}

/** 隔離：U09/U16 模擬意見不得建立正式 ExternalReview（來源不同通道）。 */
export function requireRealReviewSource(params: { simulated: boolean }): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  if (params.simulated) return err("REVIEW_SOURCE_INCOMPLETE", "模擬審查（U09/U16）只能作內部參考，不可匯成真實 ExternalReview。");
  return { ok: true };
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

/** 複合意見拆 subitems（保留 parent＋原文覆蓋）。 */
export function splitReviewComment(params: {
  review: ExternalReview;
  parentItemId: string;
  subFragments: Array<{ originalQuote: string; locationRef: string; category: ExternalReviewItem["category"] }>;
}): ExternalReview {
  const subs: ExternalReviewItem[] = params.subFragments.map((f) => ({
    itemId: `it_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`,
    reviewId: params.review.reviewId,
    parentItemId: params.parentItemId,
    originalQuote: f.originalQuote,
    locationRef: f.locationRef,
    round: params.review.round,
    category: f.category,
    decision: "REQUEST_CLARIFICATION",
    responseDraft: "",
    status: "PENDING",
  }));
  // 保留含 parent 以外項目 + 以 subitems 取代 parent 本身
  const withoutParent = params.review.items.filter((i) => i.itemId !== params.parentItemId);
  return { ...params.review, items: [...withoutParent, ...subs] };
}

export function assertReviewSourceComplete(params: { review: ExternalReview; missingRefs: string[] }): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  if (params.missingRefs.length > 0) return err("REVIEW_SOURCE_INCOMPLETE", `意見附檔/原稿/Editor 指示不齊：${params.missingRefs.join(", ")}。列缺失，不補造內容或頁碼。`);
  return { ok: true };
}

export type ConflictSide = { itemId: string; demands: string };
export type ConflictDisposition = {
  dispositionId: string;
  caseId: string;
  conflicts: Array<{ a: ConflictSide; b: ConflictSide }>;
  disposition: "SEEK_EDITOR_CLARIFICATION" | "PRIORITIZE_EDITOR_DIRECTIVE" | "RESOLVED_WITH_JUSTIFICATION";
  note: string;
};
export function createConflictDisposition(params: { caseId: string; conflicts: ConflictDisposition["conflicts"] }): ConflictDisposition {
  return {
    dispositionId: `scd_${Date.now().toString(36)}`,
    caseId: params.caseId,
    conflicts: params.conflicts,
    disposition: "SEEK_EDITOR_CLARIFICATION",
    note: "不同 Reviewer 相反要求：不兩邊都虛稱完成；先與 Editor 澄清或採 Editor directive，並保留可行性論證。",
  };
}

// =========================================================================
// §20 ReplyClaimChecker　＋ §18 Response WorkOrder
// =========================================================================
const COMPLETED_PATTERNS: Array<RegExp> = [/we added/i, /已新增|已完成|已改寫|已重新分析|已取得同意|已招募|已補做|已邀請|已採用/i, /added analysis/i, /done/i];

export function checkResponseClaims(params: { text: string; hasActionEvidence: boolean; allowCompletedWithoutEvidence: boolean }): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  const hasClaim = COMPLETED_PATTERNS.some((r) => r.test(params.text));
  if (hasClaim && !params.hasActionEvidence && !params.allowCompletedWithoutEvidence) {
    return err("RESPONSE_ACTION_UNPROVEN", "回覆有「已完成/已新增」完成式陳述但無 actionable 證據；不可用文字自證完成。可用 PLAN / 保留限制 + 替代，或以 ACTION_VERIFIED_RESPONSE 附證據。");
  }
  return { ok: true };
}

export function createReviewResponseWorkOrder(params: {
  caseId: string;
  round: number;
  commentsVersion: string;
  authorizations?: string[];
}): { ok: true; workOrder: ReviewResponseWorkOrder } | { ok: false; code: ErrCode; reason: string } {
  if (params.commentsVersion.trim() === "") return err("ROUND_REQUIREMENTS_UNVERIFIED", "缺 commentsVersion（完整意見版）。");
  return {
    ok: true,
    workOrder: {
      workOrderId: `srwo_${params.caseId}_r${params.round}`,
      caseId: params.caseId,
      round: params.round,
      commentsVersion: params.commentsVersion,
      scope: ["SPLIT", "CLASSIFY", "LOCATE", "GAP_ANALYSIS", "STRATEGY", "RESPONSE_DRAFT", "COVERAGE_CHECK"],
      authorizations: params.authorizations ?? [],
      costCap: null,
      iterationCap: 3,
      defaultKeepLocks: true,
      status: (params.authorizations?.length ?? 0) > 0 ? "AUTHORIZED" : "DRAFT",
    },
  };
}

// =========================================================================
// §9/§18 updateReviewItemResponse（R1 相容 ret）+ 附證據
// =========================================================================
export function updateReviewItemResponse(params: {
  review: ExternalReview;
  itemId: string;
  decision: ExternalReviewItem["decision"];
  responseDraft: string;
  actualChangeRef?: string;
  actionEvidenceRefs?: string[];
  canDisagree?: boolean;
}): { ok: true; review: ExternalReview } | { ok: false; code: ErrCode; reason: string } {
  const idx = params.review.items.findIndex((i) => i.itemId === params.itemId);
  if (idx < 0) return err("REVIEW_SOURCE_INCOMPLETE", "item 不存在。");
  const hasEvidence = Boolean(params.actualChangeRef) || (params.actionEvidenceRefs?.length ?? 0) > 0;
  const responseKind: "PLANNED_RESPONSE" | "ACTION_VERIFIED_RESPONSE" = hasEvidence ? "ACTION_VERIFIED_RESPONSE" : "PLANNED_RESPONSE";
  const items = params.review.items.map((i, n) =>
    n === idx
      ? {
          ...i,
          decision: params.decision,
          responseDraft: params.responseDraft,
          responseKind,
          actionEvidenceRefs: params.actionEvidenceRefs ?? [],
          actualChangeRef: params.actualChangeRef,
          status: (hasEvidence ? "RESPONDED" : "DRAFTED") as ExternalReviewItem["status"],
        }
      : i
  );
  return { ok: true, review: { ...params.review, items } };
}

// =========================================================================
// §16/§24 決策分流（Decision in Process 不→Accept；accept≠publish，award≠funds）
// =========================================================================
export function recordFormalDecision(params: {
  workOrder: SubmissionWorkOrder;
  decision: FormalDecision;
  evidenceRef: string;
  sourceVerified: boolean;
}): { ok: true; decision: FormalDecision; rationale: string } | { ok: false; code: ErrCode; reason: string } {
  if (params.decision === "NOT_DECISIONED") return err("REVIEW_SOURCE_INCOMPLETE", "決策不可為 NOT_DECISIONED。");
  if (!params.sourceVerified) return err("REVIEW_SOURCE_INCOMPLETE", "決策須來自真實官方來源（回執/portal observation）；Reviewer recommend accept ≠ editor accept。");
  return { ok: true, decision: params.decision, rationale: `決策 ${params.decision} 已由來源 ${params.evidenceRef} 核對。` };
}

export function proposeDecisionCategory(params: { wording: string }): { category: DecisionCategory; evidenceHint: string } {
  const t = params.wording.toLowerCase();
  const has = (ks: string[]) => ks.some((k) => t.includes(k));
  if (has(["accepted for publication", "accepted", "通知核定", "獲核定"])) return { category: "ACCEPTED", evidenceHint: "accepted" };
  if (has(["accept subject to", "accepted subject to", "條件式核定"])) return { category: "ACCEPTED_SUBJECT_TO_EXPLICIT_CONDITIONS", evidenceHint: "subject-to-conditions" };
  if (has(["major revision"])) return { category: "REVISION_INVITED", evidenceHint: "major" };
  if (has(["minor revision"])) return { category: "REVISION_INVITED", evidenceHint: "minor" };
  if (has(["reject and resubmit", "reject & resubmit"])) return { category: "REJECT_AND_RESUBMIT_AS_NEW", evidenceHint: "reject-rsn" };
  if (has(["not funded", "不予補助", "未獲補助"])) return { category: "NOT_FUNDED", evidenceHint: "not-funded" };
  if (has(["reject", "退稿", "否決"])) return { category: "REJECTED", evidenceHint: "rejected" };
  if (has(["award", "核定補助", "elected"])) return { category: "AWARD_NOTIFICATION", evidenceHint: "award" };
  if (has(["transfer offer", "invite to transfer"])) return { category: "TRANSFER_OFFER", evidenceHint: "transfer" };
  if (has(["withdraw", "撤回確認"])) return { category: "WITHDRAWAL_CONFIRMED", evidenceHint: "withdrawal" };
  if (has(["request clarification", "資料不齊", "補件"])) return { category: "CLARIFICATION_REQUEST", evidenceHint: "clarification" };
  if (has(["administrative return"])) return { category: "ADMINISTRATIVE_RETURN", evidenceHint: "admin-return" };
  return { category: "UNKNOWN", evidenceHint: "unknown" };
}

/** Decision in Process / review completed 不 mapping 成 Accept（只 DECISION_PENDING）。 */
export function isEditorAccept(params: { wording: string }): boolean {
  const p = proposeDecisionCategory({ wording: params.wording });
  return p.category === "ACCEPTED" || p.category === "ACCEPTED_SUBJECT_TO_EXPLICIT_CONDITIONS";
}

export function recordDecisionRecord(params: {
  caseId: string;
  round: number;
  issuingParty: string;
  wording: string;
  officialVerified: boolean;
}): DecisionRecord {
  const propose = proposeDecisionCategory({ wording: params.wording });
  const verifiedCategory = params.officialVerified && propose.category !== "UNKNOWN";
  const finalCategory: DecisionCategory = verifiedCategory ? propose.category : propose.category === "UNKNOWN" ? "UNKNOWN" : "CLARIFICATION_REQUEST";
  return {
    decisionId: `sdec_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    caseId: params.caseId,
    round: params.round,
    issuingParty: params.issuingParty,
    decisionWording: params.wording, // 原文保存不改寫
    category: finalCategory,
    categorySourceVerified: verifyDecisionCategoryFromSource({ wording: params.wording, officialVerified: params.officialVerified }),
    decisionDate: new Date().toISOString(),
    datePrecision: "DATETIME",
    dueEventRefs: [],
    sourceAssetRef: params.wording,
    sourceEvidenceTier: params.officialVerified ? "OFFICIAL_PORTAL_OBSERVATION" : "IMPORTED_DOCUMENT",
    note: "decisionWording 為原文；category 依來源核對，未核為 CLARIFICATION_REQUEST/UNKNOWN 並由人工裁決。",
  };
}

function verifyDecisionCategoryFromSource(params: { wording: string; officialVerified: boolean }): boolean {
  if (!params.officialVerified) return false;
  const p = proposeDecisionCategory({ wording: params.wording });
  return p.category !== "UNKNOWN";
}

// =========================================================================
// §15 Deadline / §23 Withdrawal/Transfer/Appeal / §24 Outcome
// =========================================================================
export type DeadlineRecord = { deadlineId: string; caseId: string; task: string; precision: "DATE_ONLY" | "DATETIME"; timezoneKnown: boolean; effectiveDate: string | null; officialDeadline: string | null };

export function createDeadlineRecord(params: { caseId: string; task: string; precision: "DATE_ONLY" | "DATETIME"; timezoneKnown: boolean }): { ok: true; deadline: DeadlineRecord } | { ok: false; code: ErrCode; reason: string } {
  if (params.precision === "DATE_ONLY" && !params.timezoneKnown) {
    return err("DEADLINE_UNRESOLVED", "僅知日期且時區未知：不虛補 23:59；保留 DATE_ONLY + timezone 待查。");
  }
  return { ok: true, deadline: { deadlineId: `sdl_${Date.now().toString(36)}`, caseId: params.caseId, task: params.task, precision: params.precision, timezoneKnown: params.timezoneKnown, effectiveDate: null, officialDeadline: null } };
}

export function approveExtension(params: { deadline: DeadlineRecord; approvedUntil: string }): DeadlineRecord {
  return { ...params.deadline, effectiveDate: params.approvedUntil, officialDeadline: params.approvedUntil };
}

export function requestExtensionKeepsOfficialDeadline(params: { deadline: DeadlineRecord }): { note: string } {
  return { note: "展延請求送出≠已延長；收到正式核可才更新 officialDeadline，原截止/提醒歷史保留。" };
}

export type WithdrawalStage = "WITHDRAWAL_DRAFT" | "REQUESTED" | "ACKNOWLEDGED" | "CONFIRMED";
export function setWithdrawalStage(params: { from: WithdrawalStage; to: WithdrawalStage; officialConfirmed: boolean }): { ok: true; stage: WithdrawalStage } | { ok: false; code: ErrCode; reason: string } {
  if (params.to === "CONFIRMED" && !params.officialConfirmed) {
    return err("OUTCOME_UNKNOWN", "撤回須官方機制確認；寄出撤回信/本地 cancel 不等於官方已撤回。確認前 active submission guard 保留。");
  }
  const order: WithdrawalStage[] = ["WITHDRAWAL_DRAFT", "REQUESTED", "ACKNOWLEDGED", "CONFIRMED"];
  if (order.indexOf(params.to) <= order.indexOf(params.from)) return err("EVENT_CONFLICT", "撤回狀態倒退需正式更正事件。");
  return { ok: true, stage: params.to };
}

export type TargetChangeProposal = { proposalId: string; fromCaseId: string; toTarget: string; scopeAutorizedRefs: string[]; transferOfferOnly: boolean };
export function proposeTransfer(params: { fromCaseId: string; toTarget: string; scopeAuthorizedRefs: string[]; offerNotAccepted: boolean }): { ok: true; proposal: TargetChangeProposal } | { ok: false; code: ErrCode; reason: string } {
  if (params.scopeAuthorizedRefs.length === 0) return err("SOURCE_SCOPE_DENIED", "轉投需適用移轉範圍授權；不直接搬內部審查或超授權附件。");
  return {
    ok: true,
    proposal: { proposalId: `strp_${Date.now().toString(36)}`, fromCaseId: params.fromCaseId, toTarget: params.toTarget, scopeAutorizedRefs: params.scopeAuthorizedRefs, transferOfferOnly: params.offerNotAccepted },
  };
}

export function assessAppealEligibility(params: { channelRuleRef: string | null }): { ok: true; appealable: boolean; note: string } | { ok: false; code: ErrCode; reason: string } {
  if (!params.channelRuleRef) return err("PROVIDER_UNSUPPORTED", "未核實申覆管道/規則（NSTC 申覆規定另查、MOE 不從他類推定、期刊按平台）：不得顯示可正式申覆。");
  return { ok: true, appealable: true, note: `依 ${params.channelRuleRef} 確有管道；當次資格/期限仍需逐案核對。` };
}

const OUTCOME_ORDER: Array<"ACCEPTED" | "PUBLISHED" | "INDEXED" | "AWARDED" | "CONTRACTED" | "FUNDS_RECEIVED" | "EXECUTION_AUTHORIZED"> = ["ACCEPTED", "PUBLISHED", "INDEXED", "AWARDED", "CONTRACTED", "FUNDS_RECEIVED", "EXECUTION_AUTHORIZED"];

/** Accept≠Published/Indexed；Award≠Contract/FundsReceived/ExecutionAuthorized；不因較大序或 APC 推定。 */
export function setOutcome(params: { current: (typeof OUTCOME_ORDER)[number] | null; target: (typeof OUTCOME_ORDER)[number]; evidenceTier: EvidenceTier }) {
  if (params.evidenceTier !== "OFFICIAL_PORTAL_OBSERVATION" && params.evidenceTier !== "AUTHENTICATED_PROVIDER_EVENT") {
    return err("REVIEW_SOURCE_INCOMPLETE", "Outcome 需官方來源；APC 帳單/正向 Reviewer/出現 DOI ≠ 正式接受或核定狀態。");
  }
  if (params.current !== null && OUTCOME_ORDER.indexOf(params.target) <= OUTCOME_ORDER.indexOf(params.current)) {
    return err("EVENT_CONFLICT", "Outcome 不自動由較大序號覆寫；Accepts 不代表 Published，Award ≠ Contract/Funds/Exec。");
  }
  return { ok: true, target: params.target };
}

// =========================================================================
// §1/§3/§4 R2：Case・Leg・Round・Provider registry・ActionIntent
// =========================================================================
export function createSubmissionCase(params: {
  scope: { workspaceId: string; projectId: string; documentId: string; manuscriptId: string | null };
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  targetCallYear?: string;
  institutionRef?: string | null;
  publicationFamilyId: string;
  intakeMode: IntakeMode;
}): SubmissionCase {
  return {
    caseId: `stc_${params.scope.projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 5)}`,
    workspaceId: params.scope.workspaceId,
    projectId: params.scope.projectId,
    documentId: params.scope.documentId,
    manuscriptId: params.scope.manuscriptId,
    documentPurpose: params.documentPurpose,
    route: params.route,
    target: params.target,
    targetCallYear: params.targetCallYear ?? "",
    institutionRef: params.institutionRef ?? null,
    publicationFamilyId: params.publicationFamilyId,
    intakeMode: params.intakeMode,
    externalCaseIdentifiers: [],
    createdAt: new Date().toISOString(),
  };
}

export function standardDestinationLegs(params: { caseId: string; route: SubmissionRoute }): DestinationLeg[] {
  if (params.route === "JOURNAL_SCI_SSCI") {
    return [{ legId: `stl_${params.caseId}_auth_journal`, caseId: params.caseId, kind: "AUTHOR_TO_JOURNAL", fromActor: "corresponding_author", toParty: "journal_portal", verifiedEntryUrl: undefined, status: "PENDING" }];
  }
  return [
    { legId: `stl_${params.caseId}_auth_inst`, caseId: params.caseId, kind: "AUTHOR_TO_INSTITUTION", fromActor: "PI", toParty: "institution_grants_office", verifiedEntryUrl: undefined, status: "PENDING" },
    { legId: `stl_${params.caseId}_inst_auth`, caseId: params.caseId, kind: "INSTITUTION_TO_AUTHORITY", fromActor: "institution_grants_office", toParty: params.route === "NSTC_GENERAL" ? "nstc" : "moe", verifiedEntryUrl: undefined, status: "PENDING" },
  ];
}

export function openRound(params: { caseId: string; leg?: DestinationLeg; number: number; externalRoundLabel?: string }): SubmissionRound {
  const leg = params.leg;
  const kind: SubmissionRoundKind = params.number <= 1 ? "INITIAL" : params.number === 2 ? "REVISION_R1" : `REVISION_R2` as SubmissionRoundKind;
  return {
    roundId: `str_${params.caseId}_r${params.number}`,
    caseId: params.caseId,
    legId: leg?.legId ?? `stl_${params.caseId}`,
    number: params.number,
    kind,
    externalRoundLabel: params.externalRoundLabel,
    parentRoundId: params.number > 1 ? `str_${params.caseId}_r${params.number - 1}` : null,
    status: "OPEN",
  };
}

/** 既有已投案件導入：保留真實舊狀態，不重設 NOT_SUBMITTED、不重送。 */
export function importExistingCase(params: {
  scope: { workspaceId: string; projectId: string; documentId: string; manuscriptId: string | null };
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  publicationFamilyId: string;
  externalEvidence: { externalCaseId: string; providerAccount: string; verification: ExternalReview["sourceVerified"] extends boolean ? "OFFICIAL_PORTAL_OBSERVATION" | "DOCUMENT_CHECKED" | "SOURCE_MATCHED" : never } | null;
}): SubmissionCase {
  const base = createSubmissionCase({
    scope: params.scope,
    documentPurpose: params.documentPurpose,
    route: params.route,
    target: params.target,
    publicationFamilyId: params.publicationFamilyId,
    intakeMode: "IMPORTED_EXISTING_CASE",
  });
  if (!params.externalEvidence) return base; // 原包不完整：明示歷史資料缺失（由 UI 呈現）
  return {
    ...base,
    externalCaseIdentifiers: [
      {
        externalCaseId: params.externalEvidence.externalCaseId,
        providerAccount: params.externalEvidence.providerAccount,
        verifiedTarget: params.target,
        verification: params.externalEvidence.verification,
      },
    ],
  };
}

// provider registry
export function registerProviderCapability(params: {
  provider: string;
  accountRef: string;
  capability: ProviderCapability;
  officialDocRef: string;
  testStatus?: ProviderCapabilityEntry["testStatus"];
}): ProviderCapabilityEntry {
  const hasOfficialDoc = /^https?:\/\/.+/.test(params.officialDocRef);
  return {
    provider: params.provider,
    accountRef: params.accountRef,
    capability: params.capability,
    officialDocRef: params.officialDocRef,
    verifiedAt: new Date().toISOString(),
    testStatus: params.testStatus ?? (hasOfficialDoc ? "NOT_TESTED" : "UNSUPPORTED"),
  };
}

export function resolveProviderMode(params: { registers: ProviderCapabilityEntry[] }): ProviderMode {
  const verified = params.registers.filter((r) => r.testStatus === "LIVE_VERIFIED" || r.testStatus === "MOCK_VERIFIED");
  if (verified.some((r) => r.capability === "COMMIT_SUBMISSION")) return "AUTHORIZED_WRITE";
  if (verified.length > 0) return "READ_ONLY_SYNC";
  return "GUIDED_MANUAL"; // 無能力者兜底人工導引
}

export function providerSupportsWrite(params: { mode: ProviderMode }): boolean {
  return params.mode === "AUTHORIZED_WRITE";
}

/** 權限護欄：有權維護 Project ≠ 可代表機構函送 / 自動獲通訊作者或機構送件權。 */
export function roleAllowsOperation(params: { role: ActorRole; operation: ExternalOperation; route: SubmissionRoute }): boolean {
  const { role, operation, route } = params;
  const formal = operation === "SUBMIT" || operation === "WITHDRAW" || operation === "TRANSFER";
  if (formal && route === "JOURNAL_SCI_SSCI") return role === "CORRESPONDING_AUTHOR";
  if (formal && route !== "JOURNAL_SCI_SSCI") return role === "PI" || role === "INSTITUTION_OFFICER";
  if (operation === "POST_REPLY" || operation === "UPLOAD_DRAFT") return ["CORRESPONDING_AUTHOR", "CO_AUTHOR", "PI", "INSTITUTION_OFFICER"].includes(role);
  if (operation === "PAY_FEE") return false; // 站內永不代付
  return ["CORRESPONDING_AUTHOR", "PI", "INSTITUTION_OFFICER"].includes(role);
}

// ActionIntent + ExecutionAuthorization
export function createActionIntent(params: {
  caseId: string;
  legId: string;
  roundId: string;
  actorId: string;
  actorRole: ActorRole;
  operation: ExternalOperation;
  target: string;
  providerAccountRef: string;
  packageDigest: string;
  filesManifestRef: string;
  audience: string;
  formContentHash?: string | null;
  responsePayloadHash?: string | null;
  declarationsRef?: string | null;
  policyVersion: string;
  validUntil: string;
}): { ok: true; intent: ActionIntent } | { ok: false; code: ErrCode; reason: string } {
  if (!/^[a-f0-9]{64}$/.test(params.packageDigest)) return err("PACKAGE_HASH_MISMATCH", "packageDigest 需 sha256 hex。");
  return {
    ok: true,
    intent: {
      intentId: `sti_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
      caseId: params.caseId,
      legId: params.legId,
      roundId: params.roundId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      operation: params.operation,
      target: params.target,
      providerAccountRef: params.providerAccountRef,
      packageDigest: params.packageDigest,
      filesManifestRef: params.filesManifestRef,
      audience: params.audience,
      formContentHash: params.formContentHash ?? null,
      responsePayloadHash: params.responsePayloadHash ?? null,
      declarationsRef: params.declarationsRef ?? null,
      feeScope: null,
      policyVersion: params.policyVersion,
      validUntil: params.validUntil,
      singleUse: true,
      status: "DRAFT",
      revokedAt: null,
    },
  };
}

export function confirmActionIntent(params: {
  intent: ActionIntent;
  route: SubmissionRoute;
  declarationsConfirmed: boolean;
  now?: string;
}): { ok: true; intent: ActionIntent; authEvent: ExecutionAuthorizationEvent } | { ok: false; code: ErrCode; reason: string } {
  const now = params.now ?? new Date().toISOString();
  if (params.intent.status !== "DRAFT") return err("LOCK_CONFLICT", "intent 已非 DRAFT；不可重複確認。");
  if (now > params.intent.validUntil) return err("DEADLINE_EXPIRED", "intent 已過 valid_until；未即時確認不自動延期。");
  if (params.intent.declarationsRef && !params.declarationsConfirmed) {
    return err("SOURCE_SCOPE_DENIED", "存在必勾聲明/rendered bundle（重建 PDF 導致 bytes 改變需重新適用）；AI 不代勾合法聲明。");
  }
  if (!roleAllowsOperation({ role: params.intent.actorRole, operation: params.intent.operation, route: params.route })) {
    return err("ACTOR_ROLE_NOT_ALLOWED", `角色 ${params.intent.actorRole} 對 ${params.intent.operation}（${params.route}）不具正式執行權。`);
  }
  if (params.intent.operation === "PAY_FEE") {
    return err("EXTERNAL_PROCESSING_BLOCKED", "付款僅記錄意圖；網站永不代付。");
  }
  const confirmed: ActionIntent = { ...params.intent, status: "CONFIRMED" };
  const scopeDigest = sha256(confirmed); // 綁定精確內容：任一欄位變更→digest 變→舊授權不適用
  const authEvent: ExecutionAuthorizationEvent = {
    authEventId: `stae_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    intentId: confirmed.intentId,
    authorizedBy: confirmed.actorId,
    authorizedAt: now,
    scopeDigest,
  };
  return { ok: true, intent: confirmed, authEvent };
}

/** 授權可作 audit，但快照/replay 不視為可重放憑證。 */
export function intentDigest(params: { intent: ActionIntent }): string {
  return sha256(params.intent);
}

// =========================================================================
// §11 Status projection
// =========================================================================
export function mapStatusText(params: { text: string }): { label: NormalizedStatusLabel; confidence: "HIGH" | "MEDIUM" | "LOW" } {
  const t = params.text.toLowerCase();
  // Decision in Process 絕不可 mapping 成 accept
  if (/decision in process|decision pending/.test(t)) return { label: "DECISION_PENDING", confidence: "Medium".toLowerCase() as "MEDIUM" };
  if (/under review|in review|required reviews completed/.test(t)) return { label: "IN_REVIEW", confidence: "HIGH" };
  if (/accepted|accepted for publication/.test(t)) return { label: "DECISION_RECORDED", confidence: "MEDIUM" };
  if (/revision|revise|resubmit/.test(t)) return { label: "REVISION_REQUESTED", confidence: "MEDIUM" };
  if (/submitted|received|acknowledge/.test(t)) return { label: "RECEIPT_CONFIRMED", confidence: "MEDIUM" };
  if (/rejected|declined/.test(t)) return { label: "UNKNOWN", confidence: "LOW" };
  if (/draft|complete submission/.test(t)) return { label: "DRAFT_AT_DESTINATION", confidence: "MEDIUM" };
  return { label: "UNKNOWN", confidence: "LOW" };
}

export function projectStatus(params: { caseId: string; events: SubmissionEvent[]; lastVerifiedAt?: string | null }): StatusProjection {
  const sorted = [...params.events]
    .filter((e) => ["STATUS_CHANGE", "DECISION", "RECEIPT", "CORRECTION"].includes(e.eventType))
    .sort((a, b) => {
      const ea = a.effectiveAt ?? a.timestamp;
      const eb = b.effectiveAt ?? b.timestamp;
      return ea === eb ? (a.providerSequence ?? 0) - (b.providerSequence ?? 0) : ea < eb ? -1 : 1;
    });
  let confirmed: NormalizedStatusLabel = "UNKNOWN";
  let confirmedEventId: string | null = null;
  let conflicting = false;
  const pending: StatusProjection["pendingCandidates"] = [];
  for (const ev of sorted) {
    const label = ev.normalizedLabel ?? "UNKNOWN";
    if (ev.verified && ev.evidenceTier !== "CONFLICTING") {
      confirmed = label;
      confirmedEventId = ev.eventId;
    } else if (ev.evidenceTier === "CONFLICTING") {
      conflicting = true;
      pending.push({ eventId: ev.eventId, label, reason: "來源衝突；保留已確認狀態與待查候選。" });
    } else {
      pending.push({ eventId: ev.eventId, label, reason: ev.verified ? "已確認" : "未達官方確認層級。" });
    }
  }
  return {
    caseId: params.caseId,
    lastConfirmedLabel: confirmed,
    lastConfirmedEventId: confirmedEventId,
    pendingCandidates: pending,
    conflicting,
    lastVerifiedAt: params.lastVerifiedAt ?? null,
    note: conflicting ? "來源矛盾：保留已確認與候選，不自行選擇最有利解讀。較晚取得之舊信不覆蓋較新決定。" : "時間軸顯示實際事件與最後查核時間；stale 不推測退件。",
  };
}

// =========================================================================
// §14 入站安全（isolated extractor；信件是資料不是指令）
// =========================================================================
export function verifyInboundWebhook(params: {
  rawBody: string;
  signature: string;
  secret: string;
  eventId: string;
  timestampMs: number;
  replayWindowMs?: number;
  signatureAlgorithm?: "hmac_sha256_b64" | "resend_ed25519_placeholder";
}): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  const expected = createHash("sha256").update(`${params.rawBody}${params.secret}`).digest("hex");
  if (params.signature !== expected) {
    return err("SOURCE_SCOPE_DENIED", "入站 raw body 驗簽失敗：拒收。簽章僅證明 provider delivery，不證明信件作者=編輯；From/domain allowlist 不足。");
  }
  // 重放防護：timestamp 在窗內
  if (Math.abs(Date.now() - params.timestampMs) > (params.replayWindowMs ?? 300_000)) {
    return err("SOURCE_SCOPE_DENIED", "timestamp 超出 replay window；同 eventId 需去重後再處理。");
  }
  return { ok: true };
}

/** 隔離擷取：只輸出候選資料事件；內文指令永不執行為 shell/send/write。 */
export function isolateExtractedContent(params: { rawText: string }): { candidateEvents: number; executed: 0; note: string } {
  return { candidateEvents: params.rawText.split(/\n/).filter((l) => l.trim().length > 0).length, executed: 0, note: "信件內容只是資料；擷取器無 send/shell/secret/任意 fetch/改 ACL 能力。" };
}

export function htmlPreviewSafe(params: { hasRemoteImage: boolean; hasScript: boolean }): boolean {
  return !params.hasRemoteImage && !params.hasScript;
}

export function assertThirdPartyDisclosureAllowed(params: { scopeAuthorized: boolean; destinationAudited: boolean }): { ok: true } | { ok: false; code: ErrCode; reason: string } {
  if (!params.scopeAuthorized || !params.destinationAudited) return err("SOURCE_SCOPE_DENIED", "敏感 review 原文/信件 headers/未公開稿件要求送出前需範圍授權與目的地稽核；未授權保留本地人工。");
  return { ok: true };
}

// =========================================================================
// §9/§19 R1 相容 resubmission + upstream ref（R1 ≠ R0）
// =========================================================================
export function authorizeResubmission(params: {
  workOrder: SubmissionWorkOrder;
  revisedPackageLocked: boolean;
  newContentHash: string;
  authorizedBy: string;
}): { ok: true; attempt: ExternalAttempt } | { ok: false; code: ErrCode; reason: string } {
  if (params.workOrder.round < 1) return err("DUPLICATE_ACTIVE_SUBMISSION", "尚未完成初輪，不可開 R1 再送。");
  if (!params.revisedPackageLocked) return err("PACKAGE_STALE", "修訂後包需本輪 QA、確認、lock 與新授權;原初稿 approval 或 R0 回執不能算 R1 再送成功。");
  if (!params.newContentHash) return err("EXECUTION_AUTH_REQUIRED", "新內容 hash 缺失。");
  const attempt: ExternalAttempt = {
    attemptId: `att_r${params.workOrder.round + 1}_${Date.now().toString(36)}`,
    caseId: params.workOrder.caseId ?? `stc_${params.workOrder.projectId}`,
    workOrderId: params.workOrder.workOrderId,
    round: params.workOrder.round + 1,
    target: params.workOrder.target,
    actorAccount: params.authorizedBy,
    operation: "SUBMIT",
    idempotencyKey: `idem_resub_${sha256(params.newContentHash).slice(0, 12)}`,
    contentHash: params.newContentHash,
    authorizedBy: params.authorizedBy,
    authorizedUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
    state: "DISPATCH_RESERVED",
    reservationStatus: "RESERVED",
    outcome: "NOT_DISPATCHED",
    note: "R1 再送需同 Case 新 Round + 新授權；原 approval 不沿用新 bytes。",
  };
  return { ok: true, attempt };
}

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

// =========================================================================
// §30 完整規格錯誤碼涵蓋偵測（供 test 斷言）
// =========================================================================
export function errorCodesCovered(specCodes: readonly string[]): { missing: string[]; covered: number } {
  const specSet = new Set<string>(specCodes);
  const missing = [...SUBMISSION_TRACKING_ERROR_CODES].filter((c) => !specSet.has(c));
  return { missing, covered: SUBMISSION_TRACKING_ERROR_CODES.length - missing.length };
}

// =========================================================================
// §32 SubmissionTrackingSnapshot + U20 receiver
// =========================================================================
export function buildSubmissionTrackingSnapshot(params: {
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  sourcePackageSnapshot: FinalSubmissionPackageSnapshot;
  workOrder: SubmissionWorkOrder;
  submissionCase?: SubmissionCase;
  destinationLegs?: DestinationLeg[];
  rounds?: SubmissionRound[];
  providerCapabilities?: ProviderCapabilities[];
  actionIntentRefs?: string[];
  executionAuthorizationEventRefs?: string[];
  decisionRecords?: DecisionRecord[];
  adoptedStatusProjection?: StatusProjection | null;
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

  const route: SubmissionRoute =
    sourcePackageSnapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : sourcePackageSnapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR";
  const submissionCase: SubmissionCase =
    params.submissionCase ??
    createSubmissionCase({
      scope: { workspaceId, projectId, documentId: sourcePackageSnapshot.documentPurpose, manuscriptId: null },
      documentPurpose: sourcePackageSnapshot.documentPurpose,
      route,
      target: workOrder.target,
      publicationFamilyId: `fam_${projectId}_${sourcePackageSnapshot.documentPurpose}`,
      intakeMode: "FROM_U18_PACKAGE",
    });
  const legs = params.destinationLegs ?? standardDestinationLegs({ caseId: submissionCase.caseId, route });
  const rounds: SubmissionRound[] =
    params.rounds ?? [
      openRound({
        caseId: submissionCase.caseId,
        leg: legs[0] ?? { legId: `stl_${submissionCase.caseId}`, caseId: submissionCase.caseId, kind: "AUTHOR_TO_JOURNAL", fromActor: "", toParty: "", status: "UNKNOWN" },
        number: workOrder.round,
        externalRoundLabel: workOrder.round > 1 ? `R${workOrder.round - 1} 修訂` : undefined,
      }),
    ];

  const activeGuard =
    decision === "NOT_DECISIONED" &&
    events.some((e) => e.verified && /UNDER_REVIEW|RECEIPT|REVIEW_RECEIVED|REVISION_REQUEST/.test(`${e.eventType} ${e.description}`));

  const acceptedOrGranted = decision === "ACCEPTED" || decision === "GRANTED";
  const decisionVerified = decision !== "NOT_DECISIONED";
  const snapshotId = `stsna_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

  const limitations: string[] = [
    "本快照為送件與審查追蹤基線；只有真實官方來源的回執/決定才標 verified。",
    "submission_execution_authorized 預設 false；正式 commit/Post/寄信/撤回/轉投/付款均需精確授權。GUIDED_MANUAL 不臆造 endpoint。",
    decisionVerified && !acceptedOrGranted
      ? "已記正式決定但非接受/核定：保留 refinement/closure，不走接受後作業。"
      : "等待審查或未決定為正常狀態；不為亮綠燈捏造接受。",
    "第二十階段尚未完整建置；提供可重開 receiver 頁，不跳空白頁。下一步外部動作一律需新授權。",
  ];

  return {
    snapshotId,
    schemaVersion: "submission-tracking/1.1.0",
    stageKey: "V3-U19",
    workspaceId,
    projectId,
    workOrderId,
    stageId: "submission-tracking",
    nextStageId: "post-acceptance",
    sourceFinalSubmissionPackageSnapshotId: sourcePackageSnapshot.snapshotId,
    sourceFinalSubmissionPackageSnapshotHash: sha256({ id: sourcePackageSnapshot.snapshotId, decision: sourcePackageSnapshot.decision }),
    goalContextRevision: 1,
    primaryGoal: sourcePackageSnapshot.primaryGoal,
    documentPurpose: sourcePackageSnapshot.documentPurpose,

    decision,
    decisionRationale: rationale,
    submissionExecutionAuthorized,
    activeSubmissionGuard: activeGuard,
    // §32 映射給下游 U20：接受/核定（源核）才允許 post-decision；nextExternal 恆 false 不可重放
    postDecisionProcessingAllowed: acceptedOrGranted && decisionVerified,
    postDecisionAllowedScopeRefs:
      decision === "ACCEPTED" || decision === "GRANTED"
        ? ["PROOF_HANDLING", "CONTRACT_OR_GRANT_TERMS", "RESEARCH_EXECUTION_PREP", "OUTCOME_REPORT", "FINANCE_RECONCILE"]
        : [],
    allowedNextActions:
      decision === "ACCEPTED" || decision === "GRANTED"
        ? ["POST_ACCEPTANCE_PROCESSING", "RESULT_OVERVIEW", "CLOSE_OR_ARCHIVE"]
        : ["PREPARE_ONLY"],
    nextExternalActionAuthorized: false,

    workOrder,
    submissionCase,
    destinationLegs: legs,
    rounds,
    providerCapabilities: params.providerCapabilities ?? [],
    actionIntentRefs: params.actionIntentRefs ?? [],
    executionAuthorizationEventRefs: params.executionAuthorizationEventRefs ?? [],
    decisionRecords: params.decisionRecords ?? [],
    adoptedStatusProjection: params.adoptedStatusProjection ?? projectStatus({ caseId: submissionCase.caseId, events }),
    statusMappingVersion: STATUS_MAPPING_VERSION,
    intakeMode: submissionCase.intakeMode,
    attempts,
    events,
    receipts,
    externalReviews: reviews,
    responseMatrixRef: `resp_matrix_${workOrderId}`,
    responseWorkOrderRefs: [],
    upstreamRevisionRefs: upstreamRefs,

    revisedPackageSnapshotId,
    resubmissionAttemptId,

    unresolvedIssueRefs: [],
    laterStageRequirements: ["接受/核定後作業與成果管理（U20）需另授權", "正式出版/款項/人體研究授權不因本階段接受而自動成立"],
    limitations,
    checksum: `chk_st_${Date.now().toString(36)}_${sha256(snapshotId).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

export function buildStage20ReceiverState(params: { snapshot: SubmissionTrackingSnapshot }): Stage20ReceiverState {
  const { snapshot } = params;
  const acceptedOrGranted = snapshot.decision === "ACCEPTED" || snapshot.decision === "GRANTED";
  const decisionVerified = snapshot.decision !== "NOT_DECISIONED";
  const notes: string[] = [];
  if (!acceptedOrGranted) notes.push("尚未有真實接受/核定；只能保存準備，不點亮 U20 執行。");
  if (snapshot.decision === "NOT_DECISIONED") notes.push("等待審查是正常狀態，不為亮綠燈捏造接受。");
  if (decisionVerified && !acceptedOrGranted) notes.push("非接受/核定分支：保留 closure/refinement，不走接受後作業。");
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
    postDecisionProcessingAllowed: acceptedOrGranted && decisionVerified,
    nextExternalActionAuthorized: false, // §32 固定
    receiverNotes: notes,
    reEntryPoint: { route: "submission-tracking", action: "initialize", snapshotId: snapshot.sourceFinalSubmissionPackageSnapshotId },
    createdAt: new Date().toISOString(),
  };
}
