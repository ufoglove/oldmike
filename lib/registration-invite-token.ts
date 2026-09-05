import { createHmac, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function normalizeInviteEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateRegistrationInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function isRegistrationInviteToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

function keyedDigest(namespace: string, value: string, secret: string) {
  return createHmac("sha256", secret).update(`${namespace}\0${value}`, "utf8").digest("hex");
}

export function registrationInviteKeys(input: { token: string; email: string; secret: string }) {
  if (!isRegistrationInviteToken(input.token)) throw new Error("invalid_invitation_token");
  const email = normalizeInviteEmail(input.email);
  if (!email) throw new Error("invalid_invitation_email");
  if (input.secret.length < 32) throw new Error("invalid_invitation_secret");
  return {
    tokenKey: keyedDigest("old-mike-registration-invite-token-v1", input.token, input.secret),
    emailKey: keyedDigest("old-mike-registration-invite-email-v1", email, input.secret),
  };
}

export function registrationInviteUrl(baseUrl: string, token: string) {
  if (!isRegistrationInviteToken(token)) throw new Error("invalid_invitation_token");
  const url = new URL("/register", baseUrl);
  url.hash = `invite=${encodeURIComponent(token)}`;
  return url.toString();
}
