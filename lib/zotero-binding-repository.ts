import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("zotero_binding_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function tenantWhere(): string { return "workspace_id=$1 AND project_id=$2"; }
type Row = Record<string, unknown>;

export type ZoteroProjectBinding = {
  id: string;
  libraryType: "user" | "group";
  libraryId: string;
  collectionKey: string;
  collectionName: string | null;
  bindingStatus: string;
  itemVersion: number | null;
  libraryVersion: number | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ZoteroBindingRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "ZoteroBindingRepositoryError"; this.code = code; this.status = status; }
}

async function rowToBinding(row: Row): Promise<ZoteroProjectBinding> {
  return {
    id: text(row.id),
    libraryType: text(row.library_type) as "user" | "group",
    libraryId: text(row.library_id),
    collectionKey: text(row.collection_key),
    collectionName: row.collection_name === null ? null : text(row.collection_name),
    bindingStatus: text(row.binding_status),
    itemVersion: row.item_version === null ? null : Number(row.item_version),
    libraryVersion: row.library_version === null ? null : Number(row.library_version),
    lastSuccessfulSyncAt: row.last_successful_sync_at ? (row.last_successful_sync_at instanceof Date ? row.last_successful_sync_at.toISOString() : text(row.last_successful_sync_at)) : null,
    lastError: row.last_error === null ? null : text(row.last_error),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : text(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : text(row.updated_at),
  };
}

export async function listZoteroProjectBindings(tenant: ResearchTenant): Promise<ZoteroProjectBinding[]> {
  return withClient(async (client) => {
    const rows = (await client.query(
      `SELECT id, library_type, library_id, collection_key, collection_name, binding_status, item_version, library_version, last_successful_sync_at, last_error, created_at, updated_at
         FROM zotero_project_bindings WHERE ${tenantWhere()} ORDER BY updated_at DESC`,
      [tenant.workspaceId, tenant.projectId],
    )).rows as Row[];
    return Promise.all(rows.map((row) => rowToBinding(row)));
  });
}

export async function upsertZoteroProjectBinding(tenant: ResearchTenant, input: {
  userId: string;
  libraryType: "user" | "group";
  libraryId: string;
  collectionKey: string | null;
  collectionName: string | null;
  bindingStatus: string;
  itemVersion?: number | null;
  libraryVersion?: number | null;
  lastSuccessfulSyncAt?: Date | null;
  lastError?: string | null;
}): Promise<ZoteroProjectBinding> {
  return withClient(async (client) => {
    const id = `zb_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const existing = (await client.query(
      `SELECT id FROM zotero_project_bindings WHERE ${tenantWhere()} AND library_type=$3 AND library_id=$4 AND collection_key IS NOT DISTINCT FROM $5 LIMIT 1`,
      [tenant.workspaceId, tenant.projectId, input.libraryType, input.libraryId, input.collectionKey],
    )).rows[0] as { id: string } | undefined;
    const row = (await client.query(
      `INSERT INTO zotero_project_bindings (id, workspace_id, project_id, library_type, library_id, collection_key, collection_name, binding_status, item_version, library_version, last_successful_sync_at, last_error, created_by_user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
       ON CONFLICT (workspace_id, project_id, library_type, library_id, collection_key) DO UPDATE SET
         collection_name = EXCLUDED.collection_name,
         binding_status = EXCLUDED.binding_status,
         item_version = COALESCE(EXCLUDED.item_version, zotero_project_bindings.item_version),
         library_version = COALESCE(EXCLUDED.library_version, zotero_project_bindings.library_version),
         last_successful_sync_at = COALESCE(EXCLUDED.last_successful_sync_at, zotero_project_bindings.last_successful_sync_at),
         last_error = EXCLUDED.last_error,
         updated_at = now()
       RETURNING id, library_type, library_id, collection_key, collection_name, binding_status, item_version, library_version, last_successful_sync_at, last_error, created_at, updated_at`,
      [existing?.id ?? id, tenant.workspaceId, tenant.projectId, input.libraryType, input.libraryId, input.collectionKey, input.collectionName, input.bindingStatus,
        input.itemVersion ?? null, input.libraryVersion ?? null, input.lastSuccessfulSyncAt ?? null, input.lastError ?? null, input.userId],
    )).rows[0] as Row;
    return rowToBinding(row);
  });
}

export async function markProjectBindingsDisconnected(tenant: ResearchTenant, userId: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE zotero_project_bindings SET binding_status='DISABLED', updated_at=now(), last_error='連線已撤銷（資料保留；本地文獻不受影響）' WHERE ${tenantWhere()} AND binding_status NOT IN ('DISABLED')`,
      [tenant.workspaceId, tenant.projectId],
    );
    return result.rowCount ?? 0;
  });
}
