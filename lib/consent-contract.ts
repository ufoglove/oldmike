import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { irreversibleIdentifier, recordAuditEvent } from "@/lib/auth-audit";
import { authConfiguration } from "@/lib/auth-config";
import { Pool } from "pg";

export const TERMS_VERSION = "2026-08-16";
export const PRIVACY_VERSION = "2026-08-16";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
  termsVersion: string;
  privacyVersion: string;
  inviteToken: string;
};

export function parseRegistrationInput(value: unknown): { ok: true; value: RegistrationInput } | { ok: false; response: NextResponse } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, response: invalidRegistration("invalid_body") };
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const consent = body.consent === true;
  const termsVersion = typeof body.termsVersion === "string" ? body.termsVersion.trim() : "";
  const privacyVersion = typeof body.privacyVersion === "string" ? body.privacyVersion.trim() : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, response: invalidRegistration("invalid_name") };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, response: invalidRegistration("invalid_email") };
  if (password.length < 8 || password.length > 128 || password !== confirmPassword) return { ok: false, response: invalidRegistration("invalid_password") };
  if (!consent) return { ok: false, response: invalidRegistration("consent_required") };
  if (termsVersion !== TERMS_VERSION || privacyVersion !== PRIVACY_VERSION) return { ok: false, response: invalidRegistration("consent_version_required") };
  return { ok: true, value: { name, email, password, confirmPassword, consent, termsVersion, privacyVersion, inviteToken } };
}

export function invalidRegistration(code: string) {
  return NextResponse.json({ ok: false, code, error: "Registration requirements were not satisfied." }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export function registrationUnavailable() {
  const config = authConfiguration();
  if (!config.ready || config.registrationMode === "closed") return NextResponse.json({ ok: false, code: "registration_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return null;
}

export async function persistRegistrationConsent(input: {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  request: Request;
}) {
  if (!pool || !authConfiguration().ready) throw new Error("auth_storage_unavailable");
  const acceptedAt = new Date();
  const userAgentKey = irreversibleIdentifier(input.request.headers.get("user-agent") || "unknown-user-agent");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO user_consents (id, user_id, terms_version, privacy_version, accepted_at, user_agent_key) VALUES ($1, $2, $3, $4, $5, $6)",
      [randomUUID(), input.userId, input.termsVersion, input.privacyVersion, acceptedAt, userAgentKey],
    );
    await client.query("COMMIT");
    await recordAuditEvent({
      eventType: "registration_consent",
      outcome: "accepted",
      userId: input.userId,
      metadata: { termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, acceptedAt: acceptedAt.toISOString(), userAgentKey },
    });
    return acceptedAt;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
