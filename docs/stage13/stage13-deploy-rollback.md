# V3-U13-FULL 部署、資料庫遷移與回滾機制 (Deploy & Rollback Runbook)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、部署架構與隔離政策
1. **本輪實作邊界**：本輪所有變更皆於受控開發環境（`/home/node/dev/repo`）內完成，未執行正式生產環境之破壞性操作。
2. **分析資料集封存**：分析資料集採用 Parquet 結構化儲存並計算 64 字元 SHA-256 數位簽章，快照記錄存於 `stage_completion_snapshots`，原始 Raw Data 維持不可變。
3. **安全防護**：受控資料清理管線（`data-preparation-pipeline.ts`）完全運行於本地隔離沙箱，嚴禁任意 eval 與外部程式碼執行。

## 二、回滾步驟 (Rollback Runbook)
若需完全撤銷第十三階段之功能：
1. **快照記錄還原**：將 `stage_completion_snapshots` 中 `stageId = 'data-governance'` 之記錄標記為 `SUPERSEDED` 或軟刪除，上游 `FormalExecutionSnapshot` 狀態重設為未交接。
2. **程式碼復原**：
   ```bash
   git restore lib/data-governance-* lib/data-preparation-pipeline.ts
   rm -rf app/api/projects/[projectId]/data-governance/
   ```
3. **快取清理**：重啟 Next.js 服務以釋放記憶體中快顯之工作區物件。
