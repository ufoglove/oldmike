import { isSafeProjectId, projectStatusValues } from "./project-contract.ts";

export const OPENCLAW_ACTIVE_PROJECTS_PREFIX = "/home/node/.openclaw/workspace/projects/active/";

export const PROJECT_LIST_FIELDS = [
  "project_id",
  "path",
  "working_title",
  "domain",
  "output_track",
  "current_stage",
  "next_gate",
  "recommended_action",
  "evidence_status",
  "risk_status",
  "human_gate_status",
  "known",
  "unknown",
  "assumptions",
  "risks",
  "human_confirmations",
  "artifact_paths",
] as const;

const humanGateStatusValues = ["REQUIRED", "CLEAR", "UNVERIFIED"] as const;
const projectStatusSet = new Set<string>(projectStatusValues);
const humanGateStatusSet = new Set<string>(humanGateStatusValues);
type RecordValue = Record<string, unknown>;
type CompatibilityField = "evidence_status" | "risk_status" | "human_gate_status";

export type CompatibilityWarningField = {
  field: CompatibilityField;
  original: string;
  canonical: string;
  reason: string;
};

export type CompatibilityWarning = {
  projectId: string;
  code: "LEGACY_STATUS_NORMALIZED";
  fields: CompatibilityWarningField[];
};

type CanonicalSuccess = {
  ok: true;
  content: string;
  compatibilityWarnings: CompatibilityWarning[];
};

export type CanonicalizeProjectListResult =
  | CanonicalSuccess
  | { ok: false; code: string; message: string };

export type CanonicalizeProjectEnvelopeResult = CanonicalizeProjectListResult;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactlyKeys(value: RecordValue, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return JSON.stringify(actual) === JSON.stringify(wanted);
}

function warningField(field: CompatibilityField, original: string): CompatibilityWarningField | null {
  if (field === "evidence_status" && original === "unverified") {
    return {
      field,
      original,
      canonical: "UNVERIFIED",
      reason: "Legacy evidence status is retained as unverified",
    };
  }
  if (field === "risk_status" && original === "high") {
    return {
      field,
      original,
      canonical: "BLOCKED",
      reason: "Legacy risk severity conservatively blocks progression",
    };
  }
  if (field === "human_gate_status" && original === "pending") {
    return {
      field,
      original,
      canonical: "REQUIRED",
      reason: "Pending legacy human gate requires confirmation",
    };
  }
  return null;
}

function canonicalStatus(
  value: unknown,
  allowed: Set<string>,
  field: CompatibilityField,
  warningFields: CompatibilityWarningField[],
): string | null {
  if (typeof value !== "string") return null;
  if (allowed.has(value)) return value;
  const warning = warningField(field, value);
  if (!warning || !allowed.has(warning.canonical)) return null;
  warningFields.push(warning);
  return warning.canonical;
}

function canonicalProjectPath(value: unknown, projectId: string): string | null {
  if (typeof value !== "string" || value.includes("\\")) return null;
  const relative = `projects/active/${projectId}`;
  const exactOpenClawPath = `${OPENCLAW_ACTIVE_PROJECTS_PREFIX}${projectId}`;
  if (value === relative || value === exactOpenClawPath) return relative;
  return null;
}

function canonicalArtifactPath(value: unknown, projectId: string): string | null {
  if (typeof value !== "string" || value.includes("\\")) return null;
  const relativeBase = `projects/active/${projectId}`;
  const exactOpenClawBase = `${OPENCLAW_ACTIVE_PROJECTS_PREFIX}${projectId}`;
  for (const artifact of ["PROJECT.md", "STATE.yaml"]) {
    if (value === `${relativeBase}/${artifact}` || value === `${exactOpenClawBase}/${artifact}`) {
      return `${relativeBase}/${artifact}`;
    }
  }
  return null;
}

function invalid(code: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message: "Old Mike project response failed the canonical path/status contract" };
}

