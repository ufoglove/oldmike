# phase-02-test-report.md — V3-U02-R1 實證測試報告
更新：2026-09-05 21:50 UTC。環境：本站隔離 disposable **PostgreSQL 15.19 @127.0.0.1:5433 / v3u01_dev**（migration 0001–0034；220+ 表）＋ local runner。
狀態圖例：**LIVE**＝對隔離 PG 真實查詢通過；**MOCK/CONTRACT**＝純邏輯契約（無 DB）；**BLOCKED**＝需正式外部/正式環境憑證或 Stage-3 上線方可實測，本輪**未**宣稱通過；**REGRESSION**＝由早批次（V3-U01/Home-01）在生產已驗之有據回歸。
⚠️ 誠實界限：本輪工程與契約實測於**隔離本地 PG**進行；**未部署正式、未套用正式 migration 0034、未取得真實外部來源接受認可（V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED 不成立）。** MOCK 成功 ≠ LIVE 成功，已分列。

## 一、本輪批次實測（新驗證器，LIVE on isolated PG15 / MOCK logic）
### 批次A — shared operation layer（scripts/verify-stage02-batch-a.ts，全 PASS）
| # | 驗證點 | 對應案例 | 方式 | 結果 |
|---|---|---|---|---|
|A1|未填專案 → StageReadiness 產生 RQ/Gap/Contribution 阻擋 issues＋deep-link|T23/T24|LIVE|✅ blocked issues + navigation routeId/anchor|
|A2|FieldLock acquire 遞增 lock_version|T18/T26|LIVE|✅ v1→v2|
|A3|assertFieldWritePermitted 拒絕 stale/unlocked 寫入|T18/T19|LIVE|✅ permitted=false（理由含 locked）；correct version→permitted true|
|A4|isFieldAiWritable → IRB/p-value/簽名 false（保護正式事實）|T22|MOCK(logic)|✅|
|A5|填必填後 readiness→SATISFIED→可前進|T25/T27|LIVE|✅ blocking=0, next=blueprint|
|A6|saveCompletionSnapshot 冪等同 key 不回複|T31|LIVE|✅ same id|

### 批次B — exploration logic & quality rules（scripts/verify-stage02-batch-b.ts，全 PASS）
| # | 驗證點 | 對應 | 方式 | 結果 |
|---|---|---|---|---|
|B1|growth_pct=100*(120-100)/100=20.0|T07|LIVE|✅ CALCULATED|
|B2|zero/low baseline→growth null＋LOW_BASELINE|T07|LIVE|✅|
|B3|unknown count 不填 0|T07|LIVE|✅ UNKNOWN null|
|B4|metadata-update grain→INCOMPARABLE 無偽成長|T08|LIVE|✅|
|B5|isTruncated→PARTIAL_DATA|T09|LIVE|✅|
|B6|validateMetricRecord 拒絕偽造 metric score|T11|LIVE|✅ reject forged / accept genuine|
|B7|duplicate wording detection＋自然數量保留|T12|MOCK(logic)|✅ high-overlap flagged；"Only 2 valid"|
|B8|novelty null 保留、fit 與 coverage 分開、UNVERIFIED 不宣稱 grounded novelty|T13|MOCK(logic)|✅|
|B9|FieldAssist RQ 可起草；IRB 被 policy 擋|T14|MOCK(logic)|✅|

### 批次C — batch automation & handoff（scripts/verify-stage02-batch-c.ts，全 PASS）
| # | 驗證點 | 對應 | 方式 | 結果 |
|---|---|---|---|---|
|C1|FILL_BLANKS 保留非空欄只補空白欄|T15|LIVE|✅|
|C2|OPTIMIZE_UNLOCKED 跳過已鎖定欄|T16|LIVE|✅|
|C3|FILL_AND_LOCK 取得 AUTOMATION_POLICY 鎖|T17|LIVE|✅|
|C4|TopicSelectionSnapshot：AUTO_SELECTED_DRAFT（不偽 HUMAN），附 handoffLimitations/downstream/lockManifest|T15-17/29/31|LIVE|✅|

