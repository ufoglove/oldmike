# V3-U07-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Design Brief** (`coreQuestionSummary`, `targetInformationGoal`) | 文字/論述 | `EXPLAIN`, `DRAFT`, `IMPROVE_UNLOCKED` | 欄位層級 (Field Lock) | 鎖定後 AI 建議僅存為候選，禁止直接覆寫 (T34) |
| **Design Candidates** (`selectionRationale`, `knownLimitations`) | 結構/多方案 | `EXPLAIN`, `COMPARE_CANDIDATES`, `DRAFT` | 物件層級 (Candidate Lock) | 刪除或修改已被矩陣引用之方案時被拒絕 (T36) |
| **Inference Targets** (`estimandSummary`, `targetPopulation`) | 推論定義 | `EXPLAIN`, `DRAFT_ESTIMAND`, `VERIFY` | 欄位層級 (Target Lock) | 嚴禁將預測準確度自動宣稱為因果效應 (T12) |
| **Study Structure** (`arms`, `timePoints`, `units`) | 試驗結構 | `EXPLAIN`, `SUGGEST_CONTROLS`, `AUDIT_UNITS` | 區塊層級 (Structure Lock) | 抽樣/分配/觀察/分析單位分離，一班一組報警 (T10, T11) |
| **Sample Justification** (`justificationNarrative`, `effectSize`) | 樣本理據 | `EXPLAIN`, `CALCULATE_POWER`, `SCENARIO` | 記錄層級 (Record Lock) | 缺乏計算或非法參數標記失敗，AI 不得自由補算 (T21) |
| **Planning Calculation** (`nPerArm`, `totalAnalyzableN`) | 數值紀錄 | `RECALCULATE`, `COMPARE_SCENARIO` | 不可變記錄 (Immutable Record) | 僅接受真實引擎計算輸出，禁止手動或 AI patch (T22, T38) |
| **Measurement Requirements** (`sourceOrInstrumentDirection`) | 測量規格 | `EXPLAIN`, `SUGGEST_INSTRUMENT`, `ALIGN_RQ` | 欄位層級 (Metric Lock) | 僅定義方向與信效度需求，嚴禁捏造題項 (T15) |
| **RQ Matrix Rows** (`matrixRows`) | 可追溯矩陣 | `EXPLAIN`, `ALIGN_DATA_ANALYSIS`, `LOCK_ROW` | 列層級 (Row Lock) | 核心 RQ 必須完整串聯推論目標、時點與分析 (T25) |
| **Analysis Plans** (`modelOrStrategy`, `missingDataStrategy`) | 分析計畫 | `EXPLAIN`, `DRAFT_RECIPE`, `SENSITIVITY` | 條目層級 (Plan Lock) | 嚴格區分主要與次要分析，登錄缺失值處理 (T26) |
| **Validity Risks** (`preventiveDesignRemedy`) | 效度與偏誤 | `EXPLAIN`, `AUDIT_BIAS`, `SENSITIVITY_PLAN` | 條目層級 (Risk Lock) | 承接第六階段競爭解釋，霍桑新奇效應納管 (T27) |
| **三目標專屬論述** (`Journal / Nstc / MoeTpr`) | 專屬論述 | `EXPLAIN`, `DRAFT_RATIONALE`, `ALIGN_RULES` | 區塊層級 (Goal Lock) | 教學實踐未處理班級差異或僅測滿意度精確示警 (T11, T15) |
