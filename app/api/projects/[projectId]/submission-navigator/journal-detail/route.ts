import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import { JournalDetailContractError, parseJournalDetailRequest } from "@/lib/submission-journal-detail-contract";
import { JournalDetailProviderError, runJournalDetailWithOpenClaw } from "@/lib/submission-journal-detail-provider";
import { SubmissionNavigatorV2RepositoryError, SubmissionNavigatorV2StorageUnavailable, getNavigatorStateV2, getRunTopicContext, saveJournalDetail } from "@/lib/submission-navigator-v2-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 64_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 64_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "submission_navigator_not_found" }, 404);
    const parsed = parseJournalDetailRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-navigator:journal-detail", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 12 });
    if (limited) return limited;
    const topicContext = await getRunTopicContext(tenant, parsed.runId);
    if (!topicContext) return json({ ok: false, code: "journal_detail_run_not_found", error: "找不到指定的導航分析（runId 無效）。" }, 404);
    const route = { ...resolveModelRoute({ modeProfile: "AUTO", operation: "SUBMISSION_NAVIGATOR" }), timeoutMs: 900_000, inputLimitBytes: 256_000, outputLimitBytes: 300_000 };
    const detail = await runJournalDetailWithOpenClaw({ request: { ...parsed, topicContext }, actorId: authenticated.session.user.id, route });
    const lastVerifiedAt = typeof detail.last_verified_at === "string" ? detail.last_verified_at : new Date().toISOString();
    const verificationStatus = typeof detail.verification_status === "string" ? detail.verification_status : "unverified";
    await saveJournalDetail({ tenant, userId: authenticated.session.user.id, runId: parsed.runId, journalName: parsed.journalName, detail, verificationStatus, lastVerifiedAt });
    const state = await getNavigatorStateV2(tenant);
    return json({ ok: true, detail, lastVerifiedAt, verificationStatus, state });
  } catch (error) {
    if (error instanceof JournalDetailContractError) return json({ ok: false, code: error.code, error: "期刊查證要求未通過契約。" }, error.status);
    if (error instanceof JournalDetailProviderError) return json({ ok: false, code: error.code, error: "期刊查證目前無法取得；未寫入任何資料。" }, error.status);
    if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用。" }, error.status);
    if (error instanceof SubmissionNavigatorV2RepositoryError) return json({ ok: false, code: error.code, error: "期刊查證未通過專案契約。" }, error.status);
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorV2StorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "journal_detail_storage_unavailable", error: "期刊查證目前不可用。" }, 503);
    return json({ ok: false, code: "journal_detail_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}
