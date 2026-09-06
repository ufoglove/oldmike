/**
 * Batch B contract tests: A3 research profile versioning + A4 opportunity categories.
 * Run: node --experimental-strip-types scripts/verify-stage03-batch-b-contracts.ts
 * No keys, no network, no DB.
 */
import {
  buildDefaultProfileAxes,
  diffProfiles,
  energyAxisQueryKeywords,
  profileHasChanges,
  type ResearchProfileVersion,
} from "../lib/research-profile-contract.ts";
import {
  countOpportunitiesByCategory,
  isIdeaExpansionClass,
  isOpportunityCategory,
  parseOpportunityCategoryAssignment,
  trendLineLabel,
} from "../lib/opportunity-category-contract.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// ===== A3 Profile =====
const axes = buildDefaultProfileAxes();
check("profile_six_axes", axes.length === 6, `got ${axes.length}`);
check("profile_energy_axis_present", axes.some((a) => a.axisKey === "ai_energy_management"));
check("profile_energy_keywords_nonempty", axes.find((a) => a.axisKey === "ai_energy_management")!.keywords.length >= 3);
check("profile_energy_not_just_label", axes.find((a) => a.axisKey === "ai_energy_management")!.keywords.includes("能源管理") && axes.find((a) => a.axisKey === "ai_energy_management")!.keywords.includes("energy management"));

const v1: ResearchProfileVersion = {
  profileVersionId: "pf_v1",
  versionNumber: 1,
  contractVersion: "research-profile/1.0.0",
  axes: buildDefaultProfileAxes(),
  createdAt: "2026-09-06T00:00:00.000Z",
  appliesTo: "NEW_RUNS_ONLY",
  source: "SYSTEM_DEFAULT",
};

const v2: ResearchProfileVersion = {
  ...v1,
  profileVersionId: "pf_v2",
  versionNumber: 2,
  axes: buildDefaultProfileAxes().map((a) => a.axisKey === "ai_energy_management"
    ? { ...a, keywords: [...a.keywords, "儲能", "智慧電網"] }
    : a),
};

const diff = diffProfiles(v1, v2);
check("profile_diff_detects_keyword_add", diff.keywordChanges.length === 1 && diff.keywordChanges[0]!.added.includes("儲能"), JSON.stringify(diff.keywordChanges));
check("profile_diff_no_added_axis", diff.addedAxes.length === 0);
check("profile_has_changes_true", profileHasChanges(diff));
check("profile_no_change_false", !profileHasChanges(diffProfiles(v1, v1)));

// energy keywords feed query
const energyKw = energyAxisQueryKeywords(v2, "專案附加詞");
check("energy_keywords_feed_query", energyKw.includes("能源管理") && energyKw.includes("儲能") && energyKw.includes("專案附加詞"));

// ===== A4 Opportunity Categories =====
check("category_enum_three", isOpportunityCategory("HOT_TOPIC") && isOpportunityCategory("EMERGING_FRONTIER") && isOpportunityCategory("CROSS_DOMAIN"));
check("category_rejects_unknown", !isOpportunityCategory("RANDOM"));
check("expansion_class_separate", isIdeaExpansionClass("CORE_EXTENSION") && isIdeaExpansionClass("FRONTIER_EXPLORATION"));
check("expansion_rejects_category", !isIdeaExpansionClass("HOT_TOPIC"));

// parse multi-tag assignment
const parsed = parseOpportunityCategoryAssignment({ primaryCategory: "HOT_TOPIC", categories: ["HOT_TOPIC", "CROSS_DOMAIN"], ideaExpansionClass: "CORE_EXTENSION" });
check("parse_multitag_ok", parsed !== null && parsed.primaryCategory === "HOT_TOPIC" && parsed.categories.length === 2 && parsed.ideaExpansionClass === "CORE_EXTENSION");
check("parse_primary_missing_in_categories_added", parseOpportunityCategoryAssignment({ primaryCategory: "EMERGING_FRONTIER", categories: [] })?.categories.includes("EMERGING_FRONTIER") === true);
check("parse_dupes_deduped", parseOpportunityCategoryAssignment({ primaryCategory: "CROSS_DOMAIN", categories: ["CROSS_DOMAIN", "CROSS_DOMAIN"] })?.categories.length === 1);
check("parse_invalid_primary_rejected", parseOpportunityCategoryAssignment({ primaryCategory: "BOGUS", categories: [] }) === null);
check("parse_invalid_expansion_rejected", parseOpportunityCategoryAssignment({ primaryCategory: "HOT_TOPIC", ideaExpansionClass: "HOT_TOPIC" }) === null);

