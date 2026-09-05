import "server-only";

import { executeDefaultOpenClawChatCompletion } from "./openclaw.ts";
import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import { collectTopicLabObservations } from "./topic-lab-source-provider.ts";
import { topicValidationMessages } from "./assist-prompts.ts";
import {
  TOPIC_VALIDATION_CONTRACT,
  parseTopicValidationEnvelope,
  type TopicValidationRequest,
  type TopicValidationResult,
} from "./research-topic-validation-contract.ts";

export class TopicValidationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly stage: string;
  readonly recoverableFields: string[];
  constructor(code: string, stage: string, status = 502, recoverableFields: string[] = []) {
    super(code);
    this.name = "TopicValidationError";
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.recoverableFields = recoverableFields;
  }
}

export async function executeTopicValidation(
  input: TopicValidationRequest,
  options: { signal?: AbortSignal; observedAt?: Date; version?: number } = {},
): Promise<TopicValidationResult> {
  const observedAt = options.observedAt || new Date();
  const version = options.version ?? 1;
  const validationId = `E-${observedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${sha256Canonical({ idempotencyKey: input.idempotencyKey }).slice(0, 8).toUpperCase()}`;
  // 1) real scholarly observations for the topic (Evidence First)
  let observations: { provider: string; publishedAt: string | null; title: string; doi: string | null }[] = [];
  try {
    const collected = await collectTopicLabObservations(
      {
        operation: "ANALYZE",
        idempotencyKey: input.idempotencyKey,
        researchDirection: `${input.topicTitle} ${input.researchQuestion || ""}`.slice(0, 200),
        advanced: { domain: null, outputTrack: null, population: "", context: "", method: "", data: "", timeline: "", ethics: "" },
        sourceStrategy: "SCHOLARLY_AUTO",
        evidenceWindow: { from: `${observedAt.getUTCFullYear() - 3}-01-01`, to: observedAt.toISOString().slice(0, 10) },
        sourceUrls: [],
      },
      { now: () => observedAt, signal: options.signal },
    );
    observations = collected.observations.map((o) => ({ provider: o.provider, publishedAt: o.publishedAt, title: o.title, doi: o.doi }));
  } catch {
    // validation proceeds with what evidence exists; the result is labelled UNVERIFIED
  }
  // 2) generate with one automatic retry on contract rejection
  const sessionBase = `topic-validation:${sha256Canonical({ idempotencyKey: input.idempotencyKey }).slice(0, 32)}`;
  let lastFailure: { code: string; stage: string; recoverableFields: string[] } | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content: string;
    try {
      const result = await executeDefaultOpenClawChatCompletion(
        topicValidationMessages(input, observations as never),
        attempt === 0 ? sessionBase : `${sessionBase}:retry${attempt}`,
        "ASSIST_RESEARCH_CLAIM",
        options.signal,
      );
      if (result.kind !== "success") throw new TopicValidationError(`topic_validation_generation_${result.code}`, "HTTP_ACK", result.kind === "proven-not-submitted" ? 503 : 502, ["topicTitle"]);
      content = result.content;
    } catch (error) {
      if (error instanceof TopicValidationError) throw error;
      throw new TopicValidationError("topic_validation_generation_unexpected_internal", "HTTP_ACK", 500, ["topicTitle"]);
    }
    const parsed = parseTopicValidationEnvelope(content);
    if (parsed.ok) {
      return {
        contractVersion: TOPIC_VALIDATION_CONTRACT,
        validationId,
        version,
        parameters: input.parameters,
        decomposition: parsed.value.decomposition,
        evidence: parsed.value.evidence,
        gapMatrix: parsed.value.gapMatrix,
        novelty: parsed.value.novelty,
        score: parsed.value.score,
        reviewer2: parsed.value.reviewer2,
        recommendedNextStep: parsed.value.recommendedNextStep,
        evidenceStatus: "UNVERIFIED",
      };
    }
    lastFailure = { code: parsed.code, stage: parsed.stage, recoverableFields: parsed.recoverableFields };
  }
  throw new TopicValidationError(lastFailure?.code ?? "topic_validation_invalid", lastFailure?.stage ?? "VALIDATE_RESPONSE", 502, lastFailure?.recoverableFields ?? []);
}
