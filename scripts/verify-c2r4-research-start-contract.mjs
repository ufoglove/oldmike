import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  RESEARCH_DIRECTION_MAX_LENGTH,
  RESEARCH_PLAN_LANES,
  RESEARCH_PLAN_S0_BINDINGS,
  normalizeResearchStartRequest,
  parseResearchPlanEnvelope,
} from "../lib/research-start-contract.ts";
import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import { sha256CanonicalPortable, sha256Utf8 } from "../lib/canonical-sha256.ts";

assert.equal(sha256Utf8("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(sha256CanonicalPortable({ b: 2, a: ["老麥", undefined, -0] }), createHash("sha256").update('{"a":["老麥",null,0],"b":2}', "utf8").digest("hex"));
assert.deepEqual(RESEARCH_PLAN_S0_BINDINGS, { workingTitle: "workingTitle", methodIdea: "methodDesign", expectedContribution: "contribution", targetUsers: "targetContext", problemContext: "researchDirection+researchQuestion+professionalBackground" });

const direction = "改善高風險作業人員在擴增實境安全訓練後的危害辨識移轉";
function requestFor(researchDirection = direction, advanced = {}, sourceStrategy = "NONE") {
  return normalizeResearchStartRequest({ operation: "ANALYZE", idempotencyKey: `research-start:fixture:${createHash("sha256").update(researchDirection).digest("hex").slice(0, 12)}`, researchDirection, advanced, sourceStrategy, evidenceWindow: { from: "2023-08-24", to: "2026-08-24" }, sourceUrls: [] });
}
const request = requestFor();
assert.equal(request.researchDirection, direction);
assert.equal(request.advanced.domain, null);
assert.equal(request.sourceStrategy, "NONE");
const schema = JSON.parse(readFileSync(new URL("../contracts/research-start.schema.json", import.meta.url), "utf8"));
assert.equal(schema["x-old-mike-authority"], "lib/s0-fields.ts#S0_FIELDS");
assert.deepEqual(schema.$defs.s0.required, [...S0_FIELD_NAMES]);

const titles = [
  "擴增實境危害辨識回饋對高風險作業訓練移轉的影響：情境比較研究",
  "沉浸式安全訓練中的認知負荷軌跡與危害辨識移轉：縱貫機制研究",
  "高風險作業訓練移轉失效的邊界條件：擴增實境提示依賴與延宕保留",
];
const questions = [
  "不同回饋時點如何影響高風險作業人員的危害辨識與工作場域訓練移轉？",
  "認知負荷與臨場感的時間變化是否解釋沉浸式訓練後的危害辨識移轉？",
  "擴增實境提示依賴在何種工作情境下會降低延宕危害辨識與訓練移轉？",
];
const methods = ["準實驗情境比較與延宕測量", "三波縱貫追蹤與中介機制分析", "提示撤除實驗與異質性邊界分析"];
const targets = ["高風險作業人員的擴增實境訓練與後續工作場域", "高風險作業人員的沉浸式訓練與延宕評量場域", "高風險作業人員的提示撤除訓練與真實工作情境"];
const contributions = ["提出可被否證的回饋時點實務比較證據。", "提出可被否證的認知負荷時間機制證據。", "提出可被否證的提示依賴失效邊界證據。"];

function s0(index, activeRequest = request, overrides = {}) {
  const directionText = activeRequest.researchDirection.trim();
  return {
    workingTitle: titles[index], domain: "AR/VR/XR × 職業安全與教育訓練", outputTrack: "NSTC",
    problemContext: `研究者原始方向：${directionText}。本方案聚焦研究問題：${questions[index]} 現有背景與場域條件仍需由研究者及來源核對。`,
    targetUsers: targets[index], expectedContribution: contributions[index], existingData: "目前沒有已確認的正式資料；需先盤點可用紀錄。",
    availableData: "可規劃去識別化訓練表現、危害辨識與延宕測量資料，實際權限待確認。", methodIdea: methods[index],
    timeline: "建議分為場域協議、前測、介入、延宕後測與分析；實際期程待確認。", constraints: "樣本可得性、設備一致性與工作場域介入負荷仍待確認。",
    ethicsPrivacyRisks: "需完成倫理、隱私、職場同意與去識別化審查；不得將訓練表現用於人事懲處。", unresolvedItems: "場域、樣本數、測量工具效度、資料權限與替代解釋待研究者核定。", ...overrides,
  };
}

function envelope(activeRequest = request, s0Factory = s0) {
  return { recommendedLane: "EMERGING_FRONTIER", recommendationRationale: "第二方案直接檢驗時間機制且能以分波資料反駁；目前來源證據不足，優先序仍屬待審查概念。", candidates: RESEARCH_PLAN_LANES.map((lane, index) => ({
    lane, workingTitle: titles[index], researchQuestion: questions[index], researchValue: `方案 ${index + 1} 將可觀察構念連結至實務訓練決策，價值仍待來源與研究者核對。`,
    mechanismTheory: index === 0 ? "回饋時點與近端行為強化" : index === 1 ? "認知負荷、臨場感與記憶鞏固" : "提示依賴、撤除成本與情境邊界",
    targetContext: targets[index], contribution: contributions[index], methodDesign: methods[index], dataPlan: "使用去識別化危害辨識、訓練表現與延宕測量；資料權限與樣本量待確認。",
    feasibility: "先以單一場域小規模驗證量測與招募，再依可得資源調整設計。", riskEthics: "倫理、隱私、職場權力關係與設備暈動風險均需正式審查。",
    evidenceStatus: "UNVERIFIED", assumptions: ["場域願意提供去識別化資料", "量測工具可在目標族群使用"], unresolvedItems: ["樣本數", "場域權限", "延宕測量時間"],
    nextAction: "由研究者核對構念、場域與資料可得性後再進入正式預覽。", s0Draft: s0Factory(index, activeRequest),
  })) };
}

for (const raw of [JSON.stringify(envelope()), `\`\`\`json\n${JSON.stringify(envelope())}\n\`\`\``]) {
  const parsed = parseResearchPlanEnvelope(raw, request);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok && parsed.value.candidates.map(({ lane }) => lane), RESEARCH_PLAN_LANES);
  for (const candidate of parsed.ok ? parsed.value.candidates : []) {
    assert.deepEqual(Object.keys(candidate.s0Draft).sort(), [...S0_FIELD_NAMES].sort());
    assert.equal(candidate.researchDirectionProvenance.value, direction);
    assert.equal(candidate.researchDirectionProvenance.status, "USER_PROVIDED");
    assert.equal(candidate.s0Draft.workingTitle, candidate.workingTitle);
    assert.equal(candidate.s0Draft.methodIdea, candidate.methodDesign);
    assert.equal(candidate.s0Draft.expectedContribution, candidate.contribution);
    assert.equal(candidate.s0Draft.targetUsers, candidate.targetContext);
    assert.match(candidate.s0Draft.problemContext, new RegExp(direction, "u"));
    assert.match(candidate.s0Draft.problemContext, new RegExp(candidate.researchQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }
}

const exactFacts = { population: "高風險夜班維修人員", context: "夜班維修情境", method: "混合方法", data: "既有 12 筆紀錄 [1]", timeline: "18 個月", ethics: "尚未取得同意" };
const factRequest = requestFor(direction, { domain: "AR/VR/XR × 職業安全與教育訓練", outputTrack: "NSTC", ...exactFacts });
const factEnvelope = envelope(factRequest, (index, activeRequest) => {
  const target = `${exactFacts.population}；${exactFacts.context}；${targets[index]}`;
  const method = `${exactFacts.method}；${methods[index]}`;
  return s0(index, activeRequest, { targetUsers: target, methodIdea: method, availableData: `${exactFacts.data}；資料權限待確認。`, timeline: `${exactFacts.timeline}；分階段執行。`, ethicsPrivacyRisks: `${exactFacts.ethics}；須完成倫理與隱私審查。` });
});
factEnvelope.candidates.forEach((candidate, index) => { candidate.targetContext = factEnvelope.candidates[index].s0Draft.targetUsers; candidate.methodDesign = factEnvelope.candidates[index].s0Draft.methodIdea; });
const factParsed = parseResearchPlanEnvelope(JSON.stringify(factEnvelope), factRequest);
assert.equal(factParsed.ok, true);
for (const candidate of factParsed.ok ? factParsed.value.candidates : []) for (const fact of Object.values(exactFacts)) assert.equal(JSON.stringify(candidate).includes(fact), true, `researcher fact missing: ${fact}`);

const shortDirection = requestFor("安全訓練");
const shortRaw = envelope(shortDirection, (index, activeRequest) => s0(index, activeRequest, { problemContext: activeRequest.researchDirection }));
assert.equal(parseResearchPlanEnvelope(JSON.stringify(shortRaw), shortDirection).ok, false, "a short raw direction is not a complete professional problem background");

const unrelated = envelope();
unrelated.candidates[0].s0Draft.methodIdea = "完全無關的方法";
assert.equal(parseResearchPlanEnvelope(JSON.stringify(unrelated), request).ok, false, "unrelated S0 must fail exact binding");

const identicalS0 = envelope();
identicalS0.candidates[1].s0Draft = { ...identicalS0.candidates[0].s0Draft };
identicalS0.candidates[2].s0Draft = { ...identicalS0.candidates[0].s0Draft };
assert.equal(parseResearchPlanEnvelope(JSON.stringify(identicalS0), request).ok, false, "three cards cannot carry one repeated S0");

const boundary = "研".repeat(RESEARCH_DIRECTION_MAX_LENGTH);
assert.equal(requestFor(boundary).researchDirection.length, RESEARCH_DIRECTION_MAX_LENGTH);
assert.throws(() => requestFor(`${boundary}研`), /research_direction_required/);

for (const invalid of [`before ${JSON.stringify(envelope())}`, `${JSON.stringify(envelope())}\nafter`, `${JSON.stringify(envelope())}${JSON.stringify(envelope())}`, JSON.stringify({ ...envelope(), provider: "not-allowed" })]) assert.equal(parseResearchPlanEnvelope(invalid, request).ok, false);
const placeholder = envelope(); placeholder.candidates[0].workingTitle = "〈研究類型〉研究：以〈對象／情境〉為例探討〈研究主題〉"; assert.equal(parseResearchPlanEnvelope(JSON.stringify(placeholder), request).ok, false);
const missing = envelope(); delete missing.candidates[2].s0Draft.constraints; const missingResult = parseResearchPlanEnvelope(JSON.stringify(missing), request); assert.equal(missingResult.ok, false); assert.equal(!missingResult.ok && missingResult.recoverableFields.includes("candidates.2.s0Draft.constraints"), true);

console.log("C2R4_BR1_RESEARCH_START_CONTRACT=PASS");
