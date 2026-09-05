import "server-only";

import { Pool, type PoolClient } from "pg";
import {
  V2_BETA2_CONTRACT_VERSION,
  V2_BETA2_STAGE_ID,
  beta2CanonicalJson,
  createV2Beta2EventHash,
  createV2Beta2GenerationPayloadHash,
  createV2Beta2ConfirmedWorkspace,
  createV2Beta2ConfirmedWorkspacePayloadHash,
  createV2Beta2ReconciliationRequestHash,
  createV2Beta2SelectionPayloadHash,
  createV2Beta2StageInstanceHash,
  createV2Beta2StageOutcome,
  createV2Beta2DurableSnapshot,
  createV2Beta2InitialHead,
  parseV2Beta2DurableSnapshot,
  parseV2Beta2GenerateRequest,
  parseV2Beta2ProviderResult,
  type V2Beta2DurableSnapshot,
  type V2Beta2GenerateRequest,
  type V2Beta2ProjectHead,
  type V2Beta2ProviderResult,
  type V2Beta2ReconcileRequest,
  type V2Beta2SaveConfirmedWorkspaceRequest,
  type V2Beta2SaveSelectionRequest,
  type V2Beta2StageOutcome,
} from "./contracts.ts";
import { validateV2Beta2DisposableDatabaseUrl } from "./environment.ts";

export { validateV2Beta2DisposableDatabaseUrl } from "./environment.ts";

export type V2Beta2TenantContext = {
  workspaceId: string;
  projectId: string;
  userId: string;
};

export type V2Beta2JobState = "INTENT_RECORDED" | "SUBMITTING" | "SUCCEEDED" | "FAILED" | "RECONCILE_REQUIRED";

export type V2Beta2JobRecord = {
  workspaceId: string;
  projectId: string;
  jobId: string;
  userId: string;
  stageInstanceHash: string;
  idempotencyKey: string;
  requestId: string;
  requestHash: string;
  sourceRevision: number;
  sourceHash: string;
  request: V2Beta2GenerateRequest;
  state: V2Beta2JobState;
  completionClass: "PENDING" | "COMPLETE" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED";
  providerSubmissionCount: 0 | 1;
  providerReceiptCommitment: string | null;
  providerResultHash: string | null;
  sanitizedReasonCode: string | null;
};

export type V2Beta2GenerationReservation = { created: boolean; job: V2Beta2JobRecord; replayHead: V2Beta2ProjectHead | null };

type V2Beta2OperationIntent = {
  operation: "GENERATE_DURABLE_CORE" | "SAVE_DIRECTION_SELECTION" | "SAVE_CONFIRMED_WORKSPACE";
  idempotencyKey: string;
  requestId: string;
  requestHash: string;
  status: "PENDING" | "COMMITTED";
  committedRevision: number | null;
  committedContentHash: string | null;
};

export class V2Beta2RepositoryError extends Error {
  readonly code: string;
  readonly status: 400 | 404 | 409 | 413 | 503;

  constructor(code: string, status: 400 | 404 | 409 | 413 | 503 = 409) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const HASH = /^[0-9a-f]{64}$/u;
let disposablePool: Pool | null = null;

export function getV2Beta2DisposablePool() {
  if (!disposablePool) disposablePool = new Pool({ connectionString: validateV2Beta2DisposableDatabaseUrl(process.env.BETA2_DISPOSABLE_DATABASE_URL), max: 8 });
  return disposablePool;
}

export async function closeV2Beta2DisposablePool() {
  const active = disposablePool;
  disposablePool = null;
  if (active) await active.end();
}

function requestHash(request: V2Beta2GenerateRequest | V2Beta2SaveSelectionRequest | V2Beta2SaveConfirmedWorkspaceRequest) {
  return request.operation === "GENERATE_DURABLE_CORE"
    ? createV2Beta2GenerationPayloadHash(request)
    : request.operation === "SAVE_DIRECTION_SELECTION"
      ? createV2Beta2SelectionPayloadHash(request)
      : createV2Beta2ConfirmedWorkspacePayloadHash(request);
}

function jobIdFor(stageInstanceHash: string) {
  return `beta2-job-${stageInstanceHash.slice(0, 32)}`;
}

function numeric(value: string | number | bigint) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new V2Beta2RepositoryError("beta2_database_numeric_invalid", 503);
  return parsed;
}

function jobFromRow(row: Record<string, unknown>): V2Beta2JobRecord {
  const request = parseV2Beta2GenerateRequest(row.requestPayload);
  const providerSubmissionCount = numeric(row.providerSubmissionCount as string) as 0 | 1;
  const job: V2Beta2JobRecord = {
    workspaceId: String(row.workspaceId),
    projectId: String(row.projectId),
    jobId: String(row.jobId),
    userId: String(row.userId),
    stageInstanceHash: String(row.stageInstanceHash),
    idempotencyKey: String(row.idempotencyKey),
    requestId: String(row.requestId),
    requestHash: String(row.requestHash),
    sourceRevision: numeric(row.sourceRevision as string),
    sourceHash: String(row.sourceHash),
    request,
    state: row.state as V2Beta2JobState,
    completionClass: row.completionClass as V2Beta2JobRecord["completionClass"],
    providerSubmissionCount,
    providerReceiptCommitment: row.providerReceiptCommitment === null ? null : String(row.providerReceiptCommitment),
    providerResultHash: row.providerResultHash === null ? null : String(row.providerResultHash),
    sanitizedReasonCode: row.sanitizedReasonCode === null ? null : String(row.sanitizedReasonCode),
  };
  const expectedStageInstanceHash = createV2Beta2StageInstanceHash({
    workspaceId: job.workspaceId,
    projectId: job.projectId,
    baseRevision: job.request.baseRevision,
    baseContentHash: job.request.baseContentHash,
  });
  if (!HASH.test(job.stageInstanceHash) || !HASH.test(job.requestHash) || !HASH.test(job.sourceHash)
    || job.stageInstanceHash !== expectedStageInstanceHash || job.requestHash !== requestHash(job.request)
    || job.sourceRevision !== job.request.baseRevision || job.sourceHash !== job.request.source.sourceHash) {
    throw new V2Beta2RepositoryError("beta2_job_authority_invalid", 503);
  }
  return job;
}

