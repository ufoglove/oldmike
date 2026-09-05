import { canonicalDomains, outputTrackIds, type CanonicalDomain, type OutputTrackId } from "./research-config.ts";
import type { S0Intake } from "./project-contract.ts";
import { S0_FIELD_LIMITS, S0_FIELD_NAMES } from "./s0-fields.ts";
import type { S0DraftCompletionClass, S0DraftField, S0ParserBitmap } from "./s0-composer.ts";

export const assistStatuses = ["success", "blocked", "error"] as const;
export type AssistStatus = (typeof assistStatuses)[number];
export const evidenceLabels = ["VERIFIED", "SUPPORTED", "UNVERIFIED", "CONTRADICTED", "BLOCKED"] as const;
export type EvidenceLabel = (typeof evidenceLabels)[number];
export const sourceIdentityStatuses = ["SOURCE_METADATA_VERIFIED", "UNVERIFIED", "CONTRADICTED", "BLOCKED"] as const;
export type SourceIdentityStatus = (typeof sourceIdentityStatuses)[number];
export const claimSupportStatuses = ["CLAIM_VERIFIED", "CLAIM_UNVERIFIED", "CLAIM_CONTRADICTED", "BLOCKED"] as const;
export type ClaimSupportStatus = (typeof claimSupportStatuses)[number];
export const llmSourceStatuses = ["AI_PROPOSED", "UNVERIFIED", "CONTRADICTED", "BLOCKED"] as const;
export type LlmSourceStatus = (typeof llmSourceStatuses)[number];
export type SourceVerificationMethod = "llm_claim_only" | "trusted_api_crossref" | "not_connected" | "blocked";
export const noveltyLabels = ["PROVISIONAL", "SUPPORTED", "UNVERIFIED", "BLOCKED"] as const;
export type NoveltyLabel = (typeof noveltyLabels)[number];
export const fieldAssistActions = ["suggest", "options", "complete", "rewrite"] as const;
export type FieldAssistAction = (typeof fieldAssistActions)[number];
export const writingModes = ["concise", "formal", "academic"] as const;
export type WritingMode = (typeof writingModes)[number];

export type SourceRef = {
  title: string;
  url: string;
  sourceType: string;
  status: EvidenceLabel;
  sourceIdentityStatus: SourceIdentityStatus;
  claimSupportStatus: ClaimSupportStatus;
  publisher?: string;
  publishedAt?: string;
  doi?: string;
  resolvedUrl?: string;
  retrievedAt?: string;
  verificationMethod?: SourceVerificationMethod;
  verificationOutcome?: SourceIdentityStatus;
  claimEvidence?: { locator?: string; passage?: string; page?: string; section?: string; humanConfirmed?: boolean };
};

export type TopicCandidate = {
  candidateId: string;
  chineseTitle: string;
  englishTitle: string;
  coreQuestion: string;
  practicalProblem: string;
  researchPopulation: string;
  whyNow: string;
  theoryOrMechanism: string;
  possibleMethods: string[];
  requiredData: string[];
  feasibility: string;
  ethicsPrivacySiteRisks: string[];
  trackFit: Record<OutputTrackId, string>;
  noveltyStatus: NoveltyLabel;
  sources: SourceRef[];
  unknowns: string[];
  uniqueNextAction: string;
};

export type TopicLabResponse = {
  status: AssistStatus;
  mode: "AI_PROPOSED" | "UNVERIFIED";
  candidates?: TopicCandidate[];
  message?: string;
  searchWindow?: string;
  checkedAt?: string;
};

export type RadarItem = {
  title: string;
  summary: string;
  status: "EMERGING" | "GROWING" | "CONTESTED" | "UNRESOLVED" | "OPPORTUNITY";
  sources: SourceRef[];
  unknowns: string[];
};

export type HorizonRadarResponse = {
  status: AssistStatus;
  mode: "UNVERIFIED" | "BLOCKED";
  searchWindow: string;
  checkedAt?: string;
  items?: RadarItem[];
  searchLog?: string[];
  message?: string;
};

export type FieldAssistResponse = {
  status: AssistStatus;
  mode: "AI_PROPOSED" | "UNVERIFIED";
  field: keyof S0Intake;
  action: FieldAssistAction;
  suggestions?: string[];
  message?: string;
};

