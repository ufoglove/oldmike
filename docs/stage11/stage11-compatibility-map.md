# V3-U11-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §27) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `InstrumentProtocolSnapshot` | `lib/instrument-protocol-contract.ts` | 第十一階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `rqRefs`, `pilotValidationNeeds`, `pilotApplicabilityHints` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `RESEARCH_DATA_TIERS` (資料分層) | `lib/pilot-validation-contract.ts` | 嚴格分層：SYNTHETIC, DRY_RUN, PRETEST, PILOT, FORMAL | 隔離測試資料與正式 Dataset，防止假數據混淆 | 標記 PILOT_DIAGNOSTIC，不計入正式樣本 | PASS (T02, T06) |
| `PilotReadinessAssessment` / `PilotExecutionPermission` | `lib/pilot-validation-contract.ts` | 預試放行閘門與權限控管 | 區分非人體乾跑 (`ALLOWED`) 與人體預試 (`PENDING`) | 未獲正式倫理核准前嚴禁放行人體 Pilot | PASS (T04, T05) |
| `CognitiveInterviewRecord` | `lib/pilot-validation-contract.ts` | 問卷題目理解性與認知訪談紀錄 | 記錄題項理解偏差與指導語澄清 (如 NASA-TLX) | 僅保存必要匿名代碼 (P-01)，不存個資 | PASS (T11, T12) |
| `RaterCalibrationRun` (`calculateCohensKappa`) | `lib/rater-calibration-engine.ts` | 評分者間信度受控確定性計算引擎 (v1.0.0) | 嚴格計算兩評分員 Cohen's Kappa ($Po=0.9, Pe=0.28, \kappa=0.861$) | 數值由程式運算產生，嚴禁 AI 隨意捏造 | PASS (T09, T13, T14) |
| `TechnicalPilotRecord` / `AIResearchSystemValidation` | `lib/pilot-validation-contract.ts` | 系統、感測日誌與 AI 模組技術預試 | 記錄採樣率 (90Hz)、通訊延遲 (38.5ms) 與丟包率 (0.2%) | 模型更新觸發 REVALIDATION_REQUIRED | PASS (T17, T18, T19, T20) |
| `ProtocolDryRun` / `PilotProtocolDeviation` | `lib/pilot-validation-contract.ts` | Study Protocol 全流程乾跑與偏差日誌 | 分步驟記錄預計與實際耗時，落實防動暈中斷 (20m+10m) | 記錄眼鏡反光校準偏差並提出修正手冊 | PASS (T21, T22, T23, T24) |
| `PilotDataQualityMetric` | `lib/pilot-validation-contract.ts` | 預試資料品質儀表板 | 所有指標強制標註 `PILOT_DIAGNOSTIC` | 嚴禁將預試效應當成正式研究假設結果 | PASS (T10, T25, T26) |
| `PilotRevisionProposal` | `lib/pilot-validation-contract.ts` | 預試問題修訂提案管道 | 提出題項與 Protocol 修正，不覆蓋舊版 | 若涉及知情同意或受試負擔自動標記倫理變更 | PASS (T27, T28) |
| `FormalStudyReadinessAssessment` | `lib/pilot-validation-contract.ts` | 正式研究放行評估閘門 | 檢驗正式倫理批件、關鍵偏差解決與場地協議 | 缺乏正式批件標記為 CONDITIONALLY_READY | PASS (T29, T30, T31) |
| `PilotValidationSnapshot` | `lib/pilot-validation-contract.ts` | 第十一至第十二階段不可變交接快照 | 傳遞至 Stage 12 (`formal-execution`)，帶入執行準備結論 | 包含 Kappa 指標、延遲紀錄與 SHA-256 校驗碼 | PASS (T45, T47) |
