import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ASSIST_REGISTRY,
  OLD_MIKE_ASSIST_CONTRACT_VERSION,
  canonicalAssistSource,
  mergeOldMikeAssistGroupPatch,
  parseOldMikeAssistGroupPatch,
  parseOldMikeAssistRequest,
  parseOldMikeAssistResponse,
} from "../lib/old-mike-assist-contract.ts";
import { executeOldMikeAssist } from "../lib/old-mike-assist-server.ts";

const currentFields = Object.fromEntries(ASSIST_REGISTRY.M05_RATIONALE.groupFields["m05-rationale"].map((field) => [field, `${field} 研究者草稿`]));
const contextSnapshot = { current: currentFields };
const sourceHash = createHash("sha256").update(canonicalAssistSource(contextSnapshot)).digest("hex");
const request = {
  contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION,
  idempotencyKey: "assist:v11:fixture:0001",
  surface: "M05_RATIONALE",
  action: "REWRITE",
  targetKind: "GROUP",
  schemaId: "m05-rationale",
  sourceHash,
  modeProfile: "AUTO",
  contextSnapshot,
  selection: null,
};
const parsedRequest = parseOldMikeAssistRequest(request, "PROJECT");
assert.equal(parsedRequest.ok, true);
assert.equal(parsedRequest.ok && parsedRequest.value.targetKind, "GROUP");
assert.deepEqual(parsedRequest.ok && parsedRequest.value.contextSnapshot.current, currentFields);

for (const invalid of [
  { ...request, targetKind: "FIELD" },
  { ...request, schemaId: "password" },
  { ...request, sourceHash: "not-a-hash" },
  { ...request, provider: "not-allowed" },
  { ...request, selection: { start: 0, end: 4, text: "wrong" } },
]) assert.equal(parseOldMikeAssistRequest(invalid, "PROJECT").ok, false);
for (const disabledMode of ["FAST", "ACADEMIC", "DEEP_REVIEW", "CODE_DATA"]) {
  const disabled = parseOldMikeAssistRequest({ ...request, modeProfile: disabledMode }, "PROJECT");
  assert.equal(disabled.ok, false);
  assert.equal(!disabled.ok && disabled.code, "assist_mode_not_enabled");
}

const raw = {
  outputs: [{ fields: { problem: "聚焦臨床問題與可觀察結果", background: "保留已知背景並標示來源不足" }, changeSummary: "整理問題與背景" }],
  issues: [{ code: "RESEARCHER_INPUT_REQUIRED", fields: ["literatureGap"], message: "缺少可核對來源" }],
};
for (const content of [JSON.stringify(raw), `\`\`\`json\n${JSON.stringify(raw)}\n\`\`\``]) {
  const parsed = parseOldMikeAssistResponse(content, parsedRequest.value, { contextHash: "a".repeat(64) });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.value.completionClass, "PARTIAL_REVIEW_REQUIRED");
  assert.equal(parsed.ok && parsed.value.suggestions.length, 1);
  assert.match(parsed.ok && parsed.value.suggestions[0].id, /^assist_suggestion_[a-f0-9]{64}$/u);
  assert.deepEqual(parsed.ok && parsed.value.suggestions[0].fields, raw.outputs[0].fields);
  assert.equal(parsed.ok && parsed.value.receipt.formalWrites, 0);
}

const oneFieldPatch = parseOldMikeAssistGroupPatch(JSON.stringify({ problem: "更新後的研究問題" }), ASSIST_REGISTRY.M05_RATIONALE.groupFields["m05-rationale"]);
assert.ok(oneFieldPatch);
const mergedGroup = mergeOldMikeAssistGroupPatch(currentFields, oneFieldPatch, ASSIST_REGISTRY.M05_RATIONALE.groupFields["m05-rationale"]);
assert.ok(mergedGroup);
assert.equal(mergedGroup.problem, "更新後的研究問題");
for (const field of ASSIST_REGISTRY.M05_RATIONALE.groupFields["m05-rationale"].filter((field) => field !== "problem")) assert.equal(mergedGroup[field], currentFields[field], `omitted field changed: ${field}`);

const mixed = parseOldMikeAssistResponse(JSON.stringify({ outputs: [
  { fields: { problem: "可保留的有效研究問題", background: "" }, changeSummary: "混合有效與無效欄位" },
  { fields: { literatureGap: "可核對的文獻缺口草稿" }, changeSummary: "保留另一個有效 sibling" },
], issues: [] }), parsedRequest.value, { contextHash: "a".repeat(64) });
assert.equal(mixed.ok, true);
assert.equal(mixed.ok && mixed.value.suggestions.length, 2);
assert.equal(mixed.ok && mixed.value.suggestions.some((item) => item.fields?.problem === "可保留的有效研究問題"), true);
assert.equal(mixed.ok && mixed.value.issues.some((issue) => issue.fields.includes("background")), true);
const zeroValid = parseOldMikeAssistResponse(JSON.stringify({ outputs: [{ fields: { problem: "" }, changeSummary: "無有效欄位" }], issues: [] }), parsedRequest.value, { contextHash: "a".repeat(64) });
assert.equal(zeroValid.ok, false);
assert.equal(!zeroValid.ok && zeroValid.code, "assist_zero_valid_output");

