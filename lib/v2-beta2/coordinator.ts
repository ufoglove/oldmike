import "server-only";

import {
  beta2Hash,
  createV2Beta2StageInstanceHash,
  parseV2Beta2GenerateRequest,
  parseV2Beta2ProviderSubmitOutcome,
  parseV2Beta2ReconcileRequest,
  parseV2Beta2SaveConfirmedWorkspaceRequest,
  parseV2Beta2SaveSelectionRequest,
  type V2Beta2ProjectHead,
} from "./contracts.ts";
import { assertV2Beta2SubmissionCapability, type V2Beta2ProviderPort } from "./provider-port.ts";
import { reconcileV2Beta2Job } from "./reconciliation.ts";
import { PostgresV2Beta2Repository, V2Beta2RepositoryError, type V2Beta2JobRecord, type V2Beta2TenantContext } from "./repository.ts";

export type V2Beta2CoordinatorOutcome = {
  head: V2Beta2ProjectHead;
  replayed: boolean;
  providerSubmissionDelta: 0 | 1;
  snapshotAppendDelta: 0 | 1;
  eventAppendDelta: 0 | 1;
};

export type V2Beta2FaultPoint = "AFTER_T1" | "AFTER_T2_BEFORE_IO" | "DURING_IO" | "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT";

export class V2Beta2SimulatedCrash extends Error {
  readonly faultPoint: V2Beta2FaultPoint;

  constructor(faultPoint: V2Beta2FaultPoint) {
    super(`beta2_simulated_crash_${faultPoint.toLowerCase()}`);
    this.faultPoint = faultPoint;
  }
}

function existingOutcome(job: V2Beta2JobRecord, head: V2Beta2ProjectHead): V2Beta2CoordinatorOutcome | null {
  if (["SUCCEEDED", "RECONCILE_REQUIRED", "FAILED"].includes(job.state) && head.stageOutcome?.jobId !== job.jobId) throw new V2Beta2RepositoryError("beta2_stage_outcome_authority_invalid", 503);
  if (job.state === "SUCCEEDED") return { head, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 };
  if (job.state === "RECONCILE_REQUIRED") return { head, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 };
  if (job.state === "FAILED") return { head, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 };
  return null;
}

