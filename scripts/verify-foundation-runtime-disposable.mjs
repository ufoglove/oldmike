import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makePreviewHash, makeProjectId } from "../lib/project-id.ts";
import { normalizeS0Intake } from "../lib/project-contract.ts";
import {
  PostgresProjectRepository,
  TenantProjectConflict,
  TenantProjectUnauthorized,
  closeTenantRepositoryForDisposableTest,
} from "../lib/tenant-repository.ts";
import { closeTaskContextRepositoryForDisposableTest, loadAuthorizedProjectTaskContext } from "../lib/task-context-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") process.exit(2);
const parsedDatabaseUrl = new URL(databaseUrl);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedDatabaseUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-foundation-runtime-disposable" });
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const q = (sql, values = []) => client.query(sql, values);
const repository = new PostgresProjectRepository();

const intakeResult = normalizeS0Intake({
  workingTitle: "可重現高等教育回饋研究", domain: "AI × 教育", outputTrack: "SCI", problemContext: "比較回饋設計。", targetUsers: "大學生", expectedContribution: "建立可核對設計。", existingData: "匿名摘要", availableData: "核准後問卷", methodIdea: "準實驗", timeline: "十二個月", constraints: "有限樣本", ethicsPrivacyRisks: "須倫理審查", unresolvedItems: "樣本數待定",
});
assert.equal(intakeResult.ok, true);
if (!intakeResult.ok) throw new Error("fixture_intake_invalid");
const intake = intakeResult.value;
const projectId = makeProjectId(intake);
const previewHash = makePreviewHash(intake, projectId);
const owner = { userId: "foundation_u_owner", workspaceId: "foundation_w_a", role: "owner" };
const member = { userId: "foundation_u_member", workspaceId: "foundation_w_a", role: "member" };
const outsider = { userId: "foundation_u_outsider", workspaceId: "foundation_w_b", role: "owner" };

let retainedRows = -1;
try {
  await client.connect();
  for (const name of ["0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0005_research_workflow_phase2.up.sql"]) await q(await migration(name));
  await q(`
    INSERT INTO "user" (id,name,email) VALUES
      ('foundation_u_owner','Owner','foundation-owner@example.test'),
      ('foundation_u_member','Member','foundation-member@example.test'),
      ('foundation_u_outsider','Outsider','foundation-outsider@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES
      ('foundation_w_a','Workspace A','foundation_u_owner'),
      ('foundation_w_b','Workspace B','foundation_u_outsider');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
      ('foundation_w_a','foundation_u_owner','owner'),
      ('foundation_w_a','foundation_u_member','member'),
      ('foundation_w_b','foundation_u_outsider','owner');
  `);

  assert.equal(await repository.canCreate(owner), true);
  assert.equal(await repository.canCreate(member), true);
  assert.equal(await repository.canCreate({ userId: "missing", workspaceId: owner.workspaceId, role: "member" }), false);

  const input = { identity: owner, projectId, previewHash, intake };
  const first = await repository.create(input);
  const replay = await repository.create(input);
  assert.equal(first.idempotent, false);
  assert.equal(replay.idempotent, true);
  assert.equal(first.intakePersistence, "APPEND_ONLY_RESEARCH_DOCUMENT");
  assert.equal((await q("SELECT count(*)::int AS count FROM projects WHERE project_id=$1", [projectId])).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM project_artifacts WHERE project_id=$1", [projectId])).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_documents WHERE project_id=$1 AND stage_detail='S0_INTAKE'", [projectId])).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM audit_events WHERE event_type='PROJECT_CREATED' AND workspace_id=$1", [owner.workspaceId])).rows[0].count, 1);

  await assert.rejects(() => repository.create({ ...input, identity: outsider }), (error) => error instanceof TenantProjectConflict);
  await assert.rejects(() => repository.create({ ...input, identity: { ...owner, userId: "missing" } }), (error) => error instanceof TenantProjectUnauthorized);
  await assert.rejects(() => repository.create({ ...input, previewHash: "f".repeat(64) }), (error) => error instanceof TenantProjectConflict);
  assert.equal((await q("SELECT count(*)::int AS count FROM projects WHERE project_id=$1", [projectId])).rows[0].count, 1);
  console.log("CATEGORY_03_CROSS_TENANT_UNAUTHORIZED=PASS");

  const context = await loadAuthorizedProjectTaskContext(owner.userId, projectId);
  assert.equal(context.tenantId, owner.workspaceId);
  assert.equal(context.projectId, projectId);
  assert.equal(context.documents.length, 1);
  await assert.rejects(() => loadAuthorizedProjectTaskContext(outsider.userId, projectId), /project_context_not_found/);

  await q(`CREATE OR REPLACE FUNCTION foundation_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_audit_rejected'; END $$; CREATE TRIGGER foundation_reject_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION foundation_reject_audit();`);
  const rollbackIntake = { ...intake, workingTitle: "回滾測試專案" };
  const rollbackProjectId = makeProjectId(rollbackIntake);
  await assert.rejects(() => repository.create({ identity: owner, projectId: rollbackProjectId, previewHash: makePreviewHash(rollbackIntake, rollbackProjectId), intake: rollbackIntake }), /fixture_audit_rejected/);
  assert.equal((await q("SELECT count(*)::int AS count FROM projects WHERE project_id=$1", [rollbackProjectId])).rows[0].count, 0);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_documents WHERE project_id=$1", [rollbackProjectId])).rows[0].count, 0);
  await q("DROP TRIGGER foundation_reject_audit ON audit_events; DROP FUNCTION foundation_reject_audit()");
  console.log("CATEGORY_02_PROJECT_CREATE_EXACT_ONCE_ROLLBACK=PASS");

  retainedRows = Number((await q("SELECT (SELECT count(*) FROM projects)+(SELECT count(*) FROM project_artifacts)+(SELECT count(*) FROM research_documents)+(SELECT count(*) FROM audit_events) AS count")).rows[0].count);
  assert.equal(retainedRows, 4);
  console.log("FOUNDATION_RUNTIME_DISPOSABLE=PASS");
} finally {
  await closeTaskContextRepositoryForDisposableTest().catch(() => undefined);
  await closeTenantRepositoryForDisposableTest().catch(() => undefined);
  await client.end().catch(() => undefined);
  console.log(`DISPOSABLE_FORMAL_ROWS_BEFORE_CLUSTER_CLEANUP=${Math.max(retainedRows, 0)}`);
}
