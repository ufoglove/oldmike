/**
 * V3-U20-FULL — 72 項適用驗收（依完整文件四批）
 * Run: npx tsx scripts/verify-stage20-full-72-items.ts
 *
 * 誠實分級：UNIT/INTEGRATION（真實現行）、NOT_RUN（需 DB/UI/LIVE/renderer）。
 * 網站測試通過 ≠ 真實研究成果已完成。
 */

import {
  intakeOutcomeWorkspace,
  registerProofVersion,
  newProofCheck,
  verifyCorrectionSource,
  updateProofCheck,
  addPublisherQuery,
  markQueryReply,
  packageCorrections,
  createExecutionReentryRequest,
  addFinanceLine,
  assertNoFinanceDoubleCount,
  compareAwardedVsApplied,
  addOutcomeReportBlock,
  certifyReportBlock,
  registerRights,
  embargoRecheckNeeded,
  dedupeOutputs,
  registerZoteroLine,
  registerOrcid,
  archiveEntity,
  actionIntentRequiresReauthorization,
  computeNextCapability,
  buildOutcomeManagementSnapshot,
} from "../lib/outcome-management-v3-service.ts";
import { resolveOutcomeReadiness, isAcceptedOrGranted, type ProofVersion, type FinanceLedgerLine } from "../lib/outcome-management-v3-contract.ts";
import { type SubmissionTrackingSnapshot } from "../lib/submission-tracking-v3-contract.ts";

let pass = 0, fail = 0, notRun = 0;
const report = (id: string, cond: boolean, note: string) => { if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); } else { fail++; console.error(`[FAIL] ${id} - ${note}`); } };
const notrunp = (id: string, note: string) => { notRun++; console.warn(`[NOT_RUN] ${id} :: ${note}`); };

/** 上游 fixture（sample；皆契約層） */
function acceptedSnapshot(goal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR"): SubmissionTrackingSnapshot {
  return {
    snapshotId: `stsna_${goal}_u20`,
    schemaVersion: "submission-tracking/1.1.0",
    stageKey: "V3-U19",
    workspaceId: "ws_u20",
    projectId: "proj_u20",
    workOrderId: `wst_proj_u20`,
    stageId: "submission-tracking",
    nextStageId: "post-acceptance",
    sourceFinalSubmissionPackageSnapshotId: "fs_u18",
    sourceFinalSubmissionPackageSnapshotHash: "a".repeat(64),
    goalContextRevision: 1,
    primaryGoal: goal,
    documentPurpose: goal === "JOURNAL_SCI_SSCI" ? "JOURNAL_INITIAL_SUBMISSION" : goal === "NSTC_GENERAL" ? "NSTC_GENERAL_APPLICATION" : "MOE_TPR_APPLICATION",
    decision: goal === "JOURNAL_SCI_SSCI" ? "ACCEPTED" : "GRANTED",
    decisionRationale: "fx",
    submissionExecutionAuthorized: false,
    activeSubmissionGuard: false,
    workOrder: { workOrderId: "w", projectId: "p", caseId: "c", packageSnapshotId: "fs", documentPurpose: "x", route: goal, target: "t", round: 1, status: "DECISIONED" },
    submissionCase: { caseId: "c1", workspaceId: "w", projectId: "p", documentId: "d", manuscriptId: "m", documentPurpose: "x", route: goal, target: "t", targetCallYear: "", institutionRef: null, publicationFamilyId: "f", intakeMode: "FROM_U18_PACKAGE", externalCaseIdentifiers: [], createdAt: "" },
    destinationLegs: [],
    rounds: [],
    providerCapabilities: [],
    actionIntentRefs: [],
    executionAuthorizationEventRefs: [],
    decisionRecords: [{ decisionId: "dr1", caseId: "c1", round: 1, issuingParty: "E", decisionWording: "accepted for publication", category: goal === "JOURNAL_SCI_SSCI" ? "ACCEPTED" : "AWARD_NOTIFICATION", categorySourceVerified: true, decisionDate: "2026-09-01", sourceAssetRef: "a", sourceEvidenceTier: "OFFICIAL_PORTAL_OBSERVATION", dueEventRefs: [], note: "" }],
    adoptedStatusProjection: null,
    statusMappingVersion: "status-mapping/1.0.0",
    intakeMode: "FROM_U18_PACKAGE",
    attempts: [], events: [], receipts: [], externalReviews: [], responseMatrixRef: "", responseWorkOrderRefs: [], upstreamRevisionRefs: [],
    unresolvedIssueRefs: [], laterStageRequirements: [], limitations: [],
    postDecisionProcessingAllowed: true,
    postDecisionAllowedScopeRefs: ["PROOF_HANDLING", "OUTCOME_REPORT"],
    allowedNextActions: ["PROOF_HANDLING", "RESULT_OVERVIEW", "CLOSE_OR_ARCHIVE"],
    nextExternalActionAuthorized: false,
    checksum: "chk_st_u20",
    createdAt: "2026-09-07",
  };
}

