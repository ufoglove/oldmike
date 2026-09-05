import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("scientific_review_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
type Row = Record<string, unknown>;
async function one(client: PoolClient, sql: string, params: unknown[]): Promise<Row | null> {
  const r = await client.query(sql, params);
  return (r.rows[0] as Row) ?? null;
}
async function many(client: PoolClient, sql: string, params: unknown[]): Promise<Row[]> {
  const r = await client.query(sql, params);
  return r.rows as Row[];
}

const SEVERITIES = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "SUGGESTION"] as const;
const DECISIONS = ["OPEN", "ACCEPTED", "IN_REVISION", "RESOLVED_PENDING_REVIEW", "VERIFIED_RESOLVED", "ACCEPTED_RISK", "REJECTED_WITH_JUSTIFICATION", "NOT_APPLICABLE"] as const;
const TASK_STATUSES = ["OPEN", "BLOCKED", "IN_PROGRESS", "AUTHOR_REVIEW", "RESOLVED_PENDING_VERIFICATION", "VERIFIED", "ACCEPTED_RISK", "CANCELLED_WITH_REASON"] as const;
const RUN_STATUSES = ["NOT_STARTED", "INTAKE", "REVIEW_IN_PROGRESS", "FINDINGS_READY", "REVISION_PLANNING", "REVISION_IN_PROGRESS", "RE_REVIEW_REQUIRED", "SCIENTIFICALLY_APPROVED", "BLOCKED", "CLOSED"] as const;

async function manuscriptState(client: PoolClient, tenant: ResearchTenant): Promise<{ manuscriptId: string; version: number; approvedSections: number; totalSections: number }> {
  const man = await one(client, `SELECT manuscript_id, current_version FROM manuscript_projects WHERE ${tenantWhere()} AND status IN ('DRAFT','ACTIVE') ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const manuscriptId = text(man?.manuscript_id);
  if (!manuscriptId) return { manuscriptId: "", version: 0, approvedSections: 0, totalSections: 0 };
  const rows = await many(client, `SELECT status FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3`, [tenant.workspaceId, tenant.projectId, manuscriptId]);
  return { manuscriptId, version: int(man?.current_version), approvedSections: rows.filter((row) => text(row.status) === "APPROVED" || text(row.status) === "LOCKED").length, totalSections: rows.length };
}

export async function getScientificReviewCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const man = await manuscriptState(client, tenant);
    const runs = await many(client, `SELECT review_run_id, manuscript_id, review_version, manuscript_version, status, simulated, review_started_at, completed_at, created_at FROM scientific_review_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId]);
    const latest = runs[0] as Row | undefined;
    const runId = text(latest?.review_run_id);
    const findings = runId ? await many(client, `SELECT finding_id, reviewer_role, issue_type, severity, finding_title, finding_description, recommended_action, destination_module, author_decision, status, created_at FROM scientific_review_findings WHERE ${tenantWhere()} AND review_run_id=$3 ORDER BY created_at ASC LIMIT 200`, [tenant.workspaceId, tenant.projectId, runId]) : [];
    const tasks = runId ? await many(client, `SELECT task_id, finding_id, title, severity, affected_sections, destination_module, required_action, status, due_date, proposed_change FROM scientific_revision_tasks WHERE ${tenantWhere()} AND review_run_id=$3 ORDER BY created_at ASC LIMIT 200`, [tenant.workspaceId, tenant.projectId, runId]) : [];
    const reasons: string[] = [];
    if (!man.manuscriptId) reasons.push("尚未建立全文稿件；請先至「全文寫作工作室（13）」建立稿件並完成章節。");
    else if (man.totalSections > 0 && man.approvedSections < man.totalSections) reasons.push(`稿件尚有 ${man.totalSections - man.approvedSections} 個章節未核准（${man.approvedSections}/${man.totalSections}）；請先完成「全文寫作工作室（13）」章節核准。`);
    const locked = reasons.length > 0;
    const openFindings = findings.filter((row) => text(row.status) === "OPEN" || text(row.status) === "ACCEPTED" || text(row.status) === "IN_REVISION");
    const blockers = openFindings.filter((row) => text(row.severity) === "BLOCKER" || text(row.severity) === "CRITICAL").length;
    return {
      ok: true,
      locked,
      reasons,
      summary: {
        status: locked ? "SCIENTIFIC_REVIEW_CENTER_LOCKED" : runs.length === 0 ? "SCIENTIFIC_REVIEW_NOT_STARTED" : text(latest?.status),
        runs: runs.length,
        simulated: runs.some((row) => row.simulated === true || text(row.simulated) === "true"),
        findings: findings.length,
        openFindings: openFindings.length,
        blockers,
        tasks: tasks.length,
        nextCenter: "manuscript",
      },
      manuscript: { manuscriptId: man.manuscriptId, version: man.version, approvedSections: man.approvedSections, totalSections: man.totalSections },
      runs: runs.map((row) => ({ reviewRunId: text(row.review_run_id), reviewVersion: int(row.review_version), manuscriptVersion: int(row.manuscript_version), status: text(row.status), simulated: row.simulated === true || text(row.simulated) === "true", startedAt: dt(row.review_started_at), completedAt: dt(row.completed_at) })),
      findings: findings.map((row) => ({ findingId: text(row.finding_id), reviewerRole: text(row.reviewer_role), issueType: text(row.issue_type), severity: text(row.severity), title: text(row.finding_title), description: text(row.finding_description), recommendedAction: text(row.recommended_action), destinationModule: text(row.destination_module), authorDecision: text(row.author_decision), status: text(row.status), createdAt: dt(row.created_at) })),
      tasks: tasks.map((row) => ({ taskId: text(row.task_id), findingId: text(row.finding_id), title: text(row.title), severity: text(row.severity), destinationModule: text(row.destination_module), status: text(row.status), dueDate: dt(row.due_date) })),
    };
  });
}

