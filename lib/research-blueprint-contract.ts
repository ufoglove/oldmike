import "server-only";

export const BLUEPRINT_STATUSES = ["DRAFT", "EVIDENCE_INCOMPLETE", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED", "OUTDATED"] as const;
export type BlueprintStatus = (typeof BLUEPRINT_STATUSES)[number];

export const BLUEPRINT_ROUTES = ["JOURNAL", "NSTC", "MOE_TEACHING_PRACTICE", "GENERAL"] as const;
export type BlueprintRoute = (typeof BLUEPRINT_ROUTES)[number];

export const GAP_TYPES = ["Theoretical", "Empirical", "Methodological", "Population", "Context", "Technology", "Implementation"] as const;
export const CONTRIBUTION_TYPES = ["Theoretical", "Methodological", "Empirical", "Technical", "Educational", "Practical", "Policy"] as const;
export const RISK_TYPES = ["LITERATURE", "NOVELTY", "SAMPLE", "METHOD", "DATA", "ETHICS", "TECHNOLOGY", "TIMELINE", "SUBMISSION"] as const;
export const COVERAGE_TYPES = ["PROBLEM_IMPORTANCE", "GAP", "THEORY", "METHOD", "MEASUREMENT", "SIMILAR_STUDY", "CONTRIBUTION", "TEACHING_PROBLEM"] as const;
export const COVERAGE_STATUSES = ["SUPPORTED", "PARTIALLY_SUPPORTED", "MISSING", "CONFLICTING", "UNVERIFIED"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export type LogicFinding = {
  severity: "LOGIC_GAP" | "MAJOR_LOGIC_GAP" | "OUTCOME_MISALIGNMENT";
  chain: string;
  description: string;
  suggestion: string;
};

export type SectionEdit = {
  section: "identity" | "core_problem" | "gaps" | "purpose" | "objectives" | "questions" | "hypotheses" | "conceptual_logic" | "variables" | "population_context" | "method" | "contributions" | "outputs" | "risks" | "workpackages" | "milestones" | "next_best_action";
  payload: Record<string, unknown>;
  reason?: string;
  approvedOnly?: boolean;
};

function isIn<T extends readonly string[]>(allowed: readonly T[number][], value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

export function validateSectionEdit(value: unknown): SectionEdit {
  if (!record(value) || typeof value.section !== "string") throw new Error("invalid_blueprint_section");
  const section = value.section as SectionEdit["section"];
  const payload = record(value.payload) ? value.payload : {};
  return {
    section,
    payload,
    reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 500) : "",
    approvedOnly: value.approvedOnly === true,
  };
}

export type BlueprintDraftSource = {
  chineseTitle: string;
  englishTitle: string;
  researchGap: string;
  researchQuestions: string[];
  theory: string[];
  conceptualFramework: string | null;
  methodology: string;
  population: string;
  context: string;
  variables: string[];
  expectedContribution: string[];
  targetJournals: { journalName: string; publisher: string | null; fitScore: number | null }[];
  nstcRoute: { routeName: string; fitScore: number | null; status: string } | null;
  moeRoute: { routeName: string; fitScore: number | null; status: string } | null;
  researcherProfile: Record<string, unknown> | null;
};

export function derivePrimaryRoute(source: BlueprintDraftSource, projectType: string): BlueprintRoute {
  const normalized = (projectType || "").toUpperCase();
  if (normalized === "NSTC") return "NSTC";
  if (normalized === "MOE_TEACHING_PRACTICE") return "MOE_TEACHING_PRACTICE";
  if (normalized === "JOURNAL_MANUSCRIPT") return "JOURNAL";
  if (source.nstcRoute && !source.moeRoute) return "NSTC";
  if (source.moeRoute && !source.nstcRoute) return "MOE_TEACHING_PRACTICE";
  if (source.targetJournals.length > 0) return "JOURNAL";
  return "GENERAL";
}

export function deriveSecondaryRoute(source: BlueprintDraftSource, primary: BlueprintRoute): BlueprintRoute | null {
  if (primary === "JOURNAL") return null;
  if (source.targetJournals.length > 0) return "JOURNAL";
  return null;
}
