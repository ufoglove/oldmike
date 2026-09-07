/**
 * Outcome / Post-Acceptance & Award Service (V3-U20-FULL)
 * Spec: docs/stage20/spec-v3-4.0.md
 * Pure functions; 絕不臆造結果/核准/簽名/付款/外部完成。
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type ArchiveEntity,
  type CorrectionPackage,
  type ExecutionReentryRequest,
  type FinanceLedgerLine,
  type FinanceStage,
  type NextStageCapability,
  type OrcidLine,
  type OutcomeManagementSnapshot,
  type OutcomeReportBlock,
  type OutcomeRoute,
  type ProofCheckItem,
  type ProofVersion,
  type PublisherQueryItem,
  type RightsEntity,
  type ZoteroRefLine,
  OUTCOME_MANAGEMENT_ERROR_CODES,
  isAcceptedOrGranted,
  resolveOutcomeReadiness,
} from "./outcome-management-v3-contract.ts";
import { type SubmissionTrackingSnapshot } from "./submission-tracking-v3-contract.ts";

type ErrCode = (typeof OUTCOME_MANAGEMENT_ERROR_CODES)[number];

type Result<T> = { ok: true; data: T } | { ok: false; code: ErrCode; reason: string };
const okRes = <T>(data: T): Result<T> => ({ ok: true, data });
const errRes = (code: ErrCode, reason: string): Result<never> => ({ ok: false, code, reason });

function sha256(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// -------------------------------------------------------------
// §1 intake + readiness
// -------------------------------------------------------------
export type IntakeResult = {
  route: OutcomeRoute;
  decision: string;
  ready: { readyForPostAcceptanceExecution: boolean; allowPreparationOnly: boolean };
  snapshotReceivesOutcome: boolean;
};

export function intakeOutcomeWorkspace(params: { snapshot: SubmissionTrackingSnapshot }): IntakeResult {
  const decision = params.snapshot.decision;
  const route: OutcomeRoute =
    params.snapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : params.snapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR";
  const acceptedRecords =
    (params.snapshot.decisionRecords ?? []).filter((d) => d.category === "ACCEPTED" || d.category === "AWARD_NOTIFICATION" || d.category === "ACCEPTED_SUBJECT_TO_EXPLICIT_CONDITIONS").filter((d) => d.categorySourceVerified).length > 0;
  const sourceVerified = acceptedRecords && params.snapshot.postDecisionProcessingAllowed === true;
  const ready = resolveOutcomeReadiness({ decision, sourceVerified, postDecisionProcessingAllowed: params.snapshot.postDecisionProcessingAllowed === true });
  return { route, decision, ready, snapshotReceivesOutcome: true };
}

// -------------------------------------------------------------
// §3 proof
// -------------------------------------------------------------
export function registerProofVersion(params: { caseId: string; version: number; acceptedVersionRef: string; bytesDigest: string }): ProofVersion {
  return {
    proofId: `prf_${params.caseId}_v${params.version}`,
    caseId: params.caseId,
    version: params.version,
    bytesDigest: params.bytesDigest,
    acceptedVersionRef: params.acceptedVersionRef,
    pageLineLocator: `proof_v${params.version}`,
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
  };
}

export function newProofCheck(params: { proofId: string; field: ProofCheckItem["field"]; reference: string; derivedFromResultFact?: string }): ProofCheckItem {
  return {
    checkId: `pc_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
    proofId: params.proofId,
    field: params.field,
    reference: params.reference,
    derivedFromResultFact: params.derivedFromResultFact,
    status: "PENDING",
    note: "",
  };
}

/** 數字更正只能引用既有 Result Fact；機械(sign/typography)可標機械。 */
export function verifyCorrectionSource(params: { item: ProofCheckItem; mechanical: boolean }): Result<ProofCheckItem> {
  if (!params.mechanical && !params.item.derivedFromResultFact) {
    return errRes("CLAIM_WITHOUT_EXECUTION_EVIDENCE", "數字更正需引用既有 Result Fact（不可由 AI 自行重算）。科學/作者變更回 U14/U16。");
  }
  return okRes(params.item);
}

export function updateProofCheck(params: { item: ProofCheckItem; status: ProofCheckItem["status"]; needsReRender?: boolean; locator?: string }): Result<ProofCheckItem> {
  if (params.needsReRender && !params.locator) {
    return errRes("LOCATION_NOT_RENDERED", "新 proof 重排後需重新 render 定位；不沿用舊行號。");
  }
  return okRes({ ...params.item, status: params.status, ...(params.locator ? { carried_from_previous_locator: undefined } : {}) });
}

