export const AUTH_ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

// The union is retained for parsing legacy configuration and compatibility
// fixtures, but v1.5.17 accepts only `closed` as an operational policy.
export const REGISTRATION_MODES = ["closed", "invite_only", "open"] as const;
export type RegistrationMode = typeof REGISTRATION_MODES[number];
export const ACCOUNT_PROVISIONING_MODES = ["admin_only"] as const;
export type AccountProvisioningMode = typeof ACCOUNT_PROVISIONING_MODES[number];

function registrationMode(): RegistrationMode | null {
  const value = process.env.REGISTRATION_MODE?.trim() || "closed";
  return value === "closed" ? "closed" : null;
}

function accountProvisioningMode(): AccountProvisioningMode | null {
  const value = process.env.ACCOUNT_PROVISIONING_MODE?.trim() || "admin_only";
  return ACCOUNT_PROVISIONING_MODES.includes(value as AccountProvisioningMode) ? value as AccountProvisioningMode : null;
}

function present(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function isSafeFixtureAuthUrl(value: string | undefined) {
  if (!present(value)) return false;
  try {
    const url = new URL(value as string);
    return url.protocol === "http:" && !url.username && !url.password && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function isSafeFixtureDatabaseUrl(value: string | undefined) {
  if (!present(value)) return false;
  try {
    const url = new URL(value as string);
    return ["postgres:", "postgresql:"].includes(url.protocol) && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

export function isFixtureMode() {
  return process.env.INTEGRATION_TEST_MODE === "1"
    && process.env.TEST_FIXTURE === "1"
    && isSafeFixtureAuthUrl(process.env.BETTER_AUTH_URL)
    && isSafeFixtureDatabaseUrl(process.env.DATABASE_URL);
}

export function isFixtureConfigurationInvalid() {
  const fixtureSignalPresent = process.env.INTEGRATION_TEST_MODE === "1" || process.env.TEST_FIXTURE === "1";
  return fixtureSignalPresent && !isFixtureMode();
}

export function authConfiguration() {
  const missing = AUTH_ENV_KEYS.filter((key) => !present(process.env[key]));
  if (isFixtureConfigurationInvalid()) missing.push("SAFE_INTEGRATION_FIXTURE_ENV" as typeof AUTH_ENV_KEYS[number]);
  const mode = registrationMode();
  if (!mode) missing.push("VALID_REGISTRATION_MODE" as typeof AUTH_ENV_KEYS[number]);
  const provisioningMode = accountProvisioningMode();
  if (!provisioningMode) missing.push("VALID_ACCOUNT_PROVISIONING_MODE" as typeof AUTH_ENV_KEYS[number]);
  return {
    ready: missing.length === 0,
    missing,
    registrationMode: mode || "closed",
    registrationEnabled: false,
    accountProvisioningMode: provisioningMode || "admin_only",
    legacyAuthEnabled: process.env.LEGACY_AUTH_ENABLED === "true",
  };
}

export function authConfigurationMissing() {
  return !authConfiguration().ready;
}

export function publicAuthStatus() {
  const config = authConfiguration();
  return {
    ready: config.ready,
    registrationMode: config.registrationMode,
    registrationEnabled: config.registrationEnabled,
    accountProvisioningMode: config.accountProvisioningMode,
    legacyAuthEnabled: config.legacyAuthEnabled,
  };
}
