import "server-only";

import { executeDefaultOpenClawChatCompletion } from "./openclaw.ts";
import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import { collectTopicLabObservations } from "./topic-lab-source-provider.ts";
import { radarMessages } from "./assist-prompts.ts";
import {
  OPPORTUNITY_MAX,
  RADAR_CONTRACT,
  parseRadarEnvelope,
  type RadarOpportunity,
  type RadarScanResult,
} from "./research-opportunity-radar-contract.ts";

export class RadarGenerationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly stage: string;
  readonly recoverableFields: string[];
  constructor(code: string, stage: string, status = 502, recoverableFields: string[] = []) {
    super(code);
    this.name = "RadarGenerationError";
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.recoverableFields = recoverableFields;
  }
}

export async function executeRadarScan(
  input: { focus: string; idempotencyKey: string },
  options: { signal?: AbortSignal; observedAt?: Date } = {},
): Promise<RadarScanResult> {
  const observedAt = options.observedAt || new Date();
  const scanId = `RADAR-${observedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${sha256Canonical({ idempotencyKey: input.idempotencyKey }).slice(0, 8).toUpperCase()}`;
  // 1) collect real scholarly observations for the focus (Evidence First)
  const query = input.focus || "AI education XR occupational safety digital twin multimodal agentic";
  let observations: { provider: string; publishedAt: string | null; title: string; doi: string | null }[] = [];
  let capability = "SCHOLARLY_DISABLED";
  let providerStates: Record<string, string> = {};
  try {
    const collected = await collectTopicLabObservations(
      {
        operation: "ANALYZE",
        idempotencyKey: input.idempotencyKey,
        researchDirection: query,
        advanced: { domain: null, outputTrack: null, population: "", context: "", method: "", data: "", timeline: "", ethics: "" },
        sourceStrategy: "SCHOLARLY_AUTO",
        evidenceWindow: { from: `${observedAt.getUTCFullYear() - 3}-01-01`, to: observedAt.toISOString().slice(0, 10) },
        sourceUrls: [],
      },
      { now: () => observedAt, signal: options.signal },
    );
    observations = collected.observations.map((o) => ({ provider: o.provider, publishedAt: o.publishedAt, title: o.title, doi: o.doi }));
    capability = collected.capability;
    providerStates = collected.providerStates;
  } catch {
    // scanning proceeds with what evidence exists; the result is labelled UNVERIFIED
  }
  // 2) generate opportunity analysis with one automatic retry on contract rejection
  const sessionBase = `radar:${sha256Canonical({ idempotencyKey: input.idempotencyKey }).slice(0, 32)}`;
  let lastFailure: { code: string; stage: string; recoverableFields: string[] } | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content: string;
    try {
      const result = await executeDefaultOpenClawChatCompletion(
        radarMessages({ focus: input.focus, idempotencyKey: input.idempotencyKey }, observations as never),
        attempt === 0 ? sessionBase : `${sessionBase}:retry${attempt}`,
        "M01_HORIZON",
        options.signal,
      );
      if (result.kind !== "success") throw new RadarGenerationError(`radar_generation_${result.code}`, "HTTP_ACK", result.kind === "proven-not-submitted" ? 503 : 502, ["focus"]);
      content = result.content;
    } catch (error) {
      if (error instanceof RadarGenerationError) throw error;
      throw new RadarGenerationError("radar_generation_unexpected_internal", "HTTP_ACK", 500, ["focus"]);
    }
    const parsed = parseRadarEnvelope(content);
    if (parsed.ok) {
      return {
        contractVersion: RADAR_CONTRACT,
        scanId,
        generatedAt: observedAt.toISOString(),
        focus: input.focus,
        capability,
        providerStates,
        globalOpportunities: parsed.value.opportunities,
        myOpportunities: parsed.value.opportunities.slice().sort((a, b) => b.researcherFit - a.researcherFit || b.opportunityScore - a.opportunityScore).slice(0, Math.min(6, OPPORTUNITY_MAX)),
        evidenceNote: parsed.value.evidenceNote,
      };
    }
    lastFailure = { code: parsed.code, stage: parsed.stage, recoverableFields: parsed.recoverableFields };
  }
  throw new RadarGenerationError(lastFailure?.code ?? "radar_invalid", lastFailure?.stage ?? "VALIDATE_RESPONSE", 502, lastFailure?.recoverableFields ?? []);
}
