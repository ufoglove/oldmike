import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import {
  V2_BETA1_DIRECTION_LANES,
  createV2Beta1AssistOptions,
  validateV2Beta1AssistOptionAgainstParent,
  type V2Beta1AssistOptionAuthority,
  type V2Beta1AssistParentAuthority,
} from "../v2-beta1/shared-authority.ts";
import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "../v2-beta1/canonical-hash.ts";

export const V2_BETA2_CONTRACT_VERSION = "old-mike-v2-beta2/2.0.0-alpha.11" as const;
export const V2_BETA2_STAGE_ID = "DURABLE_CORE_GENERATION" as const;
export const V2_BETA2_SOURCE_STRATEGY = "NONE" as const;
export const V2_BETA2_DURABILITY_CLASS = "DISPOSABLE_POSTGRES_DURABLE_CORE" as const;
export const V2_BETA2_TRUST_CLASS = "LOCAL_FAKE_PROVIDER_AND_DISPOSABLE_POSTGRES_IMPLEMENTATION_ONLY" as const;
export const V2_BETA2_OPERATIONS = Object.freeze(["GENERATE_DURABLE_CORE", "SAVE_DIRECTION_SELECTION", "SAVE_CONFIRMED_WORKSPACE", "RECONCILE_UNKNOWN"] as const);
export const V2_BETA2_OUTPUT_TARGETS = Object.freeze(["SCI", "SSCI", "NSTC", "MOE"] as const);
export const V2_BETA2_MATERIAL_KINDS = Object.freeze(["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "STATISTICS", "TABLE", "FIGURE", "CITATION", "NOTE"] as const);
export const V2_BETA2_CORE_MATERIAL_KINDS = Object.freeze(["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "STATISTICS"] as const);
export const V2_BETA2_REQUEST_MAX_BYTES = 131_072 as const;
export const V2_BETA2_MATERIAL_MAX_COUNT = 12 as const;
export const V2_BETA2_MATERIAL_CONTENT_MAX_BYTES = 24_000 as const;
export const V2_BETA2_MATERIAL_TOTAL_MAX_BYTES = 96_000 as const;

export const beta2CanonicalJson = beta1CanonicalJson;
export const beta2Hash = beta1Hash;

export function createV2Beta2ReceiptHash(input: {
  workspaceId: string;
  projectId: string;
  jobId: string;
  receiptNo: number;
  jobStateVersion: number;
  kind: string;
  completionClass: string;
  submissionCount: 0 | 1;
  providerReferenceCommitment: string | null;
  resultHash: string | null;
  predecessorReceiptHash: string | null;
}) {
  return beta2Hash(input);
}

export function createV2Beta2EventHash(input: {
  workspaceId: string;
  projectId: string;
  sequence: number;
  eventType: string;
  operation: "GENERATE_DURABLE_CORE" | "SAVE_DIRECTION_SELECTION" | "SAVE_CONFIRMED_WORKSPACE" | "RECONCILE_UNKNOWN";
  idempotencyKey: string | null;
  jobId: string | null;
  requestId: string;
  requestHash: string;
  fromRevision: number;
  toRevision: number;
  snapshotRevision: number | null;
  predecessorEventHash: string | null;
}) {
  return beta2Hash(input);
}

type UnknownRecord = Record<string, unknown>;

export type V2Beta2OutputTarget = (typeof V2_BETA2_OUTPUT_TARGETS)[number];
export type V2Beta2MaterialKind = (typeof V2_BETA2_MATERIAL_KINDS)[number];
export type V2Beta2CoreMaterialKind = (typeof V2_BETA2_CORE_MATERIAL_KINDS)[number];
export type V2Beta2DirectionLane = (typeof V2_BETA1_DIRECTION_LANES)[number];

export type V2Beta2Material = {
  materialId: string;
  kind: V2Beta2MaterialKind;
  title: string;
  content: string;
  contentByteLength: number;
  contentHash: string;
};

export type V2Beta2Source = {
  entryMode: "KEYWORD" | "PARTIAL_MATERIAL";
  researchDirection: string;
  outputTarget: V2Beta2OutputTarget;
  sourceStrategy: typeof V2_BETA2_SOURCE_STRATEGY;
  materials: V2Beta2Material[];
  materialCoverage: Record<V2Beta2CoreMaterialKind, "PROVIDED_UNVERIFIED" | "MISSING">;
  sourceHash: string;
};

export type V2Beta2ConfirmedWorkspace = {
  schemaId: "old-mike-v2-beta2/confirmed-workspace/1";
  selectedDirectionId: string;
  s0: Record<S0FieldName, string>;
  appliedAssistOptionIds: Record<S0FieldName, string | null>;
  confirmationHash: string;
};

export type V2Beta2DomainAuthority = {
  domainId: "ai-education";
  label: "AI應用於教育";
  selectionHash: string;
};

export type V2Beta2HumanReadableArtifact = {
  rendererVersion: "old-mike-v2-beta2/human-readable/1";
  markdown: string;
  artifactHash: string;
};

export type V2Beta2Direction = {
  schemaId: "old-mike-v2-beta2/direction/1";
  directionId: string;
  lane: V2Beta2DirectionLane;
  recommended: boolean;
  title: string;
  researchQuestion: string;
  mechanism: string;
  method: string;
  contribution: string;
  s0: Record<S0FieldName, string>;
  domain: V2Beta2DomainAuthority;
  outputTarget: V2Beta2OutputTarget;
  inputBundleHash: string;
  directionHash: string;
  fieldAssist: Record<S0FieldName, V2Beta1AssistOptionAuthority[]>;
  humanReadableArtifact: V2Beta2HumanReadableArtifact;
};

export type V2Beta2ProviderResult = {
  schemaId: "old-mike-v2-beta2/provider-result/1";
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  stageInstanceHash: string;
  sourceHash: string;
  providerClass: "LOCAL_DETERMINISTIC_FIXTURE" | "BOUNDED_SERVER_ADAPTER";
  directions: V2Beta2Direction[];
  recommendedDirectionId: string;
  selectedDirectionId: string;
  resultHash: string;
};

export type V2Beta2ProviderSubmitOutcome =
  | { completionClass: "COMPLETE"; receiptCommitment: string; requestHash: string; result: V2Beta2ProviderResult }
  | { completionClass: "COMPLETION_UNKNOWN"; receiptCommitment: string; requestHash: string }
  | { completionClass: "TERMINAL_REJECTED"; receiptCommitment: string; requestHash: string; reasonCode: "FAKE_PROVIDER_REJECTED" | "PROVIDER_TERMINAL_REJECTED" };

export type V2Beta2ProviderLookupOutcome =
  | { status: "NOT_FOUND" | "PENDING" | "REJECTED" | "UNKNOWN"; receiptCommitment: string; requestHash: string }
  | { status: "COMPLETE"; receiptCommitment: string; requestHash: string; result: V2Beta2ProviderResult };

export type V2Beta2DurableSnapshot = {
  schemaId: "old-mike-v2-beta2/durable-snapshot/1";
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  durabilityClass: typeof V2_BETA2_DURABILITY_CLASS;
  projectId: string;
  revision: number;
  source: V2Beta2Source;
  directions: V2Beta2Direction[];
  recommendedDirectionId: string;
  selectedDirectionId: string;
  s0Summary: Record<S0FieldName, string>;
  fieldAssist: Record<S0FieldName, V2Beta1AssistOptionAuthority[]>;
  humanReadableArtifact: V2Beta2HumanReadableArtifact;
  confirmedWorkspace: V2Beta2ConfirmedWorkspace | null;
  stageId: typeof V2_BETA2_STAGE_ID;
  stageInstanceHash: string;
  jobId: string;
  providerSubmissionCount: 1;
  persistenceStatus: "SAVED" | "RECONCILE_REQUIRED";
  formalResearchWriteCount: 0;
  contentHash: string;
};

export type V2Beta2ProjectHead = {
  projectId: string;
  revision: number;
  contentHash: string;
  snapshot: V2Beta2DurableSnapshot | null;
  reconciliation: null | { jobId: string; status: "RECONCILE_REQUIRED" };
  stageOutcome: V2Beta2StageOutcome | null;
};

export type V2Beta2TerminalEventAuthority = {
  eventType: "GENERATION_COMPLETE" | "RECONCILIATION_COMPLETE" | "GENERATION_TERMINAL_FAILURE" | "RECONCILIATION_TERMINAL_FAILURE";
  operation: "GENERATE_DURABLE_CORE" | "RECONCILE_UNKNOWN";
  requestId: string;
  requestHash: string;
};

export type V2Beta2StageOutcome = {
  schemaId: "old-mike-v2-beta2/stage-outcome/1";
  jobId: string;
  stageInstanceHash: string;
  generationRequestId: string;
  generationRequestHash: string;
  status: "COMPLETE" | "RECONCILE_REQUIRED" | "REJECTED";
  completionClass: "COMPLETE" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED";
  providerSubmissionCount: 0 | 1;
  providerReceiptCommitment: string | null;
  providerResultHash: string | null;
  reasonCode: string | null;
  terminalEvent: V2Beta2TerminalEventAuthority | null;
  outcomeHash: string;
};

export type V2Beta2GenerateRequest = {
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  operation: "GENERATE_DURABLE_CORE";
  projectId: string;
  requestId: string;
  idempotencyKey: string;
  baseRevision: number;
  baseContentHash: string;
  source: V2Beta2Source;
};

export type V2Beta2SaveSelectionRequest = {
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  operation: "SAVE_DIRECTION_SELECTION";
  projectId: string;
  requestId: string;
  idempotencyKey: string;
  baseRevision: number;
  baseContentHash: string;
  selectedDirectionId: string;
};

export type V2Beta2SaveConfirmedWorkspaceRequest = {
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  operation: "SAVE_CONFIRMED_WORKSPACE";
  projectId: string;
  requestId: string;
  idempotencyKey: string;
  baseRevision: number;
  baseContentHash: string;
  selectedDirectionId: string;
  s0Summary: Record<S0FieldName, string>;
  appliedAssistOptionIds: Record<S0FieldName, string | null>;
};

export type V2Beta2ReconcileRequest = {
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  operation: "RECONCILE_UNKNOWN";
  projectId: string;
  requestId: string;
  jobId: string;
};

export type V2Beta2MutationRequest = V2Beta2GenerateRequest | V2Beta2SaveSelectionRequest | V2Beta2SaveConfirmedWorkspaceRequest | V2Beta2ReconcileRequest;

export type V2Beta2RequestAuthority = {
  schemaId: "old-mike-v2-beta2/response-request-authority/1";
  projectId: string;
  operation: V2Beta2MutationRequest["operation"];
  requestId: string;
  transportRequestHash: string;
  authorityHash: string;
};

export type V2Beta2ResponseExpectation = {
  projectId: string;
  request: V2Beta2MutationRequest | null;
};

export type V2Beta2SuccessEnvelope = {
  ok: true;
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  trustClass: typeof V2_BETA2_TRUST_CLASS;
  durabilityClass: typeof V2_BETA2_DURABILITY_CLASS;
  operation: "RESUME" | V2Beta2MutationRequest["operation"];
  requestAuthority: V2Beta2RequestAuthority | null;
  project: V2Beta2ProjectHead;
  replayed: boolean;
  providerSubmissionDelta: 0 | 1;
  snapshotAppendDelta: 0 | 1;
  eventAppendDelta: 0 | 1;
  formalResearchWriteCount: 0;
  liveProviderCallCount: 0;
};

export type V2Beta2TerminalFailureEnvelope = {
  ok: false;
  code: "beta2_provider_terminal_rejected";
  contractVersion: typeof V2_BETA2_CONTRACT_VERSION;
  trustClass: typeof V2_BETA2_TRUST_CLASS;
  durabilityClass: typeof V2_BETA2_DURABILITY_CLASS;
  operation: "GENERATE_DURABLE_CORE" | "RECONCILE_UNKNOWN";
  requestAuthority: V2Beta2RequestAuthority;
  project: V2Beta2ProjectHead;
  replayed: boolean;
  providerSubmissionDelta: 0 | 1;
  snapshotAppendDelta: 0;
  eventAppendDelta: 0 | 1;
  formalResearchWriteCount: 0;
  liveProviderCallCount: 0;
};

export type V2Beta2ResponseEnvelope = V2Beta2SuccessEnvelope | V2Beta2TerminalFailureEnvelope;

const MATERIAL_KEYS = Object.freeze(["materialId", "kind", "title", "content", "contentByteLength", "contentHash"] as const);
const SOURCE_KEYS = Object.freeze(["entryMode", "researchDirection", "outputTarget", "sourceStrategy", "materials", "materialCoverage", "sourceHash"] as const);
const CONFIRMED_WORKSPACE_KEYS = Object.freeze(["schemaId", "selectedDirectionId", "s0", "appliedAssistOptionIds", "confirmationHash"] as const);
const DOMAIN_KEYS = Object.freeze(["domainId", "label", "selectionHash"] as const);
const HUMAN_KEYS = Object.freeze(["rendererVersion", "markdown", "artifactHash"] as const);
const DIRECTION_KEYS = Object.freeze(["schemaId", "directionId", "lane", "recommended", "title", "researchQuestion", "mechanism", "method", "contribution", "s0", "domain", "outputTarget", "inputBundleHash", "directionHash", "fieldAssist", "humanReadableArtifact"] as const);
const PROVIDER_RESULT_KEYS = Object.freeze(["schemaId", "contractVersion", "stageInstanceHash", "sourceHash", "providerClass", "directions", "recommendedDirectionId", "selectedDirectionId", "resultHash"] as const);
const SNAPSHOT_KEYS = Object.freeze(["schemaId", "contractVersion", "durabilityClass", "projectId", "revision", "source", "directions", "recommendedDirectionId", "selectedDirectionId", "s0Summary", "fieldAssist", "humanReadableArtifact", "confirmedWorkspace", "stageId", "stageInstanceHash", "jobId", "providerSubmissionCount", "persistenceStatus", "formalResearchWriteCount", "contentHash"] as const);
const PROVIDER_SUBMIT_BASE_KEYS = Object.freeze(["completionClass", "receiptCommitment", "requestHash"] as const);
const PROVIDER_LOOKUP_BASE_KEYS = Object.freeze(["status", "receiptCommitment", "requestHash"] as const);
const TERMINAL_EVENT_KEYS = Object.freeze(["eventType", "operation", "requestId", "requestHash"] as const);
const STAGE_OUTCOME_KEYS = Object.freeze(["schemaId", "jobId", "stageInstanceHash", "generationRequestId", "generationRequestHash", "status", "completionClass", "providerSubmissionCount", "providerReceiptCommitment", "providerResultHash", "reasonCode", "terminalEvent", "outcomeHash"] as const);
const PROJECT_HEAD_KEYS = Object.freeze(["projectId", "revision", "contentHash", "snapshot", "reconciliation", "stageOutcome"] as const);
const REQUEST_AUTHORITY_KEYS = Object.freeze(["schemaId", "projectId", "operation", "requestId", "transportRequestHash", "authorityHash"] as const);

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exact(value: unknown, keys: readonly string[], code: string): UnknownRecord {
  const input = record(value, code);
  const actual = Object.keys(input);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) throw new Error(code);
  return input;
}

function text(value: unknown, minimum: number, maximum: number, code: string) {
  if (typeof value !== "string" || value !== value.trim()) throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n");
  if (normalized.length < minimum || normalized.length > maximum || /[\u0000\u007f]/u.test(normalized)) throw new Error(code);
  return normalized;
}

function materialContent(value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 12_000 || value.trim().length === 0 || /\u0000/u.test(value)) throw new Error("beta2_material_content_invalid");
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("beta2_material_content_invalid");
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error("beta2_material_content_invalid");
    }
  }
  const contentByteLength = new TextEncoder().encode(value).byteLength;
  if (contentByteLength > V2_BETA2_MATERIAL_CONTENT_MAX_BYTES) throw new Error("beta2_material_content_invalid");
  return { content: value, contentByteLength };
}

