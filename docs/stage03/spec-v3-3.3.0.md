# 老麥科研網站 V3｜全站智慧工作流與三大研究目標整合建置提示詞
## 首頁流程圖亮燈 × 全項老麥協作 × SCI／SSCI × 國科會一般研究計畫 × 教育部教學實踐

規格版本：3.3.0  
任務代號：V3-U03-R2  
整理日期：2026-09-06（Asia/Taipei）  
執行對象：OpenClaw 建站工程代理。

> 本文件是實際網站功能的增量建置規格，不是老麥人設或只回答科研問題的提示詞。本文件未實際連入網站、資料庫或使用者付費API，不代表功能已部署或測試通過。使用者回報第二階段已完成，第三階段正在整合；必須以repository實際狀況為準。

## 0. 文件地位、任務範圍與交付方向

本版整合現有V3-U02-R1的共用Assist／Lock／Next-Step、首頁兩輪追加需求、V3-U03-R1的Consensus多來源API與投稿導航，以及本次新增需求。可單獨交給OpenClaw；不必讓使用者手動拼接多份長提示詞。

本版明確修正項優先於較早重疊規格；原有研究資料、來源、版本、權限、倫理與原始資料保護不能被降低。既有可靠功能重用，不因名稱不同而重建。

本輪完成四件事：
1. 首頁建立醒目的、可操作的真實研究流程圖：完成亮燈、定位目前階段、提示下一步及缺失。
2. 全站統一三大研究目標，修復一鍵靈感等處缺少「教育部教學實踐」的前後端問題。
3. 所有已存在的區塊與欄位接入老麥專業協作、批次自動化、來源、鎖定、版本及缺失導航。
4. 完成本輪投稿與計畫導航，使選題快照正確交接研究藍圖；保留Consensus與既有文獻API。

尚未建置的後續專業引擎登錄能力、輸入輸出及缺口，不製造假功能，也不在這一輪重寫統計、IRB或整套全文系統。已存在的這些模組必須完成共用操作接入與回歸測試。

產品定位：**一鍵啟動、證據驅動、連續協作、分段驗證、專業成稿。**
不是一鍵捏造研究結果、保證收錄／通過、繞過機構核准，或自動替作者對外送件。

## 1. 開工盤點與資料保護

先搜尋真實網站repository及PROJECT_STATE.md，讀取目前分支、未提交修改、前後端、ORM、登入、部署環境、儲存、workers與現有測試。不要把OpenClaw工作區當成網站程式庫。

盤點：
- ResearchProject／ProjectContext、專案儲存讀取、未完成下拉、回收復原。
- ModuleRegistry／StageDefinition／ProjectStageState及目前首頁流程圖。
- StageWorkspaceShell、StageReadinessService、StageActionBar、RequirementIssuePanel。
- FieldAssist／SectionAssist／StageAssist、FieldPolicy、Lock、Revision、Approval與Audit。
- AgentJob、checkpoint、queue、取消、retry、冪等、預算及外部傳輸授權。
- 前沿雷達、一鍵靈感、選題、TopicSelectionSnapshot、投稿導航及既有後續模組。
- 所有研究目標選單：首頁、表單、schema、API、prompt、輸出、任務、快照、匯出與歷史值。
- 文獻與證據中心、Evidence／CitationSource、Zotero綁定、Consensus及其他adapter。

交付「需求→現況→重現證據→根因／未知→最小修改→測試」表。不先猜測漏選項只是前端問題。

保留資料ID、版本、原始紀錄與作者修改。先在隔離開發／測試環境實作。正式部署、正式migration、破壞性操作、增購服務或超出預算支出另行授權。migration採可檢視的增量策略與回復方案，不使用清庫重建。

## 2. 三大目標必須是全站單一來源

建立或擴充 `ResearchGoalRegistry`。正式主要選項固定為：

| goal_id | 使用者看到的名稱 | 核心產出 |
|---|---|---|
| JOURNAL_SCI_SSCI | SCI／SSCI 國際期刊論文 | 期刊研究規劃、實證或適用文章類型稿件、投稿包 |
| NSTC_GENERAL | 國科會一般研究計畫 | 一般研究計畫學門規劃、計畫書、經費及申請附件 |
| MOE_TPR | 教育部教學實踐研究計畫 | 課程問題、教學介入與評量、計畫書、授課及申請附件 |

所有選單必須從同一registry生成；禁止首頁、靈感、後端與prompt各寫一份兩選項陣列。

「老麥建議目標／比較三方向」是輔助動作，不是第四個正式補助或發表類型。「快速」「三年」「高新穎」屬策略或時程，不是正式目標類別。

未提供課程、未具備當年度申請資格、官方徵件尚未確認，**教學實踐選項仍可看見並進行條件式規劃**，不得整個隱藏。已知FAIL不能標為符合申請資格；缺資料為UNKNOWN，不是FAIL。

SCI／SSCI前端保留使用者熟悉的名稱；內部索引精確保存SCIE、SSCI及官方查得的collection／coverage。可設SCIE優先、SSCI優先、兩者皆可，不把有JIF、Scopus或ESCI收錄直接等同SCIE／SSCI。[S3]

期刊推薦的索引硬條件不等於文獻來源限制：背景／方法文獻可以來自其他適用來源，不得把所有非SCI／SSCI參考文獻刪掉。

## 3. 主目標、資助、發表及本次工作終點分開

建議等價契約，實際名稱配合既有Schema：

```yaml
GoalContext:
  primary_goal: JOURNAL_SCI_SSCI | NSTC_GENERAL | MOE_TPR
  funding_intent: NONE | UNDECIDED | NSTC_GENERAL | MOE_TPR
  publication_intent: JOURNAL | DEFERRED | NONE
  journal_index_preference: SCIE | SSCI | SCIE_OR_SSCI | UNSPECIFIED
  target_year: null
  source: USER_SELECTED | USER_PROFILE | AUTHORIZED_POLICY
  revision: 1
WorkOrderContext:
  target_output: IDEA_SET | ROUTE_PLAN | RESEARCH_PLAN | PROPOSAL_DRAFT |
    PROPOSAL_APPLICATION_PACKAGE | MANUSCRIPT_SCIENTIFIC_DRAFT |
    JOURNAL_SUBMISSION_PACKAGE
  input_state: IDEA_ONLY | PLANNED_STUDY | EXISTING_DATA | VALIDATED_RESULTS | EXISTING_MANUSCRIPT
  bounded_auto_adopt_topic: false
  bounded_auto_adopt_route: false
```

