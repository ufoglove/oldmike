import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import {
  RESEARCH_PLAN_LANES,
  RESEARCH_SOURCE_STRATEGIES,
  normalizeResearchStartRequest,
  type ResearchPlanCandidate,
  type ResearchPlanEnvelope,
  type ResearchPlanLane,
  type ResearchSourceStrategy,
  type ResearchStartRequest,
} from "./research-start-contract.ts";

export const TOPIC_LAB_CONTRACT_VERSION = "1.5.30-c2r4";
export const TOPIC_LAB_SCORING_VERSION = "topic-lab-frontier-radar/1.1.0";
export const TOPIC_LAB_SOURCE_MODES = RESEARCH_SOURCE_STRATEGIES;
export const TOPIC_LAB_CLASSIFICATIONS = ["CURRENT_HOT", "EMERGING", "OPTIONAL_CONTRARIAN_GAP", "INSUFFICIENT_EVIDENCE"] as const;

export type TopicLabSourceMode = ResearchSourceStrategy;
export type TopicLabClassification = (typeof TOPIC_LAB_CLASSIFICATIONS)[number];
export type TopicLabRequestedGroup = Exclude<TopicLabClassification, "INSUFFICIENT_EVIDENCE">;

export type TopicLabAnalyzeRequest = ResearchStartRequest;

export type TopicLabGateRequest = {
  operation: "APPROVE_CANDIDATE";
  idempotencyKey: string;
  runId: string;
  candidateId: string;
  candidateHash: string;
  rationale: string;
};

export type TopicLabPromoteRequest = {
  operation: "PROMOTE_CANDIDATE";
  idempotencyKey: string;
  runId: string;
  candidateId: string;
  candidateHash: string;
  humanGateId: string;
};

export type TopicLabRequest = TopicLabAnalyzeRequest | TopicLabGateRequest | TopicLabPromoteRequest;

export type TopicLabSourceObservation = {
  observationId: string;
  provider: "OPENALEX" | "CROSSREF" | "SEMANTIC_SCHOLAR" | "CONSENSUS" | "MANUAL_PUBLIC_HTTPS";
  providerKey: string;
  queryHash: string;
  window: { from: string; to: string };
  title: string;
  publishedAt: string | null;
  retrievedAt: string;
  doi: string | null;
  citationCount: number | null;
  urlHash: string;
  status: "UNVERIFIED";
};

export type TopicLabObservationProviderResult = {
  contractVersion: "topic-lab-observation-provider/1.0.0";
  observations: TopicLabSourceObservation[];
};

export type TopicLabSignalValue = {
  value: number | null;
  basis: "OBSERVATION_DERIVED" | "USER_CONSTRAINT_PROXY" | "NOT_AVAILABLE";
};

export type TopicLabSignals = {
  recency: TopicLabSignalValue;
  momentum: TopicLabSignalValue;
  evidenceVolume: TopicLabSignalValue;
  sourceDiversity: TopicLabSignalValue;
  noveltyProxy: TopicLabSignalValue;
  feasibility: TopicLabSignalValue;
  saturationRisk: TopicLabSignalValue;
};

export type TopicLabCandidate = ResearchPlanCandidate & {
  requestedLane: ResearchPlanLane;
  requestedGroup: TopicLabRequestedGroup;
  classification: TopicLabClassification;
  observedClassification: "READY" | "INSUFFICIENT_EVIDENCE";
  hypothesisCandidate: string;
  novelty: string;
  dataMethods: string[];
  risks: string[];
  professionalAdvice: string;
  evidenceDate: string;
  evidenceWindow: string;
  sourceCount: number;
  sourceDiversity: number;
  scoringMethod: string;
  uncertainty: string;
  signals: TopicLabSignals;
  observationIds: string[];
  candidateHash: string;
};

