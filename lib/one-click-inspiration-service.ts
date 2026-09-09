// server-only guard removed FOR LOCAL SIM ONLY

import {
  executeOpenClawChatCompletion,
  tryPrimaryOpenAi,
  tryTokenPlanOpenAi,
  type PrimaryLlmAttempt,
  resolveDefaultOpenClawOperationRoute,
  type OpenClawChatCompletionProtocolResult,
} from "./openclaw.ts";
import { resolveModelRoute } from "./model-route-catalog.ts";
import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import { oneClickInspirationMessages } from "./assist-prompts.ts";
import { collectTopicLabObservations } from "./topic-lab-source-provider.ts";
import {
  CANDIDATE_OUTPUT_LIMIT_BYTES,
  ONE_CLICK_INSPIRATION_CONTRACT,
  parseInspirationEnvelope,
  type InspirationCandidate,
  type InspirationTop3Entry,
  type OneClickInspirationRequest,
} from "./one-click-inspiration-contract.ts";

export type OneClickInspirationServiceResult = {
  contractVersion: typeof ONE_CLICK_INSPIRATION_CONTRACT;
  judgment: string;
  evidenceStatus: "UNVERIFIED" | "NEEDS_VERIFICATION";
  evidenceNote: string;
  candidates: InspirationCandidate[];
  top3: InspirationTop3Entry[];
  inputHash: string;
  sourceCapability: string;
  providerStates: Record<string, string>;
  providerSubmissionCount: 1;
};

export class OneClickInspirationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly stage: string;
  readonly recoverableFields: string[];
  constructor(code: string, stage: string, status = 502, recoverableFields: string[] = [], extra?: Record<string, unknown>) {
    super(code);
    this.name = "OneClickInspirationError";
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.recoverableFields = recoverableFields;
  }
}

const responseContractEvidence = Object.freeze({ reasonEnum: "RESPONSE_CONTRACT_REJECTED", elapsedBucket: "UNKNOWN", providerAttemptClass: "RESPONSE_COMPLETE" });
const unexpectedInternalEvidence = Object.freeze({ reasonEnum: "UNEXPECTED_INTERNAL", elapsedBucket: "UNKNOWN", providerAttemptClass: "UNKNOWN" });

// HTTP_ACK root-cause fix (2026-09-08): deepseek-v4-pro full-candidate generation can take
// well beyond one minute. Per-attempt ceilings previously cancelled every tier before the
// provider finished, surfacing HTTP_ACK/504 in the UI. The service now enforces an overall
// deadline (default 170s, tunable via ONE_CLICK_INSPIRATION_DEADLINE_MS) and derives each
// tier's timeout from the remaining budget so at least the primary tier always gets a
// realistic chance to complete.
const ONE_CLICK_DEFAULT_DEADLINE_MS = 170_000;
const ONE_CLICK_MIN_TIER_BUDGET_MS = 40_000;
const ONE_CLICK_MAX_TIER_BUDGET_MS = 150_000;

function oneClickDeadlineMs(): number {
  const raw = Number(process.env.ONE_CLICK_INSPIRATION_DEADLINE_MS);
  return Number.isFinite(raw) && raw >= 60_000 && raw <= 300_000 ? Math.floor(raw) : ONE_CLICK_DEFAULT_DEADLINE_MS;
}

function oneClickTierBudgets(fallbackMaxMs: number): { min: number; max: number } {
  const minRaw = Number(process.env.ONE_CLICK_INSPIRATION_TIER_MIN_MS);
  const maxRaw = Number(process.env.ONE_CLICK_INSPIRATION_TIER_MAX_MS);
  return {
    min: Number.isFinite(minRaw) && minRaw >= 5_000 && minRaw <= 120_000 ? Math.floor(minRaw) : ONE_CLICK_MIN_TIER_BUDGET_MS,
    max: Number.isFinite(maxRaw) && maxRaw >= 30_000 && maxRaw <= 300_000 ? Math.floor(maxRaw) : Math.min(fallbackMaxMs, ONE_CLICK_MAX_TIER_BUDGET_MS),
  };
}

