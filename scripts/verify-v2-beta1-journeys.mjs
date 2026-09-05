import assert from "node:assert/strict";

import {
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_JOURNEY_OPERATION,
  beta1Hash,
  parseV2Beta1JourneyArtifact,
  snapshotContentHash,
  validateProjectTruthSnapshot,
} from "../lib/v2-beta1/contracts.ts";
import { parseV2Beta1GetResponse, parseV2Beta1PostResponse } from "../lib/v2-beta1/client-contract.ts";
import { createV2Beta1HistoryEntry, createV2Beta1HistoryIntent, validateV2Beta1AuthoritativeTransition, validateV2Beta1FullHistory } from "../lib/v2-beta1/history-authority.ts";
import { deriveV2Beta1JourneyInputBundleHash } from "../lib/v2-beta1/journey-lineage.ts";
import {
  createV2Beta1Coordinator,
  createSyntheticBeta1Insight,
  createV2Beta1JourneyRequest,
} from "../lib/v2-beta1/runtime.ts";
import { createV2Beta1RouteHandlers } from "../lib/v2-beta1/route-handlers.ts";
import { deriveEvidenceProjectionBundle, v2Beta1WholeArtifactValue, validateEvidenceProjectionBundle } from "../lib/v2-beta1/selection-authority.ts";
import { V2_BETA1_DIRECTION_LANES, createV2Beta1AssistOptions } from "../lib/v2-beta1/shared-authority.ts";
import { createV2Beta1ObservationConfirmationAuthority, createV2Beta1TypedObservationRecord, deriveV2Beta1ObservationCandidates, deriveV2Beta1ObservationEffectLineageHash } from "../lib/v2-beta1/typed-observation-authority.ts";

process.env.NODE_ENV = "development";
process.env.TEST_FIXTURE = "1";
process.env.OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE = "1";
process.env.OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL = "1";

const groups = [];

async function group(name, test) {
  await test();
  groups.push(name);
}

