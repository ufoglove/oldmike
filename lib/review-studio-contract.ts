import { createHash } from "node:crypto";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const REVIEW_STUDIO_CONTRACT_VERSION = "review-studio/1.0.0";
export const REVIEW_STUDIO_MAX_BODY_BYTES = 65_536;
export const REVIEW_STUDIO_MAX_TEXT_BYTES = 48_000;
export const REVIEW_STUDIO_MAX_PARAGRAPH_BYTES = 6_000;
export const REVIEW_STUDIO_MAX_PARAGRAPHS = 60;
export const REVIEW_STUDIO_MAX_REVISION_LOOPS = 2;

export const reviewLenses = [
  "ARGUMENT_STRUCTURE",
  "METHOD",
  "EVIDENCE_CLAIM_SUPPORT",
  "CLARITY",
  "TERMINOLOGY",
  "JOURNAL_FIT",
  "ETHICS_REPRODUCIBILITY",
] as const;
export const reviewSeverities = ["P0", "P1", "P2"] as const;
export const reviewStages = ["REVIEW", "RE_REVIEW"] as const;
export const reviewDecisionActions = ["ACCEPT", "EDIT", "REJECT"] as const;

export type ReviewLens = (typeof reviewLenses)[number];
export type ReviewSeverity = (typeof reviewSeverities)[number];
export type ReviewStage = (typeof reviewStages)[number];
export type ReviewDecisionAction = (typeof reviewDecisionActions)[number];

export type ReviewMethodParameters = {
  preserveCitations: true;
  preserveNumbers: true;
  preserveUnits: true;
  preserveFormulas: true;
  preserveParagraphIdentity: true;
  explainRecommendations: true;
  prohibitInventedEvidence: true;
};

export type ReviewSource =
  | { kind: "PASTED_TEXT"; text: string }
  | { kind: "DOCUMENT_VERSION"; documentVersionId: string; contentHash: string };

export type RunReviewRequest = {
  operation: "RUN_REVIEW";
  idempotencyKey: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  stage: ReviewStage;
  cycle: number;
  previousReviewDocumentVersionId: string | null;
  source: ReviewSource;
  lenses: ReviewLens[];
  journalProfile: string;
  methodParameters: ReviewMethodParameters;
  modeProfile: ModelModeProfile;
};

export type ReviewDecision = {
  findingId: string;
  action: ReviewDecisionAction;
  editedText: string | null;
};

export type SaveRevisionRequest = {
  operation: "SAVE_REVISION";
  idempotencyKey: string;
  reviewDocumentVersionId: string;
  reviewContentHash: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  decisions: ReviewDecision[];
};

export type ApproveReviewDocumentRequest = {
  operation: "APPROVE_DOCUMENT";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  reviewDocumentVersionId: string;
  reviewContentHash: string;
  rationale: string;
};

export type PromoteReviewDocumentRequest = {
  operation: "PROMOTE_DOCUMENT";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  humanGateId: string;
  targetLogicalId: string;
  expectedVersion: number;
  title: string;
};

export type ReviewStudioRequest = RunReviewRequest | SaveRevisionRequest | ApproveReviewDocumentRequest | PromoteReviewDocumentRequest;

export type ResolvedRunReviewRequest = RunReviewRequest & {
  sourceText: string;
  sourceDocumentVersionId: string | null;
  sourceContentHash: string;
};

export type ReviewFinding = {
  findingId: string;
  lens: ReviewLens;
  severity: ReviewSeverity;
  paragraphId: string;
  startOffset: number;
  endOffset: number;
  sourceSpanHash: string;
  suggestedRevision: string;
  rationale: string;
  risk: string;
  uncertainty: string;
  action: string;
};

export type ReviewProviderResult = {
  contractVersion: typeof REVIEW_STUDIO_CONTRACT_VERSION;
  status: "SUCCESS";
  cycle: number;
  qualityDelta: number;
  lenses: ReviewLens[];
  findings: ReviewFinding[];
  uncertainties: string[];
};

export class ReviewStudioContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "ReviewStudioContractError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedText(value: unknown, code: string, max: number, min = 1) {
  if (typeof value !== "string") throw new ReviewStudioContractError(code);
  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.trim().length < min || Buffer.byteLength(normalized, "utf8") > max || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new ReviewStudioContractError(code);
  }
  return normalized;
}

