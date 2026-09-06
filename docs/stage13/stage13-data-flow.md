# V3-U13-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 12 -> Stage 13 -> Stage 14)

```text
[Stage 12: 正式研究執行與資料蒐集]
  FormalExecutionSnapshot (不可變快照，含收案統計、Raw Data 數位簽章與安全事件紀錄)
         │
         ▼
[Stage 13: 資料治理、清理與 Analysis Dataset 工作區]
  1. Intake & Source Scope Freeze:
     ├─ 檢查 FormalExecutionSnapshot 與 Raw Data SHA-256 簽章
     └─ 凍結本次處理範圍，區隔正式與測試資料 (嚴禁混入 Pilot 資料)
  2. Data Tiers & Privacy Governance:
     ├─ IdentityMappingVault: 受試者真實身分隔離於金庫，工作區僅用虛擬代碼 (P-001)
     ├─ 教育情境防護 (MOE_TPR): 未同意參與研究之學生紀錄絕不流入分析資料集
     └─ 建立標準化資料字典 (DataDictionary) 與欄位映射 (SourceMapping)
  3. Deterministic Data Preparation Pipeline:
     ├─ 缺失碼優先攔截 (99 / -9 優先轉譯為 null，嚴防產生 6-99=-93 錯誤)
     ├─ 安全反向計分 (僅對合法範圍執行 lower+upper-x，防止重複反向)
     ├─ 極端值非破壞性標記 (FLAGGED_RETAINED，不為顯著性隨意刪除數據)
     └─ AI 切分防洩漏 (Fold-safe Fit，嚴禁在全資料上預先 Fit Scaler/Imputer)
  4. Data Quality Dashboard & W3C PROV-O Lineage:
     ├─ 品質指標全面標記 DATA_PREPARATION_DIAGNOSTIC，不生成假顯著結論
     └─ 每筆衍生紀錄建立 Lineage 邊緣，直溯原始 Raw ID、Rule 與 Run ID
  5. Analysis Dataset Release Sealing:
     └─ 依據 AnalysisScope 封存分析資料集，計算 SHA-256 數位簽章並鎖定
         │
         ▼
  DataGovernanceSnapshot (不可變交接快照，含 Analysis Dataset 雜湊、資料字典與 Stage 14 分析義務)
         │
         ▼
[Stage 14: 分析實驗室 Execution Mode、研究結果與圖表 (analysis-execution)]
  ├─ 讀取指定分析資料集版本與 SHA-256 雜湊
  ├─ 執行線性混合效應模型 (LMM) 與 ANCOVA 統計推論檢定
  └─ 產出實證估計量、95% 信賴區間與科研圖表
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/data-governance/initialize`
   - 驗證 `FormalExecutionSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `DataGovernanceWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/data-governance/complete`
   - 執行 `runDataGovernanceGateCheck`（阻擋資料洩漏、未同意學生紀錄流出、分析資料集未發布等違規）。
   - 原子寫入 `DataGovernanceSnapshot`，並將狀態更新為交接至 `analysis-execution`。
