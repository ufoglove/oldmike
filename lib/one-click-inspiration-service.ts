import "server-only";

import {
  executeOpenClawChatCompletion,
  tryPrimaryOpenAi,
  tryTokenPlanOpenAi,
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
      { now: () => observedAt, signal: options.signal },
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
    timeoutMs: 60_000,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content: string;
    const sessionKey = attempt === 0 ? sessionBase : `${sessionBase}:retry${attempt}`;
    const messages = oneClickInspirationMessages(request, observations as never);

    try {
      // 優先調用 Vectide Coding Plan (DeepSeek V4 Pro)
      let result: OpenClawChatCompletionProtocolResult | null = null;
      const codingAttempt = await tryPrimaryOpenAi({
        messages,
        sessionKey,
        route: baseRoute,
        signal: options.signal,
      });

      if (codingAttempt.kind === "success") {
        result = { kind: "success", content: codingAttempt.content };
      } else {
        const tokenAttempt = await tryTokenPlanOpenAi({
          messages,
          sessionKey,
          route: baseRoute,
          signal: options.signal,
        });
        if (tokenAttempt.kind === "success") {
          result = { kind: "success", content: tokenAttempt.content };
        } else {
          result = await executeOpenClawChatCompletion({
            messages,
            sessionKey,
            operation: "ONE_CLICK_INSPIRATION",
            route: baseRoute,
            baseUrl: process.env.OPENCLAW_BASE_URL,
            bearerToken: process.env.OPENCLAW_GATEWAY_TOKEN,
            signal: options.signal,
          });
        }
      }

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
}
