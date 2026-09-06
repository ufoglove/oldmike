# OpenClaw 科研網站 V3｜新版第十階段完整建置提示詞
## 研究工具、量表、教學／實驗材料與 Study Protocol
**規格代碼：V3-U10-FULL｜文件版本：v3.4｜整理日期：2026-09-06**

> 這是交給 OpenClaw 的網站工程任務，不是老麥人格、獨立 Skill，亦不是直接替研究者執行預試。請實際閱讀 repository、增量實作、保存資料與執行驗收。
>
> **本輪完成：工具與 Protocol 的可用規劃工作區、可編輯材料、計分規格預覽、版本化研究程序及第十一階段交接。**
> **本輪不執行：人體認知訪談、預試、正式招募、資料蒐集、信效度實證檢驗、正式統計或對外送件。**

## 0. 本階段目的與交付邊界

目前新版 V3 第一至第九階段已完成網站建置；不據此推論每一個研究專案已完成審查、取得倫理核准或實際執行研究。

本次承接新版第九階段「路線審查、合規準備與研究倫理」，建立：

**研究工具、量表與 Study Protocol 工作室（Instrument & Protocol Studio）**。

請將第七階段的 Measurement Requirements、第八階段的計畫／期刊研究規劃，以及第九階段的審查修訂、倫理範圍、資料管理與待辦，轉成下列成果：

- 工具需求與 RQ／構念／分析的對照。
- 候選工具及來源比較、選用或自編理由。
- 標準化量表、原創問卷與測驗、技能評分規準、訪談工具及技術資料規格。
- 授權與文化調適紀錄，保留仍需人工、實地或後续驗證的項目。
- 介入與比較條件、活動時程、計分與 Data Capture Schema。
- 可閱讀、可編輯、可保存、可匯出的 Study Protocol 規劃草稿。
- 對照研究設計、分析及倫理的檢查結果。
- InstrumentProtocolSnapshot 與新版第十一階段「Pilot／工具預試與 Protocol 驗證」的接收契約。

正確資料流：

```text
Stage09HandoffSnapshot
＋已採用的 DesignAnalysisPlanningSnapshot／RouteWorkspaceSnapshot
→ 工具需求 → 工具選擇／自編 → 授權與調適 → 材料與活動安排
→ 計分與資料欄位 → Protocol → 一致性檢查 → 規劃／條件式基線
→ InstrumentProtocolSnapshot → 第十一階段接收頁
```

本輪不是舊版第十階段「正式研究執行」。不要因歷史模組編號相同而接錯頁面；使用 StageRegistry 的語義識別與明確版本映射。

## 1. 先盤點實際架構與保護既有成果

先找真正網站 repository、PROJECT_STATE.md、目前分支、未提交修改、部署及測試環境。不要把 OpenClaw 個人工作區誤當網站程式库。

盤點：

1. 第九階段 handoff schema、實際 payload、consumer tests、第十階段接收頁。
2. ResearchProject／GoalContext／work order／study component／RQ／construct 的既有型別與 ID。
3. 研究設計、測量需求、分析計畫、樣本規劃、預算及課程矩陣的已採用版本。
4. 第九階段 ReviewerFinding、ComplianceItem、RequirementIssue、RevisionTask、EthicsAssessment、InstitutionalEthicsDecision、DataManagementPlan。
5. 既有工具／問卷／材料／表單／Protocol 功能，能修復者重用，不重複造表。
6. 文獻與證據中心、EvidenceNeed、CitationSource、Zotero binding 及現有 Consensus 等 API adapters。
7. StageWorkspaceShell、FieldPolicy、FieldAssist／SectionAssist／StageAssist、Lock、revision、Audit Trail、AgentJob、outbox、export。
8. 專案讀写權限、機密檔案權限、Secret 管理及備份／回復方式。

保留原 ID、研究資料、稿件、文獻、工具版本與未提交修改。先在隔離開發／測試環境增量實作；正式 migration、正式部署、破壞性變更、付費額度增加及外部寫入擴權另取授權。

交付「目前實況→可重用→待修復→最小新增」表，然後實作可完成部分，不只交分析報告。任何遠端未設定憑證只標 BLOCKED，不假裝整合成功。

## 2. 接收 Stage09HandoffSnapshot：不重填、不丟失限制

第九階段交接至少包含以下語義欄位；實際命名以 repository schema 為準：

| 上游內容 | 本階段使用方式 |
|---|---|
| project_id、goal_context、selected_route | 驗權並固定專案、研究目標與本次工作範圍 |
| selected_journal／discipline、proposal／planning draft references | 繼承目標與文件參考，不重新選刊或選門 |
| reviewer findings、resolved／unresolved findings | 轉為工具／程序需求或引用原修訂任務 |
| official rule snapshots、compliance matrix | 繼承規則適用性、年度、due 與實際阻擋動作 |
| ethics scope、ethics risks、institutional decision status | 判斷需處理的風險及版本覆蓋，不自行核准 |
| data management plan、preregistration plan | 作為資料欄位、外部處理與修訂的約束 |
| measurement／instrument needs、protocol needs | 建立本輪需求工作區 |
| blocking issues、later-stage issues | 保留哪些阻擋規劃、哪些阻擋使用／執行 |
| evidence links、citation links、zotero refs | 使用既有正式來源，不複製書目 |
| locks、versions、source manifest | 保留有效版本、鎖定與追溯鏈 |

上游已聲明的 Gate 是 `ROUTE_REVIEW_BASELINE_COMPLETE`、`ETHICS_SCOPE_AND_DATA_PLAN_COMPLETE`、`STAGE09_HANDOFF_READY`。建立顯式 adapter 對應實際 Gate，允許合格的條件式交接；不新增「先有正式IRB核准才可寫工具草稿」的循環前提。

第九階段部分參數較精簡，以下資訊應從已授權原紀錄解析，不重問使用者：DesignAnalysisPlanningSnapshot、RouteWorkspaceSnapshot、study component、RQ、construct、measurement requirement、time point、分析變數及 source revision。無法解析則建立 `UPSTREAM_REFERENCE_MISSING`，不得自動建立一組假 RQ。

兼容要求：

- `blocks_action` 與既有 `blocks_actions` 可顯式映射，保存原值及 adapter version。
- 舊 `JOURNAL` 可在已確認語義後映射到 `JOURNAL_SCI_SSCI`，不能把不明值默認成期刊。
- 缺 envelope metadata 時，只可由真實專案上下文產生技術識別，不生成科學事實或 PASS。
- 來源指向 pending ChangeProposal 時，保留建議狀態；只有已採用的版本參與基線。
- 若倫理狀態僅是使用者自述，另存 `USER_ATTESTED` 與待核證狀態；不冒充已核對的正式機構文件。

驗證 tenant／workspace、project、巢狀來源 ACL、schema version、revision 及 checksum。無支援版本回傳清楚錯誤與修復入口，不靜默忽略欄位。

初始化唯一性至少含 workspace、project、source_stage09_snapshot、work_order_scope、schema version。重開、刷新、重複點擊不得重建專案或自動重跑付費任務。

## 3. 三大目標與研究類型：共用工具，保留不同用途

全站繼續使用：`JOURNAL_SCI_SSCI`、`NSTC_GENERAL`、`MOE_TPR`。primary goal、funding intent、publication intent、當前文件、研究時間狀態及本次終點分開。

| 目標 | 工具與 Protocol 重點 |
|---|---|
| SCI／SSCI | 可重現的研究方法、主要／次要結果與資料來源、測量理由、文章類型適用的報告項目 |
| 國科會一般 | 工具如何支援科學問題與工作包、設備及資源需求、開發風險、可行替代方案與計畫書方法附件 |
| 教育部教學實踐 | 課程目標、教學介入、知識／技能／作品／行為等學習成果、評量與課程週次、学生權益 |

