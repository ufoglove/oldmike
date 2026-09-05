import "server-only";

import { researchDirectionStageMessages, researchS0ExpansionStageMessages } from "./assist-prompts.ts";
import { createOpenClawResearchProvider, type ResearchGenerationProvider, type ResearchGenerationResult } from "./research-generation-provider.ts";
import {
  parseResearchDirectionEnvelope,
  parseResearchS0ExpansionEnvelope,
  researchStartStageRequestHash,
  type ResearchDirectionSet,
  type ResearchStartStageARequest,
  type ResearchStartStageBRequest,
} from "./research-start-two-stage-contract.ts";

export type ResearchStartStageState = "DIRECTIONS_READY" | "READY_FOR_HUMAN_REVIEW";
export type ResearchStartCompletionClass = "PROVEN_NOT_SUBMITTED" | "TERMINAL_REJECTED" | "COMPLETION_UNKNOWN";
export type ResearchStartProviderAttemptClass = "NOT_SUBMITTED" | "SUBMISSION_POSSIBLE" | "RESPONSE_HEADERS_RECEIVED" | "RESPONSE_COMPLETE" | "UNKNOWN";
export type ResearchStartStage = "AUTH_VALIDATE" | "SUBMIT" | "HTTP_ACK" | "PARSE_OUTPUT" | "VALIDATE_OUTPUT" | "COMMIT";

export type ResearchStartStageAResult = {
  stage: "STAGE_A";
  state: "DIRECTIONS_READY";
  rootIntentHash: string;
  directionSet: ResearchDirectionSet;
  providerSubmissionCount: 1;
  formalResearchWrites: 0;
  liveScholarlyEgress: 0;
};

export type ResearchStartStageBResult = {
  stage: "STAGE_B";
  state: "READY_FOR_HUMAN_REVIEW";
  rootIntentHash: string;
  selectedCardId: string;
  s0Draft: import("./project-contract.ts").S0Intake;
  s0Hash: string;
  providerSubmissionCount: 1;
  formalResearchWrites: 0;
  liveScholarlyEgress: 0;
};

export class ResearchStartTwoStageError extends Error {
  readonly code: string;
  readonly stage: ResearchStartStage;
  readonly status: number;
  readonly completionClass: ResearchStartCompletionClass;
  readonly providerAttemptClass: ResearchStartProviderAttemptClass;
  readonly recoverableFields: string[];
  readonly providerSubmissionCount: 0 | 1;
  constructor(input: {
    code: string;
    stage: ResearchStartStage;
    status: number;
    completionClass: ResearchStartCompletionClass;
    providerAttemptClass: ResearchStartProviderAttemptClass;
    recoverableFields?: string[];
    providerSubmissionCount: 0 | 1;
  }) {
    super(input.code);
    this.name = "ResearchStartTwoStageError";
    this.code = input.code;
    this.stage = input.stage;
    this.status = input.status;
    this.completionClass = input.completionClass;
    this.providerAttemptClass = input.providerAttemptClass;
    this.recoverableFields = input.recoverableFields || [];
    this.providerSubmissionCount = input.providerSubmissionCount;
  }
}

type StageResult = ResearchStartStageAResult | ResearchStartStageBResult;
type Settled = { requestHash: string; result?: StageResult; error?: ResearchStartTwoStageError };
const inFlight = new Map<string, { requestHash: string; promise: Promise<StageResult> }>();
const settled = new Map<string, Settled>();
const MAX_SETTLED = 128;

function ledgerKey(scope: string, idempotencyKey: string) {
  if (!scope || scope.length > 256) throw new ResearchStartTwoStageError({ code: "research_stage_scope_invalid", stage: "AUTH_VALIDATE", status: 400, completionClass: "PROVEN_NOT_SUBMITTED", providerAttemptClass: "NOT_SUBMITTED", providerSubmissionCount: 0 });
  return `${scope}:${idempotencyKey}`;
}

function retain(key: string, value: Settled) {
  settled.set(key, value);
  while (settled.size > MAX_SETTLED) settled.delete(settled.keys().next().value as string);
}

