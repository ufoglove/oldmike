import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { resolveTenantUser, TenantStorageUnavailable, tenantProjectRepository } from "@/lib/tenant-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const identity = await resolveTenantUser(auth.session.user.id);
    if (!identity) return NextResponse.json({ ok: true, projects: [] });
    const projects = await tenantProjectRepository.listTrashed(identity);
    return NextResponse.json({ ok: true, source: "postgres", projects, compatibilityWarnings: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TenantStorageUnavailable) return NextResponse.json({ ok: false, code: "tenant_storage_not_ready" }, { status: 503 });
    return NextResponse.json({ ok: false, code: "trash_list_failed", error: "回收筒讀取失敗。" }, { status: 500 });
  }
}
