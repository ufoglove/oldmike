import { NextResponse } from "next/server";
import { changeOwnPassword } from "@/lib/account-provisioning";
import { provisioningErrorResponse } from "@/lib/admin-api";
import { guardAuthRequest } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request, "/portal-change-password");
  if (blocked) return blocked;
  const authenticated = await requireAuthenticatedUser({ allowPasswordChangeRequired: true });
  if (!authenticated.ok) return authenticated.response;
  const limited = await guardSensitiveAuthRateLimit({ scope: "change-password", identifier: authenticated.session.user.id, windowSeconds: 600, max: 5 });
  if (limited) return limited;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const result = await changeOwnPassword({
      userId: authenticated.session.user.id,
      currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      acceptConsent: body.acceptConsent === true,
      termsVersion: typeof body.termsVersion === "string" ? body.termsVersion : undefined,
      privacyVersion: typeof body.privacyVersion === "string" ? body.privacyVersion : undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: true, sessionsRevoked: result.sessionsRevoked, loginRequired: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return provisioningErrorResponse(error);
  }
}
