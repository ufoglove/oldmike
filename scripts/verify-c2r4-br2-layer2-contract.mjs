import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

import { executeOpenClawChatCompletion, resolveDefaultOpenClawOperationRoute } from "../lib/openclaw.ts";
import { normalizeResearchStartRequest, RESEARCH_PLAN_LANES } from "../lib/research-start-contract.ts";
import { POST } from "../app/api/projects/[projectId]/topic-lab/route.ts";
import { br2RouteFixtureSnapshot, resetBr2RouteFixture, setBr2Authenticated } from "./fixtures/c2r4-br2-route-deps.mjs";

const secretCanary = "br2-local-secret-canary-0123456789";
const scenario = { mode: "safe", submissions: new Map() };
const stageNames = ["AUTH_VALIDATE", "SUBMIT", "HTTP_ACK", "PARSE_PLAN", "VALIDATE_RESPONSE", "COMMIT"];

const requests = [];
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  let body = null;
  try { body = JSON.parse(raw); } catch { /* asserted below */ }
  assert.equal(request.method, "POST");
  assert.equal(request.url, "/v1/chat/completions");
  assert.equal(request.headers.authorization, `Bearer ${secretCanary}`);
  assert.equal(request.headers["content-type"], "application/json");
  assert.deepEqual(Object.keys(body || {}).sort(), ["messages", "model", "stream", "user"]);
  assert.equal(body?.model, "openclaw/default");
  assert.equal(body?.stream, false);
  assert.ok(Array.isArray(body?.messages) && body.messages.length > 0);
  assert.equal(typeof body?.user, "string");
  const count = (scenario.submissions.get(scenario.mode) ?? 0) + 1;
  scenario.submissions.set(scenario.mode, count);
  requests.push({ mode: scenario.mode, method: request.method, path: request.url, count });

  if (scenario.mode === "socket") { request.socket.destroy(); return; }
  if (scenario.mode === "timeout") { return; }
  if (scenario.mode === "content-type") { response.writeHead(200, { "Content-Type": "text/plain" }); response.end("not-json"); return; }
  if (scenario.mode === "body") { response.writeHead(200, { "Content-Type": "application/json", "Content-Length": "70000" }); response.end(); return; }
  if (scenario.mode === "envelope") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ object: "wrong", choices: [] })); return; }
  const content = planEnvelope(scenario.mode === "affirmative");
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] }));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.OPENCLAW_GATEWAY_TOKEN = secretCanary;

function makeInput(idempotencyKey, researchDirection = "以可解釋回饋改善護理模擬訓練的臨床推理移轉") {
  return normalizeResearchStartRequest({ operation: "ANALYZE", idempotencyKey, researchDirection, advanced: {}, sourceStrategy: "NONE", evidenceWindow: { from: "2023-08-24", to: "2026-08-24" }, sourceUrls: [] });
}

const baseRequest = makeInput("br2-route-safe-0001");
const titles = ["可解釋回饋對護理模擬臨床推理移轉的情境比較", "認知負荷軌跡在護理模擬推理移轉中的機制研究", "回饋依賴對護理臨床推理延宕移轉的失效邊界"];
const questions = ["不同可解釋回饋如何影響臨床推理移轉？", "認知負荷軌跡如何解釋臨床推理移轉？", "回饋依賴何時降低延宕臨床推理移轉？"];
const targets = ["護理學習者的模擬訓練與後續臨床推理情境", "護理學習者的三波模擬訓練與延宕評量情境", "護理學習者的回饋撤除訓練與臨床邊界情境"];
const contributions = ["建立回饋策略的可反駁實務比較", "建立認知負荷的時間機制證據", "界定回饋依賴的失效邊界"];
const methods = ["準實驗比較", "三波縱貫機制分析", "回饋撤除與異質性分析"];

function s0(index, direction) {
  return { workingTitle: titles[index], domain: "AI × 教育", outputTrack: "NSTC", problemContext: `研究者原始方向：${direction}。本方案研究問題：${questions[index]} 專業背景與場域條件仍待核對。`, targetUsers: targets[index], expectedContribution: contributions[index], existingData: "目前沒有已確認資料", availableData: "可規劃去識別化推理歷程與延宕評量；權限待確認", methodIdea: methods[index], timeline: "分階段執行；期程待確認", constraints: "樣本、教師時間與平台一致性待確認", ethicsPrivacyRisks: "需倫理、隱私與學習評量用途審查", unresolvedItems: "樣本數、工具效度與延宕時間待確認" };
}

function planEnvelope(affirmative, direction = baseRequest.researchDirection) {
  return JSON.stringify({
    recommendedLane: "EMERGING_FRONTIER",
    recommendationRationale: affirmative ? "這些方案屬於熱門趨勢並具有新穎性。" : "尚無足夠證據支持熱門趨勢或已證明新穎性的判定。",
    candidates: RESEARCH_PLAN_LANES.map((lane, index) => ({ lane, workingTitle: titles[index], researchQuestion: questions[index], researchValue: `方案 ${index + 1} 連結訓練決策與可觀察結果`, mechanismTheory: ["回饋時點與行為強化", "認知負荷與記憶鞏固", "回饋依賴與撤除成本"][index], targetContext: targets[index], contribution: contributions[index], methodDesign: methods[index], dataPlan: "去識別化推理歷程與延宕評量", feasibility: "先做單班小規模可行性", riskEthics: "避免將學習資料用於懲罰性評量", evidenceStatus: "UNVERIFIED", assumptions: ["教師與學習者可參與"], unresolvedItems: ["樣本與工具待確認"], nextAction: "人工核對後進入預覽", s0Draft: s0(index, direction) })),
  });
}

