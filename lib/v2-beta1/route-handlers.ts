import "server-only";

import { resolveV2Beta1Principal } from "./auth.ts";
import { V2_BETA1_CONTRACT_VERSION, V2_BETA1_JOURNEY_OPERATION, V2_BETA1_OPERATION, V2_BETA1_REQUEST_MAX_BYTES, beta1Hash, parseV2Beta1ImportChatInsightRequest, parseV2Beta1JourneyRequest } from "./contracts.ts";
import { v2Beta1PrototypeEnabled } from "./page-authority.ts";
import { createSyntheticBeta1Insight, getV2Beta1FixtureCoordinator } from "./runtime.ts";

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const authority = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : new URL(request.url);
    return new URL(origin).origin === authority.origin;
  } catch {
    return false;
  }
}

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > V2_BETA1_REQUEST_MAX_BYTES) throw new Error("beta1_request_too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > V2_BETA1_REQUEST_MAX_BYTES) throw new Error("beta1_request_too_large");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("beta1_request_invalid");
  }
}

async function principal(request: Request) {
  if (!v2Beta1PrototypeEnabled()) return { ok: false as const, result: response({ ok: false, code: "not_found" }, 404) };
  const authority = await resolveV2Beta1Principal(request);
  if (!authority.ok) return { ok: false as const, result: response({ ok: false, code: authority.code }, authority.status) };
  return { ok: true as const, authority: authority.principal };
}

type Coordinator = Pick<ReturnType<typeof getV2Beta1FixtureCoordinator>, "getSnapshot" | "importInsight" | "runJourney">;

type RouteDependencies = {
  coordinator: Coordinator;
  previewInsight: typeof createSyntheticBeta1Insight;
};

/** Fixture-only dependency seam. The prototype and principal gates run before a dependency is consumed. */
export function createV2Beta1RouteHandlers(dependencies: RouteDependencies = {
  coordinator: getV2Beta1FixtureCoordinator(),
  previewInsight: createSyntheticBeta1Insight,
}) {
  return {
    async GET(request: Request) {
      const resolved = await principal(request);
      if (!resolved.ok) return resolved.result;
      const snapshot = dependencies.coordinator.getSnapshot(resolved.authority.scope);
      return response({
        ok: true,
        contractVersion: V2_BETA1_CONTRACT_VERSION,
        trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY",
        snapshot,
        previewInsight: dependencies.previewInsight(),
        effectSubmissionCount: 0,
        liveProviderCallCount: 0,
        formalResearchWriteCount: 0,
        onlineDatabaseWriteCount: 0,
        externalMutationCount: 0,
      }, 200);
    },

    async POST(request: Request) {
      const resolved = await principal(request);
      if (!resolved.ok) return resolved.result;
      if (!originAllowed(request)) return response({ ok: false, code: "origin_rejected" }, 403);
      let requestCorrelation: { idempotencyKey: string; requestHash: string } | null = null;
      try {
        const body = await boundedJson(request);
        const operation = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).operation : null;
        if (operation !== V2_BETA1_OPERATION && operation !== V2_BETA1_JOURNEY_OPERATION) throw new Error("beta1_operation_invalid");
        const parsedRequest = operation === V2_BETA1_JOURNEY_OPERATION ? parseV2Beta1JourneyRequest(body, { trustedScope: resolved.authority.scope }) : parseV2Beta1ImportChatInsightRequest(body);
        requestCorrelation = { idempotencyKey: parsedRequest.idempotencyKey, requestHash: beta1Hash(parsedRequest) };
        const outcome = operation === V2_BETA1_JOURNEY_OPERATION
          ? await dependencies.coordinator.runJourney(parsedRequest, resolved.authority.scope)
          : await dependencies.coordinator.importInsight(parsedRequest, resolved.authority.scope);
        return response({
          ok: true,
          contractVersion: V2_BETA1_CONTRACT_VERSION,
          trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY",
          generatedArtifactHash: outcome.generatedArtifactHash,
          snapshot: outcome.snapshot,
          replayed: outcome.replayed,
          effectSubmissionCount: outcome.replayed ? 0 : 1,
          liveProviderCallCount: 0,
          formalResearchWriteCount: 0,
          onlineDatabaseWriteCount: 0,
          externalMutationCount: 0,
        }, 200);
      } catch (error) {
        const code = error instanceof Error && error.message.startsWith("beta1_") ? error.message : "beta1_request_invalid";
        if (code === "beta1_idempotency_conflict" || code === "beta1_stale_revision" || code === "beta1_stale_content_hash" || code === "beta1_concurrent_state_conflict" || code === "beta1_journey_already_completed") {
          return response({ ok: false, code }, 409);
        }
        if (code === "beta1_completion_unknown_no_resend") {
          const correlation = requestCorrelation;
          const matchingReceipt = correlation
            ? dependencies.coordinator.getSnapshot(resolved.authority.scope).effectReceipts.find((receipt) => receipt.idempotencyKey === correlation.idempotencyKey && receipt.requestHash === correlation.requestHash && receipt.completionClass === "UNKNOWN")
            : null;
          const generatedArtifactHash = matchingReceipt?.generatedArtifactHash ?? null;
          return response({ ok: false, code, completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash }, 503);
        }
        if (code === "beta1_request_too_large") return response({ ok: false, code }, 413);
        return response({ ok: false, code }, 400);
      }
    },
  };
}
