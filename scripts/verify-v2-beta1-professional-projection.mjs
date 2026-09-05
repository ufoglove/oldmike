import assert from "node:assert/strict";

import { S0_FIELD_LIMITS, S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import { beta1Hash } from "../lib/v2-beta1/canonical-hash.ts";
import { parseV2Beta1JourneyRequest } from "../lib/v2-beta1/contracts.ts";
import { classifyV2Beta1ClauseResultState, deriveV2Beta1EvidenceRelationIR, extractV2Beta1StructuredEvidenceRecords, reduceV2Beta1ResultPropositionStates, tokenizeV2Beta1ResultPropositions, validateV2Beta1RevisionAnchors } from "../lib/v2-beta1/evidence-anchors.ts";
import { assessV2Beta1PublicationReadiness, classifyV2Beta1ResultEvidence } from "../lib/v2-beta1/evidence-classifier.ts";
import {
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_DIRECTION_LANES,
  V2_BETA1_REVIEW_STRATEGIES,
  createV2Beta1AssistOptions,
  v2Beta1AssistOptionCore,
  validateV2Beta1AssistOptionAgainstParent,
  validateV2Beta1AssistOptionContent,
} from "../lib/v2-beta1/shared-authority.ts";
import {
  createV2Beta1ObservationConfirmationAuthority,
  createV2Beta1TypedObservationRecord,
  deriveV2Beta1ObservationCandidates,
  parseV2Beta1ObservationConfirmationAuthority,
  renderV2Beta1TypedObservationRecord,
} from "../lib/v2-beta1/typed-observation-authority.ts";
import {
  V2_BETA1_PROFESSIONAL_PROJECTION_VERSION,
  createV2Beta1EvidenceAuthority,
  createV2Beta1HumanDraftAuthority,
  createV2Beta1ProfessionalProjection,
  validateV2Beta1EvidenceAuthority,
  validateV2Beta1ProfessionalProjection,
} from "../lib/v2-beta1/professional-projection.ts";

let groups = 0;
const group = (name, fn) => { fn(); groups += 1; };
const material = (materialId, kind, title, content) => ({ materialId, kind, title, content, contentHash: beta1Hash(content) });
const domain = { label: "教育與學習科學", selectionHash: beta1Hash({ id: "education" }) };
const EXPECTED_AUTHORITIES = {
  SSCI: ["40e8a3dc41fab179620f3d465d3effa90d73865abf8ede344d509383745bd561", "ff81050f5e13a3f0b1cd5a14e38202f63dd432e697d787fa29c9cf6c0fbce48c"],
  SCI: ["b9ea4f48e51afb3c65a3abb89ac426fe80480fdc38d652bff9cb21cb8fe56b55", "1ca1d55cd14ad4901a5338918d2913f744cdd94988b6f60b67eaf34e451b0d69"],
  NSTC: ["b0d2fd255e0e12a98e3ce64cdd8b3d4ac6c93c8c9a774338707f3b545758e4d8", "f67a7c84188a68a50c84ef55092ab1042c7fb8b1a1eb8de451e138716fdc7315"],
  MOE: ["f75bad5761ce4faffcfa94f046935c16052e3d5b6749539070e936890fbcd6f9", "9ec0ad73e37974d833ebb1566a2d00ea72b9d07a55224434302407117330379b"],
};

group("contract 1.7.20 exact and older request fail closed", () => {
  assert.equal(V2_BETA1_CONTRACT_VERSION, "old-mike-v2-beta1/1.7.20");
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.19" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.18" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.17" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.16" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.15" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.14" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.13" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.12" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.11" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.10" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.9" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.8" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.7" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.6" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.5" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.4" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.3" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.2" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.1" }), /beta1_journey_request_invalid/);
  assert.throws(() => parseV2Beta1JourneyRequest({ contractVersion: "old-mike-v2-beta1/1.7.0" }), /beta1_journey_request_invalid/);
});

group("version and four track-specific deterministic projections", () => {
  assert.equal(V2_BETA1_PROFESSIONAL_PROJECTION_VERSION, "old-mike-v2-beta1/professional-projection/1");
  const materials = [material("methods-1", "METHODS", "方法", "樣本採分層招募，並比較介入組與基準組。"), material("results-1", "RESULTS", "結果", "目前觀察到任務表現為 82%；95% CI 尚待核對。")];
  for (const target of ["SSCI", "SCI", "NSTC", "MOE"]) {
    const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, target);
    const projection = createV2Beta1ProfessionalProjection({ outputTarget: target, lane: "BALANCED_RECOMMENDED", domain, researchDirection: "生成式回饋的證據校準與自我調節學習", materials, evidenceAuthority });
    assert.equal(validateV2Beta1ProfessionalProjection(projection, { outputTarget: target, lane: "BALANCED_RECOMMENDED", domain, researchDirection: "生成式回饋的證據校準與自我調節學習", materials, evidenceAuthority }), true);
    assert.equal(projection.s0.outputTrack, target);
    assert.equal(projection.s0.domain, domain.label);
    assert.match(projection.title, /生成式回饋/);
    assert.deepEqual([evidenceAuthority.authorityHash, projection.authorityHash], EXPECTED_AUTHORITIES[target]);
    assert.match(projection.method, target === "SSCI" ? /構念|量測|效度/ : target === "SCI" ? /樣本|比較|信賴區間|敏感度/ : target === "NSTC" ? /理論|假設|先導|工作包/ : /課程|學習者|教學介入|忠實度/);
  }
});

group("clause-local planned observed conflict missing and unresolved evidence", () => {
  const planned = createV2Beta1EvidenceAuthority([material("r1", "RESULTS", "結果", "本研究目標為 82%。")], "SCI");
  assert.equal(planned.summary.resultState, "PLANNED");
  const observed = createV2Beta1EvidenceAuthority([material("r2", "RESULTS", "結果", "目前觀察到主要指標為 82%；95% CI 尚待核對。")], "SCI");
  assert.equal(observed.summary.resultState, "OBSERVED");
  assert.deepEqual([observed.summary.consistencyProven, observed.summary.traceable, observed.summary.publicationUsable, observed.summary.reviewStatus], [false, false, false, "READY_WITH_GAPS"]);
  const conflict = createV2Beta1EvidenceAuthority([material("r3", "RESULTS", "結果", "metricId=score cohortId=all timepoint=post analysisId=primary，目前觀察到 82%。"), material("s3", "STATISTICS", "統計", "metricId=score cohortId=all timepoint=post analysisId=primary，目前觀察到 76%。")], "SCI");
  assert.equal(conflict.summary.resultState, "CONFLICT");
  assert.equal(conflict.summary.reviewStatus, "BLOCKED_EVIDENCE_OR_INTEGRITY");
  const missing = createV2Beta1EvidenceAuthority([], "MOE");
  assert.equal(missing.summary.resultState, "MISSING");
  assert.equal(missing.clauses.some((item) => item.provenance === "MISSING_SECTION_NO_SOURCE_MATERIAL"), true);
  const unresolved = createV2Beta1EvidenceAuthority([material("r4", "RESULTS", "結果", "資料模式仍無法可靠解析。")], "SSCI");
  assert.equal(unresolved.clauses.some((item) => item.state === "UNRESOLVED"), true);
});

group("literal evidence algebra and citation identities fail closed", () => {
  const observedWithLocalGap = createV2Beta1EvidenceAuthority([
    material("observed-82", "RESULTS", "結果", "主要指標實際觀察為 82%，但樣本 N=待填。"),
  ], "SCI");
  assert.deepEqual(
    [observedWithLocalGap.summary.resultState, observedWithLocalGap.summary.consistencyProven, observedWithLocalGap.summary.traceable, observedWithLocalGap.summary.publicationUsable, observedWithLocalGap.summary.reviewStatus],
    ["OBSERVED", false, false, false, "READY_WITH_GAPS"],
  );
  for (const plannedText of [
    "預期結果顯示主要指標 82%。",
    "預期結果指出主要指標 82%。",
    "預期結果為 82%，正式分析尚待完成。",
    "主要指標預計達 82%，仍待正式分析。",
  ]) {
    const planned = createV2Beta1EvidenceAuthority([material(`planned-${beta1Hash(plannedText).slice(0, 8)}`, "RESULTS", "結果", plannedText)], "SCI");
    assert.equal(planned.summary.resultState, "PLANNED", plannedText);
    assert.equal(planned.summary.publicationUsable, false, plannedText);
  }
  for (const observedNoun of ["預期結果與實際觀察一致，主要指標為 82%。", "未完成作業組的結果顯示指標為 82%。", "預期焦慮量表的實際觀察值為 82%。"]) {
    assert.equal(createV2Beta1EvidenceAuthority([material(`noun-${beta1Hash(observedNoun).slice(0, 8)}`, "RESULTS", "結果", observedNoun)], "SSCI").summary.resultState, "OBSERVED");
  }
  const observedAndPlanned = createV2Beta1EvidenceAuthority([
    material("observed-clause", "RESULTS", "結果", "主要指標實際觀察為 82%。預期結果指出次要指標 76%。"),
  ], "SCI");
  assert.equal(observedAndPlanned.summary.resultState, "OBSERVED");
  assert.equal(observedAndPlanned.clauses.some((item) => item.state === "PLANNED"), true);
  assert.deepEqual([observedAndPlanned.summary.consistencyProven, observedAndPlanned.summary.publicationUsable, observedAndPlanned.summary.reviewStatus], [false, false, "READY_WITH_GAPS"]);
  const distinctMetrics = createV2Beta1EvidenceAuthority([
    material("attendance", "RESULTS", "結果", "出席率實際觀察為 82%。"),
    material("completion", "STATISTICS", "統計", "完成率實際觀察為 76%。"),
  ], "SCI");
  assert.notEqual(distinctMetrics.summary.resultState, "CONFLICT");
  const unresolvedIdentity = createV2Beta1EvidenceAuthority([
    material("unnamed-a", "RESULTS", "結果", "目前觀察到 82%。"),
    material("unnamed-b", "STATISTICS", "統計", "目前觀察到 76%。"),
  ], "SCI");
  assert.notEqual(unresolvedIdentity.summary.resultState, "CONFLICT");
  assert.equal(unresolvedIdentity.clauses.filter((item) => item.provenance === "PROVIDED_RESULT_MATERIAL").every((item) => item.observationKey === null), true);
  const metadataCitation = createV2Beta1EvidenceAuthority([
    material("citation-data", "CITATION", "引用", "Dataset (2024). Data archive."),
    material("result-data", "RESULTS", "結果", "Dataset (2024) 報告主要指標實際觀察為 82%。"),
  ], "SSCI");
  assert.equal(metadataCitation.summary.traceable, false);
  const qualifiedCitation = createV2Beta1EvidenceAuthority([
    material("citation-wang", "CITATION", "引用", "Wang et al. (2024). Evidence calibration in higher education."),
    material("result-wang", "RESULTS", "結果", "Wang et al. (2024) 報告主要指標實際觀察為 82%。"),
  ], "SSCI");
  assert.equal(qualifiedCitation.summary.traceable, true);
});

