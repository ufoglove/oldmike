import { normalizeS0Intake, type S0Intake } from "./project-contract.ts";
import { canonicalDomains, outputTrackIds, type CanonicalDomain, type OutputTrackId } from "./research-config.ts";
import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import { S0_FIELD_NAMES } from "./s0-fields.ts";
import { hasExactKeys, parseStrictJsonObject, type StrictJsonEnvelopeStage } from "./strict-json-envelope.ts";
import { TOPIC_LAB_OUTPUT_LIMIT_BYTES } from "./topic-lab-runtime-contract.ts";

export const RESEARCH_START_CONTRACT_VERSION = "research-start/1.1.0" as const;
export const RESEARCH_PLAN_LANES = ["CURRENT_PRACTICE_VALUE", "EMERGING_FRONTIER", "HIGH_VALUE_GAP_OR_CONTRARIAN"] as const;
export const RESEARCH_SOURCE_STRATEGIES = ["SCHOLARLY_AUTO", "MANUAL_PUBLIC_HTTPS", "NONE"] as const;
export const RESEARCH_DIRECTION_MAX_LENGTH = 1_000 as const;
export const RESEARCH_PLAN_S0_BINDINGS = Object.freeze({
  workingTitle: "workingTitle",
  methodIdea: "methodDesign",
  expectedContribution: "contribution",
  targetUsers: "targetContext",
  problemContext: "researchDirection+researchQuestion+professionalBackground",
} as const);

export type ResearchPlanLane = (typeof RESEARCH_PLAN_LANES)[number];
export type ResearchSourceStrategy = (typeof RESEARCH_SOURCE_STRATEGIES)[number];
export type ResearchStartAdvanced = {
  domain: CanonicalDomain | null;
  outputTrack: OutputTrackId | null;
  population: string;
  context: string;
  method: string;
  data: string;
  timeline: string;
  ethics: string;
};
export type ResearchStartRequest = {
  operation: "ANALYZE";
  idempotencyKey: string;
  researchDirection: string;
  advanced: ResearchStartAdvanced;
  sourceStrategy: ResearchSourceStrategy;
  evidenceWindow: { from: string; to: string };
  sourceUrls: string[];
};

export type ResearchPlanCandidate = {
  candidateId: string;
  lane: ResearchPlanLane;
  recommended: boolean;
  workingTitle: string;
  researchQuestion: string;
  researchValue: string;
  mechanismTheory: string;
  targetContext: string;
  contribution: string;
  methodDesign: string;
  dataPlan: string;
  feasibility: string;
  riskEthics: string;
  evidenceStatus: "UNVERIFIED";
  assumptions: string[];
  unresolvedItems: string[];
  nextAction: string;
  researchDirectionProvenance: { value: string; status: "USER_PROVIDED" };
  s0Draft: S0Intake;
  qualityWarnings: string[];
  candidateHash: string;
};

export type ResearchPlanEnvelope = {
  contractVersion: typeof RESEARCH_START_CONTRACT_VERSION;
  recommendedCandidateId: string;
  recommendationRationale: string;
  candidates: ResearchPlanCandidate[];
};

export type ResearchPlanParseStage = StrictJsonEnvelopeStage | "TOP_LEVEL_SHAPE" | "CANDIDATE_SHAPE" | "FIELD_VALUE" | "S0_SHAPE" | "PROFESSIONAL_QUALITY" | "CANDIDATE_DISTINCTNESS";
export type ResearchPlanParseResult =
  | { ok: true; value: ResearchPlanEnvelope }
  | { ok: false; code: string; stage: ResearchPlanParseStage; recoverableFields: string[] };

export class ResearchStartContractError extends Error {
  readonly code: string;
  readonly status: number;
  readonly recoverableFields: string[];
  constructor(code: string, status = 400, recoverableFields: string[] = []) {
    super(code);
    this.name = "ResearchStartContractError";
    this.code = code;
    this.status = status;
    this.recoverableFields = recoverableFields;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function userText(value: unknown, maximum: number, required = false) {
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) return null;
  if (required && !value.trim()) return null;
  return value;
}

function modelText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/gu, "\n").replace(/\u0000/gu, "").trim();
  return cleaned && cleaned.length <= maximum ? cleaned : "";
}

function modelTextArray(value: unknown, maximumItems = 8, itemMaximum = 1_000) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumItems) return null;
  const output = value.map((item) => modelText(item, itemMaximum));
  return output.every(Boolean) ? output : null;
}

