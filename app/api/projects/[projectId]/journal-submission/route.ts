import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  JOURNAL_SUBMISSION_MAX_BODY_BYTES,
  JournalSubmissionContractError,
  journalSubmissionRequestHash,
  parseJournalSubmissionRequest,
} from "@/lib/journal-submission-contract";
import { JournalSubmissionProviderError, runJournalSubmissionStudio } from "@/lib/journal-submission-provider";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import {
  JournalSubmissionRepositoryError,
  JournalSubmissionStorageUnavailable,
  approveSubmissionPackage,
  finalizeSubmissionPackage,
  getJournalSubmissionOverview,
  replaySubmissionCheck,
  resolveSubmissionSource,
  saveCoverLetterVersion,
  saveSubmissionCheck,
} from "@/lib/journal-submission-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request) { const length = Number(request.headers.get("content-length") || "0"); if (Number.isFinite(length) && length > JOURNAL_SUBMISSION_MAX_BODY_BYTES) throw new JournalSubmissionContractError("request_too_large", 413); const body = await request.text(); if (!body || Buffer.byteLength(body, "utf8") > JOURNAL_SUBMISSION_MAX_BODY_BYTES) throw new JournalSubmissionContractError(body ? "request_too_large" : "invalid_request_body", body ? 413 : 400); try { return JSON.parse(body) as unknown; } catch { throw new JournalSubmissionContractError("invalid_json"); } }
function schemaUnavailable(error: unknown) { const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : ""; return code === "42P01" || code === "42703" || code === "3D000"; }
function publicError(error: unknown) {
  if (error instanceof JournalSubmissionContractError) return json({ ok: false, code: error.code, error: "投稿要求未通過老麥的固定資料契約。" }, error.status);
  if (error instanceof JournalSubmissionProviderError) return json({ ok: false, code: error.code, error: "老麥目前無法安全完成投稿核對；來源與正式文件均未變更。" }, error.status);
  if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用；來源與正式文件均未變更。" }, error.status);
  if (error instanceof JournalSubmissionRepositoryError) return json({ ok: false, code: error.code, error: "操作未通過專案、版本、來源或 Human Gate 契約。" }, error.status);
  if (error instanceof JournalSubmissionStorageUnavailable || error instanceof ResearchStorageUnavailable || schemaUnavailable(error)) return json({ ok: false, code: "journal_submission_storage_unavailable", error: "投稿工作室目前不可用；來源未被覆寫。" }, 503);
  return json({ ok: false, code: "journal_submission_unavailable", error: "老麥目前無法完成這項操作；正式資料未被變更。" }, 503);
}
async function authorize(projectId: string) { const authenticated = await requireAuthenticatedUser(); if (!authenticated.ok) return { response: authenticated.response } as const; const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); if (!tenant) return { response: json({ ok: false, code: "journal_submission_not_found" }, 404) } as const; return { authenticated, tenant } as const; }

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await context.params; const authorized = await authorize(projectId); if ("response" in authorized) return authorized.response; return json({ ok: true, workspace: await getJournalSubmissionOverview(authorized.tenant) }); }
  catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params; const authorized = await authorize(projectId); if ("response" in authorized) return authorized.response;
    const parsed = parseJournalSubmissionRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: `journal-submission:${parsed.operation}`, identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: parsed.operation === "RUN_SUBMISSION_CHECK" ? 6 : 20 });
    if (limited) return limited;
    if (parsed.operation === "RUN_SUBMISSION_CHECK") {
      const replay = await replaySubmissionCheck(authorized.tenant, parsed.idempotencyKey, journalSubmissionRequestHash(parsed)); if (replay) return json({ ok: true, analysis: replay });
      const resolved = await resolveSubmissionSource(authorized.tenant, parsed); const route = resolveModelRoute({ modeProfile: parsed.modeProfile, operation: "JOURNAL_SUBMISSION" }); const result = await runJournalSubmissionStudio({ request: resolved, actorId: authorized.authenticated.session.user.id, route }); const analysis = await saveSubmissionCheck({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: resolved, result }); return json({ ok: true, analysis }, analysis.idempotent ? 200 : 201);
    }
    if (parsed.operation === "SAVE_COVER_LETTER") { const coverLetter = await saveCoverLetterVersion({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed }); return json({ ok: true, coverLetter }, coverLetter.idempotent ? 200 : 201); }
    if (parsed.operation === "APPROVE_SUBMISSION") { const approval = await approveSubmissionPackage({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed }); return json({ ok: true, approval }, approval.idempotent ? 200 : 201); }
    const submission = await finalizeSubmissionPackage({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed }); return json({ ok: true, submission }, submission.idempotent ? 200 : 201);
  } catch (error) { return publicError(error); }
}
