import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TASK_GATEWAY_CONTRACT_VERSION,
  parseTaskEnvelope,
  taskGatewayHash,
} from "../lib/task-gateway-contract.ts";
import { ServerOnlyTaskGateway } from "../lib/task-gateway.ts";
import {
  PrivateResponsesTaskProviderAdapter,
  TaskProviderExecutionError,
} from "../lib/task-gateway-responses-adapter.ts";
import {
  authorizedProjectContextHash,
} from "../lib/task-context-repository.ts";
import {
  parseProjectChatRequest,
  parseProjectCreateRequest,
} from "../lib/foundation-runtime-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const secretCanary = "fixture-bearer-secret-never-output";

const intake = {
  workingTitle: "以可重現證據改善高等教育回饋",
  domain: "AI × 教育",
  outputTrack: "SCI",
  problemContext: "需要以可驗證方法比較不同回饋設計。",
  targetUsers: "高等教育研究者與教師",
  expectedContribution: "提供可重現的研究設計與限制說明。",
  existingData: "目前只有研究者整理的匿名摘要。",
  availableData: "可取得經核准的匿名問卷與課程指標。",
  methodIdea: "預先註冊的準實驗與敏感度分析。",
  timeline: "十二個月",
  constraints: "不得處理可識別個資。",
  ethicsPrivacyRisks: "需先通過倫理與資料使用審查。",
  unresolvedItems: "樣本數與場域仍待確認。",
};

const createRequest = parseProjectCreateRequest({
  intake,
  projectId: "placeholder",
  previewHash: "0".repeat(64),
  confirmed: true,
  confirmationText: "我確認以上資料，請建立正式研究專案",
}, { permitComputedIdentity: true });
assert.equal(createRequest.confirmed, true);
assert.match(createRequest.projectId, /^[a-z0-9-]+$/);
assert.match(createRequest.previewHash, /^[a-f0-9]{64}$/);
assert.throws(() => parseProjectCreateRequest({ ...createRequest, confirmationText: "yes" }), /human_confirmation_required/);
assert.throws(() => parseProjectCreateRequest({ ...createRequest, previewHash: "f".repeat(64) }), /preview_expired/);
assert.throws(() => parseProjectCreateRequest({ ...createRequest, projectId: "other-project" }), /project_id_mismatch/);
console.log("CATEGORY_04_PREVIEW_CONFIRMATION_IDEMPOTENCY=PASS");

const chat = parseProjectChatRequest({ projectId: createRequest.projectId, message: "請整理目前證據狀態。", idempotencyKey: "chat:fixture:0001", modeProfile: "AUTO" });
assert.equal(chat.message, "請整理目前證據狀態。");
assert.throws(() => parseProjectChatRequest({ ...chat, message: "" }), /invalid_chat_message/);
assert.throws(() => parseProjectChatRequest({ ...chat, projectId: "../escape" }), /invalid_project_id/);
assert.throws(() => parseProjectChatRequest({ ...chat, unexpected: true }), /invalid_chat_request/);

