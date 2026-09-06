# V3-U13-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Data Dictionary** (`canonicalName`, `scaleRange`) | 字典語義 | `EXPLAIN`, `SUGGEST_CANONICAL_NAME`, `AUDIT_UNITS` | 字典層級 (Dictionary Lock) | 保持 ID 前導零 (0012) 與小數點 locale，不可全域合併 (T09, T10) |
| **Field Mappings** (`sourceFieldName`, `localeRules`) | 來源映射 | `SUGGEST_MAPPING`, `VERIFY_TRANSFORMATION` | 映射層級 (Mapping Lock) | 高風險語義映射未確定前保持 UNKNOWN，不猜測覆蓋 (T09, T10) |
| **Cleaning Rules** (`ruleType`, `inputParameters`) | 清理規則 | `EXPLAIN_RULE`, `SIMULATE_CLEANING`, `LOCK_RULE` | 規則層級 (Rule Lock) | 缺失碼 99 優先攔截，安全反向計分，拒絕任意 eval (T11, T12, T16) |
| **Outlier Management** (`qualityStatus`, `thresholdMs`) | 極端值 | `DIAGNOSE_OUTLIERS`, `FLAG_RETAINED` | 條目層級 (Record Lock) | 非破壞性標記 FLAGGED_RETAINED，嚴禁為顯著性隨意刪除 (T20) |
| **Education Scope (MOE)** (`studyUnitPseudonym`) | 教育隱私 | `AUDIT_STUDENT_CONSENT`, `ISOLATE_NON_PARTICIPANTS` | 範圍層級 (Scope Lock) | 未同意參與研究之學生紀錄絕不流入分析資料集 (T22) |
| **AI Preprocessing** (`foldSafeFitConfirmed`) | 機器學習 | `AUDIT_DATA_LEAKAGE`, `ENFORCE_FOLD_SAFE` | 演算法層級 (Pipeline Lock) | 嚴禁在包含測試集的完整資料上預先 Fit Scaler (T28) |
| **Lineage Edges** (`derivedRecordId`, `sourceRawRecordId`) | 血緣追蹤 | `TRACE_ORIGIN`, `EXPORT_PROV_REPORT` | 不可變保護 (Lineage Lock) | 遵循 W3C PROV-O 規範，直溯原始 Raw ID、Rule 與 Run (T12, T30) |
| **Analysis Scope** (`targetCohortName`, `includedUnits`) | 分析範圍 | `DEFINE_COHORT`, `MAP_ANALYSIS_OBLIGATION` | 範圍層級 (Scope Lock) | 嚴格區隔 ITT 與 Per-Protocol，退出受試者原因透明記錄 (T15, T27) |
| **Analysis Dataset Release** (`contentHashSha256`, `isLocked`) | 封存發布 | `CALCULATE_CONTENT_HASH`, `APPROVE_RELEASE` | 嚴格鎖定 (Release Lock) | 封存後產生不可變 SHA-256 數位簽章，禁止原地覆寫 (T30, T43) |
| **Quality Summary** (`diagnosticsBadge`) | 品質儀表板 | `AUDIT_QUALITY_SUMMARY` | 唯讀儀表板 (Dashboard Lock) | 全部指標強制標註 DATA_PREPARATION_DIAGNOSTIC (T45) |
