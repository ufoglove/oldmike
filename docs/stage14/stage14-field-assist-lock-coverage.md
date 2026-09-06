# V3-U14-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Analysis Work Order** (`authorizedRqRefs`, `signoffRole`) | 工作單 | `AUDIT_AUTHORIZED_RQ`, `CHECK_DATASET_HASH` | 系統層級 (Order Lock) | 嚴禁擅自切換分析資料集或因不顯著降級主要 RQ (T06, T08) |
| **Statistical Computations** (`tStatistic`, `pValueRaw`) | 計算數值 | `RE_RUN_COMPUTATION`, `CHECK_TOLERANCE` | 引擎層級 (Engine Lock) | 數值由受控程式計算，嚴禁 AI 隨意改算或 eval 注入 (T10, T15, T16) |
| **Immutable Result Facts** (`primaryNumericValue`, `factHashSha256`) | 結果事實 | `VIEW_FACT_HASH`, `VERIFY_SEAL` | 最高不可變 (Fact Seal Lock) | 附加 64 字元 SHA-256 簽章，AI 與通用編輯器嚴禁覆寫 (T41, T45) |
| **P-Value Formatting** (`formattedDisplayText`) | 統計格式 | `FORMAT_P_VALUE` | 格式層級 (Format Lock) | 嚴禁輸出 p=0 或將 NaN/null 格式化為 0.000，微小值顯示 p < .001 (T28) |
| **Publication Table Cells** (`cellText`, `boundFactId`) | 表格儲存格 | `BIND_TO_FACT`, `EXPORT_TABLE_CSV` | 儲存格層級 (Cell Lock) | 數值直接綁定 ResultFact，嚴禁手動輸入不一致數值 (T42) |
| **Publication Figures** (`dataPoints`, `associatedFactIds`) | 出版圖表 | `RENDER_SVG`, `EXPORT_PNG` | 圖表層級 (Figure Lock) | 資料驅動渲染 (DATA_DRIVEN_SVG_RENDERER_V1)，嚴禁文生圖假圖表 (T43, T44) |
| **Scientific Interpretations** (`causalBoundaryWarning`) | 科學解說 | `DRAFT_INTERPRETATION`, `AUDIT_CAUSAL_CLAIM` | 區塊層級 (Card Lock) | 提示因果推論邊界，不顯著結果如實發布，無 p-hacking (T24, T27) |
| **Multiplicity Adjustments** (`pValueAdjusted`) | 多重校正 | `CALCULATE_HOLM_BONFERRONI` | 家族層級 (Family Lock) | Holm-Bonferroni step-down 運算，家族變更觸發重驗 (T26) |
