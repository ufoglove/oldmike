import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  collectTopicLabObservations,
  createCrossrefAdapter,
  createOpenAlexAdapter,
} from "../lib/topic-lab-source-provider.ts";
import { analyzeTopicLab } from "../lib/topic-lab-contract.ts";
import { normalizeResearchStartRequest, parseResearchPlanEnvelope, RESEARCH_PLAN_LANES } from "../lib/research-start-contract.ts";

const request = normalizeResearchStartRequest({ operation: "ANALYZE", idempotencyKey: "research-start:sources:0001", researchDirection: "擴增實境安全訓練的危害辨識移轉", advanced: {}, sourceStrategy: "SCHOLARLY_AUTO", evidenceWindow: { from: "2023-08-24", to: "2026-08-24" }, sourceUrls: [] });
const now = new Date("2026-08-24T02:00:00.000Z");
const urlHash = (value) => createHash("sha256").update(value).digest("hex");

const openAlex = createOpenAlexAdapter(async () => new Response(JSON.stringify({
  meta: { count: 1 },
  results: [{ id: "https://openalex.org/W1", title: "擴增實境安全訓練與危害辨識移轉", publication_date: "2026-01-02", doi: "https://doi.org/10.1000/example", cited_by_count: 12, primary_location: { landing_page_url: "https://example.test/work/1" }, unrelated: "allowed" }],
  unrelatedTop: true,
}), { status: 200, headers: { "Content-Type": "application/json" } }));
const crossref = createCrossrefAdapter(async () => new Response(JSON.stringify({
  status: "ok", "message-type": "work-list", message: { items: [{ DOI: "10.1000/example", title: ["XR safety training transfer"], published: { "date-parts": [[2025, 8, 1]] }, "is-referenced-by-count": 4, URL: "https://example.test/work/2", additive: true }] },
}), { status: 200, headers: { "Content-Type": "application/json" } }));
const openItems = await openAlex.search(request, now);
const crossItems = await crossref.search(request, now);
assert.equal(openItems.length, 1);
assert.equal(crossItems.length, 1);
assert.equal(openItems[0].provider, "OPENALEX");
assert.equal(crossItems[0].provider, "CROSSREF");
assert.equal(openItems[0].doi, "10.1000/example");
assert.equal(openItems[0].urlHash, urlHash("https://example.test/work/1"));
for (const item of [...openItems, ...crossItems]) {
  assert.deepEqual(Object.keys(item).sort(), ["citationCount", "doi", "observationId", "provider", "providerKey", "publishedAt", "queryHash", "retrievedAt", "status", "title", "urlHash", "window"].sort());
  assert.equal(JSON.stringify(item).includes("raw"), false);
  assert.match(item.providerKey, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(item.providerKey, /https?:|\/\//u);
}

const crossrefWithoutDoi = createCrossrefAdapter(async () => new Response(JSON.stringify({
  status: "ok", "message-type": "work-list", message: { items: [{ title: ["URL must not become a provider key"], published: { "date-parts": [[2025, 1, 1]] }, URL: "https://example.test/raw-landing-url" }] },
}), { status: 200, headers: { "Content-Type": "application/json" } }));
const [withoutDoi] = await crossrefWithoutDoi.search(request, now);
assert.match(withoutDoi.providerKey, /^[a-f0-9]{64}$/u);
assert.equal(JSON.stringify(withoutDoi).includes("raw-landing-url"), false, "raw Crossref URLs never survive in retained observations");

const partial = await collectTopicLabObservations(request, {
  now: () => now,
  enabled: true,
  adapters: [openAlex, createCrossrefAdapter(async () => new Response("", { status: 429 }))],
});
assert.equal(partial.capability, "SCHOLARLY_PARTIAL");
assert.equal(partial.observations.length, 1);
assert.deepEqual(partial.providerStates, { OPENALEX: "READY", CROSSREF: "RATE_LIMITED" });

const unavailable = await collectTopicLabObservations(request, { now: () => now, enabled: false });
assert.equal(unavailable.capability, "SCHOLARLY_DISABLED");
assert.deepEqual(unavailable.observations, []);
assert.deepEqual(unavailable.providerStates, { OPENALEX: "DISABLED", CROSSREF: "DISABLED", SEMANTIC_SCHOLAR: "DISABLED" });

const conceptOnlyRequest = normalizeResearchStartRequest({ ...request, idempotencyKey: "research-start:concept-only:0001", sourceStrategy: "NONE" });
const conceptOnly = await collectTopicLabObservations(conceptOnlyRequest, { now: () => now, enabled: true, adapters: [openAlex, crossref] });
assert.equal(conceptOnly.capability, "SCHOLARLY_DISABLED");
assert.deepEqual(conceptOnly.observations, []);
assert.deepEqual(conceptOnly.providerStates, { OPENALEX: "DISABLED", CROSSREF: "DISABLED", SEMANTIC_SCHOLAR: "DISABLED" });

const [preprojectRoute, projectRoute] = await Promise.all([
  readFile(new URL("../app/api/assist/topic-lab/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/projects/[projectId]/topic-lab/route.ts", import.meta.url), "utf8"),
]);
assert.match(preprojectRoute, /sourceStrategy:\s*"NONE"/u, "legacy quick-start compatibility must remain concept-only");
assert.doesNotMatch(preprojectRoute, /sourceStrategy:\s*"SCHOLARLY_AUTO"/u, "legacy quick-start compatibility must never silently enable egress");
assert.match(preprojectRoute, /executeTopicLabAnalysis\(parsed,\s*\{\s*signal:\s*request\.signal\s*\}\)/u, "pre-project route propagates client cancellation");
assert.match(projectRoute, /executeTopicLabAnalysis\(parsed as TopicLabAnalyzeRequest,\s*\{\s*observedAt,\s*signal:\s*request\.signal\s*\}\)/u, "project route propagates client cancellation");

let semanticCalls = 0;
const semanticCapability = {
  provider: "SEMANTIC_SCHOLAR",
  async search(input, observedAt) {
    semanticCalls += 1;
    return [{
      observationId: "obs_semantic_capability_0001",
      provider: "SEMANTIC_SCHOLAR",
      providerKey: urlHash("semantic-capability-0001"),
      queryHash: urlHash(`SEMANTIC_SCHOLAR:${input.researchDirection}`),
      window: input.evidenceWindow,
      title: "危害辨識移轉的延宕機制研究",
      publishedAt: "2026-03-01",
      retrievedAt: observedAt.toISOString(),
      doi: null,
      citationCount: null,
      urlHash: urlHash("semantic-capability-0001"),
      status: "UNVERIFIED",
    }];
  },
};
const explicitlyEnabledSemantic = await collectTopicLabObservations(request, {
  now: () => now,
  enabled: true,
  adapters: [semanticCapability],
});
assert.equal(semanticCalls, 1, "Semantic Scholar is callable only through an explicitly supplied server capability");
assert.equal(explicitlyEnabledSemantic.capability, "SCHOLARLY_READY");
assert.deepEqual(explicitlyEnabledSemantic.providerStates, { SEMANTIC_SCHOLAR: "READY" });

const startOrder = [];
function delayedAdapter(provider, delay) {
  return { provider, async search(_input, _observedAt, signal) { startOrder.push({ provider, at: Date.now() }); await new Promise((resolve, reject) => { const timer = setTimeout(resolve, delay); signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true }); }); return []; } };
}
const concurrentStarted = Date.now();
const concurrent = await collectTopicLabObservations(request, { enabled: true, deadlineMs: 250, adapters: [delayedAdapter("OPENALEX", 35), delayedAdapter("CROSSREF", 35)] });
assert.equal(Date.now() - concurrentStarted < 100, true, "scholarly adapters execute concurrently under one deadline");
assert.equal(Math.abs(startOrder[0].at - startOrder[1].at) < 20, true);
assert.equal(concurrent.capability, "SCHOLARLY_UNAVAILABLE");

