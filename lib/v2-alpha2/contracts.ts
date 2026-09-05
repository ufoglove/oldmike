import { createHash } from "node:crypto";

import { S0_FIELD_LIMITS, S0_FIELD_NAMES as SHARED_S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";

export const V2_ALPHA2_CONTRACT_VERSION = "old-mike-v2-alpha2/1.0.0" as const;
export const V2_ALPHA2_DIRECTION_LANES = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
export const V2_ALPHA2_SUGGESTION_STRATEGIES = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
export const S0_FIELD_NAMES = SHARED_S0_FIELD_NAMES;

export type V2Alpha2DirectionLane = (typeof V2_ALPHA2_DIRECTION_LANES)[number];
export type V2Alpha2SuggestionStrategy = (typeof V2_ALPHA2_SUGGESTION_STRATEGIES)[number];
export type V2Alpha2Operation = "GENERATE_DIRECTIONS" | "EXPAND_SELECTED_S0" | "FIELD_ASSIST";
export type V2Alpha2ErrorCode = "OUTPUT_JSON" | "OUTPUT_SCHEMA" | "DOMAIN_VALIDATE" | "TIMEOUT" | "TRANSPORT" | "COMPLETION_UNKNOWN" | "UNEXPECTED_INTERNAL";
export type V2Alpha2JobState = "QUEUED" | "RUNNING" | "STAGE_A_READY" | "STAGE_B_QUEUED" | "STAGE_B_RUNNING" | "STAGE_B_READY" | "RECONCILE_REQUIRED" | "FAILED" | "CANCELED";
export type V2Alpha2LastReadyStage = "NONE" | "A" | "B";

type UnknownRecord = Record<string, unknown>;

export type V2Alpha2DirectionCard = {
  directionId: string;
  lane: V2Alpha2DirectionLane;
  workingTitle: string;
  researchQuestion: string;
  researchValue: string;
  mechanismTheory: string;
  targetContext: string;
  methodSketch: string;
  feasibilityRisk: string;
  domain: string;
  outputTrack: string;
  unknowns: string[];
  nextAction: string;
};

export type V2Alpha2DirectionArtifact = {
  schemaId: "old-mike-v2-alpha2/directions/1";
  researchDirection: string;
  directions: [V2Alpha2DirectionCard, V2Alpha2DirectionCard, V2Alpha2DirectionCard];
  recommendedDirectionId: string;
};

export type V2Alpha2S0Artifact = {
  schemaId: "old-mike-v2-alpha2/s0/1";
  sourceDirectionId: string;
  fields: Record<S0FieldName, string>;
};

export type V2Alpha2SuggestionOption = {
  strategy: V2Alpha2SuggestionStrategy;
  text: string;
  rationale: string;
  boundary: "UNVERIFIED" | "ASSUMPTION" | "MISSING_DATA";
};

export type V2Alpha2SuggestionSlot =
  | { strategy: V2Alpha2SuggestionStrategy; status: "VALID"; option: V2Alpha2SuggestionOption }
  | { strategy: V2Alpha2SuggestionStrategy; status: "INVALID"; option: null; issueCode: "OPTION_INVALID" };

export type V2Alpha2FieldAssistArtifact = {
  schemaId: "old-mike-v2-alpha2/field-assist/1";
  targetField: S0FieldName;
  slots: [V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot];
  validOptions: V2Alpha2SuggestionOption[];
  recommendedOption: V2Alpha2SuggestionOption | null;
};

export type V2Alpha2JourneySnapshot = {
  contractVersion: "old-mike-v2-alpha2/journey/1";
  journeyRef: string;
  state: V2Alpha2JobState;
  lastReadyStage: V2Alpha2LastReadyStage;
  stageA: ({ contentHash: string } & V2Alpha2DirectionArtifact) | null;
  stageB: ({ contentHash: string } & V2Alpha2S0Artifact) | null;
  selectedCompareDirectionId: string | null;
  s0SourceDirectionId: string | null;
  cancelAllowed: boolean;
  recoveryAction: "CANCEL_OR_VIEW_PROGRESS" | "VIEW_PROGRESS" | "NONE";
  formalWriteCount: 0;
};

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function boundedText(value: unknown, maximum: number, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function exactLowerHex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as UnknownRecord).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as UnknownRecord)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function parseDirectionCard(value: unknown): V2Alpha2DirectionCard {
  const input = record(value, "direction_card_invalid");
  const unknowns = input.unknowns;
  if (!Array.isArray(unknowns) || unknowns.length < 1 || unknowns.length > 2) throw new Error("direction_unknowns_invalid");
  const lane = input.lane;
  if (!V2_ALPHA2_DIRECTION_LANES.includes(lane as V2Alpha2DirectionLane)) throw new Error("direction_lane_invalid");
  return {
    directionId: boundedText(input.directionId, 120, "direction_id_invalid"),
    lane: lane as V2Alpha2DirectionLane,
    workingTitle: boundedText(input.workingTitle, 240, "direction_working_title_invalid"),
    researchQuestion: boundedText(input.researchQuestion, 600, "direction_research_question_invalid"),
    researchValue: boundedText(input.researchValue, 800, "direction_research_value_invalid"),
    mechanismTheory: boundedText(input.mechanismTheory, 800, "direction_mechanism_invalid"),
    targetContext: boundedText(input.targetContext, 800, "direction_target_context_invalid"),
    methodSketch: boundedText(input.methodSketch, 800, "direction_method_invalid"),
    feasibilityRisk: boundedText(input.feasibilityRisk, 800, "direction_feasibility_invalid"),
    domain: boundedText(input.domain, 120, "direction_domain_invalid"),
    outputTrack: boundedText(input.outputTrack, 120, "direction_output_track_invalid"),
    unknowns: unknowns.map((item) => boundedText(item, 240, "direction_unknown_invalid")),
    nextAction: boundedText(input.nextAction, 400, "direction_next_action_invalid"),
  };
}

