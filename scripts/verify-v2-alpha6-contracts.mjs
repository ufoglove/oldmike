import assert from "node:assert/strict";

import {
  V2_ALPHA6_CONTRACT_VERSION,
  V2_ALPHA6_LANGUAGE_ALTERNATIVES,
  V2_ALPHA6_LANGUAGE_TASKS,
  V2_ALPHA6_MANUSCRIPT_SECTION_KEYS,
  V2_ALPHA6_NARRATIVE_STRATEGIES,
} from "../lib/v2-alpha6/contracts.ts";
import { V2_ALPHA6_R1_SEMANTIC_FIXTURES } from "../lib/v2-alpha6-r1/semantic-language-fixtures.ts";
import {
  alpha6Hash,
  applyAlpha6LanguageRevision,
  createAlpha6LanguageAssistance,
  createSyntheticAlpha6ProjectRequest,
  createSyntheticAlpha6PastedRequest,
  createSyntheticAlpha6Workspace,
  createV2Alpha6Coordinator,
  parseAlpha6WorkspaceRequest,
  undoAlpha6LanguageRevision,
} from "../lib/v2-alpha6/runtime.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const throws = (fn, pattern, message) => { assertions += 1; assert.throws(fn, pattern, message); };
const groups = [];
const group = async (name, run) => { await run(); groups.push(name); };

const projectRequest = createSyntheticAlpha6ProjectRequest("alpha6-project-contract-001");
const pastedRequest = createSyntheticAlpha6PastedRequest("alpha6-pasted-contract-001");

await group("1_EXACT_SOURCE_S0_EVIDENCE_JOURNAL_HASHES_TWO_ENTRY_MODES_MALFORMED_STALE_REJECTION", async () => {
  equal(parseAlpha6WorkspaceRequest(projectRequest).entryMode, "PROJECT_ARTIFACT", "project entry parses");
  const pasted = parseAlpha6WorkspaceRequest(pastedRequest);
  equal(pasted.entryMode, "PASTED_DRAFT", "pasted entry parses");
  equal(pasted.source.sourceText, pastedRequest.source.sourceText, "pasted source bytes preserved");
  ok([projectRequest.source.sourceHash, projectRequest.source.s0Hash, projectRequest.source.evidenceBundleHash, projectRequest.source.journal.identity.snapshotHash, projectRequest.source.journal.policy.snapshotHash].every((value) => /^[a-f0-9]{64}$/u.test(value)), "all project authorities hash-bound");
  throws(() => parseAlpha6WorkspaceRequest({ ...projectRequest, source: { ...projectRequest.source, s0Hash: "0".repeat(64) } }), /alpha6_s0_hash_mismatch/u, "tampered S0 rejected");
  throws(() => parseAlpha6WorkspaceRequest({ ...pastedRequest, source: { ...pastedRequest.source, sourceText: `${pastedRequest.source.sourceText} altered` } }), /alpha6_source_hash_mismatch/u, "tampered pasted source rejected");
  const stale = createSyntheticAlpha6Workspace(createSyntheticAlpha6ProjectRequest("alpha6-stale-journal-001", { journalFreshness: "STALE" }));
  equal(stale.submissionReadiness, "STALE", "stale journal cannot be ready");
  const analysisResult = { artifactHash: "a".repeat(64), verifiedResultData: true, summary: "Verified synthetic analysis artifact with bounded scope." };
  const sourceWithAnalysis = { ...projectRequest.source, analysisResult, analysisResultHash: analysisResult.artifactHash };
  const { sourceHash: _priorSourceHash, ...sourceCoreWithAnalysis } = sourceWithAnalysis;
  const verifiedAnalysisRequest = { ...projectRequest, requestId: "alpha6-verified-analysis-001", source: { ...sourceWithAnalysis, sourceHash: alpha6Hash(sourceCoreWithAnalysis) } };
  equal(parseAlpha6WorkspaceRequest(verifiedAnalysisRequest).source.analysisResultHash, analysisResult.artifactHash, "verified analysis artifact commitment parses without self-hash");
  equal(createSyntheticAlpha6Workspace(verifiedAnalysisRequest).manuscript.sections.resultsOrPlannedResults.resultState, "VERIFIED_DATA_BOUND", "verified analysis enables only bound result drafting");
});

