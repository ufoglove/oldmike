# V3-U15-FULL 部署、資料庫遷移與回滾機制 (Deploy & Rollback Runbook)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、部署架構與隔離政策
1. **本輪實作邊界**：本輪所有變更皆於受控開發環境（`/home/node/dev/repo`）內完成，未執行正式生產環境之破壞性操作。
2. **證據驅動寫作保護**：正文所有統計數值嚴格綁定不可變 `ResultFact` 標籤（附帶 64 字元 SHA-256 數位簽章），Discussion 幽靈數據與不可能 p 值觸發 FATAL 阻擋。
3. **安全防護**：寫作服務運行於本地隔離沙箱，拒絕任意 HTML/SVG/LaTeX 惡意注入；快照記錄存於 `stage_completion_snapshots`。

## 二、回滾步驟 (Rollback Runbook)
若需完全撤銷第十五階段之功能：
1. **快照記錄還原**：將 `stage_completion_snapshots` 中 `stageId = 'results-writing'` 之記錄標記為 `SUPERSEDED` 或軟刪除，上游 `AnalysisResultsSnapshot` 狀態重設為未交接。
2. **程式碼復原**：
   ```bash
   git restore lib/manuscript-writing-*
   rm -rf app/api/projects/[projectId]/manuscript-writing/
   ```
3. **快取清理**：重啟 Next.js 服務以釋放記憶體中快顯之工作區物件。
