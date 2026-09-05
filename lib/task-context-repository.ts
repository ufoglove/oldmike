import "server-only";

import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "./auth-config.ts";
import {
  authorizedProjectContextHash,
  type AuthorizedProjectTaskContext,
  type AuthorizedProjectTaskContextBase,
} from "./task-context-contract.ts";

export {
  authorizedProjectContextHash,
  type AuthorizedProjectTaskContext,
  type AuthorizedProjectTaskContextBase,
} from "./task-context-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }) : null;

export class ProjectTaskContextUnavailable extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code = "project_context_unavailable", status = 503) { super(code); this.name = "ProjectTaskContextUnavailable"; this.code = code; this.status = status; }
}

export class ProjectTaskContextNotFound extends ProjectTaskContextUnavailable {
  constructor() { super("project_context_not_found", 404); this.name = "ProjectTaskContextNotFound"; }
}

type ProjectRow = { tenantId: string; projectId: string; title: string; status: "ACTIVE"; storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE" | "OPENCLAW_CONTROLLED" };
type DocumentRow = { logicalId: string; version: number; type: AuthorizedProjectTaskContextBase["documents"][number]["type"]; title: string; stage: string; contentHash: string; body: string };
type EventRow = { fromStage: string; toStage: string; stageDetail: string | null; eventHash: string };

export class PostgresTaskContextRepository {
  readonly databasePool: Pool | null;
  constructor(databasePool: Pool | null = pool) { this.databasePool = databasePool; }

  async load(userId: string, projectId: string): Promise<AuthorizedProjectTaskContext> {
    if (!this.databasePool || !authConfiguration().ready) throw new ProjectTaskContextUnavailable();
    const client = await this.databasePool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout = '5000ms'");
      const project = await client.query<ProjectRow>(
        `SELECT p.workspace_id AS "tenantId", p.project_id AS "projectId", p.title,
                p.status, p.storage_backend AS "storageBackend"
           FROM projects p
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
          WHERE p.project_id = $1 AND wm.user_id = $2 AND wm.role IN ('owner','member')
            AND p.legacy = false AND p.status = 'ACTIVE'
          LIMIT 1`,
        [projectId, userId],
      );
      const projectRow = project.rows[0];
      if (!projectRow) throw new ProjectTaskContextNotFound();

      const hasDocuments = await hasRelation(client, "research_documents");
      const hasEvents = await hasRelation(client, "research_workflow_events");
      const documents = hasDocuments ? await client.query<DocumentRow>(
        `SELECT d.logical_id AS "logicalId", d.version_number AS version, d.document_type AS type,
                left(d.title, 300) AS title, left(d.stage_detail, 160) AS stage,
                d.content_hash AS "contentHash", left(d.body, 8000) AS body
           FROM research_documents d
          WHERE d.workspace_id = $1 AND d.project_id = $2
            AND d.document_type IN ('RESEARCH_PLAN','MANUSCRIPT','RESPONSE_TO_REVIEWERS')
            AND d.version_number = (
              SELECT max(latest.version_number) FROM research_documents latest
               WHERE latest.workspace_id=d.workspace_id AND latest.project_id=d.project_id AND latest.logical_id=d.logical_id
            )
          ORDER BY d.updated_at DESC, d.logical_id ASC
          LIMIT 3`,
        [projectRow.tenantId, projectId],
      ) : { rows: [] as DocumentRow[] };
      const events = hasEvents ? await client.query<EventRow>(
        `SELECT left(from_stage, 160) AS "fromStage", left(to_stage, 160) AS "toStage",
                left(stage_detail, 240) AS "stageDetail", event_hash AS "eventHash"
           FROM research_workflow_events
          WHERE workspace_id = $1 AND project_id = $2
          ORDER BY created_at DESC, id DESC
          LIMIT 8`,
        [projectRow.tenantId, projectId],
      ) : { rows: [] as EventRow[] };
      await client.query("COMMIT");

      let bodyBudget = 16_000;
      const boundedDocuments = documents.rows.map((document) => {
        const body = document.body.slice(0, Math.max(0, bodyBudget));
        bodyBudget -= body.length;
        return { ...document, body };
      });
      const base: AuthorizedProjectTaskContextBase = {
        tenantId: projectRow.tenantId,
        projectId: projectRow.projectId,
        project: { title: projectRow.title.slice(0, 300), status: projectRow.status, storageBackend: projectRow.storageBackend },
        documents: boundedDocuments,
        workflowEvents: events.rows,
      };
      return { ...base, contextHash: authorizedProjectContextHash(base) };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof ProjectTaskContextUnavailable) throw error;
      throw new ProjectTaskContextUnavailable();
    } finally {
      client.release();
    }
  }
}

async function hasRelation(client: PoolClient, relation: string) {
  const result = await client.query<{ present: boolean }>("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${relation}`]);
  return result.rows[0]?.present === true;
}

const taskContextRepository = new PostgresTaskContextRepository();

export function loadAuthorizedProjectTaskContext(userId: string, projectId: string) {
  return taskContextRepository.load(userId, projectId);
}

export async function closeTaskContextRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new ProjectTaskContextUnavailable();
  await pool?.end();
}