function assertCompleteJourney(result, expectedKind) {
  assert.equal(result.replayed, false);
  assert.equal(result.snapshot.journey?.kind, expectedKind);
  assert.equal(result.snapshot.journey?.directions.length, 3);
  assert.equal(new Set(result.snapshot.journey?.directions.map((item) => item.lane)).size, 3);
  assert.equal(result.snapshot.journey?.directions.filter((item) => item.recommended).length, 1);
  assert.equal(Object.values(result.snapshot.s0Summary).length, 13);
  assert.ok(Object.values(result.snapshot.s0Summary).every((value) => value.trim().length > 0));
  assert.equal(result.snapshot.timeline.length, 1);
  assert.equal(result.snapshot.effectReceipts.length, 1);
  assert.equal(result.snapshot.effectReceipts[0].operation, V2_BETA1_JOURNEY_OPERATION);
  assert.equal(result.snapshot.formalResearchWriteCount, 0);
  assert.equal(result.snapshot.onlineDatabaseWriteCount, 0);
  assert.equal(result.snapshot.externalMutationCount, 0);
  const journey = result.snapshot.journey;
  assert.ok(journey?.evidenceAuthority.authorityHash);
  assert.equal(journey?.resultEvidenceClass, journey?.evidenceAuthority.summary.resultState);
  const trackKeys = { SSCI: ["population", "sample", "construct", "measurement", "validity", "primaryMechanism", "context"], SCI: ["sample", "comparison", "operationalization", "instrumentQuality", "effect", "confidenceInterval", "sensitivity", "reproducibility"], NSTC: ["theory", "hypotheses", "pilot", "mainStudy", "workPackages", "milestones", "reproducibleAnalysis"], MOE: ["course", "learners", "intervention", "fidelity", "learningAssessment", "effectAnalysis", "reflectionIteration"] };
  const wholeHashes = new Set();
  let assistCards = 0;
  for (const direction of journey?.directions ?? []) {
    assert.equal(direction.professionalProjection.outputTarget, journey?.outputTarget);
    assert.equal(direction.professionalProjection.lane, direction.lane);
    assert.equal(direction.professionalProjection.domainLabel, journey?.researchDomain.label);
    assert.equal(direction.professionalProjection.researchDirection, journey?.researchDirection);
    assert.deepEqual(Object.keys(direction.professionalProjection.trackFields), trackKeys[journey.outputTarget]);
    assert.equal(direction.professionalProjection.evidenceAuthorityHash, journey?.evidenceAuthority.authorityHash);
    const selection = direction.selectionArtifact;
    const { selectionArtifact: _selectionArtifact, ...directionCore } = direction;
    const selectionParent = { outputTarget: journey.outputTarget, researchDomainHash: journey.researchDomain.selectionHash, officialSourceBundleHash: journey.officialSourceBundleHash, direction: directionCore, materials: journey.sourceMaterials, evidenceAuthority: journey.evidenceAuthority };
    assert.equal(validateEvidenceProjectionBundle(selection, selectionParent), true);
    assert.deepEqual(deriveEvidenceProjectionBundle(selectionParent), selection);
    assert.equal(validateEvidenceProjectionBundle({ ...selection, unexpectedNestedAuthority: true }, selectionParent), false);
    assert.equal(validateEvidenceProjectionBundle({ ...selection, outputTarget: journey.outputTarget === "SCI" ? "SSCI" : "SCI" }, selectionParent), false);
    assert.equal(selection.evidenceAuthority.authorityHash, journey?.evidenceAuthority.authorityHash);
    assert.equal(selection.humanDraft.humanDraft.startsWith("# "), true);
    assert.match(selection.humanDraft.humanDraft, /## 13 欄研究摘要/);
    assert.match(selection.humanDraft.humanDraft, /## 最終人工關卡/);
    assert.doesNotMatch(selection.humanDraft.humanDraft, /EVIDENCE_FIRST|CAUSAL_MECHANISM|FRONTIER_INNOVATION|BALANCED_RECOMMENDED|"schemaId"/);
    assert.equal(selection.projectionHash, beta1Hash(`${selection.humanDraft.projectionVersion}${selection.humanDraft.humanDraft}`));
    assert.equal(selection.humanGateHash, beta1Hash({ scope: "WHOLE_ARTIFACT", wholeArtifactHash: selection.wholeArtifactHash, projectionHash: selection.projectionHash }));
    wholeHashes.add(selection.wholeArtifactHash);
    assistCards += Object.values(direction.fieldAssist).flat().length;
  }
  assert.equal(wholeHashes.size, 3);
  assert.equal(assistCards, 117);
}

function forgeCoherentRecommendedLaneFlip(artifact) {
  const forged = structuredClone(artifact);
  const observationEffectLineageHash = deriveV2Beta1ObservationEffectLineageHash(forged.observationAuthority);
  forged.directions = forged.directions.map((original) => {
    const direction = structuredClone(original);
    direction.recommended = direction.lane === V2_BETA1_DIRECTION_LANES[2];
    const { directionHash: _directionHash, inputBundleHash: _inputBundleHash, s0, preview, fieldAssist: _fieldAssist, selectionArtifact: _selectionArtifact, ...base } = direction;
    direction.directionHash = beta1Hash(base);
    const lineageBase = { entryMode: forged.entryMode, outputTarget: forged.outputTarget, researchDirection: forged.researchDirection, researchDomain: forged.researchDomain, materials: forged.sourceMaterials, observationEffectLineageHash, selectedLane: direction.lane };
    direction.inputBundleHash = deriveV2Beta1JourneyInputBundleHash(lineageBase, direction.directionHash);
    const assistParent = { direction: { lane: direction.lane, directionHash: direction.directionHash, inputBundleHash: direction.inputBundleHash, title: direction.title, researchQuestion: direction.researchQuestion, mechanism: direction.mechanism, contribution: direction.contribution, method: direction.method, s0 }, domain: { label: forged.researchDomain.label, selectionHash: forged.researchDomain.selectionHash }, outputTarget: forged.outputTarget };
    direction.fieldAssist = Object.fromEntries(Object.keys(direction.fieldAssist).map((field) => [field, createV2Beta1AssistOptions(assistParent, field)]));
    const { selectionArtifact: _oldSelection, ...directionCore } = direction;
    direction.selectionArtifact = deriveEvidenceProjectionBundle({ outputTarget: forged.outputTarget, researchDomainHash: forged.researchDomain.selectionHash, officialSourceBundleHash: forged.officialSourceBundleHash, direction: directionCore, materials: forged.sourceMaterials, evidenceAuthority: forged.evidenceAuthority });
    assert.equal(direction.directionHash, beta1Hash(base));
    assert.equal(direction.inputBundleHash, deriveV2Beta1JourneyInputBundleHash(lineageBase, direction.directionHash));
    assert.equal(validateEvidenceProjectionBundle(direction.selectionArtifact, { outputTarget: forged.outputTarget, researchDomainHash: forged.researchDomain.selectionHash, officialSourceBundleHash: forged.officialSourceBundleHash, direction: directionCore, materials: forged.sourceMaterials, evidenceAuthority: forged.evidenceAuthority }), true);
    return direction;
  });
  const selected = forged.directions.find((direction) => direction.lane === V2_BETA1_DIRECTION_LANES[2]);
  assert.ok(selected);
  const projection = selected.selectionArtifact;
  forged.inputBundleHash = selected.inputBundleHash;
  forged.recommendedDirectionId = selected.directionId;
  forged.selectedDirectionId = selected.directionId;
  forged.selectedDirectionHash = selected.directionHash;
  forged.evidenceGapMap = projection.evidenceGapMap;
  forged.analysisWorkPackages = projection.analysisWorkPackages;
  forged.continuationSections = projection.continuationSections;
  forged.journal = projection.journal;
  forged.taiwanProposal = projection.taiwanProposal;
  forged.humanGate = { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: projection.humanGateHash };
  const { artifactHash: _artifactHash, ...artifactCore } = forged;
  forged.artifactHash = beta1Hash(artifactCore);
  assert.equal(forged.artifactHash, beta1Hash(artifactCore));
  return forged;
}

await group("keyword_to_journal_final_review", async () => {
  const coordinator = createV2Beta1Coordinator();
  const snapshot = coordinator.getSnapshot("workspace:journey-keyword-journal");
  const request = createV2Beta1JourneyRequest(snapshot, {
    suffix: "keyword-journal",
    entryMode: "KEYWORD",
    outputTarget: "SSCI",
    researchDirection: "生成式回饋的證據校準與自我調節學習",
    materials: [],
  });
  assert.equal(request.contractVersion, V2_BETA1_CONTRACT_VERSION);
  assertCompleteJourney(await coordinator.runJourney(request, "workspace:journey-keyword-journal"), "JOURNAL");
});

await group("partial_material_to_journal_final_review", async () => {
  const coordinator = createV2Beta1Coordinator();
  const snapshot = coordinator.getSnapshot("workspace:journey-partial-journal");
  const materials = [
    { materialId: "material-abstract-001", kind: "ABSTRACT", title: "摘要", content: "本研究關注回饋可操作性與證據校準，不預先宣稱成效。" },
    { materialId: "material-method-001", kind: "METHODS", title: "方法", content: "採混合方法並保留樣本、比較條件、量測品質與分析設定待確認。" },
    { materialId: "material-results-001", kind: "RESULTS", title: "結果", content: "目前只觀察到描述性差異，不支持因果或顯著性推論。" },
    { materialId: "material-statistics-001", kind: "STATISTICS", title: "統計", content: "目前觀察到指標為 82%；分母、估計量與 95% CI 仍待核對。" },
  ];
  const request = createV2Beta1JourneyRequest(snapshot, {
    suffix: "partial-journal",
    entryMode: "PARTIAL_MATERIAL",
    outputTarget: "SCI",
    researchDirection: "整合既有方法材料形成可驗證研究問題",
    materials,
  });
  const result = await coordinator.runJourney(request, "workspace:journey-partial-journal");
  assertCompleteJourney(result, "JOURNAL");
  assert.deepEqual(result.snapshot.journey?.sourceMaterials.map((item) => [item.materialId, item.kind, item.title, item.content, item.contentHash]), materials.map((item) => [item.materialId, item.kind, item.title, item.content, beta1Hash(item.content)]));
  assert.equal(result.snapshot.journey?.resultEvidenceClass, "OBSERVED");
  assert.deepEqual([result.snapshot.journey?.evidenceAuthority.summary.consistencyProven, result.snapshot.journey?.evidenceAuthority.summary.traceable, result.snapshot.journey?.evidenceAuthority.summary.publicationUsable, result.snapshot.journey?.evidenceAuthority.summary.reviewStatus], [false, false, false, "READY_WITH_GAPS"]);
  const method = result.snapshot.journey?.directions[1].professionalProjection.method ?? "";
  for (const expected of ["樣本", "比較", "儀器品質", "效果", "信賴區間", "敏感度", "重現性"]) assert.match(method, new RegExp(expected));
  assert.equal(result.snapshot.journey?.journal?.publicationUsable, false);
});

await group("confirmed_typed_own_data_reaches_final_once_and_binds_history", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-confirmed-typed";
  const snapshot = coordinator.getSnapshot(scope);
  const observedRow = "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; effectId=participation-rate; Primary participation was observed at 0.31 %; N=180; p<=0.04; 95% CI [0.02, 0.6]; citation=OWN_DATA.";
  const materials = [
    { materialId: "typed-abstract", kind: "ABSTRACT", title: "Abstract", content: "This study examines participation without a causal claim." },
    { materialId: "typed-introduction", kind: "INTRODUCTION", title: "Introduction", content: "The research question and evidence boundary are explicit." },
    { materialId: "typed-methods", kind: "METHODS", title: "Methods", content: "The sample, comparison, measurement, and analysis are specified." },
    { materialId: "typed-results", kind: "RESULTS", title: "Results", content: observedRow },
    { materialId: "typed-statistics", kind: "STATISTICS", title: "Statistics", content: observedRow },
    { materialId: "typed-discussion", kind: "NOTE", title: "Discussion", content: "Interpretation remains association-only and preserves uncertainty." },
    { materialId: "typed-conclusion", kind: "NOTE", title: "Conclusion", content: "The conclusion remains bounded by confirmed source records." },
  ];
  const researchDirection = "Participation and evidence calibration";
  const candidates = deriveV2Beta1ObservationCandidates(materials);
  const records = candidates.map((candidate, index) => createV2Beta1TypedObservationRecord({ ...candidate.suggestedRecord, recordId: `observation:journey-${index + 1}` }));
  const observationConfirmation = createV2Beta1ObservationConfirmationAuthority({ projectId: snapshot.projectId, baseRevision: snapshot.revision, baseContentHash: snapshot.contentHash, outputTarget: "SCI", researchDirection, researchDomainHash: snapshot.focusDomain.selectionHash, trustedScope: scope, materials }, candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, decision: "CONFIRMED", recordHash: records[index].recordHash })), records);
  const request = createV2Beta1JourneyRequest(snapshot, { suffix: "confirmed-typed", entryMode: "PARTIAL_MATERIAL", outputTarget: "SCI", researchDirection, materials, observationConfirmation });
  const result = await coordinator.runJourney(request, scope);
  assertCompleteJourney(result, "JOURNAL");
  const journey = result.snapshot.journey;
  assert.deepEqual(journey?.observationAuthority, observationConfirmation);
  assert.deepEqual([journey?.evidenceAuthority.summary.resultState, journey?.evidenceAuthority.summary.consistencyProven, journey?.evidenceAuthority.summary.traceable, journey?.evidenceAuthority.summary.publicationUsable, journey?.evidenceAuthority.summary.reviewStatus], ["OBSERVED", true, true, true, "FINAL_CONFIRMABLE"]);
  assert.equal(journey?.evidenceAuthority.recordBindings.length, records.length);
  assert.equal(journey?.journal?.reviewStatus, "FINAL_CONFIRMABLE");
  assert.equal(journey?.journal?.publicationUsable, false);
  assert.equal(result.snapshot.effectReceipts[0].observationAuthorityHash, observationConfirmation.authorityHash);
  assert.equal(result.snapshot.timeline[0].observationAuthorityHash, observationConfirmation.authorityHash);
  assert.equal(result.snapshot.effectReceipts[0].generatedArtifactHash, journey?.artifactHash);
  const parsedGet = parseV2Beta1GetResponse({ ok: true, contractVersion: V2_BETA1_CONTRACT_VERSION, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: result.snapshot, previewInsight: createSyntheticBeta1Insight(), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 });
  assert.ok(parsedGet);
  const parsedPost = parseV2Beta1PostResponse({ ok: true, contractVersion: V2_BETA1_CONTRACT_VERSION, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: journey?.artifactHash, snapshot: result.snapshot, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 }, { trustedScope: scope, previousSnapshot: snapshot, submittedRequest: request });
  assert.ok(parsedPost);
  const replay = await coordinator.runJourney(request, scope);
  assert.equal(replay.replayed, true);
  assert.deepEqual([replay.snapshot.timeline.length, replay.snapshot.effectReceipts.length, replay.snapshot.journeys.length], [1, 1, 1]);
});

