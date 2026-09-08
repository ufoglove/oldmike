/**
 * Telegram & Web Job Gateway Integration Contract (v4.0 Spec §14, §17 Case #19)
 *
 * 定位：網站後端與 Telegram 機器人入口使用同一套 Research Work Order 與 AgentJob 體系。
 * 核心原則：
 * 1. 統一狀態機與 Idempotency：相同的 telegram_update_id 或 idempotency_key 絕不重複排程或重複執行。
 * 2. 身份對齊：透過已驗證之帳號與 Telegram ID 綁定，群組訊息或隨意 username 不得越權。
 * 3. 唯讀狀態回傳：重送 update 時安全回傳既有 Job 狀態與進度摘要，絕不二次扣款。
 */

export const TELEGRAM_JOB_GATEWAY_CONTRACT = "telegram-job-gateway/1.0.0" as const;

export type TelegramInboundMessage = {
  updateId: number;
  telegramUserId: string;
  telegramChatId: string;
  isPrivateChat: boolean;
  commandText: string;
  verifiedPortalUserId: string | null;
  receivedAt: string;
};

export type TelegramJobDispatchResult = {
  ok: boolean;
  action: "CREATED" | "IDEMPOTENT_REPLAY" | "REJECTED_UNAUTHORIZED" | "REJECTED_INVALID_COMMAND";
  jobId?: string;
  currentStatus?: string;
  summaryMessage: string;
  error?: string;
};

export function parseTelegramCommandIntent(commandText: string): {
  intent: "QUERY_STATUS" | "TRIGGER_AUTO_DRAFT" | "PAUSE_JOB" | "HELP" | "UNKNOWN";
  targetProjectId?: string;
} {
  const trimmed = commandText.trim();
  if (trimmed === "進度" || trimmed === "/status" || trimmed.startsWith("查詢")) {
    return { intent: "QUERY_STATUS" };
  }
  if (trimmed === "繼續" || trimmed === "一鍵協作" || trimmed.startsWith("/run")) {
    return { intent: "TRIGGER_AUTO_DRAFT" };
  }
  if (trimmed === "暫停" || trimmed === "/pause") {
    return { intent: "PAUSE_JOB" };
  }
  if (trimmed === "幫助" || trimmed === "/help") {
    return { intent: "HELP" };
  }
  return { intent: "UNKNOWN" };
}

/**
 * 產生 Telegram Inbound 之確定性 Idempotency Key
 */
export function buildTelegramJobIdempotencyKey(updateId: number, chatId: string): string {
  return `tg_${chatId}_${updateId}`;
}
