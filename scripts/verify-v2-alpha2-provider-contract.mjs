import assert from "node:assert/strict";

process.env.TEST_FIXTURE = "1";
process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER = "1";
const { V2_ALPHA2_PROVIDER_OPERATION_AUTHORITY, buildV2Alpha2ProviderMessages, createV2Alpha2SyntheticProvider } = await import("../lib/v2-alpha2/provider.ts");
const { parseFieldAssistArtifact } = await import("../lib/v2-alpha2/contracts.ts");

assert.deepEqual(V2_ALPHA2_PROVIDER_OPERATION_AUTHORITY, {
  GENERATE_DIRECTIONS: "M01_RESEARCH_DIRECTIONS",
  EXPAND_SELECTED_S0: "M01_RESEARCH_S0_EXPAND",
  FIELD_ASSIST: "M01_FIELD",
});
const messages = buildV2Alpha2ProviderMessages("FIELD_ASSIST", { targetField: "workingTitle", currentValue: "既有題目", contextSnapshot: {} });
assert.equal(messages.length, 2);
assert.match(messages[0].content, /field-assist\/1/u);
assert.match(messages[0].content, /EVIDENCE_FIRST.*BALANCED_RECOMMENDED.*FRONTIER_INNOVATION/u);
assert.doesNotMatch(messages.map((item) => item.content).join("\n"), /GENERATE_DIRECTIONS|方向生成語義/u);

let submissionMarkers = 0;
const result = await createV2Alpha2SyntheticProvider().submit({
  operation: "FIELD_ASSIST",
  requestPayload: { targetField: "workingTitle", currentValue: "既有題目", contextSnapshot: {} },
  requestHash: "a".repeat(64),
  markSubmissionPossible: async () => { submissionMarkers += 1; },
});
assert.equal(submissionMarkers, 1);
assert.equal(result.kind, "success");
if (result.kind !== "success") throw new Error("fixture_failed");
const parsed = parseFieldAssistArtifact(result.payload);
assert.equal(parsed.validOptions.length, 3);
assert.deepEqual(parsed.slots.map((slot) => slot.strategy), ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"]);

delete process.env.TEST_FIXTURE;
delete process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER;
console.log("V2_ALPHA2_PROVIDER_CONTRACT=PASS");
console.log("V2_ALPHA2_FIELD_ASSIST_ROUTE=M01_FIELD_EXACT");
console.log("V2_ALPHA2_FIELD_ASSIST_OPTIONS=PASS_3_STRATEGIES");
