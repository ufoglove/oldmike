# V3-U07-FULL 部署、資料庫遷移與回滾機制 (Deploy & Rollback Runbook)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、部署架構與隔離政策
1. **本輪實作邊界**：本輪所有變更皆於受控開發環境（`/home/node/dev/repo`）內完成，未執行正式生產環境之破壞性操作。
2. **資料表架構**：本階段沿用既有 JSONB 結構化儲存與快照表（`stage_completion_snapshots`），無需額外新增獨立關聯表，大幅降低 Schema 遷移風險。
3. **安全防護**：受控計算引擎（`planning-calculation-engine.ts`）完全運行於本地隔離沙箱，嚴禁任意使用者執行碼與連網權限。

## 二、回滾步驟 (Rollback Runbook)
若需完全撤銷第七階段之功能：
1. **快照記錄還原**：將 `stage_completion_snapshots` 中 `stageId = 'study-design'` 之記錄標記為 `SUPERSEDED` 或軟刪除，上游 `TheoryMechanismSnapshot` 狀態重設為未交接。
2. **程式碼復原**：
   ```bash
   git restore components/StudyDesignStudioView.tsx lib/study-design-planning-* lib/planning-calculation-engine.ts
   rm -rf app/api/projects/[projectId]/study-design/
   ```
3. **快取清理**：重啟 Next.js 服務以釋放記憶體中快顯之工作區物件。
