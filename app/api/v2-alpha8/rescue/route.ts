import "server-only";

import { NextResponse } from "next/server";

import { originAllowed } from "@/lib/auth-http";
import { resolveV2Alpha8Principal } from "@/lib/v2-alpha8/auth";
import { V2_ALPHA8_CONTRACT_VERSION, V2_ALPHA8_REQUEST_MAX_BYTES } from "@/lib/v2-alpha8/contracts";
import { alpha8PrototypeEnabled } from "@/lib/v2-alpha8/page-authority";
import { createV2Alpha8Coordinator } from "@/lib/v2-alpha8/runtime";

const coordinator = createV2Alpha8Coordinator();
function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > V2_ALPHA8_REQUEST_MAX_BYTES) throw new Error("alpha8_request_too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > V2_ALPHA8_REQUEST_MAX_BYTES) throw new Error("alpha8_request_too_large");
  return JSON.parse(body) as unknown;
}

export async function POST(request: Request) {
  if (!alpha8PrototypeEnabled()) return response({ ok: false, code: "not_found" }, 404);
  if (!originAllowed(request)) return response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha8Principal(request);
  if (!authority.ok) return response({ ok: false, code: authority.code }, authority.status);
  try {
    const outcome = await coordinator.run(await boundedJson(request), `${authority.principal.workspaceId}:${authority.principal.userId}`);
    return response({
      ok: true,
      contractVersion: V2_ALPHA8_CONTRACT_VERSION,
      workspace: outcome.workspace,
      replayed: outcome.replayed,
      syntheticGenerationStagesAdded: outcome.syntheticGenerationStagesAdded,
      liveProviderSubmissionsAdded: outcome.liveProviderSubmissionsAdded,
      formalResearchWriteCount: 0,
      onlineDatabaseWriteCount: 0,
      externalMutationCount: 0,
    }, 200);
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("alpha8_") ? error.message : "alpha8_request_invalid";
    if (code === "alpha8_idempotency_conflict" || code === "alpha8_stale_draft_hash") return response({ ok: false, code }, 409);
    if (code === "alpha8_completion_unknown" || code === "alpha8_completion_unknown_no_resend") return response({ ok: false, code, completionClass: "COMPLETION_UNKNOWN" }, 503);
    if (code === "alpha8_request_too_large") return response({ ok: false, code }, 413);
    return response({ ok: false, code }, 400);
  }
}