export function parseDirectionArtifact(value: unknown): V2Alpha2DirectionArtifact {
  const input = record(value, "direction_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-alpha2/directions/1") throw new Error("direction_schema_invalid");
  if (!Array.isArray(input.directions) || input.directions.length !== 3) throw new Error("direction_count_invalid");
  const directions = input.directions.map(parseDirectionCard) as [V2Alpha2DirectionCard, V2Alpha2DirectionCard, V2Alpha2DirectionCard];
  if (new Set(directions.map((item) => item.directionId)).size !== 3) throw new Error("direction_id_duplicate");
  if (new Set(directions.map((item) => item.lane)).size !== 3 || !V2_ALPHA2_DIRECTION_LANES.every((lane) => directions.some((item) => item.lane === lane))) {
    throw new Error("direction_lane_set_invalid");
  }
  if (new Set(directions.map((item) => item.workingTitle.toLocaleLowerCase("zh-TW"))).size !== 3) throw new Error("direction_title_not_distinct");
  const recommendedDirectionId = boundedText(input.recommendedDirectionId, 120, "recommended_direction_id_invalid");
  const recommended = directions.find((item) => item.directionId === recommendedDirectionId);
  if (!recommended || recommended.lane !== "BALANCED_RECOMMENDED") throw new Error("recommended_direction_binding_invalid");
  return {
    schemaId: "old-mike-v2-alpha2/directions/1",
    researchDirection: boundedText(input.researchDirection, 1_000, "research_direction_invalid"),
    directions,
    recommendedDirectionId,
  };
}

export function parseS0Artifact(value: unknown): V2Alpha2S0Artifact {
  const input = record(value, "s0_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-alpha2/s0/1") throw new Error("s0_schema_invalid");
  const rawFields = record(input.fields, "s0_fields_invalid");
  if (Object.keys(rawFields).length !== S0_FIELD_NAMES.length || !S0_FIELD_NAMES.every((field) => Object.hasOwn(rawFields, field))) throw new Error("s0_field_set_invalid");
  const fields = {} as Record<S0FieldName, string>;
  for (const field of S0_FIELD_NAMES) fields[field] = boundedText(rawFields[field], S0_FIELD_LIMITS[field], `s0_field_invalid:${field}`);
  return {
    schemaId: "old-mike-v2-alpha2/s0/1",
    sourceDirectionId: boundedText(input.sourceDirectionId, 120, "s0_source_direction_invalid"),
    fields,
  };
}

function parseSuggestionOption(value: unknown, expectedStrategy: V2Alpha2SuggestionStrategy): V2Alpha2SuggestionOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as UnknownRecord;
  if (input.strategy !== expectedStrategy) return null;
  if (input.boundary !== "UNVERIFIED" && input.boundary !== "ASSUMPTION" && input.boundary !== "MISSING_DATA") return null;
  try {
    return {
      strategy: expectedStrategy,
      text: boundedText(input.text, 4_000, "assist_text_invalid"),
      rationale: boundedText(input.rationale, 1_000, "assist_rationale_invalid"),
      boundary: input.boundary,
    };
  } catch {
    return null;
  }
}