function hash(value: unknown, code: string) {
  if (!isBeta1Hash(value)) throw new Error(code);
  return value;
}

function reasonCode(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{2,79}$/u.test(value)) throw new Error(code);
  return value;
}

function safeInteger(value: unknown, minimum: number, maximum: number, code: string) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(code);
  return value as number;
}

function canonicalEqual(left: unknown, right: unknown) {
  return beta2CanonicalJson(left) === beta2CanonicalJson(right);
}

export function parseV2Beta2ProjectId(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(value)) throw new Error("beta2_project_id_invalid");
  return value;
}

export function parseV2Beta2RequestId(value: unknown): string {
  return text(value, 16, 128, "beta2_request_id_invalid").match(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u)?.[0] ?? (() => { throw new Error("beta2_request_id_invalid"); })();
}

export function parseV2Beta2IdempotencyKey(value: unknown): string {
  return text(value, 16, 128, "beta2_idempotency_key_invalid").match(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u)?.[0] ?? (() => { throw new Error("beta2_idempotency_key_invalid"); })();
}

export function createV2Beta2DomainAuthority(): V2Beta2DomainAuthority {
  const core = { domainId: "ai-education" as const, label: "AI應用於教育" as const };
  return { ...core, selectionHash: beta2Hash(core) };
}