await group("planned_result_parent_stays_planned_across_selection_bundle", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-planned-journal";
  const snapshot = coordinator.getSnapshot(scope);
  const request = createV2Beta1JourneyRequest(snapshot, {
    suffix: "planned-journal",
    entryMode: "PARTIAL_MATERIAL",
    outputTarget: "SCI",
    researchDirection: "規劃證據校準與任務表現的研究",
    materials: [{ materialId: "material-planned-results-001", kind: "RESULTS", title: "結果", content: "metricId=score; cohortId=all; timepoint=post; analysisId=primary；Results have not yet been independently observed；β = 0.31；N=180；p=.04；95% CI [0.02, 0.60]。" }],
  });
  const result = await coordinator.runJourney(request, scope);
  assertCompleteJourney(result, "JOURNAL");
  const journey = result.snapshot.journey;
  assert.equal(journey?.resultEvidenceClass, "PLANNED");
  assert.equal(journey?.evidenceAuthority.summary.resultState, "PLANNED");
  assert.deepEqual([journey?.evidenceAuthority.summary.consistencyProven, journey?.evidenceAuthority.summary.publicationUsable, journey?.evidenceAuthority.summary.reviewStatus], [false, false, "READY_WITH_GAPS"]);
  assert.equal(journey?.journal?.publicationUsable, false);
  assert.equal(journey?.evidenceAuthority.clauses.some((item) => item.state === "PLANNED"), true);
  for (const direction of journey?.directions ?? []) {
    const selection = direction.selectionArtifact;
    assert.equal(selection.continuationSections.find((item) => item.sectionId === "RESULTS")?.evidenceState, "MISSING");
    assert.equal(selection.evidenceGapMap.some((item) => /規劃或預期|尚未形成可驗證觀察/u.test(item.statement)), true);
    assert.match(selection.humanDraft.humanDraft, /結果狀態：規劃中/u);
    assert.doesNotMatch(selection.humanDraft.humanDraft, /結果狀態：已觀察|已提供觀察材料/u);
  }
  const direction = journey?.directions[1];
  assert.ok(direction);
  const { selectionArtifact: selection, ...directionCore } = direction;
  const parent = { outputTarget: journey.outputTarget, researchDomainHash: journey.researchDomain.selectionHash, officialSourceBundleHash: journey.officialSourceBundleHash, direction: directionCore, materials: journey.sourceMaterials, evidenceAuthority: journey.evidenceAuthority };
  const forged = structuredClone(selection);
  forged.evidenceAuthority.summary.resultState = "OBSERVED";
  const { authorityHash: _oldAuthorityHash, ...evidenceCore } = forged.evidenceAuthority;
  forged.evidenceAuthority.authorityHash = beta1Hash(evidenceCore);
  const resultContinuation = forged.continuationSections.find((item) => item.sectionId === "RESULTS");
  assert.ok(resultContinuation);
  resultContinuation.evidenceState = "OBSERVED";
  const { contentHash: _oldContinuationHash, ...continuationCore } = resultContinuation;
  resultContinuation.contentHash = beta1Hash(continuationCore);
  forged.humanDraft.humanDraft = forged.humanDraft.humanDraft.replace("結果狀態：規劃中", "結果狀態：已觀察");
  forged.humanDraft.projectionHash = beta1Hash(`${forged.humanDraft.projectionVersion}${forged.humanDraft.humanDraft}`);
  forged.projectionHash = forged.humanDraft.projectionHash;
  const { wholeArtifactHash: _oldWholeHash, humanGateHash: _oldGateHash, ...forgedCore } = forged;
  forged.wholeArtifactHash = beta1Hash(v2Beta1WholeArtifactValue(directionCore, forgedCore));
  forged.humanGateHash = beta1Hash({ scope: "WHOLE_ARTIFACT", wholeArtifactHash: forged.wholeArtifactHash, projectionHash: forged.projectionHash });
  assert.equal(validateEvidenceProjectionBundle(forged, parent), false);
});

