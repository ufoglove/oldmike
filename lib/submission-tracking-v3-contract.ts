/**
 * Submission Tracking & Review Cycles Contract (V3-U19-FULL, R2)
 * Spec: docs/stage19/spec-v3-4.0.md（完整 36 節版 v3.4）
 *
 * R2 規格補強（相對 R1 摘要版）：
 * §3/§5 Provider 能力登錄＋三模式（GUIDED_MANUAL／READ_ONLY_SYNC／AUTHORIZED_WRITE）
 * §4 SubmissionCase／DestinationLeg／SubmissionRound 分離（＋publication family 防雙投、
 *    外部 ID 唯一性 scope、IMPORTED_EXISTING_CASE）
 * §6 ActionIntent＋ExecutionAuthorization（單次、綁精確內容 digest）
 * §8 Attempt 狀態機（DRAFT_INTENT…CONFIRMED＋OUTCOME_UNKNOWN／RECONCILIATION_REQUIRED）
 * §10 證據層級 7 tier（USER_REPORTED…UNVERIFIED）＋回執 ID_PENDING
 * §11 append-only 事件（原文＋effectiveAt＋providerSequence）＋StatusProjection
 * §16 DecisionRecord 12 類別（原文保存；AI 僅 proposal）
 * §18 ReviewResponseWorkOrder＋PLANNED_RESPONSE／ACTION_VERIFIED_RESPONSE
 * §30 完整規格 20 錯誤碼（R1 舊碼走 LEGACY_ERROR_CODE_ALIASES 對照）
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type FinalSubmissionPackageSnapshot } from "./final-submission-v3-contract.ts";

export const SUBMISSION_TRACKING_CONTRACT_VERSION = "submission-tracking/1.1.0" as const;
export const STATUS_MAPPING_VERSION = "status-mapping/1.0.0" as const;

// -------------------------------------------------------------
// §1-2 Submission route & work order
// -------------------------------------------------------------
export type SubmissionRoute = "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";

export type SubmissionWorkOrder = {
  workOrderId: string;
  projectId: string;
  caseId?: string;
  packageSnapshotId: string;
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  round: number; // R0 initial / R1 resubmission / …
  status: "DRAFT" | "PRE_SUBMIT_REVERIFY" | "AUTHORIZED_ATTEMPT" | "RECEIPT_VERIFIED" | "UNDER_REVIEW" | "REVISION_REQUIRED" | "RE_SUBMITTED" | "DECISIONED" | "CLOSED";
};

// -------------------------------------------------------------
// §4 Case / DestinationLeg / Round（不同概念，不用單一 status 包辦）
// -------------------------------------------------------------
export type DestinationLegKind =
  | "AUTHOR_TO_INSTITUTION"
  | "INSTITUTION_TO_AUTHORITY"
  | "AUTHOR_TO_JOURNAL"
  | "AUTHOR_TO_AUTHORITY";

export type SubmissionRoundKind =
  | "INITIAL"
  | "ADMINISTRATIVE_CORRECTION"
  | "REVISION_R1"
  | "REVISION_R2"
  | "APPEAL"
  | "TRANSFER_HANDOVER";

export type IntakeMode = "FROM_U18_PACKAGE" | "IMPORTED_EXISTING_CASE";

export type ExternalIdVerification =
  | "USER_REPORTED"
  | "DOCUMENT_CHECKED"
  | "SOURCE_MATCHED"
  | "OFFICIAL_PORTAL_OBSERVATION"
  | "ID_PENDING";

export type SubmissionCase = {
  caseId: string;
  workspaceId: string;
  projectId: string;
  documentId: string;
  manuscriptId: string | null; // 期刊稿有；計畫書為 null
  documentPurpose: string;
  route: SubmissionRoute;
  target: string;
  targetCallYear: string; // 計畫年度；期刊可為 ""
  institutionRef: string | null;
  publicationFamilyId: string; // 同稿（含轉刊/換語言）共用 family → ActiveSubmissionGuard 依據
  intakeMode: IntakeMode;
  /** 唯一性檢查以 (workspace, providerAccount, verifiedTarget, externalCaseId)，非全站字串合併。 */
  externalCaseIdentifiers: Array<{
    externalCaseId: string;
    providerAccount: string;
    verifiedTarget: string;
    verification: ExternalIdVerification;
  }>;
  createdAt: string;
};

