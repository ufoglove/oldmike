import "server-only";

import { parseDomainSelection } from "@/lib/v2-alpha3/contracts";
import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { buildManualGoogleScholarSearchLink, synthesizeLocalLiteratureFixtures } from "@/lib/v2-alpha3/literature";
import { createV2Alpha3Repository } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";

export async function POST(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    const domainSelection = parseDomainSelection(input.domainSelection);
    await createV2Alpha3Repository(authority.principal).resolveDomainSelection(domainSelection);
    const query = String(input.query ?? "");
    const fixture = synthesizeLocalLiteratureFixtures({ domainSelection, query });
    return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/literature-local/1", domainSelectionHash: domainSelection.selectionHash, ...fixture, manualGoogleScholarLink: buildManualGoogleScholarSearchLink({ domainLabel: domainSelection.label, query }), importContracts: ["DOI", "BIBTEX", "RIS"], rawBodiesRetained: false, formalWriteCount: 0 }, 200);
  } catch {
    return alpha3Response({ ok: false, code: "literature_request_invalid" }, 400);
  }
}