await group("target_scoped_negative_observation_stays_nonfinal_across_all_boundaries", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-negative-evidence-governor";
  const initial = coordinator.getSnapshot(scope);
  const governorRow = "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; Primary participation was not observed at 82%; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).";
  const request = createV2Beta1JourneyRequest(initial, {
    suffix: "negative-evidence-governor",
    entryMode: "PARTIAL_MATERIAL",
    outputTarget: "SCI",
    researchDirection: "檢驗證據校準與參與率的關係",
    materials: [
      { materialId: "governor-abstract", kind: "ABSTRACT", title: "Abstract", content: "This study examines evidence calibration without overstating the supplied result state." },
      { materialId: "governor-introduction", kind: "INTRODUCTION", title: "Introduction", content: "Wang et al. (2024) motivates the bounded evidence comparison." },
      { materialId: "governor-methods", kind: "METHODS", title: "Methods", content: "The sample, comparison, measure, and analysis are specified before interpretation." },
      { materialId: "governor-results", kind: "RESULTS", title: "Results", content: governorRow },
      { materialId: "governor-statistics", kind: "STATISTICS", title: "Statistics", content: governorRow },
      { materialId: "governor-discussion", kind: "NOTE", title: "Discussion", content: "Discussion remains bounded by the supplied negative-evidence governor." },
      { materialId: "governor-conclusion", kind: "NOTE", title: "Conclusion", content: "Conclusion does not convert an embedded observed effect into supported evidence." },
      { materialId: "governor-citation", kind: "CITATION", title: "Citation", content: "Wang et al. (2024). Evidence calibration in higher education." },
    ],
  });
  const result = await coordinator.runJourney(request, scope);
  assertCompleteJourney(result, "JOURNAL");
  const journey = result.snapshot.journey;
  assert.ok(journey);
  assert.deepEqual([journey.resultEvidenceClass, journey.evidenceAuthority.summary.resultState, journey.evidenceAuthority.summary.consistencyProven, journey.evidenceAuthority.summary.traceable, journey.evidenceAuthority.summary.publicationUsable, journey.evidenceAuthority.summary.reviewStatus], ["PLANNED", "PLANNED", false, true, false, "READY_WITH_GAPS"]);
  assert.equal(journey.journal?.publicationUsable, false);
  assert.doesNotThrow(() => parseV2Beta1JourneyArtifact(journey));
  assert.doesNotThrow(() => validateProjectTruthSnapshot(result.snapshot));
  assert.doesNotThrow(() => validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: result.snapshot, completionClass: "COMPLETE", selectedDirectionHash: journey.selectedDirectionHash, generatedArtifactHash: journey.artifactHash }));

  const getEnvelope = { ok: true, contractVersion: result.snapshot.contractVersion, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: result.snapshot, previewInsight: createSyntheticBeta1Insight("如何檢驗負向證據治理與觀察效果的關係？"), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  const postEnvelope = { ok: true, contractVersion: result.snapshot.contractVersion, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: result.snapshot.effectReceipts.at(-1)?.generatedArtifactHash ?? null, snapshot: result.snapshot, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  const postContext = { trustedScope: scope, previousSnapshot: initial, submittedRequest: request };
  assert.ok(parseV2Beta1GetResponse(getEnvelope)?.snapshot.journey);
  assert.ok(parseV2Beta1PostResponse(postEnvelope, postContext)?.snapshot.journey);

  const forged = structuredClone(result.snapshot);
  for (const artifact of [forged.journey, forged.journeys.at(-1)]) {
    assert.ok(artifact);
    artifact.resultEvidenceClass = "OBSERVED";
    artifact.evidenceAuthority.summary = { resultState: "OBSERVED", consistencyProven: true, traceable: true, publicationUsable: true, reviewStatus: "FINAL_CONFIRMABLE" };
    for (const clause of artifact.evidenceAuthority.clauses.filter((item) => ["RESULTS", "STATISTICS"].includes(item.kind))) {
      clause.state = "OBSERVED";
      clause.consistencyProven = true;
      clause.traceable = true;
      clause.publicationUsable = true;
      clause.reviewStatus = "FINAL_CONFIRMABLE";
    }
    const { authorityHash: _oldAuthorityHash, ...authorityCore } = artifact.evidenceAuthority;
    artifact.evidenceAuthority.authorityHash = beta1Hash(authorityCore);
    for (const direction of artifact.directions) {
      direction.professionalProjection.evidenceAuthorityHash = artifact.evidenceAuthority.authorityHash;
      const { authorityHash: _oldProjectionHash, ...projectionCore } = direction.professionalProjection;
      direction.professionalProjection.authorityHash = beta1Hash(projectionCore);
      direction.selectionArtifact.evidenceAuthority = structuredClone(artifact.evidenceAuthority);
      const { selectionArtifact, directionHash: _oldDirectionHash, ...directionCore } = direction;
      direction.directionHash = beta1Hash(directionCore);
      const { wholeArtifactHash: _oldWholeHash, humanGateHash: _oldGateHash, ...selectionCore } = selectionArtifact;
      selectionArtifact.wholeArtifactHash = beta1Hash(v2Beta1WholeArtifactValue(directionCore, selectionCore));
      selectionArtifact.humanGateHash = beta1Hash({ scope: "WHOLE_ARTIFACT", wholeArtifactHash: selectionArtifact.wholeArtifactHash, projectionHash: selectionArtifact.projectionHash });
    }
    const { artifactHash: _oldArtifactHash, ...artifactCore } = artifact;
    artifact.artifactHash = beta1Hash(artifactCore);
  }
  const { contentHash: _oldSnapshotHash, ...snapshotCore } = forged;
  forged.contentHash = snapshotContentHash(snapshotCore);
  assert.throws(() => parseV2Beta1JourneyArtifact(forged.journey), /beta1_evidence_authority_invalid/);
  assert.throws(() => validateProjectTruthSnapshot(forged), /beta1_evidence_authority_invalid/);
  assert.throws(() => validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: forged, completionClass: "COMPLETE", selectedDirectionHash: forged.journey.selectedDirectionHash, generatedArtifactHash: forged.journey.artifactHash }), /beta1_evidence_authority_invalid/);
  assert.equal(parseV2Beta1GetResponse({ ...getEnvelope, snapshot: forged }), null);
  assert.equal(parseV2Beta1PostResponse({ ...postEnvelope, snapshot: forged }, postContext), null);
});