function conflict(): ResearchStartTwoStageError {
  return new ResearchStartTwoStageError({ code: "research_stage_idempotency_conflict", stage: "AUTH_VALIDATE", status: 409, completionClass: "PROVEN_NOT_SUBMITTED", providerAttemptClass: "NOT_SUBMITTED", providerSubmissionCount: 0 });
}

function providerRouteError(provider: ResearchGenerationProvider): ResearchStartTwoStageError | null {
  if (provider.id !== "OLD_MIKE_DEFAULT") return new ResearchStartTwoStageError({ code: "research_stage_route_invalid", stage: "AUTH_VALIDATE", status: 503, completionClass: "PROVEN_NOT_SUBMITTED", providerAttemptClass: "NOT_SUBMITTED", providerSubmissionCount: 0 });
  if (provider.capability !== "ENABLED") return new ResearchStartTwoStageError({ code: "research_stage_provider_not_configured", stage: "AUTH_VALIDATE", status: 503, completionClass: "PROVEN_NOT_SUBMITTED", providerAttemptClass: "NOT_SUBMITTED", providerSubmissionCount: 0 });
  return null;
}

function providerFailure(result: Exclude<ResearchGenerationResult, { kind: "success" }>): ResearchStartTwoStageError {
  if (result.kind === "proven-not-submitted") return new ResearchStartTwoStageError({
    code: `research_stage_${result.code}`,
    stage: "SUBMIT",
    status: 503,
    completionClass: "PROVEN_NOT_SUBMITTED",
    providerAttemptClass: "NOT_SUBMITTED",
    recoverableFields: ["researchDirection"],
    providerSubmissionCount: 0,
  });
  if (result.kind === "completion-unknown") return new ResearchStartTwoStageError({
    code: `research_stage_${result.code}`,
    stage: "HTTP_ACK",
    status: result.code === "provider_deadline" ? 504 : 502,
    completionClass: "COMPLETION_UNKNOWN",
    providerAttemptClass: result.evidence.providerAttemptClass,
    recoverableFields: ["researchDirection"],
    providerSubmissionCount: 1,
  });
  return new ResearchStartTwoStageError({
    code: `research_stage_${result.code}`,
    stage: result.code === "response_shape_invalid" ? "PARSE_OUTPUT" : "HTTP_ACK",
    status: 502,
    completionClass: "TERMINAL_REJECTED",
    providerAttemptClass: result.evidence.providerAttemptClass,
    recoverableFields: ["researchDirection"],
    providerSubmissionCount: 1,
  });
}

async function submit(provider: ResearchGenerationProvider, input: Parameters<ResearchGenerationProvider["submit"]>[0]) {
  try {
    const result = await provider.submit(input);
    if (result.kind !== "success") throw providerFailure(result);
    return result.content;
  } catch (error) {
    if (error instanceof ResearchStartTwoStageError) throw error;
    throw new ResearchStartTwoStageError({ code: "research_stage_unexpected_internal", stage: "HTTP_ACK", status: 500, completionClass: "COMPLETION_UNKNOWN", providerAttemptClass: "UNKNOWN", recoverableFields: ["researchDirection"], providerSubmissionCount: 1 });
  }
}

async function executeA(request: ResearchStartStageARequest, provider: ResearchGenerationProvider, signal?: AbortSignal): Promise<ResearchStartStageAResult> {
  const routeError = providerRouteError(provider);
  if (routeError) throw routeError;
  const content = await submit(provider, {
    operation: "M01_RESEARCH_DIRECTIONS",
    messages: researchDirectionStageMessages(request),
    sessionKey: `research-start-a:${request.rootIntentId}`,
    signal,
  });
  const parsed = parseResearchDirectionEnvelope(content, request);
  if (!parsed.ok) throw new ResearchStartTwoStageError({ code: parsed.code, stage: parsed.stage === "JSON_ENVELOPE" || parsed.stage === "JSON_PARSE" || parsed.stage === "TOP_LEVEL_OBJECT" || parsed.stage === "TOP_LEVEL_SHAPE" ? "PARSE_OUTPUT" : "VALIDATE_OUTPUT", status: 502, completionClass: "TERMINAL_REJECTED", providerAttemptClass: "RESPONSE_COMPLETE", recoverableFields: parsed.recoverableFields, providerSubmissionCount: 1 });
  return { stage: "STAGE_A", state: "DIRECTIONS_READY", rootIntentHash: parsed.value.rootIntentHash, directionSet: parsed.value, providerSubmissionCount: 1, formalResearchWrites: 0, liveScholarlyEgress: 0 };
}