多路線可指向同一組工具或 Protocol 元件，不複製整份研究；不同課程或版本的私有材料與註記仍隔離。切換 Tab 不改變主要 Goal，也不重新生成已鎖定內容。

支持工作用途：

- `PROPOSAL_SUPPORT`：為計畫書準備方法、工具需求與附件規劃，不強迫先有未來研究結果。
- `PROSPECTIVE_STUDY_PREPARATION`：準備研究程序，保留預試、授權及倫理前置条件。
- `EXISTING_STUDY_DOCUMENTATION`：整理有真實紀錄的既有工具／程序，不回填為事前計畫，不改寫實際曾執行的程序。

研究元件允許量化、質性、混合方法、技術／AI、二手資料、環境／能源／製程研究。非人體研究不強制問卷、分組、知情同意表或量表信度；需保留資料使用、場域及安全的適用要求。

本輪可以準備計畫所需的方法附件。正式申請或研究執行前的文件時間點，延用適用官方規則，不通用延期到計畫核定後。[S9][S10]

## 4. 使用者介面：簡單入口，細項按需求展開

升級第九階段留下的第十階段接收頁。頁名：**研究工具、量表與 Protocol**，副標：**把研究問題轉成可測量的工具與可照做的研究流程。**

預設只顯示與當前研究元件適用的內容。建議七個主頁籤：

1. 總覽與工具需求。
2. 工具選擇與設計。
3. 介入、材料與活動。
4. 計分與資料規格。
5. Study Protocol。
6. 來源、授權與調適。
7. 檢查、版本與交接。

內層用可搜尋列表、區塊展開及實體詳情頁，不一次排出二十個橫向 Tab。

頂部保留目前專案、主要目標、工作用途、上游來源版本、保存狀態、工具規劃進度、Protocol 狀態與目前執行限制。首頁仍保留未完成專案下拉、儲存／讀取／新增、功能解說、成果、文獻摘要與底部可復原刪除。

每區塊說清楚：用途、需要什麼、老麥能做什麼、產出、保存位置與下一步。沒有內容提供具體開始動作，不能放假題項、假分數或展示資料當成果。

保留一個 Next Best Action 與醒目 StageActionBar。狀態同時用文字、圖示與顏色；手機單欄，固定操作列不遮住編輯器、鍵盤焦點或底部危險區。

## 5. 工具資料模型：書目、工具與專案使用不可混為一體

建立或擴充工具 registry，但不要另建文獻庫。區分：

- **InstrumentDefinition**：工具本身的名稱、構念、作者／來源、版本家族。
- **InstrumentVersion**：特定語言、長／短版、修訂、施測方式與計分規格。
- **ProjectInstrumentUse**：本專案為什麼使用、對應 RQ／需求／時點、選用狀態、限制與私有註記。
- **ProtectedInstrumentContent**：受保護的題項、手冊、答案或附件，依實際權限提供，不自動全站共享。

Canonical 去重只在有授權的 workspace 範圍內；跨 tenant 不共享私有材料、筆記或權利證明。公開Metadata即使共用也必須隔離專案使用關係。

不能只用 DOI 當工具唯一鍵：同一篇文章可能描述多個工具，原版／短版／翻譯／改編也不一定等效。保存 `derived_from`、語言、form、revision、mode 與正式出處；有疑義時提出待確認重複，不自動合併。

工具類型可包含標準化量表、自編問卷、知識測驗、技能／作品 Rubric、觀察清單、訪談、行為任務、系統事件、感測資料、文件抽取、AI標註／評估。這些是類型，不要求每個Project都建立全部工具。

## 6. Measurement Requirement Map：從需求開始，不從量表清單開始

讀取第七階段的既有 MeasurementRequirement，不另生一套構念。每列至少包括：

```text
requirement_id / revision / study_component_ref / rq_refs / statement_refs
construct_ref / conceptual_definition_ref / primary_secondary_or_process
target_population_or_unit / context / intended_use / interpretation_scope
measure_type / objective_subjective_or_mixed / observation_unit
measurement_time_point_refs / language / administration_mode
candidate_instrument_refs / selected_or_provisional_use_refs
analysis_variable_requirements / evidence_refs / permission_status_refs
measurement_property_needs / burden_assumptions / risk_refs
requirement_issue_refs / due_event / blocks_actions / decision / review_state
```

一個構念可多種量測，一個工具可支援多RQ；必須保存many-to-many關係。區分心理構念、工具得分、原始資料、衍生指標，不能因名稱相近就視為相同概念。

每個主要RQ／主要結果需有具體測量或資料取得路徑。尚未選定工具時可以保留候選與明確缺失，但不能標「已可施測」。不適用心理量表的技術指標可使用評估規格或資料來源。

狀態至少分需求已整理、待候選、候選可比較、暫定選用、已選用、待來源／權利／調適、待實地驗證、不適用。實際命名映射現有狀態，不混成一個 VERIFIED。

## 7. 候選工具比較：適用性、品質證據、負擔與成本

每個需要選用的工具，可提出合理數量的真實候選；不固定必須找滿2–5個，也不為湊數虛構工具。沒有合適既有工具可選原創開發與驗證計畫。

比較：名稱及版本、構念與涵蓋範圍、原作者、來源、適用對象、研究情境、語言、施測方式、反應格式、題數、時間負擔、計分、測量性質、成本與權限、現有研究限制、本專案使用理由。未知欄位為 null 並有原因。

測量品質證據逐筆保存：來源研究、工具版本、語言、樣本／群體、施測方式、測量性質、方法、估計及不確定性（來源有報告時）、來源位置及可遷移性限制。**他人樣本的信度或效度不是本專案的實證結果。**

COSMIN 的方法提示工具選擇需同時考慮構念、實務負擔與品質；內容效度包含適切性、完整性與可理解性。此處採用這些判斷面向，不把主要針對特定測量領域的方法強制當成所有工程工具的唯一認證標準。[S1][S2]

不要只用 Cronbach's alpha 排名，不以單一門檻宣稱工具完整有效。依用途考慮內容、結構、再測、評分者、測量誤差、反應性、跨語言／跨群體可比性等；不適用者有理由，尚無證據者提出後續計畫。

預設顯示理由、證據覆蓋與風險；若沿用100分功能，後端依版本化權重計算，未知不補0或假高分，另列覆蓋度及可比較性。分數不是官方標準、接受率或授權。權利與倫理限制不可由高總分抵銷。

## 8. 文獻、Evidence、Consensus與Zotero共用流程

所有新文獻先進入既有文獻與證據中心，建立／匹配Canonical Literature、ProjectLink、Evidence與CitationSource，再連到工具、計分、介入或Protocol；不在此頁另開一套文獻資料庫。

`補充工具來源／測量品質／調適依據／方法來源` 按鈕建立或重用 EvidenceNeed，帶入 project、work order、requirement、instrument version、RQ、source purpose、允許來源與return context。

Consensus及其他已接API依任務、權限與預算選擇，優先重用 adapter；官方有API整合能力，不代表目前部署已具憑證或每種全文能力。LIVE可用能力由實測確認，失敗回局部成果及待處理，不假裝查到全文。[S7]

區分：metadata核對、取得內容範圍、AI處理位置、人工閱讀、支持／反證、出版後更新狀態、Zotero同步。全文可得不等於已閱讀；同篇多來源不算多份独立支持。

Zotero引用保存 `library_type + library_id + item_key + item_version` 及本地citation ID；item key不是BibTeX citation key。沿用已授權Collection與API版本化讀取，不將雲端localhost当成使用者桌面。不新增整庫雙向同步，不因新階段自動增加write／附件权限。[S5][S6]

Zotero斷線保留仍合法可用的本地來源；遠端更新只提出metadata差異或來源過期，不覆蓋鎖定的工具分析。權限實際撤回則依政策停止相應使用與顯示，不能把舊快取當成永久授權。