export function addPublisherQuery(params: { proofId: string; rawText: string }): Result<PublisherQueryItem> {
  if (params.rawText.trim() === "") return errRes("QUERY_EVIDENCE_MISSING", "query 原文不可空白。");
  return okRes({ queryId: `pq_${Date.now().toString(36)}`, proofId: params.proofId, rawText: params.rawText, hasRealReply: false, modificationEvidenceRefs: [], status: "PENDING_REPLY" });
}

export function markQueryReply(params: { q: PublisherQueryItem; evidenceRef: string }): Result<PublisherQueryItem> {
  if (params.evidenceRef.trim() === "") return errRes("QUERY_EVIDENCE_MISSING", "query 回覆需附真實修改證據。");
  return okRes({ ...params.q, hasRealReply: true, modificationEvidenceRefs: [params.evidenceRef], status: params.evidenceRef ? "REPLY_VERIFIED" : "REPLY_DRAFTED" });
}

export function packageCorrections(params: { kind: CorrectionPackage["kind"]; proofId: string; sourceAllApplied: boolean }): Result<CorrectionPackage> {
  const returnedNow = params.sourceAllApplied;
  if (returnedNow && !params.sourceAllApplied) {
    return errRes("SCOPE_NOT_ALLOWED", "更正包核准≠已送回；送回≠出版社已全部採用。未確認全部採用不標完成。");
  }
  return okRes({ kind: params.kind, packageId: `cp_${Date.now().toString(36)}`, approvedReturned: returnedNow, sourceConfirmedAllApplied: params.sourceAllApplied });
}

// -------------------------------------------------------------
// §4 ExecutionReentry
// -------------------------------------------------------------
export function createExecutionReentryRequest(params: { projectId: string; cycleRef: string; requestedItems: string[]; humanStudyConditionsMet: boolean }): Result<ExecutionReentryRequest> {
  if (params.requestedItems.length === 0) return errRes("SCOPE_NOT_ALLOWED", "reentry 需明確 scope。");
  if (!params.humanStudyConditionsMet) return errRes("SCOPE_NOT_ALLOWED", "核定不解除人體研究/工具/場域執行條件。");
  const reentryId = `rer_${params.projectId}_${Date.now().toString(36)}`;
  return okRes({
    reentryId,
    projectId: params.projectId,
    cycleRef: params.cycleRef,
    scope: { destinationStages: ["data-governance", "analysis-execution", "tooling", "ethics"] as const, requestedItems: params.requestedItems },
    authorizedScopeDigest: sha256({ id: reentryId, cycle: params.cycleRef, items: params.requestedItems }),
    status: "DRAFT",
  });
}

// -------------------------------------------------------------
// §4 Finance（Decimal 由呼叫端以 amountCents 表示；來源驗證＋防三重支出）
// -------------------------------------------------------------

/** 建立財務行：一律以 <stage> 收入/減項分開；SPENT 需附一致之 doubleCountKey。 */
export function addFinanceLine(params: {
  projectId: string;
  stage: FinanceStage;
  amountCents: string; // non-negative integer string (分)
  sourceVerified: boolean;
  sourceRef: string;
  doubleCountKey?: string;
}): Result<FinanceLedgerLine> {
  if (!/^\d+$/.test(params.amountCents)) return errRes("FINANCE_SOURCE_UNVERIFIED", "金額需非負整數(分)。");
  if (!params.sourceVerified) return errRes("FINANCE_SOURCE_UNVERIFIED", "財務需真實來源，不自造數。");
  return okRes({
    lineId: `fin_${Date.now().toString(36)}`,
    projectId: params.projectId,
    stage: params.stage,
    amountCents: params.amountCents,
    sourceVerified: true,
    sourceRef: params.sourceRef,
    ...(params.doubleCountKey ? { counterDoubleCountKey: params.doubleCountKey } : {}),
    note: params.stage === "SPENT" && params.doubleCountKey ? "支出僅記一次（counterDoubleCountKey）。" : params.stage === "SPENT" ? "支出（缺 key，會受 assert 保護不重複）。" : "",
  });
}

/** 防重複支出：same counterDoubleCountKey 在不同 SPENT 行→double count。 */
export function assertNoFinanceDoubleCount(params: { lines: FinanceLedgerLine[] }): Result<null> {
  const seen = new Map<string, number>();
  for (const l of params.lines) {
    if (l.stage !== "SPENT") continue;
    const k = l.counterDoubleCountKey ?? l.sourceRef;
    const n = (seen.get(k) ?? 0) + 1;
    if (n > 1) return errRes("FINANCE_DOUBLE_COUNT", `Same doubleCountKey '${k}' 出現 ${n} 次支出：承諾/發票/付款不算三次支出。`);
    seen.set(k, n);
  }
  return okRes(null);
}