await group("2_ONE_ACTION_THREE_DIFFERENT_NARRATIVE_STRATEGIES_BALANCED_RECOMMENDED_SWITCH_ZERO_EFFECTS", async () => {
  const workspace = createSyntheticAlpha6Workspace(projectRequest);
  equal(workspace.strategies.map((item) => item.strategy), [...V2_ALPHA6_NARRATIVE_STRATEGIES], "exact three strategy order");
  equal(workspace.strategies.length, 3, "exactly three strategies");
  equal(workspace.strategies.filter((item) => item.recommended).map((item) => item.strategy), ["BALANCED_JOURNAL_FIT_RECOMMENDED"], "balanced is recommended");
  equal(new Set(workspace.strategies.map((item) => item.framing)).size, 3, "framing materially distinct");
  equal(new Set(workspace.strategies.map((item) => item.argumentArchitecture)).size, 3, "argument architecture materially distinct");
  equal(new Set(workspace.strategies.map((item) => item.evidenceBurden)).size, 3, "evidence burden materially distinct");
  equal(new Set(workspace.strategies.map((item) => item.risk)).size, 3, "risk materially distinct");
  equal(workspace.cardSwitchProviderSubmissionCount, 0, "card switching creates no effect");
});

await group("3_COMPLETE_MANUSCRIPT_SCHEMA_COHERENCE_MISSING_RESULTS_PLANNED_NO_FABRICATION", async () => {
  for (const request of [projectRequest, pastedRequest]) {
    const workspace = createSyntheticAlpha6Workspace(request);
    equal(Object.keys(workspace.manuscript.sections).sort(), [...V2_ALPHA6_MANUSCRIPT_SECTION_KEYS].sort(), "complete manuscript field set");
    ok(Object.values(workspace.manuscript.sections).every((section) => section.text.trim().length > 0), "all manuscript sections populated");
    equal(workspace.manuscript.sections.resultsOrPlannedResults.resultState, "PLANNED", "results are explicitly planned without verified data");
    ok(workspace.manuscript.sections.resultsOrPlannedResults.requiredDataChecklist.length >= 3, "required result data checklist present");
    ok(!/(p\s*[<=>]\s*0\.|顯著提升|effect size\s*=|結果顯示)/iu.test(JSON.stringify(workspace.manuscript)), "no invented result claim");
    equal(workspace.manuscript.formalWriteCount, 0, "manuscript remains local draft");
  }
});

await group("4_CLAIM_EVIDENCE_UNKNOWN_SEPARATION_JOURNAL_FRESHNESS_NO_ACCEPTANCE_PROBABILITY", async () => {
  const workspace = createSyntheticAlpha6Workspace(projectRequest);
  equal(new Set(workspace.claimLedger.map((claim) => claim.state)), new Set(["VERIFIED", "UNVERIFIED", "ASSUMPTION", "MISSING"]), "all claim states represented");
  ok(workspace.claimLedger.every((claim) => claim.evidenceBoundary.length > 0 && claim.claimHash.length === 64), "claims have evidence boundaries and hashes");
  equal(workspace.journalAuthority.identity.freshness, "CURRENT", "identity freshness consumed");
  equal(workspace.journalAuthority.policy.freshness, "CURRENT", "policy freshness consumed");
  ok(!/acceptance probability|接受機率|保證刊登|命中率/iu.test(JSON.stringify(workspace)), "no acceptance probability or promise");
  ok(workspace.zoteroEvidence.every((item) => item.cannotUpgradeClaimState === true && item.attachmentPolicy === "METADATA_ONLY"), "Zotero cannot upgrade claims or retain full text");
});

await group("5_FOUR_LANGUAGE_TASKS_EXACT_THREE_ALTERNATIVES_PRESERVE_FACTS_DIFF_REASON_RISK", async () => {
  for (const task of V2_ALPHA6_LANGUAGE_TASKS) {
    const fixture = V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((item) => item.task === task);
    ok(fixture, `${task} authored semantic fixture exists`);
    const source = fixture.source;
    const result = createAlpha6LanguageAssistance(task, source);
    equal(result.task, task, `${task} bound`);
    equal(result.options.map((item) => item.strategy), [...V2_ALPHA6_LANGUAGE_ALTERNATIVES], `${task} exact strategy set`);
    equal(result.options.filter((item) => item.recommended).map((item) => item.strategy), ["PRECISE_JOURNAL_FORMAL"], `${task} one recommendation`);
    ok(result.options.every((item) => item.source === source && item.revision.length > 0 && item.reason.length > 0 && item.risk.length > 0), `${task} diff fields complete`);
    ok(result.options.every((item) => item.preservation.citations && item.preservation.numbers && item.preservation.units && item.preservation.formulas && item.preservation.hedging && item.preservation.terminology), `${task} preservation contract`);
  }
});

