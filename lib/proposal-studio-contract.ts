import { createHash } from "node:crypto";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const PROPOSAL_STUDIO_CONTRACT_VERSION = "taiwan-proposal-studio/1.0.0" as const;
export const PROPOSAL_STUDIO_MAX_BODY_BYTES = 512_000;
export const PROPOSAL_SOURCE_REVIEW_WINDOW_DAYS = 180;

export const proposalModes = ["NSTC_RESEARCH", "MOE_TEACHING_PRACTICE"] as const;
export const requirementStatuses = ["PASS", "FAIL", "UNKNOWN", "NA"] as const;
export const sourceAuthorityClasses = ["NSTC_OFFICIAL", "MOE_OFFICIAL"] as const;
export const budgetCategories = ["PERSONNEL", "OPERATING", "EQUIPMENT", "TRAVEL", "OTHER"] as const;
export const guidanceFocuses = ["STRUCTURE", "METHOD_FEASIBILITY", "BUDGET_JUSTIFICATION", "RISK_AND_ALTERNATIVES"] as const;

export const nstcRequirementCategories = [
  "CALL_AND_PROGRAM",
  "ELIGIBILITY",
  "CM03_NARRATIVE",
  "BILINGUAL_ABSTRACT",
  "PRELIMINARY_EVIDENCE",
  "METHODS_AND_FEASIBILITY",
  "ETHICS_PRIVACY_DATA",
  "WORK_PLAN_AND_OUTPUTS",
  "TEAM_AND_RESOURCES",
  "BUDGET_AND_JUSTIFICATION",
  "ATTACHMENTS",
  "SUBMISSION_WINDOW",
] as const;

export const moeRequirementCategories = [
  "CALL_AND_PROGRAM",
  "ELIGIBILITY",
  "TEACHING_PROBLEM_AND_CONTEXT",
  "INTERVENTION_AND_DESIGN",
  "LEARNING_OUTCOMES",
  "DATA_AND_EVALUATION",
  "RESEARCH_ETHICS",
  "IMPLEMENTATION_FIDELITY",
  "TEACHING_ARTIFACTS_AND_REFLECTION",
  "WORK_PLAN_AND_OUTPUTS",
  "BUDGET_AND_JUSTIFICATION",
  "ATTACHMENTS_AND_SUBMISSION_WINDOW",
] as const;

export type ProposalMode = (typeof proposalModes)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type SourceAuthorityClass = (typeof sourceAuthorityClasses)[number];
export type BudgetCategory = (typeof budgetCategories)[number];
export type GuidanceFocus = (typeof guidanceFocuses)[number];
export type SourceFreshnessClass = "CURRENT" | "STALE" | "UNKNOWN";

export type OfficialProposalSource = {
  sourceUrl: string;
  authorityClass: SourceAuthorityClass;
  retrievedAt: string;
  effectiveYear: number;
  sourceHash: string;
  humanVerified: boolean;
};

export type ProposalRequirement = {
  category: string;
  status: RequirementStatus;
  officialRule: string;
  evidence: string;
  remediation: string;
  sourceHash: string;
};

export type WorkPackage = {
  workPackageId: string;
  title: string;
  objective: string;
  methods: string;
  startMonth: number;
  endMonth: number;
};

export type ProposalMilestone = { milestoneId: string; workPackageId: string; dueMonth: number; deliverable: string };
export type ProposalKpi = { kpiId: string; workPackageId: string; measure: string; target: string; evidencePlan: string };
export type TeamRole = { roleId: string; role: string; responsibility: string; contribution: string };
export type BudgetItem = {
  itemId: string;
  category: BudgetCategory;
  unit: string;
  quantity: number;
  unitCostTwd: number;
  subtotalTwd: number;
  justification: string;
  workPackageId: string;
  ruleEvidenceStatus: RequirementStatus;
};

