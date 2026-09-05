import { NextResponse } from "next/server";
import { isSafeProjectId } from "@/lib/project-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { resolveTenantUser, TenantProjectConflict, TenantStorageUnavailable, tenantProjectRepository } from "@/lib/tenant-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!isSafeProjectId(projectId)) return NextResponse.json({ ok: false, code: "invalid_project_id", error: "Project ID 格式不安全。" }, { status: 400 });
  try {
    const identity = await resolveTenantUser(auth.session.user.id);
    if (!identity) return NextResponse.json({ ok: false, code: "project_not_found" }, { status: 404 });
    const result = await tenantProjectRepository.restore(identity, projectId);
    if (!result.restored) return NextResponse.json({ ok: false, code: "project_not_found", error: "找不到可復原的專案（僅限自己的專案，且需在回收筒）。" }, { status: 404 });
    return NextResponse.json({ ok: true, restored: true, projectId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TenantStorageUnavailable) return NextResponse.json({ ok: false, code: "tenant_storage_not_ready" }, { status: 503 });
    if (error instanceof TenantProjectConflict) return NextResponse.json({ ok: false, code: "invalid_project_id", error: "Project ID 格式不安全。" }, { status: 400 });
    return NextResponse.json({ ok: false, code: "project_restore_failed", error: "復原失敗。" }, { status: 500 });
  }
}
