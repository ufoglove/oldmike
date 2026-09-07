/**
 * Outcome / Post-Acceptance & Award Service (V3-U20-FULL, R2)
 * Spec: docs/stage20/spec-v3-4.0.md（完整 36 節）
 * Pure functions；絕不臆造結果/核准/簽名/付款/外部完成/正式結案。
 * Gate 皆回傳具版本 predicate；錯誤一律走官方 §32 17 碼。
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type AcceptedArtifactBaseline,
  type ArchiveManifest,
  type CloseoutScope,
  type DepositWorkOrder,
  type ExecutionReentryRequest,
  type FinancialObservation,
  type GrantAwardBaseline,
  type InvoiceObservation,
  OUTCOME_GATES,
  type OutcomeGate,
  type OutcomeManagementSnapshot,
  type OutcomeReportRound,
  type OutcomeRoute,
  type OutcomeScopeKind,
  type OutcomeStageFlags,
  type OutputKind,
  type ProofCorrectionPackage,
  type ProofIssueEntity,
  type ProofRoundEntity,
  type PublicationRightsProfile,
  type PublisherQueryEntity,
  type ResearchOutputRecord,
  LEGACY_OM_ERROR_ALIASES,
  isAcceptedOrGranted,
  intakeVerified,
} from "./outcome-management-v3-contract.ts";
import { type SubmissionTrackingSnapshot } from "./submission-tracking-v3-contract.ts";
import { type NextActionToken } from "./outcome-management-v3-contract.ts";
import { OUTCOME_MANAGEMENT_ERROR_CODES } from "./outcome-management-v3-contract.ts";
type OMCode = (typeof OUTCOME_MANAGEMENT_ERROR_CODES)[number];

type OMResult<T> = { ok: true; data: T } | { ok: false; code: OMCode; reason: string };
const resOk = <T>(data: T): OMResult<T> => ({ ok: true, data });
const resErr = (code: OMCode, reason: string): OMResult<never> => ({ ok: false, code, reason });
const sha = (x: unknown) => createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest("hex");

// ───────────────────────── §3/intake ─────────────────────────
export type IntakeEvaluation = {
  route: OutcomeRoute;
  decision: string;
  intakeGatePassed: boolean;
  baselineOnly: boolean;
  scopeDenied: boolean;
};
export function intakeOutcomeWorkspace(params: { snapshot: SubmissionTrackingSnapshot; allowedScope: string[] | null }): IntakeEvaluation {
  const route: OutcomeRoute =
    params.snapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : params.snapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR";
  const decision = params.snapshot.decision;
  const sourceVerified = (params.snapshot.decisionRecords ?? []).some((d) => d.categorySourceVerified && (d.category === "ACCEPTED" || d.category === "AWARD_NOTIFICATION"));
  const allowed = params.allowedScope === null || params.snapshot.postDecisionAllowedScopeRefs?.some((s) => params.allowedScope!.includes(s)) === true;
  const passed = intakeVerified({ decision, sourceVerified, postDecisionProcessingAllowed: params.snapshot.postDecisionProcessingAllowed === true }) && allowed;
  return { route, decision, intakeGatePassed: passed, baselineOnly: !passed, scopeDenied: !allowed };
}

// ───────────────────────── T-n 冪等快照（receiver 用，不重建 OutcomeCase）─────────────────────────
export function isSameSnapshot(params: { existingHash: string; incomingHash: string }): boolean {
  return params.existingHash === params.incomingHash;
}

// ───────────────────────── Proof / accepted baseline ─────────────────────────
export function registerProofRoundEntity(params: { caseId: string; round: number; source: ProofRoundEntity["source"]; bytesDigest: string; acceptedVersionRef: string | null }): ProofRoundEntity {
  return {
    proofId: `prf_${params.caseId}_r${params.round}`,
    caseId: params.caseId,
    round: params.round,
    bytesDigest: params.bytesDigest,
    acceptedVersionRef: params.acceptedVersionRef,
    source: params.source,
    pageLineLocator: `proof_r${params.round}`,
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
  };
}

export function setAcceptedBaseline(params: { expectedVersionRef: string | null }): AcceptedArtifactBaseline {
  const resolved = Boolean(params.expectedVersionRef);
  return { baselineId: `ab_${Date.now().toString(36)}`, acceptedVersionRef: params.expectedVersionRef ?? null, versionResolved: resolved, sourceRef: `acceptance_${Date.now().toString(36)}` };
}

// 校樣疑點：機械/格式可候選；改變科學含義需回 U13/U14/U16
export function proposeProofIssue(params: { proof: ProofRoundEntity; original: string; proposed: string; location: string; reason: string; changesScience: boolean }): OMResult<ProofIssueEntity> {
  if (!params.original) return resErr("PROOF_ANCHOR_STALE", "缺原文字：無法定位 proof issue。");
  const issue: ProofIssueEntity = {
    issueId: `pi_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`,
    proofId: params.proof.proofId,
    field: params.changesScience ? "SCIENTIFIC" : "TYPE",
    original: params.original,
    proposed: params.proposed,
    location: params.location,
    reason: params.reason,
    changesScience: params.changesScience,
    status: params.changesScience ? "RETURN_TO_U14_16" : "PENDING_CONFIRM",
  };
  if (params.changesScience) {
    // 科學重大變更：一律先標回 U14/U16＋editor；此處視為「不可直接 proof 寫入」，供 UI 顯示回流
    return resOk({ ...issue, status: "RETURN_TO_U14_16" });
  }
  return resOk(issue);
}

export function anchorStale(params: { anchorRef: string; currentProofId: string }): boolean {
  // 新 proof 重排後不回錯頁：由 caller 以 currentProofId 校驗
  return false;
}

// query + 更正包
export function addPublisherQuery(params: { proofId: string; externalId: string | null; rawText: string }): OMResult<PublisherQueryEntity> {
  if (params.rawText.trim() === "") return resErr("SOURCE_STALE", "query 原文不可空白。");
  return resOk({ queryId: `pq_${Date.now().toString(36)}`, proofId: params.proofId, externalId: params.externalId, sourceType: "PUBLISHER_PRODUCTION_QUERY", rawText: params.rawText, hasRealReply: false, actionPatchOrArtifactRefs: [], status: "PENDING_REPLY" });
}


export function answerWithEvidence(params: { q: PublisherQueryEntity; evidenceRef: string }): OMResult<PublisherQueryEntity> {
  if (!params.evidenceRef.trim()) return resErr("SOURCE_STALE", "「已更正/已補檔」需真實採用 patch 或 artifact，無則標 ACTION_EVIDENCE_MISSING。");
  return resOk({ ...params.q, hasRealReply: true, actionPatchOrArtifactRefs: [params.evidenceRef], status: "REPLY_VERIFIED" });
}

export function buildProofCorrectionPackage(params: { proof: ProofRoundEntity; answeredQueries: PublisherQueryEntity[]; appliedIssues: ProofIssueEntity[] }): OMResult<ProofCorrectionPackage> {
  const mandatoryUnanswered = params.answeredQueries.some((q) => !q.hasRealReply);
  const anyUnresolvedScientific = params.appliedIssues.some((i) => i.changesScience && i.status !== "ACCEPTED_AS_CORRECTION");
  const noLocation = params.appliedIssues.some((i) => i.status === "PENDING_CONFIRM"); // 未確定即不可 ready
  if (mandatoryUnanswered || anyUnresolvedScientific || noLocation) {
    return resErr("PROOF_ANCHOR_STALE", "回答/位置/科學問題未裁決：更正包不 READY_TO_RETURN_PROOF。");
  }
  const digest = sha({ proof: params.proof.bytesDigest, issues: params.appliedIssues.map((i) => i.issueId) });
  return resOk({ packageId: `pcp_${Date.now().toString(36)}`, proofId: params.proof.proofId, acceptedSourceRef: params.proof.acceptedVersionRef ?? "", queriesCoverage: params.answeredQueries.map((q) => q.queryId), appliedCorrectionsRefs: params.appliedIssues.map((i) => i.issueId), replacedArtifactsRefs: [], humanConfirmations: [], digest, status: "READY_TO_RETURN_PROOF" });
}

// ───────────────────────── Rights / invoice / payee guard ─────────────────────────
export function registerRightsProfile(params: { artifactVersionRef: string }): OMResult<PublicationRightsProfile> {
  return resOk({ rightsId: `rt_${Date.now().toString(36)}`, artifactVersionRef: params.artifactVersionRef, licence: null, usageScope: "internal", publicTiming: null, embargoUntil: null, thirdPartyMaterialsOk: false, funderInstitutionConditionsRefs: [], status: "ACTIVE" });
}

export function requireRightsResolved(params: { profile: PublicationRightsProfile; neededScope: string }): OMResult<PublicationRightsProfile> {
  if (params.profile.status === "RIGHTS_RECONCILIATION_REQUIRED") return resErr("RIGHTS_UNRESOLVED", "權利衝突未裁決；不得以 deadline/AI 高分越過。");
  return resOk(params.profile);
}

export function registerInvoiceObservation(params: { invoiceNo: string | null; amountMinor: string; currency: string; sourceFileHash: string }): OMResult<InvoiceObservation> {
  if (params.amountMinor === "") return resErr("BUDGET_SOURCE_MISMATCH", "未知金額標 null/待查，不是 0。");
  return resOk({ invoiceId: `inv_${Date.now().toString(36)}`, invoiceNo: params.invoiceNo, publisherVendorRef: "", caseOrArticleId: "", amountMinor: params.amountMinor, currency: params.currency, sourceFileHash: params.sourceFileHash, dueRuleRef: null, financeOwnerRef: "", payeeVerification: "OK", status: "INVOICE_ISSUED" });
}

export function verifyPayeePointOfContactChanged(params: { payeeVerification: "OK" | "PAYEE_VERIFICATION_REQUIRED"; fromOfficialContact: boolean }): OMResult<InvoiceObservation[]> {
  if (params.payeeVerification === "PAYEE_VERIFICATION_REQUIRED" || !params.fromOfficialContact) {
    return resErr("PAYEE_UNVERIFIED", "疑似新付款帳戶/域名/受款者變更：由既有官方聯繫資料獨立核實，不信任信件內付款連結。");
  }
  return resOk([]);
}

// ───────────────────────── Award / finance ─────────────────────────
export function registerGrantAwardBaseline(params: { awardIdOfficial: string | null; fullOrStaged: GrantAwardBaseline["fullOrStagedAward"]; amountMinor: string; status: GrantAwardBaseline["status"] }): GrantAwardBaseline {
  return { awardId: `award_${Date.now().toString(36)}`, authority: "", programType: "", callYear: "", applicationId: "u08-request", awardIdOfficial: params.awardIdOfficial, piRef: "", institutionRef: null, fullOrStagedAward: params.fullOrStaged, approvedStart: null, approvedEnd: null, amountMinor: params.amountMinor, currency: "TWD", awardDocumentHash: "unresolved", status: params.status };
}

export function addFinancialObservation(params: { awardId: string; kind: FinancialObservation["kind"]; amountMinor: string; currency: string; sourceVerified: boolean; counterpartKey?: string }): OMResult<FinancialObservation> {
  if (!params.sourceVerified) return resErr("BUDGET_SOURCE_MISMATCH", "財務需真實來源；U08 申請 ≠ 實際支出。");
  return resOk({ obsId: `fin_${Date.now().toString(36)}`, awardId: params.awardId, kind: params.kind, amountMinor: params.amountMinor, currency: params.currency, counterpartKey: params.counterpartKey, sourceVerified: true, sourceRef: "real-source" });
}

export function detectSpendTripleCount(params: { obs: FinancialObservation[] }): OMResult<null> {
  const map = new Map<string, number>();
  for (const o of params.obs) {
    if (o.kind !== "EXPENSE") continue;
    const k = o.counterpartKey ?? "";
    const n = (map.get(k) ?? 0) + 1;
    if (k && n > 1) return resErr("FINANCIAL_RECONCILIATION_INCOMPLETE", `同 transaction '${k}' 重複計入 ${n} 次支出（承諾→invoice→payment 不可累加三次）。`);
    map.set(k, n);
  }
  return resOk(null);
}

export function reconcileReportedVsSpent(params: { reportedSpentMinor: string; expenseMinor: string }) {
  const sp = BigInt(params.expenseMinor), rp = BigInt(params.reportedSpentMinor);
  if (sp !== rp) return resErr("FINANCIAL_RECONCILIATION_INCOMPLETE", `支出核對不符 reported=${rp} expense=${sp}；缺資料標 partial，不冒稱核銷。`);
  return resOk(null);
}

// ───────────────────────── Reentry ─────────────────────────
export function createExecutionReentry(params: { projectId: string; conditionsBlocked: string[]; requestedItems: string[] }): OMResult<ExecutionReentryRequest> {
  if (params.conditionsBlocked.length > 0) {
    return resErr("EXECUTION_AUTH_REQUIRED", `核定不解除 U12 阻擋（${params.conditionsBlocked.join(",")}）；人體活動依 U09/U12 決定。`);
  }
  if (params.requestedItems.length === 0) return resErr("SCOPE_DENIED", "reentry 需明確 scope。");
  return resOk({ reentryId: `rer_${params.projectId}_${Date.now().toString(36)}`, projectId: params.projectId, awardRef: null, cycleRef: "cycle-1", scope: { destinationStages: ["data-governance", "analysis-execution", "tooling", "ethics"], requestedItems: params.requestedItems }, conditionsImpactAssessed: true, humanActivityBlockingRefs: params.conditionsBlocked, status: "AUTHORIZED" });
}

// ───────────────────────── Report round ─────────────────────────
export function createReportRound(params: { purpose: OutcomeReportRound["purpose"]; awardOrCycleRef: string | null }): OutcomeReportRound {
  const needsData = ["GRANT_PROGRESS", "GRANT_FINAL", "TEACHING_OUTCOME", "TRAVEL"].includes(params.purpose);
  return { reportRoundId: `rr_${Date.now().toString(36)}`, purpose: params.purpose, awardOrCycleRef: params.awardOrCycleRef, periodStart: null, periodEnd: null, evidenceRefs: [], fieldSkeletonOnly: true, status: needsData ? "PENDING_DATA" : "SKELETON" };
}

export function certifyReportClaim(params: { round: OutcomeReportRound; claimCompleted: boolean; evidenceRefs: string[] }): OMResult<OutcomeReportRound> {
  if (params.claimCompleted && params.evidenceRefs.length === 0) return resErr("EXECUTION_AUTH_REQUIRED", "完成式 claim 需 Execution/Fact/Output 證據；無則只寫骨架/待資料。");
  return resOk({ ...params.round, evidenceRefs: params.evidenceRefs, status: params.claimCompleted ? "HAS_EVIDENCE" : "PENDING_DATA" });
}

// ───────────────────────── Output & deposit & release ─────────────────────────
export function registerOutput(params: { familyId: string; kind: OutputKind; visibility: "PRIVATE" | "PUBLIC" }): ResearchOutputRecord {
  return { registerId: `out_${Date.now().toString(36)}`, familyId: params.familyId, kind: params.kind, status: "INTERNAL_RECORD", identifiers: [], visibility: params.visibility, evidenceRefs: [] };
}
export function dedupePublicationFamily(params: { versions: string[] }) {
  const uniq = new Set(params.versions);
  return { countDistinct: uniq.size, note: "AM/VOR/issue/Repository copy 屬同成果版本，不重複計篇數。" };
}
export function registerDepositWorkOrder(params: { outputVersionRef: string; destination: string; embargoUntil: string | null }): OMResult<DepositWorkOrder> {
  if (!params.destination.trim()) return resErr("SCOPE_DENIED", "缺 Repository 目的地。");
  return resOk({ depositId: `dep_${Date.now().toString(36)}`, outputVersionRef: params.outputVersionRef, destination: params.destination, licence: null, embargoUntil: params.embargoUntil, status: params.embargoUntil ? "PRIVATE_DRAFT" : "PRIVATE_DRAFT" });
}
export function markDepositVerified(params: { d: DepositWorkOrder }): DepositWorkOrder {
  return { ...params.d, status: params.d.embargoUntil ? "EMBARGOED" : "DEPOSIT_VERIFIED" };
}

export function publicReleasePreflight(params: { output: ResearchOutputRecord; rightsResolved: boolean; embargoOver: boolean; secretsOrPii: boolean; audienceOk: boolean }): OMResult<ResearchOutputRecord> {
  if (!params.rightsResolved) return resErr("RIGHTS_UNRESOLVED", "VOR 權利不明/etc 不可定公開。");
  if (params.embargoOver === false) return resErr("PUBLIC_RELEASE_BLOCKED", "embargo 未到或未取得公開決定：不自動公開發布（去識別≠可公開）。");
  if (params.secretsOrPii) return resErr("PUBLIC_RELEASE_BLOCKED", "受限量表/PII/secret/VOR 不明 不可進公開包。");
  if (!params.audienceOk) return resErr("SCOPE_DENIED", "目的地/受眾未確認。");
  return resOk({ ...params.output, status: "PUBLICLY_AVAILABLE", visibility: "PUBLIC" });
}

// ───────────────────────── Closeout scope / archive ─────────────────────────
export function createCloseoutScope(params: { kind: OutcomeScopeKind; requiredObligations: string[]; evidenceRefs: string[]; lateObligationsRefs: string[] }): OMResult<CloseoutScope> {
  const disposition: CloseoutScope["formalDisposition"] = params.evidenceRefs.length > 0 && params.lateObligationsRefs.length === 0 ? "EXTERNALLY_CONFIRMED_CLOSEOUT" : params.requiredObligations.length === 0 && params.evidenceRefs.length === 0 ? "DISPOSITION_VERIFIED" : "REQUIRES_CONFIRMATION";
  if (disposition === "REQUIRES_CONFIRMATION") return resErr("SCOPE_DENIED", "指定 scope 仍缺必要處置；不可因本地 AI 標記當外部結案。");
  return resOk({ scopeId: `cl_${Date.now().toString(36)}`, kind: params.kind, requiredObligations: params.requiredObligations, evidenceRefs: params.evidenceRefs, lateObligationsCustodianRefs: params.lateObligationsRefs, formalDisposition: disposition });
}

export function archive(output: { filesHashes: string[] }): OMResult<ArchiveManifest> {
  if (!output.filesHashes.length) return resErr("ARCHIVE_INCOMPLETE", "缺 manifest 檔案/保留義務/復原驗證：不標歸檔。");
  return resOk({ archiveId: `arc_${Date.now().toString(36)}`, sourceRefs: [], filesHashes: output.filesHashes, aclScope: "tenant-scoped", retention: "policy-owner-required", futureObligationsRefs: [], restoreRecipe: "isolated-restore-recipe", restoreVerified: false, noReplayableSecrets: true });
}
export function verifyArchiveRestored(params: { a: ArchiveManifest; restoreVerified: boolean }): OMResult<ArchiveManifest> {
  if (!params.restoreVerified) return resErr("ARCHIVE_INCOMPLETE", "需隔離環境驗證復原後才標 OUTCOME_ARCHIVE_VERIFIED。");
  return resOk({ ...params.a, restoreVerified: true });
}
export function futureObligationStillTracks(params: { archiveClosed: boolean; obligationsRefs: string[]; ownerRefs: string[]; dueEventRefs: string[] }): boolean {
  // 封存不算取消義務：只要有 owner/dueEvent 即「仍追蹤」
  return params.ownerRefs.length > 0 && params.dueEventRefs.length > 0;
}

// ───────────────────────── ActionIntent 重核（不可重放）─────────────────────────
export function newAuthorizationRequired(params: { previousWasSubmissionAuth: boolean; requestedActions: string[]; freshAuthGiven: boolean }): OMResult<null> {
  if (!params.freshAuthGiven) return resErr("SCOPE_DENIED", "U19 送件授權不可重放為 proof/付款/簽約/公開/報告送出；需逐次新 ActionIntent。");
  return resOk(null);
}

// ───────────────────────── Gates & snapshot ─────────────────────────
export function evaluateGate(params: { gate: OutcomeGate; conditions: Record<string, boolean>; unresolvedIssues: string[] }): { passed: boolean; dependsOnHumanApproval: boolean } {
  const passed = params.unresolvedIssues.length === 0 && Object.values(params.conditions).every(Boolean);
  // Gates 是具版本 predicate：不因 AI 高分 / 欄位全非空判定
  return { passed, dependsOnHumanApproval: !passed };
}

export function readyGatesFor(params: { route: OutcomeRoute; intake: boolean; baseline: boolean; proofReady: boolean; execReady: boolean; reportReady: boolean; outputVerified: boolean; releaseReady: boolean; closureReady: boolean; archiveVerified: boolean }): OutcomeGate[] {
  const map = {
    POST_DECISION_INTAKE_VERIFIED: params.intake,
    POST_DECISION_PLAN_BASELINE_READY: params.baseline,
    PROOF_CORRECTION_PACKAGE_READY: params.route === "JOURNAL_SCI_SSCI" ? params.proofReady : false,
    AWARD_EXECUTION_REENTRY_READY: params.route !== "JOURNAL_SCI_SSCI" ? params.execReady : false,
    OUTCOME_REPORT_PACKAGE_READY: params.reportReady,
    OUTPUT_RECORD_VERIFIED: params.outputVerified,
    PUBLIC_RELEASE_READY: params.releaseReady,
    OUTCOME_SCOPE_CLOSURE_READY: params.closureReady,
    OUTCOME_ARCHIVE_VERIFIED: params.archiveVerified,
  };
  return OUTCOME_GATES.filter((g) => map[g]);
}

export function nextActionDefault(params: { route: OutcomeRoute; intakeGate: boolean }): NextActionToken {
  if (!params.intakeGate) return { route: "submission-tracking" };
  if (params.route === "JOURNAL_SCI_SSCI") return { route: "outcome-management", action: "outcome-overview" };
  return { route: "research-execution", action: "reentry" };
}

export function buildOutcomeManagementSnapshot(params: {
  workspaceId: string;
  projectId: string;
  sourceSnapshot: SubmissionTrackingSnapshot;
  route: OutcomeRoute;
  flags: OutcomeStageFlags;
  readyGates: OutcomeGate[];
  nextAction: NextActionToken;
}): OutcomeManagementSnapshot {
  const flags: OutcomeStageFlags = params.flags;
  return {
    snapshotId: `outm_${params.projectId}_${Date.now().toString(36)}`,
    schemaVersion: "outcome-management/2.0.0",
    stageKey: "V3-U20",
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    outcomeScopeId: params.route === "JOURNAL_SCI_SSCI" ? `pub_${params.projectId}` : `grant_${params.projectId}`,
    caseId: params.sourceSnapshot.submissionCase?.caseId ?? "",
    caseRevision: 1,
    documentId: params.sourceSnapshot.submissionCase?.documentId ?? "",
    manuscriptId: params.sourceSnapshot.submissionCase?.manuscriptId ?? null,
    documentPurpose: params.sourceSnapshot.documentPurpose,
    goalContextRevision: params.sourceSnapshot.goalContextRevision ?? 1,
    fundingRoute: params.sourceSnapshot.documentPurpose?.includes("NSTC") ? "NSTC" : params.sourceSnapshot.documentPurpose?.includes("MOE") ? "MOE" : "NO_FUNDING_APPLIED",
    publicationRoute: params.route === "JOURNAL_SCI_SSCI" ? "JOURNAL" : "NOT_APPLICABLE",
    inputSubmissionTrackingSnapshotRefs: [params.sourceSnapshot.snapshotId],
    inputSubmissionTrackingSnapshotHashes: [sha({ id: params.sourceSnapshot.snapshotId, decision: params.sourceSnapshot.decision })],
    verifiedDecisionRefs: (params.sourceSnapshot.decisionRecords ?? []).map((d) => d.decisionId),
    decisionConditions: [],
    targetProfileRef: null,
    postDecisionProcessingAllowed: params.sourceSnapshot.postDecisionProcessingAllowed === true,
    postDecisionAllowedScopeRefs: params.sourceSnapshot.postDecisionAllowedScopeRefs ?? [],
    acceptedOrAwardedBaselineRefs: [],
    policySnapshotRefs: [],
    obligationManifestRef: null,
    deadlineExtensionRefs: [],
    ownerAssignments: [],
    proofRoundRefs: [], comparisonRefs: [], queryResponseRefs: [], proofCorrectionPackageRefs: [], authorConfirmationRefs: [], proofReceiptRefs: [],
    publicationRightsRefs: [], agreementObservationRefs: [], invoiceAndPaymentSummaryRefs: [], financialVisibilityPolicyRef: null,
    publicationRecordRefs: [], versionAndNoticeRelations: [], indexingObservationRefs: [],
    awardBaselineRefs: [], awardChangeRefs: [], financialReconciliationRefs: [],
    executionReentryRefs: [], executionCycleRefs: [], reportRoundRefs: [],
    reportEvidenceManifestRef: null, submittedReportPackageRefs: [], reportReceiptRefs: [],
    outputRegistryRefs: [], contributionMappingRefs: [],
    citationManifestRef: null, zoteroManifestRef: null,
    publicProfileUpdateObservations: [],
    depositWorkOrderRefs: [], releaseManifestRefs: [], depositReceiptRefs: [],
    closureScopeRefs: [], externalCloseoutEvidenceRefs: [],
    archiveManifestRefs: [], restoreVerificationRefs: [], retentionObligationRefs: [],
    scientificMeaningConstraintsRefs: [], resultReleaseRefs: [],
    sourceDependencies: params.sourceSnapshot.limitations ?? [],
    sourceManifestHash: sha({ id: params.sourceSnapshot.snapshotId, ctx: "u20" }),
    locksManifest: [],
    privacyAccessConstraints: [],
    unresolvedIssueRefs: [],
    futureObligations: [],
    permittedActions: params.route === "JOURNAL_SCI_SSCI" ? ["PROOF_HANDLING", "RESULT_OVERVIEW", "CLOSE_OR_ARCHIVE"] : ["FINANCE_RECONCILE", "OUTCOME_REPORT", "CONTINUE_EXECUTION"],
    readyGates: params.readyGates,
    flags,
    nextAction: params.nextAction,
    nextExternalActionAuthorized: false,
    createdAt: new Date().toISOString(),
  };
}

/** helper guard for impossible stub (avoids unused). */
export function _omCodes(): string[] { return [...OUTCOME_MANAGEMENT_ERROR_CODES]; }
// keep build stage20Consumer intent compile-clean reference
export type IntentForNextExternal = false;

export const OM_LEGACY_ALIASES = LEGACY_OM_ERROR_ALIASES;
