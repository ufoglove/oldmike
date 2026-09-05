import assert from "node:assert/strict";

import { createBuiltinDomainSelection } from "../lib/v2-alpha3/contracts.ts";
import { V2_ALPHA5_CONTRACT_VERSION } from "../lib/v2-alpha5/contracts.ts";
import { createSyntheticOfficialSourceBundle } from "../lib/v2-alpha5/official-source-bundle.ts";
import { createSyntheticAlpha5Workspace } from "../lib/v2-alpha5/runtime.ts";
import { V2_ALPHA8_CONTRACT_VERSION } from "../lib/v2-alpha8/contracts.ts";
import { createSyntheticV2Alpha8Workspace } from "../lib/v2-alpha8/runtime.ts";
import { fromAlpha8Workspace } from "../lib/v2-alpha9/adapters.ts";
import {
  V2_ALPHA9_CONTRACT_VERSION,
  V2_ALPHA9_PAPERPAL_BOUNDARY,
  V2_ALPHA9_REVISION_STRATEGIES,
  V2_ALPHA9_SECTION_KEYS,
  alpha9SectionsHash,
} from "../lib/v2-alpha9/contracts.ts";
import {
  applyV2Alpha9WholeArtifactReview,
  createV2Alpha9ManuscriptReview,
  undoV2Alpha9WholeArtifactReview,
  validateV2Alpha9ManuscriptWorkspace,
} from "../lib/v2-alpha9/manuscript-review.ts";
import {
  V2_ALPHA9_FIXTURE_SEEDS,
  createSyntheticV2Alpha9UiWorkspace,
  createV2Alpha9Coordinator,
  parseV2Alpha9LocalFinalizeRequest,
  validateV2Alpha9UiWorkspace,
} from "../lib/v2-alpha9/runtime.ts";
import { V2_ALPHA9_REVIEW_DIMENSIONS, reviewAlpha9TaiwanProposal } from "../lib/v2-alpha9/taiwan-review.ts";

let assertions = 0;
const results = [];
const equal = (...args) => { assertions += 1; assert.equal(...args); };
const deepEqual = (...args) => { assertions += 1; assert.deepEqual(...args); };
const ok = (...args) => { assertions += 1; assert.ok(...args); };
const throws = (...args) => { assertions += 1; assert.throws(...args); };
const rejects = async (...args) => { assertions += 1; await assert.rejects(...args); };
const doesNotMatch = (...args) => { assertions += 1; assert.doesNotMatch(...args); };
const group = async (name, run) => {
  await run();
  results.push({ name, status: "PASS" });
};

function alpha9Request(track, suffix) {
  return {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    requestId: `alpha9-request-${suffix}`,
    idempotencyKey: `alpha9-idempotency-${suffix}`,
    track,
    fixtureSeed: V2_ALPHA9_FIXTURE_SEEDS[track],
  };
}

function alpha8Request(suffix, resultReadiness = "RESULTS_NOT_AVAILABLE") {
  return {
    contractVersion: V2_ALPHA8_CONTRACT_VERSION,
    requestId: `alpha8-request-${suffix}`,
    idempotencyKey: `alpha8-idempotency-${suffix}`,
    focusDomain: { kind: "BUILTIN", domainId: "ai-education", label: "AI應用於教育" },
    goal: "JOURNAL_MANUSCRIPT",
    resultReadiness,
    materials: [
      { materialId: "material-abstract", kind: "ABSTRACT", title: "部分摘要", content: "本研究探討智慧回饋如何支持高等教育學習者的自我調節，目前僅完成研究構想與方法草稿。" },
      { materialId: "material-introduction", kind: "INTRODUCTION", title: "前言草稿", content: "既有材料指出教學回饋的可操作性值得進一步研究，但尚未完成文獻核驗。" },
      { materialId: "material-methods", kind: "METHODS", title: "方法草稿", content: "預計採準實驗混合方法設計；尚未完成收案、資料清理或正式分析。" },
    ],
    statistics: [],
  };
}

function alpha5Workspace(targetId, suffix) {
  const domainSelection = createBuiltinDomainSelection("ai-education");
  return createSyntheticAlpha5Workspace({
    contractVersion: V2_ALPHA5_CONTRACT_VERSION,
    requestId: `alpha5-request-${suffix}`,
    domainSelection,
    targetId,
    researchDirection: targetId === "NSTC"
      ? "智慧回饋支持跨域研究能力與可驗證學習機制"
      : "智慧回饋促進大學課程自我調節與教學實踐改善",
    sourceBundle: createSyntheticOfficialSourceBundle({
      targetId,
      cycleYear: 2027,
      domainSelection,
      variant: "MIXED_FRESHNESS",
    }),
  });
}

