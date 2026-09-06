/**
 * Contract verification test for Stage 4 Research Blueprint (Batch B + Core Contracts).
 * Spec: v3.4.0 §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, §18, §20, §25 (T09-T16, T18, T19, T34).
 * Run: node --experimental-strip-types scripts/verify-stage04-batch-b-contracts.ts
 */

import {
  buildBlueprintWorkspaceFromNavigation,
  runBlueprintLogicCheck,
  buildBlueprintPlanningSnapshot,
} from "../lib/blueprint-builder-service.ts";
import {
  type SubmissionNavigationSnapshot,
  type JournalCandidate,
  type NstcRouteCandidate,
  type MoeTprRouteCandidate,
  type OfficialRuleSnapshot,
} from "../lib/submission-navigation-engines-contract.ts";
import { buildFingerprintFromTopicSnapshot } from "../lib/submission-fingerprint-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

// -------------------------------------------------------------
// Fixture: Base Topic Selection Snapshot
// -------------------------------------------------------------
const baseTopicSnapshot: TopicSelectionSnapshot = {
  projectId: "proj_stage4_eval",
  topicId: "top_stage4_01",
  topicTitle: "生成式 AI 與沉浸式 XR 於職業安全即時危害辨識之介入成效",
  topicTitleEn: "Generative AI and Immersive XR in Hazard Recognition for Occupational Safety",
  conceptAbstract: "本研究探討在危險作業情境下，結合 LLM 即時語意引導與 XR 模擬對作業人員危害知覺之影響。",
  researchQuestion: "LLM 引導式 XR 訓練相較傳統影片教學，是否能顯著提升作業人員在複雜情境的危害辨識精準度與反應時間？",
  gapStatement: "現有研究多著重靜態 VR 體驗，缺乏結合生成式 AI 進行即時自適應危害反饋之系統性檢證。",
  methodologyOverview: "準實驗研究設計，分兩組進行前後測與歷程指標評估。",
  expectedContribution: "建構結合自適應 AI 的 XR 職安訓練架構，並驗證其成效邊界。",
  minimumViableStudy: "單一高空作業危害場景的前後測成效檢定",
  knownLimitations: ["受試者科技接受度個別差異", "場域設備限制"],
  assumptions: ["受試人員具備基本 XR 穿戴耐受度"],
  risks: ["硬體設備延遲可能造成動暈眩干擾"],
  literatureIds: ["lit_wu2021", "lit_endsley2000"],
  citationSourceIds: ["cs_wu2021", "cs_endsley2000"],
  sourceSnapshotIds: ["ss_01"],
  selectedBy: "user_stage4",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: new Date().toISOString(),
  lockManifest: [],
  handoffLimitations: [],
  downstreamOpenRequirements: [],
};

