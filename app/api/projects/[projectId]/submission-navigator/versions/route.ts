import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { SubmissionNavigatorV2RepositoryError, SubmissionNavigatorV2StorageUnavailable, createTopicVersion } from "@/lib/submission-navigator-v2-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max = 8_000): string { return typeof value === "string" ? value.slice(0, max) : ""; }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 200_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 200_000) return null;
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
    if (!record(parsed) || typeof parsed.runId !== "string" || typeof parsed.versionKey !== "string" || typeof parsed.titleZh !== "string" || !parsed.titleZh.trim()) {
      return json({ ok: false, code: "invalid_version_request", error: "必須提供 runId、versionKey 與中文題目。" }, 400);
    }
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-navigator:version", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 20 });
    if (limited) return limited;
    const created = await createTopicVersion({
      tenant, userId: authenticated.session.user.id, runId: parsed.runId, versionKey: parsed.versionKey,
      titleZh: text(parsed.titleZh, 300), titleEn: typeof parsed.titleEn === "string" ? text(parsed.titleEn, 400) : null,
      gap: typeof parsed.gap === "string" ? text(parsed.gap) : null, contribution: typeof parsed.contribution === "string" ? text(parsed.contribution) : null,
      method: typeof parsed.method === "string" ? text(parsed.method) : null,
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map((item) => text(item, 2_000)).filter(Boolean).slice(0, 10) : [],
      abstract: typeof parsed.abstract === "string" ? text(parsed.abstract, 6_000) : null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((item) => text(item, 100)).filter(Boolean).slice(0, 8) : [],
      snapshot: record(parsed.snapshot) ? parsed.snapshot : {},
    });
    return json({ ok: true, versionId: created.id, idempotent: created.idempotent }, created.idempotent ? 200 : 201);
  } catch (error) {
    if (error instanceof SubmissionNavigatorV2RepositoryError) return json({ ok: false, code: error.code, error: "版本建立未通過契約。" }, error.status);
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorV2StorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "submission_navigator_v2_storage_unavailable", error: "投稿導航目前不可用。" }, 503);
    return json({ ok: false, code: "submission_navigator_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}
