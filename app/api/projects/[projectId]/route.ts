import { NextResponse } from "next/server";
import { isSafeProjectId } from "@/lib/project-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { resolveTenantUser, TenantProjectRemoveFailed, TenantStorageUnavailable, tenantProjectRepository } from "@/lib/tenant-repository";

const RESET_CONFIRMATION_PHRASE = "RESET_PROJECT";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser(); if (!auth.ok) return auth.response;
  const { projectId } = await context.params; if (!isSafeProjectId(projectId)) return NextResponse.json({ ok: false, code: "invalid_project_id", error: "Project ID 格式不安全。" }, { status: 400 });
  try {
    const identity = await resolveTenantUser(auth.session.user.id); if (!identity) return NextResponse.json({ ok: false, code: "project_not_found" }, { status: 404 });
    const project = await tenantProjectRepository.get(identity, projectId); if (!project) return NextResponse.json({ ok: false, code: "project_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, source: "postgres", project, compatibilityWarnings: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof TenantStorageUnavailable) return NextResponse.json({ ok: false, code: "tenant_storage_not_ready" }, { status: 503 }); return NextResponse.json({ ok: false, code: "project_not_found" }, { status: 404 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser(); if (!auth.ok) return auth.response;
  const { projectId } = await context.params; if (!isSafeProjectId(projectId)) return NextResponse.json({ ok: false, code: "invalid_project_id", error: "Project ID 格式不安全。" }, { status: 400 });
  let body: { confirm?: string } = {};
  try { body = await request.json().catch(() => ({})) as { confirm?: string }; } catch { /* keep empty */ }
  if (body.confirm !== RESET_CONFIRMATION_PHRASE) return NextResponse.json({ ok: false, code: "reset_confirmation_required", error: "重置需要明確確認文字。" }, { status: 400 });
  try {
    const identity = await resolveTenantUser(auth.session.user.id); if (!identity) return NextResponse.json({ ok: false, code: "project_not_found" }, { status: 404 });
    const result = await tenantProjectRepository.remove(identity, projectId);
    if (!result.removed) return NextResponse.json({ ok: false, code: "project_not_found", error: "找不到可重置的專案。" }, { status: 404 });
    return NextResponse.json({ ok: true, removed: true, projectId, deleted: result.deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TenantStorageUnavailable) return NextResponse.json({ ok: false, code: "tenant_storage_not_ready" }, { status: 503 });
    if (error instanceof TenantProjectRemoveFailed) return NextResponse.json({ ok: false, code: error.code, error: "專案重置失敗：" + error.message }, { status: 409 });
    return NextResponse.json({ ok: false, code: "project_reset_failed", error: "專案重置失敗。" }, { status: 500 });
  }
}
