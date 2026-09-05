import assert from "node:assert/strict";

import {
  V2_ALPHA7_EDITORIAL_RECOMMENDATIONS,
  V2_ALPHA7_PURPOSE_MODES,
  V2_ALPHA7_RESPONSE_DECISIONS,
  V2_ALPHA7_REVIEW_LENSES,
  alpha7Hash,
  applyAlpha7Revision,
  undoAlpha7Revision,
  validateAlpha7Finding,
  validateAlpha7Workspace,
} from "../lib/v2-alpha7/contracts.ts";
import {
  createSyntheticAlpha7Request,
  createSyntheticAlpha7Workspace,
  createV2Alpha7Coordinator,
  parseAlpha7StudioRequest,
} from "../lib/v2-alpha7/runtime.ts";

let assertions = 0;
const group = (name, fn) => Promise.resolve().then(fn).then(() => ({ name, status: "PASS" }));
const equal = (...args) => { assertions += 1; assert.equal(...args); };
const deepEqual = (...args) => { assertions += 1; assert.deepEqual(...args); };
const throws = (...args) => { assertions += 1; assert.throws(...args); };

const results = [];

results.push(await group("A_AUTHORITY_AND_MODE_BOUNDARIES", () => {
  deepEqual(V2_ALPHA7_PURPOSE_MODES, ["AUTHOR_PRE_SUBMISSION_REVIEW", "AUTHOR_REVISION_AND_REVIEWER_RESPONSE", "INDEPENDENT_REVIEWER_MODE"]);
  for (const purpose of V2_ALPHA7_PURPOSE_MODES) {
    const request = createSyntheticAlpha7Request(`alpha7-mode-${purpose.toLowerCase()}`, purpose);
    const workspace = createSyntheticAlpha7Workspace(request);
    equal(workspace.purpose, purpose);
    equal(workspace.sourceHash, request.source.sourceHash);
    equal(workspace.originalArtifactImmutable, true);
    equal(workspace.formalResearchWriteCount, 0);
    equal(workspace.humanGate.scope, "WHOLE_ARTIFACT");
  }
  const malformed = structuredClone(createSyntheticAlpha7Request("alpha7-malformed-source"));
  malformed.source.sourceHash = "0".repeat(64);
  throws(() => parseAlpha7StudioRequest(malformed), /alpha7_source_hash_mismatch/u);
}));

results.push(await group("B_FIVE_LENS_SYNTHESIS_SOURCE_BINDING", () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-five-lenses"));
  deepEqual(workspace.lensReports.map((item) => item.lens), V2_ALPHA7_REVIEW_LENSES);
  equal(new Set(workspace.lensReports.map((item) => item.reportHash)).size, 5);
  equal(workspace.prioritizedFindings[0].severity, "CRITICAL");
  for (const finding of workspace.prioritizedFindings) validateAlpha7Finding(finding, workspace.sourceSections);
  const tampered = structuredClone(workspace.prioritizedFindings[0]);
  tampered.sourceSpan += "x";
  throws(() => validateAlpha7Finding(tampered, workspace.sourceSections), /alpha7_source_binding_invalid/u);
  const invented = structuredClone(workspace);
  invented.prioritizedFindings.push(structuredClone(workspace.prioritizedFindings[0]));
  throws(() => validateAlpha7Workspace(invented), /alpha7_synthesis_invented_or_missing_finding/u);
}));

results.push(await group("C_THREE_REVISIONS_AND_ALPHA6_PRESERVATION", () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-revisions"));
  const finding = workspace.prioritizedFindings.find((item) => item.sectionKey === "methods") ?? workspace.prioritizedFindings[0];
  deepEqual(finding.alternatives.map((item) => item.strategy), ["EVIDENCE_CALIBRATED", "JOURNAL_CONCISE_RECOMMENDED", "NATURAL_SCHOLARLY"]);
  equal(new Set(finding.alternatives.map((item) => item.revision)).size, 3);
  const section = workspace.sourceSections.find((item) => item.key === finding.sectionKey);
  const recommended = finding.alternatives.find((item) => item.recommended);
  const applied = applyAlpha7Revision({ currentText: section.text, currentSourceHash: section.sectionHash, finding, alternativeId: recommended.alternativeId, reviewerMode: false });
  equal(applied.originalText, section.text);
  equal(applied.text.includes(section.text), false);
  equal(applied.text.slice(finding.startOffset, finding.startOffset + recommended.revision.length), recommended.revision);
  equal(undoAlpha7Revision(applied).text, section.text);
  throws(() => applyAlpha7Revision({ currentText: `${section.text} changed`, currentSourceHash: section.sectionHash, finding, alternativeId: recommended.alternativeId, reviewerMode: false }), /alpha7_stale_source_hash/u);
}));