await group("fixed_local_recommended_lane_rejects_coherent_descendant_rehash_flip", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-fixed-recommended-lane";
  const initial = coordinator.getSnapshot(scope);
  const request = createV2Beta1JourneyRequest(initial, {
    suffix: "fixed-recommended-lane",
    entryMode: "KEYWORD",
    outputTarget: "SSCI",
    researchDirection: "固定本地推薦政策與可追溯研究方向",
    materials: [],
  });
  const result = await coordinator.runJourney(request, scope);
  const journey = result.snapshot.journey;
  assert.ok(journey);
  assert.equal(journey.directions.find((direction) => direction.recommended)?.lane, V2_BETA1_DIRECTION_LANES[1]);
  assert.doesNotThrow(() => parseV2Beta1JourneyArtifact(journey));
  assert.doesNotThrow(() => validateProjectTruthSnapshot(result.snapshot));
  assert.doesNotThrow(() => validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: result.snapshot, completionClass: "COMPLETE", selectedDirectionHash: journey.selectedDirectionHash, generatedArtifactHash: journey.artifactHash }));
  const validPost = { ok: true, contractVersion: result.snapshot.contractVersion, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: journey.artifactHash, snapshot: result.snapshot, replayed: false, effectSubmissionCount: 1, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  const postContext = { trustedScope: scope, previousSnapshot: initial, submittedRequest: request };
  assert.ok(parseV2Beta1PostResponse(validPost, postContext));

  const forgedArtifact = forgeCoherentRecommendedLaneFlip(journey);
  const selected = forgedArtifact.directions.find((direction) => direction.lane === V2_BETA1_DIRECTION_LANES[2]);
  assert.ok(selected);
  const intent = createV2Beta1HistoryIntent({ scope, request, selectedDirectionHash: forgedArtifact.selectedDirectionHash, generatedArtifactHash: forgedArtifact.artifactHash });
  const { receipt, event } = createV2Beta1HistoryEntry({ intent, completionClass: "COMPLETE", sequence: 1 });
  assert.notEqual(receipt.payloadHash, forgedArtifact.inputBundleHash);
  assert.equal(receipt.generatedArtifactHash, forgedArtifact.artifactHash);
  const { contentHash: _initialContentHash, ...initialCore } = initial;
  const forgedCore = {
    ...initialCore,
    revision: initial.revision + 1,
    focusDomain: forgedArtifact.researchDomain,
    s0Summary: selected.s0,
    stages: result.snapshot.stages,
    journeys: [...initial.journeys, forgedArtifact],
    journey: forgedArtifact,
    timeline: [...initial.timeline, event],
    effectReceipts: [...initial.effectReceipts, receipt],
  };
  const forgedSnapshot = { ...forgedCore, contentHash: snapshotContentHash(forgedCore) };
  const forgedPost = { ...validPost, generatedArtifactHash: forgedArtifact.artifactHash, snapshot: forgedSnapshot };

  assert.throws(() => parseV2Beta1JourneyArtifact(forgedArtifact), /beta1_recommended_lane_invalid/);
  assert.throws(() => validateProjectTruthSnapshot(forgedSnapshot), /beta1_recommended_lane_invalid/);
  assert.throws(() => validateV2Beta1AuthoritativeTransition({ trustedScope: scope, previousSnapshot: initial, submittedRequest: request, nextSnapshot: forgedSnapshot, completionClass: "COMPLETE", selectedDirectionHash: forgedArtifact.selectedDirectionHash, generatedArtifactHash: forgedArtifact.artifactHash }), /beta1_recommended_lane_invalid/);
  assert.equal(parseV2Beta1GetResponse({ ok: true, contractVersion: forgedSnapshot.contractVersion, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: forgedSnapshot, previewInsight: createSyntheticBeta1Insight("如何檢驗推薦政策權威？"), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 }), null);
  assert.equal(parseV2Beta1PostResponse(forgedPost, postContext), null);
});