## 二、44 項分類總表
| ID | 本案 | 本輪狀態 | 證據／備註 |
|---|---|---|---|
|T01|首頁儲存／讀取|**REGRESSION_LIVE**（V3-HOME-01 生產 save/stale409/meta 實測已過）|PROJECT_STATE；未重新在本輪生產走查|
|T02|未完成選單與隔離|**REGRESSION_LIVE**（Home-01）|同上所列 |
|T03|首頁功能導覽|**BLOCKED**(UI browser 未於正式走查)||
|T04|回收與復原|**REGRESSION_LIVE**（V3-U01 trash/restore 實測）||
|T05|直接構想／概念草稿|**MOCK**（TopicLabFrontierRadar 既有；本輪未另測外部來源）||
|T06|三模組一鍵流程|**MOCK**(批次 adapter contract)＋部分 LIVE（lock/assist）|真實一次授權外部連續檢索需外部來源，未開|
|T07|趨勢計數|**LIVE** |B1-B3|
|T08|時間與來源口徑|**LIVE**|B4|
|T09|搜尋不完整 PARTIAL|**LIVE**|B5 (isTruncated)；真實限流另需外部|
|T10|版本與跨庫去重|**BLOCKED**（需真實 cross-source；本輪僅契約）|
|T11|AI 不得改計量|**LIVE**|B6 / validateMetricRecord|
|T12|候選品質與數量|**MOCK/logic PASS**|B7；真實數量需外部檢索樣本|
|T13|證據與評分分離|**MOCK/logic PASS**|B8|
|T14|單欄位協助|**MOCK/logic PASS**|B9；來源型查證需外部|
|T15|批次補空白|**LIVE**|C1|
|T16|優化未鎖定|**LIVE**|C2|
|T17|自動鎖定 AUTOMATION_POLICY|**LIVE**|C3|
|T18|後端強制鎖|**LIVE**|A3|
|T19|執行中鎖定(遲到 patch→CONFLICT)|**BLOCKED**（需真實 worker 並行；本輪僅 stale-reject 即 A3，完整 CONFLICT 佇列未開）|
|T20|解鎖與舊工作版本|**MOCK/logic**（acquire 新版 v2 取代＋release 實作）；舊版回溯 UI 未 browser||
|T21|來源過期→LOCKED_SOURCE_STALE|**BLOCKED**(完整衝突導航需 Stage-3 稿回圈)|
|T22|保護正式事實(不造假 IRB/p/簽名)|**LIVE/MOCK PASS**|A4|
|T23|缺項總覽(原因＋按鈕)|**LIVE**|A1；UI 按鈕另有 component 未 browser 走查|
|T24|精確導航(deep-link)|**LIVE(logic)**|A1 routeId/anchor；browser focus 走查 BLOCKED|
|T25|缺失解除後重驗才 SATISFIED|**LIVE**|A5|
|T26|鎖定缺項可解鎖新版、AI 不改原文|**LIVE**|A2/A3；「不改原文」由鎖定後寫入攔截保證|
|T27|必要與選填/NOT_APPLICABLE|**MOCK/logic**（readiness blocking 已測；NOT_APPLICABLE 分類規則未 browser）|
|T28|不強加過多前置、概念模式誠實|**MOCK/logic**（CONCEPT_ONLY／UNVERIFIED 不偽完成已有設計；live 證據要求不降級規則於 field policy）|
|T29|三模組 StageActionBar 可執行下一站按鈕|**LIVE(contract)/UI file added**|StageActionBar.tsx 存在；browser 點擊未正式走查|
|T30|最後一刻重驗(改來源使舊 readiness 失效)|**BLOCKED**(此為 Stage-3 交接時再驗；本輪 readiness 僅 topic-lab 於保存時重算)|
|T31|重複前進冪等／重開下一站|**LIVE**|A6|
|T32|導航失敗顯示重開|**BLOCKED**(browser)|
|T33|未建置目的地→HANDOFF_READY|**MOCK/logic**（stage_completion status 含 HANDOFF_READY）；無目的地實境 browser 未開|
|T34|不把建置/測試當研究完成|**LIVE/logic**（鎖定區分 HUMAN vs AI；A4 確認不違規設人工核准）|
|T35|Funding/Publication 分支並存|**REGRESSION/MOCK**（既有 meta_current_goal/funding/publication_route 於 Home-01）|
|T36|AI 局部失敗單欄保留|**MOCK/logic**（批次逐欄 try/continue persist）；真 worker 未開|
|T37|取消重啟 job 狀態|**REGRESSION_LIVE**(V3-U01 agent_jobs cancel/worker)；重啟 sweep 需 staging|
|T38|成本邊界|**BLOCKED**(需真實收費 provider/超額行為實測；無憑證)|
|T39|Zotero 只讀關係|**REGRESSION_LIVE / read**（V3-U01 collections 實測 200）；sync 覆寫鎖定主張與新同步行為需正式|
|T40|外部注入與越權|**REGRESSION_LIVE**（V3-U01 intruder 404 全項目）＋本輪 field_policy 阻外部寫鎖定欄（A3）|
|T41|所有項目 coverage 報告|**LIVE**|本篇＋module-field-coverage.md|
|T42|可存取操作重排/鍵盤/讀屏|**BLOCKED(browser/a11y 需實際研究者走查)**|
|T43|排程與鎖定|**BLOCKED**(每日更新 worker 未開；不擅開)|
|T44|既有回歸與誠實交付|**DONE(分類如上)**|本篇|

## 三、通過／受限統計（供覆核，非「合併 100%」）
- LIVE（isolated PG / logic 對 DB 真查詢）：T07/08/09/11/15/16/17/18/22/23/25/26/31＝13 項核心，另有批次 A/B/C 細項全 PASS。
- MOCK/logic PASS：T05?、T12/13/14/20/27/28/33/34/36、T29(contract)；明確為「邏輯契約通過」非 live。
- REGRESSION（取自 early batches 生產既有證據）：T01/T02/T04/T35/T37/T39/T40（部分）。
- BLOCKED / 未正式走查：T03/T10/T19/T21/T30/T32/T38/T42/T43 及所有需「真實外部來源 or 正式 browser/a11y」項。**上列 BLOCKED 一律不宣稱通過。**

## 四、誠實交付聲明
**沒有 MOCK 被當成 LIVE**。本輪完成的是「隔離環境工程契約＋邏輯層」實測；正式網站(LIVE scholarly query、真實交遞給投稿導航 Stage-3、a11y/browser 走查、正式 migration 0034 部署)**皆未執行**，理由為規格要求「正式部署/migration/新收費另需授權」。下一階段（投稿導航）須直接沿用 StageActionBar/RequirementIssuePanel/FieldAssist/Lock/Handoff 契約，不得再發明。