for (const invalid of [
  `before ${JSON.stringify(raw)}`,
  `${JSON.stringify(raw)} after`,
  `${JSON.stringify(raw)}${JSON.stringify(raw)}`,
  JSON.stringify({ ...raw, status: "COMPLETED" }),
  JSON.stringify({ outputs: [{ id: "model-id", fields: raw.outputs[0].fields, changeSummary: "x" }], issues: [] }),
  JSON.stringify({ outputs: [{ fields: raw.outputs[0].fields, changeSummary: "x" }, { fields: raw.outputs[0].fields, changeSummary: "x" }], issues: [] }),
]) assert.equal(parseOldMikeAssistResponse(invalid, parsedRequest.value, { contextHash: "a".repeat(64) }).ok, false);

const s0 = { workingTitle: "形成性回饋機制與大學生學習遷移之研究", domain: "AI × 教育", outputTrack: "NSTC", problemContext: "改善形成性回饋", targetUsers: "大學生", expectedContribution: "釐清回饋機制", existingData: "目前沒有已確認資料", availableData: "課程資料待授權", methodIdea: "準實驗", timeline: "一年", constraints: "樣本待確認", ethicsPrivacyRisks: "需倫理審查", unresolvedItems: "工具效度待確認" };
const fieldStatus = Object.fromEntries(Object.keys(s0).map((field) => [field, field === "problemContext" ? "USER_PROVIDED" : "AI_PROPOSED"]));
const wholeSnapshot = { researchDirection: "改善形成性回饋", selectedCandidate: null, domain: "AI × 教育", outputTrack: "NSTC", s0, fieldStatus, current: s0 };
const wholeRequestRaw = { contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION, idempotencyKey: "assist:v11:whole-s0", surface: "S0_RESEARCH_TEXT", action: "COMPLETE_ALL_S0", targetKind: "WHOLE_S0", schemaId: "s0-fields/1.0.0", sourceHash: createHash("sha256").update(canonicalAssistSource(wholeSnapshot)).digest("hex"), modeProfile: "AUTO", contextSnapshot: wholeSnapshot, selection: null };
const wholeRequest = parseOldMikeAssistRequest(wholeRequestRaw, "PRE_PROJECT");
assert.equal(wholeRequest.ok, true);
assert.equal(parseOldMikeAssistRequest({ ...wholeRequestRaw, targetKind: "FIELD", schemaId: "workingTitle" }, "PRE_PROJECT").ok, false, "COMPLETE_ALL_S0 is whole-draft only");
const incompleteWhole = parseOldMikeAssistResponse(JSON.stringify({ outputs: [{ fields: { workingTitle: "形成性回饋機制與學習遷移之研究" }, changeSummary: "僅一欄" }], issues: [{ code: "RESEARCHER_INPUT_REQUIRED", fields: ["methodIdea"], message: "方法待確認" }] }), wholeRequest.value, { contextHash: "b".repeat(64) });
assert.equal(incompleteWhole.ok, true);
assert.equal(incompleteWhole.ok && incompleteWhole.value.canApply, false);
assert.equal(incompleteWhole.ok && incompleteWhole.value.completionClass, "PARTIAL_REVIEW_REQUIRED");
assert.deepEqual(incompleteWhole.ok && incompleteWhole.value.recoverableFields.includes("methodIdea"), true);
const changedUserFact = parseOldMikeAssistResponse(JSON.stringify({ outputs: [{ fields: { ...s0, problemContext: "模型改寫研究者事實" }, changeSummary: "不應通過" }], issues: [] }), wholeRequest.value, { contextHash: "b".repeat(64) });
assert.equal(changedUserFact.ok, false);
assert.equal(!changedUserFact.ok && changedUserFact.code, "assist_zero_valid_output");

