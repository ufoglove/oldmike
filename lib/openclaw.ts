import "server-only";

import type { ResolvedModelRoute } from "./model-route-catalog.ts";
import { RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES, RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS, TOPIC_LAB_OUTPUT_LIMIT_BYTES, TOPIC_LAB_PROVIDER_TIMEOUT_MS } from "./topic-lab-runtime-contract.ts";

export type OpenClawMessage = { role: "system" | "user" | "assistant"; content: string };
export type OpenClawChatOperation = "M01_TOPIC_LAB" | "M01_RESEARCH_DIRECTIONS" | "M01_RESEARCH_S0_EXPAND" | "M01_S0_DRAFT" | "M01_HORIZON" | "M01_EVIDENCE" | "M01_FIELD" | "M01_WEB_PREVIEW" | "ACADEMIC_LANGUAGE" | "REVIEW_STUDIO" | "JOURNAL_SUBMISSION" | "PROJECT_CHAT" | "PROPOSAL_GUIDANCE" | "ASSIST_S0" | "ASSIST_M01" | "ASSIST_M02" | "ASSIST_M03" | "ASSIST_M04" | "ASSIST_M05_BILINGUAL" | "ASSIST_M05_RATIONALE" | "ASSIST_M05_METHODS" | "ASSIST_M05_MODE" | "ASSIST_M05_EXECUTION" | "ASSIST_M05_BUDGET" | "ASSIST_RESEARCH_DESIGN" | "ASSIST_RESEARCH_CLAIM" | "ASSIST_RESEARCH_DOCUMENT" | "ONE_CLICK_INSPIRATION" | "SUBMISSION_NAVIGATOR" | "ASSIST_ETHICS_DRAFT" | "ASSIST_ROUTE_SECTION" | "ASSIST_REVIEWER_SIMULATION" | "ASSIST_LITERATURE_REVIEW" | "ASSIST_GAP_ANALYSIS" | "ASSIST_THEORY_ANALYSIS" | "ASSIST_DESIGN_ANALYSIS";

export const openClawChatOperationContracts: Readonly<Record<OpenClawChatOperation, Readonly<{ endpointFamily: "CHAT_COMPLETIONS"; endpointFeatureState: "ENABLED" }>>> = Object.freeze({
  M01_TOPIC_LAB: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_RESEARCH_DIRECTIONS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_RESEARCH_S0_EXPAND: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_S0_DRAFT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_HORIZON: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_EVIDENCE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_FIELD: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  M01_WEB_PREVIEW: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ACADEMIC_LANGUAGE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  REVIEW_STUDIO: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  JOURNAL_SUBMISSION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  PROJECT_CHAT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  PROPOSAL_GUIDANCE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_S0: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M01: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M02: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M03: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M04: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_BILINGUAL: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_RATIONALE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_METHODS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_MODE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_EXECUTION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_M05_BUDGET: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_RESEARCH_DESIGN: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_RESEARCH_CLAIM: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_RESEARCH_DOCUMENT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ONE_CLICK_INSPIRATION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  SUBMISSION_NAVIGATOR: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_ETHICS_DRAFT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_ROUTE_SECTION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_REVIEWER_SIMULATION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_LITERATURE_REVIEW: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_GAP_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_THEORY_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_DESIGN_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
});

export type OpenClawCallResult =
  | { kind: "demo" }
  | { kind: "not-configured" }
  | { kind: "invalid-config" }
  | { kind: "upstream-error" }
  | { kind: "success"; content: string };

export type OpenClawChatCompletionProtocolResult =
  | { kind: "success"; content: string }
  | { kind: "proven-not-submitted"; code: "configuration_missing" | "configuration_invalid" | "request_invalid" | "canceled_before_submission" }
  | { kind: "terminal-rejected"; code: "http_rejected" | "content_type_rejected" | "body_rejected" | "response_shape_invalid"; evidence: OpenClawFailureEvidence }
  | { kind: "completion-unknown"; code: "provider_deadline" | "caller_cancel" | "transport_failure_before_headers" | "transport_failure_after_headers"; evidence: OpenClawFailureEvidence };

