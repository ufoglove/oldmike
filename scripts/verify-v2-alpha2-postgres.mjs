import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { createV2Alpha2SyntheticProvider } from "../lib/v2-alpha2/provider.ts";
import { V2Alpha2PostgresRepository, V2Alpha2RepositoryError } from "../lib/v2-alpha2/repository.ts";
import { runV2Alpha2WorkerOnce } from "../lib/v2-alpha2/worker.ts";

assert.equal(process.env.INTEGRATION_TEST_MODE, "1");
assert.equal(process.env.TEST_FIXTURE, "1");
assert.ok(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const version = await pool.query("SHOW server_version");
  assert.match(version.rows[0].server_version, /^18\./u);
  await pool.query(`
    INSERT INTO "user" (id,name,email,"emailVerified") VALUES
      ('fixture-user-v2','Fixture Alpha2','fixture-alpha2@example.invalid',true),
      ('fixture-user-other','Other Fixture','fixture-other@example.invalid',true);
    INSERT INTO workspaces (id,name,owner_user_id) VALUES
      ('fixture-workspace-v2','Alpha2','fixture-user-v2'),
      ('fixture-workspace-other','Other','fixture-user-other');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
      ('fixture-workspace-v2','fixture-user-v2','owner'),
      ('fixture-workspace-other','fixture-user-other','owner');
  `);

  const repo = new V2Alpha2PostgresRepository(pool, { workspaceId: "fixture-workspace-v2", userId: "fixture-user-v2" }, 1);
  const createInput = { requestId: "alpha2-explicit-action-0001", operation: "GENERATE_DIRECTIONS", payloadSchemaId: "old-mike-v2-alpha2/generate-directions-input/1", requestPayload: { researchDirection: "教師如何校準生成式工具的課程使用", sourceStrategy: "NONE" } };
  const first = await repo.create(createInput);
  assert.equal(first.replayed, false);
  const replay = await repo.create(createInput);
  assert.equal(replay.replayed, true);
  assert.equal(replay.journeyRef, first.journeyRef);
  await assert.rejects(() => repo.create({ ...createInput, requestPayload: { researchDirection: "同一識別碼但不同內容", sourceStrategy: "NONE" } }), (error) => error instanceof V2Alpha2RepositoryError && error.code === "IDEMPOTENCY_CONFLICT");

  const otherRepo = new V2Alpha2PostgresRepository(pool, { workspaceId: "fixture-workspace-other", userId: "fixture-user-other" });
  await assert.rejects(() => otherRepo.getJourney(first.journeyRef), (error) => error instanceof V2Alpha2RepositoryError && error.code === "TENANT_REJECTED");

  const provider = createV2Alpha2SyntheticProvider();
  let providerSubmissions = 0;
  const countedProvider = { capability: provider.capability, async submit(input) { providerSubmissions += 1; await new Promise((resolve) => setTimeout(resolve, 60)); return provider.submit(input); } };
  const competed = await Promise.all([
    runV2Alpha2WorkerOnce(repo, countedProvider, { workerOwner: "worker-one", workerToken: "token-one" }),
    runV2Alpha2WorkerOnce(repo, countedProvider, { workerOwner: "worker-two", workerToken: "token-two" }),
  ]);
  assert.equal(competed.filter((item) => item.outcome === "COMMITTED").length, 1);
  assert.equal(providerSubmissions, 1);
  let journey = await repo.getJourney(first.journeyRef);
  assert.equal(journey.lastReadyStage, "A");
  assert.equal(journey.stageA?.directions.length, 3);

  const childResult = await runV2Alpha2WorkerOnce(repo, countedProvider, { workerOwner: "worker-three", workerToken: "token-three" });
  assert.equal(childResult.outcome, "COMMITTED");
  assert.equal(providerSubmissions, 2);
  journey = await repo.getJourney(first.journeyRef);
  assert.equal(journey.state, "STAGE_B_READY");
  assert.equal(Object.keys(journey.stageB?.fields ?? {}).length, 13);
  assert.equal(journey.stageB?.sourceDirectionId, journey.stageA?.recommendedDirectionId);
  assert.equal(journey.formalWriteCount, 0);

  const assistCreated = await repo.createFieldAssist(first.journeyRef, {
    requestId: "alpha2-field-assist-action-0001",
    targetField: "workingTitle",
    currentValue: journey.stageB.fields.workingTitle,
    contextSnapshot: { researchDirection: journey.stageA.researchDirection, selectedDirection: journey.stageA.directions.find((item) => item.directionId === journey.s0SourceDirectionId), s0: journey.stageB.fields },
  });
  assert.equal(assistCreated.replayed, false);
  const assistWorker = await runV2Alpha2WorkerOnce(repo, countedProvider, { workerOwner: "worker-assist", workerToken: "token-assist" });
  assert.equal(assistWorker.outcome, "COMMITTED");
  const assist = await repo.getFieldAssist(assistCreated.assistRef);
  assert.equal(assist.completionClass, "COMPLETE");
  assert.deepEqual(assist.artifact?.validOptions.map((option) => option.strategy), ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"]);

  const binding = await pool.query(`SELECT jobs.parent_job_id,results.job_id,
      jobs.parent_result_id::text AS parent_result_id,results.id::text AS bound_result_id,
      jobs.selected_item_hash AS child_selected_item_hash,results.selected_item_hash AS parent_selected_item_hash
    FROM research_generation_jobs jobs JOIN research_generation_results results ON results.id=jobs.parent_result_id
    WHERE jobs.operation='EXPAND_SELECTED_S0'`);
  assert.equal(binding.rowCount, 1);
  assert.equal(binding.rows[0].parent_job_id, binding.rows[0].job_id);
  assert.equal(binding.rows[0].parent_result_id, binding.rows[0].bound_result_id);
  assert.equal(binding.rows[0].child_selected_item_hash, binding.rows[0].parent_selected_item_hash);

  await assert.rejects(() => pool.query("UPDATE research_generation_results SET result_hash=$1 WHERE job_id=$2", ["f".repeat(64), first.journeyRef]), /research_generation_results_are_append_only/u);

  const late = await repo.create({ ...createInput, requestId: "alpha2-explicit-action-crash", requestPayload: { researchDirection: "租約與 crash recovery", sourceStrategy: "NONE" } });
  const oldClaim = await repo.claim({ workerOwner: "old-worker", workerToken: "old-token" });
  assert.equal(oldClaim?.id, late.jobRef);
  await repo.ensureIntent(oldClaim);
  await pool.query("SELECT pg_sleep(1.1)");
  const newClaim = await repo.claim({ workerOwner: "new-worker", workerToken: "new-token" });
  assert.equal(newClaim?.id, oldClaim.id);
  await repo.ensureIntent(newClaim);
  await assert.rejects(() => repo.markSubmissionPossible(oldClaim), (error) => error instanceof V2Alpha2RepositoryError && error.code === "FENCE_REJECTED");
  await repo.markSubmissionPossible(newClaim);
  await repo.completeUnknown(newClaim, "COMPLETION_UNKNOWN");
  await repo.markReconcileRequired(newClaim, "COMPLETION_UNKNOWN");
  const unknown = await pool.query("SELECT state FROM research_generation_jobs WHERE id=$1", [newClaim.id]);
  assert.equal(unknown.rows[0].state, "RECONCILE_REQUIRED");
  assert.equal((await repo.claim({ workerOwner: "third-worker", workerToken: "third-token" }))?.id ?? null, null);

  await assert.rejects(() => pool.query("INSERT INTO research_generation_effects (workspace_id,created_by_user_id,job_id,effect_state,effect_request_hash,provider_attempt_class) VALUES ($1,$2,$3,'ACKNOWLEDGED',$4,'RESPONSE_ACKNOWLEDGED')", ["fixture-workspace-v2", "fixture-user-v2", newClaim.id, "a".repeat(64)]), /research_generation_effect_initial_state_invalid|duplicate key/u);

  const privileges = await pool.query(`SELECT count(*)::integer AS count FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_name LIKE 'research_generation_%'`);
  assert.equal(privileges.rows[0].count, 0);
  const formalRows = await pool.query(`SELECT
    (SELECT count(*) FROM projects)+(SELECT count(*) FROM research_documents)+(SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_workflow_events) AS count`);
  assert.equal(Number(formalRows.rows[0].count), 0);

  const down = await readFile(path.join(portalRoot, "database", "proposals", "v2-alpha2-research-generation.down.sql"), "utf8");
  await assert.rejects(() => pool.query(down), /research_generation_rows_present/u);
  const stillPresent = await pool.query("SELECT to_regclass('research_generation_jobs') IS NOT NULL AS present");
  assert.equal(stillPresent.rows[0].present, true);

  console.log("V2_ALPHA2_POSTGRES18=PASS");
  console.log("V2_ALPHA2_REPOSITORY_IDEMPOTENCY=PASS_REPLAY_AND_409");
  console.log("V2_ALPHA2_CAS_LEASE_FENCE=PASS_LATE_RESULT_REJECTED");
  console.log("V2_ALPHA2_CRASH_RECOVERY=PASS_INTENT_RECLAIM_UNKNOWN_NO_RESEND");
  console.log("V2_ALPHA2_PARENT_RESULT_BINDING=PASS_EXACT_COMPOSITE");
  console.log("V2_ALPHA2_PUBLIC_PRIVILEGES=0");
  console.log("V2_ALPHA2_FORMAL_RESEARCH_ROWS=0");
} finally {
  await pool.end();
}
