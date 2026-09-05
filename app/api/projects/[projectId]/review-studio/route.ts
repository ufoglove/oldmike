import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  REVIEW_STUDIO_MAX_BODY_BYTES,
  ReviewStudioContractError,
  parseReviewStudioRequest,
  reviewRequestHash,
} from "@/lib/review-studio-contract";
import { ReviewStudioProviderError, runReviewStudio } from "@/lib/review-studio-provider";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import {
  ReviewStudioRepositoryError,
  ReviewStudioStorageUnavailable,
  approveReviewDocument,
  getReviewStudioOverview,
  promoteReviewDocument,
  replayReviewRun,
  resolveReviewSource,
  saveReviewRevision,
  saveReviewRun,
} from "@/lib/review-studio-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > REVIEW_STUDIO_MAX_BODY_BYTES) throw new ReviewStudioContractError("request_too_large", 413);
  const text = await request.text();
  if (!text || Buffer.byteLength(text, "utf8") > REVIEW_STUDIO_MAX_BODY_BYTES) throw new ReviewStudioContractError(text ? "request_too_large" : "invalid_request_body", text ? 413 : 400);
  try { return JSON.parse(text) as unknown; } catch { throw new ReviewStudioContractError("invalid_json"); }
}

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

function publicError(error: unknown) {
  if (error instanceof ReviewStudioContractError) return json({ ok: false, code: error.code, error: "審稿要求未通過老麥的固定資料契約。" }, error.status);
  if (error instanceof ReviewStudioProviderError) return json({ ok: false, code: error.code, error: "老麥目前無法安全完成審稿；來源與正式文件均未變更。" }, error.status);
  if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用；來源與正式文件均未變更。" }, error.status);
  if (error instanceof ReviewStudioRepositoryError) return json({ ok: false, code: error.code, error: "操作未通過專案、版本、循環或 Human Gate 契約。" }, error.status);
  if (error instanceof ReviewStudioStorageUnavailable || error instanceof ResearchStorageUnavailable || schemaUnavailable(error)) return json({ ok: false, code: "review_studio_storage_unavailable", error: "審稿版本資料目前不可用；來源未被覆寫。" }, 503);
  return json({ ok: false, code: "review_studio_unavailable", error: "老麥目前無法完成這項操作；來源未被覆寫。" }, 503);
}

async function authorize(projectId: string) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return { response: authenticated.response } as const;
  const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
  if (!tenant) return { response: json({ ok: false, code: "review_studio_not_found" }, 404) } as const;
  return { authenticated, tenant } as const;
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    return json({ ok: true, workspace: await getReviewStudioOverview(authorized.tenant) });
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const parsed = parseReviewStudioRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: `review-studio:${parsed.operation}`, identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: parsed.operation === "RUN_REVIEW" ? 8 : 24 });
    if (limited) return limited;
    if (parsed.operation === "RUN_REVIEW") {
      const replay = await replayReviewRun(authorized.tenant, parsed.idempotencyKey, reviewRequestHash(parsed));
      if (replay) return json({ ok: true, review: replay });
      const resolved = await resolveReviewSource(authorized.tenant, parsed);
      const route = resolveModelRoute({ modeProfile: parsed.modeProfile, operation: "REVIEW_STUDIO" });
      const result = await runReviewStudio({ request: resolved, actorId: authorized.authenticated.session.user.id, route });
      const saved = await saveReviewRun({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: resolved, result });
      return json({ ok: true, review: saved }, saved.idempotent ? 200 : 201);
    }
    if (parsed.operation === "SAVE_REVISION") {
      const revision = await saveReviewRevision({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed });
      return json({ ok: true, revision }, revision.idempotent ? 200 : 201);
    }
    if (parsed.operation === "APPROVE_DOCUMENT") {
      const approval = await approveReviewDocument({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed });
      return json({ ok: true, approval }, approval.idempotent ? 200 : 201);
    }
    const promotion = await promoteReviewDocument({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed });
    return json({ ok: true, promotion }, promotion.idempotent ? 200 : 201);
  } catch (error) { return publicError(error); }
}
