import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import {
  FoundationRuntimeContractError,
  PROJECT_CREATE_MAX_BODY_BYTES,
  buildCreatedProjectSummary,
  parseProjectCreateRequest,
  readBoundedJson,
} from "@/lib/foundation-runtime-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  TenantProjectConflict,
  TenantProjectUnauthorized,
  TenantStorageUnavailable,
  resolveTenantUser,
  tenantProjectRepository,
} from "@/lib/tenant-repository";

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function storageBlocked() {
  return noStore({ ok: false, code: "tenant_storage_not_ready", error: "正式專案資料庫契約目前不可用；未建立專案。" }, 503);
}

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const identity = await resolveTenantUser(auth.session.user.id);
    if (!identity) return noStore({ ok: false, code: "workspace_not_provisioned", error: "個人 Workspace 尚未完成配置。" }, 503);
    const projects = await tenantProjectRepository.list(identity);
    return noStore({ ok: true, source: "postgres", demo: false, projects, compatibilityWarnings: [] }, 200);
  } catch (error) {
    if (error instanceof TenantStorageUnavailable) return storageBlocked();
    return noStore({ ok: false, code: "project_source_unavailable", error: "目前無法取得個人專案索引。" }, 503);
  }
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return noStore({ ok: false, code: "origin_rejected", error: "Request origin was rejected." }, 403);
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const parsed = parseProjectCreateRequest(await readBoundedJson(request, PROJECT_CREATE_MAX_BODY_BYTES));
    const identity = await resolveTenantUser(auth.session.user.id);
    if (!identity) return storageBlocked();
    if (!(await tenantProjectRepository.canCreate(identity))) return noStore({ ok: false, code: "project_create_unauthorized", error: "目前帳戶不能在此 Workspace 建立專案。" }, 403);
    const created = await tenantProjectRepository.create({ identity, projectId: parsed.projectId, previewHash: parsed.previewHash, intake: parsed.intake });
    const project = buildCreatedProjectSummary(parsed.intake, created.intakePersistence);
    return noStore({ ok: true, project, idempotent: created.idempotent, compatibilityWarnings: [] }, created.idempotent ? 200 : 201);
  } catch (error) {
    if (error instanceof FoundationRuntimeContractError) return noStore({ ok: false, code: error.code, error: "建立專案請求未通過固定契約。", ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) }, error.status);
    if (error instanceof TenantProjectUnauthorized) return noStore({ ok: false, code: error.code, error: "目前帳戶不能在此 Workspace 建立專案。" }, 403);
    if (error instanceof TenantProjectConflict) return noStore({ ok: false, code: error.code, error: "Project ID 已綁定不同的確認內容；未覆寫既有專案。" }, 409);
    if (error instanceof TenantStorageUnavailable) return storageBlocked();
    return noStore({ ok: false, code: "project_create_failed", error: "專案交易未完成；未顯示假成功。" }, 503);
  }
}
