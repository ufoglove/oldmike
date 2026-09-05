import "server-only";

import { randomUUID } from "node:crypto";
import {
  ACADEMIC_LANGUAGE_MAX_PARAGRAPHS,
  ACADEMIC_LANGUAGE_MAX_TEXT_BYTES,
  academicLanguageHash,
  academicScopes,
  academicTonePresets,
  academicLanguageTasks,
  splitAcademicParagraphs,
  type AcademicScope,
  type AcademicTonePreset,
  type AcademicLanguageTask,
  type AcademicProviderResult,
} from "./academic-language-contract.ts";
import { AcademicLanguageContractError } from "./academic-language-contract.ts";
import { AcademicLanguageProviderError, transformAcademicLanguage, transformAcademicLanguageWithDeepL, type BoundGlossary, type StandaloneEngine } from "./academic-language-provider.ts";
import { languageToolCheckParagraphs, languageToolConfigured, type LanguageToolIssue } from "./languagetool-client.ts";
import { ModelRouteContractError, resolveModelRoute } from "./model-route-catalog.ts";
import type { ModelModeProfile } from "./model-mode-contract.ts";

// 獨立翻譯與學術潤稿（Standalone Academic Language Tool）
// 不需研究專案／不需前面流程；僅需登入使用者。
// 不建立 glossary/document 版本、不寫入任何 research_documents、不建立 Human Gate。
// 所有輸出皆為 AI_PROPOSED 草稿（persistence NONE），供 paper 文獻與簡單寫作即時使用。

export type StandaloneGlossaryTerms = {
  fixedTerms?: string;
  abbreviations?: string;
  bannedTerms?: string;
};

export const standaloneEngines = ["OLD_MIKE", "DEEPL"] as const;

export type StandaloneTransformBody = {
  operation: "STANDALONE_TRANSFORM";
  task: AcademicLanguageTask;
  scope?: AcademicScope;
  tonePreset: AcademicTonePreset;
  sourceText: string;
  title?: string;
  modeProfile?: ModelModeProfile;
  engine?: StandaloneEngine;
  terms?: StandaloneGlossaryTerms;
};

export type StandaloneMechanicalLayer = {
  engine: "LANGUAGETOOL";
  available: boolean;
  degradedParagraphs: number[];
  issues: Array<LanguageToolIssue & { paragraphIndex: number }>;
};

export type StandaloneScratchResult = AcademicProviderResult & {
  sourceHash: string;
  resultHash: string;
  persistence: "NONE";
  humanGate: "NOT_APPLICABLE";
  mode: "STANDALONE_AI_PROPOSED";
  engine: StandaloneEngine;
  mechanical?: StandaloneMechanicalLayer;
  note: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new AcademicLanguageContractError(code);
  return value as T;
}

function boundedText(value: unknown, code: string, maxBytes: number): string {
  if (typeof value !== "string") throw new AcademicLanguageContractError(code);
  const text = value.trim();
  if (!text || Buffer.byteLength(text, "utf8") > maxBytes) throw new AcademicLanguageContractError(code);
  return text;
}

function parseTermLines(value: unknown, maxLines: number, code: string) {
  if (value === undefined || value === null) return [];
  if (typeof value !== "string") throw new AcademicLanguageContractError(code);
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > maxLines) throw new AcademicLanguageContractError(code);
  return lines;
}

function parseMappingLine(line: string, kind: "FIXED_TRANSLATION" | "ABBREVIATION", code: string) {
  const parts = line.split("=>");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new AcademicLanguageContractError(code);
  return { sourceTerm: parts[0].trim(), targetTerm: parts[1].trim(), kind, caseSensitive: false };
}

function parseBannedLine(line: string, code: string) {
  const parts = line.split("=>");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new AcademicLanguageContractError(code);
  return { term: parts[0].trim(), replacement: parts[1].trim() };
}