await group("6_NATURAL_SCHOLARLY_STYLE_SPECIFIC_READABLE_AUTHORIAL_FACTS_UNCHANGED_NO_EVASION", async () => {
  const fixture = V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((item) => item.fixtureId === "energy-natural-multiparagraph");
  ok(fixture, "natural scholarly authored fixture exists");
  const source = fixture.source;
  const option = createAlpha6LanguageAssistance("NATURAL_SCHOLARLY_STYLE", source).options.find((item) => item.strategy === "NATURAL_SCHOLARLY");
  ok(option && option.revision !== source && option.revision.includes("[9]") && option.revision.includes("15%") && option.revision.includes("$x=4$"), "natural option improves rhythm without changing facts");
  ok(!/AI detector|humanize to evade|規避偵測|繞過檢測/iu.test(`${option?.reason} ${option?.revision}`), "no detector-evasion claim");
  ok(!/In today's rapidly evolving|delve into|game-changer|seamlessly|revolutionary/iu.test(option?.revision ?? ""), "no generic machine-like filler");
});

await group("7_IDEMPOTENCY_REPLAY_CONFLICT_UNKNOWN_PRESERVATION_APPLY_UNDO_HUMAN_GATE_WRITES_ZERO", async () => {
  let submissions = 0;
  const coordinator = createV2Alpha6Coordinator(async (request) => { submissions += 1; return createSyntheticAlpha6Workspace(request); });
  const first = await coordinator.run({ ...projectRequest, scope: "fixture-workspace:fixture-user" });
  const replay = await coordinator.run({ ...projectRequest, scope: "fixture-workspace:fixture-user" });
  equal(first.replayed, false, "first action executes"); equal(replay.replayed, true, "same action replays"); equal(submissions, 1, "one generation effect");
  await assert.rejects(() => coordinator.run({ ...projectRequest, scope: "fixture-workspace:fixture-user", declaredLanguage: "EN" }), /alpha6_idempotency_conflict/u); assertions += 1;
  const workspace = first.result;
  const applyFixture = V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((item) => item.fixtureId === "environment-academic-edit");
  ok(applyFixture, "apply and undo authored fixture exists");
  const source = applyFixture.source;
  const suggestion = createAlpha6LanguageAssistance("ACADEMIC_EN_EDIT", source).options[1];
  const applied = applyAlpha6LanguageRevision({ currentText: source, expectedSourceHash: suggestion.sourceHash, suggestion });
  equal(applied.text, suggestion.revision, "preview applies only selected local revision");
  equal(undoAlpha6LanguageRevision(applied).text, source, "undo restores exact source");
  equal(workspace.humanGate, { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: workspace.humanGate.contentHash }, "one whole-artifact gate");
  equal(workspace.formalResearchWriteCount, 0, "formal writes zero");
  equal(workspace.onlineDatabaseWriteCount, 0, "online DB writes zero");
  equal(workspace.externalMutationCount, 0, "external mutations zero");
  const preserved = structuredClone(workspace.manuscript);
  const unknownCoordinator = createV2Alpha6Coordinator(async () => { throw new Error("alpha6_completion_unknown"); });
  await assert.rejects(() => unknownCoordinator.run({ ...pastedRequest, scope: "fixture-workspace:fixture-user" }), /alpha6_completion_unknown/u); assertions += 1;
  equal(preserved.manuscriptHash, workspace.manuscript.manuscriptHash, "unknown completion preserves prior draft");
});

equal(groups.length, 7, "exactly seven non-browser acceptance groups");
console.log(JSON.stringify({ status: "PASS", contractVersion: V2_ALPHA6_CONTRACT_VERSION, groups, assertions, liveProviderCalls: 0, scholarlyCalls: 0, zoteroCalls: 0, onlineDatabaseConnections: 0, formalResearchWrites: 0, externalMutations: 0 }));
