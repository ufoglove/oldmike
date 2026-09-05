import "server-only";

import { v2Beta2LocalFixtureEnabled } from "./environment.ts";
import { resolveResearchTenant, type V2Beta2ResearchTenant } from "./tenant.ts";

export { v2Beta2LocalFixtureEnabled } from "./environment.ts";
export { resolveResearchTenant, type V2Beta2ResearchTenant } from "./tenant.ts";

export type V2Beta2AuthenticationResult =
  | { ok: true; userId: string; fixture: boolean }
  | { ok: false; response: Response };

function noStore(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function exactUserId(value: unknown) {
  if (typeof value !== "string" || value !== value.trim() || value.length < 3 || value.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(value)) throw new Error("beta2_user_id_invalid");
  return value;
}

async function requireRealAuthenticatedUser() {
  const { requireAuthenticatedUser } = await import("../request-auth.ts");
  return requireAuthenticatedUser();
}

export async function authenticateV2Beta2Request(request: Request): Promise<V2Beta2AuthenticationResult> {
  if (v2Beta2LocalFixtureEnabled()) {
    try {
      return { ok: true, userId: exactUserId(request.headers.get("x-old-mike-beta2-test-user")), fixture: true };
    } catch {
      return { ok: false, response: noStore({ ok: false, code: "not_found" }, 404) };
    }
  }
  if (process.env.OLD_MIKE_V2_BETA2_ENABLED !== "1") {
    return { ok: false, response: noStore({ ok: false, code: "not_found" }, 404) };
  }
  const authority = await requireRealAuthenticatedUser();
  if (!authority.ok) return { ok: false, response: authority.response };
  return { ok: true, userId: exactUserId(authority.session.user.id), fixture: false };
}

export async function authenticateV2Beta2Page(): Promise<{ ok: true; userId: string } | { ok: false }> {
  if (process.env.OLD_MIKE_V2_BETA2_ENABLED !== "1") return { ok: false };
  const authority = await requireRealAuthenticatedUser();
  return authority.ok ? { ok: true, userId: exactUserId(authority.session.user.id) } : { ok: false };
}
