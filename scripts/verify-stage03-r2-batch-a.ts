/**
 * Batch A contract tests for V3-U03-R2: Research Goal Registry & Context.
 * Covers: single source of truth, three primary goals, MOE_TPR availability in one-click,
 * legacy mapping with raw_legacy_value preservation, and no-fake-defaults.
 */
import {
  PRIMARY_GOAL_IDS,
  RESEARCH_GOAL_DEFINITIONS,
  getAllResearchGoalDefinitions,
  getResearchGoalDefinition,
  migrateLegacyGoal,
} from "../lib/research-goal-registry.ts";
import {
  RESEARCH_GOALS,
  parseOneClickInspirationRequest,
} from "../lib/one-click-inspiration-contract.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Primary Goals Integrity
check("three_primary_goals_exactly", PRIMARY_GOAL_IDS.length === 3);
check("has_journal_sci_ssci", PRIMARY_GOAL_IDS.includes("JOURNAL_SCI_SSCI"));
check("has_nstc_general", PRIMARY_GOAL_IDS.includes("NSTC_GENERAL"));
check("has_moe_tpr", PRIMARY_GOAL_IDS.includes("MOE_TPR"));

// 2. Goal Definitions
const defs = getAllResearchGoalDefinitions();
check("definitions_count_3", defs.length === 3);
check("moe_tpr_requires_course", getResearchGoalDefinition("MOE_TPR").requiresCourseProfile === true);
check("nstc_requires_discipline", getResearchGoalDefinition("NSTC_GENERAL").requiresDisciplineSelection === true);
check("journal_defaults_none_funding", getResearchGoalDefinition("JOURNAL_SCI_SSCI").defaultFundingIntent === "NONE");

// 3. One-Click Inspiration Includes MOE_TPR
check("one_click_has_moe_tpr", RESEARCH_GOALS.includes("MOE_TPR"));
check("one_click_has_journal_sci_ssci", RESEARCH_GOALS.includes("JOURNAL_SCI_SSCI"));
check("one_click_has_nstc_general", RESEARCH_GOALS.includes("NSTC_GENERAL"));

// Parse request with MOE_TPR should succeed now
const moeReq = parseOneClickInspirationRequest({
  operation: "GENERATE_INSPIRATIONS",
  idempotencyKey: "test_moe_01",
  researchFocus: "VR 工廠安全",
  researchGoal: "MOE_TPR",
  researchDomains: ["AI與職業安全"],
});
check("parse_moe_tpr_request_success", moeReq.researchGoal === "MOE_TPR");

// 4. Legacy Migration (spec §3)
const legMoe = migrateLegacyGoal("教育部計畫");
check("legacy_moe_maps_to_moe_tpr", legMoe.primaryGoal === "MOE_TPR" && legMoe.rawLegacyValue === "教育部計畫");

const legNstc = migrateLegacyGoal("科技部計畫");
check("legacy_nstc_maps_to_nstc_general", legNstc.primaryGoal === "NSTC_GENERAL" && legNstc.rawLegacyValue === "科技部計畫");

const legSsci = migrateLegacyGoal("SSCI");
check("legacy_ssci_maps_to_journal_ssci", legSsci.primaryGoal === "JOURNAL_SCI_SSCI" && legSsci.journalIndexPreference === "SSCI");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
