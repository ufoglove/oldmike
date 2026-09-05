import "server-only";

import { Buffer } from "node:buffer";

import {
  V2_ALPHA6_MANUSCRIPT_SECTION_KEYS,
  type V2Alpha6ManuscriptSectionKey,
} from "../v2-alpha6/contracts.ts";
import { createSyntheticAlpha6PastedRequest, createSyntheticAlpha6Workspace } from "../v2-alpha6/runtime.ts";
import { createAlpha7R1SemanticRevisionAlternatives } from "../v2-alpha7-r1/semantic-revision.ts";
import {
  V2_ALPHA7_CONTRACT_VERSION,
  V2_ALPHA7_EDITORIAL_RECOMMENDATIONS,
  V2_ALPHA7_ENTRY_MODES,
  V2_ALPHA7_MAX_PASTED_BYTES,
  V2_ALPHA7_MAX_REVIEWER_COMMENTS,
  V2_ALPHA7_PURPOSE_MODES,
  V2_ALPHA7_RESPONSE_DECISIONS,
  V2_ALPHA7_REVIEW_LENSES,
  V2_ALPHA7_SEVERITIES,
  alpha7Hash,
  validateAlpha7Workspace,
  type V2Alpha7EditorialRecommendation,
  type V2Alpha7Finding,
  type V2Alpha7LensReport,
  type V2Alpha7PurposeMode,
  type V2Alpha7ResponseItem,
  type V2Alpha7ReviewerComment,
  type V2Alpha7Source,
  type V2Alpha7SourceSection,
  type V2Alpha7StudioRequest,
  type V2Alpha7Workspace,
} from "./contracts.ts";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function text(value: unknown, code: string, minimum: number, maximum: number, preserveBytes = false) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = preserveBytes ? value : value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.trim().length < minimum || Buffer.byteLength(normalized, "utf8") > maximum) throw new Error(code);
  return normalized;
}

