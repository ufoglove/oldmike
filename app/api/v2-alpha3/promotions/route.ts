import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { validateAlpha2PromotionRequest } from "@/lib/v2-alpha3/contracts";
import { createV2Alpha3Repository } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";
import { createV2Alpha2Repository, V2Alpha2RepositoryError } from "@/lib/v2-alpha2/repository";
import { kickV2Alpha2SyntheticWorker } from "@/lib/v2-alpha2/runtime";

export async function POST(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const promotion = validateAlpha2PromotionRequest(await boundedAlpha3Json(request));
    const alpha3 = createV2Alpha3Repository(authority.principal);
    await alpha3.resolveDomainSelection(promotion.domainSelection);
    const alpha2 = createV2Alpha2Repository(authority.principal);
    const created = await alpha2.create({
      requestId: promotion.requestId,
      operation: "GENERATE_DIRECTIONS",
      payloadSchemaId: "old-mike-v2-alpha2/generate-directions-input/1",
      requestPayload: { researchDirection: `${promotion.insightCard.title}：${promotion.insightCard.researchQuestion}`, sourceStrategy: "NONE", alpha3Promotion: { domainSelectionHash: promotion.domainSelectionHash, insightCardHash: promotion.insightCardHash } },
    });
    await alpha3.bindGenerationInput({ jobId: created.jobRef, inputNo: 1, inputKind: "DOMAIN_SELECTION", domainSelection: promotion.domainSelection, payload: { domainSelectionHash: promotion.domainSelectionHash } });
    await alpha3.bindGenerationInput({ jobId: created.jobRef, inputNo: 2, inputKind: "CHAT_INSIGHT", domainSelection: promotion.domainSelection, insightCard: promotion.insightCard, payload: { insightCardHash: promotion.insightCardHash } });
    kickV2Alpha2SyntheticWorker(authority.principal, 2);
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/alpha2-promotion-result/1", journeyRef: created.journeyRef, domainSelectionHash: promotion.domainSelectionHash, insightCardHash: promotion.insightCardHash, replayed: created.replayed, formalWriteCount: 0 }, 202);
  } catch (error) {
    if (error instanceof V2Alpha2RepositoryError && error.code === "IDEMPOTENCY_CONFLICT") return alpha3Response({ ok: false, code: "promotion_request_conflict" }, 409);
    return alpha3Response({ ok: false, code: "promotion_request_invalid" }, 400);
  }
}
