import "server-only";

import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { resolveResearchTenant } from "@/lib/research-repository";
import type { AdoptionWorkOrder } from "@/lib/real-project-adoption-v3-contract";
import type { ArtifactManifestEntry } from "@/lib/artifact-request-contract";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

type AppendParams = {
  userId: string;
  projectId: string;
  idempotencyKey: string;
  workOrderId: string;
  authorizationId: string;
  filename: string;
  format: ArtifactManifestEntry["format"];
  bytes: number;
  contentBase64: string;
};

type AppendOk = {
  ok: true;
  artifactId: string;
  entry: ArtifactManifestEntry;
  workOrderStatus: AdoptionWorkOrder["status"];
};

type AppendFailure = {
  ok: false;
  code:
    | "work_order_not_found"
    | "authorization_revoked"
    | "authorization_expired"
    | "work_order_not_running"
    | "storage_unavailable"
    | "idempotency_conflict";
  error: string;
};

export async function artifactAppend(params: AppendParams): Promise<AppendOk | AppendFailure> {
  if (!pool) return { ok: false, code: "storage_unavailable", error: "Artifact storage is not configured." };

  // 1) 租戶與專案授權檢查：申請者必須是該專案成員
  let tenant;
  try {
    tenant = await resolveResearchTenant(params.userId, params.projectId);
  } catch {
    return { ok: false, code: "storage_unavailable", error: "Tenant resolution unavailable." };
  }
  if (!tenant) return { ok: false, code: "work_order_not_found", error: "Project not found for this user." };

  try {
    return await withClient(async (client) => {
      // 2) 冪等：同 workspace + idempotencyKey 已存在則直接回傳原結果
      const existing = await client.query(
        `SELECT artifact_id, work_order_id FROM artifact_requests WHERE workspace_id=$1 AND idempotency_key=$2`,
        [tenant.workspaceId, params.idempotencyKey],
      );
      if ((existing.rowCount ?? 0) > 0) {
        const row = existing.rows[0] as Record<string, unknown>;
        if (String(row.work_order_id) !== params.workOrderId) {
          return { ok: false as const, code: "idempotency_conflict" as const, error: "Idempotency key already used for a different work order." };
        }
        const prior = await loadArtifact(client, tenant.workspaceId, String(row.artifact_id));
        if (prior) return { ok: true as const, ...prior };
      }

      // 3) Work order 存在且屬於此專案、狀態為 RUNNING
      const workOrderRow = await client.query(
        `SELECT work_order_id, status FROM adoption_work_orders WHERE workspace_id=$1 AND project_id=$2 AND work_order_id=$3`,
        [tenant.workspaceId, tenant.projectId, params.workOrderId],
      );
      if ((workOrderRow.rowCount ?? 0) === 0) {
        return { ok: false as const, code: "work_order_not_found" as const, error: "Adoption work order not found in this project." };
      }
      const workOrderStatus = String((workOrderRow.rows[0] as Record<string, unknown>).status) as AdoptionWorkOrder["status"];
      if (workOrderStatus !== "RUNNING") {
        return { ok: false as const, code: "work_order_not_running" as const, error: `Work order status is ${workOrderStatus}; writes require RUNNING.` };
      }

      // 4) 授權有效且屬於此 work order
      const authzRow = await client.query(
        `SELECT is_revoked, valid_until FROM project_work_authorizations WHERE workspace_id=$1 AND authorization_id=$2 AND work_order_id=$3`,
        [tenant.workspaceId, params.authorizationId, params.workOrderId],
      );
      if ((authzRow.rowCount ?? 0) === 0) {
        return { ok: false as const, code: "work_order_not_found" as const, error: "Authorization not found for this work order." };
      }
      const authz = authzRow.rows[0] as Record<string, unknown>;
      if (authz.is_revoked === true) {
        return { ok: false as const, code: "authorization_revoked" as const, error: "Authorization has been revoked." };
      }
      if (new Date(String(authz.valid_until)).getTime() < Date.now()) {
        return { ok: false as const, code: "authorization_expired" as const, error: "Authorization has expired." };
      }

      // 5) 寫入 manifest 與內容（content 僅存雜湊與 base64 原文於獨立欄位）
      const artifactId = `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const sha256 = createHash("sha256").update(params.contentBase64, "utf8").digest("hex");
      const storageRef = `artifact-requests/${tenant.workspaceId}/${tenant.projectId}/${params.workOrderId}/${artifactId}`;
      const nowIso = new Date().toISOString();
      await client.query(
        `INSERT INTO artifact_requests (artifact_id, workspace_id, project_id, work_order_id, authorization_id, idempotency_key, filename, format, bytes, sha256, storage_ref, content_base64, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [artifactId, tenant.workspaceId, tenant.projectId, params.workOrderId, params.authorizationId, params.idempotencyKey, params.filename, params.format, params.bytes, sha256, storageRef, params.contentBase64, nowIso],
      );
      return {
        ok: true as const,
        artifactId,
        entry: { filename: params.filename, format: params.format, bytes: params.bytes, sha256, storageRef, createdAt: nowIso },
        workOrderStatus,
      };
    });
  } catch {
    return { ok: false, code: "storage_unavailable", error: "Artifact storage operation failed." };
  }
}

async function withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error("artifact_request_storage_unavailable");
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

async function loadArtifact(client: PoolClient, workspaceId: string, artifactId: string): Promise<{ artifactId: string; entry: ArtifactManifestEntry; workOrderStatus: AdoptionWorkOrder["status"] } | null> {
  const row = await client.query(
    `SELECT r.artifact_id, r.filename, r.format, r.bytes, r.sha256, r.storage_ref, r.created_at, w.status AS work_order_status
     FROM artifact_requests r LEFT JOIN adoption_work_orders w ON w.workspace_id=r.workspace_id AND w.work_order_id=r.work_order_id
     WHERE r.workspace_id=$1 AND r.artifact_id=$2`,
    [workspaceId, artifactId],
  );
  if ((row.rowCount ?? 0) === 0) return null;
  const r = row.rows[0] as Record<string, unknown>;
  return {
    artifactId: String(r.artifact_id),
    entry: {
      filename: String(r.filename),
      format: String(r.format) as ArtifactManifestEntry["format"],
      bytes: Number(r.bytes),
      sha256: String(r.sha256),
      storageRef: String(r.storage_ref),
      createdAt: String(r.created_at),
    },
    workOrderStatus: (r.work_order_status ? String(r.work_order_status) : "RUNNING") as AdoptionWorkOrder["status"],
  };
}

export const artifactStore = { append: artifactAppend };
