import { parseDirectionArtifact, parseFieldAssistArtifact, parseS0Artifact, type V2Alpha2ErrorCode, type V2Alpha2Operation } from "./contracts.ts";

export type V2Alpha2Claim = {
  id: string;
  rootJobId: string;
  operation: V2Alpha2Operation;
  requestPayload: Record<string, unknown>;
  requestHash: string;
  leaseOwner: string;
  leaseToken: string;
  leaseGeneration: number;
  stateVersion: number;
};

type EffectState = "INTENT_PERSISTED" | "PROVEN_NOT_SUBMITTED" | "SUBMISSION_POSSIBLE" | "ACKNOWLEDGED" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED";

export type V2Alpha2WorkerRepository = {
  claim(input: { workerOwner: string; workerToken: string }): Promise<V2Alpha2Claim | null>;
  ensureIntent(claim: V2Alpha2Claim): Promise<EffectState>;
  markSubmissionPossible(claim: V2Alpha2Claim): Promise<void>;
  commitSuccess(claim: V2Alpha2Claim, artifact: unknown): Promise<{ resultId: string; childCreated: boolean }>;
  completeProvenNotSubmitted(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode): Promise<void>;
  completeTerminalRejected(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode): Promise<void>;
  completeUnknown(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode): Promise<void>;
  markReconcileRequired(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode): Promise<void>;
};

export type V2Alpha2ProviderResult =
  | { kind: "success"; payload: unknown }
  | { kind: "proven-not-submitted"; code: V2Alpha2ErrorCode }
  | { kind: "terminal-rejected"; code: V2Alpha2ErrorCode }
  | { kind: "completion-unknown"; code: V2Alpha2ErrorCode };

export type V2Alpha2WorkerProvider = {
  capability: "ENABLED" | "DISABLED";
  submit(input: { operation: V2Alpha2Operation; requestPayload: Record<string, unknown>; requestHash: string; markSubmissionPossible: () => Promise<void> }): Promise<V2Alpha2ProviderResult>;
};

export class V2Alpha2WorkerTermination extends Error {
  readonly crashPoint: "BEFORE_INTENT" | "AFTER_INTENT" | "AFTER_SUBMISSION_POSSIBLE";
  constructor(crashPoint: "BEFORE_INTENT" | "AFTER_INTENT" | "AFTER_SUBMISSION_POSSIBLE") {
    super(`v2_alpha2_worker_terminated:${crashPoint}`);
    this.name = "V2Alpha2WorkerTermination";
    this.crashPoint = crashPoint;
  }
}

function parseArtifact(operation: V2Alpha2Operation, payload: unknown) {
  if (operation === "GENERATE_DIRECTIONS") return parseDirectionArtifact(payload);
  if (operation === "EXPAND_SELECTED_S0") return parseS0Artifact(payload);
  return parseFieldAssistArtifact(payload);
}

function terminalEffect(state: EffectState) {
  return state === "PROVEN_NOT_SUBMITTED" || state === "ACKNOWLEDGED" || state === "COMPLETION_UNKNOWN" || state === "TERMINAL_REJECTED";
}

