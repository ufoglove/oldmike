import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
export { S0_FIELD_NAMES } from "../s0-fields.ts";
import type { V2Alpha3DomainSelection, V2Alpha3InsightCard } from "../v2-alpha3/contracts.ts";
import { V2_PROJECT_STAGES, type V2StageId } from "../v2/prototype-contract.ts";
import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { parseBrowserSafeAlpha3DomainSelection, parseBrowserSafeAlpha3InsightCard } from "./alpha3-browser-authority.ts";
import { hasV2Beta1ExactRevisionKeys, requiresV2Beta1CompleteEvidenceClausePreservation, validateV2Beta1RevisionAnchors } from "./evidence-anchors.ts";
import { type V2Beta1ResultEvidenceClass } from "./evidence-classifier.ts";
import { validateV2Beta1FullHistory } from "./history-authority.ts";
import { deriveV2Beta1JourneyInputBundleHash } from "./journey-lineage.ts";
import {
  createV2Beta1EvidenceAuthority,
  createV2Beta1HumanDraftAuthority,
  createV2Beta1ProfessionalProjection,
  validateV2Beta1EvidenceAuthority,
  validateV2Beta1HumanDraftAuthority,
  validateV2Beta1ProfessionalProjection,
  type V2Beta1EvidenceAuthority,
  type V2Beta1HumanDraftAuthority,
  type V2Beta1ProfessionalProjection,
} from "./professional-projection.ts";
import { createV2Beta1CitationCatalog, validateV2Beta1ResearchIntegrityGraph, type V2Beta1ResearchIntegrityGraph } from "./research-integrity.ts";
import { deriveEvidenceProjectionBundle, v2Beta1WholeArtifactValue } from "./selection-authority.ts";
import {
  V2_BETA1_CONTINUATION_SECTIONS,
  V2_BETA1_ASSIST_OPTION_KEYS,
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_DIRECTION_LANES,
  V2_BETA1_MATERIAL_CONTENT_MAX_BYTES,
  V2_BETA1_MATERIAL_MAX_COUNT,
  V2_BETA1_MATERIAL_TOTAL_MAX_BYTES,
  V2_BETA1_PROPOSAL_SECTIONS,
  V2_BETA1_REVIEW_STRATEGIES,
  createV2Beta1AssistOptions,
  deriveV2Beta1AssistOptionId,
  hasV2Beta1ExactDomainSelectionKeys,
  hasV2Beta1ExactInsightCardKeys,
  isV2Beta1DirectAssistValue,
  parseV2Beta1ProjectId,
  validateV2Beta1ExpectedRecommendedLaneBinding,
  validateV2Beta1AssistOptionAgainstParent,
  validateV2Beta1AssistOptionContent,
  type V2Beta1AssistParentAuthority,
} from "./shared-authority.ts";
import { deriveV2Beta1ObservationEffectLineageHash, parseV2Beta1ObservationAuthorityStructural, parseV2Beta1ObservationConfirmationAuthority, type V2Beta1ObservationConfirmationAuthority } from "./typed-observation-authority.ts";

export { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
export * from "./shared-authority.ts";
export * from "./professional-projection.ts";
export * from "./typed-observation-authority.ts";
export { v2Beta1WholeArtifactValue } from "./selection-authority.ts";

export const V2_BETA1_PERSISTENCE_CLASS = "PROCESS_LOCAL_LOCAL_PROTOTYPE" as const;
export const V2_BETA1_OPERATION = "IMPORT_CHAT_INSIGHT" as const;
export const V2_BETA1_JOURNEY_OPERATION = "RUN_RESEARCH_JOURNEY" as const;

export type V2Beta1Operation = typeof V2_BETA1_OPERATION | typeof V2_BETA1_JOURNEY_OPERATION;
export type V2Beta1EntryMode = "KEYWORD" | "CHAT_INSIGHT" | "PARTIAL_MATERIAL";
export type V2Beta1OutputTarget = "SCI" | "SSCI" | "NSTC" | "MOE";
export type V2Beta1MaterialKind = "ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "QUESTIONNAIRE" | "STATISTICS" | "FIGURE" | "TABLE" | "CITATION" | "NOTE";
export type V2Beta1ReviewStrategy = (typeof V2_BETA1_REVIEW_STRATEGIES)[number];

export type V2Beta1SourceMaterial = {
  materialId: string;
  kind: V2Beta1MaterialKind;
  title: string;
  content: string;
  contentHash: string;
  evidenceState: "OBSERVED";
};

export type V2Beta1AssistOption = {
  optionId: string;
  strategy: V2Beta1ReviewStrategy;
  field: S0FieldName;
  directionHash: string;
  inputBundleHash: string;
  domainSelectionHash: string;
  outputTarget: V2Beta1OutputTarget;
  lane: V2Beta1Direction["lane"];
  text: string;
  applyValue: string;
  rationale: string;
  risk: string;
  recommended: boolean;
  optionHash: string;
};

export type V2Beta1DirectionPreview = {
  kind: "JOURNAL_MANUSCRIPT" | "TAIWAN_PROPOSAL";
  title: string;
  sections: Record<(typeof V2_BETA1_CONTINUATION_SECTIONS)[number], string>;
  contentHash: string;
};

export type V2Beta1Direction = {
  directionId: string;
  lane: (typeof V2_BETA1_DIRECTION_LANES)[number];
  title: string;
  researchQuestion: string;
  mechanism: string;
  contribution: string;
  method: string;
  evidenceBoundary: "UNVERIFIED";
  unknowns: string[];
  recommended: boolean;
  directionHash: string;
  inputBundleHash: string;
  professionalProjection: V2Beta1ProfessionalProjection;
  s0: Record<S0FieldName, string>;
  preview: V2Beta1DirectionPreview;
  fieldAssist: Record<S0FieldName, [V2Beta1AssistOption, V2Beta1AssistOption, V2Beta1AssistOption]>;
  selectionArtifact: V2Beta1DirectionSelectionArtifact;
};

export type V2Beta1EvidenceGap = {
  gapId: string;
  statement: string;
  state: "OBSERVED" | "UNVERIFIED" | "MISSING" | "CONFLICT";
  sourceMaterialIds: string[];
};

export type V2Beta1AnalysisWorkPackage = {
  workPackageId: string;
  title: string;
  objective: string;
  steps: string[];
  deliverables: string[];
  sourceMaterialIds: string[];
  claimPolicy: "OBSERVED_ONLY" | "ANALYSIS_PLAN_ONLY" | "RECONCILIATION_ONLY";
};

export type V2Beta1ContinuationSection = {
  sectionId: (typeof V2_BETA1_CONTINUATION_SECTIONS)[number];
  text: string;
  evidenceState: "OBSERVED" | "UNVERIFIED" | "ASSUMPTION" | "MISSING";
  sourceMaterialIds: string[];
  contentHash: string;
};

export type V2Beta1ArtifactSnapshot = { title: string; sections: Record<string, string>; contentHash: string };
export type V2Beta1RevisionAlternative = {
  revisionId: string;
  strategy: V2Beta1ReviewStrategy;
  text: string;
  rationale: string;
  risk: string;
  recommended: boolean;
  researchIntegrity: V2Beta1ResearchIntegrityGraph;
  revisionHash: string;
};
export type V2Beta1PriorityFinding = {
  findingId: string;
  location: string;
  title: string;
  reason: string;
  sourceText: string;
  recommendedRevisionId: string;
  revisions: [V2Beta1RevisionAlternative, V2Beta1RevisionAlternative, V2Beta1RevisionAlternative];
};

export type V2Beta1JournalArtifact = {
  target: "SCI" | "SSCI";
  verificationCollection: "SCIE" | "SSCI";
  sourceSnapshot: V2Beta1ArtifactSnapshot;
  proposedSnapshot: V2Beta1ArtifactSnapshot;
  reviewStatus: "FINAL_CONFIRMABLE" | "READY_WITH_GAPS" | "BLOCKED_EVIDENCE_OR_INTEGRITY";
  priorityFindings: [V2Beta1PriorityFinding, V2Beta1PriorityFinding, V2Beta1PriorityFinding];
  publicationUsable: boolean;
};

export type V2Beta1TaiwanProposalArtifact = {
  targetId: "NSTC" | "MOE";
  proposalTitle: string;
  narrativeSections: Record<(typeof V2_BETA1_PROPOSAL_SECTIONS)[number], string>;
  workPackages: Array<{ workPackageId: string; title: string; objective: string }>;
  kpis: Array<{ kpiId: string; workPackageId: string; measure: string; target: string }>;
  budget: { currency: "TWD"; totalTwd: number; authority: "LOCAL_SYNTHETIC_UNVERIFIED"; allocations: Array<{ workPackageId: string; amountTwd: number }> };
  attachments: Array<{ attachmentId: string; label: string; status: string }>;
  sourceSnapshot: V2Beta1ArtifactSnapshot;
  proposedSnapshot: V2Beta1ArtifactSnapshot;
  priorityFindings: [V2Beta1PriorityFinding, V2Beta1PriorityFinding, V2Beta1PriorityFinding];
  finalReviewStatus: "READY" | "READY_WITH_GAPS" | "NOT_READY";
  officialFactsState: "UNKNOWN_OR_STALE";
  officialSourceBundleHash: string;
};

export type V2Beta1DirectionSelectionArtifact = {
  schemaId: "old-mike-v2-beta1/direction-selection/2";
  kind: "JOURNAL" | "TAIWAN_PROPOSAL";
  outputTarget: V2Beta1OutputTarget;
  researchDomainHash: string;
  selectedDirectionHash: string;
  inputBundleHash: string;
  sourceBundleHash: string;
  officialSourceBundleHash: string | null;
  observationAuthorityHash: string | null;
  evidenceAuthority: V2Beta1EvidenceAuthority;
  evidenceGapMap: V2Beta1EvidenceGap[];
  analysisWorkPackages: V2Beta1AnalysisWorkPackage[];
  continuationSections: V2Beta1JourneyArtifact["continuationSections"];
  journal: V2Beta1JournalArtifact | null;
  taiwanProposal: V2Beta1TaiwanProposalArtifact | null;
  humanDraft: V2Beta1HumanDraftAuthority;
  projectionHash: string;
  wholeArtifactHash: string;
  humanGateHash: string;
};

export type V2Beta1JourneyArtifact = {
  schemaId: "old-mike-v2-beta1/journey/4";
  kind: "JOURNAL" | "TAIWAN_PROPOSAL";
  entryMode: V2Beta1EntryMode;
  outputTarget: V2Beta1OutputTarget;
  researchDirection: string;
  researchDomain: V2Alpha3DomainSelection;
  inputBundleHash: string;
  officialSourceBundleHash: string | null;
  sourceMaterials: V2Beta1SourceMaterial[];
  observationAuthority: V2Beta1ObservationConfirmationAuthority | null;
  resultEvidenceClass: V2Beta1ResultEvidenceClass;
  evidenceAuthority: V2Beta1EvidenceAuthority;
  directions: [V2Beta1Direction, V2Beta1Direction, V2Beta1Direction];
  recommendedDirectionId: string;
  selectedDirectionId: string;
  selectedDirectionHash: string;
  evidenceGapMap: V2Beta1EvidenceGap[];
  analysisWorkPackages: V2Beta1AnalysisWorkPackage[];
  continuationSections: [V2Beta1ContinuationSection, V2Beta1ContinuationSection, V2Beta1ContinuationSection, V2Beta1ContinuationSection, V2Beta1ContinuationSection, V2Beta1ContinuationSection];
  journal: V2Beta1JournalArtifact | null;
  taiwanProposal: V2Beta1TaiwanProposalArtifact | null;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  artifactHash: string;
};

export type V2Beta1StageStatus = "COMPLETE" | "ACTIVE" | "PENDING";
export type V2Beta1StageState = { stageId: V2StageId; status: V2Beta1StageStatus };
export type V2Beta1EffectReceipt = {
  sequence: number; effectId: string; scope: string; scopeAuthority: string; scopeHash: string; projectId: string; operation: V2Beta1Operation; requestId: string;
  idempotencyKey: string; requestHash: string; payloadHash: string; generatedArtifactHash: string | null; observationAuthorityHash: string | null; baseRevision: number; baseContentHash: string;
  completionClass: "COMPLETE" | "UNKNOWN"; resultRevision: number; effectLineageHash: string; lineageHash: string;
  predecessorCommitment: string; entryCommitment: string; receiptHash: string;
};
export type V2Beta1TimelineEvent = {
  sequence: number; eventId: string;
  eventType: "CHAT_INSIGHT_IMPORTED" | "CHAT_INSIGHT_COMPLETION_UNKNOWN" | "RESEARCH_JOURNEY_COMPLETED" | "RESEARCH_JOURNEY_COMPLETION_UNKNOWN";
  receiptId: string; scope: string; scopeAuthority: string; scopeHash: string; projectId: string; operation: V2Beta1Operation; requestId: string; idempotencyKey: string;
  requestHash: string; payloadHash: string; generatedArtifactHash: string | null; observationAuthorityHash: string | null; fromRevision: number; toRevision: number;
  completionClass: "COMPLETE" | "UNKNOWN"; effectLineageHash: string; lineageHash: string;
  predecessorCommitment: string; entryCommitment: string; eventHash: string;
};

export type ProjectTruthSnapshot = {
  contractVersion: typeof V2_BETA1_CONTRACT_VERSION;
  projectId: string; revision: number; contentHash: string;
  focusDomain: V2Alpha3DomainSelection;
  s0Summary: Record<S0FieldName, string>;
  stages: readonly [V2Beta1StageState, V2Beta1StageState, V2Beta1StageState, V2Beta1StageState, V2Beta1StageState, V2Beta1StageState];
  chatInsights: V2Alpha3InsightCard[];
  timeline: V2Beta1TimelineEvent[];
  effectReceipts: V2Beta1EffectReceipt[];
  journeys: V2Beta1JourneyArtifact[];
  journey: V2Beta1JourneyArtifact | null;
  formalResearchWriteCount: 0; onlineDatabaseWriteCount: 0; externalMutationCount: 0;
  persistenceClass: typeof V2_BETA1_PERSISTENCE_CLASS;
};

export type V2Beta1ImportChatInsightRequest = {
  contractVersion: typeof V2_BETA1_CONTRACT_VERSION; operation: typeof V2_BETA1_OPERATION;
  requestId: string; idempotencyKey: string; projectId: string; baseRevision: number; baseContentHash: string;
  insight: V2Alpha3InsightCard;
};
export type V2Beta1JourneyRequest = {
  contractVersion: typeof V2_BETA1_CONTRACT_VERSION; operation: typeof V2_BETA1_JOURNEY_OPERATION;
  requestId: string; idempotencyKey: string; projectId: string; baseRevision: number; baseContentHash: string;
  entryMode: V2Beta1EntryMode; outputTarget: V2Beta1OutputTarget; researchDirection: string;
  researchDomain: V2Alpha3DomainSelection;
  materials: Array<{ materialId: string; kind: V2Beta1MaterialKind; title: string; content: string }>;
  observationConfirmation: V2Beta1ObservationConfirmationAuthority | null;
};

type UnknownRecord = Record<string, unknown>;
const MATERIAL_KINDS: readonly V2Beta1MaterialKind[] = ["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "QUESTIONNAIRE", "STATISTICS", "FIGURE", "TABLE", "CITATION", "NOTE"];
const OUTPUT_TARGETS: readonly V2Beta1OutputTarget[] = ["SCI", "SSCI", "NSTC", "MOE"];
const ENTRY_MODES: readonly V2Beta1EntryMode[] = ["KEYWORD", "CHAT_INSIGHT", "PARTIAL_MATERIAL"];

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}
function exactKeys(value: UnknownRecord, expected: readonly string[], code: string) {
  const actual = Object.keys(value).sort(); const authority = [...expected].sort();
  if (actual.length !== authority.length || actual.some((key, index) => key !== authority[index])) throw new Error(code);
}
export function parseV2Beta1SnapshotDomain(value: unknown) {
  if (!hasV2Beta1ExactDomainSelectionKeys(value)) throw new Error("domain_selection_invalid");
  const parsed = parseBrowserSafeAlpha3DomainSelection(value);
  if (beta1CanonicalJson(parsed) !== beta1CanonicalJson(value)) throw new Error("domain_selection_invalid");
  return parsed;
}
export function parseV2Beta1SnapshotInsight(value: unknown) {
  if (!hasV2Beta1ExactInsightCardKeys(value)) throw new Error("insight_card_invalid");
  return parseBrowserSafeAlpha3InsightCard(value);
}
function boundedText(value: unknown, minimum: number, maximum: number, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(code);
  return normalized;
}
function sourceText(value: unknown, maximumBytes: number, code: string) {
  if (typeof value !== "string" || !value.trim() || new TextEncoder().encode(value).byteLength > maximumBytes) throw new Error(code);
  return value;
}
function safeIdentifier(value: unknown, minimum: number, maximum: number, code: string) {
  const identifier = boundedText(value, minimum, maximum, code);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(identifier)) throw new Error(code);
  return identifier;
}

