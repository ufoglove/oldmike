import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { getOverviewProgress } from "@/lib/overview-progress-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const user = authenticated.session.user;
  const { projectId } = await context.params;
  let tenant;
  try {
    tenant = await resolveResearchTenant(user.id, projectId);
  } catch (error) {
    if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const view = await getOverviewProgress(tenant);
    return NextResponse.json(view, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "研究路徑進度讀取失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