function identifier(value: unknown, code: string) {
  if (typeof value !== "string" || value.length < 8 || value.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new ReviewStudioContractError(code);
  return value;
}

function hash(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new ReviewStudioContractError(code);
  return value;
}

function integer(value: unknown, code: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new ReviewStudioContractError(code);
  return Number(value);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new ReviewStudioContractError(code);
  return value as T;
}

function parseMethodParameters(value: unknown): ReviewMethodParameters {
  const row = record(value);
  const keys = ["preserveCitations", "preserveNumbers", "preserveUnits", "preserveFormulas", "preserveParagraphIdentity", "explainRecommendations", "prohibitInventedEvidence"];
  if (!row || !exactKeys(row, keys) || keys.some((key) => row[key] !== true)) throw new ReviewStudioContractError("unsafe_method_parameters");
  return { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, preserveParagraphIdentity: true, explainRecommendations: true, prohibitInventedEvidence: true };
}

function parseSource(value: unknown): ReviewSource {
  const row = record(value);
  if (!row || typeof row.kind !== "string") throw new ReviewStudioContractError("invalid_review_source");
  if (row.kind === "PASTED_TEXT") {
    if (!exactKeys(row, ["kind", "text"])) throw new ReviewStudioContractError("invalid_pasted_source_shape");
    const text = boundedText(row.text, "invalid_source_text", REVIEW_STUDIO_MAX_TEXT_BYTES);
    splitReviewParagraphs(text);
    return { kind: "PASTED_TEXT", text };
  }
  if (row.kind === "DOCUMENT_VERSION") {
    if (!exactKeys(row, ["kind", "documentVersionId", "contentHash"])) throw new ReviewStudioContractError("invalid_document_source_shape");
    return { kind: "DOCUMENT_VERSION", documentVersionId: identifier(row.documentVersionId, "invalid_document_version_id"), contentHash: hash(row.contentHash, "invalid_content_hash") };
  }
  throw new ReviewStudioContractError("invalid_review_source");
}

function parseLenses(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > reviewLenses.length) throw new ReviewStudioContractError("invalid_review_lenses");
  const parsed = value.map((item) => enumValue(item, reviewLenses, "invalid_review_lens"));
  if (new Set(parsed).size !== parsed.length) throw new ReviewStudioContractError("duplicate_review_lens");
  return parsed;
}

function parseDecision(value: unknown): ReviewDecision {
  const row = record(value);
  if (!row || !exactKeys(row, ["findingId", "action", "editedText"])) throw new ReviewStudioContractError("invalid_review_decision_shape");
  const action = enumValue(row.action, reviewDecisionActions, "invalid_review_decision_action");
  const editedText = row.editedText === null ? null : boundedText(row.editedText, "invalid_edited_text", 6_000, 0);
  if ((action === "EDIT") !== (editedText !== null)) throw new ReviewStudioContractError("invalid_review_decision_edit_binding");
  return { findingId: identifier(row.findingId, "invalid_finding_id"), action, editedText };
}

