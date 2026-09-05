import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { parseOldMikeAssistRequest } from "@/lib/old-mike-assist-contract";
import { executeOldMikeAssist } from "@/lib/old-mike-assist-server";
import { sha256Canonical } from "@/lib/research-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { loadAuthorizedProjectTaskContext, ProjectTaskContextUnavailable } from "@/lib/task-context-repository";
import { readAssistBody, assistGatewayError, assistResponse } from "../../../assist/_shared";

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return noStore({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const body = await readAssistBody(request);
  if (body instanceof NextResponse) return body;
  const parsed = parseOldMikeAssistRequest(body, "PROJECT");
  if (!parsed.ok) return noStore({ ok: false, code: parsed.code, error: "老麥協助請求未通過此研究表面的固定契約。" }, 400);
  try {
    const { projectId } = await context.params;
    const authorized = await loadAuthorizedProjectTaskContext(authenticated.session.user.id, projectId);
    const boundedContext = {
      project: authorized.project,
      documents: authorized.documents,
      workflowEvents: authorized.workflowEvents,
      contextHash: authorized.contextHash,
    };
    const sessionCommitment = sha256Canonical({ tenantId: authorized.tenantId, projectId: authorized.projectId, idempotencyKey: parsed.value.idempotencyKey, surface: parsed.value.surface });
    const result = await executeOldMikeAssist({ request: parsed.value, context: boundedContext, contextHash: authorized.contextHash, sessionKey: `assist:${sessionCommitment.slice(0, 32)}`, signal: request.signal });
    if (result.kind === "gateway-failed") return assistGatewayError(result.failure);
    if (result.kind === "parse-failed") return noStore({ ok: false, code: result.code, stage: "ASSIST_RESPONSE_CONTRACT", recoverableFields: [parsed.value.schemaId], error: `老麥建議未通過 ASSIST_RESPONSE_CONTRACT（${result.code}）；目前草稿未變更。` }, 502);
    return assistResponse(result.value);
  } catch (error) {
    if (error instanceof ProjectTaskContextUnavailable) return noStore({ ok: false, code: error.code, error: "無法取得此專案的授權脈絡。" }, error.status);
    return noStore({ ok: false, code: "assist_project_context_failed", error: "老麥協助未完成；未變更正式資料。" }, 502);
  }
}