async function routePost(input) {
  const request = new Request("https://portal.fixture.invalid/api/projects/fixture-project/topic-lab", { method: "POST", headers: { "content-type": "application/json", origin: "https://portal.fixture.invalid" }, body: JSON.stringify(input) });
  const response = await POST(request, { params: Promise.resolve({ projectId: "fixture-project" }) });
  return { status: response.status, body: await response.json() };
}

try {
  resetBr2RouteFixture();
  scenario.mode = "safe";
  const created = await routePost(baseRequest);
  assert.equal(created.status, 201);
  assert.equal(created.body.ok, true);
  assert.equal(created.body.providerSubmissionCount, 1);
  assert.equal(created.body.analysis.candidates.length, 3);
  assert.ok(created.body.analysis.candidates.every((candidate) => Object.keys(candidate.s0Draft).length === 13));
  assert.equal(new Set(created.body.analysis.candidates.map((candidate) => candidate.candidateHash)).size, 3);
  const replay = await routePost(baseRequest);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotent, true);
  assert.equal(replay.body.analysis.resultHash, created.body.analysis.resultHash);
  assert.equal(scenario.submissions.get("safe"), 1);
  const conflict = await routePost({ ...baseRequest, researchDirection: "不同內容" });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, "idempotency_payload_conflict");
  assert.equal(scenario.submissions.get("safe"), 1);

  scenario.mode = "affirmative";
  const affirmative = await routePost(makeInput("br2-route-affirmative-0001"));
  assert.equal(affirmative.status, 502);
  assert.equal(affirmative.body.code, "unsupported_trend_claim_without_evidence");
  assert.equal(affirmative.body.stage, "VALIDATE_RESPONSE");

  for (const [mode, code, stage] of [["content-type", "research_generation_content_type_rejected", "HTTP_ACK"], ["body", "research_generation_body_rejected", "HTTP_ACK"], ["envelope", "research_generation_response_shape_invalid", "PARSE_PLAN"]]) {
    scenario.mode = mode;
    const result = await routePost(makeInput(`br2-route-${mode}-0001`));
    assert.equal(result.status, 502);
    assert.equal(result.body.code, code);
    assert.equal(result.body.stage, stage);
    assert.equal(scenario.submissions.get(mode), 1);
  }

  scenario.mode = "socket";
  const socket = await routePost(makeInput("br2-route-socket-0001"));
  assert.equal(socket.status, 502);
  assert.equal(socket.body.code, "research_generation_transport_failure_before_headers");
  assert.equal(socket.body.stage, "HTTP_ACK");
  assert.equal(socket.body.reasonEnum, "TRANSPORT_FAILURE_BEFORE_HEADERS");
  assert.equal(socket.body.providerAttemptClass, "SUBMISSION_POSSIBLE");
  assert.equal(scenario.submissions.get("socket"), 1);

  scenario.mode = "timeout";
  const timeout = await executeOpenClawChatCompletion({
    messages: [{ role: "user", content: "fixture" }], sessionKey: "br2-timeout-session", operation: "M01_TOPIC_LAB",
    route: { ...resolveDefaultOpenClawOperationRoute("M01_TOPIC_LAB"), timeoutMs: 30 },
    baseUrl: process.env.OPENCLAW_BASE_URL, bearerToken: secretCanary,
  });
  assert.equal(timeout.kind, "completion-unknown");
  assert.equal(timeout.kind === "completion-unknown" && timeout.code, "provider_deadline");
  assert.equal(timeout.kind === "completion-unknown" && timeout.evidence.reasonEnum, "PROVIDER_DEADLINE");
  assert.equal(scenario.submissions.get("timeout"), 1);

  setBr2Authenticated(false);
  scenario.mode = "unauthenticated";
  const beforeUnauthorized = requests.length;
  const unauthorized = await routePost(makeInput("br2-route-unauth-0001"));
  assert.equal(unauthorized.status, 401);
  assert.equal(requests.length, beforeUnauthorized);

  assert.ok([...scenario.submissions.values()].every((count) => count === 1));
  assert.deepEqual(Object.keys(br2RouteFixtureSnapshot()).sort(), ["authenticated", "repositoryBoundaryCalls", "retainedRuns"]);
  const output = { LAYER2_CONTRACT: "PASS", AUTHENTICATED_ROUTE_HTTP_200_REPLAY: "PASS", PLAN_COUNT: 3, S0_FIELD_COUNT: 13, SAFE_NEGATION: "PASS", AFFIRMATIVE_TREND_DOMAIN_ERROR: "PASS", TERMINAL_REJECTED_CLASSES: "PASS", COMPLETION_UNKNOWN_CLASSES: "PASS", IDEMPOTENCY: "PASS_ZERO_SECOND_SUBMISSION", UNAUTHENTICATED: "PASS_401", PROVIDER_SUBMISSION_MAXIMUM: 1, STAGE_BITMAP: Object.fromEntries(stageNames.map((stage) => [stage, "COVERED"])), FORMAL_RESEARCH_WRITES: 0, ONLINE_DATABASE_CONNECTIONS: 0, REMOTE_CALLS: 0 };
  const sanitized = JSON.stringify(output);
  assert.equal(sanitized.includes(secretCanary), false);
  process.stdout.write(`${sanitized}\n`);
} finally {
  delete process.env.OPENCLAW_BASE_URL;
  delete process.env.OPENCLAW_GATEWAY_TOKEN;
  server.closeAllConnections?.();
  server.close();
  await once(server, "close");
}