await group("keyword_to_taiwan_proposal_final_review", async () => {
  const coordinator = createV2Beta1Coordinator();
  const snapshot = coordinator.getSnapshot("workspace:journey-keyword-taiwan");
  const request = createV2Beta1JourneyRequest(snapshot, {
    suffix: "keyword-taiwan",
    entryMode: "KEYWORD",
    outputTarget: "MOE",
    researchDirection: "XR 情境演練對職業安全教育遷移表現的影響",
    materials: [],
  });
  const result = await coordinator.runJourney(request, "workspace:journey-keyword-taiwan");
  assertCompleteJourney(result, "TAIWAN_PROPOSAL");
  assert.equal(result.snapshot.journey?.taiwanProposal?.targetId, "MOE");
  assert.ok((result.snapshot.journey?.taiwanProposal?.workPackages.length ?? 0) > 0);
  assert.ok((result.snapshot.journey?.taiwanProposal?.kpis.length ?? 0) > 0);
  assert.ok((result.snapshot.journey?.taiwanProposal?.attachments.length ?? 0) > 0);
  assert.equal(result.snapshot.journey?.evidenceAuthority.summary.resultState, "MISSING");
  assert.match(result.snapshot.journey?.directions[1].selectionArtifact.humanDraft.humanDraft ?? "", /尚未提供可驗證結果|沒有來源材料/);
  assert.match(result.snapshot.journey?.directions[1].selectionArtifact.humanDraft.humanDraft ?? "", /官方規則未知|官方狀態未知/);
});

