import assert from "node:assert/strict";
import { executeTopicLabAnalysis } from "../lib/topic-lab-service.ts";
import { createDisabledGptByokResearchProvider } from "../lib/research-generation-provider.ts";
import { normalizeResearchStartRequest, RESEARCH_PLAN_LANES } from "../lib/research-start-contract.ts";

const request = normalizeResearchStartRequest({ operation: "ANALYZE", idempotencyKey: "research-start:singleflight:0001", researchDirection: "以可解釋回饋改善護理模擬訓練的臨床推理移轉", advanced: {}, sourceStrategy: "NONE", evidenceWindow: { from: "2023-08-24", to: "2026-08-24" }, sourceUrls: [] });
const titles = ["可解釋回饋對護理模擬臨床推理移轉的情境比較", "認知負荷軌跡在護理模擬推理移轉中的機制研究", "回饋依賴對護理臨床推理延宕移轉的失效邊界"];
const questions = ["不同可解釋回饋如何影響臨床推理移轉？", "認知負荷軌跡如何解釋臨床推理移轉？", "回饋依賴何時降低延宕臨床推理移轉？"];
const targets = ["護理學習者的模擬訓練與後續臨床推理情境", "護理學習者的三波模擬訓練與延宕評量情境", "護理學習者的回饋撤除訓練與臨床邊界情境"];
const contributions = ["建立回饋策略的可反駁實務比較", "建立認知負荷的時間機制證據", "界定回饋依賴的失效邊界"];
const methods = ["準實驗比較", "三波縱貫機制分析", "回饋撤除與異質性分析"];
function s0(index) { return { workingTitle: titles[index], domain: "AI × 教育", outputTrack: "NSTC", problemContext: `研究者原始方向：${request.researchDirection}。本方案研究問題：${questions[index]} 專業背景與場域條件仍待核對。`, targetUsers: targets[index], expectedContribution: contributions[index], existingData: "目前沒有已確認資料", availableData: "可規劃去識別化推理歷程與延宕評量；權限待確認", methodIdea: methods[index], timeline: "分階段執行；期程待確認", constraints: "樣本、教師時間與平台一致性待確認", ethicsPrivacyRisks: "需倫理、隱私與學習評量用途審查", unresolvedItems: "樣本數、工具效度與延宕時間待確認" }; }
const content = JSON.stringify({ recommendedLane: "EMERGING_FRONTIER", recommendationRationale: "縱貫機制可反駁且可連結實務；來源證據仍不足。", candidates: RESEARCH_PLAN_LANES.map((lane, index) => ({ lane, workingTitle: titles[index], researchQuestion: questions[index], researchValue: `方案 ${index + 1} 連結訓練決策與可觀察結果`, mechanismTheory: ["回饋時點與行為強化", "認知負荷與記憶鞏固", "回饋依賴與撤除成本"][index], targetContext: targets[index], contribution: contributions[index], methodDesign: methods[index], dataPlan: "去識別化推理歷程與延宕評量", feasibility: "先做單班小規模可行性", riskEthics: "避免將學習資料用於懲罰性評量", evidenceStatus: "UNVERIFIED", assumptions: ["教師與學習者可參與"], unresolvedItems: ["樣本與工具待確認"], nextAction: "人工核對後進入預覽", s0Draft: s0(index) })) });

let modelSubmissions = 0;
let sourceBatches = 0;
const options = {
  observedAt: new Date("2026-08-24T00:00:00.000Z"),
  collect: async () => { sourceBatches += 1; return { capability: "SCHOLARLY_DISABLED", observations: [], providerStates: { OPENALEX: "DISABLED", CROSSREF: "DISABLED", SEMANTIC_SCHOLAR: "DISABLED" } }; },
  provider: { id: "OLD_MIKE_DEFAULT", capability: "ENABLED", async submit() { modelSubmissions += 1; return { kind: "success", content }; } },
};
const [first, second] = await Promise.all([executeTopicLabAnalysis(request, options), executeTopicLabAnalysis(request, options)]);
assert.equal(modelSubmissions, 1);
assert.equal(sourceBatches, 1);
assert.deepEqual(first, second);
assert.equal(first.analysis.candidates.length, 3);
assert.equal(first.analysis.recommendedCandidateId, first.analysis.candidates[1].candidateId);

await assert.rejects(() => executeTopicLabAnalysis({ ...request, researchDirection: "不同內容" }, options), /topic_lab_idempotency_conflict/);
assert.equal(modelSubmissions, 1);

let unknownCalls = 0;
const unknown = { ...request, idempotencyKey: "research-start:singleflight:unknown" };
await assert.rejects(() => executeTopicLabAnalysis(unknown, { ...options, provider: { id: "OLD_MIKE_DEFAULT", capability: "ENABLED", async submit() { unknownCalls += 1; return { kind: "completion-unknown", code: "transport_failure_before_headers", evidence: { reasonEnum: "TRANSPORT_FAILURE_BEFORE_HEADERS", elapsedBucket: "LT_1S", providerAttemptClass: "SUBMISSION_POSSIBLE" } }; } } }), /research_generation_transport_failure_before_headers/);
assert.equal(unknownCalls, 1, "completion unknown is never retried or switched");

const gpt = createDisabledGptByokResearchProvider();
assert.equal(gpt.capability, "NOT_CONFIGURED");
assert.deepEqual(await gpt.submit({ messages: [], sessionKey: "fixture-session" }), { kind: "proven-not-submitted", code: "provider_not_configured" });

console.log("C2R4_ROUTING_EFFECTIVELY_ONCE=PASS");
