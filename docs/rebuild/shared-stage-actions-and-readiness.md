# 共用階段動作與就緒度設計（Shared Stage Actions & Readiness）

> 交付：2026-09-05（Phase-02，V3-U02-R1）
> 規格來源：`docs/stage02/spec-v3-1.0.md`
> 性質：本文件描述「已落地且經 live 驗證」的行為，與「設計意圖」兩類內容；前者以 FACTS ledger 為準，後者明確標註「design」。

## 1. StageReadinessService（伺服端就緒度）

已實作於 `lib/stage-readiness-service.ts`，並由 API `app/api/projects/[projectId]/stage-operation/route.ts` 的 GET 端點暴露：

- **伺服端阻斷**：對 ResearchQuestion / Gap / Contribution 等核心欄位做伺服端檢查——這是規格第 16 節 stage 定義的落實，阻斷邏輯在伺服端強制執行，不依賴前端。
- **方法論諮詢（advisory）**：方法論相關檢查屬 advisory（建議層級），不構成硬性阻斷。
- 檢查結果以 `StageReadinessSnapshot` 回傳：`isReady` / `canProceed` / `totalRequirements` / `satisfiedRequirements` / `blockingIssues` / `nonBlockingIssues` / `nextStageId` / `nextStageLabel` / `evaluatedAt`。

設計意圖（design，非測試主張）：`isReady` 與 `canProceed` 的區別在於——`isReady` 描述「本 stage 是否自足」，`canProceed` 描述「是否允許進入下一 stage」；兩者在存在非阻斷 issue 時可能不同（例如 advisory 未滿但無 blocking 時可 proceed）。實際判定邏輯以代碼為準。

## 2. RequirementIssue 與 deep-link 導航

- `RequirementIssue` 為 typed contract（見 phase-02-data-contracts.md），其中 `destination` 為 deep-link 導航載荷：
  - `routeId`：目標路由（必要）。
  - `anchor`：頁面內錨點（選用）。
  - 另有 `tabId` / `fieldRef` / `entityId` 選用欄位（contract 定義，實際使用視路由而定）。
- UI 端由 `components/RequirementIssuePanel.tsx` 呈現 blocking/non-blocking issues，並以 destination 做 deep-link，將使用者直接帶到缺失欄位的表單位置。

## 3. StageActionBar 與 next-stage 按鈕

- `components/StageActionBar.tsx` 提供 next-stage 按鈕。
- 按鈕可用性由伺服端 readiness 判定（blocking issues 存在時不可進入下一 stage）；前端不自行放行。

## 4. StageCompletionSnapshot 與 HANDOFF_READY 閘門

- 完成 stage 時寫入 `stage_completion_snapshots`（contract 見 data-contracts 文檔）。
- `status` 三態：`COMPLETED`、`HANDOFF_READY`、`SUPERSEDED`。
- **閘門行為（design，來自 contract 與 migration CHECK 約束的設計意圖）**：
  - `COMPLETED`：本 stage 內容已滿足定義要求，可視為完成。
  - `HANDOFF_READY`：內容完成，且已為下游 stage 產生交接物（例如 `topicSnapshot` / `downstreamOpenRequirements`），下游可開始；若存在未解決的 downstream open requirements，下游 stage 的 readiness 會據此產生非阻斷或阻斷 issue（實際阻斷與否以 StageReadinessService 判定為準）。
  - `SUPERSEDED`：被更新的快照取代（例如同 stage 重新評估後舊快照失效）；`idempotency_key` 用於防止重複寫入（migration 有 UNIQUE(workspace_id, project_id, stage_id, idempotency_key)）。

## 5. FieldLock 後端強制鎖定

- 資料表：`field_locks`（migration 0034），欄位含 `locked_value`、`lock_version`、`lock_policy`（MANUAL / AUTOMATION_POLICY / SYSTEM_ENFORCED）、`is_stale`、`stale_reason`、`source_version_id` 等。
- 唯一約束：`(workspace_id, project_id, stage_id, entity_id, field_ref)`——同一欄位在同一 scope 下只有一把鎖。
- **樂觀鎖（optimistic concurrency）**：每次寫入/更新鎖時 `lock_version` 遞增；`assertFieldWritePermitted` 在寫入前比對預期版本，版本不符即判定 stale 並拒絕（CONFLICT_STALE）。
- API 暴露於 `app/api/projects/[projectId]/stage-operation/route.ts`：
  - `GET`：readiness（可同時回傳現有 locks）。
  - `POST` 四種 action：
    - `LOCK`：取得/更新鎖（帶 lock_version 版本控制）。
    - `UNLOCK`：釋放鎖。
    - `CHECK_WRITE`：寫入前檢查（是否可寫、版本是否過期、policy 是否允許）。
    - `HANDOFF`：完成 stage 交接（寫 StageCompletionSnapshot，選擇性產出 TopicSelectionSnapshot）。
- 後端強制：前端只能「請求」鎖定/寫入；最終允不允許由伺服端 `assertFieldWritePermitted` 決定。此為規格第 16 節「backend write protection」的落地。

## 6. 驗證依據（FACTS ledger）

- live 驗證於隔離 PG15（`127.0.0.1:5433/v3u01_dev`）通過：batch-a（6 項，含 readiness/lock 基礎路徑）、batch-b（T07–T14）、batch-c（T24–26、T15–17）。
- `tsc --noEmit` 0 errors。
- git：`58612e2`（A）、`d6c10ad`（B）、`c4a6dc2`（C）。

## 7. 限制

- 本文件中的「閘門行為」語意（COMPLETED 與 HANDOFF_READY 的實務差別）屬設計意圖；驗證腳本通過的是既定用例，不代表所有分支（例如 SUPERSEDED 全路徑）皆已逐一覆蓋——未逐一列舉測試計數，避免臆造。