export type ProposalDraft = {
  mode: ProposalMode;
  callProgram: { programName: string; programCode: string | null; effectiveYear: number };
  officialSource: OfficialProposalSource;
  bilingual: {
    titleZhTw: string;
    titleEn: string;
    abstractZhTw: string;
    abstractEn: string;
    keywordsZhTw: string[];
    keywordsEn: string[];
  };
  narrative: {
    problem: string;
    background: string;
    literatureGap: string;
    aims: string[];
    researchQuestions: string[];
    hypotheses: string[];
    innovation: string;
    significance: string;
    expectedImpact: string;
    methods: string;
    sample: string;
    data: string;
    analysis: string;
    ethics: string;
    privacy: string;
    risks: string[];
    alternatives: string[];
  };
  modeSpecific:
    | { kind: "NSTC_RESEARCH"; cm03Narrative: string; preliminaryEvidence: string; feasibility: string; expectedOutputs: string[] }
    | { kind: "MOE_TEACHING_PRACTICE"; courseContext: string; teachingProblem: string; intervention: string; learningOutcomes: string[]; evaluationDesign: string; implementationFidelity: string; teachingArtifacts: string[]; reflectionPlan: string };
  workPackages: WorkPackage[];
  milestones: ProposalMilestone[];
  kpis: ProposalKpi[];
  team: TeamRole[];
  resources: string[];
  budget: { currency: "TWD"; items: BudgetItem[]; totalTwd: number };
  requirements: ProposalRequirement[];
  attachments: Array<{ attachmentId: string; label: string; required: boolean; status: RequirementStatus; evidence: string }>;
  unresolvedIssues: string[];
};

export type SaveProposalVersionRequest = {
  operation: "SAVE_PROPOSAL_VERSION";
  idempotencyKey: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  sourceDocumentVersionId: string | null;
  sourceContentHash: string | null;
  proposal: ProposalDraft;
};

export type RequestProposalGuidanceRequest = {
  operation: "REQUEST_PROPOSAL_GUIDANCE";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  focus: GuidanceFocus;
  modeProfile: ModelModeProfile;
};

export type ApproveProposalRequest = {
  operation: "APPROVE_PROPOSAL";
  idempotencyKey: string;
  documentVersionId: string;
  contentHash: string;
  rationale: string;
};

export type ExportProposalPreviewRequest = {
  operation: "EXPORT_PROPOSAL_PREVIEW";
  documentVersionId: string;
  contentHash: string;
  humanGateId: string;
  format: "JSON" | "MARKDOWN";
};

export type ProposalStudioRequest = SaveProposalVersionRequest | RequestProposalGuidanceRequest | ApproveProposalRequest | ExportProposalPreviewRequest;

export type ProposalValidationSummary = {
  sourceFreshness: SourceFreshnessClass;
  factualPass: number;
  factualFail: number;
  factualUnknown: number;
  factualNa: number;
  budgetArithmetic: "PASS";
  workPackageLinkage: "PASS";
  totalTwd: number;
  unresolvedCount: number;
};

export class ProposalStudioContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = "ProposalStudioContractError"; this.code = code; this.status = status; }
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, expected: readonly string[]) { const actual = Object.keys(value).sort(); const wanted = [...expected].sort(); return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]); }
function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new ProposalStudioContractError(code); return value as T; }
function identifier(value: unknown, code: string, min = 4, max = 160) { if (typeof value !== "string" || value.length < min || value.length > max || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new ProposalStudioContractError(code); return value; }
function digest(value: unknown, code: string) { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new ProposalStudioContractError(code); return value; }
function integer(value: unknown, code: string, min = 0, max = 10_000_000) { if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new ProposalStudioContractError(code); return Number(value); }
function text(value: unknown, code: string, max: number, min = 1) { if (typeof value !== "string") throw new ProposalStudioContractError(code); const parsed = value.normalize("NFC").trim(); if (parsed.length < min || parsed.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(parsed)) throw new ProposalStudioContractError(code); return parsed; }
function nullableText(value: unknown, code: string, max: number) { return value === null ? null : text(value, code, max); }
function iso(value: unknown, code: string) { if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) throw new ProposalStudioContractError(code); return value; }
function list(value: unknown, code: string, maxItems: number, itemMax: number, minItems = 0) { if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw new ProposalStudioContractError(code); return value.map((item) => text(item, code, itemMax)); }
function unique<T>(items: T[], key: (item: T) => string, code: string) { if (new Set(items.map(key)).size !== items.length) throw new ProposalStudioContractError(code); return items; }