export function parseReviewStudioRequest(value: unknown): ReviewStudioRequest {
  const row = record(value);
  if (!row || typeof row.operation !== "string") throw new ReviewStudioContractError("invalid_review_studio_shape");
  if (row.operation === "RUN_REVIEW") {
    const keys = ["operation", "idempotencyKey", "logicalId", "expectedVersion", "title", "stage", "cycle", "previousReviewDocumentVersionId", "source", "lenses", "journalProfile", "methodParameters", "modeProfile"];
    if (!exactKeys(row, keys)) throw new ReviewStudioContractError("invalid_run_review_shape");
    const stage = enumValue(row.stage, reviewStages, "invalid_review_stage");
    const cycle = integer(row.cycle, "invalid_review_cycle", 0, REVIEW_STUDIO_MAX_REVISION_LOOPS);
    const previousReviewDocumentVersionId = row.previousReviewDocumentVersionId === null ? null : identifier(row.previousReviewDocumentVersionId, "invalid_previous_review_id");
    if ((stage === "REVIEW" && (cycle !== 0 || previousReviewDocumentVersionId !== null)) || (stage === "RE_REVIEW" && (cycle < 1 || previousReviewDocumentVersionId === null))) throw new ReviewStudioContractError("invalid_review_state_binding");
    const source = parseSource(row.source);
    if (stage === "RE_REVIEW" && source.kind !== "DOCUMENT_VERSION") throw new ReviewStudioContractError("re_review_requires_document_source");
    return {
      operation: "RUN_REVIEW",
      idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"),
      logicalId: identifier(row.logicalId, "invalid_logical_id"),
      expectedVersion: integer(row.expectedVersion, "invalid_expected_version", 0),
      title: boundedText(row.title, "invalid_title", 240),
      stage,
      cycle,
      previousReviewDocumentVersionId,
      source,
      modeProfile: parseModelModeProfile(row.modeProfile),
      lenses: parseLenses(row.lenses),
      journalProfile: boundedText(row.journalProfile, "invalid_journal_profile", 1_000),
      methodParameters: parseMethodParameters(row.methodParameters),
    };
  }
  if (row.operation === "SAVE_REVISION") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "reviewDocumentVersionId", "reviewContentHash", "logicalId", "expectedVersion", "title", "decisions"])) throw new ReviewStudioContractError("invalid_save_revision_shape");
    if (!Array.isArray(row.decisions) || row.decisions.length > 100) throw new ReviewStudioContractError("invalid_review_decisions");
    const decisions = row.decisions.map(parseDecision);
    if (new Set(decisions.map((item) => item.findingId)).size !== decisions.length) throw new ReviewStudioContractError("duplicate_review_decision");
    return { operation: "SAVE_REVISION", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), reviewDocumentVersionId: identifier(row.reviewDocumentVersionId, "invalid_review_document_id"), reviewContentHash: hash(row.reviewContentHash, "invalid_review_content_hash"), logicalId: identifier(row.logicalId, "invalid_logical_id"), expectedVersion: integer(row.expectedVersion, "invalid_expected_version", 0), title: boundedText(row.title, "invalid_title", 240), decisions };
  }
  if (row.operation === "APPROVE_DOCUMENT") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "reviewDocumentVersionId", "reviewContentHash", "rationale"])) throw new ReviewStudioContractError("invalid_review_approval_shape");
    return { operation: "APPROVE_DOCUMENT", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), documentVersionId: identifier(row.documentVersionId, "invalid_document_version_id"), contentHash: hash(row.contentHash, "invalid_content_hash"), reviewDocumentVersionId: identifier(row.reviewDocumentVersionId, "invalid_review_document_id"), reviewContentHash: hash(row.reviewContentHash, "invalid_review_content_hash"), rationale: boundedText(row.rationale, "invalid_rationale", 2_000, 8) };
  }
  if (row.operation === "PROMOTE_DOCUMENT") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "humanGateId", "targetLogicalId", "expectedVersion", "title"])) throw new ReviewStudioContractError("invalid_review_promotion_shape");
    return { operation: "PROMOTE_DOCUMENT", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), documentVersionId: identifier(row.documentVersionId, "invalid_document_version_id"), contentHash: hash(row.contentHash, "invalid_content_hash"), humanGateId: identifier(row.humanGateId, "invalid_human_gate_id"), targetLogicalId: identifier(row.targetLogicalId, "invalid_target_logical_id"), expectedVersion: integer(row.expectedVersion, "invalid_expected_version", 0), title: boundedText(row.title, "invalid_title", 240) };
  }
  throw new ReviewStudioContractError("unsupported_review_operation");
}

export function splitReviewParagraphs(sourceText: string) {
  const paragraphs = sourceText.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((text, index) => ({ paragraphId: `p-${String(index + 1).padStart(3, "0")}`, text: text.trim() })).filter((item) => item.text.length > 0);
  if (!paragraphs.length || paragraphs.length > REVIEW_STUDIO_MAX_PARAGRAPHS || paragraphs.some((item) => Buffer.byteLength(item.text, "utf8") > REVIEW_STUDIO_MAX_PARAGRAPH_BYTES)) throw new ReviewStudioContractError("review_paragraph_bounds_exceeded", 413);
  return paragraphs;
}

