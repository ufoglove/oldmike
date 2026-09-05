import { createHash } from "node:crypto";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const ACADEMIC_LANGUAGE_CONTRACT_VERSION = "academic-language/1.1.0";
export const ACADEMIC_LANGUAGE_MAX_BODY_BYTES = 65_536;
export const ACADEMIC_LANGUAGE_MAX_TEXT_BYTES = 48_000;
export const ACADEMIC_LANGUAGE_MAX_PARAGRAPH_BYTES = 6_000;
export const ACADEMIC_LANGUAGE_MAX_PARAGRAPHS = 60;

export const academicLanguageTasks = ["TRANSLATE_ZH_EN", "TRANSLATE_EN_ZH_TW", "EDIT_ACADEMIC_EN", "GRAMMAR_CHECK"] as const;
export const academicTonePresets = ["JOURNAL_CONCISE", "JOURNAL_FORMAL", "JOURNAL_INTERPRETIVE"] as const;
export const academicScopes = ["PARAGRAPH", "FULL_TEXT"] as const;
export const glossaryEntryKinds = ["FIXED_TRANSLATION", "ABBREVIATION"] as const;
export const changeKinds = ["TRANSLATION", "TERMINOLOGY", "CLARITY", "GRAMMAR", "TONE", "STRUCTURE"] as const;

export type AcademicLanguageTask = (typeof academicLanguageTasks)[number];
export type AcademicTonePreset = (typeof academicTonePresets)[number];
export type AcademicScope = (typeof academicScopes)[number];
export type GlossaryEntryKind = (typeof glossaryEntryKinds)[number];
export type AcademicChangeKind = (typeof changeKinds)[number];

export type GlossaryEntry = {
  sourceTerm: string;
  targetTerm: string;
  kind: GlossaryEntryKind;
  caseSensitive: boolean;
};

export type BannedTerm = { term: string; replacement: string };

export type AcademicMethodParameters = {
  preserveCitations: true;
  preserveNumbers: true;
  preserveUnits: true;
  preserveFormulas: true;
  explainChanges: true;
};

export type SaveGlossaryRequest = {
  operation: "SAVE_GLOSSARY";
  idempotencyKey: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  tonePreset: AcademicTonePreset;
  entries: GlossaryEntry[];
  bannedTerms: BannedTerm[];
};

export type TransformLanguageRequest = {
  operation: "TRANSFORM";
  idempotencyKey: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  task: AcademicLanguageTask;
  scope: AcademicScope;
  tonePreset: AcademicTonePreset;
  sourceText: string;
  glossaryVersionId: string | null;
  glossaryHash: string | null;
  methodParameters: AcademicMethodParameters;
  modeProfile: ModelModeProfile;
};

export type ScratchTransformLanguageRequest = {
  operation: "SCRATCH_TRANSFORM";
  idempotencyKey: string;
  task: AcademicLanguageTask;
  scope: "PARAGRAPH";
  tonePreset: AcademicTonePreset;
  sourceText: string;
  glossaryVersionId: string | null;
  glossaryHash: string | null;
  methodParameters: AcademicMethodParameters;
  modeProfile: ModelModeProfile;
};

export type LanguageTransformationRequest = TransformLanguageRequest | ScratchTransformLanguageRequest;

export type ApproveLanguageRequest = {
  operation: "APPROVE_DOCUMENT";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  rationale: string;
};

export type PromoteLanguageRequest = {
  operation: "PROMOTE_DOCUMENT";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  humanGateId: string;
  targetLogicalId: string;
  expectedVersion: number;
  title: string;
};

export type AcademicLanguageRequest = SaveGlossaryRequest | LanguageTransformationRequest | ApproveLanguageRequest | PromoteLanguageRequest;

export type AcademicChange = {
  kind: AcademicChangeKind;
  original: string;
  revised: string;
  reason: string;
};

export type AcademicParagraphResult = {
  index: number;
  source: string;
  revised: string;
  changes: AcademicChange[];
};

