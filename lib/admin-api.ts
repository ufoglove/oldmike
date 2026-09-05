import "server-only";

import { NextResponse } from "next/server";
import { AccountProvisioningError } from "@/lib/account-provisioning";
import { guardAuthRequest } from "@/lib/auth-http";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export function provisioningErrorResponse(error: unknown) {
  if (error instanceof AccountProvisioningError) {
    return NextResponse.json({ ok: false, code: error.code }, { status: error.httpStatus, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: false, code: "account_operation_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function requireAdminRequest(request: Request, path: string) {
  const blocked = guardAuthRequest(request, path);
  if (blocked) return { ok: false as const, response: blocked };
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated;
  if (!authenticated.policy.isAdministrator) {
    return { ok: false as const, response: NextResponse.json({ ok: false, code: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } }) };
  }
  return authenticated;
}

export function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key") || "";
}