國科會或教學實踐計畫可有次要SCI／SSCI發表目標；不是三選一互相覆蓋。主要目標變更建立新GoalContext版本，列出對草稿、候選、工作包、選刊與流程的影響，經確認套用；舊版本不可消失。

一個專案可有多個成果工作單。申請書已完成不代表研究已完成；論文已完成不代表計畫結案或期刊已接受。

新專案的預設映射：SCI／SSCI主目標→publication_intent=JOURNAL、funding_intent=NONE或明確未決；NSTC_GENERAL主目標→funding_intent=NSTC_GENERAL；MOE_TPR主目標→funding_intent=MOE_TPR。兩種計畫是否增加期刊成果布局由使用者或已授權政策決定，不偷偷產生新的工作單。

主要目標與資助／發表資料出現矛盾時，回傳GOAL_CONTEXT_CONFLICT並顯示修正預覽；不得以最後送出的某欄位靜默勝出。每個實際成果工作單只能有一個明確target_output及自己的完成終點。

既有資料遷移：保留raw_legacy_value。能確認的「科技部一般計畫」可映射NSTC_GENERAL；只有NSTC等模糊值不能擅自推定一般計畫；缺失值設待確認，不自動退回期刊。已鎖定歷史快照不批次改寫。保留原有引用與導覽ID。

## 4. 修復教學實踐缺選項：不只新增一個option

全鏈檢查並修復：

```text
首頁目標卡
→ 新建／編輯專案
→ 一鍵靈感本次目標
→ 前沿雷達推薦情境
→ 候選題生成與評分
→ 選題比較與採用
→ TopicSelectionSnapshot
→ 投稿導航
→ SubmissionNavigationSnapshot
→ 研究藍圖／計畫工作室
→ 後續寫作、審查、潤稿、匯出及成果路徑
```

每一層檢查型別enum、validator、DB constraint、API request/response、prompt resolver、output schema、queue payload、cache key、filters、匯出header、UI文案、測試fixture與分析事件。

每個任務必須包含project_id、goal_context_revision、primary_goal、target_output、topic_snapshot、schema_version。缺少MOE_TPR模板時回報 `GOAL_TEMPLATE_UNAVAILABLE`，禁止默默套期刊或NSTC模板。

快取key必須包含三路線與各自必要context fingerprint：教學實踐含授權可用的課程版本；年度與目標版本改變須失效相關快取。

使用者只切換首頁流程檢視，不應改寫project主要目標；「切換檢視」與「變更研究目標」用不同操作。

## 5. 首頁：首屏有明顯研究流程圖

保留頂部專案清單、讀取／儲存／新增、最後儲存狀態、功能說明、近期成果及底部回收按鈕。

登入且已選專案的首頁版面：

```text
[未完成專案下拉] [讀取] [儲存] [新增]
專案名稱／實際儲存狀態

主要目標：SCI／SSCI｜國科會一般｜教育部教學實踐
本次工作終點／次要成果目標

【研究流程與完成燈號】← 首屏核心區塊，不藏在說明選單
具名節點＋連接路徑＋完成燈號＋目前階段＋下一步
[本次成果路徑] [完整研究生命週期] [展開細節]

【老麥一鍵協作】
根據現有資料，繼續完成「本次目標」
[老麥一鍵完成可執行工作] [設定範圍／預算]
目前產出／待補事項／執行進度／取消與恢復

【目前階段與下一步】
已完成什麼／還缺什麼／可產生什麼
[具名下一步] [老麥一鍵補足] [查看依據]

功能導覽／文獻與證據摘要／近期成果
底部危險操作：[刪除本專案（移至回收筒）]
```

桌面用可折疊分支與多列泳道，手機改垂直流程清單。提供圖形與清單兩種等價呈現；不能只有一張不能點的圖片或只顯示百分比。沿用既有繪圖元件或語意化DOM／SVG，不強制安裝新library。

首頁初載只讀狀態與已存摘要，不自動啟動付費API或重新生成全部內容。

## 6. 流程圖節點、完成亮燈與進度口徑

每個節點顯示：階段中文名稱、狀態文字、圖示／燈號、已完成必需項／全部適用必需項、來源更新時間、主要動作及缺失數。核心狀態建议：

| 狀態 | 建議視覺 | 解說與動作 |
|---|---|---|
| NOT_STARTED | 灰色空心燈 | 尚未開始；進入或查看用途 |
| IN_PROGRESS | 藍色燈＋進行中 | 檢視任務／繼續編輯 |
| AWAITING_INPUT / AWAITING_APPROVAL | 黃色燈＋待補資料／待確認 | 直達缺失或確認處 |
| BLOCKED / FAILED | 紅色警示圖示＋原因 | 修復／重試／查看依據 |
| COMPLETED_VALID | 綠色燈＋勾選＋已完成 | 查看完成產出或前進 |
| STALE | 黃色迴轉圖示＋需重驗 | 保留歷史，重驗受影響部分 |
| NOT_APPLICABLE | 灰色斜紋＋不適用 | 顯示理由，不假裝已完成 |
| MODULE_UNAVAILABLE | 灰色鎖／未建置 | 顯示能力缺口，不跳空白頁 |

顏色只是輔助，文字、圖示與可讀狀態必須同時存在；完成事件以可被輔助技術辨識的狀態訊息通知，避免持續閃爍或每次輪詢搶焦點。[S4][S5]

「綠燈」必須来自後端有效completion snapshot，不由開啟頁面、填滿非空字串、UI勾選、模型自稱完成、建站測試通過或按鎖定決定。必要資料、驗證與適用審閱條件滿足後才完成。

草稿階段可以在允許政策內自動通過「草稿已產生」這個真實任務，但顯示`AI草稿／待審閱`，不能順便把科學審查、倫理或正式送件節點點綠。人工核准與AI輸出鎖定分開。