export type AcademicProviderResult = {
  contractVersion: typeof ACADEMIC_LANGUAGE_CONTRACT_VERSION;
  status: "SUCCESS";
  task: AcademicLanguageTask;
  tonePreset: AcademicTonePreset;
  paragraphs: AcademicParagraphResult[];
  uncertainties: string[];
};

export class AcademicLanguageContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "AcademicLanguageContractError";
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
  if (typeof value !== "string") throw new AcademicLanguageContractError(code);
  const normalized = value.replace(/\r\n?/g, "\n");
  const bytes = Buffer.byteLength(normalized, "utf8");
  if (normalized.trim().length < min || bytes > max || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) throw new AcademicLanguageContractError(code);
  return normalized;
}

function identifier(value: unknown, code: string) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new AcademicLanguageContractError(code);
  return value;
}

function hash(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new AcademicLanguageContractError(code);
  return value;
}

function nonNegativeInteger(value: unknown, code: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AcademicLanguageContractError(code);
  return Number(value);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new AcademicLanguageContractError(code);
  return value as T;
}

function uniqueStrings(values: string[], code: string) {
  if (new Set(values.map((value) => value.toLocaleLowerCase("en-US"))).size !== values.length) throw new AcademicLanguageContractError(code);
}

function parseGlossaryEntries(value: unknown) {
  if (!Array.isArray(value) || value.length > 200) throw new AcademicLanguageContractError("invalid_glossary_entries");
  const entries = value.map((item) => {
    const row = record(item);
    if (!row || !exactKeys(row, ["sourceTerm", "targetTerm", "kind", "caseSensitive"])) throw new AcademicLanguageContractError("invalid_glossary_entry_shape");
    if (typeof row.caseSensitive !== "boolean") throw new AcademicLanguageContractError("invalid_glossary_case_policy");
    return {
      sourceTerm: boundedText(row.sourceTerm, "invalid_glossary_source", 300),
      targetTerm: boundedText(row.targetTerm, "invalid_glossary_target", 300),
      kind: enumValue(row.kind, glossaryEntryKinds, "invalid_glossary_kind"),
      caseSensitive: row.caseSensitive,
    };
  });
  uniqueStrings(entries.map((entry) => `${entry.kind}:${entry.sourceTerm}`), "duplicate_glossary_entry");
  return entries;
}

function parseBannedTerms(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new AcademicLanguageContractError("invalid_banned_terms");
  const terms = value.map((item) => {
    const row = record(item);
    if (!row || !exactKeys(row, ["term", "replacement"])) throw new AcademicLanguageContractError("invalid_banned_term_shape");
    return { term: boundedText(row.term, "invalid_banned_term", 300), replacement: boundedText(row.replacement, "invalid_banned_replacement", 300) };
  });
  uniqueStrings(terms.map((item) => item.term), "duplicate_banned_term");
  return terms;
}

function parseMethodParameters(value: unknown): AcademicMethodParameters {
  const row = record(value);
  const keys = ["preserveCitations", "preserveNumbers", "preserveUnits", "preserveFormulas", "explainChanges"];
  if (!row || !exactKeys(row, keys) || keys.some((key) => row[key] !== true)) throw new AcademicLanguageContractError("unsafe_method_parameters");
  return { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, explainChanges: true };
}

function validateSourceText(value: unknown, scope: AcademicScope) {
  const sourceText = boundedText(value, "invalid_source_text", ACADEMIC_LANGUAGE_MAX_TEXT_BYTES);
  const paragraphs = splitAcademicParagraphs(sourceText);
  if (scope === "PARAGRAPH" && paragraphs.length !== 1) throw new AcademicLanguageContractError("paragraph_scope_requires_one_paragraph");
  return sourceText;
}

