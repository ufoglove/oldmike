import { createHash } from "node:crypto";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const TASK_GATEWAY_CONTRACT_VERSION = "old-mike-task-gateway/1.2.0" as const;
export const taskStates = ["QUEUED", "RUNNING", "WAITING_HUMAN", "COMPLETED", "FAILED", "CANCELED"] as const;
export const taskOperations = ["TOPIC_GOLDEN_PATH", "PAPER_DRAFT_STAGE", "ACADEMIC_LANGUAGE", "CODE_DATA_ASSIST", "PROJECT_CHAT", "PROPOSAL_GUIDANCE"] as const;
export const taskHumanGates = ["RESEARCH_DIRECTION", "METHOD_AND_ETHICS", "EVIDENCE_AND_CLAIMS", "DOCUMENT_RELEASE"] as const;
export const taskToolAllowlist = ["FIXTURE_SCHOLARLY_METADATA", "PORTAL_FORMAL_DATA_READ", "PORTAL_APPEND_PROPOSAL", "ISOLATED_CODE_DATA_WORKER"] as const;

export type TaskState = (typeof taskStates)[number];
export type TaskOperation = (typeof taskOperations)[number];
export type TaskHumanGate = (typeof taskHumanGates)[number];
export type TaskTool = (typeof taskToolAllowlist)[number];

export type TopicKeywordPayload = {
  kind: "TOPIC_KEYWORDS";
  keywords: string[];
  observationWindow: { from: string; to: string };
};

export type PaperDraftStagePayload = {
  kind: "PAPER_DRAFT_STAGE";
  stage: "OUTLINE" | "METHOD_PLAN" | "EVIDENCE_LEDGER" | "DOCUMENT_DRAFT";
  selectedCandidateHash: string;
  formalDocumentHash: string | null;
};

export type AcademicLanguagePayload = {
  kind: "ACADEMIC_LANGUAGE";
  requestHash: string;
  task: "TRANSLATE_ZH_EN" | "TRANSLATE_EN_ZH_TW" | "EDIT_ACADEMIC_EN";
};

export type CodeDataAssistPayload = {
  kind: "CODE_DATA_ASSIST";
  artifactHash: string;
  instructionClass: "REPRODUCIBLE_CODE" | "STATISTICAL_CHECK" | "FIGURE_SPEC";
};

export type ProjectChatPayload = {
  kind: "PROJECT_CHAT_MESSAGE";
  message: string;
  contextHash: string;
  modeProfile: ModelModeProfile;
};

export type ProposalGuidancePayload = {
  kind: "PROPOSAL_GUIDANCE";
  proposalHash: string;
  mode: "NSTC_RESEARCH" | "MOE_TEACHING_PRACTICE";
  focus: "STRUCTURE" | "METHOD_FEASIBILITY" | "BUDGET_JUSTIFICATION" | "RISK_AND_ALTERNATIVES";
  modeProfile: ModelModeProfile;
};

export type TaskPayload = TopicKeywordPayload | PaperDraftStagePayload | AcademicLanguagePayload | CodeDataAssistPayload | ProjectChatPayload | ProposalGuidancePayload;

export type TaskContinuation = {
  parentTaskId: string;
  parentReceiptHash: string;
  approvedGate: TaskHumanGate;
  approvalHash: string;
};

export type TaskEnvelope = {
  contractVersion: typeof TASK_GATEWAY_CONTRACT_VERSION;
  actionId: string;
  taskId: string;
  tenantId: string;
  projectId: string;
  operation: TaskOperation;
  idempotencyKey: string;
  createdAt: string;
  payload: TaskPayload;
  skillIds: string[];
  toolIds: TaskTool[];
  continuation: TaskContinuation | null;
};

export type SanitizedExecutionReceipt = {
  contractVersion: typeof TASK_GATEWAY_CONTRACT_VERSION;
  taskId: string;
  operation: TaskOperation;
  state: TaskState;
  startedAt: string;
  finishedAt: string;
  inputHash: string;
  outputHash: string | null;
  idempotencyFingerprint: string;
  attemptClass: "FIRST" | "IDEMPOTENT_REPLAY";
  dataEgress: "NONE" | "OPAQUE_METADATA_ONLY" | "BOUNDED_AUTHORIZED_PROJECT_CONTEXT";
  humanGate: TaskHumanGate | null;
  sanitizedStatus: "MOCK_COMPLETE" | "PROVIDER_COMPLETE" | "WAITING_HUMAN" | "CANCELED" | "FAILED_FAIL_CLOSED";
  receiptHash: string;
};

export class TaskGatewayContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "TaskGatewayContractError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function boundedId(value: unknown, code: string) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new TaskGatewayContractError(code);
  return value;
}

function hash(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new TaskGatewayContractError(code);
  return value;
}

