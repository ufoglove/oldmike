import "server-only";

import { alpha3Response } from "@/lib/v2-alpha3/http";
import { sha256Canonical, verifyAlpha2PromotionResult } from "@/lib/v2-alpha3/contracts";
import { createV2Alpha3Repository } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";
import { createV2Alpha2Repository } from "@/lib/v2-alpha2/repository";

export async function GET(request: Request, context: { params: Promise<{ journeyRef: string }> }) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  const { journeyRef } = await context.params;
  try {
    const [journey, bindings] = await Promise.all([createV2Alpha2Repository(authority.principal).getJourney(journeyRef), createV2Alpha3Repository(authority.principal).getGenerationInputBindings(journeyRef)]);
    const domain = bindings.find((item) => item.inputKind === "DOMAIN_SELECTION");
    const insight = bindings.find((item) => item.inputKind === "CHAT_INSIGHT");
    if (!domain || !insight?.insightCardHash) throw new Error("promotion_binding_missing");
    const selected = journey.stageA?.directions.find((item) => item.directionId === journey.stageA?.recommendedDirectionId) ?? null;
    const selectedDirectionHash = selected ? sha256Canonical(selected) : null;
    if (journey.stageA && selectedDirectionHash && journey.stageB) verifyAlpha2PromotionResult({ domainSelectionHash: domain.domainSelectionHash, insightCardHash: insight.insightCardHash, selectedDirectionHash, stageADomainSelectionHash: domain.domainSelectionHash, stageB: { sourceDirectionHash: journey.stageB.sourceDirectionId === selected?.directionId ? selectedDirectionHash : "invalid", domainSelectionHash: domain.domainSelectionHash } });
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/alpha2-promotion-snapshot/1", journey, domainSelectionHash: domain.domainSelectionHash, insightCardHash: insight.insightCardHash, selectedDirectionHash, bindingGate: journey.stageB ? "PASS" : "PENDING", formalWriteCount: 0 }, 200);
  } catch {
    return alpha3Response({ ok: false, code: "promotion_not_found_or_invalid" }, 404);
  }
}