function httpsUrl(value: unknown) {
  const source = text(value, "invalid_official_source_url", 2_000);
  let parsed: URL;
  try { parsed = new URL(source); } catch { throw new ProposalStudioContractError("invalid_official_source_url"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || !parsed.hostname || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) throw new ProposalStudioContractError("invalid_official_source_url");
  return parsed.toString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function proposalStudioHash(value: unknown) { return createHash("sha256").update(canonical(value), "utf8").digest("hex"); }

function parseSource(value: unknown, mode: ProposalMode): OfficialProposalSource {
  if (!record(value) || !exactKeys(value, ["sourceUrl", "authorityClass", "retrievedAt", "effectiveYear", "sourceHash", "humanVerified"])) throw new ProposalStudioContractError("invalid_official_source_shape");
  const authorityClass = enumValue(value.authorityClass, sourceAuthorityClasses, "invalid_source_authority_class");
  if ((mode === "NSTC_RESEARCH") !== (authorityClass === "NSTC_OFFICIAL")) throw new ProposalStudioContractError("source_mode_authority_mismatch");
  if (typeof value.humanVerified !== "boolean") throw new ProposalStudioContractError("invalid_source_human_verification");
  return { sourceUrl: httpsUrl(value.sourceUrl), authorityClass, retrievedAt: iso(value.retrievedAt, "invalid_source_retrieved_at"), effectiveYear: integer(value.effectiveYear, "invalid_effective_year", 2000, 2200), sourceHash: digest(value.sourceHash, "invalid_source_hash"), humanVerified: value.humanVerified };
}

function parseBilingual(value: unknown): ProposalDraft["bilingual"] {
  if (!record(value) || !exactKeys(value, ["titleZhTw", "titleEn", "abstractZhTw", "abstractEn", "keywordsZhTw", "keywordsEn"])) throw new ProposalStudioContractError("invalid_bilingual_shape");
  const keywordsZhTw = unique(list(value.keywordsZhTw, "invalid_keywords_zh_tw", 12, 80, 1), (item) => item.toLocaleLowerCase("zh-TW"), "duplicate_keywords_zh_tw");
  const keywordsEn = unique(list(value.keywordsEn, "invalid_keywords_en", 12, 80, 1), (item) => item.toLocaleLowerCase("en"), "duplicate_keywords_en");
  return { titleZhTw: text(value.titleZhTw, "invalid_title_zh_tw", 500), titleEn: text(value.titleEn, "invalid_title_en", 500), abstractZhTw: text(value.abstractZhTw, "invalid_abstract_zh_tw", 12_000), abstractEn: text(value.abstractEn, "invalid_abstract_en", 12_000), keywordsZhTw, keywordsEn };
}

function parseNarrative(value: unknown): ProposalDraft["narrative"] {
  const keys = ["problem", "background", "literatureGap", "aims", "researchQuestions", "hypotheses", "innovation", "significance", "expectedImpact", "methods", "sample", "data", "analysis", "ethics", "privacy", "risks", "alternatives"];
  if (!record(value) || !exactKeys(value, keys)) throw new ProposalStudioContractError("invalid_narrative_shape");
  return {
    problem: text(value.problem, "invalid_problem", 16_000), background: text(value.background, "invalid_background", 24_000), literatureGap: text(value.literatureGap, "invalid_literature_gap", 16_000),
    aims: list(value.aims, "invalid_aims", 12, 2_000, 1), researchQuestions: list(value.researchQuestions, "invalid_research_questions", 12, 2_000, 1), hypotheses: list(value.hypotheses, "invalid_hypotheses", 12, 2_000),
    innovation: text(value.innovation, "invalid_innovation", 12_000), significance: text(value.significance, "invalid_significance", 12_000), expectedImpact: text(value.expectedImpact, "invalid_expected_impact", 12_000),
    methods: text(value.methods, "invalid_methods", 24_000), sample: text(value.sample, "invalid_sample", 8_000), data: text(value.data, "invalid_data", 12_000), analysis: text(value.analysis, "invalid_analysis", 16_000), ethics: text(value.ethics, "invalid_ethics", 8_000), privacy: text(value.privacy, "invalid_privacy", 8_000),
    risks: list(value.risks, "invalid_risks", 20, 2_000, 1), alternatives: list(value.alternatives, "invalid_alternatives", 20, 2_000, 1),
  };
}

function parseModeSpecific(value: unknown, mode: ProposalMode): ProposalDraft["modeSpecific"] {
  if (!record(value) || value.kind !== mode) throw new ProposalStudioContractError("mode_specific_binding_mismatch");
  if (mode === "NSTC_RESEARCH") {
    if (!exactKeys(value, ["kind", "cm03Narrative", "preliminaryEvidence", "feasibility", "expectedOutputs"])) throw new ProposalStudioContractError("invalid_nstc_module_shape");
    return { kind: "NSTC_RESEARCH", cm03Narrative: text(value.cm03Narrative, "invalid_cm03_narrative", 48_000), preliminaryEvidence: text(value.preliminaryEvidence, "invalid_preliminary_evidence", 16_000), feasibility: text(value.feasibility, "invalid_feasibility", 12_000), expectedOutputs: list(value.expectedOutputs, "invalid_expected_outputs", 20, 2_000, 1) };
  }
  if (!exactKeys(value, ["kind", "courseContext", "teachingProblem", "intervention", "learningOutcomes", "evaluationDesign", "implementationFidelity", "teachingArtifacts", "reflectionPlan"])) throw new ProposalStudioContractError("invalid_moe_module_shape");
  return { kind: "MOE_TEACHING_PRACTICE", courseContext: text(value.courseContext, "invalid_course_context", 12_000), teachingProblem: text(value.teachingProblem, "invalid_teaching_problem", 12_000), intervention: text(value.intervention, "invalid_intervention", 16_000), learningOutcomes: list(value.learningOutcomes, "invalid_learning_outcomes", 20, 2_000, 1), evaluationDesign: text(value.evaluationDesign, "invalid_evaluation_design", 16_000), implementationFidelity: text(value.implementationFidelity, "invalid_implementation_fidelity", 8_000), teachingArtifacts: list(value.teachingArtifacts, "invalid_teaching_artifacts", 20, 2_000, 1), reflectionPlan: text(value.reflectionPlan, "invalid_reflection_plan", 8_000) };
}

function parseWorkPackages(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new ProposalStudioContractError("invalid_work_packages");
  return unique(value.map((item) => { if (!record(item) || !exactKeys(item, ["workPackageId", "title", "objective", "methods", "startMonth", "endMonth"])) throw new ProposalStudioContractError("invalid_work_package_shape"); const startMonth = integer(item.startMonth, "invalid_work_package_month", 1, 120); const endMonth = integer(item.endMonth, "invalid_work_package_month", 1, 120); if (startMonth > endMonth) throw new ProposalStudioContractError("invalid_work_package_range"); return { workPackageId: identifier(item.workPackageId, "invalid_work_package_id"), title: text(item.title, "invalid_work_package_title", 500), objective: text(item.objective, "invalid_work_package_objective", 4_000), methods: text(item.methods, "invalid_work_package_methods", 8_000), startMonth, endMonth }; }), (item) => item.workPackageId, "duplicate_work_package_id");
}

function parseMilestones(value: unknown, workPackageIds: ReadonlySet<string>) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new ProposalStudioContractError("invalid_milestones");
  return unique(value.map((item) => { if (!record(item) || !exactKeys(item, ["milestoneId", "workPackageId", "dueMonth", "deliverable"])) throw new ProposalStudioContractError("invalid_milestone_shape"); const workPackageId = identifier(item.workPackageId, "invalid_milestone_work_package"); if (!workPackageIds.has(workPackageId)) throw new ProposalStudioContractError("milestone_work_package_not_found"); return { milestoneId: identifier(item.milestoneId, "invalid_milestone_id"), workPackageId, dueMonth: integer(item.dueMonth, "invalid_milestone_month", 1, 120), deliverable: text(item.deliverable, "invalid_milestone_deliverable", 4_000) }; }), (item) => item.milestoneId, "duplicate_milestone_id");
}

function parseKpis(value: unknown, workPackageIds: ReadonlySet<string>) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new ProposalStudioContractError("invalid_kpis");
  return unique(value.map((item) => { if (!record(item) || !exactKeys(item, ["kpiId", "workPackageId", "measure", "target", "evidencePlan"])) throw new ProposalStudioContractError("invalid_kpi_shape"); const workPackageId = identifier(item.workPackageId, "invalid_kpi_work_package"); if (!workPackageIds.has(workPackageId)) throw new ProposalStudioContractError("kpi_work_package_not_found"); return { kpiId: identifier(item.kpiId, "invalid_kpi_id"), workPackageId, measure: text(item.measure, "invalid_kpi_measure", 2_000), target: text(item.target, "invalid_kpi_target", 2_000), evidencePlan: text(item.evidencePlan, "invalid_kpi_evidence", 4_000) }; }), (item) => item.kpiId, "duplicate_kpi_id");
}