function exactHash(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

function exactKeys(value: UnknownRecord, keys: readonly string[], code: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
}

function parseSection(value: unknown): V2Alpha7SourceSection {
  const input = record(value, "alpha7_source_section_invalid");
  exactKeys(input, ["key", "text", "sectionHash"], "alpha7_source_section_shape_invalid");
  if (!V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.includes(input.key as V2Alpha6ManuscriptSectionKey)) throw new Error("alpha7_source_section_key_invalid");
  const sectionText = text(input.text, "alpha7_source_section_text_invalid", 1, V2_ALPHA7_MAX_PASTED_BYTES, true);
  const sectionHash = exactHash(input.sectionHash, "alpha7_source_section_hash_invalid");
  if (alpha7Hash(sectionText) !== sectionHash) throw new Error("alpha7_source_section_hash_mismatch");
  return { key: input.key as V2Alpha6ManuscriptSectionKey, text: sectionText, sectionHash };
}

function parseSource(value: unknown): V2Alpha7Source {
  const input = record(value, "alpha7_source_invalid");
  exactKeys(input, ["kind", "sourceHash", "manuscriptHash", "sourcePreserved", "sections"], "alpha7_source_shape_invalid");
  if (!V2_ALPHA7_ENTRY_MODES.includes(input.kind as V2Alpha7Source["kind"]) || input.sourcePreserved !== true) throw new Error("alpha7_source_authority_invalid");
  const sections = Array.isArray(input.sections) ? input.sections.map(parseSection) : [];
  if (sections.length < 1 || sections.length > V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.length || new Set(sections.map((item) => item.key)).size !== sections.length) throw new Error("alpha7_source_sections_invalid");
  const sourceHash = exactHash(input.sourceHash, "alpha7_source_hash_invalid");
  const manuscriptHash = input.manuscriptHash === null ? null : exactHash(input.manuscriptHash, "alpha7_manuscript_hash_invalid");
  if (input.kind === "ALPHA6_MANUSCRIPT" && (!manuscriptHash || sections.length !== 13)) throw new Error("alpha7_alpha6_binding_invalid");
  if (input.kind === "PASTED_MANUSCRIPT" && manuscriptHash !== null) throw new Error("alpha7_pasted_binding_invalid");
  if (alpha7Hash({ kind: input.kind, manuscriptHash, sections }) !== sourceHash) throw new Error("alpha7_source_hash_mismatch");
  return { kind: input.kind as V2Alpha7Source["kind"], sourceHash, manuscriptHash, sourcePreserved: true, sections };
}

function parseReviewerComment(value: unknown): V2Alpha7ReviewerComment {
  const input = record(value, "alpha7_reviewer_comment_invalid");
  exactKeys(input, ["commentId", "text", "sourceSection"], "alpha7_reviewer_comment_shape_invalid");
  if (!V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.includes(input.sourceSection as V2Alpha6ManuscriptSectionKey)) throw new Error("alpha7_reviewer_comment_section_invalid");
  return {
    commentId: text(input.commentId, "alpha7_reviewer_comment_id_invalid", 1, 120),
    text: text(input.text, "alpha7_reviewer_comment_text_invalid", 4, 2_000),
    sourceSection: input.sourceSection as V2Alpha6ManuscriptSectionKey,
  };
}

export function parseAlpha7StudioRequest(value: unknown): V2Alpha7StudioRequest {
  const input = record(value, "alpha7_request_invalid");
  exactKeys(input, ["contractVersion", "requestId", "purpose", "source", "reviewerComments"], "alpha7_request_shape_invalid");
  if (input.contractVersion !== V2_ALPHA7_CONTRACT_VERSION || !V2_ALPHA7_PURPOSE_MODES.includes(input.purpose as V2Alpha7PurposeMode)) throw new Error("alpha7_request_authority_invalid");
  const requestId = text(input.requestId, "alpha7_request_id_invalid", 8, 160);
  if (!/^[A-Za-z0-9._:-]+$/u.test(requestId)) throw new Error("alpha7_request_id_invalid");
  const reviewerComments = Array.isArray(input.reviewerComments) ? input.reviewerComments.map(parseReviewerComment) : [];
  if (reviewerComments.length > V2_ALPHA7_MAX_REVIEWER_COMMENTS || new Set(reviewerComments.map((item) => item.commentId)).size !== reviewerComments.length) throw new Error("alpha7_reviewer_comments_invalid");
  const purpose = input.purpose as V2Alpha7PurposeMode;
  if (purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE" ? reviewerComments.length < 1 : reviewerComments.length !== 0) throw new Error("alpha7_reviewer_comment_mode_invalid");
  return { contractVersion: V2_ALPHA7_CONTRACT_VERSION, requestId, purpose, source: parseSource(input.source), reviewerComments };
}

function sectionsFromAlpha6(): V2Alpha7Source {
  const alpha6 = createSyntheticAlpha6Workspace(createSyntheticAlpha6PastedRequest("alpha7-alpha6-source-001"));
  const sections = V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.map((key) => ({ key, text: alpha6.manuscript.sections[key].text, sectionHash: alpha7Hash(alpha6.manuscript.sections[key].text) }));
  return {
    kind: "ALPHA6_MANUSCRIPT",
    manuscriptHash: alpha6.manuscript.manuscriptHash,
    sourcePreserved: true,
    sections,
    sourceHash: alpha7Hash({ kind: "ALPHA6_MANUSCRIPT", manuscriptHash: alpha6.manuscript.manuscriptHash, sections }),
  };
}

function pastedSource(sourceText: string): V2Alpha7Source {
  const preserved = text(sourceText, "alpha7_pasted_text_invalid", 20, V2_ALPHA7_MAX_PASTED_BYTES, true);
  const sections: V2Alpha7SourceSection[] = [{ key: "introduction", text: preserved, sectionHash: alpha7Hash(preserved) }];
  return { kind: "PASTED_MANUSCRIPT", manuscriptHash: null, sourcePreserved: true, sections, sourceHash: alpha7Hash({ kind: "PASTED_MANUSCRIPT", manuscriptHash: null, sections }) };
}

const DEFAULT_PASTED_SOURCE = "Evidence calibration may improve teacher decisions in two documented stages [7]. The proposed comparison uses 36 classrooms and reports uncertainty rather than claiming a verified effect. Method, ethics, and data-sharing details remain incomplete.";

export function createSyntheticAlpha7Request(requestId: string, purpose: V2Alpha7PurposeMode = "AUTHOR_PRE_SUBMISSION_REVIEW", options: { entryMode?: "ALPHA6_MANUSCRIPT" | "PASTED_MANUSCRIPT"; sourceText?: string } = {}): V2Alpha7StudioRequest {
  const source = options.entryMode === "PASTED_MANUSCRIPT" ? pastedSource(options.sourceText ?? DEFAULT_PASTED_SOURCE) : sectionsFromAlpha6();
  const reviewerComments: V2Alpha7ReviewerComment[] = purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE" ? [
    { commentId: "R1-C1", text: "Clarify how the comparison isolates the proposed mechanism.", sourceSection: source.sections.some((item) => item.key === "methods") ? "methods" : source.sections[0].key },
    { commentId: "R1-C2", text: "Temper the contribution claim until independent evidence is available.", sourceSection: source.sections.some((item) => item.key === "discussion") ? "discussion" : source.sections[0].key },
    { commentId: "R1-C3", text: "Explain why an additional unsupported subgroup analysis is not adopted.", sourceSection: source.sections.some((item) => item.key === "limitations") ? "limitations" : source.sections[0].key },
  ] : [];
  return { contractVersion: V2_ALPHA7_CONTRACT_VERSION, requestId, purpose, source, reviewerComments };
}

const lensPlan = [
  { lens: "EDITORIAL_CONTRIBUTION", severity: "MAJOR", claimState: "UNVERIFIED", preferred: "introduction", problem: "核心貢獻與既有證據的差異尚未被一句話界定。", impact: "編輯可能無法快速判斷稿件的學術增量。", evidence: "需以可核對文獻定位差異；目前僅標記為待驗證。", action: "在不新增事實下，先分開問題、已知證據與待驗證貢獻。" },
  { lens: "THEORY_ARGUMENT", severity: "MAJOR", claimState: "ASSUMPTION", preferred: "literatureReviewOrTheoreticalFramework", problem: "機制敘述與可觀察結果之間仍有推論跳躍。", impact: "論證鏈可能被誤讀為已驗證因果關係。", evidence: "需補入可反駁的機制證據；現階段維持假設。", action: "把機制、競爭解釋與失效條件並列。" },
  { lens: "METHOD_RIGOR", severity: "CRITICAL", claimState: "MISSING", preferred: "methods", problem: "抽樣、測量與分析決策缺少可重現的判定細節。", impact: "讀者無法評估偏誤與推論邊界。", evidence: "需補齊實際樣本、工具效度與分析規則，禁止代填。", action: "以缺值清單標記待研究者確認的設計參數。" },
  { lens: "EVIDENCE_ANALYSIS", severity: "MAJOR", claimState: "UNVERIFIED", preferred: "resultsOrPlannedResults", problem: "結果敘事尚未與可驗證資料產物逐項綁定。", impact: "未完成分析可能被誤認為研究發現。", evidence: "需以資料與分析產物驗證；目前只能陳述規劃。", action: "明確區分已觀察、未驗證與規劃結果。" },
  { lens: "CLARITY_ETHICS_REPORTING", severity: "STRENGTH", claimState: "VERIFIED", preferred: "declarations", problem: "目前已清楚保留不確定性，但倫理與資料聲明仍可更集中。", impact: "保留此優點可降低過度宣稱並改善可讀性。", evidence: "僅保留稿件內已有的限制與聲明，不推定外部核准。", action: "保留審慎語氣並將既有聲明集中呈現。" },
] as const;

function sectionFor(source: V2Alpha7Source, preferred: V2Alpha6ManuscriptSectionKey) {
  return source.sections.find((item) => item.key === preferred) ?? source.sections[0];
}

function createFinding(source: V2Alpha7Source, plan: (typeof lensPlan)[number], priority: number): V2Alpha7Finding {
  const preferred = plan.preferred as V2Alpha6ManuscriptSectionKey;
  const section = sectionFor(source, preferred);
  const startOffset = 0;
  const endOffset = Math.min(section.text.length, Math.max(1, section.text.indexOf("。") + 1 || section.text.indexOf(".") + 1 || 160));
  const sourceSpan = section.text.slice(startOffset, endOffset);
  const sourceSpanHash = alpha7Hash(sourceSpan);
  const findingId = `A7-${priority + 1}-${alpha7Hash({ lens: plan.lens, section: section.key, sourceSpan }).slice(0, 12)}`;
  const options = createAlpha7R1SemanticRevisionAlternatives({ findingId, lens: plan.lens, sourceSpan, sourceSpanHash });
  return {
    findingId,
    lens: plan.lens,
    severity: plan.severity,
    claimState: plan.claimState,
    sectionKey: section.key,
    startOffset,
    endOffset,
    sourceSpan,
    sourceSpanHash,
    problem: plan.problem,
    impact: plan.impact,
    requiredEvidence: plan.evidence,
    action: plan.action,
    alternatives: options,
    recommendedAlternativeId: options.find((item) => item.recommended)!.alternativeId,
  };
}

function createLensReports(source: V2Alpha7Source): V2Alpha7LensReport[] {
  return lensPlan.map((plan, index) => {
    const finding = createFinding(source, plan, index);
    const core = { lens: plan.lens, independent: true as const, sourceHash: source.sourceHash, strengths: plan.severity === "STRENGTH" ? ["稿件已顯式保留不確定性與限制。"] : ["來源文字可建立精確 section/span 綁定。"], findings: [finding] };
    return { ...core, reportHash: alpha7Hash(core) };
  });
}

function createResponseMatrix(request: V2Alpha7StudioRequest, findings: V2Alpha7Finding[]): V2Alpha7ResponseItem[] {
  if (request.purpose !== "AUTHOR_REVISION_AND_REVIEWER_RESPONSE") return [];
  return request.reviewerComments.map((comment, index) => {
    const finding = findings[index % findings.length];
    const decision = V2_ALPHA7_RESPONSE_DECISIONS[index % V2_ALPHA7_RESPONSE_DECISIONS.length];
    const recommendation = finding.alternatives.find((item) => item.recommended)!;
    const responseText = decision === "ACCEPT"
      ? `已依意見在「${finding.sectionKey}」重組論證，並保留未驗證界線。`
      : decision === "PARTIAL"
        ? `部分採納：已改善「${finding.sectionKey}」的可檢查性；其餘部分等待所需證據後再處理。`
        : `未採納新增分析，因現有資料與設計不足以支持；已在「${finding.sectionKey}」明示此限制。`;
    return {
      commentId: comment.commentId,
      interpretation: `意見要求：${comment.text}`,
      decision,
      revisionLocation: finding.sectionKey,
      before: finding.sourceSpan,
      after: recommendation.revision,
      evidence: decision === "DECLINE" ? finding.requiredEvidence : `來源 span ${finding.sourceSpanHash.slice(0, 12)} 與修訂選項綁定。`,
      responseText,
      unresolvedRisk: decision === "ACCEPT" ? "仍需作者核對語意與證據來源。" : finding.requiredEvidence,
    };
  });
}

function severityRank(value: V2Alpha7Finding["severity"]) {
  return { CRITICAL: 0, MAJOR: 1, MINOR: 2, STRENGTH: 3 }[value];
}

export function createSyntheticAlpha7Workspace(raw: V2Alpha7StudioRequest): V2Alpha7Workspace {
  const request = parseAlpha7StudioRequest(raw);
  const lensReports = createLensReports(request.source);
  const prioritizedFindings = lensReports.flatMap((report) => report.findings).sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
  const citationAudit = [{ citationId: "source-citation-1", existence: "UNKNOWN" as const, metadata: "UNKNOWN" as const, context: "UNKNOWN" as const, authority: "INDEPENDENT_VERIFICATION_REQUIRED" as const }];
  const responseMatrix = createResponseMatrix(request, prioritizedFindings);
  const editorialRecommendation: V2Alpha7EditorialRecommendation = request.purpose === "INDEPENDENT_REVIEWER_MODE" ? "MAJOR" : prioritizedFindings.some((item) => item.severity === "CRITICAL") ? "MAJOR" : "MINOR";
  if (!V2_ALPHA7_EDITORIAL_RECOMMENDATIONS.includes(editorialRecommendation) || V2_ALPHA7_SEVERITIES.length !== 4 || V2_ALPHA7_REVIEW_LENSES.length !== 5) throw new Error("alpha7_enum_authority_invalid");
  const reviewerReport = request.purpose === "INDEPENDENT_REVIEWER_MODE" ? {
    readOnly: true as const,
    strengths: lensReports.flatMap((report) => report.strengths),
    majorConcerns: prioritizedFindings.filter((item) => item.severity === "CRITICAL" || item.severity === "MAJOR").map((item) => item.problem),
    minorConcerns: prioritizedFindings.filter((item) => item.severity === "MINOR").map((item) => item.problem),
    methodQuestions: ["方法參數與分析規則是否已有可核對的研究紀錄？"],
    ethicsReportingQuestions: ["倫理、資料可用性與作者聲明是否已有正式依據？"],
    editorialRecommendation,
    journalDecisionClaimed: false as const,
  } : null;
  const core = { sourceHash: request.source.sourceHash, purpose: request.purpose, findings: prioritizedFindings.map((item) => item.findingId) };
  return validateAlpha7Workspace({
    contractVersion: V2_ALPHA7_CONTRACT_VERSION,
    purpose: request.purpose,
    sourceHash: request.source.sourceHash,
    originalArtifactImmutable: true,
    sourceSections: request.source.sections,
    lensReports,
    prioritizedFindings,
    citationAudit,
    responseMatrix,
    reviewerReport,
    editorialRecommendation,
    canApplyAuthorRevision: request.purpose !== "INDEPENDENT_REVIEWER_MODE",
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: alpha7Hash(core) },
    providerSubmissionCount: 1,
    formalResearchWriteCount: 0,
    externalSubmissionEnabled: false,
    externalMutationCount: 0,
  });
}