export type TopicLabProvenance = {
  observationId: string;
  provider: TopicLabSourceObservation["provider"];
  providerKey: string;
  queryHash: string;
  window: { from: string; to: string };
  title: string;
  publishedAt: string | null;
  retrievedAt: string;
  doi: string | null;
  citationCount: number | null;
  urlHash: string;
  status: "UNVERIFIED";
  includedInScoring: boolean;
  exclusionReason: "NONE" | "DUPLICATE_DOI" | "DUPLICATE_PROVIDER_KEY" | "OUTSIDE_WINDOW" | "INVALID_DATE" | "PROMPT_INJECTION_ISOLATED";
};

export type TopicLabAnalysis = {
  contractVersion: typeof TOPIC_LAB_CONTRACT_VERSION;
  scoringVersion: typeof TOPIC_LAB_SCORING_VERSION;
  status: "READY" | "INSUFFICIENT_EVIDENCE";
  sourcePolicy: TopicLabSourceMode;
  sourceStatus: "UNVERIFIED";
  inputHash: string;
  resultHash: string;
  evidenceDate: string;
  evidenceWindow: string;
  method: string;
  uncertainty: string;
  observations: TopicLabProvenance[];
  candidates: TopicLabCandidate[];
  recommendedCandidateId: string;
  recommendationRationale: string;
};

export class TopicLabContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "TopicLabContractError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function cleanText(value: unknown, maxLength: number, required = true) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (cleaned.length > maxLength || (required && !cleaned)) return "";
  return cleaned;
}

function textArray(value: unknown, maxItems: number, itemLimit: number) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const output = value.map((item) => cleanText(item, itemLimit)).filter(Boolean);
  return output.length === value.length ? output : null;
}

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? "" : value;
}

function parseId(value: unknown, code: string) {
  const parsed = cleanText(value, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(parsed)) throw new TopicLabContractError(code);
  return parsed;
}

function parseHash(value: unknown, code: string) {
  const parsed = cleanText(value, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(parsed)) throw new TopicLabContractError(code);
  return parsed;
}

function parseSourceUrl(value: unknown) {
  const raw = cleanText(value, 2048);
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
    const privateIpv4 = ipv4 && (ipv4.some((part) => part < 0 || part > 255) || ipv4[0] === 10 || ipv4[0] === 127 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168));
    const privateHost = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal" || host === "169.254.169.254" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || Boolean(privateIpv4);
    const restrictedPath = /\/(?:login|log-in|signin|sign-in|auth|oauth|session|account)(?:\/|$)/i.test(url.pathname);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash || privateHost || restrictedPath) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function parseTopicLabRequest(value: unknown): TopicLabRequest {
  if (!record(value) || typeof value.operation !== "string") throw new TopicLabContractError("invalid_topic_lab_input");
  if (value.operation === "ANALYZE") {
    try { return normalizeResearchStartRequest(value); }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && "status" in error) throw new TopicLabContractError(String(error.code), Number(error.status));
      throw new TopicLabContractError("invalid_topic_lab_input");
    }
  }
  if (value.operation === "APPROVE_CANDIDATE") {
    if (!exactKeys(value, ["operation", "idempotencyKey", "runId", "candidateId", "candidateHash", "rationale"])) throw new TopicLabContractError("invalid_topic_lab_gate_shape");
    const rationale = cleanText(value.rationale, 1000);
    if (!rationale) throw new TopicLabContractError("human_gate_rationale_required");
    return { operation: value.operation, idempotencyKey: parseId(value.idempotencyKey, "invalid_idempotency_key"), runId: parseId(value.runId, "invalid_run_id"), candidateId: parseId(value.candidateId, "invalid_candidate_id"), candidateHash: parseHash(value.candidateHash, "invalid_candidate_hash"), rationale };
  }
  if (value.operation === "PROMOTE_CANDIDATE") {
    if (!exactKeys(value, ["operation", "idempotencyKey", "runId", "candidateId", "candidateHash", "humanGateId"])) throw new TopicLabContractError("invalid_topic_lab_promotion_shape");
    return { operation: value.operation, idempotencyKey: parseId(value.idempotencyKey, "invalid_idempotency_key"), runId: parseId(value.runId, "invalid_run_id"), candidateId: parseId(value.candidateId, "invalid_candidate_id"), candidateHash: parseHash(value.candidateHash, "invalid_candidate_hash"), humanGateId: parseId(value.humanGateId, "invalid_human_gate_id") };
  }
  throw new TopicLabContractError("unsupported_topic_lab_operation", 422);
}

