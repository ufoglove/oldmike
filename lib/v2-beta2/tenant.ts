import "server-only";

import type { Pool } from "pg";
import { parseV2Beta2ProjectId } from "./contracts.ts";

export type V2Beta2ResearchTenant = {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: "owner" | "member";
  projectTitle: string;
};

function exactUserId(value: unknown) {
  if (typeof value !== "string" || value !== value.trim() || value.length < 3 || value.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(value)) throw new Error("beta2_user_id_invalid");
  return value;
}

export async function resolveResearchTenant(pool: Pool, userId: string, projectId: string): Promise<V2Beta2ResearchTenant | null> {
  const safeUserId = exactUserId(userId);
  const safeProjectId = parseV2Beta2ProjectId(projectId);
  const result = await pool.query<V2Beta2ResearchTenant>(
    `SELECT p.workspace_id AS "workspaceId", p.project_id AS "projectId", m.user_id AS "userId",
            m.role, p.title AS "projectTitle"
       FROM projects p
       JOIN workspace_members m
         ON m.workspace_id = p.workspace_id
        AND m.user_id = $1
        AND m.role IN ('owner','member')
      WHERE p.project_id = $2
        AND p.status = 'ACTIVE'
        AND p.legacy = false`,
    [safeUserId, safeProjectId],
  );
  if (result.rowCount !== 1) return null;
  const row = result.rows[0];
  if (!row || row.projectId !== safeProjectId || row.userId !== safeUserId || !["owner", "member"].includes(row.role)) return null;
  return row;
}