## 9. 授權、題項安全與用途範圍

建立 PermissionRecord／RightsDecision，分開記錄：權利人、資料出處、適用版本、允許的使用者／專案、用途、地區／語言／施測模式、費用、期限、來源文件、查證狀態與限制。

至少區分以下動作權限：

```text
VIEW_METADATA / VIEW_RESTRICTED_CONTENT / PRIVATE_PROCESSING
TRANSLATE / ADAPT / DIGITAL_ADMINISTRATION / PRINT_ADMINISTRATION
EXPORT_ITEMS / PUBLISH_SUPPLEMENT / COMMERCIAL_USE / SEND_TO_PROVIDER
```

公開可看見、可下載文章、文章有開放授權，不自動證明其中每套第三方量表、手冊或圖像也可任意改寫或公開重製。

未知時仍可保存Metadata與使用需求；對受限內容的抓取、匯出、公開、外部傳輸或施測按用途阻擋。使用者合法上傳的內容只在確認的私有範圍處理，不把上傳等同全站公開權。若使用依據是開放授權、權利人许可或其他经確認適用依據，保存實際範圍，不要求一律付費。

不得用AI仿造受保護題目來規避限制。答案、評分錨點、測驗安全材料与權利文件採独立ACL，搜尋索引、向量庫、Provider SourcePack、匯出與簽名檔案連結均檢查權限。學生預覽不顯示答案鍵。

狀態至少包括UNKNOWN、VERIFIED_SCOPE、REQUEST_PENDING、RESTRICTED、DENIED、EXPIRED；有結論仍保存proof與reviewer。不因使用者勾選「同意」就把第三方權利人核准寫成已查證。

## 10. 翻譯與文化調適：不是一般論文潤稿

有合適現成語言版時先核對適用版本、群體與使用限制，不擅自翻新。需要翻譯／改編時，建立TranslationAdaptationPlan，保留原版、對照、理由及後續確認。

可安排來源與權利確認、翻譯／調和、獨立檢查或回譯、專家及目標對象理解檢查、文化修訂、施測說明、計分與文件化。具體流程依工具、目標及適用準則決定，不硬性規定所有研究都要兩次正譯＋一次回譯。ITC準則涵蓋前提、開發、確認、施測、計分解釋與文件化，不是只確認字面語言。[S3]

每一題／指示保存 source item ID、source revision、target text、語言、文化修改、response option與量尺改變、reviewer role、decision及status。題目、反應錨點、回憶期間、時態及構念改動都要可辨識。

DeepL或其他現有語言adapter可以產生建議，但必須先滿足內容使用與外部處理授權。不可新買服務、重建整套潤稿引擎或假設所有付費產品都有相同端點。兩次模型輸出不算兩位獨立專家；回譯相似不代表量尺已被驗證。

本輪只準備認知訪談／目標對象測試與測量品質評估需求；真實人體認知訪談留到適用授權下的下一階段。狀態可為DRAFT_FOR_REVIEW、READY_FOR_COGNITIVE_TESTING、VALIDATION_PENDING，不預填VALIDATED。

不要以「尚未完成Pilot才有的驗證」阻擋進入Pilot規劃，形成循環；反之，可能影響理解與安全的已知問題要先處理才能實際使用。

## 11. 原創問卷、知識測驗、技能與作品評量

沒有適合既有工具時允許開發，不將新工具預設判為不合格，也不直接宣稱有效。

### 問卷／知識測驗

先建立構念／內容領域／學習目標與題目藍圖，題項可連RQ、domain、cognitive demand、source rationale及預期評分方式。原創草稿標為 `NEWLY_DEVELOPED_DRAFT`。

功能包括題目編輯、題型、反應選項、分支條件、題序、可理解性與雙重問題檢查、答案鍵（若適用）、解析、版本與待測試狀態。AI可起草原創題目及答案候選，需標來源與內容核對狀態，不能仿稱既有量表原題。

知識測驗需保留Table of Specifications與內容覆蓋；難度、鑑別度、信度或內容效度數值只有真實評估才能填入。目前為NOT_YET_TESTED或source-reported，不生成假專家評分。

反向題不是所有問卷必備，不為形式而強加。敏感題不能一律必答；跳題、拒答、缺失、未呈現與技術失敗需区分。

### 技能／行為／作品評量

建立task、可觀察行為、criteria、具體評分錨點、score levels、評分者角色、訓練、盲化及爭議裁決規劃。不要只寫「好／普通／不好」。

評分者一致性、測驗難度、信效度等為後續驗證需求。若使用AI評分，另保存human review、錯誤風險與替代處理，不把模型評分當成已建立的標準答案。

## 12. 質性、技術、感測與二手資料工具

依study component動態顯示，至少具備可編輯、可保存、可匯出的結構化規格；不在本輪要求完整設備控制或模型訓練平台。

| 類型 | 需要建立的規格 |
|---|---|
| 訪談／觀察 | RQ與目的、主問題與probe、順序、敏感性、訪談者角色、紀錄方式、去識別化、reflexivity需求 |
| 系統Log／行為任務 | event定義、trigger、time reference、actor code、payload schema、單位、有效範圍、缺失理由、對應RQ／analysis variable |
| 眼動／生理／動作感測 | 已確認或候選設備、訊號、取樣與單位、校正、同步、基線、雜訊風險、品質規劃、人體負擔與資料權限 |
| 環境／能源／製程 | 測量對象、單位、設備與校正依據、時間／地點代碼、條件、採樣或實體樣本交接規格、量測限制 |
| 二手資料／文件分析 | 來源、版本、使用範圍、抽取欄位、資料定義、授權、linkage需求與不適用的新量測說明 |
| AI／技術評估 | 任務與label定義、標註規則、歧義裁決、baseline、metric定義、資料切分與洩漏防範、模型／prompt版本、失敗分類、human oversight |

設備型號、sampling rate、時延、準確率、可靠性不能由AI猜測。未知參數可提出「候選設定」及需查證來源，不能當成實際配置或測試結果。

AI／感測輸出不是某心理構念的直接真值；保留解釋限制與映射依據。技術規格更新不得靜默改變已核准的比較條件；自適應介入需將可變範圍與決策規則本身版本化。

本輪不取得真實访談，不生成逐字稿或研究主題，不接通正式感測錄製，也不訓練／測試真實模型效能。

## 13. 教學／實驗材料、比較條件與介入忠實度

從既有InterventionRequirement、ComparatorRequirement及第八階段課程矩陣建立材料版本，不另造研究設計。

保存：目的與機制、材料／來源／權利、活動、提供者角色、場地或平台、次數與時長、允許調整範圍、回饋、participant task、設備需求、介入忠實度計畫、已知風險及替代策略。

TIDieR可用於提醒描述介入及比較條件的材料、程序、提供者、方式、時間／劑量、調整與忠實度；仍以研究適用性為準，不將其當成所有計畫的強制法律條款。計畫中的執行方式與未來實際執行紀錄必須分開。[S4]

比較條件可為現行教學、主動對照、自然群組、交叉順序、技術baseline或不適用；不是所有研究必須有RCT控制組。若希望估計特定介入差異，但組間時間、教師、關注程度或設備等同時不同，建立設計風險與回第七階段的ChangeProposal，不能用文字假裝已消除混淆。

教學實踐另連結課程週次、課程目標、學習成果、Rubric、任務、非研究學生的學習安排與成績資料權限。只設計學生權益保護與適用流程，不在本輪收集學生身分或研究參與名單。

安全風險與權力關係對策依第九階段判斷；不將所有建議措施一律寫成法律必備，也不因自動填寫對策就聲稱已執行。

## 14. Schedule of Activities：活動、測量與研究時點一致

建立或擴充活動時程：

