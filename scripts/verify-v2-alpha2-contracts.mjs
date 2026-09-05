import assert from "node:assert/strict";

import {
  S0_FIELD_NAMES,
  V2_ALPHA2_DIRECTION_LANES,
  V2_ALPHA2_SUGGESTION_STRATEGIES,
  mergeJourneySnapshots,
  parseDirectionArtifact,
  parseFieldAssistArtifact,
  parseJourneySnapshot,
  parseS0Artifact,
  validatePersistedFieldAssistArtifact,
  validateCreateJourneyRequest,
} from "../lib/v2-alpha2/contracts.ts";

const researchDirection = "大學教師如何在課程中校準生成式工具的使用";

const directions = [
  {
    directionId: "dir_evidence",
    lane: "EVIDENCE_FIRST",
    workingTitle: "大學教師生成式工具決策的證據使用與課程調整機制",
    researchQuestion: "教師如何使用可觀察證據調整生成式工具的課程決策？",
    researchValue: "建立可反駁的證據—決策鏈結。",
    mechanismTheory: "證據校準影響教師判斷與課程調整。",
    targetContext: "大學課程與授課教師；場域仍待研究者確認。",
    methodSketch: "文件分析結合半結構訪談。",
    feasibilityRisk: "文件可先盤點；樣本與權限仍未知。",
    domain: "高等教育",
    outputTrack: "學術論文",
    unknowns: ["樣本框", "資料權限"],
    nextAction: "確認可取得的課程文件。",
  },
  {
    directionId: "dir_balanced",
    lane: "BALANCED_RECOMMENDED",
    workingTitle: "生成式工具信任校準、教師決策與課程品質的混合方法研究",
    researchQuestion: "信任校準如何影響教師決策與可觀察的課程品質？",
    researchValue: "兼顧作用機制、可行性與實務用途。",
    mechanismTheory: "信任校準透過專業判斷影響教學設計。",
    targetContext: "大學教師與課程實施情境；實際樣本待確認。",
    methodSketch: "問卷描繪關聯，再以訪談解釋機制。",
    feasibilityRisk: "可分階段執行；量測工具仍待驗證。",
    domain: "教育科技",
    outputTrack: "學術論文",
    unknowns: ["量測工具"],
    nextAction: "確認主要構念與可用資料。",
  },
  {
    directionId: "dir_frontier",
    lane: "FRONTIER_INNOVATION",
    workingTitle: "生成式工具教學決策的失效邊界與反直覺效果",
    researchQuestion: "何種條件下生成式工具反而削弱教師判斷或學生參與？",
    researchValue: "以負向案例界定理論邊界。",
    mechanismTheory: "認知卸載與過度信任形成非線性失效條件。",
    targetContext: "具不同工具整合程度的大學課程；分層依據待確認。",
    methodSketch: "邊界案例抽樣與負向案例比較。",
    feasibilityRisk: "原創性高；案例取得與替代解釋控制較難。",
    domain: "學習科學",
    outputTrack: "學術論文",
    unknowns: ["失效訊號", "替代機制"],
    nextAction: "界定可觀察的失效訊號。",
  },
];

const directionArtifact = parseDirectionArtifact({
  schemaId: "old-mike-v2-alpha2/directions/1",
  researchDirection,
  directions,
  recommendedDirectionId: "dir_balanced",
  additiveProviderTrace: "ignored",
});
assert.deepEqual(directionArtifact.directions.map((item) => item.lane), V2_ALPHA2_DIRECTION_LANES);
assert.equal(directionArtifact.recommendedDirectionId, "dir_balanced");
assert.throws(
  () => parseDirectionArtifact({ schemaId: "old-mike-v2-alpha2/directions/1", researchDirection, directions: [directions[0], directions[0], directions[2]], recommendedDirectionId: "dir_balanced" }),
  /direction_lane_set_invalid|direction_id_duplicate/u,
);

const s0Draft = {
  workingTitle: directions[1].workingTitle,
  domain: directions[1].domain,
  outputTrack: directions[1].outputTrack,
  problemContext: `${researchDirection}。本草稿把信任校準、教師決策與課程品質整理成待驗證的研究背景；不把假設寫成結果。`,
  targetUsers: directions[1].targetContext,
  expectedContribution: "建立可檢驗的信任校準作用機制並說明實務意義。",
  existingData: "尚未盤點；不假定已有正式研究資料。",
  availableData: "可評估課程文件、教師訪談與去識別化活動紀錄，實際權限待確認。",
  methodIdea: directions[1].methodSketch,
  timeline: "先完成證據與可行性盤點，再由研究者確認期程。",
  constraints: "樣本、資料權限、量測工具、人力與預算仍待確認。",
  ethicsPrivacyRisks: "需處理知情同意、資料最小化、去識別化與權力關係。",
  unresolvedItems: "樣本框、量測工具、資料取得、倫理審查與正式引用待確認。",
};
const s0Artifact = parseS0Artifact({
  schemaId: "old-mike-v2-alpha2/s0/1",
  sourceDirectionId: "dir_balanced",
  fields: s0Draft,
});
assert.deepEqual(Object.keys(s0Artifact.fields), [...S0_FIELD_NAMES]);
assert.equal(Object.values(s0Artifact.fields).filter((value) => value.trim().length > 0).length, 13);
assert.throws(() => parseS0Artifact({ schemaId: "old-mike-v2-alpha2/s0/1", sourceDirectionId: "dir_balanced", fields: { ...s0Draft, timeline: "" } }), /s0_field_invalid:timeline/u);

