import "server-only";

import {
  ModelModeContractError,
  parseModelModeProfile,
  type ModelModeProfile,
  type ModelRoutingOperation,
} from "./model-mode-contract.ts";

export type ModelRouteProfile = "OLD_MIKE_DEFAULT" | "OWNER_MANAGED_FAST" | "OWNER_MANAGED_ACADEMIC" | "OWNER_MANAGED_DEEP_REVIEW" | "ISOLATED_CODE_DATA_WORKER";
export type ModelRouteFeatureState = "ENABLED" | "DISABLED_PENDING_EXACT_EXTERNAL_SETUP";
export type ModelRouteCostBucket = "LOW" | "MEDIUM" | "HIGH" | "ISOLATED_UNKNOWN";
export type ProviderEndpointFamily = "CHAT_COMPLETIONS" | "RESPONSES" | "NONE";
export type ProviderEndpointFeatureState = "ENABLED" | "DISABLED_PENDING_LIVE_CAPABILITY" | "DISABLED_FIXTURE_ONLY" | "DISABLED_FUTURE_WORKER";

export const modelOperationEndpointContracts: Readonly<Record<ModelRoutingOperation, Readonly<{
  endpointFamily: ProviderEndpointFamily;
  endpointFeatureState: ProviderEndpointFeatureState;
}>>> = Object.freeze({
  PROJECT_CHAT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ACADEMIC_LANGUAGE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  REVIEW_STUDIO: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  JOURNAL_SUBMISSION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  PROPOSAL_GUIDANCE: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  CODE_DATA_ASSIST: Object.freeze({ endpointFamily: "NONE", endpointFeatureState: "DISABLED_FUTURE_WORKER" }),
  SUBMISSION_NAVIGATOR: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ONE_CLICK_INSPIRATION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_LITERATURE_REVIEW: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_GAP_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_THEORY_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_DESIGN_ANALYSIS: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_ETHICS_DRAFT: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_ROUTE_SECTION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),
  ASSIST_REVIEWER_SIMULATION: Object.freeze({ endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }),

});

export type ResolvedModelRoute = {
  modeProfile: ModelModeProfile;
  operation: ModelRoutingOperation;
  endpointFamily: Exclude<ProviderEndpointFamily, "NONE">;
  endpointFeatureState: "ENABLED" | "DISABLED_PENDING_LIVE_CAPABILITY";
  routeProfile: ModelRouteProfile;
  featureState: "ENABLED";
  upstreamBehavior: "DEFER_TO_EXISTING_DEFAULT" | "EXPLICIT_OWNER_ROUTE" | "ISOLATED_FUTURE_WORKER";
  modelOverride: null;
  timeoutMs: number;
  inputLimitBytes: number;
  outputLimitBytes: number;
  costBucket: ModelRouteCostBucket;
};

type CatalogEntry = Omit<ResolvedModelRoute, "operation" | "featureState" | "endpointFamily" | "endpointFeatureState"> & {
  featureState: ModelRouteFeatureState;
  allowedOperations: readonly ModelRoutingOperation[];
};

