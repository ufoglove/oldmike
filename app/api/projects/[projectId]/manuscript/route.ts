import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as m from "@/lib/research-manuscript-repository";

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
  try { return NextResponse.json(await m.getManuscriptCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "全文寫作工作室讀取失敗。" }, { status: 422 }); }
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
      case "create": r = await m.createManuscript(tenant, { userId: uid, workingTitle: str(body.workingTitle), articleType: str(body.articleType) || undefined, writingMode: str(body.writingMode) || undefined, primaryRoute: str(body.primaryRoute) || undefined }); break;
      case "save-settings": r = await m.saveManuscriptSettings(tenant, { userId: uid, manuscriptId: str(body.manuscriptId), workingTitle: str(body.workingTitle) || undefined, articleType: str(body.articleType) || undefined, writingMode: str(body.writingMode) || undefined, currentStage: str(body.currentStage) || undefined }); break;
      case "save-section": r = await m.saveManuscriptSection(tenant, { userId: uid, manuscriptId: str(body.manuscriptId), sectionId: str(body.sectionId), body: str(body.body), sectionTitle: str(body.sectionTitle) || undefined, status: str(body.status) || undefined }); break;
      case "set-section-status": r = await m.setManuscriptSectionStatus(tenant, { userId: uid, manuscriptId: str(body.manuscriptId), sectionId: str(body.sectionId), status: str(body.status) }); break;
      default: return NextResponse.json({ ok: false, error: "manuscript_action_not_supported" }, { status: 422 });
    }
    if (r.ok === false) return NextResponse.json(r, { status: 422 });
    return NextResponse.json(r, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "全文寫作工作室操作失敗。" }, { status: 422 });
  }
}
