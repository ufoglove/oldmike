import { normalizeS0Intake, type S0Intake } from "./project-contract.ts";
import { canonicalDomains, outputTrackIds, type CanonicalDomain, type OutputTrackId } from "./research-config.ts";
import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import { hasExactKeys, parseStrictJsonObject, type StrictJsonEnvelopeStage } from "./strict-json-envelope.ts";
import { RESEARCH_DIRECTION_MAX_LENGTH, RESEARCH_PLAN_LANES, type ResearchPlanLane, type ResearchStartAdvanced } from "./research-start-contract.ts";
import { RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS, RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES, RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS } from "./topic-lab-runtime-contract.ts";

export const RESEARCH_START_TWO_STAGE_CONTRACT_VERSION = "research-start-two-stage/1.0.0" as const;
export type { ResearchStartAdvanced } from "./research-start-contract.ts";
export { RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS, RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES, RESEARCH_START_STAGE_PROVIDER_TIMEOUT_MS };

export type ResearchStartStageARequest = {
  contractVersion: typeof RESEARCH_START_TWO_STAGE_CONTRACT_VERSION;
  operation: "GENERATE_DIRECTIONS";
  rootIntentId: string;
  idempotencyKey: string;
  researchDirection: string;
  advanced: ResearchStartAdvanced;
  sourceStrategy: "NONE";
};

export type ResearchDirectionCardModel = {
  lane: ResearchPlanLane;
  workingTitle: string;
  researchQuestion: string;
  researchValue: string;
  mechanismTheory: string;
  targetContext: string;
  methodSketch: string;
  feasibilityRisk: string;
  domain: CanonicalDomain;
  outputTrack: OutputTrackId;
  unknowns: string[];
  nextAction: string;
};

export type ResearchDirectionCard = ResearchDirectionCardModel & {
  cardId: string;
  cardHash: string;
};

export type ResearchDirectionSet = {
  contractVersion: typeof RESEARCH_START_TWO_STAGE_CONTRACT_VERSION;
  rootIntentHash: string;
  researchDirectionProvenance: { value: string; status: "USER_PROVIDED" };
  recommendedCardId: string;
  recommendationRationale: string;
  cards: ResearchDirectionCard[];
};

export type ResearchStartStageBRequest = {
  contractVersion: typeof RESEARCH_START_TWO_STAGE_CONTRACT_VERSION;
  operation: "EXPAND_SELECTED_S0";
  rootIntentId: string;
  rootIntentHash: string;
  idempotencyKey: string;
  researchDirection: string;
  advanced: ResearchStartAdvanced;
  sourceStrategy: "NONE";
  selectedCard: ResearchDirectionCard;
};

export type ResearchStageParse =
  | { ok: true; value: unknown }
  | { ok: false; code: string; stage: StrictJsonEnvelopeStage | "TOP_LEVEL_SHAPE" | "CARD_SHAPE" | "FIELD_VALUE" | "DISTINCTNESS" | "S0_SHAPE" | "BINDING"; recoverableFields: string[] };

export class ResearchStartTwoStageContractError extends Error {
  readonly code: string;
  readonly status: number;
  readonly recoverableFields: string[];
  constructor(code: string, status = 400, recoverableFields: string[] = []) {
    super(code);
    this.name = "ResearchStartTwoStageContractError";
    this.code = code;
    this.status = status;
    this.recoverableFields = recoverableFields;
  }
}

const STAGE_A_KEYS = ["contractVersion", "operation", "rootIntentId", "idempotencyKey", "researchDirection", "advanced", "sourceStrategy"] as const;
const STAGE_B_KEYS = ["contractVersion", "operation", "rootIntentId", "rootIntentHash", "idempotencyKey", "researchDirection", "advanced", "sourceStrategy", "selectedCard"] as const;
const CARD_MODEL_KEYS = ["lane", "workingTitle", "researchQuestion", "researchValue", "mechanismTheory", "targetContext", "methodSketch", "feasibilityRisk", "domain", "outputTrack", "unknowns", "nextAction"] as const;
const CARD_KEYS = [...CARD_MODEL_KEYS, "cardId", "cardHash"] as const;
const STAGE_B_MODEL_KEYS = ["problemContext", "expectedContribution", "existingData", "availableData", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const PLACEHOLDER = /(?:[<>〈〉]|\b(?:TBD|TODO)\b|待填|研究類型.{0,16}研究.{0,16}對象.{0,16}情境)/iu;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanUserText(value: unknown, maximum: number, required = false) {
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) return null;
  if (required && !value.trim()) return null;
  return value;
}

