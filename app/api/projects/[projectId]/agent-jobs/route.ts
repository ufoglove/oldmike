import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { AgentJobRepositoryError, createAgentJob, listAgentJobs } from "@/lib/agent-job-repository";
import { dispatchPendingJobs } from "@/lib/agent-job-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_TASK_TYPES = ["RESEARCH_START_SUMMARY"] as const;
const MAX_INPUT_BYTES = 32_000;

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 65_536) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 65_536) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const url = new URL(request.url);
    const taskType = url.searchParams.get("taskType") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const jobs = await listAgentJobs(tenant, taskType, Number.isFinite(limit) ? limit : 10);
    return json({ ok: true, jobs });
  } catch (error) {
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "agent_jobs_unavailable" }, 503);
    return json({ ok: false, code: "agent_jobs_list_failed", error: "任務清單讀取失敗。" }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  const body = await readBody(request);
  if (!record(body) || typeof body.taskType !== "string") return json({ ok: false, code: "invalid_agent_job_request" }, 400);
  const taskType = body.taskType as string;
  if (!(SUPPORTED_TASK_TYPES as readonly string[]).includes(taskType)) return json({ ok: false, code: "unsupported_task_type", error: `本階段只支援：${SUPPORTED_TASK_TYPES.join(", ")}` }, 422);
  const inputSnapshot = record(body.inputSnapshot) ? body.inputSnapshot : {};
  const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim().slice(0, 200) : `default:${taskType}`;
  if (Buffer.byteLength(JSON.stringify(inputSnapshot), "utf8") > MAX_INPUT_BYTES) return json({ ok: false, code: "agent_job_input_too_large" }, 413);
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const job = await createAgentJob({ tenant, requesterUserId: auth.session.user.id, taskType, inputSnapshot, idempotencyKey });
    // 背景派送（不 await AI 完成；job 狀態持久化，失敗可重試/恢復）
    void dispatchPendingJobs(tenant).catch(() => undefined);
    return json({ ok: true, job }, job.status === "QUEUED" ? 202 : 200);
  } catch (error) {
    if (error instanceof AgentJobRepositoryError) return json({ ok: false, code: error.code }, error.status);
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "agent_jobs_unavailable" }, 503);
    return json({ ok: false, code: "agent_job_create_failed", error: "任務建立失敗。" }, 500);
  }
}