上游實質變更，使相關有效完成節點轉`STALE`，保留完成歷史；不把全部研究清空。不相關新文獻或純展示變更不得讓全圖無差別失效。

進度：按選定工作終點及workflow_version的「適用必要節點」計算。選填不阻擋；N/A有理由；尚未建置但在選定路徑必要的模組仍是缺口，不能移出分母美化進度。並行分支共享節點只算一次。

分別顯示：本次成果完成度、完整研究生命週期、稿件／計畫書完整度、證據覆蓋。不要把它們合成一個神秘百分比，也不要以固定計時器推進百分比。

## 7. 三路線Workflow Template

workflow用穩定stage_id、前置條件、產出型別、route適用性及gate定義，不使用pageIndex+1。迭代回修以新版本或修订子任務表示，不把DAG變成無限循環。

### 共用探索與規劃骨幹

```text
研究目標與背景
→ 前沿雷達（可選入口）
→ 一鍵靈感（可選入口）
→ 選題實驗室
→ 投稿與計畫導航
→ 研究藍圖
→ 文獻深化／Gap
→ 理論與機制（適用時）
→ 研究設計與分析規劃
```

文獻與證據中心是全程共用服務，不在每頁複製資料庫。已有題目可直接選題；有真實既有資料或稿件者，以受控匯入和來源審查銜接適當節點，不強迫重新招募或虛構過去程序。

### SCI／SSCI國際期刊

```text
期刊定位與文章類型
→ 研究規劃／必要倫理、工具與Protocol
→ 適用的預試與正式研究／既有合法資料接入
→ 資料治理
→ 分析實驗室與結果鎖定
→ 全文協作
→ 科學審查與修訂
→ 翻譯與學術潤稿
→ 目標期刊合規與作者核准
→ 投稿包就緒
→ 真實送件／審查／修訂紀錄（外部事件）
```

文章類型包含量化、質性、混合、技術／方法與證據綜合等；各自使用適用研究和分析結果，不能強迫每種文章有問卷、RCT、假設、p值或感測器。

有已驗證結果時可一鍵串接現有全文、審查、潤稿及投稿包；沒有結果時可完成研究規劃、Introduction／Methods規劃草稿與缺資料清單，產出標`RESEARCH_PLANNING_PACKAGE`或`DRAFT_WITH_GAPS`，不能標為完整實證稿件。

### 國科會一般研究計畫

```text
科學問題與學門定位
→ 研究現況／Gap／創新
→ 目標、方法、工作包及適用倫理規劃
→ 時程、人力、設備及預算規劃
→ 國科會計畫書
→ 科學與學門模擬審查
→ 語言與格式檢查
→ 當年度／校內規範、附件與申請人確認
→ 申請包就緒
→ 真實申請／核定／執行與結案紀錄
```

以現行一般研究計畫規則及目標年度條件配置；不混用新進人員、其他專案類別，不預設一定三年。計畫類別與個別／整合型分開；審查重點依官方規則。[S1]

### 教育部教學實踐研究計畫

```text
正式課程與主持人資訊
→ 教學問題與可取得的現場證據
→ 教學文獻、原因假說與學習機制
→ 課程設計／教學介入／成果評量
→ 研究設計／倫理與學生權益規劃
→ 課程週次、資源及預算
→ 教學實踐計畫書與授課資料
→ 課程研究一致性／模擬審查
→ 當年度／校內規範、附件與申請人確認
→ 申請包就緒
→ 真實申請／核定／課程研究／成果紀錄
```

學習問題、介入、學生學習成果與評量是中心。核對主授、學生與正式學分要求，具體年度依正式文件。[S2]

兩類計畫的「申請書目標」不要求先取得未來的正式研究結果。計畫產出是「預期成果」，實際先期成果需要真實來源。

### 並行與後續成果

倫理判定、工具、Protocol及文件準備可以在設計充分後並行，不統一拖到計畫核定才開始。人體預試／正式活動按有效倫理與場域等條件啟動；是否一定等待補助核定依該研究的資源及授權，不把未申請補助當成所有研究的禁止條件。

國科會／教學實踐可連結次要期刊成果工作單；計畫申請包完成不會自動點亮該論文的Results。資料未就緒時顯示「等待研究證據」。

## 8. 真正的一鍵協作：Project Orchestrator

在既有AgentJob上擴充 `ProjectOrchestrator` 或等價服務，不建立第二套queue。

首頁主按鈕依目標及資料狀態顯示：
- SCI／SSCI＋已有結果：`老麥一鍵協作完成期刊稿件`。
- SCI／SSCI＋只有構想：`老麥一鍵完成期刊研究規劃`。
- 國科會：`老麥一鍵協作完成國科會計畫書`。
- 教學實踐：`老麥一鍵協作完成教學實踐計畫書`。
- 有未解阻擋：`老麥一鍵補足可處理項目`。

按下後：

```text
讀取權限與project／goal／版本
→ 確認這次產出與外部處理／預算授權
→ 產生依賴任務計畫
→ 檢索／帶入來源
→ 按欄位政策生成或計算
→ schema＋來源＋一致性驗證
→ 保存候選或可套用草稿
→ 適用範圍的自動核對與鎖定
→ 更新節點進度
→ 自動前進下一個可執行任務
→ 遇人工作業或外部事實缺項，集中列成清單
→ 補足後從checkpoint接續
→ 產出及品質報告
```

不要每生成一段就要求確認。一次授權後的低風險草稿與查證可持續執行；需要資料／作者聲明／正式授權／支出增加／對外送件時保留真實確認。

選題與路線採用預設由使用者決定；可提供「在我設定的範圍自動採用暫定推薦」一次授權。policy需保存可改範圍、預算、規則與來源，不能因全站一鍵授權而任意改題或改主要路線。

跨多章與多模組使用結構化source pack與局部任務，不以一個超長Prompt重新想一次整個專案。使用Project記憶，但不把其他專案內容混入。

## 9. 自動化等級、工作狀態與停點

提供三級自動化：