const JOB_SELECT = `SELECT workspace_id AS "workspaceId", project_id AS "projectId", job_id AS "jobId",
  created_by_user_id AS "userId", stage_instance_hash AS "stageInstanceHash", idempotency_key AS "idempotencyKey",
  request_id AS "requestId", request_hash AS "requestHash", source_revision AS "sourceRevision", source_hash AS "sourceHash",
  request_payload AS "requestPayload", state, completion_class AS "completionClass",
  provider_submission_count AS "providerSubmissionCount", provider_receipt_commitment AS "providerReceiptCommitment",
  provider_result_hash AS "providerResultHash", sanitized_reason_code AS "sanitizedReasonCode" FROM beta2_generation_jobs`;

export class PostgresV2Beta2Repository {
  readonly pool: Pool;
  private readonly staleAfterMs: number;

  constructor(pool: Pool, staleAfterMs = 30_000) {
    this.pool = pool;
    this.staleAfterMs = staleAfterMs;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '10000ms'");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockProject(client: PoolClient, context: V2Beta2TenantContext) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('old-mike-v2-beta2/project-lock/2' || chr(31) || $1 || chr(31) || $2, 22020))", [context.workspaceId, context.projectId]);
    const project = await client.query(
      `SELECT p.project_id FROM projects p JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$3
        WHERE p.workspace_id=$1 AND p.project_id=$2 AND p.status='ACTIVE' AND p.legacy=false AND m.role IN ('owner','member')`,
      [context.workspaceId, context.projectId, context.userId],
    );
    if (project.rowCount !== 1) throw new V2Beta2RepositoryError("not_found", 404);
  }

  private async readStageOutcomeWithClient(client: PoolClient, context: V2Beta2TenantContext, exactJobId?: string): Promise<V2Beta2StageOutcome | null> {
    const jobResult = await client.query<Record<string, unknown>>(
      exactJobId === undefined
        ? `${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND state IN ('RECONCILE_REQUIRED','SUCCEEDED','FAILED')
            ORDER BY (state='RECONCILE_REQUIRED') DESC, updated_at DESC, job_id DESC LIMIT 1`
        : `${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3 AND state IN ('SUCCEEDED','FAILED')`,
      exactJobId === undefined ? [context.workspaceId, context.projectId] : [context.workspaceId, context.projectId, exactJobId],
    );
    if (!jobResult.rows[0]) return null;
    const job = jobFromRow(jobResult.rows[0]);
    if (job.state === "RECONCILE_REQUIRED") {
      if (job.completionClass !== "COMPLETION_UNKNOWN" || job.providerSubmissionCount !== 1 || !job.providerReceiptCommitment || job.providerResultHash !== null || !job.sanitizedReasonCode) throw new V2Beta2RepositoryError("beta2_stage_outcome_authority_invalid", 503);
      return createV2Beta2StageOutcome(context.projectId, {
        jobId: job.jobId,
        stageInstanceHash: job.stageInstanceHash,
        generationRequestId: job.requestId,
        generationRequestHash: job.requestHash,
        status: "RECONCILE_REQUIRED",
        completionClass: "COMPLETION_UNKNOWN",
        providerSubmissionCount: 1,
        providerReceiptCommitment: job.providerReceiptCommitment,
        providerResultHash: null,
        reasonCode: job.sanitizedReasonCode,
        terminalEvent: null,
      });
    }
    const terminalEvents = await client.query<Record<string, unknown>>(
      `SELECT sequence,event_type AS "eventType",operation,idempotency_key AS "idempotencyKey",job_id AS "jobId",
        request_id AS "requestId",request_hash AS "requestHash",from_revision AS "fromRevision",to_revision AS "toRevision",
        snapshot_revision AS "snapshotRevision",predecessor_event_hash AS "predecessorEventHash",event_hash AS "eventHash"
       FROM beta2_project_events WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3
        AND event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE','GENERATION_TERMINAL_FAILURE','RECONCILIATION_TERMINAL_FAILURE') ORDER BY sequence`,
      [context.workspaceId, context.projectId, job.jobId],
    );
    if (terminalEvents.rowCount !== 1) throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
    const event = terminalEvents.rows[0];
    const sequence = numeric(event.sequence as string);
    const fromRevision = numeric(event.fromRevision as string);
    const toRevision = numeric(event.toRevision as string);
    const snapshotRevision = event.snapshotRevision === null ? null : numeric(event.snapshotRevision as string);
    const predecessorEventHash = event.predecessorEventHash === null ? null : String(event.predecessorEventHash);
    const expectedEventHash = createV2Beta2EventHash({
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      sequence,
      eventType: String(event.eventType),
      operation: event.operation as "GENERATE_DURABLE_CORE" | "RECONCILE_UNKNOWN",
      idempotencyKey: event.idempotencyKey === null ? null : String(event.idempotencyKey),
      jobId: String(event.jobId),
      requestId: String(event.requestId),
      requestHash: String(event.requestHash),
      fromRevision,
      toRevision,
      snapshotRevision,
      predecessorEventHash,
    });
    if (event.jobId !== job.jobId || event.eventHash !== expectedEventHash) throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
    const terminalEvent = {
      eventType: String(event.eventType) as "GENERATION_COMPLETE" | "RECONCILIATION_COMPLETE" | "GENERATION_TERMINAL_FAILURE" | "RECONCILIATION_TERMINAL_FAILURE",
      operation: String(event.operation) as "GENERATE_DURABLE_CORE" | "RECONCILE_UNKNOWN",
      requestId: String(event.requestId),
      requestHash: String(event.requestHash),
    };
    if (job.state === "SUCCEEDED") {
      if (job.completionClass !== "COMPLETE" || job.providerSubmissionCount !== 1 || !job.providerReceiptCommitment || !job.providerResultHash || job.sanitizedReasonCode !== null || !["GENERATION_COMPLETE", "RECONCILIATION_COMPLETE"].includes(terminalEvent.eventType)) throw new V2Beta2RepositoryError("beta2_stage_outcome_authority_invalid", 503);
      return createV2Beta2StageOutcome(context.projectId, { jobId: job.jobId, stageInstanceHash: job.stageInstanceHash, generationRequestId: job.requestId, generationRequestHash: job.requestHash, status: "COMPLETE", completionClass: "COMPLETE", providerSubmissionCount: 1, providerReceiptCommitment: job.providerReceiptCommitment, providerResultHash: job.providerResultHash, reasonCode: null, terminalEvent });
    }
    if (job.completionClass !== "TERMINAL_REJECTED" || !job.sanitizedReasonCode || job.providerResultHash !== null || !["GENERATION_TERMINAL_FAILURE", "RECONCILIATION_TERMINAL_FAILURE"].includes(terminalEvent.eventType)) throw new V2Beta2RepositoryError("beta2_stage_outcome_authority_invalid", 503);
    return createV2Beta2StageOutcome(context.projectId, { jobId: job.jobId, stageInstanceHash: job.stageInstanceHash, generationRequestId: job.requestId, generationRequestHash: job.requestHash, status: "REJECTED", completionClass: "TERMINAL_REJECTED", providerSubmissionCount: job.providerSubmissionCount, providerReceiptCommitment: job.providerReceiptCommitment, providerResultHash: null, reasonCode: job.sanitizedReasonCode, terminalEvent });
  }

  private async readHeadWithClient(client: PoolClient, context: V2Beta2TenantContext): Promise<V2Beta2ProjectHead> {
    const snapshotResult = await client.query<{ revision: string; contentHash: string; payload: unknown }>(
      `SELECT revision, content_hash AS "contentHash", snapshot_payload AS payload
         FROM beta2_project_snapshots WHERE workspace_id=$1 AND project_id=$2 ORDER BY revision DESC LIMIT 1`,
      [context.workspaceId, context.projectId],
    );
    const stageOutcome = await this.readStageOutcomeWithClient(client, context);
    const reconciliation = stageOutcome?.status === "RECONCILE_REQUIRED" ? { jobId: stageOutcome.jobId, status: "RECONCILE_REQUIRED" as const } : null;
    if (!snapshotResult.rows[0]) {
      const initial = createV2Beta2InitialHead(context.projectId);
      return { ...initial, reconciliation, stageOutcome };
    }
    const snapshot = parseV2Beta2DurableSnapshot(snapshotResult.rows[0].payload, { projectId: context.projectId });
    if (snapshot.revision !== numeric(snapshotResult.rows[0].revision) || snapshot.contentHash !== snapshotResult.rows[0].contentHash) throw new V2Beta2RepositoryError("beta2_snapshot_storage_invalid", 503);
    return { projectId: context.projectId, revision: snapshot.revision, contentHash: snapshot.contentHash, snapshot, reconciliation, stageOutcome };
  }

  private async readHeadAtRevisionWithClient(client: PoolClient, context: V2Beta2TenantContext, revision: number): Promise<V2Beta2ProjectHead> {
    const snapshotResult = await client.query<{ revision: string; contentHash: string; payload: unknown }>(
      `SELECT revision,content_hash AS "contentHash",snapshot_payload AS payload FROM beta2_project_snapshots
        WHERE workspace_id=$1 AND project_id=$2 AND revision=$3`,
      [context.workspaceId, context.projectId, revision],
    );
    if (snapshotResult.rowCount !== 1) throw new V2Beta2RepositoryError("beta2_operation_result_authority_invalid", 503);
    const snapshot = parseV2Beta2DurableSnapshot(snapshotResult.rows[0].payload, { projectId: context.projectId });
    if (snapshot.revision !== revision || snapshot.contentHash !== snapshotResult.rows[0].contentHash) throw new V2Beta2RepositoryError("beta2_operation_result_authority_invalid", 503);
    const stageOutcome = await this.readStageOutcomeWithClient(client, context, snapshot.jobId);
    if (stageOutcome?.status !== "COMPLETE" || stageOutcome.jobId !== snapshot.jobId) throw new V2Beta2RepositoryError("beta2_operation_result_authority_invalid", 503);
    return { projectId: context.projectId, revision, contentHash: snapshot.contentHash, snapshot, reconciliation: null, stageOutcome };
  }

  private async readOperationIntentWithClient(client: PoolClient, context: V2Beta2TenantContext, request: V2Beta2GenerateRequest | V2Beta2SaveSelectionRequest | V2Beta2SaveConfirmedWorkspaceRequest): Promise<V2Beta2OperationIntent | null> {
    const incomingHash = requestHash(request);
    const result = await client.query<Record<string, unknown>>(
      `SELECT operation,idempotency_key AS "idempotencyKey",request_id AS "requestId",request_hash AS "requestHash",status,
          committed_revision AS "committedRevision",committed_content_hash AS "committedContentHash"
        FROM beta2_operation_intents WHERE workspace_id=$1 AND project_id=$2 AND (idempotency_key=$3 OR request_id=$4)`,
      [context.workspaceId, context.projectId, request.idempotencyKey, request.requestId],
    );
    if (result.rowCount === 0) return null;
    if (result.rowCount !== 1) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
    const row = result.rows[0];
    if (row.operation !== request.operation || row.idempotencyKey !== request.idempotencyKey || row.requestId !== request.requestId || row.requestHash !== incomingHash) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
    const status = row.status;
    const committedRevision = row.committedRevision === null ? null : numeric(row.committedRevision as string);
    const committedContentHash = row.committedContentHash === null ? null : String(row.committedContentHash);
    if (!(["PENDING", "COMMITTED"] as unknown[]).includes(status)
      || (status === "PENDING" && (committedRevision !== null || committedContentHash !== null))
      || (status === "COMMITTED" && (committedRevision === null || !HASH.test(committedContentHash ?? "")))) throw new V2Beta2RepositoryError("beta2_operation_intent_authority_invalid", 503);
    return { operation: request.operation, idempotencyKey: request.idempotencyKey, requestId: request.requestId, requestHash: incomingHash, status: status as V2Beta2OperationIntent["status"], committedRevision, committedContentHash };
  }

  async readProjectHead(context: V2Beta2TenantContext) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      return this.readHeadWithClient(client, context);
    });
  }

  async reserveGeneration(context: V2Beta2TenantContext, request: V2Beta2GenerateRequest, stageInstanceHash: string): Promise<V2Beta2GenerationReservation> {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const expectedLineage = createV2Beta2StageInstanceHash({ workspaceId: context.workspaceId, projectId: context.projectId, baseRevision: request.baseRevision, baseContentHash: request.baseContentHash });
      if (stageInstanceHash !== expectedLineage) throw new V2Beta2RepositoryError("beta2_stage_lineage_invalid", 409);
      const incomingHash = requestHash(request);
      const intent = await this.readOperationIntentWithClient(client, context, request);
      const existing = await client.query<Record<string, unknown>>(
        `${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND stage_id=$3 AND (stage_instance_hash=$4 OR idempotency_key=$5 OR request_id=$6)`,
        [context.workspaceId, context.projectId, V2_BETA2_STAGE_ID, stageInstanceHash, request.idempotencyKey, request.requestId],
      );
      if (existing.rowCount) {
        if (existing.rowCount !== 1) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
        const job = jobFromRow(existing.rows[0]);
        if (!intent || job.stageInstanceHash !== stageInstanceHash || job.requestHash !== incomingHash
          || job.requestId !== request.requestId || job.idempotencyKey !== request.idempotencyKey) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
        const replayHead = intent.status === "COMMITTED" && intent.committedRevision !== null
          ? await this.readHeadAtRevisionWithClient(client, context, intent.committedRevision)
          : null;
        if (replayHead && replayHead.contentHash !== intent.committedContentHash) throw new V2Beta2RepositoryError("beta2_operation_result_authority_invalid", 503);
        return { created: false, job, replayHead };
      }
      if (intent) throw new V2Beta2RepositoryError("beta2_operation_intent_authority_invalid", 503);
      const activeFence = await client.query<{ state: V2Beta2JobState }>(
        `SELECT state FROM beta2_generation_jobs
          WHERE workspace_id=$1 AND project_id=$2 AND stage_id=$3 AND state IN ('SUBMITTING','RECONCILE_REQUIRED')
          ORDER BY updated_at DESC LIMIT 1`,
        [context.workspaceId, context.projectId, V2_BETA2_STAGE_ID],
      );
      if (activeFence.rows[0]) {
        throw new V2Beta2RepositoryError(activeFence.rows[0].state === "RECONCILE_REQUIRED" ? "beta2_reconcile_required" : "beta2_submission_in_progress", 409);
      }
      const head = await this.readHeadWithClient(client, context);
      if (head.revision !== request.baseRevision || head.contentHash !== request.baseContentHash) throw new V2Beta2RepositoryError("beta2_stale_project_head", 409);
      const reserved = await client.query<{ jobId: string }>(
        `SELECT out_job_id AS "jobId" FROM old_mike_beta2_private.reserve_generation_intent(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [context.workspaceId, context.projectId, context.userId, stageInstanceHash, request.idempotencyKey, request.requestId, incomingHash, request.baseRevision, request.source.sourceHash, beta2CanonicalJson(request)],
      );
      const jobId = reserved.rows[0]?.jobId ?? jobIdFor(stageInstanceHash);
      const inserted = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      return { created: true, job: jobFromRow(inserted.rows[0]), replayHead: null };
    });
  }

  async markSubmitting(context: V2Beta2TenantContext, jobId: string, receiptCommitment: string) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const result = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      if (!result.rows[0]) throw new V2Beta2RepositoryError("not_found", 404);
      const job = jobFromRow(result.rows[0]);
      if (job.state !== "INTENT_RECORDED") return { shouldSubmit: false, job };
      const transitioned = await client.query<{ shouldSubmit: boolean }>(
        `SELECT out_should_submit AS "shouldSubmit" FROM old_mike_beta2_private.mark_submission_started($1,$2,$3,$4)`,
        [context.workspaceId, context.projectId, jobId, receiptCommitment],
      );
      const updated = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      return { shouldSubmit: transitioned.rows[0]?.shouldSubmit === true, job: jobFromRow(updated.rows[0]) };
    });
  }

  async commitProviderSuccess(context: V2Beta2TenantContext, jobId: string, resultValue: V2Beta2ProviderResult, eventType: "GENERATION_COMPLETE" | "RECONCILIATION_COMPLETE", eventRequestId?: string) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const jobResult = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      if (!jobResult.rows[0]) throw new V2Beta2RepositoryError("not_found", 404);
      const job = jobFromRow(jobResult.rows[0]);
      if (job.state === "SUCCEEDED") {
        const prior = await client.query<{ eventType: string; requestId: string; snapshotRevision: string }>(
          `SELECT event_type AS "eventType", request_id AS "requestId", snapshot_revision AS "snapshotRevision" FROM beta2_project_events
            WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3 AND event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE')
            ORDER BY sequence DESC LIMIT 1`,
          [context.workspaceId, context.projectId, jobId],
        );
        if (prior.rows[0]?.eventType !== eventType
          || (eventType === "GENERATION_COMPLETE" && eventRequestId !== undefined)
          || (eventType === "RECONCILIATION_COMPLETE" && prior.rows[0]?.requestId !== eventRequestId)) {
          throw new V2Beta2RepositoryError("beta2_state_event_pair_invalid", 409);
        }
        return { head: await this.readHeadAtRevisionWithClient(client, context, numeric(prior.rows[0].snapshotRevision)), replayed: true };
      }
      if (!(["SUBMITTING", "RECONCILE_REQUIRED"] as V2Beta2JobState[]).includes(job.state)) throw new V2Beta2RepositoryError("beta2_job_not_committable", 409);
      if ((job.state === "SUBMITTING" && (eventType !== "GENERATION_COMPLETE" || eventRequestId !== undefined))
        || (job.state === "RECONCILE_REQUIRED" && (eventType !== "RECONCILIATION_COMPLETE" || eventRequestId === undefined))) {
        throw new V2Beta2RepositoryError("beta2_state_event_pair_invalid", 409);
      }
      const result = parseV2Beta2ProviderResult(resultValue);
      if (result.stageInstanceHash !== job.stageInstanceHash || result.sourceHash !== job.sourceHash) throw new V2Beta2RepositoryError("beta2_provider_result_authority_invalid", 409);
      const head = await this.readHeadWithClient(client, context);
      if (head.revision !== job.sourceRevision || head.contentHash !== job.request.baseContentHash) throw new V2Beta2RepositoryError("beta2_stale_project_head", 409);
      const snapshot = createV2Beta2DurableSnapshot({
        projectId: context.projectId,
        revision: head.revision + 1,
        source: job.request.source,
        directions: result.directions,
        recommendedDirectionId: result.recommendedDirectionId,
        selectedDirectionId: result.selectedDirectionId,
        stageId: V2_BETA2_STAGE_ID,
        stageInstanceHash: job.stageInstanceHash,
        jobId,
        persistenceStatus: "SAVED",
      });
      const committed = await client.query<{ replayed: boolean }>(
        `SELECT out_replayed AS replayed FROM old_mike_beta2_private.commit_provider_success(
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [context.workspaceId, context.projectId, jobId, result.resultHash, snapshot.revision, snapshot.contentHash, snapshot.schemaId, beta2CanonicalJson(snapshot), eventType, eventRequestId ?? null],
      );
      const replayed = committed.rows[0]?.replayed === true;
      return { head: await this.readHeadWithClient(client, context), replayed };
    });
  }

  private async transitionToReconcileRequired(client: PoolClient, context: V2Beta2TenantContext, job: V2Beta2JobRecord, reasonCode: string) {
    if (job.state === "RECONCILE_REQUIRED") return this.readHeadWithClient(client, context);
    if (job.state !== "SUBMITTING") throw new V2Beta2RepositoryError("beta2_unknown_transition_invalid", 409);
    await client.query(
      `SELECT out_replayed FROM old_mike_beta2_private.mark_completion_unknown($1,$2,$3,$4)`,
      [context.workspaceId, context.projectId, job.jobId, reasonCode],
    );
    const head = await this.readHeadWithClient(client, context);
    return { ...head, reconciliation: { jobId: job.jobId, status: "RECONCILE_REQUIRED" as const } };
  }

  async markCompletionUnknown(context: V2Beta2TenantContext, jobId: string, reasonCode = "COMPLETION_UNKNOWN") {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const result = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      if (!result.rows[0]) throw new V2Beta2RepositoryError("not_found", 404);
      return this.transitionToReconcileRequired(client, context, jobFromRow(result.rows[0]), reasonCode);
    });
  }

  async markTerminalRejected(context: V2Beta2TenantContext, jobId: string, reasonCode: string, reconciliationRequestId?: string) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const result = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      if (!result.rows[0]) throw new V2Beta2RepositoryError("not_found", 404);
      const job = jobFromRow(result.rows[0]);
      if (!(["INTENT_RECORDED", "SUBMITTING", "RECONCILE_REQUIRED", "FAILED"] as V2Beta2JobState[]).includes(job.state)) throw new V2Beta2RepositoryError("beta2_failure_transition_invalid", 409);
      if ((["INTENT_RECORDED", "SUBMITTING"] as V2Beta2JobState[]).includes(job.state) && reconciliationRequestId !== undefined
        || job.state === "RECONCILE_REQUIRED" && reconciliationRequestId === undefined) {
        throw new V2Beta2RepositoryError("beta2_state_event_pair_invalid", 409);
      }
      const transition = await client.query<{ replayed: boolean }>(
        `SELECT out_replayed AS replayed FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,$4,$5)`,
        [context.workspaceId, context.projectId, jobId, reasonCode, reconciliationRequestId ?? null],
      );
      const head = await this.readHeadWithClient(client, context);
      return { head: { ...head, reconciliation: null }, replayed: transition.rows[0]?.replayed === true };
    });
  }

  async promoteStaleSubmitting(context: V2Beta2TenantContext, jobId: string) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const stale = await client.query<{ stale: boolean }>(
        `SELECT submit_started_at <= clock_timestamp() - ($4::bigint * interval '1 millisecond') AS stale
           FROM beta2_generation_jobs WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3 AND state='SUBMITTING'`,
        [context.workspaceId, context.projectId, jobId, this.staleAfterMs],
      );
      if (!stale.rows[0]?.stale) return null;
      const job = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
      return this.transitionToReconcileRequired(client, context, jobFromRow(job.rows[0]), "STALE_SUBMITTING");
    });
  }

  async resumeProjectHead(context: V2Beta2TenantContext) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const stale = await client.query<{ jobId: string }>(
        `SELECT job_id AS "jobId" FROM beta2_generation_jobs WHERE workspace_id=$1 AND project_id=$2 AND state='SUBMITTING'
          AND submit_started_at <= clock_timestamp() - ($3::bigint * interval '1 millisecond')
          ORDER BY submit_started_at ASC LIMIT 1`,
        [context.workspaceId, context.projectId, this.staleAfterMs],
      );
      if (!stale.rows[0]) return { head: await this.readHeadWithClient(client, context), eventAppendDelta: 0 as const };
      const job = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, stale.rows[0].jobId]);
      return { head: await this.transitionToReconcileRequired(client, context, jobFromRow(job.rows[0]), "STALE_SUBMITTING"), eventAppendDelta: 1 as const };
    });
  }

  async getJob(context: V2Beta2TenantContext, jobId: string) {
    const result = await this.pool.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, jobId]);
    return result.rows[0] ? jobFromRow(result.rows[0]) : null;
  }

  async replayReconciliationTerminal(context: V2Beta2TenantContext, request: V2Beta2ReconcileRequest) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      if (request.projectId !== context.projectId) throw new V2Beta2RepositoryError("not_found", 404);
      const jobResult = await client.query<Record<string, unknown>>(`${JOB_SELECT} WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3`, [context.workspaceId, context.projectId, request.jobId]);
      if (!jobResult.rows[0]) throw new V2Beta2RepositoryError("not_found", 404);
      const job = jobFromRow(jobResult.rows[0]);
      if (job.state !== "SUCCEEDED" && job.state !== "FAILED") throw new V2Beta2RepositoryError("beta2_reconciliation_not_available", 409);
      const terminalEvents = await client.query<{ eventType: string; operation: string; requestId: string; requestHash: string; toRevision: string }>(
        `SELECT event_type AS "eventType", operation, request_id AS "requestId", request_hash AS "requestHash", to_revision AS "toRevision"
           FROM beta2_project_events
          WHERE workspace_id=$1 AND project_id=$2 AND job_id=$3
            AND event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE','GENERATION_TERMINAL_FAILURE','RECONCILIATION_TERMINAL_FAILURE')
          ORDER BY sequence`,
        [context.workspaceId, context.projectId, request.jobId],
      );
      if (terminalEvents.rowCount !== 1) throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
      const event = terminalEvents.rows[0];
      const expectedGenerationEvent = job.state === "SUCCEEDED" ? "GENERATION_COMPLETE" : "GENERATION_TERMINAL_FAILURE";
      const expectedReconciliationEvent = job.state === "SUCCEEDED" ? "RECONCILIATION_COMPLETE" : "RECONCILIATION_TERMINAL_FAILURE";
      if (event.eventType === expectedGenerationEvent) {
        if (event.operation !== "GENERATE_DURABLE_CORE" || event.requestId !== job.requestId || event.requestHash !== job.requestHash) {
          throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
        }
        throw new V2Beta2RepositoryError("beta2_reconciliation_not_available", 409);
      }
      if (event.eventType !== expectedReconciliationEvent || event.operation !== "RECONCILE_UNKNOWN") {
        throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
      }
      let persistedRequestHash: string;
      try {
        persistedRequestHash = createV2Beta2ReconciliationRequestHash({
          contractVersion: V2_BETA2_CONTRACT_VERSION,
          operation: "RECONCILE_UNKNOWN",
          projectId: context.projectId,
          requestId: event.requestId,
          jobId: request.jobId,
        });
      } catch {
        throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
      }
      if (event.requestHash !== persistedRequestHash) throw new V2Beta2RepositoryError("beta2_terminal_event_authority_invalid", 503);
      const incomingRequestHash = createV2Beta2ReconciliationRequestHash(request);
      if (event.requestId !== request.requestId || event.requestHash !== incomingRequestHash) {
        throw new V2Beta2RepositoryError("beta2_reconciliation_replay_conflict", 409);
      }
      const head = await this.readHeadWithClient(client, context);
      if (head.stageOutcome?.jobId !== request.jobId
        || head.revision !== numeric(event.toRevision)
        || (job.state === "SUCCEEDED" && (head.stageOutcome.status !== "COMPLETE" || head.snapshot?.jobId !== request.jobId))
        || (job.state === "FAILED" && head.stageOutcome.status !== "REJECTED")) {
        throw new V2Beta2RepositoryError("beta2_reconciliation_replay_conflict", 409);
      }
      return {
        head,
        terminalStatus: job.state === "SUCCEEDED" ? "COMPLETE" as const : "REJECTED" as const,
      };
    });
  }

  async withReconciliationLookupAuthority<T>(context: V2Beta2TenantContext, jobId: string, operation: () => Promise<T>): Promise<T> {
    const lockAuthority = `old-mike-v2-beta2/reconciliation-lookup/1\u001f${context.workspaceId}\u001f${context.projectId}\u001f${jobId}`;
    const deadline = Date.now() + 30_000;
    let client: PoolClient | null = null;
    while (!client) {
      const candidate = await this.pool.connect();
      const lock = await candidate.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1, 22020)) AS locked", [lockAuthority]);
      if (lock.rows[0]?.locked === true) {
        client = candidate;
        break;
      }
      candidate.release();
      if (Date.now() >= deadline) throw new V2Beta2RepositoryError("beta2_reconciliation_lookup_busy", 409);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    try {
      return await operation();
    } finally {
      let unlocked: boolean;
      try {
        const result = await client.query<{ unlocked: boolean }>("SELECT pg_advisory_unlock(hashtextextended($1, 22020)) AS unlocked", [lockAuthority]);
        unlocked = result.rows[0]?.unlocked === true;
      } catch (error) {
        client.release(error as Error);
        throw error;
      }
      if (!unlocked) {
        const error = new V2Beta2RepositoryError("beta2_reconciliation_lookup_unlock_failed", 503);
        client.release(error);
        throw error;
      }
      client.release();
    }
  }

  async saveSelection(context: V2Beta2TenantContext, request: V2Beta2SaveSelectionRequest) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const incomingHash = requestHash(request);
      const intent = await this.readOperationIntentWithClient(client, context, request);
      if (intent) {
        if (intent.status !== "COMMITTED" || intent.committedRevision === null) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
        const replayHead = await this.readHeadAtRevisionWithClient(client, context, intent.committedRevision);
        if (!replayHead.snapshot || replayHead.contentHash !== intent.committedContentHash || replayHead.snapshot.selectedDirectionId !== request.selectedDirectionId) throw new V2Beta2RepositoryError("beta2_selection_replay_conflict", 409);
        const replayed = await client.query<{ replayed: boolean }>(
          `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_direction_selection(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [context.workspaceId, context.projectId, context.userId, request.requestId, request.idempotencyKey, incomingHash,
            replayHead.snapshot.revision, replayHead.snapshot.contentHash, replayHead.snapshot.schemaId, beta2CanonicalJson(replayHead.snapshot), replayHead.snapshot.jobId],
        );
        if (replayed.rows[0]?.replayed !== true) throw new V2Beta2RepositoryError("beta2_selection_authority_invalid", 503);
        return { head: replayHead, replayed: true };
      }
      const head = await this.readHeadWithClient(client, context);
      const unresolved = await client.query(
        `SELECT 1 FROM beta2_generation_jobs
          WHERE workspace_id=$1 AND project_id=$2 AND state IN ('INTENT_RECORDED','SUBMITTING','RECONCILE_REQUIRED') LIMIT 1`,
        [context.workspaceId, context.projectId],
      );
      if (head.reconciliation !== null
        || unresolved.rowCount !== 0
        || head.stageOutcome?.status !== "COMPLETE"
        || !head.snapshot
        || head.stageOutcome.jobId !== head.snapshot.jobId) {
        throw new V2Beta2RepositoryError("beta2_selection_not_available", 409);
      }
      const prior = await client.query<{ requestId: string; idempotencyKey: string | null; requestHash: string; fromRevision: string; snapshotRevision: string | null }>(
        `SELECT request_id AS "requestId", idempotency_key AS "idempotencyKey", request_hash AS "requestHash",
            from_revision AS "fromRevision", snapshot_revision AS "snapshotRevision"
           FROM beta2_project_events
          WHERE workspace_id=$1 AND project_id=$2 AND operation='SAVE_DIRECTION_SELECTION'
            AND (request_id=$3 OR idempotency_key=$4)`,
        [context.workspaceId, context.projectId, request.requestId, request.idempotencyKey],
      );
      if (prior.rowCount) {
        throw new V2Beta2RepositoryError("beta2_operation_intent_authority_invalid", 503);
      }
      if (head.revision !== request.baseRevision || head.contentHash !== request.baseContentHash) throw new V2Beta2RepositoryError("beta2_stale_project_head", 409);
      const snapshot = createV2Beta2DurableSnapshot({
        projectId: context.projectId,
        revision: head.revision + 1,
        source: head.snapshot.source,
        directions: head.snapshot.directions,
        recommendedDirectionId: head.snapshot.recommendedDirectionId,
        selectedDirectionId: request.selectedDirectionId,
        stageId: V2_BETA2_STAGE_ID,
        stageInstanceHash: head.snapshot.stageInstanceHash,
        jobId: head.snapshot.jobId,
        persistenceStatus: "SAVED",
      });
      const saved = await client.query<{ replayed: boolean }>(
        `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_direction_selection(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [context.workspaceId, context.projectId, context.userId, request.requestId, request.idempotencyKey, incomingHash, snapshot.revision, snapshot.contentHash, snapshot.schemaId, beta2CanonicalJson(snapshot), snapshot.jobId],
      );
      const replayed = saved.rows[0]?.replayed === true;
      return { head: await this.readHeadWithClient(client, context), replayed };
    });
  }

  async saveConfirmedWorkspace(context: V2Beta2TenantContext, request: V2Beta2SaveConfirmedWorkspaceRequest) {
    return this.transaction(async (client) => {
      await this.lockProject(client, context);
      const incomingHash = requestHash(request);
      const intent = await this.readOperationIntentWithClient(client, context, request);
      if (intent) {
        if (intent.status !== "COMMITTED" || intent.committedRevision === null) throw new V2Beta2RepositoryError("beta2_idempotency_conflict", 409);
        const replayHead = await this.readHeadAtRevisionWithClient(client, context, intent.committedRevision);
        const replaySnapshot = replayHead.snapshot;
        const replayDirection = replaySnapshot?.directions.find((direction) => direction.directionId === request.selectedDirectionId);
        if (!replaySnapshot || !replayDirection || replayHead.contentHash !== intent.committedContentHash) throw new V2Beta2RepositoryError("beta2_workspace_confirmation_replay_conflict", 409);
        const expectedConfirmation = createV2Beta2ConfirmedWorkspace({
          selectedDirectionId: request.selectedDirectionId,
          s0: request.s0Summary,
          appliedAssistOptionIds: request.appliedAssistOptionIds,
        }, replayDirection);
        if (replaySnapshot.confirmedWorkspace?.confirmationHash !== expectedConfirmation.confirmationHash) throw new V2Beta2RepositoryError("beta2_workspace_confirmation_replay_conflict", 409);
        const replayed = await client.query<{ replayed: boolean }>(
          `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_confirmed_workspace(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14::jsonb)`,
          [context.workspaceId, context.projectId, context.userId, request.requestId, request.idempotencyKey, incomingHash,
            replaySnapshot.revision, replaySnapshot.contentHash, replaySnapshot.schemaId, beta2CanonicalJson(replaySnapshot), replaySnapshot.jobId,
            request.selectedDirectionId, beta2CanonicalJson(request.s0Summary), beta2CanonicalJson(request.appliedAssistOptionIds)],
        );
        if (replayed.rows[0]?.replayed !== true) throw new V2Beta2RepositoryError("beta2_workspace_confirmation_authority_invalid", 503);
        return { head: replayHead, replayed: true };
      }
      const head = await this.readHeadWithClient(client, context);
      const unresolved = await client.query(
        `SELECT 1 FROM beta2_generation_jobs
          WHERE workspace_id=$1 AND project_id=$2 AND state IN ('INTENT_RECORDED','SUBMITTING','RECONCILE_REQUIRED') LIMIT 1`,
        [context.workspaceId, context.projectId],
      );
      if (head.reconciliation !== null
        || unresolved.rowCount !== 0
        || head.stageOutcome?.status !== "COMPLETE"
        || !head.snapshot
        || head.stageOutcome.jobId !== head.snapshot.jobId
        || head.snapshot.selectedDirectionId !== request.selectedDirectionId) {
        throw new V2Beta2RepositoryError("beta2_workspace_confirmation_not_available", 409);
      }
      const selected = head.snapshot.directions.find((direction) => direction.directionId === request.selectedDirectionId);
      if (!selected) throw new V2Beta2RepositoryError("beta2_workspace_confirmation_invalid", 409);
      const confirmedWorkspace = createV2Beta2ConfirmedWorkspace({
        selectedDirectionId: request.selectedDirectionId,
        s0: request.s0Summary,
        appliedAssistOptionIds: request.appliedAssistOptionIds,
      }, selected);
      const prior = await client.query<{ requestId: string; idempotencyKey: string | null; requestHash: string; fromRevision: string; snapshotRevision: string | null }>(
        `SELECT request_id AS "requestId", idempotency_key AS "idempotencyKey", request_hash AS "requestHash",
            from_revision AS "fromRevision", snapshot_revision AS "snapshotRevision"
           FROM beta2_project_events
          WHERE workspace_id=$1 AND project_id=$2 AND operation='SAVE_CONFIRMED_WORKSPACE'
            AND (request_id=$3 OR idempotency_key=$4)`,
        [context.workspaceId, context.projectId, request.requestId, request.idempotencyKey],
      );
      if (prior.rowCount) {
        throw new V2Beta2RepositoryError("beta2_operation_intent_authority_invalid", 503);
      }
      if (head.revision !== request.baseRevision || head.contentHash !== request.baseContentHash) throw new V2Beta2RepositoryError("beta2_stale_project_head", 409);
      const snapshot = createV2Beta2DurableSnapshot({
        projectId: context.projectId,
        revision: head.revision + 1,
        source: head.snapshot.source,
        directions: head.snapshot.directions,
        recommendedDirectionId: head.snapshot.recommendedDirectionId,
        selectedDirectionId: head.snapshot.selectedDirectionId,
        confirmedWorkspace,
        stageId: V2_BETA2_STAGE_ID,
        stageInstanceHash: head.snapshot.stageInstanceHash,
        jobId: head.snapshot.jobId,
        persistenceStatus: "SAVED",
      });
      const saved = await client.query<{ replayed: boolean }>(
        `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_confirmed_workspace(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14::jsonb)`,
        [context.workspaceId, context.projectId, context.userId, request.requestId, request.idempotencyKey, incomingHash,
          snapshot.revision, snapshot.contentHash, snapshot.schemaId, beta2CanonicalJson(snapshot), snapshot.jobId,
          request.selectedDirectionId, beta2CanonicalJson(request.s0Summary), beta2CanonicalJson(request.appliedAssistOptionIds)],
      );
      const replayed = saved.rows[0]?.replayed === true;
      return { head: await this.readHeadWithClient(client, context), replayed };
    });
  }

}
