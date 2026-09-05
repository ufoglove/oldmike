import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "./auth-config.ts";
import { canAccessProject, listProjectsForUser, type ProjectRecord, type TenantFixture, type TenantUser } from "./tenant-model.ts";
import type { S0Intake } from "./project-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export type ProjectCreateInput = {
  identity: TenantUser;
  projectId: string;
  previewHash: string;
  intake: S0Intake;
};

export type ProjectCreateResult = {
  projectId: string;
  title: string;
  status: "ACTIVE";
  storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE";
  intakePersistence: "APPEND_ONLY_RESEARCH_DOCUMENT" | "PENDING_ARTIFACT_COMMITMENT";
  idempotent: boolean;
};

export type ProjectRemoveResult = {
  projectId: string;
  removed: boolean;
  deleted: {
    projects: number;
    artifacts: number;
    children: number;
  };
};

export type TenantRepository = {
  list(identity: TenantUser): Promise<ProjectRecord[]>;
  get(identity: TenantUser, projectId: string): Promise<ProjectRecord | null>;
  canCreate(identity: TenantUser): Promise<boolean>;
  create(input: ProjectCreateInput): Promise<ProjectCreateResult>;
  remove(identity: TenantUser, projectId: string): Promise<ProjectRemoveResult>;
  listTrashed(identity: TenantUser): Promise<ProjectRecord[]>;
  trash(identity: TenantUser, projectId: string): Promise<{ projectId: string; trashed: boolean }>;
  restore(identity: TenantUser, projectId: string): Promise<{ projectId: string; restored: boolean }>;
};

export class TenantStorageUnavailable extends Error {
  constructor() { super("tenant_storage_not_ready"); this.name = "TenantStorageUnavailable"; }
}

export class TenantProjectUnauthorized extends Error {
  readonly code = "project_create_unauthorized";
  constructor() { super("project_create_unauthorized"); this.name = "TenantProjectUnauthorized"; }
}


export class TenantProjectRemoveFailed extends Error {
  readonly code = "project_reset_failed";
  constructor(message = "project_reset_failed") { super(message); this.name = "TenantProjectRemoveFailed"; }
}

