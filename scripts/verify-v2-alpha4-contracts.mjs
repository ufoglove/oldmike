import assert from "node:assert/strict";

import {
  V2_ALPHA4_REVIEW_LENSES,
  V2_ALPHA4_SOURCE_CONTRACTS,
  V2_ALPHA4_STAGE_RAIL,
  V2_ALPHA4_STATUS_VALUES,
  V2_ALPHA4_TARGETS,
  assertResearchIntentPropagation,
  createResearchIntentBinding,
  createTargetSelection,
  evaluateReadyForHumanSubmission,
  parseCitationAudit,
  parseFiveLensReview,
  parseJournalIdentityAuthority,
  parseJournalPolicySnapshot,
  parseJournalRecentCorpus,
  parseCrossrefDoiMetadata,
  parseJournalFitAssessment,
  parseManuscriptArtifact,
  parseReviewResponseLedger,
} from "../lib/v2-alpha4/contracts.ts";
import { createSyntheticAlpha4Workspace, createV2Alpha4Coordinator } from "../lib/v2-alpha4/runtime.ts";
import { createBuiltinDomainSelection } from "../lib/v2-alpha3/contracts.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const throws = (fn, pattern, message) => { assertions += 1; assert.throws(fn, pattern, message); };

const targetLabels = [
  "SCI 國際期刊（實際以 SCIE 收錄驗證）",
  "SSCI 國際期刊",
  "國科會專題研究計畫（原科技部）",
  "教育部教學實踐研究計畫",
];
equal(V2_ALPHA4_TARGETS.map(({ id }) => id), ["SCI", "SSCI", "NSTC", "MOE"], "exact stable target ids");
equal(V2_ALPHA4_TARGETS.map(({ label }) => label), targetLabels, "exact target labels");
equal(V2_ALPHA4_TARGETS.map(({ enabled }) => enabled), [true, true, false, false], "SCI SSCI enabled and Alpha5 targets upcoming");
equal(V2_ALPHA4_STATUS_VALUES, ["READY", "NEEDS_FIX", "BLOCKED", "STALE"], "status vocabulary closed");
equal(V2_ALPHA4_STAGE_RAIL.length, 11, "zero-to-finish rail exact eleven stages");
equal(V2_ALPHA4_REVIEW_LENSES, ["EIC", "METHODOLOGY", "DOMAIN", "PERSPECTIVE", "DEVILS_ADVOCATE"], "five independent lenses exact");
equal(V2_ALPHA4_SOURCE_CONTRACTS.GOOGLE_SCHOLAR.mode, "NO_SCRAPING", "Google Scholar scraping forbidden");
ok(Object.values(V2_ALPHA4_SOURCE_CONTRACTS).every(({ liveEnabled }) => liveEnabled === false), "all source connectors local contract only");

const domain = createBuiltinDomainSelection("ai-education");
const target = createTargetSelection("SCI");
const intent = createResearchIntentBinding({ domainSelection: domain, targetSelection: target });
ok(/^[0-9a-f]{64}$/u.test(intent.researchIntentHash), "research intent is hash bound");
equal(intent.domainSelectionHash, domain.selectionHash, "domain hash retained");
equal(intent.outputTargetId, "SCI", "target retained");
throws(() => createTargetSelection("NSTC"), /target_upcoming_alpha5/u, "upcoming target cannot execute");

const scie = parseJournalIdentityAuthority({
  schemaId: "old-mike-v2-alpha4/journal-identity/1",
  journalId: "journal-fixture-scie",
  title: "Journal of Evidence-Calibrated Teaching",
  issn: ["1234-5678"],
  issnL: "1234-5678",
  verifiedCollection: "SCIE",
  verifiedAt: "2026-08-24T08:00:00.000Z",
  sourceDate: "2026-08-01",
  snapshotHash: "a".repeat(64),
  freshness: "CURRENT",
  targetId: "SCI",
  additiveIgnored: true,
});
equal(scie.verifiedCollection, "SCIE", "SCI consumes exact SCIE authority");
throws(() => parseJournalIdentityAuthority({ ...scie, verifiedCollection: "ESCI", jif: 9.9 }), /journal_collection_target_mismatch/u, "ESCI plus JIF cannot satisfy SCI");
throws(() => parseJournalIdentityAuthority({ ...scie, targetId: "SSCI", verifiedCollection: "SCIE" }), /journal_collection_target_mismatch/u, "SSCI requires exact SSCI");