const parent = new AbortController();
const cancelledPromise = collectTopicLabObservations(request, { enabled: true, deadlineMs: 250, signal: parent.signal, adapters: [delayedAdapter("OPENALEX", 200), delayedAdapter("CROSSREF", 200)] });
setTimeout(() => parent.abort(), 5);
const cancelled = await cancelledPromise;
assert.deepEqual(cancelled.providerStates, { OPENALEX: "CANCELLED", CROSSREF: "CANCELLED" });
const deadline = await collectTopicLabObservations(request, { enabled: true, deadlineMs: 5, adapters: [delayedAdapter("OPENALEX", 200), delayedAdapter("CROSSREF", 200)] });
assert.deepEqual(deadline.providerStates, { OPENALEX: "TIMED_OUT", CROSSREF: "TIMED_OUT" });

const planTitles = ["擴增實境回饋與危害辨識移轉的情境比較", "沉浸訓練認知負荷軌跡與危害辨識移轉", "提示依賴對延宕危害辨識移轉的失效邊界"];
const planQuestions = ["回饋時點如何影響危害辨識移轉？", "認知負荷如何解釋危害辨識移轉？", "提示依賴何時造成危害辨識移轉失效？"];
const planMethods = ["準實驗比較", "縱貫機制分析", "提示撤除與異質性分析"];
const planTargets = ["高風險作業的擴增實境訓練場域", "高風險作業的沉浸式訓練與延宕評量場域", "高風險作業的提示撤除與真實工作情境"];
const planContributions = ["建立回饋策略的可反駁實務比較", "建立認知負荷的時間機制證據", "界定提示依賴的失效邊界"];
function s0(index) { return { workingTitle: planTitles[index], domain: "AR/VR/XR × 職業安全與教育訓練", outputTrack: "NSTC", problemContext: `研究者原始方向：${request.researchDirection}。本方案研究問題：${planQuestions[index]} 專業背景仍待來源核對。`, targetUsers: planTargets[index], expectedContribution: planContributions[index], existingData: "目前沒有已確認資料", availableData: "去識別化訓練與延宕評量資料；權限待確認", methodIdea: planMethods[index], timeline: "分階段執行；期程待確認", constraints: "樣本與設備限制待確認", ethicsPrivacyRisks: "倫理、隱私與職場權力關係待審查", unresolvedItems: "場域、樣本與量測效度待確認" }; }
const planRaw = { recommendedLane: "EMERGING_FRONTIER", recommendationRationale: "機制可反駁且具縱貫設計價值；來源仍未驗證。", candidates: RESEARCH_PLAN_LANES.map((lane, index) => ({ lane, workingTitle: planTitles[index], researchQuestion: planQuestions[index], researchValue: `研究價值 ${index + 1} 仍待核對`, mechanismTheory: ["回饋強化", "認知負荷與記憶鞏固", "提示依賴與撤除成本"][index], targetContext: planTargets[index], contribution: planContributions[index], methodDesign: planMethods[index], dataPlan: "去識別化危害辨識與延宕資料", feasibility: "先做小規模可行性", riskEthics: "需倫理與隱私審查", evidenceStatus: "UNVERIFIED", assumptions: ["場域可招募"], unresolvedItems: ["樣本數待確認"], nextAction: "人工核對後再預覽", s0Draft: s0(index) })) };
const parsedPlans = parseResearchPlanEnvelope(JSON.stringify(planRaw), request);
assert.equal(parsedPlans.ok, true);
const analysis = analyzeTopicLab(request, [...openItems, ...crossItems], now, parsedPlans.value);
assert.equal(analysis.candidates.length, 3);
assert.deepEqual(analysis.candidates.map(({ requestedLane }) => requestedLane), RESEARCH_PLAN_LANES);
assert.equal(analysis.observations.filter(({ includedInScoring }) => includedInScoring).length, 1, "DOI-first dedupe");
assert.equal(analysis.observations.find(({ provider }) => provider === "CROSSREF").exclusionReason, "DUPLICATE_DOI");
assert.equal(analysis.candidates.every(({ observedClassification, signals }) => observedClassification === "INSUFFICIENT_EVIDENCE" && signals.momentum.value === null), true);

const unsupported = structuredClone(planRaw);
unsupported.recommendationRationale = "這是已證明新穎的熱門趨勢。";
const unsupportedPlans = parseResearchPlanEnvelope(JSON.stringify(unsupported), request);
assert.equal(unsupportedPlans.ok, true);
assert.throws(() => analyzeTopicLab(request, [], now, unsupportedPlans.value), /unsupported_trend_claim_without_evidence/);

console.log("C2R4_SCHOLARLY_ORCHESTRATION=PASS");