```text
activity_id / revision / study_component_ref / purpose / protocol_section_ref
arm_or_comparator_ref / population_or_unit_ref / time_point_ref
relative_timing / visit_window / prerequisites / assigned_role
instrument_use_version / material_version / expected_data_field_refs
estimated_burden / burden_basis / ethics_scope_ref / completion_rule
skip_or_branch_rule / applicable_status / validation_task_ref
```

可顯示「篩選／說明與同意／基線／介入／後測／追蹤／訪談／結束」，但只在適用元件使用；既有資料研究可用「取得／授權核對／抽取／版本固定」，不強制虛構訪視。

時點沿用上游ID，不固定每案30日、90日或三年。T0、T1是顯示名稱，需有真實相對時間意義及計畫窗口。實際日期未知時不產生假排程。

檢查：主要結果是否安排、保留／遷移問題是否有適當評量時點、不同組／場域的可比性、資料觸發先後、活動相依是否有循環、預估負擔是否有來源。未來實際耗時留空，不用規劃估算冒充實測。

本輪只保存排程規格與預覽，不發送招募／提醒、不建立真實participant session。

## 15. ScoringSpecification與可執行的沙盒計分預覽

**本輪必須實作真正可測的計分規格預覽，而不只生成公式文字。** 優先重用现有運算元件；不具備的計分方法明示 `UNSUPPORTED_SCORING_METHOD`，不能假裝成功。

每份規格保存：來源與版本、item ID、response domain、有效範圍、missing code及原因、反向題、subscale、加權或總分、有效作答條件、缺項規則、分數方向、單位、轉換、cut-off（有適用來源才可使用）、顯示精度及限制。

支援最低可用能力：明確輸入型別／範圍驗證、enum mapping、反向轉碼、數值加總／平均、規定的weighted aggregation、Rubric加總、明確缺項規則及有依據的簡單轉換。缺規格時回傳待補，不自行設平均補值、cut-off或四捨五入策略。

安全與順序：

1. 先按來源判斷缺失／跳題／無效值，不能把99之類missing code拿去反向計分。
2. 只有確定適用且合法數值範圍的反向規則，才使用 `lower + upper - x`；不對文字類別或未知域硬套公式。
3. 原始測試輸入保留，轉碼輸出另存；記錄input stage與rule revision，避免反向題被計算兩次。
4. 分支未顯示的題目，不當成一般未作答；分支規則需無循環且預覽可重現。
5. 全部缺失、低於來源的有效作答條件、未知選項及越界值，回傳具理由的null／query，不默認0或成功得分。
6. 計算精度与显示精度分開；計畫數值不轉成受試者結果。
7. 使用白名單規則DSL／受限expression evaluator，不以任意 `eval` 執行AI或使用者輸入程式。

預覽使用 `SYNTHETIC_INSTRUMENT_TEST`，隔離於正式資料、Pilot資料與ResultFact registry之外，不計入任何N、Cronbach alpha、CVI或Outcome。可做規則測試，不是信效度實證驗證。

建置驗收用原創示意fixture（不是任何既有量表的完整題項）：

- 三個1–5數值測試欄，第二欄反向，輸入 `[1, 2, 5]` → 轉碼 `[1, 4, 5]` → sum `10`、mean `10/3`；保留來源標籤 `TEST_FIXTURE_ONLY`。
- 第二欄99且規格將99定義missing：先轉missing，禁止產生 `6-99=-93`。
- 缺項未達作答條件時回傳null與原因，不自動改分母或填0。
- 重複請求、重用已轉碼輸出、不同rule revision、全部missing及惡意公式，都須有測試。

此處數字只驗證程式機制，不是建議採用的科學工具、有效作答門檻或研究資料。

## 16. Data Capture Schema與方法—分析追溯

沿用第七階段data requirement與既有DataDictionary，建立本輪可供預試驗證的schema版本：

```text
field_id / stable_variable_code / revision / label / component_ref
source_instrument_version / item_event_or_task_id / construct_ref / rq_refs
observation_unit / data_type / unit / response_domain / valid_range
missing_reason_enum / branch_rule / time_point_ref / arm_ref
scoring_output_ref / planned_analysis_ref / origin_state
identifier_class / sensitivity_class / permitted_processor_refs
storage_zone / data_management_plan_ref / retention_rule_ref
```

欄位代碼穩定，改名稱只改label；改科學意義則新revision／mapping，不能讓舊資料同名異義。

直接識別、重新識別對照、研究代碼與分析資料分層規劃。去識別化不是任意把所有資訊刪掉；需要的linkage鍵由權限與DMP限制。法律／機構政策所要求的合法更正、刪除及保存限制不得被「永久不可變」口號取代；本輪不處理真實資料刪除。

同名不同單位、重複欄位、缺analysis variable、未知missing規則、不可達分支、PII進一般分析欄位，提出具體Issue。對Sensor／Log保留單位、timestamp來源與時區規則，不能只靠日期文字拼接。

輸出DataDictionary Draft與Source-to-Analysis Mapping，不執行正式清理、插補或特徵工程。最終資料治理與Analysis Dataset留後續階段。

## 17. Study Protocol組裝器：以版本化紀錄組裝，不从零猜一份

建立 **Study Protocol — Instrument Planning Baseline**，首次可顯示v1.0；若專案已有Protocol，採既有version lineage追加版本，不能強制覆蓋成v1或v2。

核心內容按適用性組裝：

- 文件識別、研究目標、研究狀態、版本與來源。
- 背景／問題／RQ／假設或命題，以及已採用的設計參考。
- 對象或研究單位、場域與納排規劃、招募及同意需求（適用時）。
- 群組、比較、分配／盲化的上游計畫，不在本輪真的分組。
- 介入、材料、執行角色、時程、主要／次要／過程量測。
- 工具、語言、版本、授權、調適、施測與計分說明。
- 資料欄位、Log／Sensor／AI規格、檔案與版本命名。
- 引用樣本規劃與分析計畫，不擅自更換N、主模型或排除規則。
- 資料管理、敏感資料處理、風險、退出、偏差及安全處置規劃。
- 倫理判斷、待補授權、預註冊狀態、機構文件與version coverage。
- 工作角色、必要訓練、需要的預試與驗證任务、附錄與來源。

以source-linked Sections實作，保存可編輯敘述與結構化參考；允許章節重組，但核心來源事實受保護。畫面、匯出與交接使用同一版本，不形成另一份隨意生成的Protocol。

適用隨機試驗時可對應SPIRIT 2025的方案報告項目；CONSORT是試驗結果報告方向，不能把它當作所有Protocol的統一必填表。質性、技術、教育或二手資料使用相應項目與明確不適用理由。[S8]

方法草稿使用planned／proposed等真實時間狀態；已有研究文件整理使用實際紀錄，不事後補寫未執行的方法。Protocol完整不代表已獲IRB核准、已完成預註冊或已可正式研究。

## 18. 三重一致性檢查與正確回送

重用版本化AlignmentRule／Report，規則判斷與AI意見分開，每项有rule version、source、locator、severity、certainty及due／blocking action。

### A. Research & Analysis Alignment

```text
RQ → Construct／Outcome → Requirement → Instrument／Task
→ Time Point → Data Field → Scoring／Derivation → Planned Analysis
```

檢查主要Outcome未量測、構念與工具定義不一致、追蹤問題缺timepoint、缺分析欄位、改變計分導致尺度或意義改變、在沒有新證據下只用滿意度代替學習成果。

### B. Protocol & Ethics Alignment

核對對象、活動、敏感問題、錄音錄影、Sensor、第三方AI／雲端、傳輸位置、酬勞、退出、保存及分享，與第九階段DMP／同意規劃／institutional decision範圍是否一致。

