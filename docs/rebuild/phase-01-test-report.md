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