function parseTeam(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new ProposalStudioContractError("invalid_team");
  return unique(value.map((item) => { if (!record(item) || !exactKeys(item, ["roleId", "role", "responsibility", "contribution"])) throw new ProposalStudioContractError("invalid_team_role_shape"); return { roleId: identifier(item.roleId, "invalid_role_id"), role: text(item.role, "invalid_role", 300), responsibility: text(item.responsibility, "invalid_responsibility", 4_000), contribution: text(item.contribution, "invalid_contribution", 4_000) }; }), (item) => item.roleId, "duplicate_role_id");
}

function parseBudget(value: unknown, workPackageIds: ReadonlySet<string>) {
  if (!record(value) || !exactKeys(value, ["currency", "items", "totalTwd"]) || value.currency !== "TWD" || !Array.isArray(value.items) || value.items.length > 100) throw new ProposalStudioContractError("invalid_budget_shape");
  const items = unique(value.items.map((item) => {
    if (!record(item) || !exactKeys(item, ["itemId", "category", "unit", "quantity", "unitCostTwd", "subtotalTwd", "justification", "workPackageId", "ruleEvidenceStatus"])) throw new ProposalStudioContractError("invalid_budget_item_shape");
    const workPackageId = identifier(item.workPackageId, "invalid_budget_work_package"); if (!workPackageIds.has(workPackageId)) throw new ProposalStudioContractError("budget_work_package_not_found");
    const quantity = integer(item.quantity, "invalid_budget_quantity", 1, 1_000_000); const unitCostTwd = integer(item.unitCostTwd, "invalid_budget_unit_cost", 0, 100_000_000); const subtotalTwd = integer(item.subtotalTwd, "invalid_budget_subtotal", 0, 1_000_000_000);
    if (quantity * unitCostTwd !== subtotalTwd) throw new ProposalStudioContractError("budget_arithmetic_mismatch", 422);
    return { itemId: identifier(item.itemId, "invalid_budget_item_id"), category: enumValue(item.category, budgetCategories, "invalid_budget_category"), unit: text(item.unit, "invalid_budget_unit", 120), quantity, unitCostTwd, subtotalTwd, justification: text(item.justification, "invalid_budget_justification", 4_000, 8), workPackageId, ruleEvidenceStatus: enumValue(item.ruleEvidenceStatus, requirementStatuses, "invalid_budget_rule_status") };
  }), (item) => item.itemId, "duplicate_budget_item_id");
  const computed = items.reduce((sum, item) => sum + item.subtotalTwd, 0); const totalTwd = integer(value.totalTwd, "invalid_budget_total", 0, 10_000_000_000); if (computed !== totalTwd) throw new ProposalStudioContractError("budget_total_mismatch", 422);
  return { currency: "TWD" as const, items, totalTwd };
}

