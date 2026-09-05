import { createHash } from "node:crypto";

export const LIFECYCLE_CONTRACT_VERSION = "1.5.6";

export const FORMAL_STAGES = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"] as const;
export type FormalStage = typeof FORMAL_STAGES[number];

export const STAGE_DETAILS = [
  "S0_RESEARCH_DIRECTION_HUMAN_GATE",
  "S1_DESIGN_DRAFT",
  "S1_DESIGN_LOCKED",
  "S2_DATASET_REGISTERED",
  "S2_EVIDENCE_REGISTERED",
  "S3_ANALYSIS_PLAN_LOCKED",
  "S4_ANALYSIS_COMPLETED",
  "S5_EVIDENCE_SCREENED",
  "S6_RESULTS_HUMAN_GATE",
  "S7_DOCUMENT_DRAFT",
  "S8_RELEASE_HUMAN_GATE",
  "S9_ARCHIVED",
] as const;
export type StageDetail = typeof STAGE_DETAILS[number];

export const ALLOWED_ANALYSIS_METHODS = [
  "DESCRIPTIVE_STATISTICS",
  "MISSING_VALUE_SUMMARY",
  "CORRELATION",
  "TWO_GROUP_COMPARISON",
] as const;
export type AnalysisMethod = typeof ALLOWED_ANALYSIS_METHODS[number];

export type AnalysisParameters = {
  pairing: "PAIRED" | "UNPAIRED";
  correlation?: "PEARSON" | "SPEARMAN";
  test?: "STUDENT" | "WELCH";
  tail: "TWO_SIDED" | "ONE_SIDED";
  alternative?: "GREATER" | "LESS";
  alpha: number;
  missingValuePolicy: "COMPLETE_CASE" | "PAIRWISE";
  precision: number;
  rounding: "HALF_EVEN" | "HALF_UP";
};

export const WORKFLOW_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  S0: ["S1", "S0_RESEARCH_DIRECTION_HUMAN_GATE"], S1: ["S2", "S1_DESIGN_DRAFT"],
  S2: ["S3", "S2_DATASET_REGISTERED", "S2_EVIDENCE_REGISTERED"], S3: ["S4", "S3_ANALYSIS_PLAN_LOCKED"],
  S4: ["S5", "S4_ANALYSIS_COMPLETED"], S5: ["S6", "S5_EVIDENCE_SCREENED"],
  S6: ["S7", "S6_RESULTS_HUMAN_GATE"], S7: ["S8", "S7_DOCUMENT_DRAFT"],
  S8: ["S9", "S8_RELEASE_HUMAN_GATE"], S9: ["S9_ARCHIVED"],
  S0_RESEARCH_DIRECTION_HUMAN_GATE: ["S1_DESIGN_DRAFT"],
  S1_DESIGN_DRAFT: ["S1_DESIGN_LOCKED"], S1_DESIGN_LOCKED: ["S2_DATASET_REGISTERED"],
  S2_DATASET_REGISTERED: ["S2_EVIDENCE_REGISTERED", "S3_ANALYSIS_PLAN_LOCKED"],
  S2_EVIDENCE_REGISTERED: ["S3_ANALYSIS_PLAN_LOCKED"], S3_ANALYSIS_PLAN_LOCKED: ["S4_ANALYSIS_COMPLETED"],
  S4_ANALYSIS_COMPLETED: ["S5_EVIDENCE_SCREENED"], S5_EVIDENCE_SCREENED: ["S6_RESULTS_HUMAN_GATE"],
  S6_RESULTS_HUMAN_GATE: ["S7_DOCUMENT_DRAFT"], S7_DOCUMENT_DRAFT: ["S8_RELEASE_HUMAN_GATE"],
  S8_RELEASE_HUMAN_GATE: ["S9_ARCHIVED"], S9_ARCHIVED: [],
});

