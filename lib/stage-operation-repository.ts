/**
 * Stage Operation Repository & Lock Engine (V3-U02-R1)
 *
 * Provides server-side persistence and strict optimistic locking:
 * - Direct API, autosave, sync, or AI cannot overwrite a locked field.
 * - Lock updates increment lock_version.
 * - Requirement issues evaluate and persist with deep-link navigation payloads.
 * - Stage completion snapshots provide immutable handoffs.
 */

import "server-only";

import { Pool, type PoolClient } from "pg";
import type {
  FieldLockRecord,
  RequirementIssue,
  StageCompletionSnapshot,
  TopicSelectionSnapshot,
  StageId,
  LockPolicy,
} from "./stage-operation-contracts.ts";

const _pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

function getPool(): Pool {
  if (!_pool) throw new Error("stage_operation_storage_unavailable");
  return _pool;
}

async function withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!_pool) throw new Error("stage_operation_storage_unavailable");
  const client = await _pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

export class StageOperationRepository {
  /**
   * Fetch all active locks for a project stage
   */
  static async getFieldLocks(
    workspaceId: string,
    projectId: string,
    stageId: StageId
  ): Promise<FieldLockRecord[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT * FROM field_locks 
       WHERE workspace_id = $1 AND project_id = $2 AND stage_id = $3`,
      [workspaceId, projectId, stageId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      projectId: r.project_id,
      stageId: r.stage_id,
      entityId: r.entity_id,
      fieldRef: r.field_ref,
      lockedValue: r.locked_value,
      lockVersion: r.lock_version,
      lockedByUserId: r.locked_by_user_id,
      lockReason: r.lock_reason,
      lockPolicy: r.lock_policy,
      sourceVersionId: r.source_version_id,
      isStale: r.is_stale,
      staleReason: r.stale_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  /**
   * Acquire or update a lock on a field
   */
  static async acquireFieldLock(params: {
    workspaceId: string;
    projectId: string;
    stageId: StageId;
    entityId?: string;
    fieldRef: string;
    lockedValue: any;
    userId?: string;
    lockReason?: string;
    lockPolicy?: LockPolicy;
    sourceVersionId?: string;
  }): Promise<FieldLockRecord> {
    const pool = getPool();
    const entityId = params.entityId || "default";
    const lockPolicy = params.lockPolicy || "MANUAL";

    const res = await pool.query(
      `INSERT INTO field_locks (
        workspace_id, project_id, stage_id, entity_id, field_ref,
        locked_value, lock_version, locked_by_user_id, lock_reason,
        lock_policy, source_version_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, NOW())
      ON CONFLICT (workspace_id, project_id, stage_id, entity_id, field_ref)
      DO UPDATE SET
        locked_value = EXCLUDED.locked_value,
        lock_version = field_locks.lock_version + 1,
        locked_by_user_id = EXCLUDED.locked_by_user_id,
        lock_reason = EXCLUDED.lock_reason,
        lock_policy = EXCLUDED.lock_policy,
        source_version_id = EXCLUDED.source_version_id,
        is_stale = false,
        stale_reason = NULL,
        updated_at = NOW()
      RETURNING *`,
      [
        params.workspaceId,
        params.projectId,
        params.stageId,
        entityId,
        params.fieldRef,
        JSON.stringify(params.lockedValue),
        params.userId || null,
        params.lockReason || null,
        lockPolicy,
        params.sourceVersionId || null,
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      projectId: r.project_id,
      stageId: r.stage_id,
      entityId: r.entity_id,
      fieldRef: r.field_ref,
      lockedValue: r.locked_value,
      lockVersion: r.lock_version,
      lockedByUserId: r.locked_by_user_id,
      lockReason: r.lock_reason,
      lockPolicy: r.lock_policy,
      sourceVersionId: r.source_version_id,
      isStale: r.is_stale,
      staleReason: r.stale_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  /**
   * Unlock a field
   */
  static async releaseFieldLock(
    workspaceId: string,
    projectId: string,
    stageId: StageId,
    fieldRef: string,
    entityId: string = "default"
  ): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query(
      `DELETE FROM field_locks 
       WHERE workspace_id = $1 AND project_id = $2 AND stage_id = $3 AND field_ref = $4 AND entity_id = $5`,
      [workspaceId, projectId, stageId, fieldRef, entityId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Check if an attempted field write violates an existing lock
   */
  static async assertFieldWritePermitted(params: {
    workspaceId: string;
    projectId: string;
    stageId: StageId;
    fieldRef: string;
    entityId?: string;
    expectedLockVersion?: number;
  }): Promise<{ permitted: boolean; reason?: string; existingLock?: FieldLockRecord }> {
    const pool = getPool();
    const entityId = params.entityId || "default";

    const res = await pool.query(
      `SELECT * FROM field_locks 
       WHERE workspace_id = $1 AND project_id = $2 AND stage_id = $3 AND field_ref = $4 AND entity_id = $5`,
      [params.workspaceId, params.projectId, params.stageId, params.fieldRef, entityId]
    );

    if (res.rows.length === 0) {
      return { permitted: true };
    }

    const lock = res.rows[0];
    if (params.expectedLockVersion !== undefined && lock.lock_version === params.expectedLockVersion) {
      return { permitted: true };
    }

    return {
      permitted: false,
      reason: `Field '${params.fieldRef}' is locked (version ${lock.lock_version}, policy ${lock.lock_policy}). Overwrite denied.`,
      existingLock: {
        id: lock.id,
        workspaceId: lock.workspace_id,
        projectId: lock.project_id,
        stageId: lock.stage_id,
        entityId: lock.entity_id,
        fieldRef: lock.field_ref,
        lockedValue: lock.locked_value,
        lockVersion: lock.lock_version,
        lockPolicy: lock.lock_policy,
        isStale: lock.is_stale,
        createdAt: lock.created_at.toISOString(),
        updatedAt: lock.updated_at.toISOString(),
      },
    };
  }

  /**
   * Replace/sync requirement issues for a project stage
   */
  static async syncRequirementIssues(
    workspaceId: string,
    projectId: string,
    stageId: StageId,
    issues: Omit<RequirementIssue, "issueId" | "evaluatedAt">[]
  ): Promise<RequirementIssue[]> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Remove stale issues for this stage
      await client.query(
        `DELETE FROM requirement_issues 
         WHERE workspace_id = $1 AND project_id = $2 AND stage_id = $3`,
        [workspaceId, projectId, stageId]
      );

      const saved: RequirementIssue[] = [];
      for (const iss of issues) {
        const res = await client.query(
          `INSERT INTO requirement_issues (
            workspace_id, project_id, stage_id, requirement_id, entity_id,
            field_ref, status, blocks_transition, message, expected_revision,
            destination, assist_actions, requires_user_fact, return_context_id, evaluated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          RETURNING *`,
          [
            workspaceId,
            projectId,
            stageId,
            iss.requirementId,
            iss.entityId || "default",
            iss.fieldRef,
            iss.status,
            iss.blocksTransition,
            iss.message,
            iss.expectedRevision || null,
            JSON.stringify(iss.destination),
            iss.assistActions,
            iss.requiresUserFact,
            iss.returnContextId || null,
          ]
        );
        const r = res.rows[0];
        saved.push({
          issueId: r.id,
          projectId: r.project_id,
          stageId: r.stage_id,
          requirementId: r.requirement_id,
          entityId: r.entity_id,
          fieldRef: r.field_ref,
          status: r.status,
          blocksTransition: r.blocks_transition,
          message: r.message,
          expectedRevision: r.expected_revision,
          destination: r.destination,
          assistActions: r.assist_actions,
          requiresUserFact: r.requires_user_fact,
          returnContextId: r.return_context_id,
          evaluatedAt: r.evaluated_at.toISOString(),
        });
      }

      await client.query("COMMIT");
      return saved;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Save an immutable StageCompletionSnapshot with idempotency protection
   */
  static async saveCompletionSnapshot(params: {
    workspaceId: string;
    projectId: string;
    stageId: StageId;
    snapshotData: Record<string, any>;
    topicSnapshot?: TopicSelectionSnapshot | null;
    lockManifest?: any[];
    handoffLimitations?: string[];
    downstreamOpenRequirements?: string[];
    nextStageId?: string;
    userId?: string;
    idempotencyKey?: string;
  }): Promise<StageCompletionSnapshot> {
    const pool = getPool();

    // Idempotency check: if existing with same key, return without recreating
    if (params.idempotencyKey) {
      const existing = await pool.query(
        `SELECT * FROM stage_completion_snapshots 
         WHERE workspace_id = $1 AND project_id = $2 AND stage_id = $3 AND idempotency_key = $4`,
        [params.workspaceId, params.projectId, params.stageId, params.idempotencyKey]
      );
      if (existing.rows.length > 0) {
        const r = existing.rows[0];
        return {
          id: r.id,
          workspaceId: r.workspace_id,
          projectId: r.project_id,
          stageId: r.stage_id,
          status: r.status,
          snapshotData: r.snapshot_data,
          topicSnapshot: r.topic_snapshot,
          lockManifest: r.lock_manifest,
          handoffLimitations: r.handoff_limitations,
          downstreamOpenRequirements: r.downstream_open_requirements,
          nextStageId: r.next_stage_id,
          createdByUserId: r.created_by_user_id,
          idempotencyKey: r.idempotency_key,
          createdAt: r.created_at.toISOString(),
        };
      }
    }

    const res = await pool.query(
      `INSERT INTO stage_completion_snapshots (
        workspace_id, project_id, stage_id, status, snapshot_data,
        topic_snapshot, lock_manifest, handoff_limitations, downstream_open_requirements,
        next_stage_id, created_by_user_id, idempotency_key, created_at
      ) VALUES ($1, $2, $3, 'COMPLETED', $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        params.workspaceId,
        params.projectId,
        params.stageId,
        JSON.stringify(params.snapshotData || {}),
        params.topicSnapshot ? JSON.stringify(params.topicSnapshot) : null,
        JSON.stringify(params.lockManifest || []),
        JSON.stringify(params.handoffLimitations || []),
        JSON.stringify(params.downstreamOpenRequirements || []),
        params.nextStageId || null,
        params.userId || null,
        params.idempotencyKey || null,
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      projectId: r.project_id,
      stageId: r.stage_id,
      status: r.status,
      snapshotData: r.snapshot_data,
      topicSnapshot: r.topic_snapshot,
      lockManifest: r.lock_manifest,
      handoffLimitations: r.handoff_limitations,
      downstreamOpenRequirements: r.downstream_open_requirements,
      nextStageId: r.next_stage_id,
      createdByUserId: r.created_by_user_id,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at.toISOString(),
    };
  }
}
