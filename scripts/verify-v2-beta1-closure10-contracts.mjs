import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
  OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
  BETTER_AUTH_URL: "http://beta1.local",
});

const [contracts, runtime, integrity, anchors, evidence, client, assist, scopeAuthority] = await Promise.all([
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/research-integrity.ts"),
  import("../lib/v2-beta1/evidence-anchors.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
  import("../lib/v2-beta1/shared-authority.ts"),
  import("../lib/v2-beta1/scope-authority.ts"),
]);

const groups = []; const failures = [];
async function check(name, callback) { try { await callback(); groups.push(name); } catch (error) { failures.push({ name, code: error instanceof Error ? error.message : "closure10_contract_failure" }); } }

const scope = scopeAuthority.V2_BETA1_LOCAL_TRUSTED_SCOPE;
const emptyCatalog = integrity.createV2Beta1CitationCatalog([]);
const citationMaterials = [{ kind: "CITATION", title: "Reference 2", content: "[2] Wang et al. (2024). Evidence calibration in learning contexts. doi:10.1000/example" }];
const citationCatalog = integrity.createV2Beta1CitationCatalog(citationMaterials);
const structured = (effect = "β = −0.31", qualifier = "結果並不支持無條件因果主張", citation = "Wang et al. (2024)") => `metricId=engagement cohortId=A timepoint=post analysisId=main；${effect}，N=180，p≤.05，95% CI [−0.52, −0.10]，${qualifier}${citation ? `，${citation}` : ""}。`;
const validRevision = (source = structured()) => {
  const record = anchors.extractV2Beta1StructuredEvidenceRecords(source).records[0];
  const effects = record.effects.map((effect) => `${effect.raw}${effect.scopeSpans.length ? `，${effect.scopeSpans.join("，")}` : ""}`).join("；");
  const details = [...record.sampleSizeSpans, ...record.probabilitySpans, ...record.confidenceIntervalSpans, ...record.citationSpans].join("、");
  return `在 ${record.observationKeySpans.join("、")} 所界定的同一觀察中，${effects}；${details}共同支持有限且可追溯的學術命題，推論仍受替代解釋與既定證據界線約束。`;
};
const graphInput = (sourceText, revisionText, findingId = "finding:closure10:integrity", catalog = citationCatalog, ownDataBinding = false) => ({ findingId, sourceText, revisionText, citationCatalog: catalog, ownDataBinding });
const rehashGraph = (graph) => { const { graphHash: _old, ...core } = graph; return { ...core, graphHash: contracts.beta1Hash(core) }; };

await check("G1_CLOSURE9_ELEVEN_REPROS_REJECT", async () => {
  const planned = ["Pending remains the statistical analysis.", "Awaiting completion is the analysis."];
  for (const value of planned) assert.equal(evidence.hasV2Beta1PlannedResultMarker(value), true, value);
  for (const value of ["研究於2024年完成。", "Model (2024)", "Table（2024）", "Wave (2024)", "研究期別（2024）", "CI [2,8]", "[2]"]) {
    assert.deepEqual(integrity.createV2Beta1CitationCatalog([{ kind: "CITATION", title: "citation", content: value }]).directIdentities, [], value);
  }
  const source = structured(); const valid = validRevision(source);
  for (const value of [`${valid} This result certainly causes universal benefit.`, `${valid} 所有族群都必然受益。`, `${source.slice(0, -1)}；上述資訊僅供參考並維持學術判斷。`]) assert.equal(anchors.validateV2Beta1RevisionEvidenceClauses(source, value), false, value);
});

await check("G2_TYPED_GRAPH_RESULT_STATE_ENUM", async () => {
  const planned = integrity.createV2Beta1ResearchIntegrityGraph(graphInput("結果分析仍待完成。", "結果分析仍待完成，故目前只可保留分析規劃。", "finding:state:planned", emptyCatalog));
  const observedSource = structured("β = −0.31", "結果顯示有限關聯", "");
  const observed = integrity.createV2Beta1ResearchIntegrityGraph(graphInput(observedSource, validRevision(observedSource), "finding:state:observed", emptyCatalog, true));
  const unresolved = integrity.createV2Beta1ResearchIntegrityGraph(graphInput("結果證明所有族群必然受益。", "此結果證明所有族群必然受益。", "finding:state:unresolved", emptyCatalog));
  const missing = integrity.createV2Beta1ResearchIntegrityGraph(graphInput("N=?", "樣本數仍缺少可核對值。", "finding:state:missing", emptyCatalog));
  const conflictSource = `${structured("β = −0.31", "結果顯示下降", "")}${structured("β = 0.45", "結果顯示上升", "")}`;
  const conflict = integrity.createV2Beta1ResearchIntegrityGraph(graphInput(conflictSource, `${validRevision(structured("β = −0.31", "結果顯示下降", ""))} ${validRevision(structured("β = 0.45", "結果顯示上升", ""))}`, "finding:state:conflict", emptyCatalog, true));
  assert.deepEqual([conflict.resultState, unresolved.resultState, planned.resultState, missing.resultState, observed.resultState], ["CONFLICT", "UNRESOLVED", "PLANNED", "MISSING", "OBSERVED"]);
  for (const graph of [planned, observed, unresolved, missing, conflict]) {
    assert.equal(graph.schemaId, integrity.V2_BETA1_RESEARCH_INTEGRITY_SCHEMA);
    assert.equal(graph.source.segments.every((segment, index) => segment.startByte === (index ? graph.source.segments[index - 1].endByte : 0)), true);
    assert.equal(graph.source.segments.at(-1).endByte, graph.source.byteLength);
    assert.equal(graph.source.segments.filter((item) => item.kind === "CLAIM").length, graph.source.claims.length);
  }
  assert.equal(observed.publicationUsable, true); assert.equal(planned.publicationUsable, false); assert.equal(unresolved.publicationUsable, false); assert.equal(conflict.publicationUsable, false);
});

await check("G3_ANCHORLESS_CAUSAL_UNIVERSAL_AND_TOKEN_DUMP_REJECT", async () => {
  const source = structured(); const valid = validRevision(source);
  assert.equal(integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, valid)).semanticEquivalent, true);
  for (const invalid of [`${valid} This intervention causes benefit in every setting.`, `${valid} 因此可普遍推論所有對象均受益。`, anchors.extractV2Beta1EvidenceAnchors(source).join("；")]) {
    const graph = integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, invalid));
    assert.equal(graph.publicationUsable, false, invalid);
  }
});

