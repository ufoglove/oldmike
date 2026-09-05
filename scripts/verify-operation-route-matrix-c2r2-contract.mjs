import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { enabledModelModesForOperation, modelModeLabels } from "../lib/model-mode-contract.ts";
import { openClawChatOperationContracts } from "../lib/openclaw.ts";
import {
  decideEndpointFallback,
  modelOperationEndpointContracts,
  resolveModelRoute,
} from "../lib/model-route-catalog.ts";

assert.equal(modelModeLabels.AUTO, "老麥預設");
assert.deepEqual(enabledModelModesForOperation("PROJECT_CHAT"), ["AUTO"]);
const projectRoute = resolveModelRoute({ modeProfile: "AUTO", operation: "PROJECT_CHAT" });
assert.equal(projectRoute.endpointFamily, "CHAT_COMPLETIONS");
assert.equal(projectRoute.endpointFeatureState, "ENABLED");
assert.equal(projectRoute.routeProfile, "OLD_MIKE_DEFAULT");
assert.equal(projectRoute.upstreamBehavior, "DEFER_TO_EXISTING_DEFAULT");
assert.equal(projectRoute.modelOverride, null);
assert.deepEqual(modelOperationEndpointContracts.PROJECT_CHAT, {
  endpointFamily: "CHAT_COMPLETIONS",
  endpointFeatureState: "ENABLED",
});
assert.deepEqual(openClawChatOperationContracts.PROJECT_CHAT, {
  endpointFamily: "CHAT_COMPLETIONS",
  endpointFeatureState: "ENABLED",
});
for (const completionClass of ["PROVEN_NOT_SUBMITTED", "COMPLETION_UNKNOWN", "TERMINAL_REJECTED"]) {
  assert.equal(decideEndpointFallback({ completionClass }), "DENY_PROTOCOL_FALLBACK");
}

const [routeSource, runtimeSource, adapterSource, environment, authority, routeHandler] = await Promise.all([
  readFile(new URL("../lib/model-route-catalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/task-gateway-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/task-gateway-chat-completions-adapter.ts", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../contracts/project-chat-authority.contract.json", import.meta.url), "utf8"),
  readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
]);
const activeProjectChatCallGraph = `${routeSource}\n${runtimeSource}\n${adapterSource}`;
assert.doesNotMatch(activeProjectChatCallGraph, /PrivateResponsesTaskProviderAdapter|\/v1\/responses|\/tools\/invoke/u);
assert.doesNotMatch(activeProjectChatCallGraph, /OLD_MIKE_RESPONSES_|OLD_MIKE_TASK_GATEWAY_MODE/u);
assert.match(environment, /OPENCLAW_BASE_URL=/u);
assert.match(environment, /OPENCLAW_GATEWAY_TOKEN=/u);
assert.doesNotMatch(environment, /OLD_MIKE_RESPONSES_|OLD_MIKE_TASK_GATEWAY_MODE|\/v1\/responses|\/tools\/invoke/u);
const parsedAuthority = JSON.parse(authority);
assert.equal(parsedAuthority.chatEndpointFamily, "CHAT_COMPLETIONS_ONLY");
assert.equal(parsedAuthority.chatState, "ENABLED_EXISTING_PRIVATE_OPENCLAW_CONFIGURATION");
assert.equal(parsedAuthority.liveFeatureFlagRequired, false);
assert.equal(parsedAuthority.backendModelOverride, null);
assert.equal(parsedAuthority.logicalDefaultAgentAlias, "openclaw/default");
assert.doesNotMatch(routeHandler, /老麥 Task Gateway/u);
assert.match(routeHandler, /老麥服務目前無法使用/u);

console.log("OPERATION_ENDPOINT_FAMILY_MATRIX_C2R2=PASS");
console.log("ACTIVE_PROJECT_CHAT_CALL_GRAPH_RESPONSES_TOOLS_FALLBACK=ZERO");
console.log("PROJECT_CHAT_AUTHORITY_EXISTING_OPENCLAW_CONFIG_NO_NEW_ENV=PASS");