function manuscriptReview(suffix = "review") {
  return validateV2Alpha9ManuscriptWorkspace(
    createV2Alpha9ManuscriptReview(fromAlpha8Workspace(createSyntheticV2Alpha8Workspace(alpha8Request(suffix)))),
  );
}

function commonPrefixLength(values) {
  const shortest = Math.min(...values.map((value) => value.length));
  let index = 0;
  while (index < shortest && values.every((value) => value[index] === values[0][index])) index += 1;
  return index;
}

function userFacingProjection(workspace) {
  return JSON.stringify({
    issues: workspace.priorityIssues.map((issue) => ({
      title: issue.title,
      reason: issue.reason,
      alternatives: issue.alternatives.map((alternative) => ({ label: alternative.label, text: alternative.text })),
    })),
    proposedSnapshot: workspace.proposedSnapshot,
  });
}

await group("A_EXACT_REQUEST_CONSUMER_CONTRACT", () => {
  const request = alpha9Request("JOURNAL_MANUSCRIPT", "exact");
  deepEqual(parseV2Alpha9LocalFinalizeRequest(request), request);
  throws(() => parseV2Alpha9LocalFinalizeRequest({ ...request, extra: true }), /alpha9_request_invalid/u);
  throws(() => parseV2Alpha9LocalFinalizeRequest({ ...request, contractVersion: "old-mike-v2-alpha9/0.9.0" }), /alpha9_request_authority_invalid/u);
  throws(() => parseV2Alpha9LocalFinalizeRequest({ ...request, fixtureSeed: V2_ALPHA9_FIXTURE_SEEDS.NSTC_PROPOSAL }), /alpha9_fixture_binding_invalid/u);
  throws(() => parseV2Alpha9LocalFinalizeRequest({ ...request, requestId: "bad id" }), /alpha9_request_id_invalid/u);
  throws(() => parseV2Alpha9LocalFinalizeRequest({ ...request, idempotencyKey: "short" }), /alpha9_idempotency_key_invalid/u);
});

await group("B_ALPHA8_HANDOFF_PRESERVES_MISSING_RESULTS_AS_PLAN_ONLY", () => {
  const alpha8 = createSyntheticV2Alpha8Workspace(alpha8Request("plan-only"));
  const original = structuredClone(alpha8);
  const canonical = fromAlpha8Workspace(alpha8);
  deepEqual(alpha8, original);
  equal(canonical.resultNarrativeAllowed, false);
  for (const sectionKey of ["ABSTRACT", "RESULTS_OR_EXPECTED_OUTCOMES", "DISCUSSION_OR_SIGNIFICANCE", "CONCLUSION_OR_IMPACT"]) {
    const section = canonical.sections.find((item) => item.sectionKey === sectionKey);
    equal(section?.mode, "PLAN_ONLY");
    equal(section?.sourceStatisticIds.length, 0);
  }
  equal(canonical.statisticLedger.length, 0);
  const review = validateV2Alpha9ManuscriptWorkspace(createV2Alpha9ManuscriptReview(canonical));
  equal(review.completenessMatrix.entries.filter((item) => item.status === "PLAN_ONLY" || item.status === "MISSING").length >= 4, true);
  equal(review.integrityStatus, "BLOCKED_EVIDENCE_OR_INTEGRITY");
  equal(review.formalResearchWriteCount, 0);
});

await group("C_TAIWAN_TEN_DIMENSIONS_AND_SYNTHETIC_OFFICIAL_BOUNDARY", () => {
  for (const targetId of ["NSTC", "MOE"]) {
    const workspace = alpha5Workspace(targetId, targetId.toLocaleLowerCase("en-US"));
    const review = reviewAlpha9TaiwanProposal(workspace);
    equal(review.targetId, targetId);
    equal(review.dimensions.length, 10);
    deepEqual(review.dimensions.map((item) => item.dimension), V2_ALPHA9_REVIEW_DIMENSIONS);
    equal(new Set(review.dimensions.map((item) => item.dimensionHash)).size, 10);
    equal(review.contentClosureStatus, "PASS");
    equal(review.officialComplianceStatus, "BLOCKED_SOURCE_AUTHORITY");
    equal(review.officialComplianceStatus === "PASS_OFFICIAL_CURRENT", false);
    equal(review.reviewStatus, "READY_WITH_GAPS");
    equal(review.formalResearchWriteCount, 0);
    equal(review.providerCallCount, 0);
    equal(review.databaseConnectionCount, 0);
    equal(review.externalMutationCount, 0);
  }
});

