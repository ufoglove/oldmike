import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
});

const [contracts, runtime, history, evidence, clauses, assist, client, adapters] = await Promise.all([
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/history-authority.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/evidence-anchors.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/journey-adapters.ts"),
]);

const failures = [];
const groups = [];
async function check(name, callback) {
  try { await callback(); groups.push(name); }
  catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure6_contract_failure" }); }
}

const scope = "fixture-workspace-v2:fixture-user-v2";
const postEnvelope = (snapshot, replayed = false) => ({
  ok: true,
  contractVersion: contracts.V2_BETA1_CONTRACT_VERSION,
  trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY",
  generatedArtifactHash: snapshot.effectReceipts.at(-1)?.generatedArtifactHash ?? null,
  snapshot,
  replayed,
  effectSubmissionCount: replayed ? 0 : 1,
  liveProviderCallCount: 0,
  formalResearchWriteCount: 0,
  onlineDatabaseWriteCount: 0,
  externalMutationCount: 0,
});

function assistParent(direction, journey) {
  return {
    direction: {
      lane: direction.lane,
      directionHash: direction.directionHash,
      inputBundleHash: direction.inputBundleHash,
      title: direction.title,
      researchQuestion: direction.researchQuestion,
      mechanism: direction.mechanism,
      contribution: direction.contribution,
      method: direction.method,
      s0: direction.s0,
    },
    domain: { label: journey.researchDomain.label, selectionHash: journey.researchDomain.selectionHash },
    outputTarget: journey.outputTarget,
  };
}