const routeCatalog: Readonly<Record<ModelModeProfile, CatalogEntry>> = Object.freeze({
  AUTO: {
    modeProfile: "AUTO",
    routeProfile: "OLD_MIKE_DEFAULT",
    featureState: "ENABLED",
    upstreamBehavior: "DEFER_TO_EXISTING_DEFAULT",
    modelOverride: null,
    allowedOperations: ["PROJECT_CHAT", "ACADEMIC_LANGUAGE", "REVIEW_STUDIO", "JOURNAL_SUBMISSION", "PROPOSAL_GUIDANCE", "SUBMISSION_NAVIGATOR", "ONE_CLICK_INSPIRATION", "ASSIST_LITERATURE_REVIEW", "ASSIST_GAP_ANALYSIS", "ASSIST_THEORY_ANALYSIS", "ASSIST_DESIGN_ANALYSIS", "ASSIST_ETHICS_DRAFT", "ASSIST_ROUTE_SECTION", "ASSIST_REVIEWER_SIMULATION"],
    timeoutMs: 20_000,
    inputLimitBytes: 65_536,
    outputLimitBytes: 65_536,
    costBucket: "MEDIUM",
  },
  FAST: {
    modeProfile: "FAST",
    routeProfile: "OWNER_MANAGED_FAST",
    featureState: "DISABLED_PENDING_EXACT_EXTERNAL_SETUP",
    upstreamBehavior: "EXPLICIT_OWNER_ROUTE",
    modelOverride: null,
    allowedOperations: ["PROJECT_CHAT", "ACADEMIC_LANGUAGE", "SUBMISSION_NAVIGATOR", "ONE_CLICK_INSPIRATION", "ASSIST_LITERATURE_REVIEW", "ASSIST_GAP_ANALYSIS", "ASSIST_THEORY_ANALYSIS", "ASSIST_DESIGN_ANALYSIS", "ASSIST_ETHICS_DRAFT", "ASSIST_ROUTE_SECTION", "ASSIST_REVIEWER_SIMULATION"],
    timeoutMs: 12_000,
    inputLimitBytes: 32_768,
    outputLimitBytes: 32_768,
    costBucket: "LOW",
  },
  ACADEMIC: {
    modeProfile: "ACADEMIC",
    routeProfile: "OWNER_MANAGED_ACADEMIC",
    featureState: "DISABLED_PENDING_EXACT_EXTERNAL_SETUP",
    upstreamBehavior: "EXPLICIT_OWNER_ROUTE",
    modelOverride: null,
    allowedOperations: ["ACADEMIC_LANGUAGE", "JOURNAL_SUBMISSION", "SUBMISSION_NAVIGATOR", "ONE_CLICK_INSPIRATION", "ASSIST_LITERATURE_REVIEW", "ASSIST_GAP_ANALYSIS", "ASSIST_THEORY_ANALYSIS", "ASSIST_DESIGN_ANALYSIS", "ASSIST_ETHICS_DRAFT", "ASSIST_ROUTE_SECTION", "ASSIST_REVIEWER_SIMULATION"],
    timeoutMs: 45_000,
    inputLimitBytes: 160_000,
    outputLimitBytes: 120_000,
    costBucket: "MEDIUM",
  },
  DEEP_REVIEW: {
    modeProfile: "DEEP_REVIEW",
    routeProfile: "OWNER_MANAGED_DEEP_REVIEW",
    featureState: "DISABLED_PENDING_EXACT_EXTERNAL_SETUP",
    upstreamBehavior: "EXPLICIT_OWNER_ROUTE",
    modelOverride: null,
    allowedOperations: ["REVIEW_STUDIO", "JOURNAL_SUBMISSION"],
    timeoutMs: 90_000,
    inputLimitBytes: 220_000,
    outputLimitBytes: 160_000,
    costBucket: "HIGH",
  },
  CODE_DATA: {
    modeProfile: "CODE_DATA",
    routeProfile: "ISOLATED_CODE_DATA_WORKER",
    featureState: "DISABLED_PENDING_EXACT_EXTERNAL_SETUP",
    upstreamBehavior: "ISOLATED_FUTURE_WORKER",
    modelOverride: null,
    allowedOperations: ["CODE_DATA_ASSIST"],
    timeoutMs: 60_000,
    inputLimitBytes: 65_536,
    outputLimitBytes: 65_536,
    costBucket: "ISOLATED_UNKNOWN",
  },
});

export class ModelRouteContractError extends ModelModeContractError {
  constructor(code: string, status = 422) {
    super(code, status);
    this.name = "ModelRouteContractError";
  }
}

export function resolveModelRoute(input: { modeProfile: unknown; operation: ModelRoutingOperation }): ResolvedModelRoute {
  const modeProfile = parseModelModeProfile(input.modeProfile);
  const entry = routeCatalog[modeProfile];
  if (!entry.allowedOperations.includes(input.operation)) throw new ModelRouteContractError("model_operation_not_allowed");
  if (entry.featureState !== "ENABLED") throw new ModelRouteContractError("model_mode_disabled", 503);
  const endpoint = modelOperationEndpointContracts[input.operation];
  if (endpoint.endpointFamily === "NONE" || !["ENABLED", "DISABLED_PENDING_LIVE_CAPABILITY"].includes(endpoint.endpointFeatureState)) throw new ModelRouteContractError("model_endpoint_family_disabled", 503);
  const { allowedOperations: _allowedOperations, ...resolved } = entry;
  return {
    ...resolved,
    featureState: "ENABLED",
    operation: input.operation,
    endpointFamily: endpoint.endpointFamily,
    endpointFeatureState: endpoint.endpointFeatureState,
  } as ResolvedModelRoute;
}

export function decideEndpointFallback(_input: { completionClass: "PROVEN_NOT_SUBMITTED" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED" }) {
  return "DENY_PROTOCOL_FALLBACK" as const;
}

export type ModelFallbackDecision = "ALLOW_ONE_FALLBACK" | "DENY_MANUAL_MODE_LOCKED" | "DENY_COMPLETION_NOT_PROVEN" | "DENY_FALLBACK_BUDGET_EXHAUSTED" | "DENY_NO_ENABLED_FALLBACK";

export function decideModelFallback(input: { requestedMode: ModelModeProfile; completionClass: "PROVEN_NOT_SUBMITTED" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED"; fallbackAttempts: number; enabledCandidateExists: boolean }): ModelFallbackDecision {
  if (input.requestedMode !== "AUTO") return "DENY_MANUAL_MODE_LOCKED";
  if (input.completionClass !== "PROVEN_NOT_SUBMITTED") return "DENY_COMPLETION_NOT_PROVEN";
  if (input.fallbackAttempts >= 1) return "DENY_FALLBACK_BUDGET_EXHAUSTED";
  if (!input.enabledCandidateExists) return "DENY_NO_ENABLED_FALLBACK";
  return "ALLOW_ONE_FALLBACK";
}
