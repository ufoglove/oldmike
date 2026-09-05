import assert from "node:assert/strict";

import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import { createBuiltinDomainSelection } from "../lib/v2-alpha3/contracts.ts";
import {
  V2_BETA1_MATERIAL_CONTENT_MAX_BYTES,
  V2_BETA1_MATERIAL_TOTAL_MAX_BYTES,
  V2_BETA1_REVIEW_STRATEGIES,
  beta1Hash,
  parseV2Beta1JourneyArtifact,
  parseV2Beta1JourneyRequest,
} from "../lib/v2-beta1/contracts.ts";
import {
  createSyntheticBeta1Project,
  createV2Beta1Coordinator,
  createV2Beta1JourneyRequest,
} from "../lib/v2-beta1/runtime.ts";

const domain = createBuiltinDomainSelection("ai-education");
const scope = "fixture-workspace-v2:fixture-user-v2";
const baseMaterials = [
  { materialId: "material-abstract", kind: "ABSTRACT", title: "摘要", content: "本材料記錄生成式回饋與證據校準的研究背景，不宣稱研究結果。" },
  { materialId: "material-methods", kind: "METHODS", title: "方法", content: "採混合方法並保留樣本、量測與分析設定待確認。" },
  { materialId: "material-results", kind: "RESULTS", title: "結果", content: "目前只觀察到描述性差異，不支持因果或顯著性推論。" },
  { materialId: "material-statistics", kind: "STATISTICS", title: "統計", content: "指標為 82%；分母、估計量與不確定性仍待核對。" },
];

function journeyRequest(snapshot, suffix, direction, target = "SSCI", materials = baseMaterials) {
  return createV2Beta1JourneyRequest(snapshot, {
    suffix,
    entryMode: materials.length ? "PARTIAL_MATERIAL" : "KEYWORD",
    outputTarget: target,
    researchDirection: direction,
    researchDomain: domain,
    materials,
  });
}

function assertCompleteDirection(direction, target) {
  assert.deepEqual(Object.keys(direction.s0).sort(), [...S0_FIELD_NAMES].sort());
  assert.equal(Object.values(direction.s0).every((value) => typeof value === "string" && value.trim()), true);
  assert.equal(direction.s0.workingTitle, direction.title);
  assert.equal(direction.s0.outputTrack, target);
  assert.equal(direction.s0.domain, domain.label);
  assert.equal(direction.preview.contentHash, beta1Hash({ kind: direction.preview.kind, title: direction.preview.title, sections: direction.preview.sections }));
  assert.deepEqual(Object.keys(direction.fieldAssist).sort(), [...S0_FIELD_NAMES].sort());
  for (const field of S0_FIELD_NAMES) {
    const options = direction.fieldAssist[field];
    assert.equal(options.length, 3);
    assert.deepEqual(options.map((option) => option.strategy), [...V2_BETA1_REVIEW_STRATEGIES]);
    assert.equal(options.filter((option) => option.recommended).length, 1);
    assert.equal(new Set(options.map((option) => option.text)).size, 3);
    assert.equal(options.every((option) => typeof option.applyValue === "string" && option.applyValue.trim()), true);
    assert.equal(options.every((option) => option.rationale.trim()), true);
  }
}

const groups = [];

{
  const coordinator = createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(scope);
  const request = journeyRequest(initial, "multi-001", "生成式回饋的證據校準如何影響高等教育自我調節學習？");
  const result = await coordinator.runJourney(request, scope);
  assert.deepEqual(result.snapshot.journey.sourceMaterials.map((item) => ({ id: item.materialId, kind: item.kind, content: item.content })), baseMaterials.map((item) => ({ id: item.materialId, kind: item.kind, content: item.content })));
  assert.equal(result.snapshot.journey.researchDomain.selectionHash, domain.selectionHash);
  assert.equal(result.snapshot.journey.directions.every((item) => !item.title.includes(baseMaterials[1].content)), true);
  groups.push("MULTI_MATERIAL_DOMAIN_EXACT_PRESERVATION");
}

