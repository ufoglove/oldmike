import "server-only";

import { researchStartMessages } from "./assist-prompts.ts";
import { createOpenClawResearchProvider, type ResearchGenerationProvider, type ResearchGenerationResult } from "./research-generation-provider.ts";
import type { OpenClawElapsedBucket, OpenClawFailureReason, OpenClawProviderAttemptClass } from "./openclaw.ts";
import { parseResearchPlanEnvelope, type ResearchPlanParseStage } from "./research-start-contract.ts";
import { sha256Canonical } from "./research-contract.ts";
import { analyzeTopicLab, containsPromptInjection, topicLabInputHash, TopicLabContractError, type TopicLabAnalysis, type TopicLabAnalyzeRequest, type TopicLabSourceObservation } from "./topic-lab-contract.ts";
import { collectTopicLabObservations, type TopicLabProviderState, type TopicLabSourceCapability } from "./topic-lab-source-provider.ts";

export type TopicLabServiceResult = {
  analysis: TopicLabAnalysis;
  sourceCapability: TopicLabSourceCapability;
  providerStates: Record<string, TopicLabProviderState>;
  providerSubmissionCount: 1;
};

export type TopicLabFailureReason = OpenClawFailureReason
  | "ROUTE_UNAVAILABLE"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_INVALID"
  | "CANCELED_BEFORE_SUBMISSION"
  | "REQUEST_CONTRACT_REJECTED"
  | "RESPONSE_CONTRACT_REJECTED"
  | "UNEXPECTED_INTERNAL";
export type TopicLabElapsedBucket = OpenClawElapsedBucket | "NOT_STARTED" | "UNKNOWN";
export type TopicLabProviderAttemptClass = OpenClawProviderAttemptClass | "NOT_SUBMITTED" | "UNKNOWN";
type TopicLabFailureEvidence = Readonly<{
  reasonEnum: TopicLabFailureReason;
  elapsedBucket: TopicLabElapsedBucket;
  providerAttemptClass: TopicLabProviderAttemptClass;
}>;

const responseContractEvidence = Object.freeze({
  reasonEnum: "RESPONSE_CONTRACT_REJECTED",
  elapsedBucket: "UNKNOWN",
  providerAttemptClass: "RESPONSE_COMPLETE",
} satisfies TopicLabFailureEvidence);

const requestContractEvidence = Object.freeze({
  reasonEnum: "REQUEST_CONTRACT_REJECTED",
  elapsedBucket: "NOT_STARTED",
  providerAttemptClass: "NOT_SUBMITTED",
} satisfies TopicLabFailureEvidence);

const unexpectedInternalEvidence = Object.freeze({
  reasonEnum: "UNEXPECTED_INTERNAL",
  elapsedBucket: "UNKNOWN",
  providerAttemptClass: "UNKNOWN",
} satisfies TopicLabFailureEvidence);

export class TopicLabGenerationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly stage: "AUTH_VALIDATE" | "SUBMIT" | "HTTP_ACK" | "PARSE_PLAN" | "VALIDATE_RESPONSE" | "COMMIT";
  readonly recoverableFields: string[];
  readonly reasonEnum: TopicLabFailureReason;
  readonly elapsedBucket: TopicLabElapsedBucket;
  readonly providerAttemptClass: TopicLabProviderAttemptClass;
  constructor(code: string, stage: TopicLabGenerationError["stage"], status = 502, recoverableFields: string[] = [], evidence: TopicLabFailureEvidence = unexpectedInternalEvidence) {
    super(code);
    this.name = "TopicLabGenerationError";
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.recoverableFields = recoverableFields;
    this.reasonEnum = evidence.reasonEnum;
    this.elapsedBucket = evidence.elapsedBucket;
    this.providerAttemptClass = evidence.providerAttemptClass;
  }
}

function normalizedPlanStage(stage: ResearchPlanParseStage): TopicLabGenerationError["stage"] {
  return ["JSON_ENVELOPE", "JSON_PARSE", "TOP_LEVEL_OBJECT", "TOP_LEVEL_SHAPE"].includes(stage) ? "PARSE_PLAN" : "VALIDATE_RESPONSE";
}

type ObservationBatch = { capability: TopicLabSourceCapability; observations: TopicLabSourceObservation[]; providerStates: Record<string, TopicLabProviderState> };
type ServiceOptions = {
  observedAt?: Date;
  signal?: AbortSignal;
  provider?: ResearchGenerationProvider;
  collect?: (request: TopicLabAnalyzeRequest, signal?: AbortSignal) => Promise<ObservationBatch>;
};

type Settled = { inputHash: string; result?: TopicLabServiceResult; error?: TopicLabGenerationError };
const inFlight = new Map<string, { inputHash: string; promise: Promise<TopicLabServiceResult> }>();
const settled = new Map<string, Settled>();
const MAX_LEDGER = 64;

