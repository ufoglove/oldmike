import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { authConfigurationMissing } from "@/lib/auth-config";
import { getAccountPolicy } from "@/lib/account-provisioning";

function noStoreJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function getPortalSession() {
  if (authConfigurationMissing()) return null;
  return auth.api.getSession({ headers: await headers() });
}

export async function getPortalAccountContext() {
  const session = await getPortalSession();
  if (!session) return null;
  const policy = await getAccountPolicy(session.user.id);
  return { session, policy };
}

export async function requirePortalSession() {
  if (authConfigurationMissing()) return noStoreJson({ ok: false, code: "auth_configuration_missing" }, 503);
  try {
    const context = await getPortalAccountContext();
    if (!context) return noStoreJson({ ok: false, code: "unauthorized" }, 401);
    if (context.policy.status === "DISABLED") return noStoreJson({ ok: false, code: "account_disabled" }, 403);
    if (context.policy.mustChangePassword) return noStoreJson({ ok: false, code: "password_change_required" }, 428);
  } catch {
    return noStoreJson({ ok: false, code: "account_provisioning_unavailable" }, 503);
  }
  return null;
}

export async function requireAuthenticatedUser(options: { allowPasswordChangeRequired?: boolean } = {}) {
  if (authConfigurationMissing()) return { ok: false as const, response: noStoreJson({ ok: false, code: "auth_configuration_missing" }, 503) };
  let session;
  try {
    session = await getPortalSession();
  } catch {
    return { ok: false as const, response: noStoreJson({ ok: false, code: "auth_storage_unavailable" }, 503) };
  }
  if (!session) return { ok: false as const, response: noStoreJson({ ok: false, code: "unauthorized" }, 401) };
  try {
    const policy = await getAccountPolicy(session.user.id);
    if (policy.status === "DISABLED") return { ok: false as const, response: noStoreJson({ ok: false, code: "account_disabled" }, 403) };
    if (policy.mustChangePassword && !options.allowPasswordChangeRequired) {
      return { ok: false as const, response: noStoreJson({ ok: false, code: "password_change_required" }, 428) };
    }
    return { ok: true as const, session, policy };
  } catch {
    return { ok: false as const, response: noStoreJson({ ok: false, code: "account_provisioning_unavailable" }, 503) };
  }
}
