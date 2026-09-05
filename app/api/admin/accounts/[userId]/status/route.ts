import { NextResponse } from "next/server";
import { setManagedAccountEnabled } from "@/lib/account-provisioning";
import { idempotencyKey, provisioningErrorResponse, requireAdminRequest } from "@/lib/admin-api";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const authorized = await requireAdminRequest(request, "/admin/accounts/status");
  if (!authorized.ok) return authorized.response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.enabled !== "boolean") return NextResponse.json({ ok: false, code: "invalid_status" }, { status: 400 });
  try {
    const result = await setManagedAccountEnabled({
      actorAdminId: authorized.session.user.id,
      targetUserId: userId,
      enabled: body.enabled,
      idempotencyKey: idempotencyKey(request),
    });
    return NextResponse.json({ ok: true, idempotent: result.idempotent, status: result.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