await check("G4_EFFECT_QUALIFIER_POLARITY_CERTAINTY_SWAP_REJECT", async () => {
  const source = "metricId=engagement cohortId=A timepoint=post analysisId=main；β = −0.31，結果並不支持無條件因果主張；OR = 1.40，結果可能支持有限關聯；N=180，p≤.05，Wang et al. (2024)。";
  const valid = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 的觀察中，β = −0.31 所對應的結果並不支持無條件因果主張，而 OR = 1.40 所對應的結果可能支持有限關聯；N=180、p≤.05 與 Wang et al. (2024) 共同界定此審慎命題。";
  const swapped = "在 metricId=engagement cohortId=A timepoint=post analysisId=main 的觀察中，β = −0.31 所對應的結果可能支持有限關聯，而 OR = 1.40 所對應的結果並不支持無條件因果主張；N=180、p≤.05 與 Wang et al. (2024) 共同界定此審慎命題。";
  assert.equal(integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, valid)).semanticEquivalent, true);
  assert.equal(integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, swapped)).semanticEquivalent, false);
});

await check("G5_SOURCE_REVISION_BIJECTION_AND_CROSS_FINDING", async () => {
  const source = structured(); const valid = validRevision(source);
  const extra = `${valid} ${structured("OR = 1.80", "結果顯示額外效果")}`;
  for (const invalid of ["本段只保留一般說明。", `${valid} ${valid}`, extra]) assert.equal(integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, invalid)).semanticEquivalent, false);
  const graph = integrity.createV2Beta1ResearchIntegrityGraph(graphInput(source, valid, "finding:closure10:A"));
  assert.equal(integrity.validateV2Beta1ResearchIntegrityGraph(graph, graphInput(source, valid, "finding:closure10:A")), true);
  assert.equal(integrity.validateV2Beta1ResearchIntegrityGraph(graph, graphInput(source, valid, "finding:closure10:B")), false);
});

