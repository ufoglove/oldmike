import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { validateSectionEdit } from "@/lib/research-blueprint-contract";
import {
  ResearchBlueprintRepositoryError,
  ResearchBlueprintStorageUnavailable,
  approveBlueprint,
  compareBlueprintVersions,
  createBlueprintDraft,
  editBlueprintSection,
  getBlueprint,
  linkBlueprintEvidence,
  regenerateBlueprintSection,
  verifyBlueprint,
} from "@/lib/research-blueprint-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request, maximumBytes = 128_000) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maximumBytes) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > maximumBytes) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const view = await getBlueprint(tenant);
    return json({ ...view });
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const body = await readBody(request);
    if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_blueprint_action", error: "請求格式不正確。" }, 400);
    const userId = authenticated.session.user.id;
    const limited = await guardSensitiveAuthRateLimit({ scope: "blueprint:action", identifier: `${userId}:${projectId}`, windowSeconds: 600, max: 120 });
    if (limited) return limited;
    switch (body.action) {
      case "draft": {
        const created = await createBlueprintDraft(tenant, { userId });
        return json({ ...created });
      }
      case "edit": {
        const edit = validateSectionEdit(body.edit);
        const result = await editBlueprintSection(tenant, { userId, edit });
        return json({ ...result });
      }
      case "regenerate": {
        const section = typeof body.section === "string" ? body.section : "";
        if (!section) return json({ ok: false, code: "invalid_blueprint_section" }, 400);
        const result = await regenerateBlueprintSection(tenant, { userId, section: section as Parameters<typeof regenerateBlueprintSection>[1]["section"] });
        return json({ ...result });
      }
      case "verify": {
        const result = await verifyBlueprint(tenant, { userId });
        return json({ ...result });
      }
      case "approve": {
        const result = await approveBlueprint(tenant, { userId });
        return json({ ...result }, result.ok ? 200 : 422);
      }
      case "compare": {
        const fromVersion = typeof body.fromVersion === "number" ? body.fromVersion : 0;
        const toVersion = typeof body.toVersion === "number" ? body.toVersion : 0;
        if (!fromVersion || !toVersion) return json({ ok: false, code: "invalid_blueprint_versions" }, 400);
        const result = await compareBlueprintVersions(tenant, { userId, fromVersion, toVersion });
        return json({ ...result });
      }
      case "link-evidence": {
        const links = Array.isArray(body.links) ? body.links as { targetType?: string; targetRef?: string; literatureId?: string; supportedSection?: string; supportedClaim?: string }[] : [];
        const result = await linkBlueprintEvidence(tenant, { userId, links: links.filter((l) => typeof l.targetType === "string" && typeof l.literatureId === "string").map((l) => ({ targetType: String(l.targetType), targetRef: l.targetRef ? String(l.targetRef) : undefined, literatureId: String(l.literatureId), supportedSection: l.supportedSection ? String(l.supportedSection) : undefined, supportedClaim: l.supportedClaim ? String(l.supportedClaim) : undefined })) });
        return json({ ...result });
      }
      default:
        return json({ ok: false, code: "invalid_blueprint_action", error: "不支援的操作。" }, 422);
    }
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  if (error instanceof ResearchBlueprintRepositoryError) {
    const friendly: Record<string, string> = {
      research_project_required: "請先在投稿導航完成分析並按「建立研究專案」，再建立研究藍圖。",
      blueprint_section_approved_locked: "此區塊已核准，無法直接覆蓋；請先建立新版本再編輯。",
      blueprint_version_missing: "藍圖尚未建立任何版本。",
      blueprint_version_not_found: "指定的版本不存在。",
      research_project_not_found: "研究專案不存在。",
    };
    return json({ ok: false, code: error.code, error: friendly[error.code] ?? "研究藍圖操作未通過契約。" }, error.status);
  }
  if (error instanceof ResearchBlueprintStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "research_blueprint_storage_unavailable", error: "研究藍圖目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "research_blueprint_storage_unavailable", error: "研究藍圖目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "blueprint_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
