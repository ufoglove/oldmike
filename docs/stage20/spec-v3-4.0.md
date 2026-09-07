# OpenClaw 科研網站 V3｜新版第二十階段完整建置提示詞
## 接受／核定後作業與成果管理
**版本：V3-U20-FULL / v3.4**
**接收：新版U19 SubmissionTrackingSnapshot（v1.1，next_stage=post-acceptance）**
**交付：OutcomeManagementSnapshot（無必做第21階段；可由使用者自行啟動新研究／結案歸檔）**

本文件供OpenClaw實際增量建置網站。完整承接新版V1～U19。本輪不是代使用者送校樣、簽約、付款或提交成果報告，也不代表任何真實稿件已出版、計畫已核定或研究已結案。功能建置完成不等於有真實成果、款到或校樣已核准。只有 tracking 或待核實決定時允許準備，不自動升級成正式接受／核定。

## 1. 承接第十九階段與不越界的完成定義

先找真實repository與 `PROJECT_STATE.md`，讀取SubmissionTrackingSnapshot、實際schema、consumer tests與原第二十階段接收頁。

正式上游Gate：**DECISION_VERIFIED_AND_OUTCOME_HANDOFF_READY**。上游僅 tracking 或待核實決定時，U20 只能準備，不自動變成正式接受／核定。

沿用Project、Goal、document_purpose、case/round、真實decision、accepted/awarded文件、條件、期限、Result Facts、科學約束、引用、Zotero、Assist、Lock、AgentJob、Version與Audit。

完整映射上游 `post_decision_processing_allowed`、`post_decision_allowed_scope_refs`與`allowed_next_actions`。保留 `next_external_action_authorized=false`；過去送件授權（U19 ActionIntent/ExecutionAuthorization）不可重放為校樣、付款、簽約或公開授權。

## 2. 三路線真正分開（document_purpose 決定走哪條）

- **JOURNAL_SCI_SSCI**：出版待辦、accepted版、校樣(proof)比對、publisher queries、更正清單、出版權利、費用核對、Metadata、實際出版與索引狀態、典藏及出版後更正。
- **NSTC_GENERAL**：核定baseline、簽約與撥款條件、核定與申請金額差異、工作包、期間、資源、變更、進度／成果報告、經費核對及機構結案紀錄。
- **MOE_TPR**：核定課程、實際教學、學生成果與研究同意、成果交流、報告、經費結報與典藏等各自義務。

資助專案的期刊成果稿依 document_purpose 走期刊路線。**Accepted≠Published 或 Indexed；Awarded≠FundsReceived、IRB核准或 ExecutionAuthorized。**

## 3. 校樣與科學事實

保留原 proof bytes 及 accepted 版本；比對作者、機構、Funding、公式、負號、N、群組、單位、時點、引用、表圖、caption 與 supplements。

定位 (page/line) 需對應指定 proof 版本；新 proof 重排後重新定位，不沿用舊行號。數字更正引用原 Result Facts（由來源導出），不由 AI 自行重算。科學修改、作者變更或新分析回既有 U14／U16 及適用 editor 程序。

Queries 需有真實回覆與修改證據。依本刊當次要求產生 portal 內容、標註 PDF 或其他更正包。更正包核准≠已送回；送回≠出版社已全部採用。無外部 API 時完成實用人工導引（GUIDED_MANUAL），不臆造端點。

## 4. 核定後執行與成果報告

核定文件與原申請版分開，產生差異及影響評估。經費減額或年限改變，不靜默改樣本、RQ 或方法。

建立 **ExecutionReentryRequest** 回接 U09～U14，沿用同一 Project 與受控 cycle／scope，不重建研究系統。核定不解除人體研究、工具或場域的真實執行條件。報告重用 U08/U15 寫作、U16 審查、U17 語言、U18 組包及 U19 送件回執。沒有真實結果只建立骨架與待取得資料。「已完成」的每個重要主張需 Execution／Fact／Output 證據。

財務以真實來源紀錄及 Decimal 計算；申請、預核、核定、款到、承諾、支出、核銷分開。不把承諾→invoice→付款算三次支出。不代銀行付款、不冒充機構會計核銷。

## 5. 權利、成果與歸檔

AM、proof、VOR 及補充資料的使用權按版本與用途核對。去識別≠可公開；embargo 到期預設觸發重核，不自動發布研究全文或敏感資料。

成果一份多版本不重複算篇數。Zotero 沿用 library/item/version 與原授權，不全庫同步、不自動擴大遠端寫入。Consensus 仍透過既有文獻中心，不接收機密研究資料。ORCID 寫入需真實 API 能力與 owner 授權；只有 ORCID 號碼不能宣稱已同步。

歸檔保留來源、ACL、manifest、retention 與未來義務，並用隔離環境驗證復原。合法隱私處置依正式流程，不以不可變紀錄拒絕必要隱私處置。

## 6. 全項老麥協作、鎖定與安全

每欄、query、義務、報告章節、成果及整階段都有 Assist；保留 FILL_EMPTY、IMPROVE_UNLOCKED、FILL_AND_LOCK。一次授權範圍與預算後普通工作連續完成，不逐段確認。

AI 不得造結果、核准、簽名、支付或外部完成紀錄。所有回寫由後端驗 ACL、scope、revision 與 lock；遲到結果不能覆蓋已修改、鎖定、取消或回收內容。

信件、校樣、invoice 及附件皆不可信資料：沿用 U19 驗簽、防注入及 OUTCOME_UNKNOWN 防重送。精確外部 ActionIntent 須重新核對 target、actor、payload 與 files（不沿用送件授權）。不使用真實稿件、款項或公開帳號做破壞性驗收。

## 7. 首頁流程與下一步

保留專案下拉、儲存／讀取、功能導覽、明顯流程燈號、近期成果與底部可復原刪除。

缺失直達正確 case、award、proof、report、欄位；補完提供「保存並返回接受／核定後作業」。CTA 依真實狀態顯示校樣處理、研究執行準備、成果報告、成果總覽或指定 scope 結案。不為亮綠燈假造出版、核結、款到或取消未來義務。完成狀態可到成果總覽、繼續既有研究、處理結案／歸檔或由使用者自行啟動新研究。本輪不臆造必做的第21階段。

## 8. 實作、驗收與停止

依完整文件四批實作及 72 項適用驗收。先在開發／測試環境完成；正式 migration、部署、破壞性操作、新增費用及資料外傳擴張另行授權。

交付修改檔案、migration(ref)、API、三路線 profiles、proof/queries、財務核對／報告、回流 contracts、成果／權利／歸檔、Assist／Lock 覆蓋、真實匯出、OutcomeManagementSnapshot schema、contract tests、真實驗收、未完成項目與 rollback。

LIVE、MOCK、FIXTURE、SYNTHETIC_POST_DECISION_TEST、NOT_RUN、BLOCKED 及 UNSUPPORTED 分開回報。網站測試通過≠真實研究成果已完成。

更新 `PROJECT_STATE.md`。完成新版第二十階段後停止，等待後續指令。