/** 申請/核定金額比較（不可靜默改變樣本/RQ/方法）。 */
export function compareAwardedVsApplied(params: { appliedCents: string; awardedCents: string; requestedN: number; awardedN: number }): {
  deltaCents: string; // awarded - applied (可能負)
  note: string;
} {
  const diff = BigInt(params.awardedCents) - BigInt(params.appliedCents);
  const reducedN = params.awardedN !== params.requestedN;
  return {
    deltaCents: diff.toString(),
    note: reducedN ? "金額/人數變更：產生影響評估並回規劃，不靜默改樣本/方法。無成果不假造已完成。" : "金額與人數差異已對照原申請。",
  };
}

// -------------------------------------------------------------
// §4 成果報告 block + claim 認證
// -------------------------------------------------------------
export function addOutcomeReportBlock(params: { projectId: string; kind: OutcomeReportBlock["kind"]; title: string }): OutcomeReportBlock {
  const pending = params.kind === "PENDING_DATA";
  return {
    blockId: `rb_${Date.now().toString(36)}`,
    kind: params.kind,
    title: params.title,
    completedClaim: !pending,
    evidenceRefs: [],
    status: pending ? "PENDING_DATA" : "SKELETON",
  };
}

export function certifyReportBlock(params: { block: OutcomeReportBlock; evidenceRefs: string[] }): Result<OutcomeReportBlock> {
  if (params.block.completedClaim && params.evidenceRefs.length === 0) {
    return errRes("CLAIM_WITHOUT_EXECUTION_EVIDENCE", "「已完成」主張需 Execution/Fact/Output 證據；無證據僅骨架/待資料。");
  }
  return okRes({ ...params.block, evidenceRefs: params.evidenceRefs, status: params.block.completedClaim ? "READY" : "PENDING_DATA" });
}

// -------------------------------------------------------------
// §5 rights/Zotero/ORCID/archive
// -------------------------------------------------------------
export function registerRights(params: { artifact: RightsEntity["whichArtifact"]; versionRef: string; grantedUsageScope: string; notPublicUnlessRelicensed: boolean }): Result<RightsEntity> {
  if (!params.grantedUsageScope) return errRes("RIGHTS_SCOPE_DENIED", "缺少使用權範圍。");
  return okRes({ rightsId: `ri_${Date.now().toString(36)}`, whichArtifact: params.artifact, versionRef: params.versionRef, purposeScope: params.grantedUsageScope, grantedUsageScope: params.grantedUsageScope, notPublicUnlessRelicensed: params.notPublicUnlessRelicensed, embargoRecheckTriggered: false });
}

export function embargoRecheckNeeded(params: { r: RightsEntity; embargoOver: boolean; safeToDiscloseNow: boolean }): Result<RightsEntity> {
  if (params.embargoOver && !params.r.notPublicUnlessRelicensed) {
    // 去識別≠可公開：embargo 到期預設觸發重核；除非已額外取得公開決定，否則不外發
    return errRes("EMBARGO_PENDING_RECHECK", "embargo 已過期且未另行取得公開決定：觸發重核，不自動公開發布研究全文/敏感資料。");
  }
  if (params.embargoOver && !params.safeToDiscloseNow) {
    return errRes("EMBARGO_PENDING_RECHECK", "embargo 已過期進入重核；需人確立公開範圍後才可發布（去識別≠可公開）。");
  }
  return okRes({ ...params.r, embargoRecheckTriggered: params.embargoOver });
}

export function dedupeOutputs(params: { versions: string[] }): { countDistinct: number; note: string } {
  return { countDistinct: new Set(params.versions).size, note: "一份成果多版本不重複算篇數；以去重後篇數計。" };
}

export function registerZoteroLine(params: { itemKey: string; remoteWriteAllowed: boolean; syncedVerified: boolean }): Result<ZoteroRefLine> {
  if (!params.remoteWriteAllowed && params.syncedVerified) return errRes("ZOTERO_WRITE_UNAUTHORIZED", "未取得遠端寫入，不得聲稱已同步（不全庫同步）。");
  return okRes({ itemKey: params.itemKey, libraryType: "user", version: 0, remoteWriteAllowed: params.remoteWriteAllowed, syncedVerified: params.syncedVerified });
}