const policy = parseJournalPolicySnapshot({
  schemaId: "old-mike-v2-alpha4/journal-policy/1",
  journalId: scie.journalId,
  scope: ["teacher decision making", "evidence-informed educational technology"],
  articleTypes: ["Original Research"],
  authorGuide: { wordLimit: "VERIFY_OFFICIAL_SOURCE", figures: "VERIFY_OFFICIAL_SOURCE" },
  ethicsPolicy: "Human-participant ethics statement required when applicable.",
  aiPolicy: "AI assistance must be disclosed according to the current author guide.",
  dataPolicy: "A data-availability statement is required.",
  feeAndOa: "Fee and open-access status require current official verification.",
  submissionChecklist: ["title page", "anonymous manuscript", "cover letter"],
  verifiedAt: "2026-08-24T08:00:00.000Z",
  sourceDate: "2026-08-20",
  snapshotHash: "b".repeat(64),
  freshness: "CURRENT",
});
equal(policy.freshness, "CURRENT", "official policy current");
equal(parseJournalPolicySnapshot({ ...policy, freshness: "STALE" }).freshness, "STALE", "stale policy remains visible");
equal(parseJournalPolicySnapshot({ ...policy, freshness: "MISSING" }).freshness, "MISSING", "missing policy remains visible");

const corpus = parseJournalRecentCorpus({
  schemaId: "old-mike-v2-alpha4/journal-recent-corpus/1",
  journalId: scie.journalId,
  publicLabel: "近期已發表內容的可觀察模式",
  period: { from: "2024-01-01", to: "2026-07-31" },
  itemCount: 24,
  observedTopics: ["教師決策校準"],
  observedMethods: ["混合方法"],
  observedPopulations: ["高等教育教師"],
  observedArticleTypes: ["Original Research"],
  officialIssueCount: 6,
  officialSpecialCollections: ["合成特刊 fixture"],
  officialCalls: ["合成徵稿 fixture"],
  sourceDate: "2026-08-20",
  snapshotHash: "e".repeat(64),
  freshness: "CURRENT",
  confidence: "MEDIUM",
  counterEvidence: ["部分近期文章採純質性設計。"],
});
equal(corpus.publicLabel, "近期已發表內容的可觀察模式", "public corpus wording exact");
equal([corpus.officialIssueCount, corpus.officialSpecialCollections.length, corpus.officialCalls.length], [6, 1, 1], "official issues special collections and calls retained");
throws(() => parseJournalRecentCorpus({ ...corpus, privateEditorialPreference: "偏好此主題" }), /journal_corpus_semantic_extra_key/u, "private preference forbidden");
throws(() => parseJournalRecentCorpus({ ...corpus, acceptanceProbability: 0.72 }), /journal_corpus_semantic_extra_key/u, "acceptance probability forbidden");
const crossref = parseCrossrefDoiMetadata({ schemaId: "old-mike-v2-alpha4/crossref-doi/1", doi: "https://doi.org/10.1000/Fixture.1", title: "Evidence calibration", issuedYear: 2025, containerTitle: "Journal of Evidence", metadataStatus: "MATCH", sourceDate: "2026-08-24", snapshotHash: "d".repeat(64), additiveIgnored: true });
equal(crossref.doi, "10.1000/fixture.1", "Crossref DOI normalized for metadata cross-check");

const workspace = createSyntheticAlpha4Workspace({
  domainSelection: domain,
  targetSelection: target,
  researchDirection: "生成式工具如何影響教師以證據修正課程決策",
});
equal(workspace.directions.length, 3, "exactly three directions");
equal(new Set(workspace.directions.map(({ lane }) => lane)).size, 3, "three direction lanes distinct");
equal(workspace.journals.length, 3, "exactly three journals for selected direction");
equal(workspace.journals.filter(({ recommended }) => recommended).length, 1, "one recommended direction journal combination");
equal(Object.keys(workspace.s0.fields).length, 13, "complete thirteen-field S0");
ok(Object.values(workspace.s0.fields).every((value) => typeof value === "string" && value.trim()), "all S0 values nonempty");
equal(workspace.formalResearchWriteCount, 0, "formal writes zero");
equal(workspace.externalSubmissionCount, 0, "external submission zero");
ok(assertResearchIntentPropagation(workspace, intent.researchIntentHash), "research intent propagates through all artifacts");
equal(parseJournalFitAssessment(workspace.journals[0].fit).status, "READY", "typed journal fit blueprint passes");
equal(parseManuscriptArtifact(workspace.manuscript).formalWriteCount, 0, "typed manuscript artifact remains draft-only");