function validId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(value);
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function safePublicUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u)?.slice(1).map(Number);
    const privateIpv4 = ipv4 && (ipv4.some((part) => part < 0 || part > 255) || ipv4[0] === 10 || ipv4[0] === 127 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168));
    const privateLabel = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || !host.includes(".") || Boolean(privateIpv4);
    const restrictedPath = /\/(?:login|log-in|signin|sign-in|auth|oauth|session|account)(?:\/|$)/iu.test(url.pathname);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443") && !privateLabel && !restrictedPath ? url.toString() : "";
  } catch { return ""; }
}

export function normalizeResearchStartRequest(value: unknown): ResearchStartRequest {
  if (!record(value) || !hasExactKeys(value, ["operation", "idempotencyKey", "researchDirection", "advanced", "sourceStrategy", "evidenceWindow", "sourceUrls"]) || value.operation !== "ANALYZE" || !validId(value.idempotencyKey)) throw new ResearchStartContractError("research_start_request_shape_invalid");
  const researchDirection = userText(value.researchDirection, RESEARCH_DIRECTION_MAX_LENGTH, true);
  if (researchDirection === null) throw new ResearchStartContractError("research_direction_required", 422, ["researchDirection"]);
  if (!record(value.advanced) || !Object.keys(value.advanced).every((key) => ["domain", "outputTrack", "population", "context", "method", "data", "timeline", "ethics"].includes(key))) throw new ResearchStartContractError("research_start_advanced_shape_invalid");
  const advanced = value.advanced;
  const domain = advanced.domain === undefined || advanced.domain === null || advanced.domain === "" ? null : advanced.domain;
  const outputTrack = advanced.outputTrack === undefined || advanced.outputTrack === null || advanced.outputTrack === "" ? null : advanced.outputTrack;
  if (domain !== null && !canonicalDomains.includes(domain as CanonicalDomain)) throw new ResearchStartContractError("research_domain_invalid", 422, ["advanced.domain"]);
  if (outputTrack !== null && !outputTrackIds.includes(outputTrack as OutputTrackId)) throw new ResearchStartContractError("research_output_track_invalid", 422, ["advanced.outputTrack"]);
  const advancedText = Object.fromEntries(["population", "context", "method", "data", "timeline", "ethics"].map((key) => {
    const parsed = userText(advanced[key] ?? "", key === "data" || key === "ethics" ? 1_000 : 500);
    if (parsed === null) throw new ResearchStartContractError("research_start_advanced_value_invalid", 422, [`advanced.${key}`]);
    return [key, parsed];
  })) as Pick<ResearchStartAdvanced, "population" | "context" | "method" | "data" | "timeline" | "ethics">;
  if (!RESEARCH_SOURCE_STRATEGIES.includes(value.sourceStrategy as ResearchSourceStrategy)) throw new ResearchStartContractError("research_source_strategy_invalid", 422, ["sourceStrategy"]);
  if (!record(value.evidenceWindow) || !hasExactKeys(value.evidenceWindow, ["from", "to"])) throw new ResearchStartContractError("research_evidence_window_invalid");
  const from = isoDate(value.evidenceWindow.from);
  const to = isoDate(value.evidenceWindow.to);
  if (!from || !to || from > to) throw new ResearchStartContractError("research_evidence_window_invalid", 422, ["evidenceWindow"]);
  if (!Array.isArray(value.sourceUrls) || value.sourceUrls.length > 8) throw new ResearchStartContractError("research_source_urls_invalid");
  const sourceUrls = value.sourceUrls.map(safePublicUrl);
  if (sourceUrls.some((item) => !item) || new Set(sourceUrls).size !== sourceUrls.length) throw new ResearchStartContractError("research_source_urls_invalid", 422, ["sourceUrls"]);
  if (value.sourceStrategy === "MANUAL_PUBLIC_HTTPS" && sourceUrls.length === 0) throw new ResearchStartContractError("research_source_urls_required", 422, ["sourceUrls"]);
  if (value.sourceStrategy !== "MANUAL_PUBLIC_HTTPS" && sourceUrls.length > 0) throw new ResearchStartContractError("research_source_strategy_mismatch", 422, ["sourceUrls"]);
  return {
    operation: "ANALYZE",
    idempotencyKey: value.idempotencyKey as string,
    researchDirection,
    advanced: { domain: domain as CanonicalDomain | null, outputTrack: outputTrack as OutputTrackId | null, ...advancedText },
    sourceStrategy: value.sourceStrategy as ResearchSourceStrategy,
    evidenceWindow: { from, to },
    sourceUrls,
  };
}

