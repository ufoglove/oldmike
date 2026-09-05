import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { validateAnalysisCard, validateCitationSource, validateLiteratureLink, validateRqLinks } from "@/lib/research-project-contract";
import {
  ResearchProjectRepositoryError,
  ResearchProjectStorageUnavailable,
  removeLiteratureFromProject,
  saveAnalysisCard,
  setRqLinks,
  updateLiteratureLink,
  upsertCitationSource,
} from "@/lib/research-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request, maximumBytes = 64_000) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maximumBytes) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > maximumBytes) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

function literatureIdFrom(params: Record<string, string | undefined>): string | null {
  const value = params.literatureId;
  return value && /^[A-Za-z0-9_-]{8,100}$/.test(value) ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; literatureId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const params = await context.params;
    const literatureId = literatureIdFrom(params);
    if (!literatureId) return json({ ok: false, code: "invalid_literature_id" }, 400);
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, params.projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const body = await readBody(request);
    if (!record(body)) return json({ ok: false, code: "invalid_literature_link", error: "請求格式不正確。" }, 400);
    const link = validateLiteratureLink(body);
    if (!link.role?.length && !link.readingStatus && !link.evidenceStatus && link.priority === null && link.relevanceScore === null && link.notes === null) {
      return json({ ok: false, code: "invalid_literature_link", error: "沒有可更新的欄位。" }, 400);
    }
    const limited = await guardSensitiveAuthRateLimit({ scope: "literature:link", identifier: `${authenticated.session.user.id}:${params.projectId}`, windowSeconds: 600, max: 120 });
    if (limited) return limited;
    await updateLiteratureLink(tenant, { userId: authenticated.session.user.id, literatureId, link });
    return json({ ok: true });
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string; literatureId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const params = await context.params;
    const literatureId = literatureIdFrom(params);
    if (!literatureId) return json({ ok: false, code: "invalid_literature_id" }, 400);
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, params.projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const body = await readBody(request);
    if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_literature_action", error: "請求格式不正確。" }, 400);
    const userId = authenticated.session.user.id;
    const limited = await guardSensitiveAuthRateLimit({ scope: "literature:item", identifier: `${userId}:${params.projectId}`, windowSeconds: 600, max: 120 });
    if (limited) return limited;
    switch (body.action) {
      case "analysis-card": {
        const card = validateAnalysisCard(body.card);
        await saveAnalysisCard(tenant, { userId, literatureId, card });
        return json({ ok: true });
      }
      case "rq-links": {
        const links = validateRqLinks(body.links);
        await setRqLinks(tenant, { userId, literatureId, links });
        return json({ ok: true, count: links.length });
      }
      case "citation-source": {
        const citation = validateCitationSource(body.citation ?? { ...body, literatureId });
        await upsertCitationSource(tenant, { userId, citation });
        return json({ ok: true });
      }
      case "remove": {
        await removeLiteratureFromProject(tenant, { userId, literatureId });
        return json({ ok: true });
      }
      default:
        return json({ ok: false, code: "invalid_literature_action", error: "不支援的操作。" }, 422);
    }
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  if (error instanceof ResearchProjectRepositoryError) return json({ ok: false, code: error.code, error: "文獻操作未通過契約。" }, error.status);
  if (error instanceof ResearchProjectStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "research_project_storage_unavailable", error: "文獻與證據中心目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "research_project_storage_unavailable", error: "文獻與證據中心目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "literature_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
