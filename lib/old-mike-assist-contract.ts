import { modelModeProfiles, type ModelModeProfile } from "./model-mode-contract.ts";
import type { OpenClawChatOperation } from "./openclaw.ts";
import { normalizeS0Intake } from "./project-contract.ts";
import { S0_FIELD_NAMES } from "./s0-fields.ts";
import { hasExactKeys, parseStrictJsonObject } from "./strict-json-envelope.ts";
import { sha256CanonicalPortable } from "./canonical-sha256.ts";

export const OLD_MIKE_ASSIST_CONTRACT_VERSION = "old-mike-assist/1.1.0" as const;
export const ASSIST_ACTIONS = ["SUGGEST", "COMPLETE", "REWRITE", "COMPLETE_ALL_S0", "TRANSLATE", "ALIGN_BILINGUAL", "CRITIQUE"] as const;
export type OldMikeAssistAction = (typeof ASSIST_ACTIONS)[number];
export type OldMikeAssistScope = "PRE_PROJECT" | "PROJECT";

type AssistRegistryEntry = Readonly<{
  scope: OldMikeAssistScope;
  operation: OpenClawChatOperation;
  actions: readonly OldMikeAssistAction[];
  targetIds: readonly string[];
  groupIds: readonly string[];
  groupFields: Readonly<Record<string, readonly string[]>>;
  label: string;
  maxCurrentLength: number;
}>;

const BASIC_ACTIONS = ["SUGGEST", "COMPLETE", "REWRITE"] as const;
const EDIT_ACTIONS = ["SUGGEST", "COMPLETE", "REWRITE", "CRITIQUE"] as const;

export const ASSIST_REGISTRY: Readonly<Record<
  "S0_RESEARCH_TEXT" | "M01_TOPIC_CONDITIONS" | "M02_TERMINOLOGY" | "M03_JOURNAL_PROFILE" |
  "M04_TARGET_JOURNAL" | "M04_COVER_BODY" | "M05_BILINGUAL" | "M05_RATIONALE" | "M05_METHODS" |
  "M05_MODE_SPECIFIC" | "M05_EXECUTION" | "M05_BUDGET_RISKS" | "RESEARCH_DESIGN" |
  "RESEARCH_CLAIM" | "RESEARCH_DOCUMENT" | "ROUTE_WORKSPACE_SECTION",
  AssistRegistryEntry
