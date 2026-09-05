import "server-only";

export const SUBMISSION_CONTEXT_VERSION = "submission-context/1.0.0" as const;
export const SUBMISSION_NAVIGATOR_SCHEMA_VERSION = "0009" as const;

export type ContextFieldStatus = "PRESENT" | "MISSING";

export type SubmissionContextField = {
  value: string | string[] | number | null;
  status: ContextFieldStatus;
  source: string;
};

export type SubmissionContext = {
  contractVersion: typeof SUBMISSION_CONTEXT_VERSION;
  project_id: string;
  topic_id: string;
  topic_version: string;
  chinese_title: SubmissionContextField;
  english_title: SubmissionContextField;
  concept_abstract: SubmissionContextField;
  research_gap: SubmissionContextField;
  research_questions: SubmissionContextField;
  hypotheses: SubmissionContextField;
  theory: SubmissionContextField;
  conceptual_framework: SubmissionContextField;
  technology: SubmissionContextField;
  intervention: SubmissionContextField;
  population: SubmissionContextField;
  context: SubmissionContextField;
  methodology: SubmissionContextField;
  variables: SubmissionContextField;
  expected_contribution: SubmissionContextField;
  novelty_analysis: SubmissionContextField;
  feasibility_analysis: SubmissionContextField;
  evidence_ledger: SubmissionContextField;
  researcher_profile: SubmissionContextField;
  researcher_publications: SubmissionContextField;
  researcher_projects: SubmissionContextField;
  available_sample: SubmissionContextField;
  available_sites: SubmissionContextField;
  available_equipment: SubmissionContextField;
  available_data: SubmissionContextField;
  created_at: string;
};

export type ConfirmedTopic = {
  studyVersionId: string;
  logicalId: string;
  runId: string;
  candidateHash: string;
  humanGateId: string;
  candidate: Record<string, unknown>;
  runResultPayload: Record<string, unknown> | null;
};

type FieldInput = { value: string | string[] | number | null; source: string };

function present(input: FieldInput): SubmissionContextField {
  const value = Array.isArray(input.value) ? input.value.filter(Boolean) : input.value;
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  return { value: isEmpty ? null : value, status: isEmpty ? "MISSING" : "PRESENT", source: input.source };
}

function missing(source: string): SubmissionContextField {
  return { value: null, status: "MISSING", source };
}

function splitContext(text: string): { population: string; context: string } {
  const parts = text.split(/／|、|\/|\n/).map((item) => item.trim()).filter(Boolean);
  return { population: parts[0] ?? "", context: parts[1] ?? "" };
}

function stringOf(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function arrayOf(value: unknown): string[] { return Array.isArray(value) ? value.map((item) => stringOf(item)).filter(Boolean) : []; }

export function buildSubmissionContext(input: { projectId: string; confirmedTopic: ConfirmedTopic }): SubmissionContext {
  const c = input.confirmedTopic.candidate;
  const s0 = (c.s0Draft && typeof c.s0Draft === "object" ? c.s0Draft : {}) as Record<string, unknown>;
  const target = splitContext(stringOf(c.targetContext));
  const method = [stringOf(c.methodDesign), stringOf(c.dataPlan)].filter(Boolean).join("\n");
  const observations = Array.isArray(input.confirmedTopic.runResultPayload?.observations)
    ? (input.confirmedTopic.runResultPayload.observations as Array<Record<string, unknown>>).map((o) => ({
        title: stringOf(o.title), provider: stringOf(o.provider), publishedAt: stringOf(o.publishedAt), doi: stringOf(o.doi),
      })).filter((o) => o.title)
    : [];

  return {
    contractVersion: SUBMISSION_CONTEXT_VERSION,
    project_id: input.projectId,
    topic_id: input.confirmedTopic.runId,
    topic_version: `${stringOf(c.candidateId)}@${stringOf(c.candidateHash).slice(0, 12)}`,
    chinese_title: present({ value: stringOf(c.workingTitle), source: "topic_lab_candidate.workingTitle" }),
    english_title: missing("topic_lab_candidate（無英文題目欄位）"),
    concept_abstract: present({ value: stringOf(c.researchQuestion), source: "topic_lab_candidate.researchQuestion" }),
    research_gap: present({ value: stringOf(c.researchValue), source: "topic_lab_candidate.researchValue" }),
    research_questions: present({ value: stringOf(c.researchQuestion) ? [stringOf(c.researchQuestion)] : [], source: "topic_lab_candidate.researchQuestion" }),
    hypotheses: missing("topic_lab_candidate（無假設欄位）"),
    theory: present({ value: stringOf(c.mechanismTheory) ? [stringOf(c.mechanismTheory)] : [], source: "topic_lab_candidate.mechanismTheory" }),
    conceptual_framework: missing("topic_lab_candidate（無架構欄位）"),
    technology: missing("topic_lab_candidate（無技術規格欄位）"),
    intervention: present({ value: stringOf(c.methodDesign) ? [stringOf(c.methodDesign)] : [], source: "topic_lab_candidate.methodDesign" }),
    population: present({ value: target.population || stringOf(s0.targetUsers), source: "topic_lab_candidate.targetContext / s0Draft.targetUsers" }),
    context: present({ value: target.context || stringOf(s0.problemContext), source: "topic_lab_candidate.targetContext / s0Draft.problemContext" }),
    methodology: present({ value: method, source: "topic_lab_candidate.methodDesign + dataPlan" }),
    variables: missing("topic_lab_candidate（無變數欄位）"),
    expected_contribution: present({ value: stringOf(c.contribution), source: "topic_lab_candidate.contribution" }),
    novelty_analysis: present({ value: stringOf(c.novelty), source: "topic_lab_candidate.novelty" }),
    feasibility_analysis: present({ value: stringOf(c.feasibility), source: "topic_lab_candidate.feasibility" }),
    evidence_ledger: present({ value: Array.isArray(observations) ? JSON.stringify(observations) : (observations == null ? null : String(observations)), source: "topic_lab_run.resultPayload.observations（UNVERIFIED）" }),
    researcher_profile: missing("系統尚未儲存主持人履歷；請於導航器補充"),
    researcher_publications: missing("系統尚未儲存主持人著作"),
    researcher_projects: missing("系統尚未儲存主持人計畫"),
    available_sample: present({ value: stringOf(s0.availableData) || null, source: "s0Draft.availableData" }),
    available_sites: missing("s0Draft 無場域欄位"),
    available_equipment: missing("系統尚未儲存設備"),
    available_data: present({ value: stringOf(s0.existingData) || null, source: "s0Draft.existingData" }),
    created_at: new Date().toISOString(),
  };
}

export function contextSummary(context: SubmissionContext) {
  const presentCount = Object.values(context).filter((field) => field && typeof field === "object" && "status" in field && field.status === "PRESENT").length;
  const missingFields = Object.entries(context)
    .filter(([key, field]) => key !== "contractVersion" && key !== "created_at" && field && typeof field === "object" && "status" in field && field.status === "MISSING")
    .map(([key]) => key);
  return { presentCount, missingFields };
}
