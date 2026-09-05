import { canonicalDomains, outputTrackIds, projectStageIds, projectStageKeys, type CanonicalDomain, type OutputTrackId, type ProjectStageKey } from "./research-config.ts";
import { S0_FIELD_LABELS, S0_FIELD_LIMITS } from "./s0-fields.ts";

export { projectStageIds };
export const projectStages = projectStageKeys;
export type ProjectStage = ProjectStageKey;

export const projectStatusValues = ["UNVERIFIED", "SUPPORTED", "VERIFIED", "BLOCKED"] as const;
export type ProjectStatusValue = (typeof projectStatusValues)[number];

export const CONFIRMATION_PHRASE = "我確認以上資料，請建立正式研究專案";
export const PROJECT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export type S0Intake = {
  workingTitle: string;
  domain: CanonicalDomain;
  outputTrack: OutputTrackId;
  problemContext: string;
  targetUsers: string;
  expectedContribution: string;
  existingData: string;
  availableData: string;
  methodIdea: string;
  timeline: string;
  constraints: string;
  ethicsPrivacyRisks: string;
  unresolvedItems: string;
};

export type FieldErrors = Partial<Record<keyof S0Intake, string>>;

export type ProjectSummary = {
  projectId: string;
  path: `projects/active/${string}`;
  workingTitle: string;
  domain: CanonicalDomain;
  outputTrack: OutputTrackId;
  currentStage: ProjectStage;
  nextGate: string;
  recommendedAction: string;
  evidenceStatus: ProjectStatusValue;
  riskStatus: ProjectStatusValue;
  humanGateStatus: "REQUIRED" | "CLEAR" | "UNVERIFIED";
  known: string[];
  unknown: string[];
  assumptions: string[];
  risks: string[];
  humanConfirmations: string[];
  artifactPaths: string[];
  source: "openclaw" | "preview" | "postgres";
};

export type ProjectPreview = ProjectSummary & {
  previewHash: string;
  source: "preview";
};

export type ProjectEnvelope = {
  status: "success" | "blocked" | "error";
  project_id?: string;
  path?: string;
  working_title?: string;
  domain?: string;
  output_track?: string;
  current_stage?: string;
  next_gate?: string;
  recommended_action?: string;
  evidence_status?: string;
  risk_status?: string;
  human_gate_status?: string;
  known?: unknown;
  unknown?: unknown;
  assumptions?: unknown;
  risks?: unknown;
  human_confirmations?: unknown;
  artifact_paths?: unknown;
  error_code?: string;
  error_message?: string;
};

export type ProjectListContract = {
  status: "success";
  projects: Array<Omit<ProjectEnvelope, "status">>;
};

export type ValidationResult =
  | { ok: true; value: S0Intake }
  | { ok: false; fieldErrors: FieldErrors; error: string };

const fieldLimits: Record<keyof S0Intake, number> = S0_FIELD_LIMITS;
const fieldLabels: Record<keyof S0Intake, string> = S0_FIELD_LABELS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

export function isSafeProjectId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && PROJECT_ID_PATTERN.test(value);
}

function isCanonicalDomain(value: string): value is CanonicalDomain {
  return canonicalDomains.includes(value as CanonicalDomain);
}

function isOutputTrack(value: string): value is OutputTrackId {
  return outputTrackIds.includes(value as OutputTrackId);
}

export function normalizeS0Intake(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, fieldErrors: {}, error: "S0 Intake 格式不正確" };

  const value = {} as S0Intake;
  const fieldErrors: FieldErrors = {};
  (Object.keys(fieldLimits) as Array<keyof S0Intake>).forEach((field) => {
    const cleaned = cleanString(input[field]);
    if (!cleaned) fieldErrors[field] = `${fieldLabels[field]}為必填欄位`;
    else if (cleaned.length > fieldLimits[field]) fieldErrors[field] = `${fieldLabels[field]}超過 ${fieldLimits[field]} 字元上限`;
    value[field] = cleaned as never;
  });

  if (value.domain && !isCanonicalDomain(value.domain)) fieldErrors.domain = "研究領域不在六大正式領域內";
  if (value.outputTrack && !isOutputTrack(value.outputTrack)) fieldErrors.outputTrack = "主成果路徑不正確";

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, error: "請修正 S0 Intake 欄位後再試" };
  return { ok: true, value };
}

export function isProjectStage(value: string): value is ProjectStage {
  return projectStages.includes(value as ProjectStage);
}

