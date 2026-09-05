import { createHash } from "node:crypto";

import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { V2_ALPHA3_BUILTIN_DOMAINS } from "../v2-alpha3/contracts.ts";
import { assertAlpha8PublicationText, assertAlpha8SemanticGrounding } from "./semantic-grounding.ts";

export const V2_ALPHA8_CONTRACT_VERSION = "old-mike-v2-alpha8/1.0.0" as const;
export const V2_ALPHA8_REQUEST_MAX_BYTES = 192_000;
export const V2_ALPHA8_GOALS = Object.freeze(["JOURNAL_MANUSCRIPT"] as const);
export const V2_ALPHA8_RESULT_READINESS = Object.freeze(["OBSERVED_RESULTS_AVAILABLE", "RESULTS_NOT_AVAILABLE", "UNCERTAIN"] as const);
export const V2_ALPHA8_MATERIAL_KINDS = Object.freeze([
  "ABSTRACT",
  "INTRODUCTION",
  "METHODS",
  "RESULTS",
  "DISCUSSION",
  "EXPERIMENT_DATA",
  "SURVEY_DATA",
  "TABLE",
  "FIGURE",
  "CITATION_LIBRARY",
  "NOTE",
] as const);
export const V2_ALPHA8_DIRECTION_LANES = Object.freeze(["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const);
export const V2_ALPHA8_CORE_SECTIONS = Object.freeze(["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] as const);
export const V2_ALPHA8_EVIDENCE_STATES = Object.freeze(["OBSERVED", "UNVERIFIED", "ASSUMPTION", "MISSING"] as const);
export const V2_ALPHA8_S0_ALTERNATIVE_STRATEGIES = Object.freeze(["EVIDENCE_CALIBRATED", "BALANCED_RECOMMENDED", "FRONTIER_REFRAME"] as const);

export type V2Alpha8Goal = (typeof V2_ALPHA8_GOALS)[number];
export type V2Alpha8ResultReadiness = (typeof V2_ALPHA8_RESULT_READINESS)[number];
export type V2Alpha8MaterialKind = (typeof V2_ALPHA8_MATERIAL_KINDS)[number];
export type V2Alpha8DirectionLane = (typeof V2_ALPHA8_DIRECTION_LANES)[number];
export type V2Alpha8CoreSection = (typeof V2_ALPHA8_CORE_SECTIONS)[number];
export type V2Alpha8EvidenceState = (typeof V2_ALPHA8_EVIDENCE_STATES)[number];
export type V2Alpha8S0AlternativeStrategy = (typeof V2_ALPHA8_S0_ALTERNATIVE_STRATEGIES)[number];

export type V2Alpha8FocusDomain =
  | { kind: "BUILTIN"; domainId: string; label: string }
  | { kind: "CUSTOM"; domainId: null; label: string };

export type V2Alpha8MaterialInput = {
  materialId: string;
  kind: V2Alpha8MaterialKind;
  title: string;
  content: string;
};

export type V2Alpha8StatisticInput = {
  statisticId: string;
  label: string;
  value: string;
  unit: string;
  sourceMaterialId: string;
  consistency: "CONSISTENT_REPORTED" | "CONFLICT_REPORTED" | "UNCHECKED";
  note: string;
};

export type V2Alpha8CreateRequest = {
  contractVersion: typeof V2_ALPHA8_CONTRACT_VERSION;
  requestId: string;
  idempotencyKey: string;
  focusDomain: V2Alpha8FocusDomain;
  goal: V2Alpha8Goal;
  resultReadiness: V2Alpha8ResultReadiness;
  materials: V2Alpha8MaterialInput[];
  statistics: V2Alpha8StatisticInput[];
};

export type V2Alpha8MaterialRecord = Omit<V2Alpha8MaterialInput, "content"> & {
  content: string;
  contentHash: string;
  evidenceState: "OBSERVED";
};

export type V2Alpha8Direction = {
  directionId: string;
  lane: V2Alpha8DirectionLane;
  title: string;
  researchQuestion: string;
  rationale: string;
  methodOptimization: string;
  expectedContribution: string;
  evidenceMaterialIds: string[];
  evidenceStatisticIds: string[];
  limitations: string[];
  recommended: boolean;
  contentHash: string;
};

export type V2Alpha8StageAArtifact = {
  schemaId: "old-mike-v2-alpha8/stage-a/1";
  sourceBundleHash: string;
  directions: [V2Alpha8Direction, V2Alpha8Direction, V2Alpha8Direction];
  recommendedDirectionId: string;
  artifactHash: string;
};

export type V2Alpha8S0Entry = {
  value: string;
  evidenceState: V2Alpha8EvidenceState;
  materialIds: string[];
  statisticIds: string[];
};

export type V2Alpha8S0Alternative = V2Alpha8S0Entry & {
  alternativeId: string;
  strategy: V2Alpha8S0AlternativeStrategy;
  rationale: string;
  recommended: boolean;
  contentHash: string;
};

export type V2Alpha8AnalysisWorkPackage = {
  workPackageId: string;
  title: string;
  objective: string;
  inputMaterialIds: string[];
  inputStatisticIds: string[];
  steps: string[];
  deliverables: string[];
  claimPolicy: "OBSERVED_ONLY" | "ANALYSIS_PLAN_ONLY" | "RECONCILIATION_ONLY";
  blockedReasons: string[];
};

export type V2Alpha8ContinuedSection = {
  sectionId: V2Alpha8CoreSection;
  mode: "PRESERVED" | "REVISED" | "GENERATED" | "PLAN_ONLY";
  text: string;
  evidenceState: V2Alpha8EvidenceState;
  sourceMaterialIds: string[];
  statisticIds: string[];
  unresolvedItems: string[];
  contentHash: string;
};

export type V2Alpha8StageBArtifact = {
  schemaId: "old-mike-v2-alpha8/stage-b/1";
  sourceBundleHash: string;
  stageAArtifactHash: string;
  selectedDirectionId: string;
  s0: Record<S0FieldName, V2Alpha8S0Entry>;
  s0Alternatives: Record<S0FieldName, [V2Alpha8S0Alternative, V2Alpha8S0Alternative, V2Alpha8S0Alternative]>;
  analysisWorkPackages: V2Alpha8AnalysisWorkPackage[];
  continuedDraft: [V2Alpha8ContinuedSection, V2Alpha8ContinuedSection, V2Alpha8ContinuedSection, V2Alpha8ContinuedSection, V2Alpha8ContinuedSection, V2Alpha8ContinuedSection];
  resultsNarrativeAllowed: boolean;
  blockedReasons: string[];
  artifactHash: string;
};

export type V2Alpha8Workspace = {
  contractVersion: typeof V2_ALPHA8_CONTRACT_VERSION;
  requestId: string;
  idempotencyKey: string;
  requestHash: string;
  focusDomain: V2Alpha8FocusDomain;
  goal: V2Alpha8Goal;
  resultReadiness: V2Alpha8ResultReadiness;
  sourceBundleHash: string;
  sourcePreserved: true;
  materials: V2Alpha8MaterialRecord[];
  statistics: V2Alpha8StatisticInput[];
  stageA: V2Alpha8StageAArtifact;
  stageB: V2Alpha8StageBArtifact;
  status: "READY" | "READY_WITH_GAPS";
  syntheticGenerationStageCount: 2;
  liveProviderSubmissionCount: 0;
  cardSwitchProviderSubmissionCount: 0;
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  externalMutationCount: 0;
  persistenceClass: "PROCESS_LOCAL_LOCAL_PROTOTYPE";
  humanGate: { required: true; scope: "WHOLE_ARTIFACT_HANDOFF"; confirmed: false; contentHash: string };
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, keys: readonly string[], code: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
}

function text(value: unknown, minimum: number, maximum: number, code: string, preserve = false) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = preserve ? value.replace(/\r\n?/gu, "\n") : value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.trim().length < minimum || normalized.length > maximum || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) throw new Error(code);
  return normalized;
}

function stringList(value: unknown, code: string, maximum = 32) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(code);
  const values = value.map((item) => text(item, 1, 1_000, code));
  if (new Set(values).size !== values.length) throw new Error(code);
  return values;
}

function references(value: unknown, authority: Set<string>, code: string, minimum = 0) {
  const values = stringList(value, code, 64);
  if (values.length < minimum || values.some((item) => !authority.has(item))) throw new Error(code);
  return values;
}

function lowerHex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

export function alpha8CanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(alpha8CanonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as UnknownRecord).sort().map((key) => `${JSON.stringify(key)}:${alpha8CanonicalJson((value as UnknownRecord)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function alpha8Hash(value: unknown) {
  return createHash("sha256").update(alpha8CanonicalJson(value), "utf8").digest("hex");
}

function parseFocusDomain(value: unknown): V2Alpha8FocusDomain {
  const input = record(value, "alpha8_focus_domain_invalid");
  exactKeys(input, ["kind", "domainId", "label"], "alpha8_focus_domain_invalid");
  if (input.kind === "BUILTIN") {
    const domainId = text(input.domainId, 1, 120, "alpha8_focus_domain_invalid");
    const authority = V2_ALPHA3_BUILTIN_DOMAINS.find((item) => item.id === domainId);
    if (!authority || input.label !== authority.label) throw new Error("alpha8_focus_domain_invalid");
    return { kind: "BUILTIN", domainId, label: authority.label };
  }
  if (input.kind !== "CUSTOM" || input.domainId !== null) throw new Error("alpha8_focus_domain_invalid");
  return { kind: "CUSTOM", domainId: null, label: text(input.label, 2, 120, "alpha8_custom_domain_invalid") };
}

export function parseV2Alpha8CreateRequest(value: unknown): V2Alpha8CreateRequest {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("alpha8_request_invalid");
  }
  if (typeof serialized !== "string") throw new Error("alpha8_request_invalid");
  if (Buffer.byteLength(serialized, "utf8") > V2_ALPHA8_REQUEST_MAX_BYTES) throw new Error("alpha8_request_too_large");
  const input = record(value, "alpha8_request_invalid");
  exactKeys(input, ["contractVersion", "requestId", "idempotencyKey", "focusDomain", "goal", "resultReadiness", "materials", "statistics"], "alpha8_request_invalid");
  if (input.contractVersion !== V2_ALPHA8_CONTRACT_VERSION || !V2_ALPHA8_GOALS.includes(input.goal as V2Alpha8Goal)) throw new Error("alpha8_request_authority_invalid");
  if (!V2_ALPHA8_RESULT_READINESS.includes(input.resultReadiness as V2Alpha8ResultReadiness)) throw new Error("alpha8_result_readiness_invalid");
  const requestId = text(input.requestId, 8, 160, "alpha8_request_id_invalid");
  const idempotencyKey = text(input.idempotencyKey, 16, 160, "alpha8_idempotency_key_invalid");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(requestId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(idempotencyKey)) throw new Error("alpha8_request_id_invalid");
  if (!Array.isArray(input.materials) || input.materials.length < 1 || input.materials.length > 32) throw new Error("alpha8_materials_invalid");
  const materialIds = new Set<string>();
  const materials = input.materials.map((raw): V2Alpha8MaterialInput => {
    const material = record(raw, "alpha8_material_invalid");
    exactKeys(material, ["materialId", "kind", "title", "content"], "alpha8_material_invalid");
    const materialId = text(material.materialId, 3, 120, "alpha8_material_id_invalid");
    if (materialIds.has(materialId)) throw new Error("alpha8_material_id_duplicate");
    materialIds.add(materialId);
    if (!V2_ALPHA8_MATERIAL_KINDS.includes(material.kind as V2Alpha8MaterialKind)) throw new Error("alpha8_material_kind_invalid");
    return {
      materialId,
      kind: material.kind as V2Alpha8MaterialKind,
      title: text(material.title, 1, 240, "alpha8_material_title_invalid"),
      content: text(material.content, 4, 48_000, "alpha8_material_content_invalid", true),
    };
  });
  if (!Array.isArray(input.statistics) || input.statistics.length > 64) throw new Error("alpha8_statistics_invalid");
  const statisticIds = new Set<string>();
  const statistics = input.statistics.map((raw): V2Alpha8StatisticInput => {
    const statistic = record(raw, "alpha8_statistic_invalid");
    exactKeys(statistic, ["statisticId", "label", "value", "unit", "sourceMaterialId", "consistency", "note"], "alpha8_statistic_invalid");
    const statisticId = text(statistic.statisticId, 3, 120, "alpha8_statistic_id_invalid");
    if (statisticIds.has(statisticId)) throw new Error("alpha8_statistic_id_duplicate");
    statisticIds.add(statisticId);
    if (!materialIds.has(String(statistic.sourceMaterialId))) throw new Error("alpha8_statistic_source_invalid");
    if (statistic.consistency !== "CONSISTENT_REPORTED" && statistic.consistency !== "CONFLICT_REPORTED" && statistic.consistency !== "UNCHECKED") throw new Error("alpha8_statistic_consistency_invalid");
    return {
      statisticId,
      label: text(statistic.label, 1, 240, "alpha8_statistic_label_invalid"),
      value: text(statistic.value, 1, 120, "alpha8_statistic_value_invalid"),
      unit: text(statistic.unit, 1, 80, "alpha8_statistic_unit_invalid"),
      sourceMaterialId: String(statistic.sourceMaterialId),
      consistency: statistic.consistency,
      note: text(statistic.note, 1, 1_000, "alpha8_statistic_note_invalid"),
    };
  });
  const consistentValues = new Map<string, string>();
  const statisticKeyPart = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("zh-TW");
  for (const statistic of statistics) {
    if (statistic.consistency !== "CONSISTENT_REPORTED") continue;
    const key = `${statisticKeyPart(statistic.label)}:${statisticKeyPart(statistic.unit)}`;
    const prior = consistentValues.get(key);
    if (prior !== undefined && prior !== statistic.value.normalize("NFKC")) throw new Error("alpha8_statistic_consistency_contradiction");
    consistentValues.set(key, statistic.value.normalize("NFKC"));
  }
  return {
    contractVersion: V2_ALPHA8_CONTRACT_VERSION,
    requestId,
    idempotencyKey,
    focusDomain: parseFocusDomain(input.focusDomain),
    goal: input.goal as V2Alpha8Goal,
    resultReadiness: input.resultReadiness as V2Alpha8ResultReadiness,
    materials,
    statistics,
  };
}

function parseDirection(value: unknown, materialIds: Set<string>, statisticIds: Set<string>): V2Alpha8Direction {
  const input = record(value, "alpha8_direction_invalid");
  const lane = input.lane as V2Alpha8DirectionLane;
  if (!V2_ALPHA8_DIRECTION_LANES.includes(lane) || typeof input.recommended !== "boolean") throw new Error("alpha8_direction_authority_invalid");
  const core = {
    directionId: text(input.directionId, 3, 120, "alpha8_direction_id_invalid"),
    lane,
    title: text(input.title, 12, 500, "alpha8_direction_title_invalid"),
    researchQuestion: text(input.researchQuestion, 12, 1_200, "alpha8_direction_question_invalid"),
    rationale: text(input.rationale, 12, 3_000, "alpha8_direction_rationale_invalid"),
    methodOptimization: text(input.methodOptimization, 12, 3_000, "alpha8_direction_method_invalid"),
    expectedContribution: text(input.expectedContribution, 12, 2_000, "alpha8_direction_contribution_invalid"),
    evidenceMaterialIds: references(input.evidenceMaterialIds, materialIds, "alpha8_direction_material_reference_invalid", 1),
    evidenceStatisticIds: references(input.evidenceStatisticIds, statisticIds, "alpha8_direction_statistic_reference_invalid"),
    limitations: stringList(input.limitations, "alpha8_direction_limitations_invalid", 12),
    recommended: input.recommended,
  };
  if (core.limitations.length < 1 || /[〈〉]|\b(?:TBD|placeholder)\b|待填/iu.test(core.title)) throw new Error("alpha8_direction_quality_invalid");
  [core.title, core.researchQuestion, core.rationale, core.methodOptimization, core.expectedContribution, ...core.limitations]
    .forEach(assertAlpha8PublicationText);
  const contentHash = lowerHex(input.contentHash, "alpha8_direction_hash_invalid");
  if (alpha8Hash(core) !== contentHash) throw new Error("alpha8_direction_hash_mismatch");
  return { ...core, contentHash };
}

export function validateV2Alpha8StageA(value: unknown, sourceBundleHash: string, materialIds: Set<string>, statisticIds: Set<string>): V2Alpha8StageAArtifact {
  const input = record(value, "alpha8_stage_a_invalid");
  if (input.schemaId !== "old-mike-v2-alpha8/stage-a/1" || input.sourceBundleHash !== sourceBundleHash || !Array.isArray(input.directions) || input.directions.length !== 3) throw new Error("alpha8_stage_a_invalid");
  const directions = input.directions.map((item) => parseDirection(item, materialIds, statisticIds)) as V2Alpha8StageAArtifact["directions"];
  if (new Set(directions.map((item) => item.directionId)).size !== 3 || new Set(directions.map((item) => item.lane)).size !== 3 || new Set(directions.map((item) => item.title.toLocaleLowerCase("zh-TW"))).size !== 3 || new Set(directions.map((item) => item.researchQuestion.toLocaleLowerCase("zh-TW"))).size !== 3) throw new Error("alpha8_direction_distinctness_invalid");
  const recommendedDirectionId = text(input.recommendedDirectionId, 3, 120, "alpha8_recommendation_invalid");
  const recommended = directions.filter((item) => item.recommended);
  if (recommended.length !== 1 || recommended[0].directionId !== recommendedDirectionId || recommended[0].lane !== "BALANCED_RECOMMENDED") throw new Error("alpha8_recommendation_invalid");
  const core = { schemaId: "old-mike-v2-alpha8/stage-a/1" as const, sourceBundleHash, directions, recommendedDirectionId };
  const artifactHash = lowerHex(input.artifactHash, "alpha8_stage_a_hash_invalid");
  if (alpha8Hash(core) !== artifactHash) throw new Error("alpha8_stage_a_hash_mismatch");
  return { ...core, artifactHash };
}

function parseS0(value: unknown, materialIds: Set<string>, statisticIds: Set<string>) {
  const input = record(value, "alpha8_s0_invalid");
  exactKeys(input, S0_FIELD_NAMES, "alpha8_s0_field_set_invalid");
  const result = {} as Record<S0FieldName, V2Alpha8S0Entry>;
  for (const field of S0_FIELD_NAMES) {
    const entry = record(input[field], `alpha8_s0_${field}_invalid`);
    exactKeys(entry, ["value", "evidenceState", "materialIds", "statisticIds"], `alpha8_s0_${field}_invalid`);
    if (!V2_ALPHA8_EVIDENCE_STATES.includes(entry.evidenceState as V2Alpha8EvidenceState)) throw new Error(`alpha8_s0_${field}_evidence_invalid`);
    const materialReferences = references(entry.materialIds, materialIds, `alpha8_s0_${field}_material_invalid`);
    const statisticReferences = references(entry.statisticIds, statisticIds, `alpha8_s0_${field}_statistic_invalid`);
    if ((entry.evidenceState === "OBSERVED" || entry.evidenceState === "UNVERIFIED") && materialReferences.length + statisticReferences.length === 0) throw new Error(`alpha8_s0_${field}_grounding_required`);
    result[field] = {
      value: text(entry.value, 1, S0_FIELD_LIMITS[field], `alpha8_s0_${field}_value_invalid`),
      evidenceState: entry.evidenceState as V2Alpha8EvidenceState,
      materialIds: materialReferences,
      statisticIds: statisticReferences,
    };
  }
  return result;
}

function parseS0Alternative(value: unknown, field: S0FieldName, materialIds: Set<string>, statisticIds: Set<string>): V2Alpha8S0Alternative {
  const input = record(value, `alpha8_s0_alternative_${field}_invalid`);
  exactKeys(input, ["alternativeId", "strategy", "value", "rationale", "evidenceState", "materialIds", "statisticIds", "recommended", "contentHash"], `alpha8_s0_alternative_${field}_invalid`);
  if (!V2_ALPHA8_S0_ALTERNATIVE_STRATEGIES.includes(input.strategy as V2Alpha8S0AlternativeStrategy) || typeof input.recommended !== "boolean" || !V2_ALPHA8_EVIDENCE_STATES.includes(input.evidenceState as V2Alpha8EvidenceState)) throw new Error(`alpha8_s0_alternative_${field}_authority_invalid`);
  const materialReferences = references(input.materialIds, materialIds, `alpha8_s0_alternative_${field}_material_invalid`);
  const statisticReferences = references(input.statisticIds, statisticIds, `alpha8_s0_alternative_${field}_statistic_invalid`);
  if ((input.evidenceState === "OBSERVED" || input.evidenceState === "UNVERIFIED") && materialReferences.length + statisticReferences.length === 0) throw new Error(`alpha8_s0_alternative_${field}_grounding_required`);
  const core = {
    alternativeId: text(input.alternativeId, 3, 160, `alpha8_s0_alternative_${field}_id_invalid`),
    strategy: input.strategy as V2Alpha8S0AlternativeStrategy,
    value: text(input.value, 1, S0_FIELD_LIMITS[field], `alpha8_s0_alternative_${field}_value_invalid`),
    rationale: text(input.rationale, 8, 1_000, `alpha8_s0_alternative_${field}_rationale_invalid`),
    evidenceState: input.evidenceState as V2Alpha8EvidenceState,
    materialIds: materialReferences,
    statisticIds: statisticReferences,
    recommended: input.recommended,
  };
  const contentHash = lowerHex(input.contentHash, `alpha8_s0_alternative_${field}_hash_invalid`);
  if (alpha8Hash(core) !== contentHash) throw new Error(`alpha8_s0_alternative_${field}_hash_mismatch`);
  return { ...core, contentHash };
}

function normalizeS0AlternativeValue(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, "").replace(/^(?:證據校準|證據整合|前沿重構|跨域前沿)[：｜|]/u, "").toLocaleLowerCase("zh-TW");
}

function parseS0Alternatives(value: unknown, s0: Record<S0FieldName, V2Alpha8S0Entry>, materialIds: Set<string>, statisticIds: Set<string>) {
  const input = record(value, "alpha8_s0_alternatives_invalid");
  exactKeys(input, S0_FIELD_NAMES, "alpha8_s0_alternative_field_set_invalid");
  const output = {} as V2Alpha8StageBArtifact["s0Alternatives"];
  for (const field of S0_FIELD_NAMES) {
    const alternatives = input[field];
    if (!Array.isArray(alternatives) || alternatives.length !== 3) throw new Error(`alpha8_s0_alternative_${field}_count_invalid`);
    const parsed = alternatives.map((item) => parseS0Alternative(item, field, materialIds, statisticIds)) as V2Alpha8StageBArtifact["s0Alternatives"][S0FieldName];
    if (new Set(parsed.map((item) => item.alternativeId)).size !== 3 || new Set(parsed.map((item) => item.strategy)).size !== 3 || new Set(parsed.map((item) => item.value.toLocaleLowerCase("zh-TW"))).size !== 3) throw new Error(`alpha8_s0_alternative_${field}_distinctness_invalid`);
    const recommended = parsed.filter((item) => item.recommended);
    if (recommended.length !== 1 || recommended[0].strategy !== "BALANCED_RECOMMENDED") throw new Error(`alpha8_s0_alternative_${field}_recommendation_invalid`);
    if (recommended[0].value !== s0[field].value) throw new Error(`alpha8_s0_alternative_${field}_binding_invalid`);
    const base = normalizeS0AlternativeValue(s0[field].value);
    if (parsed.some((item) => item.strategy !== "BALANCED_RECOMMENDED" && normalizeS0AlternativeValue(item.value) === base)) throw new Error(`alpha8_s0_alternative_${field}_materiality_invalid`);
    output[field] = parsed;
  }
  return output;
}

function parseWorkPackage(value: unknown, materialIds: Set<string>, statisticIds: Set<string>): V2Alpha8AnalysisWorkPackage {
  const input = record(value, "alpha8_work_package_invalid");
  if (input.claimPolicy !== "OBSERVED_ONLY" && input.claimPolicy !== "ANALYSIS_PLAN_ONLY" && input.claimPolicy !== "RECONCILIATION_ONLY") throw new Error("alpha8_work_package_policy_invalid");
  const result = {
    workPackageId: text(input.workPackageId, 3, 120, "alpha8_work_package_id_invalid"),
    title: text(input.title, 4, 500, "alpha8_work_package_title_invalid"),
    objective: text(input.objective, 8, 2_000, "alpha8_work_package_objective_invalid"),
    inputMaterialIds: references(input.inputMaterialIds, materialIds, "alpha8_work_package_material_invalid"),
    inputStatisticIds: references(input.inputStatisticIds, statisticIds, "alpha8_work_package_statistic_invalid"),
    steps: stringList(input.steps, "alpha8_work_package_steps_invalid", 24),
    deliverables: stringList(input.deliverables, "alpha8_work_package_deliverables_invalid", 16),
    claimPolicy: input.claimPolicy,
    blockedReasons: stringList(input.blockedReasons, "alpha8_work_package_blockers_invalid", 16),
  } as V2Alpha8AnalysisWorkPackage;
  if (result.inputMaterialIds.length + result.inputStatisticIds.length < 1 || result.steps.length < 2 || result.deliverables.length < 1) throw new Error("alpha8_work_package_incomplete");
  return result;
}

function parseContinuedSection(value: unknown, materialIds: Set<string>, statisticIds: Set<string>): V2Alpha8ContinuedSection {
  const input = record(value, "alpha8_continued_section_invalid");
  if (!V2_ALPHA8_CORE_SECTIONS.includes(input.sectionId as V2Alpha8CoreSection) || !["PRESERVED", "REVISED", "GENERATED", "PLAN_ONLY"].includes(String(input.mode)) || !V2_ALPHA8_EVIDENCE_STATES.includes(input.evidenceState as V2Alpha8EvidenceState)) throw new Error("alpha8_continued_section_authority_invalid");
  const core = {
    sectionId: input.sectionId as V2Alpha8CoreSection,
    mode: input.mode as V2Alpha8ContinuedSection["mode"],
    text: text(input.text, 12, 12_000, "alpha8_continued_section_text_invalid", true),
    evidenceState: input.evidenceState as V2Alpha8EvidenceState,
    sourceMaterialIds: references(input.sourceMaterialIds, materialIds, "alpha8_continued_section_material_invalid"),
    statisticIds: references(input.statisticIds, statisticIds, "alpha8_continued_section_statistic_invalid"),
    unresolvedItems: stringList(input.unresolvedItems, "alpha8_continued_section_unresolved_invalid", 16),
  };
  if (core.mode !== "PLAN_ONLY" && core.sourceMaterialIds.length + core.statisticIds.length < 1) throw new Error("alpha8_continued_section_grounding_required");
  assertAlpha8PublicationText(core.text);
  const contentHash = lowerHex(input.contentHash, "alpha8_continued_section_hash_invalid");
  if (alpha8Hash(core) !== contentHash) throw new Error("alpha8_continued_section_hash_mismatch");
  return { ...core, contentHash };
}

export function validateV2Alpha8StageB(value: unknown, sourceBundleHash: string, stageA: V2Alpha8StageAArtifact, materialIds: Set<string>, statisticIds: Set<string>, conflictIds: string[], uncheckedIds: string[], resultsAvailable: boolean): V2Alpha8StageBArtifact {
  const input = record(value, "alpha8_stage_b_invalid");
  if (input.schemaId !== "old-mike-v2-alpha8/stage-b/1" || input.sourceBundleHash !== sourceBundleHash || input.stageAArtifactHash !== stageA.artifactHash || input.selectedDirectionId !== stageA.recommendedDirectionId || typeof input.resultsNarrativeAllowed !== "boolean") throw new Error("alpha8_stage_b_binding_invalid");
  const s0 = parseS0(input.s0, materialIds, statisticIds);
  const s0Alternatives = parseS0Alternatives(input.s0Alternatives, s0, materialIds, statisticIds);
  if (!Array.isArray(input.analysisWorkPackages) || input.analysisWorkPackages.length < 1 || input.analysisWorkPackages.length > 24) throw new Error("alpha8_work_packages_invalid");
  const analysisWorkPackages = input.analysisWorkPackages.map((item) => parseWorkPackage(item, materialIds, statisticIds));
  if (new Set(analysisWorkPackages.map((item) => item.workPackageId)).size !== analysisWorkPackages.length) throw new Error("alpha8_work_package_duplicate");
  if (conflictIds.length && !analysisWorkPackages.some((item) => item.claimPolicy === "RECONCILIATION_ONLY" && conflictIds.every((id) => item.inputStatisticIds.includes(id)))) throw new Error("alpha8_reconciliation_work_package_required");
  if (uncheckedIds.length && !analysisWorkPackages.some((item) => item.claimPolicy === "ANALYSIS_PLAN_ONLY" && uncheckedIds.every((id) => item.inputStatisticIds.includes(id)))) throw new Error("alpha8_unchecked_analysis_work_package_required");
  const unsafeStatisticIds = new Set([...conflictIds, ...uncheckedIds]);
  if (analysisWorkPackages.some((item) => item.claimPolicy === "OBSERVED_ONLY" && item.inputStatisticIds.some((id) => unsafeStatisticIds.has(id)))) throw new Error("alpha8_observed_work_package_unsafe_statistic");
  if (!Array.isArray(input.continuedDraft) || input.continuedDraft.length !== 6) throw new Error("alpha8_continued_draft_invalid");
  const continuedDraft = input.continuedDraft.map((item) => parseContinuedSection(item, materialIds, statisticIds)) as V2Alpha8StageBArtifact["continuedDraft"];
  if (continuedDraft.some((item, index) => item.sectionId !== V2_ALPHA8_CORE_SECTIONS[index])) throw new Error("alpha8_continued_draft_order_invalid");
  const blockedReasons = stringList(input.blockedReasons, "alpha8_stage_b_blockers_invalid", 16);
  const expectedBlockedReasons = [
    ...(!resultsAvailable ? ["RESULTS_MISSING_ANALYSIS_PLAN_ONLY"] : []),
    ...(conflictIds.length ? ["STATISTICAL_CONFLICT_REQUIRES_RESOLUTION"] : []),
    ...(uncheckedIds.length ? ["STATISTICS_UNCHECKED_REQUIRES_VALIDATION"] : []),
  ];
  if (blockedReasons.length !== expectedBlockedReasons.length || expectedBlockedReasons.some((reason) => !blockedReasons.includes(reason))) throw new Error("alpha8_stage_b_blockers_mismatch");
  const resultsDependent = new Set<V2Alpha8CoreSection>(["ABSTRACT", "RESULTS", "DISCUSSION", "CONCLUSION"]);
  const mustBlock = !resultsAvailable || conflictIds.length > 0 || uncheckedIds.length > 0;
  if (input.resultsNarrativeAllowed !== !mustBlock) throw new Error("alpha8_results_boundary_invalid");
  if (mustBlock && continuedDraft.some((section) => resultsDependent.has(section.sectionId) && section.mode !== "PLAN_ONLY")) throw new Error("alpha8_result_dependent_section_must_be_plan_only");
  if (mustBlock && blockedReasons.length < 1) throw new Error("alpha8_blocked_reason_required");
  const core = {
    schemaId: "old-mike-v2-alpha8/stage-b/1" as const,
    sourceBundleHash,
    stageAArtifactHash: stageA.artifactHash,
    selectedDirectionId: stageA.recommendedDirectionId,
    s0,
    s0Alternatives,
    analysisWorkPackages,
    continuedDraft,
    resultsNarrativeAllowed: input.resultsNarrativeAllowed,
    blockedReasons,
  };
  const artifactHash = lowerHex(input.artifactHash, "alpha8_stage_b_hash_invalid");
  if (alpha8Hash(core) !== artifactHash) throw new Error("alpha8_stage_b_hash_mismatch");
  return { ...core, artifactHash };
}

export function validateV2Alpha8Workspace(value: V2Alpha8Workspace, expectedRequest?: V2Alpha8CreateRequest): V2Alpha8Workspace {
  if (value.contractVersion !== V2_ALPHA8_CONTRACT_VERSION || value.sourcePreserved !== true || value.syntheticGenerationStageCount !== 2 || value.liveProviderSubmissionCount !== 0 || value.cardSwitchProviderSubmissionCount !== 0 || value.formalResearchWriteCount !== 0 || value.onlineDatabaseWriteCount !== 0 || value.externalMutationCount !== 0 || value.persistenceClass !== "PROCESS_LOCAL_LOCAL_PROTOTYPE") throw new Error("alpha8_workspace_boundary_invalid");
  const parsed = parseV2Alpha8CreateRequest({
    contractVersion: value.contractVersion,
    requestId: value.requestId,
    idempotencyKey: value.idempotencyKey,
    focusDomain: value.focusDomain,
    goal: value.goal,
    resultReadiness: value.resultReadiness,
    materials: value.materials.map((item) => ({ materialId: item.materialId, kind: item.kind, title: item.title, content: item.content })),
    statistics: value.statistics,
  });
  const requestHash = alpha8Hash(parsed);
  if (value.requestHash !== requestHash) throw new Error("alpha8_workspace_request_hash_mismatch");
  if (expectedRequest && requestHash !== alpha8Hash(expectedRequest)) throw new Error("alpha8_workspace_request_binding_mismatch");
  if (value.materials.some((item) => item.evidenceState !== "OBSERVED" || item.contentHash !== alpha8Hash(item.content))) throw new Error("alpha8_workspace_material_hash_mismatch");
  const sourceBundleHash = alpha8Hash({ focusDomain: parsed.focusDomain, goal: parsed.goal, resultReadiness: parsed.resultReadiness, materials: value.materials, statistics: parsed.statistics });
  if (value.sourceBundleHash !== sourceBundleHash) throw new Error("alpha8_workspace_source_hash_mismatch");
  const materialIds = new Set(value.materials.map((item) => item.materialId));
  const safeStatisticIds = new Set(parsed.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => item.statisticId));
  const allStatisticIds = new Set(parsed.statistics.map((item) => item.statisticId));
  const conflictIds = parsed.statistics.filter((item) => item.consistency === "CONFLICT_REPORTED").map((item) => item.statisticId);
  const uncheckedIds = parsed.statistics.filter((item) => item.consistency === "UNCHECKED").map((item) => item.statisticId);
  const resultMaterialPresent = value.materials.some((item) => ["RESULTS", "TABLE", "FIGURE"].includes(item.kind));
  const resultsAvailable = parsed.resultReadiness === "OBSERVED_RESULTS_AVAILABLE" && resultMaterialPresent;
  const stageA = validateV2Alpha8StageA(value.stageA, sourceBundleHash, materialIds, safeStatisticIds);
  const stageB = validateV2Alpha8StageB(value.stageB, sourceBundleHash, stageA, materialIds, allStatisticIds, conflictIds, uncheckedIds, resultsAvailable);
  assertAlpha8SemanticGrounding(stageA.directions, value.materials);
  const expectedStatus = stageB.blockedReasons.length ? "READY_WITH_GAPS" : "READY";
  if (value.status !== expectedStatus) throw new Error("alpha8_workspace_status_mismatch");
  if (value.humanGate.required !== true || value.humanGate.scope !== "WHOLE_ARTIFACT_HANDOFF" || value.humanGate.confirmed !== false || value.humanGate.contentHash !== alpha8Hash({ stageA: stageA.artifactHash, stageB: stageB.artifactHash })) throw new Error("alpha8_workspace_binding_invalid");
  return value;
}
