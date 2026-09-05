import { NextResponse } from "next/server";
import { isSafeProjectId } from "@/lib/project-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { resolveTenantUser, TenantProjectConflict, TenantStorageUnavailable, tenantProjectRepository } from "@/lib/tenant-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TEXT_FIELDS = ["currentLocation", "primaryGoal", "fundingRoute", "publicationRoute"] as const;

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 64_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 64_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!isSafeProjectId(projectId)) return json({ ok: false, code: "invalid_project_id", error: "Project ID 格式不安全。" }, 400);
  const body = await readBody(request);
  if (!record(body) || !record(body.fields)) return json({ ok: false, code: "invalid_save_request", error: "儲存請求格式不正確。" }, 400);
  const rawFields = body.fields;
  const fields: Record<string, unknown> = {};
  for (const key of ALLOWED_TEXT_FIELDS) {
    if (rawFields[key] !== undefined) fields[key] = rawFields[key] === null ? null : String(rawFields[key]).slice(0, 1200);
  }
  if (rawFields.draft !== undefined) {
    fields.draft = record(rawFields.draft) ? rawFields.draft : {};
  }
  if (Object.keys(fields).length === 0) return json({ ok: false, code: "no_savable_fields", error: "沒有可儲存的欄位。" }, 400);
  const expectedVersion = body.expectedVersion === null || body.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
  try {
    const identity = await resolveTenantUser(auth.session.user.id);
    if (!identity) return json({ ok: false, code: "project_not_found" }, 404);
    const result = await tenantProjectRepository.saveProjectMeta(identity, projectId, { fields, expectedVersion });
    if (result.conflict) return json({ ok: false, code: "version_conflict", error: "此專案已在其他分頁被儲存（版本 " + String(result.serverVersion ?? 0) + "）。請選擇重新讀取或以新版本覆寫。", serverVersion: result.serverVersion ?? 0 }, 409);
    if (!result.saved) return json({ ok: false, code: "project_not_found", error: "找不到可儲存的專案（僅限自己的專案）。" }, 404);
    return json({ ok: true, projectId, version: result.version, idempotent: result.idempotent, savedAt: result.savedAt }, result.idempotent ? 200 : 200);
  } catch (error) {
    if (error instanceof TenantStorageUnavailable) return json({ ok: false, code: "tenant_storage_not_ready" }, 503);
    if (error instanceof TenantProjectConflict) return json({ ok: false, code: "invalid_project_id" }, 400);
    return json({ ok: false, code: "project_save_failed", error: "儲存失敗。" }, 500);
  }
}