| 模式 | 可做什麼 |
|---|---|
| GUIDED | 解說、候選與建議，不自動套用 |
| AUTO_DRAFT | 補空白或指定未鎖定內容，自動保存草稿 |
| AUTO_ADVANCE | 在已授權範圍連續執行可通過的內部任務，直到目標產出或有效停點 |

`AUTO_ADVANCE`不等於取消檢查、清空障礙或代簽。每次worker執行與提交前重新查驗權限、版本、lock、來源與費用政策。

工作狀態分為：QUEUED、RUNNING、PARTIAL_RESULT、WAITING_INPUT、WAITING_APPROVAL、WAITING_EXTERNAL、PAUSED、FAILED_RETRYABLE、FAILED_FINAL、COMPLETED、CANCELLED、STALE_INPUT。

遇缺項保留已完成工作，不全部失敗回零；可獨立處理的分支繼續，禁止越過該分支必要前置。顯示AI能自動補、人需提供、外部待確認三類。

限制最大步數、重試次數、無進展循環、並行與費用。工具超時或回覆不明時先核對request／result，不盲目重送付費操作。帳務不支持冪等時要記錄不確定用量，不能保證供應商絕不重複計費。

本文件只要求實作網站任務恢復，不代表本次ChatGPT會在背景替使用者執行工作。

## 10. 所有欄位與區塊都有老麥協助

所有已存在的可編輯欄位接入FieldAssist；唯讀欄位也有「老麥解說／查證」，不能用假的「自動生成」替代。

共用操作：
- 欄位：`老麥協助`、`帶入／起草／優化`（依政策）、`查證`、`鎖定`、`來源與版本`。
- 區塊：`老麥補全本區`、`優化未鎖定內容`、`一致性檢查`、`鎖定本區`。
- 階段：`老麥一鍵完成可處理工作`、`一鍵補缺`、`補全並鎖定`、`下一階段`。

每項由 `FieldPolicy` 決定：

| 類型 | 合法AI動作 | 不允許的行為 |
|---|---|---|
| GENERATED_DRAFT | 依來源起草、重組、提出替代版本 | 冒充已執行事實 |
| USER_FACT | 從使用者授權資料抽取、確認、缺失說明 | 編造職稱、設備、課程、合作、身分 |
| EXTERNAL_FACT | 查官方／學術來源後带入及顯示日期 | 猜APC、學門、截止日期、索引 |
| COMPUTED_FACT | 叫用可追溯計算／分析服務，呈現來源 | LLM手寫統計、加總或假完成率 |
| PROTECTED_RESULT | 引用ResultFact並解釋、定位來源 | 修改N、p值、效應、CI、結果方向 |
| APPROVAL_OR_ATTESTATION | 準備說明、導航確認或上傳真實紀錄 | 自動簽署、核准IRB、冒充送件成功 |

每個FieldPolicy另有route適用性、專業模板版本、輸入refs、allowed_tools、review_level、validation_rules、token_protection、cost_class與可用導航。缺模板為待建置，不回退不相符路線。

一鍵完成不得以占位文字、與欄位無關長文或只填「待補」就計為必要資料完成。

## 11. 老麥專業协助的全站覆蓋表

| 模組 | 老麥可連續完成的工作 | 真實完成依據／不能冒充 |
|---|---|---|
| 研究Profile | 抽取專長、整理領域、建議搜尋詞 | 不捏造任職／資源 |
| 前沿雷達 | 依來源發現熱門、新興、跨域機會 | 真實查詢與計量；不造趨勢數字 |
| 一鍵靈感 | 依目標產生有差異構想 | 初步Gap仍標待驗證 |
| 選題實驗室 | 相近研究、可行性與候選比較 | 採用快照與授權範圍 |
| 投稿導航 | 三套匹配、來源核對、定位與風險 | 不保證接受／合格 |
| 研究藍圖 | 整理目的、RQ、工作與產出 | 規劃不冒充實作 |
| 文獻與證據中心 | 檢索、去重、讀取授權內容、矩陣 | 讀到的範圍與Claim來源 |
| Gap與新穎性 | 最近研究比較、差異、反證與限制 | 沒搜尋到不等於首創 |
| 理論與機制 | 比較解釋、定義構念及命題 | 不強制所有研究有理論／假設 |
| 研究設計／分析計畫 | 方法候選、矩陣、可計算樣本方案 | 效果量假設與計算透明 |
| 國科會計畫書 | 學術問題、方法、工作包、預期成果與預算草稿 | 人員／價格等依據與申請人確認 |
| 教學實踐計畫書 | 課程問題、介入、評量、課程安排、申請書 | 課程事實與學生資料權利 |
| 倫理／IRB | 清單、風險、文件草稿 | 正式判定與核准不是AI作成 |
| 工具／Protocol | 工具比較、程序草稿、計分與資料規格 | 量表授權、原文、效度來源 |
| Pilot／正式研究 | 計畫、排程、紀錄整理、完整性檢查 | 真實參與、同意、檔案與場域紀錄 |
| 資料治理 | 可回復轉換、字典、缺失與品質紀錄 | Raw不改寫；規則有版本 |
| 分析實驗室 | 依计划在隔離環境計算與核對 | 真實資料、程式、Run與ResultFact |
| 全文協作 | 基於來源逐章成稿、論述與一致性 | 數值鎖定、引文支持、實際方法 |
| 老麥科學審查 | 多視角問題、修訂任務與建議 | 模擬審查，不冒充官方判定 |
| 翻譯與潤稿 | 科學翻譯、術語與語言改善 | 不提高因果／確定性或變更結果 |
| 合規／投稿包 | 規則核對、文件、引用與附件整理 | 作者及真實聲明，未送不標送 |
| Reviewer回覆 | 對真實意見拆解、回覆草稿與修訂對照 | 沒有實改不寫「已修正」 |

以上是所有既有模組的接入標準，不要求本輪重建尚不存在的專業引擎。Coverage報告要列每個stage／section／field的實際adapter與限制，不能只把同一聊天按鈕貼滿全站就宣稱完成。

## 12. 內容鎖定、作者核准與版本並行

沿用Field／Section／Artifact／Handoff鎖。每個寫入路徑都要後端檢查：手動保存、autosave、AI、匯入、同步與worker callback。