export async function startScientificReview(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const man = await manuscriptState(client, tenant);
    if (!man.manuscriptId) return { ok: false, error: "scientific_review_requires_manuscript" };
    if (man.totalSections > 0 && man.approvedSections < man.totalSections) return { ok: false, error: "scientific_review_requires_approved_sections" };
    const active = await one(client, `SELECT review_run_id FROM scientific_review_runs WHERE ${tenantWhere()} AND status IN ('INTAKE','REVIEW_IN_PROGRESS','FINDINGS_READY','REVISION_PLANNING','RE_REVIEW_REQUIRED') ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (active) return { ok: false, error: "scientific_review_already_active", reviewRunId: text(active.review_run_id) };
    const runId = `srr_${randomUUID()}`;
    const snapshot = { mode: "SIMULATED_AI_REVIEW", note: "老麥科學審查（模擬）：發現由審查契約產生或由研究者手動登錄；正式決策需研究者核准。", initiatedBy: input.userId, at: new Date().toISOString() };
    await client.query(`INSERT INTO scientific_review_runs (id, workspace_id, project_id, review_run_id, manuscript_id, review_version, manuscript_version, status, intake_snapshot, simulated, initiated_by, review_started_at, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,1,$6,'REVIEW_IN_PROGRESS',$7::jsonb,true,$8,now(),$8,now(),now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, runId, man.manuscriptId, man.version, JSON.stringify(snapshot), input.userId]);
    return { ok: true, reviewRunId: runId, simulated: true };
  });
}

