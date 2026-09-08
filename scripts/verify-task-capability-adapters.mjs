import assert from "node:assert/strict";
import {
  ADAPTED_CAPABILITIES,
  resolveApplicableCapabilities,
} from "../lib/task-capability-resolver.ts";
import {
  executeCapabilityInvocation,
} from "../lib/task-capability-adapters.ts";

console.log("=== 開始執行 TaskCapabilityResolver 與 Skill Adapters 契約驗證 ===");

// 1. 驗證清冊約束
assert.ok(ADAPTED_CAPABILITIES.length >= 2, "至少包含 2 個已適配 Capabilities");
const ars = ADAPTED_CAPABILITIES.find((c) => c.capabilityId === "ars-citation-verification");
const cs = ADAPTED_CAPABILITIES.find((c) => c.capabilityId === "cs-obsidian-project-vault");

assert.ok(ars, "需具備 ars-citation-verification");
assert.equal(ars?.licenseCategory, "NON_COMMERCIAL_RESEARCH_ONLY");
assert.equal(ars?.writeScopePolicy, "APPEND_CANDIDATE_DRAFT");

assert.ok(cs, "需具備 cs-obsidian-project-vault");
assert.equal(cs?.licenseCategory, "PERMISSIVE_MIT_OR_APACHE");

// 2. 驗證 Resolver 分發與商業防護
const nonCommercialCaps = resolveApplicableCapabilities({
  workOrder: { primaryGoal: "JOURNAL_SCI_SSCI" },
  stageId: "literature-review",
  isCommercialTenant: false,
});
assert.ok(nonCommercialCaps.some((c) => c.capabilityId === "ars-citation-verification"), "非商業租戶應解析出 ARS");

const commercialCaps = resolveApplicableCapabilities({
  workOrder: { primaryGoal: "JOURNAL_SCI_SSCI" },
  stageId: "literature-review",
  isCommercialTenant: true,
});
assert.ok(!commercialCaps.some((c) => c.capabilityId === "ars-citation-verification"), "商業租戶應阻擋 CC BY-NC 之 ARS");
assert.ok(commercialCaps.some((c) => c.capabilityId === "cs-obsidian-project-vault"), "商業租戶仍可使用 MIT 之 Obsidian adapter");

// 3. 驗證 Execution Engine: 缺少參數防呆
const missingRes = await executeCapabilityInvocation({
  invocationId: "inv_test_1",
  capabilityId: "ars-citation-verification",
  workOrderId: "wo_test",
  projectId: "proj_test",
  workspaceId: "ws_test",
  stageId: "literature-review",
  inputPayload: {}, // 缺 citationList, claimText
});
assert.equal(missingRes.ok, false);
assert.equal(missingRes.status, "WAITING_INPUT");

// 4. 驗證 ARS Citation Verification 成功執行
const arsRes = await executeCapabilityInvocation({
  invocationId: "inv_test_2",
  capabilityId: "ars-citation-verification",
  workOrderId: "wo_test",
  projectId: "proj_test",
  workspaceId: "ws_test",
  stageId: "literature-review",
  inputPayload: {
    claimText: "VR 訓練能顯著降低職業災害率",
    citationList: [
      { title: "Paper 1", doi: "10.1016/j.ssci.2024.106" },
      { title: "Paper 2" }, // 缺識別碼
    ],
  },
});
assert.equal(arsRes.ok, true);
assert.equal(arsRes.status, "COMPLETED");
assert.ok(arsRes.outputArtifact?.hash, "產物需具備 SHA-256 Hash");
const report = JSON.parse(arsRes.outputArtifact?.content || "{}");
assert.equal(report.totalCitations, 2);
assert.equal(report.verifiedCount, 1);
assert.equal(report.unverifiedCount, 1);
assert.equal(report.hasMissingIdentifiers, true);

// 5. 驗證 Obsidian Research Note 格式化產出
const csRes = await executeCapabilityInvocation({
  invocationId: "inv_test_3",
  capabilityId: "cs-obsidian-project-vault",
  workOrderId: "wo_test",
  projectId: "proj_test",
  workspaceId: "ws_test",
  stageId: "topic-lab",
  inputPayload: {
    topicTitle: "AI × 職業安全教育訓練",
    notesList: ["觀察到傳統受訓者專注度不足", "探討多模態回饋之成效"],
  },
});
assert.equal(csRes.ok, true);
assert.equal(csRes.outputArtifact?.format, "MARKDOWN");
assert.ok(csRes.outputArtifact?.content.includes("tags: [research-note, oldmike-adapted]"));
assert.ok(csRes.outputArtifact?.content.includes("AI × 職業安全教育訓練"));

console.log("=== TaskCapabilityResolver 與 Skill Adapters 契約驗證全部通過 (PASS) ===");