AI開始時保存base_revision；完成時比對project、goal、field、lock與source版本。期間有人編輯／鎖定，輸出僅保存為候選或CONFLICT，不覆寫。切換active_version不能繞過lock。

`補全並鎖定`只鎖定已保存、通過適用檢查且在授權範圍的輸出；核准者記錄`AUTOMATION_POLICY`而不是使用者。AI草稿鎖定並不表示人工審閱。

解鎖建立新工作版本與理由；只解鎖有權限範圍。來源過期顯示`LOCKED_SOURCE_STALE`，保留原文，提供修訂候選及受影響章節。

Scientific Meaning Lock沿用：ResultFact、方法、假設結果、引用ID、表圖、因果語言上限不可被語言潤稿或路線轉換改寫。

## 13. 缺失導航與醒目下一步

每個Issue保存：project、goal版本、stage、entity、section、tab、field、requirement、source版本、缺失原因、何時必須完成、阻擋哪個動作、可用Assist、來源與return_context。

範例：

```text
缺失：尚未提供教學實踐課程的主授資訊
影響：可繼續構想草稿，但不能確認申請資格。
[前往課程／主授欄位] [老麥從已上傳授课資料整理]
```

```text
缺失：目前沒有正式分析結果
影響：可撰寫研究規劃，不能生成完整實證Results。
[前往資料／分析工作區] [老麥建立待取得資料清單]
```

```text
需重驗：已鎖定引用所支持的Gap可能與新研究衝突
[查看來源差異] [老麥提出修訂候選]
```

跳轉後展開正確區塊、定位欄位；提供「保存並返回原階段」，後端重驗才解除Issue。對無法自動補足者明確顯示文件／人員／外部決定需求。

StageActionBar固定使用：
- 完成：`完成本階段，前進「下一階段名稱」→`。
- 未保存：`儲存並檢查下一步`。
- 缺項：`尚缺N項，前往補足`，另有`老麥一鍵補全`。
- 自動執行中：`查看老麥處理進度`。
- 過期：`重新檢查受影響項目`。
- 下一模組不可用：`保存交接並查看下一階段說明`。
- 本次產出已完成：`查看成果與品質報告`，不要自動宣稱接受或核定。

完成提交前重新驗證revision、權限、規則與依賴。冪等保存completion、handoff及transition；導航失敗可重開已保存交接，不重跑AI、不建立重複成果。

## 14. 一鍵靈感、雷達與選題的三路線深化

一鍵靈感主要輸入維持簡單：研究方向可空白、本次主要目標三選項、按鈕「啟動一鍵靈感」，進階條件收合。首次可讓老麥提出方向建議；不能無聲替使用者選目標。

預設最多10題，5核心延伸／3跨域拓展／2前沿探索，只作候選多樣性策略。合理候選不足如實顯示，不湊題；Top3角色為綜合適配／最低可行研究／長期價值，依本次目標解釋，不三卡複製同一題。

不同目標的生成與評分：
- SCI／SSCI：國際問題、Gap、相近研究差異、方法、可用資料、理論或技術貢獻、讀者與期刊群。
- 國科會一般：科學問題、重要性／創新、方法可行性、主持人／團隊适任性、工作包與資源。
- 教學實踐：課程及學習難點、問題證據、教學介入、學習機制、成果評量、課程可行性與教師經驗。

教學實踐無課程時可提供候選課程情境，但標`PROPOSED_COURSE_CONTEXT`；不能把建議當成本人已主授。若目標為技能改善卻只有滿意度，提示成果測量不一致；不得把任何滿意度研究一律判定不合法。

雷達仍有HOT_TOPIC／EMERGING_FRONTIER／CROSS_DOMAIN與「我的／全球」檢視；保留AI能源管理、環境資源管理、AI教育、職安、XR與可選智慧製造專長。

選題實驗室保留健檢、比較、可行性與採用，移除重複大型「沒有靈感」介面但不刪歷史。選題快照保留GoalContext與來源，再進入投稿導航；文獻中心全程共用。

保留先前DailyDigest每日研究推薦：讀取同一GoalContext、領域Profile與文獻API，在使用者已授權的排程、台北時區、來源範圍及費用上限內執行。日報產生的新方向仍走同一雷達→靈感→選題入口；不能覆蓋已鎖定題目，不能因首頁開啟而自動啟用排程或Telegram推播。

## 15. 投稿與計畫導航：本輪完整專業範圍

從TopicSelectionSnapshot自動讀取題目、摘要、RQ、初步Gap、方法方向、場域／對象、貢獻、來源與Profile，不重新要求輸入。

### 共同作業

QUICK MATCH使用現有來源與可用API先給候選；DEEP MATCH對選定候選深化。共用任務、版本與來源，不重複建立結果系統。一次局部來源失敗不讓整頁空白；沒有live查證時標本地／待驗證規劃。

輸出分開：內容Fit、證據coverage、資格、規則查證、徵件狀態、使用者硬限制、規劃採用、正式送件準備。未知為null，不以0或假95分補上。

### 期刊

核對身份／ISSN、出版商官方scope、文章類型、近期相關文章、貢獻／方法／讀者適配；依SCI／SSCI偏好檢查官方index與期間。JCR分區、CiteScore／SJR分區不得互換，數值附年度與學科。

APC、OA模式、額外費用、審稿時程定義、資料／程式／倫理／AI政策及有效Special Issue由官方來源記錄；查不到為unknown。沒有Special Issue不自動扣分。已停刊、可疑入口、索引或預算不符獨立阻擋正式選定，不能以高Fit抵銷。

候選推薦Best Fit／Ambitious／Practical，不足不湊數；此階段是前瞻布局，可暫定具名刊或期刊領域群，不保證接受。

### 國科會一般

依科學問題與主要學術貢獻比較合理處別／學門（可2–4條，有依據才列）。核對資格、一般研究計畫、型別、PI成果、方法、資源、當年度要求與機構程序。學門名稱與代碼不可編造。引用官方規則，不把網站評分寫成官方分數。[S1]

### 教學實踐

