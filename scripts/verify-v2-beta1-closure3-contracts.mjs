import assert from "node:assert/strict";

Object.assign(process.env, { NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1", OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1" });

const [{ createBuiltinDomainSelection }, contracts, runtime, evidence, history, client] = await Promise.all([
  import("../lib/v2-alpha3/contracts.ts"),
  import("../lib/v2-beta1/contracts.ts"),
  import("../lib/v2-beta1/runtime.ts"),
  import("../lib/v2-beta1/evidence-classifier.ts"),
  import("../lib/v2-beta1/history-authority.ts"),
  import("../lib/v2-beta1/client-contract.ts"),
]);

const scope = "fixture-workspace-v2:fixture-user-v2";
const domain = createBuiltinDomainSelection("ai-education");
const groups = [];
const gate = async (name, callback) => { await callback(); groups.push(name); };
const raw = (kind, content, id = kind.toLowerCase()) => ({ materialId: `material-${id}`, kind, title: kind, content, contentHash: contracts.beta1Hash(content), evidenceState: "OBSERVED" });
const requestMaterial = ({ materialId, kind, title, content }) => ({ materialId, kind, title, content });

function completeMaterials(resultMaterials) {
  return [
    raw("ABSTRACT", "本研究檢驗生成式回饋、證據校準與任務表現，結論受來源界線限制。"),
    raw("INTRODUCTION", "既有研究尚未釐清回饋可操作性、校準歷程與任務表現的機制鏈。", "introduction"),
    raw("METHODS", "採準實驗混合方法，事前界定樣本、量測、分析與替代解釋。"),
    ...resultMaterials,
    raw("NOTE", "討論僅解釋已觀察結果，並保留樣本、場域及量測限制。", "discussion"),
    { ...raw("NOTE", "結論不超越現有觀察；[1] 的存在性與脈絡仍須獨立核對。", "conclusion"), title: "Conclusion" },
    raw("CITATION", "引用 [1] 僅作本機可追溯契約；正式存在性與脈絡仍須獨立稽核。", "citation"),
  ].map((item) => item.materialId === "material-note" ? { ...item, title: "Discussion" } : item);
}

function journeyRequest(snapshot, suffix, materials, target = "SSCI") {
  return runtime.createV2Beta1JourneyRequest(snapshot, { suffix, entryMode: materials.length ? "PARTIAL_MATERIAL" : "KEYWORD", outputTarget: target, researchDirection: "生成式回饋證據校準與學習任務表現", researchDomain: domain, materials: materials.map(requestMaterial) });
}

function envelope(snapshot) {
  return { ok: true, contractVersion: contracts.V2_BETA1_CONTRACT_VERSION, snapshot, previewInsight: runtime.createSyntheticBeta1Insight(), effectSubmissionCount: 0, liveProviderCallCount: 0, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0 };
}