function cleanModelText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/gu, "\n").replace(/\u0000/gu, "").trim();
  return cleaned && cleaned.length <= maximum ? cleaned : "";
}

function exactOccurrences(source: string, expected: string) {
  const needle = expected.trim();
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function normalizedTokens(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
  const output = new Set<string>(normalized.match(/[a-z0-9]{3,}/gu) || []);
  const chinese = [...normalized].filter((character) => /[\u3400-\u9fff]/u.test(character));
  for (let index = 0; index + 1 < chinese.length; index += 1) output.add(`${chinese[index]}${chinese[index + 1]}`);
  return output;
}

function overlaps(left: string, right: string) {
  const rightTokens = normalizedTokens(right);
  for (const token of normalizedTokens(left)) if (rightTokens.has(token)) return true;
  return false;
}

function similarity(left: string, right: string) {
  const a = normalizedTokens(left);
  const b = normalizedTokens(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
}

function validRootIntentId(value: unknown) {
  return typeof value === "string" && /^research-root:[A-Za-z0-9][A-Za-z0-9._:-]{15,120}$/u.test(value);
}

function validStageKey(value: unknown, rootIntentId: string, stage: "stage-a" | "stage-b") {
  return typeof value === "string" && value.startsWith(`${rootIntentId}:${stage}:`) && /^[A-Za-z0-9][A-Za-z0-9._:-]{31,180}$/u.test(value);
}

function validHash(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function normalizeAdvanced(value: unknown): ResearchStartAdvanced {
  if (!record(value) || !hasExactKeys(value, ["domain", "outputTrack", "population", "context", "method", "data", "timeline", "ethics"])) {
    throw new ResearchStartTwoStageContractError("research_stage_advanced_shape_invalid", 422, ["advanced"]);
  }
  const domain = value.domain === undefined || value.domain === null || value.domain === "" ? null : value.domain;
  const outputTrack = value.outputTrack === undefined || value.outputTrack === null || value.outputTrack === "" ? null : value.outputTrack;
  if (domain !== null && !canonicalDomains.includes(domain as CanonicalDomain)) throw new ResearchStartTwoStageContractError("research_stage_domain_invalid", 422, ["advanced.domain"]);
  if (outputTrack !== null && !outputTrackIds.includes(outputTrack as OutputTrackId)) throw new ResearchStartTwoStageContractError("research_stage_output_track_invalid", 422, ["advanced.outputTrack"]);
  const parsed = Object.fromEntries(["population", "context", "method", "data", "timeline", "ethics"].map((key) => {
    const text = cleanUserText(value[key] ?? "", key === "data" || key === "ethics" ? 1_000 : 500);
    if (text === null) throw new ResearchStartTwoStageContractError("research_stage_advanced_value_invalid", 422, [`advanced.${key}`]);
    return [key, text];
  })) as Pick<ResearchStartAdvanced, "population" | "context" | "method" | "data" | "timeline" | "ethics">;
  return { domain: domain as CanonicalDomain | null, outputTrack: outputTrack as OutputTrackId | null, ...parsed };
}

export function researchStartRootIntentHash(value: Pick<ResearchStartStageARequest, "rootIntentId" | "researchDirection" | "advanced" | "sourceStrategy">) {
  return sha256Canonical({ contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION, rootIntentId: value.rootIntentId, researchDirection: value.researchDirection, advanced: value.advanced, sourceStrategy: value.sourceStrategy });
}

export function researchStartStageRequestHash(value: ResearchStartStageARequest | ResearchStartStageBRequest) {
  return sha256Canonical({ ...value, idempotencyKey: undefined });
}

export function normalizeResearchStartStageARequest(value: unknown): ResearchStartStageARequest {
  if (!record(value) || !hasExactKeys(value, STAGE_A_KEYS) || value.contractVersion !== RESEARCH_START_TWO_STAGE_CONTRACT_VERSION || value.operation !== "GENERATE_DIRECTIONS" || !validRootIntentId(value.rootIntentId)) {
    throw new ResearchStartTwoStageContractError("research_stage_a_request_shape_invalid");
  }
  const researchDirection = cleanUserText(value.researchDirection, RESEARCH_DIRECTION_MAX_LENGTH, true);
  if (researchDirection === null) throw new ResearchStartTwoStageContractError("research_direction_required", 422, ["researchDirection"]);
  if (!validStageKey(value.idempotencyKey, value.rootIntentId as string, "stage-a")) throw new ResearchStartTwoStageContractError("research_stage_a_idempotency_invalid", 422, ["idempotencyKey"]);
  if (value.sourceStrategy !== "NONE") throw new ResearchStartTwoStageContractError("research_stage_source_strategy_not_enabled", 422, ["sourceStrategy"]);
  return {
    contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION,
    operation: "GENERATE_DIRECTIONS",
    rootIntentId: value.rootIntentId as string,
    idempotencyKey: value.idempotencyKey as string,
    researchDirection,
    advanced: normalizeAdvanced(value.advanced),
    sourceStrategy: "NONE",
  };
}

function cardModelBody(value: ResearchDirectionCardModel) {
  return Object.fromEntries(CARD_MODEL_KEYS.map((key) => [key, value[key]])) as ResearchDirectionCardModel;
}

function expectedCardId(rootIntentHash: string, lane: ResearchPlanLane) {
  return `direction_${lane.toLowerCase()}_${sha256Canonical({ rootIntentHash, lane }).slice(0, 16)}`;
}

function expectedCardHash(rootIntentHash: string, card: ResearchDirectionCardModel) {
  return sha256Canonical({ contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION, rootIntentHash, card: cardModelBody(card) });
}

function parseCardModel(value: unknown, lane: ResearchPlanLane, index: number, request: ResearchStartStageARequest): ResearchDirectionCardModel | null {
  if (!record(value) || !hasExactKeys(value, CARD_MODEL_KEYS) || value.lane !== lane) return null;
  const textFields = ["workingTitle", "researchQuestion", "researchValue", "mechanismTheory", "targetContext", "methodSketch", "feasibilityRisk", "nextAction"] as const;
  const text = Object.fromEntries(textFields.map((key) => [key, cleanModelText(value[key], key === "workingTitle" ? 300 : 1_500)])) as Record<(typeof textFields)[number], string>;
  if (textFields.some((key) => !text[key]) || PLACEHOLDER.test(Object.values(text).join(" "))) return null;
  if (text.workingTitle.length < 12 || !overlaps(text.workingTitle, `${text.researchQuestion} ${text.targetContext} ${text.mechanismTheory}`) || !overlaps(request.researchDirection, `${text.workingTitle} ${text.researchQuestion} ${text.targetContext}`)) return null;
  if (!canonicalDomains.includes(value.domain as CanonicalDomain) || !outputTrackIds.includes(value.outputTrack as OutputTrackId)) return null;
  if (request.advanced.domain && value.domain !== request.advanced.domain) return null;
  if (request.advanced.outputTrack && value.outputTrack !== request.advanced.outputTrack) return null;
  if (request.advanced.population && !text.targetContext.includes(request.advanced.population)) return null;
  if (request.advanced.context && !text.targetContext.includes(request.advanced.context)) return null;
  if (request.advanced.method && !text.methodSketch.includes(request.advanced.method)) return null;
  if (!Array.isArray(value.unknowns) || value.unknowns.length < 1 || value.unknowns.length > 2) return null;
  const unknowns = value.unknowns.map((item) => cleanModelText(item, 500));
  if (unknowns.some((item) => !item)) return null;
  return { lane, ...text, domain: value.domain as CanonicalDomain, outputTrack: value.outputTrack as OutputTrackId, unknowns, nextAction: text.nextAction };
}

export function parseResearchDirectionEnvelope(content: string, request: ResearchStartStageARequest):
  | { ok: true; value: ResearchDirectionSet }
  | { ok: false; code: string; stage: StrictJsonEnvelopeStage | "TOP_LEVEL_SHAPE" | "CARD_SHAPE" | "FIELD_VALUE" | "DISTINCTNESS"; recoverableFields: string[] } {
  const envelope = parseStrictJsonObject(content, RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES);
  if (!envelope.ok) return { ok: false, code: "research_stage_a_json_invalid", stage: envelope.stage, recoverableFields: [] };
  const value = envelope.value;
  if (!hasExactKeys(value, ["recommendedLane", "recommendationRationale", "cards"]) || !RESEARCH_PLAN_LANES.includes(value.recommendedLane as ResearchPlanLane) || !Array.isArray(value.cards) || value.cards.length !== 3) {
    return { ok: false, code: "research_stage_a_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["cards"] };
  }
  const rationale = cleanModelText(value.recommendationRationale, 1_000);
  if (!rationale) return { ok: false, code: "research_stage_a_recommendation_invalid", stage: "FIELD_VALUE", recoverableFields: ["recommendationRationale"] };
  const models: ResearchDirectionCardModel[] = [];
  for (let index = 0; index < RESEARCH_PLAN_LANES.length; index += 1) {
    const parsed = parseCardModel(value.cards[index], RESEARCH_PLAN_LANES[index], index, request);
    if (!parsed) return { ok: false, code: "research_stage_a_card_invalid", stage: "CARD_SHAPE", recoverableFields: [`cards.${index}`] };
    models.push(parsed);
  }
  for (let left = 0; left < models.length; left += 1) {
    for (let right = left + 1; right < models.length; right += 1) {
      const leftBody = `${models[left].researchQuestion} ${models[left].mechanismTheory} ${models[left].methodSketch} ${models[left].researchValue}`;
      const rightBody = `${models[right].researchQuestion} ${models[right].mechanismTheory} ${models[right].methodSketch} ${models[right].researchValue}`;
      if (models[left].workingTitle === models[right].workingTitle || similarity(leftBody, rightBody) >= 0.78) {
        return { ok: false, code: "research_stage_a_cards_not_distinct", stage: "DISTINCTNESS", recoverableFields: [`cards.${left}`, `cards.${right}`] };
      }
    }
  }
  const rootIntentHash = researchStartRootIntentHash(request);
  const cards = models.map((card) => ({ ...card, cardId: expectedCardId(rootIntentHash, card.lane), cardHash: expectedCardHash(rootIntentHash, card) }));
  const recommendedCardId = cards.find((card) => card.lane === value.recommendedLane)?.cardId;
  if (!recommendedCardId) return { ok: false, code: "research_stage_a_recommendation_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["recommendedLane"] };
  return { ok: true, value: {
    contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION,
    rootIntentHash,
    researchDirectionProvenance: { value: request.researchDirection, status: "USER_PROVIDED" },
    recommendedCardId,
    recommendationRationale: rationale,
    cards,
  } };
}

function normalizeSelectedCard(value: unknown, rootIntentHash: string, bindingRequest: ResearchStartStageARequest): ResearchDirectionCard {
  if (!record(value) || !hasExactKeys(value, CARD_KEYS) || !RESEARCH_PLAN_LANES.includes(value.lane as ResearchPlanLane)) throw new ResearchStartTwoStageContractError("research_stage_b_card_shape_invalid", 422, ["selectedCard"]);
  const rawModel = Object.fromEntries(CARD_MODEL_KEYS.map((key) => [key, value[key]]));
  const model = parseCardModel(rawModel, value.lane as ResearchPlanLane, RESEARCH_PLAN_LANES.indexOf(value.lane as ResearchPlanLane), bindingRequest);
  if (!model || value.cardId !== expectedCardId(rootIntentHash, model.lane) || value.cardHash !== expectedCardHash(rootIntentHash, model)) throw new ResearchStartTwoStageContractError("research_stage_b_card_binding_invalid", 409, ["selectedCard"]);
  return { ...model, cardId: value.cardId as string, cardHash: value.cardHash as string };
}

export function normalizeResearchStartStageBRequest(value: unknown): ResearchStartStageBRequest {
  if (!record(value) || !hasExactKeys(value, STAGE_B_KEYS) || value.contractVersion !== RESEARCH_START_TWO_STAGE_CONTRACT_VERSION || value.operation !== "EXPAND_SELECTED_S0" || !validRootIntentId(value.rootIntentId) || !validHash(value.rootIntentHash)) {
    throw new ResearchStartTwoStageContractError("research_stage_b_request_shape_invalid");
  }
  const researchDirection = cleanUserText(value.researchDirection, RESEARCH_DIRECTION_MAX_LENGTH, true);
  if (researchDirection === null) throw new ResearchStartTwoStageContractError("research_direction_required", 422, ["researchDirection"]);
  if (!validStageKey(value.idempotencyKey, value.rootIntentId as string, "stage-b")) throw new ResearchStartTwoStageContractError("research_stage_b_idempotency_invalid", 422, ["idempotencyKey"]);
  if (value.sourceStrategy !== "NONE") throw new ResearchStartTwoStageContractError("research_stage_source_strategy_not_enabled", 422, ["sourceStrategy"]);
  const advanced = normalizeAdvanced(value.advanced);
  const expectedRoot = researchStartRootIntentHash({ rootIntentId: value.rootIntentId as string, researchDirection, advanced, sourceStrategy: "NONE" });
  if (value.rootIntentHash !== expectedRoot) throw new ResearchStartTwoStageContractError("research_stage_b_root_binding_invalid", 409, ["rootIntentHash"]);
  const selectedCard = normalizeSelectedCard(value.selectedCard, expectedRoot, {
    contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION,
    operation: "GENERATE_DIRECTIONS",
    rootIntentId: value.rootIntentId as string,
    idempotencyKey: `${value.rootIntentId as string}:stage-a:binding-only`,
    researchDirection,
    advanced,
    sourceStrategy: "NONE",
  });
  if (advanced.domain && selectedCard.domain !== advanced.domain) throw new ResearchStartTwoStageContractError("research_stage_b_card_binding_invalid", 409, ["selectedCard.domain"]);
  if (advanced.outputTrack && selectedCard.outputTrack !== advanced.outputTrack) throw new ResearchStartTwoStageContractError("research_stage_b_card_binding_invalid", 409, ["selectedCard.outputTrack"]);
  return {
    contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION,
    operation: "EXPAND_SELECTED_S0",
    rootIntentId: value.rootIntentId as string,
    rootIntentHash: expectedRoot,
    idempotencyKey: value.idempotencyKey as string,
    researchDirection,
    advanced,
    sourceStrategy: "NONE",
    selectedCard,
  };
}

export function buildResearchStartStageBRequest(value: Omit<ResearchStartStageBRequest, "contractVersion" | "operation" | "sourceStrategy">) {
  return normalizeResearchStartStageBRequest({ ...value, contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION, operation: "EXPAND_SELECTED_S0", sourceStrategy: "NONE" });
}

export function parseResearchS0ExpansionEnvelope(content: string, request: ResearchStartStageBRequest):
  | { ok: true; value: { s0Draft: S0Intake; s0Hash: string } }
  | { ok: false; code: string; stage: StrictJsonEnvelopeStage | "TOP_LEVEL_SHAPE" | "FIELD_VALUE" | "S0_SHAPE" | "BINDING"; recoverableFields: string[] } {
  const envelope = parseStrictJsonObject(content, RESEARCH_START_STAGE_OUTPUT_LIMIT_BYTES);
  if (!envelope.ok) return { ok: false, code: "research_stage_b_json_invalid", stage: envelope.stage, recoverableFields: [] };
  const value = envelope.value;
  if (!hasExactKeys(value, STAGE_B_MODEL_KEYS)) return { ok: false, code: "research_stage_b_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: [...STAGE_B_MODEL_KEYS] };
  const parsed = Object.fromEntries(STAGE_B_MODEL_KEYS.map((key) => [key, cleanModelText(value[key], key === "timeline" ? 500 : key === "availableData" || key === "existingData" || key === "constraints" ? 1_000 : key === "problemContext" || key === "expectedContribution" ? 2_000 : 1_500)])) as Record<(typeof STAGE_B_MODEL_KEYS)[number], string>;
  const missing = STAGE_B_MODEL_KEYS.filter((key) => !parsed[key] || PLACEHOLDER.test(parsed[key]));
  if (missing.length) return { ok: false, code: "research_stage_b_value_invalid", stage: "FIELD_VALUE", recoverableFields: [...missing] };
  const direction = request.researchDirection.trim();
  const bindingFailures: string[] = [];
  if (parsed.problemContext === direction || exactOccurrences(parsed.problemContext, direction) !== 1 || !overlaps(parsed.problemContext, request.selectedCard.researchQuestion)) bindingFailures.push("problemContext");
  if (request.advanced.data && !parsed.availableData.includes(request.advanced.data)) bindingFailures.push("availableData");
  if (request.advanced.timeline && !parsed.timeline.includes(request.advanced.timeline)) bindingFailures.push("timeline");
  if (request.advanced.ethics && !parsed.ethicsPrivacyRisks.includes(request.advanced.ethics)) bindingFailures.push("ethicsPrivacyRisks");
  if (bindingFailures.length) return { ok: false, code: "research_stage_b_binding_invalid", stage: "BINDING", recoverableFields: bindingFailures };
  const merged = normalizeS0Intake({
    workingTitle: request.selectedCard.workingTitle,
    domain: request.selectedCard.domain,
    outputTrack: request.selectedCard.outputTrack,
    problemContext: parsed.problemContext,
    targetUsers: request.selectedCard.targetContext,
    expectedContribution: parsed.expectedContribution,
    existingData: parsed.existingData,
    availableData: parsed.availableData,
    methodIdea: request.selectedCard.methodSketch,
    timeline: parsed.timeline,
    constraints: parsed.constraints,
    ethicsPrivacyRisks: parsed.ethicsPrivacyRisks,
    unresolvedItems: parsed.unresolvedItems,
  });
  if (!merged.ok) return { ok: false, code: "research_stage_b_s0_invalid", stage: "S0_SHAPE", recoverableFields: Object.keys(merged.fieldErrors) };
  return { ok: true, value: { s0Draft: merged.value, s0Hash: sha256Canonical({ rootIntentHash: request.rootIntentHash, cardHash: request.selectedCard.cardHash, s0Draft: merged.value }) } };
}