await check("G6_TYPED_CITATION_CATALOG", async () => {
  assert.equal(citationCatalog.directIdentities.some((item) => item.includes("10.1000/example")), true);
  const arxiv = integrity.createV2Beta1CitationCatalog([{ kind: "CITATION", title: "Reference", content: "arXiv:2401.01234 A bounded scholarly title" }]);
  assert.equal(arxiv.directIdentities.some((item) => item.includes("arxiv:2401.01234")), true);
  const complete = integrity.createV2Beta1CitationCatalog([{ kind: "CITATION", title: "Reference", content: "Wang et al. (2024). Evidence calibration in education." }]);
  assert.equal(complete.directIdentities.some((item) => item.includes("wang et al. (2024)")), true);
  for (const falseAuthority of ["研究於2024年完成", "95% CI [2,8]", "Wave (2024)", "[2]"]) assert.equal(integrity.createV2Beta1CitationCatalog([{ kind: "CITATION", title: "Reference", content: falseAuthority }]).directIdentities.length, 0, falseAuthority);
});

await check("G7_OWN_DATA_VALID_LITERATURE_GENERALIZATION_UNBOUND_REJECT", async () => {
  const ownSource = structured("β = −0.31", "結果顯示有限關聯", ""); const ownRevision = validRevision(ownSource);
  assert.equal(integrity.createV2Beta1ResearchIntegrityGraph(graphInput(ownSource, ownRevision, "finding:own-data", emptyCatalog, true)).citationValid, true);
  const literatureSource = structured("β = −0.31", "既有研究顯示普遍受益", "");
  const literature = integrity.createV2Beta1ResearchIntegrityGraph(graphInput(literatureSource, validRevision(literatureSource), "finding:literature", emptyCatalog, false));
  assert.equal(literature.citationValid, false); assert.equal(literature.publicationUsable, false);
});

await check("G8_UTF8_FULLWIDTH_EMOJI_SPAN_AUTHORITY", async () => {
  const source = `研究場域😀。ｍｅｔｒｉｃＩｄ＝engagement ｃｏｈｏｒｔＩｄ＝A ｔｉｍｅｐｏｉｎｔ＝post ａｎａｌｙｓｉｓＩｄ＝main；β＝−０．３１，Ｎ＝１８０，ｐ≤．０５，９５％ CI［−０．５２，−０．１０］，結果並不支持無條件因果主張，doi:10.1000/example。`;
  const revision = `在研究場域😀中，ｍｅｔｒｉｃＩｄ＝engagement ｃｏｈｏｒｔＩｄ＝A ｔｉｍｅｐｏｉｎｔ＝post ａｎａｌｙｓｉｓＩｄ＝main；β＝−０．３１、Ｎ＝１８０、ｐ≤．０５、９５％ CI［−０．５２，−０．１０］與 doi:10.1000/example 共同顯示結果並不支持無條件因果主張，故推論維持有限且可反駁。`;
  const input = graphInput(source, revision, "finding:utf8", citationCatalog);
  const graph = integrity.createV2Beta1ResearchIntegrityGraph(input);
  assert.equal(graph.source.byteLength, new TextEncoder().encode(source).length);
  assert.equal(graph.source.segments.at(-1).endByte, graph.source.byteLength);
  assert.equal(graph.source.claims.flatMap((claim) => claim.rawSpans).some((span) => span.role === "N" && span.endByte > span.startByte), true);
  const tampered = structuredClone(graph); tampered.source.segments[0].endByte += 1; tampered.graphHash = rehashGraph(tampered).graphHash;
  assert.equal(integrity.validateV2Beta1ResearchIntegrityGraph(tampered, input), false);
});

