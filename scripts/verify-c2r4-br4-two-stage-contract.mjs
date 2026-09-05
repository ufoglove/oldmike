import assert from "node:assert/strict";

import {
  RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS,
  RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES,
  RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS,
  buildResearchStartStageBRequest,
  normalizeResearchStartStageARequest,
  parseResearchDirectionEnvelope,
  parseResearchS0ExpansionEnvelope,
} from "../lib/research-start-two-stage-contract.ts";
import {
  ResearchStartTwoStageError,
  executeResearchStartStageA,
  executeResearchStartStageB,
  resetResearchStartTwoStageLedgerForTests,
} from "../lib/research-start-two-stage-service.ts";
import { openClawChatOperationContracts, resolveDefaultOpenClawOperationRoute } from "../lib/openclaw.ts";
import { researchDirectionStageMessages, researchS0ExpansionStageMessages } from "../lib/assist-prompts.ts";

const direction = "探討高風險產業新進人員的安全訓練移轉與現場危害判斷";
const rootIntentId = "research-root:br4-contract-00000001";
const baseA = {
  contractVersion: "research-start-two-stage/1.0.0",
  operation: "GENERATE_DIRECTIONS",
  rootIntentId,
  idempotencyKey: `${rootIntentId}:stage-a:action-0001`,
  researchDirection: direction,
  advanced: {
    domain: "AI × 職業安全與教育訓練",
    outputTrack: "NSTC",
    population: "高風險產業新進人員",
    context: "職前與現場銜接訓練",
    method: "混合方法序列設計",
    data: "情境判斷測驗與訪談資料",
    timeline: "十二個月",
    ethics: "需完成知情同意與去識別化",
  },
  sourceStrategy: "NONE",
};

const cards = [
  {
    lane: "CURRENT_PRACTICE_VALUE",
    workingTitle: "情境判斷回饋如何提升高風險產業新進人員的安全訓練移轉",
    researchQuestion: "情境判斷回饋如何影響新進人員由職前訓練到現場的危害辨識移轉？",
    researchValue: "釐清現行訓練與現場判斷間的可改善環節。",
    mechanismTheory: "以回饋素養與訓練移轉機制作為可檢驗解釋。",
    targetContext: "高風險產業新進人員於職前與現場銜接訓練。",
    methodSketch: "混合方法序列設計，結合情境判斷測驗與訪談資料。",
    feasibilityRisk: "可沿用訓練流程蒐集資料，但需控制主管評分偏差。",
    domain: "AI × 職業安全與教育訓練",
    outputTrack: "NSTC",
    unknowns: ["現場主管可投入的觀察時數"],
    nextAction: "確認場域流程與可取得的基線資料。",
  },
  {
    lane: "EMERGING_FRONTIER",
    workingTitle: "適性化危害情境提示對新進人員現場判斷校準的作用機制",
    researchQuestion: "適性提示能否改善新進人員對低頻高風險情境的判斷校準？",
    researchValue: "建立適性提示與判斷校準之間的可驗證關係。",
    mechanismTheory: "以認知負荷與後設判斷校準解釋提示效果。",
    targetContext: "高風險產業新進人員於職前與現場銜接訓練中的模擬與前置活動。",
    methodSketch: "混合方法序列設計，先以準實驗搭配歷程紀錄與情境判斷測驗，再進行訪談。",
    feasibilityRisk: "需確認提示系統可用性，且不得宣稱為已證明的新興趨勢。",
    domain: "AI × 職業安全與教育訓練",
    outputTrack: "NSTC",
    unknowns: ["提示系統可記錄的歷程粒度", "可用樣本規模"],
    nextAction: "盤點提示規則與最小可行實驗條件。",
  },
  {
    lane: "HIGH_VALUE_GAP_OR_CONTRARIAN",
    workingTitle: "訓練高分是否掩蓋高風險新進人員的現場危害誤判",
    researchQuestion: "訓練測驗高分是否可能與現場危害誤判並存，且由情境差異所解釋？",
    researchValue: "檢驗現有績效指標可能遺漏的實務風險。",
    mechanismTheory: "以近遷移與遠遷移落差及情境依賴解釋指標失配。",
    targetContext: "高風險產業新進人員由職前與現場銜接訓練進入真實作業情境。",
    methodSketch: "混合方法序列設計，以配對測量比較訓練測驗與情境判斷，再分析訪談資料。",
    feasibilityRisk: "現場事件低頻，需預先界定替代指標與停止條件。",
    domain: "AI × 職業安全與教育訓練",
    outputTrack: "NSTC",
    unknowns: ["可合法使用的現場替代指標"],
    nextAction: "與場域共同界定不涉及事故個資的結果指標。",
  },
];

const stageAContent = JSON.stringify({
  recommendedLane: "CURRENT_PRACTICE_VALUE",
  recommendationRationale: "現行流程已有可觀察資料，最適合先建立可審查的研究起點。",
  cards,
});

