/**
 * Final Compliance & Submission Package Service (V3-U18-FULL)
 * Spec: docs/stage18/spec-v3-4.0.md
 *
 * Implements:
 * 1. Zero re-entry intake from Stage 17 LanguageQualitySnapshot
 * 2. Three-route profiles (JOURNAL / NSTC / MOE)
 * 3. Rule snapshots with sources & hashes (no unverified deadlines/APC)
 * 4. Derived document list + format mapping (renderer availability gate)
 * 5. Anonymization QA (metadata/comments/track changes, not just first page)
 * 6. ApprovalSubjectManifest (no approval events in hash) + author approval records
 * 7. Candidate freeze → human confirm → package lock (hash-cycle free)
 * 8. FinalSubmissionPackageSnapshot immutable handoff for Stage 19
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type RouteProfile,
  type JournalProfile,
  type NstcProfile,
  type MoeTprProfile,
  type OfficialRuleSnapshot,
  type PackageDocument,
  type ApprovalSubjectManifest,
  type AuthorApprovalRecord,
  type PackageReadiness,
  type FinalSubmissionPackageSnapshot,
  type Stage19ReceiverState,
  type SubmissionRoute,
} from "./final-submission-v3-contract.ts";
import { type LanguageQualitySnapshot } from "./language-quality-v3-contract.ts";

function sha256(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// -------------------------------------------------------------
// §1 Zero re-entry intake from Stage 17
// -------------------------------------------------------------
export function buildComplianceWorkspaceFromStage17(params: {
  workspaceId: string;
  projectId: string;
  languageQualitySnapshot: LanguageQualitySnapshot;
}): {
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  sourceSnapshotId: string;
  sourceSnapshotHash: string;
  primaryGoal: import("./research-goal-registry.ts").PrimaryGoalId;
  documentPurpose: string;
  formalComplianceAllowed: boolean;
  complianceAllowedScopeRefs: string[];
  route: SubmissionRoute;
  profile: RouteProfile;
  createdAt: string;
} {
  const { workspaceId, projectId, languageQualitySnapshot } = params;
  const route: SubmissionRoute = languageQualitySnapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : languageQualitySnapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR";
  const formalAllowed = languageQualitySnapshot.formalComplianceAllowed === true;

  // Build route profile from goal
  let profile: RouteProfile;
  if (route === "JOURNAL_SCI_SSCI") {
    profile = {
      profileId: `jp_${projectId}`,
      route,
      targetJournal: "TBD（待依目標期刊確認）",
      articleType: "TBD",
      requirements: ["主稿", "Title Page", "適用匿名", "作者與聲明", "引用與表圖", "Reporting Checklist", "Cover Letter", "目標要求其他附件"],
      reportingGuideline: "依適用 guideline（存規則來源）",
      anonymizationRequired: true,
      coverLetterRequired: true,
      titlePageRequired: true,
    } satisfies JournalProfile;
  } else if (route === "NSTC_GENERAL") {
    profile = {
      profileId: `np_${projectId}`,
      route,
      targetYear: "TBD（依當年度徵件）",
      discipline: "TBD",
      projectType: "TBD",
      eligibility: ["待依學門與資格規則核對"],
      sections: ["計畫內容", "個人資料", "工作包", "經費", "所需證明"],
      budgetWorkPackages: ["依 U08 預算與工作包核對"],
      institutionalReviewRequired: true,
      institutionalSubmissionRequired: true,
    } satisfies NstcProfile;
  } else {
    profile = {
      profileId: `mp_${projectId}`,
      route,
      mainCourse: "TBD",
      teachingProblem: "TBD",
      studentOutcomes: "TBD",
      assessmentPlan: "TBD",
      budget: "TBD",
      statements: ["教學實踐聲明", "學生權益聲明"],
      ethicsOrCooperationDocs: ["倫理／協同文件依校內程序"],
      institutionalProcedure: "校內程序待確認",
    } satisfies MoeTprProfile;
  }

  return {
    workspaceId: `ws_fc_${projectId}`,
    projectId,
    workOrderId: `wfc_${projectId}`,
    sourceSnapshotId: languageQualitySnapshot.snapshotId,
    sourceSnapshotHash: sha256({ id: languageQualitySnapshot.snapshotId, decision: languageQualitySnapshot.decision }),
    primaryGoal: languageQualitySnapshot.primaryGoal,
    documentPurpose: `document_purpose=${languageQualitySnapshot.scope.task} / ${route}`,
    formalComplianceAllowed: formalAllowed,
    complianceAllowedScopeRefs: languageQualitySnapshot.complianceAllowedScopeRefs,
    route,
    profile,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §3 Scope gate: partial/standalone language may only pre-check
// -------------------------------------------------------------
export function assertComplianceScopeAuthorized(params: {
  formalComplianceAllowed: boolean;
  sectionRef: string;
}): { ok: true } | { ok: false; code: "COMPLIANCE_SCOPE_NOT_AUTHORIZED"; reason: string } {
  const { formalComplianceAllowed, sectionRef } = params;
  if (!formalComplianceAllowed) {
    return {
      ok: false,
      code: "COMPLIANCE_SCOPE_NOT_AUTHORIZED",
      reason: `上游 formal_compliance_allowed=false；僅可做相應預檢（${sectionRef}），不得宣稱完整科學核准。`,
    };
  }
  return { ok: true };
}

// -------------------------------------------------------------
// §4 Rule snapshots (sources must be preserved; no invented deadlines/APC)
// -------------------------------------------------------------
export function buildRuleSnapshots(params: { route: SubmissionRoute }): OfficialRuleSnapshot[] {
  const { route } = params;
  const common = { version: "1.0", hash: sha256(`rule:${route}:${Date.now().toString(36)}`), note: "來源須以官方文件核對後填寫；未查證不得填入截止日/APC/索引。" };
  const rules: OfficialRuleSnapshot[] = [
    {
      ruleId: `rule_${route}_01`,
      route,
      source: "待官方文件",
      clause: "適用要求矩陣（三路線分開）",
      applicableYearOrPhase: "TBD",
      ...common,
    },
  ];
  if (route === "JOURNAL_SCI_SSCI") {
    rules.push({
      ruleId: "rule_JOURNAL_02",
      route,
      source: "目標期刊作者指南（待官方確認）",
      clause: "字數／頁數／匿名／聲明／附件要求",
      applicableYearOrPhase: "依期刊目前版本",
      version: "1.0",
      hash: sha256("rule:journal:author-guidelines"),
      note: "舊年度指南僅作明標參考；來源讀不到不是尚未公告。",
    });
    rules.push({
      ruleId: "rule_JOURNAL_03",
      route,
      source: "Reporting Guideline（依適用）",
      clause: "checklist 與主稿對應",
      applicableYearOrPhase: "依 guideline 版本",
      version: "1.0",
      hash: sha256("rule:journal:reporting"),
      note: "機械映射不是正式規範認證。",
    });
  }
  if (route === "NSTC_GENERAL") {
    rules.push({
      ruleId: "rule_NSTC_02",
      route,
      source: "當年度國科會徵件要點（待官方確認）",
      clause: "學門／型別／資格／經費上限",
      applicableYearOrPhase: "TBD",
      version: "1.0",
      hash: sha256("rule:nstc:call"),
      note: "不得用他校截止日或未查證 APC/索引填入。",
    });
  }
  if (route === "MOE_TPR") {
    rules.push({
      ruleId: "rule_MOE_02",
      route,
      source: "教育部教學實踐研究要點（待官方確認）",
      clause: "課程／評量／聲明／校內程序",
      applicableYearOrPhase: "TBD",
      version: "1.0",
      hash: sha256("rule:moe:tpr"),
      note: "校內程序與主管機關送件分開。",
    });
  }
  return rules;
}

// -------------------------------------------------------------
// §5 Derived document list + renderer gate
// -------------------------------------------------------------
export type RendererCapability = { format: "markdown" | "json" | "docx" | "pdf" | "latex"; available: boolean; note: string };

export function rendererCapabilities(): RendererCapability[] {
  return [
    { format: "markdown", available: true, note: "本輪真實可用" },
    { format: "json", available: true, note: "結構化快照" },
    { format: "docx", available: false, note: "無可靠 DOCX renderer（如實標 UNSUPPORTED，不以 Markdown 冒稱可送件）" },
    { format: "pdf", available: false, note: "無可靠 PDF renderer（如實標 UNSUPPORTED）" },
    { format: "latex", available: false, note: "無隔離 LaTeX 編譯能力（如實標 UNSUPPORTED）" },
  ];
}

export function buildDerivedDocuments(params: {
  route: SubmissionRoute;
  profile: RouteProfile;
  anonymizationRequired: boolean;
}): PackageDocument[] {
  const { route, profile, anonymizationRequired } = params;
  const docs: PackageDocument[] = [];
  const common = { contentHash: "", byteSize: 0, status: "CANDIDATE" as const };

  docs.push({ documentId: "doc_main", kind: "MAIN_TEXT", filename: "main-text.md", format: "markdown", ...common });
  if (route === "JOURNAL_SCI_SSCI") {
    const jp = profile as JournalProfile;
    if (jp.titlePageRequired) docs.push({ documentId: "doc_title", kind: "TITLE_PAGE", filename: "title-page.md", format: "markdown", ...common });
    if (jp.coverLetterRequired) docs.push({ documentId: "doc_cover", kind: "COVER_LETTER", filename: "cover-letter.md", format: "markdown", ...common });
    if (jp.reportingGuideline) docs.push({ documentId: "doc_checklist", kind: "REPORTING_CHECKLIST", filename: "reporting-checklist.md", format: "markdown", ...common });
  }
  docs.push({ documentId: "doc_refs", kind: "REFERENCES", filename: "references.md", format: "markdown", ...common });
  docs.push({ documentId: "doc_statements", kind: "STATEMENTS", filename: "statements.md", format: "markdown", ...common });
  docs.push({ documentId: "doc_approval", kind: "APPROVAL_RECORD", filename: "approval-record.json", format: "json", ...common });

  // Anonymization note: not just removing the first page name
  if (anonymizationRequired) {
    // metadata/comments/track changes are part of QA, not a separate doc
  }
  return docs;
}

// -------------------------------------------------------------
// §6 Anonymization QA (metadata/comments/track changes, not only first page)
// -------------------------------------------------------------
export function runAnonymizationQa(params: {
  candidateText: string;
  metadataSample: string;
}): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const namePatterns = [/(?:姓名|名字|作者|指導教授|通訊作者)[:：]\s*\S+/u, /[A-Z][a-z]+ [A-Z][a-z]+/u];
  for (const pat of namePatterns) {
    if (pat.test(params.candidateText)) issues.push(`候選文字含疑似姓名（${pat.source}）。`);
  }
  if (/track.?changes|修訂記錄|revised by/iu.test(params.metadataSample)) issues.push("metadata 含修訂／Track Changes，需清除（不只刪第一頁姓名）。");
  if (/@|tel[:：]|電話|email/iu.test(params.metadataSample)) issues.push("metadata 含聯絡資訊。");
  return { passed: issues.length === 0, issues };
}

// -------------------------------------------------------------
// §6 References QA (use existing CitationSource / Zotero graph; no fake live fields)
// -------------------------------------------------------------
export function runReferencesQa(params: {
  referenceBlock: string;
}): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!params.referenceBlock.trim()) issues.push("References 空白。");
  if (/\[TODO\]|\[未填\]/u.test(params.referenceBlock)) issues.push("References 含未填佔位。");
  // Static export only — never claim Zotero Word live fields
  return { passed: issues.length === 0, issues };
}

// -------------------------------------------------------------
// §6 Render QA placeholder (real renderer round-trip when available)
// -------------------------------------------------------------
export function runRenderQa(params: {
  hasRenderer: boolean;
  format: string;
}): { passed: boolean; issues: string[] } {
  if (!params.hasRenderer) {
    return { passed: false, issues: [`renderer for ${params.format} 不可用；不以 Markdown 冒稱可送件（RENDERER_UNAVAILABLE）。`] };
  }
  return { passed: true, issues: [] };
}

// -------------------------------------------------------------
// §5 ApprovalSubjectManifest (hash of frozen bytes; no approval events inside)
// -------------------------------------------------------------
export function buildApprovalSubjectManifest(params: {
  projectId: string;
  documents: PackageDocument[];
  createdBy: string;
}): ApprovalSubjectManifest {
  const { projectId, documents, createdBy } = params;
  return {
    manifestId: `asm_${projectId}_${Date.now().toString(36)}`,
    projectId,
    documents: documents.map((d) => ({ ...d })),
    contentHash: sha256(documents.map((d) => `${d.documentId}:${d.contentHash}`)),
    createdById: createdBy,
    createdAt: new Date().toISOString(),
  };
}

export function approveDocument(params: {
  manifest: ApprovalSubjectManifest;
  documentId: string;
  verifiedOfflineRef: string;
}): { ok: true; record: AuthorApprovalRecord } | { ok: false; code: string; reason: string } {
  const doc = params.manifest.documents.find((d) => d.documentId === params.documentId);
  if (!doc) return { ok: false, code: "DOCUMENT_HASH_MISMATCH", reason: "文件不存在於 ApprovalSubjectManifest。" };
  if (!doc.contentHash) return { ok: false, code: "DOCUMENT_HASH_MISMATCH", reason: "文件尚未 freeze（無 digest），不可核准。" };
  const record: AuthorApprovalRecord = {
    approvalId: `appr_${params.documentId}_${Date.now().toString(36)}`,
    subjectManifestId: params.manifest.manifestId,
    documentDigest: doc.contentHash,
    approverType: "VERIFIED_OFFLINE",
    approverLabel: `verified-offline:${params.verifiedOfflineRef}`,
    verifiedOfflineRef: params.verifiedOfflineRef,
    approvedAt: new Date().toISOString(),
  };
  return { ok: true, record };
}

// -------------------------------------------------------------
// §7 Freeze → confirm → lock (hash-cycle free)
// -------------------------------------------------------------
export function freezeDocuments(params: {
  documents: PackageDocument[];
  contentByDocumentId: Record<string, string>;
}): { ok: true; documents: PackageDocument[] } | { ok: false; code: string; missing: string[] } {
  const missing: string[] = [];
  const docs = params.documents.map((d) => {
    const content = params.contentByDocumentId[d.documentId];
    if (typeof content !== "string") {
      missing.push(d.documentId);
      return d;
    }
    return { ...d, contentHash: sha256(content), byteSize: Buffer.byteLength(content, "utf8"), status: "FROZEN" as const };
  });
  if (missing.length > 0) return { ok: false, code: "DOCUMENT_HASH_MISMATCH", missing };
  return { ok: true, documents: docs };
}

export function confirmFreezeAndLock(params: {
  documents: PackageDocument[];
  humanConfirmed: boolean;
  pendingApprovals: number;
}): { ok: true; documents: PackageDocument[]; packageLocked: boolean } | { ok: false; code: string; reason: string } {
  if (!params.humanConfirmed) return { ok: false, code: "FREEZE_NOT_CONFIRMED", reason: "尚未收到真人確認（freeze 後才收 approval，避免 hash 循環）。" };
  if (params.pendingApprovals > 0) return { ok: false, code: "APPROVAL_NOT_VERIFIED", reason: `尚有 ${params.pendingApprovals} 份文件未獲核准。` };
  return {
    ok: true,
    documents: params.documents.map((d) => ({ ...d, status: "LOCKED" as const })),
    packageLocked: true,
  };
}

// -------------------------------------------------------------
// §7 FinalSubmissionPackageSnapshot builder
// -------------------------------------------------------------
export function buildFinalSubmissionPackageSnapshot(params: {
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  sourceSnapshot: LanguageQualitySnapshot;
  route: SubmissionRoute;
  profile: RouteProfile;
  rules: OfficialRuleSnapshot[];
  documents: PackageDocument[];
  manifest: ApprovalSubjectManifest;
  approvals: AuthorApprovalRecord[];
  requiredApprovals: number;
  anonymizationQa: { passed: boolean; issues: string[] };
  referencesQa: { passed: boolean; issues: string[] };
  renderQa: { passed: boolean; issues: string[] };
  freezeConfirmed: boolean;
  packageLocked: boolean;
}): FinalSubmissionPackageSnapshot {
  const {
    workspaceId, projectId, workOrderId, sourceSnapshot, route, profile, rules,
    documents, manifest, approvals, requiredApprovals, anonymizationQa, referencesQa, renderQa,
    freezeConfirmed, packageLocked,
  } = params;

  const snapshotId = `fspsnap_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const pending = requiredApprovals - approvals.length;
  const allQaPassed = anonymizationQa.passed && referencesQa.passed && renderQa.passed;
  const decision: PackageReadiness =
    !packageLocked || pending > 0 || !allQaPassed || !freezeConfirmed
      ? "NOT_READY"
      : route === "JOURNAL_SCI_SSCI"
        ? "READY_FOR_AUTHOR_SUBMISSION"
        : route === "NSTC_GENERAL"
          ? "READY_FOR_INSTITUTIONAL_SUBMISSION"
          : "READY_FOR_INSTITUTIONAL_SUBMISSION";

  return {
    snapshotId,
    schemaVersion: "final-submission/1.0.0",
    stageKey: "V3-U18",
    workspaceId,
    projectId,
    workOrderId,
    stageId: "final-compliance",
    nextStageId: "submission-tracking", // Stage 19: 正式送件與審查追蹤
    sourceLanguageQualitySnapshotId: sourceSnapshot.snapshotId,
    sourceLanguageQualitySnapshotHash: sha256({ id: sourceSnapshot.snapshotId, decision: sourceSnapshot.decision }),
    goalContextRevision: 1,
    primaryGoal: sourceSnapshot.primaryGoal,
    documentPurpose: `document_purpose=${sourceSnapshot.scope.task} / ${route}`,

    decision,
    decisionRationale:
      decision === "NOT_READY"
        ? `尚未就緒：pendingApprovals=${pending}，anonymization=${anonymizationQa.passed}，references=${referencesQa.passed}，render=${renderQa.passed}，lock=${packageLocked}。`
        : decision === "READY_FOR_AUTHOR_SUBMISSION"
          ? "成果包已鎖定、QA 全過、作者核准齊備；僅 READY_FOR_AUTHOR_SUBMISSION（不等於 SUBMITTED 或官方核准）。"
          : "成果包已鎖定、QA 全過、核准齊備；READY_FOR_INSTITUTIONAL_REVIEW/SUBMISSION（不等於已送件或官方核准）。",
    submissionExecutionAuthorized: false,

    route,
    profile,
    ruleSnapshots: rules,

    documents,
    approvalSubjectManifest: manifest,
    authorApprovals: approvals,
    requiredAuthorApprovals: requiredApprovals,
    pendingAuthorApprovals: pending,

    anonymizationQaPassed: anonymizationQa.passed,
    referencesQaPassed: referencesQa.passed,
    renderQaPassed: renderQa.passed,
    freezeConfirmed,
    packageLocked,
    sensitiveContentExcluded: true,

    unresolvedIssueRefs: [],
    laterStageRequirements: ["正式送件執行（U19）需另授權", "Cover Letter 完整內容待期刊確認", "Reporting Checklist 對應待 guideline 確認"],
    limitations: [
      "本快照為最終合規與成果包基線；READY 不等於 SUBMITTED、官方核准或期刊接受。",
      "submission_execution_authorized=false；本輪不自動登入、填表、寄信、付 APC、上傳或代簽。",
      "DOCX/PDF/LaTeX renderer 未具備時如實標 UNSUPPORTED；靜態 References 不冒充 Zotero Word 動態欄位。",
      "第十九階段正式送件與審查追蹤尚未建置；本輪提供可重開 receiver 頁。",
    ],
    checksum: `chk_fs_${Date.now().toString(36)}_${sha256(snapshotId).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §7 Stage 19 receiver state
// -------------------------------------------------------------
export function buildStage19ReceiverState(params: {
  snapshot: FinalSubmissionPackageSnapshot;
}): Stage19ReceiverState {
  const { snapshot } = params;
  const notes: string[] = [];
  if (snapshot.decision === "NOT_READY") notes.push("成果包尚未就緒；請完成核准/QA/lock 後再交 U19。");
  if (snapshot.submissionExecutionAuthorized) notes.push("注意：本輪不執行正式送件。");
  notes.push("U19 尚未完整建置；此為可重開 receiver，可返回 U18，不生成假送件或空白頁。");

  return {
    receiverVersion: "submission-tracking-receiver/1.0.0",
    stageKey: "V3-U19-RECEIVER",
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    sourceFinalSubmissionPackageSnapshotId: snapshot.snapshotId,
    sourceSchemaVersion: snapshot.schemaVersion,
    primaryGoal: snapshot.primaryGoal,
    decision: snapshot.decision,
    readiness: snapshot.decision,
    documentCount: snapshot.documents.length,
    locked: snapshot.packageLocked,
    submissionExecutionAuthorized: false,
    readyForSubmissionTracking: snapshot.decision !== "NOT_READY" && snapshot.packageLocked,
    receiverNotes: notes,
    reEntryPoint: { route: "final-compliance", action: "initialize", snapshotId: snapshot.sourceLanguageQualitySnapshotId },
    createdAt: new Date().toISOString(),
  };
}