await group("D_THREE_TRACK_UI_PROJECTIONS_ARE_EXACT_AND_ACTIONABLE", () => {
  for (const track of ["JOURNAL_MANUSCRIPT", "NSTC_PROPOSAL", "MOE_PROPOSAL"]) {
    const request = alpha9Request(track, `ui-${track.toLocaleLowerCase("en-US")}`);
    const workspace = createSyntheticV2Alpha9UiWorkspace(request);
    validateV2Alpha9UiWorkspace(workspace, request);
    deepEqual(Object.keys(workspace.sourceSnapshot.sections), V2_ALPHA9_SECTION_KEYS);
    deepEqual(Object.keys(workspace.proposedSnapshot.sections), V2_ALPHA9_SECTION_KEYS);
    equal(Object.values(workspace.proposedSnapshot.sections).every((text) => text.trim().length > 0), true);
    equal(workspace.priorityIssues.length, 3);
    equal(new Set(workspace.priorityIssues.map((item) => item.issueId)).size, 3);
    equal(new Set(workspace.priorityIssues.map((item) => item.location)).size, 3);
    for (const issue of workspace.priorityIssues) {
      equal(issue.alternatives.length, 3);
      equal(new Set(issue.alternatives.map((item) => item.alternativeId)).size, 3);
      equal(new Set(issue.alternatives.map((item) => item.text)).size, 3);
      deepEqual(new Set(issue.alternatives.map((item) => item.strategy)), new Set(V2_ALPHA9_REVISION_STRATEGIES));
      equal(issue.alternatives.filter((item) => item.recommended).length, 1);
      equal(issue.alternatives.find((item) => item.recommended)?.alternativeId, issue.recommendedAlternativeId);
    }
    equal(workspace.completedCount + workspace.gapCount, 13);
    equal(workspace.formalResearchWriteCount, 0);
    const visible = userFacingProjection(workspace);
    doesNotMatch(visible, /\bUNKNOWN\b|fixture|Human Gate|ZOTERO-ALPHA|wp-00|本機|基於現有半成品|使用者提供|\bOPERATING\b|BUDGET snapshot/iu);
    doesNotMatch(visible, /[ \t]+[，。；：！？]|[，。；：！？][ \t]+|(?:。。|；；|，，|：：|；\s*。|。\s*；)/u);
    if (track === "JOURNAL_MANUSCRIPT") deepEqual(workspace.paperpalBoundary, V2_ALPHA9_PAPERPAL_BOUNDARY);
    else {
      equal(workspace.paperpalBoundary, null);
      const gapLocations = new Set(workspace.priorityIssues.map((issue) => issue.location));
      equal(workspace.gapCount, gapLocations.size);
      equal(workspace.completedCount, V2_ALPHA9_SECTION_KEYS.filter((sectionKey) => !gapLocations.has(sectionKey)).length);
      for (const issue of workspace.priorityIssues) {
        const alternatives = issue.alternatives.map((alternative) => alternative.text);
        const shortest = Math.min(...alternatives.map((text) => text.length));
        ok(commonPrefixLength(alternatives) / shortest <= 0.5, `${track} ${issue.issueId} alternatives share too much prefix`);
        for (const replacement of alternatives) {
          ok(replacement.length >= 60, `${track} ${issue.issueId} replacement should be substantive`);
          ok(/[。；！？]$/u.test(replacement), `${track} ${issue.issueId} replacement should be directly usable prose`);
          doesNotMatch(replacement, /^(?:以下|建議|可改為|改寫|此版本|本版本|老麥建議)|(?:以下是|建議你|可將.{0,30}改為)/u);
        }
      }
    }
  }
  const journal = createSyntheticV2Alpha9UiWorkspace(alpha9Request("JOURNAL_MANUSCRIPT", "ui-journal-location-regression"));
  deepEqual(journal.priorityIssues.map((issue) => issue.location), [
    "RESULTS_OR_EXPECTED_OUTCOMES",
    "REFERENCES",
    "DECLARATIONS_OR_ATTACHMENTS",
  ]);
  equal(journal.priorityIssues.some((issue) => issue.location === "KEYWORDS" || issue.location === "LITERATURE_OR_POLICY_CONTEXT"), false);
});

