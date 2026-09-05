import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  V2_CAPABILITIES,
  V2_DIRECTION_LANES,
  V2_GLOBAL_NAV,
  V2_PROJECT_STAGES,
  buildV2PrototypeWorkspace,
  createFactBoundGuidance,
  parseV2SuggestionEnvelope,
} from "../lib/v2/prototype-contract.ts";
import { V2_OPERATION_REGISTRY, validateV2OperationRequest } from "../lib/v2/operation-registry.ts";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(portalRoot, relative), "utf8");

assert.deepEqual(V2_GLOBAL_NAV.map((item) => item.id), ["HOME", "PROJECTS", "LITERATURE", "QUICK_TOOLS", "SETTINGS"]);
assert.deepEqual(V2_GLOBAL_NAV.map((item) => item.label), ["Home", "My Projects", "Literature Library", "Quick Tools", "Settings"]);
assert.deepEqual(V2_PROJECT_STAGES.map((item) => item.id), ["DISCOVER", "BLUEPRINT", "EVIDENCE", "ANALYZE", "WRITE", "REVIEW_SUBMIT"]);
assert.equal(V2_CAPABILITIES.length, 12);
assert.deepEqual([...new Set(V2_CAPABILITIES.map((item) => item.stage))], V2_PROJECT_STAGES.map((item) => item.id));
const visibleCapabilityTasks = V2_CAPABILITIES.flatMap((item) => item.tasks).join("|");
for (const requiredTask of ["跨領域可行性", "審查意見回覆", "Reviewer 模式", "NSTC", "MOE", "書目", "數據圖表", "期刊規格", "Cover Letter"]) {
  assert.match(visibleCapabilityTasks, new RegExp(requiredTask, "u"));
}
assert.deepEqual(V2_DIRECTION_LANES, ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"]);

const direction = "大學教師採用生成式工具的教學決策與學習成效";
const workspace = buildV2PrototypeWorkspace(direction);
assert.equal(workspace.directions.length, 3);
assert.equal(workspace.directions.filter((item) => item.recommended).length, 1);
assert.equal(workspace.recommendedDirectionId, workspace.directions[1].id);
assert.equal(workspace.generationEffectCount, 1);
assert.equal(workspace.formalWriteCount, 0);
assert.equal(workspace.s0Draft.problemContext.split(direction).length - 1, 1);
assert.equal(Object.keys(workspace.s0Draft).length, 13);
assert.ok(Object.values(workspace.s0Draft).every((value) => typeof value === "string" && value.trim().length > 0));
assert.equal(new Set(workspace.directions.map((item) => item.workingTitle)).size, 3);
assert.equal(new Set(workspace.directions.map((item) => item.methodSketch)).size, 3);

const factGuidance = createFactBoundGuidance("sample", "樣本數尚未提供");
assert.equal(factGuidance.length, 3);
assert.ok(factGuidance.every((item) => item.status === "ASSUMPTION" && !/\b\d+\b/u.test(item.guidance)));

const parsed = parseV2SuggestionEnvelope({
  contractVersion: "old-mike-v2-suggestion/1.0.0",
  completionClass: "PARTIAL_REVIEW_REQUIRED",
  options: [
    { strategy: "EVIDENCE_FIRST", text: "先界定可觀察證據與未知事項。", rationale: "避免把假設寫成事實。", boundary: "UNVERIFIED" },
    { strategy: "BALANCED_RECOMMENDED", text: "整合問題、機制與方法。", rationale: "兼顧學術與實務價值。", boundary: "ASSUMPTION" },
    { strategy: "FRONTIER_INNOVATION", text: "提出邊界條件與前沿機制。", rationale: "以新證據驗證原創方向。", boundary: "UNVERIFIED" },
  ],
  ignoredProviderField: "ADDITIVE_FIELD_TOLERATED",
});
assert.equal(parsed.options.length, 3);
assert.equal(parsed.validOptions.length, 3);
const isolated = parseV2SuggestionEnvelope({
  contractVersion: "old-mike-v2-suggestion/1.0.0",
  completionClass: "PARTIAL_REVIEW_REQUIRED",
  options: [
    { strategy: "EVIDENCE_FIRST", text: "有效選項。", rationale: "可審查。", boundary: "UNVERIFIED" },
    { strategy: "BALANCED_RECOMMENDED", text: "", rationale: "無效空值。", boundary: "ASSUMPTION" },
    { strategy: "FRONTIER_INNOVATION", text: "另一個有效選項。", rationale: "可審查。", boundary: "UNVERIFIED" },
  ],
});
assert.equal(isolated.validOptions.length, 2);
assert.deepEqual(isolated.invalidOptionIndexes, [1]);

assert.equal(V2_OPERATION_REGISTRY.length, 12);
assert.ok(V2_OPERATION_REGISTRY.every((item) => item.transport === "SERVER_ONLY_SHARED_ENVELOPE"));
assert.ok(V2_OPERATION_REGISTRY.every((item) => item.formalWriteBoundary === "HUMAN_GATE_OR_EXISTING_VERSION_ENDPOINT"));
assert.ok(V2_OPERATION_REGISTRY.every((item) => item.tools.every((tool) => !["SHELL", "DEPLOYMENT", "DATABASE_ADMIN", "UNRESTRICTED_FILESYSTEM"].includes(tool))));
const validatedRequest = validateV2OperationRequest({
  contractVersion: "old-mike-v2-operation/1.0.0",
  operation: "GENERATE_DIRECTIONS",
  requestId: "fixture-request-0001",
  projectScope: "PRE_PROJECT",
  input: { researchDirection: direction, ignoredPayloadField: "ADDITIVE_FIELD_TOLERATED" },
  additiveCallerField: "IGNORED",
});
assert.equal(validatedRequest.operation, "GENERATE_DIRECTIONS");
assert.deepEqual(validatedRequest.input, { researchDirection: direction });
assert.throws(() => validateV2OperationRequest({ contractVersion: "old-mike-v2-operation/1.0.0", operation: "RUN_SHELL", requestId: "fixture-request-0002", projectScope: "PRE_PROJECT", input: {} }), /v2_operation_not_allowed/u);

const routeSource = await read("app/v2-alpha1-local/page.tsx");
assert.match(routeSource, /process\.env\.NODE_ENV !== "development"/u);
assert.match(routeSource, /process\.env\.TEST_FIXTURE !== "1"/u);
assert.match(routeSource, /process\.env\.OLD_MIKE_V2_LOCAL_PROTOTYPE !== "1"/u);
assert.doesNotMatch(routeSource, /GuidedResearchCenter/u);
const componentSource = [
  await read("components/v2/OldMikeResearchOSV2.tsx"),
  await read("components/v2/AssistableField.tsx"),
  await read("components/v2/SuggestionDrawer.tsx"),
].join("\n");
assert.doesNotMatch(componentSource, /OpenClaw|Codex|GPT|provider|modelId|apiKey|DATABASE_URL/iu);
assert.match(componentSource, /SuggestionDrawer/u);
assert.match(componentSource, /AssistableField/u);
assert.match(componentSource, /S0_FIELDS\.map\(\(field\) => <AssistableField/u);
assert.doesNotMatch(componentSource, /className=\{styles\.fixedFields\}/u);
assert.match(componentSource, /field === "workingTitle"/u);
assert.match(componentSource, /field === "domain"/u);
assert.match(componentSource, /field === "outputTrack"/u);
assert.match(componentSource, /Human Gate · 整份草稿/u);
assert.match(componentSource, /不是逐欄核准/u);
assert.match(componentSource, /自訂顯示名稱/u);
assert.match(componentSource, /setLocalDisplayName/u);

console.log("V2_ALPHA1_CONTRACT_TESTS=PASS");
console.log("V2_ALPHA1_GLOBAL_NAV=PASS_5");
console.log("V2_ALPHA1_PROJECT_STAGES=PASS_6");
console.log("V2_ALPHA1_CAPABILITIES=PASS_12");
console.log("V2_ALPHA1_DIRECTION_S0=PASS_3_AND_13");
console.log("V2_ALPHA1_ALL_13_FIELDS_ASSISTABLE=PASS");
console.log("V2_ALPHA1_OPERATION_CONTRACT=PASS_EXACT_CONSUMED_FIELDS_ADDITIVE_TOLERANCE");
console.log("V2_ALPHA1_FORMAL_WRITES=0");