export type DestinationLeg = {
  legId: string;
  caseId: string;
  kind: DestinationLegKind;
  fromActor: string;
  toParty: string;
  verifiedEntryUrl?: string; // 已核實官方入口（GUIDED_MANUAL 顯示；信中任意 URL 不是可信入口）
  status: "PENDING" | "DELIVERY_CONFIRMED" | "RECEIPT_CONFIRMED" | "UNKNOWN";
};

export type SubmissionRound = {
  roundId: string;
  caseId: string;
  legId: string;
  number: number; // 站內序號
  kind: SubmissionRoundKind;
  externalRoundLabel?: string; // 外部編號原樣保存
  parentRoundId: string | null;
  status: "OPEN" | "AWAITING_RECEIPT" | "UNDER_REVIEW" | "DECISIONED" | "CLOSED";
};

// -------------------------------------------------------------
// §3/§5 Provider capabilities & three operating modes
// -------------------------------------------------------------
export type ProviderCapability =
  | "READ_STATUS"
  | "READ_MESSAGES"
  | "PREPARE_FIELDS"
  | "UPLOAD_DRAFT"
  | "POST_RESPONSE"
  | "COMMIT_SUBMISSION"
  | "WITHDRAW"
  | "TRANSFER";

export type ProviderMode = "GUIDED_MANUAL" | "READ_ONLY_SYNC" | "AUTHORIZED_WRITE";

export type CapabilityVerificationStatus =
  | "LIVE_VERIFIED"
  | "MOCK_VERIFIED"
  | "NOT_TESTED"
  | "UNSUPPORTED"
  | "MANUAL_REQUIRED";

export type ProviderCapabilityEntry = {
  provider: string;
  accountRef: string; // 帳號參考（不含 secret）
  capability: ProviderCapability;
  officialDocRef: string; // 官方文件來源（無文件＝未驗證能力）
  verifiedAt: string;
  testStatus: CapabilityVerificationStatus;
};

export type ProviderCapabilities = {
  provider: string;
  accountRef: string;
  mode: ProviderMode; // 無已驗證寫入能力時只能 GUIDED_MANUAL；read 權限不放寫
  capabilities: ProviderCapabilityEntry[];
  note: string;
};

// -------------------------------------------------------------
// §6 ActionIntent + ExecutionAuthorization（單次對外操作授權）
// -------------------------------------------------------------
export type ExternalOperation =
  | "SUBMIT"
  | "POST_REPLY"
  | "UPLOAD_DRAFT"
  | "WITHDRAW"
  | "TRANSFER"
  | "PAY_FEE"; // 站內只能記錄意圖；真實付款永不代作

export type ActorRole =
  | "CORRESPONDING_AUTHOR"
  | "CO_AUTHOR"
  | "PI"
  | "INSTITUTION_OFFICER"
  | "PROJECT_EDITOR";

export type ActionIntent = {
  intentId: string;
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
  formContentHash: string | null;
  responsePayloadHash: string | null;
  declarationsRef: string | null;
  feeScope: string | null;
  policyVersion: string;
  validUntil: string;
  singleUse: true;
  status: "DRAFT" | "CONFIRMED" | "EXPIRED" | "REVOKED";
  revokedAt: string | null;
};

export type ExecutionAuthorizationEvent = {
  authEventId: string;
  intentId: string;
  authorizedBy: string;
  authorizedAt: string;
  scopeDigest: string; // 綁 intent 精確內容；任一欄位變更 → 舊授權失效
};