export class TenantProjectConflict extends Error {
  readonly code = "project_create_conflict";
  constructor() { super("project_create_conflict"); this.name = "TenantProjectConflict"; }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalS0Intake(intake: S0Intake) {
  return JSON.stringify({
    contractVersion: "old-mike-s0-intake/1.0.0",
    workingTitle: intake.workingTitle,
    domain: intake.domain,
    outputTrack: intake.outputTrack,
    problemContext: intake.problemContext,
    targetUsers: intake.targetUsers,
    expectedContribution: intake.expectedContribution,
    existingData: intake.existingData,
    availableData: intake.availableData,
    methodIdea: intake.methodIdea,
    timeline: intake.timeline,
    constraints: intake.constraints,
    ethicsPrivacyRisks: intake.ethicsPrivacyRisks,
    unresolvedItems: intake.unresolvedItems,
  });
}

function authorityIds(input: ProjectCreateInput) {
  const scope = sha256(`${input.identity.workspaceId}\n${input.projectId}`);
  return { artifactId: `artifact_s0_${scope.slice(0, 32)}`, documentId: `document_s0_${scope.slice(0, 32)}` };
}

async function coreSchemaAvailable(client: PoolClient) {
  const result = await client.query<{ projects: boolean; artifacts: boolean; members: boolean }>(
    `SELECT to_regclass('public.projects') IS NOT NULL AS projects,
            to_regclass('public.project_artifacts') IS NOT NULL AS artifacts,
            to_regclass('public.workspace_members') IS NOT NULL AS members`,
  );
  const row = result.rows[0];
  return Boolean(row?.projects && row.artifacts && row.members);
}

async function researchDocumentsSupported(client: PoolClient) {
  const required = ["id", "logical_id", "version_number", "workspace_id", "project_id", "created_by_user_id", "document_type", "title", "body", "content_hash", "stage_detail"];
  const result = await client.query<{ relationPresent: boolean; columns: number; appendOnlyTrigger: boolean }>(
    `SELECT to_regclass('public.research_documents') IS NOT NULL AS "relationPresent",
            (SELECT count(*)::int FROM information_schema.columns
              WHERE table_schema='public' AND table_name='research_documents' AND column_name = ANY($1::text[])) AS columns,
            EXISTS (
              SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname='research_documents'
                 AND t.tgname='research_documents_append_only' AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal
            ) AS "appendOnlyTrigger"`,
    [required],
  );
  const row = result.rows[0];
  return Boolean(row?.relationPresent && row.columns === required.length && row.appendOnlyTrigger);
}

async function auditSupported(client: PoolClient) {
  const required = ["workspace_id", "user_id", "event_type", "outcome", "metadata"];
  const result = await client.query<{ relationPresent: boolean; columns: number }>(
    `SELECT to_regclass('public.audit_events') IS NOT NULL AS "relationPresent",
            (SELECT count(*)::int FROM information_schema.columns
              WHERE table_schema='public' AND table_name='audit_events' AND column_name = ANY($1::text[])) AS columns`,
    [required],
  );
  return Boolean(result.rows[0]?.relationPresent && result.rows[0]?.columns === required.length);
}

/**
 * Better Auth owns account/session records. This hook creates the separate
 * personal workspace index after the user record is created. It never creates
 * an agent directory and it cannot claim the shared legacy project.
 */
export async function ensurePersonalWorkspace(user: { id: string; name?: string | null }) {
  if (!pool || !authConfiguration().ready) throw new TenantStorageUnavailable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const workspace = await client.query<{ id: string }>(
      "INSERT INTO workspaces (id, name, owner_user_id) VALUES ($1, $2, $3) ON CONFLICT (owner_user_id) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [`ws_${randomUUID()}`, `${user.name?.trim() || "Personal"} Workspace`, user.id],
    );
    const workspaceId = workspace.rows[0]?.id;
    if (!workspaceId) throw new TenantStorageUnavailable();
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'",
      [workspaceId, user.id],
    );
    await client.query("COMMIT");
    return workspaceId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Research tables protected by the `research_append_only_guard` trigger.
 * A project reset must temporarily disable these triggers inside its own
 * transaction so the append-only ledger can be removed together with the
 * project it belongs to. Trigger state is restored before COMMIT; any error
 * rolls the whole transaction back including trigger state.
 */

/**
 * Tables that reference themselves through `supersedes_version_id` with
 * ON DELETE RESTRICT. Rows must be removed newest-first (rows that no other
 * row in the same table still references) in repeated passes.
 */

/**
 * Delete order for the remaining FK graph (each referenced table must be
 * deleted after the tables that reference it with ON DELETE RESTRICT).
 */

/**
 * Research tables protected by the `research_append_only_guard` trigger.
 * A project reset must temporarily disable these triggers inside its own
 * transaction so the append-only ledger can be removed together with the
 * project it belongs to. Trigger state is restored before COMMIT; any error
 * rolls the whole transaction back including trigger state.
 */
const APPEND_ONLY_RESEARCH_TABLES = [
  "research_datasets",
  "research_evidence_sources",
  "research_claims",
  "research_claim_evidence",
  "topic_versions",
  "gap_novelty_versions",
  "submission_navigator_runs",
  "submission_journal_candidates",
  "submission_funding_routes",
  "submission_compliance_items",
  "submission_evidence_items",
  "theory_mechanism_versions",
  "submission_rule_snapshots",
  "submission_journal_details",
  "submission_journal_marks",
  "submission_projects",
  "research_blueprint_versions",
  "research_design_versions",
  "route_workspace_versions",
  "route_workspace_section_versions",
  "preregistration_versions",
  "project_instrument_versions",
  "study_protocol_versions",
  "pilot_study_versions",
  "research_analysis_plans",
  "research_analysis_runs",
  "research_studies",
  "research_documents",
  "research_human_gates",
  "research_workflow_events",
  "research_topic_lab_runs",
  "research_topic_lab_promotions",
] as const;

/**
 * Tables that reference themselves through `supersedes_version_id` with
 * ON DELETE RESTRICT. Rows must be removed newest-first (rows that no other
 * row in the same table still references) in repeated passes.
 */
const SUPERSEDES_RESEARCH_TABLES = [
  "research_studies",
  "research_analysis_plans",
  "research_claims",
  "research_documents",
  "research_topic_lab_runs",
  "topic_versions",
  "research_blueprint_versions",
  "gap_novelty_versions",
  "theory_mechanism_versions",
  "research_design_versions",
  "route_workspace_versions",
  "route_workspace_section_versions",
  "preregistration_versions",
  "project_instrument_versions",
  "study_protocol_versions",
  "pilot_study_versions",
] as const;

/**
 * Delete order for the remaining FK graph (each referenced table must be
 * deleted after the tables that reference it with ON DELETE RESTRICT).
 */
type ResetGuardedTrigger = { table: string; trigger: string };
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;

/**
 * 執行期解析重置刪除所需的真實 DB 結構（append-only 守衛、supersedes 自參考、
 * FK 拓樸）。重建時曾把這些清單回歸成舊版，導致後期模組表刪不掉而觸發
 * research_append_only_record 守衛——因此以資訊架構查詢為準，靜態清單僅作備援。
 */
async function resolveResetSchema(client: PoolClient): Promise<{ guarded: ResetGuardedTrigger[]; supersedes: Set<string>; order: string[] }> {
  try {
    const [projectRows, guardedRows, supersedesRows, fkRows] = await Promise.all([
      client.query<{ table: string }>(`SELECT table_name AS "table" FROM information_schema.columns WHERE column_name IN ('project_id','workspace_id') GROUP BY table_name HAVING count(DISTINCT column_name)=2`),
      client.query<{ table: string; trigger: string }>(`SELECT tgrelid::regclass::text AS "table", tgname AS "trigger" FROM pg_trigger WHERE NOT tgisinternal AND (tgname LIKE '%_append_only' OR tgname LIKE '%_are_append_only')`),
      client.query<{ table: string }>(`SELECT table_name AS "table" FROM information_schema.columns WHERE column_name='supersedes_version_id'`),
      client.query<{ child: string; parent: string }>(`SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid<>confrelid`),
    ]);
    const allTables = new Set<string>(projectRows.rows.map((row) => row.table).filter((table) => SAFE_IDENTIFIER.test(table)));
    allTables.delete("projects");
    const guarded = guardedRows.rows
      .filter((row) => allTables.has(row.table) && SAFE_IDENTIFIER.test(row.table) && SAFE_IDENTIFIER.test(row.trigger))
      .map((row) => ({ table: row.table, trigger: row.trigger }));
    const supersedes = new Set<string>(supersedesRows.rows.map((row) => row.table).filter((table) => allTables.has(table)));
    const parentsOf = new Map<string, Set<string>>();
    for (const row of fkRows.rows) {
      if (!allTables.has(row.child) || !allTables.has(row.parent)) continue;
      if (!parentsOf.has(row.child)) parentsOf.set(row.child, new Set());
      parentsOf.get(row.child)!.add(row.parent);
    }
    const order: string[] = [];
    const done = new Set<string>();
    const visiting = new Set<string>();
    const visit = (table: string) => {
      if (done.has(table) || visiting.has(table)) return;
      visiting.add(table);
      for (const parent of [...(parentsOf.get(table) ?? [])].sort()) visit(parent);
      visiting.delete(table);
      done.add(table);
      order.push(table);
    };
    for (const table of [...allTables].sort()) visit(table);
    order.reverse();
    for (const table of [...allTables].sort()) if (!done.has(table)) order.push(table);
    return { guarded, supersedes, order };
  } catch {
    // 資訊架構查詢失敗時的靜態備援（完整版清單，避免回到舊版截斷清單）
    const guarded: ResetGuardedTrigger[] = (APPEND_ONLY_RESEARCH_TABLES as readonly string[]).map((table) => ({ table, trigger: `${table}_append_only` }));
    const supersedes = new Set<string>(SUPERSEDES_RESEARCH_TABLES as readonly string[]);
    const order = [...new Set<string>([...(APPEND_ONLY_RESEARCH_TABLES as readonly string[]), ...(SUPERSEDES_RESEARCH_TABLES as readonly string[])])];
    return { guarded, supersedes, order };
  }
}

export class PostgresProjectRepository implements TenantRepository {
  readonly databasePool: Pool | null;
  constructor(databasePool: Pool | null = pool) { this.databasePool = databasePool; }

