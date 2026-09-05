import assert from "node:assert/strict";

import { V2Alpha2WorkerTermination, runV2Alpha2WorkerOnce } from "../lib/v2-alpha2/worker.ts";

const directionPayload = {
  schemaId: "old-mike-v2-alpha2/directions/1",
  researchDirection: "教師如何校準生成式工具的課程使用",
  directions: [
    { directionId: "d1", lane: "EVIDENCE_FIRST", workingTitle: "生成式工具課程決策的證據使用機制", researchQuestion: "教師如何用證據修正課程決策？", researchValue: "界定可檢驗證據鏈。", mechanismTheory: "證據校準影響教學決策。", targetContext: "大學課程；樣本待確認。", methodSketch: "文件分析與訪談。", feasibilityRisk: "文件可先盤點；權限未知。", domain: "高等教育", outputTrack: "學術論文", unknowns: ["資料權限"], nextAction: "盤點課程文件。" },
    { directionId: "d2", lane: "BALANCED_RECOMMENDED", workingTitle: "生成式工具信任校準與課程品質的混合方法研究", researchQuestion: "信任校準如何影響課程品質？", researchValue: "兼顧機制與可行性。", mechanismTheory: "信任校準透過教師判斷影響設計。", targetContext: "大學教師；場域待確認。", methodSketch: "問卷與訪談序列混合。", feasibilityRisk: "量測工具待驗證。", domain: "教育科技", outputTrack: "學術論文", unknowns: ["量測工具"], nextAction: "確認構念。" },
    { directionId: "d3", lane: "FRONTIER_INNOVATION", workingTitle: "生成式工具教學決策的失效邊界", researchQuestion: "何時工具會削弱教師判斷？", researchValue: "辨識反直覺邊界。", mechanismTheory: "過度信任形成非線性效果。", targetContext: "不同整合程度課程；分層待確認。", methodSketch: "負向案例比較。", feasibilityRisk: "案例取得較難。", domain: "學習科學", outputTrack: "學術論文", unknowns: ["失效訊號"], nextAction: "界定負向案例。" },
  ],
  recommendedDirectionId: "d2",
};

class FixtureRepository {
  constructor() {
    this.job = { id: "job-a", rootJobId: "job-a", operation: "GENERATE_DIRECTIONS", requestPayload: { researchDirection: directionPayload.researchDirection, sourceStrategy: "NONE" }, requestHash: "a".repeat(64), leaseOwner: "worker", leaseToken: "token", leaseGeneration: 1, stateVersion: 1 };
    this.claimed = false;
    this.effectState = null;
    this.result = null;
    this.childCount = 0;
    this.reconcileCount = 0;
  }
  async claim() { if (this.claimed) return null; this.claimed = true; return this.job; }
  async ensureIntent() { if (!this.effectState) this.effectState = "INTENT_PERSISTED"; return this.effectState; }
  async markSubmissionPossible() { assert.equal(this.effectState, "INTENT_PERSISTED"); this.effectState = "SUBMISSION_POSSIBLE"; }
  async commitSuccess(_claim, artifact) { assert.equal(this.effectState, "SUBMISSION_POSSIBLE"); this.effectState = "ACKNOWLEDGED"; this.result = artifact; if (this.job.operation === "GENERATE_DIRECTIONS") this.childCount += 1; return { resultId: "result-a", childCreated: this.childCount === 1 }; }
  async completeProvenNotSubmitted() { this.effectState = "PROVEN_NOT_SUBMITTED"; }
  async completeTerminalRejected() { this.effectState = "TERMINAL_REJECTED"; }
  async completeUnknown() { this.effectState = "COMPLETION_UNKNOWN"; }
  async markReconcileRequired() { this.reconcileCount += 1; }
}