group("shared planned grammar and proposition boundaries fail closed", () => {
  const plannedLiterals = [
    "預期提升 12%。",
    "預計 n=180。",
    "將檢驗效果。",
    "擬蒐集資料。",
    "尚待分析。",
    "尚未完成。",
    "未完成。",
    "待蒐集。",
    "預期結果顯示主要指標 82%。",
    "預期結果指出主要指標 82%。",
    "預期結果為 82%，正式分析尚待完成。",
    "主要指標預計達 82%，仍待正式分析。",
    "expected improvement.",
    "planned results.",
    "will test the effect.",
    "pending analysis.",
    "not yet observed.",
    "future study.",
    "results remain pending.",
    "analysis remains pending.",
  ];
  for (const plannedText of plannedLiterals) {
    const authority = createV2Beta1EvidenceAuthority([material(`c3-planned-${beta1Hash(plannedText).slice(0, 8)}`, "RESULTS", "結果", plannedText)], "SCI");
    assert.equal(authority.summary.resultState, "PLANNED", plannedText);
    assert.equal(authority.summary.publicationUsable, false, plannedText);
    assert.equal(authority.clauses.some((item) => item.state === "OBSERVED"), false, plannedText);
  }

  const falseFinalStructured = createV2Beta1EvidenceAuthority([
    material("c3-structured-results", "RESULTS", "結果", "metricId=score cohortId=all timepoint=post analysisId=primary；not yet observed；β = 0.31；N=180；p=.04；95% CI [0.02, 0.60]。"),
    material("c3-structured-statistics", "STATISTICS", "統計", "metricId=score cohortId=all timepoint=post analysisId=primary; results remain pending; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]."),
  ], "SCI");
  assert.equal(falseFinalStructured.summary.resultState, "PLANNED");
  assert.equal(falseFinalStructured.summary.publicationUsable, false);
  assert.equal(falseFinalStructured.clauses.some((item) => item.state === "OBSERVED"), false);

  const periodAuthority = createV2Beta1EvidenceAuthority([
    material("c3-period", "RESULTS", "結果", "主要指標實際觀察為 82%。次要指標尚待分析。"),
  ], "SCI");
  const semicolonAuthority = createV2Beta1EvidenceAuthority([
    material("c3-semicolon", "RESULTS", "結果", "主要指標實際觀察為 82%；次要指標尚待分析；"),
  ], "SCI");
  assert.deepEqual(periodAuthority.clauses.map((item) => item.state), semicolonAuthority.clauses.map((item) => item.state));
  assert.deepEqual(
    [periodAuthority.summary.resultState, periodAuthority.summary.consistencyProven, periodAuthority.summary.publicationUsable],
    [semicolonAuthority.summary.resultState, semicolonAuthority.summary.consistencyProven, semicolonAuthority.summary.publicationUsable],
  );
  const periodPropositions = tokenizeV2Beta1ResultPropositions("主要指標實際觀察為 82%。次要指標尚待分析。");
  const semicolonPropositions = tokenizeV2Beta1ResultPropositions("主要指標實際觀察為 82%；次要指標尚待分析；");
  assert.deepEqual(periodPropositions.map((item) => item.resultState), ["OBSERVED", "PLANNED"]);
  assert.deepEqual(semicolonPropositions.map((item) => item.resultState), ["OBSERVED", "PLANNED"]);
  assert.deepEqual(reduceV2Beta1ResultPropositionStates(semicolonPropositions.map((item) => item.resultState)), { resultState: "OBSERVED", hasObserved: true, hasPlanned: true, hasMissing: false, hasUnresolved: false });

  const structuredSemicolon = createV2Beta1EvidenceAuthority([
    material("c3-structured-semicolon", "RESULTS", "結果", "metricId=score; cohortId=all; timepoint=post; analysisId=primary；主要指標實際觀察為 82%；N=180；p=.04；95% CI [0.02, 0.60]。"),
  ], "SCI");
  assert.equal(structuredSemicolon.summary.resultState, "OBSERVED");
  assert.equal(tokenizeV2Beta1ResultPropositions("metricId=score; cohortId=all; timepoint=post; analysisId=primary；主要指標實際觀察為 82%；N=180；p=.04；95% CI [0.02, 0.60]。").length, 1);
  assert.equal(tokenizeV2Beta1ResultPropositions("metricId=score；cohortId=all；timepoint=post；analysisId=primary；主要指標實際觀察為 ８２％；ｐ＝０．０４；９５％ CI [０．０２, ０．６０]。").length, 1);

  for (const collision of [
    "未完成作業組的結果顯示指標為 82%，但尚待分析。",
    "預期焦慮量表的實際觀察值為 82%；然而結果仍待完成。",
    "Expected-result scale scores were observed at 82%; however, analysis remains pending.",
  ]) {
    const authority = createV2Beta1EvidenceAuthority([material(`c3-collision-${beta1Hash(collision).slice(0, 8)}`, "RESULTS", "結果", collision)], "SSCI");
    assert.equal(authority.summary.resultState, "OBSERVED", collision);
    assert.equal(authority.clauses.some((item) => item.state === "PLANNED"), true, collision);
    assert.deepEqual([authority.summary.consistencyProven, authority.summary.publicationUsable, authority.summary.reviewStatus], [false, false, "READY_WITH_GAPS"]);
  }
});

group("bounded English pending auxiliary grammar preserves observed controls", () => {
  const auxiliaryPlanned = [
    "Results have not yet been observed.",
    "Findings had not been observed yet.",
    "The analysis has yet to be observed.",
    "Results were not yet observed.",
    "The findings are not observed yet.",
  ];
  for (const plannedText of auxiliaryPlanned) {
    const authority = createV2Beta1EvidenceAuthority([material(`c4-planned-${beta1Hash(plannedText).slice(0, 8)}`, "RESULTS", "Results", plannedText)], "SCI");
    assert.equal(authority.summary.resultState, "PLANNED", plannedText);
    assert.equal(authority.summary.publicationUsable, false, plannedText);
    assert.equal(authority.clauses.some((item) => item.state === "OBSERVED"), false, plannedText);
  }

  for (const observedText of [
    "Results have been observed.",
    "Results were observed.",
    "Results have already been observed.",
    "Results have not only been observed but independently replicated.",
  ]) {
    const authority = createV2Beta1EvidenceAuthority([material(`c4-observed-${beta1Hash(observedText).slice(0, 8)}`, "RESULTS", "Results", observedText)], "SCI");
    assert.equal(authority.summary.resultState, "OBSERVED", observedText);
    assert.equal(authority.clauses.some((item) => item.state === "PLANNED"), false, observedText);
  }

  const fullMaterials = (pendingSentence) => [
    material("c4-abstract", "ABSTRACT", "Abstract", "This study examines evidence calibration without overstating the current result state."),
    material("c4-introduction", "INTRODUCTION", "Introduction", "Wang et al. (2024) motivates a bounded comparison of evidence calibration."),
    material("c4-methods", "METHODS", "Methods", "The study specifies the sample, comparison, measure, and analysis before interpretation."),
    material("c4-results", "RESULTS", "Results", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${pendingSentence}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c4-statistics", "STATISTICS", "Statistics", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${pendingSentence}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c4-discussion", "NOTE", "Discussion", "Discussion remains bounded by the supplied evidence state and uncertainty."),
    material("c4-conclusion", "NOTE", "Conclusion", "Conclusion does not convert pending results into observed findings."),
    material("c4-citation", "CITATION", "Citation", "Wang et al. (2024). Evidence calibration in higher education."),
  ];
  for (const pendingSentence of [
    "Results have not yet been observed",
    "Results have not been observed yet",
    "Results have yet to be observed",
  ]) {
    const authority = createV2Beta1EvidenceAuthority(fullMaterials(pendingSentence), "SCI");
    assert.deepEqual(
      [authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus],
      ["PLANNED", false, true, false, "READY_WITH_GAPS"],
      pendingSentence,
    );
    assert.equal(authority.clauses.some((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind) && item.state === "OBSERVED"), false, pendingSentence);
  }
});

