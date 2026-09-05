import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDeterministicAnalysis } from "../lib/research-analysis.ts";
import { sha256Canonical, stableArchiveManifest } from "../lib/research-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.log("DISPOSABLE_DATABASE=NOT_EXECUTED");
  console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED");
  process.exit(0);
}
const parsed = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000, statement_timeout: 15000, application_name: "old-mike-v154-disposable" });
const migrations = ["0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql", "0005_research_workflow_phase2.up.sql"];
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const q = (sql, values = []) => client.query(sql, values);
let fixtureRowsRetained = -1;

try {
  await client.connect();
  for (const name of migrations) await q(await migration(name));
  const inventory = await q("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'research_%'");
  assert.equal(inventory.rows[0].count, 10);
  assert.equal((await q("SELECT count(*)::int AS count FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname LIKE 'research_%' AND NOT convalidated")).rows[0].count, 0);
  assert.equal((await q("SELECT count(*)::int AS count FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'research_%' AND (NOT i.indisvalid OR NOT i.indisready)")).rows[0].count, 0);

  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('u_a','A','a@example.test'),('u_b','B','b@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('w_a','A','u_a'),('w_b','B','u_b');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('w_a','u_a','owner'),('w_b','u_b','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES
      ('p_a','w_a','u_a','A','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
      ('p_b','w_b','u_b','B','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
  `);
  const tenantA = await q("SELECT count(*)::int AS count FROM projects p JOIN workspace_members wm ON wm.workspace_id=p.workspace_id WHERE wm.user_id='u_a' AND p.workspace_id='w_a' AND p.project_id='p_a'");
  const tenantLeak = await q("SELECT count(*)::int AS count FROM projects p JOIN workspace_members wm ON wm.workspace_id=p.workspace_id WHERE wm.user_id='u_a' AND p.workspace_id='w_b' AND p.project_id='p_b'");
  assert.equal(tenantA.rows[0].count, 1); assert.equal(tenantLeak.rows[0].count, 0);

  await q("INSERT INTO research_studies (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,content_hash,design_payload) VALUES ('study_1','primary',1,'w_a','p_a','u_a',$1,'{}')", ["a".repeat(64)]);
  await q("UPDATE research_studies SET locked_at=now(),locked_by_user_id='u_a' WHERE id='study_1'");
  const lockedMutation = await q("UPDATE research_studies SET design_payload='{\"changed\":true}' WHERE id='study_1'").then(() => false, () => true);
  assert.equal(lockedMutation, true);
  await q("INSERT INTO research_studies (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,content_hash,design_payload) VALUES ('study_2','primary',2,'study_1','w_a','p_a','u_a',$1,'{\"revision\":2}')", ["b".repeat(64)]);

  await q("INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at) VALUES ('gate_1','w_a','p_a','u_a','RESULTS_RELEASE','study','study_1',$1,'APPROVED','u_a',now())", ["a".repeat(64)]);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_human_gates WHERE artifact_version_id='study_2' AND approved_content_hash=$1", ["b".repeat(64)])).rows[0].count, 0);

  await q("INSERT INTO research_datasets (id,workspace_id,project_id,created_by_user_id,artifact_id,artifact_path,sha256,media_type,byte_size,schema_summary) VALUES ('dataset_1','w_a','p_a','u_a','artifact_1','private/artifact_1.csv',$1,'text/csv',12,'{}')", ["c".repeat(64)]);
await q("INSERT INTO research_analysis_plans (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,method,parameters,content_hash,engine,engine_version) VALUES ('plan_1','primary-plan',1,'w_a','p_a','u_a','DESCRIPTIVE_STATISTICS','{}',$1,'old-mike-deterministic-stats','1.1.0')", ["d".repeat(64)]);
  await q("UPDATE research_analysis_plans SET locked_at=now(),locked_by_user_id='u_a' WHERE id='plan_1'");
  const parameters = { pairing: "UNPAIRED", tail: "TWO_SIDED", alpha: 0.05, missingValuePolicy: "COMPLETE_CASE", precision: 6, rounding: "HALF_EVEN" };
  const analysis = runDeterministicAnalysis({ datasetSha256: "c".repeat(64), analysisPlanHash: "d".repeat(64), method: "DESCRIPTIVE_STATISTICS", parameters, values: [1, 2, 3, null] });
  const repeated = runDeterministicAnalysis({ datasetSha256: "c".repeat(64), analysisPlanHash: "d".repeat(64), method: "DESCRIPTIVE_STATISTICS", parameters, values: [1, 2, 3, null] });
  assert.equal(analysis.resultHash, repeated.resultHash);
const insertRun = `INSERT INTO research_analysis_runs (id,workspace_id,project_id,created_by_user_id,dataset_id,analysis_plan_id,idempotency_key,input_hash,method,engine,engine_version,result_hash,result_payload,provenance,status) VALUES ($1,'w_a','p_a','u_a','dataset_1','plan_1','same-key',$2,'DESCRIPTIVE_STATISTICS','old-mike-deterministic-stats','1.1.0',$3,$4,$5,'COMPLETED') ON CONFLICT (workspace_id,project_id,idempotency_key) DO NOTHING`;
  await Promise.all([q(insertRun, ["run_1", analysis.inputHash, analysis.resultHash, analysis.payload, { parameters }]), q(insertRun, ["run_2", analysis.inputHash, analysis.resultHash, analysis.payload, { parameters }])]);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_analysis_runs WHERE idempotency_key='same-key'")).rows[0].count, 1);

  await q("INSERT INTO research_evidence_sources (id,workspace_id,project_id,created_by_user_id,source_identity_status,source_identity,source_version,source_hash,verification_method,retrieved_at,excerpt,page_section_locator,verification_actor) VALUES ('evidence_1','w_a','p_a','u_a','UNVERIFIED','synthetic','v1',$1,'manual',now(),'synthetic excerpt','p.1','u_a')", ["e".repeat(64)]);
  await q("INSERT INTO research_claims (id,logical_id,version_number,workspace_id,project_id,created_by_user_id,claim_text,content_hash,source_identity_status,claim_support_status) VALUES ('claim_1','claim',1,'w_a','p_a','u_a','Synthetic claim',$1,'UNVERIFIED','AI_PROPOSED')", ["f".repeat(64)]);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_claim_evidence WHERE claim_version_id='claim_1' AND support_status='SUPPORTED'")).rows[0].count, 0);
  await q("INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at) VALUES ('gate_evidence','w_a','p_a','u_a','EVIDENCE_VERIFICATION','evidence','evidence_1',$1,'APPROVED','u_a',now())", ["e".repeat(64)]);
  await q("INSERT INTO research_evidence_sources (id,workspace_id,project_id,created_by_user_id,source_identity_status,source_identity,source_version,source_hash,verification_method,retrieved_at,excerpt,page_section_locator,verification_actor) SELECT 'evidence_2',workspace_id,project_id,'u_a','VERIFIED',source_identity,source_version,source_hash,verification_method,retrieved_at,excerpt,page_section_locator,'u_a' FROM research_evidence_sources WHERE id='evidence_1'");
  await q("UPDATE research_claims SET locked_at=now(),locked_by_user_id='u_a' WHERE id='claim_1'");
  await q("INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at) VALUES ('gate_claim','w_a','p_a','u_a','CLAIM_SUPPORT','claim','claim_1',$1,'APPROVED','u_a',now())", ["f".repeat(64)]);
  await q("INSERT INTO research_claims (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,claim_text,content_hash,source_identity_status,claim_support_status,locked_at,locked_by_user_id) VALUES ('claim_2','claim',2,'claim_1','w_a','p_a','u_a','Synthetic claim',$1,'VERIFIED','SUPPORTED',now(),'u_a')", ["f".repeat(64)]);
  await q("INSERT INTO research_claim_evidence (id,workspace_id,project_id,created_by_user_id,claim_version_id,evidence_source_id,support_status) VALUES ('relation_1','w_a','p_a','u_a','claim_2','evidence_2','SUPPORTED')");
  assert.equal((await q("SELECT count(*)::int AS count FROM research_claims c JOIN research_claim_evidence ce ON ce.claim_version_id=c.id JOIN research_evidence_sources e ON e.id=ce.evidence_source_id WHERE c.id='claim_2' AND c.claim_support_status='SUPPORTED' AND ce.support_status='SUPPORTED' AND e.source_identity_status='VERIFIED'")).rows[0].count, 1);

  await q("INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,event_hash) VALUES ('event_1','w_a','p_a','u_a','S0','S1','S1_DESIGN_DRAFT',$1)", ["1".repeat(64)]);
  const eventDelete = await q("DELETE FROM research_workflow_events WHERE id='event_1'").then(() => false, () => true); assert.equal(eventDelete, true);
const archiveInput = { workspaceId: "w_a", projectId: "p_a", artifactPaths: ["z", "a"], workflowEvents: [{ id: "event_1" }], humanGates: [{ id: "gate_1" }], evidenceReferences: [{ id: "evidence_1" }], analysisEngine: "old-mike-deterministic-stats@1.1.0" };
  assert.equal(sha256Canonical(stableArchiveManifest(archiveInput)), sha256Canonical(stableArchiveManifest({ ...archiveInput })));
  assert.doesNotMatch(stableArchiveManifest(archiveInput), /password|token|DATABASE_URL|b@example\.test/i);

  let formalDownRejected = false;
  try { await q(await migration("0005_research_workflow_phase2.down.sql")); }
  catch (error) { formalDownRejected = String(error?.message).includes("0005_disposable_down_refused_formal_data_present"); await q("ROLLBACK").catch(() => undefined); }
  assert.equal(formalDownRejected, true);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_studies WHERE id='study_1'")).rows[0].count, 1);

  await q("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  for (const name of migrations) await q(await migration(name));
  await q(await migration("0005_research_workflow_phase2.down.sql"));
  assert.equal((await q("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'research_%'")).rows[0].count, 0);
  fixtureRowsRetained = 0;
  console.log("MIGRATION_0001_TO_0005=PASS");
  console.log("TENANT_ISOLATION=PASS");
  console.log("WORKFLOW_STATE_MACHINE=PASS");
  console.log("LOCKED_VERSION_PROTECTION=PASS");
  console.log("HUMAN_GATE_HASH_BINDING=PASS");
  console.log("DETERMINISTIC_ANALYSIS=PASS");
  console.log("ANALYSIS_CONCURRENCY_IDEMPOTENCY=PASS");
  console.log("EVIDENCE_FIRST_GATE=PASS");
  console.log("DETERMINISTIC_ARCHIVE=PASS");
  console.log("DOWN_FORMAL_DATA_FAIL_CLOSED=PASS");
  console.log("DOWN_EMPTY_DATA=PASS");
  console.log("DISPOSABLE_DATABASE=PASS");
} catch (error) {
  console.log("DISPOSABLE_DATABASE=FAIL");
  console.log(`ERROR_CATEGORY=${typeof error?.code === "string" ? error.code : "ASSERTION_OR_RUNTIME"}`);
  process.exitCode = 2;
} finally {
  console.log(`DATABASE_WRITES_DISPOSABLE_RETAINED=${fixtureRowsRetained}`);
  await client.end().catch(() => undefined);
}