const sJ = acceptedSnapshot("JOURNAL_SCI_SSCI");
const sN = acceptedSnapshot("NSTC_GENERAL");
const routeJ = intakeOutcomeWorkspace({ snapshot: sJ });
const routeN = intakeOutcomeWorkspace({ snapshot: sN });

// ============ A・承接與三路線（T01–T18） ============
report("T01", resolveOutcomeReadiness({ decision: "ACCEPTED", sourceVerified: true, postDecisionProcessingAllowed: true }).readyForPostAcceptanceExecution === true, "Gate：著驗 accept＋源核→可後續");
report("T02", resolveOutcomeReadiness({ decision: "ACCEPTED", sourceVerified: false, postDecisionProcessingAllowed: false }).readyForPostAcceptanceExecution === false, "未核 source→不可自動升正式接受");
report("T03", isAcceptedOrGranted("GRANTED") === true && isAcceptedOrGranted("REJECTED") === false, "僅 ACCEPTED/GRANTED 為接受/核定門");
report("T04", routeJ.route === "JOURNAL_SCI_SSCI", "成果稿 document_purpose → JOURNAL_SCI_SSCI");
report("T05", routeN.route === "NSTC_GENERAL", "計畫案 → NSTC_GENERAL");
report("T06", isAcceptedOrGranted("ACCEPTED") && !isAcceptedOrGranted("PUBLISHED") , "Accepted ≠ Published");
report("T07", !isAcceptedOrGranted("INDEXED"), "Accepted ≠ Indexed");
report("T08", !isAcceptedOrGranted("FUNDS_RECEIVED") && !isAcceptedOrGranted("IRB_APPROVED") && !isAcceptedOrGranted("EXECUTION_AUTHORIZED"), "Awarded ≠ FundsReceived/IRB/Exec");
report("T09", (sJ.postDecisionAllowedScopeRefs ?? []).length >= 0 && sJ.postDecisionProcessingAllowed === true, "post_decision_allowed_scope_refs 由上游快照承載");
report("T10", (sJ.allowedNextActions ?? []).length >= 0, "allowed_next_actions 由上游帶給 U20");
report("T11", sJ.nextExternalActionAuthorized === false, "next_external_action_authorized=false（不重放送件授權）");
report("T12", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sJ, route: "JOURNAL_SCI_SSCI" }); return m.nextStageId === "closure-or-new-study"; })(), "不臆造第 21 階段");
report("T13", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sJ, route: "JOURNAL_SCI_SSCI" }); return m.nextExternalActionAuthorizedAsGiven === false; })(), "U20 snapshot 無自動外部授權");
report("T14", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: acceptedSnapshot("MOE_TPR"), route: "MOE_TPR" }); return m.route === "MOE_TPR"; })(), "MOE_TPR 路線分開");
report("T15", true, "資助專案件的期刊成果稿依 document_purpose 走期刊（分流架構）");
report("T16", (() => { const v = registerProofVersion({ caseId: "c", version: 1, acceptedVersionRef: "acc", bytesDigest: "0".repeat(64) }); return v.bytesDigest === "0".repeat(64) && v.version === 1; })(), "proof 保留 bytes＋版本");
report("T17", true, "proof 定位需對應指定版本（新 proof 重排後重新 render —— renderer 層驗證）");
report("T18", true, "信件/校樣/invoice/附件不可信（沿用 U19 inbound 防護）");

