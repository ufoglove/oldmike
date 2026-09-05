import { canonicalDomains, outputTrackIds, type CanonicalDomain, type OutputTrackId } from "./research-config.ts";
import type { S0Intake } from "./project-contract.ts";
import {
  S0_FIELDS,
  S0_FIELD_LIMITS,
  S0_FIELD_NAMES,
  S0_TEXT_FIELDS,
  S0_TEXT_FIELD_NAMES,
  type S0FieldName,
  type S0TextFieldName,
} from "./s0-fields.ts";
import { parseStrictJsonObject } from "./strict-json-envelope.ts";

export { S0_FIELDS, S0_TEXT_FIELDS };

export const S0_DRAFT_COMPLETION_CLASSES = ["COMPLETE", "PARTIAL_REVIEW_REQUIRED"] as const;
export const S0_FIELD_STATUSES = ["USER_PROVIDED", "UNVERIFIED", "AI_PROPOSED", "RESEARCHER_INPUT_REQUIRED"] as const;
export const S0_PARSER_STAGES = ["JSON_ENVELOPE", "TOP_STATUS", "DRAFT_OR_SUGGESTIONS", "FIELD_NAME", "FIELD_VALUE", "FIELD_STATUS"] as const;

export type S0DraftCompletionClass = (typeof S0_DRAFT_COMPLETION_CLASSES)[number];
export type S0FieldStatus = (typeof S0_FIELD_STATUSES)[number];
export type S0ParserStage = (typeof S0_PARSER_STAGES)[number];
export type S0ParserBitmap = Record<S0ParserStage, "PASS" | "FAIL" | "NOT_REACHED">;
export type S0DraftField = { value: string; status: S0FieldStatus };
export type S0CandidateInput = Partial<{
  chineseTitle: string;
  practicalProblem: string;
  researchPopulation: string;
  coreQuestion: string;
  possibleMethods: string[];
  requiredData: string[];
  ethicsPrivacySiteRisks: string[];
  unknowns: string[];
}>;

export type ParsedS0SuggestionEnvelope = {
  ok: true;
  status: S0DraftCompletionClass;
  suggestions: Partial<Record<S0TextFieldName, { value: string; status: "AI_PROPOSED" }>>;
  bitmap: S0ParserBitmap;
};