// -------------------------------------------------------------
// §8 External attempt（spec §8 狀態機 + Outbox 防重送）
// -------------------------------------------------------------
export type AttemptState =
  | "DRAFT_INTENT"
  | "AWAITING_AUTHORIZATION"
  | "AUTHORIZED"
  | "DISPATCH_RESERVED"
  | "DISPATCHING"
  | "AWAITING_RECEIPT"
  | "CONFIRMED"
  | "CANCELLED_BEFORE_DISPATCH"
  | "KNOWN_FAILURE"
  | "OUTCOME_UNKNOWN"
  | "RECONCILIATION_REQUIRED";

export type AttemptOutcome =
  | "NOT_DISPATCHED"
  | "DISPATCHED"
  | "OUTCOME_UNKNOWN"
  | "RECEIPT_VERIFIED"
  | "FAILED"
  | "CANCELLED"
  | "RECONCILED_CONFIRMED"
  | "RECONCILED_NOT_SUBMITTED";

export type ExternalAttempt = {
  attemptId: string;
  caseId: string;
  workOrderId: string;
  legId?: string;
  roundId?: string;
  round: number;
  target: string;
  actorAccount: string;
  operation: ExternalOperation;
  intentId?: string; // §6：授權綁定的精確意圖
  idempotencyKey: string;
  contentHash: string; // binds to exact bytes sent
  authorizedBy: string;
  authorizedUntil: string;
  state: AttemptState;
  /** legacy（R1 相容）；新邏輯以 state 為準。 */
  reservationStatus: "RESERVED" | "DISPATCHED" | "OUTCOME_UNKNOWN" | "VERIFIED" | "FAILED";
  outcome: AttemptOutcome;
  receiptReference?: string;
  reconciliationEvidenceRef?: string; // §8：人工核對／官方紀錄來源
  note: string;
};

// -------------------------------------------------------------
// §10 證據層級（7 tier）與 §5/§11 事件、回執
// -------------------------------------------------------------
export type EvidenceTier =
  | "USER_REPORTED"
  | "IMPORTED_DOCUMENT"
  | "SOURCE_MATCHED"
  | "AUTHENTICATED_PROVIDER_EVENT"
  | "OFFICIAL_PORTAL_OBSERVATION"
  | "CONFLICTING"
  | "UNVERIFIED";

/** R1 相容 tier 標籤（新事件建議同時標 evidenceTier）。 */
export type EventSourceTier =
  | "USER_REPORTED"
  | "DOCUMENT_CHECKED"
  | "PROVIDER_EVENT"
  | "OFFICIAL_PORTAL_OBSERVATION"
  | "OFFICIAL_RECEIPT";

/** §11 Normalized 顯示標籤（只作顯示，不覆寫原文；不假裝線性百分比）。 */
export type NormalizedStatusLabel =
  | "DRAFT_AT_DESTINATION"
  | "RECEIPT_CONFIRMED"
  | "ADMIN_CHECK"
  | "EDITOR_HANDLING"
  | "IN_REVIEW"
  | "REVISION_REQUESTED"
  | "DECISION_PENDING"
  | "DECISION_RECORDED"
  | "UNKNOWN";

export type SubmissionEvent = {
  eventId: string;
  caseId?: string; // §4：事件綁 case
  workOrderId: string;
  round?: number;
  timestamp: string;
  effectiveAt?: string; // 外部生效時間（晚到舊信不覆蓋新決定）
  providerSequence?: number | null; // 有則按 provider 序投影
  eventType: "ATTEMPT" | "RECEIPT" | "STATUS_CHANGE" | "REVIEW_RECEIVED" | "DECISION" | "REVISION_REQUEST" | "DEADLINE" | "CORRECTION";
  sourceTier: EventSourceTier;
  evidenceTier?: EvidenceTier;
  officialStatusText?: string; // 原文保存（期刊可客製狀態文字）
  normalizedLabel?: NormalizedStatusLabel;
  statusMappingConfidence?: "HIGH" | "MEDIUM" | "LOW";
  statusMappingVersion?: string;
  sourceRef: string;
  description: string;
  verified: boolean; // only true when official receipt/portal observation
  rawPayloadHash?: string;
};