function parseRequirements(value: unknown, mode: ProposalMode, source: OfficialProposalSource) {
  const required = mode === "NSTC_RESEARCH" ? [...nstcRequirementCategories] : [...moeRequirementCategories];
  if (!Array.isArray(value) || value.length !== required.length) throw new ProposalStudioContractError("requirements_matrix_incomplete");
  const rows = unique(value.map((item) => {
    if (!record(item) || !exactKeys(item, ["category", "status", "officialRule", "evidence", "remediation", "sourceHash"])) throw new ProposalStudioContractError("invalid_requirement_shape");
    const category = enumValue(item.category, required, "invalid_requirement_category"); const status = enumValue(item.status, requirementStatuses, "invalid_requirement_status"); const sourceHash = digest(item.sourceHash, "invalid_requirement_source_hash");
    if (sourceHash !== source.sourceHash) throw new ProposalStudioContractError("requirement_source_hash_mismatch");
    if (!source.humanVerified && !["UNKNOWN", "NA"].includes(status)) throw new ProposalStudioContractError("unverified_source_cannot_decide_fact");
    return { category, status, officialRule: text(item.officialRule, "invalid_official_rule", 8_000), evidence: text(item.evidence, "invalid_requirement_evidence", 8_000), remediation: text(item.remediation, "invalid_requirement_remediation", 8_000) , sourceHash };
  }), (item) => item.category, "duplicate_requirement_category");
  if (required.some((category) => !rows.some((item) => item.category === category))) throw new ProposalStudioContractError("requirements_matrix_incomplete");
  return rows;
}

