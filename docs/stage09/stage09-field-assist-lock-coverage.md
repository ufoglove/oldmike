# V3-U09-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Simulated Review Findings** (`issueDescription`, `suggestedAction`) | 審查條目 | `EXPLAIN`, `SUGGEST_REWRITE`, `RESOLVE` | 條目層級 (Finding Lock) | 模擬意見嚴格標記 SIMULATED_REVIEW，不得冒充官方審查 (T02, T36) |
| **Official Rules** (`requirementDescription`, `verificationStatus`) | 官方規則 | `EXPLAIN`, `VERIFY_CURRENT`, `AUDIT_DIFF` | 記錄層級 (Rule Lock) | 來源讀取失敗標記 SOURCE_UNAVAILABLE，禁止編造未公告 (T09, T10) |
| **Compliance Matrix** (`status`, `duePhase`, `blocksAction`) | 合規檢驗 | `EXPLAIN`, `AUDIT_COMPLIANCE`, `ASSIGN_OWNER` | 項目層級 (Item Lock) | 嚴格區分當前必要與晚期送件條件，晚期 IRB 不卡規劃 (T11, T12) |
| **Ethics Scope Screening** (`overallScopeResult`, `rationale`) | 範疇篩檢 | `EXPLAIN`, `SCREEN_RISKS`, `ALIGN_DESIGN` | 區塊層級 (Scope Lock) | 僅提供評估建議，網站絕不自行宣布正式 Approved/Exempt (T19) |
| **Institutional Ethics Decision** (`approvalNumber`, `status`) | 機構核准 | `IMPORT_OFFICIAL_DOC`, `VERIFY_NUMBER` | 嚴格鎖定 (Strict Lock) | 無真實文件時嚴禁標記 APPROVED 或捏造假案號 (T20, T21) |
| **Teacher-Student Power Risk** (`mitigationStrategy`, `monitoringPlan`) | 權力防護 | `EXPLAIN`, `DRAFT_MITIGATION`, `SEPARATE_GRADE` | 條目層級 (Risk Lock) | 未建立成績封存與同意書獨立收集機制時觸發 FATAL 阻擋 (T08, T22) |
| **Data Management Plan** (`identifiersHandling`, `destructionPlan`) | 資料治理 | `EXPLAIN`, `ALIGN_DMP`, `CHECK_SECURITY` | 區塊層級 (DMP Lock) | 去識別化密鑰獨立存儲，第三方 AI 嚴禁模型訓練 (T25, T27) |
| **Preregistration Plan** (`status`, `registrationUrlOrId`) | 預註冊規劃 | `EXPLAIN`, `DRAFT_REGISTRATION`, `LINK_PLATFORM` | 欄位層級 (Field Lock) | 缺乏真實註冊 URL 時嚴禁標記為 REGISTERED (T29, T30) |
| **Revision Tasks** (`requiredAction`, `status`) | 修訂任務 | `EXPLAIN`, `NAVIGATE_TO_SECTION`, `MARK_RESOLVED` | 任務層級 (Task Lock) | 導航直達對應章節，修改後經後端重新驗證始得解除 (T33, T41) |