export function normalizeBeta1StatisticalProse(value: string) {
  return value.replace(/\r\n?/gu, "\n").replace(/([\p{L}\p{N}）)】\]])\s*=\s*(?=[+-]?(?:\d|\.\d))/gu, "$1為 ").replace(/\s+(%|％)/gu, "$1").trim();
}

export function parseV2Beta1SnapshotS0(value: unknown): Record<S0FieldName, string> {
  const input = record(value, "beta1_s0_invalid"); exactKeys(input, S0_FIELD_NAMES, "beta1_s0_field_set_invalid");
  return Object.fromEntries(S0_FIELD_NAMES.map((field) => {
    const text = boundedText(input[field], 1, S0_FIELD_LIMITS[field], `beta1_s0_field_invalid:${field}`);
    if (normalizeBeta1StatisticalProse(text) !== text) throw new Error(`beta1_s0_stat_prose_invalid:${field}`);
    return [field, text];
  })) as Record<S0FieldName, string>;
}

function parseSourceMaterial(value: unknown): V2Beta1SourceMaterial {
  const input = record(value, "beta1_material_invalid");
  exactKeys(input, ["materialId", "kind", "title", "content", "contentHash", "evidenceState"], "beta1_material_invalid");
  if (!MATERIAL_KINDS.includes(input.kind as V2Beta1MaterialKind) || input.evidenceState !== "OBSERVED") throw new Error("beta1_material_invalid");
  const core = { materialId: safeIdentifier(input.materialId, 4, 120, "beta1_material_id_invalid"), kind: input.kind as V2Beta1MaterialKind, title: boundedText(input.title, 1, 240, "beta1_material_title_invalid"), content: sourceText(input.content, V2_BETA1_MATERIAL_CONTENT_MAX_BYTES, "beta1_material_content_invalid"), evidenceState: "OBSERVED" as const };
  if (!isBeta1Hash(input.contentHash) || beta1Hash(core.content) !== input.contentHash) throw new Error("beta1_material_hash_invalid");
  return { ...core, contentHash: input.contentHash };
}

function parseAssistOption(value: unknown, field: S0FieldName, strategy: V2Beta1ReviewStrategy, parent: V2Beta1AssistParentAuthority): V2Beta1AssistOption {
  const input = record(value, "beta1_assist_option_invalid");
  exactKeys(input, V2_BETA1_ASSIST_OPTION_KEYS, "beta1_assist_option_invalid");
  const context = { field, directionHash: parent.direction.directionHash, inputBundleHash: parent.direction.inputBundleHash, domainSelectionHash: parent.domain.selectionHash, outputTarget: parent.outputTarget, strategy, lane: parent.direction.lane };
  if (input.strategy !== strategy || input.field !== field || input.directionHash !== context.directionHash || input.inputBundleHash !== context.inputBundleHash || input.domainSelectionHash !== context.domainSelectionHash || input.outputTarget !== context.outputTarget || input.lane !== context.lane || typeof input.recommended !== "boolean") throw new Error("beta1_assist_context_invalid");
  const expectedOptionId = deriveV2Beta1AssistOptionId(context);
  const displayMaximum = field === "domain" || field === "outputTrack" ? 800 : S0_FIELD_LIMITS[field];
  const optionId = safeIdentifier(input.optionId, 4, 160, "beta1_assist_option_invalid");
  if (optionId !== expectedOptionId) throw new Error("beta1_assist_option_id_invalid");
  const core = { optionId, ...context, text: boundedText(input.text, 12, displayMaximum, "beta1_assist_text_invalid"), applyValue: boundedText(input.applyValue, 1, S0_FIELD_LIMITS[field], "beta1_assist_apply_value_invalid"), rationale: boundedText(input.rationale, 24, 800, "beta1_assist_rationale_invalid"), risk: boundedText(input.risk, 24, 800, "beta1_assist_risk_invalid"), recommended: input.recommended };
  if (!isBeta1Hash(input.optionHash) || beta1Hash(core) !== input.optionHash) throw new Error("beta1_assist_hash_invalid");
  const candidate = { ...core, optionHash: input.optionHash };
  if (!validateV2Beta1AssistOptionContent(candidate, context) || !validateV2Beta1AssistOptionAgainstParent(candidate, parent) || beta1CanonicalJson(candidate) !== beta1CanonicalJson(createV2Beta1AssistOptions(parent, field).find((item) => item.strategy === strategy))) throw new Error(`beta1_assist_semantics_invalid:${field}:${strategy}`);
  return { ...core, optionHash: input.optionHash };
}

