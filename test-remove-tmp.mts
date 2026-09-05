// Integration test for PostgresProjectRepository.remove() with lock contention.
process.env.INTEGRATION_TEST_MODE = "0";
process.env.TEST_FIXTURE = "0";
process.env.DATABASE_URL = "postgres://app_user:app_pass@127.0.0.1:5432/portal_test";
process.env.BETTER_AUTH_SECRET = "012345…cdef";
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3999";
process.env.REGISTRATION_MODE = "closed";
process.env.ACCOUNT_PROVISIONING_MODE = "admin_only";
process.env.LEGACY_AUTH_ENABLED = "false";

const { Pool } = await import("pg");
const { PostgresProjectRepository } = await import("./lib/tenant-repository.ts");
const { createHash } = await import("node:crypto");

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

async function seed(projectId: string) {
  const c = await pool.connect();
  try {
    await c.query(`INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('owner-1','t','owner@t.local',false) ON CONFLICT (email) DO NOTHING`);
    await c.query(`INSERT INTO workspaces (id, name, owner_user_id) VALUES ('ws-1','w','owner-1') ON CONFLICT (id) DO NOTHING`);
    await c.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('ws-1','owner-1','owner') ON CONFLICT DO NOTHING`);
    await c.query(`INSERT INTO projects (project_id, workspace_id, created_by, title, status, legacy, storage_backend) VALUES ($1,'ws-1','owner-1','t','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE')`, [projectId]);
    await c.query(`INSERT INTO project_artifacts (id, project_id, workspace_id, artifact_type, content_ref) VALUES ($1,$1,'ws-1','S0_INTAKE_COMMITMENT', $2)`, [projectId, h(projectId)]);
    await c.query(`INSERT INTO research_studies (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, content_hash, lifecycle_contract_version, design_payload) VALUES ($1||'-v1','s',1,NULL,'ws-1',$2,'owner-1',repeat('a',64),'1.5.3','{}')`, [projectId, projectId]);
    await c.query(`INSERT INTO research_studies (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, content_hash, lifecycle_contract_version, design_payload) VALUES ($1||'-v2','s',2,$1||'-v1','ws-1',$2,'owner-1',repeat('b',64),'1.5.3','{}')`, [projectId, projectId]);
    await c.query(`INSERT INTO research_documents (id, logical_id, version_number, workspace_id, project_id, created_by_user_id, document_type, title, body, content_hash, stage_detail) VALUES ($1||'-doc','s0-intake',1,'ws-1',$2,'owner-1','RESEARCH_PLAN','t','b',repeat('c',64),'S0_INTAKE')`, [projectId, projectId]);
  } finally {
    c.release();
  }
}

async function expectRows(projectId: string, label: string) {
  const r = await pool.query(`SELECT
    (SELECT count(*) FROM projects WHERE project_id=$1) p,
    (SELECT count(*) FROM project_artifacts WHERE project_id=$1) a,
    (SELECT count(*) FROM research_studies WHERE project_id=$1) s,
    (SELECT count(*) FROM research_documents WHERE project_id=$1) d`, [projectId]);
  console.log(label, JSON.stringify(r.rows[0]));
}

async function main() {
  const repo = new PostgresProjectRepository();
  const identity = { userId: "owner-1", workspaceId: "ws-1" };

  const p1 = "reset-test-1";
  await seed(p1);
  await expectRows(p1, "before case1:");
  const r1 = await repo.remove(identity, p1);
  console.log("case1 result:", JSON.stringify(r1));
  await expectRows(p1, "after  case1:");

  const p2 = "reset-test-2";
  await seed(p2);
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  await blocker.query("SELECT * FROM research_studies WHERE project_id=$1 FOR UPDATE", [p2]);
  const r2Promise = repo.remove(identity, p2).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e: e.message }));
  setTimeout(async () => { try { await blocker.query("COMMIT"); } finally { blocker.release(); } }, 4000);
  const r2 = await r2Promise;
  console.log("case2 result:", JSON.stringify(r2).slice(0, 220));
  await expectRows(p2, "after  case2:");

  const r3 = await repo.remove(identity, "reset-test-3");
  console.log("case3 (not found):", JSON.stringify(r3));

  await pool.end();
  console.log("ALL DONE");
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAIL:", e); process.exit(1); });