export function parseTopicLabObservationProviderResult(value: unknown): TopicLabObservationProviderResult {
  if (!record(value) || !exactKeys(value, ["contractVersion", "observations"]) || value.contractVersion !== "topic-lab-observation-provider/1.0.0" || !Array.isArray(value.observations) || value.observations.length > 40) throw new TopicLabContractError("invalid_observation_provider_result", 502);
  const observations = value.observations.map((item) => {
    if (!record(item) || !exactKeys(item, ["observationId", "provider", "providerKey", "queryHash", "window", "title", "publishedAt", "retrievedAt", "doi", "citationCount", "urlHash", "status"])) throw new TopicLabContractError("invalid_observation_provider_shape", 502);
    const observationId = parseId(item.observationId, "invalid_observation_id");
    if (!["OPENALEX", "CROSSREF", "SEMANTIC_SCHOLAR", "CONSENSUS", "MANUAL_PUBLIC_HTTPS"].includes(String(item.provider))) throw new TopicLabContractError("invalid_observation_provider_value", 502);
    const providerKey = parseHash(item.providerKey, "invalid_observation_provider_key");
    const queryHash = parseHash(item.queryHash, "invalid_observation_query_hash");
    if (!record(item.window) || !exactKeys(item.window, ["from", "to"])) throw new TopicLabContractError("invalid_observation_window", 502);
    const from = parseIsoDate(item.window.from); const to = parseIsoDate(item.window.to);
    const title = cleanText(item.title, 300);
    const publishedAt = item.publishedAt === null ? null : parseIsoDate(item.publishedAt);
    const retrievedAt = cleanText(item.retrievedAt, 40);
    const doi = item.doi === null ? null : cleanText(item.doi, 300).toLowerCase();
    const citationCount = item.citationCount === null ? null : Number(item.citationCount);
    if (!providerKey || !from || !to || from > to || !title || (item.publishedAt !== null && !publishedAt) || Number.isNaN(new Date(retrievedAt).getTime()) || (doi !== null && !/^10\.\d{4,9}\/.+/u.test(doi)) || (citationCount !== null && (!Number.isInteger(citationCount) || citationCount < 0)) || item.status !== "UNVERIFIED") throw new TopicLabContractError("invalid_observation_provider_value", 502);
    return { observationId, provider: item.provider as TopicLabSourceObservation["provider"], providerKey, queryHash, window: { from, to }, title, publishedAt, retrievedAt: new Date(retrievedAt).toISOString(), doi, citationCount, urlHash: parseHash(item.urlHash, "invalid_observation_url_hash"), status: "UNVERIFIED" as const };
  });
  return { contractVersion: value.contractVersion, observations };
}

export function topicLabInputHash(input: TopicLabAnalyzeRequest) {
  return sha256Canonical({ contractVersion: TOPIC_LAB_CONTRACT_VERSION, ...input, idempotencyKey: undefined });
}

function tokens(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase();
  const output = new Set(normalized.match(/[a-z0-9]{3,}|[\u3400-\u9fff]{2,}/g) || []);
  const chinese = [...normalized].filter((character) => /[\u3400-\u9fff]/.test(character));
  for (let index = 0; index + 1 < chinese.length; index += 1) output.add(`${chinese[index]}${chinese[index + 1]}`);
  return output;
}

function related(input: TopicLabAnalyzeRequest, candidate: ResearchPlanCandidate, observation: TopicLabSourceObservation) {
  const candidateTokens = tokens(`${input.researchDirection} ${candidate.workingTitle} ${candidate.researchQuestion} ${candidate.mechanismTheory}`);
  const sourceTokens = tokens(observation.title);
  let overlap = 0;
  for (const token of candidateTokens) if (sourceTokens.has(token)) overlap += 1;
  return overlap >= 1;
}