function parseDirection(value: unknown, target: V2Beta1OutputTarget, domain: V2Alpha3DomainSelection, researchDirection: string, materials: readonly V2Beta1SourceMaterial[], observationAuthority: V2Beta1ObservationConfirmationAuthority | null, evidenceAuthority: V2Beta1EvidenceAuthority, materialIds: ReadonlySet<string>, sourceBundleHash: string, officialSourceBundleHash: string | null): V2Beta1Direction {
  const input = record(value, "beta1_direction_invalid");
  exactKeys(input, ["directionId", "lane", "title", "researchQuestion", "mechanism", "contribution", "method", "evidenceBoundary", "unknowns", "recommended", "directionHash", "inputBundleHash", "professionalProjection", "s0", "preview", "fieldAssist", "selectionArtifact"], "beta1_direction_invalid");
  if (!V2_BETA1_DIRECTION_LANES.includes(input.lane as V2Beta1Direction["lane"]) || input.evidenceBoundary !== "UNVERIFIED" || typeof input.recommended !== "boolean" || !Array.isArray(input.unknowns) || input.unknowns.length < 1 || input.unknowns.length > 4) throw new Error("beta1_direction_invalid");
  const projectionParent = { outputTarget: target, lane: input.lane as V2Beta1Direction["lane"], domain: { label: domain.label, selectionHash: domain.selectionHash }, researchDirection, materials, observationAuthority, evidenceAuthority };
  if (!validateV2Beta1ProfessionalProjection(input.professionalProjection, projectionParent)) throw new Error("beta1_professional_projection_invalid");
  const professionalProjection = createV2Beta1ProfessionalProjection(projectionParent);
  const base = { directionId: safeIdentifier(input.directionId, 4, 120, "beta1_direction_id_invalid"), lane: input.lane as V2Beta1Direction["lane"], title: boundedText(input.title, 12, 300, "beta1_direction_title_invalid"), researchQuestion: boundedText(input.researchQuestion, 12, 1_200, "beta1_direction_question_invalid"), mechanism: boundedText(input.mechanism, 12, 1_200, "beta1_direction_mechanism_invalid"), contribution: boundedText(input.contribution, 12, 1_200, "beta1_direction_contribution_invalid"), method: boundedText(input.method, 12, 1_200, "beta1_direction_method_invalid"), evidenceBoundary: "UNVERIFIED" as const, unknowns: input.unknowns.map((item) => boundedText(item, 2, 500, "beta1_direction_unknown_invalid")), recommended: input.recommended, professionalProjection };
  if (base.title !== professionalProjection.title || base.researchQuestion !== professionalProjection.researchQuestion || base.mechanism !== professionalProjection.mechanism || base.method !== professionalProjection.method || base.contribution !== professionalProjection.contribution || beta1CanonicalJson(base.unknowns) !== beta1CanonicalJson(professionalProjection.unknowns)) throw new Error("beta1_professional_projection_binding_invalid");
  if (!isBeta1Hash(input.directionHash) || beta1Hash(base) !== input.directionHash || !isBeta1Hash(input.inputBundleHash)) throw new Error("beta1_direction_hash_invalid");
  const s0 = parseV2Beta1SnapshotS0(input.s0);
  if (beta1CanonicalJson(s0) !== beta1CanonicalJson(professionalProjection.s0)) throw new Error("beta1_direction_s0_binding_invalid");
  const previewInput = record(input.preview, "beta1_preview_invalid");
  exactKeys(previewInput, ["kind", "title", "sections", "contentHash"], "beta1_preview_invalid");
  const expectedKind: V2Beta1DirectionPreview["kind"] = target === "SCI" || target === "SSCI" ? "JOURNAL_MANUSCRIPT" : "TAIWAN_PROPOSAL";
  if (previewInput.kind !== expectedKind) throw new Error("beta1_preview_kind_invalid");
  const sectionsInput = record(previewInput.sections, "beta1_preview_sections_invalid"); exactKeys(sectionsInput, V2_BETA1_CONTINUATION_SECTIONS, "beta1_preview_sections_invalid");
  const previewCore = { kind: expectedKind, title: boundedText(previewInput.title, 12, 300, "beta1_preview_title_invalid"), sections: Object.fromEntries(V2_BETA1_CONTINUATION_SECTIONS.map((key) => [key, sourceText(sectionsInput[key], 48_000, "beta1_preview_section_invalid")])) as V2Beta1DirectionPreview["sections"] };
  if (!isBeta1Hash(previewInput.contentHash) || beta1Hash(previewCore) !== previewInput.contentHash) throw new Error("beta1_preview_hash_invalid");
  if (beta1CanonicalJson({ ...previewCore, contentHash: previewInput.contentHash }) !== beta1CanonicalJson(professionalProjection.preview)) throw new Error("beta1_preview_projection_invalid");
  const assistParent: V2Beta1AssistParentAuthority = { direction: { lane: base.lane, directionHash: input.directionHash as string, inputBundleHash: input.inputBundleHash as string, title: base.title, researchQuestion: base.researchQuestion, mechanism: base.mechanism, contribution: base.contribution, method: base.method, s0 }, domain: { label: domain.label, selectionHash: domain.selectionHash }, outputTarget: target };
  const assistInput = record(input.fieldAssist, "beta1_assist_invalid"); exactKeys(assistInput, S0_FIELD_NAMES, "beta1_assist_field_set_invalid");
  const fieldAssist = Object.fromEntries(S0_FIELD_NAMES.map((field) => {
    const raw = assistInput[field]; if (!Array.isArray(raw) || raw.length !== 3) throw new Error("beta1_assist_count_invalid");
    const options = V2_BETA1_REVIEW_STRATEGIES.map((strategy, index) => parseAssistOption(raw[index], field, strategy, assistParent)) as unknown as V2Beta1Direction["fieldAssist"][S0FieldName];
    if (options.filter((option) => option.recommended).length !== 1 || options[1].recommended !== true || new Set(options.map((option) => option.text)).size !== 3) throw new Error("beta1_assist_set_invalid");
    if (field !== "domain" && field !== "outputTrack" && (new Set(options.map((option) => option.applyValue)).size !== 3 || options.some((option) => !isV2Beta1DirectAssistValue(field, option.applyValue)))) throw new Error(`beta1_assist_apply_set_invalid:${field}`);
    if (field === "domain" && options.some((option) => option.applyValue !== domain.label)) throw new Error("beta1_assist_authority_invalid");
    if (field === "outputTrack" && options.some((option) => option.applyValue !== target)) throw new Error("beta1_assist_authority_invalid");
    return [field, options];
  })) as V2Beta1Direction["fieldAssist"];
  const directionCore = { ...base, directionHash: input.directionHash, inputBundleHash: input.inputBundleHash, s0, preview: { ...previewCore, contentHash: previewInput.contentHash }, fieldAssist };
  const selectionArtifact = parseDirectionSelectionArtifact(input.selectionArtifact, directionCore, target, domain, materials, evidenceAuthority, officialSourceBundleHash);
  return { ...directionCore, selectionArtifact };
}

function parseSnapshotArtifact(value: unknown, code: string): V2Beta1ArtifactSnapshot {
  const input = record(value, code); exactKeys(input, ["title", "sections", "contentHash"], code);
  const sectionsInput = record(input.sections, code); if (Object.keys(sectionsInput).length < 6) throw new Error(code);
  const core = { title: boundedText(input.title, 12, 1_000, code), sections: Object.fromEntries(Object.entries(sectionsInput).map(([key, item]) => [safeIdentifier(key, 2, 80, code), sourceText(item, 192_000, code)])) };
  if (!isBeta1Hash(input.contentHash) || beta1Hash(core) !== input.contentHash) throw new Error(`${code}_hash`);
  return { ...core, contentHash: input.contentHash };
}

function parsePriorityFinding(value: unknown, expectedSourceText: string, citationCatalog: ReturnType<typeof createV2Beta1CitationCatalog>, ownDataBinding: boolean): V2Beta1PriorityFinding {
  const input = record(value, "beta1_finding_invalid"); exactKeys(input, ["findingId", "location", "title", "reason", "sourceText", "recommendedRevisionId", "revisions"], "beta1_finding_invalid");
  if (!Array.isArray(input.revisions) || input.revisions.length !== 3) throw new Error("beta1_revision_count_invalid");
  const rawRevisions = input.revisions as unknown[];
  const revisions = V2_BETA1_REVIEW_STRATEGIES.map((strategy, index) => {
    const raw = record(rawRevisions[index], "beta1_revision_invalid"); if (!hasV2Beta1ExactRevisionKeys(raw)) throw new Error("beta1_revision_invalid");
    if (raw.strategy !== strategy || typeof raw.recommended !== "boolean") throw new Error("beta1_revision_strategy_invalid");
    const text = sourceText(raw.text, 48_000, "beta1_revision_text_invalid");
    const graphInput = { findingId: String(input.findingId), sourceText: expectedSourceText, revisionText: text, citationCatalog, ownDataBinding };
    if (!validateV2Beta1ResearchIntegrityGraph(raw.researchIntegrity, graphInput)) throw new Error("beta1_revision_integrity_invalid");
    const researchIntegrity = raw.researchIntegrity as V2Beta1ResearchIntegrityGraph;
    if (!researchIntegrity.completeCoverage || !researchIntegrity.semanticEquivalent || !researchIntegrity.citationValid || !researchIntegrity.proseValid) throw new Error("beta1_revision_integrity_invalid");
    const core = { revisionId: safeIdentifier(raw.revisionId, 4, 160, "beta1_revision_invalid"), strategy, text, rationale: boundedText(raw.rationale, 4, 1_200, "beta1_revision_rationale_invalid"), risk: boundedText(raw.risk, 4, 1_200, "beta1_revision_risk_invalid"), recommended: raw.recommended, researchIntegrity };
    if (!isBeta1Hash(raw.revisionHash) || beta1Hash(core) !== raw.revisionHash) throw new Error("beta1_revision_hash_invalid");
    return { ...core, revisionHash: raw.revisionHash };
  }) as [V2Beta1RevisionAlternative, V2Beta1RevisionAlternative, V2Beta1RevisionAlternative];
  const source = sourceText(input.sourceText, 48_000, "beta1_finding_source_invalid");
  if (source !== expectedSourceText) throw new Error("beta1_finding_source_binding_invalid");
  const completeClauseRequired = requiresV2Beta1CompleteEvidenceClausePreservation(source);
  if (revisions.some((item) => item.text === source || (source.length >= 12 && item.text.includes(source) && !completeClauseRequired) || !validateV2Beta1RevisionAnchors(source, item.text)) || new Set(revisions.map((item) => item.text)).size !== 3 || revisions.filter((item) => item.recommended).length !== 1 || revisions[1].recommended !== true || input.recommendedRevisionId !== revisions[1].revisionId) throw new Error("beta1_revision_semantics_invalid");
  return { findingId: safeIdentifier(input.findingId, 4, 160, "beta1_finding_invalid"), location: safeIdentifier(input.location, 2, 120, "beta1_finding_invalid"), title: boundedText(input.title, 4, 400, "beta1_finding_invalid"), reason: boundedText(input.reason, 4, 1_200, "beta1_finding_invalid"), sourceText: source, recommendedRevisionId: input.recommendedRevisionId, revisions };
}