group("predicate-scoped pending grammar and clause-local observations reject false finalization", () => {
  const fullMaterials = (resultText) => [
    material("c5-abstract", "ABSTRACT", "Abstract", "This study examines evidence calibration without overstating the supplied result state."),
    material("c5-introduction", "INTRODUCTION", "Introduction", "Wang et al. (2024) motivates the bounded evidence comparison."),
    material("c5-methods", "METHODS", "Methods", "The sample, comparison, measure, and analysis are specified before interpretation."),
    material("c5-results", "RESULTS", "Results", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c5-statistics", "STATISTICS", "Statistics", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c5-discussion", "NOTE", "Discussion", "Discussion remains bounded by the supplied evidence state."),
    material("c5-conclusion", "NOTE", "Conclusion", "Conclusion retains the stated uncertainty and result status."),
    material("c5-citation", "CITATION", "Citation", "Wang et al. (2024). Evidence calibration in higher education."),
  ];
  for (const pendingText of [
    "Results are yet to be observed",
    "Results have not yet been independently observed",
    "Results haven't yet been observed",
  ]) {
    const materials = fullMaterials(pendingText);
    const classifier = classifyV2Beta1ResultEvidence(materials);
    const readiness = assessV2Beta1PublicationReadiness(materials);
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.deepEqual(
      [classifier.classification, classifier.consistencyProven, classifier.traceable, readiness.publicationUsable, readiness.reviewStatus],
      ["PLANNED", false, true, false, "READY_WITH_GAPS"],
      pendingText,
    );
    assert.deepEqual(
      [authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus],
      ["PLANNED", false, true, false, "READY_WITH_GAPS"],
      pendingText,
    );
    assert.equal(authority.clauses.some((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind) && item.state === "OBSERVED"), false, pendingText);
  }

  for (const observedText of [
    "The expected improvement was observed at 12%.",
    "Expected results were observed at 82%.",
    "The planned result has now been observed at 12%.",
  ]) {
    const authority = createV2Beta1EvidenceAuthority([material(`c5-observed-${beta1Hash(observedText).slice(0, 8)}`, "RESULTS", "Results", observedText)], "SCI");
    assert.equal(authority.summary.resultState, "OBSERVED", observedText);
    assert.equal(authority.clauses.some((item) => item.state === "PLANNED"), false, observedText);
  }
  for (const plannedText of ["Expected improvement is 12%.", "Planned results are 12%."]) {
    assert.equal(createV2Beta1EvidenceAuthority([material(`c5-nominal-${beta1Hash(plannedText).slice(0, 8)}`, "RESULTS", "Results", plannedText)], "SCI").summary.resultState, "PLANNED", plannedText);
  }

  for (const mixedText of [
    "主要參與率實際觀察為82%。預期提升76%。",
    "主要參與率實際觀察為82%；預期提升76%；",
    "Primary participation was observed at 82%. Expected improvement is 76%.",
    "Primary participation was observed at 82%; Expected improvement is 76%;",
  ]) {
    const materials = [material(`c5-mixed-${beta1Hash(mixedText).slice(0, 8)}`, "RESULTS", "結果", mixedText)];
    const propositions = tokenizeV2Beta1ResultPropositions(mixedText);
    const reduction = reduceV2Beta1ResultPropositionStates(propositions.map((item) => item.resultState));
    const classifier = classifyV2Beta1ResultEvidence(materials);
    const readiness = assessV2Beta1PublicationReadiness(materials);
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.deepEqual(propositions.map((item) => item.resultState), ["OBSERVED", "PLANNED"], mixedText);
    assert.deepEqual(reduction, { resultState: "OBSERVED", hasObserved: true, hasPlanned: true, hasMissing: false, hasUnresolved: false }, mixedText);
    assert.equal(classifier.classification, "OBSERVED", mixedText);
    assert.equal(readiness.hasBlockingMarker, true, mixedText);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.publicationUsable, authority.summary.reviewStatus], ["OBSERVED", false, false, "READY_WITH_GAPS"], mixedText);
  }

  const duplicateMixed = [
    material("c5-duplicate-result", "RESULTS", "結果", "主要參與率實際觀察為82%。預期提升76%。"),
    material("c5-duplicate-statistics", "STATISTICS", "統計", "主要參與率實際觀察為82%；預期提升76%；"),
  ];
  assert.equal(classifyV2Beta1ResultEvidence(duplicateMixed).classification, "OBSERVED");
  assert.deepEqual(
    [createV2Beta1EvidenceAuthority(duplicateMixed, "SCI").summary.consistencyProven, createV2Beta1EvidenceAuthority(duplicateMixed, "SCI").summary.publicationUsable],
    [false, false],
  );
  const genuineConflict = [
    material("c5-conflict-result", "RESULTS", "結果", "主要參與率實際觀察為82%。"),
    material("c5-conflict-statistics", "STATISTICS", "統計", "主要參與率實際觀察為76%。"),
  ];
  assert.equal(classifyV2Beta1ResultEvidence(genuineConflict).classification, "CONFLICT");
  assert.equal(createV2Beta1EvidenceAuthority(genuineConflict, "SCI").summary.resultState, "CONFLICT");
});

