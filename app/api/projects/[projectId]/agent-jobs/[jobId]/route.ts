import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { cancelAgentJob, getAgentJob, listAgentJobEvents } from "@/lib/agent-job-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request) {
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 16_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string; jobId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId, jobId } = await context.params;
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const job = await getAgentJob(tenant, jobId);
    if (!job) return json({ ok: false, code: "agent_job_not_found" }, 404);
    const events = await listAgentJobEvents(tenant, jobId, 50);
    return json({ ok: true, job, events });
  } catch (error) {
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "agent_jobs_unavailable" }, 503);
    return json({ ok: false, code: "agent_job_read_failed", error: "任務讀取失敗。" }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string; jobId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId, jobId } = await context.params;
  const body = await readBody(request);
  const action = body && typeof body === "object" && "action" in (body as Record<string, unknown>) ? String((body as Record<string, unknown>).action) : "";
  if (action !== "cancel") return json({ ok: false, code: "invalid_agent_job_action" }, 400);
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const result = await cancelAgentJob(tenant, jobId);
    if (!result.cancelled) return json({ ok: false, code: "agent_job_not_cancellable", error: "任務不在可取消狀態（或不存在）。" }, 409);
    return json({ ok: true, cancelled: true, jobId });
  } catch (error) {
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "agent_jobs_unavailable" }, 503);
    return json({ ok: false, code: "agent_job_cancel_failed", error: "取消失敗。" }, 500);
  }
}
