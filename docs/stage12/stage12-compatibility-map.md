# V3-U12-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §27) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `PilotValidationSnapshot` | `lib/pilot-validation-contract.ts` | 第十二階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `testedInstrumentVersionRefs`, `testedProtocolVersionRefs`, `formalExecutionReadinessStatus` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `FormalExecutionGate` / `ExecutionAuthorization` | `lib/formal-execution-contract.ts` | 正式研究執行放行閘門與授權憑證 | 檢查正式機構倫理核准 (REC-115-089) 與現場協議 | 未獲授權人體試驗精確阻擋，網站絕不自行核准 | PASS (T02, T03) |
| `IdentityMappingVault` (身分金庫) | `lib/formal-execution-contract.ts` | 嚴格隔離真實身分與聯絡方式，獨立金庫加密 | 工作區僅使用虛擬代碼 (P-001)，PII 絕不上傳至 LLM | 獨立金庫稽核與權限隔離 | PASS (T05, T28, T37) |
| `StudyUnit` / Enrollment | `lib/formal-execution-contract.ts` | 受試者或研究單元註冊與退出追蹤 | 追蹤納入狀態與退出原因代碼 (`WORK_SCHEDULE_CONFLICT`) | 目標規劃 N=151 與實際入組 N=4 嚴格分離 | PASS (T06, T08, T26) |
| `ConsentRecord` | `lib/formal-execution-contract.ts` | 書面知情同意版本與正式簽署紀錄 | 綁定真實簽署檔案 (`vault://signatures/p001_consent_signed.pdf`) | 缺乏真實簽名與檔案時嚴禁標記 CONSENTED | PASS (T04, T27) |
| `StudySession` / `ProtocolFidelityRecord` | `lib/formal-execution-contract.ts` | 試驗 Session (T0/介入/T1) 執行與忠實度 | 記錄實際起訖時間、介入劑量達成率與防動暈中斷 | 偏差日誌 (ProtocolDeviation) 完整記錄不隱瞞 | PASS (T09, T10, T11) |
| `RawDataRecord` (不可變原始資料層) | `lib/formal-execution-contract.ts` | 正式研究原始數據 Append-only 儲存與校驗 | 每筆資料附帶 SHA-256 簽章，任何修改走 DataCorrectionRecord | AI、資料清理與手動編輯嚴禁覆寫原始值 | PASS (T17, T18, T21, T22) |
| `HardwareAndAIProvenance` | `lib/formal-execution-contract.ts` | 硬體設備與 AI 模組運行脈絡追蹤 | 記錄 Vive Pro Eye 採樣率 90Hz、時間同步 2.1ms、模型 Prompt | 模型版本變更觸發 MODEL_VERSION_CHANGED 警告 | PASS (T12, T19, T20) |
| `SafetyEvent` (不良事件管理) | `lib/formal-execution-contract.ts` | 試驗不良反應監控與處置日誌 | 記錄 VR 短暫動暈眩與舒緩處置 (10分鐘靜坐)，追蹤至緩解 | 系統輔助流程，不取代機構正式安全裁決 | PASS (T13) |
| `StudyOperationsDashboard` | `lib/formal-execution-contract.ts` | 即時營運進度與品質檢查 (QA) | 彙整收案、完成、退出、Session 與原始資料筆數 | 僅顯示研究執行營運進度，絕不等於研究結果 | PASS (T25, T27, T43) |
| `FormalExecutionSnapshot` | `lib/formal-execution-contract.ts` | 第十二至第十三階段不可變交接快照 | 傳遞至 Stage 13 (`data-governance`)，帶入原始資料清單 | 包含 Checksum、收案統計、安全紀錄與校驗碼 | PASS (T45, T47) |