export type S0DraftResponse = {
  status: "success";
  mode: "AI_PROPOSED";
  completionClass: S0DraftCompletionClass;
  draft: Record<keyof S0Intake, S0DraftField>;
  appliedCount: number;
  pendingCount: number;
  firstPendingField: keyof S0Intake | null;
  parserStages: S0ParserBitmap;
  upstreamCount: 0 | 1;
};

export type EvidenceLedgerRow = {
  claim: string;
  sourceTitle: string;
  url: string;
  verificationStatus: EvidenceLabel;
  sourceIdentityStatus: SourceIdentityStatus;
  claimSupportStatus: ClaimSupportStatus;
  relationship: "SUPPORTS" | "CONTRADICTS" | "UNKNOWN";
  verificationMethod: SourceVerificationMethod;
  retrievedAt: string;
  resolvedUrl: string;
  doi?: string;
  verificationOutcome: SourceIdentityStatus;
};

export type EvidenceCenterResponse = {
  status: AssistStatus;
  mode: "UNVERIFIED" | "BLOCKED";
  searchStrategy: string;
  sources: SourceRef[];
  ledger: EvidenceLedgerRow[];
  message?: string;
};

type ParseFailure = { status: "blocked" | "error"; code: string; message: string };

export type QuickStartInput = {
  domain: CanonicalDomain;
  direction: string;
  noIdea: boolean;
  outputTrack: OutputTrackId;
  verificationMode?: "AI_CONCEPT" | "FRESH_VERIFIED";
  setting?: string;
  timeline?: string;
  availableData?: string;
};

export type HorizonInput = {
  domain: CanonicalDomain;
  keywords: string[];
  synonyms: string[];
  months: number;
  direction?: string;
  outputTrack?: OutputTrackId;
};

export type FieldAssistInput = {
  field: keyof S0Intake;
  action: FieldAssistAction;
  mode?: WritingMode;
  intake: Partial<S0Intake>;
  candidate?: Partial<TopicCandidate>;
};

export function parseS0DraftInput(value: unknown): { ok: true; value: Partial<S0Intake> } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: "S0 草稿請求格式不正確" };
  const intake: Partial<S0Intake> = {};
  for (const key of S0_FIELD_NAMES) {
    if (value[key] !== undefined) intake[key] = text(value[key], textLimits[key]) as never;
  }
  if (intake.domain !== undefined && !isCanonicalDomainValue(intake.domain)) return { ok: false, message: "S0 草稿研究領域不正確" };
  if (intake.outputTrack !== undefined && !isOutputTrackValue(intake.outputTrack)) return { ok: false, message: "S0 草稿成果路徑不正確" };
  return { ok: true, value: intake };
}

const textLimits: Record<keyof S0Intake, number> = S0_FIELD_LIMITS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, limit: number) {
  return typeof value === "string" && value.replace(/\u0000/g, "").trim().length <= limit ? value.replace(/\u0000/g, "").trim() : "";
}

function boundedTextArray(value: unknown, limit = 8, itemLimit = 1000) {
  return Array.isArray(value) && value.length <= limit && value.every((item) => typeof item === "string" && item.trim().length <= itemLimit)
    ? value.map((item) => item.trim()).filter(Boolean)
    : null;
}

export function isCanonicalDomainValue(value: unknown): value is CanonicalDomain { return typeof value === "string" && canonicalDomains.includes(value as CanonicalDomain); }
export function isOutputTrackValue(value: unknown): value is OutputTrackId { return typeof value === "string" && outputTrackIds.includes(value as OutputTrackId); }

export function parseQuickStartInput(value: unknown): { ok: true; value: QuickStartInput } | { ok: false; message: string } {
  if (!isRecord(value) || !isCanonicalDomainValue(value.domain) || !isOutputTrackValue(value.outputTrack)) return { ok: false, message: "研究領域或成果路徑不正確" };
  const direction = text(value.direction, 1000);
  const setting = text(value.setting, 500);
  const timeline = text(value.timeline, 500);
  const availableData = text(value.availableData, 1000);
  if (!Boolean(value.noIdea) && !direction) return { ok: false, message: "請提供研究方向，或明確選擇我沒有想法" };
  if (typeof value.noIdea !== "boolean" || (!value.noIdea && !direction)) return { ok: false, message: "快速開始資料不完整" };
  const verificationMode = value.verificationMode === undefined ? "AI_CONCEPT" : value.verificationMode;
  if (verificationMode !== "AI_CONCEPT" && verificationMode !== "FRESH_VERIFIED") return { ok: false, message: "選題驗證模式不正確" };
  return { ok: true, value: { domain: value.domain, direction, noIdea: value.noIdea, outputTrack: value.outputTrack, verificationMode, setting, timeline, availableData } };
}

