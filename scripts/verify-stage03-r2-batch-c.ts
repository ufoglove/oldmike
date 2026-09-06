/**
 * Batch C contract tests: Project Orchestrator + Assist Coverage Registry (V3-U03-R2).
 * Run: node --experimental-strip-types scripts/verify-stage03-r2-batch-c.ts
 */
import {
  decidePrimaryButton,
  validateActionGate,
  AUTOMATION_LEVELS,
  WORKER_STATES,
} from "../lib/project-orchestrator-contract.ts";
import { ASSIST_COVERAGE, coverageSummary, getAssistCoverage } from "../lib/assist-coverage-registry.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Automation levels & worker states
check("automation_three_levels", AUTOMATION_LEVELS.length === 3 && AUTOMATION_LEVELS.includes("AUTO_ADVANCE"));
check("worker_states_include_waiting", WORKER_STATES.includes("WAITING_APPROVAL") && WORKER_STATES.includes("WAITING_EXTERNAL") && WORKER_STATES.includes("STALE_INPUT"));

// 2. Primary button per spec §8
check("journal_no_results_button", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: false, hasBlockingIssues: false }) === "老麥一鍵完成期刊研究規劃");
check("journal_with_results_button", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: true, hasBlockingIssues: false }) === "老麥一鍵協作完成期刊稿件");
check("nstc_button", decidePrimaryButton({ goal: "NSTC_GENERAL", hasValidatedResults: false, hasBlockingIssues: false }) === "老麥一鍵協作完成國科會計畫書");
check("moe_button", decidePrimaryButton({ goal: "MOE_TPR", hasValidatedResults: false, hasBlockingIssues: false }) === "老麥一鍵協作完成教學實踐計畫書");
check("blocking_issues_override", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: true, hasBlockingIssues: true }) === "老麥一鍵補足可處理項目");

// 3. Action gate (spec §9: AUTO_ADVANCE never skips checks)
check("gate_ok", validateActionGate({ expectedRevision: 2, currentRevision: 2, fieldLocked: false, authorizedRange: true, withinBudget: true }).permitted);
check("gate_revision_mismatch", validateActionGate({ expectedRevision: 2, currentRevision: 1, fieldLocked: false, authorizedRange: true, withinBudget: true }).reason === "REVISION_MISMATCH");
check("gate_locked", validateActionGate({ expectedRevision: 2, currentRevision: 2, fieldLocked: true, authorizedRange: true, withinBudget: true }).reason === "FIELD_LOCKED");
check("gate_out_of_range", validateActionGate({ expectedRevision: 2, currentRevision: 2, fieldLocked: false, authorizedRange: false, withinBudget: true }).reason === "OUT_OF_AUTHORIZED_RANGE");
check("gate_over_budget", validateActionGate({ expectedRevision: 2, currentRevision: 2, fieldLocked: false, authorizedRange: true, withinBudget: false }).reason === "OVER_BUDGET");

// 4. Assist coverage registry
check("coverage_modules_gt_20", ASSIST_COVERAGE.length >= 20, `got ${ASSIST_COVERAGE.length}`);
check("coverage_nstc_proposal_route", getAssistCoverage("nstc-proposal")?.routeApplicability === "NSTC_GENERAL");
check("coverage_moe_proposal_route", getAssistCoverage("moe-proposal")?.routeApplicability === "MOE_TPR");
check("coverage_analysis_lab_computed", getAssistCoverage("analysis-lab")?.mustNotFabricate.includes("LLM 手填統計") === true);
check("coverage_ethics_no_approval", getAssistCoverage("ethics")?.mustNotFabricate.includes("正式判定") === true);
const summary = coverageSummary();
check("coverage_summary_total_matches", summary.total === ASSIST_COVERAGE.length);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);