import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  GapNoveltyRepositoryError,
  GapNoveltyStorageUnavailable,
  analyzeClosestStudies,
  assessNoveltyAndSaturation,
  createGapNoveltyAnalysis,
  getGapNovelty,
  linkGapEvidence,
  runGapSearchTask,
  saveGapClaims,
  validateGapNovelty,
  writebackBlueprintV2,
} from "@/lib/gap-novelty-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

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
    const view = await getGapNovelty(tenant);
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
    if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_gap_novelty_action", error: "請求格式不正確。" }, 400);
    const userId = authenticated.session.user.id;
    const limited = await guardSensitiveAuthRateLimit({ scope: "gap-novelty:action", identifier: `${userId}:${projectId}`, windowSeconds: 600, max: 120 });
    if (limited) return limited;
    switch (body.action) {
      case "draft": {
        const created = await createGapNoveltyAnalysis(tenant, { userId });
        return json({ ...created });
      }
      case "search-run": {
        const taskId = text(body.taskId);
        if (!taskId) return json({ ok: false, code: "invalid_search_task" }, 400);
        const result = await runGapSearchTask(tenant, { userId, taskId });
        return json({ ...result });
      }
      case "save-gap-claims": {
        const claims = Array.isArray(body.claims) ? body.claims as { gapId?: string; gapType?: string; claim?: string; validationStatus?: string; evidenceStrength?: string; scope?: string }[] : [];
        const normalized = claims.filter((c) => typeof c.gapId === "string" && typeof c.gapType === "string" && typeof c.claim === "string").map((c) => ({ gapId: String(c.gapId), gapType: String(c.gapType) as Parameters<typeof saveGapClaims>[1]["claims"][number]["gapType"], claim: String(c.claim).slice(0, 5000), validationStatus: c.validationStatus ? String(c.validationStatus) : undefined, evidenceStrength: c.evidenceStrength ? String(c.evidenceStrength) : undefined, scope: c.scope ? String(c.scope) : undefined }));
        if (!normalized.length) return json({ ok: false, code: "invalid_gap_claims" }, 400);
        const result = await saveGapClaims(tenant, { userId, claims: normalized });
        return json({ ...result });
      }
      case "link-evidence": {
        const gapId = text(body.gapId);
        const literatureIds = Array.isArray(body.literatureIds) ? (body.literatureIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
        if (!gapId || !literatureIds.length) return json({ ok: false, code: "invalid_gap_evidence" }, 400);
        const result = await linkGapEvidence(tenant, { userId, gapId, literatureIds });
        return json({ ...result });
      }
      case "analyze-closest": {
        const result = await analyzeClosestStudies(tenant, { userId });
        return json({ ...result });
      }
      case "assess-novelty": {
        const result = await assessNoveltyAndSaturation(tenant, { userId });
        return json({ ...result });
      }
      case "writeback-v2": {
        const result = await writebackBlueprintV2(tenant, { userId });
        return json({ ...result });
      }
      case "validate": {
        const result = await validateGapNovelty(tenant, { userId });
        return json({ ...result }, result.ok ? 200 : 422);
      }
      default:
        return json({ ok: false, code: "invalid_gap_novelty_action", error: "不支援的操作。" }, 422);
    }
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  if (error instanceof GapNoveltyRepositoryError) {
    const friendly: Record<string, string> = {
      blueprint_required: "請先建立研究藍圖（v1），再建立 Gap 與新穎性分析。",
      research_project_required: "請先建立正式研究專案（投稿導航 → 建立研究專案）。",
      gap_novelty_analysis_required: "請先根據研究藍圖建立 Gap 與新穎性分析（依研究藍圖建立搜尋計畫）。",
      gap_claim_supported_without_evidence: "Gap Claim 標記 SUPPORTED 前必須至少連結一筆 Evidence（文獻／引用）。",
      search_task_not_found: "指定的搜尋任務不存在。",
    };
    return json({ ok: false, code: error.code, error: friendly[error.code] ?? "Gap 與新穎性操作未通過契約。" }, error.status);
  }
  if (error instanceof GapNoveltyStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "gap_novelty_storage_unavailable", error: "Gap 與新穎性目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "gap_novelty_storage_unavailable", error: "Gap 與新穎性目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "gap_novelty_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
