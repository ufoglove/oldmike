import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTopicLab, parseTopicLabRequest } from "../lib/topic-lab-contract.ts";
import {
  approveTopicLabCandidate,
  closeTopicLabRepositoryForDisposableTest,
  findTopicLabRunByIdempotency,
  getLatestTopicLabRun,
  promoteTopicLabCandidate,
  saveTopicLabAnalysis,
  TOPIC_LAB_LOGICAL_ID,
  TOPIC_LAB_STAGE_DETAIL,
} from "../lib/topic-lab-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
assert.equal(process.env.INTEGRATION_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.INTEGRATION_TEST_MODE, "1");
assert.equal(process.env.TEST_FIXTURE, "1");
assert.ok(url);
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));

const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-c2r3-topic-lab-0006-disposable" });
const migrations = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];
const q = (sql, values = []) => client.query(sql, values);

try {
  await client.connect();
  for (const migration of migrations) await q(await readFile(path.join(root, "database", "migrations", migration), "utf8"));
  assert.equal((await q("SHOW server_version_num")).rows[0].server_version_num.startsWith("18"), true);
  assert.equal((await q("SELECT to_regclass('public.research_topic_lab_runs') IS NULL AND to_regclass('public.research_topic_lab_promotions') IS NULL AS absent")).rows[0].absent, true);
  assert.equal((await q("SELECT pg_get_constraintdef(oid) LIKE '%RESEARCH_DIRECTION%' AS has_0007 FROM pg_constraint WHERE conname='research_human_gates_gate_type_check'")).rows[0].has_0007, false);
  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('c2r3_u_a','A','c2r3-a@example.test'),('c2r3_u_b','B','c2r3-b@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('c2r3_w_a','A','c2r3_u_a'),('c2r3_w_b','B','c2r3_u_b');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('c2r3_w_a','c2r3_u_a','owner'),('c2r3_w_b','c2r3_u_b','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES
      ('c2r3_p_a','c2r3_w_a','c2r3_u_a','A','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
      ('c2r3_p_b','c2r3_w_b','c2r3_u_b','B','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
  `);
  const tenantA = { userId: "c2r3_u_a", workspaceId: "c2r3_w_a", projectId: "c2r3_p_a", role: "owner" };
  const tenantB = { userId: "c2r3_u_b", workspaceId: "c2r3_w_b", projectId: "c2r3_p_b", role: "owner" };
  assert.equal(await getLatestTopicLabRun(tenantA), null, "GET-equivalent must return run:null on schema 0006");

  const request = parseTopicLabRequest({
    operation: "ANALYZE", idempotencyKey: "topic-analysis:c2r3-0001", professionalField: "fixture field", population: "fixture population", context: "fixture context", methodPreferences: ["fixture method"],
    constraints: { time: "fixture time", data: "fixture data", ethics: "fixture ethics" }, evidenceWindow: { from: "2023-01-01", to: "2026-01-01" }, sourceMode: "NO_EXTERNAL_SOURCE", sourceUrls: [],
  });
  const analysis = analyzeTopicLab(request, [], new Date("2026-01-01T00:00:00.000Z"));
  const saved = await Promise.all([
    saveTopicLabAnalysis({ tenant: tenantA, userId: tenantA.userId, request, analysis }),
    saveTopicLabAnalysis({ tenant: tenantA, userId: tenantA.userId, request, analysis }),
  ]);
  assert.equal(new Set(saved.map((item) => item.id)).size, 1);
  assert.deepEqual(new Set(saved.map((item) => item.idempotent)), new Set([false, true]));
  assert.equal((await q("SELECT count(*)::int AS count FROM research_documents WHERE workspace_id='c2r3_w_a' AND project_id='c2r3_p_a' AND logical_id=$1 AND document_type='RESEARCH_PLAN' AND stage_detail=$2", [TOPIC_LAB_LOGICAL_ID, TOPIC_LAB_STAGE_DETAIL])).rows[0].count, 1);
  assert.equal(await getLatestTopicLabRun(tenantB), null);
  assert.equal(await findTopicLabRunByIdempotency(tenantB, request.idempotencyKey), null);

  const run = saved[0];
  const candidate = run.resultPayload.candidates[0];
  await assert.rejects(() => approveTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-gate:c2r3-wrong", runId: run.id, candidateId: candidate.candidateId, candidateHash: "0".repeat(64), rationale: "fixture rationale" }), /candidate_binding_mismatch/);
  const gates = await Promise.all([
    approveTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-gate:c2r3-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, rationale: "fixture rationale" }),
    approveTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-gate:c2r3-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, rationale: "fixture rationale" }),
  ]);
  assert.equal(new Set(gates.map((item) => item.id)).size, 1);
  const gateRow = (await q("SELECT gate_type,artifact_type,approved_content_hash AS hash FROM research_human_gates WHERE id=$1", [gates[0].id])).rows[0];
  assert.deepEqual(gateRow, { gate_type: "DOCUMENT_RELEASE", artifact_type: "topic_lab_candidate", hash: candidate.candidateHash });

  const promotions = await Promise.all([
    promoteTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-promotion:c2r3-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, humanGateId: gates[0].id }),
    promoteTopicLabCandidate({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "topic-promotion:c2r3-0001", runId: run.id, candidateId: candidate.candidateId, candidateHash: candidate.candidateHash, humanGateId: gates[0].id }),
  ]);
  assert.equal(new Set(promotions.map((item) => item.studyVersionId)).size, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_studies WHERE workspace_id='c2r3_w_a' AND project_id='c2r3_p_a' AND stage_detail='S1_DESIGN_DRAFT'")).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_workflow_events WHERE workspace_id='c2r3_w_a' AND project_id='c2r3_p_a' AND stage_detail='M01_TOPIC_LAB_CANDIDATE_PROMOTED'")).rows[0].count, 1);
  const payload = (await q("SELECT design_payload AS payload FROM research_studies WHERE id=$1", [promotions[0].studyVersionId])).rows[0].payload;
  assert.equal(payload.provenance.sourceStatus, "UNVERIFIED");
  assert.equal(payload.provenance.approvalUpgradesSourceStatus, false);
  assert.equal(await q("UPDATE research_documents SET body='{}' WHERE id=$1", [run.id]).then(() => false, () => true), true);

  console.log("POSTGRESQL_MAJOR_18=PASS");
  console.log("SCHEMA_0006_WITHOUT_0007=PASS");
  console.log("GET_RUN_NULL=PASS");
  console.log("ANALYZE_VERSION_IDEMPOTENCY_CONCURRENCY=PASS");
  console.log("TENANT_404_BOUNDARY=PASS");
  console.log("EXACT_CANDIDATE_HASH_DOCUMENT_RELEASE_GATE=PASS");
  console.log("S1_PROMOTION_TRANSACTION=PASS");
  console.log("FORMAL_SOURCE_STATUS_UNVERIFIED=PASS");
} finally {
  await closeTopicLabRepositoryForDisposableTest().catch(() => undefined);
  await client.end().catch(() => undefined);
}