{
  const coordinator = createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:directions`);
  const result = await coordinator.runJourney(journeyRequest(initial, "directions-001", "生成式回饋的證據校準與自我調節學習", "SCI", []), `${scope}:directions`);
  assert.equal(result.snapshot.journey.directions.length, 3);
  assert.equal(new Set(result.snapshot.journey.directions.map((item) => item.title)).size, 3);
  result.snapshot.journey.directions.forEach((item) => assertCompleteDirection(item, "SCI"));
  assert.equal(result.snapshot.s0Summary.workingTitle, result.snapshot.journey.directions.find((item) => item.recommended).s0.workingTitle);
  groups.push("THREE_DIRECTIONS_EACH_COMPLETE_S0_PREVIEW_ASSIST");
}

{
  const coordinator = createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:journal`);
  const result = await coordinator.runJourney(journeyRequest(initial, "journal-001", "生成式回饋的證據校準與高等教育決策", "SSCI"), `${scope}:journal`);
  const journal = result.snapshot.journey.journal;
  assert.equal(journal.target, "SSCI");
  assert.equal(journal.sourceSnapshot.contentHash, beta1Hash({ title: journal.sourceSnapshot.title, sections: journal.sourceSnapshot.sections }));
  assert.equal(journal.proposedSnapshot.contentHash, beta1Hash({ title: journal.proposedSnapshot.title, sections: journal.proposedSnapshot.sections }));
  assert.equal(journal.priorityFindings.length, 3);
  journal.priorityFindings.forEach((finding) => {
    assert.equal(finding.revisions.length, 3);
    assert.equal(finding.revisions.filter((item) => item.recommended).length, 1);
    assert.equal(finding.revisions.every((item) => item.text !== finding.sourceText && item.rationale.trim()), true);
  });
  if (Object.values(journal.proposedSnapshot.sections).some((text) => /待填|placeholder|尚未提供|missing/iu.test(text))) assert.equal(journal.publicationUsable, false);
  groups.push("JOURNAL_SOURCE_PROPOSED_THREE_REVISIONS");
}