export function parseHorizonInput(value: unknown): { ok: true; value: HorizonInput } | { ok: false; message: string } {
  if (!isRecord(value) || !isCanonicalDomainValue(value.domain)) return { ok: false, message: "研究領域不正確" };
  const keywords = boundedTextArray(value.keywords, 12, 100);
  const synonyms = boundedTextArray(value.synonyms, 20, 100);
  const months = typeof value.months === "number" && Number.isInteger(value.months) && value.months >= 24 && value.months <= 36 ? value.months : 36;
  if (!keywords || !synonyms || !text(value.direction, 1000)) return { ok: false, message: "前沿雷達資料不完整" };
  if (value.outputTrack !== undefined && !isOutputTrackValue(value.outputTrack)) return { ok: false, message: "成果路徑不正確" };
  return { ok: true, value: { domain: value.domain, keywords, synonyms, months, direction: text(value.direction, 1000), outputTrack: value.outputTrack as OutputTrackId | undefined } };
}

export function parseFieldAssistInput(value: unknown): { ok: true; value: FieldAssistInput } | { ok: false; message: string } {
  if (!isRecord(value) || typeof value.field !== "string" || !Object.prototype.hasOwnProperty.call(textLimits, value.field) || !fieldAssistActions.includes(value.action as FieldAssistAction)) return { ok: false, message: "欄位助理請求不正確" };
  if (!isRecord(value.intake)) return { ok: false, message: "欄位助理需要目前 Intake 草稿" };
  const intake: Partial<S0Intake> = {};
  for (const key of Object.keys(textLimits) as Array<keyof S0Intake>) if (value.intake[key] !== undefined) intake[key] = text(value.intake[key], textLimits[key]) as never;
  const mode = value.mode === undefined ? "formal" : value.mode;
  if (!writingModes.includes(mode as WritingMode)) return { ok: false, message: "改寫模式不正確" };
  return { ok: true, value: { field: value.field as keyof S0Intake, action: value.action as FieldAssistAction, mode: mode as WritingMode, intake, candidate: isRecord(value.candidate) ? value.candidate as Partial<TopicCandidate> : undefined } };
}

export function parseJsonObject(content: string): Record<string, unknown> | null {
  const raw = content.trim();
  if (!raw || raw.length > 500000 || raw.startsWith("```") || !raw.startsWith("{") || !raw.endsWith("}")) return null;
  try { const parsed: unknown = JSON.parse(raw); return isRecord(parsed) ? parsed : null; } catch { return null; }
}