依課程內容、教學問題、介入、學生成果、方法及教師經驗比較合理學門／專案。與國科會學門使用不同namespace。課程、主授、學生與學分等依官方規則確認；沒有教學現場證據屬準備／品質缺失，不能任意改成法定資格FAIL。[S2]

每個候選提供定位摘要、推薦及不適配理由、相近證據、尚缺真實資料、所需修正與下一步。改寫只能形成PositioningVariant，不能偷偷加入不存在的隨機化、樣本或成果。

### 內部rubric延續且版本化

- Journal：scope25、貢獻20、近期相近研究20、方法／文章類型15、讀者10、實務條件10。
- NSTC：學門／科學問題25、重要與創新20、方法可行性20、PI15、預期貢獻10、資源10。
- MOE_TPR：課程20、教學問題證據20、介入／機制20、成果評量20、方法可行性10、教師經驗10。

模型提供各維度評語、Evidence與0–5或UNKNOWN，後端計算加權分。未完成評估顯示已評權重與缺失，不能把一項滿分放大成100分；不同rubric不可直接比較成跨路線通過機率。

### 導航完成與交接

有已保存的選題快照、三軸目標、選定／暫定路線、定位、來源層級、風險及後續待辦即可依政策通過規劃交接。不能要求真實Results或IRB核准才開始藍圖，也不能把暫定路線當成申請合格。

保存不可變 `SubmissionNavigationSnapshot`：project／goal／topic版本、指紋、候選及規則版本、所選路線、Fit明細、缺失、文獻／CitationSource／Zotero refs、lock、decision_origin與readiness。

[完成投稿導航，前進研究藍圖→] 或 [保存暫定規劃並前進研究藍圖→]。未有研究藍圖模組時保留HANDOFF_READY與說明，不製造假完整藍圖。

## 16. 共用文獻API、Consensus與Zotero

使用者確認文獻相關服務有API。優先讀現有adapter、帳號與secret reference，不再把Consensus當未來占位，也不要求無謂增購。

建議任務路由：Consensus做問題導向相關研究，Ai4Scholar做既有多源／中文／專利召回，Semantic Scholar等做引用與相近研究，Crossref做書目核對，OpenAlex做明確範圍聚合；PubMed、arXiv、IEEE／ACM、Scopus／WoS等依現有權限與研究適用性使用。不要每次全部API都呼叫。

保留provider、upstream database、原始出版來源、access_level、取得／出版／更新日期、閱讀範圍、查證與Claim支持。多來源找到同一篇文獻只計一個work，不能視為多個獨立研究或以票數形成共識。

所有學術內容經：Canonical LiteratureRecord→ProjectLiteratureLink→Evidence／Claim→CitationSource。全文／摘要／片段與人工／機器處理狀態分開。多篇article屬同一study時在證據綜合避免重複樣本計權。

Zotero沿用 `(library_type, library_id, item_key)` 身分與Collection對應；citation key不是item key。沿用已批准讀寫scope，不自動擴權、不把官方核准文件或學生個資大量寫入Zotero。未同步者只要本地來源有效可繼續規劃，顯示同步待辦，不能讓同步狀態冒充科學可信度。[S6][S7]

DeepL等語言API沿用現有Language Gateway與科學含義鎖。所有provider能力按現行官方文件、帳號scope及Live測試確認，不沿用過去回答中未再核實的參數或價格。外部服務不能取得非必要個資或跨專案資料。

## 17. 官方規則與成熟度：不能把晚期條件提早卡死

OfficialRuleSnapshot保存authority、document、URL、條文位置、適用年度、effective_at、retrieved_at、rule_version、status與exact_requirement。

需求區分：官方要求、校內要求、使用者硬條件、研究品質建議、網站操作條件；每項有 `due_phase` 及 `blocks_actions`。

來源讀取失敗顯示FETCH_FAILED／UNVERIFIED，不等同「官方未公告」。先前年度只能標參考。目標年度、機構、學門未確定可在規劃層前進，但正式申請包不能宣稱符合未核實要求。

本輪不寫死115／116年度日期、頁數、補助上限或審查比重；不以他校期限代替使用者校內期限。[S1][S2]

期刊／計畫的「文件已準備好」與「已正式送出／核定／接受」分開。任何正式提交、作者同意、IRB判定、計畫核定要真實可追溯紀錄，不能單靠模型判斷。

## 18. 產出品質與「可用」的驗收

目標是專業可用，不是文長漂亮或欄位全填。每個產出附：
1. 來源與證據manifest。
2. 方法／结果／引用一致性報告。
3. 目標期刊或計畫的內容與文件對照。
4. 缺失、假設、未決事項及限制。
5. 人工審閱／自動處理／鎖定與版本紀錄。

可用成熟度：IDEA_DRAFT、PLANNING_DRAFT、EVIDENCE_LINKED_DRAFT、SCIENTIFICALLY_REVIEWED、LANGUAGE_REVIEWED、COMPLIANCE_CHECKED、READY_FOR_AUTHOR_ACTION。每層有真實條件，不跳層。

預期結果永遠標預期；未研究不能產生正式發現。新分析須回Analysis Lab，正式數值只能由ResultFact流入稿件。引用為正式CitationSource關係，不是純文字作者年份。

不同研究的品質要求按設計設定：不以相同量表、樣本數、假設、RCT或效果量清單機械檢查全部文章。無法估計或不適用時保留合理說明與評核，不為達標生成數字。

文件匯出沿用既有引擎，產生確實可開啟的檔案與manifest／checksum；未產檔不給假下載連結。排版轉換後仍需核對數值、引文與表圖。第一輪在现有引擎内驗證，不另外重建DOCX／PDF系统。

## 19. 預算、可靠性、資料安全與主機權限

沿用AgentJob checkpoint、租約／排他、取消、有限retry、outbox／等價事務交接。首頁狀態採可恢復事件stream或既有polling，以event revision去重排序；斷線後重取server snapshot，不能把過時事件畫成新完成。

所有任務帶project／workorder／goal／input版本。刪除／回收、停用、取消、權限改變後阻止遲到回寫；恢復專案不自動重啟外部工作。

