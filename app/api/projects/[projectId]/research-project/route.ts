import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { validateResearchProjectCreate } from "@/lib/research-project-contract";
import {
  ResearchProjectRepositoryError,
  ResearchProjectStorageUnavailable,
  computeNextBestAction,
  createResearchProjectFromRun,
  getEvidenceMatrix,
  getLiteratureSummary,
  getResearchProject,
  importNavigatorOutputLiterature,
} from "@/lib/research-project-repository";
import { createBlueprintDraft } from "@/lib/research-blueprint-repository";

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
    const project = await getResearchProject(tenant);
    if (!project) return json({ ok: true, exists: false });
    const [summary, matrix] = await Promise.all([getLiteratureSummary(tenant), getEvidenceMatrix(tenant)]);
    return json({ ok: true, exists: true, project, literatureSummary: summary, evidenceMatrix: matrix, nextBestAction: computeNextBestAction(summary, matrix) });
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
    if (!record(body)) return json({ ok: false, code: "invalid_research_project_request", error: "請求格式不正確。" }, 400);
    let parsed: ReturnType<typeof validateResearchProjectCreate>;
    try { parsed = validateResearchProjectCreate(body); } catch (error) { return json({ ok: false, code: "invalid_research_project_request", error: error instanceof Error ? error.message : "請求格式不正確。" }, 400); }
    const limited = await guardSensitiveAuthRateLimit({ scope: "research-project:create", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 10 });
    if (limited) return limited;
    const created = await createResearchProjectFromRun(tenant, { userId: authenticated.session.user.id, request: parsed });
    // 文獻匯入與藍圖重建：navigatorRunId（導航流程）或 inheritLatestRun（繼承/直接建立）皆觸發；
    // 重點：即使 run 原本已綁定（runAdded=false），只要這次請求帶 inheritLatestRun，
    // 也必須強制重建藍圖——否則「藍圖 GENERAL 但 rproj 已有 run」的專案永遠修不好（route_confirmed 死結）。
    const runAdded = Boolean((created as { runAdded?: boolean }).runAdded);
    const forceSync = Boolean(parsed.inheritLatestRun) || runAdded;
    if (parsed.navigatorRunId || forceSync) {
      try {
        await importNavigatorOutputLiterature(tenant, { userId: authenticated.session.user.id, runId: parsed.navigatorRunId ?? (await resolveLatestCompletedRunId(tenant)) ?? "" });
      } catch { /* 文獻匯入失敗不阻擋 */ }
    }
    if (!created.idempotent) {
      try {
        await createBlueprintDraft(tenant, { userId: authenticated.session.user.id });
      } catch { /* 藍圖初稿建立失敗不阻擋專案建立 */ }
    } else if (forceSync) {
      try {
        await createBlueprintDraft(tenant, { userId: authenticated.session.user.id }, { force: true });
      } catch { /* 藍圖重建失敗不阻擋 */ }
    }
    return json({ ok: true, researchProjectId: created.id, idempotent: created.idempotent, note: parsed.navigatorRunId ? "研究專案已建立，並從投稿導航繼承主題資料與文獻（研究藍圖初稿已自動建立）。" : "研究專案已建立（研究藍圖初稿已自動建立；尚未執行導航分析，可稍後補跑）。" }, created.idempotent ? 200 : 201);
  } catch (error) { return publicError(error); }
}

async function resolveLatestCompletedRunId(tenant: import("@/lib/research-repository").ResearchTenant): Promise<string | null> {
  // 繼承按鈕（inheritLatestRun）時 route 需要知道 runId 來匯入文獻；
  // 但 createResearchProjectFromRun 已把 run 綁定到 research_projects，直接讀取即可
  try {
    const { Pool } = await import("pg");
    const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }) : null;
    if (!pool) return null;
    try {
      const result = await pool.query(`SELECT submission_navigator_id AS "runId" FROM research_projects WHERE workspace_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const runId = result.rows[0] ? String((result.rows[0] as Record<string, unknown>).runId ?? "") : "";
      return runId || null;
    } finally { await pool.end(); }
  } catch { return null; }
}

function publicError(error: unknown) {
  if (error instanceof ResearchProjectRepositoryError) return json({ ok: false, code: error.code, error: "研究專案操作未通過契約。" }, error.status);
  if (error instanceof ResearchProjectStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "research_project_storage_unavailable", error: "研究專案目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "research_project_storage_unavailable", error: "研究專案目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "research_project_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
