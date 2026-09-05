import "server-only";

import { beta2Hash, parseV2Beta2ProviderLookupOutcome, type V2Beta2ProjectHead, type V2Beta2ReconcileRequest } from "./contracts.ts";
import { assertV2Beta2LookupCapability, type V2Beta2ProviderPort } from "./provider-port.ts";
import { PostgresV2Beta2Repository, V2Beta2RepositoryError, type V2Beta2TenantContext } from "./repository.ts";

export type V2Beta2ReconciliationOutcome = {
  head: V2Beta2ProjectHead;
  replayed: boolean;
  snapshotAppendDelta: 0 | 1;
  eventAppendDelta: 0 | 1;
  lookupStatus: "NOT_FOUND" | "PENDING" | "COMPLETE" | "REJECTED" | "UNKNOWN";
};

export async function reconcileV2Beta2Job(input: {
  repository: PostgresV2Beta2Repository;
  provider: V2Beta2ProviderPort;
  context: V2Beta2TenantContext;
  request: V2Beta2ReconcileRequest;
}): Promise<V2Beta2ReconciliationOutcome> {
  return input.repository.withReconciliationLookupAuthority(input.context, input.request.jobId, async () => {
    const job = await input.repository.getJob(input.context, input.request.jobId);
    if (!job || job.projectId !== input.context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
    if (job.state === "SUCCEEDED" || job.state === "FAILED") {
      const terminal = await input.repository.replayReconciliationTerminal(input.context, input.request);
      return { head: terminal.head, replayed: true, snapshotAppendDelta: 0, eventAppendDelta: 0, lookupStatus: terminal.terminalStatus };
    }
    if (job.state !== "RECONCILE_REQUIRED" || !job.providerReceiptCommitment || job.providerSubmissionCount !== 1) throw new V2Beta2RepositoryError("beta2_reconciliation_not_available", 409);

    assertV2Beta2LookupCapability(input.provider);

    let lookup;
    try {
      lookup = parseV2Beta2ProviderLookupOutcome(await input.provider.lookup({ receiptCommitment: job.providerReceiptCommitment, requestHash: job.requestHash }));
    } catch {
      throw new V2Beta2RepositoryError("beta2_provider_lookup_invalid", 503);
    }
    if (lookup.receiptCommitment !== job.providerReceiptCommitment || lookup.requestHash !== job.requestHash) {
      throw new V2Beta2RepositoryError("beta2_reconciliation_authority_invalid", 503);
    }
    if (lookup.status === "COMPLETE") {
      const committed = await input.repository.commitProviderSuccess(input.context, job.jobId, lookup.result, "RECONCILIATION_COMPLETE", input.request.requestId);
      return { head: committed.head, replayed: committed.replayed, snapshotAppendDelta: committed.replayed ? 0 : 1, eventAppendDelta: committed.replayed ? 0 : 1, lookupStatus: "COMPLETE" };
    }
    if (lookup.status === "REJECTED") {
      const rejected = await input.repository.markTerminalRejected(input.context, job.jobId, "RECONCILIATION_REJECTED", input.request.requestId);
      return { head: rejected.head, replayed: rejected.replayed, snapshotAppendDelta: 0, eventAppendDelta: rejected.replayed ? 0 : 1, lookupStatus: "REJECTED" };
    }
    const head = await input.repository.readProjectHead(input.context);
    if (!head.reconciliation || head.reconciliation.jobId !== job.jobId) throw new V2Beta2RepositoryError("beta2_reconciliation_authority_invalid", 503);
    if (!/^[0-9a-f]{64}$/u.test(beta2Hash({ jobId: job.jobId, receipt: job.providerReceiptCommitment, lookupStatus: lookup.status }))) throw new V2Beta2RepositoryError("beta2_reconciliation_authority_invalid", 503);
    return { head, replayed: true, snapshotAppendDelta: 0, eventAppendDelta: 0, lookupStatus: lookup.status };
  });
}