function parseJournal(value: unknown, materials: readonly V2Beta1SourceMaterial[], evidenceAuthority: V2Beta1EvidenceAuthority): V2Beta1JournalArtifact {
  const input = record(value, "beta1_journal_invalid"); exactKeys(input, ["target", "verificationCollection", "sourceSnapshot", "proposedSnapshot", "reviewStatus", "priorityFindings", "publicationUsable"], "beta1_journal_invalid");
  if ((input.target !== "SCI" && input.target !== "SSCI") || input.verificationCollection !== (input.target === "SCI" ? "SCIE" : "SSCI") || !["FINAL_CONFIRMABLE", "READY_WITH_GAPS", "BLOCKED_EVIDENCE_OR_INTEGRITY"].includes(String(input.reviewStatus)) || typeof input.publicationUsable !== "boolean" || !Array.isArray(input.priorityFindings) || input.priorityFindings.length !== 3) throw new Error("beta1_journal_invalid");
  const sourceSnapshot = parseSnapshotArtifact(input.sourceSnapshot, "beta1_journal_source_invalid"); const proposedSnapshot = parseSnapshotArtifact(input.proposedSnapshot, "beta1_journal_proposed_invalid");
  const citationCatalog = createV2Beta1CitationCatalog(materials);
  const priorityFindings = input.priorityFindings.map((item) => {
    const row = record(item, "beta1_finding_invalid"); const location = safeIdentifier(row.location, 2, 120, "beta1_finding_invalid"); const source = sourceSnapshot.sections[location];
    if (typeof source !== "string") throw new Error("beta1_finding_source_binding_invalid");
    return parsePriorityFinding(item, source, citationCatalog, ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(location));
  }) as V2Beta1JournalArtifact["priorityFindings"];
  if (priorityFindings.some((finding) => proposedSnapshot.sections[finding.location] !== finding.revisions.find((revision) => revision.revisionId === finding.recommendedRevisionId)?.text)) throw new Error("beta1_journal_proposed_binding_invalid");
  const resultGraphReady = priorityFindings.filter((finding) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(finding.location)).every((finding) => finding.revisions.every((revision) => revision.researchIntegrity.publicationUsable));
  const expectedReviewStatus = evidenceAuthority.summary.reviewStatus;
  const expectedPublicationUsable = evidenceAuthority.summary.publicationUsable && resultGraphReady;
  if (input.reviewStatus !== expectedReviewStatus || input.publicationUsable !== expectedPublicationUsable) throw new Error("beta1_journal_publication_ready_invalid");
  return { target: input.target, verificationCollection: input.verificationCollection as "SCIE" | "SSCI", sourceSnapshot, proposedSnapshot, reviewStatus: input.reviewStatus as V2Beta1JournalArtifact["reviewStatus"], priorityFindings, publicationUsable: input.publicationUsable };
}

function parseTaiwanProposal(value: unknown): V2Beta1TaiwanProposalArtifact {
  const input = record(value, "beta1_taiwan_proposal_invalid"); exactKeys(input, ["targetId", "proposalTitle", "narrativeSections", "workPackages", "kpis", "budget", "attachments", "sourceSnapshot", "proposedSnapshot", "priorityFindings", "finalReviewStatus", "officialFactsState", "officialSourceBundleHash"], "beta1_taiwan_proposal_invalid");
  if ((input.targetId !== "NSTC" && input.targetId !== "MOE") || !Array.isArray(input.workPackages) || input.workPackages.length < 1 || !Array.isArray(input.kpis) || input.kpis.length < 1 || !Array.isArray(input.attachments) || input.attachments.length < 1 || !Array.isArray(input.priorityFindings) || input.priorityFindings.length !== 3 || !["READY", "READY_WITH_GAPS", "NOT_READY"].includes(String(input.finalReviewStatus)) || input.officialFactsState !== "UNKNOWN_OR_STALE" || !isBeta1Hash(input.officialSourceBundleHash)) throw new Error("beta1_taiwan_proposal_invalid");
  const narrativeInput = record(input.narrativeSections, "beta1_proposal_narrative_invalid"); exactKeys(narrativeInput, V2_BETA1_PROPOSAL_SECTIONS, "beta1_proposal_narrative_invalid");
  const narrativeSections = Object.fromEntries(V2_BETA1_PROPOSAL_SECTIONS.map((key) => [key, sourceText(narrativeInput[key], 48_000, "beta1_proposal_narrative_invalid")])) as V2Beta1TaiwanProposalArtifact["narrativeSections"];
  const workPackages = input.workPackages.map((item) => { const row = record(item, "beta1_proposal_work_invalid"); exactKeys(row, ["workPackageId", "title", "objective"], "beta1_proposal_work_invalid"); return { workPackageId: safeIdentifier(row.workPackageId, 3, 120, "beta1_proposal_work_invalid"), title: boundedText(row.title, 4, 300, "beta1_proposal_work_invalid"), objective: boundedText(row.objective, 4, 1_200, "beta1_proposal_work_invalid") }; });
  const workPackageIds = new Set(workPackages.map((item) => item.workPackageId));
  const kpis = input.kpis.map((item) => { const row = record(item, "beta1_proposal_kpi_invalid"); exactKeys(row, ["kpiId", "workPackageId", "measure", "target"], "beta1_proposal_kpi_invalid"); const workPackageId = safeIdentifier(row.workPackageId, 3, 120, "beta1_proposal_kpi_invalid"); if (!workPackageIds.has(workPackageId)) throw new Error("beta1_proposal_kpi_work_package_invalid"); return { kpiId: safeIdentifier(row.kpiId, 3, 120, "beta1_proposal_kpi_invalid"), workPackageId, measure: boundedText(row.measure, 2, 600, "beta1_proposal_kpi_invalid"), target: boundedText(row.target, 1, 600, "beta1_proposal_kpi_invalid") }; });
  const budget = record(input.budget, "beta1_proposal_budget_invalid"); exactKeys(budget, ["currency", "totalTwd", "authority", "allocations"], "beta1_proposal_budget_invalid"); if (budget.currency !== "TWD" || !Number.isSafeInteger(budget.totalTwd) || Number(budget.totalTwd) <= 0 || budget.authority !== "LOCAL_SYNTHETIC_UNVERIFIED" || !Array.isArray(budget.allocations) || budget.allocations.length !== workPackages.length) throw new Error("beta1_proposal_budget_invalid");
  const allocations = budget.allocations.map((item) => { const row = record(item, "beta1_proposal_budget_invalid"); exactKeys(row, ["workPackageId", "amountTwd"], "beta1_proposal_budget_invalid"); const workPackageId = safeIdentifier(row.workPackageId, 3, 120, "beta1_proposal_budget_invalid"); if (!workPackageIds.has(workPackageId) || !Number.isSafeInteger(row.amountTwd) || Number(row.amountTwd) <= 0) throw new Error("beta1_proposal_budget_invalid"); return { workPackageId, amountTwd: Number(row.amountTwd) }; });
  if (new Set(allocations.map((item) => item.workPackageId)).size !== workPackages.length || allocations.reduce((sum, item) => sum + item.amountTwd, 0) !== Number(budget.totalTwd)) throw new Error("beta1_proposal_budget_linkage_invalid");
  const attachments = input.attachments.map((item) => { const row = record(item, "beta1_proposal_attachment_invalid"); exactKeys(row, ["attachmentId", "label", "status"], "beta1_proposal_attachment_invalid"); return { attachmentId: safeIdentifier(row.attachmentId, 3, 120, "beta1_proposal_attachment_invalid"), label: boundedText(row.label, 2, 300, "beta1_proposal_attachment_invalid"), status: boundedText(row.status, 2, 120, "beta1_proposal_attachment_invalid") }; });
  const sourceSnapshot = parseSnapshotArtifact(input.sourceSnapshot, "beta1_proposal_source_invalid"); const proposedSnapshot = parseSnapshotArtifact(input.proposedSnapshot, "beta1_proposal_proposed_invalid"); const citationCatalog = createV2Beta1CitationCatalog([]);
  const priorityFindings = input.priorityFindings.map((item) => { const row = record(item, "beta1_finding_invalid"); const location = safeIdentifier(row.location, 2, 120, "beta1_finding_invalid"); const source = sourceSnapshot.sections[location]; if (typeof source !== "string") throw new Error("beta1_finding_source_binding_invalid"); return parsePriorityFinding(item, source, citationCatalog, false); }) as V2Beta1TaiwanProposalArtifact["priorityFindings"];
  if (priorityFindings.some((finding) => proposedSnapshot.sections[finding.location] !== finding.revisions.find((revision) => revision.revisionId === finding.recommendedRevisionId)?.text)) throw new Error("beta1_proposal_proposed_binding_invalid");
  return { targetId: input.targetId, proposalTitle: boundedText(input.proposalTitle, 12, 1_000, "beta1_proposal_title_invalid"), narrativeSections, workPackages, kpis, budget: { currency: "TWD", totalTwd: Number(budget.totalTwd), authority: "LOCAL_SYNTHETIC_UNVERIFIED", allocations }, attachments, sourceSnapshot, proposedSnapshot, priorityFindings, finalReviewStatus: input.finalReviewStatus as V2Beta1TaiwanProposalArtifact["finalReviewStatus"], officialFactsState: "UNKNOWN_OR_STALE", officialSourceBundleHash: input.officialSourceBundleHash };
}

