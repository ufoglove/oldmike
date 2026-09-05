/**
 * Opportunity Category Contract (Spec v3.2.0 / V3-U03-R1 — A4)
 *
 * Three research-opportunity categories with multi-tag support, primary category,
 * de-dup by unique opportunity id, and a SEPARATE idea_expansion_class used only
 * for the 5/3/2 candidate configuration (never mixed with these categories).
 *
 * Rules enforced:
 * - primary_category drives main classification; a single opportunity may carry
 *   multiple category labels.
 * - Cross-category totals count unique opportunity IDs once (no double counting).
 * - idea_expansion_class = CORE_EXTENSION | ADJACENT_EXPANSION | FRONTIER_EXPLORATION
 *   is a candidate-configuration axis, NOT a research category.
 * - No global field-growth percentages from ranked search samples; when metrics
 *   are not available show "檢索樣本中的趨勢線索" instead.
 */
export const OPPORTUNITY_CATEGORY_CONTRACT = "opportunity-category/1.0.0" as const;

export const OPPORTUNITY_CATEGORIES = ["HOT_TOPIC", "EMERGING_FRONTIER", "CROSS_DOMAIN"] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const OPPORTUNITY_CATEGORY_LABELS: Readonly<Record<OpportunityCategory, string>> = Object.freeze({
  HOT_TOPIC: "熱門研究方向",
  EMERGING_FRONTIER: "前沿新興方向",
  CROSS_DOMAIN: "跨領域複合方向",
});

export const IDEA_EXPANSION_CLASSES = ["CORE_EXTENSION", "ADJACENT_EXPANSION", "FRONTIER_EXPLORATION"] as const;
export type IdeaExpansionClass = (typeof IDEA_EXPANSION_CLASSES)[number];

export const IDEA_EXPANSION_LABELS: Readonly<Record<IdeaExpansionClass, string>> = Object.freeze({
  CORE_EXTENSION: "核心延伸",
  ADJACENT_EXPANSION: "跨域拓展",
  FRONTIER_EXPLORATION: "前沿探索",
});

export type OpportunityCategoryAssignment = {
  primaryCategory: OpportunityCategory;
  categories: OpportunityCategory[]; // multi-tag, includes primary
  ideaExpansionClass?: IdeaExpansionClass; // ONLY for 5/3/2 candidate config, separate axis
};

export type CategoryEvidenceNote = {
  basis: "CANONICAL_DOCUMENTS" | "WORK_FAMILIES" | "STUDY_FAMILIES" | "SOURCE_AGGREGATION" | "RETRIEVAL_SAMPLE";
  note: string; // e.g. "檢索樣本中的趨勢線索" when no metric basis
};

const CATEGORY_SET = new Set<string>(OPPORTUNITY_CATEGORIES);
const EXPANSION_SET = new Set<string>(IDEA_EXPANSION_CLASSES);

export function isOpportunityCategory(value: unknown): value is OpportunityCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function isIdeaExpansionClass(value: unknown): value is IdeaExpansionClass {
  return typeof value === "string" && EXPANSION_SET.has(value);
}

/** Parse and validate a category assignment from untrusted model output. */
export function parseOpportunityCategoryAssignment(value: unknown): OpportunityCategoryAssignment | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const primary = record.primaryCategory;
  if (!isOpportunityCategory(primary)) return null;

  const categoriesRaw = Array.isArray(record.categories) && record.categories.length > 0
    ? record.categories
    : [primary];
  const categories = categoriesRaw.filter(isOpportunityCategory);
  if (!categories.includes(primary)) categories.unshift(primary);
  const deduped = Array.from(new Set(categories)).slice(0, 3);

  let ideaExpansionClass: IdeaExpansionClass | undefined;
  if (record.ideaExpansionClass !== undefined && record.ideaExpansionClass !== null) {
    if (!isIdeaExpansionClass(record.ideaExpansionClass)) return null;
    ideaExpansionClass = record.ideaExpansionClass;
  }

  return { primaryCategory: primary, categories: deduped, ideaExpansionClass };
}

/**
 * Count opportunities per category by UNIQUE opportunity id (spec A4: no double counting).
 * An opportunity with [HOT_TOPIC, CROSS_DOMAIN] contributes 1 to each of those buckets,
 * but is counted once for the overall total.
 */
export function countOpportunitiesByCategory(
  assignments: Array<{ opportunityId: string; categories: OpportunityCategory[] }>,
): { byCategory: Record<OpportunityCategory, number>; uniqueTotal: number } {
  const byCategory: Record<OpportunityCategory, number> = { HOT_TOPIC: 0, EMERGING_FRONTIER: 0, CROSS_DOMAIN: 0 };
  const seen = new Set<string>();
  for (const { opportunityId, categories } of assignments) {
    if (!opportunityId || seen.has(opportunityId)) continue;
    seen.add(opportunityId);
    for (const category of categories) byCategory[category] += 1;
  }
  return { byCategory, uniqueTotal: seen.size };
}

/** Guard: ranked search samples cannot produce global growth percentages. */
export function trendLineLabel(hasMetricBasis: boolean, hasZeroDenominator: boolean): string {
  if (!hasMetricBasis) return "檢索樣本中的趨勢線索";
  if (hasZeroDenominator) return "新出現（前期數量為 0，不計算成長率）";
  return "趨勢線索（已註明計量範圍與期間）";
}