export function parseAcademicLanguageRequest(value: unknown): AcademicLanguageRequest {
  const row = record(value);
  if (!row || typeof row.operation !== "string") throw new AcademicLanguageContractError("invalid_academic_language_shape");
  if (row.operation === "SAVE_GLOSSARY") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "logicalId", "expectedVersion", "title", "tonePreset", "entries", "bannedTerms"])) throw new AcademicLanguageContractError("invalid_glossary_request_shape");
    return {
      operation: "SAVE_GLOSSARY",
      idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"),
      logicalId: identifier(row.logicalId, "invalid_logical_id"),
      expectedVersion: nonNegativeInteger(row.expectedVersion, "invalid_expected_version"),
      title: boundedText(row.title, "invalid_title", 240),
      tonePreset: enumValue(row.tonePreset, academicTonePresets, "invalid_tone_preset"),
      entries: parseGlossaryEntries(row.entries),
      bannedTerms: parseBannedTerms(row.bannedTerms),
    };
  }
  if (row.operation === "TRANSFORM") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "logicalId", "expectedVersion", "title", "task", "scope", "tonePreset", "sourceText", "glossaryVersionId", "glossaryHash", "methodParameters", "modeProfile"])) throw new AcademicLanguageContractError("invalid_transform_request_shape");
    const scope = enumValue(row.scope, academicScopes, "invalid_scope");
    const glossaryVersionId = row.glossaryVersionId === null ? null : identifier(row.glossaryVersionId, "invalid_glossary_version_id");
    const glossaryHash = row.glossaryHash === null ? null : hash(row.glossaryHash, "invalid_glossary_hash");
    if ((glossaryVersionId === null) !== (glossaryHash === null)) throw new AcademicLanguageContractError("incomplete_glossary_binding");
    return {
      operation: "TRANSFORM",
      idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"),
      logicalId: identifier(row.logicalId, "invalid_logical_id"),
      expectedVersion: nonNegativeInteger(row.expectedVersion, "invalid_expected_version"),
      title: boundedText(row.title, "invalid_title", 240),
      task: enumValue(row.task, academicLanguageTasks, "invalid_task"),
      scope,
      tonePreset: enumValue(row.tonePreset, academicTonePresets, "invalid_tone_preset"),
      sourceText: validateSourceText(row.sourceText, scope),
      glossaryVersionId,
      glossaryHash,
      methodParameters: parseMethodParameters(row.methodParameters),
      modeProfile: parseModelModeProfile(row.modeProfile),
    };
  }
  if (row.operation === "SCRATCH_TRANSFORM") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "task", "scope", "tonePreset", "sourceText", "glossaryVersionId", "glossaryHash", "methodParameters", "modeProfile"])) throw new AcademicLanguageContractError("invalid_scratch_transform_request_shape");
    if (row.scope !== "PARAGRAPH") throw new AcademicLanguageContractError("scratch_requires_paragraph_scope");
    const glossaryVersionId = row.glossaryVersionId === null ? null : identifier(row.glossaryVersionId, "invalid_glossary_version_id");
    const glossaryHash = row.glossaryHash === null ? null : hash(row.glossaryHash, "invalid_glossary_hash");
    if ((glossaryVersionId === null) !== (glossaryHash === null)) throw new AcademicLanguageContractError("incomplete_glossary_binding");
    return {
      operation: "SCRATCH_TRANSFORM",
      idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"),
      task: enumValue(row.task, academicLanguageTasks, "invalid_task"),
      scope: "PARAGRAPH",
      tonePreset: enumValue(row.tonePreset, academicTonePresets, "invalid_tone_preset"),
      sourceText: validateSourceText(row.sourceText, "PARAGRAPH"),
      glossaryVersionId,
      glossaryHash,
      methodParameters: parseMethodParameters(row.methodParameters),
      modeProfile: parseModelModeProfile(row.modeProfile),
    };
  }
  if (row.operation === "APPROVE_DOCUMENT") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "rationale"])) throw new AcademicLanguageContractError("invalid_approval_request_shape");
    return { operation: "APPROVE_DOCUMENT", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), documentVersionId: identifier(row.documentVersionId, "invalid_document_version_id"), contentHash: hash(row.contentHash, "invalid_content_hash"), rationale: boundedText(row.rationale, "invalid_rationale", 2_000, 8) };
  }
  if (row.operation === "PROMOTE_DOCUMENT") {
    if (!exactKeys(row, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "humanGateId", "targetLogicalId", "expectedVersion", "title"])) throw new AcademicLanguageContractError("invalid_promotion_request_shape");
    return { operation: "PROMOTE_DOCUMENT", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), documentVersionId: identifier(row.documentVersionId, "invalid_document_version_id"), contentHash: hash(row.contentHash, "invalid_content_hash"), humanGateId: identifier(row.humanGateId, "invalid_human_gate_id"), targetLogicalId: identifier(row.targetLogicalId, "invalid_target_logical_id"), expectedVersion: nonNegativeInteger(row.expectedVersion, "invalid_expected_version"), title: boundedText(row.title, "invalid_title", 240) };
  }
  throw new AcademicLanguageContractError("unsupported_academic_language_operation");
}

