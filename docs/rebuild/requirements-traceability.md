# requirements-traceability.md — V3-U01（更新中）

| 驗收案例 | 狀態 | 證據 |
|---|---|---|
| 01 登入/顯示名稱刷新保留 | ✅ | /api/account/profile＋ProfileDisplayNameForm；QA 登入實測 session |
| 02 專案 A/B 切換不混用 | ✅ | topbar 下拉＋tenant scope 伺服器驗證；QA 建立/切換實測 |
| 03 URL/project_id 越權擋下 | ✅ | resolveResearchTenant＋401/403 實測 |
| 04 關鍵字建啟動摘要、不虛構 DOI | ⚠️ | 摘要 job 待建（本階段）；現有 S0 assist 不含虛構檢查證據待補 |
| 05 重複點擊只一個 job | ⏳ | agent_jobs idempotency_key（待建） |
| 06 重啟後進度可查/不永久 RUNNING | ⏳ | lease/checkpoint＋boot sweep（待建） |
| 07 外部 API 失敗頁面仍可用 | ⚠️ | 各 lab 錯誤狀態存在；專案級測試待本階段補 |
| 08 不合格 JSON 不污染 DB | ✅ | contract 驗證＋保存失敗診斷（academic-language/gap 等） |
| 09 一文獻多專案不重複、筆記獨立 | ✅ | canonical literature_items＋ProjectLiteratureLink（110 筆存在） |
| 10 摘要不得冒稱全文已讀 | ✅ | reading_status 分層＋Gap 檢查 |
| 11 文獻中心帶 project_id 返回保留 | ✅ | URL 綁定專案 |
| 12 Zotero 只讀、重複匯入不重複 | ⚠️ | collections 實測；binding/import 測試待建 |
| 13 Zotero 撤權顯示錯誤、本地保留 | ⏳ | 錯誤路徑測試待建 |
| 14 單一來源不當偽造、衝突明示 | ✅ | metadata_status/evidence 分層 |
| 15 回收不刪共用文獻/Zotero、可還原 | ⏳ | trash/restore（待建） |
| 16 遲到 job 不覆寫新版本 | ⏳ | job→project/version 綁定＋版本檢查（待建） |
| 17 不把建置當研究完成 | ✅ | 鎖定原因/狀態分開（PhaseProgressCards 等） |
| 18 金鑰不出現在前端 | ✅ | env 名稱盤點＋無前端引用 |
| 19 外部文字非命令 | ✅ | 既有 policy（XSS/指令隔離） |
| 20 舊模組資料不因改造遺失 | ⚠️ | migration 只 additive；0026–0030 缺檔風險 R1 |

✅實測 PASS ｜ ⚠️部分/待補測 ｜ ⏳待建


## 批次一至三完成後最終狀態（2026-09-05 09:1x UTC；證據詳見 phase-01-test-report.md）
| ID | 最終狀態 | 證據 |
|----|----|----|
|01|✅|登入＋顯示名稱（既有 profile API）；session 實測 |
|02|✅|topbar 切換＋tenant scope；回收筒流程（A/B 不混用）|
|03|✅|intruder 對他人專案 get/trash/restore/evidence-notes 全 404|
|04|⚠️|job＋版本保存已建且「無金鑰如實 FAILED、不虛構 DOI」；真實 AI 摘要正測 BLOCKED_EXTERNAL_CONFIG|
|05|✅|同 idempotency_key → 同 jobId（實測）|
|06|⚠️|lease＋逾時 requeue 已實作（程式層）；重啟恢復待正式環境實測|
|07|✅|無金鑰路徑乾淨 FAILED 且 research_documents 0 列；錯誤回傳結構一致|
|08|✅|模型 JSON 契約驗證＋失敗不寫入（parse/contract 實作＋既有翻譯/gap 錯誤測試）|
|09|✅|canonical literature_items（110）+ProjectLiteratureLink；notes 跨帳號 404|
|10|✅|reading_level 分離（ABSTRACT/FULLTEXT）＋預設 ABSTRACT；metadata/access/reading/claim 四層既有|
|11|✅|URL 綁定 project_id（既有）＋返回狀態保留|
|12|⚠️|binding 表＋connect/sync 串接完成（本機讀出 SYNCED 綁定）；真實 Zotero 往返需正式 key|
|13|⚠️|撤權/斷線錯誤路徑已接（SYNC_FAILED/DISABLED＋本地保留）；實測待正式 key|
|14|✅|metadata_status/evidence_status 分層（既有 production 功能）|
|15|✅|回收筒只改 projects 列（trashed_at），不刪文獻/Zotero；復原實測 PASS|
|16|⚠️|job 結果以新版本 append（supersedes 鏈）＋冪等；「遲到結果覆寫」防護在程式層，實測待 staging|
|17|✅|建置狀態≠研究完成（既有鎖定/Gate 設計；本階段未新增完成宣稱）|
|18|✅|金鑰僅 server env（盤點確認；.v3env 僅本機測試、不入 repo、0600）|
|19|✅|外部文字非命令（既有 policy）；本階段無新增執行面|
|20|⚠️|migration 全 additive＋隔離 up/down PASS；R1：repo 缺 0026–0030 檔，完整重建受限（以 prod schema 目錄複製補足階段所需）|