export function isProjectStatus(value: string): value is ProjectStatusValue {
  return projectStatusValues.includes(value as ProjectStatusValue);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 40 || value.some((item) => typeof item !== "string" || item.length > 1000)) {
    throw new Error(`invalid_${field}`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function extractJsonObject(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = (fenced || content).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseProjectEnvelope(content: string, expectedProjectId?: string): ProjectSummary | { status: "blocked" | "error"; code: string; message: string } {
  const parsed = extractJsonObject(content);
  if (!isRecord(parsed) || (parsed.status !== "success" && parsed.status !== "blocked" && parsed.status !== "error")) {
    return { status: "error", code: "invalid_machine_response", message: "Old Mike 回傳格式無法解析，未建立專案" };
  }
  const envelope = parsed as ProjectEnvelope;
  if (envelope.status !== "success") {
    return { status: envelope.status, code: cleanString(envelope.error_code) || "project_init_blocked", message: cleanString(envelope.error_message) || "Old Mike 尚未完成專案建立" };
  }

  const projectId = cleanString(envelope.project_id);
  const path = cleanString(envelope.path);
  const domain = cleanString(envelope.domain);
  const outputTrack = cleanString(envelope.output_track);
  const stage = cleanString(envelope.current_stage);
  const evidenceStatus = cleanString(envelope.evidence_status) || "UNVERIFIED";
  const riskStatus = cleanString(envelope.risk_status) || "UNVERIFIED";
  const humanGateStatus = cleanString(envelope.human_gate_status) || "REQUIRED";
  if (!isSafeProjectId(projectId) || (expectedProjectId && projectId !== expectedProjectId)) return { status: "error", code: "project_id_mismatch", message: "Old Mike 回傳的 Project ID 不符合安全契約，未建立專案" };
  if (path !== `projects/active/${projectId}`) return { status: "error", code: "project_path_mismatch", message: "Old Mike 回傳的專案路徑不符合安全契約，未建立專案" };
  if (!isCanonicalDomain(domain) || !isOutputTrack(outputTrack) || !isProjectStage(stage)) return { status: "error", code: "invalid_project_metadata", message: "Old Mike 回傳的專案 metadata 不完整，未建立專案" };
  if (!isProjectStatus(evidenceStatus) || !isProjectStatus(riskStatus) || !["REQUIRED", "CLEAR", "UNVERIFIED"].includes(humanGateStatus)) return { status: "error", code: "invalid_project_status", message: "Old Mike 回傳的專案狀態不完整，未建立專案" };
  const typedHumanGateStatus = humanGateStatus as "REQUIRED" | "CLEAR" | "UNVERIFIED";
  const recommendedAction = cleanString(envelope.recommended_action);
  const nextGate = cleanString(envelope.next_gate);
  const workingTitle = cleanString(envelope.working_title);
  if (!workingTitle || !nextGate || !recommendedAction) return { status: "error", code: "missing_project_gate", message: "Old Mike 未回傳完整的 stage、gate 或唯一建議行動，未建立專案" };

  try {
    const artifactPaths = stringArray(envelope.artifact_paths, "artifact_paths");
    const requiredArtifacts = new Set([`${path}/PROJECT.md`, `${path}/STATE.yaml`]);
    if (![...requiredArtifacts].every((item) => artifactPaths.includes(item))) return { status: "error", code: "missing_project_artifacts", message: "Old Mike 未確認正式專案檔案，未建立專案" };
    return {
      projectId,
      path: path as `projects/active/${string}`,
      workingTitle,
      domain,
      outputTrack,
      currentStage: stage,
      nextGate,
      recommendedAction,
      evidenceStatus,
      riskStatus,
      humanGateStatus: typedHumanGateStatus,
      known: stringArray(envelope.known, "known"),
      unknown: stringArray(envelope.unknown, "unknown"),
      assumptions: stringArray(envelope.assumptions, "assumptions"),
      risks: stringArray(envelope.risks, "risks"),
      humanConfirmations: stringArray(envelope.human_confirmations, "human_confirmations"),
      artifactPaths,
      source: "openclaw",
    };
  } catch {
    return { status: "error", code: "invalid_project_arrays", message: "Old Mike 回傳的專案清單欄位不完整，未建立專案" };
  }
}

export function parseProjectList(content: string): ProjectSummary[] | { status: "error"; code: string; message: string } {
  const parsed = extractJsonObject(content);
  if (!isRecord(parsed) || parsed.status !== "success" || !Array.isArray(parsed.projects) || parsed.projects.length > 100 || Object.keys(parsed).some((key) => key !== "status" && key !== "projects")) return { status: "error", code: "invalid_project_list", message: "Old Mike 回傳的專案清單無法解析" };
  const projects: ProjectSummary[] = [];
  for (const item of parsed.projects) {
    if (!isRecord(item)) return { status: "error", code: "invalid_project_list_item", message: "Old Mike 回傳的專案清單不完整" };
    const result = parseProjectEnvelope(JSON.stringify({ ...item, status: "success" }));
    if ("status" in result) return { status: "error", code: result.code, message: result.message };
    projects.push(result);
  }
  return projects;
}
