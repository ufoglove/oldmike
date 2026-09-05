import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { SUBMISSION_NAVIGATOR_MAX_BODY_BYTES, SubmissionNavigatorContractError, parseNavigatorRunRequest } from "@/lib/submission-navigator-contract";
import { SubmissionNavigatorProviderError, runSubmissionNavigatorWithOpenClaw } from "@/lib/submission-navigator-provider";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import {
  SubmissionNavigatorRepositoryError,
  SubmissionNavigatorStorageUnavailable,
  getNavigatorOverview,
  saveNavigatorRun,
} from "@/lib/submission-navigator-repository";
import { getNavigatorStateV2, insertStructuredMatchRun } from "@/lib/submission-navigator-v2-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > SUBMISSION_NAVIGATOR_MAX_BODY_BYTES) throw new SubmissionNavigatorContractError("request_too_large", 413);
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > SUBMISSION_NAVIGATOR_MAX_BODY_BYTES) throw new SubmissionNavigatorContractError(body ? "request_too_large" : "invalid_request_body", body ? 413 : 400);
  try { return JSON.parse(body) as unknown; } catch { throw new SubmissionNavigatorContractError("invalid_json"); }
}

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

function publicError(error: unknown) {
  if (error instanceof SubmissionNavigatorContractError) return json({ ok: false, code: error.code, error: "導航器輸入未通過老麥的固定結構契約。" }, error.status);
  if (error instanceof SubmissionNavigatorProviderError) return json({ ok: false, code: error.code, error: "老麥導航目前無法取得；尚未寫入任何正式資料。" }, error.status);
  if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用；尚未寫入任何正式資料。" }, error.status);
  if (error instanceof SubmissionNavigatorRepositoryError) return json({ ok: false, code: error.code, error: "操作未通過專案或版本契約。" }, error.status);
  if (error instanceof SubmissionNavigatorStorageUnavailable || error instanceof ResearchStorageUnavailable || schemaUnavailable(error)) return json({ ok: false, code: "submission_navigator_storage_unavailable", error: "導航器目前不可用；既有版本沒有被覆寫。" }, 503);
  return json({ ok: false, code: "submission_navigator_unavailable", error: "老麥目前無法完成這項操作；正式資料沒有被變更。" }, 503);
}

async function authorize(projectId: string) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return { response: authenticated.response } as const;
  const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
  if (!tenant) return { response: json({ ok: false, code: "submission_navigator_not_found" }, 404) } as const;
  return { authenticated, tenant } as const;
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const overview = await getNavigatorOverview(authorized.tenant);
    const stateV2 = await getNavigatorStateV2(authorized.tenant);
    return json({ ok: true, workspace: overview, navigatorV2: stateV2 });
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const parsed = parseNavigatorRunRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: "submission-navigator:run", identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: 8 });
    if (limited) return limited;
    const route = { ...resolveModelRoute({ modeProfile: "AUTO", operation: "SUBMISSION_NAVIGATOR" }), timeoutMs: 900_000, inputLimitBytes: 512_000, outputLimitBytes: 400_000 };
    const output = await runSubmissionNavigatorWithOpenClaw({ request: parsed, actorId: authorized.authenticated.session.user.id, route });
    const saved = await saveNavigatorRun({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed, output });
    let structuredId: string | null = null;
    try {
      const structured = await insertStructuredMatchRun({
        tenant: authorized.tenant,
        userId: authorized.authenticated.session.user.id,
        runType: "DEEP",
        targetYear: parsed.targetYear,
        targetMode: parsed.targetMode,
        context: {
          contractVersion: "submission-context/1.0.0",
          project_id: projectId,
          topic_id: "",
          topic_version: "",
          chinese_title: { value: parsed.topicProfile.titleZh, status: "PRESENT", source: "navigator_request" },
          english_title: { value: parsed.topicProfile.titleEn, status: parsed.topicProfile.titleEn ? "PRESENT" : "MISSING", source: "navigator_request" },
          concept_abstract: { value: parsed.topicProfile.abstract, status: "PRESENT", source: "navigator_request" },
          research_gap: { value: parsed.topicProfile.researchGap, status: "PRESENT", source: "navigator_request" },
          research_questions: { value: parsed.topicProfile.researchQuestions, status: "PRESENT", source: "navigator_request" },
          hypotheses: { value: null, status: "MISSING", source: "navigator_request" },
          theory: { value: parsed.topicProfile.theory, status: "PRESENT", source: "navigator_request" },
          conceptual_framework: { value: null, status: "MISSING", source: "navigator_request" },
          technology: { value: null, status: "MISSING", source: "navigator_request" },
          intervention: { value: parsed.topicProfile.intervention, status: "PRESENT", source: "navigator_request" },
          population: { value: parsed.topicProfile.population, status: "PRESENT", source: "navigator_request" },
          context: { value: parsed.topicProfile.context, status: "PRESENT", source: "navigator_request" },
          methodology: { value: parsed.topicProfile.method, status: "PRESENT", source: "navigator_request" },
          variables: { value: parsed.topicProfile.variables, status: "PRESENT", source: "navigator_request" },
          expected_contribution: { value: parsed.topicProfile.expectedOutcomes, status: "PRESENT", source: "navigator_request" },
          novelty_analysis: { value: parsed.topicProfile.noveltyAnalysis, status: "PRESENT", source: "navigator_request" },
          feasibility_analysis: { value: null, status: "MISSING", source: "navigator_request" },
          evidence_ledger: { value: null, status: "MISSING", source: "navigator_request" },
          researcher_profile: { value: parsed.researcherProfile.position, status: "PRESENT", source: "navigator_request" },
          researcher_publications: { value: parsed.researcherProfile.recentPapers, status: "PRESENT", source: "navigator_request" },
          researcher_projects: { value: parsed.researcherProfile.recentGrants, status: "PRESENT", source: "navigator_request" },
          available_sample: { value: null, status: "MISSING", source: "navigator_request" },
          available_sites: { value: null, status: "MISSING", source: "navigator_request" },
          available_equipment: { value: null, status: "MISSING", source: "navigator_request" },
          available_data: { value: null, status: "MISSING", source: "navigator_request" },
          created_at: new Date().toISOString(),
        },
        fitSummary: {
          fundingRoute: typeof (output.funding_route_decision as Record<string, unknown> | undefined)?.recommended_route === "string" ? (output.funding_route_decision as Record<string, unknown>).recommended_route as string : "",
          publicationRoute: typeof (output.journal_analysis as Record<string, unknown> | undefined)?.recommendation_stage === "string" ? (output.journal_analysis as Record<string, unknown>).recommendation_stage as string : "",
        },
        idempotencyKey: `structured:${parsed.idempotencyKey}`,
        output,
      });
      structuredId = structured.id;
    } catch {
      structuredId = null;
    }
    const readiness = await getNavigatorOverview(authorized.tenant);
    const stateV2 = await getNavigatorStateV2(authorized.tenant);
    return json({ ok: true, runId: saved.documentVersionId, versionNumber: saved.versionNumber, contentHash: saved.contentHash, idempotent: saved.idempotent, schemaValidated: true, output, workspace: readiness, navigatorV2: stateV2, structuredRunId: structuredId }, saved.idempotent ? 200 : 201);
  } catch (error) { return publicError(error); }
}