export type OpenClawFailureReason =
  | "PROVIDER_DEADLINE"
  | "CALLER_CANCEL"
  | "TRANSPORT_FAILURE_BEFORE_HEADERS"
  | "TRANSPORT_FAILURE_AFTER_HEADERS"
  | "UPSTREAM_HTTP_REJECTED"
  | "CONTENT_TYPE_REJECTED"
  | "BODY_REJECTED"
  | "RESPONSE_SHAPE_REJECTED";
export type OpenClawElapsedBucket = "LT_1S" | "S1_TO_LT_5S" | "S5_TO_LT_20S" | "S20_TO_LT_60S" | "GE_60S";
export type OpenClawProviderAttemptClass = "SUBMISSION_POSSIBLE" | "RESPONSE_HEADERS_RECEIVED" | "RESPONSE_COMPLETE";
export type OpenClawFailureEvidence = Readonly<{
  reasonEnum: OpenClawFailureReason;
  elapsedBucket: OpenClawElapsedBucket;
  providerAttemptClass: OpenClawProviderAttemptClass;
}>;

type OpenClawAbortReason = "PROVIDER_DEADLINE" | "CALLER_CANCEL";

class BoundedBodyRejection extends Error {
  constructor() {
    super("bounded_body_rejected");
    this.name = "BoundedBodyRejection";
  }
}

export type OpenClawProtocolRoute = Omit<ResolvedModelRoute, "operation"> & { operation: OpenClawChatOperation };

export function isPrivateGatewayUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isZeaburServiceHostname = /^service-[a-f0-9]{24}$/.test(hostname);
    const isPrivateHostname = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".zeabur.internal") || isZeaburServiceHostname;
    return url.protocol === "http:" && isPrivateHostname && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
  } catch {
    return false;
  }
}

export function normalizePrivateGatewayBaseUrl(value: string) {
  if (!isPrivateGatewayUrl(value)) return null;
  return new URL(value).toString().replace(/\/$/u, "");
}