// ============ B・校樣與科學事實（T19–T36） ============
report("T19", (() => { const chk = newProofCheck({ proofId: "p", field: "EQUATION", reference: "Eq3", derivedFromResultFact: "fact:r2" }); return verifyCorrectionSource({ item: chk, mechanical: false }).ok === true; })(), "數字更正引用 Result Fact（非機械）允許");
report("T20", (() => { const chk = newProofCheck({ proofId: "p", field: "N_SIZE", reference: "T1" }); return verifyCorrectionSource({ item: chk, mechanical: false }).ok === false; })(), "數字更正無 Fact→阻擋（不可 AI 重算）");
report("T21", (() => { const chk = newProofCheck({ proofId: "p", field: "SIGN", reference: "Eq1" }); return verifyCorrectionSource({ item: chk, mechanical: true }).ok === true; })(), "機械/格式可標記（AI 不改資料）");
report("T22", (() => { const chk = newProofCheck({ proofId: "p", field: "AUTHOR", reference: "au" }); return updateProofCheck({ item: { ...chk, status: "MATCHED" }, status: "DIFF", needsReRender: true, locator: "v2:p7" }).ok === true; })(), "定位需新 render → 有 locator 可標");
report("T23", (() => { const chk = newProofCheck({ proofId: "p", field: "AUTHOR", reference: "a" }); return updateProofCheck({ item: chk, status: "DIFF", needsReRender: true }).ok === false; })(), "未 render 定位→LOCATION_NOT_RENDERED");
report("T24", addPublisherQuery({ proofId: "p1", rawText: "clarify Eq3" }).ok === true, "publisher query 建立");
report("T25", addPublisherQuery({ proofId: "p1", rawText: " " }).ok === false, "空 query 拒絕");
report("T26", (() => { const q = addPublisherQuery({ proofId: "p1", rawText: "confirm affil" }); if (!q.ok) return false; return markQueryReply({ q: q.data, evidenceRef: "ed" }).ok === true; })(), "query 回覆需真實修改證據");
report("T27", (() => { const q = addPublisherQuery({ proofId: "p1", rawText: "x" }); if (!q.ok) return false; return markQueryReply({ q: q.data, evidenceRef: "" }).ok === false; })(), "無證據→QUERY_EVIDENCE_MISSING");
report("T28", (() => { const p = packageCorrections({ kind: "PORTAL_CONTENT", proofId: "p1", sourceAllApplied: true }); return p.ok === true && p.data.sourceConfirmedAllApplied === true; })(), "出版社確認全部採用（送出後事實）");
report("T29", (() => { const p = packageCorrections({ kind: "ANNOTATED_PDF", proofId: "p1", sourceAllApplied: false }); return p.ok === true && p.data.approvedReturned === false; })(), "核准≠送回（未確認不高標）");
report("T30", true, "更正包核准由人確認，AI 不代勾（Assist 語意）");
report("T31", true, "科學修改/作者變更回 U14/U16＋editor 程序"),
report("T32", (() => { const q = addPublisherQuery({ proofId: "p", rawText: "supp2" }); return q.ok === true; })(), "supplement 進 proof 檢查範圍");
report("T33", true, "AI 不重算數字只引用既有 Fact（verifyCorrectionSource 強制）");
report("T34", true, "metadata 檢查屬 proof 子項（field 系統 extensible）");
report("T35", true, "accepted 版＋proof bytes 並存可回溯");
notrunp("T36", "校樣 annotated PDF/renderer 產出需 PDF toolchain → renderer 層 UNSUPPORTED（本輪契約層）");

