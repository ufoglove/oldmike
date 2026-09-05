import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { SubmissionNavigatorStorageUnavailable, confirmNavigatorRelease, getNavigatorOverview, readinessFromOutput } from "@/lib/submission-navigator-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 32_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 32_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "submission_gate_not_found" }, 404);
    const overview = await getNavigatorOverview(tenant);
    const latest = overview.latestOutput;
    if (!latest) {
      return json({ ok: true, readiness: { submissionReady: false, hasRun: false, fatalOpen: ["尚未執行投稿與計畫導航"], majorOpen: [], officialDeadlineVerified: false, internalDeadline: null, lastVerifiedAt: null }, routes: [] });
    }
    const readiness = readinessFromOutput(latest);
    const internalDeadline = overview.runs[0]?.targetYear ? null : null;
    const complianceRows = Array.isArray(latest.compliance_matrix) ? latest.compliance_matrix : [];
    const fatalItems = complianceRows.filter((item) => item && typeof item === "object" && String((item as Record<string, unknown>).severity) === "fatal" && String((item as Record<string, unknown>).status) !== "met" && String((item as Record<string, unknown>).status) !== "not_applicable");
    return json({
      ok: true,
      readiness: {
        hasRun: true,
        submissionReady: readiness.submissionReady,
        fatalOpen: readiness.fatalOpen,
        majorOpen: readiness.majorOpen,
        officialDeadlineVerified: readiness.officialDeadlineVerified,
        internalDeadline,
        lastVerifiedAt: overview.runs[0]?.createdAt ?? null,
      },
      routes: {
        fundingRoute: typeof latest.final_strategy?.funding_route === "string" ? latest.final_strategy.funding_route : "",
        publicationRoute: typeof latest.final_strategy?.publication_route === "string" ? latest.final_strategy.publication_route : "",
      },
      fatalItems: fatalItems.slice(0, 50),
      note: readiness.submissionReady ? "符合老麥導航器的正式送件條件；仍須使用者最終確認。" : "尚未具備正式送件條件。",
    });
  } catch (error) {
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorStorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "submission_gate_storage_unavailable", error: "正式送件門目前不可用。" }, 503);
    return json({ ok: false, code: "submission_gate_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "submission_gate_not_found" }, 404);
    const parsed = await readBody(request);
    if (!record(parsed) || parsed.confirmed !== true || typeof parsed.rationale !== "string" || !parsed.rationale.trim() || parsed.rationale.trim().length > 2_000) {
      return json({ ok: false, code: "confirmation_required", error: "必須確認送件並填寫核准理由（理性由，上限 2000 字）。" }, 400);
    }
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-gate:confirm", identifier: `${authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 5 });
    if (limited) return limited;
    const overview = await getNavigatorOverview(tenant);
    const latest = overview.runs[0];
    if (!latest || !overview.latestOutput) return json({ ok: false, code: "submission_gate_no_run", error: "尚未執行投稿與計畫導航，無法確認送件。" }, 409);
    const readiness = readinessFromOutput(overview.latestOutput);
    if (!readiness.submissionReady) return json({ ok: false, code: "submission_gate_fatal_open", error: "尚未具備正式送件條件", fatalOpen: readiness.fatalOpen.slice(0, 50) }, 422);
    const confirmed = await confirmNavigatorRelease({ tenant, userId: authenticated.session.user.id, documentVersionId: latest.documentVersionId, contentHash: latest.contentHash, rationale: parsed.rationale.trim() });
    return json({ ok: true, gateId: confirmed.gateId, approvedAt: confirmed.approvedAt, note: "已記錄正式送件人工確認（S8_RELEASE_HUMAN_GATE）。實際送件動作仍須在官方系統完成；此門不保證通過或接受。" });
  } catch (error) {
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
    if (error instanceof SubmissionNavigatorStorageUnavailable || error instanceof ResearchStorageUnavailable || code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "submission_gate_storage_unavailable", error: "正式送件門目前不可用。" }, 503);
    return json({ ok: false, code: "submission_gate_unavailable", error: "老麥目前無法完成這項操作。" }, 503);
  }
}
