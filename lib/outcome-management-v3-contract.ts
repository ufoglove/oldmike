/**
 * Outcome / Post-Acceptance & Award Management Contract (V3-U20-FULL)
 * Spec: docs/stage20/spec-v3-4.0.md
 *
 * 承接：U19 SubmissionTrackingSnapshot (v1.1) — 上游 Gate
 *   DECISION_VERIFIED_AND_OUTCOME_HANDOFF_READY。
 * 下游：OutcomeManagementSnapshot（無必做第 21 階段；可結案／歸檔／由使用者啟動新研究）。
 *
 * 涵蓋：
 * §2 三路線（JOURNAL_SCI_SSCI／NSTC_GENERAL／MOE_TPR）真正分開
 * §3 校樣(proof)與科學事實（proof bytes＋queries＋更正）
 * §4 核定後執行與成果報告（ExecutionReentryRequest、財務 Decimal、報告）
 * §5 權利、成果與歸檔（AM/proof/VOR、embargo、Zotero、ORCID、archive）
 * §6 Assist／Lock／ActionIntent 重核（送件授權不可重放為校樣/付款/簽約/公開）
 * §8 OutcomeManagementSnapshot + 72 項驗收
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";

export const OUTCOME_MANAGEMENT_CONTRACT_VERSION = "outcome-management/1.1.0" as const;
export const OUTCOME_MANAGEMENT_ERROR_CODES = [
  "HANDOFF_NOT_READY", // 上游非 ACCEPTED/GRANTED 且非允許準備之核實分支
  "DECISION_UNVERIFIED",
  "SCOPE_NOT_ALLOWED", // post_decision_allowed_scope 未涵蓋
  "EXTERNAL_ACTION_UNAUTHORIZED", // 過去送件授權 ≠ 校樣/付款/簽約/公開授權
  "PROOF_VERSION_MISMATCH",
  "LOCATION_NOT_RENDERED",
  "QUERY_EVIDENCE_MISSING",
  "FINANCE_SOURCE_UNVERIFIED",
  "FINANCE_DOUBLE_COUNT",
  "CLAIM_WITHOUT_EXECUTION_EVIDENCE",
  "REPORT_PENDING_DATA",
  "RIGHTS_SCOPE_DENIED",
  "EMBARGO_PENDING_RECHECK",
  "ORCID_SYNC_NOT_VERIFIED",
  "ZOTERO_WRITE_UNAUTHORIZED",
  "ARCHIVE_INTEGRITY_FAULT",
  "LOCK_CONFLICT",
  "LATE_OUTPUT_REJECTED",
  "ROUTE_MISMATCH",
  "OUTCOME_SAVE_FAILED",
] as const;
export type OutcomeManagementErrorCode = (typeof OUTCOME_MANAGEMENT_ERROR_CODES)[number];

// -------------------------------------------------------------
// §2 三路線 profile
// -------------------------------------------------------------
export type OutcomeRoute = "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";

/** Accepted≠Published/Indexed；Awarded≠FundsReceived/IRB/ExecutionAuthorized。 */
export type PublicationStage = "ACCEPTED" | "IN_PROOF" | "PROOF_RETURNED" | "PUBLISHED_AT_SOURCE" | "INDEXED" | "POST_PUBLICATION_CORRECTION";
export type AwardStage = "AWARD_NOTIFICATION" | "BASELINE_ESTABLISHED" | "CONTRACT_IN_PROCESS" | "CONTRACT_SIGNED" | "FUNDS_RECEIVED" | "IN_EXECUTION" | "REPORT_SUBMITTED" | "PROJECT_CLOSED";
export type TprStage = "TPR_AWARDED" | "COURSE_APPROVED" | "TEACHING_UNDERWAY" | "OUTCOME_EXCHANGE" | "REPORT_SUBMITTED" | "FUND_CLAIMED" | "CURATED";

// -------------------------------------------------------------
// §3 校樣 Proof / Queries（保留 bytes，數字來源不可由 AI 重算）
// -------------------------------------------------------------
export type ProofVersion = {
  proofId: string;
  caseId: string;
  version: number;
  bytesDigest: string; // proof bytes sha256
  acceptedVersionRef: string; // 對應 accepted 版
  pageLineLocator: string; // 定位版本
  status: "RECEIVED" | "CHECKING" | "READY" | "CORRECTIONS_PENDING" | "RETURNED" | "VERIFIED_PUBLISHED_MATCH";
  createdAt: string;
};

export type ProofCheckItem = {
  checkId: string;
  proofId: string;
  field: "AUTHOR" | "AFFILIATION" | "FUNDING" | "EQUATION" | "SIGN" | "N_SIZE" | "GROUP" | "UNIT" | "TIMEPOINT" | "CITATION" | "TABLE_FIGURE" | "CAPTION" | "SUPPLEMENT" | "OTHER";
  reference: string; // 對應 accepted 版或 Result Fact ref
  derivedFromResultFact?: string; // 數字更正只能引用既有 Result Fact，不可 AI 重算
  carried_from_previous_locator?: string; // 新 proof 重排後重新定位，不沿用舊行號
  status: "PENDING" | "MATCHED" | "DIFF" | "CORRECTION_NEEDED";
  note: string;
};