{
  const coordinator = createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:taiwan`);
  const result = await coordinator.runJourney(journeyRequest(initial, "taiwan-001", "生成式回饋支持大學教學實踐改善", "MOE", []), `${scope}:taiwan`);
  const proposal = result.snapshot.journey.taiwanProposal;
  assert.equal(proposal.targetId, "MOE");
  assert.equal(Object.keys(proposal.narrativeSections).length, 6);
  assert.equal(Object.values(proposal.narrativeSections).every((text) => text.trim()), true);
  assert.equal(proposal.priorityFindings.length, 3);
  assert.equal(proposal.priorityFindings.every((finding) => finding.revisions.length === 3), true);
  assert.match(proposal.officialFactsState, /UNKNOWN|STALE/u);
  assert.equal(result.snapshot.journey.officialSourceBundleHash, proposal.officialSourceBundleHash);
  groups.push("TAIWAN_FULL_PLAN_REVIEW");
}

{
  const coordinator = createV2Beta1Coordinator();
  const initial = coordinator.getSnapshot(`${scope}:gate`);
  const result = await coordinator.runJourney(journeyRequest(initial, "gate-001", "XR 情境演練與職業安全教育遷移", "NSTC", []), `${scope}:gate`);
  const artifact = result.snapshot.journey;
  assert.equal(artifact.humanGate.required, true);
  assert.equal(artifact.humanGate.scope, "WHOLE_ARTIFACT");
  assert.equal(artifact.humanGate.contentHash, artifact.directions.find((item) => item.recommended).selectionArtifact.humanGateHash);
  assert.equal(result.snapshot.formalResearchWriteCount, 0);
  groups.push("WHOLE_ARTIFACT_GATE_AND_ASSIST");
}

{
  let attempts = 0;
  let release;
  const entered = new Promise((resolve) => { release = resolve; });
  let unblock;
  const blocked = new Promise((resolve) => { unblock = resolve; });
  const coordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; release(); await blocked; return "COMPLETE"; } });
  const initial = coordinator.getSnapshot(`${scope}:concurrency`);
  const first = coordinator.runJourney(journeyRequest(initial, "concurrent-a", "第一個研究方向", "NSTC", []), `${scope}:concurrency`);
  await entered;
  await assert.rejects(coordinator.runJourney(journeyRequest(initial, "concurrent-b", "第二個不同研究方向", "NSTC", []), `${scope}:concurrency`), /beta1_concurrent_state_conflict/);
  unblock();
  await first;
  assert.equal(attempts, 1);

  const unknownCoordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { throw new Error("fixture_timeout_after_possible_submission"); } });
  const unknownInitial = unknownCoordinator.getSnapshot(`${scope}:unknown`);
  const unknownRequest = journeyRequest(unknownInitial, "unknown-a", "完成狀態不明研究方向", "NSTC", []);
  await assert.rejects(unknownCoordinator.runJourney(unknownRequest, `${scope}:unknown`), /beta1_completion_unknown_no_resend/);
  const unknownSnapshot = unknownCoordinator.getSnapshot(`${scope}:unknown`);
  assert.equal(unknownSnapshot.revision, 2);
  assert.equal(unknownSnapshot.effectReceipts.length, 1);
  assert.equal(unknownSnapshot.effectReceipts[0].completionClass, "UNKNOWN");
  groups.push("PRE_EFFECT_SCOPE_CONCURRENCY_AND_UNKNOWN_RECEIPT");
}

{
  let attempts = 0;
  const coordinator = createV2Beta1Coordinator({ beforeJourneyCommit: async () => { attempts += 1; return "COMPLETE"; } });
  const initial = coordinator.getSnapshot(`${scope}:lineage`);
  const firstRequest = journeyRequest(initial, "lineage-a", "NSTC 第一個關鍵字", "NSTC", []);
  const first = await coordinator.runJourney(firstRequest, `${scope}:lineage`);
  const secondRequest = journeyRequest(first.snapshot, "lineage-b", "NSTC 第二個不同關鍵字", "NSTC", []);
  const second = await coordinator.runJourney(secondRequest, `${scope}:lineage`);
  assert.notEqual(first.snapshot.journey.inputBundleHash, second.snapshot.journey.inputBundleHash);
  const replay = await coordinator.runJourney(firstRequest, `${scope}:lineage`);
  assert.equal(replay.replayed, true);
  assert.equal(replay.snapshot.revision, second.snapshot.revision);
  assert.equal(attempts, 2);
  const duplicate = journeyRequest(second.snapshot, "lineage-a-new-key", "NSTC 第一個關鍵字", "NSTC", []);
  await assert.rejects(coordinator.runJourney(duplicate, `${scope}:lineage`), /beta1_journey_already_completed/);
  assert.equal(attempts, 2);
  const wrongTarget = structuredClone(second.snapshot.journey);
  wrongTarget.taiwanProposal.targetId = "MOE";
  assert.throws(() => parseV2Beta1JourneyArtifact(wrongTarget), /beta1_direction_selection_binding_invalid/);
  const wrongS0 = structuredClone(second.snapshot.journey);
  wrongS0.directions[1].s0.outputTrack = "SSCI";
  assert.throws(() => parseV2Beta1JourneyArtifact(wrongS0), /beta1_direction_s0_binding_invalid/);
  const wrongDomain = structuredClone(second.snapshot.journey);
  wrongDomain.directions[1].s0.domain = "錯誤領域";
  assert.throws(() => parseV2Beta1JourneyArtifact(wrongDomain), /beta1_direction_s0_binding_invalid/);
  const repeatedTitle = structuredClone(second.snapshot.journey);
  repeatedTitle.directions[2].title = repeatedTitle.directions[0].title;
  assert.throws(() => parseV2Beta1JourneyArtifact(repeatedTitle), /beta1_professional_projection_binding_invalid|beta1_direction_hash_invalid|beta1_direction_set_invalid/);
  const shrunkenPlan = structuredClone(second.snapshot.journey);
  delete shrunkenPlan.taiwanProposal.narrativeSections.WORK_PLAN;
  assert.throws(() => parseV2Beta1JourneyArtifact(shrunkenPlan), /beta1_direction_selection_binding_invalid/);
  const emptyRevision = structuredClone(second.snapshot.journey);
  emptyRevision.taiwanProposal.priorityFindings[0].revisions[0].text = "";
  assert.throws(() => parseV2Beta1JourneyArtifact(emptyRevision), /beta1_direction_selection_binding_invalid/);
  groups.push("INPUT_LINEAGE_REPLAY_AND_CROSS_TARGET");
}

{
  const initial = createSyntheticBeta1Project(`${scope}:limits`);
  const exactMaterial = "界".repeat(V2_BETA1_MATERIAL_CONTENT_MAX_BYTES / 3);
  const exact = journeyRequest(initial, "limit-exact", "UTF-8 精確邊界", "SCI", [{ materialId: "material-exact", kind: "NOTE", title: "精確", content: exactMaterial }]);
  assert.equal(parseV2Beta1JourneyRequest(exact).materials[0].content, exactMaterial);
  const overMaterial = `${exactMaterial}界`;
  assert.throws(() => parseV2Beta1JourneyRequest({ ...exact, materials: [{ ...exact.materials[0], content: overMaterial }] }), /beta1_material_content_invalid/);
  const quarter = "x".repeat(V2_BETA1_MATERIAL_TOTAL_MAX_BYTES / 4);
  const totalExact = journeyRequest(initial, "total-exact", "UTF-8 total exact", "SCI", [0, 1, 2, 3].map((index) => ({ materialId: `material-total-${index}`, kind: "NOTE", title: `材料${index}`, content: quarter })));
  assert.equal(parseV2Beta1JourneyRequest(totalExact).materials.length, 4);
  const totalOver = { ...totalExact, materials: [...totalExact.materials, { materialId: "material-total-over", kind: "NOTE", title: "超限", content: "x" }] };
  assert.throws(() => parseV2Beta1JourneyRequest(totalOver), /beta1_material_total_too_large/);
  groups.push("UTF8_REQUEST_LIMITS");
}

assert.equal(groups.length, 8);
console.log(JSON.stringify({ status: "PASS", groups, groupCount: groups.length, externalNetworkCalls: 0, formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0 }));
