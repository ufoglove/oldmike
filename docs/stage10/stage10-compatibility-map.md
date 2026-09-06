# V3-U10-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §26) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `Stage09HandoffSnapshot` | `lib/route-review-compliance-contract.ts` | 第十階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `rqRefs`, `instrumentRequirementsSummary`, `protocolNeedsSummary` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `InstrumentDefinition` / `InstrumentVersion` | `lib/instrument-protocol-contract.ts` | 工具定義與具體施測版本分離，多專案引用 | 支援感測日誌、問卷量表、表現規準 (Rubrics) | 嚴格區分原版與修訂版，不混為單一 DOI | PASS (T10, T11, T12) |
| `ProjectInstrumentUse` | `lib/instrument-protocol-contract.ts` | 本專案工具選用關係、對齊 RQ 與時點 | 對應第七階段 Measurement Requirements 與時點 | 主要 RQ 缺乏對應工具時觸發阻擋 | PASS (T06, T09) |
| `PermissionRecord` | `lib/instrument-protocol-contract.ts` | 版權與動作權限矩陣 (`VIEW`, `DIGITAL_ADMIN`, `EXPORT`) | 檢查是否允許公開匯出題項與數位施測 | 受限商業題項未授權公開時精確觸發 FATAL | PASS (T17, T18, T24) |
| `TranslationAdaptationPlan` | `lib/instrument-protocol-contract.ts` | 翻譯與文化調適計畫 | 記錄來源題項對照與文化修訂點 | 機器翻譯不標記為 Validated Translation | PASS (T19, T20) |
| `ActivityScheduleItem` (Schedule of Activities) | `lib/instrument-protocol-contract.ts` | 活動與測量時程表 (T0, T1, T2 延宕追蹤) | 串聯研究元件、介入劑量、負擔分鐘數與執行角色 | 清楚界定基線與 14 日延宕追蹤時點 | PASS (T27, T28) |
| `ScoringSpecification` / `ScoringPreviewEngine` | `lib/scoring-preview-engine.ts` | 確定性受控沙盒計分預覽引擎 (v1.0.0) | 嚴格順序：先判斷 missing/skip，再執行 $lower+upper-x$ 反向 | 測試標記 SYNTHETIC_INSTRUMENT_TEST，不進資料集 | PASS (T29, T30, T31) |
| `DataCaptureField` (Data Capture Schema) | `lib/instrument-protocol-contract.ts` | 資料欄位與分析變數對應表 (Data Dictionary) | 對齊變數代碼、資料型態、有效範圍與缺值政策 | PII 欄位獨立分類，資料型態嚴格校驗 | PASS (T32) |
| `StudyProtocolDocument` | `lib/instrument-protocol-contract.ts` | Study Protocol 標準作業程序草稿組裝器 | 組裝研究目的、防動暈安全中斷機制、工具計分規範 | 完全對齊第九階段倫理送審範圍 | PASS (T33, T34, T35) |
| `InstrumentProtocolSnapshot` | `lib/instrument-protocol-contract.ts` | 第十至第十一階段不可變交接快照 | 傳遞至 Stage 11 (`pilot-validation`)，帶入預試驗證需求 | 包含工具版本、計分限制、Pilot 需求與校驗碼 | PASS (T45, T47) |
