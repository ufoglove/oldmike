import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { PROPOSAL_STUDIO_MAX_BODY_BYTES, ProposalStudioContractError, parseProposalStudioRequest } from "@/lib/proposal-studio-contract";
import { ProposalGuidanceProviderError } from "@/lib/proposal-guidance-provider";
import { ProposalGuidanceUnavailable, runProposalGuidance } from "@/lib/proposal-studio-guidance";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import {
  ProposalStudioRepositoryError,
  ProposalStudioStorageUnavailable,
  approveProposalVersion,
  exportProposalPreview,
  getProposalStudioOverview,
  resolveProposalForGuidance,
  saveProposalVersion,
} from "@/lib/proposal-studio-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request) { const length = Number(request.headers.get("content-length") || "0"); if (Number.isFinite(length) && length > PROPOSAL_STUDIO_MAX_BODY_BYTES) throw new ProposalStudioContractError("request_too_large", 413); const body = await request.text(); if (!body || Buffer.byteLength(body, "utf8") > PROPOSAL_STUDIO_MAX_BODY_BYTES) throw new ProposalStudioContractError(body ? "request_too_large" : "invalid_request_body", body ? 413 : 400); try { return JSON.parse(body) as unknown; } catch { throw new ProposalStudioContractError("invalid_json"); } }
function schemaUnavailable(error: unknown) { const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : ""; return code === "42P01" || code === "42703" || code === "3D000"; }
function publicError(error: unknown) {
  if (error instanceof ProposalStudioContractError) return json({ ok: false, code: error.code, error: "計畫書資料未通過老麥的固定結構契約。" }, error.status);
  if (error instanceof ProposalGuidanceUnavailable) return json({ ok: false, code: error.code, error: "老麥建議目前維持停用；正式計畫書沒有變更。" }, error.status);
  if (error instanceof ProposalGuidanceProviderError) return json({ ok: false, code: error.code, error: "老麥建議目前無法取得；正式計畫書沒有變更。" }, error.status);
  if (error instanceof ProposalGuidanceProviderError) return json({ ok: false, code: error.code, error: "老麥建議目前無法取得；正式計畫書沒有變更。" }, error.status);
  if (error instanceof ProposalGuidanceProviderError) return json({ ok: false, code: error.code, error: "老麥建議目前無法取得；正式計畫書沒有變更。" }, error.status);
  if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用；正式計畫書沒有變更。" }, error.status);
  if (error instanceof ProposalStudioRepositoryError) return json({ ok: false, code: error.code, error: "操作未通過專案、版本、官方來源或 Human Gate 契約。" }, error.status);
  if (error instanceof ProposalStudioStorageUnavailable || error instanceof ResearchStorageUnavailable || schemaUnavailable(error)) return json({ ok: false, code: "proposal_studio_storage_unavailable", error: "計畫書工作室目前不可用；既有版本沒有被覆寫。" }, 503);
  return json({ ok: false, code: "proposal_studio_unavailable", error: "老麥目前無法完成這項操作；正式資料沒有被變更。" }, 503);
}
async function authorize(projectId: string) { const authenticated = await requireAuthenticatedUser(); if (!authenticated.ok) return { response: authenticated.response } as const; const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); if (!tenant) return { response: json({ ok: false, code: "proposal_studio_not_found" }, 404) } as const; return { authenticated, tenant } as const; }

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await context.params; const authorized = await authorize(projectId); if ("response" in authorized) return authorized.response; return json({ ok: true, workspace: await getProposalStudioOverview(authorized.tenant) }); }
  catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params; const authorized = await authorize(projectId); if ("response" in authorized) return authorized.response;
    const parsed = parseProposalStudioRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: `proposal-studio:${parsed.operation}`, identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: parsed.operation === "REQUEST_PROPOSAL_GUIDANCE" ? 8 : 24 }); if (limited) return limited;
    if (parsed.operation === "SAVE_PROPOSAL_VERSION") { const proposal = await saveProposalVersion({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed }); return json({ ok: true, proposal }, proposal.idempotent ? 200 : 201); }
    if (parsed.operation === "REQUEST_PROPOSAL_GUIDANCE") { const resolved = await resolveProposalForGuidance(authorized.tenant, parsed); const route = resolveModelRoute({ modeProfile: parsed.modeProfile, operation: "PROPOSAL_GUIDANCE" }); const result = await runProposalGuidance({ tenantId: authorized.tenant.workspaceId, projectId, userId: authorized.authenticated.session.user.id, idempotencyKey: parsed.idempotencyKey, proposalHash: resolved.proposalHash, proposal: resolved.proposal, mode: resolved.mode, focus: parsed.focus, modeProfile: parsed.modeProfile, route }); return json({ ...result }); }
    if (parsed.operation === "APPROVE_PROPOSAL") { const approval = await approveProposalVersion({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed }); return json({ ok: true, approval }, approval.idempotent ? 200 : 201); }
    const preview = await exportProposalPreview({ tenant: authorized.tenant, request: parsed }); return json({ ok: true, preview });
  } catch (error) { return publicError(error); }
}
