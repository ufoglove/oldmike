# V3-U13-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §27) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `FormalExecutionSnapshot` | `lib/formal-execution-contract.ts` | 第十三階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `totalRawRecordsCaptured`, `rawDataManifestChecksumSha256`, `identityVaultRef` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `IdentityMappingVault` (身分金庫) | `lib/data-governance-contract.ts` | 最高安全隔離層，儲存真實身分與聯絡方式 | 工作區僅呈現虛擬代碼 (P-001)，PII 絕不進分析 Dataset | 獨立金庫稽核與權限隔離 | PASS (T25, T26) |
| `CanonicalDataVariable` (資料字典) | `lib/data-governance-contract.ts` | 標準化變數字典與單位、有效範圍、sentinel 定義 | 保持 ID 字串前導零 (0012) 與小數點 locale 不失真 | 嚴格區分 0 與缺失 null，不全域合併 | PASS (T09, T10, T17) |
| `CleaningRule` / `DataPreparationPipeline` | `lib/data-preparation-pipeline.ts` | 確定性受控清理管線 (v1.0.0) | 99 與 -9 優先攔截為 missing，合法反向運算 $lower+upper-x$ | 嚴禁任意 eval 與重複反向轉碼 | PASS (T11, T12, T16) |
| `DataCorrectionRecord` / 裁決 | `lib/formal-execution-contract.ts` | 原始資料修正追蹤與審核 | 原始 Raw Data 保持不可變，修正僅作用於衍生 Clean 資料集 | 衝突修正不採 latest-wins，需經審核 | PASS (T13, T14) |
| `OutlierFlagging` (極端值管理) | `lib/data-preparation-pipeline.ts` | 非破壞性極端值標記 (`FLAGGED_RETAINED`) | 超出生理極限者標記保留，不自動刪除 | 排除需基於 named analysis 與科學理由 | PASS (T20, T21) |
| 教育情境隔離 (`MOE_TPR`) | `lib/data-governance-contract.ts` | 學生課程資料與研究同意權限隔離 | 未同意參與研究之學生紀錄絕不流入分析 Dataset | 違規洩漏精確觸發 FATAL 阻擋 | PASS (T22) |
| AI 切分防洩漏 (`Fold-safe Fit`) | `lib/data-governance-contract.ts` | 機器學習與預測特徵轉換隔離 | 嚴格限制 Scaler/Imputer 僅能在訓練 Fold 內 Fit | 全資料預先 Fit 精確觸發 FATAL 阻擋 | PASS (T28, T29) |
| `AnalysisDatasetRelease` | `lib/data-governance-contract.ts` | 封存之分析資料集發布版本 (v1.0-formal) | 關聯 AnalysisScope，計算 SHA-256 數位簽章 | 一旦鎖定嚴禁原地覆寫，變更需新版本 | PASS (T30, T43, T44) |
| `DataQualitySummary` / Lineage | `lib/data-governance-contract.ts` | 資料品質診斷報告與 W3C PROV-O 血緣追蹤 | 所有指標強制標註 `DATA_PREPARATION_DIAGNOSTIC` | 追蹤每一筆衍生欄位至原始 Raw ID 與 Rule | PASS (T30, T45) |
| `DataGovernanceSnapshot` | `lib/data-governance-contract.ts` | 第十三至第十四階段不可變交接快照 | 傳遞至 Stage 14 (`analysis-execution`)，帶入分析資料集 | 包含 Content Hash、延後分析義務與校驗碼 | PASS (T46, T48) |