function parseEvidenceGap(value: unknown, ids: ReadonlySet<string>): V2Beta1EvidenceGap {
  const input = record(value, "beta1_evidence_gap_invalid"); exactKeys(input, ["gapId", "statement", "state", "sourceMaterialIds"], "beta1_evidence_gap_invalid");
  if (!Array.isArray(input.sourceMaterialIds) || !["OBSERVED", "UNVERIFIED", "MISSING", "CONFLICT"].includes(String(input.state))) throw new Error("beta1_evidence_gap_invalid");
  const refs = input.sourceMaterialIds.map((item) => safeIdentifier(item, 4, 120, "beta1_material_id_invalid")); if (refs.some((id) => !ids.has(id))) throw new Error("beta1_evidence_gap_source_invalid");
  return { gapId: safeIdentifier(input.gapId, 4, 120, "beta1_gap_id_invalid"), statement: boundedText(input.statement, 4, 1_200, "beta1_evidence_gap_invalid"), state: input.state as V2Beta1EvidenceGap["state"], sourceMaterialIds: refs };
}
function parseWorkPackage(value: unknown, ids: ReadonlySet<string>): V2Beta1AnalysisWorkPackage {
  const input = record(value, "beta1_work_package_invalid"); exactKeys(input, ["workPackageId", "title", "objective", "steps", "deliverables", "sourceMaterialIds", "claimPolicy"], "beta1_work_package_invalid");
  if (!Array.isArray(input.steps) || input.steps.length < 1 || !Array.isArray(input.deliverables) || input.deliverables.length < 1 || !Array.isArray(input.sourceMaterialIds) || !["OBSERVED_ONLY", "ANALYSIS_PLAN_ONLY", "RECONCILIATION_ONLY"].includes(String(input.claimPolicy))) throw new Error("beta1_work_package_invalid");
  const refs = input.sourceMaterialIds.map((item) => safeIdentifier(item, 4, 120, "beta1_material_id_invalid")); if (refs.some((id) => !ids.has(id))) throw new Error("beta1_work_package_source_invalid");
  return { workPackageId: safeIdentifier(input.workPackageId, 4, 120, "beta1_work_package_invalid"), title: boundedText(input.title, 4, 300, "beta1_work_package_invalid"), objective: boundedText(input.objective, 4, 1_200, "beta1_work_package_invalid"), steps: input.steps.map((item) => boundedText(item, 2, 600, "beta1_work_package_invalid")), deliverables: input.deliverables.map((item) => boundedText(item, 2, 600, "beta1_work_package_invalid")), sourceMaterialIds: refs, claimPolicy: input.claimPolicy as V2Beta1AnalysisWorkPackage["claimPolicy"] };
}
function parseContinuation(value: unknown, expected: V2Beta1ContinuationSection["sectionId"], ids: ReadonlySet<string>): V2Beta1ContinuationSection {
  const input = record(value, "beta1_continuation_invalid"); exactKeys(input, ["sectionId", "text", "evidenceState", "sourceMaterialIds", "contentHash"], "beta1_continuation_invalid");
  if (input.sectionId !== expected || !["OBSERVED", "UNVERIFIED", "ASSUMPTION", "MISSING"].includes(String(input.evidenceState)) || !Array.isArray(input.sourceMaterialIds)) throw new Error("beta1_continuation_invalid");
  const refs = input.sourceMaterialIds.map((item) => safeIdentifier(item, 4, 120, "beta1_material_id_invalid")); if (refs.some((id) => !ids.has(id))) throw new Error("beta1_continuation_source_invalid");
  const core = { sectionId: expected, text: sourceText(input.text, 48_000, "beta1_continuation_text_invalid"), evidenceState: input.evidenceState as V2Beta1ContinuationSection["evidenceState"], sourceMaterialIds: refs };
  if (!isBeta1Hash(input.contentHash) || beta1Hash(core) !== input.contentHash) throw new Error("beta1_continuation_hash_invalid"); return { ...core, contentHash: input.contentHash };
}

function parseDirectionSelectionArtifact(
  value: unknown,
  direction: Omit<V2Beta1Direction, "selectionArtifact">,
  target: V2Beta1OutputTarget,
  domain: V2Alpha3DomainSelection,
  materials: readonly V2Beta1SourceMaterial[],
  evidenceAuthority: V2Beta1EvidenceAuthority,
  expectedOfficialSourceBundleHash: string | null,
): V2Beta1DirectionSelectionArtifact {
  const expected = deriveEvidenceProjectionBundle({ outputTarget: target, researchDomainHash: domain.selectionHash, officialSourceBundleHash: expectedOfficialSourceBundleHash, direction, materials, evidenceAuthority });
  if (beta1CanonicalJson(value) !== beta1CanonicalJson(expected)) throw new Error("beta1_direction_selection_binding_invalid");
  return expected;
}