export function parseV2Beta2DomainAuthority(value: unknown): V2Beta2DomainAuthority {
  const input = exact(value, DOMAIN_KEYS, "beta2_domain_invalid");
  const expected = createV2Beta2DomainAuthority();
  if (!canonicalEqual(input, expected)) throw new Error("beta2_domain_invalid");
  return expected;
}

export function createV2Beta2Material(input: Omit<V2Beta2Material, "contentByteLength" | "contentHash">): V2Beta2Material {
  const raw = materialContent(input.content);
  const core = {
    materialId: text(input.materialId, 8, 120, "beta2_material_id_invalid"),
    kind: V2_BETA2_MATERIAL_KINDS.includes(input.kind) ? input.kind : (() => { throw new Error("beta2_material_kind_invalid"); })(),
    title: text(input.title, 1, 160, "beta2_material_title_invalid"),
    content: raw.content,
    contentByteLength: raw.contentByteLength,
  };
  return { ...core, contentHash: beta2Hash(core.content) };
}

export function parseV2Beta2Material(value: unknown): V2Beta2Material {
  const input = exact(value, MATERIAL_KEYS, "beta2_material_invalid");
  const expected = createV2Beta2Material({ materialId: input.materialId as string, kind: input.kind as V2Beta2MaterialKind, title: input.title as string, content: input.content as string });
  if (!canonicalEqual(input, expected)) throw new Error("beta2_material_invalid");
  return expected;
}

export function createV2Beta2Source(input: Omit<V2Beta2Source, "sourceStrategy" | "materialCoverage" | "sourceHash">): V2Beta2Source {
  const entryMode = input.entryMode === "KEYWORD" || input.entryMode === "PARTIAL_MATERIAL" ? input.entryMode : (() => { throw new Error("beta2_entry_mode_invalid"); })();
  const researchDirection = text(input.researchDirection, 2, 1_600, "beta2_research_direction_invalid");
  const outputTarget = V2_BETA2_OUTPUT_TARGETS.includes(input.outputTarget) ? input.outputTarget : (() => { throw new Error("beta2_output_target_invalid"); })();
  if (!Array.isArray(input.materials) || input.materials.length > V2_BETA2_MATERIAL_MAX_COUNT) throw new Error("beta2_materials_invalid");
  const materials = input.materials.map(parseV2Beta2Material);
  if ((entryMode === "KEYWORD" && materials.length !== 0) || (entryMode === "PARTIAL_MATERIAL" && materials.length < 1)) throw new Error("beta2_materials_invalid");
  if (new Set(materials.map((item) => item.materialId)).size !== materials.length) throw new Error("beta2_materials_invalid");
  const materialBytes = materials.reduce((sum, item) => sum + new TextEncoder().encode(item.content).byteLength, 0);
  if (materialBytes > V2_BETA2_MATERIAL_TOTAL_MAX_BYTES) throw new Error("beta2_materials_invalid");
  const materialCoverage = Object.fromEntries(V2_BETA2_CORE_MATERIAL_KINDS.map((kind) => [
    kind,
    materials.some((material) => material.kind === kind) ? "PROVIDED_UNVERIFIED" : "MISSING",
  ])) as V2Beta2Source["materialCoverage"];
  const core = { entryMode, researchDirection, outputTarget, sourceStrategy: V2_BETA2_SOURCE_STRATEGY, materials, materialCoverage };
  return { ...core, sourceHash: beta2Hash(core) };
}

export function parseV2Beta2Source(value: unknown): V2Beta2Source {
  const input = exact(value, SOURCE_KEYS, "beta2_source_invalid");
  if (input.sourceStrategy !== V2_BETA2_SOURCE_STRATEGY) throw new Error("beta2_source_strategy_invalid");
  const expected = createV2Beta2Source({ entryMode: input.entryMode as V2Beta2Source["entryMode"], researchDirection: input.researchDirection as string, outputTarget: input.outputTarget as V2Beta2OutputTarget, materials: input.materials as V2Beta2Material[] });
  if (!canonicalEqual(input, expected)) throw new Error("beta2_source_invalid");
  return expected;
}

export function createV2Beta2InitialHead(projectId: string): V2Beta2ProjectHead {
  const canonicalProjectId = parseV2Beta2ProjectId(projectId);
  return {
    projectId: canonicalProjectId,
    revision: 0,
    contentHash: beta2Hash({ contractVersion: V2_BETA2_CONTRACT_VERSION, projectId: canonicalProjectId, revision: 0 }),
    snapshot: null,
    reconciliation: null,
    stageOutcome: null,
  };
}

function parseS0(value: unknown): Record<S0FieldName, string> {
  const input = exact(value, S0_FIELD_NAMES, "beta2_s0_invalid");
  return Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, text(input[field], 1, S0_FIELD_LIMITS[field], "beta2_s0_invalid")])) as Record<S0FieldName, string>;
}

function parseAppliedAssistOptionIds(value: unknown): Record<S0FieldName, string | null> {
  const input = exact(value, S0_FIELD_NAMES, "beta2_applied_assist_invalid");
  return Object.fromEntries(S0_FIELD_NAMES.map((field) => {
    const optionId = input[field];
    if (optionId !== null && (typeof optionId !== "string" || optionId.length < 8 || optionId.length > 160 || optionId !== optionId.trim())) throw new Error("beta2_applied_assist_invalid");
    return [field, optionId];
  })) as Record<S0FieldName, string | null>;
}

export function createV2Beta2ConfirmedWorkspace(input: {
  selectedDirectionId: string;
  s0: Record<S0FieldName, string>;
  appliedAssistOptionIds: Record<S0FieldName, string | null>;
}, directionValue: unknown): V2Beta2ConfirmedWorkspace {
  const direction = parseV2Beta2Direction(directionValue);
  const selectedDirectionId = text(input.selectedDirectionId, 8, 120, "beta2_direction_id_invalid");
  if (selectedDirectionId !== direction.directionId) throw new Error("beta2_confirmed_workspace_invalid");
  const s0 = parseS0(input.s0);
  const appliedAssistOptionIds = parseAppliedAssistOptionIds(input.appliedAssistOptionIds);
  for (const field of S0_FIELD_NAMES) {
    const optionId = appliedAssistOptionIds[field];
    const expectedValue = optionId === null
      ? direction.s0[field]
      : direction.fieldAssist[field].find((option) => option.optionId === optionId)?.applyValue;
    if (expectedValue === undefined || s0[field] !== expectedValue) throw new Error("beta2_confirmed_workspace_invalid");
  }
  const core = {
    schemaId: "old-mike-v2-beta2/confirmed-workspace/1" as const,
    selectedDirectionId,
    s0,
    appliedAssistOptionIds,
  };
  return { ...core, confirmationHash: beta2Hash(core) };
}

export function parseV2Beta2ConfirmedWorkspace(value: unknown, directionValue: unknown): V2Beta2ConfirmedWorkspace {
  const input = exact(value, CONFIRMED_WORKSPACE_KEYS, "beta2_confirmed_workspace_invalid");
  if (input.schemaId !== "old-mike-v2-beta2/confirmed-workspace/1") throw new Error("beta2_confirmed_workspace_invalid");
  const expected = createV2Beta2ConfirmedWorkspace({
    selectedDirectionId: input.selectedDirectionId as string,
    s0: input.s0 as Record<S0FieldName, string>,
    appliedAssistOptionIds: input.appliedAssistOptionIds as Record<S0FieldName, string | null>,
  }, directionValue);
  if (!canonicalEqual(input, expected)) throw new Error("beta2_confirmed_workspace_invalid");
  return expected;
}

export function v2Beta2DirectionCore(direction: Omit<V2Beta2Direction, "directionHash" | "fieldAssist" | "humanReadableArtifact">) {
  return {
    schemaId: direction.schemaId,
    directionId: direction.directionId,
    lane: direction.lane,
    recommended: direction.recommended,
    title: direction.title,
    researchQuestion: direction.researchQuestion,
    mechanism: direction.mechanism,
    method: direction.method,
    contribution: direction.contribution,
    s0: direction.s0,
    domain: direction.domain,
    outputTarget: direction.outputTarget,
    inputBundleHash: direction.inputBundleHash,
  };
}

export function createV2Beta2FieldAssist(direction: Omit<V2Beta2Direction, "fieldAssist" | "humanReadableArtifact">) {
  const parent: V2Beta1AssistParentAuthority = {
    direction: {
      lane: direction.lane,
      directionHash: direction.directionHash,
      inputBundleHash: direction.inputBundleHash,
      title: direction.title,
      researchQuestion: direction.researchQuestion,
      mechanism: direction.mechanism,
      contribution: direction.contribution,
      method: direction.method,
      s0: direction.s0,
    },
    domain: direction.domain,
    outputTarget: direction.outputTarget,
  };
  const result: Partial<Record<S0FieldName, V2Beta1AssistOptionAuthority[]>> = {};
  for (const field of S0_FIELD_NAMES) result[field] = createV2Beta1AssistOptions(parent, field);
  return result as Record<S0FieldName, V2Beta1AssistOptionAuthority[]>;
}