const baseContext = {
  tenantId: "workspace-fixture-0001",
  projectId: createRequest.projectId,
  project: { title: intake.workingTitle, status: "ACTIVE", storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE" },
  documents: [{ logicalId: "s0-intake", version: 1, type: "RESEARCH_PLAN", title: intake.workingTitle, stage: "S0_INTAKE", contentHash: sha256("body"), body: "受限的 S0 正式內容" }],
  workflowEvents: [{ fromStage: "S0_INTAKE", toStage: "S0_INTAKE", stageDetail: "PROJECT_CREATED", eventHash: sha256("event") }],
};
const context = { ...baseContext, contextHash: authorizedProjectContextHash(baseContext) };

const envelope = parseTaskEnvelope({
  contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
  actionId: "chat:fixture:action-0001",
  taskId: "chat:fixture:task-0001",
  tenantId: context.tenantId,
  projectId: context.projectId,
  operation: "PROJECT_CHAT",
  idempotencyKey: "chat:fixture:0001",
  createdAt: "2026-08-23T08:00:00.000Z",
  payload: { kind: "PROJECT_CHAT_MESSAGE", message: chat.message, contextHash: context.contextHash, modeProfile: chat.modeProfile },
  skillIds: ["scientific-writing", "scientific-critical-thinking"],
  toolIds: ["PORTAL_FORMAL_DATA_READ"],
  continuation: null,
}, new Set(["scientific-writing", "scientific-critical-thinking"]));

async function withFixture(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try { return await run(`http://127.0.0.1:${address.port}/v1/responses`); }
  finally { await new Promise((resolve) => server.close(() => resolve())); }
}

let nonStreamCalls = 0;
const nonStream = await withFixture((request, response) => {
  nonStreamCalls += 1;
  assert.equal(request.method, "POST");
  assert.equal(request.url, "/v1/responses");
  assert.equal(request.headers.authorization, `Bearer ${secretCanary}`);
  assert.equal(request.headers["idempotency-key"], envelope.idempotencyKey);
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; });
  request.on("end", () => {
    const body = JSON.parse(raw);
    assert.deepEqual(Object.keys(body).sort(), ["input", "stream"]);
    assert.equal(body.stream, false);
    assert.equal(JSON.stringify(body).includes(secretCanary), false);
    assert.equal(JSON.stringify(body).includes(["", "tools", "invoke"].join("/")), false);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      object: "response",
      status: "completed",
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "老麥已依受限專案脈絡整理證據狀態。", harmlessAdditive: true }], harmlessAdditive: true }],
      harmlessAdditive: true,
    }));
  });
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 4_096, fixtureMode: true, stream: false });
  const gateway = new ServerOnlyTaskGateway({ featureState: "PRIVATE_RESPONSES", adapter });
  const first = await gateway.execute(envelope, new AbortController().signal, context);
  const replay = await gateway.execute(envelope, new AbortController().signal, context);
  assert.equal(first.receipt.sanitizedStatus, "PROVIDER_COMPLETE");
  assert.equal(replay.receipt.attemptClass, "IDEMPOTENT_REPLAY");
  assert.equal(JSON.stringify(first).includes(secretCanary), false);
  await assert.rejects(() => gateway.execute({ ...envelope, payload: { ...envelope.payload, message: "不同內容" } }, new AbortController().signal, context), /task_id_payload_conflict/);
  return first;
});
assert.equal(nonStreamCalls, 1);
assert.match(nonStream.output.content, /^老麥/);

let rejectedStatusCalls = 0;
await withFixture((_request, response) => {
  rejectedStatusCalls += 1;
  response.writeHead(206, { "content-type": "application/json" });
  response.end(JSON.stringify({ object: "response", status: "completed", output: [] }));
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 4_096, fixtureMode: true, stream: false });
  await assert.rejects(() => adapter.execute(envelope, new AbortController().signal, context), (error) => error instanceof TaskProviderExecutionError && error.completionClass === "TERMINAL_PROVIDER_REJECTED");
});
assert.equal(rejectedStatusCalls, 1);

await withFixture((_request, response) => {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"老麥串流"}\n\n');
  response.write('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"結果"}\n\n');
  response.end('event: response.completed\ndata: {"type":"response.completed","response":{"object":"response","status":"completed"}}\n\n');
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 4_096, fixtureMode: true, stream: true });
  const result = await adapter.execute({ ...envelope, taskId: "chat:fixture:task-stream", idempotencyKey: "chat:fixture:stream" }, new AbortController().signal, context);
  assert.equal(result.output.content, "老麥串流結果");
});

await withFixture((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "x".repeat(5_000) }] }] }));
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 1_024, fixtureMode: true, stream: false });
  await assert.rejects(() => adapter.execute(envelope, new AbortController().signal, context), (error) => error instanceof TaskProviderExecutionError && error.code === "task_provider_output_too_large");
});
console.log("CATEGORY_05_LOCAL_RESPONSES_SHAPE_SIZE=PASS");