function parseChange(value: unknown): AcademicChange {
  const row = record(value);
  if (!row || !exactKeys(row, ["kind", "original", "revised", "reason"])) throw new AcademicLanguageContractError("invalid_change_shape", 502);
  return {
    kind: enumValue(row.kind, changeKinds, "invalid_change_kind"),
    original: typeof row.original === "string" ? boundedText(row.original, "invalid_change_original", 1_000, 0) : "",
    revised: typeof row.revised === "string" ? boundedText(row.revised, "invalid_change_revised", 1_000, 0) : "",
    reason: boundedText(row.reason, "invalid_change_reason", 1_000),
  };
}

export function splitAcademicParagraphs(sourceText: string) {
  const paragraphs = sourceText.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length || paragraphs.length > ACADEMIC_LANGUAGE_MAX_PARAGRAPHS || paragraphs.some((item) => Buffer.byteLength(item, "utf8") > ACADEMIC_LANGUAGE_MAX_PARAGRAPH_BYTES)) throw new AcademicLanguageContractError("paragraph_bounds_exceeded", 413);
  return paragraphs;
}

function normalizeModelResultShape(value: unknown): unknown {
  // 模型偶發把 uncertainties 放進 paragraph 內層（requiredResultShape 範例在頂層）：
  // 於 parse 入口正規化，把段落內層 uncertainties 提升至頂層並移除該鍵，
  // 使段落 exactKeys（index/source/revised/changes）與頂層 uncertainties 契約一致。
  const rec = record(value);
  if (!rec) return value;
  const root = { ...rec } as Record<string, unknown>;
  if (!Array.isArray(root.paragraphs)) return root;
  const lifted: string[] = [];
  root.paragraphs = root.paragraphs.map((entry) => {
    const entryRec = record(entry);
    if (!entryRec) return entry;
    const paragraph = { ...entryRec } as Record<string, unknown>;
    if (Array.isArray(paragraph.uncertainties)) {
      for (const item of paragraph.uncertainties) if (typeof item === "string") lifted.push(item);
      delete paragraph.uncertainties;
    }
    return paragraph;
  });
  if (lifted.length === 0 && Array.isArray(root.uncertainties)) return root;
  root.uncertainties = Array.isArray(root.uncertainties) ? [...root.uncertainties, ...lifted] : lifted;
  return root;
}

