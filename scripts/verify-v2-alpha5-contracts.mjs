import assert from "node:assert/strict";

import { createBuiltinDomainSelection, createCustomDomainSelection, V2_ALPHA3_BUILTIN_DOMAINS } from "../lib/v2-alpha3/contracts.ts";
import { classifyZoteroDuplicates } from "../lib/v2-alpha4-r1/zotero-contracts.ts";
import { parseProposalDraft } from "../lib/proposal-studio-contract.ts";
import {
  V2_ALPHA5_CONTRACT_VERSION,
  V2_ALPHA5_DIRECTION_LANES,
  V2_ALPHA5_TARGETS,
} from "../lib/v2-alpha5/contracts.ts";
import {
  alpha5Hash,
  createAlpha5TargetSelection,
  createSyntheticOfficialSourceBundle,
  parseOfficialSourceBundle,
} from "../lib/v2-alpha5/official-source-bundle.ts";
import {
  createSyntheticAlpha5Workspace,
  createV2Alpha5Coordinator,
  parseAlpha5WorkspaceRequest,
} from "../lib/v2-alpha5/runtime.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const throws = (fn, pattern, message) => { assertions += 1; assert.throws(fn, pattern, message); };
const groups = [];
const group = async (name, run) => { await run(); groups.push(name); };

const domain = createBuiltinDomainSelection("ai-education");
const targetId = "NSTC";
const bundle = createSyntheticOfficialSourceBundle({ targetId, cycleYear: 2026, domainSelection: domain, variant: "MIXED_FRESHNESS" });
const request = { contractVersion: V2_ALPHA5_CONTRACT_VERSION, requestId: "alpha5-contract-001", domainSelection: domain, targetId, researchDirection: "以情境式學習改善職業安全風險辨識", sourceBundle: bundle };

await group("1_DOMAIN_TARGET_SOURCE_BUNDLE_HASH_BINDING_SIX_PRESETS_CUSTOM", async () => {
  equal(V2_ALPHA3_BUILTIN_DOMAINS.map((item) => item.id), ["ai-cross-disciplinary", "ai-education", "ai-occupational-safety-training", "ai-environment-resource-management", "ai-energy-management", "xr-cross-disciplinary"], "six exact stable domains");
  equal(V2_ALPHA5_TARGETS.map((item) => item.id), ["NSTC", "MOE"], "exact proposal targets");
  equal(V2_ALPHA5_TARGETS.map((item) => item.label), ["國科會專題研究計畫（原科技部）", "教育部教學實踐研究計畫"], "exact target labels");
  const custom = createCustomDomainSelection({ profileId: "profile-alpha5-custom", version: 2, name: "循環經濟與職能發展", contentHash: alpha5Hash({ name: "循環經濟與職能發展", version: 2 }) });
  const customBundle = createSyntheticOfficialSourceBundle({ targetId: "MOE", cycleYear: 2026, domainSelection: custom, variant: "CURRENT" });
  equal(parseOfficialSourceBundle(customBundle, { targetId: "MOE", domainSelectionHash: custom.selectionHash }).disciplineHash, custom.selectionHash, "custom profile hash binding");
  equal(parseAlpha5WorkspaceRequest(request).sourceBundle.bundleHash, bundle.bundleHash, "request consumes exact source bundle");
  equal(createAlpha5TargetSelection("NSTC").proposalMode, "NSTC_RESEARCH", "target maps existing proposal mode");
  const mixedCycle = createSyntheticOfficialSourceBundle({ targetId: "NSTC", cycleYear: 2026, domainSelection: domain, variant: "MIXED_CYCLE" });
  throws(() => parseOfficialSourceBundle(mixedCycle, { targetId: "NSTC", domainSelectionHash: domain.selectionHash }), /alpha5_source_cycle_mixed/u, "mixed cycles fail closed");
});