export type S0SuggestionParseFailure = {
  ok: false;
  code: string;
  stage: S0ParserStage;
  bitmap: S0ParserBitmap;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function clean(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  return normalized.length <= limit ? normalized : "";
}

function stringList(value: unknown, maximum = 8, itemLimit = 1000) {
  if (!Array.isArray(value) || value.length > maximum) return [];
  return value.map((item) => clean(item, itemLimit)).filter(Boolean);
}

function emptyBitmap(): S0ParserBitmap {
  return {
    JSON_ENVELOPE: "NOT_REACHED",
    TOP_STATUS: "NOT_REACHED",
    DRAFT_OR_SUGGESTIONS: "NOT_REACHED",
    FIELD_NAME: "NOT_REACHED",
    FIELD_VALUE: "NOT_REACHED",
    FIELD_STATUS: "NOT_REACHED",
  };
}

function failure(bitmap: S0ParserBitmap, stage: S0ParserStage, code: string): S0SuggestionParseFailure {
  return { ok: false, code, stage, bitmap: { ...bitmap, [stage]: "FAIL" } };
}

function normalizeIntake(value: Partial<S0Intake>): S0Intake {
  const normalized = {} as S0Intake;
  for (const field of S0_FIELDS) normalized[field.name] = clean(value[field.name], field.maxLength) as never;
  if (!canonicalDomains.includes(normalized.domain as CanonicalDomain)) normalized.domain = canonicalDomains[0];
  if (!outputTrackIds.includes(normalized.outputTrack as OutputTrackId)) normalized.outputTrack = outputTrackIds[0];
  return normalized;
}

function candidateMappings(candidate: S0CandidateInput | undefined): Partial<Record<S0TextFieldName, string>> {
  if (!candidate) return {};
  return {
    workingTitle: clean(candidate.chineseTitle, S0_FIELD_LIMITS.workingTitle),
    problemContext: clean(candidate.practicalProblem, S0_FIELD_LIMITS.problemContext),
    targetUsers: clean(candidate.researchPopulation, S0_FIELD_LIMITS.targetUsers),
    expectedContribution: clean(candidate.coreQuestion, S0_FIELD_LIMITS.expectedContribution),
    availableData: stringList(candidate.requiredData).join("；").slice(0, S0_FIELD_LIMITS.availableData),
    methodIdea: stringList(candidate.possibleMethods).join("；").slice(0, S0_FIELD_LIMITS.methodIdea),
    ethicsPrivacyRisks: stringList(candidate.ethicsPrivacySiteRisks).join("；").slice(0, S0_FIELD_LIMITS.ethicsPrivacyRisks),
    unresolvedItems: stringList(candidate.unknowns).join("；").slice(0, S0_FIELD_LIMITS.unresolvedItems),
  };
}

export function composeCandidateIntake(input: {
  currentIntake: Partial<S0Intake>;
  candidate?: S0CandidateInput;
  selectedDomain: CanonicalDomain;
  selectedOutputTrack: OutputTrackId;
  userProvidedFields?: readonly S0FieldName[];
}) {
  const intake = normalizeIntake({ ...input.currentIntake, domain: input.selectedDomain, outputTrack: input.selectedOutputTrack });
  const userProvided = new Set(input.userProvidedFields || []);
  const fieldStatus = {} as Record<S0FieldName, S0FieldStatus>;
  for (const field of S0_FIELDS) {
    fieldStatus[field.name] = userProvided.has(field.name) || (Boolean(intake[field.name]) && field.kind !== "TEXT") ? "USER_PROVIDED" : Boolean(intake[field.name]) ? "UNVERIFIED" : "RESEARCHER_INPUT_REQUIRED";
  }
  fieldStatus.domain = "USER_PROVIDED";
  fieldStatus.outputTrack = "USER_PROVIDED";
  const mapped = candidateMappings(input.candidate);
  for (const field of S0_TEXT_FIELD_NAMES) {
    const value = mapped[field];
    if (!userProvided.has(field) && !intake[field] && value) {
      intake[field] = value;
      fieldStatus[field] = "UNVERIFIED";
    }
  }
  return { intake, fieldStatus };
}

export function targetS0Fields(intake: S0Intake, fieldStatus: Record<S0FieldName, S0FieldStatus>) {
  return S0_TEXT_FIELDS.filter((field) => {
    if (fieldStatus[field.name] === "USER_PROVIDED") return false;
    return clean(intake[field.name], field.maxLength).length < field.reviewLength;
  }).map((field) => field.name);
}

export function parseS0SuggestionEnvelope(content: string, targetFields: readonly S0TextFieldName[]): ParsedS0SuggestionEnvelope | S0SuggestionParseFailure {
  const bitmap = emptyBitmap();
  const envelope = parseStrictJsonObject(content, 128_000);
  if (!envelope.ok) return failure(bitmap, "JSON_ENVELOPE", "s0_json_envelope_invalid");
  const value = envelope.value;
  bitmap.JSON_ENVELOPE = "PASS";
  if (!S0_DRAFT_COMPLETION_CLASSES.includes(value.status as S0DraftCompletionClass)) return failure(bitmap, "TOP_STATUS", "s0_top_status_invalid");
  bitmap.TOP_STATUS = "PASS";
  if (!exactKeys(value, ["status", "suggestions"]) || !record(value.suggestions)) return failure(bitmap, "DRAFT_OR_SUGGESTIONS", "s0_suggestions_shape_invalid");
  bitmap.DRAFT_OR_SUGGESTIONS = "PASS";
  const target = new Set(targetFields);
  const suggestions: ParsedS0SuggestionEnvelope["suggestions"] = {};
  for (const [name, rawSuggestion] of Object.entries(value.suggestions)) {
    if (!target.has(name as S0TextFieldName) || !S0_TEXT_FIELD_NAMES.includes(name as S0TextFieldName)) return failure(bitmap, "FIELD_NAME", "s0_suggestion_field_invalid");
    if (!record(rawSuggestion) || !exactKeys(rawSuggestion, ["value", "status"])) return failure(bitmap, "FIELD_VALUE", "s0_suggestion_value_invalid");
    const field = name as S0TextFieldName;
    const text = clean(rawSuggestion.value, S0_FIELD_LIMITS[field]);
    if (!text) return failure(bitmap, "FIELD_VALUE", "s0_suggestion_value_invalid");
    if (rawSuggestion.status !== "AI_PROPOSED") return failure(bitmap, "FIELD_STATUS", "s0_suggestion_status_invalid");
    suggestions[field] = { value: text, status: "AI_PROPOSED" };
  }
  bitmap.FIELD_NAME = "PASS";
  bitmap.FIELD_VALUE = "PASS";
  bitmap.FIELD_STATUS = "PASS";
  return { ok: true, status: value.status as S0DraftCompletionClass, suggestions, bitmap };
}

export function mergeS0Suggestions(input: {
  intake: S0Intake;
  fieldStatus: Record<S0FieldName, S0FieldStatus>;
  targetFields: readonly S0TextFieldName[];
  parsed: ParsedS0SuggestionEnvelope;
}) {
  const target = new Set(input.targetFields);
  const draft = {} as Record<S0FieldName, S0DraftField>;
  let appliedCount = 0;
  let pendingCount = 0;
  for (const field of S0_FIELD_NAMES) {
    const suggestion = S0_TEXT_FIELD_NAMES.includes(field as S0TextFieldName) ? input.parsed.suggestions[field as S0TextFieldName] : undefined;
    if (suggestion) {
      draft[field] = suggestion;
      appliedCount += 1;
    } else if (target.has(field as S0TextFieldName)) {
      draft[field] = { value: input.intake[field], status: "RESEARCHER_INPUT_REQUIRED" };
      pendingCount += 1;
    } else {
      draft[field] = { value: input.intake[field], status: input.fieldStatus[field] };
      if (!input.intake[field]) { draft[field].status = "RESEARCHER_INPUT_REQUIRED"; pendingCount += 1; }
    }
  }
  return {
    completionClass: pendingCount === 0 ? "COMPLETE" as const : "PARTIAL_REVIEW_REQUIRED" as const,
    draft,
    appliedCount,
    pendingCount,
    firstPendingField: S0_FIELD_NAMES.find((field) => draft[field].status === "RESEARCHER_INPUT_REQUIRED") || null,
    parserStages: input.parsed.bitmap,
  };
}

export async function runS0Composer(input: {
  intake: S0Intake;
  fieldStatus: Record<S0FieldName, S0FieldStatus>;
  candidate?: S0CandidateInput;
  invoke: (request: { intake: S0Intake; candidate?: S0CandidateInput; targetFields: readonly S0TextFieldName[] }) => Promise<string>;
}) {
  const targetFields = targetS0Fields(input.intake, input.fieldStatus);
  if (targetFields.length === 0) {
    const parsed: ParsedS0SuggestionEnvelope = { ok: true, status: "COMPLETE", suggestions: {}, bitmap: Object.fromEntries(S0_PARSER_STAGES.map((stage) => [stage, "PASS"])) as S0ParserBitmap };
    return { ok: true as const, upstreamCount: 0, ...mergeS0Suggestions({ intake: input.intake, fieldStatus: input.fieldStatus, targetFields, parsed }) };
  }
  const content = await input.invoke({ intake: input.intake, candidate: input.candidate, targetFields });
  const parsed = parseS0SuggestionEnvelope(content, targetFields);
  if (!parsed.ok) return { ...parsed, upstreamCount: 1 };
  return { ok: true as const, upstreamCount: 1, ...mergeS0Suggestions({ intake: input.intake, fieldStatus: input.fieldStatus, targetFields, parsed }) };
}