>> = Object.freeze({
  S0_RESEARCH_TEXT: Object.freeze({ scope: "PRE_PROJECT", operation: "ASSIST_S0", actions: [...BASIC_ACTIONS, "COMPLETE_ALL_S0"] as const, targetIds: ["workingTitle", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"], groupIds: [], groupFields: {}, label: "協助整理 S0", maxCurrentLength: 16_000 }),
  M01_TOPIC_CONDITIONS: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M01", actions: BASIC_ACTIONS, targetIds: ["professionalField", "population", "context", "methodPreferences", "time", "data", "ethics"], groupIds: ["m01-conditions"], groupFields: { "m01-conditions": ["professionalField", "population", "context", "methodPreferences", "time", "data", "ethics"] }, label: "協助整理研究條件", maxCurrentLength: 16_000 }),
  M02_TERMINOLOGY: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M02", actions: ["SUGGEST", "COMPLETE", "REWRITE", "TRANSLATE", "ALIGN_BILINGUAL"] as const, targetIds: ["fixedTerms", "abbreviations", "bannedTerms"], groupIds: ["m02-terminology"], groupFields: { "m02-terminology": ["fixedTerms", "abbreviations", "bannedTerms"] }, label: "建立術語草案", maxCurrentLength: 16_000 }),
  M03_JOURNAL_PROFILE: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M03", actions: EDIT_ACTIONS, targetIds: ["journalProfile"], groupIds: ["m03-journal-profile"], groupFields: { "m03-journal-profile": ["titleContext", "journalProfile"] }, label: "整理審稿語境", maxCurrentLength: 16_000 }),
  M04_TARGET_JOURNAL: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M04", actions: BASIC_ACTIONS, targetIds: ["journalName", "publisherName", "articleType"], groupIds: ["m04-target-journal"], groupFields: { "m04-target-journal": ["journalName", "publisherName", "articleType"] }, label: "整理目標期刊資訊（需官方核對）", maxCurrentLength: 12_000 }),
  M04_COVER_BODY: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M04", actions: EDIT_ACTIONS, targetIds: ["coverBody"], groupIds: ["m04-cover-body"], groupFields: { "m04-cover-body": ["coverBody"] }, label: "潤飾目前段落／全文", maxCurrentLength: 24_000 }),
  M05_BILINGUAL: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_BILINGUAL", actions: ["SUGGEST", "COMPLETE", "REWRITE", "TRANSLATE", "ALIGN_BILINGUAL"] as const, targetIds: ["titleZhTw", "titleEn", "abstractZhTw", "abstractEn", "keywordsZhTw", "keywordsEn"], groupIds: ["m05-bilingual"], groupFields: { "m05-bilingual": ["titleZhTw", "titleEn", "abstractZhTw", "abstractEn", "keywordsZhTw", "keywordsEn"] }, label: "整理雙語標題摘要關鍵詞", maxCurrentLength: 24_000 }),
  M05_RATIONALE: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_RATIONALE", actions: EDIT_ACTIONS, targetIds: ["problem", "background", "literatureGap", "aims", "questions", "hypotheses", "innovation", "significance", "impact"], groupIds: ["m05-rationale"], groupFields: { "m05-rationale": ["problem", "background", "literatureGap", "aims", "questions", "hypotheses", "innovation", "significance", "impact"] }, label: "整理問題與研究價值", maxCurrentLength: 32_000 }),
  M05_METHODS: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_METHODS", actions: EDIT_ACTIONS, targetIds: ["methods", "sample", "data", "analysis", "ethics", "privacy", "risks", "alternatives"], groupIds: ["m05-methods"], groupFields: { "m05-methods": ["methods", "sample", "data", "analysis", "ethics", "privacy", "risks", "alternatives"] }, label: "整理方法與風險", maxCurrentLength: 32_000 }),
  M05_MODE_SPECIFIC: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_MODE", actions: EDIT_ACTIONS, targetIds: ["nstcNarrative", "preliminaryEvidence", "feasibility", "expectedOutputs", "courseContext", "teachingProblem", "intervention", "learningOutcomes", "evaluationDesign", "implementationFidelity", "teachingArtifacts", "reflectionPlan"], groupIds: ["m05-mode-nstc", "m05-mode-moe"], groupFields: { "m05-mode-nstc": ["nstcNarrative", "preliminaryEvidence", "feasibility", "expectedOutputs"], "m05-mode-moe": ["courseContext", "teachingProblem", "intervention", "learningOutcomes", "evaluationDesign", "implementationFidelity", "teachingArtifacts", "reflectionPlan"] }, label: "整理計畫類型專屬內容", maxCurrentLength: 32_000 }),
  M05_EXECUTION: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_EXECUTION", actions: EDIT_ACTIONS, targetIds: ["workPackageTitle", "workPackageObjective", "workPackageMethods", "milestone", "kpiMeasure", "kpiTarget", "kpiEvidence", "teamRole", "teamResponsibility", "teamContribution", "resources"], groupIds: ["m05-execution"], groupFields: { "m05-execution": ["workPackageTitle", "workPackageObjective", "workPackageMethods", "milestone", "kpiMeasure", "kpiTarget", "kpiEvidence", "teamRole", "teamResponsibility", "teamContribution", "resources"] }, label: "整理執行與資源", maxCurrentLength: 32_000 }),
  M05_BUDGET_RISKS: Object.freeze({ scope: "PROJECT", operation: "ASSIST_M05_BUDGET", actions: EDIT_ACTIONS, targetIds: ["budgetJustification", "unresolvedIssues"], groupIds: ["m05-budget-risks"], groupFields: { "m05-budget-risks": ["budgetJustification", "unresolvedIssues"] }, label: "整理預算理由與未決事項", maxCurrentLength: 24_000 }),
  RESEARCH_DESIGN: Object.freeze({ scope: "PROJECT", operation: "ASSIST_RESEARCH_DESIGN", actions: EDIT_ACTIONS, targetIds: ["title", "objective"], groupIds: ["research-design"], groupFields: { "research-design": ["title", "objective"] }, label: "整理研究設計", maxCurrentLength: 24_000 }),
  RESEARCH_CLAIM: Object.freeze({ scope: "PROJECT", operation: "ASSIST_RESEARCH_CLAIM", actions: EDIT_ACTIONS, targetIds: ["claim"], groupIds: [], groupFields: {}, label: "整理研究主張", maxCurrentLength: 16_000 }),
  RESEARCH_DOCUMENT: Object.freeze({ scope: "PROJECT", operation: "ASSIST_RESEARCH_DOCUMENT", actions: EDIT_ACTIONS, targetIds: ["title", "body"], groupIds: ["research-document"], groupFields: { "research-document": ["title", "body"] }, label: "整理研究文件草稿", maxCurrentLength: 32_000 }),
  ROUTE_WORKSPACE_SECTION: Object.freeze({ scope: "PROJECT", operation: "ASSIST_ROUTE_SECTION", actions: EDIT_ACTIONS, targetIds: ["positioning", "alignment", "manuscript-blueprint", "reporting-guideline", "preregistration", "authorship", "risks", "basics", "abstract", "background", "problem", "theory", "method", "workplan", "expected", "pi", "ethics", "risk", "budget", "teaching-problem", "root-cause", "literature", "intervention", "outcomes", "research-design", "benefits"], groupIds: [], groupFields: {}, label: "老麥協助段落（一鍵草稿／深入建議）", maxCurrentLength: 32_000 }),
});

export type OldMikeAssistSurface = keyof typeof ASSIST_REGISTRY;
export type OldMikeAssistTargetKind = "FIELD" | "GROUP" | "WHOLE_S0";
export type OldMikeAssistContextSnapshot = Record<string, unknown> & { current: string | Record<string, string> };
export type OldMikeAssistRequest = {
  contractVersion: typeof OLD_MIKE_ASSIST_CONTRACT_VERSION;
  idempotencyKey: string;
  surface: OldMikeAssistSurface;
  action: OldMikeAssistAction;
  targetKind: OldMikeAssistTargetKind;
  schemaId: string;
  sourceHash: string;
  contextSnapshot: OldMikeAssistContextSnapshot;
  selection?: { start: number; end: number; text: string } | null;
  modeProfile: ModelModeProfile;
};

export type OldMikeAssistSuggestion = { id: string; text?: string; fields?: Record<string, string>; changeSummary: string; status: "AI_PROPOSED" };
export type OldMikeAssistCompletionClass = "COMPLETED" | "PARTIAL_REVIEW_REQUIRED";
export type OldMikeAssistResponse = {
  completionClass: OldMikeAssistCompletionClass;
  suggestions: OldMikeAssistSuggestion[];
  issues: Array<{ code: string; fields: string[]; message: string }>;
  sourceHash: string;
  contextHash: string;
  receipt: { completionClass: OldMikeAssistCompletionClass; suggestionCount: number; formalWrites: 0; retryCount: 0 };
  recoverableFields: string[];
  canApply: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactAllowedKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/gu, "\n").replace(/\u0000/gu, "").trim();
  return cleaned && cleaned.length <= maximum ? cleaned : "";
}

function boundedDraft(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\r\n?/gu, "\n").replace(/\u0000/gu, "").trim();
  return cleaned.length <= maximum ? cleaned : null;
}

const TITLE_FIELDS = new Set(["workingTitle", "titleZhTw", "titleEn", "title"]);
const TITLE_PLACEHOLDER = /[<>〈〉]|待填|研究類型.*研究.*(?:對象|情境).*研究主題|^(?:研究題目|專業研究題目|研究計畫)$/iu;
function protectedTokens(value: string) {
  return [...new Set([
    ...(value.match(/\d+(?:\.\d+)?\s*(?:%|％|人|年|月|週|天|小時|分鐘|秒|mg|kg|g|mL|L|cm|mm|km|Hz|kW|MW|°C|℃)?/giu) || []),
    ...(value.match(/\[[^\]\r\n]{1,100}\]|\([^()\r\n]*(?:19|20)\d{2}[^()\r\n]*\)/gu) || []),
    ...(value.match(/尚未|未確認|待確認|可能|假設|不確定|資料不足/gu) || []),
  ])];
}
function preservesProtectedTokens(source: string, next: string) { return protectedTokens(source).every((token) => next.includes(token)); }