正式文件若已存在，改版可能需 `ETHICS_AMENDMENT_REVIEW_REQUIRED`；只是草稿未送審則標 `ETHICS_DRAFT_UPDATE_REQUIRED`，不虛構已需或已取得正式修正核准。保留authority decision原始status，另更新本版本的coverage，不能替機構取消或重新核准。

### C. Rights, Translation & Content Alignment

檢查所用版本、語言、授權動作、response anchor、回憶時段、反向題、答案鍵、計分與條件分支的一致性；標出已知歧義及需後續验证。

需要改變核心RQ、主要Outcome、設計或分析時建立ChangeProposal，回第六／七階段，不直接為了合規改字掩蓋問題。權利內容問題回本輪Rights；來源缺失回Evidence中心；規則／倫理問題回第九階段；預算變動回第八階段。

已識別的限制可有正式處置與下一步，不以AI評分自動忽略。法定／權利／安全必要条件不能用ACCEPTED_RISK任意豁免。

## 19. 全項老麥Assist與跨區塊自動協作

每個欄位、工具卡、題項、Rubric、活動、計分規則與Protocol章節都接入既有Assist，不新建平行Agent框架。

| 欄位類型 | 老麥允許動作 |
|---|---|
| 工具選用理由、原創材料、程序草稿 | 根據SourcePack解說、提出候選、起草、補全、優化與一致性檢查 |
| 文獻與量表作者、版本、來源信效度 | 從來源抽取／核對，未知不補造 |
| 計分、單位與規劃數值 | 使用真實來源規格或受限計算服務；AI解釋但不自由改算 |
| 受限題項／答案／手冊 | 先查內容與動作權限；未許可只協助metadata、需求與取得途徑 |
| 人員、設備、課程、許可與機構核准 | 真實資料帶入／查證／人工確認導航 |
| 已核准、鎖定或正式as-run內容 | 解說與新候選修訂，不原地覆寫 |

支援 `FILL_EMPTY`、`IMPROVE_UNLOCKED`、`FILL_AND_LOCK`。一次授權scope／budget後，允許普通工作連續執行，不逐段彈確認；永久刪除、正式部署、額外付費、對外寫入與未授權內容傳送另行授權。

階段一鍵操作：讀取需求→選擇適用工具類型→定向補證據→產生候選／原創草稿→建立計分與欄位→組裝Protocol→檢查→保存未鎖定候選／草稿→集中列真正需要使用者的資料。

模型請求使用最小SourcePack：goal、work order、已採用來源refs、允許片段、FieldPolicy、數值來源、限制、lock manifest及預算。輸出要求structured patch、target ref、base revision、source refs、uncertainty、change reason及new requirements，server再validate。

未連上Provider時可以用本地資料規劃，但不得模擬已完成線上查證。所有生成段落標來源與AI狀態；「補全並鎖定」僅鎖檢查通過的指定部分，actor為AUTOMATION_POLICY，仍不是人工核准或測量驗證。

## 20. 持久任務、後端鎖定與版本競態

沿用AgentJob、checkpoint、有限重試、取消與費用限制。task graph中有外部來源等待、rights阻擋或人工資料缺失時，保存已完成部分，不重跑其他成功步驟。

每次寫入驗證workspace、project、goal、source revision、expected revision、field policy與lock。來源、schema、權限或模型輸出未通過時，不能寫入主工作版本。

AI執行中使用者修改／鎖定／回收專案／取消任務，遲到輸出只成候選或被拒絕；不可藉整段替換、刪父區塊、重排題項、換active version或同步覆寫繞過鎖定。

最小patch保存；未載入欄位不能以null整段清空。部分成功逐項回報，不說整批成功。相同request id不同payload回CONFLICT；多分頁保存有version conflict及可看差異。

來源更新只標受影響的選用、工具、計分、Protocol或handoff為STALE，不替換已鎖定revision。checksum只證明內容身份，不代表安全／權利／科学有效。

工具鎖定、內部審閱、法律／倫理許可、施測可用性及實證品質分开記錄。不能將「鎖住了」轉成「已驗證」。OpenClaw的Session或提示詞不代替網站授權；使用網站端既有權限與動作白名單。[S11]

## 21. Gate分層：避免先要Pilot結果才能進Pilot

本輪分開管理：`module_health`、`planning_readiness`、`content_review_state`、`rights_by_action`、`external_authorization_status`、`execution_readiness`。

### 規劃完成判斷

**INSTRUMENT_PROTOCOL_PLANNING_COMPLETE**：

- 有可解析且授權的來源基線與明確研究範圍。
- 主要RQ／Outcome有已選用的工具或可執行資料取得規格，及選用依據。
- 當前需要的材料、活動、資料欄位及計分規格已定義並完成適用沙盒檢查。
- Protocol可完整閱讀，来源与假設、待驗證內容可分辨。
- 已處理本階段必須解決的重大邏輯／來源／權限問題。
- 未來才需的驗證與外部授權完整列入 due_event／blocks_actions。

**INSTRUMENT_PROTOCOL_PLANNING_PROVISIONAL**：核心方向可使用，但部分候選、參數、權利或資料待確認；有明確影響、責任與補足方式，可以條件式交給下一階段規劃，不能標成已可施測。

**PLANNING_REVISION_REQUIRED**：核心RQ無可行測量路徑、來源不可信卻聲稱確證、計分邏輯矛盾、違反當前存取權、或缺失無正式處置；允許保存與修改，但不能假完成。

**INSTRUMENT_PROTOCOL_HANDOFF_COMMITTED**：snapshot、source manifest、readiness、待辦與outbox已原子保存。這是技術交接完成，不表示每項驗證結果都是PASS。

### 執行預檢（本輪僅顯示，不授權啟動）

產生preview：PLANNING_ONLY、ELIGIBILITY_REVIEW_PENDING、BLOCKED_FOR_SPECIFIC_ACTION、NO_KNOWN_BLOCKER_PENDING_FINAL_CHECK。即使無已知阻擋，本輪也不自行啟動人體認知訪談、Pilot或正式研究。

不可要求：工具已在本樣本通過信效度、認知訪談已完成、全部Pilot成功、所有來源全文、每篇Zotero同步、每個選填欄位、全部外部API、未來研究Results先完成。對新工具，後續驗證正是下一階段任務。

倫理核准、場域、工具施測許可與計畫啟動依實際活動判定。沒有補助不自動等於不得進行合法自籌研究；有計畫核定也不等於人體活動已獲倫理授權。

第九階段機構自述紀錄可供規劃，但不得在無相符證據時自動授予執行權；需要後續權限角色按制度確認文件範圍、版本與有效性。

## 22. 缺失與精確導航

每個Issue包含：code、source、reason、impacted action、severity、certainty、owner、due_phase／due_event、blocks_actions、allowed deferral、proposed remedy、assist actions、source version與locator。

精確定位：`project + work_order + study_component + instrument/use/version + tab + section + field/item/event`，可跨回倫理中心、分析規劃、文獻中心或計畫書工作室，並保留return context。

例子：

| 問題 | 本階段顯示與處理 |
|---|---|
| 工具尚無已核對的來源 | 建EvidenceNeed，前往文獻中心；AI可查證，不能編造作者或原題 |
| 施測授權仍待確認 | 規劃可保留；施測／受限匯出列阻擋，直達Rights欄位 |
| 來源規定缺項處理不明 | 計分預覽不自設規則，直達ScoringSpecification及原手冊位置 |
| 新增感測資料超出同意內容 | 回第九階段更新草稿或評估amendment，不自行標倫理通過 |
| 新量表需認知訪談 | 列下一階段驗證任務，不要求本輪先有訪談結果 |
| 長期保留RQ只有立即測驗 | 指向活動時點與第七階段設計，提出修訂候選 |

補完提供 **「保存並返回工具與Protocol」**。server重驗後才解除Issue；點過導航、AI回覆完成或使用者任意勾選不算已解決。

