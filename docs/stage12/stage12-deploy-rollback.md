# V3-U12-FULL 部署、資料庫遷移與回滾機制 (Deploy & Rollback Runbook)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、部署架構與隔離政策
1. **本輪實作邊界**：本輪所有變更皆於受控開發環境（`/home/node/dev/repo`）內完成，未執行正式生產環境之破壞性操作。
2. **原始資料不可變層**：正式原始數據（`RawDataRecord`）採 Append-only 儲存並計算 SHA-256 簽章，直接識別身分存於獨立金庫 `IdentityMappingVault`，絕不污染分析資料庫。
3. **安全防護**：正式執行放行閘門（`FormalExecutionGate`）嚴格核對真實倫理核准函（REC-115-089），未獲授權嚴禁啟動現場收案。

## 二、回滾步驟 (Rollback Runbook)
若需完全撤銷第十二階段之功能：
1. **快照記錄還原**：將 `stage_completion_snapshots` 中 `stageId = 'formal-execution'` 之記錄標記為 `SUPERSEDED` 或軟刪除，上游 `PilotValidationSnapshot` 狀態重設為未交接。
2. **程式碼復原**：
   ```bash
   git restore lib/formal-execution-*
   rm -rf app/api/projects/[projectId]/formal-execution/
   ```
3. **快取清理**：重啟 Next.js 服務以釋放記憶體中快顯之工作區物件。
