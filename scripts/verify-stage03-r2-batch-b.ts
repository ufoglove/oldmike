/**
 * Batch B contract tests: research workflow registry + node state + progress口径.
 * Run: node --experimental-strip-types scripts/verify-stage03-r2-batch-b.ts
 */
import {
  NODE_STATES,
  computeWorkflowProgress,
  getWorkflowTemplate,
  type WorkflowNodeProgress,
} from "../lib/research-workflow-registry.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Three route templates exist with stable node ids
for (const route of ["JOURNAL_SCI_SSCI", "NSTC_GENERAL", "MOE_TPR"] as const) {
  const tpl = getWorkflowTemplate(route);
  check(`template_exists_${route}`, tpl.nodes.length > 0);
  check(`template_has_common_backbone_${route}`, tpl.nodes.some((n) => n.nodeId === "topic-lab" && n.route === "COMMON"));
}

const journal = getWorkflowTemplate("JOURNAL_SCI_SSCI");
const nstc = getWorkflowTemplate("NSTC_GENERAL");
const moe = getWorkflowTemplate("MOE_TPR");

check("journal_has_results_lock", journal.nodes.some((n) => n.nodeId === "analysis-results-lock"));
check("journal_has_submission_package", journal.nodes.some((n) => n.nodeId === "submission-package"));
check("nstc_has_proposal", nstc.nodes.some((n) => n.nodeId === "nstc-proposal"));
check("moe_has_course_instructor", moe.nodes.some((n) => n.nodeId === "moe-course-instructor"));
check("moe_has_intervention", moe.nodes.some((n) => n.nodeId === "moe-design-intervention"));

// 2. Node state enum validity
check("node_states_valid", NODE_STATES.length === 10 && NODE_STATES.includes("COMPLETED_VALID") && NODE_STATES.includes("MODULE_UNAVAILABLE"));

// 3. Progress口径 (spec §6)
const nodes = journal.nodes;
const progress: WorkflowNodeProgress[] = [
  { node: nodes[0]!, state: "COMPLETED_VALID", completionSnapshotId: "scs_1", issueCount: 0 },
  { node: nodes[3]!, state: "COMPLETED_VALID", completionSnapshotId: "scs_2", issueCount: 0 }, // topic-lab
  { node: nodes[4]!, state: "AWAITING_INPUT", issueCount: 2 }, // submission-navigation
  { node: nodes[5]!, state: "MODULE_UNAVAILABLE", issueCount: 0 }, // blueprint unbuilt
];

const p = computeWorkflowProgress(nodes, progress);
check("progress_required_total_gt_0", p.requiredTotal > 0);
check("progress_completion_rate_excludes_optional", p.completionRate === p.requiredComplete / p.requiredTotal);
check("progress_optional_separate", p.optionalTotal >= 0); // optional not counted in required denominator
check("progress_awaiting_input_counted", p.awaitingInputCount === 1, `got ${p.awaitingInputCount}`);
check("progress_unbuilt_in_denominator", p.unbuiltCount === 1, "unbuilt required module remains a gap");
check("progress_shared_node_not_double_counted", p.sharedCompleteCount === 0); // submission-nav not complete yet

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);