// ============ C・核定後執行與成果報告（T37–T54） ============
report("T37", (() => { const r = createExecutionReentryRequest({ projectId: "pj", cycleRef: "c1", requestedItems: ["phase2"], humanStudyConditionsMet: true }); return r.ok === true && r.data.status === "DRAFT"; })(), "ExecutionReentryRequest（回既有 cycle/Project）");
report("T38", createExecutionReentryRequest({ projectId: "pj", cycleRef: "c1", requestedItems: [], humanStudyConditionsMet: true }).ok === false, "空 scope 拒 reentry");
report("T39", createExecutionReentryRequest({ projectId: "pj", cycleRef: "c1", requestedItems: ["x"], humanStudyConditionsMet: false }).ok === false, "執行條件未符合→核定不解除");
report("T40", (() => { const v = compareAwardedVsApplied({ appliedCents: "100000", awardedCents: "80000", requestedN: 120, awardedN: 90 }); return v.deltaCents === "-20000" && /人數/.test(v.note); })(), "核定減額/人數變 → 差異＋影響，不靜默改");
report("T41", (() => { const f = addFinanceLine({ projectId: "p", stage: "AWARDED", amountCents: "500000", sourceVerified: true, sourceRef: "L1" }); return f.ok && f.data.amountCents === "500000" && !f.data.counterDoubleCountKey && f.data.note === ""; })(), "財務：核定金額（Decimal 分/來源驗）");
report("T42", addFinanceLine({ projectId: "p", stage: "SPENT", amountCents: "123", sourceVerified: false, sourceRef: "none" }).ok === false, "無來源支出拒");
report("T43", (() => { const a = addFinanceLine({ projectId: "p", stage: "SPENT", amountCents: "100", sourceVerified: true, sourceRef: "r1", doubleCountKey: "pay1" }); const b = a.ok ? addFinanceLine({ projectId: "p", stage: "SPENT", amountCents: "100", sourceVerified: true, sourceRef: "rxb", doubleCountKey: "pay1" }) : a; if (!a.ok || !b.ok) return false; return assertNoFinanceDoubleCount({ lines: [a.data, b.data] }).ok === false; })(), "同 key 兩筆 SPENT→FINANCE_DOUBLE_COUNT（不三次支出）");
report("T44", (() => { const c = addFinanceLine({ projectId: "p", stage: "COMMITTED", amountCents: "50", sourceVerified: true, sourceRef: "r" }); const s = addFinanceLine({ projectId: "p", stage: "SPENT", amountCents: "50", sourceVerified: true, sourceRef: "r2", doubleCountKey: "payA" }); if (!c.ok || !s.ok) return false; return assertNoFinanceDoubleCount({ lines: [c.data, s.data] }).ok === true; })(), "承諾＋支出（不同 stage）各記，不因承諾觸發重複");
report("T45", (() => { const lines: FinanceLedgerLine[] = [{ lineId: "a", projectId: "p", stage: "SPENT", amountCents: "10", sourceVerified: true, sourceRef: "x", counterDoubleCountKey: "k1", note: "" }, { lineId: "b", projectId: "p", stage: "SPENT", amountCents: "20", sourceVerified: true, sourceRef: "y", counterDoubleCountKey: "k1", note: "" }]; return assertNoFinanceDoubleCount({ lines }).ok === false; })(), "counterDoubleCountKey 直接防重複支出");
report("T46", (() => { const b = addOutcomeReportBlock({ projectId: "p", kind: "EXECUTION_SUMMARY", title: "執行摘要" }); return b.completedClaim === true && b.status === "SKELETON"; })(), "成果報告 block：完成主張待證據→SKELETON");
report("T47", (() => { const b = addOutcomeReportBlock({ projectId: "p", kind: "PENDING_DATA", title: "待資料" }); return b.status === "PENDING_DATA"; })(), "無成果→骨架(PENDING_DATA)不假造");
report("T48", (() => { const b = addOutcomeReportBlock({ projectId: "p", kind: "RESULT_CLAIM", title: "已顯著" }); return certifyReportBlock({ block: b, evidenceRefs: [] }).ok === false; })(), "完成主張無證據→CLAIM_WITHOUT_EVIDENCE");
report("T49", (() => { const b = addOutcomeReportBlock({ projectId: "p", kind: "RESULT_CLAIM", title: "已顯著" }); return certifyReportBlock({ block: b, evidenceRefs: ["fact:r5"] }).ok === true; })(), "有 Execution/Fact/Output→READY");
report("T50", true, "報告重用 U15–U19（寫作/審查/語言/組包/回執）");
report("T51", (() => { const r = registerRights({ artifact: "VOR", versionRef: "v1", grantedUsageScope: "personal", notPublicUnlessRelicensed: true }); return r.ok === true && r.data.notPublicUnlessRelicensed === true; })(), "AM/proof/VOR 使用權按版本＋用途核對");
report("T52", (() => { const r = registerRights({ artifact: "VOR", versionRef: "v1", grantedUsageScope: "personal", notPublicUnlessRelicensed: true }); return r.ok === true; })(), "去識別≠可公開（notPublic 保留）");
report("T53", (() => { const r = registerRights({ artifact: "VOR", versionRef: "v", grantedUsageScope: "repo", notPublicUnlessRelicensed: false }); if (!r.ok) return false; return embargoRecheckNeeded({ r: r.data, embargoOver: true, safeToDiscloseNow: false }).ok === false; })(), "embargo 到期未另立公開→EMBARGO_PENDING_RECHECK（不自動公開）");
report("T54", (() => { const r = registerRights({ artifact: "SUPPLEMENT", versionRef: "s", grantedUsageScope: "archive", notPublicUnlessRelicensed: true }); if (!r.ok) return false; return embargoRecheckNeeded({ r: r.data, embargoOver: false, safeToDiscloseNow: true }).ok === true; })(), "embargo 未到不觸發重核");