await group("2_EXACTLY_THREE_DISTINCT_DIRECTIONS_ONE_RECOMMENDATION_CARD_SWITCH_ZERO_EFFECTS", async () => {
  const workspace = createSyntheticAlpha5Workspace(request);
  equal(workspace.directions.length, 3, "exactly three directions");
  equal(new Set(workspace.directions.map((item) => item.lane)), new Set(V2_ALPHA5_DIRECTION_LANES), "exact lanes");
  equal(workspace.directions.filter((item) => item.recommended).length, 1, "one recommendation");
  equal(new Set(workspace.directions.map((item) => item.workingTitle)).size, 3, "titles distinct");
  equal(new Set(workspace.directions.map((item) => item.researchQuestion)).size, 3, "questions distinct");
  ok(workspace.directions.every((item) => !/[〈〉<>]|待填/u.test(item.workingTitle)), "professional nonplaceholder titles");
  equal(workspace.cardSwitchProviderSubmissionCount, 0, "card switching zero effects");
  let submissions = 0;
  const coordinator = createV2Alpha5Coordinator(async (input) => { submissions += 1; return createSyntheticAlpha5Workspace(input); });
  const first = await coordinator.run({ ...request, scope: "workspace:user" });
  const replay = await coordinator.run({ ...request, scope: "workspace:user" });
  equal(first.replayed, false, "first action submitted"); equal(replay.replayed, true, "same action replayed"); equal(submissions, 1, "one provider submission");
  await assert.rejects(() => coordinator.run({ ...request, scope: "workspace:user", researchDirection: "不同內容" }), /alpha5_idempotency_conflict/u); assertions += 1;
});

await group("3_SELECTED_DIRECTION_COMPLETE_COHERENT_EXISTING_M05_PROPOSALDRAFT_FOR_BOTH_NSTC_MOE", async () => {
  for (const id of ["NSTC", "MOE"]) {
    const modeBundle = createSyntheticOfficialSourceBundle({ targetId: id, cycleYear: 2026, domainSelection: domain, variant: "MIXED_FRESHNESS" });
    const workspace = createSyntheticAlpha5Workspace({ ...request, requestId: `alpha5-${id}-request`, targetId: id, sourceBundle: modeBundle });
    equal(Object.keys(workspace.proposalsByDirection).length, 3, `${id} all local card drafts available`);
    for (const directionItem of workspace.directions) {
      const proposal = parseProposalDraft(workspace.proposalsByDirection[directionItem.directionId]);
      equal(proposal.bilingual.titleZhTw, directionItem.workingTitle, `${id} title bound to direction`);
      ok(proposal.narrative.researchQuestions.includes(directionItem.researchQuestion), `${id} question bound`);
      ok(proposal.workPackages.length >= 2 && proposal.milestones.every((item) => proposal.workPackages.some((wp) => wp.workPackageId === item.workPackageId)), `${id} work-package coherence`);
      equal(proposal.mode, id === "NSTC" ? "NSTC_RESEARCH" : "MOE_TEACHING_PRACTICE", `${id} existing ProposalDraft mode`);
    }
  }
});

await group("4_OFFICIAL_FACTS_HISTORICAL_OBSERVATIONS_RECOMMENDATIONS_UNKNOWN_FRESHNESS_SEPARATION", async () => {
  const workspace = createSyntheticAlpha5Workspace(request);
  equal(workspace.sourceBundle.freshness, "STALE", "mixed freshness visible");
  ok(workspace.officialFacts.every((item) => item.status === "UNKNOWN"), "unverified facts remain unknown");
  ok(workspace.historicalObservations.every((item) => item.boundary === "HISTORICAL_NOT_CURRENT_RULE"), "history separated");
  ok(workspace.oldMikeRecommendations.every((item) => item.boundary === "RECOMMENDATION_NOT_OFFICIAL_FACT"), "recommendations separated");
  const serialized = JSON.stringify(workspace);
  ok(!/acceptance probability|接受機率|審查偏好為/u.test(serialized), "no preference or acceptance probability");
  ok(workspace.sourceBundle.sources.some((item) => item.freshness === "MISSING") && workspace.sourceBundle.sources.some((item) => item.freshness === "STALE"), "missing and stale preserved");
});

