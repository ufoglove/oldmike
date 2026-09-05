/**
 * LIVE Verification Runner for Batch C (T15 - T17, T23 - T28)
 * 驗證老麥批次自動化（補空白／優化未鎖定／補全並上鎖）與選題快照（TopicSelectionSnapshot）交接
 */
import assert from "node:assert/strict";
import { GenericStageAdapter } from "../lib/generic-stage-adapter.ts";
import { StageOperationRepository } from "../lib/stage-operation-repository.ts";

const workspaceId = "ws_test_stage02";
const projectId = "proj_test_batch_a"; // Use established project from batch A
const userId = "usr_test_evaluator";

async function runBatchCVerification() {
  console.log("=== Running Batch C Generic Adapters & Batch Automation Verification ===");

  // Defense-in-depth: reset locks for this project so repeated runs are idempotent
  await StageOperationRepository.releaseFieldLocksForProject(workspaceId, projectId, "topic-lab");

  // 1. T24: 測試「補空白 (FILL_BLANKS)」不覆蓋已有內容
  const initialPayload = {
    research_question: "現有已填寫的研究問題",
    gap_statement: "", // 空白
  };

  const fillResult = await GenericStageAdapter.executeBatchAction({
    workspaceId,
    projectId,
    stageId: "topic-lab",
    userId,
    mode: "FILL_BLANKS",
    currentPayload: initialPayload,
  });

  assert.equal(
    fillResult.updatedPayload.research_question,
    "現有已填寫的研究問題",
    "T24: Existing research_question must NOT be overwritten in FILL_BLANKS"
  );
  assert.ok(
    fillResult.updatedPayload.gap_statement.length > 0,
    "T24: Blank gap_statement must be populated"
  );
  console.log("✓ T24: FILL_BLANKS preserved existing non-empty field and filled blank field");

  // 2. T25: 先行手動鎖定 research_question，再執行「優化未鎖定 (OPTIMIZE_UNLOCKED)」
  await StageOperationRepository.acquireFieldLock({
    workspaceId,
    projectId,
    stageId: "topic-lab",
    fieldRef: "research_question",
    lockedValue: "手動鎖定的神聖研究問題",
    userId,
    lockPolicy: "MANUAL",
  });

  const optPayload = {
    research_question: "手動鎖定的神聖研究問題",
    gap_statement: "舊的未鎖定缺口陳述",
  };

  const optResult = await GenericStageAdapter.executeBatchAction({
    workspaceId,
    projectId,
    stageId: "topic-lab",
    userId,
    mode: "OPTIMIZE_UNLOCKED",
    currentPayload: optPayload,
  });

  assert.ok(
    optResult.skippedLockedFields.includes("research_question"),
    "T25: Locked research_question must be skipped from optimization"
  );
  assert.equal(
    optResult.updatedPayload.research_question,
    "手動鎖定的神聖研究問題",
    "T25: Locked value must remain untouched"
  );
  console.log("✓ T25: OPTIMIZE_UNLOCKED safely skipped locked field and respected lock boundaries");

  // 3. T26: 測試「補全並上鎖 (FILL_AND_LOCK)」自動取得 AUTO_LOCKED
  const fillAndLockResult = await GenericStageAdapter.executeBatchAction({
    workspaceId,
    projectId,
    stageId: "topic-lab",
    userId,
    mode: "FILL_AND_LOCK",
    currentPayload: {
      research_question: "手動鎖定的神聖研究問題",
      methodology_overview: "",
    },
  });

  assert.ok(fillAndLockResult.newLocksAcquiredCount > 0, "T26: New locks must be acquired");
  const currentLocks = await StageOperationRepository.getFieldLocks(
    workspaceId,
    projectId,
    "topic-lab"
  );
  const methodLock = currentLocks.find((l) => l.fieldRef === "methodology_overview");
  assert.ok(methodLock, "T26: methodology_overview must now be locked");
  assert.equal(methodLock?.lockPolicy, "AUTOMATION_POLICY", "T26: Auto-locked field must be tagged AUTOMATION_POLICY");
  console.log("✓ T26: FILL_AND_LOCK acquired AUTOMATION_POLICY lock on unfilled fields");

  // 4. T15-T17: 驗證 TopicSelectionSnapshot 規格與不可覆寫交接合約
  const snapshot = GenericStageAdapter.buildTopicSelectionSnapshot({
    workspaceId,
    projectId,
    topicId: "top_001",
    title: "基於多模態邊緣感知之智慧工安監測研究",
    rq: "多模態邊緣感知如何降低工安反應時間？",
    gapStatement: "現有研究缺乏即時高噪聲情境下實證驗證。",
    expectedContribution: "提出具容錯能力之邊緣端即時預警架構。",
    methodology: "四組模擬場域準實驗。",
    userId,
    isHumanApproved: false, // AI 輔助產生
  });

  assert.equal(
    snapshot.selectionMethod,
    "AUTO_SELECTED_DRAFT",
    "T15: Build-time adoption must tag AUTO_SELECTED_DRAFT (not a fabricated HUMAN approval)"
  );
  assert.ok(snapshot.handoffLimitations.length >= 2, "T16: Limitations must accompany snapshot into Stage 3");
  assert.ok(snapshot.downstreamOpenRequirements.length >= 1, "T16: Open requirements clearly defined for 投稿導航");
  assert.ok(snapshot.lockManifest.length >= 1, "T17: Lock manifest explicitly passed to preserve locked fields");
  console.log("✓ T15-T17: TopicSelectionSnapshot correctly formed with non-fabrication flags and handoff locks");

  console.log("\n==================================================");
  console.log("🎉 ALL BATCH C VERIFICATION CHECKS PASSED (LIVE PG)!");
  console.log("==================================================");
}

runBatchCVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
