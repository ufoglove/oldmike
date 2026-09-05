import "server-only";

export const THEORY_STATUSES = ["LOCKED", "DRAFT", "THEORY_SEARCH_REQUIRED", "EVIDENCE_INCOMPLETE", "MODEL_IN_PROGRESS", "UNDER_REVIEW", "REVISION_REQUIRED", "APPROVED", "OUTDATED"] as const;
export type TheoryMechanismStatus = (typeof THEORY_STATUSES)[number];

export const SELECTION_MODES = ["FORMAL_THEORY", "CONCEPTUAL_FRAMEWORK_ONLY"] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

export const CANDIDATE_STATUSES = ["CANDIDATE", "CORE", "SUPPORTING", "COMPETING", "REJECTED", "INSUFFICIENT_EVIDENCE"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CONSTRUCT_ROLES = ["INDEPENDENT_VARIABLE", "DEPENDENT_VARIABLE", "MEDIATOR", "MODERATOR", "CONTROL", "CONTEXTUAL_FACTOR", "PROCESS_VARIABLE", "TECHNICAL_VARIABLE", "LEARNING_OUTCOME"] as const;
export type ConstructRole = (typeof CONSTRUCT_ROLES)[number];

export const OPERATIONALIZATION_STATUSES = ["DEFINED", "PARTIAL", "MISSING", "NOT_APPLICABLE"] as const;

export const MECHANISM_STATUSES = ["PROPOSED", "SUPPORTED", "PARTIALLY_SUPPORTED", "CONFLICTING", "INSUFFICIENT_EVIDENCE"] as const;
export type MechanismStatus = (typeof MECHANISM_STATUSES)[number];

export const DIRECTION_VALUES = ["POSITIVE", "NEGATIVE", "UNSPECIFIED"] as const;
export type DirectionValue = (typeof DIRECTION_VALUES)[number];

export const HYPOTHESIS_KINDS = ["HYPOTHESIS", "PROPOSITION"] as const;
export type HypothesisKind = (typeof HYPOTHESIS_KINDS)[number];

export const EVIDENCE_LINK_TARGETS = ["THEORY", "CONSTRUCT", "MECHANISM", "HYPOTHESIS", "COMPETING"] as const;
export type EvidenceLinkTarget = (typeof EVIDENCE_LINK_TARGETS)[number];

export type AlignmentFinding = {
  severity: "MAJOR_ALIGNMENT_GAP" | "MINOR_ALIGNMENT_GAP";
  code: string;
  chain: string;
  description: string;
  suggestion: string;
};

export type TheoryMechanismSectionEdit = {
  section: "core_theory" | "supporting_theories" | "rejected_theories" | "competing_theories" | "mechanism_model" | "construct_dictionary" | "hypotheses_or_propositions" | "competing_explanations" | "boundary_conditions" | "conceptual_model" | "unresolved_theory_issues";
  payload: Record<string, unknown>;
  reason?: string;
};

function isIn<T extends readonly string[]>(allowed: readonly T[number][], value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function strList(value: unknown): string[] { return Array.isArray(value) ? (value as unknown[]).map((x) => text(x)).filter(Boolean) : []; }

export function validateTheorySectionEdit(value: unknown): TheoryMechanismSectionEdit {
  if (!record(value) || typeof value.section !== "string") throw new Error("invalid_theory_section");
  const section = value.section as TheoryMechanismSectionEdit["section"];
  const payload = record(value.payload) ? value.payload : {};
  return { section, payload, reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 500) : "" };
}

export function validateTheoryEvidenceLink(value: unknown): { targetType: string; targetRef: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; sourceLocation?: string; readingStatus?: string; verificationStatus?: string; note?: string } {
  if (!record(value)) throw new Error("invalid_theory_evidence_link");
  const targetType = isIn(EVIDENCE_LINK_TARGETS, value.targetType) ? value.targetType : "THEORY";
  const targetRef = text(value.targetRef).slice(0, 120);
  if (!targetRef) throw new Error("theory_evidence_target_ref_required");
  return {
    targetType,
    targetRef,
    literatureId: typeof value.literatureId === "string" && value.literatureId.trim() ? value.literatureId.trim().slice(0, 100) : undefined,
    citationSourceId: typeof value.citationSourceId === "string" && value.citationSourceId.trim() ? value.citationSourceId.trim().slice(0, 100) : undefined,
    zoteroItemKey: typeof value.zoteroItemKey === "string" && value.zoteroItemKey.trim() ? value.zoteroItemKey.trim().slice(0, 100) : undefined,
    sourceLocation: typeof value.sourceLocation === "string" && value.sourceLocation.trim() ? value.sourceLocation.trim().slice(0, 200) : undefined,
    readingStatus: value.readingStatus === "FULLTEXT_REVIEWED" || value.readingStatus === "ABSTRACT_REVIEWED" ? value.readingStatus : "ABSTRACT_REVIEWED",
    verificationStatus: isIn(["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"], value.verificationStatus) ? value.verificationStatus : "UNVERIFIED",
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim().slice(0, 1000) : undefined,
  };
}

export function validateTheorySelection(value: unknown): { theoryKey: string; selectionStatus: CandidateStatus; reason?: string } {
  if (!record(value) || typeof value.theoryKey !== "string" || !value.theoryKey.trim()) throw new Error("invalid_theory_selection");
  const selectionStatus: CandidateStatus = (CANDIDATE_STATUSES as readonly string[]).includes(value.selectionStatus as string) ? (value.selectionStatus as CandidateStatus) : "CANDIDATE";
  return { theoryKey: value.theoryKey.trim().slice(0, 120), selectionStatus, reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 2000) : undefined };
}

