import { makePreviewHash, makeProjectId } from "./project-id.ts";
import {
  CONFIRMATION_PHRASE,
  isSafeProjectId,
  normalizeS0Intake,
  type ProjectSummary,
  type S0Intake,
} from "./project-contract.ts";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const FOUNDATION_RUNTIME_CONTRACT_VERSION = "old-mike-foundation-runtime/1.0.0" as const;
export const PROJECT_CREATE_MAX_BODY_BYTES = 32_768;
export const PROJECT_CHAT_MAX_BODY_BYTES = 12_288;

export class FoundationRuntimeContractError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: string, status = 400, fieldErrors?: Record<string, string>) {
    super(code);
    this.name = "FoundationRuntimeContractError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
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

export type ProjectCreateRequest = {
  intake: S0Intake;
  projectId: string;
  previewHash: string;
  confirmed: true;
  confirmationText: typeof CONFIRMATION_PHRASE;
};

export function parseProjectCreateRequest(value: unknown, options: { permitComputedIdentity?: boolean } = {}): ProjectCreateRequest {
  if (!record(value) || !exactKeys(value, ["intake", "projectId", "previewHash", "confirmed", "confirmationText"])) {
    throw new FoundationRuntimeContractError("invalid_project_create_request");
  }
  const normalized = normalizeS0Intake(value.intake);
  if (!normalized.ok) throw new FoundationRuntimeContractError("invalid_intake", 400, normalized.fieldErrors);
  if (value.confirmed !== true || value.confirmationText !== CONFIRMATION_PHRASE) {
    throw new FoundationRuntimeContractError("human_confirmation_required");
  }
  const projectId = makeProjectId(normalized.value);
  const previewHash = makePreviewHash(normalized.value, projectId);
  if (!options.permitComputedIdentity) {
    if (!isSafeProjectId(value.projectId) || value.projectId !== projectId) throw new FoundationRuntimeContractError("project_id_mismatch", 409);
    if (value.previewHash !== previewHash) throw new FoundationRuntimeContractError("preview_expired", 409);
  }
  return { intake: normalized.value, projectId, previewHash, confirmed: true, confirmationText: CONFIRMATION_PHRASE };
}

export type ProjectChatRequest = {
  projectId: string;
  message: string;
  idempotencyKey: string;
  modeProfile: ModelModeProfile;
};

export function parseProjectChatRequest(value: unknown): ProjectChatRequest {
  if (!record(value) || !exactKeys(value, ["projectId", "message", "idempotencyKey", "modeProfile"])) throw new FoundationRuntimeContractError("invalid_chat_request");
  if (!isSafeProjectId(value.projectId)) throw new FoundationRuntimeContractError("invalid_project_id");
  const message = typeof value.message === "string" ? value.message.normalize("NFKC").trim() : "";
  if (!message || message.length > 8_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) throw new FoundationRuntimeContractError("invalid_chat_message");
  if (typeof value.idempotencyKey !== "string" || value.idempotencyKey.length < 8 || value.idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value.idempotencyKey)) {
    throw new FoundationRuntimeContractError("invalid_chat_idempotency_key");
  }
  let modeProfile: ModelModeProfile;
  try { modeProfile = parseModelModeProfile(value.modeProfile); }
  catch { throw new FoundationRuntimeContractError("invalid_model_mode_profile"); }
  return { projectId: value.projectId, message, idempotencyKey: value.idempotencyKey, modeProfile };
}

export async function readBoundedJson(request: Request, maximumBytes: number) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) throw new FoundationRuntimeContractError("request_too_large", 413);
  const raw = await request.text().catch(() => "");
  if (!raw) throw new FoundationRuntimeContractError("invalid_request_body");
  if (Buffer.byteLength(raw, "utf8") > maximumBytes) throw new FoundationRuntimeContractError("request_too_large", 413);
  try { return JSON.parse(raw) as unknown; }
  catch { throw new FoundationRuntimeContractError("invalid_json"); }
}

export function buildCreatedProjectSummary(input: S0Intake, persistence: "APPEND_ONLY_RESEARCH_DOCUMENT" | "PENDING_ARTIFACT_COMMITMENT"): ProjectSummary {
  const projectId = makeProjectId(input);
  return {
    projectId,
    path: `projects/active/${projectId}`,
    workingTitle: input.workingTitle,
    domain: input.domain,
    outputTrack: input.outputTrack,
    currentStage: "S0_INTAKE",
    nextGate: "define_project_charter",
    recommendedAction: "在老麥中核對 S0 Intake，完成研究方向與倫理限制。",
    evidenceStatus: "UNVERIFIED",
    riskStatus: "UNVERIFIED",
    humanGateStatus: "REQUIRED",
    known: [
      `USER_PROVIDED｜暫定研究題目：${input.workingTitle}`,
      `USER_PROVIDED｜研究領域：${input.domain}`,
      `USER_PROVIDED｜主成果路徑：${input.outputTrack}`,
      "SYSTEM_VERIFIED｜Project ID 與確認過的 Intake 已綁定。",
    ],
    unknown: ["研究問題、研究缺口與外部證據尚未查證。", "資料、方法與樣本可行性仍需人工核對。"],
    assumptions: ["本次欄位是研究者提供的待核對輸入，不是已驗證證據。"],
    risks: [input.ethicsPrivacyRisks, "尚未完成正式倫理、隱私、授權與資料治理審查。"],
    humanConfirmations: ["已確認研究題目、領域、成果路徑與完整 S0 Intake。", "已確認正式權威是 Portal/PostgreSQL，不建立共享專案檔案。"],
    artifactPaths: persistence === "APPEND_ONLY_RESEARCH_DOCUMENT" ? ["portal-db:research_documents/s0-intake"] : ["portal-db:project_artifacts/s0-pending"],
    source: "postgres",
  };
}