await gate("SHARED_HISTORY_AUTHORITY_AND_LINEAGE", async () => {
  const coordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async () => "UNKNOWN" });
  const initial = coordinator.getSnapshot(`${scope}:history`);
  const insight = runtime.createSyntheticBeta1Insight("第一條待核對洞見");
  const request = runtime.createV2Beta1ImportRequest(initial, insight, "closure3-history");
  await assert.rejects(coordinator.importInsight(request, `${scope}:history`), /beta1_completion_unknown_no_resend/u);
  const unknown = coordinator.getSnapshot(`${scope}:history`);
  assert.ok(client.parseV2Beta1GetResponse(envelope(unknown)));
  const receipt = unknown.effectReceipts[0]; const event = unknown.timeline[0];
  assert.equal(receipt.effectId, event.receiptId); assert.equal(receipt.entryCommitment, event.entryCommitment); assert.equal(receipt.sequence, 1);
  assert.equal(receipt.operation, "IMPORT_CHAT_INSIGHT"); assert.equal(event.eventType, "CHAT_INSIGHT_COMPLETION_UNKNOWN");
  assert.match(receipt.scopeHash, /^[0-9a-f]{64}$/u); assert.match(receipt.lineageHash, /^[0-9a-f]{64}$/u); assert.match(receipt.effectLineageHash, /^[0-9a-f]{64}$/u);
  const exactIntent = history.createV2Beta1HistoryIntent({ scope: `${scope}:pure`, request });
  const exactPair = history.createV2Beta1HistoryEntry({ intent: exactIntent, completionClass: "UNKNOWN", sequence: 1 });
  assert.deepEqual(exactPair, history.createV2Beta1HistoryEntry({ intent: exactIntent, completionClass: "UNKNOWN", sequence: 1 }));
  for (const mutate of [
    (draft) => { draft.effectReceipts[0].requestId += "-tampered"; },
    (draft) => { draft.effectReceipts[0].baseRevision = 7; },
    (draft) => { draft.timeline[0].sequence = 2; },
    (draft) => { draft.timeline[0].eventType = "CHAT_INSIGHT_IMPORTED"; },
    (draft) => { draft.effectReceipts[0].predecessorCommitment = "0".repeat(64); },
  ]) { const changed = structuredClone(unknown); mutate(changed); const { contentHash: _old, ...core } = changed; changed.contentHash = contracts.snapshotContentHash(core); assert.throws(() => contracts.validateProjectTruthSnapshot(changed)); assert.equal(client.parseV2Beta1GetResponse(envelope(changed)), null); }
  await assert.rejects(coordinator.importInsight(request, `${scope}:history`), /beta1_completion_unknown_no_resend/u);
  await assert.rejects(coordinator.importInsight(runtime.createV2Beta1ImportRequest(unknown, insight, "closure3-history-new-key"), `${scope}:history`), /beta1_completion_unknown_no_resend/u);
  const unrelatedCoordinator = runtime.createV2Beta1Coordinator({ beforeCommit: async ({ request: next }) => next.insight.hash === insight.hash ? "UNKNOWN" : "COMPLETE" });
  const unrelatedInitial = unrelatedCoordinator.getSnapshot(`${scope}:unrelated`);
  await assert.rejects(unrelatedCoordinator.importInsight(runtime.createV2Beta1ImportRequest(unrelatedInitial, insight, "unknown"), `${scope}:unrelated`), /beta1_completion_unknown_no_resend/u);
  const afterUnknown = unrelatedCoordinator.getSnapshot(`${scope}:unrelated`); const other = runtime.createSyntheticBeta1Insight("互不相關且可完成的第二條洞見");
  await unrelatedCoordinator.importInsight(runtime.createV2Beta1ImportRequest(afterUnknown, other, "complete-other"), `${scope}:unrelated`);
  assert.equal(unrelatedCoordinator.getSnapshot(`${scope}:unrelated`).effectReceipts.length, 2);
});

await gate("PURE_RESULT_EVIDENCE_CLASSIFIER", async () => {
  const observed = [raw("RESULTS", "任務表現為 82%，方向為增加；95% CI [76%, 88%]，p<.001，n=180；[1] 不支持因果結論。"), raw("STATISTICS", "任務表現為 82%，95% CI [76%, 88%]，p<.001，N=180。", "statistics"), raw("TABLE", "任務表現為 82%；n=180。", "table"), raw("FIGURE", "任務表現為 82%，方向為增加；n=180。", "figure")];
  assert.deepEqual(evidence.classifyV2Beta1ResultEvidence([]), { classification: "MISSING", consistencyProven: false, traceable: false, sourceMaterialIds: [] });
  const legal = evidence.classifyV2Beta1ResultEvidence(observed); assert.equal(legal.classification, "OBSERVED"); assert.equal(legal.consistencyProven, true); assert.equal(legal.traceable, true);
  for (const text of ["n=?", "N=待填", "TBD", "XXX", "待整理"]) assert.equal(evidence.classifyV2Beta1ResultEvidence([raw("RESULTS", text)]).classification, "MISSING");
  for (const text of ["預期提升 12%", "預計 n=180", "將檢驗效果", "擬蒐集資料", "尚待分析", "尚未完成", "未完成", "待蒐集", "expected improvement", "planned results", "will test", "pending analysis", "not yet observed", "future study"]) assert.equal(evidence.classifyV2Beta1ResultEvidence([raw("RESULTS", text)]).classification, "PLANNED", text);
  const opposite = [observed[0], raw("STATISTICS", "任務表現為 -18%，95% CI [-25%, -11%]，p<.001，N=180。", "statistics-opposite")];
  assert.equal(evidence.classifyV2Beta1ResultEvidence(opposite).classification, "CONFLICT");
  assert.equal(evidence.classifyV2Beta1ResultEvidence([observed[0], raw("TABLE", "任務表現為 61%；n=180。", "table-conflict")]).classification, "CONFLICT");
  assert.equal(evidence.classifyV2Beta1ResultEvidence([observed[0], raw("FIGURE", "任務表現為 82%，方向為下降；n=180。", "figure-conflict")]).classification, "CONFLICT");

  const coordinator = runtime.createV2Beta1Coordinator(); const initial = coordinator.getSnapshot(`${scope}:evidence`);
  const final = (await coordinator.runJourney(journeyRequest(initial, "observed", completeMaterials(observed)), `${scope}:evidence`)).snapshot.journey;
  assert.equal(final.resultEvidenceClass, "OBSERVED"); assert.equal(final.journal.publicationUsable, true); assert.equal(final.journal.reviewStatus, "FINAL_CONFIRMABLE");
  for (const [label, materials, expectedClass, expectedStatus] of [
    ["planned", completeMaterials([raw("RESULTS", "預期任務表現將提升 12%，資料尚待蒐集。")]), "PLANNED", "READY_WITH_GAPS"],
    ["missing", completeMaterials([raw("RESULTS", "n=?；待整理")]), "MISSING", "READY_WITH_GAPS"],
    ["conflict", completeMaterials(opposite), "CONFLICT", "BLOCKED_EVIDENCE_OR_INTEGRITY"],
  ]) { const local = runtime.createV2Beta1Coordinator(); const start = local.getSnapshot(`${scope}:${label}`); const artifact = (await local.runJourney(journeyRequest(start, label, materials), `${scope}:${label}`)).snapshot.journey; assert.equal(artifact.resultEvidenceClass, expectedClass); assert.equal(artifact.journal.publicationUsable, false); assert.equal(artifact.journal.reviewStatus, expectedStatus); }
});