async function executeB(request: ResearchStartStageBRequest, provider: ResearchGenerationProvider, signal?: AbortSignal): Promise<ResearchStartStageBResult> {
  const routeError = providerRouteError(provider);
  if (routeError) throw routeError;
  const content = await submit(provider, {
    operation: "M01_RESEARCH_S0_EXPAND",
    messages: researchS0ExpansionStageMessages(request),
    sessionKey: `research-start-b:${request.rootIntentId}:${request.selectedCard.cardId}`,
    signal,
  });
  const parsed = parseResearchS0ExpansionEnvelope(content, request);
  if (!parsed.ok) throw new ResearchStartTwoStageError({ code: parsed.code, stage: parsed.stage === "JSON_ENVELOPE" || parsed.stage === "JSON_PARSE" || parsed.stage === "TOP_LEVEL_OBJECT" || parsed.stage === "TOP_LEVEL_SHAPE" ? "PARSE_OUTPUT" : "VALIDATE_OUTPUT", status: 502, completionClass: "TERMINAL_REJECTED", providerAttemptClass: "RESPONSE_COMPLETE", recoverableFields: parsed.recoverableFields, providerSubmissionCount: 1 });
  return { stage: "STAGE_B", state: "READY_FOR_HUMAN_REVIEW", rootIntentHash: request.rootIntentHash, selectedCardId: request.selectedCard.cardId, s0Draft: parsed.value.s0Draft, s0Hash: parsed.value.s0Hash, providerSubmissionCount: 1, formalResearchWrites: 0, liveScholarlyEgress: 0 };
}

async function executeEffect<T extends StageResult>(input: {
  scope: string;
  request: ResearchStartStageARequest | ResearchStartStageBRequest;
  run: () => Promise<T>;
}): Promise<T> {
  const key = ledgerKey(input.scope, input.request.idempotencyKey);
  const requestHash = researchStartStageRequestHash(input.request);
  const prior = settled.get(key);
  if (prior) {
    if (prior.requestHash !== requestHash) throw conflict();
    if (prior.result) return prior.result as T;
    throw prior.error || new ResearchStartTwoStageError({ code: "research_stage_unexpected_internal", stage: "COMMIT", status: 500, completionClass: "COMPLETION_UNKNOWN", providerAttemptClass: "UNKNOWN", providerSubmissionCount: 1 });
  }
  const active = inFlight.get(key);
  if (active) {
    if (active.requestHash !== requestHash) throw conflict();
    return active.promise as Promise<T>;
  }
  const promise = input.run();
  inFlight.set(key, { requestHash, promise });
  try {
    const result = await promise;
    retain(key, { requestHash, result });
    return result;
  } catch (error) {
    const normalized = error instanceof ResearchStartTwoStageError
      ? error
      : new ResearchStartTwoStageError({ code: "research_stage_unexpected_internal", stage: "COMMIT", status: 500, completionClass: "COMPLETION_UNKNOWN", providerAttemptClass: "UNKNOWN", providerSubmissionCount: 1 });
    retain(key, { requestHash, error: normalized });
    throw normalized;
  } finally {
    inFlight.delete(key);
  }
}

type ServiceOptions = { scope: string; provider?: ResearchGenerationProvider; signal?: AbortSignal };

export function executeResearchStartStageA(request: ResearchStartStageARequest, options: ServiceOptions) {
  const provider = options.provider || createOpenClawResearchProvider();
  return executeEffect({ scope: options.scope, request, run: () => executeA(request, provider, options.signal) });
}

export function executeResearchStartStageB(request: ResearchStartStageBRequest, options: ServiceOptions) {
  const provider = options.provider || createOpenClawResearchProvider();
  return executeEffect({ scope: options.scope, request, run: () => executeB(request, provider, options.signal) });
}

export function resetResearchStartTwoStageLedgerForTests() {
  inFlight.clear();
  settled.clear();
}