不適用需有根據，選填不阻擋，UNKNOWN不能自動變FAIL／PASS；重大法定、安全或權利條件不能靠改due_phase消失。

## 23. 首頁流程亮燈與醒目下一步

沿用全站StageRegistry／Readiness，不手寫第二套進度。

```text
三路線工作室 → 路線審查／合規／倫理 → 工具、量表與Protocol
→ Pilot／工具預試與Protocol驗證
```

綠色勾選＝本次工具與程序規劃基線完成；黃色勾選＝條件式規劃已保存；藍色＝進行中；黃色提示＝待補或來源需重验；紅色警示＝該動作受阻。全部有文字與圖示。另顯示「預試執行權限未授予／待確認」，不與規劃燈號混用。

| 狀態 | StageActionBar |
|---|---|
| 當前必要規劃完成 | **完成工具與Protocol，前進「Pilot／工具預試與Protocol驗證」→** |
| 條件式規劃可交接 | **保存條件式規劃並前進「Pilot規劃」→** |
| 有當前必補缺失 | **尚缺N項，前往補足**＋**老麥一鍵補全** |
| 有本地未保存修改 | **儲存並檢查下一步** |
| 老麥處理中 | **查看老麥處理進度** |
| 上游需改變 | **查看問題，返回研究設計／倫理準備→** |
| 下一模組尚未建置 | **保存交接並查看Pilot準備** |

進度以適用必要任務計算，有明確分母與狀態；不因開頁、寫滿欄位、鎖定、測試部署或AI自評完成亮綠燈。

只計本次工作範圍；計畫書所需工具附件完成，不宣称期刊研究或正式資料完成。已完成版本保留，來源新改動顯示當前基線需重驗，不抹去歷史。

## 24. 第十一階段交接契約與原子保存

新增不可變 **InstrumentProtocolSnapshot**，StageRegistry next為新版第十一階段「Pilot／工具預試與 Protocol 驗證」。不能接入舊版第十一階段資料治理。

實作必須交付真實JSON Schema、專案型別、required／nullable定義、ref verifier與consumer tests；以下是語義契約，不要求照清單一項建一張資料表：

```text
snapshot_id / schema_version / workspace_id / project_id / work_order_id / stage_id
source_stage09_snapshot_id / source_route_workspace_snapshot_id
source_design_snapshot_id / source_theory_snapshot_id / source_gap_snapshot_id
source_blueprint_snapshot_id / source_navigation_snapshot_id / source_topic_snapshot_id
goal_context_revision / primary_goal / funding_intent / publication_intent
work_purpose / required_component_scope / research_stage / temporal_status
adopted_rq_refs / statement_refs / construct_versions / study_component_versions
selected_design_versions / analysis_plan_versions / planning_fact_bindings
measurement_requirement_versions / measurement_requirement_map_ref
instrument_definition_refs / instrument_version_refs / project_instrument_use_versions
candidate_comparison_refs / selection_decision_refs / rejected_candidate_refs
rights_decision_refs / permission_refs / permission_scope_manifest
translation_adaptation_plan_refs / item_mapping_refs / validation_requirement_refs
questionnaire_test_blueprint_refs / rubric_refs / qualitative_guide_refs
sensor_spec_versions / event_dictionary_versions / technical_evaluation_spec_refs
intervention_material_versions / comparator_versions / fidelity_plan_ref
schedule_version / data_capture_schema_version / data_dictionary_draft_ref
scoring_spec_versions / sandbox_test_manifest_ref / scoring_capability_limitations
protocol_id / protocol_revision / protocol_section_manifest / document_temporal_status
reporting_profile_ref / reporting_applicability_map
ethics_scope_ref / institutional_decision_refs / institutional_verification_levels
ethics_version_coverage_ref / ethics_change_proposal_refs / data_management_plan_ref
preregistration_plan_ref / preregistration_change_requirements
review_finding_refs / revision_task_refs / resolved_requirement_refs
open_issue_refs / later_stage_requirement_refs / due_events / blocks_actions
literature_ids / publication_version_refs / study_family_refs / evidence_ids
citation_source_ids / zotero_bindings / reading_coverage_refs
source_manifest / source_access_constraints / lock_manifest
alignment_report_refs / planning_decision / decision_origin / review_state
readiness_snapshot_ref / completion_basis / execution_restrictions
pilot_validation_needs / pilot_applicability_hints / pilot_authorization_gaps
methods_evidence_map_ref / export_manifest_ref / next_stage_id / next_actions
created_at / checksum
```

共用上下文required。研究類型不適用之refs允許null並附reason；缺來源未知保留issue；不能把未知變空陣列假裝已完成。巢狀ref保存revision與ACL，不夾帶未授權附件或完整題項。

本轮Methods Evidence Map可供後續寫作引用「計画採用什麼與為什麼」，但實際施測方法必須等as-run紀錄，不能把Protocol草稿作為已執行事實。

完成採後端短transaction：驗權、source/revision/lock重驗→保存readiness／planning baseline／snapshot→append transition與outbox。外部API不放入transaction；consumer按snapshot_id冪等；相同idempotency key不同payload回CONFLICT。

若保存成功但導航失敗，可重新開啟同一交接，不重新生成、不重新收費、不重建Project。第十一階段已有則adapter接收；尚未建置則提供真實receiver，顯示工具、Protocol、缺失、授權狀態與待驗證任務，不跳空白頁或假裝已完成Pilot。

下一階段可初始化Pilot規劃，不得僅憑本輪快照自動啟動人體活动。啟動前重新核對當時版本、權利、倫理與適用執行条件。

## 25. 真正可用的預覽、匯出與写作資料包

不能只交空頁、假按鈕、生成大綱或無實作的API。至少完成：

- 全文閱讀工具與Protocol規劃、逐區編輯、保存、刷新恢復、版本比較。
- 可操作的題目／Rubric／活動編輯及帶明顯沙盒標示的施測介面預覽。
- 計分預覽由受限引擎執行，含測試輸入與失敗原因。
- 工具需求表、活動時程、資料字典、計分規格及Protocol可匯出。
- 來源與引用、權利限制、待驗證事項、版本manifest可讀且可供下游消費。

优先重用既有匯出引擎。最低要有可下載的UTF-8 Markdown／HTML閱讀版及JSON規格包；已有DOCX／PDF／LaTeX匯出就接入並實測，不為本輪另建完整排版系統或只改副檔名假裝支援。

`Instrument & Protocol Preparation Package`包含：需求對照、選用理由、允許匯出的材料、調適與權利摘要、活動表、DataDictionary、ScoringSpec、沙盒測試報告、Protocol、引用清單、alignment、待辦、source與file manifest。

匯出時再次檢查權限、source freshness、item exposure及用途；不得把私有授權文件、測驗答案、受限完整量表或個资自動放入公開附錄。受限內容可用安全參照／佔位說明，並明確列出未包含之項目；不宣稱是可直接施測的完整公開工具包。

同一metadata與References由CitationSource生成，不能將Zotero item key直接當完整學術引用，也不能為補格式編作者、DOI或頁碼。[S5]

下載檔案保存版本、checksum、mime type、建立時間及對應snapshot，測試真正可開啟與文字／數值／引用一致；外部URL或舊下載快取不能繞過當前存取限制。

## 26. 實作結構、API與權限

優先重用 typed artifacts、既有JSONB／關聯表及索引，不為每個邏輯物件強制新增一張表。建議邏輯群：