const stageBContent = JSON.stringify({
  problemContext: `${direction}。本研究將聚焦職前與現場銜接時的情境判斷回饋，避免把訓練成績直接等同現場能力。`,
  expectedContribution: "建立情境判斷回饋、訓練移轉與現場危害辨識之間可檢驗的分析架構。",
  existingData: "目前僅確認可能存在既有訓練紀錄，實際欄位與品質仍待盤點。",
  availableData: "情境判斷測驗與訪談資料；資料可得性仍須由場域確認。",
  timeline: "十二個月；實際招募與場域時程仍需確認。",
  constraints: "不得把訓練測驗分數直接視為事故風險，並需控制主管評分偏差。",
  ethicsPrivacyRisks: "需完成知情同意與去識別化；不蒐集非必要的事故或身分資料。",
  unresolvedItems: "現場主管可投入的觀察時數、樣本規模與資料欄位仍待確認。",
});

function providerFor(content, resultKind = "success") {
  let submissions = 0;
  return {
    provider: {
      id: "OLD_MIKE_DEFAULT",
      capability: "ENABLED",
      async submit() {
        submissions += 1;
        if (resultKind === "completion-unknown") return {
          kind: "completion-unknown",
          code: "provider_deadline",
          evidence: { reasonEnum: "PROVIDER_DEADLINE", elapsedBucket: "GE_60S", providerAttemptClass: "SUBMISSION_POSSIBLE" },
        };
        if (resultKind === "proven-not-submitted") return { kind: "proven-not-submitted", code: "canceled_before_submission" };
        return { kind: "success", content };
      },
    },
    submissions: () => submissions,
  };
}

resetResearchStartTwoStageLedgerForTests();
const normalizedA = normalizeResearchStartStageARequest(baseA);
const parsedA = parseResearchDirectionEnvelope(stageAContent, normalizedA);
assert.equal(parsedA.ok, true);
if (!parsedA.ok) throw new Error("stage_a_fixture_invalid");
assert.deepEqual(parsedA.value.cards.map((card) => card.lane), ["CURRENT_PRACTICE_VALUE", "EMERGING_FRONTIER", "HIGH_VALUE_GAP_OR_CONTRARIAN"]);
assert.equal(parsedA.value.cards.every((card) => !("s0Draft" in card)), true);
assert.equal(parsedA.value.cards.every((card) => card.unknowns.length >= 1 && card.unknowns.length <= 2), true);
assert.equal(new Set(parsedA.value.cards.map((card) => card.workingTitle)).size, 3);
assert.equal(parsedA.value.researchDirectionProvenance.value, direction);
assert.equal(parsedA.value.researchDirectionProvenance.status, "USER_PROVIDED");
assert.equal(JSON.stringify(parsedA.value).includes("provider"), false);
assert.equal(JSON.stringify(parsedA.value).includes("model"), false);

for (const operation of ["M01_RESEARCH_DIRECTIONS", "M01_RESEARCH_S0_EXPAND"]) {
  const route = resolveDefaultOpenClawOperationRoute(operation);
  assert.deepEqual(openClawChatOperationContracts[operation], { endpointFamily: "CHAT_COMPLETIONS", endpointFeatureState: "ENABLED" });
  assert.equal(route.timeoutMs, RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS);
  assert.equal(route.outputLimitBytes, RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES);
  assert.equal(route.modelOverride, null);
  assert.equal(route.endpointFamily, "CHAT_COMPLETIONS");
}
assert.equal(RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS, 60_000);
assert.equal(RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS, 75_000);
assert.equal(RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES, 24 * 1_024);
assert.ok(Buffer.byteLength(JSON.stringify(researchDirectionStageMessages(normalizedA))) < 24 * 1_024);

const exactLimit = stageAContent + " ".repeat(RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES - Buffer.byteLength(stageAContent));
assert.equal(Buffer.byteLength(exactLimit), RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES);
assert.equal(parseResearchDirectionEnvelope(exactLimit, normalizedA).ok, true);
assert.deepEqual(parseResearchDirectionEnvelope(`${exactLimit} `, normalizedA), {
  ok: false, code: "research_stage_a_json_invalid", stage: "JSON_ENVELOPE", recoverableFields: [],
});
const cardWithForbiddenS0 = structuredClone(JSON.parse(stageAContent));
cardWithForbiddenS0.cards[0].s0Draft = {};
assert.deepEqual(parseResearchDirectionEnvelope(JSON.stringify(cardWithForbiddenS0), normalizedA), {
  ok: false, code: "research_stage_a_card_invalid", stage: "CARD_SHAPE", recoverableFields: ["cards.0"],
});

