import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { SubmissionNavigatorV2RepositoryError, SubmissionNavigatorV2StorageUnavailable, createSubmissionContextRun, getNavigatorStateV2, resolveConfirmedTopic } from "@/lib/submission-navigator-v2-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 32_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 32_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "submission_navigator_not_found" }, 404);
    const state = await getNavigatorStateV2(tenant);
    const confirmedTopic = await resolveConfirmedTopic(tenant);
    return json({ ok: true, state, confirmedTopic: confirmedTopic ? { studyVersionId: confirmedTopic.studyVersionId, runId: confirmedTopic.runId, candidate: confirmedTopic.candidate } : null });
  } catch (error) {
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorV2StorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "submission_navigator_v2_storage_unavailable", error: "投稿導航目前不可用。" }, 503);
    return json({ ok: false, code: "submission_navigator_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
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
    if (!record(parsed) || typeof parsed.targetYear !== "string" || !/^\d{4}$/.test(parsed.targetYear) || typeof parsed.idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,160}$/.test(parsed.idempotencyKey)) {
      return json({ ok: false, code: "invalid_context_request", error: "必須提供 4 位數目標年度與 idempotencyKey。" }, 400);
    }
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-navigator:context", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 10 });
    if (limited) return limited;
    const created = await createSubmissionContextRun({ tenant, userId: authenticated.session.user.id, targetYear: parsed.targetYear, idempotencyKey: parsed.idempotencyKey });
    const state = await getNavigatorStateV2(tenant);
    return json({ ok: true, contextRunId: created.id, idempotent: created.idempotent, context: created.context, state }, created.idempotent ? 200 : 201);
  } catch (error) {
    if (error instanceof SubmissionNavigatorV2RepositoryError) return json({ ok: false, code: error.code, error: "目前尚無已確認的正式選題；請先到選題實驗室完成並核准候選題目。" }, error.status);
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorV2StorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "submission_navigator_v2_storage_unavailable", error: "投稿導航目前不可用。" }, 503);
    return json({ ok: false, code: "submission_navigator_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}
