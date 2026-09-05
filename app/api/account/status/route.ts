import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export async function GET() {
  const authenticated = await requireAuthenticatedUser({ allowPasswordChangeRequired: true });
  if (!authenticated.ok) return authenticated.response;
  return NextResponse.json({
    ok: true,
    status: authenticated.policy.status,
    mustChangePassword: authenticated.policy.mustChangePassword,
    temporaryPasswordExpired: authenticated.policy.temporaryPasswordExpired,
    isAdministrator: authenticated.policy.isAdministrator,
  }, { headers: { "Cache-Control": "no-store" } });
}
