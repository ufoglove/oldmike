import { NextResponse } from "next/server";
import { revokeManagedSessions } from "@/lib/account-provisioning";
import { idempotencyKey, provisioningErrorResponse, requireAdminRequest } from "@/lib/admin-api";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const authorized = await requireAdminRequest(request, "/admin/accounts/sessions");
  if (!authorized.ok) return authorized.response;
  const { userId } = await context.params;
  try {
    const result = await revokeManagedSessions({
      actorAdminId: authorized.session.user.id,
      targetUserId: userId,
      idempotencyKey: idempotencyKey(request),
    });
    return NextResponse.json({ ok: true, idempotent: result.idempotent }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