export function parseFieldAssistArtifact(value: unknown): V2Alpha2FieldAssistArtifact {
  const input = record(value, "assist_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-alpha2/field-assist/1") throw new Error("assist_schema_invalid");
  if (!S0_FIELD_NAMES.includes(input.targetField as S0FieldName)) throw new Error("assist_target_field_invalid");
  if (!Array.isArray(input.options) || input.options.length !== 3) throw new Error("assist_option_count_invalid");
  const rawOptions = input.options as unknown[];
  const presentedStrategies = rawOptions.map((option) => option && typeof option === "object" && !Array.isArray(option) ? (option as UnknownRecord).strategy : null);
  if (new Set(presentedStrategies).size !== 3 || !V2_ALPHA2_SUGGESTION_STRATEGIES.every((strategy) => presentedStrategies.includes(strategy))) {
    throw new Error("assist_strategy_set_invalid");
  }
  const slots = V2_ALPHA2_SUGGESTION_STRATEGIES.map((strategy) => {
    const raw = rawOptions.find((option) => option && typeof option === "object" && !Array.isArray(option) && (option as UnknownRecord).strategy === strategy);
    const parsed = parseSuggestionOption(raw, strategy);
    return parsed
      ? { strategy, status: "VALID" as const, option: parsed }
      : { strategy, status: "INVALID" as const, option: null, issueCode: "OPTION_INVALID" as const };
  }) as [V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot];
  const validOptions = slots.flatMap((slot) => slot.status === "VALID" ? [slot.option] : []);
  if (!validOptions.length) throw new Error("assist_no_valid_option");
  return {
    schemaId: "old-mike-v2-alpha2/field-assist/1",
    targetField: input.targetField as S0FieldName,
    slots,
    validOptions,
    recommendedOption: validOptions.find((option) => option.strategy === "BALANCED_RECOMMENDED") ?? null,
  };
}

export function validatePersistedFieldAssistArtifact(value: unknown): V2Alpha2FieldAssistArtifact {
  const input = record(value, "assist_persisted_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-alpha2/field-assist/1") throw new Error("assist_schema_invalid");
  if (!S0_FIELD_NAMES.includes(input.targetField as S0FieldName)) throw new Error("assist_target_field_invalid");
  if (!Array.isArray(input.slots) || input.slots.length !== 3) throw new Error("assist_slot_count_invalid");
  const rawSlots = input.slots as unknown[];
  const slots = V2_ALPHA2_SUGGESTION_STRATEGIES.map((strategy, index) => {
    const slot = record(rawSlots[index], "assist_slot_invalid");
    if (slot.strategy !== strategy) throw new Error("assist_slot_strategy_invalid");
    if (slot.status === "VALID") {
      const option = parseSuggestionOption(slot.option, strategy);
      if (!option) throw new Error("assist_slot_option_invalid");
      return { strategy, status: "VALID" as const, option };
    }
    if (slot.status !== "INVALID" || slot.option !== null || slot.issueCode !== "OPTION_INVALID") throw new Error("assist_slot_invalid");
    return { strategy, status: "INVALID" as const, option: null, issueCode: "OPTION_INVALID" as const };
  }) as [V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot, V2Alpha2SuggestionSlot];
  const validOptions = slots.flatMap((slot) => slot.status === "VALID" ? [slot.option] : []);
  if (!validOptions.length) throw new Error("assist_no_valid_option");
  return {
    schemaId: "old-mike-v2-alpha2/field-assist/1",
    targetField: input.targetField as S0FieldName,
    slots,
    validOptions,
    recommendedOption: validOptions.find((option) => option.strategy === "BALANCED_RECOMMENDED") ?? null,
  };
}

export function validateCreateJourneyRequest(value: unknown) {
  const input = record(value, "journey_create_invalid");
  if (input.contractVersion !== V2_ALPHA2_CONTRACT_VERSION) throw new Error("journey_contract_version_invalid");
  const idempotencyKey = boundedText(input.idempotencyKey, 160, "journey_idempotency_key_invalid");
  if (idempotencyKey.length < 16 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(idempotencyKey)) throw new Error("journey_idempotency_key_invalid");
  if (input.sourceStrategy !== "NONE") throw new Error("journey_source_strategy_invalid");
  return {
    contractVersion: V2_ALPHA2_CONTRACT_VERSION,
    idempotencyKey,
    researchDirection: boundedText(input.researchDirection, 1_000, "research_direction_invalid"),
    sourceStrategy: "NONE" as const,
  };
}

