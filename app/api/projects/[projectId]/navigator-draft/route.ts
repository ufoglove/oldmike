import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }) : null;
function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

async function readBody(request: Request, maximumBytes = 64_000) {
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
    if (!pool) throw new Error("storage_unavailable");
    const result = await pool.query(`SELECT payload, updated_at AS "updatedAt" FROM navigator_drafts WHERE workspace_id=$1 AND project_id=$2 AND draft_type='navigator_form' LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!result.rows[0]) return json({ ok: true, exists: false });
    return json({ ok: true, exists: true, form: result.rows[0].payload, updatedAt: text(result.rows[0].updatedAt) });
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
    if (!record(body) || !record(body.form)) return json({ ok: false, code: "invalid_navigator_draft", error: "請求格式不正確。" }, 400);
    const limited = await guardSensitiveAuthRateLimit({ scope: "navigator:draft", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 200 });
    if (limited) return limited;
    if (!pool) throw new Error("storage_unavailable");
    const payload = JSON.stringify(body.form).slice(0, 60_000);
    await pool.query(
      `INSERT INTO navigator_drafts (id,workspace_id,project_id,created_by_user_id,draft_type,payload,updated_at)
       VALUES ($1,$2,$3,$4,'navigator_form',$5::jsonb,now())
       ON CONFLICT (workspace_id, project_id, draft_type) DO UPDATE SET payload=$5::jsonb, updated_at=now()`,
      [`nd_${randomUUID()}`, tenant.workspaceId, tenant.projectId, authenticated.session.user.id, payload],
    );
    return json({ ok: true, saved: true });
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "navigator_draft_storage_unavailable", error: "草稿暫存目前不可用。" }, 503);
  if (error instanceof Error && error.message === "storage_unavailable") return json({ ok: false, code: "navigator_draft_storage_unavailable", error: "草稿暫存目前不可用。" }, 503);
  if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "navigator_draft_storage_unavailable", error: "草稿暫存目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : "unknown_error";
  return json({ ok: false, code: "navigator_draft_unavailable", error: `草稿暫存失敗（${detail}）。` }, 503);
}
