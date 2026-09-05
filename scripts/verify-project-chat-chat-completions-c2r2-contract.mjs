import assert from "node:assert/strict";
import { createServer } from "node:http";

import { authorizedProjectContextHash } from "../lib/task-context-contract.ts";
import { resolveModelRoute } from "../lib/model-route-catalog.ts";
import { PrivateChatCompletionsTaskProviderAdapter } from "../lib/task-gateway-chat-completions-adapter.ts";
import { getServerTaskGateway } from "../lib/task-gateway-runtime.ts";
import {
  TASK_GATEWAY_CONTRACT_VERSION,
  parseTaskEnvelope,
} from "../lib/task-gateway-contract.ts";
import {
  ServerOnlyTaskGateway,
  TaskProviderExecutionError,
  resolveTaskGatewayFeatureState,
} from "../lib/task-gateway.ts";

const secretCanary = "fixture-secret-c2r2-chat-completions";
const tenantId = "tenant-c2r2-0001";
const projectId = "project-c2r2-0001";
const productionSkills = new Set(["scientific-writing", "scientific-critical-thinking"]);
const observations = [];

const contextBase = {
  tenantId,
  projectId,
  project: {
    title: "專案測試標題",
    status: "ACTIVE",
    storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE",
  },
  documents: [{
    logicalId: "document-private-id-not-for-egress",
    version: 2,
    type: "MANUSCRIPT",
    title: "研究稿",
    stage: "S4_DRAFT",
    contentHash: "a".repeat(64),
    body: "這是受授權且受長度限制的研究脈絡。",
  }],
  workflowEvents: [{
    fromStage: "S3_REVIEW",
    toStage: "S4_DRAFT",
    stageDetail: "等待人工核對",
    eventHash: "b".repeat(64),
  }],
};
const context = { ...contextBase, contextHash: authorizedProjectContextHash(contextBase) };

function envelope(message, suffix) {
  return parseTaskEnvelope({
    contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
    actionId: `chat:c2r2:${suffix}`,
    taskId: `chat:c2r2:task:${suffix}`,
    tenantId,
    projectId,
    operation: "PROJECT_CHAT",
    idempotencyKey: `chat-c2r2-${suffix}`,
    createdAt: "2026-08-23T14:30:00.000Z",
    payload: {
      kind: "PROJECT_CHAT_MESSAGE",
      message,
      contextHash: context.contextHash,
      modeProfile: "AUTO",
    },
    skillIds: ["scientific-writing", "scientific-critical-thinking"],
    toolIds: ["PORTAL_FORMAL_DATA_READ"],
    continuation: null,
  }, productionSkills);
}

const server = createServer((request, response) => {
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; });
  request.on("end", () => {
    const body = JSON.parse(raw);
    observations.push({ method: request.method, path: request.url, headers: request.headers, body, raw });
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.headers.authorization, `Bearer ${secretCanary}`);
    assert.deepEqual(Object.keys(body).sort(), ["messages", "model", "stream", "user"]);
    assert.equal(body.model, "openclaw/default");
    assert.equal(body.stream, false);
    assert.match(body.user, /^old-mike-project-chat:[a-f0-9]{64}$/u);
    assert.equal(raw.includes(tenantId), false);
    assert.equal(raw.includes(projectId), false);
    assert.equal(raw.includes("document-private-id-not-for-egress"), false);
    assert.equal(raw.includes(secretCanary), false);
    assert.deepEqual(body.messages.map(({ role }) => role), ["system", "user"]);
    const authorizedPayload = JSON.parse(body.messages[1].content);
    assert.deepEqual(Object.keys(authorizedPayload).sort(), ["authorizedProjectContext", "operation", "userMessage"]);
    assert.equal(authorizedPayload.operation, "PROJECT_CHAT");
    assert.equal(authorizedPayload.authorizedProjectContext.documents.length, 1);
    assert.equal(authorizedPayload.authorizedProjectContext.workflowEvents.length, 1);

    if (authorizedPayload.userMessage === "http-non200") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    if (authorizedPayload.userMessage === "malformed") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "chat.completion", choices: [] }));
      return;
    }
    if (authorizedPayload.userMessage === "timeout") return;
    const content = authorizedPayload.userMessage === "secret-output"
      ? secretCanary
      : authorizedPayload.userMessage === "identity-output"
        ? "DeepSeek provider identity"
        : "老麥固定且未驗證的專案回覆";
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      harmlessAdditive: true,
    }));
  });
});

await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

function gateway(timeoutMs = 200) {
  return new ServerOnlyTaskGateway({
    featureState: "PRIVATE_CHAT_COMPLETIONS",
    adapter: new PrivateChatCompletionsTaskProviderAdapter({
      baseUrl,
      bearerToken: secretCanary,
      fixtureMode: true,
      timeoutMs,
      maxOutputBytes: 32_768,
    }),
  });
}

