import assert from "node:assert/strict";

import {
  executeOpenClawChatCompletion,
  resolveDefaultOpenClawOperationRoute,
} from "../lib/openclaw.ts";
import {
  TOPIC_LAB_OUTPUT_LIMIT_BYTES,
  TOPIC_LAB_PROVIDER_TIMEOUT_MS,
  TOPIC_LAB_UAT_TIMEOUT_MS,
} from "../lib/topic-lab-runtime-contract.ts";
import {
  executeTopicLabAnalysis,
  TopicLabGenerationError,
} from "../lib/topic-lab-service.ts";
import {
  normalizeResearchStartRequest,
  parseResearchPlanEnvelope,
  RESEARCH_PLAN_LANES,
} from "../lib/research-start-contract.ts";
import { POST as preprojectPost } from "../app/api/assist/topic-lab/route.ts";
import { TOPIC_RESPONSE_TIMEOUT_MS } from "../../public-uat-harness/shared-browser-login-session.mjs";

const secretCanary = "br3-synthetic-secret-canary-0123456789";
const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.OPENCLAW_BASE_URL;
const originalToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const submissions = [];

function makeInput(suffix) {
  return normalizeResearchStartRequest({
    operation: "ANALYZE",
    idempotencyKey: `br3-topic-${suffix}-0001`,
    researchDirection: "以可解釋回饋改善護理模擬訓練中的臨床推理移轉",
    advanced: {},
    sourceStrategy: "NONE",
    evidenceWindow: { from: "2023-08-24", to: "2026-08-24" },
    sourceUrls: [],
  });
}

const titles = [
  "可解釋回饋對護理模擬臨床推理移轉的情境比較",
  "認知負荷軌跡在護理模擬推理移轉中的機制研究",
  "回饋依賴對護理臨床推理延宕移轉的失效邊界",
];
const questions = [
  "不同可解釋回饋如何影響臨床推理移轉？",
  "認知負荷軌跡如何解釋臨床推理移轉？",
  "回饋依賴何時降低延宕臨床推理移轉？",
];
const targets = [
  "護理學習者的模擬訓練與後續臨床推理情境",
  "護理學習者的三波模擬訓練與延宕評量情境",
  "護理學習者的回饋撤除訓練與臨床邊界情境",
];
const contributions = ["建立回饋策略的可反駁實務比較", "建立認知負荷的時間機制證據", "界定回饋依賴的失效邊界"];
const methods = ["準實驗比較", "三波縱貫機制分析", "回饋撤除與異質性分析"];

function s0(index, direction) {
  return {
    workingTitle: titles[index], domain: "AI × 教育", outputTrack: "NSTC",
    problemContext: `研究者原始方向：${direction}。本方案研究問題：${questions[index]} 專業背景與場域條件仍待核對。`,
    targetUsers: targets[index], expectedContribution: contributions[index], existingData: "目前沒有已確認資料",
    availableData: "可規劃去識別化推理歷程與延宕評量；權限待確認", methodIdea: methods[index],
    timeline: "分階段執行；期程待確認", constraints: "樣本、教師時間與平台一致性待確認",
    ethicsPrivacyRisks: "需倫理、隱私與學習評量用途審查", unresolvedItems: "樣本數、工具效度與延宕時間待確認",
  };
}

function planEnvelope(direction) {
  return JSON.stringify({
    recommendedLane: "EMERGING_FRONTIER",
    recommendationRationale: "尚無足夠證據支持熱門趨勢或已證明新穎性的判定。",
    candidates: RESEARCH_PLAN_LANES.map((lane, index) => ({
      lane, workingTitle: titles[index], researchQuestion: questions[index], researchValue: `方案 ${index + 1} 連結訓練決策與可觀察結果`,
      mechanismTheory: ["回饋時點與行為強化", "認知負荷與記憶鞏固", "回饋依賴與撤除成本"][index],
      targetContext: targets[index], contribution: contributions[index], methodDesign: methods[index],
      dataPlan: "去識別化推理歷程與延宕評量", feasibility: "先做單班小規模可行性",
      riskEthics: "避免將學習資料用於懲罰性評量", evidenceStatus: "UNVERIFIED",
      assumptions: ["教師與學習者可參與"], unresolvedItems: ["樣本與工具待確認"], nextAction: "人工核對後進入預覽",
      s0Draft: s0(index, direction),
    })),
  });
}