  async list(identity: TenantUser) {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    const result = await this.databasePool.query<ProjectRecord>("SELECT project_id AS \"projectId\", workspace_id AS \"workspaceId\", created_by AS \"ownerUserId\", title, status, legacy, trashed_at AS \"trashedAt\" FROM projects WHERE workspace_id = $1 AND created_by = $2 AND legacy = false AND trashed_at IS NULL ORDER BY created_at DESC", [identity.workspaceId, identity.userId]);
    return result.rows;
  }

  async listTrashed(identity: TenantUser) {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    const result = await this.databasePool.query<ProjectRecord>("SELECT project_id AS \"projectId\", workspace_id AS \"workspaceId\", created_by AS \"ownerUserId\", title, status, legacy, trashed_at AS \"trashedAt\" FROM projects WHERE workspace_id = $1 AND created_by = $2 AND legacy = false AND trashed_at IS NOT NULL ORDER BY trashed_at DESC", [identity.workspaceId, identity.userId]);
    return result.rows;
  }

  async trash(identity: TenantUser, projectId: string): Promise<{ projectId: string; trashed: boolean }> {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(projectId)) throw new TenantProjectConflict();
    const result = await this.databasePool.query("UPDATE projects SET trashed_at = now(), trashed_by_user_id = $4, updated_at = now() WHERE project_id = $1 AND workspace_id = $2 AND created_by = $3 AND legacy = false AND trashed_at IS NULL RETURNING project_id", [projectId, identity.workspaceId, identity.userId, identity.userId]);
    return { projectId, trashed: (result.rowCount ?? 0) > 0 };
  }