export async function runV2Alpha2WorkerOnce(
  repository: V2Alpha2WorkerRepository,
  provider: V2Alpha2WorkerProvider,
  options: {
    workerOwner: string;
    workerToken: string;
    crashPoint?: "BEFORE_INTENT" | "AFTER_INTENT" | "AFTER_SUBMISSION_POSSIBLE";
  },
): Promise<{ outcome: "IDLE" | "COMMITTED" | "TERMINAL_REJECTED" | "PROVEN_NOT_SUBMITTED" | "RECONCILE_REQUIRED"; operation?: V2Alpha2Operation }> {
  const claim = await repository.claim({ workerOwner: options.workerOwner, workerToken: options.workerToken });
  if (!claim) return { outcome: "IDLE" };
  if (options.crashPoint === "BEFORE_INTENT") throw new V2Alpha2WorkerTermination("BEFORE_INTENT");

  const existingEffect = await repository.ensureIntent(claim);
  if (existingEffect === "SUBMISSION_POSSIBLE" || existingEffect === "COMPLETION_UNKNOWN") {
    await repository.markReconcileRequired(claim, "COMPLETION_UNKNOWN");
    return { outcome: "RECONCILE_REQUIRED", operation: claim.operation };
  }
  if (terminalEffect(existingEffect)) {
    if (existingEffect === "ACKNOWLEDGED") return { outcome: "COMMITTED", operation: claim.operation };
    if (existingEffect === "PROVEN_NOT_SUBMITTED") return { outcome: "PROVEN_NOT_SUBMITTED", operation: claim.operation };
    if (existingEffect === "TERMINAL_REJECTED") return { outcome: "TERMINAL_REJECTED", operation: claim.operation };
    return { outcome: "RECONCILE_REQUIRED", operation: claim.operation };
  }
  if (options.crashPoint === "AFTER_INTENT") throw new V2Alpha2WorkerTermination("AFTER_INTENT");

  if (provider.capability !== "ENABLED") {
    await repository.completeProvenNotSubmitted(claim, "TRANSPORT");
    return { outcome: "PROVEN_NOT_SUBMITTED", operation: claim.operation };
  }

  let submissionPossible = false;
  let result: V2Alpha2ProviderResult;
  try {
    result = await provider.submit({
      operation: claim.operation,
      requestPayload: claim.requestPayload,
      requestHash: claim.requestHash,
      markSubmissionPossible: async () => {
        if (submissionPossible) throw new Error("v2_alpha2_submission_marker_duplicate");
        await repository.markSubmissionPossible(claim);
        submissionPossible = true;
        if (options.crashPoint === "AFTER_SUBMISSION_POSSIBLE") throw new V2Alpha2WorkerTermination("AFTER_SUBMISSION_POSSIBLE");
      },
    });
  } catch {
    if (!submissionPossible) {
      await repository.completeProvenNotSubmitted(claim, "TRANSPORT");
      return { outcome: "PROVEN_NOT_SUBMITTED", operation: claim.operation };
    }
    await repository.completeUnknown(claim, "TRANSPORT"); await repository.markReconcileRequired(claim, "TRANSPORT");
    return { outcome: "RECONCILE_REQUIRED", operation: claim.operation };
  }

  if (result.kind === "proven-not-submitted" && !submissionPossible) {
    await repository.completeProvenNotSubmitted(claim, result.code);
    return { outcome: "PROVEN_NOT_SUBMITTED", operation: claim.operation };
  }
  if (!submissionPossible) {
    await repository.completeProvenNotSubmitted(claim, "UNEXPECTED_INTERNAL");
    return { outcome: "PROVEN_NOT_SUBMITTED", operation: claim.operation };
  }
  if (result.kind === "completion-unknown" || result.kind === "proven-not-submitted") {
    const code = result.kind === "completion-unknown" ? result.code : "COMPLETION_UNKNOWN";
    await repository.completeUnknown(claim, code);
    await repository.markReconcileRequired(claim, code);
    return { outcome: "RECONCILE_REQUIRED", operation: claim.operation };
  }
  if (result.kind === "terminal-rejected") {
    await repository.completeTerminalRejected(claim, result.code);
    return { outcome: "TERMINAL_REJECTED", operation: claim.operation };
  }

  let artifact: unknown;
  try {
    artifact = parseArtifact(claim.operation, result.payload);
  } catch {
    await repository.completeTerminalRejected(claim, "OUTPUT_SCHEMA");
    return { outcome: "TERMINAL_REJECTED", operation: claim.operation };
  }
  await repository.commitSuccess(claim, artifact);
  return { outcome: "COMMITTED", operation: claim.operation };
}
