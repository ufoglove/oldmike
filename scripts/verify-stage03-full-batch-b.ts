/**
 * V3-U03-FULL Batch B contract tests: Tri-Route Navigation Service & Rule Snapshot Evaluator.
 * Run: node --experimental-strip-types scripts/verify-stage03-full-batch-b.ts
 * Covers: T19-T24 (journal fit/index/apc, nstc discipline, moe course/problem chain, official rules).
 */

import {
  evaluateJournalCandidates,
  evaluateNstcCandidates,
  evaluateMoeTprCandidates,
  buildOfficialRuleSnapshots,
  NSTC_GENERAL_DISCIPLINES,
  MOE_TPR_DISCIPLINES,
} from "../lib/submission-navigation-service.ts";
import {
  buildFingerprintFromTopicSnapshot,
  type SubmissionFingerprintVersion,
} from "../lib/submission-fingerprint-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

const mockTopic: TopicSelectionSnapshot = {
  projectId: "proj_b_test",
  topicId: "top_b_01",
  topicTitle: "AI×職安教育訓練研究",
  topicTitleEn: "AI Safety Training",
  conceptAbstract: "探討生成式AI即時反饋在VR危險作業訓練之成效",
  researchQuestion: "生成式AI即時反饋是否顯著提升VR危險作業之危害辨識率？",
  gapStatement: "現有研究缺乏即時情境反饋的實證數據",
  methodologyOverview: "RCT 隨機對照試驗，比較傳統與AI反饋組",
  targetPopulation: "製造業新進員工",
  expectedContribution: "提出 LLM-VR 混合訓練框架並驗證成效",
  knownLimitations: ["製造業特定高空作業場景"],
  assumptions: ["具備基礎頭顯操作能力"],
  risks: ["VR 暈眩可能"],
  literatureIds: ["lit_01"],
  citationSourceIds: [],
  sourceSnapshotIds: [],
  selectedBy: "user_test",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: "2026-09-06T00:00:00Z",
  handoffLimitations: ["新穎性待確認"],
  downstreamOpenRequirements: ["確認發表目標"],
  lockManifest: [{ fieldRef: "research_question", lockVersion: 1 }],
};

const fp: SubmissionFingerprintVersion = buildFingerprintFromTopicSnapshot("ws_test", mockTopic, {
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
});

// 1. Official Discipline Catalogs (Section 14, 15)
check("nstc_disciplines_exist", NSTC_GENERAL_DISCIPLINES.length >= 5);
check("nstc_has_h03_edu", NSTC_GENERAL_DISCIPLINES.some((d) => d.code === "H03" && d.name === "教育學門"));
check("moe_disciplines_distinct_namespace", MOE_TPR_DISCIPLINES.every((d) => d.namespace === "MOE_TPR"));
check("moe_has_tpr_eng", MOE_TPR_DISCIPLINES.some((d) => d.code === "TPR_ENG" && d.name === "工程學門"));

// 2. Journal Evaluation (Section 12, 13, T19, T20, T21)
const journals = evaluateJournalCandidates(fp, ["VR safety simulation RCT", "AI feedback in education"]);
check("journal_candidates_returned", journals.length >= 2);
const bestFit = journals.find((j) => j.role === "BEST_FIT");
check("journal_has_best_fit", Boolean(bestFit));
check("journal_name_correct", bestFit?.journalName === "Safety Science");
check("journal_fit_score_positive", (bestFit?.fitScore ?? 0) > 60);
check("journal_scie_verified", bestFit?.indexingVerified.some((i) => i.system === "SCIE" && i.verified) === true);
check("journal_apc_known", bestFit?.apcKnown.status === "KNOWN" && bestFit.apcKnown.currency === "USD");
check("journal_no_fake_results", fp.researchStage === "CONCEPT"); // concept stage doesn't block evaluation (T21)

// 3. NSTC Route Evaluation (Section 14, T22)
const nstcRoutes = evaluateNstcCandidates(fp);
check("nstc_routes_returned", nstcRoutes.length >= 2);
const h03 = nstcRoutes.find((r) => r.disciplineCode === "H03");
check("nstc_h03_matched", Boolean(h03));
check("nstc_h03_is_edu", h03?.disciplineName === "教育學門");
check("nstc_eligibility_unknown_not_failed", h03?.eligibilityStatus === "UNKNOWN"); // T22: unknown != fail
check("nstc_deadlines_separated", h03?.deadlines.isInstitutionalKnown === false && Boolean(h03?.deadlines.officialDeadline));

// 4. MOE TPR Evaluation (Section 15, T23, T24)
const moeRoutes = evaluateMoeTprCandidates(fp);
check("moe_routes_returned", moeRoutes.length >= 2);
const moeEng = moeRoutes.find((r) => r.disciplineOrProgramName === "工程學門");
check("moe_eng_matched", Boolean(moeEng));
check("moe_target_year_115", moeEng?.targetAcademicYearRoc === 115);
check("moe_pending_baseline", moeEng?.courseFit.baselineEvidenceStatus === "PENDING_BASELINE"); // T24: evidence != eligibility fail

// 5. Official Rule Snapshots (Section 10, T18)
const rules = buildOfficialRuleSnapshots();
check("rules_returned", rules.length >= 2);
check("nstc_rule_verified", rules.some((r) => r.authority === "NSTC" && r.ruleStatus === "VERIFIED_APPLICABLE"));
check("moe_rule_verified", rules.some((r) => r.authority === "MOE" && r.ruleStatus === "VERIFIED_APPLICABLE"));
check("rules_roc_ce_separated", rules.every((r) => r.targetCycle.yearRoc === 115 && r.targetCycle.yearCe === 2026));

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
