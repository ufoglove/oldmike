import "server-only";

import { parseDomainSelection, parseInsightCard, sha256Canonical } from "@/lib/v2-alpha3/contracts";
import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { createV2Alpha3Repository } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";

export async function POST(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    if (input.confirmed !== true) return alpha3Response({ ok: false, code: "project_import_confirmation_required" }, 409);
    const projectId = String(input.projectId ?? "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u.test(projectId)) throw new Error("project_invalid");
    const domainSelection = parseDomainSelection(input.domainSelection);
    const insight = parseInsightCard(input.insightCard);
    const repository = createV2Alpha3Repository({ ...authority.principal, projectId });
    await repository.resolveDomainSelection(domainSelection);
    const event = await repository.appendConversationEvent({ conversationRef: String(input.conversationRef ?? ""), eventNo: Number(input.eventNo), requestId: String(input.requestId ?? ""), eventKind: "PROJECT_IMPORT_CONFIRMED", domainSelection, payload: { projectBindingHash: sha256Canonical(projectId), insightCardHash: insight.hash, confirmation: "EXPLICIT" } });
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/project-import/1", eventRef: event.eventId, status: "CONFIRMATION_RECORDED_NO_FORMAL_WRITE", formalWriteCount: 0 }, 200);
  } catch {
    return alpha3Response({ ok: false, code: "project_import_invalid" }, 400);
  }
}