const titleCurrent = "高風險訓練 12 人樣本之移轉研究 [1] 尚未確認";
const titleContext = { researchDirection: "改善高風險訓練移轉", selectedCandidate: { workingTitle: "危害辨識回饋與訓練移轉" }, domain: "AI × 職業安全與教育訓練", outputTrack: "NSTC", s0: { ...s0, workingTitle: titleCurrent }, fieldStatus, current: titleCurrent };
const titleRequestRaw = { contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION, idempotencyKey: "assist:v11:title-context", surface: "S0_RESEARCH_TEXT", action: "REWRITE", targetKind: "FIELD", schemaId: "workingTitle", sourceHash: createHash("sha256").update(canonicalAssistSource(titleContext)).digest("hex"), modeProfile: "AUTO", contextSnapshot: titleContext, selection: null };
const titleRequest = parseOldMikeAssistRequest(titleRequestRaw, "PRE_PROJECT");
assert.equal(titleRequest.ok, true);
assert.equal(parseOldMikeAssistResponse(JSON.stringify({ outputs: [{ text: "〈研究類型〉研究：以〈對象／情境〉探討〈研究主題〉", changeSummary: "模板" }], issues: [] }), titleRequest.value, { contextHash: "d".repeat(64) }).ok, false);
assert.equal(parseOldMikeAssistResponse(JSON.stringify({ outputs: [{ text: "高風險訓練 12 人樣本之危害辨識回饋與移轉研究 [1] 尚未確認", changeSummary: "保留事實並聚焦構念" }], issues: [] }), titleRequest.value, { contextHash: "d".repeat(64) }).ok, true);
let capturedMessages = null;
const titleExecution = await executeOldMikeAssist({ request: titleRequest.value, context: { authorizedProjectContext: "bounded" }, contextHash: "d".repeat(64), sessionKey: "assist-v11-title", provider: { async submit(input) { capturedMessages = input.messages; return { kind: "success", content: JSON.stringify({ outputs: [{ text: "高風險訓練 12 人樣本之危害辨識回饋與移轉研究 [1] 尚未確認", changeSummary: "聚焦構念" }], issues: [] }) }; } } });
assert.equal(titleExecution.kind, "success");
const captured = JSON.stringify(capturedMessages);
for (const expected of [titleContext.researchDirection, titleContext.domain, s0.methodIdea, s0.availableData]) assert.equal(captured.includes(expected), true, `full S0 context missing: ${expected}`);

let submissions = 0;
const stale = await executeOldMikeAssist({ request: { ...parsedRequest.value, sourceHash: "0".repeat(64) }, context: { authorized: true }, contextHash: "c".repeat(64), sessionKey: "assist-v11-fixture", provider: { async submit() { submissions += 1; return { kind: "success", content: JSON.stringify(raw) }; } } });
assert.equal(stale.kind, "parse-failed");
assert.equal(stale.kind === "parse-failed" && stale.code, "assist_source_hash_mismatch");
assert.equal(submissions, 0);

let idempotentSubmissions = 0;
const idempotentProvider = { async submit() { idempotentSubmissions += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { kind: "success", content: JSON.stringify(raw) }; } };
const [dedupedA, dedupedB] = await Promise.all([
  executeOldMikeAssist({ request: parsedRequest.value, context: { authorized: true }, contextHash: "e".repeat(64), sessionKey: "assist-v11-dedupe-scope", provider: idempotentProvider }),
  executeOldMikeAssist({ request: parsedRequest.value, context: { authorized: true }, contextHash: "e".repeat(64), sessionKey: "assist-v11-dedupe-scope", provider: idempotentProvider }),
]);
assert.equal(idempotentSubmissions, 1, "duplicate delivery of the same explicit action submits once");
assert.deepEqual(dedupedA, dedupedB);
const changedSnapshot = { current: { ...currentFields, problem: "不同的研究者草稿" } };
const changedRequest = parseOldMikeAssistRequest({ ...request, contextSnapshot: changedSnapshot, sourceHash: createHash("sha256").update(canonicalAssistSource(changedSnapshot)).digest("hex") }, "PROJECT");
assert.equal(changedRequest.ok, true);
const conflict = await executeOldMikeAssist({ request: changedRequest.value, context: { authorized: true }, contextHash: "e".repeat(64), sessionKey: "assist-v11-dedupe-scope", provider: idempotentProvider });
assert.equal(conflict.kind, "parse-failed");
assert.equal(conflict.kind === "parse-failed" && conflict.code, "assist_idempotency_conflict");
assert.equal(idempotentSubmissions, 1);

const requiredSurfaceUsage = {
  M01_TOPIC_CONDITIONS: "TopicLabFrontierRadar.tsx",
  M02_TERMINOLOGY: "AcademicLanguageStudio.tsx",
  M03_JOURNAL_PROFILE: "ReviewStudio.tsx",
  M04_TARGET_JOURNAL: "JournalSubmissionStudio.tsx",
  M04_COVER_BODY: "JournalSubmissionStudio.tsx",
  M05_BILINGUAL: "ProposalStudio.tsx",
  M05_RATIONALE: "ProposalStudio.tsx",
  M05_METHODS: "ProposalStudio.tsx",
  M05_MODE_SPECIFIC: "ProposalStudio.tsx",
  M05_EXECUTION: "ProposalStudio.tsx",
  M05_BUDGET_RISKS: "ProposalStudio.tsx",
  RESEARCH_DESIGN: "ResearchWorkflow.tsx",
  RESEARCH_CLAIM: "ResearchWorkflow.tsx",
  RESEARCH_DOCUMENT: "ResearchWorkflow.tsx",
};
for (const [surface, file] of Object.entries(requiredSurfaceUsage)) {
  assert.ok(ASSIST_REGISTRY[surface], `missing registry surface ${surface}`);
  assert.match(readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8"), new RegExp(`surface=["']${surface}["']`, "u"), `surface ${surface} is not wired`);
}
for (const denied of ["password", "projectId", "sourceUrl", "effectiveDate", "amount", "humanGate", "approvalRationale", "status"]) assert.equal(parseOldMikeAssistRequest({ ...titleRequestRaw, schemaId: denied }, "PRE_PROJECT").ok, false);

console.log("C2R4_ASSIST_V11_CONTRACT=PASS");