const citationPass = parseCitationAudit({
  schemaId: "old-mike-v2-alpha4/citation-audit/1",
  entries: [{ citationId: "cite-1", existence: "PASS", metadata: "PASS", context: "PASS", sourceSnapshotHash: "c".repeat(64), note: "三軸均由獨立新鮮查核契約通過。" }],
});
equal(citationPass.status, "READY", "citation three-axis pass ready");
const metadataDrift = parseCitationAudit({ schemaId: citationPass.schemaId, entries: [{ ...citationPass.entries[0], metadata: "NEEDS_FIX" }] });
equal(metadataDrift.status, "NEEDS_FIX", "metadata-only drift distinct");
const wrongContext = parseCitationAudit({ schemaId: citationPass.schemaId, entries: [{ ...citationPass.entries[0], context: "FAIL" }] });
equal(wrongContext.status, "BLOCKED", "wrong-context citation blocks ready");
const missingCitation = parseCitationAudit({ schemaId: citationPass.schemaId, entries: [{ ...citationPass.entries[0], existence: "FAIL" }] });
equal(missingCitation.status, "BLOCKED", "fabricated or missing citation blocks ready");

const review = parseFiveLensReview(workspace.review);
equal(review.reports.length, 5, "five independent review reports");
equal(review.reports.map(({ lens }) => lens), V2_ALPHA4_REVIEW_LENSES, "review lenses exact and ordered");
equal(review.readOnly, true, "review is read-only");
ok(review.daCriticalAdjudications.every(({ status }) => status === "RESOLVED" || status === "REJECTED_WITH_RATIONALE"), "every DA critical visibly adjudicated");
throws(() => parseFiveLensReview({ ...workspace.review, daCriticalAdjudications: [] }), /da_critical_unadjudicated/u, "unadjudicated DA critical fails");

const responseLedger = parseReviewResponseLedger(workspace.responseLedger);
equal(responseLedger.items.length, workspace.review.reports.reduce((sum, report) => sum + report.findings.length, 0), "every reviewer finding accounted for");
ok(responseLedger.items.every(({ changeLocation, response }) => changeLocation && response), "response ledger has exact locations and responses");

const ready = evaluateReadyForHumanSubmission(workspace.submissionAudit);
equal(ready.status, "READY", "all submission conditions ready");
equal(ready.externalSubmissionEnabled, false, "external submission remains disabled");
throws(() => evaluateReadyForHumanSubmission({ ...workspace.submissionAudit, revisionLoopCount: 3 }), /revision_loop_limit_exceeded/u, "revision loops capped at two");
equal(evaluateReadyForHumanSubmission({ ...workspace.submissionAudit, journalIdentityFreshness: "STALE" }).status, "STALE", "stale MJL blocks ready without hiding recommendation");
equal(evaluateReadyForHumanSubmission({ ...workspace.submissionAudit, citationAuditStatus: "BLOCKED" }).status, "BLOCKED", "citation context failure blocks submission readiness");
throws(() => evaluateReadyForHumanSubmission({ ...workspace.submissionAudit, coverLetterClaimsTraceable: false, status: "READY" }), /cover_letter_traceability_invalid/u, "cover letter claims must trace");

let submissions = 0;
const coordinator = createV2Alpha4Coordinator({ generate: async (request) => { submissions += 1; return createSyntheticAlpha4Workspace(request); } });
const request = { scope: "workspace-alpha4:user-alpha4", requestId: "alpha4:fixture:1", domainSelection: domain, targetSelection: target, researchDirection: "生成式工具如何影響教師以證據修正課程決策" };
const first = await coordinator.run(request);
const replay = await coordinator.run(request);
equal(first.replayed, false, "first generation submitted");
equal(replay.replayed, true, "same request replayed");
equal(submissions, 1, "replay has zero second effect");
await assert.rejects(() => coordinator.run({ ...request, researchDirection: "不同研究方向" }), /alpha4_idempotency_conflict/u); assertions += 1;

console.log(`PASS V2_ALPHA4_CONTRACTS assertions=${assertions} scenario_groups=10 provider_submissions=${submissions} network_calls=0 formal_writes=0 external_submissions=0`);
