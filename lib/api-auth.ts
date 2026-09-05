import { NextResponse } from "next/server";
import { authConfiguration, isFixtureMode } from "@/lib/auth-config";
import { auth } from "@/lib/better-auth";
import { antiEnumerationResponse } from "@/lib/auth-fixture";

export function authFlowUnavailable() {
  return NextResponse.json({ ok: false, code: "auth_configuration_missing", error: "帳號服務目前尚未完成安全設定。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export function registrationUnavailable() {
  const config = authConfiguration();
  if (!config.ready || (!config.registrationEnabled && !isFixtureMode())) return authFlowUnavailable();
  return null;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const config = authConfiguration();
  if (!config.ready && !isFixtureMode()) return authFlowUnavailable();
  if (isFixtureMode()) return NextResponse.json(antiEnumerationResponse(), { headers: { "Cache-Control": "no-store" } });
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo } });
  } catch {
    // Do not reveal whether the address exists. A server-side audit event is
    // required in production; the address and reset token are never logged.
  }
  return NextResponse.json(antiEnumerationResponse(), { headers: { "Cache-Control": "no-store" } });
}

export async function sendVerification(email: string, callbackURL: string) {
  if (!authConfiguration().ready && !isFixtureMode()) return authFlowUnavailable();
  if (isFixtureMode()) return NextResponse.json({ ok: true, message: "若帳號存在，系統會寄出驗證信。" }, { headers: { "Cache-Control": "no-store" } });
  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL } });
  } catch {
    // Anti-enumeration response. Delivery details belong in audit storage.
  }
  return NextResponse.json({ ok: true, message: "若帳號存在，系統會寄出驗證信。" }, { headers: { "Cache-Control": "no-store" } });
}
