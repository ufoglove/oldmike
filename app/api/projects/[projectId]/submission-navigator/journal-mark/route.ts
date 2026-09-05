import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { SubmissionNavigatorV2RepositoryError, SubmissionNavigatorV2StorageUnavailable, getNavigatorStateV2, markJournal } from "@/lib/submission-navigator-v2-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARK_TYPES = ["CANDIDATE", "TARGET", "COMPARE"] as const;

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 16_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 16_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "submission_navigator_not_found" }, 404);
    const parsed = await readBody(request);
    if (!record(parsed) || typeof parsed.runId !== "string" || typeof parsed.journalName !== "string" || typeof parsed.markType !== "string" || !MARK_TYPES.includes(parsed.markType as (typeof MARK_TYPES)[number])) {
      return json({ ok: false, code: "invalid_mark_request", error: "必須提供 runId、journalName 與 markType（CANDIDATE / TARGET / COMPARE）。" }, 400);
    }
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-navigator:journal-mark", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 30 });
    if (limited) return limited;
    const marked = await markJournal({ tenant, userId: authenticated.session.user.id, runId: parsed.runId, journalName: parsed.journalName.slice(0, 500), markType: parsed.markType as (typeof MARK_TYPES)[number] });
    const state = await getNavigatorStateV2(tenant);
    return json({ ok: true, markId: marked.id, idempotent: marked.idempotent, state }, marked.idempotent ? 200 : 201);
  } catch (error) {
    if (error instanceof SubmissionNavigatorV2RepositoryError) return json({ ok: false, code: error.code, error: "期刊標記未通過契約。" }, error.status);
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorV2StorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "journal_mark_storage_unavailable", error: "期刊標記目前不可用。" }, 503);
    return json({ ok: false, code: "journal_mark_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}