// dedup: same opportunity with multi-tags counted once in uniqueTotal but in each bucket
const counted = countOpportunitiesByCategory([
  { opportunityId: "op1", categories: ["HOT_TOPIC", "CROSS_DOMAIN"] },
  { opportunityId: "op2", categories: ["EMERGING_FRONTIER"] },
  { opportunityId: "op1", categories: ["HOT_TOPIC"] }, // duplicate id must NOT double count
]);
check("dedup_unique_total", counted.uniqueTotal === 2, `got ${counted.uniqueTotal}`);
check("dedup_hot_bucket", counted.byCategory.HOT_TOPIC === 1, `got ${counted.byCategory.HOT_TOPIC}`);
check("dedup_cross_bucket", counted.byCategory.CROSS_DOMAIN === 1);
check("dedup_emerging_bucket", counted.byCategory.EMERGING_FRONTIER === 1);

// trend line label honesty
check("trend_no_metric_basis", trendLineLabel(false, false) === "檢索樣本中的趨勢線索");
check("trend_zero_denominator", trendLineLabel(true, true) === "新出現（前期數量為 0，不計算成長率）");

// ===== A12 Daily Digest Policy =====
import {
  buildDefaultSchedulePolicy,
  canExecuteDailyDigest,
  makeDailyDigestIdempotencyKey,
} from "../lib/daily-digest-contract.ts";

const pol = buildDefaultSchedulePolicy("ws_1");
check("digest_default_disabled", pol.enabled === false);
check("digest_tz_asia_taipei", pol.timeZone === "Asia/Taipei");
check("digest_cant_run_when_disabled", !canExecuteDailyDigest(pol, "2026-09-06").permitted);

const enabledPol = { ...pol, enabled: true };
check("digest_can_run_when_enabled", canExecuteDailyDigest(enabledPol, "2026-09-06").permitted);

const ranPol = { ...enabledPol, lastRunLocalDate: "2026-09-06" };
check("digest_idempotent_cant_run_same_day", !canExecuteDailyDigest(ranPol, "2026-09-06").permitted);

const budgetPol = { ...enabledPol, dailyBudgetUnits: 5 };
check("digest_budget_guard", !canExecuteDailyDigest(budgetPol, "2026-09-07", 10).permitted);

const idemKey = makeDailyDigestIdempotencyKey("ws_1", "sched_main", "2026-09-06");
check("digest_idempotency_key_has_date", idemKey.includes("2026-09-06") && idemKey.includes("ws_1"));

// ===== A5 Relaxed Envelope (no filler, flexible candidate count) =====
import { parseInspirationEnvelope } from "../lib/one-click-inspiration-contract.ts";

function makeCandidateJson(i: number) {
  return `{"titleZh":"中文標題${i}","titleEn":"Title ${i}","researchQuestion":"RQ${i}","literatureGap":"Gap${i}","innovation":"Inn${i}","theory":"Th","method":"Met","feasibility":"Feas","venue":"Ven","score":85}`;
}

// 7 candidates (less than 10) + 2 top entries (less than 3) -> must be ACCEPTED per spec A5
const payload7 = JSON.stringify({
  judgment: "老麥判斷",
  evidenceStatus: "UNVERIFIED",
  evidenceNote: "note",
  candidates: [1, 2, 3, 4, 5, 6, 7].map((i) => JSON.parse(makeCandidateJson(i))),
  top3: [
    { candidateId: "inspiration_1", reason: "r1", pros: ["p"], risks: ["rk"] },
    { candidateId: "inspiration_2", reason: "r2", pros: ["p"], risks: ["rk"] },
  ],
});
const res7 = parseInspirationEnvelope(payload7);
check("relaxed_envelope_7_candidates_accepted", res7.ok === true && res7.value.candidates.length === 7);
check("relaxed_envelope_top2_accepted", res7.ok === true && res7.value.top3.length === 2);

// duplicate candidate IDs in top entries rejected
const payloadDup = JSON.stringify({
  judgment: "老麥判斷",
  evidenceStatus: "UNVERIFIED",
  candidates: [1, 2].map((i) => JSON.parse(makeCandidateJson(i))),
  top3: [
    { candidateId: "inspiration_999_not_exist", reason: "r", pros: ["p"], risks: ["r"] },
  ],
});
const resDup = parseInspirationEnvelope(payloadDup);
check("relaxed_envelope_rejects_bogus_top_ref", resDup.ok === false);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