/** §11 狀態投影（衝突保留雙邊＋待查，不自選最有利解讀）。 */
export type StatusProjection = {
  caseId: string;
  lastConfirmedLabel: NormalizedStatusLabel;
  lastConfirmedEventId: string | null;
  pendingCandidates: Array<{ eventId: string; label: NormalizedStatusLabel; reason: string }>;
  conflicting: boolean;
  lastVerifiedAt: string | null;
  note: string;
};

export type ReceiptVerification = {
  receiptId: string;
  caseId: string;
  workOrderId: string;
  round?: number;
  receivedAt: string;
  verifiedAgainst: "USER_REPORTED" | "DOCUMENT_CHECKED" | "PROVIDER_EVENT" | "OFFICIAL_PORTAL_OBSERVATION" | "OFFICIAL_RECEIPT";
  evidenceTier?: EvidenceTier;
  sourceRef: string;
  verified: boolean;
  idStatus?: "KNOWN" | "ID_PENDING"; // §10：編號不明保留 pending，不自行編號填空
  note: string;
};

// -------------------------------------------------------------
// §17 External review & Response Matrix (isolated from simulated)
// -------------------------------------------------------------
export type ExternalReview = {
  reviewId: string;
  caseId?: string;
  workOrderId: string;
  round: number;
  reviewerLabel: string; // 匿名時只保留原匿名標籤，不猜身份
  kind?: "EDITOR_COMMENT" | "REVIEWER_COMMENT" | "INSTITUTION_QUERY" | "AUTHORITY_QUERY" | "ADMIN_CHECK";
  receivedAt: string;
  rawTextHash: string;
  originalTextRef: string;
  items: ExternalReviewItem[];
  sourceVerified: boolean;
};

export type ExternalReviewItem = {
  itemId: string;
  reviewId: string;
  parentItemId?: string | null; // §17：複合意見拆 subitems 保留 parent 與完整覆蓋
  originalQuote: string;
  locationRef: string;
  round: number;
  category: "LOGIC" | "METHOD" | "STATISTICS" | "REPORTING" | "CITATION" | "LANGUAGE" | "ETHICS" | "OTHER";
  decision: "ACCEPT_AND_REVISE" | "PARTIAL_ACCEPT" | "DISAGREE_WITH_EVIDENCE" | "REQUEST_CLARIFICATION" | "OUT_OF_SCOPE_WITH_REASON";
  responseDraft: string;
  responseKind?: "PLANNED_RESPONSE" | "ACTION_VERIFIED_RESPONSE"; // §18 R2
  actionEvidenceRefs?: string[]; // 只有 ACTION_VERIFIED 可支撐「已完成」式陳述
  actualChangeRef?: string; // must point to real evidence
  status: "PENDING" | "DRAFTED" | "REVISED" | "RESPONDED" | "VERIFIED";
  upstreamRequestRef?: string;
};

/** §18 ReviewResponseWorkOrder：先策略、再修訂、再陳述事實。 */
export type ReviewResponseWorkOrder = {
  workOrderId: string;
  caseId: string;
  round: number;
  commentsVersion: string;
  scope: Array<"SPLIT" | "CLASSIFY" | "LOCATE" | "GAP_ANALYSIS" | "STRATEGY" | "RESPONSE_DRAFT" | "COVERAGE_CHECK">;
  authorizations: string[];
  costCap: number | null;
  iterationCap: number;
  defaultKeepLocks: true; // 預設不改 lock；鎖定段落走 ChangeProposal
  status: "DRAFT" | "AUTHORIZED" | "IN_PROGRESS" | "COMPLETED" | "STOPPED_AT_CAP";
};

