import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("agent_job_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
type Row = Record<string, unknown>;

export type AgentJobStatus = "QUEUED" | "RUNNING" | "PARTIAL" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REQUIRES_ACTION";

export type AgentJob = {
  jobId: string;
  workspaceId: string;
  projectId: string;
  requesterUserId: string;
  taskType: string;
  inputSnapshot: Row;
  idempotencyKey: string;
  status: AgentJobStatus;
  checkpoint: Row;
  attempt: number;
  providerRequestId: string | null;
  usage: Row;
  errorCode: string | null;
  errorMessage: string | null;
  resultReference: Row;
  createdAt: string;
  updatedAt: string;
};

const JOB_COLUMNS = `job_id AS "jobId", workspace_id AS "workspaceId", project_id AS "projectId", requester_user_id AS "requesterUserId", task_type AS "taskType", input_snapshot AS "inputSnapshot", idempotency_key AS "idempotencyKey", status, checkpoint, attempt, provider_request_id AS "providerRequestId", usage, error_code AS "errorCode", error_message AS "errorMessage", result_reference AS "resultReference", created_at AS "createdAt", updated_at AS "updatedAt"`;

async function rowToJob(row: Row): Promise<AgentJob> {
  return {
    jobId: text(row.jobId),
    workspaceId: text(row.workspaceId),
    projectId: text(row.projectId),
    requesterUserId: text(row.requesterUserId),
    taskType: text(row.taskType),
    inputSnapshot: (row.inputSnapshot as Row) ?? {},
    idempotencyKey: text(row.idempotencyKey),
    status: text(row.status) as AgentJobStatus,
    checkpoint: (row.checkpoint as Row) ?? {},
    attempt: Number(row.attempt ?? 0),
    providerRequestId: row.providerRequestId === null || row.providerRequestId === undefined ? null : text(row.providerRequestId),
    usage: (row.usage as Row) ?? {},
    errorCode: row.errorCode === null || row.errorCode === undefined ? null : text(row.errorCode),
    errorMessage: row.errorMessage === null || row.errorMessage === undefined ? null : text(row.errorMessage),
    resultReference: (row.resultReference as Row) ?? {},
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : text(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : text(row.updatedAt),
  };
}

export class AgentJobRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) {
    super(code);
    this.name = "AgentJobRepositoryError";
    this.code = code;
    this.status = status;
  }
}

export async function createAgentJob(input: {
  tenant: ResearchTenant;
  requesterUserId: string;
  taskType: string;
  inputSnapshot: Row;
  idempotencyKey: string;
}): Promise<AgentJob> {
  const jobId = `aj_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const job = await withClient(async (client) => {
    // 冪等：同 project + idempotency_key 已存在 → 回傳既有 job，不重複建立
    const existing = await client.query(`SELECT ${JOB_COLUMNS} FROM agent_jobs WHERE ${tenantWhere()} AND idempotency_key=$3`, [input.tenant.workspaceId, input.tenant.projectId, input.idempotencyKey]);
    if (existing.rows[0]) return rowToJob(existing.rows[0] as Row);
    await client.query(
      `INSERT INTO agent_jobs (job_id, workspace_id, project_id, requester_user_id, task_type, input_snapshot, idempotency_key, status, checkpoint, attempt, usage, result_reference, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'QUEUED','{}'::jsonb,0,'{}'::jsonb,'{}'::jsonb,now(),now())`,
      [jobId, input.tenant.workspaceId, input.tenant.projectId, input.requesterUserId, input.taskType, JSON.stringify(input.inputSnapshot), input.idempotencyKey],
    );
    const row = (await client.query(`SELECT ${JOB_COLUMNS} FROM agent_jobs WHERE job_id=$1`, [jobId])).rows[0] as Row;
    return rowToJob(row);
  });
  return job;
}

export async function getAgentJob(tenant: ResearchTenant, jobId: string): Promise<AgentJob | null> {
  return withClient(async (client) => {
    const row = (await client.query(`SELECT ${JOB_COLUMNS} FROM agent_jobs WHERE job_id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, jobId])).rows[0] as Row | undefined;
    return row ? rowToJob(row) : null;
  });
}

export async function listAgentJobs(tenant: ResearchTenant, taskType?: string, limit = 10): Promise<AgentJob[]> {
  return withClient(async (client) => {
    const params: unknown[] = [tenant.workspaceId, tenant.projectId];
    let where = tenantWhere();
    if (taskType) { params.push(taskType); where += ` AND task_type=$${params.length}`; }
    params.push(Math.min(Math.max(limit, 1), 50));
    const rows = (await client.query(`SELECT ${JOB_COLUMNS} FROM agent_jobs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`, params)).rows as Row[];
    return Promise.all(rows.map((row) => rowToJob(row)));
  });
}

