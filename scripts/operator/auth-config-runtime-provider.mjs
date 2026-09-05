export const AUTH_CONFIG_RUNTIME_PROVIDER_CONTRACT_VERSION = "1.5.13";

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function readAuthConfigRuntimeEvidence({ expectedGeneration, environment = process.env } = {}) {
  const generationPresent = present(environment.AUTH_E2E_CONFIG_GENERATION);
  const expectsGeneration = typeof expectedGeneration === "string" && expectedGeneration.length > 0;
  return Object.freeze({
    registrationMode: present(environment.REGISTRATION_MODE)
      ? environment.REGISTRATION_MODE
      : "MISSING",
    controlledEmailKeyPresent: present(environment.AUTH_E2E_CONTROLLED_EMAIL),
    externalSearchDisabled: environment.OPENCLAW_EXTERNAL_SEARCH === "false",
    configGenerationPresent: generationPresent,
    configGenerationMatches: expectsGeneration
      ? generationPresent && environment.AUTH_E2E_CONFIG_GENERATION === expectedGeneration
      : !generationPresent,
    sensitiveValuesExposed: false,
  });
}