type CoordinatorInput = V2Alpha7StudioRequest & { scope: string };

export function createV2Alpha7Coordinator(generate: (request: V2Alpha7StudioRequest) => Promise<V2Alpha7Workspace> = async (request) => createSyntheticAlpha7Workspace(request)) {
  const settled = new Map<string, { requestHash: string; result: V2Alpha7Workspace }>();
  const pending = new Map<string, { requestHash: string; promise: Promise<V2Alpha7Workspace> }>();
  const uncertain = new Map<string, string>();
  return {
    async run(raw: CoordinatorInput) {
      const { scope: rawScope, ...requestValue } = raw;
      const request = parseAlpha7StudioRequest(requestValue);
      const scope = text(rawScope, "alpha7_scope_invalid", 3, 300);
      const key = `${scope}:${request.requestId}`;
      const requestHash = alpha7Hash(request);
      const priorUnknown = uncertain.get(key);
      if (priorUnknown) {
        if (priorUnknown !== requestHash) throw new Error("alpha7_idempotency_conflict");
        throw new Error("alpha7_completion_unknown_no_resend");
      }
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("alpha7_idempotency_conflict");
        return { result: prior.result, replayed: true };
      }
      const active = pending.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("alpha7_idempotency_conflict");
        return { result: await active.promise, replayed: true };
      }
      const promise = generate(request);
      pending.set(key, { requestHash, promise });
      try {
        const result = await promise;
        settled.set(key, { requestHash, result });
        return { result, replayed: false };
      } catch (error) {
        if (error instanceof Error && (error.message === "alpha7_completion_unknown" || error.message === "alpha7_completion_unknown_no_resend")) uncertain.set(key, requestHash);
        throw error;
      } finally {
        pending.delete(key);
      }
    },
  };
}

export const V2_ALPHA7_RUNTIME_BOUNDARY = Object.freeze({
  transport: "LOCAL_SYNTHETIC_FIXTURE_ONLY",
  sourceArtifact: "IMMUTABLE_HASH_BOUND",
  authorRevision: "LOCAL_PREVIEW_APPLY_UNDO_ONLY",
  independentReviewer: "READ_ONLY",
  externalFacts: "UNKNOWN_UNLESS_CURRENT_OFFICIAL_AUTHORITY",
  citationAudit: "EXISTENCE_METADATA_CONTEXT_INDEPENDENT",
  modelOverride: "NONE",
  formalWriteCount: 0,
  externalSubmission: "DISABLED",
});
