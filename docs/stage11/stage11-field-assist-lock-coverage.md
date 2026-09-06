# V3-U11-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Pilot Readiness Gate** (`readinessStatus`, `blockers`) | 閘門檢驗 | `AUDIT_PREREQUISITES`, `CHECK_ETHICS` | 系統層級 (Gate Lock) | 人體倫理未獲正式核准前，嚴禁將人體試驗標記為 ALLOWED (T05) |
| **Execution Permissions** (`permissionType`, `status`) | 執行許可 | `AUDIT_PERMISSIONS`, `VERIFY_PROOF` | 嚴格鎖定 (Permission Lock) | 非人體工程乾跑與人體預試權限完全隔離 (T04) |
| **Pilot Plans** (`plannedN`, `samplingRationale`) | 計畫規格 | `EXPLAIN`, `DRAFT_SAMPLING`, `CHECK_BURDEN` | 計畫層級 (Plan Lock) | planned_n 嚴格區隔於 actual_n，不自動把預估當實做 (T06) |
| **Cognitive Interviews** (`suggestedRevision`, `actionTaken`) | 理解訪談 | `EXPLAIN_VARIANCE`, `DRAFT_CLARIFICATION` | 訪談層級 (Interview Lock) | 僅保存必要匿名代碼 (P-01)，嚴禁記錄姓名身分證個資 (T11, T12) |
| **Rater Calibration** (`calculatedAgreementValue`) | 信度校準 | `CALCULATE_KAPPA`, `SUGGEST_ADJUDICATION` | 不可變數值 (Calculation Lock) | 數值由受控確定性演算法計算 ($Po=0.9, \kappa=0.861$)，拒絕 AI 隨意捏造 (T09, T13) |
| **Technical Pilots** (`packetLossRate`, `averageLatencyMs`) | 技術指標 | `RECORD_LOGS`, `CHECK_TIME_SYNC` | 記錄層級 (Tech Lock) | 採樣率 90Hz、延遲 38.5ms 實測紀錄，模型變更標記需重驗 (T17, T20) |
| **Protocol Dry Run** (`steps`, `dryRunOutcome`) | 流程演練 | `EVALUATE_FEASIBILITY`, `RECORD_DEVIATION` | 演練層級 (DryRun Lock) | 防動暈中斷強制落實 (20m+10m)，記錄眼鏡反光校準偏差 (T21, T22, T23) |
| **Quality Metrics** (`metricLabel`, `dataTier`) | 品質儀表板 | `AUDIT_QUALITY`, `FLAG_DIAGNOSTIC` | 儀表板層級 (Dashboard Lock) | 全部指標強制標註 PILOT_DIAGNOSTIC，不生成假顯著結論 (T10, T25) |
| **Revision Proposals** (`proposedChange`, `ethicsImpact`) | 修訂提案 | `DRAFT_PROPOSAL`, `CHECK_ETHICS_AMENDMENT` | 提案層級 (Proposal Lock) | 採用新版不覆寫舊版，涉及知情同意自動標記倫理變更 (T27, T28) |
| **Formal Readiness Assessment** (`readinessStatus`) | 正式閘門 | `AUDIT_FORMAL_READINESS` | 系統層級 (Gate Lock) | 缺乏正式 IRB 批件時標記 CONDITIONALLY_READY，不自動通關 (T29, T30) |