export async function addScientificFinding(tenant: ResearchTenant, input: { userId: string; reviewRunId: string; severity: string; issueType?: string; title: string; description: string; recommendedAction?: string; destinationModule?: string }) {
  if (!SEVERITIES.includes(str(input.severity) as never)) return { ok: false, error: "finding_severity_invalid" };
  const title = str(input.title).slice(0, 240);
  if (!title) return { ok: false, error: "finding_title_required" };
  return withClient(async (client) => {
    const run = await one(client, `SELECT review_run_id, simulated FROM scientific_review_runs WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    if (!run) return { ok: false, error: "scientific_review_run_not_found" };
    const findingId = `sf_${randomUUID().slice(0, 12)}`;
    await client.query(`INSERT INTO scientific_review_findings (id, workspace_id, project_id, review_run_id, finding_id, reviewer_role, issue_type, severity, finding_title, finding_description, recommended_action, destination_module, author_decision, verification_status, status, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'REVIEWER_AI','$6',$7,$8,$9,$10,$11,'OPEN','UNVERIFIED','OPEN',$12,now(),now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, input.reviewRunId, findingId, str(input.issueType, "SCIENTIFIC_VALIDITY").slice(0, 60), str(input.severity), title, str(input.description).slice(0, 20_000), str(input.recommendedAction).slice(0, 4000), str(input.destinationModule).slice(0, 80), input.userId]);
    await client.query(`UPDATE scientific_review_runs SET status='FINDINGS_READY', updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    return { ok: true, findingId, reviewRunId: input.reviewRunId };
  });
}

export async function updateFindingDecision(tenant: ResearchTenant, input: { userId: string; reviewRunId: string; findingId: string; decision: string; response?: string }) {
  if (!DECISIONS.includes(str(input.decision) as never)) return { ok: false, error: "finding_decision_invalid" };
  return withClient(async (client) => {
    const finding = await one(client, `SELECT id FROM scientific_review_findings WHERE ${tenantWhere()} AND review_run_id=$3 AND finding_id=$4`, [tenant.workspaceId, tenant.projectId, input.reviewRunId, input.findingId]);
    if (!finding) return { ok: false, error: "finding_not_found" };
    await client.query(`UPDATE scientific_review_findings SET author_decision=$3, author_response=$4, status=$3, updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$5 AND finding_id=$6`,
      [tenant.workspaceId, tenant.projectId, str(input.decision), str(input.response).slice(0, 4000), input.reviewRunId, input.findingId]);
    return { ok: true, findingId: input.findingId, decision: str(input.decision) };
  });
}

export async function createRevisionTask(tenant: ResearchTenant, input: { userId: string; reviewRunId: string; findingId: string; title: string; requiredAction?: string; destinationModule?: string; severity?: string }) {
  const title = str(input.title).slice(0, 240);
  if (!title) return { ok: false, error: "task_title_required" };
  return withClient(async (client) => {
    const run = await one(client, `SELECT review_run_id FROM scientific_review_runs WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    if (!run) return { ok: false, error: "scientific_review_run_not_found" };
    const taskId = `srt_${randomUUID().slice(0, 12)}`;
    await client.query(`INSERT INTO scientific_revision_tasks (id, workspace_id, project_id, review_run_id, task_id, finding_id, title, severity, destination_module, required_action, status, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPEN',$11,now(),now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, input.reviewRunId, taskId, input.findingId, title, SEVERITIES.includes(str(input.severity) as never) ? str(input.severity) : "MAJOR", str(input.destinationModule).slice(0, 80), str(input.requiredAction).slice(0, 4000), input.userId]);
    return { ok: true, taskId, reviewRunId: input.reviewRunId };
  });
}

export async function updateTaskStatus(tenant: ResearchTenant, input: { userId: string; reviewRunId: string; taskId: string; status: string }) {
  if (!TASK_STATUSES.includes(str(input.status) as never)) return { ok: false, error: "task_status_invalid" };
  return withClient(async (client) => {
    const task = await one(client, `SELECT id FROM scientific_revision_tasks WHERE ${tenantWhere()} AND review_run_id=$3 AND task_id=$4`, [tenant.workspaceId, tenant.projectId, input.reviewRunId, input.taskId]);
    if (!task) return { ok: false, error: "task_not_found" };
    await client.query(`UPDATE scientific_revision_tasks SET status=$3, updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$4 AND task_id=$5`, [tenant.workspaceId, tenant.projectId, str(input.status), input.reviewRunId, input.taskId]);
    return { ok: true, taskId: input.taskId, status: str(input.status) };
  });
}

export async function completeScientificReview(tenant: ResearchTenant, input: { userId: string; reviewRunId: string }) {
  return withClient(async (client) => {
    const run = await one(client, `SELECT review_run_id, status FROM scientific_review_runs WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    if (!run) return { ok: false, error: "scientific_review_run_not_found" };
    const findings = await many(client, `SELECT severity, status FROM scientific_review_findings WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    const blockers = findings.filter((row) => (text(row.status) === "OPEN" || text(row.status) === "ACCEPTED" || text(row.status) === "IN_REVISION") && (text(row.severity) === "BLOCKER" || text(row.severity) === "CRITICAL")).length;
    const tasksOpen = await one(client, `SELECT count(*)::int AS n FROM scientific_revision_tasks WHERE ${tenantWhere()} AND review_run_id=$3 AND status IN ('OPEN','BLOCKED','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    if (blockers > 0 || int(tasksOpen?.n) > 0) {
      await client.query(`UPDATE scientific_review_runs SET status='RE_REVIEW_REQUIRED', updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
      return { ok: false, error: "scientific_review_has_open_blockers", blockers, openTasks: int(tasksOpen?.n) };
    }
    await client.query(`UPDATE scientific_review_runs SET status='SCIENTIFICALLY_APPROVED', completed_at=now(), updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, input.reviewRunId]);
    return { ok: true, reviewRunId: input.reviewRunId, status: "SCIENTIFICALLY_APPROVED" };
  });
}