await check("CONTRACT_1_3_AND_OLDER_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.3.0");
  assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:closure6-version`);
  for (const staleVersion of ["old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) {
    const { contentHash: _oldHash, ...core } = { ...initial, contractVersion: staleVersion };
    assert.throws(() => contracts.validateProjectTruthSnapshot({ ...core, contentHash: contracts.beta1Hash(core) }), /beta1_snapshot_invalid/u);
  }
});

await check("TRUSTED_SCOPE_ACTUAL_POST_AND_GENERATED_ARTIFACT", async () => {
  const importCoordinator = runtime.createV2Beta1Coordinator();
  const initial = importCoordinator.getSnapshot(scope);
  const request = runtime.createV2Beta1ImportRequest(initial, runtime.createSyntheticBeta1Insight("Closure 6 實際 POST trusted scope"), "closure6-scope");
  const completed = await importCoordinator.importInsight(request, scope);
  assert.ok(client.parseV2Beta1PostResponse(postEnvelope(completed.snapshot), { trustedScope: scope, previousSnapshot: initial, submittedRequest: request }));
  assert.equal(client.parseV2Beta1PostResponse(postEnvelope(completed.snapshot), { trustedScope: `${scope}:swapped`, previousSnapshot: initial, submittedRequest: request }), null);
  assert.equal(client.parseV2Beta1PostResponse(postEnvelope(completed.snapshot), { previousSnapshot: initial, submittedRequest: request }), null);

  const journeyCoordinator = runtime.createV2Beta1Coordinator();
  const journeyInitial = journeyCoordinator.getSnapshot(`${scope}:artifact`);
  const journeyRequest = runtime.createV2Beta1JourneyRequest(journeyInitial, { suffix: "closure6-artifact", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準如何影響高等教育學習者任務表現", materials: [] });
  const generated = adapters.runV2Beta1ThinAdapters(journeyRequest, journeyRequest.researchDomain);
  const journeyResult = await journeyCoordinator.runJourney(journeyRequest, `${scope}:artifact`);
  assert.equal(history.validateV2Beta1AuthoritativeTransition({ trustedScope: `${scope}:artifact`, previousSnapshot: journeyInitial, submittedRequest: journeyRequest, nextSnapshot: journeyResult.snapshot, completionClass: "COMPLETE", selectedDirectionHash: generated.artifact.selectedDirectionHash, generatedArtifactHash: generated.artifact.artifactHash }).status, "PASS");
  assert.throws(() => history.validateV2Beta1AuthoritativeTransition({ trustedScope: `${scope}:artifact`, previousSnapshot: journeyInitial, submittedRequest: journeyRequest, nextSnapshot: journeyResult.snapshot, completionClass: "COMPLETE", selectedDirectionHash: generated.artifact.selectedDirectionHash, generatedArtifactHash: "0".repeat(64) }), /beta1_transition_generated_artifact_invalid/u);

  const coordinatedTamper = structuredClone(journeyResult.snapshot);
  const tamperedOption = coordinatedTamper.journey.directions[0].fieldAssist.methodIdea[0];
  tamperedOption.text = `${tamperedOption.text}（未授權改寫）`;
  const { optionHash: _optionHash, ...optionCore } = tamperedOption;
  tamperedOption.optionHash = contracts.beta1Hash(optionCore);
  const { artifactHash: _artifactHash, ...artifactCore } = coordinatedTamper.journey;
  coordinatedTamper.journey.artifactHash = contracts.beta1Hash(artifactCore);
  coordinatedTamper.journeys.at(-1).directions[0].fieldAssist.methodIdea[0] = structuredClone(tamperedOption);
  const { artifactHash: _listedArtifactHash, ...listedArtifactCore } = coordinatedTamper.journeys.at(-1);
  coordinatedTamper.journeys.at(-1).artifactHash = contracts.beta1Hash(listedArtifactCore);
  const { contentHash: _snapshotHash, ...snapshotCore } = coordinatedTamper;
  coordinatedTamper.contentHash = contracts.beta1Hash(snapshotCore);
  assert.throws(() => history.validateV2Beta1AuthoritativeTransition({ trustedScope: `${scope}:artifact`, previousSnapshot: journeyInitial, submittedRequest: journeyRequest, nextSnapshot: coordinatedTamper, completionClass: "COMPLETE", selectedDirectionHash: generated.artifact.selectedDirectionHash, generatedArtifactHash: generated.artifact.artifactHash }), /beta1_transition_generated_artifact_invalid/u);
  assert.equal(client.parseV2Beta1PostResponse(postEnvelope(coordinatedTamper), { trustedScope: `${scope}:artifact`, previousSnapshot: journeyInitial, submittedRequest: journeyRequest }), null);
});

await check("BOUNDED_PLANNED_PHRASE_GRAMMAR", async () => {
  for (const value of ["Results are to be analyzed.", "Data collection is ongoing.", "Analysis is in progress.", "Findings are forthcoming.", "Results are awaiting verification.", "資料待分析。", "資料蒐集中。", "正在蒐集資料。", "資料尚在蒐集。"]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), true, value);
  for (const value of ["將領壓力為 82%，N=180，[1]。", "Future orientation was observed at 82%, N=180 [1]."]) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), false, value);
});

await check("STRUCTURED_EVIDENCE_CLAUSE_AND_RAW_SPANS", async () => {
  const source = "metricId=engagement cohortId=A timepoint=post analysisId=main。結果並不支持無條件外推；β = −0.31，Ｎ=180，ｐ≤.05，95% CI [−0.52, −0.10]，doi.org/10.1000/example，[2]，Wang et al. (2024)，王等（2024）。";
  const structured = clauses.extractV2Beta1EvidenceClauses(source);
  for (const raw of ["β = −0.31", "Ｎ=180", "ｐ≤.05", "95% CI [−0.52, −0.10]", "10.1000/example", "[2]", "Wang et al. (2024)", "王等（2024）", "並不支持無條件外推"]) assert.equal(structured.rawAnchors.includes(raw), true, raw);
  const valid = "metricId=engagement cohortId=A timepoint=post analysisId=main。結果並不支持無條件外推；β = −0.31，Ｎ=180，ｐ≤.05，95% CI [−0.52, −0.10]，doi.org/10.1000/example，[2]，Wang et al. (2024) 與王等（2024）共同界定目前證據，因而不能擴張為無條件因果主張。";
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, valid), true);
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, valid.replace("β = −0.31", "OR = −0.31")), false);
  assert.equal(clauses.validateV2Beta1RevisionEvidenceClauses(source, valid.replace("結果並不支持無條件外推；", "結果呈現關聯；").replace("共同界定目前證據", "共同界定目前證據；另一段不支持無條件外推")), false);
});

await check("EXACT_ASSIST_FACTORY_SERVER_CLIENT_PARITY", async () => {
  const coordinator = runtime.createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:assist`);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure6-assist", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "證據校準如何影響高等教育學習者任務表現", materials: [] });
  const outcome = await coordinator.runJourney(request, `${scope}:assist`);
  const journey = outcome.snapshot.journey;
  const options = journey.directions.flatMap((direction) => Object.values(direction.fieldAssist).flat());
  assert.equal(options.length, 117);
  assert.equal(options.filter((option) => option.field !== "domain" && option.field !== "outputTrack").length, 99);
  assert.equal(options.filter((option) => option.field === "domain" || option.field === "outputTrack").length, 18);
  for (const direction of journey.directions) {
    const parent = assistParent(direction, journey);
    for (const field of contracts.S0_FIELD_NAMES) assert.deepEqual(direction.fieldAssist[field], assist.createV2Beta1AssistOptions(parent, field));
  }
  assert.ok(client.parseV2Beta1PostResponse(postEnvelope(outcome.snapshot), { trustedScope: `${scope}:assist`, previousSnapshot: initial, submittedRequest: request }));

  for (const mutate of [
    (option) => { option.applyValue = "請研究者補充一個適切的方法。"; option.text = option.applyValue; },
    (option, artifact) => { option.applyValue = artifact.directions[0].s0.problemContext; option.text = option.applyValue; },
    (option) => { option.rationale = "這是一般建議，請自行判斷。"; option.risk = "一般風險，請自行判斷。"; },
    (option, artifact) => { const donor = artifact.directions[0].fieldAssist.methodIdea[0]; Object.assign(option, { text: donor.text, applyValue: donor.applyValue, rationale: donor.rationale, risk: donor.risk }); },
  ]) {
    const tampered = structuredClone(journey);
    const target = tampered.directions[1].fieldAssist.methodIdea[1];
    mutate(target, tampered);
    const { optionHash: _old, ...core } = target;
    target.optionHash = contracts.beta1Hash(core);
    assert.throws(() => contracts.parseV2Beta1JourneyArtifact(tampered), /beta1_assist/u);
  }
});

await check("NO_RESEND_REPLAY_CONCURRENCY_REGRESSION", async () => {
  let attempts = 0;
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => { attempts += 1; return "UNKNOWN"; } });
  const localScope = `${scope}:unknown`;
  const initial = coordinator.getSnapshot(localScope);
  const insight = runtime.createSyntheticBeta1Insight("Closure 6 UNKNOWN 不得重送");
  const request = runtime.createV2Beta1ImportRequest(initial, insight, "closure6-unknown");
  await assert.rejects(coordinator.importInsight(request, localScope), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(coordinator.importInsight(request, localScope), /beta1_completion_unknown_no_resend/u);
  assert.equal(attempts, 1);
  assert.equal(coordinator.getSnapshot(localScope).effectReceipts.length, 1);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
assert.equal(groups.length, 6);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
