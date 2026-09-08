import assert from "node:assert/strict";
import {
  evaluateConcentratedReviewReadiness,
} from "../lib/concentrated-review-contract.ts";
import {
  TelegramJobGatewayService,
} from "../lib/telegram-job-gateway-service.ts";
import {
  parseTelegramCommandIntent,
  buildTelegramJobIdempotencyKey,
} from "../lib/telegram-job-gateway-contract.ts";

console.log("=== 開始執行 批次 C (集中審查與 Telegram 冪等) 契約驗證 ===");

// 1. 測試 Concentrated Review 阻擋評估邏輯
const fatalReport = {
  reviewId: "cr_test_1",
  workOrderId: "wo_test",
  projectId: "proj_test",
  mode: "AUTO_DRAFT_FINAL_REVIEW",
  evaluatedAt: new Date().toISOString(),
  totalStagesScanned: 5,
  totalFieldsUpdated: 2,
  totalFieldsLocked: 1,
  totalFieldsProtected: 1,
  exceptionsCount: 1,
  exceptions: [
    {
      exceptionId: "exc_1",
      stageId: "study-design",
      fieldRef: "sample_size",
      severity: "FATAL_DATA_MISSING",
      reason: "缺少實際收案樣本數據",
      recommendedHumanAction: "請填入真實樣本數",
      deepLinkPath: "/projects/proj_test/study-design",
    },
  ],
  draftCandidates: [
    {
      stageId: "study-design",
      fieldRef: "research_question",
      previousValue: null,
      candidateValue: "探討 AI 對工安訓練之影響",
      lockStatus: "AUTO_ADOPTED_DRAFT",
      rationale: "自動補全問題描述",
    },
  ],
  finalHandoffReady: false,
};

const fatalCheck = evaluateConcentratedReviewReadiness(fatalReport);
assert.equal(fatalCheck.isReadyForHumanReview, false, "含 FATAL 缺失時嚴格禁止進入最終簽核");
assert.ok(fatalCheck.blockers.length > 0, "需列出具體阻擋原因");

// 2. 測試 Concentrated Review 正常通過情境
const readyReport = {
  ...fatalReport,
  exceptions: [],
  exceptionsCount: 0,
  finalHandoffReady: true,
};
const readyCheck = evaluateConcentratedReviewReadiness(readyReport);
assert.equal(readyCheck.isReadyForHumanReview, true, "無致命缺失且具備草稿時應放行審查");
assert.equal(readyCheck.blockers.length, 0);

// 3. 測試 Telegram 意圖解析
assert.equal(parseTelegramCommandIntent("進度").intent, "QUERY_STATUS");
assert.equal(parseTelegramCommandIntent("/status").intent, "QUERY_STATUS");
assert.equal(parseTelegramCommandIntent("繼續").intent, "TRIGGER_AUTO_DRAFT");
assert.equal(parseTelegramCommandIntent("一鍵協作").intent, "TRIGGER_AUTO_DRAFT");
assert.equal(parseTelegramCommandIntent("暫停").intent, "PAUSE_JOB");
assert.equal(parseTelegramCommandIntent("未知內容xyz").intent, "UNKNOWN");

// 4. 測試 Telegram 閘道服務：未綁定使用者阻擋
const gateway = new TelegramJobGatewayService();
const unauthResult = await gateway.handleInboundMessage({
  updateId: 1001,
  telegramUserId: "tg_user_999",
  telegramChatId: "chat_999",
  isPrivateChat: true,
  commandText: "繼續",
  verifiedPortalUserId: null, // 未綁定
  receivedAt: new Date().toISOString(),
});
assert.equal(unauthResult.ok, false);
assert.equal(unauthResult.action, "REJECTED_UNAUTHORIZED");

// 5. 測試 Telegram 閘道服務：首次指派與重複重送冪等測試
const firstResult = await gateway.handleInboundMessage({
  updateId: 1002,
  telegramUserId: "tg_user_123",
  telegramChatId: "chat_123",
  isPrivateChat: true,
  commandText: "一鍵協作",
  verifiedPortalUserId: "portal_user_123",
  receivedAt: new Date().toISOString(),
});
assert.equal(firstResult.ok, true);
assert.equal(firstResult.action, "CREATED");
assert.ok(firstResult.jobId);

// 相同 updateId 再次抵達
const replayResult = await gateway.handleInboundMessage({
  updateId: 1002,
  telegramUserId: "tg_user_123",
  telegramChatId: "chat_123",
  isPrivateChat: true,
  commandText: "一鍵協作",
  verifiedPortalUserId: "portal_user_123",
  receivedAt: new Date().toISOString(),
});
assert.equal(replayResult.ok, true);
assert.equal(replayResult.action, "IDEMPOTENT_REPLAY");
assert.equal(replayResult.jobId, firstResult.jobId, "冪等重送需回傳相同 Job ID");
assert.ok(replayResult.summaryMessage.includes("冪等確認"));

console.log("=== 批次 C (集中審查與 Telegram 冪等) 契約驗證全部通過 (PASS) ===");
