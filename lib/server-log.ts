import "server-only";

// 結構化日誌（最小錯誤日誌層）：
// - 單行輸出到 stdout，方便 Zeabur runtime logs 檢索（前綴 oldmike-log）。
// - 永不 throw；不記錄 body、原文、API key、token 等 PII/機密；只記錄錯誤碼與型別層資訊。
export function logLine(level: "info" | "warn" | "error", scope: string, message: string, meta: Record<string, string | number> = {}): void {
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), level, scope, message, ...meta });
    process.stdout.write(`oldmike-log ${line}\n`);
  } catch {
    // 日誌失敗不影響主流程
  }
}

export function logError(scope: string, error: unknown, meta: Record<string, string | number> = {}): void {
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  logLine("error", scope, message, meta);
}