export function parseStandaloneTransformBody(value: unknown): StandaloneTransformBody {
  if (!record(value)) throw new AcademicLanguageContractError("invalid_standalone_language_shape");
  const row = value as Record<string, unknown>;
  if (row.operation !== "STANDALONE_TRANSFORM") throw new AcademicLanguageContractError("invalid_standalone_language_shape");
  const task = enumValue(row.task, academicLanguageTasks, "invalid_task");
  const scope = row.scope === undefined ? "PARAGRAPH" : enumValue(row.scope, academicScopes, "invalid_scope");
  const tonePreset = enumValue(row.tonePreset, academicTonePresets, "invalid_tone_preset");
  const sourceText = boundedText(row.sourceText, "invalid_source_text", ACADEMIC_LANGUAGE_MAX_TEXT_BYTES);
  const paragraphs = splitAcademicParagraphs(sourceText);
  if (paragraphs.length > ACADEMIC_LANGUAGE_MAX_PARAGRAPHS) throw new AcademicLanguageContractError("too_many_paragraphs");
  if (scope === "PARAGRAPH" && paragraphs.length !== 1) throw new AcademicLanguageContractError("paragraph_scope_requires_one_paragraph");
  const title = row.title === undefined ? "獨立翻譯草稿" : boundedText(row.title, "invalid_title", 240);
  const modeProfile = (row.modeProfile as ModelModeProfile | undefined) ?? "AUTO";
  const termsValue = row.terms === undefined ? null : (row.terms as Record<string, unknown> | null);
  if (termsValue !== null && !record(termsValue)) throw new AcademicLanguageContractError("invalid_terms_shape");
  const terms: StandaloneGlossaryTerms = termsValue ? {
    fixedTerms: termsValue.fixedTerms === undefined ? undefined : String(termsValue.fixedTerms),
    abbreviations: termsValue.abbreviations === undefined ? undefined : String(termsValue.abbreviations),
    bannedTerms: termsValue.bannedTerms === undefined ? undefined : String(termsValue.bannedTerms),
  } : {};
  const engine = row.engine === undefined ? "OLD_MIKE" : enumValue(row.engine, standaloneEngines, "invalid_engine");
  return { operation: "STANDALONE_TRANSFORM", task, scope, tonePreset, sourceText, title, modeProfile, engine, terms };
}

export function buildStandaloneGlossary(terms: StandaloneGlossaryTerms): BoundGlossary | null {
  const entries = [
    ...parseTermLines(terms.fixedTerms, 100, "too_many_terms").map((line) => parseMappingLine(line, "FIXED_TRANSLATION", "invalid_term_line")),
    ...parseTermLines(terms.abbreviations, 100, "too_many_terms").map((line) => parseMappingLine(line, "ABBREVIATION", "invalid_abbreviation_line")),
  ];
  const banned = parseTermLines(terms.bannedTerms, 100, "too_many_terms").map((line) => parseBannedLine(line, "invalid_banned_line"));
  if (entries.length === 0 && banned.length === 0) return null;
  return {
    versionId: "standalone-session",
    contentHash: academicLanguageHash({ entries, banned }),
    entries,
    bannedTerms: banned,
  };
}

