import "server-only";

import { NextResponse } from "next/server";
import { createV2Alpha2Repository } from "@/lib/v2-alpha2/repository";
import { resolveV2Alpha2Principal, v2Alpha2RoutesEnabled } from "@/lib/v2-alpha2/runtime";

const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, context: { params: Promise<{ assistRef: string }> }) {
  if (!v2Alpha2RoutesEnabled()) return reply({ ok: false, code: "not_found" }, 404);
  const authority = await resolveV2Alpha2Principal(request);
  if (!authority.ok) return reply({ ok: false, code: authority.code }, authority.status);
  try {
    const { assistRef } = await context.params;
    return reply({ ok: true, assist: await createV2Alpha2Repository(authority.principal).getFieldAssist(assistRef) }, 200);
  } catch {
    return reply({ ok: false, code: "assist_not_found" }, 404);
  }
}
