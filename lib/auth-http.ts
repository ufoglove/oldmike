import "server-only";

import { NextResponse } from "next/server";
import { authConfiguration } from "@/lib/auth-config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ADMIN_PROVISIONING_BLOCKED_PATHS = new Set([
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/change-password",
  "/set-password",
]);
const ADMIN_ONLY_AUTH_ENDPOINTS = new Set([
  "/sign-in/email",
  "/get-session",
  "/sign-out",
  "/admin-assisted-password-recovery",
  "/portal-change-password",
  "/account/profile",
  "/admin/accounts",
  "/admin/accounts/sessions",
  "/admin/accounts/status",
  "/admin/accounts/temporary-password",
]);

export function authUnavailableResponse() {
  return NextResponse.json({ ok: false, code: "auth_configuration_missing", error: "Authentication is not safely configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export function assertAuthReady() {
  return authConfiguration().ready;
}

export function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const configured = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000");
    return new URL(origin).origin === configured.origin;
  } catch {
    return false;
  }
}

export function safeRedirect(value: unknown) {
  if (typeof value !== "string" || value.length > 200) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) return "/";
  return value;
}

export function guardAuthRequest(request: Request, path: string) {
  const config = authConfiguration();
  if (!config.ready) return authUnavailableResponse();
  // Public sign-up, Email verification/reset, and Better Auth's direct
  // password mutation endpoints are outside the admin-only account contract.
  // Password changes are available only through the Portal route that updates
  // provisioning state and revokes sessions atomically.
  if (ADMIN_PROVISIONING_BLOCKED_PATHS.has(path)) {
    return NextResponse.json({ ok: false, code: "admin_provisioning_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (config.accountProvisioningMode === "admin_only" && !ADMIN_ONLY_AUTH_ENDPOINTS.has(path)) {
    return NextResponse.json({ ok: false, code: "auth_endpoint_unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (MUTATING_METHODS.has(request.method) && !originAllowed(request)) return NextResponse.json({ ok: false, code: "origin_rejected", error: "Request origin was rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  // Better Auth owns rate limiting for its catch-all endpoints. Custom
  // account routes call guardSensitiveAuthRateLimit with a persistent DB key.
  return null;
}
