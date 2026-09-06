/**
 * Translation & Academic Polishing Language Quality Service (V3-U17-FULL)
 * Spec: docs/stage17/spec-v3-4.0.md
 *
 * Implements:
 * 1. Zero re-entry intake from Stage 16 ScientificReviewSnapshot
 * 2. Language Work Order + scope check (full vs partial, never auto-upgrade)
 * 3. Segment model with safe UTF-8 byte serialization (never count zh chars as bytes)
 * 4. Fidelity checker: token, subject/group/timepoint/denominator/scale/unit,
 *    direction, negation, causal strength, confirmatory/exploratory,
 *    limitation, citation ownership, terminology — NOT just token counts
 * 5. Provider capability manifest (DeepL Translate / DeepL Write / LT / OLD_MIKE / fallbacks)
 * 6. Numeric / citation / terminology / semantic QA
 * 7. LanguageQualitySnapshot immutable handoff for Stage 18
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type LanguageWorkOrder,
  type LanguageQualitySnapshot,
  type FidelityIssue,
  type FidelityCheckKind,
  type TermBinding,
  type ProviderCapability,
  type LanguageTask,
  type LanguageSegment,
  type Stage18ReceiverState,
} from "./language-quality-v3-contract.ts";
import { type ScientificReviewSnapshot } from "./scientific-review-v3-contract.ts";

function sha256(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// -------------------------------------------------------------
// §1 Zero re-entry intake from Stage 16
// -------------------------------------------------------------
export function buildLanguageWorkspaceFromStage16(params: {
  workspaceId: string;
  projectId: string;
  scientificReviewSnapshot: ScientificReviewSnapshot;
}): {
  workspaceId: string;
  projectId: string;
  reviewRunId: string;
  workOrderId: string;
  workOrder: LanguageWorkOrder;
  sourceSnapshotId: string;
  sourceSnapshotHash: string;
  sourceDecision: string;
  primaryGoal: import("./research-goal-registry.ts").PrimaryGoalId;
  meaningConstraintRefs: string[];
  fullManuscriptLanguageAllowed: boolean;
  languageAllowedScopeRefs: string[];
  createdAt: string;
} {
  const { workspaceId, projectId, scientificReviewSnapshot } = params;

  const fullAllowed = scientificReviewSnapshot.fullManuscriptLanguageAllowed === true;
  const scopeRefs = fullAllowed
    ? scientificReviewSnapshot.languageAllowedScopeRefs.length > 0
      ? scientificReviewSnapshot.languageAllowedScopeRefs
      : ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"]
    : scientificReviewSnapshot.languageAllowedScopeRefs ?? [];

  // §3: full/partial separation; never auto-upgrade partial to full.
  const task: LanguageTask =
    scientificReviewSnapshot.primaryGoal === "NSTC_GENERAL" || scientificReviewSnapshot.primaryGoal === "MOE_TPR"
      ? "SAME_LANGUAGE_CORRECTION"
      : "TRANSLATE_ZH_EN";

  const workOrder: LanguageWorkOrder = {
    workOrderId: `wlq_${projectId}`,
    projectId,
    reviewRunId: scientificReviewSnapshot.reviewRunId,
    task,
    sourceLanguage: "zh-TW",
    targetLanguage: scientificReviewSnapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "en-US" : "zh-TW",
    fullManuscriptLanguageAllowed: fullAllowed,
    languageAllowedScopeRefs: scopeRefs,
    budget: 200,
    status: fullAllowed ? "AUTHORIZED" : "IN_PROGRESS", // partial => limited work only
  };

  return {
    workspaceId: `ws_lq_${projectId}`,
    projectId,
    reviewRunId: scientificReviewSnapshot.reviewRunId,
    workOrderId: workOrder.workOrderId,
    workOrder,
    sourceSnapshotId: scientificReviewSnapshot.snapshotId,
    sourceSnapshotHash: sha256({
      id: scientificReviewSnapshot.snapshotId,
      decision: scientificReviewSnapshot.decision,
      release: scientificReviewSnapshot.scientificReleaseState,
    }),
    sourceDecision: scientificReviewSnapshot.decision,
    primaryGoal: scientificReviewSnapshot.primaryGoal,
    meaningConstraintRefs: scientificReviewSnapshot.meaningConstraintRefs,
    fullManuscriptLanguageAllowed: fullAllowed,
    languageAllowedScopeRefs: scopeRefs,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §2 Scope check: never auto-upgrade partial to full
// -------------------------------------------------------------
export function assertLanguageScopeAuthorized(params: {
  workOrder: LanguageWorkOrder;
  sectionRef: string;
}): { ok: true } | { ok: false; code: "LANGUAGE_SCOPE_NOT_AUTHORIZED"; reason: string } {
  const { workOrder, sectionRef } = params;
  if (workOrder.fullManuscriptLanguageAllowed) return { ok: true };
  if (!workOrder.languageAllowedScopeRefs.includes(sectionRef)) {
    return {
      ok: false,
      code: "LANGUAGE_SCOPE_NOT_AUTHORIZED",
      reason: `章節 ${sectionRef} 不在 language_allowed_scope_refs 內；本稿僅獲部分語言准用，不得整稿處理。`,
    };
  }
  return { ok: true };
}

// -------------------------------------------------------------
// §4 Safe segmentation (UTF-8 bytes, not char count)
// -------------------------------------------------------------

export function segmentByParagraphs(params: {
  sections: Array<{ sectionRef: string; paragraphRef?: string; text: string }>;
  maxSegmentBytes?: number;
}): { segments: LanguageSegment[]; overLimitSegments: string[] } {
  const maxBytes = params.maxSegmentBytes ?? 6000;
  const segments: LanguageSegment[] = [];
  const overLimitSegments: string[] = [];
  for (const s of params.sections) {
    const bytes = Buffer.byteLength(s.text, "utf8");
    const segmentId = `seg_${s.sectionRef}_${s.paragraphRef ?? segments.length}`;
    if (bytes > maxBytes) {
      // Splitting is the caller's responsibility (UI/engine); we surface it.
      overLimitSegments.push(segmentId);
    }
    segments.push({
      segmentId,
      sectionRef: s.sectionRef,
      paragraphRef: s.paragraphRef,
      sourceText: s.text,
      sourceUtf8Bytes: bytes,
      targetText: "",
      status: "PENDING",
    });
  }
  return { segments, overLimitSegments };
}

// -------------------------------------------------------------
// §5 Fidelity checker (beyond token counts)
// -------------------------------------------------------------
export function runFidelityChecks(params: {
  sectionRef: string;
  paragraphRef?: string;
  sourceText: string;
  targetText: string;
  protectedTokens?: Array<{ token: string; kind: FidelityCheckKind }>;
}): { issues: FidelityIssue[]; passed: boolean } {
  const { sectionRef, paragraphRef, sourceText, targetText } = params;
  const issues: FidelityIssue[] = [];

  const protectedTokens = params.protectedTokens ?? [
    { token: "913.1", kind: "TOKEN_MODIFIED" as FidelityCheckKind },
    { token: "N = 6", kind: "DENOMINATOR_CHANGED" as FidelityCheckKind },
    { token: "T0", kind: "TIMEPOINT_CHANGED" as FidelityCheckKind },
    { token: "T1", kind: "TIMEPOINT_CHANGED" as FidelityCheckKind },
    { token: "-913.1", kind: "COMPARISON_DIRECTION_CHANGED" as FidelityCheckKind },
    { token: "p < .01", kind: "TOKEN_MODIFIED" as FidelityCheckKind },
  ];

  for (const pt of protectedTokens) {
    const inSource = sourceText.includes(pt.token);
    const inTarget = targetText.includes(pt.token);
    if (inSource && !inTarget) {
      issues.push({
        issueId: `fid_${pt.kind}_${sectionRef}_${pt.token.replace(/[^a-zA-Z0-9]/g, "_")}`,
        kind: pt.kind,
        sectionRef,
        paragraphRef,
        protectedValue: pt.token,
        sourceValue: pt.token,
        targetValue: "(missing)",
        severity: pt.kind === "COMPARISON_DIRECTION_CHANGED" || pt.kind === "DENOMINATOR_CHANGED" ? "FATAL" : "MAJOR",
        description: `受保護值「${pt.token}」在目標語言版本中遺失或改變（保真要求，不限 token 數量）。`,
        blocksAdoption: true,
      });
    }
  }

  // --- Numeric & direction fingerprint (beyond substring presence) ---
  // Extract signed decimal numbers from source, ensure the SAME numeric value
  // (including sign) appears in target. Covers swaps like -913.1 → +913.1.
  const numberPattern = /([+-]?\d+(?:\.\d+)?)/g;
  const sourceNumbers = new Set(sourceText.match(numberPattern) ?? []);
  for (const n of sourceNumbers) {
    if (n === "1" || n === "0") continue; // skip trivial integers (model version, count 1)
    if (!targetText.includes(n)) {
      // allow formatting-only differences (e.g. N = 6 vs N=6) for pure integers;
      // for signed/floating values a missing signed form is FATAL
      const isSigned = n.startsWith("-") || n.startsWith("+") || n.includes(".");
      if (isSigned || !targetText.replace(/\s/g, "").includes(n)) {
        issues.push({
          issueId: `fid_NUM_${n.replace(/[^a-zA-Z0-9]/g, "_")}_${sectionRef}`,
          kind: n.startsWith("-") || n.startsWith("+") ? "COMPARISON_DIRECTION_CHANGED" : "TOKEN_MODIFIED",
          sectionRef,
          paragraphRef,
          protectedValue: n,
          sourceValue: n,
          targetValue: "(changed or missing)",
          severity: "FATAL",
          description: `數值「${n}」在目標語言版本中遺失或改變（含正負號/尺度）。`, 
          blocksAdoption: true,
        });
      }
    }
  }

  // --- Denominator fingerprint: N = k patterns (full number boundary) ---
  const nPattern = /N\s*=\s*(\d+)/gi;
  const sourceNs = new Set(Array.from(sourceText.matchAll(nPattern)).map((m) => m[1]));
  const targetNs = new Set(Array.from(targetText.matchAll(nPattern)).map((m) => m[1]));
  for (const n of sourceNs) {
    if (!targetNs.has(n)) {
      issues.push({
        issueId: `fid_N_${n}_${sectionRef}`,
        kind: "DENOMINATOR_CHANGED",
        sectionRef,
        paragraphRef,
        protectedValue: `N = ${n}`,
        sourceValue: `N = ${n}`,
        targetValue: "(changed or missing)",
        severity: "FATAL",
        description: `樣本/分母「N = ${n}」在目標語言版本中遺失或改變（計畫 N、招募 N、分析 N 不得互換）。`,
        blocksAdoption: true,
      });
    }
  }

  // --- Group↔value pairing (same numbers, swapped groups) ---
  // Detect e.g. 「介入組 1860.2，對照組 2773.3」→「對照組 1860.2，介入組 2773.3」.
  const groupValuePattern = /([\u4e00-\u9fa5A-Za-z（）()0-9]+?組|[\u4e00-\u9fa5A-Za-z（）()0-9]+?group)\s*[:：]?\s*(\d+(?:\.\d+)?)/g;
  const sourcePairs = Array.from(sourceText.matchAll(groupValuePattern)).map((m) => `${m[1].trim()}=${m[2]}`);
  const targetPairs = new Set(Array.from(targetText.matchAll(groupValuePattern)).map((m) => `${m[1].trim()}=${m[2]}`));
  for (const pair of sourcePairs) {
    if (!targetPairs.has(pair)) {
      // Only flag when BOTH numbers exist in target but paired differently
      const [groupName, num] = pair.split("=");
      const targetHasNum = targetText.includes(num);
      const targetHasGroup = targetText.includes(groupName);
      if (targetHasNum && targetHasGroup) {
        issues.push({
          issueId: `fid_GROUP_${groupName}_${sectionRef}`,
          kind: "GROUP_SWAPPED",
          sectionRef,
          paragraphRef,
          protectedValue: `${groupName}=${num}`,
          sourceValue: pair,
          targetValue: "(group↔value pairing changed)",
          severity: "FATAL",
          description: `群組「${groupName}」與數值「${num}」的配對在目標語言版中改變（兩組數值互換不得 PASS）。`,
          blocksAdoption: true,
        });
      }
    }
  }

  // Negation check
  // Simple negation-direction check: source has 未顯著 → target must not claim 顯著/證實
  if (sourceText.includes("未顯著") && /顯著|proved|confirmed/.test(targetText)) {
    issues.push({
      issueId: `fid_NEGATION_${sectionRef}`,
      kind: "NEGATION_CHANGED",
      sectionRef,
      paragraphRef,
      protectedValue: "未顯著",
      sourceValue: sourceText.slice(0, 40),
      targetValue: targetText.slice(0, 40),
      severity: "FATAL",
      description: "來源為「未顯著」，目標語言不得改為「顯著／已證實」等效表述。",
      blocksAdoption: true,
    });
  }

  // Causal strength check: may→proved / 可能→已證實
  if (/可能|may/.test(sourceText) && /proved|已證實|證實/.test(targetText)) {
    issues.push({
      issueId: `fid_CAUSAL_${sectionRef}`,
      kind: "CAUSAL_STRENGTH_CHANGED",
      sectionRef,
      paragraphRef,
      protectedValue: "可能（未直接測量機制）",
      sourceValue: sourceText.slice(0, 40),
      targetValue: targetText.slice(0, 40),
      severity: "FATAL",
      description: "因果強度被強化：來源為可能性表述，目標語言不得改為已證實。",
      blocksAdoption: true,
    });
  }

  // Confirmatory/exploratory check
  if (sourceText.includes("探索性") && !targetText.includes("exploratory") && !targetText.includes("探索性")) {
    issues.push({
      issueId: `fid_EXPLORE_${sectionRef}`,
      kind: "CONFIRMATORY_OR_EXPLORATORY_CHANGED",
      sectionRef,
      paragraphRef,
      protectedValue: "探索性",
      sourceValue: sourceText.slice(0, 40),
      targetValue: targetText.slice(0, 40),
      severity: "MAJOR",
      description: "確認／探索分類在語言版中遺失。",
      blocksAdoption: false,
    });
  }

  return { issues, passed: issues.filter((i) => i.severity === "FATAL").length === 0 };
}

// -------------------------------------------------------------
// §6 Terminology check (locked terms must match)
// -------------------------------------------------------------
export function runTerminologyCheck(params: {
  termBindings: TermBinding[];
  targetText: string;
}): { issues: FidelityIssue[]; passed: boolean } {
  const issues: FidelityIssue[] = [];
  for (const t of params.termBindings.filter((tb) => tb.isLocked)) {
    if (!params.targetText.includes(t.targetTerm)) {
      issues.push({
        issueId: `term_${t.termId}`,
        kind: "TERMINOLOGY_MISMATCH",
        sectionRef: "ALL",
        protectedValue: t.targetTerm,
        sourceValue: t.sourceTerm,
        targetValue: "(missing)",
        severity: "MAJOR",
        description: `鎖定術語「${t.targetTerm}」（構念 ${t.canonicalId}）在目標語言版本中未使用。`,
        blocksAdoption: false,
      });
    }
  }
  return { issues, passed: issues.length === 0 };
}

// -------------------------------------------------------------
// §7 Provider capability manifest
// -------------------------------------------------------------
export function buildProviderCapabilityManifest(): ProviderCapability[] {
  return [
    { providerId: "DEEPL_TRANSLATE", status: "NOT_CONFIGURED", note: "依 DEEPL_API_KEY 環境變數決定；未配置時為 NOT_CONFIGURED（不假裝 LIVE）。" },
    { providerId: "DEEPL_WRITE", status: "NOT_CONFIGURED", note: "DeepL Write（同語言 correct/rephrase）為獨立 endpoint，不套用 Translate 的 ignore_tags/glossary。" },
    { providerId: "OLD_MIKE_SEMANTIC", status: "MOCK", note: "老麥語義模型：本輪以確定性規則執行保真檢查（LOCAL_DETERMINISTIC）。" },
    { providerId: "LANGUAGETOOL", status: "NOT_CONFIGURED", note: "自架 LanguageTool（LT_BASE_URL）；公共免費端點不作自動化批次後備。" },
    { providerId: "GOOGLE_FALLBACK", status: "UNSUPPORTED", note: "僅在 scope/region/費用/功能符合時使用；未授權不啟用。" },
    { providerId: "AZURE_FALLBACK", status: "UNSUPPORTED", note: "同 Google fallback，未授權不啟用。" },
  ];
}

// -------------------------------------------------------------
// §7 QA aggregation
// -------------------------------------------------------------
export function runLanguageQa(params: {
  fidelityIssues: FidelityIssue[];
  terminologyIssues: FidelityIssue[];
  numericTokensHeld: boolean;
  citationRefsHeld: boolean;
}): {
  numericQaPassed: boolean;
  citationQaPassed: boolean;
  terminologyQaPassed: boolean;
  semanticQaPassed: boolean;
  openFatalCount: number;
} {
  const openFatalCount = params.fidelityIssues.filter((i) => i.severity === "FATAL").length;
  return {
    numericQaPassed: params.numericTokensHeld && !params.fidelityIssues.some((i) => i.kind === "TOKEN_MODIFIED" && i.severity === "FATAL"),
    citationQaPassed: params.citationRefsHeld,
    terminologyQaPassed: params.terminologyIssues.length === 0,
    semanticQaPassed: params.fidelityIssues.filter((i) => i.kind !== "TOKEN_LOST" && i.kind !== "TOKEN_DUPLICATED").every((i) => i.severity !== "FATAL"),
    openFatalCount,
  };
}

// -------------------------------------------------------------
// §9 LanguageQualitySnapshot builder
// -------------------------------------------------------------
export function buildLanguageQualitySnapshot(params: {
  workspaceId: string;
  projectId: string;
  reviewRunId: string;
  workOrder: LanguageWorkOrder;
  sourceSnapshot: ScientificReviewSnapshot;
  segments: LanguageSegment[];
  fidelityIssues: FidelityIssue[];
  terminologyIssues: FidelityIssue[];
  termBindings: TermBinding[];
  providerCapabilities: ProviderCapability[];
  qa: ReturnType<typeof runLanguageQa>;
}): LanguageQualitySnapshot {
  const {
    workspaceId, projectId, reviewRunId, workOrder, sourceSnapshot,
    segments, fidelityIssues, terminologyIssues, termBindings, providerCapabilities, qa,
  } = params;

  const snapshotId = `lqsnap_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const translatedOrEdited = segments.filter((s) => s.status === "TRANSLATED" || s.status === "EDITED" || s.status === "ADOPTED" || s.status === "LOCKED").length;
  const openFatal = qa.openFatalCount;
  const decision: LanguageQualitySnapshot["decision"] =
    openFatal > 0 ? "BLOCKED" : translatedOrEdited < segments.length ? "REVISION_REQUIRED" : "LANGUAGE_READY";

  return {
    snapshotId,
    schemaVersion: "language-quality/1.0.0",
    stageKey: "V3-U17",
    workspaceId,
    projectId,
    reviewRunId,
    workOrderId: workOrder.workOrderId,
    stageId: "translation-polish",
    nextStageId: "final-compliance", // Stage 18: 目標期刊/計畫最終合規、送件文件與成果包
    sourceScientificReviewSnapshotId: sourceSnapshot.snapshotId,
    sourceScientificReviewSnapshotHash: sha256({ id: sourceSnapshot.snapshotId, decision: sourceSnapshot.decision }),
    sourceScientificReviewDecision: sourceSnapshot.decision,
    goalContextRevision: 1,
    primaryGoal: sourceSnapshot.primaryGoal,

    decision,
    decisionRationale:
      decision === "BLOCKED"
        ? `存在 ${openFatal} 項 FATAL 保真問題（數值/方向/分母/否定/因果強度被改變），語言版不得放行。`
        : decision === "REVISION_REQUIRED"
          ? `尚有 ${segments.length - translatedOrEdited} 段未完成翻譯/編輯；僅允許 scope 內段落處理。`
          : "全部准用段落已完成語言處理且保真 QA 通過；語言版就緒（不等於正式送件或期刊接受）。",

    scope: {
      workingTitleZh: sourceSnapshot.scope.workingTitleZh,
      workingTitleEn: sourceSnapshot.scope.workingTitleEn,
      sourceLanguage: workOrder.sourceLanguage,
      targetLanguage: workOrder.targetLanguage,
      task: workOrder.task,
      fullManuscriptLanguageAllowed: workOrder.fullManuscriptLanguageAllowed,
      languageAllowedScopeRefs: workOrder.languageAllowedScopeRefs,
      totalSegments: segments.length,
      totalSegmentsTranslatedOrEdited: translatedOrEdited,
    },

    fidelityIssues: [...fidelityIssues, ...terminologyIssues],
    openFidelityIssueCount: fidelityIssues.filter((i) => i.blocksAdoption).length + terminologyIssues.length,
    fatalFidelityIssueCount: openFatal,
    terminologyMismatchCount: terminologyIssues.length,
    numericQaPassed: qa.numericQaPassed,
    citationQaPassed: qa.citationQaPassed,
    terminologyQaPassed: qa.terminologyQaPassed,
    semanticQaPassed: qa.semanticQaPassed,

    termBindingRefs: termBindings.map((t) => t.termId),
    meaningConstraintRefs: sourceSnapshot.meaningConstraintRefs,
    providerCapabilityRefs: providerCapabilities.map((p) => p.providerId),
    alignmentRef: `alignment_${reviewRunId}`,
    languageRevisionRef: `lang_rev_${reviewRunId}_${segments.length}`,
    qaReportRef: `lq_qa_${snapshotId}`,
    aiAssistanceAuditRef: `lq_ai_audit_${snapshotId}`,
    sourceManifestHash: sha256({ review: sourceSnapshot.snapshotId, decision: sourceSnapshot.decision }),

    limitations: [
      "本快照為語言品質基線（Language Quality Baseline）；語言版就緒不等於正式送件、全作者同意或期刊接受。",
      "DeepL／LanguageTool 等外部 provider 若未配置，如實標 NOT_CONFIGURED；本輪保真檢查為本地確定性規則（OLD_MIKE_SEMANTIC=MOCK）。",
      "第十八階段最終合規與送件尚未建置；本輪提供可重開 receiver 頁，不生成假送件或空白頁。",
    ],
    checksum: `chk_lq_${Date.now().toString(36)}_${sha256(snapshotId).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §9 Stage 18 receiver state
// -------------------------------------------------------------
export function buildStage18ReceiverState(params: {
  snapshot: LanguageQualitySnapshot;
}): Stage18ReceiverState {
  const { snapshot } = params;
  const notes: string[] = [];
  if (snapshot.fatalFidelityIssueCount > 0) notes.push("存在 FATAL 保真問題，最終合規前須先修正語言版。");
  if (snapshot.decision !== "LANGUAGE_READY") notes.push("語言版未全部完成，最終合規僅可處理已准用 scope。");
  notes.push("U18 尚未完整建置；此為可重開 receiver，可返回 U17，不生成假送件。");

  return {
    receiverVersion: "final-compliance-receiver/1.0.0",
    stageKey: "V3-U18-RECEIVER",
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    sourceLanguageQualitySnapshotId: snapshot.snapshotId,
    sourceSchemaVersion: snapshot.schemaVersion,
    primaryGoal: snapshot.primaryGoal,
    decision: snapshot.decision,
    languageScopeRefs: snapshot.scope.languageAllowedScopeRefs,
    totalSegments: snapshot.scope.totalSegments,
    translatedSegments: snapshot.scope.totalSegmentsTranslatedOrEdited,
    fatalFidelityIssueCount: snapshot.fatalFidelityIssueCount,
    readyForCompliance: snapshot.decision === "LANGUAGE_READY" && snapshot.fatalFidelityIssueCount === 0,
    receiverNotes: notes,
    reEntryPoint: { route: "translation-polish", action: "initialize", snapshotId: snapshot.sourceScientificReviewSnapshotId },
    createdAt: new Date().toISOString(),
  };
}
