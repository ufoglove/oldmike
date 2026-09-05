import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { V2_ALPHA3_BUILTIN_DOMAINS, createBuiltinDomainSelection, createCustomDomainSelection } from "@/lib/v2-alpha3/contracts";
import { createV2Alpha3Repository, V2Alpha3RepositoryError } from "@/lib/v2-alpha3/repository";
import { resolveV2Alpha3Principal, v2Alpha3RoutesEnabled } from "@/lib/v2-alpha3/runtime";

export async function GET(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  const history = await createV2Alpha3Repository(authority.principal).listProfileHistory();
  const latest = new Map<string, (typeof history)[number]>();
  history.forEach((item) => { const prior = latest.get(item.profileId); if (!prior || prior.version < item.version) latest.set(item.profileId, item); });
  const customSelections = [...latest.values()].filter((item) => item.lifecycleState === "ACTIVE").map((item) => createCustomDomainSelection({ profileId: item.profileId, version: item.version, name: item.name, contentHash: item.contentHash }));
  return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/domain-profile-list/1", builtins: V2_ALPHA3_BUILTIN_DOMAINS.map((item) => createBuiltinDomainSelection(item.id)), customSelections, history }, 200);
}

export async function POST(request: Request) {
  if (!v2Alpha3RoutesEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    const repository = createV2Alpha3Repository(authority.principal);
    const selection = input.action === "CREATE"
      ? await repository.createProfile({ name: input.name as string, includedKeywords: input.includedKeywords as string[] | undefined, excludedKeywords: input.excludedKeywords as string[] | undefined })
      : input.action === "REVISE"
        ? await repository.reviseProfile({ profileId: input.profileId as string, expectedVersion: input.expectedVersion as number, name: input.name as string, includedKeywords: input.includedKeywords as string[] | undefined, excludedKeywords: input.excludedKeywords as string[] | undefined })
        : null;
    if (selection) return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/domain-profile-write/1", selection }, input.action === "CREATE" ? 201 : 200);
    if (input.action === "ARCHIVE") {
      const archived = await repository.archiveProfile({ profileId: input.profileId as string, expectedVersion: input.expectedVersion as number });
      return alpha3Response({ ok: true, contractVersion: "old-mike-v2-alpha3/domain-profile-write/1", archived }, 200);
    }
    return alpha3Response({ ok: false, code: "profile_request_invalid" }, 400);
  } catch (error) {
    if (error instanceof V2Alpha3RepositoryError) {
      const status = error.code === "TENANT_REJECTED" || error.code === "PROFILE_NOT_FOUND" ? 404 : 409;
      return alpha3Response({ ok: false, code: error.code.toLocaleLowerCase("en-US") }, status);
    }
    return alpha3Response({ ok: false, code: error instanceof Error && error.message === "request_too_large" ? "request_too_large" : "profile_request_invalid" }, 400);
  }
}
