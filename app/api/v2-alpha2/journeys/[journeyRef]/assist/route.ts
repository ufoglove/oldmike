import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { S0_FIELD_NAMES } from "@/lib/s0-fields";
import { createV2Alpha2Repository, V2Alpha2RepositoryError } from "@/lib/v2-alpha2/repository";
import { kickV2Alpha2SyntheticWorker, resolveV2Alpha2Principal, v2Alpha2RoutesEnabled } from "@/lib/v2-alpha2/runtime";

const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, context: { params: Promise<{ journeyRef: string }> }) {
  if (!v2Alpha2RoutesEnabled()) return reply({ ok: false, code: "not_found" }, 404);
  if (!originAllowed(request)) return reply({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha2Principal(request);
  if (!authority.ok) return reply({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await request.json() as Record<string, unknown>;
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 16 || !S0_FIELD_NAMES.includes(input.targetField as never) || typeof input.currentValue !== "string" || !input.contextSnapshot || typeof input.contextSnapshot !== "object" || Array.isArray(input.contextSnapshot)) throw new Error("assist_request_invalid");
    const { journeyRef } = await context.params;
    const created = await createV2Alpha2Repository(authority.principal).createFieldAssist(journeyRef, { requestId: input.idempotencyKey, targetField: input.targetField as string, currentValue: input.currentValue, contextSnapshot: input.contextSnapshot as Record<string, unknown> });
    kickV2Alpha2SyntheticWorker(authority.principal, 1);
    return reply({ ok: true, contractVersion: "old-mike-v2-alpha2/assist-create/1", assistRef: created.assistRef, state: "QUEUED", replayed: created.replayed, formalWriteCount: 0 }, 202);
  } catch (error) {
    if (error instanceof V2Alpha2RepositoryError && error.code === "IDEMPOTENCY_CONFLICT") return reply({ ok: false, code: "assist_request_conflict" }, 409);
    return reply({ ok: false, code: "assist_request_invalid" }, 400);
  }
}