const stageAProvider = providerFor(stageAContent);
const firstA = await executeResearchStartStageA(normalizedA, { scope: "fixture-user", provider: stageAProvider.provider });
const replayA = await executeResearchStartStageA(normalizedA, { scope: "fixture-user", provider: stageAProvider.provider });
assert.deepEqual(replayA, firstA);
assert.equal(stageAProvider.submissions(), 1);
await assert.rejects(
  executeResearchStartStageA({ ...normalizedA, researchDirection: `${direction}（不同內容）` }, { scope: "fixture-user", provider: stageAProvider.provider }),
  (error) => error instanceof ResearchStartTwoStageError && error.status === 409 && error.code === "research_stage_idempotency_conflict" && error.providerAttemptClass === "NOT_SUBMITTED",
);

const recommended = firstA.directionSet.cards.find((card) => card.cardId === firstA.directionSet.recommendedCardId);
assert.ok(recommended);
const normalizedB = buildResearchStartStageBRequest({
  rootIntentId,
  rootIntentHash: firstA.rootIntentHash,
  idempotencyKey: `${rootIntentId}:stage-b:action-0001`,
  researchDirection: direction,
  advanced: normalizedA.advanced,
  selectedCard: recommended,
});
const parsedB = parseResearchS0ExpansionEnvelope(stageBContent, normalizedB);
assert.equal(parsedB.ok, true);
if (!parsedB.ok) throw new Error("stage_b_fixture_invalid");
assert.equal(Object.keys(parsedB.value.s0Draft).length, 13);
assert.equal(parsedB.value.s0Draft.workingTitle, recommended.workingTitle);
assert.equal(parsedB.value.s0Draft.methodIdea, recommended.methodSketch);
assert.equal(parsedB.value.s0Draft.targetUsers, recommended.targetContext);
assert.equal(parsedB.value.s0Draft.problemContext.split(direction).length - 1, 1);
assert.equal(parsedB.value.s0Draft.expectedContribution, stageBContent && JSON.parse(stageBContent).expectedContribution);
assert.ok(Buffer.byteLength(JSON.stringify(researchS0ExpansionStageMessages(normalizedB))) < 24 * 1_024);
const exactStageBLimit = stageBContent + " ".repeat(RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES - Buffer.byteLength(stageBContent));
assert.equal(parseResearchS0ExpansionEnvelope(exactStageBLimit, normalizedB).ok, true);
assert.equal(parseResearchS0ExpansionEnvelope(`${exactStageBLimit} `, normalizedB).ok, false);

const stageBProvider = providerFor(stageBContent);
const firstB = await executeResearchStartStageB(normalizedB, { scope: "fixture-user", provider: stageBProvider.provider });
const replayB = await executeResearchStartStageB(normalizedB, { scope: "fixture-user", provider: stageBProvider.provider });
assert.deepEqual(replayB, firstB);
assert.equal(stageBProvider.submissions(), 1);

const deadlineProvider = providerFor(stageBContent, "completion-unknown");
const deadlineRequest = { ...normalizedB, idempotencyKey: `${rootIntentId}:stage-b:action-deadline` };
await assert.rejects(
  executeResearchStartStageB(deadlineRequest, { scope: "fixture-user", provider: deadlineProvider.provider }),
  (error) => error instanceof ResearchStartTwoStageError && error.completionClass === "COMPLETION_UNKNOWN" && error.providerAttemptClass === "SUBMISSION_POSSIBLE",
);
await assert.rejects(executeResearchStartStageB(deadlineRequest, { scope: "fixture-user", provider: deadlineProvider.provider }));
assert.equal(deadlineProvider.submissions(), 1);
assert.equal(firstA.directionSet.cards.length, 3);
assert.equal(firstA.formalResearchWrites, 0);
assert.equal(firstA.liveScholarlyEgress, 0);

const notSubmittedProvider = providerFor(stageAContent, "proven-not-submitted");
const notSubmittedRequest = { ...normalizedA, rootIntentId: "research-root:br4-contract-00000002", idempotencyKey: "research-root:br4-contract-00000002:stage-a:action-0001" };
await assert.rejects(
  executeResearchStartStageA(notSubmittedRequest, { scope: "fixture-user", provider: notSubmittedProvider.provider }),
  (error) => error instanceof ResearchStartTwoStageError && error.completionClass === "PROVEN_NOT_SUBMITTED",
);
assert.equal(notSubmittedProvider.submissions(), 1);
const explicitRetrigger = { ...notSubmittedRequest, idempotencyKey: `${notSubmittedRequest.rootIntentId}:stage-a:action-0002` };
await assert.rejects(executeResearchStartStageA(explicitRetrigger, { scope: "fixture-user", provider: notSubmittedProvider.provider }));
assert.equal(notSubmittedProvider.submissions(), 2);

console.log("C2R4_BR4_TWO_STAGE_CONTRACT=PASS");
console.log("STAGE_A_SCENARIOS=5");
console.log("STAGE_B_SCENARIOS=4");
console.log("PROVIDER_SUBMISSION_MAXIMUM_PER_STAGE=1");
console.log("FORMAL_RESEARCH_WRITES=0");