function retain(idempotencyKey: string, value: Settled) {
  settled.set(idempotencyKey, value);
  while (settled.size > MAX_LEDGER) settled.delete(settled.keys().next().value as string);
}

async function executeOnce(request: TopicLabAnalyzeRequest, options: ServiceOptions): Promise<TopicLabServiceResult> {
  const observedAt = options.observedAt || new Date();
  const collected = options.collect ? await options.collect(request, options.signal) : await collectTopicLabObservations(request, { now: () => observedAt, signal: options.signal });
  const provider = options.provider || createOpenClawResearchProvider();
  if (provider.id !== "OLD_MIKE_DEFAULT" || provider.capability !== "ENABLED") throw new TopicLabGenerationError("research_generation_route_unavailable", "AUTH_VALIDATE", 503, ["modeProfile"], { reasonEnum: "ROUTE_UNAVAILABLE", elapsedBucket: "NOT_STARTED", providerAttemptClass: "NOT_SUBMITTED" });
  let result: ResearchGenerationResult;
  try {
    result = await provider.submit({
      messages: researchStartMessages(request, collected.observations.filter((observation) => !containsPromptInjection(observation.title))),
      sessionKey: `research-start:${sha256Canonical({ idempotencyKey: request.idempotencyKey }).slice(0, 32)}`,
      signal: options.signal,
    });
  } catch {
    throw new TopicLabGenerationError("research_generation_unexpected_internal", "HTTP_ACK", 500, ["researchDirection"], unexpectedInternalEvidence);
  }
  if (result.kind === "proven-not-submitted") {
    const reasonEnum = result.code === "provider_not_configured"
      ? "PROVIDER_NOT_CONFIGURED"
      : result.code === "provider_invalid"
        ? "PROVIDER_INVALID"
        : "CANCELED_BEFORE_SUBMISSION";
    throw new TopicLabGenerationError(`research_generation_${result.code}`, "SUBMIT", 503, ["researchDirection"], { reasonEnum, elapsedBucket: "NOT_STARTED", providerAttemptClass: "NOT_SUBMITTED" });
  }
  if (result.kind === "completion-unknown") {
    throw new TopicLabGenerationError(`research_generation_${result.code}`, "HTTP_ACK", result.code === "provider_deadline" ? 504 : 502, ["researchDirection"], result.evidence);
  }
  if (result.kind === "terminal-rejected") {
    const stage = result.code === "response_shape_invalid" ? "PARSE_PLAN" : "HTTP_ACK";
    throw new TopicLabGenerationError(`research_generation_${result.code}`, stage, 502, ["researchDirection"], result.evidence);
  }
  const plans = parseResearchPlanEnvelope(result.content, request);
  if (!plans.ok) throw new TopicLabGenerationError(plans.code, normalizedPlanStage(plans.stage), 502, plans.recoverableFields, responseContractEvidence);
  return { analysis: analyzeTopicLab(request, collected.observations, observedAt, plans.value), sourceCapability: collected.capability, providerStates: collected.providerStates, providerSubmissionCount: 1 };
}

export async function executeTopicLabAnalysis(request: TopicLabAnalyzeRequest, options: ServiceOptions = {}): Promise<TopicLabServiceResult> {
  const inputHash = topicLabInputHash(request);
  const prior = settled.get(request.idempotencyKey);
  if (prior) {
    if (prior.inputHash !== inputHash) throw new TopicLabGenerationError("topic_lab_idempotency_conflict", "AUTH_VALIDATE", 409, [], requestContractEvidence);
    if (prior.result) return prior.result;
    throw prior.error || new TopicLabGenerationError("research_generation_unexpected_internal", "HTTP_ACK", 500, [], unexpectedInternalEvidence);
  }
  const active = inFlight.get(request.idempotencyKey);
  if (active) {
    if (active.inputHash !== inputHash) throw new TopicLabGenerationError("topic_lab_idempotency_conflict", "AUTH_VALIDATE", 409, [], requestContractEvidence);
    return active.promise;
  }
  const promise = executeOnce(request, options);
  inFlight.set(request.idempotencyKey, { inputHash, promise });
  try {
    const result = await promise;
    retain(request.idempotencyKey, { inputHash, result });
    return result;
  } catch (error) {
    const normalized = error instanceof TopicLabGenerationError
      ? error
      : error instanceof TopicLabContractError
        ? new TopicLabGenerationError(error.code, "VALIDATE_RESPONSE", error.status, [], responseContractEvidence)
        : new TopicLabGenerationError("research_generation_unexpected_internal", "VALIDATE_RESPONSE", 500, [], unexpectedInternalEvidence);
    retain(request.idempotencyKey, { inputHash, error: normalized });
    throw normalized;
  } finally {
    inFlight.delete(request.idempotencyKey);
  }
}
