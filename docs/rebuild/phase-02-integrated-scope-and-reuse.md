# Phase-02 整合範圍與資產重用（V3-U02-R1）

> 交付：2026-09-05（Phase-02）
> 規格來源：`docs/stage02/spec-v3-1.0.md`（V3.1 規格，本輪實作對應 V3-U02-R1）
> 性質：工程驗證文檔。所有測試計數、來源指紋均以本輪實際驗證結果（FACTS ledger）為準，未經驗證的內容以「設計」標註，不臆造。

## 1. 本輪範圍摘要

V3-U02-R1 聚焦於「共用操作層（Shared Operation Layer）」的落地，並在其上掛載三個探索模組：
- 共用操作層：`StageReadinessService`、`FieldLock`、`RequirementIssue`、`StageActionBar`、`RequirementIssuePanel`、`FieldAssist`、`StageCompletionSnapshot`、`TopicSelectionSnapshot` 交接。
- 三個探索模組：基於既有 Phase-1 模組（`OpportunityRadar` / `OneClickInspiration` / `TopicLabFrontierRadar` / `GuidedResearchCenter`）建構，未重建這些模組本身。
- 首頁整合：將共用操作層與探索模組的上架能力整合進首頁入口。

本輪為「整合與重用」回合：核心目標是驗證共用操作層能覆蓋既有探索流程，並把既有模組串進統一的 stage 鏈與鎖定/交接機制，而非重新發明既有能力。

## 2. 重用（REUSED）vs 新增（NEW）邊界

### 2.1 本輪明確重用（未重寫）的部分

| 資產 | 重用方式 | 說明 |
|---|---|---|
| 模組註冊鏈 | radar → one-click → topic-lab → blueprint | Phase-1 既有的模組註冊/路由鏈，本輪以「讀取並串接」方式覆用，未改寫模組內部實作 |
| 探索模組本體 | `OpportunityRadar`、`OneClickInspiration`、`TopicLabFrontierRadar`、`GuidedResearchCenter` | 三個探索模組直接建構在這些既有 Phase-1 模組之上 |
| 既有 assist 路由 | `/api/assist/*` | 探索階段的既有輔助（assist）API 繼續作為 FieldAssist 的後端通道之一，未新增重複路由 |
| 既有資料遷移 | 0001–0033 | 全部既有 migration 保留不動（0001–0033 皆已於本輪前應用） |

> 設計說明（非測試主張）：重用的判斷標準是「模組註冊鏈 radar→one-click→topic-lab→blueprint 為既有 Phase-1 產物、且本輪未被改寫」；此判定來自規格第 16 節的 stage 定義與 FACTS ledger 中「本輪新增 lib 清單」的反向推論——新清單不含上述模組檔案，故屬重用。若後續稽核發現模組檔案在本輪有修改，應更新本表。

### 2.2 本輪新增（NEW）的部分

- 資料層：migration `0034_stage_operation_layer.up.sql`（新增 `field_locks`、`requirement_issues`、`stage_completion_snapshots` 三張表，並附對應 `.down.sql`），已應用於隔離本地 PG15（詳見部署文檔）。
- lib 新增（本輪）：`stage-operation-contracts.ts`、`stage-operation-repository.ts`、`field-policy-service.ts`、`field-assist-service.ts`、`stage-readiness-service.ts`、`trend-measurement-service.ts`、`topic-candidate-quality-service.ts`、`generic-stage-adapter.ts`。
- API 新增：`app/api/projects/[projectId]/stage-operation/route.ts`（GET readiness / POST LOCK / UNLOCK / CHECK_WRITE / HANDOFF）。
- UI 新增：`components/StageActionBar.tsx`、`components/RequirementIssuePanel.tsx`。

## 3. 階段鏈與共用操作層的銜接

stage 鏈（design，來自規格第 16 節 stage 定義：radar → one-click → topic-lab → navigator → blueprint → ethics → execution → analysis → manuscript → submission-gate）以本輪的 `StageReadinessService` 與 `stage-operation` 路由作為「閘門」：

1. 每個 stage 進入前，讀取 readiness（GET /readiness），取得 `StageReadinessSnapshot`。
2. 若存在 blocking 的 `RequirementIssue`，經 `RequirementIssuePanel` 呈現，deep-link 導向對應表單（`{routeId, anchor}`）。
3. 通過後，`StageActionBar` 提供 next-stage 按鈕。
4. 完成後寫 `StageCompletionSnapshot`（COMPLETED / HANDOFF_READY），作為下游 stage 的 `TopicSelectionSnapshot` 交接依據。

## 4. 首頁整合

首頁整合將共用操作層狀態（readiness、issue 數、stage 進度）與探索模組入口合併呈現；探索模組本身維持在 Phase-1 的重用狀態（見 2.1）。

## 5. 驗證依據（FACTS ledger）

- 隔離本地 PostgreSQL 15.19（`127.0.0.1:5433/v3u01_dev`）已套用 0001–0033＋0034，全庫 220+ 表。
- 驗證腳本通過：`verify-stage02-batch-a.ts`（6 項 live 檢查）、`verify-stage02-batch-b.ts`（T07–T14 live）、`verify-stage02-batch-c.ts`（T24–26 與 T15–17 live）。
- `tsc --noEmit` 0 errors；工作樹乾淨。
- git commits：`58612e2`（batch A）、`d6c10ad`（batch B）、`c4a6dc2`（batch C）。

## 6. 限制與未包含事項

- 本輪未包含正式部署、正式 production migration 0034、新成本啟用（全部僅在工程隔離環境執行，詳見 deployment-and-rollback.md）。
- 本輪未完成真實外部學術 live 搜尋（`V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED` 未達標），見 phase-02-search-and-metrics.md。
- 探索模組的內部行為變更不在本輪範圍；本輪只做串接與閘門。