export function renderV2Beta2HumanReadableArtifact(direction: Pick<V2Beta2Direction, "title" | "researchQuestion" | "mechanism" | "method" | "contribution" | "s0" | "fieldAssist">): V2Beta2HumanReadableArtifact {
  const lines = [
    `# ${direction.title}`,
    "",
    `研究問題：${direction.researchQuestion}`,
    `作用機制：${direction.mechanism}`,
    `方法：${direction.method}`,
    `預期貢獻：${direction.contribution}`,
    "",
    "## 完整 13 欄 S0",
    ...S0_FIELD_NAMES.flatMap((field) => [`### ${field}`, direction.s0[field], ""]),
    "## Field Assist",
    ...S0_FIELD_NAMES.flatMap((field) => [
      `### ${field}`,
      ...direction.fieldAssist[field].flatMap((option) => [`- ${option.text}`, `  - 理由：${option.rationale}`, `  - 風險：${option.risk}`]),
      "",
    ]),
  ];
  const markdown = lines.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd() + "\n";
  const rendererVersion = "old-mike-v2-beta2/human-readable/1" as const;
  return { rendererVersion, markdown, artifactHash: beta2Hash({ rendererVersion, markdown }) };
}

export function createV2Beta2Direction(input: Omit<V2Beta2Direction, "schemaId" | "directionHash" | "fieldAssist" | "humanReadableArtifact">): V2Beta2Direction {
  const coreWithoutHash = {
    schemaId: "old-mike-v2-beta2/direction/1" as const,
    directionId: text(input.directionId, 8, 120, "beta2_direction_id_invalid"),
    lane: V2_BETA1_DIRECTION_LANES.includes(input.lane) ? input.lane : (() => { throw new Error("beta2_direction_lane_invalid"); })(),
    recommended: input.recommended,
    title: text(input.title, 8, 240, "beta2_direction_title_invalid"),
    researchQuestion: text(input.researchQuestion, 12, 1_200, "beta2_direction_question_invalid"),
    mechanism: text(input.mechanism, 16, 2_000, "beta2_direction_mechanism_invalid"),
    method: text(input.method, 16, 2_000, "beta2_direction_method_invalid"),
    contribution: text(input.contribution, 16, 2_000, "beta2_direction_contribution_invalid"),
    s0: parseS0(input.s0),
    domain: parseV2Beta2DomainAuthority(input.domain),
    outputTarget: V2_BETA2_OUTPUT_TARGETS.includes(input.outputTarget) ? input.outputTarget : (() => { throw new Error("beta2_output_target_invalid"); })(),
    inputBundleHash: hash(input.inputBundleHash, "beta2_input_bundle_hash_invalid"),
  };
  if (typeof coreWithoutHash.recommended !== "boolean") throw new Error("beta2_direction_recommended_invalid");
  const directionHash = beta2Hash(v2Beta2DirectionCore(coreWithoutHash));
  const withHash = { ...coreWithoutHash, directionHash };
  const fieldAssist = createV2Beta2FieldAssist(withHash);
  const humanReadableArtifact = renderV2Beta2HumanReadableArtifact({ ...withHash, fieldAssist });
  return { ...withHash, fieldAssist, humanReadableArtifact };
}

export function parseV2Beta2Direction(value: unknown): V2Beta2Direction {
  const input = exact(value, DIRECTION_KEYS, "beta2_direction_invalid");
  const expected = createV2Beta2Direction({
    directionId: input.directionId as string,
    lane: input.lane as V2Beta2DirectionLane,
    recommended: input.recommended as boolean,
    title: input.title as string,
    researchQuestion: input.researchQuestion as string,
    mechanism: input.mechanism as string,
    method: input.method as string,
    contribution: input.contribution as string,
    s0: input.s0 as Record<S0FieldName, string>,
    domain: input.domain as V2Beta2DomainAuthority,
    outputTarget: input.outputTarget as V2Beta2OutputTarget,
    inputBundleHash: input.inputBundleHash as string,
  });
  if (!canonicalEqual(input, expected)) throw new Error("beta2_direction_invalid");
  const parent: V2Beta1AssistParentAuthority = { direction: expected, domain: expected.domain, outputTarget: expected.outputTarget };
  if (S0_FIELD_NAMES.some((field) => expected.fieldAssist[field].length !== 3 || expected.fieldAssist[field].some((option) => !validateV2Beta1AssistOptionAgainstParent(option, parent)))) throw new Error("beta2_assist_invalid");
  return expected;
}

function validateDirectionSet(directions: V2Beta2Direction[], recommendedDirectionId: string, selectedDirectionId: string) {
  if (directions.length !== 3 || new Set(directions.map((item) => item.directionId)).size !== 3 || new Set(directions.map((item) => item.directionHash)).size !== 3) throw new Error("beta2_direction_set_invalid");
  if (directions.some((item, index) => item.lane !== V2_BETA1_DIRECTION_LANES[index])) throw new Error("beta2_direction_order_invalid");
  const recommended = directions.filter((item) => item.recommended);
  if (recommended.length !== 1 || recommended[0].lane !== "BALANCED_RECOMMENDED" || recommended[0].directionId !== recommendedDirectionId || selectedDirectionId !== recommendedDirectionId) throw new Error("beta2_recommendation_invalid");
}

export function createV2Beta2ProviderResult(input: Omit<V2Beta2ProviderResult, "schemaId" | "contractVersion" | "providerClass" | "resultHash"> & { providerClass?: V2Beta2ProviderResult["providerClass"] }): V2Beta2ProviderResult {
  const directions = input.directions.map(parseV2Beta2Direction);
  const stageInstanceHash = hash(input.stageInstanceHash, "beta2_stage_instance_hash_invalid");
  const sourceHash = hash(input.sourceHash, "beta2_source_hash_invalid");
  if (directions.some((item) => item.inputBundleHash !== sourceHash)) throw new Error("beta2_direction_source_hash_invalid");
  validateDirectionSet(directions, input.recommendedDirectionId, input.selectedDirectionId);
  const core = {
    schemaId: "old-mike-v2-beta2/provider-result/1" as const,
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    stageInstanceHash,
    sourceHash,
    providerClass: input.providerClass ?? "LOCAL_DETERMINISTIC_FIXTURE",
    directions,
    recommendedDirectionId: input.recommendedDirectionId,
    selectedDirectionId: input.selectedDirectionId,
  };
  return { ...core, resultHash: beta2Hash(core) };
}

export function parseV2Beta2ProviderResult(value: unknown): V2Beta2ProviderResult {
  const input = exact(value, PROVIDER_RESULT_KEYS, "beta2_provider_result_invalid");
  if (input.schemaId !== "old-mike-v2-beta2/provider-result/1" || input.contractVersion !== V2_BETA2_CONTRACT_VERSION || !["LOCAL_DETERMINISTIC_FIXTURE", "BOUNDED_SERVER_ADAPTER"].includes(input.providerClass as string)) throw new Error("beta2_provider_result_invalid");
  const expected = createV2Beta2ProviderResult({ stageInstanceHash: input.stageInstanceHash as string, sourceHash: input.sourceHash as string, providerClass: input.providerClass as V2Beta2ProviderResult["providerClass"], directions: input.directions as V2Beta2Direction[], recommendedDirectionId: input.recommendedDirectionId as string, selectedDirectionId: input.selectedDirectionId as string });
  if (!canonicalEqual(input, expected)) throw new Error("beta2_provider_result_invalid");
  return expected;
}