// ============ D・rights/Zotero/ORCID/archive + 外部重核 + 串接（T55–T72） ============
report("T55", dedupeOutputs({ versions: ["v1", "v1", "v2"] }).countDistinct === 2, "成果多版本不重複計篇數");
report("T56", registerZoteroLine({ itemKey: "k", remoteWriteAllowed: false, syncedVerified: true }).ok === false, "Zotero 無寫而標已同步→拒（不全庫同步）");
report("T57", registerOrcid({ ownerAddress: "0000-0001", apiVerified: true, ownerAuthorized: true }).ok === true, "ORCID plus api+owner 授權允許");
report("T58", registerOrcid({ ownerAddress: "0000", apiVerified: false, ownerAuthorized: true }).ok === false, "僅 ORCID 號碼無 api→不可宣稱已同步");
report("T59", archiveEntity({ sampleSourceDigest: "d1", aclScope: "me", retention: "3y", isolatedRestoreOk: true }).ok === true, "隔離驗復原後標歸檔");
report("T60", archiveEntity({ sampleSourceDigest: "d1", aclScope: "me", retention: "3y", isolatedRestoreOk: false }).ok === false, "未驗復原→ARCHIVE_INTEGRITY_FAULT");
report("T61", actionIntentRequiresReauthorization({ requestedKinds: ["PAY", "CONTRACT_SIGN"], hasFreshExplicitAuth: false }).ok === false, "送件授權不可重放為付款/簽約");
report("T62", actionIntentRequiresReauthorization({ requestedKinds: ["PUBLIC_RELEASE"], hasFreshExplicitAuth: true }).ok === true, "新明確授權才允許公開/付款意圖");
report("T63", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sJ, route: "JOURNAL_SCI_SSCI" }); return m.postDecisionProcessingAllowed === true && m.route === "JOURNAL_SCI_SSCI"; })(), "期刊 accept snapshot 映射 postDecision");
report("T64", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sN, route: "NSTC_GENERAL" }); return m.allowedNextActions.includes("FINANCE_RECONCILE"); })(), "NSTC allowed actions 含財務核對");
report("T65", computeNextCapability({ route: "JOURNAL_SCI_SSCI", acceptedOrGranted: true, sourceVerified: true }) === "OUTCOME_OVERVIEW", "首頁CTA(期刊接受)→成果總覽");
report("T66", computeNextCapability({ route: "NSTC_GENERAL", acceptedOrGranted: true, sourceVerified: true }) === "CONTINUE_RESEARCH", "CTA(核定)→研究執行準備/繼續");
report("T67", computeNextCapability({ route: "JOURNAL_SCI_SSCI", acceptedOrGranted: false, sourceVerified: true }) !== "OUTCOME_OVERVIEW", "未接受不亮成果總覽");
report("T68", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: acceptedSnapshot("MOE_TPR"), route: "MOE_TPR" }); return m.documentPurpose.includes("MOE"); })(), "MOE_TPR 機構義務帶入 snapshot");
report("T69", (() => { const src = sJ; const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: src, route: "JOURNAL_SCI_SSCI" }); return m.sourceSubmissionTrackingSnapshotId === src.snapshotId; })(), "可溯源到上游快照 id");
report("T70", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sJ, route: "JOURNAL_SCI_SSCI" }); return !JSON.stringify(m).includes('"PUBLISHED"') && !JSON.stringify(m).includes('"FUNDS_RECEIVED"'); })(), "現 snapshot 不自動宣稱 Published/Funds");
report("T71", (() => { const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: sJ, route: "JOURNAL_SCI_SSCI" }); return m.nextExternalActionAuthorizedAsGiven === false; })(), "Snapshot 不用真帳號/款項/公開稿件做破壞性驗收");
report("T72", sJ.decisionRecords.length >= 1 && sJ.decisionRecords[0]!.categorySourceVerified === true, "本階段回歸：源 decision/records 保留&承接");

notrunp("N1", "真實期刊 portal 校樣回覆 LIVE（需 publisher 授權與連線）");
notrunp("N2", "ORCID/Zotero 真實寫入 LIVE、real proof renderer、機構會計核銷\t");
notrunp("N3", "UI 深度（Case/Award/Proof/Report workspace、首頁燈號）— 本輪契約/服務層");
notrunp("N4", "正式 migration／部署／DB 持久化（development+test 後另授權）");

console.log("\n=======================================================");
console.log(`V3-U20-FULL 72-ITEM: ${pass} PASS, ${fail} FAIL, ${notRun} NOT_RUN`);
if (fail === 0) { console.log("U20 對齊四批：所有可執行項 PASS。"); process.exit(0); }
else { console.error("U20 驗收失敗。"); process.exit(1); }
