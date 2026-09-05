import "server-only";

export const GAP_TYPES = ["THEORETICAL_GAP", "EMPIRICAL_GAP", "METHODOLOGICAL_GAP", "POPULATION_GAP", "CONTEXT_GAP", "TECHNOLOGY_GAP", "DATA_GAP", "TEMPORAL_GAP", "MEASUREMENT_GAP", "IMPLEMENTATION_GAP", "HUMAN_AI_GAP", "REPLICATION_GAP", "POLICY_PRACTICE_GAP", "TEACHING_PRACTICE_GAP", "CROSS_DOMAIN_GAP"] as const;
export type GapType = (typeof GAP_TYPES)[number];

export const GAP_VALIDATION_STATUSES = ["PROPOSED", "PARTIALLY_SUPPORTED", "SUPPORTED", "CONFLICTING", "NOT_SUPPORTED", "UNVERIFIED"] as const;
export type GapValidationStatus = (typeof GAP_VALIDATION_STATUSES)[number];

export const NOVELTY_DIMENSIONS = ["Problem", "Theoretical", "Mechanism", "Methodological", "Data", "Measurement", "Population", "Context", "Technology Integration", "Longitudinal", "Implementation", "Practical"] as const;

export const NOVELTY_SCORE_BREAKDOWN: { key: string; label: string; weight: number }[] = [
  { key: "gap", label: "Evidence-backed Gap", weight: 25 },
  { key: "closest_diff", label: "Difference from Closest Studies", weight: 20 },
  { key: "theory_mechanism", label: "Theoretical or Mechanism Contribution", weight: 15 },
  { key: "method", label: "Methodological Contribution", weight: 10 },
  { key: "data_outcome", label: "Data and Outcome Contribution", weight: 10 },
  { key: "technology", label: "Technology or Cross-domain Integration", weight: 10 },
  { key: "population_context", label: "Population / Context Contribution", weight: 5 },
  { key: "international", label: "International or Transferable Relevance", weight: 5 },
];

export type SearchTaskInput = {
  taskId: string;
  researchQuestionIds: string[];
  gapType?: GapType;
  searchPurpose: string;
  keywordGroups: string[];
  synonyms: string[];
  booleanQuery: string;
  databases: string[];
  yearRange?: string;
  inclusionCriteria?: string;
  exclusionCriteria?: string;
};

export type ClosestStudyDelta = { deltaType: string; description: string; direction: "ADD" | "DIFFER" | "EXTEND"; evidenceNote?: string };

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