results.push(await group("D_RESPONSE_TRACEABILITY", () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-response", "AUTHOR_REVISION_AND_REVIEWER_RESPONSE"));
  deepEqual(workspace.responseMatrix.map((item) => item.decision), V2_ALPHA7_RESPONSE_DECISIONS);
  equal(workspace.responseMatrix.every((item) => item.commentId && item.interpretation && item.revisionLocation && item.before && item.after && item.evidence && item.responseText && item.unresolvedRisk), true);
  equal(workspace.responseMatrix.some((item) => item.decision === "DECLINE" && item.evidence.length > 0), true);
  equal(workspace.responseMatrix.some((item) => /^(thank|thanks|感謝)(\s|。|！|!)*$/iu.test(item.responseText)), false);
  const invalid = structuredClone(workspace);
  invalid.responseMatrix[2].evidence = "";
  throws(() => validateAlpha7Workspace(invalid), /alpha7_response_traceability_invalid/u);
}));

results.push(await group("E_INDEPENDENT_REVIEWER_READ_ONLY", () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-reviewer", "INDEPENDENT_REVIEWER_MODE"));
  equal(workspace.reviewerReport.readOnly, true);
  equal(workspace.canApplyAuthorRevision, false);
  equal(workspace.responseMatrix.length, 0);
  equal(V2_ALPHA7_EDITORIAL_RECOMMENDATIONS.includes(workspace.reviewerReport.editorialRecommendation), true);
  equal(workspace.reviewerReport.journalDecisionClaimed, false);
  const finding = workspace.prioritizedFindings[0];
  const section = workspace.sourceSections.find((item) => item.key === finding.sectionKey);
  throws(() => applyAlpha7Revision({ currentText: section.text, currentSourceHash: section.sectionHash, finding, alternativeId: finding.recommendedAlternativeId, reviewerMode: true }), /alpha7_reviewer_mode_read_only/u);
}));

results.push(await group("F_EVIDENCE_IDEMPOTENCY_AND_UNKNOWN", async () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-evidence"));
  equal(workspace.citationAudit.every((item) => item.authority === "INDEPENDENT_VERIFICATION_REQUIRED" && item.existence === "UNKNOWN" && item.context === "UNKNOWN"), true);
  equal(JSON.stringify(workspace).includes("acceptance probability"), false);
  let calls = 0;
  const coordinator = createV2Alpha7Coordinator(async (request) => { calls += 1; return createSyntheticAlpha7Workspace(request); });
  const request = createSyntheticAlpha7Request("alpha7-replay-001");
  const first = await coordinator.run({ ...request, scope: "fixture-workspace:fixture-user" });
  const replay = await coordinator.run({ ...request, scope: "fixture-workspace:fixture-user" });
  equal(first.replayed, false);
  equal(replay.replayed, true);
  equal(calls, 1);
  const conflict = structuredClone(request);
  conflict.purpose = "INDEPENDENT_REVIEWER_MODE";
  await assert.rejects(() => coordinator.run({ ...conflict, scope: "fixture-workspace:fixture-user" }), /alpha7_idempotency_conflict/u); assertions += 1;
  let unknownCalls = 0;
  const unknown = createV2Alpha7Coordinator(async () => { unknownCalls += 1; throw new Error("alpha7_completion_unknown"); });
  const unknownRequest = createSyntheticAlpha7Request("alpha7-unknown-001");
  await assert.rejects(() => unknown.run({ ...unknownRequest, scope: "fixture-workspace:fixture-user" }), /alpha7_completion_unknown/u); assertions += 1;
  await assert.rejects(() => unknown.run({ ...unknownRequest, scope: "fixture-workspace:fixture-user" }), /alpha7_completion_unknown_no_resend/u); assertions += 1;
  equal(unknownCalls, 1);
}));

results.push(await group("G_LOCAL_DRAFT_HUMAN_GATE", () => {
  const request = createSyntheticAlpha7Request("alpha7-pasted-preserved", "AUTHOR_PRE_SUBMISSION_REVIEW", { entryMode: "PASTED_MANUSCRIPT", sourceText: "Evidence calibration may improve teacher decisions in two documented stages [7]. The proposed comparison uses 36 classrooms and reports uncertainty rather than claiming a verified effect. Method, ethics, and data-sharing details remain incomplete." });
  const workspace = createSyntheticAlpha7Workspace(request);
  equal(workspace.sourceSections[0].text, request.source.sections[0].text);
  equal(workspace.humanGate.required, true);
  equal(workspace.humanGate.confirmed, false);
  equal(workspace.externalSubmissionEnabled, false);
  equal(workspace.externalMutationCount, 0);
  equal(alpha7Hash(workspace.sourceSections[0].text), workspace.sourceSections[0].sectionHash);
}));

results.push(await group("H_BOUNDARY_ENUMS_AND_COUNTS", () => {
  const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-boundary"));
  equal(workspace.lensReports.length, 5);
  equal(workspace.prioritizedFindings.length, 5);
  equal(workspace.prioritizedFindings.every((item) => item.alternatives.length === 3), true);
  equal(workspace.providerSubmissionCount, 1);
  equal(workspace.formalResearchWriteCount, 0);
  equal(workspace.externalMutationCount, 0);
}));

console.log(JSON.stringify({ status: "PASS", groups: results, groupCount: results.length, assertions, providerSubmissionMaximumPerRequest: 1, formalResearchWrites: 0, externalMutations: 0 }));