await check("G9_EXACT_NESTED_SERVER_CLIENT_PARITY", async () => {
  const coordinator = runtime.createV2Beta1Coordinator(); const currentScope = `${scope}:closure10-parity`; const initial = coordinator.getSnapshot(currentScope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure10-parity", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "型別化主張圖與可信執行憑證", materials: [] });
  const outcome = await coordinator.runJourney(request, currentScope); const previewInsight = runtime.createSyntheticBeta1Insight("Closure 10 parity");
  const payload = { ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: outcome.snapshot, previewInsight, effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0, extensions: { declared: true } };
  assert.notEqual(client.parseV2Beta1GetResponse(payload), null); assert.doesNotThrow(() => contracts.validateProjectTruthSnapshot(outcome.snapshot));
  const actualGraph = outcome.snapshot.journey.journal.priorityFindings[0].revisions[0].researchIntegrity;
  const tamperCases = [
    (graph) => { graph.unrelatedNested = true; },
    (graph) => { delete graph.source.byteLength; },
    (graph) => { graph.source.byteLength = "10"; },
    (graph) => { graph.source.segments[0].endByte += 1; },
    (graph) => { graph.source.textHash = "0".repeat(64); },
  ];
  const finding = outcome.snapshot.journey.journal.priorityFindings[0]; const graphContext = graphInput(finding.sourceText, finding.revisions[0].text, finding.findingId, actualGraph.citationCatalog, actualGraph.ownDataBinding);
  for (const mutate of tamperCases) { const changed = structuredClone(actualGraph); mutate(changed); changed.graphHash = rehashGraph(changed).graphHash; assert.equal(integrity.validateV2Beta1ResearchIntegrityGraph(changed, graphContext), false); }
  const nested = structuredClone(outcome.snapshot); nested.journey.journal.priorityFindings[0].revisions[0].researchIntegrity.unrelatedNested = true; nested.journeys[0].journal.priorityFindings[0].revisions[0].researchIntegrity.unrelatedNested = true;
  assert.equal(client.parseV2Beta1GetResponse({ ...payload, snapshot: nested }), null); assert.throws(() => contracts.validateProjectTruthSnapshot(nested), /beta1_/u);
});

await check("G10_CONTRACT_1_7_AND_OLDER_FAIL_CLOSED", async () => {
  assert.equal(contracts.V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.7.0"); assert.equal(client.V2_BETA1_CLIENT_CONTRACT_VERSION, contracts.V2_BETA1_CONTRACT_VERSION);
  const initial = runtime.createV2Beta1Coordinator().getSnapshot(`${scope}:closure10-version`);
  for (const staleVersion of ["old-mike-v2-beta1/1.6.0", "old-mike-v2-beta1/1.5.0", "old-mike-v2-beta1/1.4.0", "old-mike-v2-beta1/1.3.0", "old-mike-v2-beta1/1.2.0", "old-mike-v2-beta1/1.1.0"]) { const { contentHash: _old, ...core } = { ...initial, contractVersion: staleVersion }; assert.throws(() => contracts.validateProjectTruthSnapshot({ ...core, contentHash: contracts.beta1Hash(core) }), /beta1_snapshot_invalid/u); }
});

await check("G11_HISTORY_UNKNOWN_CONCURRENCY_ASSIST117_REGRESSION", async () => {
  const coordinator = runtime.createV2Beta1Coordinator(); const currentScope = `${scope}:closure10-regression`; const initial = coordinator.getSnapshot(currentScope);
  const request = runtime.createV2Beta1JourneyRequest(initial, { suffix: "closure10-regression", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "型別化研究完整性與可追溯推論", materials: [] });
  const completed = await coordinator.runJourney(request, currentScope); const receipt = completed.snapshot.effectReceipts[0]; assert.equal(receipt.generatedArtifactHash, completed.snapshot.journey.artifactHash); assert.equal(receipt.payloadHash, completed.snapshot.journey.inputBundleHash);
  const options = completed.snapshot.journey.directions.flatMap((direction) => Object.values(direction.fieldAssist).flat()); assert.equal(options.length, 117); for (const option of options) assert.equal(assist.validateV2Beta1AssistOptionContent(option), true);
  let attempts = 0; const unknown = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "UNKNOWN"; } }); const unknownScope = `${scope}:closure10-unknown`; const unknownRequest = runtime.createV2Beta1JourneyRequest(unknown.getSnapshot(unknownScope), { suffix: "closure10-unknown", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "未知完成不得重送", materials: [] });
  await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u); await assert.rejects(unknown.runJourney(unknownRequest, unknownScope), /beta1_completion_unknown_no_resend/u); assert.equal(attempts, 1);
  let concurrentAttempts = 0; let release; const gate = new Promise((resolve) => { release = resolve; }); const concurrent = runtime.createV2Beta1Coordinator({ beforeJourneyCommit: async () => { concurrentAttempts += 1; await gate; return "COMPLETE"; } }); const concurrentScope = `${scope}:closure10-concurrency`; const base = concurrent.getSnapshot(concurrentScope); const a = runtime.createV2Beta1JourneyRequest(base, { suffix: "closure10-concurrent-a", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "並行主線 A", materials: [] }); const b = runtime.createV2Beta1JourneyRequest(base, { suffix: "closure10-concurrent-b", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "並行主線 B", materials: [] }); const first = concurrent.runJourney(a, concurrentScope); const second = concurrent.runJourney(b, concurrentScope); release(); const settled = await Promise.allSettled([first, second]); assert.equal(concurrentAttempts, 1); assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
});

assert.deepEqual(failures, [], JSON.stringify(failures));
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, assertionsClass: "DERIVED_BY_EXECUTION", externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
