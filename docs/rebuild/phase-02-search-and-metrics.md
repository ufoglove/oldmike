# Phase-02 搜尋與指標（Search & Metrics）

> 交付：2026-09-05（Phase-02，V3-U02-R1）
> 規格：`docs/stage02/spec-v3-1.0.md` 第 12 節（Trend Measurement）與驗收 T07 / T08 / T09 / T11
> 實作：`lib/trend-measurement-service.ts`（TrendMeasurementService）

## 1. 範圍

本文件涵蓋兩件事：
1. **趨勢測量規則**（Trend Measurement）——已實作並 live 驗證。
2. **真實外部學術 live 搜尋認證**——**本輪未完成**，不得聲稱已驗證。

## 2. Trend Measurement 規則（spec 第 12 節 + T07/T08/T09/T11）

實作於 `TrendMeasurementService`：

### 2.1 成長率公式（T07）

```
growth_pct = 100 * (current_count - previous_count) / previous_count
```

- 正常計算時，成長率以百分比表示，數值經四捨五入至小數點後兩位（實作採 `Math.round(growth * 100) / 100`）。

### 2.2 低基期防護（low-baseline）

- 當 `previous_count` 低於 `minBaseline`（預設 5）或為 0 時，`growth_pct` 回傳 **null**，狀態標記 `LOW_BASELINE`，並附 warning message。
- 目的：避免以極小基期產生「偽加速」的無限成長或假高分（spec 意圖：低基期下比例無意義，不賦予虛假可信度）。

### 2.3 中繼資料更新不可視為新發表（metadata-update）

- 中繼資料更新不等於新發表。
- 當日期口徑不一致（例如 created 與 published 混用）時，狀態標記 `INCOMPARABLE`（實作內部名 `INCOMPARABLE_TEMPORAL_GRAIN`，契約狀態值 `INCOMPARABLE`），成長率不計算。

### 2.4 截斷資料（truncated → PARTIAL_DATA）

- 當計數來源資料不完整（truncated）時，狀態標記 `PARTIAL_DATA`；在此狀態下成長率不賦予完整可信度（實作中 PARTIAL_DATA 不覆寫為 CALCULATED）。

### 2.5 驗證模型寫入的指標（validateMetricRecord）

- `validateMetricRecord(record)` 拒絕「模型（AI）自行撰寫」的指標紀錄——即模型不得自造 metric 紀錄通過驗證；指標必須來自可計算的輸入（currentCount / previousCount 與窗口）而非 AI 生成值。

### 2.6 狀態總覽

`MetricRecord.status`：`CALCULATED | LOW_BASELINE | INCOMPARABLE | PARTIAL_DATA | UNKNOWN`。

## 3. 驗收對應（design，以規格文字為準）

| 驗收 | 對應規則 | 狀態 |
|---|---|---|
| T07 | 成長率公式（2.1） | 已實作，batch-b live 通過 |
| T08 | 低基期/零基期 null 防護（2.2） | 已實作，batch-b live 通過 |
| T09 | 中繼資料更新/日期口徑不一致（2.3） | 已實作，batch-b live 通過 |
| T11 | 截斷資料 PARTIAL_DATA（2.4）與模型寫入拒絕（2.5） | 已實作，batch-b live 通過 |

> 注意：上表「batch-b live 通過」僅指 `scripts/verify-stage02-batch-b.ts`（T07–T14 live）執行通過，未逐一列舉內部斷言計數。

## 4. 真實外部學術 live 搜尋——未完成（誠實標註）

- **`V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED` 未達認證**：本輪**未**完成真實外部學術 live 搜尋的認證流程。
- **不得聲稱**：不得聲稱已證明可從真實外部來源（如 Crossref / OpenAlex / Semantic Scholar）取回真實論文計數。
- 本輪實作的是「趨勢測量」的計算/守則層；真實外部計數的取得與認證留待後續回合，需另行授權與驗證。

## 5. 驗證依據與限制（FACTS ledger）

- `scripts/verify-stage02-batch-b.ts`（T07–T14）live 通過；`tsc --noEmit` 0 errors。
- git：`58612e2`（batch A）、`d6c10ad`（batch B）、`c4a6dc2`（batch C）。
- 限制：本文件不包含任何「真實 Crossref/OpenAlex/SemanticScholar 計數」之聲稱；所有公式與守則之「已驗證」範圍僅限於本輪 live 腳本覆蓋的計算路徑。