export function validateModelInput(value: unknown): { modelVersion: string; label?: string; nodes: unknown[]; edges: unknown[]; feedbackLoops: unknown[]; groupDifferences: unknown[]; timePoints: unknown[]; status: string } {
  if (!record(value)) throw new Error("invalid_conceptual_model");
  return {
    modelVersion: text(value.modelVersion) || "1.0",
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 200) : undefined,
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    edges: Array.isArray(value.edges) ? value.edges : [],
    feedbackLoops: Array.isArray(value.feedbackLoops) ? value.feedbackLoops : [],
    groupDifferences: Array.isArray(value.groupDifferences) ? value.groupDifferences : [],
    timePoints: Array.isArray(value.timePoints) ? value.timePoints : [],
    status: value.status === "LOCKED" ? "LOCKED" : "DRAFT",
  };
}

export function theoryKeyFromName(name: string): string {
  const slug = name.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || `theory_${Math.abs([...name].reduce((acc, ch) => acc + ch.codePointAt(0)!, 0)) % 100000}`;
}

export const FIT_DISCLAIMER = "此分數為網站內部理論適配工具（啟發式加權），不代表正式學術共識。";

export const FIT_WEIGHTS = { problem: 20, gap: 20, mechanism: 20, evidence: 15, constructs: 10, testability: 5, parsimony: 5, route: 5 };

export const CAUSAL_STRONG_WORDS = /causes|leads to|determines|proves|導致|造成|決定|證明|必然/iu;
export const CAUSAL_SOFT_WORDS = /may influence|is associated with|is expected to affect|is hypothesized to relate|可能影響|與.{0,6}相關|預期影響|推測/iu;

export const ALIGNMENT_CODES = ["THEORY_NOT_LINKED_TO_GAP", "CONSTRUCT_WITHOUT_DEFINITION", "HYPOTHESIS_WITHOUT_EVIDENCE", "MECHANISM_WITHOUT_THEORY", "RQ_WITHOUT_MECHANISM", "OUTCOME_NOT_EXPLAINED", "EXCESSIVE_THEORY_STACKING", "CAUSAL_CLAIM_UNSUPPORTED", "DUPLICATED_CONSTRUCTS"] as const;
