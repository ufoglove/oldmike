import { NextResponse } from "next/server";
import { validateDisplayName } from "@/lib/account-provisioning";
import { provisioningErrorResponse } from "@/lib/admin-api";
import { guardAuthRequest } from "@/lib/auth-http";
import { auth } from "@/lib/better-auth";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export async function PATCH(request: Request) {
  const blocked = guardAuthRequest(request, "/account/profile");
  if (blocked) return blocked;
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const limited = await guardSensitiveAuthRateLimit({
    scope: "account-profile",
    identifier: authenticated.session.user.id,
    windowSeconds: 600,
    max: 12,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const displayName = validateDisplayName(typeof body.displayName === "string" ? body.displayName : "");
    await auth.api.updateUser({ headers: request.headers, body: { name: displayName } });
    return NextResponse.json(
      { ok: true, displayName },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