// -------------------------------------------------------------
// §19 Upstream reuse & revised package
// -------------------------------------------------------------
export type UpstreamRevisionRef = {
  refId: string;
  destinationStage: "analysis-execution" | "data-governance" | "manuscript" | "scientific-review" | "translation-polish" | "final-compliance";
  changeRequestRef: string;
  correlationId?: string; // §19：回送→修正→返回持久化，不重跑全部模組
  returnTarget: { route: "submission-tracking"; workOrderId: string; reviewId?: string; itemId?: string };
  status: "PENDING" | "RESOLVED" | "BLOCKED";
};

// -------------------------------------------------------------
// §16 DecisionRecord（正式決定類別；原文保存，AI 僅 proposal）
// -------------------------------------------------------------
export type DecisionCategory =
  | "ADMINISTRATIVE_RETURN"
  | "CLARIFICATION_REQUEST"
  | "REVISION_INVITED"
  | "REJECT_AND_RESUBMIT_AS_NEW" // 只有通知明示
  | "REJECTED"
  | "ACCEPTED"
  | "ACCEPTED_SUBJECT_TO_EXPLICIT_CONDITIONS"
  | "TRANSFER_OFFER"
  | "AWARD_NOTIFICATION"
  | "NOT_FUNDED"
  | "WITHDRAWAL_CONFIRMED"
  | "UNKNOWN";

export type DecisionRecord = {
  decisionId: string;
  caseId: string;
  round: number;
  issuingParty: string; // 發出機構/編輯部，依通知原文
  decisionWording: string; // 原文保存，不改寫
  category: DecisionCategory;
  categorySourceVerified: boolean; // 映射需來源核對；未核 → UNKNOWN 由人工裁決
  decisionDate: string | null;
  datePrecision?: "DATE" | "DATETIME" | "UNKNOWN";
  dueEventRefs: string[];
  sourceAssetRef: string;
  sourceEvidenceTier: EvidenceTier;
  note: string;
};

// -------------------------------------------------------------
// §24 Formal decision routing（R1 精簡語義，保留相容）
// -------------------------------------------------------------
export type FormalDecision =
  | "NOT_DECISIONED"
  | "ACCEPTED"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECTED"
  | "TRANSFERRED"
  | "WITHDRAWN"
  | "GRANTED"
  | "NOT_GRANTED"
  | "REVIEW_REQUIRED"; // NSTC/TPR institutional phase

