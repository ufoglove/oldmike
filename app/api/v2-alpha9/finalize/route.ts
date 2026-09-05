import "server-only";

import { NextResponse } from "next/server";

import { originAllowed } from "@/lib/auth-http";
import { resolveV2Alpha9Principal } from "@/lib/v2-alpha9/auth";
import { V2_ALPHA9_CONTRACT_VERSION } from "@/lib/v2-alpha9/contracts";
import { alpha9PrototypeEnabled } from "@/lib/v2-alpha9/page-authority";
import { V2_ALPHA9_REQUEST_MAX_BYTES, createV2Alpha9Coordinator } from "@/lib/v2-alpha9/runtime";

const coordinator = createV2Alpha9Coordinator();

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > V2_ALPHA9_REQUEST_MAX_BYTES) throw new Error("alpha9_request_too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > V2_ALPHA9_REQUEST_MAX_BYTES) throw new Error("alpha9_request_too_large");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("alpha9_request_invalid");
  }
}

export async function POST(request: Request) {
  if (!alpha9PrototypeEnabled()) return response({ ok: false, code: "not_found" }, 404);
  if (!originAllowed(request)) return response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha9Principal(request);
  if (!authority.ok) return response({ ok: false, code: authority.code }, authority.status);
  try {
    const outcome = await coordinator.run(await boundedJson(request), `${authority.principal.workspaceId}:${authority.principal.userId}`);
    return response({
      ok: true,
      contractVersion: V2_ALPHA9_CONTRACT_VERSION,
      workspace: outcome.workspace,
      replayed: outcome.replayed,
      providerCallCount: 0,
      scholarlyCallCount: 0,
      databaseConnectionCount: 0,
      formalResearchWriteCount: 0,
      externalMutationCount: 0,
    }, 200);
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("alpha9_") ? error.message : "alpha9_request_invalid";
    if (code === "alpha9_idempotency_conflict") return response({ ok: false, code }, 409);
    if (code === "alpha9_completion_unknown" || code === "alpha9_completion_unknown_no_resend") return response({ ok: false, code, completionClass: "COMPLETION_UNKNOWN" }, 503);
    if (code === "alpha9_request_too_large") return response({ ok: false, code }, 413);
    return response({ ok: false, code }, 400);
  }
}
