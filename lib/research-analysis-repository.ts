import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("analysis_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
type Row = Record<string, unknown>;
async function many(client: PoolClient, sql: string, params: unknown[]): Promise<Row[]> {
  const r = await client.query(sql, params);
  return r.rows as Row[];
}
async function one(client: PoolClient, sql: string, params: unknown[]): Promise<Row | null> {
  const r = await client.query(sql, params);
  return (r.rows[0] as Row) ?? null;
}
async function gateApproved(client: PoolClient, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}
function gateRun(client: PoolClient, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  return gateApproved(client, tenant, gateType);
}

// ================= 摘要與鎖定 =================
export async function getAnalysisCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const rawDataGate = await gateRun(client, tenant, "RAW_DATA_LOCKED_AND_HANDOFF_READY");
    const datasetRows = await many(client, `SELECT id, artifact_id, sha256, media_type, byte_size, registered_at FROM research_datasets WHERE ${tenantWhere()} ORDER BY registered_at DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId]);
    const planRows = await many(client, `SELECT id, logical_id, version_number, method, parameters, engine, locked_at, created_at, updated_at FROM research_analysis_plans WHERE ${tenantWhere()} ORDER BY updated_at DESC`, [tenant.workspaceId, tenant.projectId]);
    const runRows = await many(client, `SELECT id, dataset_id, analysis_plan_id, method, engine, status, result_payload, created_at, updated_at FROM research_analysis_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]);
    const draftRow = await one(client, `SELECT id, body, title, stage_detail, created_at FROM research_documents WHERE ${tenantWhere()} AND document_type=$3 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, "ANALYSIS_RESULT_DRAFT"]);
    const lockedPlan = planRows.some((row) => Boolean(row.locked_at));
    const reasons: string[] = [];
    if (!rawDataGate) reasons.push("尚未完成正式執行 Raw Data Lock；請先至「正式研究與執行」鎖定原始資料並完成交接核准。");
    if (datasetRows.length === 0) reasons.push("尚未註冊 Analysis Dataset；請先至「資料治理與 Analysis Dataset」完成治理並註冊資料集。");
    const frozen = datasetRows.length > 0 && lockedPlan && runRows.length > 0;
    return {
      ok: true,
      locked: reasons.length > 0,
      reasons,
      gate: { rawDataGate, datasetRegistered: datasetRows.length > 0, lockedPlan, hasRuns: runRows.length > 0 },
      summary: {
        status: reasons.length > 0 ? "ANALYSIS_EXECUTION_LOCKED" : frozen ? "RESULTS_READY_FOR_REVIEW" : "ANALYSIS_IN_PROGRESS",
        datasets: datasetRows.length,
        plans: planRows.length,
        runs: runRows.length,
        frozen,
        nextCenter: reasons.some((reason) => reason.includes("Raw Data Lock")) ? "execution" : reasons.length ? "governance" : null,
      },
      datasets: datasetRows.map((row) => ({ id: text(row.id), artifactId: text(row.artifact_id), sha256: text(row.sha256), mediaType: text(row.media_type), byteSize: int(row.byte_size), registeredAt: dt(row.registered_at) })),
      plans: planRows.map((row) => ({ id: text(row.id), logicalId: text(row.logical_id), versionNumber: int(row.version_number), method: text(row.method), parameters: row.parameters ?? null, engine: text(row.engine), locked: Boolean(row.locked_at), lockedAt: dt(row.locked_at), updatedAt: dt(row.updated_at) })),
      runs: runRows.map((row) => ({ id: text(row.id), datasetId: text(row.dataset_id), analysisPlanId: text(row.analysis_plan_id), method: text(row.method), engine: text(row.engine), status: text(row.status), resultHash: text(row.result_payload ? hash(row.result_payload) : ""), createdAt: dt(row.created_at) })),
      draft: draftRow ? { id: text(draftRow.id), body: text(draftRow.body), title: text(draftRow.title), stageDetail: draftRow.stage_detail ?? null, updatedAt: dt(draftRow.created_at) } : null,
    };
  });
}

// ================= 分析計畫 =================
export async function saveAnalysisPlan(tenant: ResearchTenant, input: { userId: string; planId?: string; method: string; parameters: unknown; engine?: string }) {
  const method = str(input.method, "DESCRIPTIVE").slice(0, 120);
  const parameters = record(input.parameters) ? input.parameters : {};
  const engine = str(input.engine, "manual").slice(0, 60);
  return withClient(async (client) => {
    if (str(input.planId)) {
      const row = await one(client, `SELECT id, locked_at FROM research_analysis_plans WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, str(input.planId)]);
      if (!row) return { ok: false, error: "analysis_plan_not_found" };
      if (text(row.locked_at)) return { ok: false, error: "analysis_plan_locked" };
      await client.query(`UPDATE research_analysis_plans SET method=$3, parameters=$4::jsonb, engine=$5, content_hash=$6, updated_at=now() WHERE ${tenantWhere()} AND id=$7`, [tenant.workspaceId, tenant.projectId, method, JSON.stringify(parameters), engine, hash({ method, parameters }), str(input.planId)]);
      return { ok: true, planId: str(input.planId) };
    }
    const id = `anp_${randomUUID()}`;
    await client.query(`INSERT INTO research_analysis_plans (id, logical_id, version_number, workspace_id, project_id, created_by_user_id, method, parameters, engine, content_hash, created_at, updated_at)
      VALUES ($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8,$9,now(),now())`, [id, `analysis-plan-${randomUUID().slice(0, 8)}`, tenant.workspaceId, tenant.projectId, input.userId, method, JSON.stringify(parameters), engine, hash({ method, parameters })]);
    return { ok: true, planId: id };
  });
}