await gate("ASSIST_CONTEXT_RISK_AND_COMPLETE_VALUES", async () => {
  const coordinator = runtime.createV2Beta1Coordinator(); const initial = coordinator.getSnapshot(`${scope}:assist`);
  const artifact = (await coordinator.runJourney(journeyRequest(initial, "assist", completeMaterials([raw("RESULTS", "任務表現為 82%，95% CI [76%, 88%]，p<.001，n=180；[1] 不支持因果結論。")])) , `${scope}:assist`)).snapshot.journey;
  const editable = contracts.S0_FIELD_NAMES.filter((field) => field !== "domain" && field !== "outputTrack");
  for (const direction of artifact.directions) for (const field of contracts.S0_FIELD_NAMES) {
    const options = direction.fieldAssist[field]; assert.equal(options.length, 3);
    for (const option of options) { assert.equal(option.field, field); assert.equal(option.directionHash, direction.directionHash); assert.equal(option.inputBundleHash, direction.inputBundleHash); assert.equal(option.domainSelectionHash, artifact.researchDomain.selectionHash); assert.equal(option.outputTarget, artifact.outputTarget); assert.ok(option.rationale.length >= 12); assert.ok(option.risk.length >= 12); }
    if (editable.includes(field)) { assert.equal(new Set(options.map((item) => item.applyValue)).size, 3); assert.equal(options.every((item) => contracts.isV2Beta1DirectAssistValue(field, item.applyValue)), true, field); }
    else assert.equal(new Set(options.map((item) => item.applyValue)).size, 1);
  }
  const valid = structuredClone(artifact); const option = valid.directions[0].fieldAssist.workingTitle[0];
  for (const mutate of [
    (draft) => { draft.field = "methodIdea"; },
    (draft) => { draft.directionHash = valid.directions[1].directionHash; },
    (draft) => { draft.inputBundleHash = valid.directions[1].inputBundleHash; },
    (draft) => { draft.domainSelectionHash = "0".repeat(64); },
    (draft) => { draft.outputTarget = "NSTC"; },
    (draft) => { delete draft.risk; },
  ]) { const changed = structuredClone(valid); const target = changed.directions[0].fieldAssist.workingTitle[0]; mutate(target); assert.throws(() => contracts.parseV2Beta1JourneyArtifact(changed)); }
  assert.match(option.risk, /風險|限制|負擔|偏誤/u);
});

assert.equal(groups.length, 3);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, externalNetworkCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0 }));