await group("keyword_to_nstc_professional_projection", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-keyword-nstc";
  const snapshot = coordinator.getSnapshot(scope);
  const request = createV2Beta1JourneyRequest(snapshot, { suffix: "keyword-nstc", entryMode: "KEYWORD", outputTarget: "NSTC", researchDirection: "跨域回饋機制與研究成效", materials: [] });
  const result = await coordinator.runJourney(request, scope);
  assertCompleteJourney(result, "TAIWAN_PROPOSAL");
  const projection = result.snapshot.journey?.directions[1].professionalProjection;
  assert.match(projection?.method ?? "", /理論|假設|先導|主要研究|工作包|里程碑|可重現/);
});

await group("replay_conflict_and_unknown_preserve_snapshot", async () => {
  let attempts = 0;
  const coordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "COMPLETE"; } });
  const scope = "workspace:journey-replay";
  const initial = coordinator.getSnapshot(scope);
  const request = createV2Beta1JourneyRequest(initial, {
    suffix: "replay",
    entryMode: "KEYWORD",
    outputTarget: "SSCI",
    researchDirection: "教育回饋可操作性",
    materials: [],
  });
  const first = await coordinator.runJourney(request, scope);
  const replay = await coordinator.runJourney(request, scope);
  assert.equal(replay.replayed, true);
  assert.equal(replay.snapshot.contentHash, first.snapshot.contentHash);
  assert.deepEqual(replay.snapshot.timeline, first.snapshot.timeline);
  assert.deepEqual(replay.snapshot.effectReceipts, first.snapshot.effectReceipts);
  assert.deepEqual(replay.snapshot.journeys, first.snapshot.journeys);
  assert.equal(attempts, 1);
  await assert.rejects(() => coordinator.runJourney({ ...request, researchDirection: "不同內容" }, scope), /beta1_idempotency_conflict/);
  assert.equal(attempts, 1);

  const secondRequest = createV2Beta1JourneyRequest(first.snapshot, {
    suffix: "replay-second",
    entryMode: "KEYWORD",
    outputTarget: "SSCI",
    researchDirection: "教育回饋可操作性的第二個獨立效果",
    materials: [],
  });
  const second = await coordinator.runJourney(secondRequest, scope);
  const downgradeEnvelope = { ok: true, contractVersion: V2_BETA1_CONTRACT_VERSION, trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash: first.generatedArtifactHash, snapshot: first.snapshot, replayed: true, effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
  assert.equal(parseV2Beta1PostResponse(downgradeEnvelope, { trustedScope: scope, previousSnapshot: second.snapshot, submittedRequest: request }), null);

  let unknownAttempts = 0;
  const unknownScope = "workspace:journey-replay-unknown";
  const unknownCoordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { unknownAttempts += 1; throw new Error("fixture_completion_unknown"); } });
  const unknownInitial = unknownCoordinator.getSnapshot(unknownScope);
  const unknownRequest = createV2Beta1JourneyRequest(unknownInitial, { suffix: "unknown-first", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "穩定語義效果在完成狀態不明後不可重送", materials: [] });
  await assert.rejects(unknownCoordinator.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u);
  const afterUnknown = unknownCoordinator.getSnapshot(unknownScope);
  const renewedUnknown = createV2Beta1JourneyRequest(afterUnknown, { suffix: "unknown-new-identity", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "穩定語義效果在完成狀態不明後不可重送", materials: [] });
  await assert.rejects(unknownCoordinator.runJourney(renewedUnknown, unknownScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(unknownAttempts, 1);

  const unknownReceipt = afterUnknown.effectReceipts[0];
  const duplicateComplete = createV2Beta1HistoryEntry({
    intent: { scope: unknownScope, projectId: afterUnknown.projectId, operation: V2_BETA1_JOURNEY_OPERATION, requestId: renewedUnknown.requestId, idempotencyKey: renewedUnknown.idempotencyKey, requestHash: beta1Hash(renewedUnknown), payloadHash: unknownReceipt.payloadHash, generatedArtifactHash: unknownReceipt.generatedArtifactHash, observationAuthorityHash: unknownReceipt.observationAuthorityHash, baseRevision: 2, baseContentHash: afterUnknown.contentHash },
    completionClass: "COMPLETE",
    sequence: 2,
    predecessorCommitment: unknownReceipt.entryCommitment,
  });
  assert.throws(() => validateV2Beta1FullHistory({ projectId: afterUnknown.projectId, revision: 3, timeline: [afterUnknown.timeline[0], duplicateComplete.event], effectReceipts: [unknownReceipt, duplicateComplete.receipt], trustedScope: unknownScope }), /beta1_history_unknown_no_resend/u);
});