const PLACEHOLDER = /(?:[<>〈〉]|\b(?:TBD|TODO)\b|待填|研究類型.{0,16}研究.{0,16}對象.{0,16}情境)/iu;

function normalizedTokens(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
  const output = new Set<string>(normalized.match(/[a-z0-9]{3,}/gu) || []);
  const chinese = [...normalized].filter((character) => /[\u3400-\u9fff]/u.test(character));
  for (let index = 0; index + 1 < chinese.length; index += 1) output.add(`${chinese[index]}${chinese[index + 1]}`);
  return output;
}

function jaccard(left: Set<string>, right: Set<string>) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / union.size;
}

function overlaps(left: string, right: string) {
  const leftTokens = normalizedTokens(left);
  const rightTokens = normalizedTokens(right);
  for (const token of leftTokens) if (rightTokens.has(token)) return true;
  return false;
}

function includesExact(source: string, expected: string) {
  const required = expected.trim();
  return !required || source.includes(required);
}

function exactOccurrenceCount(source: string, expected: string) {
  const required = expected.trim();
  if (!required) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(required, offset)) >= 0) {
    count += 1;
    offset += required.length;
  }
  return count;
}

function s0CoreSignature(value: S0Intake) {
  return sha256Canonical({
    workingTitle: value.workingTitle,
    problemContext: value.problemContext,
    targetUsers: value.targetUsers,
    expectedContribution: value.expectedContribution,
    methodIdea: value.methodIdea,
    availableData: value.availableData,
  });
}

const candidateKeys = ["lane", "workingTitle", "researchQuestion", "researchValue", "mechanismTheory", "targetContext", "contribution", "methodDesign", "dataPlan", "feasibility", "riskEthics", "evidenceStatus", "assumptions", "unresolvedItems", "nextAction", "s0Draft"] as const;

