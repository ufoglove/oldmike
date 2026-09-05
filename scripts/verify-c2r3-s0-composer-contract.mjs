import assert from "node:assert/strict";
import {
  S0_FIELDS,
  S0_TEXT_FIELDS,
  composeCandidateIntake,
  mergeS0Suggestions,
  parseS0SuggestionEnvelope,
  runS0Composer,
} from "../lib/s0-composer.ts";

const base = {
  workingTitle: "研究者原題",
  domain: "教育與人才發展",
  outputTrack: "NSTC",
  problemContext: "",
  targetUsers: "",
  expectedContribution: "研究者已寫好的貢獻",
  existingData: "目前沒有已確認資料",
  availableData: "",
  methodIdea: "",
  timeline: "",
  constraints: "",
  ethicsPrivacyRisks: "尚未完成正式倫理、隱私與授權審查",
  unresolvedItems: "",
};

const candidate = {
  chineseTitle: "候選題目",
  practicalProblem: "候選問題情境",
  researchPopulation: "候選研究對象",
  coreQuestion: "候選核心問題",
  possibleMethods: ["混合方法", "縱貫追蹤"],
  requiredData: ["去識別化資料"],
  ethicsPrivacySiteRisks: ["需倫理審查"],
  unknowns: ["樣本可得性待確認"],
};

assert.equal(S0_FIELDS.length, 13);
assert.equal(S0_TEXT_FIELDS.length, 11);
assert.deepEqual(S0_FIELDS.map((field) => field.name), [
  "workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution",
  "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems",
]);

const composed = composeCandidateIntake({
  currentIntake: base,
  candidate,
  selectedDomain: "教育與人才發展",
  selectedOutputTrack: "NSTC",
  userProvidedFields: ["workingTitle", "expectedContribution"],
});
assert.equal(composed.intake.workingTitle, "研究者原題", "nonempty USER_PROVIDED text is preserved");
assert.equal(composed.intake.expectedContribution, "研究者已寫好的貢獻");
assert.equal(composed.intake.problemContext, "候選問題情境");
assert.equal(composed.fieldStatus.problemContext, "UNVERIFIED");
assert.equal(composed.fieldStatus.workingTitle, "USER_PROVIDED");

const bare = JSON.stringify({
  status: "PARTIAL_REVIEW_REQUIRED",
  suggestions: {
    timeline: { value: "十二個月，實際期程待研究者確認", status: "AI_PROPOSED" },
    constraints: { value: "人力與預算仍待確認", status: "AI_PROPOSED" },
  },
});
const parsedBare = parseS0SuggestionEnvelope(bare, ["timeline", "constraints", "unresolvedItems"]);
assert.equal(parsedBare.ok, true);
assert.deepEqual(parsedBare.ok && parsedBare.bitmap, {
  JSON_ENVELOPE: "PASS",
  TOP_STATUS: "PASS",
  DRAFT_OR_SUGGESTIONS: "PASS",
  FIELD_NAME: "PASS",
  FIELD_VALUE: "PASS",
  FIELD_STATUS: "PASS",
});
const parsedFence = parseS0SuggestionEnvelope(`\`\`\`json\n${bare}\n\`\`\``, ["timeline", "constraints", "unresolvedItems"]);
assert.equal(parsedFence.ok, true, "one entire JSON fence is accepted");

for (const invalid of [
  `before ${bare}`,
  `${bare}\nafter`,
  `${bare}${bare}`,
  `\`\`\`json\n${bare}\n\`\`\`\nextra`,
]) {
  const result = parseS0SuggestionEnvelope(invalid, ["timeline", "constraints", "unresolvedItems"]);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.stage, "JSON_ENVELOPE");
}

assert.equal(parseS0SuggestionEnvelope(JSON.stringify({ status: "success", suggestions: {} }), ["timeline"]).ok, false);
assert.equal(parseS0SuggestionEnvelope(JSON.stringify({ status: "COMPLETE", suggestions: { illegal: { value: "x", status: "AI_PROPOSED" } } }), ["timeline"]).ok, false);
assert.equal(parseS0SuggestionEnvelope(JSON.stringify({ status: "COMPLETE", suggestions: { timeline: { value: "x", status: "VERIFIED" } } }), ["timeline"]).ok, false);

const merged = mergeS0Suggestions({
  intake: composed.intake,
  fieldStatus: composed.fieldStatus,
  targetFields: ["timeline", "constraints", "unresolvedItems"],
  parsed: assertParsed(parsedBare),
});
assert.equal(merged.draft.timeline.status, "AI_PROPOSED");
assert.equal(merged.draft.constraints.status, "AI_PROPOSED");
assert.equal(merged.draft.unresolvedItems.status, "RESEARCHER_INPUT_REQUIRED");
assert.equal(merged.completionClass, "PARTIAL_REVIEW_REQUIRED");
assert.equal(merged.appliedCount, 2);
assert.equal(merged.pendingCount, 1);

let upstreamCount = 0;
let observedIntake;
const run = await runS0Composer({
  intake: composed.intake,
  fieldStatus: composed.fieldStatus,
  candidate,
  invoke: async (request) => {
    upstreamCount += 1;
    observedIntake = request.intake;
    return bare;
  },
});
assert.equal(upstreamCount, 1, "one upstream maximum");
assert.deepEqual(observedIntake, composed.intake, "request uses the exact nextIntake object supplied to state");
assert.equal(run.ok, true);

function assertParsed(value) {
  assert.equal(value.ok, true);
  return value;
}

console.log("c2r3 s0 composer contracts: PASS");