function iso(value: unknown, code: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TaskGatewayContractError(code);
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function taskGatewayHash(value: unknown) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function parseObservationWindow(value: unknown) {
  if (!record(value) || !exactKeys(value, ["from", "to"]) || typeof value.from !== "string" || typeof value.to !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.from) || !/^\d{4}-\d{2}-\d{2}$/.test(value.to)) throw new TaskGatewayContractError("invalid_observation_window");
  const from = new Date(`${value.from}T00:00:00.000Z`);
  const to = new Date(`${value.to}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.toISOString().slice(0, 10) !== value.from || to.toISOString().slice(0, 10) !== value.to || from > to) throw new TaskGatewayContractError("invalid_observation_window");
  return { from: value.from, to: value.to };
}

function parsePayload(value: unknown, operation: TaskOperation): TaskPayload {
  if (!record(value) || typeof value.kind !== "string") throw new TaskGatewayContractError("invalid_task_payload");
  if (operation === "TOPIC_GOLDEN_PATH") {
    if (value.kind !== "TOPIC_KEYWORDS" || !exactKeys(value, ["kind", "keywords", "observationWindow"]) || !Array.isArray(value.keywords) || value.keywords.length < 1 || value.keywords.length > 8) throw new TaskGatewayContractError("invalid_topic_keyword_payload");
    const keywords = value.keywords.map((item) => typeof item === "string" ? item.normalize("NFKC").trim() : "");
    if (keywords.some((item) => item.length < 2 || item.length > 80 || /[\u0000-\u001f\u007f]/.test(item)) || new Set(keywords.map((item) => item.toLocaleLowerCase("zh-TW"))).size !== keywords.length) throw new TaskGatewayContractError("invalid_topic_keywords");
    return { kind: "TOPIC_KEYWORDS", keywords, observationWindow: parseObservationWindow(value.observationWindow) };
  }
  if (operation === "PAPER_DRAFT_STAGE") {
    if (value.kind !== "PAPER_DRAFT_STAGE" || !exactKeys(value, ["kind", "stage", "selectedCandidateHash", "formalDocumentHash"]) || !["OUTLINE", "METHOD_PLAN", "EVIDENCE_LEDGER", "DOCUMENT_DRAFT"].includes(String(value.stage))) throw new TaskGatewayContractError("invalid_paper_stage_payload");
    return { kind: "PAPER_DRAFT_STAGE", stage: value.stage as PaperDraftStagePayload["stage"], selectedCandidateHash: hash(value.selectedCandidateHash, "invalid_candidate_hash"), formalDocumentHash: value.formalDocumentHash === null ? null : hash(value.formalDocumentHash, "invalid_document_hash") };
  }
  if (operation === "ACADEMIC_LANGUAGE") {
    if (value.kind !== "ACADEMIC_LANGUAGE" || !exactKeys(value, ["kind", "requestHash", "task"]) || !["TRANSLATE_ZH_EN", "TRANSLATE_EN_ZH_TW", "EDIT_ACADEMIC_EN"].includes(String(value.task))) throw new TaskGatewayContractError("invalid_academic_language_payload");
    return { kind: "ACADEMIC_LANGUAGE", requestHash: hash(value.requestHash, "invalid_request_hash"), task: value.task as AcademicLanguagePayload["task"] };
  }
  if (operation === "CODE_DATA_ASSIST") {
    if (value.kind !== "CODE_DATA_ASSIST" || !exactKeys(value, ["kind", "artifactHash", "instructionClass"]) || !["REPRODUCIBLE_CODE", "STATISTICAL_CHECK", "FIGURE_SPEC"].includes(String(value.instructionClass))) throw new TaskGatewayContractError("invalid_code_data_payload");
    return { kind: "CODE_DATA_ASSIST", artifactHash: hash(value.artifactHash, "invalid_artifact_hash"), instructionClass: value.instructionClass as CodeDataAssistPayload["instructionClass"] };
  }
  if (operation === "PROJECT_CHAT") {
    if (value.kind !== "PROJECT_CHAT_MESSAGE" || !exactKeys(value, ["kind", "message", "contextHash", "modeProfile"])) throw new TaskGatewayContractError("invalid_project_chat_payload");
    const message = typeof value.message === "string" ? value.message.normalize("NFKC").trim() : "";
    if (!message || message.length > 8_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) throw new TaskGatewayContractError("invalid_project_chat_message");
    return { kind: "PROJECT_CHAT_MESSAGE", message, contextHash: hash(value.contextHash, "invalid_project_context_hash"), modeProfile: parseModelModeProfile(value.modeProfile) };
  }
  if (operation === "PROPOSAL_GUIDANCE") {
    if (value.kind !== "PROPOSAL_GUIDANCE" || !exactKeys(value, ["kind", "proposalHash", "mode", "focus", "modeProfile"])) throw new TaskGatewayContractError("invalid_proposal_guidance_payload");
    if (!["NSTC_RESEARCH", "MOE_TEACHING_PRACTICE"].includes(String(value.mode)) || !["STRUCTURE", "METHOD_FEASIBILITY", "BUDGET_JUSTIFICATION", "RISK_AND_ALTERNATIVES"].includes(String(value.focus))) throw new TaskGatewayContractError("invalid_proposal_guidance_payload");
    return { kind: "PROPOSAL_GUIDANCE", proposalHash: hash(value.proposalHash, "invalid_proposal_hash"), mode: value.mode as ProposalGuidancePayload["mode"], focus: value.focus as ProposalGuidancePayload["focus"], modeProfile: parseModelModeProfile(value.modeProfile) };
  }
  throw new TaskGatewayContractError("payload_operation_mismatch");
}

function parseContinuation(value: unknown): TaskContinuation | null {
  if (value === null) return null;
  if (!record(value) || !exactKeys(value, ["parentTaskId", "parentReceiptHash", "approvedGate", "approvalHash"]) || !taskHumanGates.includes(value.approvedGate as TaskHumanGate)) throw new TaskGatewayContractError("invalid_task_continuation");
  return { parentTaskId: boundedId(value.parentTaskId, "invalid_parent_task_id"), parentReceiptHash: hash(value.parentReceiptHash, "invalid_parent_receipt_hash"), approvedGate: value.approvedGate as TaskHumanGate, approvalHash: hash(value.approvalHash, "invalid_approval_hash") };
}

export function parseTaskEnvelope(value: unknown, productionSkillIds: ReadonlySet<string>): TaskEnvelope {
  if (!record(value) || !exactKeys(value, ["contractVersion", "actionId", "taskId", "tenantId", "projectId", "operation", "idempotencyKey", "createdAt", "payload", "skillIds", "toolIds", "continuation"]) || value.contractVersion !== TASK_GATEWAY_CONTRACT_VERSION || !taskOperations.includes(value.operation as TaskOperation)) throw new TaskGatewayContractError("invalid_task_envelope");
  if (!Array.isArray(value.skillIds) || value.skillIds.length > 8 || value.skillIds.some((item) => typeof item !== "string" || !productionSkillIds.has(item)) || new Set(value.skillIds).size !== value.skillIds.length) throw new TaskGatewayContractError("skill_not_allowlisted", 403);
  if (!Array.isArray(value.toolIds) || value.toolIds.length > 4 || value.toolIds.some((item) => !taskToolAllowlist.includes(item as TaskTool)) || new Set(value.toolIds).size !== value.toolIds.length) throw new TaskGatewayContractError("tool_not_allowlisted", 403);
  const operation = value.operation as TaskOperation;
  return {
    contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
    actionId: boundedId(value.actionId, "invalid_action_id"),
    taskId: boundedId(value.taskId, "invalid_task_id"),
    tenantId: boundedId(value.tenantId, "invalid_tenant_id"),
    projectId: boundedId(value.projectId, "invalid_project_id"),
    operation,
    idempotencyKey: boundedId(value.idempotencyKey, "invalid_idempotency_key"),
    createdAt: iso(value.createdAt, "invalid_created_at"),
    payload: parsePayload(value.payload, operation),
    skillIds: [...value.skillIds] as string[],
    toolIds: [...value.toolIds] as TaskTool[],
    continuation: parseContinuation(value.continuation),
  };
}

export function taskIdempotencyFingerprint(envelope: TaskEnvelope) {
  return taskGatewayHash({ tenantId: envelope.tenantId, projectId: envelope.projectId, operation: envelope.operation, idempotencyKey: envelope.idempotencyKey, payload: envelope.payload, continuation: envelope.continuation });
}

const transitions: Record<TaskState, readonly TaskState[]> = {
  QUEUED: ["RUNNING", "CANCELED", "FAILED"],
  RUNNING: ["WAITING_HUMAN", "COMPLETED", "FAILED", "CANCELED"],
  WAITING_HUMAN: [],
  COMPLETED: [],
  FAILED: [],
  CANCELED: [],
};

export function assertTaskTransition(from: TaskState, to: TaskState) {
  if (!transitions[from].includes(to)) throw new TaskGatewayContractError("invalid_task_transition", 409);
}

export function buildSanitizedReceipt(input: Omit<SanitizedExecutionReceipt, "contractVersion" | "receiptHash">): SanitizedExecutionReceipt {
  if (input.finishedAt < input.startedAt || (input.state === "WAITING_HUMAN") !== (input.humanGate !== null)) throw new TaskGatewayContractError("invalid_receipt_state", 500);
  const body = { contractVersion: TASK_GATEWAY_CONTRACT_VERSION, ...input };
  return { ...body, receiptHash: taskGatewayHash(body) };
}
