import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

import { TASK_GATEWAY_CONTRACT_VERSION, parseTaskEnvelope, taskGatewayHash } from "../lib/task-gateway-contract.ts";
import { authorizedProjectContextHash } from "../lib/task-context-contract.ts";
import { resolveModelRoute } from "../lib/model-route-catalog.ts";
import { getServerTaskGateway } from "../lib/task-gateway-runtime.ts";
import { PrivateResponsesTaskProviderAdapter, isAllowedPrivateResponsesEndpoint } from "../lib/task-gateway-responses-adapter.ts";
import { ServerOnlyTaskGateway } from "../lib/task-gateway.ts";

const route = resolveModelRoute({ modeProfile: "AUTO", operation: "PROJECT_CHAT" });
assert.equal(route.endpointFamily, "RESPONSES");
assert.equal(route.endpointFeatureState, "DISABLED_PENDING_LIVE_CAPABILITY");
assert.throws(() => getServerTaskGateway(route, {}), /task_gateway_disabled/);
assert.equal(isAllowedPrivateResponsesEndpoint("http://127.0.0.1:18080/v1/responses", true), true);
assert.equal(isAllowedPrivateResponsesEndpoint("http://127.0.0.1:18080/v1/chat/completions", true), false);
assert.equal(isAllowedPrivateResponsesEndpoint("http://127.0.0.1:18080/tools/invoke", true), false);

const baseContext = {
  tenantId: "workspace-c2r1-0001",
  projectId: "project-c2r1-0001",
  project: { title: "固定專案", status: "ACTIVE", storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE" },
  documents: [],
  workflowEvents: [],
};
const context = { ...baseContext, contextHash: authorizedProjectContextHash(baseContext) };
const envelope = parseTaskEnvelope({
  contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
  actionId: "c2r1:responses:action",
  taskId: "c2r1:responses:task",
  tenantId: context.tenantId,
  projectId: context.projectId,
  operation: "PROJECT_CHAT",
  idempotencyKey: "c2r1:responses:idempotency",
  createdAt: "2026-08-23T08:00:00.000Z",
  payload: { kind: "PROJECT_CHAT_MESSAGE", message: "請整理目前狀態。", contextHash: context.contextHash, modeProfile: "AUTO" },
  skillIds: ["scientific-writing"],
  toolIds: ["PORTAL_FORMAL_DATA_READ"],
  continuation: null,
}, new Set(["scientific-writing"]));

const secretCanary = "fixture-secret-c2r1-responses";
let calls = 0;
const server = createServer((request, response) => {
  calls += 1;
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; });
  request.on("end", () => {
    const body = JSON.parse(raw);
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/v1/responses");
    assert.deepEqual(Object.keys(body).sort(), ["input", "stream"]);
    assert.equal("model" in body, false);
    assert.equal(raw.includes(secretCanary), false);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "老麥隔離回覆" }] }] }));
  });
});
await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
const address = server.address();
assert.ok(address && typeof address === "object");
try {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl: `http://127.0.0.1:${address.port}/v1/responses`, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 4_096, fixtureMode: true, stream: false });
  const gateway = new ServerOnlyTaskGateway({ featureState: "PRIVATE_RESPONSES", adapter });
  const result = await gateway.execute(envelope, new AbortController().signal, context);
  assert.equal(result.output.content, "老麥隔離回覆");
  assert.equal(taskGatewayHash(result.output), result.receipt.outputHash);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
assert.equal(calls, 1);

const adapterSource = await readFile(new URL("../lib/task-gateway-responses-adapter.ts", import.meta.url), "utf8");
assert.doesNotMatch(adapterSource, /\bmodel\??\s*:/, "Responses adapter must not accept or inject a model override");
assert.doesNotMatch(adapterSource, /\/v1\/chat\/completions|\/tools\/invoke/);

console.log("STRICT_RESPONSES_ISOLATION_C2R1_FIXTURE=PASS");
console.log("PROJECT_CHAT_RESPONSES_DEFAULT=DISABLED_PENDING_LIVE_CAPABILITY");
