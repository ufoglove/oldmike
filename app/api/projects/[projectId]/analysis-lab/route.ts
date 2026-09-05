import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as a from "@/lib/research-analysis-repository";

export const runtime = "nodejs";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
const str = (v: unknown): string => typeof v === "string" ? v : "";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await a.getAnalysisCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "分析實驗室讀取失敗。" }, { status: 422 }); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = str(body.action);
  const uid = authenticated.session.user.id;
  try {
    let r: Record<string, unknown>;
    switch (action) {
      case "save-plan": r = await a.saveAnalysisPlan(tenant, { userId: uid, planId: str(body.planId) || undefined, method: str(body.method), parameters: obj(body.parameters), engine: str(body.engine) || undefined }); break;
      case "lock-plan": r = await a.lockAnalysisPlan(tenant, { userId: uid, planId: str(body.planId) }); break;
      case "register-run": r = await a.registerAnalysisRun(tenant, { userId: uid, datasetId: str(body.datasetId), analysisPlanId: str(body.analysisPlanId), note: str(body.note) || undefined }); break;
      case "save-draft": r = await a.saveAnalysisResultDraft(tenant, { userId: uid, title: str(body.title), body: str(body.body), mode: str(body.mode) || undefined }); break;
      default: return NextResponse.json({ ok: false, error: "analysis_action_not_supported" }, { status: 422 });
    }
    if (r.ok === false) return NextResponse.json(r, { status: 422 });
    return NextResponse.json(r, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "分析實驗室操作失敗。" }, { status: 422 });
  }
}