function parseAttachments(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) throw new ProposalStudioContractError("invalid_attachments");
  return unique(value.map((item) => { if (!record(item) || !exactKeys(item, ["attachmentId", "label", "required", "status", "evidence"]) || typeof item.required !== "boolean") throw new ProposalStudioContractError("invalid_attachment_shape"); return { attachmentId: identifier(item.attachmentId, "invalid_attachment_id"), label: text(item.label, "invalid_attachment_label", 500), required: item.required, status: enumValue(item.status, requirementStatuses, "invalid_attachment_status"), evidence: text(item.evidence, "invalid_attachment_evidence", 4_000) }; }), (item) => item.attachmentId, "duplicate_attachment_id");
}

export function parseProposalDraft(value: unknown): ProposalDraft {
  const keys = ["mode", "callProgram", "officialSource", "bilingual", "narrative", "modeSpecific", "workPackages", "milestones", "kpis", "team", "resources", "budget", "requirements", "attachments", "unresolvedIssues"];
  if (!record(value) || !exactKeys(value, keys)) throw new ProposalStudioContractError("invalid_proposal_shape");
  const mode = enumValue(value.mode, proposalModes, "invalid_proposal_mode");
  if (!record(value.callProgram) || !exactKeys(value.callProgram, ["programName", "programCode", "effectiveYear"])) throw new ProposalStudioContractError("invalid_call_program_shape");
  const callProgram = { programName: text(value.callProgram.programName, "invalid_program_name", 500), programCode: nullableText(value.callProgram.programCode, "invalid_program_code", 160), effectiveYear: integer(value.callProgram.effectiveYear, "invalid_program_year", 2000, 2200) };
  const officialSource = parseSource(value.officialSource, mode); if (officialSource.effectiveYear !== callProgram.effectiveYear) throw new ProposalStudioContractError("effective_year_binding_mismatch");
  const workPackages = parseWorkPackages(value.workPackages); const workPackageIds = new Set(workPackages.map((item) => item.workPackageId));
  return {
    mode, callProgram, officialSource, bilingual: parseBilingual(value.bilingual), narrative: parseNarrative(value.narrative), modeSpecific: parseModeSpecific(value.modeSpecific, mode), workPackages,
    milestones: parseMilestones(value.milestones, workPackageIds), kpis: parseKpis(value.kpis, workPackageIds), team: parseTeam(value.team), resources: list(value.resources, "invalid_resources", 40, 2_000, 1), budget: parseBudget(value.budget, workPackageIds), requirements: parseRequirements(value.requirements, mode, officialSource), attachments: parseAttachments(value.attachments), unresolvedIssues: list(value.unresolvedIssues, "invalid_unresolved_issues", 40, 2_000),
  };
}

