import "server-only";

import { parseDomainSelection, sha256Canonical } from "@/lib/v2-alpha3/contracts";
import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { createV2Alpha3Repository, V2Alpha3RepositoryError } from "@/lib/v2-alpha3/repository";
import { getV2Alpha3FixtureCoordinator, resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";

export async function POST(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    const requestId = String(input.requestId ?? "");
    const message = String(input.message ?? "");
    const domainSelection = parseDomainSelection(input.domainSelection);
    const repository = createV2Alpha3Repository(authority.principal);
    await repository.resolveDomainSelection(domainSelection);
    const outcome = await getV2Alpha3FixtureCoordinator().run({ scope: `${authority.principal.workspaceId}:${authority.principal.userId}`, requestId, domainSelection, message });
    const messageArtifact = { messageHash: outcome.result.domainSelection.selectionHash === domainSelection.selectionHash ? sha256Canonical(message) : "", lengthClass: message.length <= 160 ? "LE_160" : message.length <= 800 ? "LE_800" : "LE_2000" };
    const requestCommitment = sha256Canonical({ requestId, domainSelectionHash: domainSelection.selectionHash });
    const userEvent = await repository.appendConversationEvent({ eventNo: 1, requestId: `chat-user:${requestCommitment}`, eventKind: "USER_MESSAGE", domainSelection, payload: messageArtifact });
    await repository.appendConversationEvent({ conversationRef: userEvent.conversationRef, eventNo: 2, requestId: `chat-result:${requestCommitment}`, eventKind: "OLD_MIKE_INSIGHTS", domainSelection, payload: { schemaId: outcome.result.schemaId, insights: outcome.result.insights, completionClass: outcome.result.completionClass } });
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/chat-turn/1", conversationRef: userEvent.conversationRef, domainSelectionHash: domainSelection.selectionHash, insights: outcome.result.insights, replayed: outcome.replayed, providerSubmissionCount: outcome.replayed ? 0 : 1, formalWriteCount: 0 }, 200);
  } catch (error) {
    if (error instanceof V2Alpha3RepositoryError && error.code === "IDEMPOTENCY_CONFLICT") return alpha3Response({ ok: false, code: "chat_request_conflict" }, 409);
    if (error instanceof V2Alpha3RepositoryError && (error.code === "TENANT_REJECTED" || error.code === "PROFILE_NOT_FOUND")) return alpha3Response({ ok: false, code: "domain_authority_not_found" }, 404);
    return alpha3Response({ ok: false, code: error instanceof Error && error.message === "chat_idempotency_conflict" ? "chat_request_conflict" : "chat_request_invalid" }, error instanceof Error && error.message === "chat_idempotency_conflict" ? 409 : 400);
  }
}