  async restore(identity: TenantUser, projectId: string): Promise<{ projectId: string; restored: boolean }> {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(projectId)) throw new TenantProjectConflict();
    const result = await this.databasePool.query("UPDATE projects SET trashed_at = NULL, trashed_by_user_id = NULL, updated_at = now() WHERE project_id = $1 AND workspace_id = $2 AND created_by = $3 AND legacy = false AND trashed_at IS NOT NULL RETURNING project_id", [projectId, identity.workspaceId, identity.userId]);
    return { projectId, restored: (result.rowCount ?? 0) > 0 };
  }

  async get(identity: TenantUser, projectId: string) {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    const result = await this.databasePool.query<ProjectRecord>("SELECT project_id AS \"projectId\", workspace_id AS \"workspaceId\", created_by AS \"ownerUserId\", title, status, legacy FROM projects WHERE project_id = $1 AND workspace_id = $2 AND created_by = $3 AND legacy = false", [projectId, identity.workspaceId, identity.userId]);
    return result.rows[0] || null;
  }

  async canCreate(identity: TenantUser) {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    const client = await this.databasePool.connect();
    try {
      if (!(await coreSchemaAvailable(client))) return false;
      const membership = await client.query<{ role: "owner" | "member" }>(
        "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member')",
        [identity.workspaceId, identity.userId],
      );
      return membership.rows[0]?.role === identity.role;
    } finally {
      client.release();
    }
  }

  async create(input: ProjectCreateInput): Promise<ProjectCreateResult> {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(input.projectId) || !/^[a-f0-9]{64}$/.test(input.previewHash)) throw new TenantProjectConflict();
    const client = await this.databasePool.connect();
    const { artifactId, documentId } = authorityIds(input);
    const body = canonicalS0Intake(input.intake);
    const documentHash = sha256(body);
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '10000ms'");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      if (!(await coreSchemaAvailable(client))) throw new TenantStorageUnavailable();
      const membership = await client.query<{ role: "owner" | "member" }>(
        "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member') FOR SHARE",
        [input.identity.workspaceId, input.identity.userId],
      );
      if (membership.rows[0]?.role !== input.identity.role) throw new TenantProjectUnauthorized();
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.projectId]);

      const documentPersistence = await researchDocumentsSupported(client);
      const auditAvailable = await auditSupported(client);
      const intakePersistence = documentPersistence ? "APPEND_ONLY_RESEARCH_DOCUMENT" as const : "PENDING_ARTIFACT_COMMITMENT" as const;
      const contentRef = JSON.stringify({
        contractVersion: "old-mike-project-intake-commitment/1.0.0",
        previewHash: input.previewHash,
        documentHash,
        persistence: intakePersistence,
      });
      const existing = await client.query<{ projectId: string; workspaceId: string; ownerUserId: string; title: string; status: string; legacy: boolean; storageBackend: string }>(
        `SELECT project_id AS "projectId", workspace_id AS "workspaceId", created_by AS "ownerUserId", title, status, legacy, storage_backend AS "storageBackend"
           FROM projects WHERE project_id=$1 FOR UPDATE`,
        [input.projectId],
      );
      const prior = existing.rows[0];
      if (prior) {
        const exactProject = prior.workspaceId === input.identity.workspaceId && prior.ownerUserId === input.identity.userId && prior.title === input.intake.workingTitle && prior.status === "ACTIVE" && prior.legacy === false && prior.storageBackend === "POSTGRES_INDEX_PENDING_SAFE_STORAGE";
        const artifact = await client.query<{ contentRef: string }>("SELECT content_ref AS \"contentRef\" FROM project_artifacts WHERE id=$1 AND workspace_id=$2 AND project_id=$3", [artifactId, input.identity.workspaceId, input.projectId]);
        if (!exactProject || artifact.rows[0]?.contentRef !== contentRef) throw new TenantProjectConflict();
        if (documentPersistence) {
          const document = await client.query<{ contentHash: string; body: string }>("SELECT content_hash AS \"contentHash\", body FROM research_documents WHERE id=$1 AND workspace_id=$2 AND project_id=$3", [documentId, input.identity.workspaceId, input.projectId]);
          if (document.rows[0]?.contentHash !== documentHash || document.rows[0]?.body !== body) throw new TenantProjectConflict();
        }
        if (auditAvailable) {
          const audit = await client.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM audit_events
              WHERE workspace_id=$1 AND user_id=$2 AND event_type='PROJECT_CREATED' AND outcome='SUCCESS'
                AND metadata->>'projectCommitment'=$3 AND metadata->>'previewHash'=$4`,
            [input.identity.workspaceId, input.identity.userId, sha256(input.projectId), input.previewHash],
          );
          if (audit.rows[0]?.count !== 1) throw new TenantProjectConflict();
        }
        await client.query("COMMIT");
        return { projectId: input.projectId, title: prior.title, status: "ACTIVE", storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE", intakePersistence, idempotent: true };
      }

      await client.query(
        `INSERT INTO projects (project_id,workspace_id,created_by,title,status,legacy,storage_backend)
         VALUES ($1,$2,$3,$4,'ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE')`,
        [input.projectId, input.identity.workspaceId, input.identity.userId, input.intake.workingTitle],
      );
      await client.query(
        "INSERT INTO project_artifacts (id,project_id,workspace_id,artifact_type,content_ref) VALUES ($1,$2,$3,'S0_INTAKE_COMMITMENT',$4)",
        [artifactId, input.projectId, input.identity.workspaceId, contentRef],
      );
      if (documentPersistence) {
        await client.query(
          `INSERT INTO research_documents
             (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail)
           VALUES ($1,'s0-intake',1,$2,$3,$4,'RESEARCH_PLAN',$5,$6,$7,'S0_INTAKE')`,
          [documentId, input.identity.workspaceId, input.projectId, input.identity.userId, input.intake.workingTitle, body, documentHash],
        );
      }
      if (auditAvailable) {
        await client.query(
          `INSERT INTO audit_events (workspace_id,user_id,event_type,outcome,metadata)
           VALUES ($1,$2,'PROJECT_CREATED','SUCCESS',$3::jsonb)`,
          [input.identity.workspaceId, input.identity.userId, JSON.stringify({ projectCommitment: sha256(input.projectId), previewHash: input.previewHash, storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE", intakePersistence })],
        );
      }
      await client.query("COMMIT");
      return { projectId: input.projectId, title: input.intake.workingTitle, status: "ACTIVE", storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE", intakePersistence, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }


  async remove(identity: TenantUser, projectId: string): Promise<ProjectRemoveResult> {
    if (!this.databasePool || !authConfiguration().ready) throw new TenantStorageUnavailable();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(projectId)) throw new TenantProjectConflict();
    const client = await this.databasePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '20000ms'");
      await client.query("SET LOCAL lock_timeout = '5000ms'");
      const project = await client.query<{ projectId: string; title: string }>(
        "SELECT project_id AS \"projectId\", title FROM projects WHERE project_id=$1 AND workspace_id=$2 AND created_by=$3 AND legacy=false FOR UPDATE",
        [projectId, identity.workspaceId, identity.userId],
      );
      const record = project.rows[0];
      if (!record) {
        await client.query("COMMIT");
        return { projectId, removed: false, deleted: { projects: 0, artifacts: 0, children: 0 } };
      }
      let deletedChildren = 0;
      const schema = await resolveResetSchema(client);
      try {
        for (const item of schema.guarded) {
          await client.query(`ALTER TABLE ${item.table} DISABLE TRIGGER ${item.trigger}`).catch(() => undefined);
        }
        // 依 FK 拓樸（子表先於父表）反覆刪除；supersedes 自參考表使用 NOT EXISTS 遞迴刪除
        const target = schema.order.length > 0 ? schema.order : schema.guarded.map((item) => item.table);
        for (let pass = 0; pass < 60; pass += 1) {
          let changed = 0;
          for (const table of target) {
            const result = schema.supersedes.has(table)
              ? await client.query(
                  `DELETE FROM ${table} s
                    WHERE s.workspace_id=$1 AND s.project_id=$2
                      AND NOT EXISTS (
                        SELECT 1 FROM ${table} n
                         WHERE n.workspace_id=$1 AND n.project_id=$2 AND n.supersedes_version_id = s.id
                      )`,
                  [identity.workspaceId, projectId],
                )
              : await client.query(`DELETE FROM ${table} WHERE workspace_id=$1 AND project_id=$2`, [identity.workspaceId, projectId]);
            changed += result.rowCount ?? 0;
          }
          deletedChildren += changed;
          if (changed === 0) break;
        }
        // 安全網：仍有殘留子列時不刪主專案（交易回滾、不半刪）
        const leftovers: string[] = [];
        for (const table of target) {
          const probe = await client.query(`SELECT 1 FROM ${table} WHERE workspace_id=$1 AND project_id=$2 LIMIT 1`, [identity.workspaceId, projectId]);
          if (probe.rowCount && probe.rowCount > 0) leftovers.push(table);
        }
        if (leftovers.length > 0) throw new TenantProjectRemoveFailed(`project_reset_incomplete:${leftovers.slice(0, 6).join(",")}`);
      } finally {
        for (const item of schema.guarded) {
          await client.query(`ALTER TABLE ${item.table} ENABLE TRIGGER ${item.trigger}`).catch(() => undefined);
        }
      }
      const artifacts = await client.query("DELETE FROM project_artifacts WHERE workspace_id=$1 AND project_id=$2", [identity.workspaceId, projectId]);
      const removed = await client.query("DELETE FROM projects WHERE project_id=$1 AND workspace_id=$2 AND created_by=$3", [projectId, identity.workspaceId, identity.userId]);
      const auditAvailable = await auditSupported(client);
      if (auditAvailable) {
        await client.query(
          `INSERT INTO audit_events (workspace_id,user_id,event_type,outcome,metadata)
           VALUES ($1,$2,'PROJECT_REMOVED','SUCCESS',$3::jsonb)`,
          [identity.workspaceId, identity.userId, JSON.stringify({ projectId, deletedChildren, deletedArtifacts: artifacts.rowCount ?? 0 })] as never[],
        );
      }
      await client.query("COMMIT");
      return { projectId, removed: (removed.rowCount ?? 0) > 0, deleted: { projects: removed.rowCount ?? 0, artifacts: artifacts.rowCount ?? 0, children: deletedChildren } };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof TenantProjectConflict) throw error;
      throw new TenantProjectRemoveFailed(error instanceof Error ? error.message : "project_reset_failed");
    } finally {
      client.release();
    }
  }
}

export class FixtureProjectRepository implements TenantRepository {
  readonly fixture: TenantFixture;
  constructor(fixture: TenantFixture) { this.fixture = fixture; }
  async list(identity: TenantUser) { return listProjectsForUser(this.fixture, identity); }
  async listTrashed(identity: TenantUser) { return this.fixture.projects.filter((project) => !project.legacy && project.workspaceId === identity.workspaceId && project.ownerUserId === identity.userId && Boolean(project.trashedAt)); }
  async trash(identity: TenantUser, projectId: string) {
    const project = this.fixture.projects.find((item) => item.projectId === projectId && item.workspaceId === identity.workspaceId && item.ownerUserId === identity.userId && !item.trashedAt);
    if (project) project.trashedAt = new Date().toISOString();
    return { projectId, trashed: Boolean(project) };
  }
  async restore(identity: TenantUser, projectId: string) {
    const project = this.fixture.projects.find((item) => item.projectId === projectId && item.workspaceId === identity.workspaceId && item.ownerUserId === identity.userId && item.trashedAt);
    if (project) project.trashedAt = null;
    return { projectId, restored: Boolean(project) };
  }
  async get(identity: TenantUser, projectId: string) { return canAccessProject(this.fixture, identity, projectId); }
  async canCreate(identity: TenantUser) { return this.fixture.users.some((user) => user.userId === identity.userId && user.workspaceId === identity.workspaceId); }
  async create(input: ProjectCreateInput): Promise<ProjectCreateResult> {
    const prior = this.fixture.projects.find((item) => item.projectId === input.projectId);
    if (prior && (prior.workspaceId !== input.identity.workspaceId || prior.ownerUserId !== input.identity.userId || prior.title !== input.intake.workingTitle)) throw new TenantProjectConflict();
    if (!prior) this.fixture.projects.push({ projectId: input.projectId, workspaceId: input.identity.workspaceId, ownerUserId: input.identity.userId, title: input.intake.workingTitle, status: "ACTIVE", legacy: false });
    return { projectId: input.projectId, title: input.intake.workingTitle, status: "ACTIVE", storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE", intakePersistence: "PENDING_ARTIFACT_COMMITMENT", idempotent: Boolean(prior) };
  }
  async remove(identity: TenantUser, projectId: string): Promise<ProjectRemoveResult> {
    const index = this.fixture.projects.findIndex((item) => item.projectId === projectId && item.workspaceId === identity.workspaceId && item.ownerUserId === identity.userId);
    if (index === -1) return { projectId, removed: false, deleted: { projects: 0, artifacts: 0, children: 0 } };
    this.fixture.projects.splice(index, 1);
    return { projectId, removed: true, deleted: { projects: 1, artifacts: 0, children: 0 } };
  }
}

export class TenantProjectGateway {
  readonly repository: TenantRepository;
  constructor(repository: TenantRepository) { this.repository = repository; }
  list(identity: TenantUser) { return this.repository.list(identity); }
  get(identity: TenantUser, projectId: string) { return this.repository.get(identity, projectId); }
  create(input: ProjectCreateInput) { return this.repository.create(input); }
  remove(identity: TenantUser, projectId: string) { return this.repository.remove(identity, projectId); }
  listTrashed(identity: TenantUser) { return this.repository.listTrashed(identity); }
  trash(identity: TenantUser, projectId: string) { return this.repository.trash(identity, projectId); }
  restore(identity: TenantUser, projectId: string) { return this.repository.restore(identity, projectId); }
  async assertCanCreate(identity: TenantUser) { if (!(await this.repository.canCreate(identity))) throw new TenantStorageUnavailable(); }
}

export async function resolveTenantUser(userId: string): Promise<TenantUser | null> {
  if (!pool || !authConfiguration().ready) throw new TenantStorageUnavailable();
  const result = await pool.query<{ workspaceId: string; role: "owner" | "member" }>("SELECT workspace_id AS \"workspaceId\", role FROM workspace_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1", [userId]);
  const membership = result.rows[0];
  return membership ? { userId, workspaceId: membership.workspaceId, role: membership.role } : null;
}

export async function closeTenantRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new TenantStorageUnavailable();
  await pool?.end();
}

export const tenantProjectRepository = new PostgresProjectRepository();
