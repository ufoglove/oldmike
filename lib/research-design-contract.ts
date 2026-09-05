import "server-only";

export const DESIGN_STATUSES = ["LOCKED", "DRAFT", "DESIGN_SEARCH_REQUIRED", "EVIDENCE_INCOMPLETE", "MODEL_IN_PROGRESS", "UNDER_REVIEW", "REVISION_REQUIRED", "APPROVED", "OUTDATED"] as const;
export type ResearchDesignStatus = (typeof DESIGN_STATUSES)[number];

export const DESIGN_CANDIDATE_STATUSES = ["CANDIDATE", "RECOMMENDED", "ALTERNATIVE", "NOT_RECOMMENDED", "SELECTED", "REJECTED"] as const;
export type DesignCandidateStatus = (typeof DESIGN_CANDIDATE_STATUSES)[number];

export const POWER_STATUSES = ["NOT_STARTED", "INPUT_INCOMPLETE", "PROVISIONAL", "CALCULATED", "VERIFIED", "REVISION_REQUIRED"] as const;
export type PowerStatus = (typeof POWER_STATUSES)[number];

export const MEASUREMENT_STATUSES = ["DEFINED", "CANDIDATE_REQUIRED", "EVIDENCE_INCOMPLETE", "READY_FOR_INSTRUMENT_SELECTION"] as const;
export type MeasurementStatus = (typeof MEASUREMENT_STATUSES)[number];

export const MATRIX_STATUSES = ["COMPLETE", "PARTIAL", "LOGIC_GAP", "MEASUREMENT_MISSING", "ANALYSIS_MISSING"] as const;
export type MatrixStatus = (typeof MATRIX_STATUSES)[number];

export const MEASUREMENT_TYPES = ["Questionnaire", "Knowledge Test", "Skill Assessment", "Behavioral Performance", "Reaction Time", "System Log", "Interview", "Observation", "Eye Tracking", "EDA", "EEG", "HRV", "Motion Data", "Environmental Sensor", "AI Model Metric"] as const;

export type DesignAlignmentFinding = {
  severity: "MAJOR_DESIGN_GAP" | "MINOR_DESIGN_GAP";
  code: string;
  chain: string;
  description: string;
  suggestion: string;
};

export type ResearchDesignSectionEdit = {
  section: "selected_design" | "study_identity" | "population_plan" | "sampling_plan" | "study_arms" | "allocation" | "time_points" | "intervention_spec" | "measurement_requirements" | "rq_data_analysis_matrix" | "analysis_plans" | "analysis_plan_amendments" | "validity_bias_items" | "unresolved_design_issues";
  payload: Record<string, unknown>;
  reason?: string;
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

export function validateDesignSectionEdit(value: unknown): ResearchDesignSectionEdit {
  if (!record(value) || typeof value.section !== "string") throw new Error("invalid_design_section");
  const section = value.section as ResearchDesignSectionEdit["section"];
  const payload = record(value.payload) ? value.payload : {};
  return { section, payload, reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 500) : "" };
}

export function validateDesignEvidenceLink(value: unknown): { targetType: string; targetRef: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; sourceLocation?: string; readingStatus?: string; verificationStatus?: string; note?: string } {
  if (!record(value)) throw new Error("invalid_design_evidence_link");
  const targetRef = text(value.targetRef).slice(0, 120);
  if (!targetRef) throw new Error("design_evidence_target_ref_required");
  return {
    targetType: ["DESIGN", "SAMPLING", "POWER", "MEASUREMENT", "ANALYSIS", "EFFECT_SIZE"].includes(text(value.targetType)) ? text(value.targetType) : "DESIGN",
    targetRef,
    literatureId: typeof value.literatureId === "string" && value.literatureId.trim() ? value.literatureId.trim().slice(0, 100) : undefined,
    citationSourceId: typeof value.citationSourceId === "string" && value.citationSourceId.trim() ? value.citationSourceId.trim().slice(0, 100) : undefined,
    zoteroItemKey: typeof value.zoteroItemKey === "string" && value.zoteroItemKey.trim() ? value.zoteroItemKey.trim().slice(0, 100) : undefined,
    sourceLocation: typeof value.sourceLocation === "string" && value.sourceLocation.trim() ? value.sourceLocation.trim().slice(0, 200) : undefined,
    readingStatus: value.readingStatus === "FULLTEXT_REVIEWED" ? "FULLTEXT_REVIEWED" : "ABSTRACT_REVIEWED",
    verificationStatus: ["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"].includes(text(value.verificationStatus)) ? text(value.verificationStatus) : "UNVERIFIED",
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim().slice(0, 1000) : undefined,
  };
}

export function validateDesignSelection(value: unknown): { designKey: string; selectionStatus: DesignCandidateStatus; reason?: string } {
  if (!record(value) || typeof value.designKey !== "string" || !value.designKey.trim()) throw new Error("invalid_design_selection");
  const selectionStatus = (DESIGN_CANDIDATE_STATUSES as readonly string[]).includes(text(value.selectionStatus)) ? text(value.selectionStatus) as DesignCandidateStatus : "CANDIDATE";
  return { designKey: value.designKey.trim().slice(0, 120), selectionStatus, reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 2000) : undefined };
}

export const DESIGN_FIT_DISCLAIMER = "此分數為網站內部研究設計比較分數，不代表研究一定成功或計畫一定通過。";

export const DESIGN_FIT_WEIGHTS = { rq: 20, theoryMechanism: 15, causal: 15, dataMeasurement: 10, feasibility: 15, sampleAccess: 10, validityControl: 5, ethics: 5, route: 5 };

export const DESIGN_ALIGNMENT_CODES = ["RQ_WITHOUT_DESIGN", "HYPOTHESIS_WITHOUT_ANALYSIS", "CONSTRUCT_WITHOUT_MEASUREMENT", "OUTCOME_WITHOUT_TIMEPOINT", "MEDIATOR_WITHOUT_TEMPORAL_ORDER", "MODERATOR_WITHOUT_INTERACTION_TEST", "RETENTION_WITHOUT_FOLLOWUP", "CAUSAL_CLAIM_WITHOUT_CAUSAL_DESIGN", "CONTROL_GROUP_REQUIRED", "SAMPLE_PLAN_INCOMPLETE", "POWER_ANALYSIS_INCOMPLETE", "ANALYSIS_NOT_MATCHING_DATA_TYPE", "COMMON_METHOD_BIAS_RISK", "ROUTE_METHOD_MISMATCH", "ANALYSIS_REPORTING_INCOMPLETE", "STUDENT_LEARNING_OUTCOME_MISSING"] as const;
