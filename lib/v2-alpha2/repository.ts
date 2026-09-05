import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

import {
  V2_ALPHA2_CONTRACT_VERSION,
  canonicalJson,
  parseDirectionArtifact,
  parseS0Artifact,
  sha256Canonical,
  validatePersistedFieldAssistArtifact,
  type V2Alpha2DirectionArtifact,
  type V2Alpha2ErrorCode,
  type V2Alpha2FieldAssistArtifact,
  type V2Alpha2JourneySnapshot,
  type V2Alpha2Operation,
  type V2Alpha2S0Artifact,
} from "./contracts.ts";
import type { V2Alpha2Claim, V2Alpha2WorkerRepository } from "./worker.ts";

export const V2_ALPHA2_REQUEST_MAX_BYTES = 24_576;
export const V2_ALPHA2_RESULT_MAX_BYTES = 192_000;
export const V2_ALPHA2_RETENTION_DAYS = 7;

export type V2Alpha2Principal = { workspaceId: string; userId: string; projectId?: string | null };
export type V2Alpha2CreateInput = {
  requestId: string;
  operation: V2Alpha2Operation;
  payloadSchemaId: "old-mike-v2-alpha2/generate-directions-input/1" | "old-mike-v2-alpha2/field-assist-input/1";
  requestPayload: Record<string, unknown>;
};

type JobRow = {
  id: string;
  rootJobId: string;
  parentJobId: string | null;
  parentResultId: string | null;
  selectedItemHash: string | null;
  operation: V2Alpha2Operation;
  requestId: string;
  requestHash: string;
  requestPayload: Record<string, unknown>;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "RECONCILE_REQUIRED" | "CANCELED";
  stage: string;
  stateVersion: string;
  leaseGeneration: string;
  leaseOwner: string | null;
  leaseToken: string | null;
};

type EffectRow = {
  id: string;
  effectState: "INTENT_PERSISTED" | "PROVEN_NOT_SUBMITTED" | "SUBMISSION_POSSIBLE" | "ACKNOWLEDGED" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED";
  stateVersion: string;
  leaseGeneration: string;
  leaseOwner: string | null;
  leaseToken: string | null;
};

type ResultRow = { id: string; jobId: string; resultPayload: Record<string, unknown>; resultHash: string; selectedItemHash: string };

export class V2Alpha2RepositoryError extends Error {
  readonly code: "STORAGE_UNAVAILABLE" | "TENANT_REJECTED" | "IDEMPOTENCY_CONFLICT" | "FENCE_REJECTED" | "RESULT_CONFLICT";
  constructor(code: "STORAGE_UNAVAILABLE" | "TENANT_REJECTED" | "IDEMPOTENCY_CONFLICT" | "FENCE_REJECTED" | "RESULT_CONFLICT") {
    super(code);
    this.name = "V2Alpha2RepositoryError";
    this.code = code;
  }
}

