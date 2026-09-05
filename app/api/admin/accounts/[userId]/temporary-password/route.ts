import { NextResponse } from "next/server";
import { resetTemporaryPassword } from "@/lib/account-provisioning";
import { idempotencyKey, provisioningErrorResponse, requireAdminRequest } from "@/lib/admin-api";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const authorized = await requireAdminRequest(request, "/admin/accounts/temporary-password");
  if (!authorized.ok) return authorized.response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const result = await resetTemporaryPassword({
      actorAdminId: authorized.session.user.id,
      targetUserId: userId,
      temporaryPassword: typeof body.temporaryPassword === "string" ? body.temporaryPassword : "",
      idempotencyKey: idempotencyKey(request),
    });
    return NextResponse.json({ ok: true, idempotent: result.idempotent }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