const assist = parseFieldAssistArtifact({
  schemaId: "old-mike-v2-alpha2/field-assist/1",
  targetField: "workingTitle",
  options: [
    { strategy: "EVIDENCE_FIRST", text: "生成式工具決策的證據使用與課程調整機制", rationale: "先界定可觀察證據。", boundary: "UNVERIFIED" },
    { strategy: "BALANCED_RECOMMENDED", text: "生成式工具信任校準、教師決策與課程品質", rationale: "兼顧機制與可行性。", boundary: "ASSUMPTION" },
    { strategy: "FRONTIER_INNOVATION", text: "生成式工具教學決策的失效邊界", rationale: "以負向案例測試邊界。", boundary: "UNVERIFIED" },
  ],
  unrelatedAdditiveField: true,
});
assert.deepEqual(assist.slots.map((slot) => slot.strategy), V2_ALPHA2_SUGGESTION_STRATEGIES);
assert.equal(assist.validOptions.length, 3);
assert.equal(assist.recommendedOption?.strategy, "BALANCED_RECOMMENDED");
assert.deepEqual(validatePersistedFieldAssistArtifact({ ...assist, ignoredStorageField: true }), assist);
const partialAssist = parseFieldAssistArtifact({
  schemaId: "old-mike-v2-alpha2/field-assist/1",
  targetField: "domain",
  options: [
    { strategy: "EVIDENCE_FIRST", text: "高等教育", rationale: "依研究場域分類。", boundary: "ASSUMPTION" },
    { strategy: "BALANCED_RECOMMENDED", text: "", rationale: "invalid", boundary: "ASSUMPTION" },
    { strategy: "FRONTIER_INNOVATION", text: "學習科學", rationale: "依機制分類。", boundary: "ASSUMPTION" },
  ],
});
assert.equal(partialAssist.validOptions.length, 2);
assert.equal(partialAssist.slots[1].status, "INVALID");
assert.throws(
  () => parseFieldAssistArtifact({ schemaId: "old-mike-v2-alpha2/field-assist/1", targetField: "domain", options: [assist.validOptions[0], assist.validOptions[0], assist.validOptions[2]] }),
  /assist_strategy_set_invalid/u,
);

const request = validateCreateJourneyRequest({
  contractVersion: "old-mike-v2-alpha2/1.0.0",
  idempotencyKey: "explicit-action-00000001",
  researchDirection,
  sourceStrategy: "NONE",
  additiveClientField: "ignored",
});
assert.deepEqual(request, {
  contractVersion: "old-mike-v2-alpha2/1.0.0",
  idempotencyKey: "explicit-action-00000001",
  researchDirection,
  sourceStrategy: "NONE",
});

const queued = parseJourneySnapshot({
  contractVersion: "old-mike-v2-alpha2/journey/1",
  journeyRef: "vj_01alpha2fixture000000000001",
  state: "QUEUED",
  lastReadyStage: "NONE",
  stageA: null,
  stageB: null,
  selectedCompareDirectionId: null,
  s0SourceDirectionId: null,
  cancelAllowed: true,
  recoveryAction: "CANCEL_OR_VIEW_PROGRESS",
  formalWriteCount: 0,
});
const stageAReady = parseJourneySnapshot({
  ...queued,
  state: "STAGE_B_RUNNING",
  lastReadyStage: "A",
  stageA: { contentHash: "a".repeat(64), ...directionArtifact },
  selectedCompareDirectionId: "dir_frontier",
  s0SourceDirectionId: "dir_balanced",
  cancelAllowed: false,
  recoveryAction: "VIEW_PROGRESS",
});
const reconcile = parseJourneySnapshot({
  ...stageAReady,
  state: "RECONCILE_REQUIRED",
  lastReadyStage: "A",
  stageA: null,
  stageB: null,
  cancelAllowed: false,
  recoveryAction: "VIEW_PROGRESS",
});
const merged = mergeJourneySnapshots(stageAReady, reconcile);
assert.equal(merged.lastReadyStage, "A");
assert.equal(merged.stageA?.contentHash, "a".repeat(64));
assert.equal(merged.selectedCompareDirectionId, "dir_frontier");
assert.equal(merged.s0SourceDirectionId, "dir_balanced");
assert.equal(merged.cancelAllowed, false);
assert.throws(() => parseJourneySnapshot({ ...stageAReady, cancelAllowed: true }), /journey_cancel_boundary_invalid/u);

console.log("V2_ALPHA2_CONTRACTS=PASS");
console.log("V2_ALPHA2_JOURNEY_ROOT=PASS_IMMUTABLE_PARTIAL_ARTIFACTS");
console.log("V2_ALPHA2_DIRECTION_OPTIONS=PASS_3");
console.log("V2_ALPHA2_S0_FIELDS=PASS_13");
console.log("V2_ALPHA2_ASSIST_STRATEGIES=PASS_EXACT_SLOTS");
console.log("V2_ALPHA2_FORMAL_WRITES=0");