function parseCandidate(value: unknown, lane: ResearchPlanLane, index: number, request: ResearchStartRequest): { candidate: Omit<ResearchPlanCandidate, "candidateId" | "recommended" | "candidateHash"> } | { failure: ResearchPlanParseResult & { ok: false } } {
  const prefix = `candidates.${index}`;
  if (!record(value) || !hasExactKeys(value, candidateKeys) || value.lane !== lane) return { failure: { ok: false, code: "research_candidate_shape_invalid", stage: "CANDIDATE_SHAPE", recoverableFields: [prefix] } };
  const textFields = ["workingTitle", "researchQuestion", "researchValue", "mechanismTheory", "targetContext", "contribution", "methodDesign", "dataPlan", "feasibility", "riskEthics", "nextAction"] as const;
  const parsedText = Object.fromEntries(textFields.map((field) => [field, modelText(value[field], field === "workingTitle" ? 300 : 2_000)])) as Record<(typeof textFields)[number], string>;
  const missingText = textFields.filter((field) => !parsedText[field]);
  const assumptions = modelTextArray(value.assumptions);
  const unresolvedItems = modelTextArray(value.unresolvedItems);
  if (missingText.length || !assumptions || !unresolvedItems || value.evidenceStatus !== "UNVERIFIED") return { failure: { ok: false, code: "research_candidate_value_invalid", stage: "FIELD_VALUE", recoverableFields: [...missingText.map((field) => `${prefix}.${field}`), ...(!assumptions ? [`${prefix}.assumptions`] : []), ...(!unresolvedItems ? [`${prefix}.unresolvedItems`] : []), ...(value.evidenceStatus !== "UNVERIFIED" ? [`${prefix}.evidenceStatus`] : [])] } };
  // 修復：模型偶發漏寫 s0Draft.problemContext；以使用者研究方向回填（避免整批分析因單欄缺失失敗）
  const direction = request.researchDirection.trim();
  const s0Row = record(value.s0Draft) ? value.s0Draft as Record<string, unknown> : null;
  if (s0Row && !s0Row.problemContext && direction) s0Row.problemContext = direction;
  if (!record(value.s0Draft) || !hasExactKeys(value.s0Draft, S0_FIELD_NAMES)) {
    const actual = record(value.s0Draft) ? new Set(Object.keys(value.s0Draft)) : new Set<string>();
    const missing = S0_FIELD_NAMES.filter((field) => !actual.has(field)).map((field) => `${prefix}.s0Draft.${field}`);
    return { failure: { ok: false, code: "research_s0_shape_invalid", stage: "S0_SHAPE", recoverableFields: missing.length ? missing : [`${prefix}.s0Draft`] } };
  }
  const normalized = normalizeS0Intake(value.s0Draft);
  if (!normalized.ok) return { failure: { ok: false, code: "research_s0_value_invalid", stage: "S0_SHAPE", recoverableFields: Object.keys(normalized.fieldErrors).map((field) => `${prefix}.s0Draft.${field}`) } };
  if (PLACEHOLDER.test(parsedText.workingTitle) || Object.values(normalized.value).some((item) => PLACEHOLDER.test(item))) return { failure: { ok: false, code: "research_placeholder_rejected", stage: "PROFESSIONAL_QUALITY", recoverableFields: [`${prefix}.workingTitle`] } };
  if (parsedText.workingTitle.length < 12 || !overlaps(parsedText.workingTitle, `${parsedText.researchQuestion} ${parsedText.targetContext} ${parsedText.mechanismTheory} ${parsedText.methodDesign}`)) return { failure: { ok: false, code: "research_title_not_specific", stage: "PROFESSIONAL_QUALITY", recoverableFields: [`${prefix}.workingTitle`] } };
  const bindingFailures: string[] = [];
  if (normalized.value.workingTitle !== parsedText.workingTitle) bindingFailures.push(`${prefix}.s0Draft.workingTitle`);
  if (normalized.value.methodIdea !== parsedText.methodDesign) bindingFailures.push(`${prefix}.s0Draft.methodIdea`);
  if (normalized.value.expectedContribution !== parsedText.contribution) bindingFailures.push(`${prefix}.s0Draft.expectedContribution`);
  if (normalized.value.targetUsers !== parsedText.targetContext) bindingFailures.push(`${prefix}.s0Draft.targetUsers`);
  // 放寬 binding 檢查：模型常以改寫（paraphrase）呈現研究問題；
  // 要求 problemContext 確實承接方向（字面包含或實質重述）且為實質內容（非純複述、非短填充）。
  const restatedContext = normalized.value.problemContext.trim();
  const directionPhrase = direction.trim();
  const directionBound = includesExact(restatedContext, directionPhrase) || (directionPhrase.length >= 40 && restatedContext.length >= directionPhrase.length && restatedContext.length >= 120);
  const questionBound = includesExact(restatedContext, parsedText.researchQuestion) || restatedContext.length >= 120;
  if (!directionBound || !questionBound || restatedContext.length < Math.min(directionPhrase.length, 200) + 10) bindingFailures.push(`${prefix}.s0Draft.problemContext`);
  if (request.advanced.domain && normalized.value.domain !== request.advanced.domain) bindingFailures.push(`${prefix}.s0Draft.domain`);
  if (request.advanced.outputTrack && normalized.value.outputTrack !== request.advanced.outputTrack) bindingFailures.push(`${prefix}.s0Draft.outputTrack`);
  if (request.advanced.population && !includesExact(parsedText.targetContext, request.advanced.population)) bindingFailures.push(`${prefix}.targetContext`);
  if (request.advanced.context && !includesExact(`${parsedText.targetContext} ${normalized.value.problemContext}`, request.advanced.context)) bindingFailures.push(`${prefix}.targetContext`);
  if (request.advanced.method && !includesExact(parsedText.methodDesign, request.advanced.method)) bindingFailures.push(`${prefix}.methodDesign`);
  if (request.advanced.data && !includesExact(normalized.value.availableData, request.advanced.data)) bindingFailures.push(`${prefix}.s0Draft.availableData`);
  if (request.advanced.timeline && !includesExact(normalized.value.timeline, request.advanced.timeline)) bindingFailures.push(`${prefix}.s0Draft.timeline`);
  if (request.advanced.ethics && !includesExact(normalized.value.ethicsPrivacyRisks, request.advanced.ethics)) bindingFailures.push(`${prefix}.s0Draft.ethicsPrivacyRisks`);
  if (bindingFailures.length) return { failure: { ok: false, code: "research_plan_s0_binding_invalid", stage: "S0_SHAPE", recoverableFields: [...new Set(bindingFailures)] } };
  const qualityWarnings: string[] = [];
  if (!overlaps(parsedText.researchQuestion, parsedText.contribution)) qualityWarnings.push("QUESTION_CONTRIBUTION_ALIGNMENT_REVIEW");
  if (!overlaps(`${parsedText.methodDesign} ${parsedText.dataPlan}`, parsedText.researchQuestion)) qualityWarnings.push("METHOD_DATA_ALIGNMENT_REVIEW");
  return { candidate: { lane, ...parsedText, evidenceStatus: "UNVERIFIED", assumptions, unresolvedItems, researchDirectionProvenance: { value: request.researchDirection, status: "USER_PROVIDED" }, s0Draft: normalized.value, qualityWarnings } };
}

