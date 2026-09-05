import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { resolveV2Alpha3Principal } from "@/lib/v2-alpha3/runtime";
import { V2_ALPHA7_CONTRACT_VERSION, alpha7Hash } from "@/lib/v2-alpha7/contracts";
import { alpha7PrototypeEnabled } from "@/lib/v2-alpha7/page-authority";
import { createSyntheticAlpha7Request, createSyntheticAlpha7Workspace, createV2Alpha7Coordinator } from "@/lib/v2-alpha7/runtime";

const coordinator = createV2Alpha7Coordinator(async (request) => createSyntheticAlpha7Workspace(request));

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export async function POST(request: Request) {
  if (!alpha7PrototypeEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const raw = await boundedAlpha3Json(request) as Record<string, unknown>;
    const alpha6 = raw.entryMode === "ALPHA6_MANUSCRIPT";
    const responseMode = raw.purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE";
    const expected = ["operation", "requestId", "entryMode", "purpose", ...(alpha6 ? ["sourceArtifactId"] : ["sourceText"]), ...(responseMode ? ["reviewerComments"] : [])];
    if (!exactKeys(raw, expected) || raw.operation !== "RUN_REVIEW_STUDIO") throw new Error("alpha7_route_shape_invalid");
    if (alpha6 && raw.sourceArtifactId !== "alpha6-manuscript-alpha7-local") throw new Error("alpha7_source_artifact_not_found");
    const studioRequest = createSyntheticAlpha7Request(String(raw.requestId ?? ""), raw.purpose as never, {
      entryMode: alpha6 ? "ALPHA6_MANUSCRIPT" : "PASTED_MANUSCRIPT",
      sourceText: alpha6 ? undefined : String(raw.sourceText ?? ""),
    });
    if (responseMode) {
      if (!Array.isArray(raw.reviewerComments) || raw.reviewerComments.length < 1) throw new Error("alpha7_reviewer_comments_invalid");
      studioRequest.reviewerComments = raw.reviewerComments.map((item, index) => ({ commentId: `UI-C${index + 1}`, text: String(item), sourceSection: studioRequest.source.sections[0].key }));
    }
    const outcome = await coordinator.run({ ...studioRequest, scope: `${authority.principal.workspaceId}:${authority.principal.userId}` });
    return alpha3Response({
      ok: true,
      contractVersion: V2_ALPHA7_CONTRACT_VERSION,
      workspace: outcome.result,
      replayed: outcome.replayed,
      providerSubmissionCount: outcome.replayed ? 0 : 1,
      requestHash: alpha7Hash(studioRequest),
      formalResearchWriteCount: 0,
      externalMutationCount: 0,
    }, 200);
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("alpha7_") ? error.message : "alpha7_request_invalid";
    if (code === "alpha7_idempotency_conflict") return alpha3Response({ ok: false, code }, 409);
    if (code === "alpha7_completion_unknown" || code === "alpha7_completion_unknown_no_resend") return alpha3Response({ ok: false, code, completionClass: "COMPLETION_UNKNOWN" }, 503);
    return alpha3Response({ ok: false, code }, 400);
  }
}
