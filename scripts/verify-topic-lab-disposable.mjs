import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTopicLab, parseTopicLabRequest } from "../lib/topic-lab-contract.ts";
import {
  approveTopicLabCandidate,
  closeTopicLabRepositoryForDisposableTest,
  getLatestTopicLabRun,
  promoteTopicLabCandidate,
  saveTopicLabAnalysis,
} from "../lib/topic-lab-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") {
  console.log("TOPIC_LAB_DISPOSABLE=NOT_EXECUTED");
  console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED");
  process.exit(0);
}
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-v1522-topic-lab-disposable" });
const migrations = [
  "0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql", "0005_research_workflow_phase2.up.sql", "0006_admin_provisioned_accounts.up.sql", "0007_topic_lab_frontier_radar.up.sql",
];
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const q = (sql, values = []) => client.query(sql, values);
let retained = -1;

try {
  await client.connect();
  for (const name of migrations) await q(await migration(name));
  assert.equal((await q("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('research_topic_lab_runs','research_topic_lab_promotions')")).rows[0].count, 2);
  assert.equal((await q("SELECT count(*)::int AS count FROM pg_constraint WHERE conname='research_human_gates_gate_type_check' AND pg_get_constraintdef(oid) LIKE '%RESEARCH_DIRECTION%'")).rows[0].count, 1);

  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('topic_u_a','A','topic-a@example.test'),('topic_u_b','B','topic-b@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('topic_w_a','A','topic_u_a'),('topic_w_b','B','topic_u_b');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('topic_w_a','topic_u_a','owner'),('topic_w_b','topic_u_b','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES
      ('topic_p_a','topic_w_a','topic_u_a','A','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
      ('topic_p_b','topic_w_b','topic_u_b','B','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
  `);
  const tenantA = { userId: "topic_u_a", workspaceId: "topic_w_a", projectId: "topic_p_a", role: "owner" };
  const tenantB = { userId: "topic_u_b", workspaceId: "topic_w_b", projectId: "topic_p_b", role: "owner" };
  const request = parseTopicLabRequest({
    operation: "ANALYZE", idempotencyKey: "topic-analysis:disposable-0001", professionalField: "教育心理", population: "大學生", context: "高等教育場域", methodPreferences: ["縱貫研究"],
    constraints: { time: "十二個月", data: "匿名問卷", ethics: "倫理與授權審查" }, evidenceWindow: { from: "2023-01-01", to: "2026-01-01" }, sourceMode: "NO_EXTERNAL_SOURCE", sourceUrls: [],
  });
  const analysis = analyzeTopicLab(request, [], new Date("2026-01-01T00:00:00.000Z"));
  const saved = await Promise.all([
    saveTopicLabAnalysis({ tenant: tenantA, userId: tenantA.userId, request, analysis }),
    saveTopicLabAnalysis({ tenant: tenantA, userId: tenantA.userId, request, analysis }),
  ]);
  assert.equal(new Set(saved.map((item) => item.id)).size, 1);
  assert.deepEqual(new Set(saved.map((item) => item.idempotent)), new Set([false, true]));
  assert.equal((await q("SELECT count(*)::int AS count FROM research_topic_lab_runs WHERE workspace_id='topic_w_a' AND project_id='topic_p_a' AND idempotency_key='topic-analysis:disposable-0001'")).rows[0].count, 1);
  assert.equal(await getLatestTopicLabRun(tenantB), null, "cross-tenant lookup must not reveal another run");

  const run = saved[0];
  const candidate = run.resultPayload.candidates[0];
  const gates = await Promise.all([
    approveTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, rationale: "人工核對固定候選版本" }),
    approveTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, rationale: "人工核對固定候選版本" }),
  ]);
  assert.equal(new Set(gates.map((item) => item.id)).size, 1);
  const promotions = await Promise.all([
    promoteTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-promotion:disposable-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, humanGateId: gates[0].id }),
    promoteTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-promotion:disposable-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, humanGateId: gates[0].id }),
  ]);
  assert.equal(new Set(promotions.map((item) => item.id)).size, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_topic_lab_promotions WHERE workspace_id='topic_w_a' AND project_id='topic_p_a'")).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_studies WHERE workspace_id='topic_w_a' AND project_id='topic_p_a' AND stage_detail='S1_DESIGN_DRAFT'")).rows[0].count, 1);
  await assert.rejects(() => approveTopicLabCandidate({ tenant: tenantB, userId: tenantB.userId, runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, rationale: "cross tenant" }), /topic_lab_run_not_found/);
  await assert.rejects(() => promoteTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-promotion:wrong-gate", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, humanGateId: "gate_wrong_fixture" }), /research_direction_human_gate_required|idempotency_payload_conflict/);

  const appendOnly = await q("UPDATE research_topic_lab_runs SET result_payload='{}' WHERE id=$1", [run.id]).then(() => false, () => true);
  assert.equal(appendOnly, true);
  let formalDownRejected = false;
  try { await q(await migration("0007_topic_lab_frontier_radar.down.sql")); }
  catch (error) { formalDownRejected = String(error?.message).includes("MIGRATION_0007_DOWN_BLOCKED_TOPIC_LAB_DATA_PRESENT"); await q("ROLLBACK").catch(() => undefined); }
  assert.equal(formalDownRejected, true);
  retained = (await q("SELECT count(*)::int AS count FROM research_topic_lab_runs")).rows[0].count;
  assert.equal(retained, 1);

  await closeTopicLabRepositoryForDisposableTest();
  await q("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  for (const name of migrations) await q(await migration(name));
  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('n1_u','N1','n1@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('n1_w','N1','n1_u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('n1_w','n1_u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('n1_p','n1_w','n1_u','N1','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_studies (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,content_hash,design_payload) VALUES ('n1_study','n1',1,'n1_w','n1_p','n1_u',repeat('a',64),'{}');
  `);
  await q(await migration("0007_topic_lab_frontier_radar.down.sql"));
  assert.equal((await q("SELECT count(*)::int AS count FROM research_studies WHERE id='n1_study'")).rows[0].count, 1, "N-1 formal data must survive 0007 empty down");
  const oldConstraint = await q("INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at) VALUES ('n1_gate','n1_w','n1_p','n1_u','RESEARCH_DIRECTION','topic_lab_candidate','x',repeat('b',64),'APPROVED','n1_u',now())").then(() => false, () => true);
  assert.equal(oldConstraint, true);
  assert.equal((await q("SELECT to_regclass('public.research_topic_lab_runs') IS NULL AS absent")).rows[0].absent, true);

  console.log("MIGRATION_0007_UP=PASS");
  console.log("MIGRATION_0007_DOWN_EMPTY=PASS");
  console.log("MIGRATION_0007_FORMAL_DATA_FAIL_CLOSED=PASS");
  console.log("N_MINUS_ONE_COMPATIBILITY=PASS");
  console.log("TENANT_ISOLATION=PASS");
  console.log("IDEMPOTENCY_CONCURRENCY=PASS");
  console.log("HUMAN_GATE_PROMOTION=PASS");
  console.log("APPEND_ONLY_TOPIC_LAB=PASS");
  console.log("TOPIC_LAB_DISPOSABLE=PASS");
} catch (error) {
  console.log("TOPIC_LAB_DISPOSABLE=FAIL");
  console.log(`ERROR_CATEGORY=${typeof error?.code === "string" ? error.code : "ASSERTION_OR_RUNTIME"}`);
  process.exitCode = 2;
} finally {
  console.log(`FORMAL_DATA_FAIL_CLOSED_ROW_RETAINED=${retained}`);
  await closeTopicLabRepositoryForDisposableTest().catch(() => undefined);
  await client.end().catch(() => undefined);
}
