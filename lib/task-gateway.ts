import "server-only";

import {
  TaskGatewayContractError,
  assertTaskTransition,
  buildSanitizedReceipt,
  taskGatewayHash,
  taskIdempotencyFingerprint,
  type SanitizedExecutionReceipt,
  type TaskEnvelope,
  type TaskHumanGate,
  type TaskOperation,
} from "./task-gateway-contract.ts";
import type { AuthorizedProjectTaskContext } from "./task-context-contract.ts";

export type TaskGatewayFeatureState = "DISABLED" | "LOCAL_MOCK_ONLY" | "PRIVATE_CHAT_COMPLETIONS" | "PRIVATE_RESPONSES";
export type TaskProviderCompletionClass = "PROVEN_NOT_SUBMITTED" | "TERMINAL_PROVIDER_REJECTED" | "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED";

export class TaskProviderExecutionError extends TaskGatewayContractError {
  readonly completionClass: TaskProviderCompletionClass;
  constructor(code: string, completionClass: TaskProviderCompletionClass, status = 502) {
    super(code, status);
    this.name = "TaskProviderExecutionError";
    this.completionClass = completionClass;
  }
}

export type TaskAdapterResult = {
  status: "MOCK_COMPLETE" | "PROVIDER_COMPLETE" | "WAITING_HUMAN" | "FAILED_FAIL_CLOSED";
  output: unknown;
  outputHash: string | null;
  humanGate: TaskHumanGate | null;
  dataEgress: "NONE" | "OPAQUE_METADATA_ONLY" | "BOUNDED_AUTHORIZED_PROJECT_CONTEXT";
};

export interface TaskProviderAdapter {
  readonly adapterKind: "LOCAL_MOCK" | "PRIVATE_CHAT_COMPLETIONS" | "PRIVATE_RESPONSES";
  readonly supportedOperations: readonly TaskOperation[];
  execute(envelope: TaskEnvelope, signal: AbortSignal, context?: AuthorizedProjectTaskContext): Promise<TaskAdapterResult>;
}

export type TaskGatewayResult = { receipt: SanitizedExecutionReceipt; output: unknown };

export function resolveTaskGatewayFeatureState(environment: Readonly<Record<string, string | undefined>> = process.env): TaskGatewayFeatureState {
  if (environment.OLD_MIKE_TASK_GATEWAY_MODE === "LOCAL_MOCK_ONLY") return "LOCAL_MOCK_ONLY";
  if (environment.OPENCLAW_BASE_URL && environment.OPENCLAW_GATEWAY_TOKEN) return "PRIVATE_CHAT_COMPLETIONS";
  return "DISABLED";
}

function terminalState(status: TaskAdapterResult["status"]) {
  return status === "MOCK_COMPLETE" || status === "PROVIDER_COMPLETE" ? "COMPLETED" as const : status === "WAITING_HUMAN" ? "WAITING_HUMAN" as const : "FAILED" as const;
}

export class ServerOnlyTaskGateway {
  readonly #featureState: TaskGatewayFeatureState;
  readonly #adapter: TaskProviderAdapter;
  readonly #receipts = new Map<string, TaskGatewayResult>();
  readonly #taskFingerprints = new Map<string, string>();
  readonly #blockedFingerprints = new Map<string, TaskProviderExecutionError>();

  constructor(input: { featureState: TaskGatewayFeatureState; adapter: TaskProviderAdapter }) {
    this.#featureState = input.featureState;
    this.#adapter = input.adapter;
    if (input.featureState === "LOCAL_MOCK_ONLY" && input.adapter.adapterKind !== "LOCAL_MOCK") throw new TaskGatewayContractError("task_adapter_mode_mismatch", 503);
    if (input.featureState === "PRIVATE_CHAT_COMPLETIONS" && input.adapter.adapterKind !== "PRIVATE_CHAT_COMPLETIONS") throw new TaskGatewayContractError("task_adapter_mode_mismatch", 503);
    if (input.featureState === "PRIVATE_RESPONSES" && input.adapter.adapterKind !== "PRIVATE_RESPONSES") throw new TaskGatewayContractError("task_adapter_mode_mismatch", 503);
  }