// -------------------------------------------------------------
// §32 SubmissionTrackingSnapshot (immutable handoff to U20)
// -------------------------------------------------------------
export type SubmissionTrackingSnapshot = {
  snapshotId: string;
  schemaVersion: "submission-tracking/1.1.0";
  stageKey: "V3-U19";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "submission-tracking";
  nextStageId: "post-acceptance"; // Stage 20: 接受/核定後作業與成果管理
  sourceFinalSubmissionPackageSnapshotId: string;
  sourceFinalSubmissionPackageSnapshotHash: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  documentPurpose: string;

  decision: FormalDecision;
  decisionRationale: string;
  submissionExecutionAuthorized: boolean; // carries U18=false; true only by explicit U19 authorization
  activeSubmissionGuard: boolean;

  workOrder: SubmissionWorkOrder;
  submissionCase: SubmissionCase;
  destinationLegs: DestinationLeg[];
  rounds: SubmissionRound[];
  providerCapabilities: ProviderCapabilities[];
  actionIntentRefs: string[];
  executionAuthorizationEventRefs: string[];
  decisionRecords: DecisionRecord[];
  adoptedStatusProjection: StatusProjection | null;
  statusMappingVersion: string;
  intakeMode: IntakeMode;
  attempts: ExternalAttempt[];
  events: SubmissionEvent[];
  receipts: ReceiptVerification[];
  externalReviews: ExternalReview[];
  responseMatrixRef: string;
  responseWorkOrderRefs: string[];
  upstreamRevisionRefs: UpstreamRevisionRef[];

  // Resubmission loop (R1 ≠ R0)
  revisedPackageSnapshotId?: string;
  resubmissionAttemptId?: string;

  unresolvedIssueRefs: string[];
  laterStageRequirements: string[];
  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §32 Stage 20 receiver state
// -------------------------------------------------------------
export type Stage20ReceiverState = {
  receiverVersion: "post-acceptance-receiver/1.0.0";
  stageKey: "V3-U20-RECEIVER";
  workspaceId: string;
  projectId: string;
  sourceSubmissionTrackingSnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  decision: string;
  round: number;
  activeSubmissionGuard: boolean;
  submissionExecutionAuthorized: boolean;
  eventCount: number;
  reviewCount: number;
  readyForPostAcceptance: boolean; // only true with real accepted/granted decision
  postDecisionProcessingAllowed: boolean; // §32：來源未核時 false，只能條件式準備
  nextExternalActionAuthorized: false; // §32：固定 false；U20 不得據此付費/簽約/上傳 Proof
  receiverNotes: string[];
  reEntryPoint: { route: "submission-tracking"; action: "initialize"; snapshotId: string };
  createdAt: string;
};

// -------------------------------------------------------------
// §30 Error codes（完整規格 20 碼）
// -------------------------------------------------------------
export const SUBMISSION_TRACKING_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "SOURCE_SCOPE_DENIED",
  "PACKAGE_STALE",
  "PACKAGE_HASH_MISMATCH",
  "APPROVAL_DIGEST_STALE",
  "DESTINATION_UNVERIFIED",
  "EXECUTION_AUTH_REQUIRED",
  "ACTOR_ROLE_NOT_ALLOWED",
  "DEADLINE_UNRESOLVED",
  "DEADLINE_EXPIRED",
  "DUPLICATE_ACTIVE_SUBMISSION",
  "OUTCOME_UNKNOWN",
  "RECEIPT_CASE_MISMATCH",
  "EVENT_CONFLICT",
  "REVIEW_SOURCE_INCOMPLETE",
  "RESPONSE_ACTION_UNPROVEN",
  "ROUND_REQUIREMENTS_UNVERIFIED",
  "EXTERNAL_PROCESSING_BLOCKED",
  "PROVIDER_UNSUPPORTED",
  "LOCK_CONFLICT",
] as const;

export type SubmissionTrackingErrorCode = (typeof SUBMISSION_TRACKING_ERROR_CODES)[number];

/** R1 舊碼 → R2 規格碼對照（相容不刪除；service 一律回傳 R2 碼）。 */
export const LEGACY_ERROR_CODE_ALIASES: Record<string, SubmissionTrackingErrorCode> = {
  PACKAGE_NOT_LOCKED: "PACKAGE_STALE",
  SUBMISSION_NOT_AUTHORIZED: "EXECUTION_AUTH_REQUIRED",
  ACTIVE_SUBMISSION_GUARD: "DUPLICATE_ACTIVE_SUBMISSION",
  ATTEMPT_ALREADY_DISPATCHED: "EXECUTION_AUTH_REQUIRED",
  ATTEMPT_OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN",
  RECEIPT_NOT_VERIFIED: "RECEIPT_CASE_MISMATCH",
  EVENT_SOURCE_UNTRUSTED: "REVIEW_SOURCE_INCOMPLETE",
  SOURCE_HASH_MISMATCH: "PACKAGE_HASH_MISMATCH",
  RESPONSE_EVIDENCE_MISSING: "RESPONSE_ACTION_UNPROVEN",
  REVIEW_NOT_VERIFIED: "REVIEW_SOURCE_INCOMPLETE",
  REVISION_PACKAGE_NOT_LOCKED: "PACKAGE_STALE",
  ROUND_RESUBMISSION_GUARD: "DUPLICATE_ACTIVE_SUBMISSION",
  WITHDRAWAL_NOT_CONFIRMED: "OUTCOME_UNKNOWN",
  BUDGET_LIMIT_REACHED: "EXTERNAL_PROCESSING_BLOCKED",
  INBOUND_SIGNATURE_INVALID: "SOURCE_SCOPE_DENIED",
};

// re-export for consumers that type against the upstream package
export type { FinalSubmissionPackageSnapshot };