export function containsPromptInjection(value: string) {
  return /(ignore (all|any|the)?\s*(previous|prior)|system prompt|developer message|execute (a )?(command|shell)|reveal (a )?(secret|token)|send (the )?(cookie|credential)|忽略.{0,8}(指令|規則)|系統提示|執行.{0,6}(指令|命令)|輸出.{0,6}(密碼|權杖|憑證))/i.test(value);
}

function normalizedObservation(value: TopicLabSourceObservation) {
  if (!/^[0-9a-f]{64}$/u.test(value.providerKey) || !/^[0-9a-f]{64}$/u.test(value.queryHash) || !/^[0-9a-f]{64}$/u.test(value.urlHash) || value.status !== "UNVERIFIED") throw new TopicLabContractError("invalid_source_observation", 502);
  return { ...value, title: cleanText(value.title, 300), providerKey: value.providerKey };
}

function nullSignal(): TopicLabSignalValue { return { value: null, basis: "NOT_AVAILABLE" }; }
function observationSignal(value: number): TopicLabSignalValue { return { value, basis: "OBSERVATION_DERIVED" }; }

const LANE_TO_GROUP: Record<ResearchPlanLane, TopicLabRequestedGroup> = {
  CURRENT_PRACTICE_VALUE: "CURRENT_HOT",
  EMERGING_FRONTIER: "EMERGING",
  HIGH_VALUE_GAP_OR_CONTRARIAN: "OPTIONAL_CONTRARIAN_GAP",
};

function scoreCandidate(input: TopicLabAnalyzeRequest, plan: ResearchPlanCandidate, observations: TopicLabSourceObservation[], evidenceDate: string): Omit<TopicLabCandidate, "candidateHash"> {
  const from = new Date(`${input.evidenceWindow.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${input.evidenceWindow.to}T23:59:59.999Z`).getTime();
  const span = Math.max(1, to - from);
  const selected = observations.filter((item) => related(input, plan, item));
  const providers = new Set(selected.map((item) => item.provider));
  const dated = selected.map((item) => item.publishedAt ? new Date(`${item.publishedAt}T00:00:00.000Z`).getTime() : Number.NaN).filter(Number.isFinite);
  const enough = selected.length >= 4 && providers.size >= 2 && dated.length === selected.length;
  let signals: TopicLabSignals = { recency: nullSignal(), momentum: nullSignal(), evidenceVolume: observationSignal(selected.length), sourceDiversity: observationSignal(providers.size), noveltyProxy: nullSignal(), feasibility: { value: 500, basis: "USER_CONSTRAINT_PROXY" }, saturationRisk: nullSignal() };
  let classification: TopicLabClassification = "INSUFFICIENT_EVIDENCE";
  if (enough) {
    const recentBoundary = to - span / 3;
    const priorBoundary = to - (span * 2) / 3;
    const recent = dated.filter((date) => date >= recentBoundary).length;
    const prior = dated.filter((date) => date >= priorBoundary && date < recentBoundary).length;
    const recency = Math.round(dated.reduce((sum, date) => sum + Math.max(0, Math.min(1, (date - from) / span)), 0) / dated.length * 1000);
    const momentum = recent + prior > 0 ? Math.round(recent / (recent + prior) * 1000) : 0;
    const diversity = Math.min(1000, providers.size * 400);
    const novelty = Math.round(recent / selected.length * 1000);
    const feasibility = input.advanced.method ? 700 : 500;
    const volumeScore = Math.min(1000, selected.length * 100);
    const saturation = Math.round(volumeScore * 0.6 + (1000 - momentum) * 0.4);
    signals = {
      recency: observationSignal(recency), momentum: observationSignal(momentum), evidenceVolume: observationSignal(selected.length), sourceDiversity: observationSignal(providers.size), noveltyProxy: observationSignal(novelty),
      feasibility: { value: feasibility, basis: "USER_CONSTRAINT_PROXY" }, saturationRisk: observationSignal(saturation),
    };
    if (plan.lane === "CURRENT_PRACTICE_VALUE" && selected.length >= 6 && recency >= 500 && diversity >= 600) classification = "CURRENT_HOT";
    if (plan.lane === "EMERGING_FRONTIER" && recency >= 600 && momentum >= 550 && novelty >= 550 && diversity >= 600 && saturation <= 750) classification = "EMERGING";
    if (plan.lane === "HIGH_VALUE_GAP_OR_CONTRARIAN" && selected.length >= 4 && diversity >= 600) classification = "OPTIONAL_CONTRARIAN_GAP";
  }
  const requestedGroup = LANE_TO_GROUP[plan.lane];
  return {
    ...plan,
    requestedLane: plan.lane,
    requestedGroup,
    classification,
    observedClassification: classification === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "READY",
    hypothesisCandidate: `${plan.researchQuestion}；方向、效果與替代解釋均須由研究者與資料檢驗。`,
    novelty: classification === "INSUFFICIENT_EVIDENCE" ? "尚無足夠正規化來源支持熱門、新興或缺口判定。" : "趨勢分類只來自日期、跨提供者量與動能 proxy，不代表已證明新穎性。",
    dataMethods: [plan.methodDesign, plan.dataPlan],
    risks: [plan.riskEthics, ...plan.unresolvedItems],
    professionalAdvice: plan.researchValue,
    evidenceDate,
    evidenceWindow: `${input.evidenceWindow.from}/${input.evidenceWindow.to}`,
    sourceCount: selected.length,
    sourceDiversity: providers.size,
    scoringMethod: TOPIC_LAB_SCORING_VERSION,
    uncertainty: classification === "INSUFFICIENT_EVIDENCE" ? "來源數、日期完整性或跨來源多樣性不足；不得推定熱門、新興或學術價值。" : "分類是未驗證來源的確定性 proxy，不等於學術價值、新穎性或因果證據。",
    signals,
    observationIds: selected.map((item) => item.observationId).sort(),
  };
}