export function createV2Beta2Coordinator(input: { repository: PostgresV2Beta2Repository; provider: V2Beta2ProviderPort }) {
  return {
    async resume(context: V2Beta2TenantContext): Promise<V2Beta2CoordinatorOutcome> {
      const resumed = await input.repository.resumeProjectHead(context);
      return { head: resumed.head, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: resumed.eventAppendDelta };
    },

    async generate(context: V2Beta2TenantContext, rawRequest: unknown, options: { faultAt?: V2Beta2FaultPoint } = {}): Promise<V2Beta2CoordinatorOutcome> {
      const request = parseV2Beta2GenerateRequest(rawRequest);
      if (request.projectId !== context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
      assertV2Beta2SubmissionCapability(input.provider);
      const stageInstanceHash = createV2Beta2StageInstanceHash({ workspaceId: context.workspaceId, projectId: context.projectId, baseRevision: request.baseRevision, baseContentHash: request.baseContentHash });
      const reservation = await input.repository.reserveGeneration(context, request, stageInstanceHash);
      if (options.faultAt === "AFTER_T1") throw new V2Beta2SimulatedCrash("AFTER_T1");

      if (!reservation.created) {
        if (reservation.job.state === "SUBMITTING") {
          const stale = await input.repository.promoteStaleSubmitting(context, reservation.job.jobId);
          if (stale) return { head: stale, replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 1 };
          throw new V2Beta2RepositoryError("beta2_submission_in_progress", 409);
        }
        const prior = existingOutcome(reservation.job, reservation.replayHead ?? await input.repository.readProjectHead(context));
        if (prior) return prior;
      }

      const receiptCommitment = beta2Hash({ namespace: "old-mike-v2-beta2/provider-submission/1", jobId: reservation.job.jobId, stageInstanceHash, requestHash: reservation.job.requestHash });
      const submitting = await input.repository.markSubmitting(context, reservation.job.jobId, receiptCommitment);
      if (!submitting.shouldSubmit) {
        const prior = existingOutcome(submitting.job, await input.repository.readProjectHead(context));
        if (prior) return prior;
        throw new V2Beta2RepositoryError("beta2_submission_in_progress", 409);
      }
      if (options.faultAt === "AFTER_T2_BEFORE_IO") throw new V2Beta2SimulatedCrash("AFTER_T2_BEFORE_IO");

      try {
        if (options.faultAt === "DURING_IO") throw new Error("simulated_provider_io_loss");
        const providerOutcome = parseV2Beta2ProviderSubmitOutcome(await input.provider.submit({
          jobId: reservation.job.jobId,
          stageInstanceHash,
          requestHash: reservation.job.requestHash,
          receiptCommitment,
          source: request.source,
        }));
        if (providerOutcome.receiptCommitment !== receiptCommitment || providerOutcome.requestHash !== reservation.job.requestHash) throw new Error("provider_receipt_authority_mismatch");
        if (providerOutcome.completionClass === "COMPLETE") {
          if (options.faultAt === "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT") throw new Error("simulated_success_commit_gap");
          const committed = await input.repository.commitProviderSuccess(context, reservation.job.jobId, providerOutcome.result, "GENERATION_COMPLETE");
          return { head: committed.head, replayed: committed.replayed, providerSubmissionDelta: 1, snapshotAppendDelta: committed.replayed ? 0 : 1, eventAppendDelta: committed.replayed ? 0 : 1 };
        }
        if (providerOutcome.completionClass === "TERMINAL_REJECTED") {
          const rejected = await input.repository.markTerminalRejected(context, reservation.job.jobId, providerOutcome.reasonCode);
          return { head: rejected.head, replayed: rejected.replayed, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: rejected.replayed ? 0 : 1 };
        }
        const head = await input.repository.markCompletionUnknown(context, reservation.job.jobId);
        return { head, replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 };
      } catch (error) {
        if (error instanceof V2Beta2RepositoryError) throw error;
        const head = await input.repository.markCompletionUnknown(context, reservation.job.jobId, "PROVIDER_IO_OR_COMMIT_UNKNOWN");
        return { head, replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 };
      }
    },

    async saveSelection(context: V2Beta2TenantContext, rawRequest: unknown): Promise<V2Beta2CoordinatorOutcome> {
      const request = parseV2Beta2SaveSelectionRequest(rawRequest);
      if (request.projectId !== context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
      const result = await input.repository.saveSelection(context, request);
      return { head: result.head, replayed: result.replayed, providerSubmissionDelta: 0, snapshotAppendDelta: result.replayed ? 0 : 1, eventAppendDelta: result.replayed ? 0 : 1 };
    },

    async saveConfirmedWorkspace(context: V2Beta2TenantContext, rawRequest: unknown): Promise<V2Beta2CoordinatorOutcome> {
      const request = parseV2Beta2SaveConfirmedWorkspaceRequest(rawRequest);
      if (request.projectId !== context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
      const result = await input.repository.saveConfirmedWorkspace(context, request);
      return { head: result.head, replayed: result.replayed, providerSubmissionDelta: 0, snapshotAppendDelta: result.replayed ? 0 : 1, eventAppendDelta: result.replayed ? 0 : 1 };
    },

    async reconcile(context: V2Beta2TenantContext, rawRequest: unknown): Promise<V2Beta2CoordinatorOutcome> {
      const request = parseV2Beta2ReconcileRequest(rawRequest);
      if (request.projectId !== context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
      const result = await reconcileV2Beta2Job({ repository: input.repository, provider: input.provider, context, request });
      return { head: result.head, replayed: result.replayed, providerSubmissionDelta: 0, snapshotAppendDelta: result.snapshotAppendDelta, eventAppendDelta: result.eventAppendDelta };
    },
  };
}

export type V2Beta2Coordinator = ReturnType<typeof createV2Beta2Coordinator>;