async function expectProviderError(promise, completionClass, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TaskProviderExecutionError);
    assert.equal(error.completionClass, completionClass);
    assert.equal(error.code, code);
    return true;
  });
}

try {
  assert.equal(resolveTaskGatewayFeatureState({ OPENCLAW_BASE_URL: baseUrl, OPENCLAW_GATEWAY_TOKEN: secretCanary }), "PRIVATE_CHAT_COMPLETIONS");
  assert.equal(resolveTaskGatewayFeatureState({ OPENCLAW_BASE_URL: baseUrl }), "DISABLED");
  assert.equal(resolveTaskGatewayFeatureState({ OPENCLAW_GATEWAY_TOKEN: secretCanary }), "DISABLED");

  const successGateway = getServerTaskGateway(
    resolveModelRoute({ modeProfile: "AUTO", operation: "PROJECT_CHAT" }),
    { OPENCLAW_BASE_URL: baseUrl, OPENCLAW_GATEWAY_TOKEN: secretCanary },
  );
  const successEnvelope = envelope("success", "success01");
  const success = await successGateway.execute(successEnvelope, new AbortController().signal, context);
  assert.equal(success.output.content, "老麥固定且未驗證的專案回覆");
  assert.equal(success.output.label, "老麥");
  assert.equal(success.output.verificationState, "UNVERIFIED");
  assert.equal(success.receipt.state, "COMPLETED");
  assert.equal(success.receipt.sanitizedStatus, "PROVIDER_COMPLETE");
  assert.equal(success.receipt.attemptClass, "FIRST");
  assert.equal(success.receipt.dataEgress, "BOUNDED_AUTHORIZED_PROJECT_CONTEXT");
  const afterFirstSuccess = observations.length;
  const replay = await successGateway.execute(successEnvelope, new AbortController().signal, context);
  assert.equal(replay.receipt.attemptClass, "IDEMPOTENT_REPLAY");
  assert.equal(observations.length, afterFirstSuccess, "idempotent replay must not submit another request");

  const mismatchedContext = { ...context, tenantId: "tenant-c2r2-other" };
  await expectProviderError(gateway().execute(envelope("success", "tenant01"), new AbortController().signal, mismatchedContext), "PROVEN_NOT_SUBMITTED", "task_project_context_binding_mismatch");
  assert.equal(observations.length, afterFirstSuccess, "cross-tenant rejection must occur before submission");

  await expectProviderError(gateway().execute(envelope("http-non200", "http0001"), new AbortController().signal, context), "TERMINAL_PROVIDER_REJECTED", "task_provider_http_rejected");
  await expectProviderError(gateway().execute(envelope("malformed", "shape001"), new AbortController().signal, context), "TERMINAL_PROVIDER_REJECTED", "task_provider_response_shape_invalid");
  await expectProviderError(gateway().execute(envelope("secret-output", "secret01"), new AbortController().signal, context), "TERMINAL_PROVIDER_REJECTED", "task_provider_secret_canary_rejected");
  await expectProviderError(gateway().execute(envelope("identity-output", "ident001"), new AbortController().signal, context), "TERMINAL_PROVIDER_REJECTED", "task_provider_identity_disclosure_rejected");
  await expectProviderError(gateway(35).execute(envelope("timeout", "timeout1"), new AbortController().signal, context), "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED", "task_provider_timeout_or_cancel");

  assert.throws(() => new PrivateChatCompletionsTaskProviderAdapter({ baseUrl: `${baseUrl}/v1/responses`, bearerToken: secretCanary, fixtureMode: true }), /task_provider_base_url_rejected/u);
  assert.throws(() => new PrivateChatCompletionsTaskProviderAdapter({ baseUrl, bearerToken: "short", fixtureMode: true }), /task_provider_credential_unavailable/u);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

assert.equal(observations.length, 6, "each non-replay provider scenario must submit exactly one request");
assert.ok(observations.every((item) => item.path === "/v1/chat/completions"));
assert.ok(observations.every((item) => !item.raw.includes("/v1/responses") && !item.raw.includes("/tools/invoke")));

console.log("PROJECT_CHAT_CHAT_COMPLETIONS_C2R2_CONTRACT=PASS");
console.log("PROJECT_CHAT_SUBMISSION_COUNT=6_EXACT_ONE_PER_SCENARIO_NO_RETRY_NO_FALLBACK");
console.log("TASK_GATEWAY_RECEIPT_IDEMPOTENCY_CONTEXT_OUTPUT_GATES=PASS");
