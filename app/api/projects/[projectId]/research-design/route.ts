import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { validateDesignEvidenceLink, validateDesignSectionEdit, validateDesignSelection } from "@/lib/research-design-contract";
import {
  ResearchDesignRepositoryError,
  ResearchDesignStorageUnavailable,
  compareDesignVersions,
  draftDesignCandidates,
  editDesignSection,
  getResearchDesign,
  linkDesignEvidence,
  lockResearchDesign,
  runDesignAlignment,
  updateDesignSelection,
  writebackBlueprintDesignLocked,
} from "@/lib/research-design-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request, maximumBytes = 256_000) {
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
    const view = await getResearchDesign(tenant, { userId: authenticated.session.user.id });
    return json(view);
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
    if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_design_action", error: "請求格式不正確。" }, 400);
    const action = body.action;
    const userId = authenticated.session.user.id;
    const limited = await guardSensitiveAuthRateLimit({ scope: "research-design", identifier: `${userId}:${projectId}`, windowSeconds: 600, max: 180 });
    if (limited) return limited;
    switch (action) {
      case "draft": {
        const result = await draftDesignCandidates(tenant, { userId });
        return json({ ...result });
      }
      case "edit": {
        let edit;
        try { edit = validateDesignSectionEdit(body.edit); } catch (error) { return json({ ok: false, code: "invalid_design_section", error: error instanceof Error ? error.message : "區塊資料不正確。" }, 400); }
        const result = await editDesignSection(tenant, { userId, edit });
        return json({ ...result });
      }
      case "select-design": {
        let selection;
        try { selection = validateDesignSelection(body.selection ?? body); } catch (error) { return json({ ok: false, code: "invalid_design_selection", error: error instanceof Error ? error.message : "選擇資料不正確。" }, 400); }
        const result = await updateDesignSelection(tenant, { userId, ...selection });
        return json({ ...result });
      }
      case "link-evidence": {
        const links = Array.isArray(body.links) ? body.links.map((l: unknown) => { try { return validateDesignEvidenceLink(l); } catch { return null; } }).filter((l): l is ReturnType<typeof validateDesignEvidenceLink> => Boolean(l)) : [];
        const result = await linkDesignEvidence(tenant, { userId, links });
        return json({ ...result });
      }
      case "alignment": {
        const result = await runDesignAlignment(tenant, { userId });
        return json({ ...result });
      }
      case "writeback": {
        const result = await writebackBlueprintDesignLocked(tenant, { userId });
        return json({ ...result });
      }
      case "lock": {
        const result = await lockResearchDesign(tenant, { userId });
        return json({ ...result });
      }
      case "compare": {
        const fromVersion = Number(body.fromVersion); const toVersion = Number(body.toVersion);
        if (!Number.isInteger(fromVersion) || !Number.isInteger(toVersion)) return json({ ok: false, code: "invalid_version" }, 400);
        const result = await compareDesignVersions(tenant, { userId, fromVersion, toVersion });
        return json({ ...result });
      }
      default:
        return json({ ok: false, code: "invalid_design_action", error: "不支援的操作。" }, 422);
    }
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  if (error instanceof ResearchDesignRepositoryError) return json({ ok: false, code: error.code, error: "研究設計操作未通過契約。" }, error.status);
  if (error instanceof ResearchDesignStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "research_design_storage_unavailable", error: "研究設計實驗室目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "research_design_storage_unavailable", error: "研究設計實驗室目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "research_design_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
