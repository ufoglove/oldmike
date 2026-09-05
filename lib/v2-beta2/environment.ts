export function validateV2Beta2DisposableDatabaseUrl(value: unknown) {
  if (typeof value !== "string" || !value) throw new Error("beta2_disposable_database_url_missing");
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
    || !parsed.pathname.slice(1).startsWith("old_mike_beta2_disposable_")
    || parsed.searchParams.get("application_name") !== "old_mike_beta2_disposable"
    || parsed.username !== "old_mike_beta2_app_local"
    || parsed.password) throw new Error("beta2_disposable_database_url_invalid");
  return parsed.toString();
}

export function v2Beta2FakeProviderEnabled(environment: Record<string, string | undefined> = process.env) {
  if (environment.NODE_ENV !== "development"
    || environment.INTEGRATION_TEST_MODE !== "1"
    || environment.TEST_FIXTURE !== "1"
    || environment.OLD_MIKE_V2_BETA2_ENABLED !== "1"
    || environment.OLD_MIKE_V2_BETA2_FAKE_PROVIDER !== "1"
    || environment.OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED === "1") return false;
  try {
    validateV2Beta2DisposableDatabaseUrl(environment.BETA2_DISPOSABLE_DATABASE_URL);
    return true;
  } catch {
    return false;
  }
}

export type V2Beta2ProviderRuntimeDecision =
  | { mode: "LOCAL_DETERMINISTIC_FIXTURE"; reasonCode: null }
  | { mode: "DISABLED"; reasonCode: "beta2_provider_disabled" | "beta2_live_provider_not_authorized" | "beta2_provider_configuration_invalid" };

export function resolveV2Beta2ProviderRuntime(environment: Record<string, string | undefined> = process.env): V2Beta2ProviderRuntimeDecision {
  const liveFlag = environment.OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED;
  const adapterFlag = environment.OLD_MIKE_V2_BETA2_OPENCLAW_ADAPTER_ENABLED;
  const lookupAuthority = environment.OLD_MIKE_V2_BETA2_DURABLE_LOOKUP_AUTHORITY;
  if (liveFlag === "1" || adapterFlag === "1") return { mode: "DISABLED", reasonCode: "beta2_live_provider_not_authorized" };
  if ((liveFlag !== undefined && liveFlag !== "0")
    || (adapterFlag !== undefined && adapterFlag !== "0")
    || (lookupAuthority !== undefined && lookupAuthority !== "0")) return { mode: "DISABLED", reasonCode: "beta2_provider_configuration_invalid" };
  if (v2Beta2FakeProviderEnabled(environment)) {
    if (adapterFlag !== "0" || lookupAuthority !== "0") return { mode: "DISABLED", reasonCode: "beta2_provider_configuration_invalid" };
    return { mode: "LOCAL_DETERMINISTIC_FIXTURE", reasonCode: null };
  }
  return { mode: "DISABLED", reasonCode: "beta2_provider_disabled" };
}

export function v2Beta2LocalFixtureEnabled(environment: Record<string, string | undefined> = process.env) {
  if (!v2Beta2FakeProviderEnabled(environment)
    || environment.OLD_MIKE_V2_BETA2_FAKE_AUTH !== "1"
    || environment.DATABASE_URL !== undefined) return false;
  return true;
}