function validId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(value);
}

function validHash(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function safeSnapshotValue(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return true;
  if (typeof value === "string") return value.length <= 32_000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
  if (Array.isArray(value)) return value.length <= 16 && value.every((item) => safeSnapshotValue(item, depth + 1));
  if (!record(value) || Object.keys(value).length > 32) return false;
  return Object.entries(value).every(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key) && !/(?:password|credential|token|secret|endpoint|provider|modelId|rawBody|rawResponse)/iu.test(key) && safeSnapshotValue(item, depth + 1));
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function canonicalAssistSource(value: OldMikeAssistContextSnapshot) {
  return canonicalValue(value);
}

export function parseOldMikeAssistRequest(value: unknown, expectedScope: OldMikeAssistScope): { ok: true; value: OldMikeAssistRequest; registry: AssistRegistryEntry } | { ok: false; code: string } {
  if (!record(value) || !hasExactKeys(value, ["contractVersion", "idempotencyKey", "surface", "action", "targetKind", "schemaId", "sourceHash", "modeProfile", "contextSnapshot", "selection"])) return { ok: false, code: "assist_request_shape_invalid" };
  const registry = typeof value.surface === "string" ? ASSIST_REGISTRY[value.surface as OldMikeAssistSurface] : undefined;
  if (!registry || registry.scope !== expectedScope) return { ok: false, code: "assist_surface_denied" };
  if (value.contractVersion !== OLD_MIKE_ASSIST_CONTRACT_VERSION || !validId(value.idempotencyKey) || !ASSIST_ACTIONS.includes(value.action as OldMikeAssistAction) || !registry.actions.includes(value.action as OldMikeAssistAction) || !validHash(value.sourceHash) || !modelModeProfiles.includes(value.modeProfile as ModelModeProfile) || value.modeProfile !== "AUTO" || !record(value.contextSnapshot) || !safeSnapshotValue(value.contextSnapshot) || new TextEncoder().encode(JSON.stringify(value.contextSnapshot)).byteLength > 64_000) return { ok: false, code: value.modeProfile !== "AUTO" ? "assist_mode_not_enabled" : "assist_request_invalid" };
  const targetKind = value.targetKind;
  const schemaId = boundedText(value.schemaId, 100);
  if (!schemaId || !["FIELD", "GROUP", "WHOLE_S0"].includes(String(targetKind))) return { ok: false, code: "assist_target_denied" };
  if ((value.action === "COMPLETE_ALL_S0") !== (targetKind === "WHOLE_S0")) return { ok: false, code: "assist_target_denied" };
  if (targetKind === "FIELD" && !registry.targetIds.includes(schemaId)) return { ok: false, code: "assist_target_denied" };
  if (targetKind === "GROUP" && !registry.groupIds.includes(schemaId)) return { ok: false, code: "assist_target_denied" };
  if (targetKind === "WHOLE_S0" && (value.surface !== "S0_RESEARCH_TEXT" || value.action !== "COMPLETE_ALL_S0" || schemaId !== "s0-fields/1.0.0")) return { ok: false, code: "assist_target_denied" };
  const current = value.contextSnapshot.current;
  if (targetKind === "FIELD" && (typeof current !== "string" || current.length > registry.maxCurrentLength)) return { ok: false, code: "assist_current_value_invalid" };
  if (targetKind === "GROUP") {
    const fields = registry.groupFields[schemaId];
    if (!record(current) || !fields || !hasExactKeys(current, fields) || fields.some((field) => boundedDraft(current[field], 32_000) === null)) return { ok: false, code: "assist_group_value_invalid" };
  }
  if (targetKind === "WHOLE_S0" && (!record(current) || !hasExactKeys(current, S0_FIELD_NAMES) || !Object.hasOwn(value.contextSnapshot, "researchDirection") || !Object.hasOwn(value.contextSnapshot, "selectedCandidate") || !Object.hasOwn(value.contextSnapshot, "domain") || !Object.hasOwn(value.contextSnapshot, "outputTrack") || !Object.hasOwn(value.contextSnapshot, "s0"))) return { ok: false, code: "assist_s0_context_invalid" };
  if (canonicalAssistSource(value.contextSnapshot as OldMikeAssistContextSnapshot).length > 64_000) return { ok: false, code: "assist_context_too_large" };
  let selection: OldMikeAssistRequest["selection"] = null;
  if (value.selection !== undefined && value.selection !== null) {
    if (!record(value.selection) || !exactAllowedKeys(value.selection, ["start", "end", "text"]) || !Number.isInteger(value.selection.start) || !Number.isInteger(value.selection.end) || Number(value.selection.start) < 0 || Number(value.selection.end) < Number(value.selection.start)) return { ok: false, code: "assist_selection_invalid" };
    const text = boundedText(value.selection.text, 8_000);
    if (targetKind !== "FIELD" || typeof current !== "string" || !text || Number(value.selection.end) > current.length || current.slice(Number(value.selection.start), Number(value.selection.end)) !== text) return { ok: false, code: "assist_selection_invalid" };
    selection = { start: Number(value.selection.start), end: Number(value.selection.end), text };
  }
  return { ok: true, registry, value: { contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION, idempotencyKey: value.idempotencyKey as string, surface: value.surface as OldMikeAssistSurface, action: value.action as OldMikeAssistAction, targetKind: targetKind as OldMikeAssistTargetKind, schemaId, sourceHash: value.sourceHash as string, contextSnapshot: value.contextSnapshot as OldMikeAssistContextSnapshot, selection, modeProfile: value.modeProfile as ModelModeProfile } };
}

function strictJsonObject(content: string) {
  const raw = content.trim();
  if (!raw || raw.length > 96_000 || !raw.startsWith("{") || !raw.endsWith("}")) return null;
  try { const value: unknown = JSON.parse(raw); return record(value) ? value : null; } catch { return null; }
}

export function assistGroupFields(surface: OldMikeAssistSurface, groupId: string): readonly string[] | null {
  return ASSIST_REGISTRY[surface].groupFields[groupId] || null;
}

export function serializeOldMikeAssistGroup(value: Record<string, string>, fields: readonly string[]): string {
  const exact = Object.fromEntries(fields.map((field) => [field, value[field] ?? ""]));
  return JSON.stringify(exact);
}

export function parseOldMikeAssistGroupValue(value: string, fields: readonly string[]): Record<string, string> | null {
  const parsed = strictJsonObject(value);
  if (!parsed || Object.keys(parsed).length !== fields.length || !fields.every((field) => Object.hasOwn(parsed, field)) || !exactAllowedKeys(parsed, fields)) return null;
  const result: Record<string, string> = {};
  for (const field of fields) {
    const item = boundedDraft(parsed[field], 32_000);
    if (item === null) return null;
    result[field] = item;
  }
  return result;
}

export function parseOldMikeAssistGroupPatch(value: string, fields: readonly string[]): Record<string, string> | null {
  const parsed = strictJsonObject(value);
  if (!parsed || Object.keys(parsed).length < 1 || !exactAllowedKeys(parsed, fields)) return null;
  const result: Record<string, string> = {};
  for (const [field, value] of Object.entries(parsed)) {
    const item = boundedDraft(value, 32_000);
    if (item === null) return null;
    result[field] = item;
  }
  return result;
}

export function mergeOldMikeAssistGroupPatch(current: Record<string, string>, patch: Record<string, string>, fields: readonly string[]): Record<string, string> | null {
  if (!hasExactKeys(current, fields) || Object.keys(patch).length < 1 || !exactAllowedKeys(patch, fields)) return null;
  const merged = Object.fromEntries(fields.map((field) => [field, Object.hasOwn(patch, field) ? patch[field] : current[field]])) as Record<string, string>;
  return parseOldMikeAssistGroupValue(serializeOldMikeAssistGroup(merged, fields), fields);
}

export function parseOldMikeAssistResponse(content: string, request: OldMikeAssistRequest, binding: { contextHash: string }): { ok: true; value: OldMikeAssistResponse } | { ok: false; code: string } {
  if (!validHash(request.sourceHash) || !validHash(binding.contextHash)) return { ok: false, code: "assist_binding_invalid" };
  const envelope = parseStrictJsonObject(content, 96_000);
  if (!envelope.ok || !hasExactKeys(envelope.value, ["outputs", "issues"]) || !Array.isArray(envelope.value.outputs) || envelope.value.outputs.length > 3 || !Array.isArray(envelope.value.issues) || envelope.value.issues.length > 16) return { ok: false, code: "assist_response_shape_invalid" };
  const issues: OldMikeAssistResponse["issues"] = [];
  const allowedFields = request.targetKind === "FIELD" ? [request.schemaId] : request.targetKind === "GROUP" ? [...(assistGroupFields(request.surface, request.schemaId) || [])] : [...S0_FIELD_NAMES];
  for (const issue of envelope.value.issues) {
    if (!record(issue) || !hasExactKeys(issue, ["code", "fields", "message"]) || !Array.isArray(issue.fields) || issue.fields.length > allowedFields.length || issue.fields.some((field) => typeof field !== "string" || !allowedFields.includes(field)) || !/^[A-Z][A-Z0-9_]{2,63}$/u.test(String(issue.code))) return { ok: false, code: "assist_issue_invalid" };
    const message = boundedText(issue.message, 500);
    if (!message) return { ok: false, code: "assist_issue_invalid" };
    issues.push({ code: String(issue.code), fields: issue.fields as string[], message });
  }
  const suggestions: OldMikeAssistSuggestion[] = [];
  const outputHashes = new Set<string>();
  for (let index = 0; index < envelope.value.outputs.length; index += 1) {
    const output = envelope.value.outputs[index];
    if (!record(output)) { issues.push({ code: "OUTPUT_SHAPE_INVALID", fields: allowedFields, message: `輸出 ${index + 1} 格式無效。` }); continue; }
    const changeSummary = boundedText(output.changeSummary, 1_000);
    if (!changeSummary) { issues.push({ code: "OUTPUT_SUMMARY_INVALID", fields: allowedFields, message: `輸出 ${index + 1} 缺少有效變更摘要。` }); continue; }
    let suggestion: Omit<OldMikeAssistSuggestion, "id" | "status">;
    if (request.targetKind === "FIELD") {
      if (!hasExactKeys(output, ["text", "changeSummary"])) { issues.push({ code: "OUTPUT_SHAPE_INVALID", fields: [request.schemaId], message: `輸出 ${index + 1} 欄位格式無效。` }); continue; }
      const text = boundedText(output.text, 32_000);
      if (!text) { issues.push({ code: "OUTPUT_VALUE_INVALID", fields: [request.schemaId], message: `輸出 ${index + 1} 沒有有效內容。` }); continue; }
      if (TITLE_FIELDS.has(request.schemaId) && (text.length < 8 || TITLE_PLACEHOLDER.test(text))) { issues.push({ code: "PROFESSIONAL_TITLE_INVALID", fields: [request.schemaId], message: `輸出 ${index + 1} 未通過專業題名契約。` }); continue; }
      if (["REWRITE", "TRANSLATE", "ALIGN_BILINGUAL", "CRITIQUE"].includes(request.action) && typeof request.contextSnapshot.current === "string" && request.contextSnapshot.current && !preservesProtectedTokens(request.contextSnapshot.current, text)) { issues.push({ code: "FACT_PRESERVATION_FAILED", fields: [request.schemaId], message: `輸出 ${index + 1} 未保留受保護內容。` }); continue; }
      suggestion = { text, changeSummary };
    } else {
      if (!hasExactKeys(output, ["fields", "changeSummary"]) || !record(output.fields) || Object.keys(output.fields).length < 1) { issues.push({ code: "OUTPUT_SHAPE_INVALID", fields: allowedFields, message: `輸出 ${index + 1} 群組格式無效。` }); continue; }
      const fields: Record<string, string> = {};
      for (const [field, item] of Object.entries(output.fields)) {
        if (!allowedFields.includes(field)) { issues.push({ code: "OUTPUT_FIELD_DENIED", fields: [], message: `輸出 ${index + 1} 含有未允許欄位。` }); continue; }
        const parsed = boundedText(item, 32_000);
        if (!parsed) { issues.push({ code: "OUTPUT_VALUE_INVALID", fields: [field], message: `輸出 ${index + 1} 的 ${field} 無有效內容。` }); continue; }
        if (TITLE_FIELDS.has(field) && (parsed.length < 8 || TITLE_PLACEHOLDER.test(parsed))) { issues.push({ code: "PROFESSIONAL_TITLE_INVALID", fields: [field], message: `輸出 ${index + 1} 的題名未通過專業契約。` }); continue; }
        const source = record(request.contextSnapshot.current) && typeof request.contextSnapshot.current[field] === "string" ? request.contextSnapshot.current[field] : "";
        if (["REWRITE", "TRANSLATE", "ALIGN_BILINGUAL", "CRITIQUE"].includes(request.action) && source && !preservesProtectedTokens(source, parsed)) { issues.push({ code: "FACT_PRESERVATION_FAILED", fields: [field], message: `輸出 ${index + 1} 的 ${field} 未保留受保護內容。` }); continue; }
        fields[field] = parsed;
      }
      if (!Object.keys(fields).length) continue;
      if (request.targetKind === "WHOLE_S0" && record(request.contextSnapshot.fieldStatus) && record(request.contextSnapshot.current)) {
        const fieldStatus = request.contextSnapshot.fieldStatus;
        const current = request.contextSnapshot.current;
        const changedUserFields = S0_FIELD_NAMES.filter((field) => fieldStatus[field] === "USER_PROVIDED" && Object.hasOwn(fields, field) && fields[field] !== current[field]);
        if (changedUserFields.length) { issues.push({ code: "USER_FACT_CHANGED", fields: changedUserFields, message: `輸出 ${index + 1} 嘗試變更研究者提供內容。` }); continue; }
      }
      suggestion = { fields, changeSummary };
    }
    const outputHash = sha256CanonicalPortable(suggestion);
    if (outputHashes.has(outputHash)) return { ok: false, code: "assist_duplicate_output" };
    outputHashes.add(outputHash);
    suggestions.push({ id: `assist_suggestion_${sha256CanonicalPortable({ sourceHash: request.sourceHash, index, suggestion })}`, ...suggestion, status: "AI_PROPOSED" });
  }
  if (!suggestions.length) return { ok: false, code: "assist_zero_valid_output" };
  const covered = new Set(suggestions.flatMap((suggestion) => suggestion.fields ? Object.keys(suggestion.fields) : [request.schemaId]));
  const missing = allowedFields.filter((field) => !covered.has(field));
  const recoverableFields = [...new Set([...issues.flatMap((issue) => issue.fields), ...missing])];
  let canApply = true;
  if (request.targetKind === "WHOLE_S0") {
    const whole = suggestions.length === 1 && suggestions[0].fields && hasExactKeys(suggestions[0].fields, S0_FIELD_NAMES) ? normalizeS0Intake(suggestions[0].fields) : null;
    canApply = Boolean(whole?.ok);
  }
  const completionClass: OldMikeAssistCompletionClass = issues.length || missing.length || !canApply ? "PARTIAL_REVIEW_REQUIRED" : "COMPLETED";
  return { ok: true, value: { completionClass, suggestions, issues, sourceHash: request.sourceHash, contextHash: binding.contextHash, receipt: { completionClass, suggestionCount: suggestions.length, formalWrites: 0, retryCount: 0 }, recoverableFields, canApply } };
}
