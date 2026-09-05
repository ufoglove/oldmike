import "server-only";

import { NextResponse } from "next/server";

import { originAllowed } from "@/lib/auth-http";
import { validateCreateJourneyRequest } from "@/lib/v2-alpha2/contracts";
import { createV2Alpha2Repository, V2Alpha2RepositoryError, V2_ALPHA2_REQUEST_MAX_BYTES } from "@/lib/v2-alpha2/repository";
import { kickV2Alpha2SyntheticWorker, resolveV2Alpha2Principal, v2Alpha2RoutesEnabled } from "@/lib/v2-alpha2/runtime";

function response(body: Record<string, unknown>, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > V2_ALPHA2_REQUEST_MAX_BYTES) throw new Error("request_too_large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > V2_ALPHA2_REQUEST_MAX_BYTES) throw new Error("request_too_large");
  return JSON.parse(text) as unknown;
}

export async function POST(request: Request) {
  if (!v2Alpha2RoutesEnabled()) return response({ ok: false, code: "not_found" }, 404);
  if (!originAllowed(request)) return response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha2Principal(request);
  if (!authority.ok) return response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = validateCreateJourneyRequest(await boundedJson(request));
    const repository = createV2Alpha2Repository(authority.principal);
    const created = await repository.create({ requestId: input.idempotencyKey, operation: "GENERATE_DIRECTIONS", payloadSchemaId: "old-mike-v2-alpha2/generate-directions-input/1", requestPayload: { researchDirection: input.researchDirection, sourceStrategy: input.sourceStrategy } });
    kickV2Alpha2SyntheticWorker(authority.principal, 2);
    return response({ ok: true, contractVersion: "old-mike-v2-alpha2/journey-create/1", journeyRef: created.journeyRef, state: "QUEUED", replayed: created.replayed, formalWriteCount: 0 }, 202);
  } catch (error) {
    if (error instanceof V2Alpha2RepositoryError && error.code === "IDEMPOTENCY_CONFLICT") return response({ ok: false, code: "journey_request_conflict" }, 409);
    if (error instanceof V2Alpha2RepositoryError && error.code === "TENANT_REJECTED") return response({ ok: false, code: "workspace_not_found" }, 404);
    return response({ ok: false, code: error instanceof Error && error.message === "request_too_large" ? "request_too_large" : "journey_request_invalid" }, 400);
  }
}
