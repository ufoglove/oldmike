import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { createV2Alpha3Repository, V2Alpha3RepositoryError } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal } from "@/lib/v2-alpha3/runtime";
import { parseDomainSelection } from "@/lib/v2-alpha3/contracts";
import { parseTargetSelection } from "@/lib/v2-alpha4/contracts";
import { createSyntheticAlpha4Workspace, createV2Alpha4Coordinator } from "@/lib/v2-alpha4/runtime";

const coordinator = createV2Alpha4Coordinator({ generate: async (request) => createSyntheticAlpha4Workspace(request) });

function enabled() {
  return process.env.NODE_ENV === "development" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA4_LOCAL_PROTOTYPE === "1";
}

export async function POST(request: Request) {
  if (!enabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    const domainSelection = parseDomainSelection(input.domainSelection);
    if (domainSelection.kind === "CUSTOM") await createV2Alpha3Repository(authority.principal).resolveDomainSelection(domainSelection);
    const targetSelection = parseTargetSelection(input.targetSelection);
    const outcome = await coordinator.run({
      scope: `${authority.principal.workspaceId}:${authority.principal.userId}`,
      requestId: String(input.requestId ?? ""), domainSelection, targetSelection, researchDirection: String(input.researchDirection ?? ""),
    });
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha4/workspace-route/1", workspace: outcome.result, replayed: outcome.replayed, providerSubmissionCount: outcome.replayed ? 0 : 1, liveSourceCalls: 0, formalResearchWriteCount: 0, externalSubmissionCount: 0 }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "alpha4_request_invalid";
    if (code === "alpha4_idempotency_conflict") return alpha3Response({ ok: false, code }, 409);
    if (error instanceof V2Alpha3RepositoryError && (error.code === "PROFILE_NOT_FOUND" || error.code === "TENANT_REJECTED")) {
      return alpha3Response({ ok: false, code: "domain_authority_not_found" }, 404);
    }
    return alpha3Response({ ok: false, code: "alpha4_request_invalid" }, 400);
  }
}