export function parseAcademicProviderResult(value: unknown, request: LanguageTransformationRequest, options?: { unitHyphenTolerant?: boolean; allowExtraTopKeys?: boolean }): AcademicProviderResult {
  const row = record(normalizeModelResultShape(value));
  if (!row) throw new AcademicLanguageContractError("invalid_language_result_shape", 502);
  // 嚴格模式：頂層不得有多餘鍵；GRAMMAR_CHECK 診斷模式容忍額外頂層鍵（段落層仍強制 exactKeys + 保全）
  if (!options?.allowExtraTopKeys && !exactKeys(row, ["contractVersion", "status", "task", "tonePreset", "paragraphs", "uncertainties"])) throw new AcademicLanguageContractError("invalid_language_result_shape", 502);
  if (row.contractVersion !== ACADEMIC_LANGUAGE_CONTRACT_VERSION || row.status !== "SUCCESS" || row.task !== request.task || row.tonePreset !== request.tonePreset) throw new AcademicLanguageContractError("language_result_binding_mismatch", 502);
  const sources = splitAcademicParagraphs(request.sourceText);
  if (!Array.isArray(row.paragraphs) || row.paragraphs.length !== sources.length) throw new AcademicLanguageContractError("language_result_paragraph_mismatch", 502);
  const paragraphs = row.paragraphs.map((item, index) => {
    const paragraph = record(item);
    if (!paragraph || !exactKeys(paragraph, ["index", "source", "revised", "changes"]) || paragraph.index !== index || paragraph.source !== sources[index] || !Array.isArray(paragraph.changes) || paragraph.changes.length > 80) throw new AcademicLanguageContractError("invalid_language_paragraph_shape", 502);
    return { index, source: sources[index], revised: boundedText(paragraph.revised, "invalid_revised_paragraph", ACADEMIC_LANGUAGE_MAX_PARAGRAPH_BYTES * 2), changes: paragraph.changes.map(parseChange) };
  });
  if (!Array.isArray(row.uncertainties) || row.uncertainties.length > 30) throw new AcademicLanguageContractError("invalid_language_uncertainties", 502);
  const uncertainties = row.uncertainties.map((item) => boundedText(item, "invalid_language_uncertainty", 800));
  const result: AcademicProviderResult = { contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION, status: "SUCCESS", task: request.task, tonePreset: request.tonePreset, paragraphs, uncertainties };
  assertPreservationContract(request, result, options);
  return result;
}

function sortedMatches(value: string, patterns: RegExp[]) {
  return patterns.flatMap((pattern) => [...value.matchAll(pattern)].map((match) => match[0])).sort();
}

function exactMultiset(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function preservationFingerprint(value: string) {
  return {
    citations: sortedMatches(value, [/\[[0-9,;\u2013\u2014\-\s]+\]/g, /\([A-Z][A-Za-z'\-]+(?: et al\.)?,?\s+\d{4}[a-z]?\)/g]),
    numbers: sortedMatches(value, [/(?<![\p{L}\p{N}])[-+]?\d+(?:[.,]\d+)*(?:%|\u2030)?/gu]),
    units: sortedMatches(value, [/\b\d+(?:\.\d+)?\s?(?:mg|g|kg|mL|L|mm|cm|m|km|Hz|kHz|MHz|GB|MB|ms|s|min|h|days?)\b/gi]),
    formulas: sortedMatches(value, [/\$[^$\r\n]{1,300}\$/g, /\\\([^\r\n]{1,300}\\\)/g]),
  };
}

export function assertPreservationContract(request: LanguageTransformationRequest, result: AcademicProviderResult, options?: { unitHyphenTolerant?: boolean }) {
  const tolerant = Boolean(options?.unitHyphenTolerant);
  const normalize = (value: string) => tolerant ? value.replace(/(\d)\s*-\s*([A-Za-z\u00b5])/g, "$1 $2") : value;
  const source = preservationFingerprint(normalize(request.sourceText));
  const revised = preservationFingerprint(normalize(result.paragraphs.map((item) => item.revised).join("\n\n")));
  const checks: Array<[boolean, string]> = [
    [exactMultiset(source.citations, revised.citations), "citation_preservation_failed"],
    [exactMultiset(source.numbers, revised.numbers), "number_preservation_failed"],
    [exactMultiset(source.units, revised.units), "unit_preservation_failed"],
    [exactMultiset(source.formulas, revised.formulas), "formula_preservation_failed"],
  ];
  const failure = checks.find(([ok]) => !ok);
  if (failure) throw new AcademicLanguageContractError(failure[1], 502);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function academicLanguageHash(value: unknown) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function academicLanguageRequestHash(request: SaveGlossaryRequest | LanguageTransformationRequest) {
  return academicLanguageHash({ contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION, ...request, idempotencyKey: undefined });
}

export function academicLanguageResultHash(result: AcademicProviderResult) {
  return academicLanguageHash(result);
}