function sourceRef(value: unknown): SourceRef | null {
  if (!isRecord(value)) return null;
  const title = text(value.title, 300); const url = text(value.url, 2000); const sourceType = text(value.sourceType, 100);
  const status = value.status;
  const rawIdentity = value.sourceIdentityStatus;
  const rawClaim = value.claimSupportStatus;
  // The model is never allowed to assert a server verification result.
  if (!title || !url || !sourceType || !/^https?:\/\//i.test(url) || !llmSourceStatuses.includes(status as LlmSourceStatus)) return null;
  if (rawIdentity === "SOURCE_METADATA_VERIFIED" || rawClaim === "CLAIM_VERIFIED") return null;
  return {
    title,
    url,
    sourceType,
    status: "UNVERIFIED",
    sourceIdentityStatus: "UNVERIFIED",
    claimSupportStatus: "CLAIM_UNVERIFIED",
    publisher: text(value.publisher, 300) || undefined,
    publishedAt: text(value.publishedAt, 40) || undefined,
    doi: text(value.doi, 300) || undefined,
    resolvedUrl: text(value.resolvedUrl, 2000) || undefined,
    retrievedAt: text(value.retrievedAt, 40) || undefined,
    verificationMethod: "llm_claim_only",
    verificationOutcome: "UNVERIFIED",
  };
}

function candidate(value: unknown): TopicCandidate | null {
  if (!isRecord(value)) return null;
  const candidateId = text(value.candidateId, 80); const chineseTitle = text(value.chineseTitle, 300); const englishTitle = text(value.englishTitle, 400);
  const coreQuestion = text(value.coreQuestion, 2000); const practicalProblem = text(value.practicalProblem, 2000); const researchPopulation = text(value.researchPopulation, 1000);
  const whyNow = text(value.whyNow, 2000); const theoryOrMechanism = text(value.theoryOrMechanism, 2000); const possibleMethods = boundedTextArray(value.possibleMethods, 8, 500);
  const requiredData = boundedTextArray(value.requiredData, 8, 500); const feasibility = text(value.feasibility, 2000); const risks = boundedTextArray(value.ethicsPrivacySiteRisks, 8, 1000);
  const unknowns = boundedTextArray(value.unknowns, 8, 1000); const uniqueNextAction = text(value.uniqueNextAction, 500); const noveltyStatus = value.noveltyStatus;
  const sources = Array.isArray(value.sources) && value.sources.length <= 12 ? value.sources.map(sourceRef) : null;
  const rawTrackFit = isRecord(value.trackFit) ? value.trackFit : null;
  const trackFit = rawTrackFit && outputTrackIds.every((id) => text(rawTrackFit[id], 1000)) ? Object.fromEntries(outputTrackIds.map((id) => [id, text(rawTrackFit[id], 1000)])) as Record<OutputTrackId, string> : null;
  if (!candidateId || !chineseTitle || !englishTitle || !coreQuestion || !practicalProblem || !researchPopulation || !whyNow || !theoryOrMechanism || !possibleMethods || !requiredData || !feasibility || !risks || !unknowns || !uniqueNextAction || !sources || sources.some((item) => !item) || !trackFit || !noveltyLabels.includes(noveltyStatus as NoveltyLabel)) return null;
  return { candidateId, chineseTitle, englishTitle, coreQuestion, practicalProblem, researchPopulation, whyNow, theoryOrMechanism, possibleMethods, requiredData, feasibility, ethicsPrivacySiteRisks: risks, trackFit, noveltyStatus: noveltyStatus as NoveltyLabel, sources: sources as SourceRef[], unknowns, uniqueNextAction };
}

export function parseTopicLabResponse(content: string): TopicLabResponse | ParseFailure {
  const value = parseJsonObject(content);
  if (!value || !assistStatuses.includes(value.status as AssistStatus) || (value.status === "success" && (!Array.isArray(value.candidates) || value.candidates.length < 3 || value.candidates.length > 5))) return { status: "error", code: "invalid_topic_lab_response", message: "Old Mike 未回傳可驗證的選題契約" };
  if (value.status !== "success") return { status: value.status as "blocked" | "error", code: text(value.errorCode, 100) || "assist_unavailable", message: text(value.message, 500) || "目前無法取得可驗證的選題結果" };
  const candidates = (value.candidates as unknown[]).map(candidate);
  if (candidates.some((item) => !item)) return { status: "error", code: "invalid_topic_candidate", message: "選題候選內容不完整或來源未通過格式檢查" };
  return { status: "success", mode: "AI_PROPOSED", candidates: candidates as TopicCandidate[], searchWindow: text(value.searchWindow, 100), checkedAt: text(value.checkedAt, 40) || undefined };
}

export function parseHorizonResponse(content: string): HorizonRadarResponse | ParseFailure {
  const value = parseJsonObject(content);
  if (!value || !assistStatuses.includes(value.status as AssistStatus) || typeof value.searchWindow !== "string") return { status: "error", code: "invalid_horizon_response", message: "Old Mike 未回傳可驗證的前沿雷達契約" };
  if (value.status !== "success") return { status: value.status as "blocked" | "error", mode: "BLOCKED", searchWindow: text(value.searchWindow, 100), message: text(value.message, 500) || "尚未取得可驗證的前沿資料" };
  const items = Array.isArray(value.items) && value.items.length <= 20 ? value.items.map((item) => {
    if (!isRecord(item)) return null;
    const sources = Array.isArray(item.sources) ? item.sources.map(sourceRef) : null;
    const status = item.status; const summary = text(item.summary, 2000); const title = text(item.title, 300); const unknowns = boundedTextArray(item.unknowns, 8, 1000);
    return title && summary && unknowns && sources && sources.every(Boolean) && ["EMERGING", "GROWING", "CONTESTED", "UNRESOLVED", "OPPORTUNITY"].includes(status as string) ? { title, summary, status: status as RadarItem["status"], sources: sources as SourceRef[], unknowns } : null;
  }) : null;
  const searchLog = boundedTextArray(value.searchLog, 20, 500);
  if (!items || items.some((item) => !item) || !searchLog) return { status: "error", code: "invalid_horizon_items", message: "前沿雷達結果缺少來源或查證紀錄" };
  if (value.mode === "VERIFIED" || value.mode === "SUPPORTED") return { status: "error", code: "model_claimed_verification", message: "Model output cannot establish VERIFIED status" };
  return { status: "success", mode: "UNVERIFIED", searchWindow: text(value.searchWindow, 100), checkedAt: text(value.checkedAt, 40) || undefined, items: items as RadarItem[], searchLog };
}

export function parseFieldAssistResponse(content: string, expectedField: keyof S0Intake, expectedAction: FieldAssistAction): FieldAssistResponse | { status: "error"; code: string; message: string } {
  const value = parseJsonObject(content);
  const suggestions = value && boundedTextArray(value.suggestions, 3, textLimits[expectedField]);
  if (!value || value.status !== "success" || value.field !== expectedField || value.action !== expectedAction || !suggestions || suggestions.length < 1 || suggestions.length > 3) return { status: "error", code: "invalid_field_assist_response", message: "欄位助理未回傳可套用的建議" };
  return { status: "success", mode: "AI_PROPOSED", field: expectedField, action: expectedAction, suggestions };
}

export function parseEvidenceResponse(content: string): EvidenceCenterResponse | { status: "error"; code: string; message: string } {
  const value = parseJsonObject(content);
  if (!value || !assistStatuses.includes(value.status as AssistStatus) || typeof value.searchStrategy !== "string") return { status: "error", code: "invalid_evidence_response", message: "Old Mike 未回傳可驗證的證據中心契約" };
  if (value.status !== "success") return { status: value.status as "blocked" | "error", mode: "BLOCKED", searchStrategy: text(value.searchStrategy, 2000), sources: [], ledger: [], message: text(value.message, 500) || "尚未取得可驗證來源" };
  const sources = Array.isArray(value.sources) ? value.sources.map(sourceRef) : null;
  const ledger = Array.isArray(value.ledger) ? value.ledger.map((item) => {
    if (!isRecord(item)) return null;
    const claim = text(item.claim, 1000); const sourceTitle = text(item.sourceTitle, 300); const url = text(item.url, 2000);
    const rawStatus = item.verificationStatus;
    if (rawStatus === "VERIFIED" || rawStatus === "SUPPORTED" || item.sourceIdentityStatus === "SOURCE_METADATA_VERIFIED" || item.claimSupportStatus === "CLAIM_VERIFIED") return null;
    return claim && sourceTitle && /^https?:\/\//i.test(url) && llmSourceStatuses.includes(rawStatus as LlmSourceStatus) && ["SUPPORTS", "CONTRADICTS", "UNKNOWN"].includes(item.relationship as string)
      ? { claim, sourceTitle, url, verificationStatus: "UNVERIFIED" as EvidenceLabel, sourceIdentityStatus: "UNVERIFIED" as SourceIdentityStatus, claimSupportStatus: "CLAIM_UNVERIFIED" as ClaimSupportStatus, relationship: item.relationship as EvidenceLedgerRow["relationship"], verificationMethod: "llm_claim_only" as const, retrievedAt: "", resolvedUrl: url, doi: text(item.doi, 300) || undefined, verificationOutcome: "UNVERIFIED" as SourceIdentityStatus }
      : null;
  }) : null;
  if (!sources || sources.some((item) => !item) || !ledger || ledger.some((item) => !item)) return { status: "error", code: "invalid_evidence_rows", message: "證據中心結果缺少來源驗證欄位" };
  if (value.mode === "VERIFIED" || value.mode === "SUPPORTED") return { status: "error", code: "model_claimed_verification", message: "Model output cannot establish VERIFIED status" };
  return { status: "success", mode: "UNVERIFIED", searchStrategy: text(value.searchStrategy, 2000), sources: sources as SourceRef[], ledger: ledger as EvidenceLedgerRow[], message: text(value.message, 500) || undefined };
}
