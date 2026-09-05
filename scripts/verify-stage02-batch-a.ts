/**
 * Self-contained executable verification runner for Batch A contracts
 */
import { Pool } from "pg";
import assert from "node:assert/strict";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5433/v3u01_dev",
});

const testWorkspaceId = "ws_test_stage02";
const testProjectId = "proj_test_batch_a";
const testUserId = "usr_test_evaluator";

async function runBatchAVerification() {
  console.log("=== Running Batch A Shared Operational Layer Verification ===");

  // 0. Setup test fixtures
  await pool.query("DELETE FROM field_locks WHERE project_id = $1", [testProjectId]);
  await pool.query("DELETE FROM requirement_issues WHERE project_id = $1", [testProjectId]);
  await pool.query("DELETE FROM stage_completion_snapshots WHERE project_id = $1", [testProjectId]);
  await pool.query("DELETE FROM projects WHERE project_id = $1", [testProjectId]);
  await pool.query("DELETE FROM workspaces WHERE id = $1", [testWorkspaceId]);
  await pool.query("DELETE FROM \"user\" WHERE id = $1", [testUserId]);

  await pool.query(
    `INSERT INTO \"user\" (id, name, email) VALUES ($1, 'Batch A Evaluator', 'evaluator@stage02.local')`,
    [testUserId]
  );
  await pool.query(
    `INSERT INTO workspaces (id, name, owner_user_id) VALUES ($1, 'Batch A Workspace', $2)`,
    [testWorkspaceId, testUserId]
  );
  await pool.query(
    `INSERT INTO projects (workspace_id, project_id, title, status, created_by, storage_backend) 
     VALUES ($1, $2, 'AI in Cross-Disciplinary Safety', 'ACTIVE', $3, 'OPENCLAW_CONTROLLED')`,
    [testWorkspaceId, testProjectId, testUserId]
  );
  console.log("✓ Fixtures established in isolated PG15");

  // 1. Test Unfilled project generates blocking RequirementIssues
  const { StageReadinessService } = await import("../lib/stage-readiness-service.ts");
  const readiness1 = await StageReadinessService.evaluateTopicLabReadiness(
    testWorkspaceId,
    testProjectId
  );

  assert.equal(readiness1.isReady, false, "Initial stage must NOT be ready");
  assert.equal(readiness1.canProceed, false, "Must NOT proceed with missing requirements");
  assert.ok(readiness1.blockingIssues.length >= 3, "Must have at least 3 blocking issues (RQ, Gap, Contribution)");

  const rqIssue = readiness1.blockingIssues.find((i) => i.fieldRef === "research_question");
  assert.ok(rqIssue, "Must report research_question missing");
  assert.equal(rqIssue?.destination.routeId, "topic-lab");
  assert.equal(rqIssue?.destination.anchor, "field-research-question");
  console.log("✓ Step 1: StageReadiness detected blocking issues and created deep links");

  // 2. Test Field Locking
  const { StageOperationRepository } = await import("../lib/stage-operation-repository.ts");
  const lock1 = await StageOperationRepository.acquireFieldLock({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    fieldRef: "research_question",
    lockedValue: "How do LLMs reduce human error in industrial training?",
    userId: testUserId,
    lockPolicy: "MANUAL",
  });

  assert.equal(lock1.lockVersion, 1);
  assert.equal(lock1.lockedValue, "How do LLMs reduce human error in industrial training?");

  const lock2 = await StageOperationRepository.acquireFieldLock({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    fieldRef: "research_question",
    lockedValue: "How do multimodal LLMs reduce human error in industrial safety?",
    userId: testUserId,
    lockPolicy: "MANUAL",
  });
  assert.equal(lock2.lockVersion, 2, "Re-locking must increment lock_version");
  console.log("✓ Step 2: Field locking acquired and incremented lock_version to 2");

  // 3. Test Backend write protection
  const staleCheck = await StageOperationRepository.assertFieldWritePermitted({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    fieldRef: "research_question",
    expectedLockVersion: 1, // Stale version
  });
  assert.equal(staleCheck.permitted, false, "Must reject stale version write");
  assert.ok(staleCheck.reason?.includes("is locked"), "Reason must mention lock");

  const validCheck = await StageOperationRepository.assertFieldWritePermitted({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    fieldRef: "research_question",
    expectedLockVersion: 2,
  });
  assert.equal(validCheck.permitted, true, "Must allow write matching current lock version");
  console.log("✓ Step 3: Backend asserted write-protection against stale/unauthorized writes");

  // 4. Test AI Field Policy
  const { isFieldAiWritable } = await import("../lib/field-policy-service.ts");
  assert.equal(isFieldAiWritable("topic-lab", "research_question"), true);
  assert.equal(isFieldAiWritable("ethics", "irb_approval_number"), false, "AI must NOT write IRB number");
  assert.equal(isFieldAiWritable("analysis", "p_value_results"), false, "AI must NOT invent p-values");
  assert.equal(isFieldAiWritable("submission-gate", "author_signatures"), false, "AI must NOT forge signatures");
  console.log("✓ Step 4: AI Field Policy strictly enforced on critical academic/ethics fields");

  // 5. Test Fulfilling requirements unlocks stage advancement
  await pool.query(
    `UPDATE projects SET project_draft = $1 WHERE workspace_id = $2 AND project_id = $3`,
    [
      JSON.stringify({
        selectedTopic: {
          researchQuestion: "How do multimodal LLMs reduce human error in industrial safety?",
          gapStatement: "Prior studies only focused on text logs, lacking real-time audio-visual situational telemetry.",
          expectedContribution: "A grounded multimodal intervention framework with measurable reduction in safety deviations.",
          methodologyOverview: "Empirical quasi-experiment across 4 simulated training centers.",
        },
      }),
      testWorkspaceId,
      testProjectId,
    ]
  );

  const readiness2 = await StageReadinessService.evaluateTopicLabReadiness(
    testWorkspaceId,
    testProjectId
  );

  assert.equal(readiness2.isReady, true, "Stage must be ready after filling required fields");
  assert.equal(readiness2.canProceed, true, "Stage must allow proceeding");
  assert.equal(readiness2.blockingIssues.length, 0, "No blocking issues should remain");
  assert.equal(readiness2.nextStageId, "blueprint");
  console.log("✓ Step 5: Requirement fulfillment verified; stage advancement unlocked");

  // 6. Test Stage Completion & Handoff with Idempotency
  const idemKey = "idem_handoff_test_001";
  const snap1 = await StageOperationRepository.saveCompletionSnapshot({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    snapshotData: { summary: "Complete Stage 02 Snapshot" },
    nextStageId: "blueprint",
    idempotencyKey: idemKey,
  });
  assert.ok(snap1.id);
  assert.equal(snap1.status, "COMPLETED");

  const snap2 = await StageOperationRepository.saveCompletionSnapshot({
    workspaceId: testWorkspaceId,
    projectId: testProjectId,
    stageId: "topic-lab",
    snapshotData: { summary: "Complete Stage 02 Snapshot" },
    nextStageId: "blueprint",
    idempotencyKey: idemKey,
  });
  assert.equal(snap2.id, snap1.id, "Idempotent execution must return identical snapshot");
  console.log("✓ Step 6: Immutable stage completion snapshot saved with idempotency guarantee");

  console.log("\n==================================================");
  console.log("🎉 ALL BATCH A VERIFICATION CHECKS PASSED (LIVE PG)!");
  console.log("==================================================");
}

runBatchAVerification()
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