export async function runStandaloneAcademicLanguage(input: { userId: string; body: StandaloneTransformBody }): Promise<StandaloneScratchResult> {
  const glossary = buildStandaloneGlossary(input.body.terms ?? {});
  const route = resolveModelRoute({ modeProfile: input.body.modeProfile ?? "AUTO", operation: "ACADEMIC_LANGUAGE" });
  const request = {
    operation: "TRANSFORM" as const,
    idempotencyKey: `standalone:${randomUUID()}`,
    logicalId: "standalone-session",
    expectedVersion: 0,
    title: input.body.title ?? "獨立翻譯草稿",
    task: input.body.task,
    scope: input.body.scope ?? "PARAGRAPH",
    tonePreset: input.body.tonePreset,
    sourceText: input.body.sourceText,
    glossaryVersionId: null,
    glossaryHash: null,
    methodParameters: { preserveCitations: true as const, preserveNumbers: true as const, preserveUnits: true as const, preserveFormulas: true as const, explainChanges: true as const },
    modeProfile: input.body.modeProfile ?? "AUTO",
  };
  const engine = input.body.engine ?? "OLD_MIKE";
  const outcome = engine === "DEEPL"
    ? await transformAcademicLanguageWithDeepL({ request, glossary, actorId: input.userId, route })
    : { engine: "OLD_MIKE" as const, result: await transformAcademicLanguage({ request, glossary, actorId: input.userId, route }) };
  const notes = [
    "獨立工具輸出為 AI_PROPOSED 草稿：未寫入任何研究專案、版本或正式文件；請人工核對引文、數字、單位與研究主張後再使用。",
  ];
  let mechanical: StandaloneMechanicalLayer | undefined;
  // 混合文法檢查：GRAMMAR_CHECK 時，老麥 AI 學術診斷之外，再加自架 LanguageTool 機械錯誤層（互補；LT 故障時降級不擋主流程）
  if (request.task === "GRAMMAR_CHECK") {
    if (languageToolConfigured()) {
      const sources = splitAcademicParagraphs(input.body.sourceText);
      const result = await languageToolCheckParagraphs(sources);
      const issues = result.issuesPerParagraph.flatMap((items, paragraphIndex) => items.map((item) => ({ ...item, paragraphIndex })));
      mechanical = { engine: "LANGUAGETOOL", available: true, degradedParagraphs: result.degradedParagraphs, issues };
      if (result.degradedParagraphs.length) notes.push(`機械錯誤層（LanguageTool）部分段落檢查失敗（段落 ${result.degradedParagraphs.map((i) => i + 1).join("、")}），已略過；學術語感診斷不受影響。`);
      if (!issues.length) notes.push("機械錯誤層（LanguageTool 自架）已完成檢查：未發現機械文法錯誤。");
    } else {
      mechanical = { engine: "LANGUAGETOOL", available: false, degradedParagraphs: [], issues: [] };
      notes.push("機械錯誤層（LanguageTool）未設定（缺少 LT_BASE_URL），本次僅顯示老麥 AI 學術診斷。");
    }
  }
  if (outcome.note) notes.push(outcome.note);
  return {
    ...outcome.result,
    sourceHash: academicLanguageHash(input.body.sourceText),
    resultHash: academicLanguageHash(outcome.result),
    persistence: "NONE",
    humanGate: "NOT_APPLICABLE",
    mode: "STANDALONE_AI_PROPOSED",
    engine: outcome.engine,
    ...(mechanical ? { mechanical } : {}),
    note: notes.join(" "),
  };
}

export class StandaloneLanguageToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "StandaloneLanguageToolError";
    this.code = code;
    this.status = status;
  }
}

export function standalonePublicError(error: unknown) {
  if (error instanceof AcademicLanguageContractError) return { ok: false as const, code: error.code, error: "獨立翻譯要求未通過老麥的固定資料契約。" };
  if (error instanceof AcademicLanguageProviderError) {
    const deeplText: Record<string, string> = {
      deepl_not_configured: "DeepL 引擎尚未設定（缺少 API Key），請通知管理員。",
      deepl_task_not_supported: "DeepL 僅支援中→英／英→繁中翻譯；英語學術潤稿請使用老麥 AI 引擎。",
      deepl_quota_exceeded: "DeepL Free 每月字元額度已用罄；請改用老麥 AI 引擎或升級 DeepL 方案。",
      deepl_rate_limited: "DeepL 暫時限制請求頻率；請稍後再試或改用老麥 AI 引擎。",
      deepl_auth_failed: "DeepL API Key 驗證失敗，請通知管理員。",
      deepl_upstream_error: "DeepL 暫時無法連線；請稍後再試或改用老麥 AI 引擎。",
      deepl_response_invalid: "DeepL 回應格式異常；原文未被覆寫。",
    };
    const errorText = deeplText[error.code] ?? "老麥目前無法安全完成這項語言處理；原文未被覆寫。";
    return { ok: false as const, code: error.code, error: errorText };
  }
  if (error instanceof ModelRouteContractError) return { ok: false as const, code: error.code, error: "所選老麥模式目前不可用；原文未被覆寫。" };
  if (error instanceof StandaloneLanguageToolError) return { ok: false as const, code: error.code, error: error.message };
  return { ok: false as const, code: "standalone_language_unavailable", error: "老麥目前無法完成這項操作；原文未被覆寫。" };
}