| 群組 | 可新增或擴充的資料 |
|---|---|
| Workbench | InstrumentProtocolWorkspace、WorkOrder、RequirementMap、SelectionDecision |
| Instruments | InstrumentDefinition／Version、ProjectInstrumentUse、Item／Task／Rubric／Guide references |
| Rights與調適 | RightsDecision、PermissionRecord、TranslationAdaptationPlan、ValidationNeed |
| Procedure | MaterialVersion、ComparatorSpec、FidelityPlan、ActivitySchedule、TechnicalMeasurementSpec |
| Data與計分 | DataCaptureSchema、ScoringSpecification、ScoringPreviewRun、SyntheticFixtureManifest |
| Protocol | ProtocolDraft／Version、ProtocolSection、SourceBinding、MethodsEvidenceMap |
| Quality與交接 | AlignmentReport、RequirementIssue、ChangeProposal、Readiness、InstrumentProtocolSnapshot、Outbox |

下列是能力契約，路由名稱配合現有框架：

- intake／resume：驗證並冪等接收Stage09 snapshot。
- get workspace／entities：最小必要讀取、role-based redaction。
- patch entity：expected revision＋field policy＋lock＋source revision。
- assistance jobs：estimate／start／status／cancel，允許scope與預算。
- evidence task：對應原文獻中心與精確return context。
- rights／adaptation：保存來源或人工真實決策，不給AI寫官方核准欄位。
- scoring preview：受限輸入、DSL與沙盒環境，不可任意執行程式。
- protocol assembly／validation：結構化来源組裝与检查。
- completion／handoff：短transaction、冪等與outbox。
- export：snapshot、用途權利与metadata校驗。

安全要求：server端每次驗workspace／project及巢狀資產，不能信任前端傳入owner或session。Secret不進前端、原始log或版本庫；資料與工具授權不相同，兩層都驗。

解析上傳文件或外部來源時，內容是資料不是指令；防止惡意HTML／腳本／提示詞注入、SSRF內網URL、任意路徑與非白名單運算。大檔案及附件有大小／MIME／解析限制、權限與失敗狀態。不得將規劃文字當成shell或SQL。

無需從網站聊天繼承OpenClaw建站代理的主機管理、資料庫管理與部署權。既有使用者信任邊界與工具控制需維持。[S11]

## 27. 四個實作批次與範圍控制

### Batch A：相容接收與資料結構

盤點與保護現況；接收Stage09＋U07／U08來源；升級第十階段接收頁；確認三Goal、研究元件、條件式入口與未解Issue；建立或重用registry、版本與权限。

### Batch B：工具、材料與可執行規格

需求圖、真實候選比較、原創工具編輯、Rights／Translation記錄、介入／比較／活動、DataCapture、受限計分引擎與沙盒fixture、Protocol全文預覽與實際匯出。質性／技術元件至少具備型別化編輯與驗證，不在本輪擴建完整平台。

### Batch C：智慧協作與無斷層交接

全項Assist覆蓋、SourcePack、版本／Lock競態、Evidence往返、三重alignment、精確缺失導航、readiness與首頁燈號；InstrumentProtocolSnapshot、完成transaction及新版第十一階段receiver。

### Batch D：回歸、權限、重啟恢復與交付

三Goal端到端、研究類型適配、48項適用驗收、冪等／取消／來源過期／未知授權、匯出核對、feature flag、migration安全、回復演練與交接文件。

只分批實作本輪。不要一次改掉所有舊階段，也不要只寫報告而放棄可完成的本地功能；外部缺憑證項目清楚列BLOCKED，其餘必須測試。

## 28. 驗收案例：48項

每項記錄測試環境、fixture或live來源、命令／步驟、預期、實際、檔案或截圖證據（適用時）及狀態。PASS／FAIL／NOT_RUN／BLOCKED與LIVE／MOCK／FIXTURE／SYNTHETIC_INSTRUMENT_TEST分開。UI快照測試不等於外部API live串接成功。

### A. 交接、目標與研究狀態

- **T01** 有效Stage09HandoffSnapshot開啟同一Project，RQ、已採用設計、審查與倫理待辦完整繼承，不重填。
- **T02** 「第九階段程式建置完成」不自動使任意Project通過審查、倫理或Pilot執行Gate。
- **T03** 跨project／workspace、未授權巢狀來源、未知schema及不相容ref安全拒絕並提供正確錯誤，不能回退其他Project資料。
- **T04** 重複初始化、刷新、斷線再進入仍為同一工作區，不重複建立工具或付費任務。
- **T05** adapter保留舊blocks_action、nullable來源、Goal及institutional self-attestation資訊，不擅自升級PASS。
- **T06** 三Goal從UI、DB、validator、API、job、prompt、cache到snapshot一致；MOE_TPR不回退為期刊。
- **T07** 同Project主要計畫與次要期刊共用工具reference但不同文件／進度不互相覆蓋。
- **T08** 既有研究文件整理不回填為事前Protocol；沒有IRB核准仍可合法草稿規劃，但沒有取得人體執行權。

### B. 需求、來源、證據與工具身份

- **T09** 主要RQ缺工具或資料取得路徑會產生精確缺失與navigation，不能靠填任意文字解除。
- **T10** 質性、技術、環境或二手資料元件不強制心理量表、RCT群組或一般問卷信度。
- **T11** 同一授權workspace中標準工具可被多Project引用，私有材料／權利／註記仍隔離；原版、短版與改編不盲目合併。
- **T12** 一篇文章描述多個工具或同篇由多API取得，不把DOI誤當單一工具鍵，不重複計算研究支持。
- **T13** Consensus等現有API可在授權scope執行定向任務；失敗／無憑證不回傳假候選或假全文。
- **T14** Abstract Reviewed、Full Text Available、AI Processed及Human Reviewed分開；來源未報告之性質為未知，不填0。
- **T15** 他人樣本的信度／效度不成為本研究結果，單一alpha高不自動認證工具完整有效。
- **T16** Zotero library＋item＋version對應正確；斷線不刪合法本地引用，遠端更新不覆蓋已鎖定判讀，寫入不擴權。

### C. 權利、調適與原創工具

- **T17** 未確認的受限完整題項不能被未授權顯示、索引、Provider傳送或公開匯出；metadata及取得需求仍可規劃。
- **T18** 正確作用域的許可允許指定操作，超出語言／用途／期限仍阻擋；使用者上傳不等於對全站公開授權。
- **T19** 調適流程保留原版、item mapping、選項與回憶期間改動；現有DeepL等可給草稿但不標Validated Translation。
- **T20** 沒有真實專家或目標對象評估時，不生成CVI／理解度；把認知訪談留成後續任務，不產生先有Pilot結果才能規劃Pilot的循環。
- **T21** 原創問卷／測驗可以編輯並留來源理由與NEWLY_DEVELOPED標示，答案鍵不洩漏到學生預覽。
- **T22** 不適用反向題不強加；敏感題不全設必答，跳題／拒答／未作答的狀態可區分。
- **T23** Rubric有可觀察criteria與錨點，評分者一致性仍是計畫；質性大綱不生成虛假逐字稿或主題。
- **T24** 翻譯、權利或工具未知狀態不能用高內部Fit分數抵銷，也不把UNKNOWN直接判不合格。

### D. 材料、計分與資料規格

- **T25** Sensor與設備未知參數保留候選／待查；不偽造校正、採樣率實測或訊號品質。
- **T26** 教學介入、學習成果、評量與課程週次可連結；只測滿意度不能自動回答技能提升RQ。
- **T27** 實驗／比較條件及忠實度記錄為planned，不填actual；已知混淆風險可回第七階段修訂。
- **T28** 上游保留／追蹤RQ缺對應timepoint會提示；活動順序與分支循環可被檢查，不硬套30／90日。
- **T29** 原創scoring fixture `[1,2,5]`第二欄反向得到`[1,4,5]`、sum10；由程式計算並標SYNTHETIC_INSTRUMENT_TEST，不寫ResultFact。
- **T30** 99 missing先解碼；全部missing、越界、未知類別、不足作答、重複反向與rule revision變更都有可預測處置，不能偷偷填0／均值。
- **T31** DSL拒絕任意程式、檔案／網路存取與循環公式；不支援方法明示UNSUPPORTED，不假算。
- **T32** DataCapture欄位與分析要求對應，PII隔離、單位、timestamp及AI切分限制保留；不在本輪生成真實研究資料。