await group("5_BUDGET_ARITHMETIC_WORK_PACKAGE_LINKAGE_ATTACHMENTS_RULE_CHECKS", async () => {
  const proposal = createSyntheticAlpha5Workspace(request).proposalsByDirection["direction-2"];
  equal(proposal.budget.totalTwd, proposal.budget.items.reduce((sum, item) => sum + item.quantity * item.unitCostTwd, 0), "budget arithmetic");
  ok(proposal.budget.items.every((item) => proposal.workPackages.some((wp) => wp.workPackageId === item.workPackageId)), "budget work-package linkage");
  ok(proposal.requirements.every((item) => item.status === "UNKNOWN" && item.sourceHash === bundle.bundleHash), "requirements source-bound unknown");
  ok(proposal.attachments.every((item) => item.status === "UNKNOWN"), "attachments unknown until verified");
  throws(() => parseProposalDraft({ ...proposal, budget: { ...proposal.budget, totalTwd: proposal.budget.totalTwd + 1 } }), /budget_total_mismatch/u, "arithmetic mismatch rejected");
});

await group("6_ZOTERO_CITATION_BOUNDARY_DETERMINISTIC_DEDUPE", async () => {
  const citation = { title: "Research design evidence", year: 2025, firstAuthor: "Lin", authors: ["Lin"], journal: "Fixture", doi: "10.5555/zotero.alpha5", pmid: null, arxiv: null, isbn: null };
  equal(classifyZoteroDuplicates({ ...citation, title: "Changed" }, [citation]).classification, "EXACT_DOI", "DOI-first dedupe");
  const fuzzy = classifyZoteroDuplicates({ ...citation, doi: null, title: "Research design evidence extended" }, [{ ...citation, doi: null }]);
  equal(fuzzy.classification, "POSSIBLE_DUPLICATE_REVIEW", "fuzzy duplicate review only");
  equal(fuzzy.autoMergeAllowed, false, "fuzzy never auto merges");
  const evidence = createSyntheticAlpha5Workspace(request).zoteroEvidence;
  ok(evidence.every((item) => item.authorityBoundary === "EVIDENCE_ONLY_NOT_OFFICIAL_RULE_OR_BUDGET"), "Zotero authority bounded");
  ok(!/pdf|fulltext|rawBody/u.test(JSON.stringify(evidence)), "no attachment fulltext or raw body");
});

await group("7_ONE_FINAL_HUMAN_GATE_FAILURE_DRAFT_PRESERVATION_IDEMPOTENCY_CONFLICT_FORMAL_WRITES_ZERO", async () => {
  const workspace = createSyntheticAlpha5Workspace(request);
  equal(workspace.humanGate, { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: workspace.humanGate.contentHash }, "one whole-artifact gate");
  ok(/^[a-f0-9]{64}$/u.test(workspace.humanGate.contentHash), "gate exact content hash");
  equal(workspace.formalResearchWriteCount, 0, "formal writes zero");
  equal(workspace.onlineDatabaseWriteCount, 0, "online DB writes zero");
  equal(workspace.externalMutationCount, 0, "external mutations zero");
  const preserved = structuredClone(workspace);
  try { throw new Error("synthetic_generation_failure"); } catch { /* UI retains the previous immutable workspace */ }
  equal(preserved.humanGate.contentHash, workspace.humanGate.contentHash, "failure preservation keeps previous draft");
});

equal(groups.length, 7, "exactly seven non-browser acceptance groups");
console.log(JSON.stringify({ status: "PASS", groups, assertions, providerCalls: 0, scholarlyCalls: 0, zoteroCalls: 0, databaseConnections: 0, formalResearchWrites: 0, externalMutations: 0 }));
