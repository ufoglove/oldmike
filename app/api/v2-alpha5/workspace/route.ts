import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { createV2Alpha3Repository, V2Alpha3RepositoryError } from "@/lib/v2-alpha3/repository";
import { parseDomainSelection } from "@/lib/v2-alpha3/contracts";
import { resolveV2Alpha3Principal } from "@/lib/v2-alpha3/runtime";
import { V2_ALPHA5_CONTRACT_VERSION } from "@/lib/v2-alpha5/contracts";
import { createSyntheticOfficialSourceBundle } from "@/lib/v2-alpha5/official-source-bundle";
import { createSyntheticAlpha5Workspace, createV2Alpha5Coordinator } from "@/lib/v2-alpha5/runtime";

const coordinator = createV2Alpha5Coordinator(async (input) => createSyntheticAlpha5Workspace(input));

function enabled() {
  return process.env.NODE_ENV === "development" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA5_LOCAL_PROTOTYPE === "1";
}

export async function POST(request: Request) {
  if (!enabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const raw = await boundedAlpha3Json(request) as Record<string, unknown>;
    const allowed = new Set(["requestId", "domainSelection", "targetId", "researchDirection"]);
    if (Object.keys(raw).some((key) => !allowed.has(key))) throw new Error("alpha5_route_shape_invalid");
    const domainSelection = parseDomainSelection(raw.domainSelection);
    if (domainSelection.kind === "CUSTOM") await createV2Alpha3Repository(authority.principal).resolveDomainSelection(domainSelection);
    if (raw.targetId !== "NSTC" && raw.targetId !== "MOE") throw new Error("alpha5_target_invalid");
    const sourceBundle = createSyntheticOfficialSourceBundle({ targetId: raw.targetId, cycleYear: 2026, domainSelection, variant: "MIXED_FRESHNESS" });
    const outcome = await coordinator.run({
      scope: `${authority.principal.workspaceId}:${authority.principal.userId}`,
      contractVersion: V2_ALPHA5_CONTRACT_VERSION,
      requestId: String(raw.requestId ?? ""),
      domainSelection,
      targetId: raw.targetId,
      researchDirection: String(raw.researchDirection ?? ""),
      sourceBundle,
    });
    return alpha3Response({
      ok: true,
      contractVersion: "old-mike-v2-alpha5/workspace-route/1",
      workspace: outcome.result,
      replayed: outcome.replayed,
      providerSubmissionCount: outcome.replayed ? 0 : 1,
      liveSourceCallCount: 0,
      formalResearchWriteCount: 0,
      onlineDatabaseWriteCount: 0,
      externalMutationCount: 0,
    }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "alpha5_request_invalid";
    if (code === "alpha5_idempotency_conflict") return alpha3Response({ ok: false, code }, 409);
    if (error instanceof V2Alpha3RepositoryError && (error.code === "PROFILE_NOT_FOUND" || error.code === "TENANT_REJECTED")) return alpha3Response({ ok: false, code: "domain_authority_not_found" }, 404);
    return alpha3Response({ ok: false, code: code.startsWith("alpha5_") ? code : "alpha5_request_invalid" }, 400);
  }
}
