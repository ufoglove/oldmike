# deployment-and-rollback.md

## 現況部署方式（證據化）
- Zeabur 單一 service research-portal（id 6a7fbdc3a21454a2cf6a28cf，env 6a7dbe5df8fa433a2b5dfaaa）；zip 上傳→Zeabur build（node/Next standalone）→RUNNING。
- 工具：/home/node/dev/deploy-restored.py、poll-deploy.py、exec-*.py（container 指令）、qa-mk*.cjs（測試帳號）。
- 最近部署：6a9bc0aa918d24b236ebc1cc（09-05 07:1x）RUNNING；health /api/health ok（不回傳 secret）。
- rollback 方式：Zeabur 部署歷史重跑前一個 deployment id；資料庫 rollback 僅限 migration down（additive 時無需）。

## 來源/資料/檔案備份狀態
- 來源：tgz 快照於 /home/node/dev（v3u01-baseline-SOURCE-20260905.tgz 等，含 .next 排除）；非 git（R4）。
- DB：Zeabur 提供之單一 DB；本階段開始前建議 pg_dump（待授權執行）；schema_migrations 記錄至 0030。
- Volume/持久檔案：目前網站無自訂 volume 依賴（容器 tmp 非持久；/tmp 日誌不屬正式資料）。

## V3 切換策略（本階段不執行正式切換）
1. 隔離環境（候選：sandbox 安裝 PostgreSQL；或 staging service＋獨立 DB）驗證 migration 與測試。
2. 程式碼增量批次：每批 tsc 0＋build 0。
3. 使用者授權後：pg_dump 備份 → 套用 additive migration → 部署 → health＋QA 走查 → 記錄。
4. 回滾：復用前一 deployment；DB 無 destructive 變更故不需資料回滾。

## Phase-02 (2026-09-05)

> 本節為 V3-U02-R1 回合補充，接續上方 Phase-1 內容；未刪除或改寫既有段落。

### 本回合部署方式（保留 Phase-1 機制）

- **維持 Zeabur zip 上傳部署**（非 git push）：沿用 Phase-1 的 zip 上傳→Zeabur build（node/Next standalone）→RUNNING 流程與既有工具（deploy-restored.py / poll-deploy.py 等）。本回合未變更部署通道。

### migration 0034 的前置條件

- **在部署前必須先套用 migration 0034**（`database/migrations/0034_stage_operation_layer.up.sql`）：本回合程式碼（讀寫 `field_locks`、`requirement_issues`、`stage_completion_snapshots` 的 repository 層與 API `stage-operation`）依賴此三張表；未先套用 migration 就部署，會導致讀取/寫入失敗。
- migration 0034 為本回合新增資料表（additive 性質），並附 `0034_stage_operation_layer.down.sql`。

### 回滾

- **程式碼回滾**：沿用 Zeabur 部署歷史重跑前一個 deployment id。
- **資料庫回滾**：migration 0034 提供 `.down.sql`；如需回滾，執行 down 會 **DROP** `field_locks` / `requirement_issues` / `stage_completion_snapshots` 三表。
  - 注意：down 為 destructive（DROP 表），僅在明確需要移除該層資料時執行，並應先備份；若僅需退回程式碼，不需 down migration。

### 本回合重要邊界（工程隔離）

- **無 production 部署**、**無 production migration 0034 套用**、**無新成本啟用**——本回合全部為工程本機執行，僅在隔離的本地 PostgreSQL 15.19（`127.0.0.1:5433/v3u01_dev`）驗證。
- **正式 production 上線需另行授權**：真實環境的 migration 套用、部署、成本開通均不在本回合範圍，須由使用者明確授權後才執行（對應上方 Phase-1「V3 切換策略」的授權閘門）。

### 本回合驗證狀態（供部署前參考）

- 隔離 PG15：0001–0033＋0034 全部套用；220+ 表。
- 驗證腳本通過：verify-stage02-batch-a.ts（6 項 live）、batch-b.ts（T07–T14 live）、batch-c.ts（T24–26、T15–17 live）；tsc --noEmit 0 errors；git 58612e2 / d6c10ad / c4a6dc2；工作樹乾淨。
- 未完成事項：真實外部學術 live 搜尋認證（V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED 未達標），不影響本回合部署決策但屬已知缺口。
