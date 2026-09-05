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

---

# Phase-02 V3-U02-R1（2026-09-05 21:55 UTC）— 本輪 T01–T44 追溯
環境：隔離 disposable PostgreSQL 15.19 @127.0.0.1:5433 / v3u01_dev（migration 0001–0034）。全 44 項分類與證據細節見 `phase-02-test-report.md`, 逐 module/field 見 `module-field-coverage.md`。
(圖例：LIVE=isolated-PG 真查詢 ｜ MOCK=契約邏輯 ｜ REGRESSION=早期生產既有證據 ｜ BLOCKED=本輪未測(需正式外部或 Stage-3))

| ID | 本案 | 本輪狀態 | 主要證據 |
|---|---|---|---|
|T01|首頁儲存/讀取|REGRESSION_LIVE|V3-HOME-01 production save/stale409 (PROJECT_STATE)|
|T02|未完成選單隔離|REGRESSION_LIVE|V3-HOME-01 |
|T03|功能導覽|BLOCKED|browser 未於正式走查|
|T04|回收復原|REGRESSION_LIVE|V3-U01 trash/restore|
|T05|直接構想|MOCK|既有 FrontierRadar；外部來源未開|
|T06|三模組一鍵流程|MOCK(contract)+部分LIVE|批次 adapter；真外部檢索未開|
|T07|趨勢計數|LIVE|verify-b B1-B3|
|T08|時間/來源口徑|LIVE|verify-b B4|
|T09|搜尋不完整|LIVE|verify-b B5；真實限流需外部|
|T10|跨庫去重|BLOCKED|需真實 cross-source|
|T11|AI 不得改計量|LIVE|verify-b B6 validateMetricRecord|
|T12|候選品質數量|MOCK PASS|verify-b B7|
|T13|證據評分分離|MOCK PASS|verify-b B8|
|T14|單欄位協助|MOCK PASS|verify-b B9|
|T15|批次補空白|LIVE|verify-c C1|
|T16|優化未鎖定|LIVE|verify-c C2|
|T17|自動鎖定|LIVE|verify-c C3 AUTOMATION_POLICY|
|T18|後端強制鎖|LIVE|verify-a A3|
|T19|執行中鎖定衝突|BLOCKED|A3 stale-reject 已過；完整並行 CONFLICT 佇列未開|
|T20|解鎖新版回溯|MOCK/logic|acquire v2＋release；UI 回溯 browser 未開|
|T21|來源過期越權導覽|BLOCKED|需 Stage-3 稿回圈|
|T22|保護正式事實|LIVE/MOCK PASS|verify-a A4 isFieldAiWritable|
|T23|缺項總覽|LIVE(logic);UI未 browser|verify-a A1|
|T24|精確 deep-link|LIVE(logic)|verify-a A1 routeId/anchor|
|T25|缺失解除重驗|LIVE|verify-a A5|
|T26|鎖定缺項處理|LIVE|verify-a A2/A3|
|T27|必要/選填|MOCK|readiness blocking；NOT_APPLICABLE 規則未 browser|
|T28|不過度前置|MOCK/logic|CONCEPT_ONLY 不偽完成|
|T29|StageActionBar 可執行按鈕|LIVE(contract)|StageActionBar.tsx 新增；browser 未走|
|T30|最後一刻重驗|BLOCKED|Stage-3 交接再驗|
|T31|冪等前進|LIVE|verify-a A6|
|T32|導航失敗重開|BLOCKED|browser|
|T33|HANDOFF_READY|MOCK/logic|completion status 含 HANDOFF_READY|
|T34|不當研究/建置完成|LIVE/logic|A4 不設人工核准；A5 明確解除|
|T35|Funding/Publication 分支|REGRESSION/MOCK|Home-01 meta routes|
|T36|AI 局部失敗保留|MOCK/logic|批次逐欄 continue|
|T37|取消重啟 job|REGRESSION_LIVE|V3-U01 agent_jobs cancel；重啟 sweep 需 staging|
|T38|成本邊界|BLOCKED|無憑證|
|T39|Zotero 只讀|REGRESSION_LIVE(read)|collections 200 (V3-U01)；sync 行為需正式|
|T40|注入與越權|REGRESSION_LIVE + LIVE|V3-U01 intruder 404；A3 阻外部改鎖定欄|
|T41|coverage 報告|LIVE|module-field-coverage.md + 本篇|
|T42|a11y/可存取|BLOCKED|需實際研究者 walk|
|T43|排程鎖定|BLOCKED|每日更新 worker 未開|
|T44|回歸誠實交付|DONE(分列)|本篇 + test-report 分列 LIVE/MOCK/BLOCKED|

### 驗收旗標（各自獨立，不合併為 100%）
- **V3_U02_EXPLORATION_WORKFLOW_VERIFIED**：本輪三模組＋選題交接於**隔離邏輯/契約層已實測**（topic-lab LIVE 流程 A1→A5→A6→C4 完整閉環）；真實驗收 browser/外部待正式。
- **V3_SHARED_STAGE_NAVIGATION_VERIFIED**：readiness 阻擋＋deep-link＋冪等前進已 LIVE；browser 點擊/導航失敗/重開未實測 → 部分。
- **V3_SHARED_FIELD_ASSIST_AND_LOCK_VERIFIED**：AI 欄位政策/批次/鎖定/衝突(stale)/版本 LIVE+MOCK 實測 ✅。
- **V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED**：**未取得**（本輪未做真實 Crossref/OpenAlex/SemanticScholar 認可收取）→ 不成立。
- **V3_HOME_CONTROLS_AND_GUIDE_REGRESSION_PASSED**：既有 V3-HOME-01/02 四控制於 production 有據；功能導覽(browser)未於本輪正式回歸走查 → 標「既有回歸有據」(Home)而非全壘打。

下一篇：`PROJECT_STATE.md` 更新。