export function parseV2Beta1JourneyArtifact(value: unknown): V2Beta1JourneyArtifact {
  const input = record(value, "beta1_journey_artifact_invalid"); exactKeys(input, ["schemaId", "kind", "entryMode", "outputTarget", "researchDirection", "researchDomain", "inputBundleHash", "officialSourceBundleHash", "sourceMaterials", "observationAuthority", "resultEvidenceClass", "evidenceAuthority", "directions", "recommendedDirectionId", "selectedDirectionId", "selectedDirectionHash", "evidenceGapMap", "analysisWorkPackages", "continuationSections", "journal", "taiwanProposal", "humanGate", "artifactHash"], "beta1_journey_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-beta1/journey/4" || (input.kind !== "JOURNAL" && input.kind !== "TAIWAN_PROPOSAL") || !ENTRY_MODES.includes(input.entryMode as V2Beta1EntryMode) || !OUTPUT_TARGETS.includes(input.outputTarget as V2Beta1OutputTarget) || !isBeta1Hash(input.inputBundleHash) || (input.officialSourceBundleHash !== null && !isBeta1Hash(input.officialSourceBundleHash)) || !["MISSING", "PLANNED", "OBSERVED", "CONFLICT"].includes(String(input.resultEvidenceClass)) || !Array.isArray(input.sourceMaterials) || !Array.isArray(input.directions) || input.directions.length !== 3 || !Array.isArray(input.evidenceGapMap) || !Array.isArray(input.analysisWorkPackages) || !Array.isArray(input.continuationSections) || input.continuationSections.length !== 6) throw new Error("beta1_journey_artifact_invalid");
  const target = input.outputTarget as V2Beta1OutputTarget; const domain = parseV2Beta1SnapshotDomain(input.researchDomain); const researchDirection = boundedText(input.researchDirection, 2, 1_600, "beta1_research_direction_invalid"); const materials = input.sourceMaterials.map(parseSourceMaterial); if (new Set(materials.map((item) => item.materialId)).size !== materials.length || materials.reduce((sum, item) => sum + new TextEncoder().encode(item.content).byteLength, 0) > V2_BETA1_MATERIAL_TOTAL_MAX_BYTES) throw new Error("beta1_material_total_too_large");
  const materialIds = new Set(materials.map((item) => item.materialId));
  const observationAuthority = input.observationAuthority === null ? null : parseV2Beta1ObservationAuthorityStructural(input.observationAuthority, materials);
  if (!validateV2Beta1EvidenceAuthority(input.evidenceAuthority, materials, target, observationAuthority)) throw new Error("beta1_evidence_authority_invalid");
  const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, target, observationAuthority);
  if (input.resultEvidenceClass !== evidenceAuthority.summary.resultState) throw new Error("beta1_result_evidence_class_invalid");
  const sourceBundleHash = beta1Hash(materials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash })));
  const directions = input.directions.map((item) => parseDirection(item, target, domain, researchDirection, materials, observationAuthority, evidenceAuthority, materialIds, sourceBundleHash, input.officialSourceBundleHash as string | null)) as V2Beta1JourneyArtifact["directions"];
  if (new Set(directions.map((item) => item.lane)).size !== 3 || new Set(directions.map((item) => item.title)).size !== 3 || directions.filter((item) => item.recommended).length !== 1) throw new Error("beta1_direction_set_invalid");
  if (!validateV2Beta1ExpectedRecommendedLaneBinding({ directions, recommendedDirectionId: input.recommendedDirectionId as string, selectedDirectionId: input.selectedDirectionId as string, selectedDirectionHash: input.selectedDirectionHash as string, inputBundleHash: input.inputBundleHash as string })) throw new Error("beta1_recommended_lane_invalid");
  const observationEffectLineageHash = deriveV2Beta1ObservationEffectLineageHash(observationAuthority);
  if (directions.some((item) => item.inputBundleHash !== deriveV2Beta1JourneyInputBundleHash({ entryMode: input.entryMode as V2Beta1EntryMode, outputTarget: target, researchDirection, researchDomain: domain, materials, observationEffectLineageHash, selectedLane: item.lane }, item.directionHash))) throw new Error("beta1_journey_input_bundle_hash_invalid");
  const allOptions = directions.flatMap((direction) => S0_FIELD_NAMES.flatMap((field) => direction.fieldAssist[field]));
  if (allOptions.length !== 117 || new Set(allOptions.map((option) => option.optionId)).size !== 117 || new Set(allOptions.map((option) => option.optionHash)).size !== 117) throw new Error("beta1_assist_card_authority_invalid");
  const recommended = directions.find((item) => item.lane === V2_BETA1_DIRECTION_LANES[1])!;
  if (input.recommendedDirectionId !== recommended.directionId || input.selectedDirectionId !== recommended.directionId || input.selectedDirectionHash !== recommended.directionHash || input.inputBundleHash !== recommended.inputBundleHash) throw new Error("beta1_selected_direction_binding_invalid");
  const recommendedSelection = recommended.selectionArtifact;
  if (beta1CanonicalJson(input.evidenceAuthority) !== beta1CanonicalJson(recommendedSelection.evidenceAuthority) || beta1CanonicalJson(input.evidenceGapMap) !== beta1CanonicalJson(recommendedSelection.evidenceGapMap) || beta1CanonicalJson(input.analysisWorkPackages) !== beta1CanonicalJson(recommendedSelection.analysisWorkPackages) || beta1CanonicalJson(input.continuationSections) !== beta1CanonicalJson(recommendedSelection.continuationSections) || beta1CanonicalJson(input.journal) !== beta1CanonicalJson(recommendedSelection.journal) || beta1CanonicalJson(input.taiwanProposal) !== beta1CanonicalJson(recommendedSelection.taiwanProposal)) throw new Error("beta1_recommended_projection_invalid");
  const { evidenceGapMap, analysisWorkPackages, continuationSections, journal, taiwanProposal } = recommendedSelection;
  const humanGateInput = record(input.humanGate, "beta1_human_gate_invalid"); exactKeys(humanGateInput, ["required", "scope", "confirmed", "contentHash"], "beta1_human_gate_invalid");
  const gateHash = recommendedSelection.humanGateHash;
  if (humanGateInput.required !== true || humanGateInput.scope !== "WHOLE_ARTIFACT" || humanGateInput.confirmed !== false || humanGateInput.contentHash !== gateHash) throw new Error("beta1_human_gate_invalid");
  const core = { schemaId: "old-mike-v2-beta1/journey/4" as const, kind: input.kind as V2Beta1JourneyArtifact["kind"], entryMode: input.entryMode as V2Beta1EntryMode, outputTarget: target, researchDirection, researchDomain: domain, inputBundleHash: input.inputBundleHash, officialSourceBundleHash: input.officialSourceBundleHash as string | null, sourceMaterials: materials, observationAuthority, resultEvidenceClass: evidenceAuthority.summary.resultState, evidenceAuthority, directions, recommendedDirectionId: recommended.directionId, selectedDirectionId: recommended.directionId, selectedDirectionHash: recommended.directionHash, evidenceGapMap, analysisWorkPackages, continuationSections, journal, taiwanProposal, humanGate: { required: true as const, scope: "WHOLE_ARTIFACT" as const, confirmed: false as const, contentHash: gateHash } };
  if (!isBeta1Hash(input.artifactHash) || beta1Hash(core) !== input.artifactHash) throw new Error("beta1_artifact_hash_invalid"); return { ...core, artifactHash: input.artifactHash };
}

// Browser-safe shared deep authority. Server, history/transition and the client
// adapter all call this exact validator before projecting a journey.
export const validateV2Beta1DeepJourneyArtifact = parseV2Beta1JourneyArtifact;