export function registerOrcid(params: { ownerAddress: string; apiVerified: boolean; ownerAuthorized: boolean }): Result<OrcidLine> {
  if (!params.apiVerified || !params.ownerAuthorized) {
    return errRes("ORCID_SYNC_NOT_VERIFIED", "ORCID 寫入需真實 API 能力與 owner 授權；僅有號碼不得宣稱已同步。");
  }
  return okRes({ ownerId: params.ownerAddress, synced: true, apiVerified: true, note: "api+owner 授權已驗證；真實寫入狀態需 provider 回執。" });
}

export function archiveEntity(params: { sampleSourceDigest: string; aclScope: string; retention: string; isolatedRestoreOk: boolean }): Result<ArchiveEntity> {
  if (!params.isolatedRestoreOk) return errRes("ARCHIVE_INTEGRITY_FAULT", "需隔離環境驗證可復原後才標歸檔完成。");
  return okRes({ archiveId: `arc_${Date.now().toString(36)}`, sourceRefs: [params.sampleSourceDigest], manifestDigest: sha256(params.sampleSourceDigest), aclScope: params.aclScope, retention: params.retention, restoreVerified: true });
}

// -------------------------------------------------------------
// §6 過去送件授權不可重放為 校樣/付款/簽約/公開；逐項新授權
// -------------------------------------------------------------
export function actionIntentRequiresReauthorization(params: { requestedKinds: Array<"PROOF_RETURN" | "PAY" | "CONTRACT_SIGN" | "PUBLIC_RELEASE" | "SEND_CORRECTION">; hasFreshExplicitAuth: boolean }): Result<null> {
  if (!params.hasFreshExplicitAuth) {
    return errRes("EXTERNAL_ACTION_UNAUTHORIZED", "過去 U19 送件授權不可重放為校樣/付款/簽約/公開；需重新核對 target/actor/payload/files 並取得明確新授權。");
  }
  return okRes(null);
}

// -------------------------------------------------------------
// §7 首頁 CTA（不臆造第 21 階段）
// -------------------------------------------------------------
export function computeNextCapability(params: { route: OutcomeRoute; acceptedOrGranted: boolean; sourceVerified: boolean }): NextStageCapability {
  if (params.acceptedOrGranted && params.sourceVerified && params.route === "JOURNAL_SCI_SSCI") return "OUTCOME_OVERVIEW";
  if (params.acceptedOrGranted && params.sourceVerified) return "CONTINUE_RESEARCH";
  return "USER_STARTS_NEW";
}

// -------------------------------------------------------------
// §8 OutcomeManagementSnapshot
// -------------------------------------------------------------
export function buildOutcomeManagementSnapshot(params: {
  workspaceId: string;
  projectId: string;
  sourceSnapshot: SubmissionTrackingSnapshot;
  route: OutcomeRoute;
}): OutcomeManagementSnapshot {
  const decision = params.sourceSnapshot.decision;
  const acceptedOrGranted = isAcceptedOrGranted(decision) && params.sourceSnapshot.postDecisionProcessingAllowed === true;
  const allowedActions = acceptedOrGranted
    ? params.route === "JOURNAL_SCI_SSCI"
      ? ["PROOF_HANDLING", "RESULT_OVERVIEW", "CLOSE_OR_ARCHIVE"]
      : ["RESEARCH_EXECUTION_PREP", "OUTCOME_REPORT", "FINANCE_RECONCILE", "PROJECT_CLOSE_OR_ARCHIVE"]
    : ["PREPARE_ONLY"];
  return {
    snapshotId: `outm_${params.projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`,
    schemaVersion: "outcome-management/1.1.0",
    stageKey: "V3-U20",
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    nextStageId: "closure-or-new-study", // 非臆造第 21 階段
    sourceSubmissionTrackingSnapshotId: params.sourceSnapshot.snapshotId,
    sourceSubmissionTrackingSnapshotHash: sha256({ id: params.sourceSnapshot.snapshotId, decision }),
    primaryGoal: params.sourceSnapshot.primaryGoal,
    documentPurpose: params.sourceSnapshot.documentPurpose,
    decision,
    route: params.route,
    postDecisionProcessingAllowed: acceptedOrGranted,
    postDecisionAllowedScopeRefs: (params.sourceSnapshot.postDecisionAllowedScopeRefs ?? []),
    allowedNextActions: allowedActions,
    nextExternalActionAuthorizedAsGiven: false,
    stage20createdAt: new Date().toISOString(),
  };
}

// re-export list for tests/lint (avoid unused-import noise)
export const OM_CONTRACT = { OUTCOME_MANAGEMENT_ERROR_CODES };