export function parseV2Beta2ProviderSubmitOutcome(value: unknown): V2Beta2ProviderSubmitOutcome {
  const base = record(value, "beta2_provider_submit_invalid");
  const receiptCommitment = hash(base.receiptCommitment, "beta2_provider_submit_invalid");
  const requestHash = hash(base.requestHash, "beta2_provider_submit_invalid");
  if (base.completionClass === "COMPLETE") {
    const input = exact(base, [...PROVIDER_SUBMIT_BASE_KEYS, "result"], "beta2_provider_submit_invalid");
    try {
      return { completionClass: "COMPLETE", receiptCommitment, requestHash, result: parseV2Beta2ProviderResult(input.result) };
    } catch {
      throw new Error("beta2_provider_submit_invalid");
    }
  }
  if (base.completionClass === "COMPLETION_UNKNOWN") {
    exact(base, PROVIDER_SUBMIT_BASE_KEYS, "beta2_provider_submit_invalid");
    return { completionClass: "COMPLETION_UNKNOWN", receiptCommitment, requestHash };
  }
  if (base.completionClass === "TERMINAL_REJECTED") {
    const input = exact(base, [...PROVIDER_SUBMIT_BASE_KEYS, "reasonCode"], "beta2_provider_submit_invalid");
    if (!["FAKE_PROVIDER_REJECTED", "PROVIDER_TERMINAL_REJECTED"].includes(input.reasonCode as string)) throw new Error("beta2_provider_submit_invalid");
    return { completionClass: "TERMINAL_REJECTED", receiptCommitment, requestHash, reasonCode: input.reasonCode as "FAKE_PROVIDER_REJECTED" | "PROVIDER_TERMINAL_REJECTED" };
  }
  throw new Error("beta2_provider_submit_invalid");
}

export function parseV2Beta2ProviderLookupOutcome(value: unknown): V2Beta2ProviderLookupOutcome {
  const base = record(value, "beta2_provider_lookup_invalid");
  const receiptCommitment = hash(base.receiptCommitment, "beta2_provider_lookup_invalid");
  const requestHash = hash(base.requestHash, "beta2_provider_lookup_invalid");
  if (base.status === "COMPLETE") {
    const input = exact(base, [...PROVIDER_LOOKUP_BASE_KEYS, "result"], "beta2_provider_lookup_invalid");
    try {
      return { status: "COMPLETE", receiptCommitment, requestHash, result: parseV2Beta2ProviderResult(input.result) };
    } catch {
      throw new Error("beta2_provider_lookup_invalid");
    }
  }
  if (["NOT_FOUND", "PENDING", "REJECTED", "UNKNOWN"].includes(base.status as string)) {
    exact(base, PROVIDER_LOOKUP_BASE_KEYS, "beta2_provider_lookup_invalid");
    return { status: base.status as "NOT_FOUND" | "PENDING" | "REJECTED" | "UNKNOWN", receiptCommitment, requestHash };
  }
  throw new Error("beta2_provider_lookup_invalid");
}

export function v2Beta2SnapshotCore(snapshot: Omit<V2Beta2DurableSnapshot, "contentHash">) {
  return { ...snapshot };
}