  async execute(envelope: TaskEnvelope, signal: AbortSignal = new AbortController().signal, context?: AuthorizedProjectTaskContext): Promise<TaskGatewayResult> {
    if (this.#featureState === "DISABLED") throw new TaskGatewayContractError("task_gateway_disabled", 503);
    if (signal.aborted) throw new TaskGatewayContractError("task_canceled", 409);
    if (!this.#adapter.supportedOperations.includes(envelope.operation)) throw new TaskGatewayContractError("operation_not_supported", 422);

    const fingerprint = taskIdempotencyFingerprint(envelope);
    const priorTaskFingerprint = this.#taskFingerprints.get(envelope.taskId);
    if (priorTaskFingerprint && priorTaskFingerprint !== fingerprint) throw new TaskGatewayContractError("task_id_payload_conflict", 409);
    const blocked = this.#blockedFingerprints.get(fingerprint);
    if (blocked) throw new TaskProviderExecutionError("task_reconciliation_required", blocked.completionClass, 409);
    const replay = this.#receipts.get(fingerprint);
    if (replay) {
      const { contractVersion: _contractVersion, receiptHash: _receiptHash, ...replayInput } = replay.receipt;
      return { output: replay.output, receipt: buildSanitizedReceipt({ ...replayInput, attemptClass: "IDEMPOTENT_REPLAY" }) };
    }

    this.#taskFingerprints.set(envelope.taskId, fingerprint);
    assertTaskTransition("QUEUED", "RUNNING");
    const startedAt = envelope.createdAt;
    const inputHash = taskGatewayHash(envelope.payload);
    let adapterResult: TaskAdapterResult;
    try {
      adapterResult = await this.#adapter.execute(envelope, signal, context);
    } catch (error) {
      if (error instanceof TaskProviderExecutionError) {
        this.#blockedFingerprints.set(fingerprint, error);
        throw error;
      }
      if (error instanceof TaskGatewayContractError) throw error;
      const unknown = new TaskProviderExecutionError("task_adapter_failed_fail_closed", "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED");
      this.#blockedFingerprints.set(fingerprint, unknown);
      throw unknown;
    }
    if (signal.aborted) {
      const unknown = new TaskProviderExecutionError("task_canceled_after_submission", "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED", 409);
      this.#blockedFingerprints.set(fingerprint, unknown);
      throw unknown;
    }
    const state = terminalState(adapterResult.status);
    assertTaskTransition("RUNNING", state);
    if ((state === "WAITING_HUMAN") !== (adapterResult.humanGate !== null)) throw new TaskGatewayContractError("adapter_gate_binding_mismatch", 502);
    if (adapterResult.outputHash !== null && adapterResult.outputHash !== taskGatewayHash(adapterResult.output)) throw new TaskGatewayContractError("adapter_output_hash_mismatch", 502);
    const finishedAt = new Date(Math.max(Date.parse(startedAt), Date.now())).toISOString();
    const receipt = buildSanitizedReceipt({
      taskId: envelope.taskId,
      operation: envelope.operation,
      state,
      startedAt,
      finishedAt,
      inputHash,
      outputHash: adapterResult.outputHash,
      idempotencyFingerprint: fingerprint,
      attemptClass: "FIRST",
      dataEgress: adapterResult.dataEgress,
      humanGate: adapterResult.humanGate,
      sanitizedStatus: adapterResult.status,
    });
    const result = { receipt, output: adapterResult.output };
    this.#receipts.set(fingerprint, result);
    return result;
  }

  cancelBeforeExecution(envelope: TaskEnvelope): SanitizedExecutionReceipt {
    const inputHash = taskGatewayHash(envelope.payload);
    const fingerprint = taskIdempotencyFingerprint(envelope);
    assertTaskTransition("QUEUED", "CANCELED");
    return buildSanitizedReceipt({ taskId: envelope.taskId, operation: envelope.operation, state: "CANCELED", startedAt: envelope.createdAt, finishedAt: envelope.createdAt, inputHash, outputHash: null, idempotencyFingerprint: fingerprint, attemptClass: "FIRST", dataEgress: "NONE", humanGate: null, sanitizedStatus: "CANCELED" });
  }
}

export function assertContinuation(parent: SanitizedExecutionReceipt, child: TaskEnvelope) {
  const continuation = child.continuation;
  if (!continuation || parent.state !== "WAITING_HUMAN" || parent.humanGate !== continuation.approvedGate || parent.taskId !== continuation.parentTaskId || parent.receiptHash !== continuation.parentReceiptHash || child.taskId === parent.taskId) throw new TaskGatewayContractError("invalid_human_gate_continuation", 409);
  if (continuation.approvalHash === taskGatewayHash({})) throw new TaskGatewayContractError("empty_human_approval", 409);
}