// -------------------------------------------------------------
// Fixture: Tri-Route Navigation Snapshot Generators
// -------------------------------------------------------------
function makeNavigationSnapshot(params: {
  fundingIntent: "NONE" | "UNDECIDED" | "NSTC_GENERAL" | "MOE_TPR";
  publicationIntent: "JOURNAL" | "DEFERRED" | "NONE";
  selectedJournal?: JournalCandidate;
  selectedNstc?: NstcRouteCandidate;
  selectedMoeTpr?: MoeTprRouteCandidate;
  courseName?: string;
  isInstructor?: boolean;
}): SubmissionNavigationSnapshot {
  const fp = buildFingerprintFromTopicSnapshot("ws_stage4", baseTopicSnapshot, {
    fundingIntent: params.fundingIntent,
    publicationIntent: params.publicationIntent,
  });

  if (params.courseName) {
    fp.courseProfileRefs = {
      courseName: params.courseName,
      isInstructorOfRecord: params.isInstructor ?? true,
      academicCredits: 3,
      status: "USER_PROVIDED",
    };
  }

  return {
    snapshotId: `sns_test_${params.fundingIntent}_${Date.now()}`,
    projectId: "proj_stage4_eval",
    workspaceId: "ws_stage4",
    contractVersion: "submission-navigation-engines/1.0.0",
    fingerprintId: fp.fingerprintId,
    fingerprintVersion: fp.versionNumber,
    sourceTopicSnapshotId: baseTopicSnapshot.topicId,
    fundingIntent: params.fundingIntent,
    publicationIntent: params.publicationIntent,
    researchStage: "CONCEPT",
    selectedJournalCandidate: params.selectedJournal,
    selectedNstcCandidate: params.selectedNstc,
    selectedMoeTprCandidate: params.selectedMoeTpr,
    fingerprint: fp,
    ruleSnapshots: [
      {
        ruleId: "rule_nstc_general",
        snapshotId: "rule_nstc_2026",
        authority: "NSTC",
        documentTitle: "國家科學及技術委員會補助專題研究計畫作業要點",
        programNamespace: "NSTC_GENERAL",
        targetCycle: {
          yearRoc: 115,
          yearCe: 2026,
          cycleLabel: "115年度國科會專題研究計畫",
        },
        sourceUrl: "https://law.nstc.gov.tw/LawContent.aspx?id=FL026713",
        retrievedAt: new Date().toISOString(),
        requirementText: "一般專題計畫申請規範",
        ruleStatus: "VERIFIED_APPLICABLE",
        notes: "年度作業要點",
      },
    ],
    handoffLimitations: ["目標年度法規以官方正式公告為準", "研究者資格待機構人事查驗"],
    downstreamRequirements: ["研究藍圖階段需依本導航結果擬定方法與期程"],
    decisionAt: new Date().toISOString(),
    decisionOrigin: "USER_MANUAL_SELECTION",
    planningStatus: "ROUTE_PLAN_READY",
  };
}

// -------------------------------------------------------------
// Test Suite: Batch B Tri-Goal & Blueprint Matrix Tests
// -------------------------------------------------------------
console.log("=== Running Stage 4 Batch B Tri-Goal & Matrix Contract Tests ===");