export async function executeOneClickInspiration(
  request: OneClickInspirationRequest,
  options: { signal?: AbortSignal; observedAt?: Date } = {},
): Promise<OneClickInspirationServiceResult> {
  const observedAt = options.observedAt || new Date();
  const inputHash = sha256Canonical({ contractVersion: ONE_CLICK_INSPIRATION_CONTRACT, ...request, idempotencyKey: undefined });
  // 1) best-effort recent-literature observations (never blocks generation)
  let observations: { provider: string; publishedAt: string | null; title: string; doi: string | null }[] = [];
  let sourceCapability = "SCHOLARLY_DISABLED";
  let providerStates: Record<string, string> = {};
  try {
    const collected = await collectTopicLabObservations(
      {
        operation: "ANALYZE",
        idempotencyKey: request.idempotencyKey,
        researchDirection: request.researchFocus || request.researchDomains[0] || "",
        advanced: { domain: null, outputTrack: null, population: "", context: "", method: "", data: "", timeline: "", ethics: "" },
        sourceStrategy: "SCHOLARLY_AUTO",
        evidenceWindow: { from: `${observedAt.getUTCFullYear() - 3}-01-01`, to: observedAt.toISOString().slice(0, 10) },
        sourceUrls: [],
      },
      { now: () => observedAt, signal: options.signal, deadlineMs: 10_000 },
    );
    observations = collected.observations.map((o) => ({ provider: o.provider, publishedAt: o.publishedAt, title: o.title, doi: o.doi }));
    sourceCapability = collected.capability;
    providerStates = collected.providerStates;
  } catch {
    // scholarly retrieval is an enhancement; generation proceeds without it
  }
  // 2) generate with one automatic retry on contract rejection (fresh session key)
  const sessionBase = `one-click-inspiration:${sha256Canonical({ idempotencyKey: request.idempotencyKey }).slice(0, 32)}`;
  let lastFailure: { code: string; stage: string; recoverableFields: string[] } | undefined;
  const baseRoute = {
    ...resolveModelRoute({ modeProfile: "AUTO", operation: "ACADEMIC_LANGUAGE" }),
    operation: "ONE_CLICK_INSPIRATION" as const,
    timeoutMs: ONE_CLICK_MAX_TIER_BUDGET_MS,
  };
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(new Error("ONE_CLICK_INSPIRATION_DEADLINE")), oneClickDeadlineMs());
  const callerSignal = options.signal;
  const relayAbort = () => deadlineController.abort(callerSignal ? callerSignal.reason : new Error("ONE_CLICK_CALLER_ABORT"));
  callerSignal?.addEventListener("abort", relayAbort, { once: true });
  const chainedSignal = deadlineController.signal;
  const tierBudgets = oneClickTierBudgets(ONE_CLICK_MAX_TIER_BUDGET_MS);
  const tierTimeoutFor = (remainingMs: number) => Math.max(tierBudgets.min, Math.min(remainingMs, tierBudgets.max));
  const attemptStartedAt = Date.now();
  try {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content: string;
    const sessionKey = attempt === 0 ? sessionBase : `${sessionBase}:retry${attempt}`;
    const messages = oneClickInspirationMessages(request, observations as never);
    const remainingMs = oneClickDeadlineMs() - (Date.now() - attemptStartedAt);
    if (remainingMs < tierBudgets.min) {
      throw new OneClickInspirationError("research_generation_deadline_budget_exhausted", "HTTP_ACK", 504, ["researchFocus"], { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" });
    }

    try {
      // 分層級主備援（沿用品質順序 coding → token → gateway）：每層依剩餘預算給時間，
      // 預算不足自動跳層；「完成但不合契約」仍由 attempt 重試並重跑整條鏈。
      let result: OpenClawChatCompletionProtocolResult | null = null;
      const remainingForTier = () => oneClickDeadlineMs() - (Date.now() - attemptStartedAt);

      const withTierBudget = async <T>(budgetMs: number, run: (signal: AbortSignal) => Promise<T>, onTimeout: () => T): Promise<T> => {
        const tierController = new AbortController();
        const relay = () => tierController.abort(chainedSignal.reason);
        chainedSignal.addEventListener("abort", relay, { once: true });
        if (chainedSignal.aborted) relay();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const budget = new Promise<T>((resolve) => {
          timer = setTimeout(() => { tierController.abort(new Error("ONE_CLICK_TIER_BUDGET")); resolve(onTimeout()); }, budgetMs);
        });
        try {
          return await Promise.race([run(tierController.signal), budget]);
        } finally {
          if (timer !== undefined) clearTimeout(timer);
          chainedSignal.removeEventListener("abort", relay);
        }
      };

      const codingRemainingMs = remainingForTier();
      let codingSkipped = false;
      if (codingRemainingMs >= tierBudgets.min) {
        const codingBudget = tierTimeoutFor(codingRemainingMs);
        const codingAttempt = await withTierBudget(codingBudget,
          (signal) => tryPrimaryOpenAi({
            messages,
            sessionKey,
            route: { ...baseRoute, timeoutMs: codingBudget },
            signal,
          }),
          () => ({ kind: "failed", code: "timeout" }) as PrimaryLlmAttempt);
        if (codingAttempt.kind === "success") result = { kind: "success", content: codingAttempt.content };
        else if (codingAttempt.kind === "skip") codingSkipped = true;
        else {
          const tierCode = codingAttempt.code === "timeout" ? "provider_deadline" : codingAttempt.code === "transport" ? "transport_failure_before_headers" : "http_rejected";
          result = tierCode === "http_rejected"
            ? { kind: "terminal-rejected", code: "http_rejected", evidence: { reasonEnum: "UPSTREAM_HTTP_REJECTED", elapsedBucket: "GE_60S", providerAttemptClass: "RESPONSE_HEADERS_RECEIVED" } }
            : { kind: "completion-unknown", code: tierCode, evidence: { reasonEnum: codingAttempt.code === "timeout" ? "PROVIDER_DEADLINE" : "TRANSPORT_FAILURE_BEFORE_HEADERS", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" } };
        }
      } else codingSkipped = true;

      if (!result && codingSkipped) {
        const tokenRemainingMs = remainingForTier();
        if (tokenRemainingMs >= tierBudgets.min) {
          const tokenBudget = tierTimeoutFor(tokenRemainingMs);
          const tokenAttempt = await withTierBudget(tokenBudget,
            (signal) => tryTokenPlanOpenAi({
              messages,
              sessionKey,
              route: { ...baseRoute, timeoutMs: tokenBudget },
              signal,
            }),
            () => ({ kind: "failed", code: "timeout" }) as PrimaryLlmAttempt);
          if (tokenAttempt.kind === "success") result = { kind: "success", content: tokenAttempt.content };
          else if (tokenAttempt.kind === "skip") {
            const gwRemainingMs = remainingForTier();
            if (gwRemainingMs >= tierBudgets.min) {
              const gwBudget = tierTimeoutFor(gwRemainingMs);
              result = await withTierBudget(gwBudget,
                (signal) => executeOpenClawChatCompletion({
                  messages,
                  sessionKey,
                  operation: "ONE_CLICK_INSPIRATION",
                  route: { ...baseRoute, timeoutMs: gwBudget },
                  baseUrl: process.env.OPENCLAW_BASE_URL,
                  bearerToken: process.env.OPENCLAW_GATEWAY_TOKEN,
                  signal,
                }),
                () => ({ kind: "completion-unknown" as const, code: "provider_deadline", evidence: { reasonEnum: "PROVIDER_DEADLINE" as const, elapsedBucket: "GE_60S" as const, providerAttemptClass: "SUBMISSION_POSSIBLE" as const } }));
            } else {
              result = { kind: "completion-unknown", code: "provider_deadline", evidence: { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" } };
            }
          } else {
            const tierCode = tokenAttempt.code === "timeout" ? "provider_deadline" : tokenAttempt.code === "transport" ? "transport_failure_before_headers" : "http_rejected";
            result = tierCode === "http_rejected"
              ? { kind: "terminal-rejected", code: "http_rejected", evidence: { reasonEnum: "UPSTREAM_HTTP_REJECTED", elapsedBucket: "GE_60S", providerAttemptClass: "RESPONSE_HEADERS_RECEIVED" } }
              : { kind: "completion-unknown", code: tierCode, evidence: { reasonEnum: tokenAttempt.code === "timeout" ? "PROVIDER_DEADLINE" : "TRANSPORT_FAILURE_BEFORE_HEADERS", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" } };
          }
        } else {
          result = { kind: "completion-unknown", code: "provider_deadline", evidence: { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" } };
        }
      }

      if (!result) result = { kind: "completion-unknown", code: "provider_deadline", evidence: { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" } };

      if (result.kind === "proven-not-submitted") {
        throw new OneClickInspirationError(`research_generation_${result.code}`, "SUBMIT", 503, ["researchFocus"], { reasonEnum: "PROVIDER_NOT_CONFIGURED", elapsedBucket: "NOT_STARTED", providerAttemptClass: "NOT_SUBMITTED" });
      }
      if (result.kind === "completion-unknown") {
        throw new OneClickInspirationError(`research_generation_${result.code}`, "HTTP_ACK", result.code === "provider_deadline" ? 504 : 502, ["researchFocus"], result.evidence);
      }
      if (result.kind === "terminal-rejected") {
        throw new OneClickInspirationError(`research_generation_${result.code}`, result.code === "response_shape_invalid" ? "PARSE_PLAN" : "HTTP_ACK", 502, ["researchFocus"], result.evidence);
      }
      if (result.kind !== "success") throw new OneClickInspirationError("research_generation_unexpected_internal", "HTTP_ACK", 500, ["researchFocus"], unexpectedInternalEvidence);
      content = result.content;
    } catch (error) {
      if (error instanceof OneClickInspirationError) throw error;
      throw new OneClickInspirationError("research_generation_unexpected_internal", "HTTP_ACK", 500, ["researchFocus"], unexpectedInternalEvidence);
    }
    if (content.length > CANDIDATE_OUTPUT_LIMIT_BYTES) {
      lastFailure = { code: "one_click_inspiration_output_too_large", stage: "PARSE_PLAN", recoverableFields: ["candidates"] };
      continue;
    }
    const parsed = parseInspirationEnvelope(content);
    if (parsed.ok) {
      return {
        contractVersion: ONE_CLICK_INSPIRATION_CONTRACT,
        judgment: parsed.value.judgment,
        evidenceStatus: parsed.value.evidenceStatus,
        evidenceNote: parsed.value.evidenceNote,
        candidates: parsed.value.candidates,
        top3: parsed.value.top3,
        inputHash,
        sourceCapability,
        providerStates,
        providerSubmissionCount: 1,
      };
    }
    lastFailure = { code: parsed.code, stage: parsed.stage, recoverableFields: parsed.recoverableFields };
  }
  throw new OneClickInspirationError(lastFailure?.code ?? "one_click_inspiration_invalid", lastFailure?.stage ?? "VALIDATE_RESPONSE", 502, lastFailure?.recoverableFields ?? [], responseContractEvidence);
  } finally {
    clearTimeout(deadlineTimer);
    callerSignal?.removeEventListener("abort", relayAbort);
  }
}