API回寫採輸出schema驗證和allowlist patch。外部文獻／網頁／使用者附件是資料，不是改系統權限的命令。不能把任意URL作內網抓取、讓LLM輸出直接執行SQL或帶主機憑證運行腳本。

網站後端驗證tenant／project／role；OpenClaw建站代理的shell、部署、DB管理權不得交給網站聊天。sessionKey是路由資訊，不是使用者授權憑證。共享可信Gateway不等於敵對多租戶隔離；按實際信任邊界配置專用受限服務。[S8]

key只放後端secret storage，log不記完整稿件、PII或secret。每個provider都有授權範圍、usage與成本上限。自動fallback需同時滿足資料傳輸許可與預算，不能因原API失敗偷偷外傳或再付費。

不讓「一鍵智慧化」表示任意安裝Skills、購買帳號、對外寄信、招募參與者或正式投稿。既有正式整合如需使用，必須依其安全與確認流程，本輪不新增無限制外部寫入。

## 20. 共用資料契約、API與事件

優先擴充既有模型，不照名單機械建立數十個新表。最少邏輯契約：

- ResearchGoalRegistry／GoalContextVersion：三目標及路線意圖。
- WorkflowTemplateVersion／ProjectWorkflowInstance：版本化路徑、依賴與適用條件。
- StageReadiness／CompletionSnapshot：完成依據與目前有效性。
- FieldPolicy／AssistCoverage：專業協助能力及限制。
- ProjectWorkOrder／TaskPlan／AgentJob：一鍵目標、任務、checkpoint與費用。
- RequirementIssue／ReturnContext：缺失、精確导航與返回。
- ArtifactRevision／ContentLock／Approval：編輯保护與真實審閱。
- SourceManifest／OfficialRuleSnapshot／CitationSource：來源鏈。
- TopicSelectionSnapshot／SubmissionNavigationSnapshot：可復用交接。

建议與既有API合併的能力：

```text
GET goal catalog／workflow view／stage readiness／assist coverage
POST goal change preview／apply
POST project work-order plan／authorize／start／pause／resume／cancel
POST field assist／section assist／stage assist
POST save／lock／unlock new revision
POST stage validate／complete and handoff
GET issues／resolve and return／job progress／artifact versions
```

所有mutating actions驗證權限、expected_revision與idempotency key。對已完成提交重復请求返回同一結果；鎖定衝突以可理解原因回應。實際路徑沿用框架，不宣稱示例就是已部署API。

前端流程燈號、側欄、首頁下一步、任務計畫及說明統一讀Workflow Registry與Readiness，不分開硬編。

## 21. 無障礙與UI驗收

所有節點與主要按鈕可用鍵盤、可見焦點、清楚中文文字；mobile 320 CSS px重排成垂直流程，不需要拖整個超寬圖才能找下一步。Sticky action bar不能遮住聚焦輸入或底部刪除區。

預設顯示本次目標路徑與目前相關節點，完整生命週期一鍵展開。不要將20多個專業節點擠在首頁一排，也不把明顯流程圖藏在「說明」。

完成燈亮起可短暫強調但不持續閃爍；支援減少動態效果。儲存、缺失、任務狀態使用ARIA適當通知，不能每個token更新都打斷閱讀。[S4][S5]

底部刪除維持醒目獨立危險區、確認名稱、軟刪除與復原，不做漂浮紅色按鈕。首頁不能為美觀使用假完成率、假作者核准或假文獻數。

## 22. 分批實作與停止規則

### 批次A：三目標修復及相容遷移
盤點根因、單一GoalRegistry、完整前後端enum與模板、GoalContext、舊值相容、三路線integration contract。

### 批次B：首頁流程圖與Readiness
醒目流程面板、分支、燈號、兩種進度視圖、缺失導航、下一步、儲存／刷新／切換／回收回歸。

### 批次C：全站Assist、Orchestrator與投稿導航
接入全部現有stage／field；一鍵可恢復工作、鎖定保护、三套專業模板與匹配、Consensus等來源、來源清單與投稿導航交接。

### 批次D：三路線端到端與交付
至少各跑一條完整可用目標流程，完成下列驗收及既有回歸。未建模組列capability gap，不造假亮燈或假全文。

完成本輪後停止，不自行開展新版第四階段的專業研究藍圖引擎。現有藍圖可透過adapter接入但不得破壞來源。

## 23. 驗收案例（40項）

