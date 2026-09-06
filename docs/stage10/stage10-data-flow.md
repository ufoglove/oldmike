# V3-U10-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 09 -> Stage 10 -> Stage 11)

```text
[Stage 09: 路線審查、合規準備與研究倫理]
  Stage09HandoffSnapshot (不可變快照，含審查意見、合規矩陣、倫理範疇篩檢、DMP 與工具需求)
         │
         ▼
[Stage 10: 研究工具、量表、教學／實驗材料與 Study Protocol 工作室]
  1. Intake & Instrument Setup (承接快照，零重複輸入，建立工具定義與多專案選用關係)
  2. Multi-category Instruments Configuration:
     ├─ 客觀感測與日誌：毫秒級 VR 眼動反應時間記錄協議 (RT_MS)
     ├─ 標準化心理量表：NASA-TLX 中文短版量表 (6-item) metadata 與受限權利
     └─ 實作表現評量：高空危害處置表現規準 (Rubrics) 對齊教學實踐技能目標
  3. Rights & Adaptation Governance:
     ├─ PermissionRecord: 嚴格控管 EXPORT_ITEMS 與 DIGITAL_ADMINISTRATION 動作
     └─ TranslationAdaptationPlan: 保留翻譯對照，認知訪談明確留作 Stage 11 任務
  4. Schedule of Activities & Materials:
     └─ 清楚規劃 T0 基線、介入單元、T1 立即後測與 T2 延宕測量時程及人體負擔
  5. Deterministic Sandbox Scoring Engine:
     └─ 先過濾 missing code (99)，再執行合法反向轉碼，輸出標記 SYNTHETIC_INSTRUMENT_TEST
  6. Data Capture Schema & Protocol Document Assembly:
     ├─ DataDictionary: 建立變數代碼、有效範圍與儲存分類 (DE_IDENTIFIED_ANALYSIS)
     └─ Study Protocol: 組裝研究目的、防動暈安全中斷機制、測量工具與倫理覆蓋
  7. Triple Alignment Checker (檢驗研究/分析、協議/倫理、權利/內容三重對齊)
         │
         ▼
  InstrumentProtocolSnapshot (不可變交接快照，含工具版本、計分限制、Protocol 章節與 Pilot 驗證清單)
         │
         ▼
[Stage 11: Pilot／工具預試與 Protocol 驗證 (pilot-validation)]
  ├─ 毫秒級眼動日誌系統通訊延遲壓力測試 (< 50ms)
  ├─ NASA-TLX 中文短版目標對象認知訪談 (5-8 人)
  └─ 高空危害處置 Rubric 評分者間信度 (Cohen's Kappa) 預試
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/instrument-protocol/initialize`
   - 驗證 `Stage09HandoffSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `InstrumentProtocolWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/instrument-protocol/complete`
   - 執行 `runInstrumentProtocolAlignmentCheck`（阻擋主要 RQ 缺工具、商業受限題項未授權公開匯出等）。
   - 原子寫入 `InstrumentProtocolSnapshot`，並將狀態更新為交接至 `pilot-validation`。
