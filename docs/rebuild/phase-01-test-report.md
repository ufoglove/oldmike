# phase-01-test-report.md — 真實測試紀錄（持續更新，只記錄實際執行）

## 已執行（本日，production 登入實測，QA 帳號已清除）
- 82 條 API 匿名掃描：0×500；401/403/405/404 皆守衛行為。
- 登入＋/api/account/status（ACTIVE）、/api/projects 200、preview+create 201、DELETE reset 200（QA 專案，隨即清除帳號與資料）。
- Zotero GET 200（3 collections）；literature GET 200 items[]；blueprint/research-project GET 200（空態）。
- 翻譯：DEEPL 200 SUCCESS；OLD_MIKE 200 SUCCESS（修 max_tokens 截斷＋repairTailClosers 後）。
- tsc 0 errors ×7（每批修改）；npm run build exit 0 ×4；production chunk hash 比對與本機一致。

## 待執行（本階段收尾前）
- migration 0031+ 於隔離 PG 的 up/down roundtrip＋還原驗證
- trash/restore API 與 UI E2E（QA 帳號）
- agent_jobs worker：建立/輪詢/取消/重啟復原/重複點擊 idempotency
- 研究啟動摘要 job→版本 artifact 資料流
- Zotero per-project binding＋重複匯入不重複＋撤權錯誤
- 跨專案隔離（文獻/筆記/job）與遲到 job 不覆寫
- 顯示名稱變更刷新保留（使用者側 UI）

## 工具未配置
- 無 CI/lint 閘；無 Playwright 自動化於本環境重跑（先前 QA-walk 曾用）；如實列出不稱「預期通過」。

## 批次一：回收筒（軟刪除/復原）隔離整合測試（v3u01_dev，2026-09-05 08:2x）
- 環境：sandbox 本機 PG15 @127.0.0.1:5433 ＋ local Next standalone @127.0.0.1:3100（DATABASE_URL=v3u01_dev；正式環境零接觸）。
- 流程 PASS：sign-in 200 → list 0 → preview 200 → create 201 → POST /trash 200（list 變空、trash list 1）→ POST /restore 200（list 恢復 1）。
- 負向 PASS：第二帳號對他人專案 trash/restore/get 全 404；其 trash list 0；owner 專案不受影響。
- 附註：http 環境 better-auth cookie 為 __Secure- 前綴，測試以手動 Cookie header 驗證（browser https 不受影響）。

## 批次二：AgentJob 持久任務底座＋研究啟動摘要（v3u01_dev，2026-09-05 08:4x）
- Migration 0032（research_documents.document_type +RESEARCH_START_SUMMARY）up/down roundtrip PASS。
- 無 AI 金鑰路徑 PASS：create 202 QUEUED → 冪等重送回同 jobId → GET job 200（events 2）→ 最終 FAILED ai_service_not_configured，research_documents 0 列（不假成功、不污染）。
- 冪等 PASS（同 idempotency_key 同 jobId）；列表/單筆/事件 PASS；取消不支援終態→409 預期。
- 越權（批次一）PASS。
- 真實 AI 正測：BLOCKED_EXTERNAL_CONFIG（局部）— sandbox 直連 gateway 路徑與 production env 不一致（code 要求 base pathname="/"、gateway 實務路由 /v1/chat/completions 才 200；isPrivateGatewayUrl 只接受根路徑 → 本機無法以同 env 完成正測）。保留待正式/staging 環境驗證；不宣稱 AI 已真實連通。
- 隔離環境事件：誤殺 consensus MCP server（23695）→ runtime 重啟但雙實例 → 已清理；工具狀態待 gateway 重整（見 PROJECT_STATE OPEN ISSUES）。