| ID | 真實測試要求 |
|---|---|
| T01 | 首頁、專案設定、一鍵靈感、導航與寫作任務均列三個相同正式目標。 |
| T02 | MOE_TPR從前端到API、job、prompt、schema、cache與snapshot完整保存，不回退期刊。 |
| T03 | 舊目標遷移保留raw值、歷史版本與unknown，不自動改已鎖定專案。 |
| T04 | 教學實踐缺課程仍顯示可規劃；資格UNKNOWN不改FAIL或PASS。 |
| T05 | Grant主目標搭配期刊次產出，各自進度與產出不覆寫。 |
| T06 | 僅切換首頁路線檢視不修改GoalContext或重新觸發付費任務。 |
| T07 | 不符SCIE／SSCI的期刊不能冒充符合條件；索引未知進待查清單。 |
| T08 | 開頁、儲存、鎖定或建站測試通過都不能無條件點亮研究完成燈。 |
| T09 | 有效completion快照才亮綠，顯示文字與產出；刷新後相同。 |
| T10 | 來源重大變更只將相關下游標STALE，歷史完成记錄仍可查看。 |
| T11 | 不適用有理由；未建置必要模組不從分母消失；共享節點不重算。 |
| T12 | 申請書完成率與研究執行率分開；不因未来實證尚未開始而阻止申請草稿。 |
| T13 | 所有燈號有文字／圖示，鍵盤及手機垂直流程可操作。 |
| T14 | 缺失直达正确project、tab、field，保存返回後重驗；不是點擊即完成。 |
| T15 | 下一步重複點擊、導航失敗、API重試不重複建立handoff。 |
| T16 | 人工作業或作者確認未完成不能被一鍵自動移除，其他獨立工作可繼續。 |
| T17 | 欄位、區塊與階段Assist全部現有模組有coverage，唯讀事實有適當查證動作。 |
| T18 | 自動補全一次授權連續處理允許草稿，不逐段重問；範圍外行為被擋。 |
| T19 | USER_FACT無來源不虛構，COMPUTED_FACT由可追溯計算服務而非LLM填總數。 |
| T20 | PROTECTED_RESULT在改寫、翻譯及路線變更後不變。 |
| T21 | 手動、autosave、worker、同步與匯入均尊重後端鎖；不能換active版本繞過。 |
| T22 | AI執行中使用者编辑或鎖定，遲到輸出存候選，不覆寫。 |
| T23 | 自動鎖定標AI草稿與AUTOMATION_POLICY，不伪造人工同意。 |
| T24 | Orchestrator有步数、重试、預算、取消及恢復；停止後回調不可復活任務。 |
| T25 | 第三方API超時保存局部成果；無live來源時不顯示「已查證最新」。 |
| T26 | 使用者未授權的外部模型／付費fallback不被自動使用。 |
| T27 | 缺真實期刊結果時生成研究規劃包＋缺項，不生成假Results或完整實證稿件。 |
| T28 | 有有效结果時可連續串接既有全文、審查與潤稿，所有數值及引用可追溯。 |
| T29 | 國科會一般計畫使用科學問題、方法、工作包、預期成果；不套教學計畫模板。 |
| T30 | 教學實踐產出含課程問題—介入—學習成果—評量鏈；不是只換標題。 |
| T31 | 三目標靈感Run相同關鍵字仍帶入不同評估目的，快取不串線。 |
| T32 | 官方頁面讀取失敗≠尚未公告；前年度規則與當年未知分開。 |
| T33 | Consensus與其他來源同文獻去重，保留provider來源，不重複當獨立支持。 |
| T34 | Zotero綁定、CitationSource、reading level及Claim支持獨立保留，未同步不假裝已讀。 |
| T35 | 不同使用者／專案不可讀寫彼此內容；OpenClaw Session不能取代project授權。 |
| T36 | 外部文獻prompt injection、任意URL、惡意輸出不能觸發shell或任意DB改寫。 |
| T37 | 非人體／質性／既有資料工作適用正確分支，不強制RCT／問卷／補招募。 |
| T38 | 沒有正式回執，不自動變SUBMITTED、APPROVED、ACCEPTED。 |
| T39 | 解鎖與來源修訂產生新版本；刪除／復原不丟文獻或重啟外部任務。 |
| T40 | 三路線各完成一次適用端到端驗收；LIVE、MOCK、FIXTURE、NOT_RUN、BLOCKED分開回報。 |

Mock／Synthetic資料只在隔離測試環境，不計入真實專案進度、真實信效度或投稿包。測試成功表示網站能力，不表示研究已完成。

## 24. 完成定義與交付

交付：修改／新增檔案、migration、實際API與資料流、三目標覆蓋表、Workflow Registry與燈號規則、Progress口徑、全站Assist覆蓋、Orchestrator checkpoint與成本、鎖定與衝突測試、缺失導航、三套專業匹配、Consensus／其他API與Zotero真實連線狀態、產出QA、手機／無障礙、40項驗收、已知問題、所在環境、回復方法。

更新PROJECT_STATE.md，至少記錄：task=V3-U03-R2、目前實作版本、可用模組、各goal可完成到哪個產出、尚未建置能力、provider與測試狀態、feature flags、migration狀態、rollback、下一階段輸入。未測試標NOT_RUN，不以「完成」一語帶過。

最終實際示範：
1. 選「教育部教學實踐」→一鍵靈感→採用題目→導航→缺課程主授資訊提示→精確補足→保存暫定／已核對規劃→綠燈更新→前進藍圖交接。
2. 同一專案另設定SCI／SSCI成果規劃，計畫進度不被覆蓋。
3. 有效已驗證結果的测试案例一鍵協作經現有稿件工作室產生真實來源稿；無結果案例只到規劃包。
4. 鎖定RQ後一鍵補全其他欄位，鎖定內容不變；重啟worker後從checkpoint恢復。

本輪驗收通過的網站狀態名稱可為 `GLOBAL_THREE_GOAL_WORKFLOW_INTEGRATION_VERIFIED`，此為工程驗收，不能寫到專案研究完成狀態。

## 25. 官方核對來源與適用邊界

以下為2026-09-06取得的官方規則／文件起點，供開發時重新確認。它們是規則與功能的來源，不是對目前網站已完成的證明。年度、帳號能力、API版本與政策需於實作及正式使用時再核對。表內沒有預設當年度申請期限、固定金額或收錄保證。

- [S1] 國科會主管法規系統：國家科學及技術委員會補助專題研究計畫作業要點。檢視第4、5、14點等；一般研究計畫、型別及審查核心。
  https://law.nstc.gov.tw/LawContent.aspx?id=FL026713
- [S2] 教育部主管法規系統：教育部補助大專校院教學實踐研究計畫作業要點。檢視第2、4、5、7、14點等；教學問題、資格、正式課程、審查與倫理時點。
  https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704
- [S3] Web of Science官方支援：Collection Development Tools／Master Journal List。核對SCIE／SSCI等collection，不能只凭JIF或其他index推定。
  https://webofscience.zendesk.com/hc/en-us/articles/44444401541521-Collection-Development-Tools
- [S4] W3C WAI：WCAG 2.2 Understanding Use of Color。顏色不能是狀態的唯一表達方式。
  https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- [S5] W3C WAI：WCAG 2.2 Understanding Status Messages。動態狀態可由輔助技術辨識。
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- [S6] Consensus官方API介紹與文件起點。使用現有有效端點與帳號scope，不將網頁产品所有能力假定為API能力。
  https://consensus.app/home/api/
  https://help.consensus.app/en/articles/16516328-the-consensus-api
- [S7] Zotero Web API v3 Basics。延續Library／Collection／Item對應與授權。
  https://www.zotero.org/support/dev/web_api/v3/basics
- [S8] OpenClaw官方Security。Gateway信任邊界、sessionKey與工具權限。
  https://docs.openclaw.ai/gateway/security

完成本輪後停止，等待使用者指示下一階段。
