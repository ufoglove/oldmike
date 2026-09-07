/**
 * Artifact Request Contract (artifact-request/1.0.0)
 * Spec: docs/operations/V3-R03 — Artifact 申請 API
 *
 * 定位：使用者透過 API 對既有 AdoptionWorkOrder 申請寫入成品（artifact）。
 * 安全邊界：
 * - 一律 requireAuthenticatedUser；寫入僅限申請者自己的 workspace 專案。
 * - 每次寫入必須對應已授權、未撤銷且未過期的 ProjectWorkAuthorization。
 * - 永不觸發：投稿、付款、對外傳送、原始研究事實改寫、未授權生產變更。
 * - Body 上限 65_536 bytes；冪等以 idempotencyKey 為準。
 */

import type {
  AdoptionWorkOrder,
  DeliveryIntent,
  FirstDeliverableManifest,
} from "@/lib/real-project-adoption-v3-contract";

export const ARTIFACT_REQUEST_CONTRACT_VERSION = "artifact-request/1.0.0" as const;
export const ARTIFACT_REQUEST_MAX_BODY_BYTES = 65_536;

export type ArtifactRequestErrorCode =
  | "auth_configuration_missing"
  | "unauthorized"
  | "account_disabled"
  | "password_change_required"
  | "origin_rejected"
  | "body_too_large"
  | "malformed_body"
  | "work_order_not_found"
  | "authorization_revoked"
  | "authorization_expired"
  | "work_order_not_running"
  | "storage_unavailable"
  | "idempotency_conflict"
  | "internal_error";

export type ArtifactWriteAuthorization = {
  authorizationRef: string;
  projectId: string;
  workOrderId: string;
  targetDeliverable: DeliveryIntent;
  allowedFormats: FirstDeliverableManifest["outputArtifacts"][number]["format"][];
  maxTotalBytes: number;
  validUntil: string; // ISO-8601
  isRevoked: false;
};

export type ArtifactManifestEntry = {
  filename: string;
  format: FirstDeliverableManifest["outputArtifacts"][number]["format"];
  bytes: number;
  sha256: string;
  storageRef: string;
  createdAt: string;
};

export type ArtifactRequestBody = {
  contractVersion: typeof ARTIFACT_REQUEST_CONTRACT_VERSION;
  idempotencyKey: string;
  workOrderId: string;
  authorizationId: string;
  entry: {
    filename: string; // 不含路徑分隔符
    format: ArtifactManifestEntry["format"];
    contentBase64: string;
  };
};

export type ArtifactRequestSuccess = {
  ok: true;
  contractVersion: typeof ARTIFACT_REQUEST_CONTRACT_VERSION;
  artifactId: string;
  manifestEntry: ArtifactManifestEntry;
  workOrderStatus: AdoptionWorkOrder["status"];
};

export type ArtifactRequestFailure = {
  ok: false;
  code: ArtifactRequestErrorCode;
  error: string;
};

export type ArtifactRequestResponse = ArtifactRequestSuccess | ArtifactRequestFailure;

export function isArtifactRequestBody(value: unknown): value is ArtifactRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (body.contractVersion !== ARTIFACT_REQUEST_CONTRACT_VERSION) return false;
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length === 0 || body.idempotencyKey.length > 128) return false;
  if (typeof body.workOrderId !== "string" || !body.workOrderId.startsWith("awo_")) return false;
  if (typeof body.authorizationId !== "string" || body.authorizationId.length === 0) return false;
  const entry = body.entry as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== "object") return false;
  if (typeof entry.filename !== "string" || entry.filename.length === 0 || entry.filename.includes("/") || entry.filename.includes("\\") || entry.filename.includes("..")) return false;
  if (entry.format !== "MARKDOWN" && entry.format !== "JSON" && entry.format !== "DOCX" && entry.format !== "PDF") return false;
  if (typeof entry.contentBase64 !== "string" || entry.contentBase64.length === 0) return false;
  return true;
}

export function isAuthorizationValid(
  authorization: ProjectWorkAuthorizationLike,
  now: Date = new Date(),
): { ok: true } | { ok: false; code: Extract<ArtifactRequestErrorCode, "authorization_revoked" | "authorization_expired"> } {
  if (authorization.isRevoked) return { ok: false, code: "authorization_revoked" };
  if (new Date(authorization.validUntil).getTime() < now.getTime()) return { ok: false, code: "authorization_expired" };
  return { ok: true };
}

// 最小結構相容型別（避免循環依賴具體 DB 型別）
export type ProjectWorkAuthorizationLike = {
  isRevoked: boolean;
  validUntil: string;
  targetDeliverable: DeliveryIntent;
};

export function base64ByteLength(contentBase64: string): number {
  return Math.floor((contentBase64.length * 3) / 4);
}