function parseStageA(value: unknown): V2Alpha2JourneySnapshot["stageA"] {
  if (value === null) return null;
  const input = record(value, "journey_stage_a_invalid");
  return { contentHash: exactLowerHex(input.contentHash, "journey_stage_a_hash_invalid"), ...parseDirectionArtifact(input) };
}

function parseStageB(value: unknown): V2Alpha2JourneySnapshot["stageB"] {
  if (value === null) return null;
  const input = record(value, "journey_stage_b_invalid");
  return { contentHash: exactLowerHex(input.contentHash, "journey_stage_b_hash_invalid"), ...parseS0Artifact(input) };
}

export function parseJourneySnapshot(value: unknown): V2Alpha2JourneySnapshot {
  const input = record(value, "journey_snapshot_invalid");
  if (input.contractVersion !== "old-mike-v2-alpha2/journey/1") throw new Error("journey_snapshot_version_invalid");
  const states: readonly V2Alpha2JobState[] = ["QUEUED", "RUNNING", "STAGE_A_READY", "STAGE_B_QUEUED", "STAGE_B_RUNNING", "STAGE_B_READY", "RECONCILE_REQUIRED", "FAILED", "CANCELED"];
  const readyStages: readonly V2Alpha2LastReadyStage[] = ["NONE", "A", "B"];
  if (!states.includes(input.state as V2Alpha2JobState)) throw new Error("journey_state_invalid");
  if (!readyStages.includes(input.lastReadyStage as V2Alpha2LastReadyStage)) throw new Error("journey_last_ready_stage_invalid");
  if (typeof input.cancelAllowed !== "boolean") throw new Error("journey_cancel_boundary_invalid");
  if (input.cancelAllowed && input.state !== "QUEUED") throw new Error("journey_cancel_boundary_invalid");
  if (input.recoveryAction !== "CANCEL_OR_VIEW_PROGRESS" && input.recoveryAction !== "VIEW_PROGRESS" && input.recoveryAction !== "NONE") throw new Error("journey_recovery_action_invalid");
  if (input.cancelAllowed !== (input.recoveryAction === "CANCEL_OR_VIEW_PROGRESS")) throw new Error("journey_cancel_boundary_invalid");
  if (input.formalWriteCount !== 0) throw new Error("journey_formal_write_boundary_invalid");
  const selectedCompareDirectionId = input.selectedCompareDirectionId === null ? null : boundedText(input.selectedCompareDirectionId, 120, "journey_compare_direction_invalid");
  const s0SourceDirectionId = input.s0SourceDirectionId === null ? null : boundedText(input.s0SourceDirectionId, 120, "journey_s0_source_invalid");
  return {
    contractVersion: "old-mike-v2-alpha2/journey/1",
    journeyRef: boundedText(input.journeyRef, 120, "journey_ref_invalid"),
    state: input.state as V2Alpha2JobState,
    lastReadyStage: input.lastReadyStage as V2Alpha2LastReadyStage,
    stageA: parseStageA(input.stageA),
    stageB: parseStageB(input.stageB),
    selectedCompareDirectionId,
    s0SourceDirectionId,
    cancelAllowed: input.cancelAllowed,
    recoveryAction: input.recoveryAction,
    formalWriteCount: 0,
  };
}

export function mergeJourneySnapshots(previous: V2Alpha2JourneySnapshot | null, incoming: V2Alpha2JourneySnapshot): V2Alpha2JourneySnapshot {
  if (!previous) return incoming;
  if (previous.journeyRef !== incoming.journeyRef) throw new Error("journey_ref_mismatch");
  if (previous.stageA && incoming.stageA && previous.stageA.contentHash !== incoming.stageA.contentHash) throw new Error("journey_stage_a_immutable_conflict");
  if (previous.stageB && incoming.stageB && previous.stageB.contentHash !== incoming.stageB.contentHash) throw new Error("journey_stage_b_immutable_conflict");
  const rank: Record<V2Alpha2LastReadyStage, number> = { NONE: 0, A: 1, B: 2 };
  const lastReadyStage = rank[previous.lastReadyStage] > rank[incoming.lastReadyStage] ? previous.lastReadyStage : incoming.lastReadyStage;
  return {
    ...incoming,
    lastReadyStage,
    stageA: incoming.stageA ?? previous.stageA,
    stageB: incoming.stageB ?? previous.stageB,
    selectedCompareDirectionId: incoming.selectedCompareDirectionId ?? previous.selectedCompareDirectionId,
    s0SourceDirectionId: incoming.s0SourceDirectionId ?? previous.s0SourceDirectionId,
  };
}