export function sourceFreshnessClass(source: OfficialProposalSource, now = new Date()): SourceFreshnessClass {
  const observed = Date.parse(source.retrievedAt); const execution = now.getTime();
  if (!Number.isFinite(observed)) return "UNKNOWN";
  const observedDay = new Date(observed).toISOString().slice(0, 10); const executionDay = now.toISOString().slice(0, 10);
  // The editor captures an official-source calendar date, not a clock time. A
  // later calendar day is future evidence; an intra-day UTC offset is not.
  if (observed > execution + 5 * 60_000 && observedDay !== executionDay) return "UNKNOWN";
  return execution - observed > PROPOSAL_SOURCE_REVIEW_WINDOW_DAYS * 86_400_000 ? "STALE" : "CURRENT";
}

export function proposalValidationSummary(proposal: ProposalDraft, now = new Date()): ProposalValidationSummary {
  const counts = { PASS: 0, FAIL: 0, UNKNOWN: 0, NA: 0 } as Record<RequirementStatus, number>;
  for (const requirement of proposal.requirements) counts[requirement.status] += 1;
  return { sourceFreshness: sourceFreshnessClass(proposal.officialSource, now), factualPass: counts.PASS, factualFail: counts.FAIL, factualUnknown: counts.UNKNOWN, factualNa: counts.NA, budgetArithmetic: "PASS", workPackageLinkage: "PASS", totalTwd: proposal.budget.totalTwd, unresolvedCount: proposal.unresolvedIssues.length };
}

export function assertProposalPromotable(proposal: ProposalDraft, now = new Date()) {
  const summary = proposalValidationSummary(proposal, now);
  if (!proposal.officialSource.humanVerified) throw new ProposalStudioContractError("official_source_human_verification_required", 422);
  if (summary.sourceFreshness !== "CURRENT") throw new ProposalStudioContractError("official_source_freshness_required", 422);
  if (summary.factualFail > 0 || summary.factualUnknown > 0) throw new ProposalStudioContractError("proposal_requirements_unresolved", 422);
  if (summary.unresolvedCount > 0) throw new ProposalStudioContractError("proposal_unresolved_issues", 422);
  if (proposal.attachments.some((item) => item.required && item.status !== "PASS")) throw new ProposalStudioContractError("proposal_attachments_unresolved", 422);
  if (proposal.budget.items.some((item) => !["PASS", "NA"].includes(item.ruleEvidenceStatus))) throw new ProposalStudioContractError("budget_rule_evidence_unresolved", 422);
  return true;
}