function parseFinding(value: unknown, request: ResolvedRunReviewRequest): ReviewFinding {
  const row = record(value);
  const keys = ["findingId", "lens", "severity", "paragraphId", "startOffset", "endOffset", "sourceSpanHash", "suggestedRevision", "rationale", "risk", "uncertainty", "action"];
  if (!row || !exactKeys(row, keys)) throw new ReviewStudioContractError("invalid_review_finding_shape", 502);
  if (typeof row.paragraphId !== "string" || !/^p-[0-9]{3}$/.test(row.paragraphId)) throw new ReviewStudioContractError("invalid_paragraph_id", 502);
  const paragraphId = row.paragraphId;
  const paragraph = splitReviewParagraphs(request.sourceText).find((item) => item.paragraphId === paragraphId);
  if (!paragraph) throw new ReviewStudioContractError("review_paragraph_binding_mismatch", 502);
  const startOffset = integer(row.startOffset, "invalid_start_offset", 0, paragraph.text.length);
  const endOffset = integer(row.endOffset, "invalid_end_offset", startOffset + 1, paragraph.text.length);
  const sourceSpanHash = hash(row.sourceSpanHash, "invalid_source_span_hash");
  if (sourceSpanHash !== reviewStudioHash(paragraph.text.slice(startOffset, endOffset))) throw new ReviewStudioContractError("source_span_hash_mismatch", 502);
  const lens = enumValue(row.lens, reviewLenses, "invalid_review_lens");
  if (!request.lenses.includes(lens)) throw new ReviewStudioContractError("unrequested_review_lens", 502);
  return {
    findingId: identifier(row.findingId, "invalid_finding_id"), lens,
    severity: enumValue(row.severity, reviewSeverities, "invalid_review_severity"), paragraphId, startOffset, endOffset, sourceSpanHash,
    suggestedRevision: boundedText(row.suggestedRevision, "invalid_suggested_revision", REVIEW_STUDIO_MAX_PARAGRAPH_BYTES, 0),
    rationale: boundedText(row.rationale, "invalid_review_rationale", 1_500), risk: boundedText(row.risk, "invalid_review_risk", 800),
    uncertainty: boundedText(row.uncertainty, "invalid_review_uncertainty", 800), action: boundedText(row.action, "invalid_review_action", 800),
  };
}

export function parseReviewProviderResult(value: unknown, request: ResolvedRunReviewRequest): ReviewProviderResult {
  const row = record(value);
  if (!row || !exactKeys(row, ["contractVersion", "status", "cycle", "qualityDelta", "lenses", "findings", "uncertainties"])) throw new ReviewStudioContractError("invalid_review_result_shape", 502);
  if (row.contractVersion !== REVIEW_STUDIO_CONTRACT_VERSION || row.status !== "SUCCESS" || row.cycle !== request.cycle) throw new ReviewStudioContractError("review_result_binding_mismatch", 502);
  const lenses = parseLenses(row.lenses);
  if (lenses.length !== request.lenses.length || lenses.some((item, index) => item !== request.lenses[index])) throw new ReviewStudioContractError("review_lenses_binding_mismatch", 502);
  if (!Array.isArray(row.findings) || row.findings.length > 100) throw new ReviewStudioContractError("invalid_review_findings", 502);
  const findings = row.findings.map((item) => parseFinding(item, request));
  if (new Set(findings.map((item) => item.findingId)).size !== findings.length) throw new ReviewStudioContractError("duplicate_review_finding", 502);
  const ranges = new Map<string, Array<[number, number]>>();
  for (const finding of findings) {
    const prior = ranges.get(finding.paragraphId) ?? [];
    if (prior.some(([start, end]) => finding.startOffset < end && finding.endOffset > start)) throw new ReviewStudioContractError("overlapping_review_findings", 502);
    prior.push([finding.startOffset, finding.endOffset]); ranges.set(finding.paragraphId, prior);
  }
  if (!Array.isArray(row.uncertainties) || row.uncertainties.length > 30) throw new ReviewStudioContractError("invalid_review_uncertainties", 502);
  return { contractVersion: REVIEW_STUDIO_CONTRACT_VERSION, status: "SUCCESS", cycle: request.cycle, qualityDelta: integer(row.qualityDelta, "invalid_quality_delta", 0, 100), lenses, findings, uncertainties: row.uncertainties.map((item) => boundedText(item, "invalid_review_uncertainty", 800)) };
}