function parseExactJson(content: string): unknown | null {
  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function canonicalizeProjectObject(
  item: RecordValue,
  expectedProjectId?: string,
): { ok: true; project: RecordValue; warning: CompatibilityWarning | null } | { ok: false; code: string; message: string } {
  if (!hasExactlyKeys(item, PROJECT_LIST_FIELDS)) return invalid("invalid_project_list_item");
  const projectId = item.project_id;
  if (!isSafeProjectId(projectId) || (expectedProjectId && projectId !== expectedProjectId)) return invalid("project_id_mismatch");

  const path = canonicalProjectPath(item.path, projectId);
  if (!path) return invalid("project_path_mismatch");

  const artifactPaths = item.artifact_paths;
  if (!Array.isArray(artifactPaths) || artifactPaths.length !== 2) return invalid("invalid_artifact_paths");
  const canonicalArtifacts = artifactPaths.map((artifact) => canonicalArtifactPath(artifact, projectId));
  if (canonicalArtifacts.some((artifact) => artifact === null)) return invalid("invalid_artifact_paths");
  const artifacts = canonicalArtifacts as string[];
  const expectedArtifacts = new Set([`${path}/PROJECT.md`, `${path}/STATE.yaml`]);
  if (new Set(artifacts).size !== 2 || artifacts.some((artifact) => !expectedArtifacts.has(artifact))) {
    return invalid("invalid_artifact_paths");
  }

  const warningFields: CompatibilityWarningField[] = [];
  const evidenceStatus = canonicalStatus(item.evidence_status, projectStatusSet, "evidence_status", warningFields);
  const riskStatus = canonicalStatus(item.risk_status, projectStatusSet, "risk_status", warningFields);
  const humanGateStatus = canonicalStatus(item.human_gate_status, humanGateStatusSet, "human_gate_status", warningFields);
  if (!evidenceStatus || !riskStatus || !humanGateStatus) return invalid("invalid_project_status");

  return {
    ok: true,
    project: {
      ...item,
      path,
      evidence_status: evidenceStatus,
      risk_status: riskStatus,
      human_gate_status: humanGateStatus,
      artifact_paths: artifacts,
    },
    warning: warningFields.length
      ? { projectId: projectId as string, code: "LEGACY_STATUS_NORMALIZED", fields: warningFields }
      : null,
  };
}

export function canonicalizeProjectListContent(content: string): CanonicalizeProjectListResult {
  const parsed = parseExactJson(content);
  if (!isRecord(parsed) || !hasExactlyKeys(parsed, ["status", "projects"]) || parsed.status !== "success") {
    return invalid("invalid_project_list");
  }
  if (!Array.isArray(parsed.projects) || parsed.projects.length > 100) return invalid("invalid_project_list");

  const projects: RecordValue[] = [];
  const compatibilityWarnings: CompatibilityWarning[] = [];
  for (const item of parsed.projects) {
    if (!isRecord(item)) return invalid("invalid_project_list_item");
    const canonical = canonicalizeProjectObject(item);
    if (!canonical.ok) return canonical;
    projects.push(canonical.project);
    if (canonical.warning) compatibilityWarnings.push(canonical.warning);
  }

  return { ok: true, content: JSON.stringify({ status: "success", projects }), compatibilityWarnings };
}

export function canonicalizeProjectEnvelopeContent(content: string, expectedProjectId: string): CanonicalizeProjectEnvelopeResult {
  if (!isSafeProjectId(expectedProjectId)) return invalid("project_id_mismatch");
  const parsed = parseExactJson(content);
  if (!isRecord(parsed) || typeof parsed.status !== "string") return invalid("invalid_machine_response");

  if (parsed.status === "blocked" || parsed.status === "error") {
    const allowedKeys = ["status", "error_code", "error_message", "project_id"];
    if (Object.keys(parsed).some((key) => !allowedKeys.includes(key))) return invalid("invalid_machine_response");
    if (parsed.project_id !== undefined && parsed.project_id !== expectedProjectId) return invalid("project_id_mismatch");
    return { ok: true, content: JSON.stringify(parsed), compatibilityWarnings: [] };
  }
  if (parsed.status !== "success") return invalid("invalid_machine_response");

  const project = { ...parsed };
  delete project.status;
  const canonical = canonicalizeProjectObject(project, expectedProjectId);
  if (!canonical.ok) return canonical;
  return {
    ok: true,
    content: JSON.stringify({ status: "success", ...canonical.project }),
    compatibilityWarnings: canonical.warning ? [canonical.warning] : [],
  };
}