export function parseResearchPlanEnvelope(content: string, request: ResearchStartRequest): ResearchPlanParseResult {
  const envelope = parseStrictJsonObject(content, TOPIC_LAB_OUTPUT_LIMIT_BYTES);
  if (!envelope.ok) return { ok: false, code: "research_plan_json_invalid", stage: envelope.stage, recoverableFields: [] };
  const value = envelope.value;
  if (!hasExactKeys(value, ["recommendedLane", "recommendationRationale", "candidates"]) || !RESEARCH_PLAN_LANES.includes(value.recommendedLane as ResearchPlanLane) || !Array.isArray(value.candidates) || value.candidates.length !== 3) return { ok: false, code: "research_plan_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["candidates"] };
  const rationale = modelText(value.recommendationRationale, 2_000);
  if (!rationale) return { ok: false, code: "research_recommendation_invalid", stage: "FIELD_VALUE", recoverableFields: ["recommendationRationale"] };
  const parsedCandidates: Array<Omit<ResearchPlanCandidate, "candidateId" | "recommended" | "candidateHash">> = [];
  for (let index = 0; index < RESEARCH_PLAN_LANES.length; index += 1) {
    const parsed = parseCandidate(value.candidates[index], RESEARCH_PLAN_LANES[index], index, request);
    if ("failure" in parsed) return parsed.failure;
    parsedCandidates.push(parsed.candidate);
  }
  for (let left = 0; left < parsedCandidates.length; left += 1) {
    for (let right = left + 1; right < parsedCandidates.length; right += 1) {
      const leftBody = `${parsedCandidates[left].researchQuestion} ${parsedCandidates[left].mechanismTheory} ${parsedCandidates[left].methodDesign} ${parsedCandidates[left].contribution}`;
      const rightBody = `${parsedCandidates[right].researchQuestion} ${parsedCandidates[right].mechanismTheory} ${parsedCandidates[right].methodDesign} ${parsedCandidates[right].contribution}`;
      if (jaccard(normalizedTokens(leftBody), normalizedTokens(rightBody)) >= 0.78) return { ok: false, code: "research_candidates_not_distinct", stage: "CANDIDATE_DISTINCTNESS", recoverableFields: [`candidates.${left}`, `candidates.${right}`] };
      if (s0CoreSignature(parsedCandidates[left].s0Draft) === s0CoreSignature(parsedCandidates[right].s0Draft)) return { ok: false, code: "research_s0_drafts_not_distinct", stage: "CANDIDATE_DISTINCTNESS", recoverableFields: [`candidates.${left}.s0Draft`, `candidates.${right}.s0Draft`] };
    }
  }
  const inputHash = sha256Canonical({ contractVersion: RESEARCH_START_CONTRACT_VERSION, ...request, idempotencyKey: undefined });
  const recommendedLane = value.recommendedLane as ResearchPlanLane;
  const candidates = parsedCandidates.map((candidate) => {
    const candidateId = `topic_${candidate.lane.toLowerCase()}_${sha256Canonical({ inputHash, lane: candidate.lane }).slice(0, 16)}`;
    const body = { ...candidate, candidateId, recommended: candidate.lane === recommendedLane };
    return { ...body, candidateHash: sha256Canonical(body) };
  });
  const recommendedCandidateId = candidates.find((candidate) => candidate.recommended)?.candidateId;
  if (!recommendedCandidateId) return { ok: false, code: "research_recommendation_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["recommendedLane"] };
  return { ok: true, value: { contractVersion: RESEARCH_START_CONTRACT_VERSION, recommendedCandidateId, recommendationRationale: rationale, candidates } };
}
