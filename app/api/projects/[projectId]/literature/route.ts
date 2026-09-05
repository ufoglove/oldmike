import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { validateLiteratureItem, validateLiteratureLink } from "@/lib/research-project-contract";
import {
  ResearchProjectRepositoryError,
  ResearchProjectStorageUnavailable,
  addLiteratureToProject,
  ensureNavigatorLiteratureImported,
  getEvidenceMatrix,
  listProjectLiterature,
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

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const url = new URL(request.url);
    const filter = {
      role: url.searchParams.get("role") || undefined,
      readingStatus: url.searchParams.get("reading") || undefined,
      evidenceStatus: url.searchParams.get("evidence") || undefined,
      zotero: url.searchParams.get("zotero") || undefined,
    };
    const [items, matrix] = await Promise.all([listProjectLiterature(tenant, filter), getEvidenceMatrix(tenant)]);
    // 自動補匯入導航文獻（早期 bug 導致 import 失敗的既有專案；無 run 或已有文獻時自動跳過）
    if (items.length === 0) {
      try { await ensureNavigatorLiteratureImported(tenant, { userId: authenticated.session.user.id }); } catch { /* 補匯入失敗不阻擋文獻載入 */ }
    }
    return json({ ok: true, items, matrix, filter });
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
    if (!record(body)) return json({ ok: false, code: "invalid_literature_item", error: "請求格式不正確。" }, 400);
    let item;
    try { item = validateLiteratureItem(body); } catch (error) { return json({ ok: false, code: "invalid_literature_item", error: error instanceof Error ? error.message : "文獻資料不正確。" }, 400); }
    const link = validateLiteratureLink(record(body.link) ? body.link : {});
    const limited = await guardSensitiveAuthRateLimit({ scope: "literature:add", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 60 });
    if (limited) return limited;
    const created = await addLiteratureToProject(tenant, { userId: authenticated.session.user.id, item, link });
    return json({ ...created }, 201);
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