export function analyzeTopicLab(input: TopicLabAnalyzeRequest, rawObservations: TopicLabSourceObservation[], observedAt: Date, plans: ResearchPlanEnvelope): TopicLabAnalysis {
  if (plans.candidates.length !== RESEARCH_PLAN_LANES.length || plans.candidates.some((candidate, index) => candidate.lane !== RESEARCH_PLAN_LANES[index])) throw new TopicLabContractError("research_plan_binding_invalid", 502);
  const observations = rawObservations.map(normalizedObservation);
  const seenDoi = new Set<string>();
  const seenProviderKey = new Set<string>();
  const included: TopicLabSourceObservation[] = [];
  const provenance: TopicLabProvenance[] = [];
  const from = new Date(`${input.evidenceWindow.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${input.evidenceWindow.to}T23:59:59.999Z`).getTime();
  for (const observation of observations) {
    const providerKey = `${observation.provider}:${observation.providerKey}`;
    const published = observation.publishedAt ? new Date(`${observation.publishedAt}T00:00:00.000Z`).getTime() : Number.NaN;
    let reason: TopicLabProvenance["exclusionReason"] = "NONE";
    if (containsPromptInjection(observation.title)) reason = "PROMPT_INJECTION_ISOLATED";
    else if (observation.doi && seenDoi.has(observation.doi)) reason = "DUPLICATE_DOI";
    else if (seenProviderKey.has(providerKey)) reason = "DUPLICATE_PROVIDER_KEY";
    else if (!Number.isFinite(published)) reason = "INVALID_DATE";
    else if (published < from || published > to) reason = "OUTSIDE_WINDOW";
    if (observation.doi) seenDoi.add(observation.doi);
    seenProviderKey.add(providerKey);
    if (reason === "NONE") included.push(observation);
    provenance.push({ observationId: observation.observationId, provider: observation.provider, providerKey: observation.providerKey, queryHash: observation.queryHash, window: observation.window, title: observation.title, publishedAt: observation.publishedAt, retrievedAt: observation.retrievedAt, doi: observation.doi, citationCount: observation.citationCount, urlHash: observation.urlHash, status: "UNVERIFIED", includedInScoring: reason === "NONE", exclusionReason: reason });
  }
  const evidenceDate = observedAt.toISOString().slice(0, 10);
  const candidates = plans.candidates.map((plan) => {
    const candidate = scoreCandidate(input, plan, included, evidenceDate);
    return { ...candidate, candidateHash: sha256Canonical(candidate) };
  });
  if (candidates.every((candidate) => candidate.observedClassification === "INSUFFICIENT_EVIDENCE")) {
    const unsupportedTrendClaim = /(?:熱門(?:趨勢|主題)?|已證明(?:新穎|前沿)|具(?:有)?新穎性|新興趨勢|\bhot\s+(?:topic|trend)\b|\bnovel(?:ty)?\s+(?:is|has|proven)\b)/iu;
    const explicitUncertaintyOrNegation = /(?:尚無(?:足夠)?證據|證據(?:仍)?不足|未(?:經)?證實|尚未|並非|不是|不屬於|不一定|未必|不得|不能|無法|不足以|待驗證|尚待(?:核對|驗證)|不確定|\bno\s+evidence\b|\binsufficient\s+evidence\b|\bnot\b|\bunverified\b|\bunproven\b|\buncertain\b|\bcannot\b|\bmust\s+not\b)/iu;
    const assertsUnsupportedTrend = (value: string) => value
      .split(/[，,；;。.!?！？]|(?:但是|然而|不過)|\b(?:but|however|yet)\b/iu)
      .some((clause) => unsupportedTrendClaim.test(clause) && !explicitUncertaintyOrNegation.test(clause));
    const planProse = [plans.recommendationRationale, ...plans.candidates.flatMap((candidate) => [candidate.researchValue, candidate.contribution, candidate.nextAction])];
    if (planProse.some(assertsUnsupportedTrend)) throw new TopicLabContractError("unsupported_trend_claim_without_evidence", 502);
  }
  const body = {
    contractVersion: TOPIC_LAB_CONTRACT_VERSION as typeof TOPIC_LAB_CONTRACT_VERSION,
    scoringVersion: TOPIC_LAB_SCORING_VERSION as typeof TOPIC_LAB_SCORING_VERSION,
    status: candidates.some((candidate) => candidate.classification !== "INSUFFICIENT_EVIDENCE") ? "READY" as const : "INSUFFICIENT_EVIDENCE" as const,
    sourcePolicy: input.sourceStrategy,
    sourceStatus: "UNVERIFIED" as const,
    inputHash: topicLabInputHash(input),
    evidenceDate,
    evidenceWindow: `${input.evidenceWindow.from}/${input.evidenceWindow.to}`,
    method: "依 DOI、提供者鍵去重正規化書目觀測；以日期、跨提供者觀測量、動能與飽和 proxy 分離 requested lane 與 observed classification；不保留 raw body。",
    uncertainty: "觀測與老麥方案分離；來源維持 UNVERIFIED，證據不足時三個概念 lane 仍可比較，但不得宣稱熱門、新興或新穎性。",
    observations: provenance,
    candidates,
    recommendedCandidateId: plans.recommendedCandidateId,
    recommendationRationale: plans.recommendationRationale,
  };
  return { ...body, resultHash: sha256Canonical(body) };
}

export function topicLabCandidateArtifactId(runId: string, candidateId: string) {
  return `${runId}:${candidateId}`;
}

export function candidateFromAnalysis(analysis: TopicLabAnalysis, candidateId: string, candidateHash: string) {
  const candidate = analysis.candidates.find((item) => item.candidateId === candidateId);
  if (!candidate || candidate.candidateHash !== candidateHash) throw new TopicLabContractError("candidate_binding_mismatch", 409);
  return candidate;
}
