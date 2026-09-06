# V3-U10-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Instrument Definitions** (`canonicalName`, `description`) | 工具定義 | `EXPLAIN`, `DRAFT_DESCRIPTION`, `ALIGN_CONSTRUCT` | 實體層級 (Instrument Lock) | 嚴禁杜撰作者或年份，同篇 DOI 多工具獨立分開 (T11, T12) |
| **Permission Records** (`permittedActions`, `licenseType`) | 版權矩陣 | `AUDIT_RIGHTS`, `CHECK_LICENSE` | 記錄層級 (Permission Lock) | 商業受限題項未授權公開匯出時觸發 FATAL 阻擋 (T17, T18) |
| **Translation Plans** (`itemsMapping`, `adaptationStrategy`) | 翻譯調適 | `EXPLAIN`, `SUGGEST_CULTURAL_MOD`, `CHECK_TERMS` | 條目層級 (Adaptation Lock) | 機器翻譯保留對照，嚴禁逕自標記 Validated Translation (T19, T20) |
| **Schedule of Activities** (`timePointLabel`, `burdenMinutes`) | 活動時程 | `EXPLAIN`, `OPTIMIZE_BURDEN`, `AUDIT_TIMEPOINTS` | 項目層級 (Schedule Lock) | 清楚界定基線與延宕時點，負擔時間需有合理依據 (T27, T28) |
| **Scoring Specifications** (`aggregationMethod`, `itemRules`) | 計分規格 | `EXPLAIN`, `SIMULATE_SCORING`, `VERIFY_RULES` | 規格層級 (Scoring Lock) | 先攔截 missing code，再執行反向轉碼，拒絕 eval (T29, T30, T31) |
| **Sandbox Scoring Output** (`totalScore`, `transformedItemValues`) | 運算預覽 | `RE_RUN_SYNTHETIC_TEST` | 不可變記錄 (Test Output Lock) | 標記 SYNTHETIC_INSTRUMENT_TEST，絕不計入受試者資料集 (T29) |
| **Data Capture Fields** (`variableCode`, `storageClassification`) | 變數規格 | `EXPLAIN`, `ALIGN_ANALYSIS_VAR`, `MAP_PII` | 欄位層級 (Field Lock) | 變數代碼穩定化，PII 密鑰加密隔離存儲 (T32) |
| **Protocol Document Sections** (`contentDraft`, `purpose`) | 標準程序 | `GUIDED`, `CO_WRITE`, `FILL_EMPTY` | 章節層級 (Section Lock) | 防動暈安全機制與倫理送審範圍完全對齊，不得擅改 (T34, T35) |
| **Triple Alignment Checker** (`findings`) | 一致性檢驗 | `RUN_ALIGNMENT_CHECK`, `NAVIGATE_ISSUE` | 系統層級 (Audit Lock) | 核心 RQ 缺工具或技能僅測滿意度精確阻擋 (T09, T26) |
