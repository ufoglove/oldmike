# module-field-coverage.md — V3-U02-R1 本輪實作覆蓋報告

更新：2026-09-05 21:45 UTC（建站代理記錄）
對應驗收：T41（所有項目 coverage）、T44（誠實交付）。
方法：逐項列出「本輪實際接入／已實作」的 module → stage → field，並標記每一欄位的類別：(可生成 AI-draft｜可查證｜人工(需研究者)｜唯讀(來源受保護))。**未接入並非全站完成；存在未列來源即不得宣稱全站驗證完成。**

## 分類圖例
- **AI-draft**：老麥可依政策（field-policy-service `isFieldAiWritable`）起草／補全並產生草稿。
- **human**：需使用者／研究者確認或填寫（含 IRB、統計結果、作者效期註記；AI 不得代填核准）。
- **readonly-source**：來源型／唯讀欄位（作品稿、審查輪、權限、歷史版本），AI 不得自由覆寫。
- **verify**：來源型欄位可由工具查證並標記驗證狀態，不得自由生成。

## 探索三模組（本輪前已存在，本輪列入 scope 覆核）
來源：`components/GuidedResearchCenter.tsx` 中央工作台、`lib/module-registry.ts`（chain radar → one-click → topic-lab → blueprint）。
| 模組 | 主要輸入欄位 | 類別 | 本輪覆核 |
|---|---|---|---|
| 前沿雷達 OpportunityRadar | domain／focus／searchWindow | AI-draft＋human（方向由人設定）| 覆核：計量落入 TrendMeasurementService（見 metrics）|
| 一鍵靈感 OneClickInspiration | background／keywords／已有構想 | AI-draft | 覆核：批次/個別補全落 FieldAssist + lock |
| 選題實驗室 TopicLabFrontierRadar | RQ／Gap／Contribution／方法 | AI-draft | 覆核：需求門檻落 StageReadiness（RQ/Gap/Contribution blocking）|

## 共用操作層（本輪新增核心，migration 0034）
| 子項 | 類型 | 類別 | 實作位置 |
|---|---|---|---|
| stage_readiness | server-side gate | 程式 | lib/stage-readiness-service.ts |
| field_lock | 版本化寫入鎖 | readonly(鎖定後) | lib/stage-operation-repository.ts＋migration `field_locks` |
| requirement_issue｜deep-link | 缺項快照＋導航 | derive | migration `requirement_issues`；requirement_issue_panel.tsx |
| completion_snapshot | 不可變成交快照 | derive | migration `stage_completion_snapshots` |
| topic_selection_snapshot | 交接快照 | derive | 同 snapshot 附 topicSnapshot（實作見 generic-stage-adapter）|
| field_policy | AI 可寫 allowlist | 政策 | lib/field-policy-service.ts |
| field_assist | 單欄位起草 | AI-draft | lib/field-assist-service.ts |
| stage_action_bar | 下一階段按鈕 | derive | components/StageActionBar.tsx |

## 保護正式事實（不可 AI 自由生成；T22/政策）
人工或唯讀欄位（AI 即便請求也不得代填為「已核准」）：
- `irb_approval_number`／`ethics.*`：**human**（人員研究審查核准；不實測 IRB 不代表通過）。
- `analysis.p_value_results`／`statistics.*`：**human**（不可臆造 p 值／樣本結果）。
- `submission-gate.author_signatures`：**human**（不可偽造作者簽名／核准投稿）。
- trend/計量（`trend_metrics`）：唯讀 → 由 `TrendMeasurementService` 依可比口徑計算；`validateMetricRecord` 拒絕模型任意 count/% 寫入（T11）。

## 全階段 adapter coverage 聲明
`lib/generic-stage-adapter.ts` 之批次模式（FILL_BLANKS／OPTIMIZE_UNLOCKED／FILL_AND_LOCK）
設計意圖為「通用 all-stage」，但**本輪實測範圍侷限於 topic-lab 階段**（批次 A-C LIVE）。
後續階段（投稿導航 Stage-3）尚**未**以 adapter 走查 → 依 T41 不宣稱全站已完成。