function sortedMatches(value: string, patterns: RegExp[]) {
  return patterns.flatMap((pattern) => [...value.matchAll(pattern)].map((match) => match[0])).sort();
}

export function reviewPreservationFingerprint(value: string) {
  return {
    citations: sortedMatches(value, [/\[[0-9,;\u2013\u2014\-\s]+\]/g, /\([A-Z][A-Za-z'\-]+(?: et al\.)?,?\s+\d{4}[a-z]?\)/g]),
    numbers: sortedMatches(value, [/(?<![\p{L}\p{N}])[-+]?\d+(?:[.,]\d+)*(?:%|\u2030)?/gu]),
    units: sortedMatches(value, [/\b\d+(?:\.\d+)?\s?(?:mg|g|kg|mL|L|mm|cm|m|km|Hz|kHz|MHz|GB|MB|ms|s|min|h|days?)\b/gi]),
    formulas: sortedMatches(value, [/\$[^$\r\n]{1,300}\$/g, /\\\([^\r\n]{1,300}\\\)/g]),
  };
}

export function assertReviewPreservation(source: string, revised: string) {
  const left = reviewPreservationFingerprint(source);
  const right = reviewPreservationFingerprint(revised);
  for (const key of ["citations", "numbers", "units", "formulas"] as const) {
    if (left[key].length !== right[key].length || left[key].some((item, index) => item !== right[key][index])) throw new ReviewStudioContractError(`${key.slice(0, -1)}_preservation_failed`, 422);
  }
}

export function applyReviewDecisions(sourceText: string, findings: ReviewFinding[], decisions: ReviewDecision[]) {
  const byId = new Map(findings.map((item) => [item.findingId, item]));
  if (decisions.length !== findings.length || decisions.some((item) => !byId.has(item.findingId))) throw new ReviewStudioContractError("incomplete_review_decisions");
  const decisionById = new Map(decisions.map((item) => [item.findingId, item]));
  const revisedParagraphs = splitReviewParagraphs(sourceText).map((paragraph) => {
    const applicable = findings.filter((finding) => finding.paragraphId === paragraph.paragraphId).sort((a, b) => b.startOffset - a.startOffset);
    let revised = paragraph.text;
    for (const finding of applicable) {
      const decision = decisionById.get(finding.findingId)!;
      if (decision.action === "REJECT") continue;
      const replacement = decision.action === "EDIT" ? decision.editedText! : finding.suggestedRevision;
      revised = `${revised.slice(0, finding.startOffset)}${replacement}${revised.slice(finding.endOffset)}`;
    }
    return { paragraphId: paragraph.paragraphId, source: paragraph.text, revised };
  });
  const revisedText = revisedParagraphs.map((item) => item.revised).join("\n\n");
  assertReviewPreservation(sourceText, revisedText);
  return { revisedText, paragraphs: revisedParagraphs };
}

export function reviewEarlyStopEligible(result: ReviewProviderResult) {
  return result.qualityDelta < 3 && !result.findings.some((finding) => finding.severity === "P0");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function reviewStudioHash(value: unknown) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function reviewRequestHash(request: RunReviewRequest | SaveRevisionRequest) {
  if (request.operation === "RUN_REVIEW") {
    return reviewStudioHash({
      contractVersion: REVIEW_STUDIO_CONTRACT_VERSION,
      operation: request.operation,
      logicalId: request.logicalId,
      expectedVersion: request.expectedVersion,
      title: request.title,
      stage: request.stage,
      cycle: request.cycle,
      previousReviewDocumentVersionId: request.previousReviewDocumentVersionId,
      source: request.source,
      lenses: request.lenses,
      journalProfile: request.journalProfile,
      methodParameters: request.methodParameters,
    });
  }
  return reviewStudioHash({
    contractVersion: REVIEW_STUDIO_CONTRACT_VERSION,
    operation: request.operation,
    reviewDocumentVersionId: request.reviewDocumentVersionId,
    reviewContentHash: request.reviewContentHash,
    logicalId: request.logicalId,
    expectedVersion: request.expectedVersion,
    title: request.title,
    decisions: request.decisions,
  });
}
