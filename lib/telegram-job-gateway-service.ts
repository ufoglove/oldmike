/**
 * Telegram & Web Job Gateway Dispatcher (v4.0 Spec §14, §17 Case #19)
 *
 * 實作 Telegram 與網站共用 AgentJob 之派送與冪等重送防護邏輯。
 */

import {
  type TelegramInboundMessage,
  type TelegramJobDispatchResult,
  parseTelegramCommandIntent,
  buildTelegramJobIdempotencyKey,
} from "./telegram-job-gateway-contract.ts";

export interface MockJobStore {
  jobsByIdempotency: Map<string, { jobId: string; status: string; taskType: string }>;
}

export class TelegramJobGatewayService {
  private store: MockJobStore;

  constructor(store?: MockJobStore) {
    this.store = store || { jobsByIdempotency: new Map() };
  }

  async handleInboundMessage(message: TelegramInboundMessage): Promise<TelegramJobDispatchResult> {
    // 1. 權限檢查：必須為已驗證帳號
    if (!message.verifiedPortalUserId) {
      return {
        ok: false,
        action: "REJECTED_UNAUTHORIZED",
        summaryMessage: "未綁定老麥科研工作台帳號，請先於網站完成身分綁定。",
        error: "PORTAL_USER_NOT_LINKED",
      };
    }

    // 2. 指令意圖解析
    const { intent } = parseTelegramCommandIntent(message.commandText);
    if (intent === "UNKNOWN") {
      return {
        ok: false,
        action: "REJECTED_INVALID_COMMAND",
        summaryMessage: "未知指令。可用指令：進度、一鍵協作、繼續、暫停、幫助。",
        error: "INVALID_COMMAND",
      };
    }

    if (intent === "HELP") {
      return {
        ok: true,
        action: "CREATED",
        summaryMessage: "老麥科研助手指令清單：\n- 進度：查詢當前專案最新研究進度\n- 繼續／一鍵協作：啟動集中審閱自動化\n- 暫停：安全停止運行中任務",
      };
    }

    // 3. 冪等檢查
    const idempotencyKey = buildTelegramJobIdempotencyKey(message.updateId, message.telegramChatId);
    const existing = this.store.jobsByIdempotency.get(idempotencyKey);
    if (existing) {
      return {
        ok: true,
        action: "IDEMPOTENT_REPLAY",
        jobId: existing.jobId,
        currentStatus: existing.status,
        summaryMessage: `[冪等確認] 此指令已排程處理中 (Job: ${existing.jobId}, 狀態: ${existing.status})，不重複執行。`,
      };
    }

    // 4. 派發新 Job (示範接入共通 AgentJob 格式)
    const newJobId = `aj_tg_${message.updateId}_${Date.now().toString(36)}`;
    const jobRecord = {
      jobId: newJobId,
      status: intent === "QUERY_STATUS" ? "SUCCEEDED" : "QUEUED",
      taskType: intent === "QUERY_STATUS" ? "RESEARCH_STATUS_QUERY" : "AUTO_DRAFT_CONCENTRATED_REVIEW",
    };

    this.store.jobsByIdempotency.set(idempotencyKey, jobRecord);

    return {
      ok: true,
      action: "CREATED",
      jobId: newJobId,
      currentStatus: jobRecord.status,
      summaryMessage: intent === "QUERY_STATUS"
        ? `目前專案進度正常，所有研究事實與文獻引用維持鎖定。`
        : `已啟動研究工作單 (Job: ${newJobId})，採集中審閱模式運行，完成後將提供完整差異報告。`,
    };
  }
}