group("typed predicate structured clauses normalized numerics and content-only state fail closed", () => {
  const completeMaterials = (resultText, resultTitle = "Results") => [
    material("c6-abstract", "ABSTRACT", "Abstract", "This study examines evidence calibration without overstating the supplied result state."),
    material("c6-introduction", "INTRODUCTION", "Introduction", "Wang et al. (2024) motivates the bounded evidence comparison."),
    material("c6-methods", "METHODS", "Methods", "The sample, comparison, measure, and analysis are specified before interpretation."),
    material("c6-results", "RESULTS", resultTitle, `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c6-statistics", "STATISTICS", "Statistics", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c6-discussion", "NOTE", "Discussion", "Discussion remains bounded by the supplied evidence state."),
    material("c6-conclusion", "NOTE", "Conclusion", "Conclusion retains the stated uncertainty and result status."),
    material("c6-citation", "CITATION", "Citation", "Wang et al. (2024). Evidence calibration in higher education."),
  ];
  for (const pendingText of [
    "Results haven't been observed yet",
    "Results haven’t been observed yet",
    "Results have never been observed",
    "No results have been observed",
    "Results were not independently observed",
    "Results remain unobserved",
    "Results have not yet been statistically observed",
    "Results have not yet been robustly observed",
    "Results have not yet been externally observed",
    "Results have not yet been conclusively observed",
    "Results have not yet been independently and reliably observed",
    "Results have not yet been independently and externally observed",
    "Results cannot be considered observed",
    "Results cannot be observed",
    "Results can't be observed",
    "The findings cannot be regarded as observed",
    "Results lack independently observed evidence",
    "Results without being observed remain unavailable",
    "Results can not be observed",
  ]) {
    const materials = completeMaterials(pendingText);
    const classifier = classifyV2Beta1ResultEvidence(materials);
    const readiness = assessV2Beta1PublicationReadiness(materials);
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], ["PLANNED", false, true], pendingText);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [true, false, "READY_WITH_GAPS"], pendingText);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus], ["PLANNED", false, true, false, "READY_WITH_GAPS"], pendingText);
    assert.equal(authority.clauses.some((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind) && item.state === "OBSERVED"), false, pendingText);
  }
  for (const observedText of [
    "The expected improvement was observed at 12%",
    "Results can be observed",
    "Results have not only been observed but independently replicated",
  ]) {
    assert.equal(createV2Beta1EvidenceAuthority([material(`c6-observed-${beta1Hash(observedText).slice(0, 8)}`, "RESULTS", "Expected Results", observedText)], "SCI").summary.resultState, "OBSERVED", observedText);
  }

  for (const unboundedText of [
    "Results have not yet been independently externally observed",
    "Results have not yet been independently and externally and robustly observed",
  ]) {
    const materials = completeMaterials(unboundedText);
    const proposition = tokenizeV2Beta1ResultPropositions(materials[3].content).find((item) => item.raw.includes(unboundedText));
    const readiness = assessV2Beta1PublicationReadiness(materials);
    assert.equal(proposition?.resultState, "UNRESOLVED", unboundedText);
    assert.deepEqual([readiness.publicationUsable, readiness.reviewStatus], [false, "READY_WITH_GAPS"], unboundedText);
  }

  const unresolvedMixed = "metricId=score; cohortId=all; timepoint=post; analysisId=primary; Results were observed at 82%; Results cannot yet plausibly be considered fully observed; N=180; p=.04; 95% CI [0.02, 0.60].";
  const unresolvedPropositions = tokenizeV2Beta1ResultPropositions(unresolvedMixed);
  const unresolvedAuthority = createV2Beta1EvidenceAuthority([material("c7-unresolved-mixed", "RESULTS", "Results", unresolvedMixed)], "SCI");
  assert.deepEqual(unresolvedPropositions.map((item) => item.resultState), ["OBSERVED", "UNRESOLVED"]);
  assert.deepEqual([unresolvedAuthority.summary.resultState, unresolvedAuthority.summary.consistencyProven, unresolvedAuthority.summary.publicationUsable, unresolvedAuthority.summary.reviewStatus], ["OBSERVED", false, false, "READY_WITH_GAPS"]);

  for (const separator of [";", "；"]) {
    const mixed = `metricId=score${separator} cohortId=all${separator} timepoint=post${separator} analysisId=primary${separator} Primary participation was observed at 82%${separator} Expected improvement is 76%${separator}`;
    const propositions = tokenizeV2Beta1ResultPropositions(mixed);
    const authority = createV2Beta1EvidenceAuthority([material(`c6-structured-${separator.charCodeAt(0)}`, "RESULTS", "Results", mixed)], "SCI");
    assert.deepEqual(propositions.map((item) => item.resultState), ["OBSERVED", "PLANNED"], mixed);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.publicationUsable, authority.summary.reviewStatus], ["OBSERVED", false, false, "READY_WITH_GAPS"], mixed);
  }

  const asciiObserved = "metricId=score; cohortId=all; timepoint=post; analysisId=primary; Primary participation was observed at 82%; N=180; p=.04; 95% CI [0.02, 0.60].";
  const fullwidthObserved = "ｍｅｔｒｉｃＩｄ＝ｓｃｏｒｅ； ｃｏｈｏｒｔＩｄ＝ａｌｌ； ｔｉｍｅｐｏｉｎｔ＝ｐｏｓｔ； ａｎａｌｙｓｉｓＩｄ＝ｐｒｉｍａｒｙ； Primary participation was observed at ８２％； Ｎ＝１８０； ｐ＝０．０４； ９５％ CI [０．０２, ０．６０]。";
  const asciiEvidence = classifyV2Beta1ResultEvidence([material("c6-ascii", "RESULTS", "Results", asciiObserved)]);
  const fullwidthEvidence = classifyV2Beta1ResultEvidence([material("c6-fullwidth", "RESULTS", "Results", fullwidthObserved)]);
  assert.deepEqual(
    [fullwidthEvidence.classification, fullwidthEvidence.consistencyProven, fullwidthEvidence.traceable],
    [asciiEvidence.classification, asciiEvidence.consistencyProven, asciiEvidence.traceable],
  );
  const fullwidthRecords = extractV2Beta1StructuredEvidenceRecords(fullwidthObserved).records;
  assert.equal(fullwidthRecords.some((record) => record.rawAnchors.includes("Ｎ＝１８０") && record.rawAnchors.includes("ｐ＝０．０４")), true);

  const observedContent = "Results were observed at 12%";
  const titlePositive = completeMaterials(observedContent, "Expected / Planned Results");
  assert.equal(classifyV2Beta1ResultEvidence(titlePositive).classification, "OBSERVED");
  assert.equal(assessV2Beta1PublicationReadiness(titlePositive).publicationUsable, true);
  const titleNegative = completeMaterials("Results have not yet been observed", "Observed Results");
  assert.equal(classifyV2Beta1ResultEvidence(titleNegative).classification, "PLANNED");
  assert.equal(assessV2Beta1PublicationReadiness(titleNegative).publicationUsable, false);
});

group("role-local observation relations narrative effects and fullwidth leading decimals fail closed", () => {
  const completeMaterials = (resultText) => [
    material("c8-abstract", "ABSTRACT", "Abstract", "This study examines evidence calibration without overstating the supplied result state."),
    material("c8-introduction", "INTRODUCTION", "Introduction", "Wang et al. (2024) motivates the bounded evidence comparison."),
    material("c8-methods", "METHODS", "Methods", "The sample, comparison, measure, and analysis are specified before interpretation."),
    material("c8-results", "RESULTS", "Results", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c8-statistics", "STATISTICS", "Statistics", `metricId=score; cohortId=all; timepoint=post; analysisId=primary; ${resultText}; β = 0.31; N=180; p=.04; 95% CI [0.02, 0.60]; Wang et al. (2024).`),
    material("c8-discussion", "NOTE", "Discussion", "Discussion remains bounded by the supplied evidence state."),
    material("c8-conclusion", "NOTE", "Conclusion", "Conclusion retains the stated uncertainty and result status."),
    material("c8-citation", "CITATION", "Citation", "Wang et al. (2024). Evidence calibration in higher education."),
  ];
  const assertCompleteBlocking = (resultText, expectedState = "PLANNED") => {
    const materials = completeMaterials(resultText);
    const classifier = classifyV2Beta1ResultEvidence(materials);
    const readiness = assessV2Beta1PublicationReadiness(materials);
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], [expectedState, false, true], resultText);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [true, false, "READY_WITH_GAPS"], resultText);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus], [expectedState, false, true, false, "READY_WITH_GAPS"], resultText);
    assert.equal(authority.clauses.some((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind) && item.state === "OBSERVED"), false, resultText);
  };
  for (const pendingText of [
    "There is no observed evidence",
    "No observed evidence is available",
    "The study lacks observed evidence",
    "No evidence was observed",
    "Evidence was not observed",
    "Observed evidence is absent",
    "There was no directly observed support",
    "Analysis lacked empirically observed evidence",
    "No support has been formally observed",
    "Support has not been directly observed",
    "There is no independently and empirically observed evidence",
    "Observed support remained unavailable",
    "Findings lacked reliably observed support",
    "Evidence remains unobserved while Primary participation was observed at 82%",
    "Support remains unobserved although Primary participation was observed at 82%",
    "There is an absence of observed evidence while Primary participation was observed at 82%",
    "Observed findings remain absent",
    "Observed evidence is lacking",
    "The studies lacked reliably observed evidence",
    "The analyses are lacking observed evidence",
    "Evidence cannot be observed",
    "Evidence can not be observed",
    "Evidence could not be observed",
    "Evidence has yet to be observed",
    "Evidence will be observed",
    "There is not any observed evidence",
    "Observed evidence is not currently available",
  ]) {
    const materials = completeMaterials(pendingText);
    const classifier = classifyV2Beta1ResultEvidence(materials);
    const readiness = assessV2Beta1PublicationReadiness(materials);
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], ["PLANNED", false, true], pendingText);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [true, false, "READY_WITH_GAPS"], pendingText);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus], ["PLANNED", false, true, false, "READY_WITH_GAPS"], pendingText);
    assert.equal(authority.clauses.some((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind) && item.state === "OBSERVED"), false, pendingText);
  }
  for (const observedText of [
    "Evidence can be observed",
    "Evidence was not only observed but replicated",
    "Observed evidence remains available",
    "Observed support is present",
    "Observed evidence is not only available",
  ]) {
    const authority = createV2Beta1EvidenceAuthority([material(`c8-observed-${beta1Hash(observedText).slice(0, 8)}`, "RESULTS", "Results", observedText)], "SCI");
    assert.equal(authority.summary.resultState, "OBSERVED", observedText);
    assert.equal(authority.clauses.some((item) => item.state === "PLANNED"), false, observedText);
  }
  for (const mixedText of [
    "Evidence can be observed and there is no observed support.",
    "Evidence was not only observed but replicated and observed support remains unavailable.",
    "There is no observed support and Evidence can be observed.",
    "Observed support remains unavailable and Evidence was not only observed but replicated.",
  ]) {
    const mixedMaterials = completeMaterials(mixedText);
    const classifier = classifyV2Beta1ResultEvidence(mixedMaterials);
    const readiness = assessV2Beta1PublicationReadiness(mixedMaterials);
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], ["PLANNED", false, true], mixedText);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [true, false, "READY_WITH_GAPS"], mixedText);
  }
  for (const boundaryControl of ["Supportive practices remain available.", "Unsupported conclusions remain available.", "Evidence remains unobservedly available."]) {
    assert.equal(classifyV2Beta1ClauseResultState(boundaryControl), null, boundaryControl);
  }
  for (const unresolvedText of [
    "Evidence was not unexpectedly observed",
    "Evidence may be observed",
    "Evidence might be observed",
    "Evidence could be observed",
    "Evidence should be observed",
    "Evidence may not have been directly observed",
    "Evidence might not have been observed",
    "There is no independently empirically robustly observed evidence",
    "There is no directly empirically robustly externally conclusively observed evidence",
  ]) {
    const unresolvedAbsence = completeMaterials(unresolvedText);
    const unresolvedProposition = tokenizeV2Beta1ResultPropositions(unresolvedAbsence[3].content).find((item) => item.raw.includes(unresolvedText));
    assert.equal(unresolvedProposition?.resultState, "UNRESOLVED", unresolvedText);
    assert.deepEqual([assessV2Beta1PublicationReadiness(unresolvedAbsence).publicationUsable, assessV2Beta1PublicationReadiness(unresolvedAbsence).reviewStatus], [false, "READY_WITH_GAPS"], unresolvedText);
  }

  for (const nominalAbsence of [
    "An absence of observed findings remains",
    "The absence of observed evidence remains",
    "Absence of directly observed support remains",
    "A lack of observed evidence persists",
    "Lack of empirically observed evidence persists",
    "The lack of independently and empirically observed support was documented",
    "The lack of observed support was documented",
    "The absence of directly observed findings was reported",
    "Lack of empirically observed evidence was noted",
    "The absence of observed evidence was not only documented but reported",
    "The study does not have evidence that Primary participation was observed at 82%",
    "The authors report that no evidence was observed",
    "The authors report that the effect was not observed",
  ]) assertCompleteBlocking(nominalAbsence);

  for (const ambiguousNominal of [
    "An absence of independently empirically reliably observed evidence remains",
    "Lack of directly formally empirically observed support persists",
    "The absence of observed evidence was not established",
    "The study examined whether an absence of observed findings remained",
    "If a lack of observed support persists, the study will reassess the claim",
    "Was an absence of observed evidence documented?",
    "There may be no evidence that Primary participation was observed at 82%",
    "The study may lack evidence that Primary participation was observed at 82%",
    "Evidence might not show that Primary participation was observed at 82%",
    "The authors did not report that evidence was observed",
    "The study may lack observed evidence",
    "If evidence were observed, the model would be retained",
    "Evidence would be observed if the sample were larger",
    "The absence of observed evidence is well documented",
    "There is no evidence that Primary participation was not observed at 82%",
    "The authors hypothesized that no evidence was observed",
    "The authors could not confirm that evidence was observed",
    "Evidence does not verify that the effect was observed",
    "The investigators did not report that Primary participation was observed at 82%",
    "The study may not confirm observed evidence",
    "Evidence could not confirm that Primary participation was observed at 82%",
    "The study did not report observed evidence",
    "The study didn't report observed evidence",
  ]) {
    const materials = completeMaterials(ambiguousNominal);
    const proposition = tokenizeV2Beta1ResultPropositions(materials[3].content).find((item) => item.raw.includes(ambiguousNominal));
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    const readiness = assessV2Beta1PublicationReadiness(materials);
    assert.equal(proposition?.resultState, "UNRESOLVED", ambiguousNominal);
    assert.equal(authority.clauses.some((item) => item.state === "UNRESOLVED"), true, ambiguousNominal);
    assert.deepEqual([authority.summary.consistencyProven, authority.summary.publicationUsable, readiness.publicationUsable, readiness.reviewStatus], [false, false, false, "READY_WITH_GAPS"], ambiguousNominal);
  }

  for (const negativeGovernor of [
    "There is no evidence that Primary participation was observed at 82%",
    "There is not any evidence that Primary participation was observed at 82%",
    "The study lacks evidence that Primary participation was observed at 82%",
    "There is an absence of evidence that Primary participation was observed at 82%",
    "No evidence that Primary participation was observed at 82% is available",
    "No evidence shows that Primary participation was observed at 82%",
    "No evidence indicates that Primary participation was observed at 82%",
    "Evidence does not show that Primary participation was observed at 82%",
    "Evidence does not confirm that the effect was observed",
    "Evidence does not establish that the effect was observed",
    "Evidence fails to show that the effect was observed",
    "There is no direct evidence that Primary participation was observed at 82%",
    "Evidence cannot confirm that Primary participation was observed at 82%",
    "The data do not show that Primary participation was observed at 82%",
    "The materials do not indicate that Primary participation was observed at 82%",
    "The report does not establish that Primary participation was observed at 82%",
    "Evidence is insufficient to conclude that Primary participation was observed at 82%",
    "It was not demonstrated that Primary participation was observed at 82%",
    "Evidence does not show observed findings",
    "Evidence fails to show observed findings",
    "Evidence fails to confirm observed findings",
    "Evidence fails to establish observed findings",
    "Evidence doesn't show observed findings",
    "Evidence can't confirm that Primary participation was observed at 82%",
    "Evidence won't establish that Primary participation was observed at 82%",
    "Evidence will not establish that Primary participation was observed at 82%",
    "There is no sufficient evidence that Primary participation was observed at 82%",
    "There is no empirical evidence that Primary participation was observed at 82%",
    "The study lacks sufficient evidence that Primary participation was observed at 82%",
  ]) assertCompleteBlocking(negativeGovernor);

  const c13SubjectIndependentRelations = [
    "The dataset does not show that Primary participation was observed at 82%",
    "The table does not indicate that Primary participation was observed at 82%",
    "The model does not establish that Primary participation was observed at 82%",
    "The trial does not report that Primary participation was observed at 82%",
    "The article does not confirm that Primary participation was observed at 82%",
    "The experiment does not demonstrate that Primary participation was observed at 82%",
    "The empirical record does not document that Primary participation was observed at 82%",
    "Primary participation was not demonstrated to have been observed at 82%",
    "The association has not been shown to have been observed at 82%",
    "The effect could not be demonstrated to have been observed at 82%",
    "It could not be demonstrated that Primary participation was observed at 82%",
    "The effect could not be demonstrated",
    "The association has not been shown",
    "Primary participation has not been shown to be observed at 82%",
    "No evidence of Primary participation having been observed at 82% is available",
    "No empirical evidence of Primary participation being observed at 82% remains available",
    "Evidence is insufficient for concluding that Primary participation was observed at 82%",
    "Evidence is insufficient to conclude that Primary participation was observed at 82%",
  ];
  const c13AmbiguousRelations = new Set([
    "The trial does not report that Primary participation was observed at 82%",
    "The empirical record does not document that Primary participation was observed at 82%",
    "The effect could not be demonstrated to have been observed at 82%",
    "It could not be demonstrated that Primary participation was observed at 82%",
    "The effect could not be demonstrated",
    "The association has not been shown",
  ]);
  for (const relation of c13SubjectIndependentRelations.filter((item) => !c13AmbiguousRelations.has(item))) assertCompleteBlocking(relation);

  for (const c14BoundRelation of [
    "There is no evidence which establishes that Primary participation was observed at 82%",
    "The dataset and the table do not show Primary participation was observed at 82%",
    "No evidence documenting Primary participation as observed at 82% is available",
    "There is insufficient evidence to conclude that Primary participation was observed at 82%",
    "Sufficient evidence was not provided to establish that Primary participation was observed at 82%",
    "No evidence exists for Primary participation having been observed at 82%",
    "Primary participation was not established as having been observed at 82%",
    "Primary participation was not confirmed through having been observed at 82%",
    "Primary participation was not observed at 82%",
    "Primary participation was, after adjustment, not observed at 82%",
    "No observed effect emerged",
    "Neither Primary participation nor the association was observed",
    "Little evidence shows that Primary participation was observed at 82%",
    "Scant evidence indicates that Primary participation was observed at 82%",
    "Hardly any evidence establishes that Primary participation was observed at 82%",
    "Scarcely any evidence confirms that Primary participation was observed at 82%",
    "Primary participation is yet to be shown",
    "Support for Primary participation was absent",
    "Primary participation was reported without evidence",
    "It was impossible to establish that Primary participation was observed at 82%",
  ]) assertCompleteBlocking(c14BoundRelation);

  for (const unresolvedRelation of [
    ...c13AmbiguousRelations,
    "The archive does not contextualize that Primary participation was observed at 82%",
    "The effect may not have been demonstrated to have been observed at 82%",
    "Evidence is insufficient for speculating that Primary participation was observed at 82%",
    "The dataset, after independent review, does not substantiate that Primary participation was observed at 82%",
    "The archive does not, after review, show that Primary participation was observed at 82%",
    "Primary participation may not have been observed at 82%",
    "There is no evidence that Primary participation was not observed at 82%",
  ]) {
    const materials = completeMaterials(unresolvedRelation);
    const proposition = tokenizeV2Beta1ResultPropositions(materials[3].content).find((item) => item.raw.includes(unresolvedRelation));
    const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
    assert.equal(proposition?.resultState, "UNRESOLVED", unresolvedRelation);
    assert.deepEqual([authority.summary.consistencyProven, authority.summary.publicationUsable, authority.summary.reviewStatus], [false, false, "READY_WITH_GAPS"], unresolvedRelation);
  }

  for (const comparator of ["≤", "＜", "＝"]) {
    const fullwidthNegative = completeMaterials("Evidence cannot confirm that Primary participation was observed at 82%")
      .map((item) => ["RESULTS", "STATISTICS"].includes(item.kind)
        ? material(item.materialId, item.kind, item.title, item.content.replace("p=.04", `ｐ${comparator}．０５`))
        : item);
    const classifier = classifyV2Beta1ResultEvidence(fullwidthNegative);
    const readiness = assessV2Beta1PublicationReadiness(fullwidthNegative);
    const authority = createV2Beta1EvidenceAuthority(fullwidthNegative, "SCI");
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], ["PLANNED", false, true], comparator);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [true, false, "READY_WITH_GAPS"], comparator);
    assert.deepEqual([authority.summary.resultState, authority.summary.publicationUsable], ["PLANNED", false], comparator);
    const records = extractV2Beta1StructuredEvidenceRecords(fullwidthNegative[3].content).records;
    assert.equal(records.length, 1, comparator);
    assert.equal(records[0].rawAnchors.includes(`ｐ${comparator}．０５`), true, comparator);
  }

  for (const positiveRelation of [
    "The presence of observed evidence remains available",
    "The availability of observed evidence was documented",
    "Observed evidence remains available",
    "Observed support remains present",
    "There is evidence that the effect was observed",
    "The study provides evidence that the effect was observed",
    "Evidence shows that the effect was observed",
    "An absence variable predicted observed support",
    "An absence of reporting bias was noted while observed evidence remains available",
    "A lack of causal support was noted while observed evidence remains available",
    "Lack et al. (2024) reported the observed effect",
    "No evidence contradicted the observed effect",
    "Primary participation was observed at 82% and did not support unconditional causality",
    "The authors report that the effect was observed at 82%",
    "Evidence that did not show bias was observed in the trial",
    "Lack et al. (2024) reported that the effect was observed",
    "Lack of fit was observed at 0.12 points",
    "Evidence does not show that bias exists and Primary participation was observed at 82%",
    "There is no lack of evidence that Primary participation was observed at 82%",
    "The dataset did not fail to show that Primary participation was observed at 82%",
    "The dataset did not fail to demonstrate that Primary participation was observed at 82%",
    "It is not the case that Primary participation was not observed at 82%",
    "No dataset failed to show that Primary participation was observed at 82%",
    "The analysis never failed to show that Primary participation was observed at 82%",
    "There is no shortage of evidence that Primary participation was observed at 82%",
  ]) assert.equal(classifyV2Beta1ClauseResultState(positiveRelation), "OBSERVED", positiveRelation);

  for (const coordinated of [
    "There is no evidence that bias was observed and Primary participation was observed at 82%.",
    "Primary participation was observed at 82% and there is no evidence that bias was observed.",
  ]) {
    const propositions = tokenizeV2Beta1ResultPropositions(coordinated);
    const expectedStates = coordinated.startsWith("Primary") ? ["OBSERVED", "PLANNED"] : ["PLANNED", "OBSERVED"];
    assert.deepEqual(propositions.map((item) => item.resultState), expectedStates, coordinated);
    const reduction = reduceV2Beta1ResultPropositionStates(propositions.map((item) => item.resultState));
    assert.deepEqual([reduction.resultState, reduction.hasObserved, reduction.hasPlanned], ["OBSERVED", true, true], coordinated);
  }

  for (const nullControl of [
    "Lack et al. support the model",
    "The evidence does not support H1",
    "Lack of fit remains a diagnostic",
  ]) assert.equal(classifyV2Beta1ClauseResultState(nullControl), null, nullControl);

  for (const separated of [
    "Evidence does not show that bias exists. Primary participation was observed at 82%.",
    "Evidence does not show that bias exists; Primary participation was observed at 82%;",
  ]) {
    const states = tokenizeV2Beta1ResultPropositions(separated).map((item) => item.resultState);
    assert.equal(states.at(-1), "OBSERVED", separated);
    assert.equal(states.slice(0, -1).includes("PLANNED"), false, separated);
  }

  for (const comparator of ["≤", "＜", "＝"]) {
    const qualifierRow = `ｍｅｔｒｉｃＩｄ＝ｐａｒｔｉｃｉｐａｔｉｏｎ； ｃｏｈｏｒｔＩｄ＝ａｌｌ； ｔｉｍｅｐｏｉｎｔ＝ｐｏｓｔ； ａｎａｌｙｓｉｓＩｄ＝ｐｒｉｍａｒｙ； Primary participation was observed at ８２％ and did not support unconditional causality； Ｎ＝１８０； ｐ${comparator}．０５； ９５％ CI [０．０２, ０．６０]； Wang et al. (2024)。`;
    const qualifierMaterials = [
      material(`c10-abstract-${comparator}`, "ABSTRACT", "Abstract", "This study examines participation without overstating causal interpretation."),
      material(`c10-introduction-${comparator}`, "INTRODUCTION", "Introduction", "Wang et al. (2024) motivates the bounded evidence comparison."),
      material(`c10-methods-${comparator}`, "METHODS", "Methods", "The sample, comparison, measure, and analysis are specified before interpretation."),
      material(`c10-results-${comparator}`, "RESULTS", "Results", qualifierRow),
      material(`c10-statistics-${comparator}`, "STATISTICS", "Statistics", qualifierRow),
      material(`c10-discussion-${comparator}`, "NOTE", "Discussion", "Discussion retains the explicit causal-negation qualifier."),
      material(`c10-conclusion-${comparator}`, "NOTE", "Conclusion", "Conclusion remains bounded by the observed participation effect."),
      material(`c10-citation-${comparator}`, "CITATION", "Citation", "Wang et al. (2024). Evidence calibration in higher education."),
    ];
    const classifier = classifyV2Beta1ResultEvidence(qualifierMaterials);
    const readiness = assessV2Beta1PublicationReadiness(qualifierMaterials);
    const authority = createV2Beta1EvidenceAuthority(qualifierMaterials, "SCI");
    assert.deepEqual([classifier.classification, classifier.consistencyProven, classifier.traceable], ["OBSERVED", true, true], comparator);
    assert.deepEqual([readiness.hasBlockingMarker, readiness.publicationUsable, readiness.reviewStatus], [false, true, "FINAL_CONFIRMABLE"], comparator);
    assert.deepEqual([authority.summary.resultState, authority.summary.consistencyProven, authority.summary.traceable, authority.summary.publicationUsable, authority.summary.reviewStatus], ["OBSERVED", false, true, false, "READY_WITH_GAPS"], comparator);
    const records = extractV2Beta1StructuredEvidenceRecords(qualifierRow).records;
    assert.equal(records.length, 1, comparator);
    assert.equal(records[0].effects.some((effect) => effect.raw === "Primary participation was observed at ８２％" && effect.value === 82), true, comparator);
    assert.equal(records[0].sampleSizeSpans.includes("Ｎ＝１８０"), true, comparator);
    assert.equal(records[0].probabilitySpans.includes(`ｐ${comparator}．０５`), true, comparator);
    assert.equal(records[0].confidenceIntervalSpans.includes("９５％ CI [０．０２, ０．６０]"), true, comparator);
    assert.equal(records[0].citationSpans.includes("Wang et al. (2024)"), true, comparator);
    assert.equal(records[0].scopeSpans.some((span) => span.includes("did not support unconditional causality")), true, comparator);
    const qualifierRevision = `ｍｅｔｒｉｃＩｄ＝ｐａｒｔｉｃｉｐａｔｉｏｎ； ｃｏｈｏｒｔＩｄ＝ａｌｌ； ｔｉｍｅｐｏｉｎｔ＝ｐｏｓｔ； ａｎａｌｙｓｉｓＩｄ＝ｐｒｉｍａｒｙ； In the retained record, Primary participation was observed at ８２％ and did not support unconditional causality； Ｎ＝１８０； ｐ${comparator}．０５； ９５％ CI [０．０２, ０．６０]； Wang et al. (2024)。`;
    assert.equal(validateV2Beta1RevisionAnchors(qualifierRow, qualifierRevision), true, comparator);
  }

  const row = (metricId, value, analysisId = "primary", terminal = ".") => `metricId=${metricId}; cohortId=all; timepoint=post; analysisId=${analysisId}; Primary participation was observed at ${value}%${terminal}`;
  const sameKeyConflict = [material("c8-effect-result", "RESULTS", "Results", row("participation", 82)), material("c8-effect-statistics", "STATISTICS", "Statistics", row("participation", 76))];
  assert.equal(classifyV2Beta1ResultEvidence(sameKeyConflict).classification, "CONFLICT");
  const sameValue = [material("c8-effect-same-result", "RESULTS", "Results", row("participation", 82)), material("c8-effect-same-statistics", "STATISTICS", "Statistics", row("participation", 82))];
  assert.deepEqual([classifyV2Beta1ResultEvidence(sameValue).classification, classifyV2Beta1ResultEvidence(sameValue).consistencyProven], ["OBSERVED", true]);
  const differentKey = [material("c8-effect-different-result", "RESULTS", "Results", row("participation", 82)), material("c8-effect-different-statistics", "STATISTICS", "Statistics", row("completion", 76))];
  assert.notEqual(classifyV2Beta1ResultEvidence(differentKey).classification, "CONFLICT");
  const chineseSameKeyConflict = [
    material("c8-effect-zh-result", "RESULTS", "結果", "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; 主要參與率實際觀察為82%。"),
    material("c8-effect-zh-statistics", "STATISTICS", "統計", "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; 主要參與率實際觀察為76%。"),
  ];
  assert.equal(classifyV2Beta1ResultEvidence(chineseSameKeyConflict).classification, "CONFLICT");
  const plannedNumeric = [material("c8-effect-planned", "RESULTS", "Results", "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; Expected improvement is 82%.")];
  assert.equal(classifyV2Beta1ResultEvidence(plannedNumeric).classification, "PLANNED");
  for (const terminal of [".", ""]) {
    const records = extractV2Beta1StructuredEvidenceRecords(row("participation", 82, "primary", terminal)).records;
    assert.equal(records.length, 1, `narrative-record-${terminal || "none"}`);
    assert.equal(records[0].structured, true, `narrative-structured-${terminal || "none"}`);
    assert.deepEqual(records[0].effects.map(({ name, value, unit }) => ({ name, value, unit })), [{ name: "primary participation", value: 82, unit: "%" }]);
  }

  for (const comparator of ["≤", "＜", "＝"]) {
    const fullwidth = `ｍｅｔｒｉｃＩｄ＝ｐａｒｔｉｃｉｐａｔｉｏｎ； ｃｏｈｏｒｔＩｄ＝ａｌｌ； ｔｉｍｅｐｏｉｎｔ＝ｐｏｓｔ； ａｎａｌｙｓｉｓＩｄ＝ｐｒｉｍａｒｙ； Primary participation was observed at ８２％； Ｎ＝１８０； ｐ${comparator}．０５； ９５％ CI [０．０２, ０．６０]； Wang et al. (2024)。`;
    const propositions = tokenizeV2Beta1ResultPropositions(fullwidth);
    const records = extractV2Beta1StructuredEvidenceRecords(fullwidth).records;
    assert.equal(propositions.length, 1, comparator);
    assert.equal(records.length, 1, comparator);
    assert.equal(records[0].structured, true, comparator);
    assert.equal(records[0].rawAnchors.includes(`ｐ${comparator}．０５`), true, comparator);
    assert.equal(records[0].effects.some((effect) => effect.raw === "Primary participation was observed at ８２％" && effect.value === 82), true, comparator);
    const revision = `Wang et al. (2024) bounds the retained observation: ｍｅｔｒｉｃＩｄ＝ｐａｒｔｉｃｉｐａｔｉｏｎ； ｃｏｈｏｒｔＩｄ＝ａｌｌ； ｔｉｍｅｐｏｉｎｔ＝ｐｏｓｔ； ａｎａｌｙｓｉｓＩｄ＝ｐｒｉｍａｒｙ； Primary participation was observed at ８２％； Ｎ＝１８０； ｐ${comparator}．０５； ９５％ CI [０．０２, ０．６０]。`;
    assert.equal(validateV2Beta1RevisionAnchors(fullwidth, revision), true, comparator);
  }
  for (const ascii of ["p<.05", "p<=.05", "p=.05"]) assert.equal(tokenizeV2Beta1ResultPropositions(`metricId=score; cohortId=all; timepoint=post; analysisId=primary; Results were observed at 82%; ${ascii}.`).length, 1, ascii);
  assert.deepEqual(tokenizeV2Beta1ResultPropositions("Results were observed at 82％．Analysis remains pending．").map((item) => item.resultState), ["OBSERVED", "PLANNED"]);
});

group("tri-state evidence relation IR is exact and compositional", () => {
  const noRelation = deriveV2Beta1EvidenceRelationIR("Lack et al. support the model");
  assert.deepEqual(noRelation, { kind: "NO_RELATION", targets: [] });
  const bound = deriveV2Beta1EvidenceRelationIR("The data do not show that Primary participation was observed at 82%");
  assert.deepEqual(Object.keys(bound).sort(), ["auxiliaryOperatorChain", "complementSpan", "composedPolarity", "kind", "modifierSpan", "observationTarget", "reportingOrContradictionPredicate", "scope", "subjectSpan", "targetId", "targets"].sort());
  assert.equal(bound.kind, "BOUND");
  assert.equal(bound.kind === "BOUND" ? bound.composedPolarity : null, "ABSENT");
  assert.equal(bound.kind === "BOUND" ? bound.reportingOrContradictionPredicate?.value : null, "show");
  assert.equal(bound.kind === "BOUND" ? bound.observationTarget?.polarity : null, "PRESENT");
  assert.equal(bound.targets.every((target) => target.targetId.startsWith("observation:") && target.kind === "BOUND"), true);
  const incomplete = deriveV2Beta1EvidenceRelationIR("The archive does not contextualize that Primary participation was observed at 82%");
  assert.deepEqual(Object.keys(incomplete).sort(), ["auxiliaryOperatorChain", "complementSpan", "kind", "modifierSpan", "observationTarget", "reason", "reportingOrContradictionPredicate", "scope", "subjectSpan", "targetId", "targets"].sort());
  assert.equal(incomplete.kind, "INCOMPLETE");
  assert.equal(incomplete.kind === "INCOMPLETE" ? incomplete.reason : null, "NEGATIVE_GOVERNOR_TARGET_INCOMPLETE");
  const positive = deriveV2Beta1EvidenceRelationIR("No evidence contradicted the observed effect");
  assert.equal(positive.kind === "BOUND" ? positive.composedPolarity : null, "PRESENT");
});

group("explicit typed observations are source-bound and confirmation-gated", () => {
  const observedRow = "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; effectId=participation-rate; Primary participation was observed at 0.31 %; N=180; p<=0.04; 95% CI [0.02, 0.6]; citation=OWN_DATA.";
  const materials = [
    material("c16-abstract", "ABSTRACT", "Abstract", "This study examines participation without a causal claim."),
    material("c16-introduction", "INTRODUCTION", "Introduction", "The study defines a bounded association-level research question."),
    material("c16-methods", "METHODS", "Methods", "The sample, comparison, measurement, and analysis are specified."),
    material("c16-results", "RESULTS", "Results", observedRow),
    material("c16-statistics", "STATISTICS", "Statistics", observedRow),
    material("c16-discussion", "NOTE", "Discussion", "Interpretation remains association-only and preserves uncertainty."),
    material("c16-conclusion", "NOTE", "Conclusion", "The conclusion remains bounded by the confirmed record."),
  ];
  const context = {
    projectId: "project-c16-focus",
    baseRevision: 1,
    baseContentHash: beta1Hash({ revision: 1 }),
    outputTarget: "SCI",
    researchDirection: "Participation and evidence calibration",
    researchDomainHash: beta1Hash({ domain: "education" }),
    trustedScope: "local:test:project-c16-focus",
    materials,
  };
  const candidates = deriveV2Beta1ObservationCandidates(materials);
  assert.equal(candidates.length, 2);
  assert.equal(candidates.every((candidate) => candidate.status === "UNCONFIRMED_ADVISORY" && candidate.suggestedRecord !== null), true);
  const records = candidates.map((candidate, index) => createV2Beta1TypedObservationRecord({ ...candidate.suggestedRecord, recordId: `observation:c16-${index + 1}` }));
  const decisions = candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, decision: "CONFIRMED", recordHash: records[index].recordHash }));
  const authority = createV2Beta1ObservationConfirmationAuthority(context, decisions, records);
  assert.deepEqual(parseV2Beta1ObservationConfirmationAuthority(authority, context), authority);

  const unconfirmed = createV2Beta1EvidenceAuthority(materials, "SCI");
  assert.deepEqual([unconfirmed.summary.consistencyProven, unconfirmed.summary.publicationUsable, unconfirmed.summary.reviewStatus], [false, false, "READY_WITH_GAPS"]);
  const confirmed = createV2Beta1EvidenceAuthority(materials, "SCI", authority);
  assert.deepEqual([confirmed.summary.resultState, confirmed.summary.consistencyProven, confirmed.summary.traceable, confirmed.summary.publicationUsable, confirmed.summary.reviewStatus], ["OBSERVED", true, true, true, "FINAL_CONFIRMABLE"]);
  assert.equal(confirmed.recordBindings.length, records.length);
  assert.equal(new Set(confirmed.recordBindings.map((binding) => binding.claimId)).size, records.length);
  assert.equal(new Set(confirmed.recordBindings.map((binding) => binding.revisionBindingHash)).size, records.length);

  const authorityTamper = structuredClone(authority);
  authorityTamper.rendererVersion = "old-mike-v2-beta1/typed-observation-renderer/1";
  assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(authorityTamper, context), /beta1_observation/);
  const sourceTamper = structuredClone(context);
  sourceTamper.materials = materials.map((entry, index) => index === 3 ? material(entry.materialId, entry.kind, entry.title, `${entry.content} changed`) : entry);
  assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(authority, sourceTamper), /beta1_observation/);
  for (const contextTamper of [
    { ...context, baseRevision: 2 },
    { ...context, baseContentHash: beta1Hash({ revision: 2 }) },
    { ...context, outputTarget: "SSCI" },
    { ...context, researchDirection: `${context.researchDirection} changed` },
    { ...context, researchDomainHash: beta1Hash({ domain: "changed" }) },
    { ...context, trustedScope: `${context.trustedScope}:changed` },
  ]) assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(authority, contextTamper), /beta1_observation/);
  for (const [field, value] of [["estimate", "0.32"], ["direction", "NEGATIVE"], ["pValue", "0.05"], ["ci95Lower", "0.03"]]) {
    const tampered = structuredClone(authority);
    tampered.records[0][field] = value;
    assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(tampered, context), /beta1_observation/, field);
  }
  const citationTamper = structuredClone(authority);
  citationTamper.records[0].citation = { kind: "LITERATURE", identityKind: "DOI", identity: "10.1234/not-in-source", materialId: citationTamper.records[0].materialId, startByte: citationTamper.records[0].startByte, endByte: citationTamper.records[0].endByte, spanHash: citationTamper.records[0].spanHash };
  assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(citationTamper, context), /beta1_observation/);
  const orderTamper = { ...structuredClone(authority), records: [...authority.records].reverse() };
  assert.throws(() => parseV2Beta1ObservationConfirmationAuthority(orderTamper, context), /beta1_observation/);
  const bindingTamper = structuredClone(confirmed);
  bindingTamper.recordBindings[0].claimId = bindingTamper.recordBindings[1].claimId;
  bindingTamper.authorityHash = beta1Hash({ ...bindingTamper, authorityHash: undefined });
  assert.equal(validateV2Beta1EvidenceAuthority(bindingTamper, materials, "SCI", authority), false);

  const plannedRow = observedRow.replace("was observed", "has not yet been observed");
  const plannedMaterials = [material("c16-planned", "RESULTS", "Results", plannedRow)];
  const plannedCandidate = deriveV2Beta1ObservationCandidates(plannedMaterials)[0];
  assert.equal(plannedCandidate.suggestedRecord, null);
  const attemptedPlannedRecord = createV2Beta1TypedObservationRecord({ ...records[0], materialId: plannedCandidate.materialId, materialContentHash: plannedCandidate.materialContentHash, startByte: plannedCandidate.startByte, endByte: plannedCandidate.endByte, spanHash: plannedCandidate.spanHash, citation: { kind: "OWN_DATA", materialId: plannedCandidate.materialId, startByte: plannedCandidate.startByte, endByte: plannedCandidate.endByte, spanHash: plannedCandidate.spanHash }, recordId: "observation:c16-planned" });
  const plannedContext = { ...context, materials: plannedMaterials };
  assert.throws(() => createV2Beta1ObservationConfirmationAuthority(plannedContext, [{ candidateId: plannedCandidate.candidateId, decision: "CORRECTED", recordHash: attemptedPlannedRecord.recordHash }], [attemptedPlannedRecord]), /beta1_observation_source_state_invalid/);

  const conflictingMaterials = [
    material("c16-conflict-positive", "RESULTS", "Results", observedRow),
    material("c16-conflict-negative", "STATISTICS", "Statistics", observedRow.replace("0.31 %", "-0.31 %").replace("[0.02, 0.6]", "[-0.6, -0.02]")),
  ];
  const conflictingContext = { ...context, materials: conflictingMaterials };
  const conflictingCandidates = deriveV2Beta1ObservationCandidates(conflictingMaterials);
  const conflictingRecords = conflictingCandidates.map((candidate, index) => createV2Beta1TypedObservationRecord({ ...candidate.suggestedRecord, recordId: `observation:c16-conflict-${index + 1}` }));
  assert.throws(() => createV2Beta1ObservationConfirmationAuthority(conflictingContext, conflictingCandidates.map((candidate, index) => ({ candidateId: candidate.candidateId, decision: "CONFIRMED", recordHash: conflictingRecords[index].recordHash })), conflictingRecords), /beta1_observation_conflict/);

  const literatureMaterials = [...materials.map((entry) => (entry.kind === "RESULTS" || entry.kind === "STATISTICS") ? material(entry.materialId, entry.kind, entry.title, observedRow.replace("citation=OWN_DATA", "citation=DOI:10.1234/example.1")) : entry), material("c16-citation", "CITATION", "Reference", "DOI:10.1234/example.1")];
  const literatureContext = { ...context, materials: literatureMaterials };
  const literatureCandidates = deriveV2Beta1ObservationCandidates(literatureMaterials);
  const literatureRecords = literatureCandidates.map((candidate, index) => createV2Beta1TypedObservationRecord({ ...candidate.suggestedRecord, recordId: `observation:c16-literature-${index + 1}` }));
  const literatureAuthority = createV2Beta1ObservationConfirmationAuthority(literatureContext, literatureCandidates.map((candidate, index) => ({ candidateId: candidate.candidateId, decision: "CONFIRMED", recordHash: literatureRecords[index].recordHash })), literatureRecords);
  assert.equal(literatureAuthority.records.every((record) => record.citation.kind === "LITERATURE" && record.citation.identityKind === "DOI"), true);
  assert.equal(createV2Beta1EvidenceAuthority(literatureMaterials, "SCI", literatureAuthority).summary.reviewStatus, "FINAL_CONFIRMABLE");
});

group("typed observation exactness rendering citation and decision authority fail closed", () => {
  const observedRow = "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; effectId=participation-rate; Primary participation was observed at 0.3100 %; N=180; p<=0.040; 95% CI [0.020, 0.600]; citation=OWN_DATA.";
  const resultA = material("c17-results-a", "RESULTS", "Results A", observedRow);
  const resultB = material("c17-results-b", "STATISTICS", "Results B", observedRow);
  const materials = [material("c17-abstract", "ABSTRACT", "Abstract", "This study examines participation without a causal claim."), material("c17-introduction", "INTRODUCTION", "Introduction", "The research question and bounded mechanism are specified."), material("c17-methods", "METHODS", "Methods", "The sample, comparison, measurement, and analysis are specified."), resultA, resultB, material("c17-discussion", "NOTE", "Discussion", "Interpretation remains association-only and preserves uncertainty."), material("c17-conclusion", "NOTE", "Conclusion", "The conclusion remains bounded by the confirmed records.")];
  const candidates = deriveV2Beta1ObservationCandidates(materials);
  assert.equal(candidates.length, 2);
  const multiSentence = deriveV2Beta1ObservationCandidates([material("c17-multi", "RESULTS", "Multi", `Context sentence without a numeric claim. ${observedRow}`)]);
  assert.equal(multiSentence.length, 1);
  assert.equal(multiSentence[0].rawExcerpt, observedRow);
  assert.equal(candidates.every((candidate) => candidate.suggestedRecord?.estimate === "0.31" && candidate.suggestedRecord.pValue === "0.04" && candidate.suggestedRecord.ci95Lower === "0.02" && candidate.suggestedRecord.ci95Upper === "0.6"), true);
  const records = candidates.map((candidate, index) => createV2Beta1TypedObservationRecord({ ...candidate.suggestedRecord, estimate: "0.3100", pValue: "0.040", ci95Lower: "0.020", ci95Upper: "0.600", recordId: `observation:c17-${index + 1}` }));
  assert.equal(records.every((record) => record.estimate === "0.31" && record.pValue === "0.04" && record.ci95Lower === "0.02" && record.ci95Upper === "0.6"), true);
  assert.throws(() => createV2Beta1TypedObservationRecord({ ...records[0], unit: ".*", recordId: "observation:c17-injection" }), /beta1_observation_unit_invalid/);
  const context = { projectId: "project-c17-focus", baseRevision: 3, baseContentHash: beta1Hash({ revision: 3 }), outputTarget: "SCI", researchDirection: "Typed observation exactness", researchDomainHash: beta1Hash({ domain: "education" }), trustedScope: "local:test:project-c17-focus", materials };
  const decisions = candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, decision: "CORRECTED", recordHash: records[index].recordHash }));
  const authority = createV2Beta1ObservationConfirmationAuthority(context, decisions, records);
  assert.deepEqual(parseV2Beta1ObservationConfirmationAuthority(authority, context), authority);
  const rendered = records.map(renderV2Beta1TypedObservationRecord);
  assert.equal(new Set(rendered.map((item) => item.claimId)).size, 2);
  assert.equal(rendered.every((item) => item.renderedClaimText.includes(item.claimId) && item.renderedClaimHash === beta1Hash(item.renderedClaimText)), true);
  const confirmed = createV2Beta1EvidenceAuthority(materials, "SCI", authority);
  assert.equal(confirmed.summary.reviewStatus, "FINAL_CONFIRMABLE");
  assert.equal(confirmed.recordBindings.every((binding) => binding.renderedClaimText === binding.revisionText && binding.renderedClaimHash === binding.revisionTextHash), true);
  const revisionOmission = structuredClone(confirmed); revisionOmission.recordBindings[0].revisionText = "free assertion"; revisionOmission.recordBindings[0].revisionTextHash = beta1Hash("free assertion"); revisionOmission.recordBindings[0].revisionBindingHash = beta1Hash(revisionOmission.recordBindings[0]); revisionOmission.authorityHash = beta1Hash({ ...revisionOmission, authorityHash: undefined });
  assert.equal(validateV2Beta1EvidenceAuthority(revisionOmission, materials, "SCI", authority), false);
  const mixedDecisions = [{ candidateId: candidates[0].candidateId, decision: "CONFIRMED", recordHash: createV2Beta1TypedObservationRecord(candidates[0].suggestedRecord).recordHash }, { candidateId: candidates[1].candidateId, decision: "EXCLUDED", recordHash: null }];
  const mixedRecord = createV2Beta1TypedObservationRecord(candidates[0].suggestedRecord);
  mixedDecisions[0].recordHash = mixedRecord.recordHash;
  const mixedAuthority = createV2Beta1ObservationConfirmationAuthority(context, mixedDecisions, [mixedRecord]);
  assert.equal(createV2Beta1EvidenceAuthority(materials, "SCI", mixedAuthority).summary.publicationUsable, false);
  assert.throws(() => createV2Beta1ObservationConfirmationAuthority(context, decisions.map((decision, index) => index ? decision : { ...decision, decision: "APPROVED" }), records), /beta1_observation_decision_invalid/);
  const fabricated = deriveV2Beta1ObservationCandidates([material("c17-fabricated", "RESULTS", "Results", observedRow.replace("citation=OWN_DATA", "citation=DOI:10.1234/fabricated.1"))]);
  assert.equal(fabricated[0].suggestedRecord, null);
});

group("material authority is byte/hash/order/context bound", () => {
  const materials = [material("m1", "METHODS", "方法", "採混合方法。"), material("r1", "RESULTS", "結果", "目前觀察到描述性差異。")];
  const authority = createV2Beta1EvidenceAuthority(materials, "SCI");
  assert.equal(validateV2Beta1EvidenceAuthority(authority, materials, "SCI"), true);
  assert.equal(validateV2Beta1EvidenceAuthority(authority, [...materials].reverse(), "SCI"), false);
  assert.equal(validateV2Beta1EvidenceAuthority(authority, [{ ...materials[0], content: `${materials[0].content}變更` }, materials[1]], "SCI"), false);
  assert.equal(validateV2Beta1EvidenceAuthority(authority, materials, "SSCI"), false);
});

group("coherently rehashed cross-target lane domain and material projections reject", () => {
  const materials = [material("m1", "METHODS", "方法", "採混合方法並核對樣本。")];
  const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, "SCI");
  const parent = { outputTarget: "SCI", lane: "BALANCED_RECOMMENDED", domain, researchDirection: "儀器品質與任務表現", materials, evidenceAuthority };
  const expected = createV2Beta1ProfessionalProjection(parent);
  const changedDomain = { label: "能源管理", selectionHash: beta1Hash({ id: "energy" }) };
  const domainProjection = createV2Beta1ProfessionalProjection({ ...parent, domain: changedDomain });
  const laneProjection = createV2Beta1ProfessionalProjection({ ...parent, lane: "FRONTIER_INNOVATION" });
  const changedMaterials = [material("m2", "METHODS", "方法", "改採不同樣本與量測。")];
  const changedEvidence = createV2Beta1EvidenceAuthority(changedMaterials, "SCI");
  const materialProjection = createV2Beta1ProfessionalProjection({ ...parent, materials: changedMaterials, evidenceAuthority: changedEvidence });
  assert.equal(validateV2Beta1ProfessionalProjection(expected, parent), true);
  for (const forged of [domainProjection, laneProjection, materialProjection]) assert.equal(validateV2Beta1ProfessionalProjection(forged, parent), false);
});

group("three lanes materially differ across question mechanism method contribution S0 and final preview", () => {
  const materials = [material("m1", "METHODS", "方法", "採混合方法並核對樣本。")];
  const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, "SCI");
  const projections = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"].map((lane) => createV2Beta1ProfessionalProjection({ outputTarget: "SCI", lane, domain, researchDirection: "儀器品質與任務表現", materials, evidenceAuthority }));
  for (const key of ["title", "researchQuestion", "mechanism", "method", "contribution"]) assert.equal(new Set(projections.map((item) => item[key])).size, 3, key);
  assert.equal(new Set(projections.map((item) => beta1Hash(item.s0))).size, 3);
  assert.equal(new Set(projections.map((item) => item.preview.contentHash)).size, 3);
});

group("field assist prose is lossless bounded and constructor-bound across SSCI SCI and MOE", () => {
  const mixedPunctuation = /(?:。，|。；|；，|，。|，；)/u;
  const editableFields = S0_FIELD_NAMES.filter((field) => field !== "domain" && field !== "outputTrack");
  let sourceSegmentCount = 0;
  for (const outputTarget of ["SSCI", "SCI", "MOE"]) {
    const allOptions = [];
    const domainAuthority = { label: "教育與學習科學", selectionHash: beta1Hash({ outputTarget, domain: "education" }) };
    for (const lane of V2_BETA1_DIRECTION_LANES) {
      const marker = `${outputTarget}-${lane}`;
      const title = `生成式回饋的證據校準、作用機制與跨情境邊界…保留使用者原始省略號，尾端否證準則【TITLE:${marker}】`;
      const researchQuestion = `核心機制如何影響結果，並在不同對象、場域與實作忠實度下產生可審查差異；缺乏相符證據時不得宣稱因果【QUESTION:${marker}】`;
      const existingData = `現有材料包含方法、結果與統計紀錄，但樣本分母、引用定位與不確定性仍待核對，因此不得把計畫值當成已觀察證據【EXISTING:${marker}】`;
      const s0 = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, field === "workingTitle" ? title : field === "domain" ? domainAuthority.label : field === "outputTrack" ? outputTarget : field === "existingData" ? existingData : `${outputTarget}-${lane}-${field}-父層內容`]));
      const parent = {
        direction: {
          lane,
          directionHash: beta1Hash({ outputTarget, lane, authority: "direction" }),
          inputBundleHash: beta1Hash({ outputTarget, lane, authority: "input" }),
          title,
          researchQuestion,
          mechanism: "以機制檢驗、實作忠實度與情境調節共同解釋成效。",
          contribution: "在理論辨識、方法可行性與實務價值之間形成平衡且可審查的貢獻。",
          method: "採準實驗或縱貫混合方法，結合主要結果、機制變項、歷程與情境比較。",
          s0,
        },
        domain: domainAuthority,
        outputTarget,
      };
      const parentOptions = [];
      for (const field of S0_FIELD_NAMES) {
        const options = createV2Beta1AssistOptions(parent, field);
        assert.deepEqual(options.map((option) => option.strategy), [...V2_BETA1_REVIEW_STRATEGIES]);
        assert.deepEqual(options.map((option) => option.recommended), [false, true, false]);
        assert.equal(new Set(options.map((option) => option.text)).size, 3);
        for (const option of options) {
          assert.equal(validateV2Beta1AssistOptionContent(option), true, `${outputTarget}:${lane}:${field}:${option.strategy}`);
          assert.equal(mixedPunctuation.test(option.text), false, `${outputTarget}:${lane}:${field}:${option.strategy}`);
          assert.equal(option.rationale.includes(title), true, `${outputTarget}:${lane}:${field}:${option.strategy}:rationale-full-title`);
          if (editableFields.includes(field)) {
            assert.equal(option.text, option.applyValue, `${outputTarget}:${lane}:${field}:${option.strategy}`);
            assert.equal(option.text.length <= S0_FIELD_LIMITS[field], true, `${outputTarget}:${lane}:${field}:${option.strategy}:${option.text.length}`);
          } else {
            assert.equal(option.applyValue, field === "domain" ? domainAuthority.label : outputTarget);
          }
        }
        if (field === "methodIdea") {
          const balanced = options[1].text;
          assert.match(balanced, /^以「[^」]+」的主要結果、機制變項、實作忠實度與情境差異建立同一分析契約。$/u);
          assert.equal((balanced.match(/[。！？]/gu) ?? []).length, 1);
        }
        allOptions.push(...options);
        parentOptions.push(...options);
      }
      for (const [sourceLabel, segment] of [["title", title], ["question", researchQuestion], ["existingData", existingData]]) {
        assert.equal(parentOptions.some((option) => option.text.includes(segment)), true, `${marker}:${sourceLabel}:full-segment`);
        assert.equal(parentOptions.some((option) => option.text.includes(`【${sourceLabel === "title" ? "TITLE" : sourceLabel === "question" ? "QUESTION" : "EXISTING"}:${marker}】`)), true, `${marker}:${sourceLabel}:tail`);
        sourceSegmentCount += 1;
      }
      assert.equal(parentOptions.filter((option) => option.text.includes("…")).every((option) => option.text.includes(title)), true, `${marker}:literal-ellipsis-only`);
    }
    assert.deepEqual({ total: allOptions.length, editable: allOptions.filter((option) => editableFields.includes(option.field)).length, immutable: allOptions.filter((option) => !editableFields.includes(option.field)).length }, { total: 117, editable: 99, immutable: 18 });
    assert.equal(new Set(allOptions.map((option) => option.optionId)).size, 117);
    assert.equal(new Set(allOptions.map((option) => option.optionHash)).size, 117);
  }
  assert.equal(sourceSegmentCount, 27);

  const parent = {
    direction: {
      lane: "BALANCED_RECOMMENDED",
      directionHash: beta1Hash({ fixture: "c18-direction" }),
      inputBundleHash: beta1Hash({ fixture: "c18-input" }),
      title: "生成式回饋與證據校準",
      researchQuestion: "如何建立可審查的研究設計？",
      mechanism: "以證據與機制共同回答。",
      contribution: "形成可審查的理論與實作貢獻。",
      method: "採混合方法完成分析。",
      s0: Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, field === "domain" ? "教育與學習科學" : field === "outputTrack" ? "SSCI" : `${field} 父層內容`])),
    },
    domain: { label: "教育與學習科學", selectionHash: beta1Hash({ fixture: "c18-domain" }) },
    outputTarget: "SSCI",
  };
  const base = createV2Beta1AssistOptions(parent, "methodIdea")[0];
  assert.equal(validateV2Beta1AssistOptionAgainstParent(base, parent), true);
  const crossParent = structuredClone(parent);
  crossParent.direction.title = `${parent.direction.title}不同父層`;
  assert.equal(validateV2Beta1AssistOptionAgainstParent(base, crossParent), false);
  const longComplete = `採方法分析與比較設計，${"完整保留量測、估計、敏感度與否證條件，".repeat(8)}不得省略尾端證據界線。`;
  assert.equal(longComplete.length > 120, true);
  const longCompleteOption = { ...base, text: longComplete, applyValue: longComplete };
  longCompleteOption.optionHash = beta1Hash(v2Beta1AssistOptionCore(longCompleteOption));
  assert.equal(validateV2Beta1AssistOptionContent(longCompleteOption), true);
  for (const value of ["採方法分析。，並完成比較設計。"] ) {
    const forged = { ...base, text: value, applyValue: value };
    forged.optionHash = beta1Hash(v2Beta1AssistOptionCore(forged));
    assert.equal(validateV2Beta1AssistOptionContent(forged), false);
  }
  const mismatch = { ...base, text: `${base.text}另稿` };
  mismatch.optionHash = beta1Hash(v2Beta1AssistOptionCore(mismatch));
  assert.equal(validateV2Beta1AssistOptionContent(mismatch), false);
  const coherentTextTamper = { ...base, text: longComplete, applyValue: longComplete };
  coherentTextTamper.optionHash = beta1Hash(v2Beta1AssistOptionCore(coherentTextTamper));
  assert.equal(validateV2Beta1AssistOptionContent(coherentTextTamper), true);
  assert.equal(validateV2Beta1AssistOptionAgainstParent(coherentTextTamper, parent), false);
  const overLimitParent = structuredClone(parent);
  overLimitParent.direction.s0.existingData = `資料${"界".repeat(S0_FIELD_LIMITS.existingData)}`;
  assert.throws(() => createV2Beta1AssistOptions(overLimitParent, "existingData"), /beta1_assist_parent_s0_invalid/);
});

group("primary human draft is readable and projection-hash bound", () => {
  const materials = [material("m1", "METHODS", "方法", "採混合方法並核對樣本與量測。")];
  const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, "MOE");
  const projection = createV2Beta1ProfessionalProjection({ outputTarget: "MOE", lane: "BALANCED_RECOMMENDED", domain, researchDirection: "課堂回饋與學習表現", materials, evidenceAuthority });
  const fieldAssist = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, [0, 1, 2].map((index) => ({ text: `${field} 專業方案 ${index + 1}`, rationale: `此方案直接回應 ${field} 的證據界線與成果路徑。`, risk: `若 ${field} 的來源不足，應保留待確認狀態。` }))]));
  const authority = createV2Beta1HumanDraftAuthority({ projection, evidenceAuthority, fieldAssist, evidenceGapMap: [{ state: "MISSING", statement: "結果材料仍缺少。" }], analysisWorkPackages: [{ title: "證據盤點", objective: "核對來源與缺口。", steps: ["核對材料"], deliverables: ["缺口圖"] }], continuationSections: Object.entries(projection.preview.sections).map(([sectionId, text]) => ({ sectionId, text })), journal: null, taiwanProposal: null });
  assert.match(authority.humanDraft, /^# /);
  assert.match(authority.humanDraft, /## 13 欄研究摘要/);
  assert.match(authority.humanDraft, /## 最終人工關卡/);
  assert.doesNotMatch(authority.humanDraft, /EVIDENCE_FIRST|CAUSAL_MECHANISM|FRONTIER_INNOVATION|BALANCED_RECOMMENDED|"schemaId"|^[{]/m);
  assert.equal(authority.projectionHash, beta1Hash(`${authority.projectionVersion}${authority.humanDraft}`));
});

console.log(JSON.stringify({ status: "PASS", groups }));