export function createV2Beta2DurableSnapshot(input: Omit<V2Beta2DurableSnapshot, "schemaId" | "contractVersion" | "durabilityClass" | "s0Summary" | "fieldAssist" | "humanReadableArtifact" | "confirmedWorkspace" | "providerSubmissionCount" | "formalResearchWriteCount" | "contentHash"> & { confirmedWorkspace?: V2Beta2ConfirmedWorkspace | null }): V2Beta2DurableSnapshot {
  const directions = input.directions.map(parseV2Beta2Direction);
  validateDirectionSet(directions, input.recommendedDirectionId, input.recommendedDirectionId);
  const selected = directions.find((item) => item.directionId === input.selectedDirectionId);
  if (!selected) throw new Error("beta2_selected_direction_invalid");
  const confirmedWorkspace = input.confirmedWorkspace == null ? null : parseV2Beta2ConfirmedWorkspace(input.confirmedWorkspace, selected);
  const effectiveS0 = confirmedWorkspace?.s0 ?? selected.s0;
  const humanReadableArtifact = renderV2Beta2HumanReadableArtifact({ ...selected, s0: effectiveS0, fieldAssist: selected.fieldAssist });
  const core = {
    schemaId: "old-mike-v2-beta2/durable-snapshot/1" as const,
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    durabilityClass: V2_BETA2_DURABILITY_CLASS,
    projectId: parseV2Beta2ProjectId(input.projectId),
    revision: safeInteger(input.revision, 1, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid"),
    source: parseV2Beta2Source(input.source),
    directions,
    recommendedDirectionId: input.recommendedDirectionId,
    selectedDirectionId: input.selectedDirectionId,
    s0Summary: effectiveS0,
    fieldAssist: selected.fieldAssist,
    humanReadableArtifact,
    confirmedWorkspace,
    stageId: input.stageId === V2_BETA2_STAGE_ID ? input.stageId : (() => { throw new Error("beta2_stage_invalid"); })(),
    stageInstanceHash: hash(input.stageInstanceHash, "beta2_stage_instance_hash_invalid"),
    jobId: text(input.jobId, 8, 120, "beta2_job_id_invalid"),
    providerSubmissionCount: 1 as const,
    persistenceStatus: input.persistenceStatus === "SAVED" || input.persistenceStatus === "RECONCILE_REQUIRED" ? input.persistenceStatus : (() => { throw new Error("beta2_persistence_status_invalid"); })(),
    formalResearchWriteCount: 0 as const,
  };
  if (core.source.sourceHash !== directions[0].inputBundleHash) throw new Error("beta2_snapshot_source_invalid");
  return { ...core, contentHash: beta2Hash(core) };
}

export function parseV2Beta2DurableSnapshot(value: unknown, context: { projectId?: string } = {}): V2Beta2DurableSnapshot {
  const input = exact(value, SNAPSHOT_KEYS, "beta2_snapshot_invalid");
  if (input.schemaId !== "old-mike-v2-beta2/durable-snapshot/1" || input.contractVersion !== V2_BETA2_CONTRACT_VERSION || input.durabilityClass !== V2_BETA2_DURABILITY_CLASS || input.providerSubmissionCount !== 1 || input.formalResearchWriteCount !== 0) throw new Error("beta2_snapshot_invalid");
  const expected = createV2Beta2DurableSnapshot({
    projectId: input.projectId as string,
    revision: input.revision as number,
    source: input.source as V2Beta2Source,
    directions: input.directions as V2Beta2Direction[],
    recommendedDirectionId: input.recommendedDirectionId as string,
    selectedDirectionId: input.selectedDirectionId as string,
    confirmedWorkspace: input.confirmedWorkspace as V2Beta2ConfirmedWorkspace | null,
    stageId: input.stageId as typeof V2_BETA2_STAGE_ID,
    stageInstanceHash: input.stageInstanceHash as string,
    jobId: input.jobId as string,
    persistenceStatus: input.persistenceStatus as V2Beta2DurableSnapshot["persistenceStatus"],
  });
  if ((context.projectId && expected.projectId !== parseV2Beta2ProjectId(context.projectId)) || !canonicalEqual(input, expected)) throw new Error("beta2_snapshot_invalid");
  return expected;
}

export function createV2Beta2EffectLineageHash(input: { workspaceId: string; projectId: string; baseRevision: number; baseContentHash: string }) {
  return beta2Hash({
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    workspaceId: text(input.workspaceId, 3, 180, "beta2_workspace_id_invalid"),
    projectId: parseV2Beta2ProjectId(input.projectId),
    stageId: V2_BETA2_STAGE_ID,
    baseRevision: safeInteger(input.baseRevision, 0, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid"),
    baseContentHash: hash(input.baseContentHash, "beta2_content_hash_invalid"),
  });
}

export function createV2Beta2StageInstanceHash(input: { workspaceId: string; projectId: string; baseRevision: number; baseContentHash: string }) {
  return createV2Beta2EffectLineageHash(input);
}

export function createV2Beta2GenerationPayloadHash(value: unknown) {
  const request = parseV2Beta2GenerateRequest(value);
  return beta2Hash({
    contractVersion: request.contractVersion,
    operation: request.operation,
    projectId: request.projectId,
    baseRevision: request.baseRevision,
    baseContentHash: request.baseContentHash,
    source: request.source,
  });
}

export function createV2Beta2SelectionPayloadHash(value: unknown) {
  const request = parseV2Beta2SaveSelectionRequest(value);
  return beta2Hash({
    contractVersion: request.contractVersion,
    operation: request.operation,
    projectId: request.projectId,
    baseRevision: request.baseRevision,
    baseContentHash: request.baseContentHash,
    selectedDirectionId: request.selectedDirectionId,
  });
}

export function createV2Beta2ConfirmedWorkspacePayloadHash(value: unknown) {
  const request = parseV2Beta2SaveConfirmedWorkspaceRequest(value);
  return beta2Hash({
    contractVersion: request.contractVersion,
    operation: request.operation,
    projectId: request.projectId,
    baseRevision: request.baseRevision,
    baseContentHash: request.baseContentHash,
    selectedDirectionId: request.selectedDirectionId,
    s0Summary: request.s0Summary,
    appliedAssistOptionIds: request.appliedAssistOptionIds,
  });
}

export function createV2Beta2ReconciliationRequestHash(value: unknown) {
  const request = parseV2Beta2ReconcileRequest(value);
  return beta2Hash({
    jobId: request.jobId,
    operation: request.operation,
    requestId: request.requestId,
  });
}

export function createV2Beta2OperationRequestHash(value: unknown) {
  return beta2Hash(parseV2Beta2MutationRequest(value));
}

export function createV2Beta2RequestAuthority(value: unknown): V2Beta2RequestAuthority {
  const request = parseV2Beta2MutationRequest(value);
  const core = {
    schemaId: "old-mike-v2-beta2/response-request-authority/1" as const,
    projectId: request.projectId,
    operation: request.operation,
    requestId: request.requestId,
    transportRequestHash: createV2Beta2OperationRequestHash(request),
  };
  return { ...core, authorityHash: beta2Hash(core) };
}

export function parseV2Beta2RequestAuthority(value: unknown, expectedRequest: unknown): V2Beta2RequestAuthority {
  const input = exact(value, REQUEST_AUTHORITY_KEYS, "beta2_request_authority_invalid");
  const expected = createV2Beta2RequestAuthority(expectedRequest);
  if (!canonicalEqual(input, expected)) throw new Error("beta2_request_authority_invalid");
  return expected;
}

function parseV2Beta2TerminalEventAuthority(value: unknown, context: {
  projectId: string;
  jobId: string;
  generationRequestId: string;
  generationRequestHash: string;
}): V2Beta2TerminalEventAuthority {
  const input = exact(value, TERMINAL_EVENT_KEYS, "beta2_terminal_event_invalid");
  const eventType = input.eventType;
  const operation = input.operation;
  const requestId = parseV2Beta2RequestId(input.requestId);
  const requestHash = hash(input.requestHash, "beta2_terminal_event_invalid");
  const generation = eventType === "GENERATION_COMPLETE" || eventType === "GENERATION_TERMINAL_FAILURE";
  const reconciliation = eventType === "RECONCILIATION_COMPLETE" || eventType === "RECONCILIATION_TERMINAL_FAILURE";
  if ((!generation && !reconciliation)
    || (generation && operation !== "GENERATE_DURABLE_CORE")
    || (reconciliation && operation !== "RECONCILE_UNKNOWN")) throw new Error("beta2_terminal_event_invalid");
  if (generation && (requestId !== context.generationRequestId || requestHash !== context.generationRequestHash)) throw new Error("beta2_terminal_event_invalid");
  if (reconciliation && requestHash !== createV2Beta2ReconciliationRequestHash({
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    operation: "RECONCILE_UNKNOWN",
    projectId: context.projectId,
    requestId,
    jobId: context.jobId,
  })) throw new Error("beta2_terminal_event_invalid");
  return { eventType: eventType as V2Beta2TerminalEventAuthority["eventType"], operation: operation as V2Beta2TerminalEventAuthority["operation"], requestId, requestHash };
}

export function createV2Beta2StageOutcome(projectIdValue: string, input: Omit<V2Beta2StageOutcome, "schemaId" | "outcomeHash">): V2Beta2StageOutcome {
  const projectId = parseV2Beta2ProjectId(projectIdValue);
  const jobId = text(input.jobId, 8, 120, "beta2_job_id_invalid");
  const stageInstanceHash = hash(input.stageInstanceHash, "beta2_stage_instance_hash_invalid");
  const generationRequestId = parseV2Beta2RequestId(input.generationRequestId);
  const generationRequestHash = hash(input.generationRequestHash, "beta2_generation_request_hash_invalid");
  if (![0, 1].includes(input.providerSubmissionCount)) throw new Error("beta2_stage_outcome_invalid");
  const providerSubmissionCount = input.providerSubmissionCount as 0 | 1;
  const providerReceiptCommitment = input.providerReceiptCommitment === null ? null : hash(input.providerReceiptCommitment, "beta2_provider_receipt_invalid");
  const terminalEvent = input.terminalEvent === null ? null : parseV2Beta2TerminalEventAuthority(input.terminalEvent, { projectId, jobId, generationRequestId, generationRequestHash });
  const providerResultHash = input.providerResultHash === null ? null : hash(input.providerResultHash, "beta2_provider_result_hash_invalid");
  const parsedReasonCode = input.reasonCode === null ? null : reasonCode(input.reasonCode, "beta2_stage_outcome_invalid");
  if (input.status === "COMPLETE") {
    if (input.completionClass !== "COMPLETE" || providerSubmissionCount !== 1 || !providerReceiptCommitment || !providerResultHash || parsedReasonCode !== null || !terminalEvent || !["GENERATION_COMPLETE", "RECONCILIATION_COMPLETE"].includes(terminalEvent.eventType)) throw new Error("beta2_stage_outcome_invalid");
  } else if (input.status === "RECONCILE_REQUIRED") {
    if (input.completionClass !== "COMPLETION_UNKNOWN" || providerSubmissionCount !== 1 || !providerReceiptCommitment || providerResultHash !== null || parsedReasonCode === null || terminalEvent !== null) throw new Error("beta2_stage_outcome_invalid");
  } else if (input.status === "REJECTED") {
    if (input.completionClass !== "TERMINAL_REJECTED" || (providerSubmissionCount === 0) !== (providerReceiptCommitment === null) || providerResultHash !== null || parsedReasonCode === null || !terminalEvent || !["GENERATION_TERMINAL_FAILURE", "RECONCILIATION_TERMINAL_FAILURE"].includes(terminalEvent.eventType)) throw new Error("beta2_stage_outcome_invalid");
  } else {
    throw new Error("beta2_stage_outcome_invalid");
  }
  const core = {
    schemaId: "old-mike-v2-beta2/stage-outcome/1" as const,
    jobId,
    stageInstanceHash,
    generationRequestId,
    generationRequestHash,
    status: input.status,
    completionClass: input.completionClass,
    providerSubmissionCount,
    providerReceiptCommitment,
    providerResultHash,
    reasonCode: parsedReasonCode,
    terminalEvent,
  };
  return { ...core, outcomeHash: beta2Hash({ projectId, ...core }) };
}

export function parseV2Beta2StageOutcome(value: unknown, context: { projectId: string }): V2Beta2StageOutcome {
  const input = exact(value, STAGE_OUTCOME_KEYS, "beta2_stage_outcome_invalid");
  if (input.schemaId !== "old-mike-v2-beta2/stage-outcome/1") throw new Error("beta2_stage_outcome_invalid");
  const expected = createV2Beta2StageOutcome(context.projectId, {
    jobId: input.jobId as string,
    stageInstanceHash: input.stageInstanceHash as string,
    generationRequestId: input.generationRequestId as string,
    generationRequestHash: input.generationRequestHash as string,
    status: input.status as V2Beta2StageOutcome["status"],
    completionClass: input.completionClass as V2Beta2StageOutcome["completionClass"],
    providerSubmissionCount: input.providerSubmissionCount as 0 | 1,
    providerReceiptCommitment: input.providerReceiptCommitment as string | null,
    providerResultHash: input.providerResultHash as string | null,
    reasonCode: input.reasonCode as string | null,
    terminalEvent: input.terminalEvent as V2Beta2TerminalEventAuthority | null,
  });
  if (!canonicalEqual(input, expected)) throw new Error("beta2_stage_outcome_invalid");
  return expected;
}

export function parseV2Beta2MutationRequest(value: unknown): V2Beta2MutationRequest {
  const base = record(value, "beta2_request_invalid");
  if (base.contractVersion !== V2_BETA2_CONTRACT_VERSION || !V2_BETA2_OPERATIONS.includes(base.operation as V2Beta2MutationRequest["operation"])) throw new Error("beta2_contract_or_operation_invalid");
  if (base.operation === "GENERATE_DURABLE_CORE") {
    const input = exact(base, ["contractVersion", "operation", "projectId", "requestId", "idempotencyKey", "baseRevision", "baseContentHash", "source"], "beta2_request_invalid");
    return { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: parseV2Beta2ProjectId(input.projectId), requestId: parseV2Beta2RequestId(input.requestId), idempotencyKey: parseV2Beta2IdempotencyKey(input.idempotencyKey), baseRevision: safeInteger(input.baseRevision, 0, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid"), baseContentHash: hash(input.baseContentHash, "beta2_content_hash_invalid"), source: parseV2Beta2Source(input.source) };
  }
  if (base.operation === "SAVE_DIRECTION_SELECTION") {
    const input = exact(base, ["contractVersion", "operation", "projectId", "requestId", "idempotencyKey", "baseRevision", "baseContentHash", "selectedDirectionId"], "beta2_request_invalid");
    return { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: parseV2Beta2ProjectId(input.projectId), requestId: parseV2Beta2RequestId(input.requestId), idempotencyKey: parseV2Beta2IdempotencyKey(input.idempotencyKey), baseRevision: safeInteger(input.baseRevision, 1, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid"), baseContentHash: hash(input.baseContentHash, "beta2_content_hash_invalid"), selectedDirectionId: text(input.selectedDirectionId, 8, 120, "beta2_direction_id_invalid") };
  }
  if (base.operation === "SAVE_CONFIRMED_WORKSPACE") {
    const input = exact(base, ["contractVersion", "operation", "projectId", "requestId", "idempotencyKey", "baseRevision", "baseContentHash", "selectedDirectionId", "s0Summary", "appliedAssistOptionIds"], "beta2_request_invalid");
    return {
      contractVersion: V2_BETA2_CONTRACT_VERSION,
      operation: "SAVE_CONFIRMED_WORKSPACE",
      projectId: parseV2Beta2ProjectId(input.projectId),
      requestId: parseV2Beta2RequestId(input.requestId),
      idempotencyKey: parseV2Beta2IdempotencyKey(input.idempotencyKey),
      baseRevision: safeInteger(input.baseRevision, 1, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid"),
      baseContentHash: hash(input.baseContentHash, "beta2_content_hash_invalid"),
      selectedDirectionId: text(input.selectedDirectionId, 8, 120, "beta2_direction_id_invalid"),
      s0Summary: parseS0(input.s0Summary),
      appliedAssistOptionIds: parseAppliedAssistOptionIds(input.appliedAssistOptionIds),
    };
  }
  const input = exact(base, ["contractVersion", "operation", "projectId", "requestId", "jobId"], "beta2_request_invalid");
  return { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: parseV2Beta2ProjectId(input.projectId), requestId: parseV2Beta2RequestId(input.requestId), jobId: text(input.jobId, 8, 120, "beta2_job_id_invalid") };
}

export function parseV2Beta2GenerateRequest(value: unknown): V2Beta2GenerateRequest {
  const parsed = parseV2Beta2MutationRequest(value);
  if (parsed.operation !== "GENERATE_DURABLE_CORE") throw new Error("beta2_operation_invalid");
  return parsed;
}

export function parseV2Beta2SaveSelectionRequest(value: unknown): V2Beta2SaveSelectionRequest {
  const parsed = parseV2Beta2MutationRequest(value);
  if (parsed.operation !== "SAVE_DIRECTION_SELECTION") throw new Error("beta2_operation_invalid");
  return parsed;
}

export function parseV2Beta2SaveConfirmedWorkspaceRequest(value: unknown): V2Beta2SaveConfirmedWorkspaceRequest {
  const parsed = parseV2Beta2MutationRequest(value);
  if (parsed.operation !== "SAVE_CONFIRMED_WORKSPACE") throw new Error("beta2_operation_invalid");
  return parsed;
}

export function parseV2Beta2ReconcileRequest(value: unknown): V2Beta2ReconcileRequest {
  const parsed = parseV2Beta2MutationRequest(value);
  if (parsed.operation !== "RECONCILE_UNKNOWN") throw new Error("beta2_operation_invalid");
  return parsed;
}

export function parseV2Beta2ProjectHead(value: unknown): V2Beta2ProjectHead {
  const project = exact(value, PROJECT_HEAD_KEYS, "beta2_project_head_invalid");
  const projectId = parseV2Beta2ProjectId(project.projectId);
  const revision = safeInteger(project.revision, 0, Number.MAX_SAFE_INTEGER, "beta2_revision_invalid");
  const snapshot = project.snapshot === null ? null : parseV2Beta2DurableSnapshot(project.snapshot, { projectId });
  if ((revision === 0) !== (snapshot === null) || (snapshot && (snapshot.revision !== revision || snapshot.contentHash !== project.contentHash))) throw new Error("beta2_project_head_invalid");
  if (!snapshot && project.contentHash !== createV2Beta2InitialHead(projectId).contentHash) throw new Error("beta2_project_head_invalid");
  let reconciliation: V2Beta2ProjectHead["reconciliation"] = null;
  if (project.reconciliation !== null) {
    const item = exact(project.reconciliation, ["jobId", "status"], "beta2_reconciliation_invalid");
    if (item.status !== "RECONCILE_REQUIRED") throw new Error("beta2_reconciliation_invalid");
    reconciliation = { jobId: text(item.jobId, 8, 120, "beta2_job_id_invalid"), status: "RECONCILE_REQUIRED" };
  }
  const stageOutcome = project.stageOutcome === null ? null : parseV2Beta2StageOutcome(project.stageOutcome, { projectId });
  if ((reconciliation === null) !== (stageOutcome?.status !== "RECONCILE_REQUIRED")
    || (reconciliation && stageOutcome?.jobId !== reconciliation.jobId)
    || (stageOutcome?.status === "COMPLETE" && (!snapshot || snapshot.jobId !== stageOutcome.jobId))
    || (snapshot && stageOutcome === null)) throw new Error("beta2_project_head_invalid");
  return { projectId, revision, contentHash: hash(project.contentHash, "beta2_content_hash_invalid"), snapshot, reconciliation, stageOutcome };
}

function validateV2Beta2SuccessEnvelopeSemantics(input: {
  operation: V2Beta2SuccessEnvelope["operation"];
  project: V2Beta2ProjectHead;
  replayed: boolean;
  providerSubmissionDelta: 0 | 1;
  snapshotAppendDelta: 0 | 1;
  eventAppendDelta: 0 | 1;
}, expectedRequest: V2Beta2MutationRequest | null) {
  const { operation, project, replayed, providerSubmissionDelta, snapshotAppendDelta, eventAppendDelta } = input;
  const tuple = `${Number(replayed)}:${providerSubmissionDelta}:${snapshotAppendDelta}:${eventAppendDelta}`;
  const status = project.stageOutcome?.status ?? "NONE";
  let allowed: readonly string[] = [];
  if (operation === "RESUME") {
    allowed = status === "RECONCILE_REQUIRED" ? ["1:0:0:0", "1:0:0:1"] : ["1:0:0:0"];
  } else if (operation === "GENERATE_DURABLE_CORE") {
    if (status === "COMPLETE") allowed = ["0:1:1:1", "1:0:0:0"];
    else if (status === "RECONCILE_REQUIRED") allowed = ["0:1:0:1", "1:0:0:0", "1:0:0:1"];
  } else if (operation === "SAVE_DIRECTION_SELECTION") {
    if (status === "COMPLETE" && project.reconciliation === null && project.snapshot?.jobId === project.stageOutcome?.jobId) allowed = ["0:0:1:1", "1:0:0:0"];
  } else if (operation === "SAVE_CONFIRMED_WORKSPACE") {
    if (status === "COMPLETE" && project.reconciliation === null && project.snapshot?.jobId === project.stageOutcome?.jobId) allowed = ["0:0:1:1", "1:0:0:0"];
  } else if (operation === "RECONCILE_UNKNOWN") {
    if (status === "COMPLETE") allowed = ["0:0:1:1", "1:0:0:0"];
    else if (status === "RECONCILE_REQUIRED") allowed = ["1:0:0:0"];
  }
  if (!allowed.includes(tuple)) throw new Error("beta2_response_invalid");
  if (operation === "RESUME") {
    if (expectedRequest !== null) throw new Error("beta2_response_invalid");
    return;
  }
  if (!expectedRequest || expectedRequest.operation !== operation || !project.stageOutcome) throw new Error("beta2_response_invalid");
  if (expectedRequest.operation === "GENERATE_DURABLE_CORE") {
    const expectedGenerationHash = createV2Beta2GenerationPayloadHash(expectedRequest);
    if (project.stageOutcome.generationRequestHash !== expectedGenerationHash
      || project.stageOutcome.generationRequestId !== expectedRequest.requestId) throw new Error("beta2_response_invalid");
    if (project.stageOutcome.status === "COMPLETE") {
      if (!project.snapshot || project.snapshot.jobId !== project.stageOutcome.jobId
        || project.revision !== expectedRequest.baseRevision + 1
        || (!replayed && (project.stageOutcome.terminalEvent?.eventType !== "GENERATION_COMPLETE"
          || project.stageOutcome.terminalEvent.requestId !== expectedRequest.requestId))) throw new Error("beta2_response_invalid");
    } else if (project.stageOutcome.status === "RECONCILE_REQUIRED") {
      if (project.reconciliation?.jobId !== project.stageOutcome.jobId
        || project.revision !== expectedRequest.baseRevision
        || project.contentHash !== expectedRequest.baseContentHash) throw new Error("beta2_response_invalid");
    }
    return;
  }
  if (expectedRequest.operation === "SAVE_DIRECTION_SELECTION") {
    if (project.stageOutcome.status !== "COMPLETE" || project.reconciliation !== null || !project.snapshot
      || project.snapshot.jobId !== project.stageOutcome.jobId
      || project.snapshot.selectedDirectionId !== expectedRequest.selectedDirectionId
      || project.revision !== expectedRequest.baseRevision + 1
      || project.snapshot.revision !== project.revision
      || project.snapshot.contentHash !== project.contentHash) throw new Error("beta2_response_invalid");
    return;
  }
  if (expectedRequest.operation === "SAVE_CONFIRMED_WORKSPACE") {
    const confirmed = project.snapshot?.confirmedWorkspace;
    if (project.stageOutcome.status !== "COMPLETE" || project.reconciliation !== null || !project.snapshot || !confirmed
      || project.snapshot.jobId !== project.stageOutcome.jobId
      || project.snapshot.selectedDirectionId !== expectedRequest.selectedDirectionId
      || project.revision !== expectedRequest.baseRevision + 1
      || project.snapshot.revision !== project.revision
      || project.snapshot.contentHash !== project.contentHash
      || !canonicalEqual(confirmed.s0, expectedRequest.s0Summary)
      || !canonicalEqual(confirmed.appliedAssistOptionIds, expectedRequest.appliedAssistOptionIds)) throw new Error("beta2_response_invalid");
    return;
  }
  const terminalEvent = project.stageOutcome.terminalEvent;
  if (project.stageOutcome.jobId !== expectedRequest.jobId) throw new Error("beta2_response_invalid");
  if (project.stageOutcome.status === "RECONCILE_REQUIRED") {
    if (project.reconciliation?.jobId !== expectedRequest.jobId || terminalEvent !== null) throw new Error("beta2_response_invalid");
  } else if (project.stageOutcome.status === "COMPLETE") {
    if (!project.snapshot || project.snapshot.jobId !== expectedRequest.jobId
      || terminalEvent?.eventType !== "RECONCILIATION_COMPLETE"
      || terminalEvent.operation !== "RECONCILE_UNKNOWN"
      || terminalEvent.requestId !== expectedRequest.requestId
      || terminalEvent.requestHash !== createV2Beta2ReconciliationRequestHash(expectedRequest)) throw new Error("beta2_response_invalid");
  } else {
    throw new Error("beta2_response_invalid");
  }
}

export function parseV2Beta2SuccessEnvelope(value: unknown, expectation: V2Beta2ResponseExpectation): V2Beta2SuccessEnvelope {
  const expectedProjectId = parseV2Beta2ProjectId(expectation.projectId);
  const expectedRequest = expectation.request === null ? null : parseV2Beta2MutationRequest(expectation.request);
  if (expectedRequest && expectedRequest.projectId !== expectedProjectId) throw new Error("beta2_response_invalid");
  const expectedOperation: V2Beta2SuccessEnvelope["operation"] = expectedRequest?.operation ?? "RESUME";
  const input = exact(value, ["ok", "contractVersion", "trustClass", "durabilityClass", "operation", "requestAuthority", "project", "replayed", "providerSubmissionDelta", "snapshotAppendDelta", "eventAppendDelta", "formalResearchWriteCount", "liveProviderCallCount"], "beta2_response_invalid");
  if (input.ok !== true || input.contractVersion !== V2_BETA2_CONTRACT_VERSION || input.trustClass !== V2_BETA2_TRUST_CLASS || input.durabilityClass !== V2_BETA2_DURABILITY_CLASS || !["RESUME", ...V2_BETA2_OPERATIONS].includes(input.operation as string) || typeof input.replayed !== "boolean" || ![0, 1].includes(input.providerSubmissionDelta as number) || ![0, 1].includes(input.snapshotAppendDelta as number) || ![0, 1].includes(input.eventAppendDelta as number) || input.formalResearchWriteCount !== 0 || input.liveProviderCallCount !== 0) throw new Error("beta2_response_invalid");
  const project = parseV2Beta2ProjectHead(input.project);
  const requestAuthority = expectedRequest === null
    ? input.requestAuthority === null ? null : (() => { throw new Error("beta2_response_invalid"); })()
    : parseV2Beta2RequestAuthority(input.requestAuthority, expectedRequest);
  if (input.operation !== expectedOperation || project.projectId !== expectedProjectId || project.stageOutcome?.status === "REJECTED" && input.operation !== "RESUME") throw new Error("beta2_response_invalid");
  const parsed = { ...input, requestAuthority, project } as V2Beta2SuccessEnvelope;
  validateV2Beta2SuccessEnvelopeSemantics(parsed, expectedRequest);
  return parsed;
}

export function parseV2Beta2TerminalFailureEnvelope(value: unknown, expectedRequestValue: unknown): V2Beta2TerminalFailureEnvelope {
  const expectedRequest = parseV2Beta2MutationRequest(expectedRequestValue);
  if (expectedRequest.operation === "SAVE_DIRECTION_SELECTION" || expectedRequest.operation === "SAVE_CONFIRMED_WORKSPACE") throw new Error("beta2_terminal_failure_response_invalid");
  const input = exact(value, ["ok", "code", "contractVersion", "trustClass", "durabilityClass", "operation", "requestAuthority", "project", "replayed", "providerSubmissionDelta", "snapshotAppendDelta", "eventAppendDelta", "formalResearchWriteCount", "liveProviderCallCount"], "beta2_terminal_failure_response_invalid");
  if (input.ok !== false || input.code !== "beta2_provider_terminal_rejected" || input.contractVersion !== V2_BETA2_CONTRACT_VERSION || input.trustClass !== V2_BETA2_TRUST_CLASS || input.durabilityClass !== V2_BETA2_DURABILITY_CLASS
    || !["GENERATE_DURABLE_CORE", "RECONCILE_UNKNOWN"].includes(input.operation as string) || typeof input.replayed !== "boolean"
    || ![0, 1].includes(input.providerSubmissionDelta as number) || input.snapshotAppendDelta !== 0 || ![0, 1].includes(input.eventAppendDelta as number)
    || input.formalResearchWriteCount !== 0 || input.liveProviderCallCount !== 0) throw new Error("beta2_terminal_failure_response_invalid");
  const project = parseV2Beta2ProjectHead(input.project);
  const requestAuthority = parseV2Beta2RequestAuthority(input.requestAuthority, expectedRequest);
  const terminalEvent = project.stageOutcome?.terminalEvent;
  if (input.operation !== expectedRequest.operation || project.projectId !== expectedRequest.projectId || project.stageOutcome?.status !== "REJECTED" || !terminalEvent || terminalEvent.operation !== input.operation
    || input.eventAppendDelta !== (input.replayed ? 0 : 1)
    || (input.operation === "RECONCILE_UNKNOWN" && input.providerSubmissionDelta !== 0)
    || (input.operation === "GENERATE_DURABLE_CORE" && input.providerSubmissionDelta !== (input.replayed ? 0 : 1))) throw new Error("beta2_terminal_failure_response_invalid");
  if (expectedRequest.operation === "GENERATE_DURABLE_CORE"
    && (project.stageOutcome.generationRequestHash !== createV2Beta2GenerationPayloadHash(expectedRequest)
      || (!input.replayed && (project.stageOutcome.generationRequestId !== expectedRequest.requestId || terminalEvent.requestId !== expectedRequest.requestId)))) throw new Error("beta2_terminal_failure_response_invalid");
  if (expectedRequest.operation === "RECONCILE_UNKNOWN"
    && (project.stageOutcome.jobId !== expectedRequest.jobId
      || terminalEvent.eventType !== "RECONCILIATION_TERMINAL_FAILURE"
      || terminalEvent.requestId !== expectedRequest.requestId
      || terminalEvent.requestHash !== createV2Beta2ReconciliationRequestHash(expectedRequest))) throw new Error("beta2_terminal_failure_response_invalid");
  return { ...input, requestAuthority, project } as V2Beta2TerminalFailureEnvelope;
}

export function expectedV2Beta2SuccessHttpStatus(envelope: V2Beta2SuccessEnvelope): 200 | 202 {
  if (envelope.operation === "RESUME") return 200;
  return envelope.project.reconciliation === null ? 200 : 202;
}

export function parseV2Beta2SuccessHttpResponse(value: unknown, status: number, expectation: V2Beta2ResponseExpectation): V2Beta2SuccessEnvelope {
  const envelope = parseV2Beta2SuccessEnvelope(value, expectation);
  if (status !== expectedV2Beta2SuccessHttpStatus(envelope)) throw new Error("beta2_response_invalid");
  return envelope;
}

export function parseV2Beta2TerminalFailureHttpResponse(value: unknown, status: number, expectedRequestValue: unknown): V2Beta2TerminalFailureEnvelope {
  const envelope = parseV2Beta2TerminalFailureEnvelope(value, expectedRequestValue);
  if (status !== 409) throw new Error("beta2_terminal_failure_response_invalid");
  return envelope;
}