async function readBounded(response: Response, maximumBytes: number) {
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new BoundedBodyRejection();
  }
  if (!response.body) throw new BoundedBodyRejection();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximumBytes) { await reader.cancel().catch(() => undefined); throw new BoundedBodyRejection(); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

const existingOperationDefaultRoute = Object.freeze({
  routeProfile: "OLD_MIKE_DEFAULT",
  upstreamBehavior: "DEFER_TO_EXISTING_DEFAULT",
  modelOverride: null,
  inputLimitBytes: 48_000,
  outputLimitBytes: 64_000,
  timeoutMs: 20_000,
  endpointFamily: "CHAT_COMPLETIONS",
  endpointFeatureState: "ENABLED",
} as const);

const OPENCLAW_DEFAULT_AGENT_ALIAS = "openclaw/default";

function elapsedBucket(startedAt: number): OpenClawElapsedBucket {
  const elapsed = Math.max(0, performance.now() - startedAt);
  if (elapsed < 1_000) return "LT_1S";
  if (elapsed < 5_000) return "S1_TO_LT_5S";
  if (elapsed < 20_000) return "S5_TO_LT_20S";
  if (elapsed < 60_000) return "S20_TO_LT_60S";
  return "GE_60S";
}

function failureEvidence(startedAt: number, reasonEnum: OpenClawFailureReason, providerAttemptClass: OpenClawProviderAttemptClass): OpenClawFailureEvidence {
  return Object.freeze({ reasonEnum, elapsedBucket: elapsedBucket(startedAt), providerAttemptClass });
}

function createAbortCauseTracker(callerSignal: AbortSignal | undefined, timeoutSignal: AbortSignal) {
  let firstReason: OpenClawAbortReason | null = null;
  const markCaller = () => { firstReason ??= "CALLER_CANCEL"; };
  const markDeadline = () => { firstReason ??= "PROVIDER_DEADLINE"; };
  callerSignal?.addEventListener("abort", markCaller, { once: true });
  timeoutSignal.addEventListener("abort", markDeadline, { once: true });
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
  return {
    signal,
    firstReason: () => firstReason,
    dispose: () => {
      callerSignal?.removeEventListener("abort", markCaller);
      timeoutSignal.removeEventListener("abort", markDeadline);
    },
  };
}

function abortCompletionUnknown(startedAt: number, reason: OpenClawAbortReason, providerAttemptClass: OpenClawProviderAttemptClass): OpenClawChatCompletionProtocolResult {
  return reason === "CALLER_CANCEL"
    ? { kind: "completion-unknown", code: "caller_cancel", evidence: failureEvidence(startedAt, reason, providerAttemptClass) }
    : { kind: "completion-unknown", code: "provider_deadline", evidence: failureEvidence(startedAt, reason, providerAttemptClass) };
}

export function resolveDefaultOpenClawOperationRoute(operation: OpenClawChatOperation): OpenClawProtocolRoute {
  return {
    ...existingOperationDefaultRoute,
    ...(operation === "M01_TOPIC_LAB" ? { timeoutMs: TOPIC_LAB_PROVIDER_TIMEOUT_MS, outputLimitBytes: TOPIC_LAB_OUTPUT_LIMIT_BYTES } : {}),
    ...(["M01_RESEARCH_DIRECTIONS", "M01_RESEARCH_S0_EXPAND"].includes(operation) ? { timeoutMs: RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS, outputLimitBytes: RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES } : {}),
    modeProfile: "AUTO",
    operation,
    featureState: "ENABLED",
    costBucket: "MEDIUM",
  };
}

function validMessages(messages: OpenClawMessage[]) {
  return Array.isArray(messages) && messages.length > 0 && messages.length <= 64 && messages.every((message) =>
    message && ["system", "user", "assistant"].includes(message.role) && typeof message.content === "string" && message.content.length > 0 && message.content.length <= 48_000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message.content),
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function executeOpenClawChatCompletion(input: {
  messages: OpenClawMessage[];
  sessionKey: string;
  operation: OpenClawChatOperation;
  route: OpenClawProtocolRoute;
  baseUrl: string | undefined;
  bearerToken: string | undefined;
  signal?: AbortSignal;
}): Promise<OpenClawChatCompletionProtocolResult> {
  const operationContract = openClawChatOperationContracts[input.operation];
  if (!input.baseUrl || !input.bearerToken) return { kind: "proven-not-submitted", code: "configuration_missing" };
  const baseUrl = normalizePrivateGatewayBaseUrl(input.baseUrl);
  if (
    !baseUrl ||
    typeof input.bearerToken !== "string" || input.bearerToken.length < 16 || input.bearerToken.length > 4_096 || /[\u0000-\u001f\u007f]/u.test(input.bearerToken)
  ) return { kind: "proven-not-submitted", code: "configuration_invalid" };
  if (
    input.route.routeProfile !== "OLD_MIKE_DEFAULT" ||
    input.route.upstreamBehavior !== "DEFER_TO_EXISTING_DEFAULT" ||
    input.route.modelOverride !== null ||
    input.route.operation !== input.operation ||
    input.route.endpointFamily !== operationContract?.endpointFamily ||
    input.route.endpointFeatureState !== operationContract?.endpointFeatureState ||
    !validMessages(input.messages) ||
    typeof input.sessionKey !== "string" || input.sessionKey.length < 8 || input.sessionKey.length > 256 || /[\u0000-\u001f\u007f]/u.test(input.sessionKey)
  ) return { kind: "proven-not-submitted", code: "request_invalid" };
  if (input.signal?.aborted) return { kind: "proven-not-submitted", code: "canceled_before_submission" };

  const body = JSON.stringify({
    model: OPENCLAW_DEFAULT_AGENT_ALIAS,
    messages: input.messages,
    stream: false,
    user: input.sessionKey,
    max_tokens: 8192,
  });
  if (Buffer.byteLength(body, "utf8") > input.route.inputLimitBytes) return { kind: "proven-not-submitted", code: "request_invalid" };

  const startedAt = performance.now();
  const timeoutSignal = AbortSignal.timeout(input.route.timeoutMs);
  const abortCause = createAbortCauseTracker(input.signal, timeoutSignal);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.bearerToken}`, "Content-Type": "application/json" },
        body,
        signal: abortCause.signal,
        cache: "no-store",
        redirect: "manual",
      });
    } catch {
      const reason = abortCause.firstReason();
      if (reason) return abortCompletionUnknown(startedAt, reason, "SUBMISSION_POSSIBLE");
      return { kind: "completion-unknown", code: "transport_failure_before_headers", evidence: failureEvidence(startedAt, "TRANSPORT_FAILURE_BEFORE_HEADERS", "SUBMISSION_POSSIBLE") };
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      return { kind: "terminal-rejected", code: "http_rejected", evidence: failureEvidence(startedAt, "UPSTREAM_HTTP_REJECTED", "RESPONSE_HEADERS_RECEIVED") };
    }
    if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      await response.body?.cancel().catch(() => undefined);
      return { kind: "terminal-rejected", code: "content_type_rejected", evidence: failureEvidence(startedAt, "CONTENT_TYPE_REJECTED", "RESPONSE_HEADERS_RECEIVED") };
    }
    let raw: string;
    try {
      raw = await readBounded(response, input.route.outputLimitBytes);
    } catch (error) {
      if (error instanceof BoundedBodyRejection) return { kind: "terminal-rejected", code: "body_rejected", evidence: failureEvidence(startedAt, "BODY_REJECTED", "RESPONSE_HEADERS_RECEIVED") };
      const reason = abortCause.firstReason();
      if (reason) return abortCompletionUnknown(startedAt, reason, "RESPONSE_HEADERS_RECEIVED");
      return { kind: "completion-unknown", code: "transport_failure_after_headers", evidence: failureEvidence(startedAt, "TRANSPORT_FAILURE_AFTER_HEADERS", "RESPONSE_HEADERS_RECEIVED") };
    }
    let data: unknown;
    try { data = JSON.parse(raw) as unknown; }
    catch { return { kind: "terminal-rejected", code: "response_shape_invalid", evidence: failureEvidence(startedAt, "RESPONSE_SHAPE_REJECTED", "RESPONSE_COMPLETE") }; }
    if (!record(data) || data.object !== "chat.completion" || !Array.isArray(data.choices) || data.choices.length !== 1) return { kind: "terminal-rejected", code: "response_shape_invalid", evidence: failureEvidence(startedAt, "RESPONSE_SHAPE_REJECTED", "RESPONSE_COMPLETE") };
    const choice = data.choices[0];
    if (!record(choice) || choice.index !== 0 || choice.finish_reason !== "stop" || !record(choice.message) || choice.message.role !== "assistant" || typeof choice.message.content !== "string") return { kind: "terminal-rejected", code: "response_shape_invalid", evidence: failureEvidence(startedAt, "RESPONSE_SHAPE_REJECTED", "RESPONSE_COMPLETE") };
    const content = choice.message.content.trim();
    return content ? { kind: "success", content } : { kind: "terminal-rejected", code: "response_shape_invalid", evidence: failureEvidence(startedAt, "RESPONSE_SHAPE_REJECTED", "RESPONSE_COMPLETE") };
  } finally {
    abortCause.dispose();
  }
}


// ===== 主備援熔斷保護 =====
// vectide Coding Plan：5 小時 1000 次調用、每週 10000 次。429/402（額度）或 401/403（認證）
// 連續失敗時開啟熔斷，避免在額度異常期間持續浪費調用或增加延遲；冷卻後自動恢復主要。
// ===== 分層主備援熔斷（V3-HOME：vectide Token plan 主 → Coding plan 輔 → Zeabur gateway 備援）=====
// vectide：Token plan（用多少算多少）與 Coding plan（訂閱額度）使用不同 API key；
// 各層獨立熔斷，避免某一層額度/認證問題拖垮另一層。未設定 Token env 時自動維持 Coding→Gateway 原行為。
type ProviderTierKey = "token" | "coding";
const tierCooldown = new Map<ProviderTierKey, number>();
const tierQuotaStreak = new Map<ProviderTierKey, number>();

function tierInCooldown(tier: ProviderTierKey): boolean {
  return (tierCooldown.get(tier) ?? 0) > Date.now();
}

function tierRecordOutcome(tier: ProviderTierKey, kind: "success" | "quota" | "auth" | "other") {
  if (kind === "success") {
    tierCooldown.delete(tier);
    tierQuotaStreak.delete(tier);
    return;
  }
  if (kind === "quota") {
    const streak = (tierQuotaStreak.get(tier) ?? 0) + 1;
    tierQuotaStreak.set(tier, streak);
    // 首次額度失敗即開啟 15 分鐘冷卻；連續失敗延長（上限 4 小時）
    const minutes = Math.min(15 * streak, 240);
    tierCooldown.set(tier, Date.now() + minutes * 60_000);
    return;
  }
  if (kind === "auth") {
    tierQuotaStreak.set(tier, (tierQuotaStreak.get(tier) ?? 0) + 1);
    tierCooldown.set(tier, Date.now() + 6 * 60 * 60_000); // 疑似 key 問題：停用 6 小時
    return;
  }
  // 其他失敗（上游/逾時/傳輸/形狀）：單次回退，不熔斷，避免誤傷暫時性問題
  tierQuotaStreak.delete(tier);
}

// 向後相容包裝（Coding plan 即原有主要）
function primaryInCooldown(): boolean { return tierInCooldown("coding"); }
function primaryRecordOutcome(kind: "success" | "quota" | "auth" | "other") { tierRecordOutcome("coding", kind); }

// ===== 主備援模型上游 =====
// 主要：外部 OpenAI-compatible API（OLDMIKE_LLM_API_URL/KEY/MODEL）；備援：Zeabur 預設 gateway。
// 主要失敗（額度/認證/上游/逾時/傳輸/形狀）一律自動回退 gateway；未設定主要時直接走 gateway。
export type PrimaryLlmAttempt =
  | { kind: "success"; content: string }
  | { kind: "skip"; code: "not_configured" | "invalid_config" | "request_invalid" }
  | { kind: "failed"; code: "auth" | "quota" | "upstream" | "timeout" | "transport" | "shape" };

export async function tryOpenAiCompatible(input: {
  apiUrl: string | undefined;
  apiKey: string | undefined;
  model: string | undefined;
  messages: OpenClawMessage[];
  sessionKey: string;
  route: OpenClawProtocolRoute;
  signal?: AbortSignal;
}): Promise<PrimaryLlmAttempt> {
  const apiUrl = input.apiUrl?.trim();
  const apiKey = input.apiKey?.trim();
  const model = input.model?.trim();
  if (!apiUrl || !apiKey || !model) return { kind: "skip", code: "not_configured" };
  if (apiKey.length < 8 || apiKey.length > 4096 || /[\u0000-\u001f\u007f]/u.test(apiKey)) return { kind: "skip", code: "invalid_config" };
  if (!validMessages(input.messages) || typeof input.sessionKey !== "string" || input.sessionKey.length < 8 || input.sessionKey.length > 256 || /[\u0000-\u001f\u007f]/u.test(input.sessionKey)) return { kind: "skip", code: "request_invalid" };
  const base = apiUrl.replace(/\/+$/u, "");
  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  const body = JSON.stringify({ model, messages: input.messages, stream: false, user: input.sessionKey, max_tokens: 8192 });
  if (Buffer.byteLength(body, "utf8") > input.route.inputLimitBytes) return { kind: "skip", code: "request_invalid" };
  const startedAt = performance.now();
  const timeoutMs = Math.min(input.route.timeoutMs, 90_000);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const abortCause = createAbortCauseTracker(input.signal, timeoutSignal);
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: abortCause.signal,
        cache: "no-store",
        redirect: "manual",
      });
    } catch {
      const reason = abortCause.firstReason();
      if (reason) return { kind: "failed", code: "timeout" };
      return { kind: "failed", code: "transport" };
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403) return { kind: "failed", code: "auth" };
      if (response.status === 402 || response.status === 429) return { kind: "failed", code: "quota" };
      return { kind: "failed", code: "upstream" };
    }
    if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return { kind: "failed", code: "shape" };
    let raw: string;
    try {
      raw = await readBounded(response, input.route.outputLimitBytes);
    } catch {
      return { kind: "failed", code: "shape" };
    }
    let data: unknown;
    try { data = JSON.parse(raw) as unknown; }
    catch { return { kind: "failed", code: "shape" }; }
    if (!record(data) || data.object !== "chat.completion" || !Array.isArray(data.choices) || data.choices.length !== 1) return { kind: "failed", code: "shape" };
    const choice = data.choices[0];
    if (!record(choice) || !record(choice.message) || choice.message.role !== "assistant" || typeof choice.message.content !== "string") return { kind: "failed", code: "shape" };
    const content = choice.message.content.trim();
    if (!content) return { kind: "failed", code: "shape" };
    return { kind: "success", content };
  } finally {
    void startedAt;
    abortCause.dispose();
  }
}

// Coding plan（既有 OLDMIKE_LLM_*；向後相容，作為「輔助」層）
export async function tryPrimaryOpenAi(input: {
  messages: OpenClawMessage[];
  sessionKey: string;
  route: OpenClawProtocolRoute;
  signal?: AbortSignal;
}): Promise<PrimaryLlmAttempt> {
  return tryOpenAiCompatible({
    apiUrl: process.env.OLDMIKE_LLM_API_URL,
    apiKey: process.env.OLDMIKE_LLM_API_KEY,
    model: process.env.OLDMIKE_LLM_MODEL,
    messages: input.messages,
    sessionKey: input.sessionKey,
    route: input.route,
    signal: input.signal,
  });
}

// Token plan（新主要層：OLDMIKE_LLM_TOKEN_API_URL/KEY/MODEL；未設定時回 skip → 自動用 Coding plan）
export async function tryTokenPlanOpenAi(input: {
  messages: OpenClawMessage[];
  sessionKey: string;
  route: OpenClawProtocolRoute;
  signal?: AbortSignal;
}): Promise<PrimaryLlmAttempt> {
  return tryOpenAiCompatible({
    apiUrl: process.env.OLDMIKE_LLM_TOKEN_API_URL ?? process.env.OLDMIKE_LLM_API_URL,
    apiKey: process.env.OLDMIKE_LLM_TOKEN_API_KEY,
    model: process.env.OLDMIKE_LLM_TOKEN_MODEL ?? process.env.OLDMIKE_LLM_MODEL,
    messages: input.messages,
    sessionKey: input.sessionKey,
    route: input.route,
    signal: input.signal,
  });
}

export async function executeDefaultOpenClawChatCompletion(
  messages: OpenClawMessage[],
  sessionKey: string,
  operation: OpenClawChatOperation,
  signal?: AbortSignal,
): Promise<OpenClawChatCompletionProtocolResult> {
  if (!operation.startsWith("M01_") && !operation.startsWith("ASSIST_")) return { kind: "proven-not-submitted", code: "request_invalid" };
  const route = resolveDefaultOpenClawOperationRoute(operation);
  // 全部網站 AI 調用（含 assist/聊天等未指定 route 者）統一走：Token plan → Coding plan → Zeabur gateway
  const tokenAttempt = !tierInCooldown("token") && process.env.OLDMIKE_LLM_TOKEN_API_KEY
    ? await tryTokenPlanOpenAi({ messages, sessionKey, route, signal })
    : null;
  if (tokenAttempt?.kind === "success") {
    tierRecordOutcome("token", "success");
    return { kind: "success", content: tokenAttempt.content };
  }
  if (tokenAttempt) {
    const failureCode = tokenAttempt.kind === "failed" ? tokenAttempt.code : "other";
    tierRecordOutcome("token", failureCode === "quota" ? "quota" : failureCode === "auth" ? "auth" : "other");
  }
  const codingAttempt = !tierInCooldown("coding") && process.env.OLDMIKE_LLM_API_KEY
    ? await tryPrimaryOpenAi({ messages, sessionKey, route, signal })
    : null;
  if (codingAttempt?.kind === "success") {
    tierRecordOutcome("coding", "success");
    return { kind: "success", content: codingAttempt.content };
  }
  if (codingAttempt) {
    const failureCode = codingAttempt.kind === "failed" ? codingAttempt.code : "other";
    tierRecordOutcome("coding", failureCode === "quota" ? "quota" : failureCode === "auth" ? "auth" : "other");
  }
  return executeOpenClawChatCompletion({
    messages,
    sessionKey,
    operation,
    route,
    baseUrl: process.env.OPENCLAW_BASE_URL,
    bearerToken: process.env.OPENCLAW_GATEWAY_TOKEN,
    signal,
  });
}

export async function callOpenClaw(messages: OpenClawMessage[], userId: string, operation: OpenClawChatOperation, route?: ResolvedModelRoute, signal?: AbortSignal): Promise<OpenClawCallResult> {
  if (!route && !operation.startsWith("M01_") && !operation.startsWith("ASSIST_")) return { kind: "invalid-config" };
  if (route && route.operation !== operation) return { kind: "invalid-config" };
  const effectiveRoute: OpenClawProtocolRoute = route
    ? { ...route, operation }
    : resolveDefaultOpenClawOperationRoute(operation);
  let result: OpenClawChatCompletionProtocolResult;
  if (route) {
    // 分層調用：① Token plan（主要）→ ② Coding plan（輔助）→ ③ Zeabur 預設 gateway（備援）。
    // 各層額度/認證問題獨立熔斷；未設定 Token plan env 時自動維持 Coding→Gateway 原行為。
    const tokenAttempt = !tierInCooldown("token") && process.env.OLDMIKE_LLM_TOKEN_API_KEY
      ? await tryTokenPlanOpenAi({ messages, sessionKey: userId, route: effectiveRoute, signal })
      : null;
    if (tokenAttempt?.kind === "success") {
      tierRecordOutcome("token", "success");
      result = { kind: "success", content: tokenAttempt.content };
    } else {
      if (tokenAttempt) {
        const failureCode = tokenAttempt.kind === "failed" ? tokenAttempt.code : "other";
        tierRecordOutcome("token", failureCode === "quota" ? "quota" : failureCode === "auth" ? "auth" : "other");
      }
      const codingAttempt = !tierInCooldown("coding") && process.env.OLDMIKE_LLM_API_KEY
        ? await tryPrimaryOpenAi({ messages, sessionKey: userId, route: effectiveRoute, signal })
        : null;
      if (codingAttempt?.kind === "success") {
        tierRecordOutcome("coding", "success");
        result = { kind: "success", content: codingAttempt.content };
      } else {
        if (codingAttempt) {
          const failureCode = codingAttempt.kind === "failed" ? codingAttempt.code : "other";
          tierRecordOutcome("coding", failureCode === "quota" ? "quota" : failureCode === "auth" ? "auth" : "other");
        }
        result = await executeOpenClawChatCompletion({ messages, sessionKey: userId, operation, route: effectiveRoute, baseUrl: process.env.OPENCLAW_BASE_URL, bearerToken: process.env.OPENCLAW_GATEWAY_TOKEN, signal });
      }
    }
  } else {
    result = await executeDefaultOpenClawChatCompletion(messages, userId, operation, signal);
  }
  if (result.kind === "success") return result;
  if (result.kind === "proven-not-submitted") return { kind: result.code === "configuration_missing" ? "not-configured" : "invalid-config" };
  return { kind: "upstream-error" };
}