await group("E_IDEMPOTENCY_REPLAY_CONFLICT_AND_COMPLETION_UNKNOWN", async () => {
  let calls = 0;
  const coordinator = createV2Alpha9Coordinator(async (request) => {
    calls += 1;
    return createSyntheticV2Alpha9UiWorkspace(request);
  });
  const request = alpha9Request("JOURNAL_MANUSCRIPT", "coordinator");
  const first = await coordinator.run(request, "fixture-workspace:fixture-user");
  const replay = await coordinator.run(request, "fixture-workspace:fixture-user");
  equal(first.replayed, false);
  equal(replay.replayed, true);
  equal(calls, 1);
  deepEqual(replay.workspace, first.workspace);
  await rejects(
    () => coordinator.run({ ...request, requestId: "alpha9-request-coordinator-conflict" }, "fixture-workspace:fixture-user"),
    /alpha9_idempotency_conflict/u,
  );

  let unknownCalls = 0;
  const unknown = createV2Alpha9Coordinator(async () => {
    unknownCalls += 1;
    throw new Error("alpha9_completion_unknown");
  });
  const unknownRequest = alpha9Request("MOE_PROPOSAL", "unknown");
  await rejects(() => unknown.run(unknownRequest, "fixture-workspace:fixture-user"), /alpha9_completion_unknown/u);
  await rejects(() => unknown.run(unknownRequest, "fixture-workspace:fixture-user"), /alpha9_completion_unknown_no_resend/u);
  equal(unknownCalls, 1);
});

await group("F_WHOLE_ARTIFACT_APPLY_UNDO_AND_STALE_FAIL_CLOSED", () => {
  const workspace = manuscriptReview("apply");
  const selections = workspace.priorityFindings.map((finding) => ({
    findingId: finding.findingId,
    optionId: finding.recommendedOptionId,
  }));
  const application = applyV2Alpha9WholeArtifactReview(workspace, workspace.reviewDraft, workspace.reviewDraftHash, selections);
  equal(application.selectedOptionIds.length, 3);
  equal(application.formalResearchWriteCount, 0);
  equal(application.onlineDatabaseWriteCount, 0);
  equal(application.networkCallCount, 0);
  equal(application.externalMutationCount, 0);
  equal(application.appliedHash === application.originalHash, false);
  const undone = undoV2Alpha9WholeArtifactReview(application, application.appliedHash);
  deepEqual(undone.sections, workspace.reviewDraft);
  equal(undone.hash, workspace.reviewDraftHash);
  throws(() => applyV2Alpha9WholeArtifactReview(workspace, workspace.reviewDraft, "0".repeat(64), selections), /alpha9_stale_candidate/u);
  throws(() => undoV2Alpha9WholeArtifactReview(application, "0".repeat(64)), /alpha9_undo_stale_candidate/u);
});

await group("G_TAMPER_EFFECT_AND_PAPERPAL_BOUNDARIES", () => {
  const request = alpha9Request("JOURNAL_MANUSCRIPT", "tamper");
  const ui = createSyntheticV2Alpha9UiWorkspace(request);
  throws(() => validateV2Alpha9UiWorkspace({ ...ui, unexpectedProviderField: "ignored-by-design-is-not-allowed-at-root" }, request), /alpha9_workspace_contract_invalid/u);
  const badIssue = structuredClone(ui);
  badIssue.priorityIssues[0].alternatives[0].recommended = true;
  throws(() => validateV2Alpha9UiWorkspace(badIssue, request), /alpha9_ui_recommendation_invalid/u);
  const badWrite = structuredClone(ui);
  badWrite.formalResearchWriteCount = 1;
  throws(() => validateV2Alpha9UiWorkspace(badWrite, request), /alpha9_workspace_effect_boundary_invalid/u);
  const badPaperpal = structuredClone(ui);
  badPaperpal.paperpalBoundary.liveConnection = true;
  throws(() => validateV2Alpha9UiWorkspace(badPaperpal, request), /alpha9_paperpal_boundary_invalid/u);

  const manuscript = manuscriptReview("tamper-review");
  const tamperedSection = structuredClone(manuscript);
  tamperedSection.reviewDraft[0].text += "竄改";
  throws(() => validateV2Alpha9ManuscriptWorkspace(tamperedSection), /alpha9_section_hash_mismatch/u);
  const tamperedEffect = structuredClone(manuscript);
  tamperedEffect.networkCallCount = 1;
  throws(() => validateV2Alpha9ManuscriptWorkspace(tamperedEffect), /alpha9_workspace_effect_boundary_invalid/u);
  const tamperedBoundary = structuredClone(manuscript);
  tamperedBoundary.paperpalBoundary.importedCandidateMayUpgradeEvidence = true;
  throws(() => validateV2Alpha9ManuscriptWorkspace(tamperedBoundary), /alpha9_paperpal_boundary_invalid/u);
  equal(alpha9SectionsHash(manuscript.reviewDraft), manuscript.reviewDraftHash);
});

console.log(JSON.stringify({
  status: "PASS",
  groups: results.length,
  assertions,
  results,
  tracks: 3,
  canonicalSections: 13,
  priorityIssuesPerTrack: 3,
  alternativesPerIssue: 3,
  officialSyntheticMayPass: false,
  paperpalLiveConnection: false,
  providerCalls: 0,
  scholarlyCalls: 0,
  databaseConnections: 0,
  formalResearchWrites: 0,
  externalMutations: 0,
}));