const successRepo = new FixtureRepository();
let successSubmissions = 0;
const successProvider = { capability: "ENABLED", async submit(input) { await input.markSubmissionPossible(); successSubmissions += 1; return { kind: "success", payload: directionPayload }; } };
const success = await runV2Alpha2WorkerOnce(successRepo, successProvider, { workerOwner: "worker", workerToken: "token" });
assert.equal(success.outcome, "COMMITTED");
assert.equal(successSubmissions, 1);
assert.equal(successRepo.effectState, "ACKNOWLEDGED");
assert.equal(successRepo.childCount, 1);
assert.equal((await runV2Alpha2WorkerOnce(successRepo, successProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "IDLE");
assert.equal(successSubmissions, 1);

const crashRepo = new FixtureRepository();
let crashSubmissions = 0;
const crashProvider = { capability: "ENABLED", async submit(input) { await input.markSubmissionPossible(); crashSubmissions += 1; return { kind: "success", payload: directionPayload }; } };
await assert.rejects(() => runV2Alpha2WorkerOnce(crashRepo, crashProvider, { workerOwner: "worker", workerToken: "token", crashPoint: "AFTER_INTENT" }), V2Alpha2WorkerTermination);
assert.equal(crashRepo.effectState, "INTENT_PERSISTED");
assert.equal(crashSubmissions, 0);
crashRepo.claimed = false;
assert.equal((await runV2Alpha2WorkerOnce(crashRepo, crashProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "COMMITTED");
assert.equal(crashSubmissions, 1);

const unknownRepo = new FixtureRepository();
let unknownSubmissions = 0;
const unknownProvider = { capability: "ENABLED", async submit(input) { await input.markSubmissionPossible(); unknownSubmissions += 1; return { kind: "completion-unknown", code: "TIMEOUT" }; } };
assert.equal((await runV2Alpha2WorkerOnce(unknownRepo, unknownProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "RECONCILE_REQUIRED");
assert.equal(unknownSubmissions, 1);
assert.equal(unknownRepo.effectState, "COMPLETION_UNKNOWN");
unknownRepo.claimed = false;
assert.equal((await runV2Alpha2WorkerOnce(unknownRepo, unknownProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "RECONCILE_REQUIRED");
assert.equal(unknownSubmissions, 1);

const competitionRepo = new FixtureRepository();
let competitionSubmissions = 0;
const competitionProvider = { capability: "ENABLED", async submit(input) { await input.markSubmissionPossible(); competitionSubmissions += 1; await Promise.resolve(); return { kind: "success", payload: directionPayload }; } };
const competed = await Promise.all([
  runV2Alpha2WorkerOnce(competitionRepo, competitionProvider, { workerOwner: "worker-a", workerToken: "token-a" }),
  runV2Alpha2WorkerOnce(competitionRepo, competitionProvider, { workerOwner: "worker-b", workerToken: "token-b" }),
]);
assert.equal(competed.filter((item) => item.outcome === "COMMITTED").length, 1);
assert.equal(competed.filter((item) => item.outcome === "IDLE").length, 1);
assert.equal(competitionSubmissions, 1);

const submittedRepo = new FixtureRepository();
submittedRepo.effectState = "SUBMISSION_POSSIBLE";
let forbiddenResend = 0;
const resendProvider = { capability: "ENABLED", async submit() { forbiddenResend += 1; return { kind: "success", payload: directionPayload }; } };
assert.equal((await runV2Alpha2WorkerOnce(submittedRepo, resendProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "RECONCILE_REQUIRED");
assert.equal(forbiddenResend, 0);

const provenRepo = new FixtureRepository();
let provenSubmissions = 0;
const provenProvider = { capability: "ENABLED", async submit() { provenSubmissions += 1; return { kind: "proven-not-submitted", code: "TRANSPORT" }; } };
assert.equal((await runV2Alpha2WorkerOnce(provenRepo, provenProvider, { workerOwner: "worker", workerToken: "token" })).outcome, "PROVEN_NOT_SUBMITTED");
assert.equal(provenRepo.effectState, "PROVEN_NOT_SUBMITTED");
assert.equal(provenRepo.reconcileCount, 0);
assert.equal(provenSubmissions, 1);

console.log("V2_ALPHA2_WORKER_CONTRACT=PASS");
console.log("V2_ALPHA2_EFFECT_MAXIMUM=1_PER_JOB");
console.log("V2_ALPHA2_AFTER_INTENT_RECOVERY=PASS");
console.log("V2_ALPHA2_SUBMISSION_UNKNOWN_NO_RESEND=PASS");
console.log("V2_ALPHA2_WORKER_COMPETITION=PASS_ONE_WINNER");
console.log("V2_ALPHA2_PROVEN_NOT_SUBMITTED=PASS_EXACT_TERMINAL_NO_RECONCILE");