await group("full_history_scope_and_idempotency_authority", async () => {
  const coordinator = createV2Beta1Coordinator();
  const scope = "workspace:journey-full-history";
  const initial = coordinator.getSnapshot(scope);
  const request = createV2Beta1JourneyRequest(initial, {
    suffix: "full-history",
    entryMode: "KEYWORD",
    outputTarget: "SSCI",
    researchDirection: "全歷史範圍與冪等權威",
    materials: [],
  });
  const first = await coordinator.runJourney(request, scope);
  const valid = validateV2Beta1FullHistory({ projectId: first.snapshot.projectId, revision: first.snapshot.revision, timeline: first.snapshot.timeline, effectReceipts: first.snapshot.effectReceipts, journeys: first.snapshot.journeys, trustedScope: scope });
  assert.deepEqual({ scope: valid.scope, trustClass: valid.trustClass }, { scope, trustClass: "TRUSTED_SCOPE_FULL_HISTORY" });

  const firstReceipt = first.snapshot.effectReceipts[0];
  const firstEvent = first.snapshot.timeline[0];
  const nextIntent = {
    scope,
    projectId: first.snapshot.projectId,
    operation: firstReceipt.operation,
    requestId: "request-full-history-0002",
    idempotencyKey: firstReceipt.idempotencyKey,
    requestHash: firstReceipt.requestHash,
    payloadHash: firstReceipt.payloadHash,
    generatedArtifactHash: firstReceipt.generatedArtifactHash,
    baseRevision: 2,
    baseContentHash: first.snapshot.contentHash,
  };
  const duplicate = createV2Beta1HistoryEntry({ intent: nextIntent, completionClass: "COMPLETE", sequence: 2, predecessorCommitment: firstReceipt.entryCommitment });
  assert.throws(() => validateV2Beta1FullHistory({ projectId: first.snapshot.projectId, revision: 3, timeline: [firstEvent, duplicate.event], effectReceipts: [firstReceipt, duplicate.receipt], trustedScope: scope }), /beta1_history_idempotency_duplicate/);

  const conflict = createV2Beta1HistoryEntry({ intent: { ...nextIntent, requestId: "request-full-history-0003", requestHash: beta1Hash({ request, conflict: true }) }, completionClass: "COMPLETE", sequence: 2, predecessorCommitment: firstReceipt.entryCommitment });
  assert.throws(() => validateV2Beta1FullHistory({ projectId: first.snapshot.projectId, revision: 3, timeline: [firstEvent, conflict.event], effectReceipts: [firstReceipt, conflict.receipt], trustedScope: scope }), /beta1_history_idempotency_conflict/);

  const mixedScope = createV2Beta1HistoryEntry({ intent: { ...nextIntent, scope: "workspace:journey-other-scope", requestId: "request-full-history-0004", idempotencyKey: "journey:full-history:other", requestHash: beta1Hash({ request, mixedScope: true }) }, completionClass: "COMPLETE", sequence: 2, predecessorCommitment: firstReceipt.entryCommitment });
  assert.throws(() => validateV2Beta1FullHistory({ projectId: first.snapshot.projectId, revision: 3, timeline: [firstEvent, mixedScope.event], effectReceipts: [firstReceipt, mixedScope.receipt], trustedScope: scope }), /beta1_history_scope_authority_invalid/);
});

await group("http_journey_exact_200_and_replay_zero_effect", async () => {
  let attempts = 0;
  const coordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "COMPLETE"; } });
  const handlers = createV2Beta1RouteHandlers({ coordinator, previewInsight: () => { throw new Error("unused"); } });
  const scope = "fixture-workspace-v2:fixture-user-v2";
  const snapshot = coordinator.getSnapshot(scope);
  const body = createV2Beta1JourneyRequest(snapshot, { suffix: "http-journey", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "智慧回饋的證據校準", materials: [] });
  const request = () => new Request("http://localhost/api/v2-beta1/project", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", "x-old-mike-v2-workspace": "fixture-workspace-v2" }, body: JSON.stringify(body) });
  const first = await handlers.POST(request());
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.effectSubmissionCount, 1);
  assert.equal(firstBody.liveProviderCallCount, 0);
  assert.equal(firstBody.snapshot.journey.kind, "JOURNAL");
  const replay = await handlers.POST(request());
  const replayBody = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(replayBody.replayed, true);
  assert.equal(replayBody.effectSubmissionCount, 0);
  assert.equal(attempts, 1);
});

console.log(JSON.stringify({ status: "PASS", groups: groups.length, groupNames: groups }));
