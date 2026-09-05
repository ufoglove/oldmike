import "server-only";

import { TaskGatewayContractError } from "./task-gateway-contract.ts";
import { PrivateChatCompletionsTaskProviderAdapter } from "./task-gateway-chat-completions-adapter.ts";
import { ServerOnlyTaskGateway, resolveTaskGatewayFeatureState } from "./task-gateway.ts";
import type { ResolvedModelRoute } from "./model-route-catalog.ts";

let runtime: ServerOnlyTaskGateway | null = null;

export function getServerTaskGateway(route: ResolvedModelRoute, environment: Readonly<Record<string, string | undefined>> = process.env) {
  if (route.operation !== "PROJECT_CHAT" || route.endpointFamily !== "CHAT_COMPLETIONS" || route.endpointFeatureState !== "ENABLED" || route.routeProfile !== "OLD_MIKE_DEFAULT" || route.modelOverride !== null || route.upstreamBehavior !== "DEFER_TO_EXISTING_DEFAULT") throw new TaskGatewayContractError("task_model_route_rejected", 503);
  const state = resolveTaskGatewayFeatureState(environment);
  if (state !== "PRIVATE_CHAT_COMPLETIONS") throw new TaskGatewayContractError("task_gateway_disabled", 503);
  if (runtime) return runtime;
  const baseUrl = environment.OPENCLAW_BASE_URL;
  const bearerToken = environment.OPENCLAW_GATEWAY_TOKEN;
  if (!baseUrl || !bearerToken) throw new TaskGatewayContractError("task_provider_configuration_missing", 503);
  runtime = new ServerOnlyTaskGateway({
    featureState: state,
    adapter: new PrivateChatCompletionsTaskProviderAdapter({
      baseUrl,
      bearerToken,
      route,
      timeoutMs: route.timeoutMs,
      maxOutputBytes: route.outputLimitBytes,
    }),
  });
  return runtime;
}
