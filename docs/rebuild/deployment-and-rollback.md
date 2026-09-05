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