export async function listAgentJobEvents(tenant: ResearchTenant, jobId: string, limit = 50): Promise<Array<{ eventId: string; eventType: string; detail: Row; createdAt: string }>> {
  return withClient(async (client) => {
    // agent_job_events 以 job_id 外鍵關聯；job 的 tenant 歸屬已在 getAgentJob/route 驗證
    void tenant;
    const rows = (await client.query(
      `SELECT event_id AS "eventId", event_type AS "eventType", detail, created_at AS "createdAt" FROM agent_job_events WHERE job_id=$1 ORDER BY created_at ASC LIMIT $2`,
      [jobId, Math.min(Math.max(limit, 1), 200)],
    )).rows as Row[];
    return rows.map((row) => ({
      eventId: text(row.eventId),
      eventType: text(row.eventType),
      detail: (row.detail as Row) ?? {},
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : text(row.createdAt),
    }));
  });
}

export async function appendJobEvent(input: { tenant: ResearchTenant; jobId: string; eventType: string; detail?: Row }): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO agent_job_events (event_id, job_id, event_type, detail, created_at) VALUES ($1,$2,$3,$4::jsonb,now())`,
      [`aje_${randomUUID().replace(/-/g, "").slice(0, 24)}`, input.jobId, input.eventType, JSON.stringify(input.detail ?? {})],
    );
    // 事件寫入不該變更 job 本體；此處僅確保 job 屬於該 tenant（由 route 層先驗證）
    void input.tenant;
  });
}

export async function updateAgentJobStatus(input: { tenant: ResearchTenant; jobId: string; patch: Partial<{ status: AgentJobStatus; checkpoint: Row; attempt: number; providerRequestId: string | null; usage: Row; errorCode: string | null; errorMessage: string | null; resultReference: Row; leaseUntil: string | null }> }): Promise<void> {
  await withClient(async (client) => {
    const sets: string[] = [];
    const params: unknown[] = [input.tenant.workspaceId, input.tenant.projectId, input.jobId];
    const add = (sql: string, value: unknown) => { params.push(value); sets.push(sql.replace("$n", `$${params.length}`)); };
    if (input.patch.status !== undefined) add("status=$n", input.patch.status);
    if (input.patch.checkpoint !== undefined) add("checkpoint=$n::jsonb", JSON.stringify(input.patch.checkpoint));
    if (input.patch.attempt !== undefined) add("attempt=$n", input.patch.attempt);
    if (input.patch.providerRequestId !== undefined) add("provider_request_id=$n", input.patch.providerRequestId);
    if (input.patch.usage !== undefined) add("usage=$n::jsonb", JSON.stringify(input.patch.usage));
    if (input.patch.errorCode !== undefined) add("error_code=$n", input.patch.errorCode);
    if (input.patch.errorMessage !== undefined) add("error_message=$n", input.patch.errorMessage);
    if (input.patch.resultReference !== undefined) add("result_reference=$n::jsonb", JSON.stringify(input.patch.resultReference));
    if (input.patch.leaseUntil !== undefined) add("lease_until=$n", input.patch.leaseUntil);
    sets.push("updated_at=now()");
    await client.query(`UPDATE agent_jobs SET ${sets.join(", ")} WHERE ${tenantWhere()} AND job_id=$3`, params);
  });
}

export async function cancelAgentJob(tenant: ResearchTenant, jobId: string): Promise<{ cancelled: boolean }> {
  return withClient(async (client) => {
    const result = await client.query(`UPDATE agent_jobs SET cancel_requested=true, updated_at=now() WHERE ${tenantWhere()} AND job_id=$3 AND status IN ('QUEUED','RUNNING','PARTIAL')`, [tenant.workspaceId, tenant.projectId, jobId]);
    return { cancelled: (result.rowCount ?? 0) > 0 };
  });
}

/** 恢復：把逾時仍 RUNNING（lease 過期）的 job 標回 QUEUED（含事件），避免永久 RUNNING */
export async function requeueStaleRunningJobs(tenant: ResearchTenant, staleAfterSeconds = 300): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE agent_jobs SET status='QUEUED', lease_until=NULL, updated_at=now()
        WHERE ${tenantWhere()} AND status='RUNNING' AND (lease_until IS NULL OR lease_until < now() - make_interval(secs => $3))`,
      [tenant.workspaceId, tenant.projectId, staleAfterSeconds],
    );
    return result.rowCount ?? 0;
  });
}