export function parseProposalStudioRequest(value: unknown): ProposalStudioRequest {
  if (!record(value) || typeof value.operation !== "string") throw new ProposalStudioContractError("invalid_proposal_request");
  if (value.operation === "SAVE_PROPOSAL_VERSION") {
    const keys = ["operation", "idempotencyKey", "logicalId", "expectedVersion", "title", "sourceDocumentVersionId", "sourceContentHash", "proposal"];
    if (!exactKeys(value, keys)) throw new ProposalStudioContractError("invalid_save_proposal_shape");
    if ((value.sourceDocumentVersionId === null) !== (value.sourceContentHash === null)) throw new ProposalStudioContractError("source_document_binding_mismatch");
    return { operation: "SAVE_PROPOSAL_VERSION", idempotencyKey: identifier(value.idempotencyKey, "invalid_idempotency_key", 8, 160), logicalId: identifier(value.logicalId, "invalid_logical_id", 8, 160), expectedVersion: integer(value.expectedVersion, "invalid_expected_version", 0, 100_000), title: text(value.title, "invalid_proposal_title", 500), sourceDocumentVersionId: value.sourceDocumentVersionId === null ? null : identifier(value.sourceDocumentVersionId, "invalid_source_document_id", 8, 200), sourceContentHash: value.sourceContentHash === null ? null : digest(value.sourceContentHash, "invalid_source_content_hash"), proposal: parseProposalDraft(value.proposal) };
  }
  if (value.operation === "REQUEST_PROPOSAL_GUIDANCE") {
    if (!exactKeys(value, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "focus", "modeProfile"])) throw new ProposalStudioContractError("invalid_guidance_request_shape");
    return { operation: "REQUEST_PROPOSAL_GUIDANCE", idempotencyKey: identifier(value.idempotencyKey, "invalid_idempotency_key", 8, 160), documentVersionId: identifier(value.documentVersionId, "invalid_document_id", 8, 200), contentHash: digest(value.contentHash, "invalid_content_hash"), focus: enumValue(value.focus, guidanceFocuses, "invalid_guidance_focus"), modeProfile: parseModelModeProfile(value.modeProfile) };
  }
  if (value.operation === "APPROVE_PROPOSAL") {
    if (!exactKeys(value, ["operation", "idempotencyKey", "documentVersionId", "contentHash", "rationale"])) throw new ProposalStudioContractError("invalid_approval_request_shape");
    return { operation: "APPROVE_PROPOSAL", idempotencyKey: identifier(value.idempotencyKey, "invalid_idempotency_key", 8, 160), documentVersionId: identifier(value.documentVersionId, "invalid_document_id", 8, 200), contentHash: digest(value.contentHash, "invalid_content_hash"), rationale: text(value.rationale, "invalid_approval_rationale", 4_000, 8) };
  }
  if (value.operation === "EXPORT_PROPOSAL_PREVIEW") {
    if (!exactKeys(value, ["operation", "documentVersionId", "contentHash", "humanGateId", "format"])) throw new ProposalStudioContractError("invalid_export_request_shape");
    return { operation: "EXPORT_PROPOSAL_PREVIEW", documentVersionId: identifier(value.documentVersionId, "invalid_document_id", 8, 200), contentHash: digest(value.contentHash, "invalid_content_hash"), humanGateId: identifier(value.humanGateId, "invalid_human_gate_id", 8, 200), format: enumValue(value.format, ["JSON", "MARKDOWN"] as const, "invalid_export_format") };
  }
  throw new ProposalStudioContractError("unsupported_proposal_operation");
}

export function proposalRequestHash(request: ProposalStudioRequest) { return proposalStudioHash(request); }

export function buildProposalMarkdown(title: string, proposal: ProposalDraft) {
  const lines = [
    `# ${title}`, "", `- 模式：${proposal.mode}`, `- 計畫／徵件：${proposal.callProgram.programName}`, `- 有效年度：${proposal.callProgram.effectiveYear}`, `- 官方來源狀態：${proposal.officialSource.humanVerified ? "人工已核對" : "尚未人工核對"}`, "",
    `## ${proposal.bilingual.titleZhTw}`, "", proposal.bilingual.abstractZhTw, "", `## ${proposal.bilingual.titleEn}`, "", proposal.bilingual.abstractEn, "", "## 研究問題與目標", "", proposal.narrative.problem, "", ...proposal.narrative.aims.map((item) => `- ${item}`), "", "## 方法、倫理與風險", "", proposal.narrative.methods, "", proposal.narrative.ethics, "", ...proposal.narrative.risks.map((item) => `- 風險：${item}`), ...proposal.narrative.alternatives.map((item) => `- 替代方案：${item}`), "", "## 工作包與里程碑", "",
    ...proposal.workPackages.flatMap((item) => [`### ${item.workPackageId} ${item.title}`, item.objective, item.methods, `月份：${item.startMonth}–${item.endMonth}`, ""]),
    "## 預算（TWD）", "", ...proposal.budget.items.map((item) => `- ${item.category}｜${item.quantity} ${item.unit} × ${item.unitCostTwd} = ${item.subtotalTwd}｜${item.justification}｜${item.workPackageId}`), `- 合計：${proposal.budget.totalTwd}`, "", "## 官方要求矩陣", "", ...proposal.requirements.map((item) => `- ${item.category}｜${item.status}｜${item.evidence}｜補救：${item.remediation}`), "", "## 未解事項", "", ...(proposal.unresolvedIssues.length ? proposal.unresolvedIssues.map((item) => `- ${item}`) : ["- 無"]), "", "本預覽僅供人工核對，不代表線上送件。",
  ];
  const output = lines.join("\n"); if (Buffer.byteLength(output, "utf8") > 512_000) throw new ProposalStudioContractError("proposal_export_too_large", 413); return output;
}