let timeoutCalls = 0;
await withFixture((_request, response) => {
  timeoutCalls += 1;
  setTimeout(() => { if (!response.destroyed) { response.writeHead(200, { "content-type": "application/json" }); response.end("{}"); } }, 250);
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 25, maxOutputBytes: 1_024, fixtureMode: true, stream: false });
  await assert.rejects(() => adapter.execute(envelope, new AbortController().signal, context), (error) => error instanceof TaskProviderExecutionError && error.completionClass === "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED");
});
assert.equal(timeoutCalls, 1);
let providerFailureCalls = 0;
await withFixture((_request, response) => {
  providerFailureCalls += 1;
  response.writeHead(500, { "content-type": "application/json" });
  response.end("{}");
}, async (endpointUrl) => {
  const adapter = new PrivateResponsesTaskProviderAdapter({ endpointUrl, bearerToken: secretCanary, timeoutMs: 2_000, maxOutputBytes: 1_024, fixtureMode: true, stream: false });
  await assert.rejects(() => adapter.execute(envelope, new AbortController().signal, context), (error) => error instanceof TaskProviderExecutionError && error.completionClass === "TERMINAL_PROVIDER_REJECTED");
});
assert.equal(providerFailureCalls, 1);
const preCanceled = new AbortController(); preCanceled.abort();
const unreachable = new PrivateResponsesTaskProviderAdapter({ endpointUrl: "http://127.0.0.1:1/v1/responses", bearerToken: secretCanary, timeoutMs: 25, maxOutputBytes: 1_024, fixtureMode: true, stream: false });
await assert.rejects(() => unreachable.execute(envelope, preCanceled.signal, context), (error) => error instanceof TaskProviderExecutionError && error.completionClass === "PROVEN_NOT_SUBMITTED");
assert.throws(() => new PrivateResponsesTaskProviderAdapter({ endpointUrl: "https://public.example/v1/responses", bearerToken: secretCanary, fixtureMode: false }), /task_provider_endpoint_rejected/);
const legacyChatPath = ["", "v1", "chat", "completions"].join("/");
assert.throws(() => new PrivateResponsesTaskProviderAdapter({ endpointUrl: `http://127.0.0.1:1${legacyChatPath}`, bearerToken: secretCanary, fixtureMode: true }), /task_provider_endpoint_rejected/);
console.log("CATEGORY_06_TIMEOUT_CANCEL_NO_BLIND_RESEND=PASS");

const [adapterSource, chatRoute, dashboard, center] = await Promise.all([
  read("lib/task-gateway-responses-adapter.ts"), read("app/api/chat/route.ts"), read("components/Dashboard.tsx"), read("components/GuidedResearchCenter.tsx"),
]);
assert.match(adapterSource, /\/v1\/responses/);
assert.doesNotMatch(adapterSource, /\/tools\/invoke|\/v1\/chat\/completions/);
assert.doesNotMatch(chatRoute, /tenant_chat_agent_not_ready|OPENCLAW|OpenClaw|Codex/);
assert.doesNotMatch(`${dashboard}\n${center}`, /OPENCLAW|OpenClaw|Codex|OPENAI|ANTHROPIC/);
assert.equal(`${adapterSource}\n${chatRoute}\n${dashboard}\n${center}`.includes(secretCanary), false);
assert.match(`${dashboard}\n${center}`, /老麥/);
console.log("CATEGORY_07_BROWSER_LOG_SECRET_PROVIDER_EXCLUSION=PASS");

assert.match(chatRoute, /loadAuthorizedProjectTaskContext/);
assert.match(chatRoute, /PORTAL_FORMAL_DATA_READ/);
assert.doesNotMatch(chatRoute, /filesystem|readFile|project-init|tools\/invoke|chat\/completions/);
assert.equal(context.documents.length <= 3, true);
assert.equal(context.workflowEvents.length <= 8, true);
assert.equal(taskGatewayHash({ ...baseContext }), context.contextHash);
console.log("CATEGORY_08_CHAT_AUTHORIZED_CONTEXT_NO_FILESYSTEM=PASS");
console.log("FOUNDATION_RUNTIME_CONTRACT=PASS");
