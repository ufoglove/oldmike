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
for (const operation of ["ACADEMIC_LANGUAGE", "REVIEW_STUDIO", "JOURNAL_SUBMISSION"]) {
  assert.deepEqual(enabledModelModesForOperation(operation), ["AUTO"]);
  const route = resolveModelRoute({ modeProfile: "AUTO", operation });
  assert.equal(route.endpointFamily, "CHAT_COMPLETIONS");
  assert.equal(route.endpointFeatureState, "ENABLED");
  assert.equal(route.modelOverride, null);
}
assert.deepEqual(enabledModelModesForOperation("PROPOSAL_GUIDANCE"), []);
assert.throws(() => resolveModelRoute({ modeProfile: "AUTO", operation: "PROPOSAL_GUIDANCE" }), /model_operation_not_allowed/);
assert.deepEqual(enabledModelModesForOperation("CODE_DATA_ASSIST"), []);
for (const profile of ["FAST", "ACADEMIC", "DEEP_REVIEW", "CODE_DATA"]) {
  assert.throws(() => resolveModelRoute({ modeProfile: profile, operation: "PROJECT_CHAT" }), /model_mode_disabled|model_operation_not_allowed/);
}

assert.deepEqual(modelOperationEndpointContracts, {
  PROJECT_CHAT: { endpointFamily: "RESPONSES", endpointFeatureState: "DISABLED_PENDING_LIVE_CAPABILITY" },
  ACADEMIC_LANGUAGE: { endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" },
  REVIEW_STUDIO: { endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" },
  JOURNAL_SUBMISSION: { endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" },
  PROPOSAL_GUIDANCE: { endpointFamily: "NONE", endpointFeatureState: "DISABLED_FIXTURE_ONLY" },
  CODE_DATA_ASSIST: { endpointFamily: "NONE", endpointFeatureState: "DISABLED_FUTURE_WORKER" },
});
assert.deepEqual(openClawChatOperationContracts, Object.fromEntries([
  "M01_TOPIC_LAB", "M01_S0_DRAFT", "M01_HORIZON", "M01_EVIDENCE", "M01_FIELD", "M01_WEB_PREVIEW",
  "ACADEMIC_LANGUAGE", "REVIEW_STUDIO", "JOURNAL_SUBMISSION",
].map((operation) => [operation, { endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" }])));
for (const completionClass of ["PROVEN_NOT_SUBMITTED", "COMPLETION_UNKNOWN", "TERMINAL_REJECTED"]) {
  assert.equal(decideEndpointFallback({ completionClass }), "DENY_PROTOCOL_FALLBACK");
}

const [proposal, environment, picker] = await Promise.all([
  readFile(new URL("../components/ProposalStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../components/ModelModePicker.tsx", import.meta.url), "utf8"),
]);
assert.doesNotMatch(proposal, /ModelModePicker/);
assert.match(proposal, /正式老麥建議尚未啟用/);
assert.doesNotMatch(environment, /OPENCLAW_MODEL|OLD_MIKE_RESPONSES_MODEL/);
assert.match(environment, /\/v1\/chat\/completions/);
assert.match(environment, /\/v1\/responses/);
assert.doesNotMatch(`${proposal}\n${picker}`, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|gpt-[a-z0-9.-]+/i);

console.log("OPERATION_ENDPOINT_FAMILY_MATRIX_C2R1=PASS");
console.log("M05_PUBLIC_GUIDANCE_MODE=DISABLED_FIXTURE_ONLY");
console.log("ENDPOINT_FALLBACK=DENIED_NO_PROTOCOL_GUESSING");