export type PublisherQueryItem = {
  queryId: string;
  proofId: string;
  rawText: string;
  hasRealReply: boolean;
  modificationEvidenceRefs: string[]; // 需真實修改證據
  status: "PENDING_REPLY" | "REPLY_DRAFTED" | "REPLY_VERIFIED" | "CHANGE_SENT";
};

export type CorrectionPackage = { kind: "PORTAL_CONTENT" | "ANNOTATED_PDF" | "OTHER"; packageId: string; approvedReturned: boolean; sourceConfirmedAllApplied: boolean };

// -------------------------------------------------------------
// §4 核定後執行與成果報告（ExecutionReentry）+ 財務（Decimal）
// -------------------------------------------------------------
export type ExecutionReentryRequest = {
  reentryId: string;
  projectId: string;
  cycleRef: string;
  scope: { destinationStages: Array<"data-governance" | "analysis-execution" | "tooling" | "ethics">; requestedItems: string[] };
  authorizedScopeDigest: string; // 只準回既有 Project/cycle；核定不解除執行條件
  status: "DRAFT" | "AUTHORIZED" | "RETURNED_TO_U09_14";
};

export type FinanceStage = "APPLIED" | "PRE_AWARDED" | "AWARDED" | "FUNDS_RECEIVED" | "COMMITTED" | "SPENT" | "CLAIMED";
/** 財務只能 Decimal；承諾→invoice→付款不重複算支出。 */
export type FinanceLedgerLine = {
  lineId: string;
  projectId: string;
  stage: FinanceStage;
  amountCents: string; // 以整數分紀錄（Decimal）來源驗證
  sourceVerified: boolean;
  sourceRef: string;
  counterDoubleCountKey?: string; // 同一實際付款只記一次支出
  note: string;
};

export type OutcomeReportBlock = {
  blockId: string;
  kind: "EXECUTION_SUMMARY" | "RESULT_CLAIM" | "OUTPUT_LINK" | "LIMITATION" | "PENDING_DATA";
  title: string;
  completedClaim: boolean; // true 需 Execution/Fact/Output 證據
  evidenceRefs: string[];
  status: "SKELETON" | "PENDING_DATA" | "HAS_EVIDENCE" | "READY";
};

// -------------------------------------------------------------
// §5 權利、成果與歸檔
// -------------------------------------------------------------
export type RightsEntity = {
  rightsId: string;
  whichArtifact: "AM" | "PROOF" | "VOR" | "SUPPLEMENT";
  versionRef: string;
  purposeScope: string;
  grantedUsageScope: string;
  notPublicUnlessRelicensed: boolean; // 去識別 ≠ 可公開
  embargoRecheckTriggered: boolean; // embargo 到期觸發重核
};

export type ZoteroRefLine = { itemKey: string; libraryType: "user" | "group"; version: number; remoteWriteAllowed: boolean; syncedVerified: boolean };
export type OrcidLine = { ownerId: string; synced: boolean; apiVerified: boolean; note: string };

export type ArchiveEntity = {
  archiveId: string;
  sourceRefs: string[];
  manifestDigest: string;
  aclScope: string;
  retention: string;
  restoreVerified: boolean; // 隔離環境驗復原
};

// -------------------------------------------------------------
// §7/§8 首頁 CTA / 下游狀態（無必做第 21 階段）
// -------------------------------------------------------------
export type NextStageCapability = "OUTCOME_OVERVIEW" | "CONTINUE_RESEARCH" | "CLOSE_ARCHIVE" | "USER_STARTS_NEW" | "NONE_REQUIRED";

// -------------------------------------------------------------
// §8 OutcomeManagementSnapshot（下游 receiver；無臆造第 21 階段）
// -------------------------------------------------------------
export type OutcomeManagementSnapshot = {
  snapshotId: string;
  schemaVersion: "outcome-management/1.1.0";
  stageKey: "V3-U20";
  workspaceId: string;
  projectId: string;
  nextStageId: "closure-or-new-study"; // 非建置中的第 21 階段；提示可結案／歸檔／新研究
  sourceSubmissionTrackingSnapshotId: string;
  sourceSubmissionTrackingSnapshotHash: string;
  primaryGoal: PrimaryGoalId;
  documentPurpose: string;
  decision: string; // 原文（from DecisionRecord）
  route: OutcomeRoute;
  postDecisionProcessingAllowed: boolean; // 上游映射
  postDecisionAllowedScopeRefs: string[];
  allowedNextActions: string[];
  nextExternalActionAuthorizedAsGiven: false; // 沿用 U19=false；不可重放
  stage20createdAt: string;
};

/** 上游 Gate：僅 ACCEPTED/GRANTED 源核到位→正式接受/核定；其餘只準備。 */
export function resolveOutcomeReadiness(params: { decision: string; sourceVerified: boolean; postDecisionProcessingAllowed: boolean }): {
  readyForPostAcceptanceExecution: boolean;
  allowPreparationOnly: boolean;
} {
  const formallyReady = params.sourceVerified && params.postDecisionProcessingAllowed && isAcceptedOrGranted(params.decision);
  return { readyForPostAcceptanceExecution: formallyReady, allowPreparationOnly: !formallyReady };
}

export function isAcceptedOrGranted(decision: string): boolean {
  return decision === "ACCEPTED" || decision === "GRANTED";
}