function parseStages(value: unknown): ProjectTruthSnapshot["stages"] {
  if (!Array.isArray(value) || value.length !== V2_PROJECT_STAGES.length) throw new Error("beta1_stage_count_invalid");
  return value.map((raw, index) => { const input = record(raw, "beta1_stage_invalid"); exactKeys(input, ["stageId", "status"], "beta1_stage_invalid"); if (input.stageId !== V2_PROJECT_STAGES[index].id || !["COMPLETE", "ACTIVE", "PENDING"].includes(String(input.status))) throw new Error("beta1_stage_invalid"); return { stageId: input.stageId as V2StageId, status: input.status as V2Beta1StageStatus }; }) as unknown as ProjectTruthSnapshot["stages"];
}
export function snapshotContentHash(value: Omit<ProjectTruthSnapshot, "contentHash">) { return beta1Hash(value); }
export function createProjectTruthSnapshot(value: Omit<ProjectTruthSnapshot, "contentHash">): ProjectTruthSnapshot { return validateProjectTruthSnapshot({ ...value, contentHash: snapshotContentHash(value) }); }
export function validateProjectTruthSnapshot(value: unknown, authority: { trustedScope?: string } = {}): ProjectTruthSnapshot {
  const input = record(value, "beta1_snapshot_invalid"); exactKeys(input, ["contractVersion", "projectId", "revision", "contentHash", "focusDomain", "s0Summary", "stages", "chatInsights", "timeline", "effectReceipts", "journeys", "journey", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount", "persistenceClass"], "beta1_snapshot_invalid");
  if (input.contractVersion !== V2_BETA1_CONTRACT_VERSION || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 || !isBeta1Hash(input.contentHash) || input.persistenceClass !== V2_BETA1_PERSISTENCE_CLASS || !Array.isArray(input.chatInsights) || !Array.isArray(input.timeline) || !Array.isArray(input.effectReceipts) || input.timeline.length !== input.effectReceipts.length || input.revision !== input.timeline.length + 1 || !Array.isArray(input.journeys)) throw new Error("beta1_snapshot_invalid");
  const focusDomain = parseV2Beta1SnapshotDomain(input.focusDomain); const s0Summary = parseV2Beta1SnapshotS0(input.s0Summary); const stages = parseStages(input.stages); const chatInsights = input.chatInsights.map(parseV2Beta1SnapshotInsight); if (new Set(chatInsights.map((item) => item.hash)).size !== chatInsights.length) throw new Error("beta1_chat_insight_duplicate");
  const journeys = input.journeys.map(parseV2Beta1JourneyArtifact); const journey = input.journey === null ? null : parseV2Beta1JourneyArtifact(input.journey); if ((journeys.length === 0) !== (journey === null) || (journey && journeys.at(-1)?.artifactHash !== journey.artifactHash)) throw new Error("beta1_current_journey_mismatch");
  const projectId = parseV2Beta1ProjectId(input.projectId);
  const history = validateV2Beta1FullHistory({ projectId, revision: Number(input.revision), timeline: input.timeline, effectReceipts: input.effectReceipts, journeys, ...authority });
  const timeline = history.timeline; const receipts = history.effectReceipts;
  if (authority.trustedScope) {
    const completedJourneyReceipts = receipts.filter((receipt) => receipt.operation === V2_BETA1_JOURNEY_OPERATION && receipt.completionClass === "COMPLETE");
    journeys.forEach((storedJourney, index) => {
      const receipt = completedJourneyReceipts[index];
      if (!receipt) throw new Error("beta1_observation_stored_context_invalid");
      if (storedJourney.observationAuthority !== null) parseV2Beta1ObservationConfirmationAuthority(storedJourney.observationAuthority, { projectId, baseRevision: receipt.baseRevision, baseContentHash: receipt.baseContentHash, outputTarget: storedJourney.outputTarget, researchDirection: storedJourney.researchDirection, researchDomainHash: storedJourney.researchDomain.selectionHash, trustedScope: authority.trustedScope!, materials: storedJourney.sourceMaterials });
    });
  }
  const completedInsightHashes = timeline.filter((event, index) => receipts[index].operation === V2_BETA1_OPERATION && event.completionClass === "COMPLETE").map((event) => event.payloadHash); if (beta1CanonicalJson(completedInsightHashes) !== beta1CanonicalJson(chatInsights.map((item) => item.hash))) throw new Error("beta1_chat_history_mismatch");
  if (journey && (journey.outputTarget !== s0Summary.outputTrack || journey.selectedDirectionHash !== journey.directions.find((item) => item.recommended)?.directionHash || beta1CanonicalJson(s0Summary) !== beta1CanonicalJson(journey.directions.find((item) => item.recommended)?.s0))) throw new Error("beta1_snapshot_journey_binding_invalid");
  if (input.formalResearchWriteCount !== 0 || input.onlineDatabaseWriteCount !== 0 || input.externalMutationCount !== 0) throw new Error("beta1_effect_boundary_invalid");
  const snapshot: ProjectTruthSnapshot = { contractVersion: V2_BETA1_CONTRACT_VERSION, projectId, revision: Number(input.revision), contentHash: input.contentHash, focusDomain, s0Summary, stages, chatInsights, timeline, effectReceipts: receipts, journeys, journey, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0, persistenceClass: V2_BETA1_PERSISTENCE_CLASS };
  const { contentHash, ...core } = snapshot; if (snapshotContentHash(core) !== contentHash) throw new Error("beta1_snapshot_hash_mismatch"); return snapshot;
}

export function parseV2Beta1ImportChatInsightRequest(value: unknown): V2Beta1ImportChatInsightRequest {
  const input = record(value, "beta1_import_request_invalid"); exactKeys(input, ["contractVersion", "operation", "requestId", "idempotencyKey", "projectId", "baseRevision", "baseContentHash", "insight"], "beta1_import_request_invalid");
  if (input.contractVersion !== V2_BETA1_CONTRACT_VERSION || input.operation !== V2_BETA1_OPERATION || !Number.isSafeInteger(input.baseRevision) || Number(input.baseRevision) < 1 || !isBeta1Hash(input.baseContentHash)) throw new Error("beta1_import_authority_invalid");
  return { contractVersion: V2_BETA1_CONTRACT_VERSION, operation: V2_BETA1_OPERATION, requestId: safeIdentifier(input.requestId, 8, 180, "beta1_request_id_invalid"), idempotencyKey: safeIdentifier(input.idempotencyKey, 16, 180, "beta1_idempotency_key_invalid"), projectId: parseV2Beta1ProjectId(input.projectId), baseRevision: Number(input.baseRevision), baseContentHash: input.baseContentHash, insight: parseV2Beta1SnapshotInsight(input.insight) };
}
export function parseV2Beta1JourneyRequest(value: unknown, authority: { trustedScope?: string } = {}): V2Beta1JourneyRequest {
  const input = record(value, "beta1_journey_request_invalid"); exactKeys(input, ["contractVersion", "operation", "requestId", "idempotencyKey", "projectId", "baseRevision", "baseContentHash", "entryMode", "outputTarget", "researchDirection", "researchDomain", "materials", "observationConfirmation"], "beta1_journey_request_invalid");
  if (input.contractVersion !== V2_BETA1_CONTRACT_VERSION || input.operation !== V2_BETA1_JOURNEY_OPERATION || !ENTRY_MODES.includes(input.entryMode as V2Beta1EntryMode) || !OUTPUT_TARGETS.includes(input.outputTarget as V2Beta1OutputTarget) || !Number.isSafeInteger(input.baseRevision) || Number(input.baseRevision) < 1 || !isBeta1Hash(input.baseContentHash) || !Array.isArray(input.materials) || input.materials.length > V2_BETA1_MATERIAL_MAX_COUNT) throw new Error("beta1_journey_request_invalid");
  const materials = input.materials.map((item) => { const row = record(item, "beta1_material_invalid"); exactKeys(row, ["materialId", "kind", "title", "content"], "beta1_material_invalid"); if (!MATERIAL_KINDS.includes(row.kind as V2Beta1MaterialKind)) throw new Error("beta1_material_invalid"); return { materialId: safeIdentifier(row.materialId, 4, 120, "beta1_material_id_invalid"), kind: row.kind as V2Beta1MaterialKind, title: boundedText(row.title, 1, 240, "beta1_material_title_invalid"), content: sourceText(row.content, V2_BETA1_MATERIAL_CONTENT_MAX_BYTES, "beta1_material_content_invalid") }; });
  if (new Set(materials.map((item) => item.materialId)).size !== materials.length) throw new Error("beta1_material_duplicate");
  if (materials.reduce((sum, item) => sum + new TextEncoder().encode(item.content).byteLength, 0) > V2_BETA1_MATERIAL_TOTAL_MAX_BYTES) throw new Error("beta1_material_total_too_large");
  if ((input.entryMode === "PARTIAL_MATERIAL") !== (materials.length > 0) || (input.entryMode !== "PARTIAL_MATERIAL" && materials.length > 0)) throw new Error("beta1_journey_entry_invalid");
  const projectId = parseV2Beta1ProjectId(input.projectId); const researchDirection = boundedText(input.researchDirection, 2, 1_600, "beta1_research_direction_invalid"); const researchDomain = parseV2Beta1SnapshotDomain(input.researchDomain);
  if (input.entryMode !== "PARTIAL_MATERIAL" && input.observationConfirmation !== null) throw new Error("beta1_observation_authority_invalid");
  const observationConfirmation = input.observationConfirmation === null ? null : authority.trustedScope ? parseV2Beta1ObservationConfirmationAuthority(input.observationConfirmation, { projectId, baseRevision: Number(input.baseRevision), baseContentHash: input.baseContentHash as string, outputTarget: input.outputTarget as V2Beta1OutputTarget, researchDirection, researchDomainHash: researchDomain.selectionHash, trustedScope: authority.trustedScope, materials }) : (() => { throw new Error("beta1_observation_trusted_scope_required"); })();
  return { contractVersion: V2_BETA1_CONTRACT_VERSION, operation: V2_BETA1_JOURNEY_OPERATION, requestId: safeIdentifier(input.requestId, 8, 180, "beta1_request_id_invalid"), idempotencyKey: safeIdentifier(input.idempotencyKey, 16, 180, "beta1_idempotency_key_invalid"), projectId, baseRevision: Number(input.baseRevision), baseContentHash: input.baseContentHash, entryMode: input.entryMode as V2Beta1EntryMode, outputTarget: input.outputTarget as V2Beta1OutputTarget, researchDirection, researchDomain, materials, observationConfirmation };
}

export const V2_BETA1_EFFECT_BOUNDARY = Object.freeze({ operations: [V2_BETA1_OPERATION, V2_BETA1_JOURNEY_OPERATION], persistenceClass: V2_BETA1_PERSISTENCE_CLASS, formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0, blindResendAfterUnknown: false });
