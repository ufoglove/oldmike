import { NextResponse } from "next/server";
import { listProvisionedAccounts, provisionStandardAccount } from "@/lib/account-provisioning";
import { idempotencyKey, provisioningErrorResponse, requireAdminRequest } from "@/lib/admin-api";

export async function GET(request: Request) {
  const authorized = await requireAdminRequest(request, "/admin/accounts");
  if (!authorized.ok) return authorized.response;
  try {
    const accounts = await listProvisionedAccounts(authorized.session.user.id);
    return NextResponse.json({ ok: true, accounts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const authorized = await requireAdminRequest(request, "/admin/accounts");
  if (!authorized.ok) return authorized.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const result = await provisionStandardAccount({
      actorAdminId: authorized.session.user.id,
      email: typeof body.email === "string" ? body.email : "",
      name: typeof body.name === "string" ? body.name : "",
      temporaryPassword: typeof body.temporaryPassword === "string" ? body.temporaryPassword : "",
      idempotencyKey: idempotencyKey(request),
    });
    return NextResponse.json({ ok: true, userId: result.userId, idempotent: result.idempotent }, { status: result.idempotent ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