// 1. T09: Tri-goal distinct blueprint generation without dropping MOE_TPR
const journalSns = makeNavigationSnapshot({
  fundingIntent: "NONE",
  publicationIntent: "JOURNAL",
  selectedJournal: {
    candidateId: "j_safety_sci",
    journalName: "Safety Science",
    publisher: "Elsevier",
    role: "BEST_FIT",
    indexingVerified: [{ system: "SCIE", verified: true }],
    fitScore: 88,
    fitCoverage: 1.0,
    apcKnown: { currency: "USD", amount: 3600, isWaiverAvailable: true, status: "KNOWN" },
    recentArticlesSample: [],
    primaryRisk: "同儕審查競爭激烈",
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});

const nstcSns = makeNavigationSnapshot({
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "DEFERRED",
  selectedNstc: {
    candidateId: "nstc_e11",
    disciplineCode: "E11",
    disciplineName: "工業工程與管理學門",
    divisionName: "工程技術研究發展處",
    fitScore: 85,
    fitCoverage: 1.0,
    eligibilityStatus: "PASS",
    eligibilityNotes: "符合專任教師資格",
    deadlines: { officialDeadline: "2026-12-31", isInstitutionalKnown: false },
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});

const moeSns = makeNavigationSnapshot({
  fundingIntent: "MOE_TPR",
  publicationIntent: "NONE",
  selectedMoeTpr: {
    candidateId: "tpr_eng",
    disciplineOrProgramName: "工程學門",
    targetAcademicYearRoc: 115,
    fitScore: 82,
    fitCoverage: 1.0,
    courseFit: {
      isInstructorVerified: false,
      creditsKnown: false,
      baselineEvidenceStatus: "PENDING_BASELINE",
    },
    eligibilityStatus: "UNKNOWN",
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});

const journalWs = buildBlueprintWorkspaceFromNavigation({
  workspaceId: "ws_stage4",
  projectId: "proj_stage4_eval",
  navigationSnapshot: journalSns,
});

const nstcWs = buildBlueprintWorkspaceFromNavigation({
  workspaceId: "ws_stage4",
  projectId: "proj_stage4_eval",
  navigationSnapshot: nstcSns,
});

const moeWs = buildBlueprintWorkspaceFromNavigation({
  workspaceId: "ws_stage4",
  projectId: "proj_stage4_eval",
  navigationSnapshot: moeSns,
});

check("T09_tri_goal_moe_retained", moeWs.primaryGoal === "MOE_TPR" && Boolean(moeWs.moeTprBlueprint));
check("T09_tri_goal_journal_retained", journalWs.primaryGoal === "JOURNAL_SCI_SSCI" && Boolean(journalWs.journalBlueprint));
check("T09_tri_goal_nstc_retained", nstcWs.primaryGoal === "NSTC_GENERAL" && Boolean(nstcWs.nstcBlueprint));

// 2. T10: SCI/SSCI concept phase has data & results plan, NEVER fake results values
check("T10_journal_temporal_status_proposed", journalWs.journalBlueprint?.dataAndResultsRequirements.temporalStatus === "PROPOSED_BEFORE_STUDY");
check("T10_journal_no_fake_results_in_evidence", journalWs.journalBlueprint?.dataAndResultsRequirements.evidenceNeededPerSection.Results.includes("待研究執行後填寫") === true);

// 3. T11: Journal sample article suggestions marked as quality recommendation, NOT mandatory rule
const sampleSuggestion = journalWs.journalBlueprint?.sampleArticleSuggestions[0];
check("T11_journal_suggestion_not_hard_rule", sampleSuggestion?.isOfficialJournalRule === false);

// 4. T12: NSTC duration not forced to 3 years; PI capability marked properly
check("T12_nstc_not_forced_three_year", nstcWs.nstcBlueprint?.projectDuration.isFixedThreeYearAssumption === false);
check("T12_nstc_default_duration_valid", nstcWs.nstcBlueprint?.projectDuration.durationOption === "ONE_YEAR");

// 5. T13: MOE TPR without course data keeps UNKNOWN, never fabricates passing status
check("T13_moe_course_unknown_without_profile", moeWs.moeTprBlueprint?.courseIdentity.courseInfoStatus === "UNKNOWN");
check("T13_moe_instructor_eligibility_unknown", moeWs.moeTprBlueprint?.courseIdentity.instructorEligibilityStatus === "UNKNOWN");
check("T13_moe_baseline_pending_task", moeWs.moeTprBlueprint?.pedagogicalProblemAndContext.baselineEvidenceSource === "PENDING_BASELINE_TASK");

// 6. T13b: MOE TPR with provided course data preserves user facts
const moeWithCourseSns = makeNavigationSnapshot({
  fundingIntent: "MOE_TPR",
  publicationIntent: "NONE",
  courseName: "虛擬實境應用與職安實務",
  isInstructor: true,
  selectedMoeTpr: {
    candidateId: "tpr_eng",
    disciplineOrProgramName: "工程學門",
    targetAcademicYearRoc: 115,
    fitScore: 82,
    fitCoverage: 1.0,
    courseFit: {
      isInstructorVerified: true,
      creditsKnown: true,
      baselineEvidenceStatus: "PENDING_BASELINE",
    },
    eligibilityStatus: "PASS",
    selectionStatus: "SELECTED_FOR_PLANNING",
  },
});
const moeCourseWs = buildBlueprintWorkspaceFromNavigation({
  workspaceId: "ws_stage4",
  projectId: "proj_stage4_eval",
  navigationSnapshot: moeWithCourseSns,
});
check("T13b_moe_course_preserved", moeCourseWs.moeTprBlueprint?.courseIdentity.courseName === "虛擬實境應用與職安實務");
check("T13b_moe_course_status_user_provided", moeCourseWs.moeTprBlueprint?.courseIdentity.courseInfoStatus === "USER_PROVIDED");

// 7. T14: Pedagogical Problem vs Assessment Misalignment Detection (Logic Check)
// Artificially modify moeCourseWs to have only satisfaction survey for skill problem
const invalidMoeWs = JSON.parse(JSON.stringify(moeCourseWs));
invalidMoeWs.moeTprBlueprint.learningOutcomesAndAssessment.assessmentMethods = ["課後學生滿意度問卷"];
const moeFindings = runBlueprintLogicCheck(invalidMoeWs);
const satisfactionIssue = moeFindings.find((f) => f.ruleCode === "PEDAGOGICAL_ASSESSMENT_MISALIGNMENT");
check("T14_pedagogical_satisfaction_mismatch_flagged", Boolean(satisfactionIssue) && satisfactionIssue?.severity === "MAJOR_WARNING");

// 8. T34: Work Package DAG cycle detection
const invalidDagWs = JSON.parse(JSON.stringify(journalWs));
// Create WP-01 -> WP-02 -> WP-03 -> WP-01 cycle
invalidDagWs.workPackages[0].dependencies = ["WP-03"];
const dagFindings = runBlueprintLogicCheck(invalidDagWs);
const dagCycleIssue = dagFindings.find((f) => f.ruleCode === "WORK_PACKAGE_DAG_CYCLE");
check("T34_dag_cycle_detected", Boolean(dagCycleIssue) && dagCycleIssue?.severity === "FATAL");

// 9. §8 Objective - RQ - WorkPackage Alignment Check
check("T08_matrix_objectives_count", journalWs.purposeAndObjectives.objectives.length >= 2);
check("T08_matrix_rq_count", journalWs.researchQuestionsMatrix.length >= 2);
check("T08_matrix_rq_mapped_to_objective", journalWs.researchQuestionsMatrix.every((r) => r.objectiveId.startsWith("OBJ-")));
check("T08_matrix_rq_has_method_direction", journalWs.researchQuestionsMatrix.every((r) => Boolean(r.preliminaryMethodDirection)));

// 10. §11 EvidenceNeed Directed Retrieval Tasks
check("T11_evidence_need_has_target_role", journalWs.evidenceNeeds.length >= 1 && journalWs.evidenceNeeds[0].role === "GAP");
check("T11_evidence_need_has_budget_cap", journalWs.evidenceNeeds[0].retrievalBudgetCap === 10);
check("T11_evidence_need_has_both_support_and_counter", journalWs.evidenceNeeds[0].supportOrCounterevidence === "BOTH_SUPPORT_AND_COUNTER");

// 11. §12 Downstream Requirements Non-Blocking Verification (T35)
check("T35_downstream_reqs_contain_irb_deferred", journalWs.downstreamRequirements.some((r) => r.requirementId === "REQ-DS-01" && r.duePhase === "BEFORE_STUDY_START"));
check("T35_downstream_reqs_gap_handed_to_stage5", journalWs.downstreamRequirements.some((r) => r.requirementId === "REQ-DS-02" && r.duePhase === "GAP_VALIDATION"));

// 12. §20 Build BlueprintPlanningSnapshot for Stage 5 Handoff
const snap = buildBlueprintPlanningSnapshot({
  workspace: journalWs,
  readinessSnapshotRef: "rd_snap_test_01",
  decisionOrigin: "USER_MANUAL_ADOPTION",
});
check("T20_handoff_snapshot_schema_valid", snap.schemaVersion === "blueprint-planning/1.0.0");
check("T20_handoff_snapshot_next_stage_gap_novelty", snap.nextStageId === "gap-novelty");
check("T20_handoff_snapshot_contains_evidence_needs", snap.evidenceNeedRefs.length > 0 && snap.evidenceNeedRefs.includes("EN-01"));
check("T20_handoff_snapshot_preserves_limitations", snap.limitations.length >= 2);

console.log("\n=======================================================");
if (failures === 0) {
  console.log("ALL BATCH B CONTRACT TESTS PASSED (0 failures)!");
  process.exit(0);
} else {
  console.error(`COMPLETED WITH ${failures} FAILURES.`);
  process.exit(1);
}
