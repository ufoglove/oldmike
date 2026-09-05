import { logLine } from "./lib/server-log";

// Next.js 伺服器生命週期 instrumentation（node runtime）。
// - 啟動旗標：證明日誌管線已接上（runtime logs 可檢索 oldmike-log）。
// - unhandledRejection：記錄錯誤（不改變 process 行為；避免第三方程式庫的孤立 rejection 無聲消失）。
// 注意：uncaughtException 預設行為已會印到 stderr（Zeabur 會擷取），此處不覆寫以避免改變崩潰語意。
export async function register(): Promise<void> {
  logLine("info", "startup", "old-mike research portal node instrumentation registered");
  process.on("unhandledRejection", (reason: unknown) => {
    logLine("error", "unhandled_rejection", reason instanceof Error ? (reason.stack || reason.message) : String(reason));
  });
}