### E. Protocol、倫理、Assist與回寫

- **T33** Protocol引用實際已採用source versions，規劃方法不改成已執行；as-run整理維持實際時間標示。
- **T34** SPIRIT適用性依研究類型，不強迫質性／技術研究填RCT表；完整報告項目不冒充倫理核准。
- **T35** 新增Sensor、敏感資料、AI處理或錄影時觸發正確draft update／amendment review，不改寫機構原始決定。
- **T36** 自述倫理／授權未被升級為官方驗證；真實文件只覆蓋相符版本、範圍與動作。
- **T37** 改Primary Outcome、核心方法、計分意義或工作包／預算時用ChangeProposal回上游，不原地覆寫。
- **T38** 每欄、題項、矩陣列、工具與Protocol章節可使用適當Assist；真實數值／官方欄位不由模型自由生成。
- **T39** FILL_EMPTY不覆蓋既有內容，IMPROVE_UNLOCKED遵守鎖，FILL_AND_LOCK記automation草稿，不冒充人工核准；整段替換／刪父節點／切版本也不得繞過。
- **T40** AI執行中修改、鎖定、取消或回收Project，遲到輸出不覆蓋；重試不重複寫入或無上限付費。

### F. 導航、Gate、交接與回歸

- **T41** 題項、權利附件、來源片段、export及download URL按巢狀ACL隔離；惡意外部內容不改系統指令、執行shell或存取內網。
- **T42** Issue連結直達正確Project／instrument／tab／field，修改後可保存返回，後端重驗才解除。
- **T43** 首頁顏色／文字／圖示與StageActionBar反映真實規劃状态；手機／鍵盤可操作且固定列不遮住輸入與刪除區。
- **T44** 晚期認知訪談、信效度、IRB與執行授權不誤阻擋普通規劃；對受限題項公開／人體使用的真正前置條件仍阻擋。
- **T45** 重複完成只建立一次baseline／snapshot／outbox；保存成功跳轉失敗可重開，不重新跑AI。
- **T46** InstrumentProtocolSnapshot具有效JSON Schema、版本refs、權利與晚期待辦；三Goal、條件式、新schema不支援及第十一階段接收fixture測試通過。
- **T47** 刷新／重啟保留工作與任務；LIVE、MOCK、NOT_RUN、BLOCKED明確區分，樣本／Pilot／正式資料未被fixture污染。
- **T48** 真實匯出可開啟、引用與計分／Protocol版本一致且受限內容未洩漏；原資料完整，migration及回復演練在隔離環境通過。

## 29. 完成回報、停止點與下一階段

交付：

1. 問題盤點、已修復／重用／新增的功能與檔案清單。
2. Schema／migration、API、Project／Goal資料流與權限設計。
3. Stage09 consumer adapter及契約測試，未知來源與條件式入口的處置。
4. 工具需求、候選、來源品質、權利、調適、原創工具與技術規格的可用操作。
5. 計分引擎支援矩陣、真实測試輸入輸出、不支援與限制，不以AI回覆冒充程式測試。
6. 介入、Schedule、DataCapture、Protocol組裝與三重alignment。
7. Assist／Lock覆蓋報告，哪些可自動補、需來源、需人工或受限。
8. Consensus及其他API、Zotero的LIVE／MOCK／BLOCKED狀態與已驗證scope；不輸出憑證。
9. 實際匯出、source/file manifest、Methods Evidence Map。
10. 四批與48項驗收的真實結果、未測與未完成項目。
11. InstrumentProtocolSnapshot機器schema、fixtures、新版第十一階段consumer contract與可重開receiver。
12. 部署所在環境、feature flag、备份、rollback與已知風險。

更新 `PROJECT_STATE.md`：完成的是新版V3-U10網站模組，列出實際功能、研究狀態是否有變動、snapshot schema version、操作入口、下一阶段需要的資料及未完成能力。不把建站驗收寫成研究預試完成。

**完成後停止，不自行開始新版第十一階段。** 下一階段是「Pilot／工具預試與 Protocol 驗證」；本輪只交接其計畫資料與待驗證需求，不啟動人體活動、正式資料蒐集或統計Execution。

### 建議人工操作驗收路徑

用MOE_TPR專案從第九階段進入：繼承研究設計與倫理待辦→老麥建立工具需求→比較既有測量方式與原創技能評量→來源缺失直達文獻中心補足→權利未明者保留metadata與待辦、不公開題項→保存計分規格並跑沙盒preview→安排課程活動／評量時點→鎖定已確認內容→組裝可閱讀與匯出的Protocol→指出需更新的同意／資料管理草稿→返回修改并保存→產生規劃或條件式基線→首頁更新燈號→帶完整來源與執行限制進入Pilot接收頁。

再以技術或二手資料元件驗收，不被強迫使用問卷／心理量表，也不把規格測試當成真實實驗。

---

## 附錄：方法與整合依據

以下於2026-09-06查閱。它們用來支持設計方向與整合契約，不代表自動取得量表授權、特定計畫年度格式或個別機構倫理決定；實作時仍核對實際版本、適用性與帳號權限。除必要的科學主張外，本文件其餘工程規則為本網站產品設計要求。

- **[S1] COSMIN — About COSMIN.** 工具選擇的構念、負擔與測量品質面向；不把特定領域適用性無限擴大。 https://www.cosmin.nl/about/
- **[S2] COSMIN authors — Content validity: judging the relevance, comprehensiveness, and comprehensibility of an outcome measurement instrument – a COSMIN perspective.** Journal of Clinical Epidemiology, 2025, DOI 10.1016/j.jclinepi.2025.111879。 https://doi.org/10.1016/j.jclinepi.2025.111879
- **[S3] International Test Commission — ITC Guidelines for Translating and Adapting Tests (Second Edition).** International Journal of Testing, 2018;18(2):101–134; online 2017，DOI 10.1080/15305058.2017.1398166。資料確認、施測、計分解釋與文件化，不只是機器翻譯。 https://www.tandfonline.com/doi/full/10.1080/15305058.2017.1398166
- **[S4] Hoffmann et al. — TIDieR checklist and guide.** BMJ 2014;348:g1687，DOI 10.1136/bmj.g1687。介入與比較條件的可重現描述、計畫與實際執行之區分。 https://www.bmj.com/content/348/bmj.g1687
- **[S5] Zotero Web API v3 Basics.** library／collection／item、API版本與引用資料格式。 https://www.zotero.org/support/dev/web_api/v3/basics
- **[S6] Zotero Web API Syncing.** 來源版本、同步與衝突，不以遠端更新覆蓋已採用內容。 https://www.zotero.org/support/dev/web_api/v3/syncing
- **[S7] Consensus — Build with our API.** 沿用現有研究搜尋adapter，具體能力以帳號及live測試為準。 https://consensus.app/home/api/
- **[S8] SPIRIT–CONSORT官方網站與SPIRIT 2025.** 隨機試驗方案與結果報告之適用範圍，非所有研究強制模板。 https://www.consort-spirit.org/
- **[S9] 國科會補助專題研究計畫作業要點。** 本文件不重寫固定年度期限與附件，沿用來源快照的適用時點。 https://law.nstc.gov.tw/LawContent.aspx?id=FL026713
- **[S10] 教育部補助大專校院教學實踐研究計畫作業要點。** 課程／學生成效與適用研究倫理要求的官方來源。 https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704
- **[S11] OpenClaw Gateway Security.** 信任邊界、工具及權限控制；網站獨立授權不可用session代替。 https://docs.openclaw.ai/gateway/security