function newOpaqueRef(prefix: "vj" | "ve") {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function boundedPayload(value: Record<string, unknown>, maximum: number, code: string) {
  const canonical = canonicalJson(value);
  if (Buffer.byteLength(canonical, "utf8") > maximum) throw new Error(code);
  return value;
}

function asClaim(row: JobRow): V2Alpha2Claim {
  if (!row.leaseOwner || !row.leaseToken) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
  return {
    id: row.id,
    rootJobId: row.rootJobId,
    operation: row.operation,
    requestPayload: row.requestPayload,
    requestHash: row.requestHash,
    leaseOwner: row.leaseOwner,
    leaseToken: row.leaseToken,
    leaseGeneration: Number(row.leaseGeneration),
    stateVersion: Number(row.stateVersion),
  };
}

const JOB_COLUMNS = `id, root_job_id AS "rootJobId", parent_job_id AS "parentJobId", parent_result_id::text AS "parentResultId",
  selected_item_hash AS "selectedItemHash", operation, request_id AS "requestId", request_hash AS "requestHash",
  request_payload AS "requestPayload", state, stage, state_version::text AS "stateVersion",
  lease_generation::text AS "leaseGeneration", lease_owner AS "leaseOwner", lease_token AS "leaseToken"`;

export class V2Alpha2PostgresRepository implements V2Alpha2WorkerRepository {
  readonly databasePool: Pool;
  readonly principal: V2Alpha2Principal;
  readonly leaseSeconds: number;
  constructor(databasePool: Pool, principal: V2Alpha2Principal, leaseSeconds = 60) {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new Error("v2_alpha2_lease_bound_invalid");
    this.databasePool = databasePool; this.principal = principal; this.leaseSeconds = leaseSeconds;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>) {
    const client = await this.databasePool.connect();
    try {
      await client.query("BEGIN");
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

  private async assertExactAuthority(client: PoolClient) {
    const membership = await client.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [this.principal.workspaceId, this.principal.userId]);
    if (membership.rowCount !== 1) throw new V2Alpha2RepositoryError("TENANT_REJECTED");
    if (this.principal.projectId) {
      const project = await client.query("SELECT 1 FROM projects WHERE workspace_id=$1 AND project_id=$2", [this.principal.workspaceId, this.principal.projectId]);
      if (project.rowCount !== 1) throw new V2Alpha2RepositoryError("TENANT_REJECTED");
    }
  }

  async create(input: V2Alpha2CreateInput) {
    boundedPayload(input.requestPayload, V2_ALPHA2_REQUEST_MAX_BYTES, "v2_alpha2_request_too_large");
    const requestHash = sha256Canonical({ operation: input.operation, projectId: this.principal.projectId ?? null, payload: input.requestPayload });
    return this.transaction(async (client) => {
      await this.assertExactAuthority(client);
      const prior = await client.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE workspace_id=$1 AND created_by_user_id=$2 AND request_id=$3 FOR UPDATE`, [this.principal.workspaceId, this.principal.userId, input.requestId]);
      if (prior.rows[0]) {
        const row = prior.rows[0];
        if (row.requestHash !== requestHash || row.operation !== input.operation) throw new V2Alpha2RepositoryError("IDEMPOTENCY_CONFLICT");
        return { journeyRef: row.rootJobId, jobRef: row.id, replayed: true, state: row.state };
      }
      const id = newOpaqueRef("vj");
      const projectScope = this.principal.projectId ? "TENANT_PROJECT" : "PRE_PROJECT";
      await client.query("SET CONSTRAINTS research_generation_jobs_root_fk DEFERRED");
      await client.query(
        `INSERT INTO research_generation_jobs (
          id,workspace_id,project_scope,project_id,created_by_user_id,root_job_id,parent_workspace_id,parent_created_by_user_id,parent_job_id,parent_result_id,selected_item_hash,
          operation,operation_contract_version,payload_schema_id,request_id,request_payload,request_byte_count,request_hash,
          state,stage,payload_expires_at,expires_at
        ) VALUES ($1,$2,$3,$4,$5,$1,NULL,NULL,NULL,NULL,NULL,$6,$7,$8,$9,$10::jsonb,octet_length($10::jsonb::text),$11,'QUEUED','QUEUED',clock_timestamp()+($12::text||' days')::interval,clock_timestamp()+($12::text||' days')::interval)`,
        [id, this.principal.workspaceId, projectScope, this.principal.projectId ?? null, this.principal.userId, input.operation, V2_ALPHA2_CONTRACT_VERSION, input.payloadSchemaId, input.requestId, JSON.stringify(input.requestPayload), requestHash, V2_ALPHA2_RETENTION_DAYS],
      );
      return { journeyRef: id, jobRef: id, replayed: false, state: "QUEUED" as const };
    });
  }

  private async recoverExpired(client: PoolClient) {
    await client.query(
      `UPDATE research_generation_jobs AS jobs SET state='RECONCILE_REQUIRED',stage='TERMINAL',completion_class='COMPLETION_UNKNOWN',sanitized_error_code='COMPLETION_UNKNOWN',
        state_version=jobs.state_version+1,lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
       FROM research_generation_effects AS effects
       WHERE jobs.workspace_id=$1 AND jobs.created_by_user_id=$2 AND jobs.state='RUNNING' AND jobs.stage='SUBMITTING'
         AND jobs.lease_until < clock_timestamp() AND effects.job_id=jobs.id AND effects.effect_state IN ('SUBMISSION_POSSIBLE','COMPLETION_UNKNOWN')`,
      [this.principal.workspaceId, this.principal.userId],
    );
    await client.query(
      `UPDATE research_generation_jobs AS jobs SET state='QUEUED',stage='QUEUED',state_version=jobs.state_version+1,
        lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
       WHERE jobs.workspace_id=$1 AND jobs.created_by_user_id=$2 AND jobs.state='RUNNING' AND jobs.lease_until < clock_timestamp()
         AND jobs.stage IN ('CLAIMED','INTENT_RECORDED')
         AND NOT EXISTS (SELECT 1 FROM research_generation_effects e WHERE e.job_id=jobs.id AND e.effect_state <> 'INTENT_PERSISTED')`,
      [this.principal.workspaceId, this.principal.userId],
    );
  }

  async claim(input: { workerOwner: string; workerToken: string }) {
    return this.transaction(async (client) => {
      await this.assertExactAuthority(client);
      await this.recoverExpired(client);
      const result = await client.query<JobRow>(
        `SELECT ${JOB_COLUMNS} FROM claim_research_generation_job($1,$2,$3,$4,($5::text||' seconds')::interval)`,
        [this.principal.workspaceId, this.principal.userId, input.workerOwner, input.workerToken, this.leaseSeconds],
      );
      return result.rows[0] ? asClaim(result.rows[0]) : null;
    });
  }

  private async lockFencedJob(client: PoolClient, claim: V2Alpha2Claim) {
    const result = await client.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE id=$1 AND workspace_id=$2 AND created_by_user_id=$3
       AND lease_owner=$4 AND lease_token=$5 AND lease_generation=$6 FOR UPDATE`,
      [claim.id, this.principal.workspaceId, this.principal.userId, claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
    );
    if (!result.rows[0]) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
    return result.rows[0];
  }

  private async lockEffect(client: PoolClient, jobId: string) {
    const result = await client.query<EffectRow>(
      `SELECT id::text,effect_state AS "effectState",state_version::text AS "stateVersion",lease_generation::text AS "leaseGeneration",lease_owner AS "leaseOwner",lease_token AS "leaseToken"
       FROM research_generation_effects WHERE job_id=$1 FOR UPDATE`,
      [jobId],
    );
    return result.rows[0] ?? null;
  }

  async ensureIntent(claim: V2Alpha2Claim) {
    return this.transaction(async (client) => {
      const job = await this.lockFencedJob(client, claim);
      const effect = await this.lockEffect(client, claim.id);
      if (!effect) {
        const inserted = await client.query<{ effectState: EffectRow["effectState"] }>(
          `INSERT INTO research_generation_effects (workspace_id,created_by_user_id,job_id,effect_state,effect_request_hash,provider_attempt_class,lease_generation,lease_owner,lease_token,lease_until)
           VALUES ($1,$2,$3,'INTENT_PERSISTED',$4,'NOT_ATTEMPTED',$5,$6,$7,(SELECT lease_until FROM research_generation_jobs WHERE id=$3)) RETURNING effect_state AS "effectState"`,
          [this.principal.workspaceId, this.principal.userId, claim.id, claim.requestHash, claim.leaseGeneration, claim.leaseOwner, claim.leaseToken],
        );
        await client.query(
          `UPDATE research_generation_jobs SET stage='INTENT_RECORDED',state_version=state_version+1,updated_at=clock_timestamp()
           WHERE id=$1 AND state_version=$2 AND lease_owner=$3 AND lease_token=$4 AND lease_generation=$5`,
          [claim.id, Number(job.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
        );
        return inserted.rows[0].effectState;
      }
      if (effect.effectState === "INTENT_PERSISTED" && (effect.leaseOwner !== claim.leaseOwner || effect.leaseToken !== claim.leaseToken || Number(effect.leaseGeneration) !== claim.leaseGeneration)) {
        const update = await client.query(
          `UPDATE research_generation_effects SET state_version=state_version+1,lease_generation=$2,lease_owner=$3,lease_token=$4,
           lease_until=(SELECT lease_until FROM research_generation_jobs WHERE id=$1),updated_at=clock_timestamp()
           WHERE job_id=$1 AND state_version=$5 AND effect_state='INTENT_PERSISTED'`,
          [claim.id, claim.leaseGeneration, claim.leaseOwner, claim.leaseToken, Number(effect.stateVersion)],
        );
        if (update.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      }
      return effect.effectState;
    });
  }

  async markSubmissionPossible(claim: V2Alpha2Claim) {
    await this.transaction(async (client) => {
      const job = await this.lockFencedJob(client, claim);
      const effect = await this.lockEffect(client, claim.id);
      if (!effect || effect.effectState !== "INTENT_PERSISTED") throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      const effectUpdate = await client.query(
        `UPDATE research_generation_effects SET effect_state='SUBMISSION_POSSIBLE',provider_attempt_class='SUBMISSION_POSSIBLE',
         submission_lease_generation=lease_generation,submission_lease_owner=lease_owner,submission_lease_token=lease_token,state_version=state_version+1,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$2 AND lease_owner=$3 AND lease_token=$4 AND lease_generation=$5 AND effect_state='INTENT_PERSISTED'`,
        [effect.id, Number(effect.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
      );
      const jobUpdate = await client.query(
        `UPDATE research_generation_jobs SET stage='SUBMITTING',state_version=state_version+1,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$2 AND lease_owner=$3 AND lease_token=$4 AND lease_generation=$5 AND state='RUNNING'`,
        [claim.id, Number(job.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
      );
      if (effectUpdate.rowCount !== 1 || jobUpdate.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
    });
  }

  private resultSelectedHash(job: JobRow, artifact: V2Alpha2DirectionArtifact | V2Alpha2S0Artifact | V2Alpha2FieldAssistArtifact) {
    if (job.operation === "GENERATE_DIRECTIONS") {
      const parsed = parseDirectionArtifact(artifact);
      const selected = parsed.directions.find((item) => item.directionId === parsed.recommendedDirectionId);
      if (!selected) throw new V2Alpha2RepositoryError("RESULT_CONFLICT");
      return sha256Canonical(selected);
    }
    if (job.operation === "EXPAND_SELECTED_S0") return job.selectedItemHash ?? sha256Canonical(parseS0Artifact(artifact));
    const parsed = validatePersistedFieldAssistArtifact(artifact);
    return sha256Canonical(parsed.recommendedOption ?? parsed.validOptions[0]);
  }

  async commitSuccess(claim: V2Alpha2Claim, rawArtifact: unknown) {
    return this.transaction(async (client) => {
      const job = await this.lockFencedJob(client, claim);
      const effect = await this.lockEffect(client, claim.id);
      if (!effect || effect.effectState !== "SUBMISSION_POSSIBLE") throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      const artifact = job.operation === "GENERATE_DIRECTIONS" ? parseDirectionArtifact(rawArtifact) : job.operation === "EXPAND_SELECTED_S0" ? parseS0Artifact(rawArtifact) : validatePersistedFieldAssistArtifact(rawArtifact);
      boundedPayload(artifact as unknown as Record<string, unknown>, V2_ALPHA2_RESULT_MAX_BYTES, "v2_alpha2_result_too_large");
      const resultHash = sha256Canonical(artifact);
      const selectedItemHash = this.resultSelectedHash(job, artifact);
      const result = await client.query<{ id: string }>(
        `INSERT INTO research_generation_results (workspace_id,created_by_user_id,job_id,schema_id,result_payload,result_byte_count,result_hash,selected_item_hash,payload_expires_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,octet_length($5::jsonb::text),$6,$7,clock_timestamp()+($8::text||' days')::interval) RETURNING id::text`,
        [this.principal.workspaceId, this.principal.userId, claim.id, artifact.schemaId, JSON.stringify(artifact), resultHash, selectedItemHash, V2_ALPHA2_RETENTION_DAYS],
      );
      const effectUpdate = await client.query(
        `UPDATE research_generation_effects SET effect_state='ACKNOWLEDGED',provider_attempt_class='RESPONSE_ACKNOWLEDGED',state_version=state_version+1,
         lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$2 AND lease_owner=$3 AND lease_token=$4 AND lease_generation=$5 AND effect_state='SUBMISSION_POSSIBLE'`,
        [effect.id, Number(effect.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
      );
      const jobUpdate = await client.query(
        `UPDATE research_generation_jobs SET state='SUCCEEDED',stage='COMMITTED',completion_class='COMPLETE',state_version=state_version+1,
         lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$2 AND lease_owner=$3 AND lease_token=$4 AND lease_generation=$5 AND state='RUNNING'`,
        [claim.id, Number(job.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
      );
      if (effectUpdate.rowCount !== 1 || jobUpdate.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");

      let childCreated = false;
      if (job.operation === "GENERATE_DIRECTIONS") {
        const directions = parseDirectionArtifact(artifact);
        const selectedDirection = directions.directions.find((item) => item.directionId === directions.recommendedDirectionId);
        if (!selectedDirection) throw new V2Alpha2RepositoryError("RESULT_CONFLICT");
        const childPayload = { parentResultId: result.rows[0].id, selectedItemHash, selectedDirection, researchDirection: directions.researchDirection, sourceStrategy: "NONE" };
        const childRequestId = `stage-b:${sha256Canonical({ root: job.rootJobId, selectedItemHash }).slice(0, 48)}`;
        const childRequestHash = sha256Canonical({ operation: "EXPAND_SELECTED_S0", projectId: this.principal.projectId ?? null, payload: childPayload });
        const childId = newOpaqueRef("vj");
        const inserted = await client.query(
          `INSERT INTO research_generation_jobs (
            id,workspace_id,project_scope,project_id,created_by_user_id,root_job_id,parent_workspace_id,parent_created_by_user_id,parent_job_id,parent_result_id,selected_item_hash,
            operation,operation_contract_version,payload_schema_id,request_id,request_payload,request_byte_count,request_hash,state,stage,payload_expires_at,expires_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$2,$5,$7,$8,$9,'EXPAND_SELECTED_S0',$10,'old-mike-v2-alpha2/expand-s0-input/1',$11,$12::jsonb,octet_length($12::jsonb::text),$13,'QUEUED','QUEUED',clock_timestamp()+($14::text||' days')::interval,clock_timestamp()+($14::text||' days')::interval)
          ON CONFLICT (workspace_id,created_by_user_id,request_id) DO NOTHING`,
          [childId, this.principal.workspaceId, this.principal.projectId ? "TENANT_PROJECT" : "PRE_PROJECT", this.principal.projectId ?? null, this.principal.userId, job.rootJobId, job.id, result.rows[0].id, selectedItemHash, V2_ALPHA2_CONTRACT_VERSION, childRequestId, JSON.stringify(childPayload), childRequestHash, V2_ALPHA2_RETENTION_DAYS],
        );
        childCreated = inserted.rowCount === 1;
      }
      return { resultId: result.rows[0].id, childCreated };
    });
  }

  private async settleEffect(claim: V2Alpha2Claim, effectState: "PROVEN_NOT_SUBMITTED" | "TERMINAL_REJECTED" | "COMPLETION_UNKNOWN", code: V2Alpha2ErrorCode) {
    await this.transaction(async (client) => {
      const job = await this.lockFencedJob(client, claim);
      const effect = await this.lockEffect(client, claim.id);
      if (!effect) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      const expected = effectState === "PROVEN_NOT_SUBMITTED" ? "INTENT_PERSISTED" : "SUBMISSION_POSSIBLE";
      const effectUpdate = await client.query(
        `UPDATE research_generation_effects SET effect_state=$2,provider_attempt_class=$3,state_version=state_version+1,
         lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$4 AND lease_owner=$5 AND lease_token=$6 AND lease_generation=$7 AND effect_state=$8`,
        [effect.id, effectState, effectState === "PROVEN_NOT_SUBMITTED" ? "NOT_ATTEMPTED" : "UNKNOWN", Number(effect.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration, expected],
      );
      if (effectUpdate.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      if (effectState !== "COMPLETION_UNKNOWN") {
        const jobUpdate = await client.query(
          `UPDATE research_generation_jobs SET state='FAILED',stage='TERMINAL',completion_class=$2,sanitized_error_code=$3,state_version=state_version+1,
           lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
           WHERE id=$1 AND state_version=$4 AND lease_owner=$5 AND lease_token=$6 AND lease_generation=$7`,
          [claim.id, effectState, code, Number(job.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
        );
        if (jobUpdate.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
      }
    });
  }

  completeProvenNotSubmitted(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode) { return this.settleEffect(claim, "PROVEN_NOT_SUBMITTED", code); }
  completeTerminalRejected(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode) { return this.settleEffect(claim, "TERMINAL_REJECTED", code); }
  completeUnknown(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode) { return this.settleEffect(claim, "COMPLETION_UNKNOWN", code); }

  async markReconcileRequired(claim: V2Alpha2Claim, code: V2Alpha2ErrorCode) {
    await this.transaction(async (client) => {
      const job = await this.lockFencedJob(client, claim);
      const updated = await client.query(
        `UPDATE research_generation_jobs SET state='RECONCILE_REQUIRED',stage='TERMINAL',completion_class='COMPLETION_UNKNOWN',sanitized_error_code=$2,
         state_version=state_version+1,lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$3 AND lease_owner=$4 AND lease_token=$5 AND lease_generation=$6`,
        [claim.id, code, Number(job.stateVersion), claim.leaseOwner, claim.leaseToken, claim.leaseGeneration],
      );
      if (updated.rowCount !== 1) throw new V2Alpha2RepositoryError("FENCE_REJECTED");
    });
  }

  async cancel(journeyRef: string) {
    return this.transaction(async (client) => {
      await this.assertExactAuthority(client);
      const job = await client.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE id=$1 AND root_job_id=$1 AND workspace_id=$2 AND created_by_user_id=$3 FOR UPDATE`, [journeyRef, this.principal.workspaceId, this.principal.userId]);
      if (!job.rows[0]) throw new V2Alpha2RepositoryError("TENANT_REJECTED");
      const effect = await this.lockEffect(client, journeyRef);
      if (job.rows[0].state !== "QUEUED" || effect) return { canceled: false, cancelAllowed: false };
      const updated = await client.query(
        `UPDATE research_generation_jobs SET state='CANCELED',stage='TERMINAL',completion_class='PROVEN_NOT_SUBMITTED',state_version=state_version+1,updated_at=clock_timestamp()
         WHERE id=$1 AND state_version=$2 AND state='QUEUED'`,
        [journeyRef, Number(job.rows[0].stateVersion)],
      );
      return { canceled: updated.rowCount === 1, cancelAllowed: false };
    });
  }

  async createFieldAssist(journeyRef: string, input: { requestId: string; targetField: string; currentValue: string; contextSnapshot: Record<string, unknown> }) {
    const requestPayload = boundedPayload({ targetField: input.targetField, currentValue: input.currentValue, contextSnapshot: input.contextSnapshot }, V2_ALPHA2_REQUEST_MAX_BYTES, "v2_alpha2_request_too_large");
    const requestHash = sha256Canonical({ operation: "FIELD_ASSIST", projectId: this.principal.projectId ?? null, payload: requestPayload });
    return this.transaction(async (client) => {
      await this.assertExactAuthority(client);
      const prior = await client.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE workspace_id=$1 AND created_by_user_id=$2 AND request_id=$3 FOR UPDATE`, [this.principal.workspaceId, this.principal.userId, input.requestId]);
      if (prior.rows[0]) {
        if (prior.rows[0].operation !== "FIELD_ASSIST" || prior.rows[0].requestHash !== requestHash || prior.rows[0].rootJobId !== journeyRef) throw new V2Alpha2RepositoryError("IDEMPOTENCY_CONFLICT");
        return { assistRef: prior.rows[0].id, replayed: true };
      }
      const parent = await client.query<{ jobId: string; resultId: string; selectedItemHash: string }>(
        `SELECT jobs.id AS "jobId",results.id::text AS "resultId",results.selected_item_hash AS "selectedItemHash"
         FROM research_generation_jobs jobs JOIN research_generation_results results ON results.job_id=jobs.id
         WHERE jobs.root_job_id=$1 AND jobs.workspace_id=$2 AND jobs.created_by_user_id=$3 AND jobs.operation='EXPAND_SELECTED_S0' AND jobs.state='SUCCEEDED'`,
        [journeyRef, this.principal.workspaceId, this.principal.userId],
      );
      if (!parent.rows[0]) throw new V2Alpha2RepositoryError("RESULT_CONFLICT");
      const assistId = newOpaqueRef("vj");
      await client.query(
        `INSERT INTO research_generation_jobs (
          id,workspace_id,project_scope,project_id,created_by_user_id,root_job_id,parent_workspace_id,parent_created_by_user_id,parent_job_id,parent_result_id,selected_item_hash,
          operation,operation_contract_version,payload_schema_id,request_id,request_payload,request_byte_count,request_hash,state,stage,payload_expires_at,expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$2,$5,$7,$8,$9,'FIELD_ASSIST',$10,'old-mike-v2-alpha2/field-assist-input/1',$11,$12::jsonb,octet_length($12::jsonb::text),$13,'QUEUED','QUEUED',clock_timestamp()+($14::text||' days')::interval,clock_timestamp()+($14::text||' days')::interval)`,
        [assistId, this.principal.workspaceId, this.principal.projectId ? "TENANT_PROJECT" : "PRE_PROJECT", this.principal.projectId ?? null, this.principal.userId, journeyRef, parent.rows[0].jobId, parent.rows[0].resultId, parent.rows[0].selectedItemHash, V2_ALPHA2_CONTRACT_VERSION, input.requestId, JSON.stringify(requestPayload), requestHash, V2_ALPHA2_RETENTION_DAYS],
      );
      return { assistRef: assistId, replayed: false };
    });
  }

  async getFieldAssist(assistRef: string) {
    const job = await this.databasePool.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE id=$1 AND workspace_id=$2 AND created_by_user_id=$3 AND operation='FIELD_ASSIST'`,
      [assistRef, this.principal.workspaceId, this.principal.userId],
    );
    if (!job.rows[0]) throw new V2Alpha2RepositoryError("TENANT_REJECTED");
    const result = await this.databasePool.query<ResultRow>(
      `SELECT id::text,job_id AS "jobId",result_payload AS "resultPayload",result_hash AS "resultHash",selected_item_hash AS "selectedItemHash"
       FROM research_generation_results WHERE job_id=$1 AND workspace_id=$2 AND created_by_user_id=$3`,
      [assistRef, this.principal.workspaceId, this.principal.userId],
    );
    return {
      assistRef,
      state: job.rows[0].state,
      completionClass: job.rows[0].state === "SUCCEEDED" ? "COMPLETE" : job.rows[0].state === "RECONCILE_REQUIRED" ? "COMPLETION_UNKNOWN" : job.rows[0].state === "FAILED" ? "TERMINAL_REJECTED" : "PENDING",
      artifact: result.rows[0]?.resultPayload ? validatePersistedFieldAssistArtifact(result.rows[0].resultPayload) : null,
      formalWriteCount: 0 as const,
    };
  }

  async getJourney(journeyRef: string): Promise<V2Alpha2JourneySnapshot> {
    const result = await this.databasePool.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM research_generation_jobs WHERE root_job_id=$1 AND workspace_id=$2 AND created_by_user_id=$3 ORDER BY created_at,id`,
      [journeyRef, this.principal.workspaceId, this.principal.userId],
    );
    const root = result.rows.find((row) => row.id === journeyRef && row.operation === "GENERATE_DIRECTIONS");
    if (!root) throw new V2Alpha2RepositoryError("TENANT_REJECTED");
    const child = result.rows.find((row) => row.operation === "EXPAND_SELECTED_S0") ?? null;
    const results = await this.databasePool.query<ResultRow>(
      `SELECT id::text,job_id AS "jobId",result_payload AS "resultPayload",result_hash AS "resultHash",selected_item_hash AS "selectedItemHash"
       FROM research_generation_results WHERE workspace_id=$1 AND created_by_user_id=$2 AND job_id = ANY($3::text[]) ORDER BY id`,
      [this.principal.workspaceId, this.principal.userId, result.rows.map((row) => row.id)],
    );
    const stageARow = results.rows.find((row) => row.jobId === root.id);
    const stageBRow = child ? results.rows.find((row) => row.jobId === child.id) : null;
    const stageA = stageARow ? { contentHash: stageARow.resultHash, ...parseDirectionArtifact(stageARow.resultPayload) } : null;
    const stageB = stageBRow ? { contentHash: stageBRow.resultHash, ...parseS0Artifact(stageBRow.resultPayload) } : null;
    const active = child ?? root;
    const effect = await this.databasePool.query<{ count: string }>("SELECT count(*)::text AS count FROM research_generation_effects WHERE job_id=$1", [root.id]);
    const cancelAllowed = root.state === "QUEUED" && effect.rows[0]?.count === "0";
    const state: V2Alpha2JourneySnapshot["state"] = stageB
      ? "STAGE_B_READY"
      : active.state === "RECONCILE_REQUIRED"
        ? "RECONCILE_REQUIRED"
        : active.state === "FAILED"
          ? "FAILED"
          : stageA && child?.state === "QUEUED"
            ? "STAGE_B_QUEUED"
            : stageA && child?.state === "RUNNING"
              ? "STAGE_B_RUNNING"
              : stageA
                ? "STAGE_A_READY"
                : root.state === "RUNNING"
                  ? "RUNNING"
                  : root.state === "CANCELED"
                    ? "CANCELED"
                    : "QUEUED";
    return {
      contractVersion: "old-mike-v2-alpha2/journey/1",
      journeyRef,
      state,
      lastReadyStage: stageB ? "B" : stageA ? "A" : "NONE",
      stageA,
      stageB,
      selectedCompareDirectionId: stageA?.recommendedDirectionId ?? null,
      s0SourceDirectionId: stageB?.sourceDirectionId ?? (stageA?.recommendedDirectionId ?? null),
      cancelAllowed,
      recoveryAction: cancelAllowed ? "CANCEL_OR_VIEW_PROGRESS" : state === "STAGE_B_READY" || state === "FAILED" || state === "CANCELED" ? "NONE" : "VIEW_PROGRESS",
      formalWriteCount: 0,
    };
  }
}

let sharedPool: Pool | null = null;
function defaultPool() {
  if (!process.env.DATABASE_URL) throw new V2Alpha2RepositoryError("STORAGE_UNAVAILABLE");
  sharedPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return sharedPool;
}

export function createV2Alpha2Repository(principal: V2Alpha2Principal) {
  return new V2Alpha2PostgresRepository(defaultPool(), principal);
}

export async function closeV2Alpha2RepositoryForDisposableTest() {
  if (process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new V2Alpha2RepositoryError("STORAGE_UNAVAILABLE");
  await sharedPool?.end();
  sharedPool = null;
}