export const HUMAN_GATE_TYPES = ["EVIDENCE_VERIFICATION", "CLAIM_SUPPORT", "RESULTS_RELEASE", "DOCUMENT_RELEASE", "ARCHIVE_RELEASE", "RESEARCH_DIRECTION"] as const;
export const HUMAN_GATE_DECISIONS = ["APPROVED", "REJECTED", "REVOKED"] as const;
export const SOURCE_IDENTITY_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;
export const CLAIM_SUPPORT_STATUSES = ["UNVERIFIED", "AI_PROPOSED", "SUPPORTED", "UNSUPPORTED"] as const;

export function isWorkflowTransitionAllowed(fromStage: string, toStage: string): boolean {
  return WORKFLOW_TRANSITIONS[fromStage]?.includes(toStage) ?? false;
}

export function hasRequiredStageDetail(stage: string, detail: string | null | undefined): boolean {
  if (FORMAL_STAGES.includes(stage as FormalStage)) {
    return Boolean(detail && STAGE_DETAILS.includes(detail as StageDetail) && detail.startsWith(`${stage}_`));
  }
  return detail === null || detail === undefined || detail === "";
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Object.is(value, -0) ? 0 : Number(value.toString());
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]));
  }
  return null;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function normalizeAnalysisParameters(method: AnalysisMethod, input: Partial<AnalysisParameters>): AnalysisParameters {
  const params: AnalysisParameters = {
    pairing: input.pairing ?? "UNPAIRED",
    correlation: method === "CORRELATION" ? (input.correlation ?? "PEARSON") : undefined,
    test: method === "TWO_GROUP_COMPARISON" ? (input.test ?? "WELCH") : undefined,
    tail: input.tail ?? "TWO_SIDED",
    alternative: (input.tail ?? "TWO_SIDED") === "ONE_SIDED" ? (input.alternative ?? "GREATER") : undefined,
    alpha: input.alpha ?? 0.05,
    missingValuePolicy: input.missingValuePolicy ?? "COMPLETE_CASE",
    precision: input.precision ?? 6,
    rounding: input.rounding ?? "HALF_EVEN",
  };
  if (!(["PAIRED", "UNPAIRED"] as const).includes(params.pairing)) throw new Error("invalid_analysis_pairing");
  if (!(["TWO_SIDED", "ONE_SIDED"] as const).includes(params.tail)) throw new Error("invalid_analysis_tail");
  if (params.alternative && !(["GREATER", "LESS"] as const).includes(params.alternative)) throw new Error("invalid_analysis_alternative");
  if (!(["COMPLETE_CASE", "PAIRWISE"] as const).includes(params.missingValuePolicy)) throw new Error("invalid_missing_value_policy");
  if (!(["HALF_EVEN", "HALF_UP"] as const).includes(params.rounding)) throw new Error("invalid_analysis_rounding");
  if (!Number.isFinite(params.alpha) || params.alpha <= 0 || params.alpha >= 1) throw new Error("invalid_analysis_alpha");
  if (!Number.isInteger(params.precision) || params.precision < 0 || params.precision > 12) throw new Error("invalid_analysis_precision");
  if (method === "CORRELATION" && !params.correlation) throw new Error("correlation_method_required");
  if (params.correlation && !(["PEARSON", "SPEARMAN"] as const).includes(params.correlation)) throw new Error("invalid_correlation_method");
  if (method === "TWO_GROUP_COMPARISON" && !params.test) throw new Error("comparison_test_required");
  if (params.test && !(["STUDENT", "WELCH"] as const).includes(params.test)) throw new Error("invalid_comparison_test");
  return params;
}

export function makeAnalysisInputHash(input: { datasetSha256: string; analysisPlanHash: string; method: AnalysisMethod; parameters: AnalysisParameters; engine: string; engineVersion: string }): string {
  return sha256Canonical(input);
}

export function canPublishClaim(status: string, evidenceStatuses: readonly string[]): boolean {
  return status === "SUPPORTED" && evidenceStatuses.some((value) => value === "SUPPORTED");
}

export function stableArchiveManifest(input: Record<string, unknown>): string {
  return canonicalJson({ schemaVersion: "1.5.6", ...input, artifactPaths: [...((input.artifactPaths as string[] | undefined) ?? [])].sort(), workflowEvents: input.workflowEvents ?? [], humanGates: input.humanGates ?? [], evidenceReferences: input.evidenceReferences ?? [] });
}