export async function lockAnalysisPlan(tenant: ResearchTenant, input: { userId: string; planId: string }) {
  return withClient(async (client) => {
    const row = await one(client, `SELECT id FROM research_analysis_plans WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.planId]);
    if (!row) return { ok: false, error: "analysis_plan_not_found" };
    await client.query(`UPDATE research_analysis_plans SET locked_at=now(), locked_by_user_id=$3 WHERE ${tenantWhere()} AND id=$4`, [tenant.workspaceId, tenant.projectId, input.userId, input.planId]);
    return { ok: true, planId: input.planId };
  });
}

// ================= 分析執行紀錄 =================
export async function registerAnalysisRun(tenant: ResearchTenant, input: { userId: string; datasetId: string; analysisPlanId: string; note?: string }) {
  return withClient(async (client) => {
    const dataset = await one(client, `SELECT id FROM research_datasets WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    if (!dataset) return { ok: false, error: "analysis_dataset_not_found" };
    const plan = await one(client, `SELECT id, locked_at, method, engine FROM research_analysis_plans WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.analysisPlanId]);
    if (!plan) return { ok: false, error: "analysis_plan_not_found" };
    const id = `anr_${randomUUID()}`;
    const provenance = { mode: "REGISTERED", note: str(input.note).slice(0, 2000) || null, registeredBy: input.userId, at: new Date().toISOString() };
    await client.query(`INSERT INTO research_analysis_runs (id, workspace_id, project_id, created_by_user_id, dataset_id, analysis_plan_id, idempotency_key, input_hash, method, engine, provenance, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'PLANNED',now(),now())`,
      [id, tenant.workspaceId, tenant.projectId, input.userId, input.datasetId, input.analysisPlanId, `anr:${randomUUID()}`, hash({ datasetId: input.datasetId, planId: input.analysisPlanId }), text(plan.method), text(plan.engine), JSON.stringify(provenance)]);
    return { ok: true, runId: id };
  });
}

// ================= 結果草稿（AI_PROPOSED，未驗證）================
export async function saveAnalysisResultDraft(tenant: ResearchTenant, input: { userId: string; title: string; body: string; mode?: string }) {
  const title = str(input.title, "分析結果草稿").slice(0, 240);
  const body = str(input.body).slice(0, 200_000);
  const mode = str(input.mode, "USER_DRAFT").slice(0, 40);
  if (!body) return { ok: false, error: "analysis_draft_body_required" };
  return withClient(async (client) => {
    const id = `and_${randomUUID()}`;
    await client.query(`INSERT INTO research_documents (id, logical_id, version_number, workspace_id, project_id, created_by_user_id, document_type, title, body, content_hash, stage_detail, created_at, updated_at)
      VALUES ($1,$2,1,$3,$4,$5,'ANALYSIS_RESULT_DRAFT',$6,$7,$8,$9::jsonb,now(),now())`,
      [id, `analysis-result-draft-${randomUUID().slice(0, 8)}`, tenant.workspaceId, tenant.projectId, input.userId, title, body, hash({ title, body }), JSON.stringify({ mode, aiProposed: mode === "AI_PROPOSED", provenance: "NOT_VERIFIED" })]);
    return { ok: true, draftId: id, mode };
  });
}
