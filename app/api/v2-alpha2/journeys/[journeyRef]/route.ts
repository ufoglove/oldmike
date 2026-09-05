import "server-only";

import { NextResponse } from "next/server";
import { createV2Alpha2Repository, V2Alpha2RepositoryError } from "@/lib/v2-alpha2/repository";
import { resolveV2Alpha2Principal, v2Alpha2RoutesEnabled } from "@/lib/v2-alpha2/runtime";

const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, context: { params: Promise<{ journeyRef: string }> }) {
  if (!v2Alpha2RoutesEnabled()) return reply({ ok: false, code: "not_found" }, 404);
  const authority = await resolveV2Alpha2Principal(request);
  if (!authority.ok) return reply({ ok: false, code: authority.code }, authority.status);
  try {
    const { journeyRef } = await context.params;
    const journey = await createV2Alpha2Repository(authority.principal).getJourney(journeyRef);
    return reply({ ok: true, journey }, 200);
  } catch (error) {
    return reply({ ok: false, code: error instanceof V2Alpha2RepositoryError && error.code === "TENANT_REJECTED" ? "journey_not_found" : "journey_unavailable" }, error instanceof V2Alpha2RepositoryError && error.code === "TENANT_REJECTED" ? 404 : 503);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ journeyRef: string }> }) {
  if (!v2Alpha2RoutesEnabled()) return reply({ ok: false, code: "not_found" }, 404);
  const authority = await resolveV2Alpha2Principal(request);
  if (!authority.ok) return reply({ ok: false, code: authority.code }, authority.status);
  const { journeyRef } = await context.params;
  try {
    const result = await createV2Alpha2Repository(authority.principal).cancel(journeyRef);
    return reply({ ...result }, result.canceled ? 200 : 409);
  } catch {
    return reply({ ok: false, code: "journey_cancel_unavailable" }, 409);
  }
}