function chatResponse(content, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify({
    object: "chat.completion",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
  }), { status, headers: { "content-type": contentType } });
}

function stalledJsonResponse(signal) {
  return new Response(new ReadableStream({
    start(controller) {
      const keepAlive = setTimeout(() => controller.error(new Error("synthetic body guard")), 250);
      signal.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        controller.error(new Error("synthetic body abort"));
      }, { once: true });
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function rejectedJsonBodyResponse() {
  return new Response(new ReadableStream({
    start(controller) {
      controller.error(new Error("synthetic ordinary body failure"));
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function coreCall(fetcher, suffix, routeOverride = {}, parentSignal) {
  globalThis.fetch = async (url, init) => {
    submissions.push({ suffix, url: String(url), init });
    return fetcher(url, init);
  };
  return executeOpenClawChatCompletion({
    messages: [{ role: "user", content: "synthetic" }],
    sessionKey: `br3-session-${suffix}`,
    operation: "M01_TOPIC_LAB",
    route: { ...resolveDefaultOpenClawOperationRoute("M01_TOPIC_LAB"), ...routeOverride },
    baseUrl: "http://localhost/",
    bearerToken: secretCanary,
    signal: parentSignal,
  });
}

async function routePost(input) {
  const request = new Request("https://portal.fixture.invalid/api/assist/topic-lab", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const response = await preprojectPost(request);
  return { status: response.status, body: await response.json() };
}

try {
  process.env.OPENCLAW_BASE_URL = "http://localhost/";
  process.env.OPENCLAW_GATEWAY_TOKEN = secretCanary;

  assert.equal(TOPIC_LAB_PROVIDER_TIMEOUT_MS, 60_000);
  assert.equal(TOPIC_LAB_UAT_TIMEOUT_MS, 75_000);
  assert.equal(TOPIC_RESPONSE_TIMEOUT_MS, TOPIC_LAB_UAT_TIMEOUT_MS);
  assert.equal(TOPIC_LAB_OUTPUT_LIMIT_BYTES, 192_000);
  const productionRoute = resolveDefaultOpenClawOperationRoute("M01_TOPIC_LAB");
  assert.equal(productionRoute.timeoutMs, TOPIC_LAB_PROVIDER_TIMEOUT_MS);
  assert.equal(productionRoute.outputLimitBytes, TOPIC_LAB_OUTPUT_LIMIT_BYTES);
  assert.equal(productionRoute.modelOverride, null);
  assert.equal(productionRoute.endpointFamily, "CHAT_COMPLETIONS");
  const unrelatedRoute = resolveDefaultOpenClawOperationRoute("M01_S0_DRAFT");
  assert.equal(unrelatedRoute.timeoutMs, 20_000);
  assert.equal(unrelatedRoute.outputLimitBytes, 64_000);

  const upstream503 = await coreCall(async () => new Response(JSON.stringify({ unavailable: true }), {
    status: 503, headers: { "content-type": "application/json" },
  }), "upstream-503");
  assert.equal(upstream503.kind, "terminal-rejected");
  assert.equal(upstream503.code, "http_rejected");
  assert.equal(upstream503.evidence.reasonEnum, "UPSTREAM_HTTP_REJECTED");
  assert.equal(upstream503.evidence.providerAttemptClass, "RESPONSE_HEADERS_RECEIVED");

  for (const status of [307, 308]) {
    const redirect = await coreCall(async () => {
      return new Response(null, { status, headers: { location: "http://untrusted-redirect.invalid/" } });
    }, `redirect-${status}`);
    assert.equal(redirect.kind, "terminal-rejected");
    assert.equal(redirect.code, "http_rejected");
    assert.equal(redirect.evidence.reasonEnum, "UPSTREAM_HTTP_REJECTED");
  }

  const transport = await coreCall(async () => { throw new Error("synthetic transport"); }, "transport");
  assert.equal(transport.kind, "completion-unknown");
  assert.equal(transport.code, "transport_failure_before_headers");
  assert.equal(transport.evidence.reasonEnum, "TRANSPORT_FAILURE_BEFORE_HEADERS");

  const caller = new AbortController();
  const callerCancel = await coreCall(async (_url, init) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("guard")), 250);
    init.signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(new Error("caller abort")); }, { once: true });
    setTimeout(() => caller.abort(), 5);
  }), "caller-cancel", { timeoutMs: 200 }, caller.signal);
  assert.equal(callerCancel.kind, "completion-unknown");
  assert.equal(callerCancel.code, "caller_cancel");
  assert.equal(callerCancel.evidence.reasonEnum, "CALLER_CANCEL");

  const providerDeadline = await coreCall(async (_url, init) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("guard")), 250);
    init.signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(new Error("deadline")); }, { once: true });
  }), "provider-deadline", { timeoutMs: 25 });
  assert.equal(providerDeadline.kind, "completion-unknown");
  assert.equal(providerDeadline.code, "provider_deadline");
  assert.equal(providerDeadline.evidence.reasonEnum, "PROVIDER_DEADLINE");

  const raceCaller = new AbortController();
  const firstAbortWins = await coreCall(async (_url, init) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("guard")), 250);
    init.signal.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      setTimeout(() => reject(new Error("delayed rejection after first abort")), 20);
    }, { once: true });
    setTimeout(() => raceCaller.abort(), 30);
  }), "deadline-before-caller-race", { timeoutMs: 20 }, raceCaller.signal);
  assert.equal(firstAbortWins.kind, "completion-unknown");
  assert.equal(firstAbortWins.code, "provider_deadline");
  assert.equal(firstAbortWins.evidence.reasonEnum, "PROVIDER_DEADLINE");

  const postHeadersDeadline = await coreCall(async (_url, init) => stalledJsonResponse(init.signal), "post-headers-deadline", { timeoutMs: 20 });
  assert.equal(postHeadersDeadline.kind, "completion-unknown");
  assert.equal(postHeadersDeadline.code, "provider_deadline");
  assert.equal(postHeadersDeadline.evidence.reasonEnum, "PROVIDER_DEADLINE");
  assert.equal(postHeadersDeadline.evidence.providerAttemptClass, "RESPONSE_HEADERS_RECEIVED");

  const postHeadersCallerController = new AbortController();
  setTimeout(() => postHeadersCallerController.abort(), 10);
  const postHeadersCaller = await coreCall(async (_url, init) => stalledJsonResponse(init.signal), "post-headers-caller", { timeoutMs: 200 }, postHeadersCallerController.signal);
  assert.equal(postHeadersCaller.kind, "completion-unknown");
  assert.equal(postHeadersCaller.code, "caller_cancel");
  assert.equal(postHeadersCaller.evidence.reasonEnum, "CALLER_CANCEL");
  assert.equal(postHeadersCaller.evidence.providerAttemptClass, "RESPONSE_HEADERS_RECEIVED");

  const delayed = await coreCall(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return chatResponse("delayed success");
  }, "delayed-success", { timeoutMs: 100 });
  assert.equal(delayed.kind, "success");

  const largeContent = "L".repeat(70_000);
  const largeSuccess = await coreCall(async () => chatResponse(largeContent), "large-success");
  assert.equal(Buffer.byteLength(largeContent, "utf8") > 64_000, true);
  assert.equal(largeSuccess.kind, "success");
  assert.equal(largeSuccess.kind === "success" && largeSuccess.content.length, 70_000);

  const overLimit = await coreCall(async () => chatResponse("X".repeat(TOPIC_LAB_OUTPUT_LIMIT_BYTES + 1)), "over-limit");
  assert.equal(overLimit.kind, "terminal-rejected");
  assert.equal(overLimit.code, "body_rejected");
  assert.equal(overLimit.evidence.reasonEnum, "BODY_REJECTED");

  let declaredOversizeCancelCount = 0;
  const declaredOversize = await coreCall(async () => new Response(new ReadableStream({
    cancel() { declaredOversizeCancelCount += 1; },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-length": String(TOPIC_LAB_OUTPUT_LIMIT_BYTES + 1),
    },
  }), "declared-over-limit");
  assert.equal(declaredOversize.kind, "terminal-rejected");
  assert.equal(declaredOversize.code, "body_rejected");
  assert.equal(declaredOversize.evidence.reasonEnum, "BODY_REJECTED");
  assert.equal(declaredOversizeCancelCount, 1);

  const rejectedBody = await coreCall(async () => rejectedJsonBodyResponse(), "ordinary-body-rejected", { timeoutMs: 100 });
  assert.equal(rejectedBody.kind, "completion-unknown");
  assert.equal(rejectedBody.code, "transport_failure_after_headers");
  assert.equal(rejectedBody.evidence.reasonEnum, "TRANSPORT_FAILURE_AFTER_HEADERS");
  assert.equal(rejectedBody.evidence.providerAttemptClass, "RESPONSE_HEADERS_RECEIVED");

  const missingBody = await coreCall(async () => new Response(null, {
    status: 200, headers: { "content-type": "application/json" },
  }), "missing-body", { timeoutMs: 100 });
  assert.equal(missingBody.kind, "terminal-rejected");
  assert.equal(missingBody.code, "body_rejected");
  assert.equal(missingBody.evidence.reasonEnum, "BODY_REJECTED");

  const malformedJson = await coreCall(async () => new Response("{not-json", {
    status: 200, headers: { "content-type": "application/json" },
  }), "malformed-json", { timeoutMs: 100 });
  assert.equal(malformedJson.kind, "terminal-rejected");
  assert.equal(malformedJson.code, "response_shape_invalid");
  assert.equal(malformedJson.evidence.reasonEnum, "RESPONSE_SHAPE_REJECTED");

  const parserLimit = parseResearchPlanEnvelope("X".repeat(TOPIC_LAB_OUTPUT_LIMIT_BYTES + 1), makeInput("parser-over-limit"));
  assert.equal(parserLimit.ok, false);
  assert.equal(!parserLimit.ok && parserLimit.code, "research_plan_json_invalid");

  const serviceEvidence = { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "LT_1S", providerAttemptClass: "SUBMISSION_POSSIBLE" };
  let serviceDeadline;
  try {
    await executeTopicLabAnalysis(makeInput("service-deadline"), {
      provider: { id: "OLD_MIKE_DEFAULT", capability: "ENABLED", submit: async () => ({ kind: "completion-unknown", code: "provider_deadline", evidence: serviceEvidence }) },
    });
  } catch (error) { serviceDeadline = error; }
  assert.ok(serviceDeadline instanceof TopicLabGenerationError);
  assert.deepEqual(
    [serviceDeadline.code, serviceDeadline.stage, serviceDeadline.status, serviceDeadline.reasonEnum, serviceDeadline.elapsedBucket, serviceDeadline.providerAttemptClass],
    ["research_generation_provider_deadline", "HTTP_ACK", 504, "PROVIDER_DEADLINE", "LT_1S", "SUBMISSION_POSSIBLE"],
  );

  let unexpected;
  try {
    await executeTopicLabAnalysis(makeInput("unexpected-internal"), {
      provider: { id: "OLD_MIKE_DEFAULT", capability: "ENABLED", submit: async () => { throw new Error("synthetic internal"); } },
    });
  } catch (error) { unexpected = error; }
  assert.ok(unexpected instanceof TopicLabGenerationError);
  assert.equal(unexpected.code, "research_generation_unexpected_internal");
  assert.equal(unexpected.reasonEnum, "UNEXPECTED_INTERNAL");

  globalThis.fetch = async (url, init) => {
    submissions.push({ suffix: "black-box", url: String(url), init });
    return chatResponse(planEnvelope(makeInput("black-box").researchDirection));
  };
  const blackBox = await routePost(makeInput("black-box"));
  assert.equal(blackBox.status, 200);
  assert.equal(blackBox.body.ok, true);
  assert.equal(blackBox.body.providerSubmissionCount, 1);
  assert.equal(blackBox.body.analysis.candidates.length, 3);
  assert.equal(new Set(blackBox.body.analysis.candidates.map((item) => item.candidateHash)).size, 3);
  assert.equal(blackBox.body.analysis.candidates.every((item) => Object.keys(item.s0Draft).length === 13), true);
  assert.equal(blackBox.body.persistence, "NONE");

  globalThis.fetch = async (url, init) => {
    submissions.push({ suffix: "route-upstream-503", url: String(url), init });
    return new Response(JSON.stringify({ unavailable: true }), { status: 503, headers: { "content-type": "application/json" } });
  };
  const serialized503 = await routePost(makeInput("route-upstream-503"));
  assert.equal(serialized503.status, 502);
  assert.equal(serialized503.body.code, "research_generation_http_rejected");
  assert.equal(serialized503.body.reasonEnum, "UPSTREAM_HTTP_REJECTED");
  assert.equal(serialized503.body.providerAttemptClass, "RESPONSE_HEADERS_RECEIVED");

  globalThis.fetch = async (url, init) => {
    submissions.push({ suffix: "route-transport", url: String(url), init });
    throw new Error("synthetic transport");
  };
  const serialized = await routePost(makeInput("route-transport"));
  assert.equal(serialized.status, 502);
  assert.deepEqual(Object.keys(serialized.body).sort(), [
    "code", "elapsedBucket", "error", "ok", "providerAttemptClass", "reasonEnum", "recoverableFields", "stage",
  ]);
  assert.equal(serialized.body.code, "research_generation_transport_failure_before_headers");
  assert.equal(serialized.body.reasonEnum, "TRANSPORT_FAILURE_BEFORE_HEADERS");
  assert.equal(serialized.body.providerAttemptClass, "SUBMISSION_POSSIBLE");
  assert.equal(typeof serialized.body.elapsedBucket, "string");
  assert.equal(serialized.body.error.includes("老麥"), true);
  assert.equal(/openclaw|provider|model/iu.test(serialized.body.error), false);

  for (const submission of submissions) {
    assert.equal(submission.url, "http://localhost/v1/chat/completions");
    assert.equal(submission.init.method, "POST");
    assert.equal(submission.init.redirect, "manual");
    assert.equal(submission.init.headers.Authorization, `Bearer ${secretCanary}`);
    assert.equal(submission.init.headers["Content-Type"], "application/json");
    const body = JSON.parse(submission.init.body);
    assert.deepEqual(Object.keys(body).sort(), ["messages", "model", "stream", "user"]);
    assert.equal(body.model, "openclaw/default");
    assert.equal(body.stream, false);
  }
  const counts = Object.groupBy(submissions, (item) => item.suffix);
  assert.equal(Object.values(counts).every((items) => items.length === 1), true);

  const sanitized = JSON.stringify({
    BR3_TOPIC_CONTRACT: "PASS",
    PROVIDER_TIMEOUT_MS: TOPIC_LAB_PROVIDER_TIMEOUT_MS,
    UAT_TIMEOUT_MS: TOPIC_LAB_UAT_TIMEOUT_MS,
    OUTPUT_LIMIT_BYTES: TOPIC_LAB_OUTPUT_LIMIT_BYTES,
    SCENARIOS: 22,
    BLACK_BOX_PLANS: 3,
    S0_FIELDS_PER_PLAN: 13,
    PROVIDER_SUBMISSION_MAXIMUM: 1,
    FORMAL_RESEARCH_WRITES: 0,
    NETWORK_CALLS: 0,
  });
  assert.equal(sanitized.includes(secretCanary), false);
  process.stdout.write(`${sanitized}\n`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL;
  else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
  if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN;
  else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken;
}
