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
