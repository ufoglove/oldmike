import "server-only";
import { authConfigurationMissing } from "@/lib/auth-config";

/** Compatibility exports only. Better Auth owns password and session handling. */
export const COOKIE_NAME = "better-auth.session_token";
export function isAuthConfigurationMissing() { return authConfigurationMissing(); }
export function verifySessionToken() { return false; }
export function passwordMatches() { return false; }
export function createSessionToken(): never { throw new Error("custom_session_tokens_disabled"); }
