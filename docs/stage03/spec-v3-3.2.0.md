# 老麥科研網站 V3｜第三階段開工整合修正版
## 附件需求補強 × Consensus與多源文獻API × 投稿與計畫導航
## 保留全站下一步、缺失導航、老麥一鍵補全與鎖定

規格版本：3.2.0  
任務代號：V3-U03-R1  
整理日期：2026-09-06（Asia/Taipei）  
執行對象：OpenClaw建站工程代理。這是網站程式、API、資料流程及介面任務，不是只建立人設或只生成研究內容。

> 使用者回報新版第二階段已完成，並補充附件與「Consensus及上述文獻相關服務都有API」。本輪以這些API已具備整合條件作為設計前提，優先讀取網站既有設定及文件，不再將Consensus列為未來選配。使用者回報完成不等於本文件作者已檢查網站或測試API。本文件只交付實作規格，不宣称已修改或部署網站。

## 文件使用與範圍

這是可單獨交付OpenClaw的整合文件，不需要手動拼接多份早期提示詞。

- **甲篇**：把本次附件及Consensus補充落实为前置修正，僅修補已完成第二階段的實際缺口。
- **乙篇**：保留並更新第三階段「投稿與計畫導航」完整功能。
- **丙篇**：新增API、來源、流程與附件需求的32項验收，與乙篇48項共同使用。
- **丁篇**：本次API官方查證紀錄及使用界線。

適用優先序：本文件明確修正項 > 前版第三階段重疊規則；既有專案權限、未提交修改、研究原始資料、已核准成果与來源權利不得因合併而降低保護。

不退回重建全站，不重做已正確的第二階段，不自動解鎖題目，不在本輪開始新版第四階段研究藍圖專業引擎。

---

# 甲篇｜附件與文獻API的開工前補強

## A1. 附件逐項理解與處置

本輪合併的附件為 `d37ec4b34003b3c8cf9bb2b410889e72af98f84f.webarchive`；已按其中正文識別下列需求。

| 附件要求 | 本輪最終實作 |
|---|---|
| 新增AI能源管理、環境資源管理等專業 | 更新可編輯研究Profile及檢索詞，不清除舊專長 |
| 雷達三類：熱門／前沿新穎／跨領域複合 | 三分類視圖＋多標籤，不把分類當成相同的計量分數 |
| 一鍵靈感只需方向與目標 | 方向可空白，目標預設自動；進階設定收合 |
| 預設10題、5／3／2配置、Top 3、100分 | 作為可調預設，不湊題，不以未知假分數填滿 |
| 四個結果區塊 | 老麥判斷、候選題、Top推薦、下一步 |
| 選題實驗室取消「沒有靈感」區塊 | 移除重複大型發想區，保留一個連回一鍵靈感的輕量入口 |
| 每日期刊熱門與新興方向推薦 | 站內DailyDigest與可設定排程；依專案授权与预算執行 |
| Ai4Scholar多源檢索及API | 使用既有API；子來源、原始出版來源與provider分開記錄 |
| 最新補充：Consensus也有API | Consensus為主要研究問題檢索adapter之一，完整納入測試及用量 |
| 舊稿：建立專案後直達文獻引擎 | 更正為選題快照→投稿導航→研究藍圖；文獻中心是橫向共用服務 |
| 「查看完整研究藍圖」按鈕 | 選題前改「查看研究構想詳情／藍圖預覽」，不得誤稱正式藍圖已核准 |
| 所有項目一鍵輔助、鎖定及下一步 | 全部接入既有Field／Section／StageAssist和後端StageActionBar |

本輪前置成果名稱：`PRE_NAVIGATION_EVIDENCE_AND_IDEA_FLOW_VERIFIED`。這是建站回歸验收，不是研究新穎性正式核准。

## A2. 先查真實程式，不先猜API或故障

在真實repository定位PROJECT_STATE.md，確認分支、未提交修改、前端、後端、ORM、資料庫、現有導覽與路由、workers、部署及來源設定。

盤點：

- ResearchProject、Project Context、保存讀取、軟刪除及復原。
- RadarOpportunity、InspirationRun、ResearchIdea、TopicEvaluation、TopicSelectionSnapshot。
- 文獻與證據中心、LiteratureItem、ProjectLiteratureLink、Evidence、CitationSource。
- Zotero連線、library及collection scope、同步權限与版本。
- 現有Consensus、Ai4Scholar、Semantic Scholar、Crossref、OpenAlex、PubMed、arXiv、IEEE／ACM、Scopus／Web of Science等connectors。
- 第三方聚合路徑與直連API是否同時存在、是否使用同一帳號額度。
- StageWorkspaceShell、StageReadinessService、RequirementIssuePanel、Assist、FieldPolicy、Lock、Audit與AgentJob。
- 首頁功能說明、未完成專案下拉、儲存讀取、路徑、底部刪除與每日推薦。

以「需求→既有實作→真實缺口→最小修改→測試」表開工。除破壞性修改、正式部署或新增支出需授權外，完成安全開發環境內可執行的修補，不只停留在Audit。

保留API憑證，只讀secret reference及遮罩資訊；不要求使用者在對話貼Key，不在報告寫出完整憑證。

## A3. 研究Profile：保留能源與跨領域，而非只剩AI教育

以以下六個可編輯主軸作為新發想的Profile預設：

1. AI與數位科技跨領域應用。
2. AI教育應用。
3. AI應用於職業安全與教育訓練。
4. AI應用於環境工程與環境資源管理。
5. AI應用於能源管理。
6. VR／AR／XR跨領域應用於職業安全教育訓練與教育。

將附件中重複或同義專長正規化，同時保存原文與alias。原有智慧製造、陶瓷、CNC等專長保留為可選拓展，不因這次修改刪除。

Profile包含：領域、方法經驗、可用資源、欲拓展方向、排除範圍及各項來源狀態。專長不等於已擁有設備、正式課程或可取得樣本。未提供資源時標UNKNOWN，提出選項而非編造。

新增預設只套用新run；既有鎖定專案須先顯示Profile差異，由使用者選擇是否套用，不能批次改題。

能源等子關鍵詞由老麥建議、附假設與版本。不可把「能源管理」僅當一個顯示標籤，必須傳入query、來源選擇及候選覆蓋檢查。

## A4. 雷達三分類與兩種檢視

保留「我的前沿／全球前沿」作為檢視範圍；另外增加三個研究機會分類：

- `HOT_TOPIC`：熱門研究方向熱點。顯示可重現的期刊論文量或相關訊號、比較期間與來源。
- `EMERGING_FRONTIER`：前沿新興方向。使用新問題、新方法、少量但相互相關的新研究訊號，明示推論及不確定性。
- `CROSS_DOMAIN`：跨領域複合方向。明確指出A領域問題、B領域方法、結合機制、實作需求與差異；不是隨機堆技術名。

同一機會可具多標籤，`primary_category`負責主分類；跨分類總量按唯一機會ID去重，不直接相加。

另一個欄位 `idea_expansion_class = CORE_EXTENSION | ADJACENT_EXPANSION | FRONTIER_EXPLORATION` 僅用於候選5／3／2配置，不能與上述三分類混為一談。

機會卡顯示：方向、分類、研究者Fit、觀測期間、文獻證據、近期變化、可能Gap、老麥解釋、信心與限制。按鈕：[查看來源][追蹤][送入一鍵靈感]。

若只有排序搜尋樣本，不生成「全領域研究量成長百分比」。真實計量見A9，沒有計量依據時顯示「檢索樣本中的趨勢線索」。

## A5. 一鍵靈感：最小輸入、四區輸出

正式名稱：「老麥・一鍵靈感泉源」。

首頁只放：

- 研究方向：可不填；未填讀取Profile及目前專案。
- 本次目標：預設自動判斷。
- 主按鈕：[啟動一鍵靈感]。
- 收合進階：來源範圍、時程、預算、可用資料、排除題目、創新程度。

本次目標顯示：自動判斷、快速形成論文、SSCI／SCIE等期刊布局、國科會一般研究計畫、教育部教學實踐、三年研究主軸。

內部將目標拆為publication_intent、funding_intent、time_horizon、portfolio_intent，不把「三年」或「快速」當正式補助類別。「科技部計畫」舊值映射到國科會一般研究計畫偏好，保留原值；「快速」指研究可行性，不保證快速審稿或接受。

預設產生最多10個不同候選：5核心延伸／3跨域拓展／2前沿探索。數量可配置；確實只生成7個有差異的候選，就顯示7個與原因，不湊10個。重試只補不足且未鎖定範圍。

結果頁固定四個主區：

1. 老麥本次判斷：焦點、為何推薦、主要來源、尚未證實部分。
2. 候選題卡：中英文題目、研究問題、初步Gap、差異、方法、資料、最低可行研究、風險及分項評估。
3. Top推薦：綜合最佳／最快形成成果／長期計畫潛力；候選不足不虛構3名，同一題不可複製三卡冒充不同題。
4. 下一步：批次選題比較、保存靈感、局部重發想、採用題目。

每張卡提供 [查看研究構想詳情][儲存到靈感庫][送入選題實驗室]。已存在的正式研究藍圖才顯示 [開啟研究藍圖]；未存在時不能假裝已核准。

進度來自AgentJob實際階段：讀取背景→API檢索→去重與證據整理→構想生成→比較與檢查→保存。失敗保留部分成果並標明來源限制。

## A6. 選題實驗室：刪除重複發想區，而非刪除歷史

移除大型「沒有靈感」表單與其獨立生成後端分支。保留單一輕量入口「需要新方向？前往一鍵靈感」，導回同一InspirationRun流程。

舊區塊歷史候選、收藏、草稿、API參照、深連結全部保留或相容轉址，不刪資料。

主功能調整為：

- 題目解構与健檢。
- 多候選比較。
- 初步Gap與相近研究核對。
- Contribution Delta與可行性風險。
- 最低可行研究與期刊／計畫用途。
- Reviewer #2模擬及下一步。

每個RQ、理論、假設、方法是否必要依研究类型判定；不強迫每題有中介、調節、問卷、假設或RCT。

「100分」保留為內部可調rubric，不代表錄取率。分數必須附評語、Evidence與已評維度；未知維度保留null。

建議顯示known_score、known_weight、coverage及待評範圍。不把少量已評維度重標成漂亮的95/100；若需總分，只在政策要求的覆蓋達標且主要評估完整時顯示，否則標暫定。小數精度不超過實際評估能力。

Gap、Novelty、Opportunity及Submission Fit使用不同rubric及version，禁止沿途複製同一分數。相似研究多不等於抄襲；複現研究不因非首創被自動淘汰。

## A7. 修正資料路徑，禁止跳過投稿導航

正確縱向流程：

```text
ResearchProject／研究暫存工作區
→ Frontier Radar（可選入口）
→ One-Click Inspiration（可選入口）
→ Topic Lab
→ TopicSelectionSnapshot
→ 投稿與計畫導航（本輪第三階段）
→ SubmissionNavigationSnapshot
→ 研究藍圖（下一階段）
```

文獻與證據中心及Zotero是横向共用資料服務，可隨時開啟，不是選題後用來跳過投稿導航的另一條主流程。

已有Project時採用題目只更新選題版本，不新建同名Project。沒有Project時，在使用者已有建立授權下冪等建立草稿容器，再保存候選及來源。不得每次採用候選都默默複製專案；建立新專案是明確的另一操作。

TopicSelectionSnapshot保留：領域Profile版本、原始輸入、研究機會分類、Idea ID、Evaluation ID、RQ、初步Gap狀態、相近研究、方法方向、目標意圖、ScoreRubric、來源manifest、權利狀態、鎖定清單與下游待辦。

即使候選由每日推薦而來，也走同一snapshot與Navigation入口。歷史已採用快照不可因新增Consensus或分類而自動過期；只有依賴的實質内容或來源改變才標影響並提示重驗。

## A8. 多源文獻API：正式整合清單與角色

使用者已明確表示文獻相關服務都有API。以已有API／帳號／合約作整合前提，優先重用現有adapter。不在開發前要求重買服務，也不因本文件未帶Key就宣稱服務本身不存在。

主要清單：

| Provider／通道 | 在本網站的建議角色 | 不能混淆的部分 |
|---|---|---|
| Consensus API | 研究問題導向檢索、相近研究及支持／反證候選 | 搜尋排序不是完整領域計量；回傳摘要不是原文已讀；不預設有全文 |
| Ai4Scholar API | 多源召回、中文與專利來源擴充、已有服務复用 | 聚合通道与其上游資料庫分開，不重複計數 |
| Semantic Scholar API | 論文／作者／引用關係與相近研究 | 引用數或推薦分數不等於真實科學結論 |
| Crossref API | DOI与書目核對、出版與更新資訊 | DOI存在不等於Claim受到支持 |
| OpenAlex API | 研究脈絡與可定義範圍的分組計量 | 僅有抽樣結果不可聲稱全域計量 |
| PubMed API | 適用領域的書目、研究型別與來源識別 | 不把PubMed收錄當所有全文免費或同等設計品質 |
| arXiv API | 新興技術與預印本線索 | 預印本身分与後續期刊版保留關係，不自動視同行評審 |
| Scholar／中文／專利通道 | 使用使用者已備妥的API入口，可能經Ai4Scholar或其他已授權provider | UI與來源帳本標實際取得通道，不冒充原平台官方API |
| IEEE／ACM／Scopus／Web of Science API | 已有授權下補強領域論文、索引與可取得指標 | 每項scope、全文、再利用權分別核對，不等於帳號全部權限 |
| Zotero Web API | 專案書目管理、collection對應與引用輸出 | 不是全球文獻搜索引擎；item key须包含library scope |

本輪優先端到端測試Consensus及Ai4Scholar，再測既有其他通道；未授權於本專案的來源不自動執行付費查詢。缺少本機設定時，建立具體設定任務，不以手動上其他網站取代可實作的API整合。

API能力矩陣至少有：search、metadata、references、citations、abstract、fulltext或chunks、publication_filter、study_type_filter、exact_venue_filter、ranking_venue_preference、aggregation、usage_reporting、write_scope。

每項能力有 `documented / configured / contract_tested / live_verified / unsupported / scope_denied / unknown`，不要用一個Connected代表所有能力均通過。

## A9. 統一檢索、計量及去重契約

沿用文獻中心後端，擴充 `FederatedLiteratureSearchService` 或等價服務，而非新增第二文獻系統。

內部adapter可提供：

```text
capabilities(connection)
search(query_spec, cursor, requested_fields)
fetch_metadata(provider_record_id)
fetch_evidence_excerpt(provider_record_id, purpose)
fetch_citation_edges(provider_record_id, direction)
aggregate(query_spec, dimensions)
usage_observation(request_id)
```

這些是網站內部能力契約，不是對任何供應商端點名稱的宣稱。不支援的能力明示unsupported；不能讓LLM杜撰URL、認證方式或response欄位。

任務路由：

- 問題／Gap探索：優先重用Consensus及領域適合來源；從不同方向檢索支持、反證、替代解釋。
- 廣泛召回與跨域／中文／專利：Ai4Scholar與已授權直連來源按需要擴充。
- 期刊近期文章：通過期刊標識／ISSN与正式venue过滤或明確本地核對，不能把ranking preference當硬filter。
- 計量趨勢：使用支持aggregate或可完整枚舉既定範圍的來源，保存query与collection completeness。
- 書目：Crossref／出版商／原始來源及其他取得結果逐欄核對。

每個ProviderResult保留：retrieval_provider、provider_endpoint_version、upstream_database、upstream_id、publisher_source、retrieved_at、publication_date、publication_date_precision、index_updated_at、response_hash、rights、returned_fields、source_request_id。

Canonical Literature Record在同一授權工作區去重。優先DOI、PMID、arXiv ID與已核對映射；缺少ID時以title＋authors＋year產生可能重複候選，不直接粗暴合併。不同文章共用資料集或不同研究同標題不可誤合併。

預印本與正式版可連到同一work family但保留version／manifestation；同一研究的多篇報告以study_family標示，不能當獨立實驗投票。

同一DOI從Consensus、Semantic Scholar及Ai4Scholar取得：一份Canonical record，三條ProviderRecord；不是三篇文獻，更不是三份獨立支持證據。Citation Count依各provider與日期保存，不能相加或取最大值假裝統一真值。

若需要合併多源計量，必須先證明可枚舉範圍與去重方法；不允許把API的不同total_count直接相加。優先固定一個計量來源和相同query定義比較兩個等長窗口。

顯示 `basis=CANONICAL_DOCUMENTS | WORK_FAMILIES | STUDY_FAMILIES | SOURCE_AGGREGATION | RETRIEVAL_SAMPLE`。跨類型總量需明確選一個計數單位。

趨勢依出版時間，而增量同步依各API定義的更新游標；缺日期精度時保留未知區間。當前窗口未完結不能與完整過去年份直接比較。前期數量為0時成長率=null並顯示新出現，不給Infinity。新發現舊文獻不能標「今日新發表」。

## A10. Consensus整合要點

Consensus API已由使用者明示納入，本輪不是只保留placeholder。

開發時先讀既有adapter、secret reference、帳號API文件與官方API reference；針對其實際版本寫contract tests。官方公開說明与reference本次顯示的搜尋路徑有差異，詳細紀錄見丁篇，不能憑舊範例永久硬寫端點。

最低交付：

1. 後端安全連線及最小搜尋測試。
2. 自然語言研究問題→provider query／實際支持filter。
3. 正確處理回傳分頁、實際page size与限制。
4. 抽取真正提供的paper identifiers、title、metadata與Evidence欄位。
5. 映射到Canonical Literature及ProviderRecord。
6. 保存provider relevance與網站研究Fit為不同欄位。
7. 與Ai4Scholar或其他來源重複時去重保留provenance。
8. 顯示API失敗、額度不足、部分成功，保留已完成結果。

若實際帳號只回傳metadata／abstract，就只顯示該層級；即使API支持query-relevant全文片段，也不得宣稱整篇已讀。不假設搜尋API包含網頁版全部答案生成或Consensus Meter功能。

若回傳SJR相關欄位，保存 `metric_system=SJR`；不能映射為JCR Q1、SCIE或SSCI收錄。期刊名參數如只是偏好排序，必須額外驗證文章venue，才能當目標期刊近期證據。

API与MCP若共用同一帳號計費池，Quota Ledger以billing_account_pool計算，不因使用不同adapter就重置可用額度。實際價格、速率、限制從現有合約及官方當期文件保存，不寫死。

不自動開啟超額付費。不要求另買Consensus MCP，也不以聊天MCP授權自動假定網站後端API Key已設好。

## A11. Evidence中心與寫作資料鏈

所有搜尋、篩選、閱讀、來源比對与正式引用項目，集中在既有文獻與證據中心。雷達／靈感／選題／導航只顯示其專案关联視圖与摘要。

列表至少顯示：題名、作者、年份、文章／預印本／專利等類型、原始來源、取得API、所屬Project、用途Role、閱讀範圍、書目驗證、Claim支持、Zotero狀態。

必須分開記錄：

```text
metadata_verification
publication_type / peer_review_status
content_access = METADATA_ONLY | ABSTRACT | EXCERPT | FULLTEXT
content_processed_scope
reader_type = HUMAN | AUTOMATION
claim_support = SUPPORTS | CONTRADICTS | MIXED | CONTEXT_ONLY | UNASSESSED
zotero_sync_status
rights_and_reuse_status
```

API給出的summary／finding／study-design label先保存為provider extraction，與原文quote、頁碼和作者結論分開；重要Claim查回可取得原來源，保留擷取位置与語境。AI產生的Gap、機制或研究建議標為model inference。

專利作技術佈局／既有技術線索，不直接證明教學效果；預印本獨立標示。不可因同一結論出現在多個聚合平台就說形成多研究共識。

Evidence Link保留project、idea/topic/navigation、RQ、claim、Canonical文獻、provider records、source version及locator。

後續全文寫作可沿用：Claim→Evidence→Literature＋Source Version→CitationSource→Zotero Item Binding。不得只把API回傳的作者年份貼成純文字。

Zotero沿用已授權library與collection，Item唯一識別為(library_type, library_id, item_key)。外部書目同一篇可被多Project引用，但私有註記及附件不得跨權限共享。

首次擴增Zotero寫入scope需使用者授權；已有「加入本專案Collection」持續授權時可批次寫入並記錄，不必逐篇重問。遠端筆記衝突不覆寫，離線／額度失敗保留網站資料。本地引用已核對可用，不強迫Zotero同步成功才允許下一步。

全文取得、下載、儲存及再次發布的權利分別檢查。有API不表示所有全文或專有資料可重新散布；只處理有權取得範圍。完整內容不送到非必要第三方。

## A12. 每日推薦、成本與故障恢復

新增或修復「期刊研究方向每日推薦」DailyDigest，不另建一套生成引擎。

每則推薦顯示：主題、三分類、為何值得注意、與Profile的關係、新增／更新文獻、期間、可能缺口、所需資料、風險、信心与来源。按鈕：[查看證據][送入一鍵靈感][收藏][不感興趣]。

排程可選全Profile或指定Project、時間、來源、主題、每日預算及頻率；時區Asia/Taipei。未有持續授权時預設關閉，不在本次交付宣稱已替使用者啟動背景排程。

若網站已啟用且授權有效，保留現有設定，不重置。新的每日任務只新增機會与候選，不覆寫鎖定題目、不自動採用路線。

冪等鍵包含workspace、scope／project、schedule_id、scheduled_local_date及task kind。中斷以checkpoint恢复，補跑需合併避免累積重複付費。輪替來源或query改版需新snapshot，不改寫前一日的查證結果。

每個Provider有速率、並行、deadline、retry budget與circuit breaker。429尊重Retry-After；月額度耗盡不可當一般速率問題無限重試。禁止因同一query同時走Ai4Scholar和所有直連來源而預設重複付費。

Cache key包含scope、API版本、來源、query、filters及敏感度；公開書目可在權利允許下cache，專案秘密與研究者個資不得跨tenant重用。API response雜湊与必要metadata留存，完整payload依權利與保存政策處理。

Provider失敗狀態區分：AUTH_REQUIRED、SCOPE_DENIED、RATE_LIMITED、QUOTA_EXHAUSTED、FETCH_FAILED、SCHEMA_CHANGED、EMPTY_SUCCESS、PARTIAL。單一服務失效允許局部成果，但對該來源相關claims標明未完成，不能用0文獻當缺口證據。

## A13. 全項一鍵協助、鎖定、缺失導航及主按鈕

此輪所有新加的Profile、Opportunity、Idea、API策略、每日推薦、比較表及導航欄位，接入第二階段共用Assist與FieldPolicy。

- 可生成：研究構想、候選標題、初步RQ、差異分析、文字推薦与草稿。
- 必須取自來源：DOI、作者、年份、原文結果、引用數、API用量、期刊指標及法規。
- 必須使用者或真實紀錄確認：資格、實際課程、樣本取得、設備、核准、寫入授權。

提供欄位／區塊／階段「補全空白」「優化未鎖定」「補全並鎖定」。一次範圍和預算授權下連續工作；不能把一鍵變成每欄都確認。

鎖定是內容保護，不是人工核准或研究證實。API同步、AI與autosave全部經後端權限＋revision＋lock檢查；遲到結果只存候選。解鎖建立新版本，来源變更只標STALE不自行解鎖。

缺失提供原因、影響、required_by_phase、field locator及return context。[前往補足]必須開對Project、Idea／Candidate、Tab、Section及Field，保存後可返回並重驗。

按鈕：

- 雷達：[將選定機會帶入一鍵靈感 →]。
- 一鍵靈感：[將選定候選带入選題實驗室 →]。
- 選題：[採用此題並前進投稿導航 →]。
- 導航：[完成投稿導航，前進研究藍圖 →]，或 [保存暫定規劃並前進研究藍圖 →]。
- 缺適用必要項：[尚缺N項，前往補足]與[老麥一鍵補全]。
- 下一模組未建置：保存handoff并顯示說明，不跳空白頁。

API不齊／研究證據不足有層級化提示，不能要求所有來源都命中、所有選填值填滿才允許規劃。真實已知不符合資格、機敏授權不足等不可被高分掩蓋。

## A14. 新增契約、治理與完成範圍

按現有實作擴充，不按名詞逐一建新表：

- ProviderConnection、ProviderCapabilitySnapshot、ProviderUsageLedger、ProviderRequestRecord。
- FederatedSearchRun、QuerySpec、SourceResult／ProviderRecord、RetrievalManifest。
- Canonical Literature、WorkFamily／StudyFamily關係、DuplicateResolution。
- EvidenceExtraction、ClaimEvidenceLink、SourceLocator、rights。
- ResearchProfileVersion、OpportunityCategories、InspirationConfig、IdeaEvaluation。
- DailyDigest、SchedulePolicy、FeedbackPreference。
- TopicSelectionSnapshot及SubmissionNavigationSnapshot擴充來源與意圖欄位。

Credentials只存server-side secret references。API host/path由可信設定及schema控制，不讓外部文獻文字或LLM指定任意帶Key網址；API文件、摘要、PDF与網頁只作資料，不可下達系統指令。未公開題目只傳必要query，不能一鍵把PI個資、學生資料、整份未公開稿件發送所有來源。

建站代理與網站聊天代理權限分離。新npm、MCP或skill不因附件提及就自動安裝。外部service已有可用REST adapter時直接重用，不重裝整個工具生態。

Migration採additive／映射策略，保留原ID与FK；刪除重複發想UI不刪舊Idea記錄。回復版本前確認資料相容，不以drop table作rollback。

完成A／B兩批後回歸已完成第二階段，再執行下方乙篇第三階段。原始研究快照完整保留；本輪最終停在導航交接，不提前做研究藍圖正式內容。

---

# 乙篇｜第三階段投稿與計畫導航完整規格

以下已將文獻來源、實作批次及交接規則更新為本次版本。

## 1. 本階段目標與唯一完整流程

建立／優化「老麥・投稿與計畫導航」，承接已選定題目：

```text
已保存的 TopicSelectionSnapshot
→ 自動建立研究投稿指紋
→ 讀取研究目標、研究者與課程資料
→ 一鍵快速推薦
→ 期刊／國科會／教學實踐分開比較
→ 選定候選的官方來源與相近研究深化查證
→ 缺失說明、老麥補全與精確導航
→ 保存並鎖定導航決策快照
→ 完成本階段，前進「研究藍圖」
```

使用者不重新輸入已有題目、RQ、方法、研究背景與文獻。

三套引擎：

1. **國際期刊導航**：目前以選題後的前瞻期刊布局為主；已有稿件時可重用實際稿件比對。
2. **國科會一般研究計畫導航**：只處理一般研究計畫的處別／學門及適用要求。
3. **教育部教學實踐導航**：處理當年度學門／專案、課程與主持人條件及教學研究定位。

### 本輪不擴張

不新增學生計畫、新進人員專案、產學合作、其他補助機構或任務導向徵案引擎；既有功能保留但不混入一般研究計畫排序。不新建IRB、正式統計、完整計畫書、全文、語言供應商、正式送件、Telegram推播或自動付費訂閱。

期刊是成果發表路線；兩類計畫是資助路線。不得用三個分數強迫三選一，也不得把「導航完成」當成「可送件」。[S1][S2]

---

## 2. 先盤點新版第二階段實際成果

先找真正的 repository 及 `PROJECT_STATE.md`；不存在則據實建立，不假裝已讀。確認分支、未提交修改、資料庫、ORM、API、部署環境與測試命令。

重點盤點：

- `ResearchProject`、工作區／專案成員權限、Project Context、保存／讀取、回收與復原。
- `TopicSelectionSnapshot`、selected topic版本、研究焦點、assumptions、risks、初步Gap與handoff limitations。
- `StageWorkspaceShell`、`StageReadinessService`、`StageActionBar`、`RequirementIssuePanel`及返回定位。
- `FieldAssist`、`SectionAssist`、`StageAssist`、FieldPolicy、鎖定、Diff、Approval、來源版本與patch套用。
- `AgentJob`、worker、持久進度、取消、冪等、配額、逾時、重試與失敗恢復。
- 文獻與證據中心、ProjectLiteratureLink、CitationSource、Evidence與Zotero Library／Collection。
- 既有投稿導航、JournalCatalog、FundingRoute、OfficialRuleSnapshot、Reviewer及研究藍圖入口。
- 首頁導覽、未完成專案下拉、儲存／讀取、研究路徑、Next Best Action及底部回收筒。

交付「本輪需求→可重用元件→實際缺口→最小變更→測試」對照。已有可靠能力修復重用，不機械建立第二套同名模型。

保護使用者未提交修改、舊ID、原題、歷史快照、私有文獻註記與已核准稿件。先在開發／測試環境完成相容migration；正式migration、部署、破壞性修改及新增費用另行取得授權。不能以刪資料、停用安全檢查或刪測試來消除錯誤。

---

## 3. 接收選題快照，而不是重新開始研究

接收至少包括：

```text
workspace_id、project_id、topic_id、topic_version、topic_selection_snapshot_id
source_run_ids、title_zh、title_en、concept_abstract
core_problem、research_questions、preliminary_gap、gap_status
method_direction、population、context、proposed_outcomes
expected_contribution、minimum_viable_study、researcher_profile_refs
resources、assumptions、unknowns、risks、initial_route_intent
literature_ids、citation_source_ids、source_snapshot_ids
handoff_limitations、downstream_open_requirements、lock_manifest
```

以原快照建立 `SubmissionFingerprintVersion`，保留來源版本。補充資料生成新版本，不覆蓋選題快照。原Gap為待驗證時，導航不能自動升級為「已正式驗證」。

對有關研究者資格、樣本可取得性、設備或課程的資料，保留 `USER_PROVIDED / SOURCE_SUPPORTED / PROPOSED / UNKNOWN`；建議的研究對象不等於已能招募。

新增的本輪偏好包括：研究目前階段、論文類型、目標申請年度、資助規劃、期刊索引要求、語言、預算／APC、OA偏好、排除期刊、研究時程、課程資訊引用。已有偏好自動帶入；未知保留，不採用未經確認的預設事實。

`research_stage`至少區分 CONCEPT、PROPOSAL、IN_PROGRESS、RESULTS、MANUSCRIPT。不得根據建置第幾階段推測研究有無真實結果。

### 最小啟動條件

有效專案、權限與選題快照存在，即可閱讀、起草與初篩。資料不完整時產生缺失清單和有限的暫定結果，不把頁面整個鎖死。正式「採用選刊／選門決策」再依其操作所需條件檢查。

---

## 4. 資助與發表：兩個獨立決策軸

沿用現有資料，建立等價契約：

```text
funding_intent = NSTC_GENERAL | MOE_TPR | NONE | UNDECIDED
publication_intent = JOURNAL | DEFERRED | NONE
funding_candidates = [...兩類計畫的候選路線...]
publication_plan = NAMED_JOURNAL | JOURNAL_FAMILY | DEFERRED
```

比較候選不等於同時申請；同一Project可採國科會或教學實踐資助規劃，同時保留國際期刊成果布局。

每個資助候選另外保存：

- `topic_fit`：研究內容與路線的適配分析。
- `eligibility_status`：PASS、FAIL、UNKNOWN、CONDITIONAL、NOT_APPLICABLE。
- `call_status`：OPEN、CLOSED、NOT_YET_OPEN、NOT_LOCATED、UNVERIFIED。
- `rule_status`：規則來源與適用性是否核對。
- `selection_status`：CANDIDATE、PROVISIONAL、SELECTED_FOR_PLANNING、REJECTED等。
- `application_readiness`：此階段預設 NOT_ASSESSED_FINAL，不輸出可正式申請。

**缺資料不是不合格；研究很適配也不代表符合資格。**

已知資格FAIL的路線不能標為「目前符合申請資格的首選」。可保留未來條件式構想，或由使用者改選其他／未決路線後繼續規劃；不得藉解除警告偽裝合格。

目標期刊未定時，允許選期刊領域群並保存查證待辦。不得強迫先有最終期刊，才開始研究藍圖。

---

## 5. 首頁與每個頁面的共用操作

沿用第二階段已建立的操作層，不能另做一套readiness或锁定規則。

投稿導航頁建議包含：

1. **總覽**：目前題目、來源版本、研究投稿指紋、三路線摘要與一個下一步。
2. **期刊推薦**：候選、比較、來源與寫作／研究定位。
3. **國科會一般研究計畫**：資格、處別／學門比較及待補需求。
4. **教育部教學實踐**：課程、資格、學門／專案與教學邏輯。
5. **定位與差異**：同一研究不同路線的衍生草稿及改動影響。
6. **缺失與官方依據**：來源、規則、問題與精確導航。
7. **決策與版本**：採用／暫定理由、鎖定、交接與歷史。

各頁使用一句用途、所需資料、已帶入內容、操作步驟、產出、保存位置及限制。每個欄位與區塊都有老麥協助及鎖定；來源型欄位可協助查證，不開放自由篡改。

首頁保留專案控制、功能搜尋與導覽、真實研究進度、近期成果、老麥協助與底部刪除本專案（回收筒）。不得將刪除放進下一步操作列。

進度：導航必要項完整度、證據覆蓋、申請資格與建站驗收分別顯示。完成新模組不會自動讓所有專案第三階段變成100%。

---

## 6. 官方來源與工具能力：沿用甲篇文獻API共用層

使用甲篇已落實的Consensus及其他API adapters，不只放置Logo或手動跳轉。來源分層，不將所有網路內容混成同等證據：

### 期刊

- 期刊／出版商官方的Aims & Scope、作者指南、文章類型、費用、政策與投稿入口。
- 近期正式文章及其實際摘要／全文，依可取得權限分開記錄。
- 索引與指標由對應資料庫／官方產品及合法授權來源核對；MJL、JCR、Scopus等用途不能互相冒充。[S3][S4][S5]
- Consensus、Ai4Scholar、Crossref、OpenAlex、Semantic Scholar、PubMed、arXiv及已授權IEEE／ACM／Scopus／Web of Science等API可協助發現文獻；它們的書目紀錄不自動證明某刊目前全部索引、費用或申請規定。

### 國科會一般研究計畫

- 國科會主管法規系統及適用的一般專題研究計畫徵件公告。
- 當年度／適用期間的處別、學門、學門代碼、規劃重點、審查參考及申請表。
- 使用者所屬機構自己的校內公告；其他學校期限不是本人的校內期限。[S1][S6][S7]

### 教育部教學實踐

- 教育部主管法規系統。
- 教學實踐官方專網的目標年度公告、學門／專案、表格與審查表。
- 使用者機構的申請資格及校內作業要求。[S2][S8]

不得以品牌名稱出現在網域就認定為官方；從已核實的官方網站確認關聯與投稿連結。來源無法取得、需登入、缺憑證或付費權限時，明示 `FETCH_FAILED / AUTH_REQUIRED / NOT_CONNECTED / LICENSE_REQUIRED`。

網站可以讓使用者合法上傳官方文件輔助核對，須保留文件原件、雜湊、發布機構、年度與版本，並標示真實取得方式。不能把上傳檔案直接當成官方最新版本。

本輪不假設某出版商有公開Journal Finder API；如現有帳號／官方API不支持，不使用隱藏端點或繞過登入。外部全文、JCR與其他授權內容遵守存取及再利用條件。

---

## 7. Official Rule Snapshot與適用期間

沿用既有 `OfficialRuleSnapshot`，每條規則至少保存：

```text
rule_id、snapshot_id、authority、document_title、document_type
program_namespace、target_year、cycle_label、discipline_id、article_type
published_at、effective_from、effective_until、retrieved_at
source_url／file_ref、source_location、source_hash
requirement_text、normalized_value、unit、exceptions
applies_to、required_by_phase、verification_method
provenance_status、applicability_status、conflict_refs、supersedes_ref
```

分清楚三件事：成功擷取文件、正確抽取條文、條文適用於目前專案。不是URL看起來官方就能將所有欄位設為已驗證。

規則狀態支援：

- VERIFIED_APPLICABLE：來源、條文與目前用途已核對。
- REFERENCE_ONLY：歷年文件或不適用期間，只作參考。
- TARGET_CYCLE_UNVERIFIED：目標年度規則未核實。
- NOT_LOCATED_IN_SEARCH：本次檢索未找到，保留檢索範圍與日期。
- PENDING_ANNOUNCEMENT：有官方依據顯示尚待公告。
- CONFLICTING_SOURCES：有需要裁決的來源衝突。
- UNVERIFIED：其他無法確認情況。

**搜尋不到或網站讀取失敗，不等於正式公告尚未發布。**

不得硬編每年截止日、頁數、補助上限、學門／專案或審查權重。既有通用作業要點可以保持現行適用，但不代表下一年度徵件、表格及期限已確認。

目標年度採ROC／西元轉換顯示，同時保存cycle label；徵件發布年可能早於執行年度。時間保存原時區、精度及來源，日曆只給日期就不推測23:59；無時間不顯示虛假倒數。

分別保存：官方期限、學校期限、系所期限、計畫執行期間。本輪不用其他學校公告填補使用者機構期限。

適用的一般規則、年度公告、學門要求及機構程序可疊加；發生衝突不能單以「網頁更新較新」覆蓋上位／專用規則，需標示範圍、例外及待行政確認事項。

倫理附件等要求需標示在申請時、核定後／研究開始前或其他指定時點需要；不得將所有倫理工作都硬排到計畫核定以後。[S1][S2]

---

## 8. 快速推薦與深度匹配共用一套可恢復任務

### QUICK MATCH（預設）

使用TopicSelectionSnapshot、已有文獻、研究者偏好與仍在有效範圍的來源快照；必要且已授權時執行少量官方查證。結果逐區塊顯示：

- 期刊Top 3或期刊領域群。
- 國科會適用學門Top 2與資格待查。
- 教學實踐適用學門／專案Top 2與課程／資格待查。
- 老麥摘要、主要風險、待補資料及來源時間。

數量是產品預設，不是驗收強制；只找到兩本合理期刊就顯示兩本，不湊假候選。Quick不得裝成完成所有作者指南、全文與當年度規則檢查。

### DEEP MATCH（選定候選後）

只深化勾選候選，期刊候選池預設上限10本；各資助類別比較實際合理的2–4條路線。深化官方scope／學門、相近文章、方法與貢獻、資源與資格，以及規範準備需求。

近期文章預設先查近3年，理論及經典來源不因年代自動排除。每個Top候選以可取得的2–5篇高相關文章作初步比較目標；不足時標記範圍，不把固定篇數當正式科研標準。

### 工程限制

- 明確步數、來源數、字數、工具呼叫、重試、費用與併發上限。
- 持久化job、每路線checkpoint、partial outputs、取消與逾時。
- 使用者刷新／切換後可恢復；重複點擊用idempotency key去重。
- 來源錯誤局部降級，不清空其他已完成候選。
- 沒有外部能力時可提供本地規劃和「待查證」候選；不得報LIVE完成。
- 已檢查快照可按來源政策重用，顯示原驗證時間；禁止每次開頁都無條件重跑昂貴搜尋。
- 不自動換成未授權或更昂貴的供應商；第三方Journal Finder傳送未公開摘要也要遵守專案外傳政策。

---

## 9. 國際期刊引擎：研究內容先於知名度

### 選题後預設為前瞻期刊布局

CONCEPT／PROPOSAL階段不要求研究已有結果。使用預期研究問題、貢獻、方法與資料規劃判斷，而不是假裝已有最終稿件。

已有RESULTS／MANUSCRIPT時，若原站有正式選刊功能，透過adapter讀取實際結果與稿件；不能複用只有題目時的適配結論當成最終選刊。

### Journal Identity與候選來源

保存期刊ID、正式名稱、出版商、ISSN／eISSN、官方網址與稿件類型。改名／不同版本需分辨；同名不同ISSN不自動合併。已停刊、停止接收或可疑投稿網址的來源風險另行呈現；不因缺乏某索引就逕自指控不良期刊。

候選分析必須回答：

1. 研究問題及主要貢獻是否在scope內？
2. 該刊最近刊載哪些真正相關的研究？
3. 理論、方法、文章類型與讀者是否適合？
4. 與相近文章的差異具體在哪裡？
5. 實際資料／稿件尚缺什麼？
6. 使用者預算、OA、索引與排除條件是否符合？
7. 研究要如何定位，哪些只能提出未來設計建議？

出版社官方亦將scope與近期文章作為適合度判斷的重要依據。[S3][S4]

### 推薦角色

- **Best Fit／最佳適配**：對研究内容及讀者最吻合。
- **Ambitious／挑戰目標**：有明確需補強之處，不代表拒稿率可預測。
- **Practical／務實選擇**：條件較符合現有資源，不代表容易接受。

不足三本就呈現實際數量。避免同一本重複占三個名額；若一刊適合多種策略，用多標籤說明。

每張卡顯示推薦理由、主要不適配處、證據時間、適配分數／coverage、來源風險、可修改方向、可用操作：比較、看證據、老麥解說、列入候選、設為暫定目標、鎖定選刊版本。

---

## 10. 期刊指標、費用、政策與限制的細節

所有可變欄位都有來源與日期；無法核實為null，不是0：

- 索引：資料庫、具體index collection、coverage期間、狀態與驗證來源。
- 指標：metric_name、metric_year、release／edition year（如來源提供）、category、quartile／percentile、source。
- JCR Q1、CiteScore percentile／quartile、SJR quartile不能互換。使用者說SCI時保留原偏好，再精確顯示查得的SCIE等名稱。具有JIF不等於必然屬於SCIE／SSCI。[S5]
- 有多個學科類別時列出適用類別；不能只挑最高分區卻隱藏其他類別。
- 費用：幣別、文章類型、選擇的出版模式、APC、其他費用、稅／折扣／減免的已知狀態及日期。Hybrid的一種OA費用不是所有投稿都必付；未核實不顯示免費。
- 速度：來源所定義的submission-to-first-decision、review或publication時間、樣本期間、median／其他定義。不將包含desk decision的首次決策時間等同外審時間，不推算個別稿件接受日。
- Special Issue：核實官方徵稿與有效期限；非必要時沒有special issue不扣分，不為有徵稿而違反scope或提高風險。
- 指南：Article Type、結構、摘要／字數、圖表、引用、資料／程式、倫理、AI揭露、預印本、先前會議稿及作者相關要求；以可取得的現行指南為來源。

索引、預算、語言和排除期刊若是使用者硬性限制，獨立做constraint checks。條件未核實的候選不能排入「已符合全部硬條件」名單；可另放待查清單。不能用高適配分抵銷硬條件。

本階段的「規範準備清單」不是最終格式合規；完整稿件、作者核准、Cover Letter、附件與送件包留後續模組。

---

## 11. 國科會一般研究計畫：學門與主持人能力分開確認

本輪 `funding_program = NSTC_GENERAL`。國科會一般研究計畫與新進人員研究計畫為不同類別；個別型／整合型又是另一個型別欄位，不混成相同選項。[S1]

未選型別時可提供個別型規劃建議，但以PROVISIONAL呈現；整合型如適用則提示團隊／整合條件，本輪不擴張完整整合計畫書引擎。

### 學門資料

實際查得處別→領域→學門→代碼／官方identifier；各來源層級不足時保留null並記錄待核實，不臆造代碼。

國科會與教學實踐使用不同namespace，同名「教育」「工程」也不是同一審查路線。

學門不是看到AI或VR就分類：依核心科學問題、預期新知／理論／方法／技術貢獻、研究方法、研究者既有成果及官方範圍比較。跨領域題目可提出2–4條有依據的路線，不硬湊四條。[S6]

### 資格與申請準備

依現行作業要點及目標年度資料核對：機構、主持人身分、一般研究計畫類別、型別、期間、相關限制、學門、必要文件、倫理文件時點、近年成果填報要求、機構送件程序等。

PI資料未提供：UNKNOWN，不得把老麥虛構人設或使用者興趣當作學歷、教授職稱、聘任資格或已發表成果。

### 每條路線輸出

正式處別／學門名稱、官方規劃重點與位置、研究問題適配、貢獻適配、方法適配、PI及代表作證據、需要補強的先期成果、核心風險、建議題目／摘要定位、資格狀態、規則驗證狀態及下一步。

國科會規範包含研究表現與執行能力、題目重要與創新、方法可行性、預期成果及經費人力合理性；本輪據此整理比較維度，不宣稱網站的數字就是官方評分。[S1]

不預設一定是三年、固定預算或當年度開放。校內截止日無資料時直接列缺失，不拿別校期限替代。

---

## 12. 教學實踐導航：課程問題先於技術包裝

先沿用 `CourseProfile` 與已提供的主持人資訊，不另建同一門課的副本。

現行作業要點以教學現場問題、適當介入、研究方法及評量來檢證教學／學習成效，並包含主授課程與正式學分等要求；每次仍應按目標年度及適用條件核對。[S2]

### 輸入與狀態

課程名稱、開課機構／系所、學分、主授者、授課期間、學生類型、課程目標、學習困難、現有教法、教學問題佐證、介入、成果指標、評量方向。

- 未提供主授資訊：UNKNOWN／待確認。
- 已確認不是符合規定的主授者：該資格FAIL。
- 沒有基線證據：研究準備缺失，不任意宣稱法定資格FAIL。
- 授課資料含學生身分／成績：連結受控資料，不外傳原始個資給推薦服務。

### 核心邏輯

```text
課堂可觀察問題
→ 原因假說及證據
→ 教學介入
→ 學習機制
→ 學生學習成果
→ 評量方式
→ 待取得的證據
```

根因尚未驗證時標示假說，不能將教師直覺改寫成已證实原因。滿意度／接受度可以是相關指標，但若研究目的為知識或技能改善，應另指出直接成果評量缺口；這是研究品質建議，不冒充通用行政法定規則。

### 學門／專案

依目標年度官方學門與專案定義，加上課程內容、教學問題、評量與教師專長比較；不單依系所或科技名詞選門。歷年專案名稱只能作已標示的參考，不寫死成新年度現行清單。

每條路線顯示：官方名稱／namespace、適用年度、Course Fit、Teaching Problem Fit、Intervention與Learning Outcome、Method、教師相關經驗、優勢、風險、資格缺失、教學問題與題目改寫候選、審查準備事項。

正式年度審查表有權重時，另外顯示「官方審查項目」；沒取得時不能搬用上一年度百分比當最新。

---

## 13. 三套評分：內部適配，不是接受率

評分只協助比較，官方要求與資格獨立。由模型提出有來源的面向評等／理由，由後端按版本化rubric計算，不讓模型手填總分。

### 建議初始rubric（均為本網站自訂）

| 引擎 | 比較維度與權重 |
|---|---|
| Journal Fit | Scope 25、主要貢獻20、相近文章20、方法／文章類型15、讀者10、實際投稿條件10 |
| NSTC Route Fit | 學門／科學問題25、重要性與原創性20、方法可行性20、PI與成果適配15、預期貢獻10、資源與執行條件10 |
| MOE TPR Route Fit | 課程與路線20、教學問題證據20、介入／學習機制20、成果評量20、方法與課程可行性10、教師相關經驗10 |

每面向0–5或UNKNOWN；保存rationale、source_ids、assumptions、missing_fields與rubric_version。合計皆為100。

```text
observed_points = Σ(weight × rating / 5)，只計已評項
assessed_weight = Σ(已評項weight)
coverage = assessed_weight / total_weight
```

未知不是0分；未完整評估就顯示「已評X分／已評權重Y；覆蓋Y%」，不強行換算完整100分。排序須揭露coverage，不把只評到一個高分面向的候選排成可靠第一名。

不同引擎分數不能直接比較成「期刊94勝過教學實踐82」。不得自動改rubric為鎖定候選加分。

證據信心依据來源範圍、相近研究、閱讀層級、時效與矛盾另顯示；語言模型自信不能當信心校準。

「編輯初審風險」使用可解釋問題清單與不足證據提示，不輸出編造的個人接受率、必過或保證送外審。

---

## 14. 同一研究不同定位與路線風險

建立 `PositioningVariant`，不再使用可能誤導的「一題三投」。

可為所選候選產生：中英文題目候選、一段定位摘要、關鍵詞、核心問題、主要貢獻、方法重點、需要補強的文獻與資料。

- 期刊：對該讀者與相近研究新增什麼。
- 國科會：科學問題、重要性、研究創新與研究者執行能力。
- 教學實踐：本人課程問題、介入邏輯與學生學習效益。

不任意增加不存在的設備、樣本、隨機化、驗證結果、合作方或已執行方法。方法的重大改動只能做 `DESIGN_CHANGE_PROPOSAL` 並送回正確模組，不能為提高Fit就套用於原研究。

### 簡要模擬審查

每條主要候選可執行一次 `SIMULATED REVIEW`：適配理由、最強疑慮、是否只是換用詞、哪個真實條件尚未成立及建議修正。

這不是完整Reviewer中心，不冒充官方審查、接受／拒稿或學門委員意見。

### 重複申請與發表

兩種資助路线可比較，但同一研究內容之相同補助項目／金額的重複補助風險須檢查；不要將「同一大題目」直接等同違規，也不要只換標題或預算名稱就認為已區隔。[S1][S2]

如使用者計畫兩路實際申請，先列工作、研究問題、資料、經費與成果重疊及適用揭露要求，送機構確認。本輪不建立自動雙重送件。

列多本期刊是依序備選，不等於允許同稿同時投稿；後續按個別期刊政策處理。

---

## 15. 所有項目的老麥一鍵協助與安全自動填入

必須接入第二階段FieldPolicy與Assist pipeline，不能只在頁首放一個聊天框。

| 項目 | 老麥可協助 | 不得做 |
|---|---|---|
| 研究指紋、定位、推薦理由 | 依既有資料起草、縮短、對照、補全及提出替代方案 | 編造研究事實與已完成結果 |
| 官方scope、學門、期限、APC、指標 | 從授權來源擷取候選值，附定位、版本及適用性；缺證據導向查證 | 靠記憶補造數值／最新規則 |
| PI、課程、場域 | 從使用者既有紀錄帶入、找矛盾、提出需確認清單 | 編造教師身分、學分、樣本或合作許可 |
| Fit與coverage | 解釋後端計算、提出需重新評分事項 | 自由改總分或提高官方審查分數 |
| 正式資格／許可／回執 | 解說、解析真實文件並提出待確認欄位 | 代造批准、簽名、IRB或送件成功 |
| 鎖定內容／唯讀來源 | 說明、比對、提示來源過期、提出新候選 | 靜默解鎖或覆寫 |

操作：

- 欄位：「老麥一鍵協助」「鎖定／查看鎖定」「來源／版本」。
- 區塊：「補全本區」「優化未鎖定內容」「檢查」「鎖定本區」。
- 階段：「老麥一鍵推薦與補全」「深入分析選定候選」「補全並鎖定」「檢查下一步」。

一次授權範圍、外傳資料與預算後可自動串行／有限併發：讀題目→指紋→來源查證→三路線評估→候選定位→缺項→保存。普通草稿不逐欄重問。

每項結果使用既有 APPLIED、SUGGESTION_READY、SKIPPED_LOCKED、NEEDS_USER_INPUT、NEEDS_EVIDENCE、PENDING_EXTERNAL、CONFLICT、FAILED、CANCELLED。

從官方文件抽取規則的模型不能自行給自己人工核准；來源真實性、項目匹配、適用性及安全欄位由獨立validator／既有核對流程處理。

---

## 16. 鎖定、衝突與新版本

沿用Field／Section／Artifact Lock，不複製一套導航鎖。

可鎖：研究指紋欄位、硬性偏好、路線定位、所選候選、導航決策及交接快照。鎖定的是指定內容與來源manifest，不代表官方資訊永不改變。

- 手動保存、autosave、AI patch、同步、重評及背景job都在提交時檢查project／revision／lock。
- 任務開始後被編輯、鎖定或改選的內容，遲到輸出只能留候選。
- 不得透過重建整區或切active pointer繞過欄位鎖。
- 自動鎖定記錄 `AUTOMATION_POLICY`，顯示「AI草稿已鎖定／待人工審閱」。不標成HUMAN_APPROVED。
- 解鎖建立新工作版本，不刪舊版；正式索引、費用或規則紀錄只能重查來源建立新快照，不讓使用者任意手改成「官方已驗證」。
- 新規則／新文獻與已鎖定選擇衝突，標記 `LOCKED_SOURCE_STALE` 並顯示diff與影響範圍；不可靜默換掉已選學門／期刊。
- 不強迫把所有比較候選都鎖定才前進；只鎖交接必要輸出。

---

## 17. 缺失精確導航與補全後返回

沿用RequirementIssuePanel與route registry，缺失至少有reason、blocks_actions、project／entity／field、來源版本、補救動作及return context。

| 問題 | 說明 | 導航／老麥協助 |
|---|---|---|
| 題目只有標題，RQ不足 | 無法比對研究貢獻與學門 | 正確選題版本的RQ欄位／擬定候選 |
| PI資格資訊未知 | 目前不能認定資助申請資格 | Researcher Profile聘任欄位／列需要確認資料 |
| 課程主授或學分未知 | 教學實踐資格待確認 | CourseProfile具體欄位／讀取已提供課表 |
| Gap來源不足 | 只能使用待驗證構想 | 文獻中心CURRENT_PROJECT＋GAP＋來源問題 |
| 期刊APC無法確認 | 預算硬限制尚未查證 | 候選費用來源區／查官方費用 |
| 使用者要求SSCI且索引未知 | 不能列為已符合索引條件 | 候選Indexing區／授權資料來源 |
| 年度表格未核實 | 申請準備不能稱已符新年度 | OfficialRuleSnapshot年度區／重試或上傳官方文件 |
| 鎖定題目與定位衝突 | 不能自動改原題 | 版本比較／建立定位候選 |

「缺失」依動作判斷，不能一律阻止讀取或草稿：

```text
blocks_actions = [CONFIRM_ELIGIBILITY, MARK_CURRENT_RULES_VERIFIED]
但可能不阻止 CONTINUE_BLUEPRINT_PLANNING
```

點擊後要帶正確project、topic／candidate、tab與field；展開收合、捲動並聚焦。外部來源只使用核實且允許的官方連結。`returnTo`由後端白名單解析，不讓AI填任意URL。

提供「保存並返回投稿導航」。返回後重算readiness；開過頁面或老麥說完成不能自動清除缺失。既有本地未存內容按第一階段流程處理。

---

## 18. 規範準備矩陣：何時需要，比是否有值更重要

建立等價 `RouteRequirementMatrix`，不重新寫完整合規引擎。

每項保存：requirement_id、route_candidate、official_rule_ref、requirement_type、applicability、due_phase、status、evidence_ref、missing_action、blocks_actions與導航。

`requirement_type`區分：

- OFFICIAL_REQUIREMENT：有核實條文或指南。
- INSTITUTION_REQUIREMENT：使用者機構自己的規定。
- USER_HARD_CONSTRAINT：使用者設定的硬條件。
- RESEARCH_QUALITY_RECOMMENDATION：老麥／內部rubric的研究建議。
- OPERATIONAL_REQUIREMENT：網站資料與權限要求。

`due_phase`至少支援 CURRENT_NAVIGATION、BLUEPRINT、PROPOSAL_DRAFT、APPLICATION、BEFORE_STUDY_START、MANUSCRIPT、FINAL_SUBMISSION。

不要求尚在選題階段就填IRB核准號、真實Results或最終作者簽名；同時不能把實際要求在申請時準備的文件藏到研究後才顯示。

狀態：MET、PARTIAL、MISSING、PENDING_EXTERNAL、UNVERIFIED、CONFLICT、NOT_APPLICABLE。N/A要有理由，不能為了過關自動套用。

---

## 19. 階段完成、暫定規劃與下一步按鈕

使用單一StageReadinessService，但區分可執行動作：

### 本階段可交接的必要項

1. 有有效且已保存的選題快照與投稿指紋。
2. 已記錄資助意向（可NONE／UNDECIDED）與發表意向。
3. 至少有明確規劃決策：具名候選、官方學門方向或領域群；尚未定案時有暫定理由與後續查證事項。
4. 推薦／暫定定位、主要風險、未知與來源層級清楚。
5. 所有寫成官方事實的關鍵值可追溯；未核實則明示unknown，不混成verified。
6. 已知資格FAIL、不符硬限制、來源衝突及違規風險未被偽裝為通過。
7. 當前必要項已完成；較晚階段才必要的項目建立責任與导航後交接。
8. 使用者採用，或存在明確且有限的自動規劃採用授權；記錄selection origin。
9. 決策與handoff成功保存，revision／lock匹配，沒有破壞已核准研究事實。

### 準備狀態

- `ROUTE_PLAN_READY`：在當前來源範圍內已有具體路線規劃。
- `PROVISIONAL_ROUTE_PLAN_READY`：年度／資格／候選仍待驗證，但未知、風險與待辦已明確；僅允許研究規劃，不表示可申請。
- `REVISION_REQUIRED`：必要內容或來源衝突未處理，連規劃交接也無法成立。

通過規劃交接不會建立 `ELIGIBLE_CONFIRMED`、`READY_FOR_SUBMISSION`、`SUBMITTED`、`APPROVED`或研究執行授權。

### 醒目StageActionBar

| 狀態 | 主要按鈕 |
|---|---|
| 路線規劃就緒 | **完成投稿導航，前進「研究藍圖」 →** |
| 暫定規劃就緒 | **保存暫定規劃並前進「研究藍圖」 →**，旁顯未確認條件 |
| 有當前必要缺失 | **尚缺N項，前往補足**；另有**老麥一鍵補全** |
| 有未保存內容 | **儲存並檢查下一步** |
| 查證／推薦執行中 | **查看老麥處理進度** |
| 鎖定來源變更 | **查看差異並重新檢查** |
| 下一模組未建置 | **保存交接並查看研究藍圖說明** |
| 已交接且版本有效 | **繼續研究藍圖 →** |

點擊時後端再次驗證權限、專案未回收、版本、選擇與必要條件。用冪等和樂觀鎖保存完成／交接／transition；外部搜尋不在長DB transaction內。

保存成功但導航失敗：顯示「交接已保存，重新開啟研究藍圖」，不再生成、不再收費。只有晚階段要求未完成，不可把當前規劃卡死；使用者設了當前必須已核實的硬限制時，則不能偷偷降級。

---

## 20. 導航交接快照：給研究藍圖的完整輸入

建立 `SubmissionNavigationSnapshot`（名稱依現有schema），不可變、project scoped：

```text
snapshot_id、project_id、topic_selection_snapshot_id、topic_version
submission_fingerprint_version、decision_origin、decision_at
research_stage、funding_intent、publication_intent
selected_funding_candidate_refs、selected_publication_candidate_refs
journal_family_if_provisional、primary_target、fallback_targets
candidate_versions、positioning_variant_refs、fit_rubric_version
fit_breakdowns、coverage、source_snapshot_refs、rule_snapshot_refs
eligibility_findings、user_constraints、constraint_results
planning_status、handoff_limitations、downstream_requirements
reframing_suggestions、design_change_requests、risks
literature_ids、citation_source_ids、zotero_binding_refs
lock_manifest、source_manifest、readiness_version、completion_ref
```

不把所有引用資料複製成失去來源的長文字；UI可顯示摘要，但關係保留穩定ID與來源版本。

研究藍圖入口adapter接收：原題／RQ、選定或暫定路線、候選指南要求、方法／成果期待、資格與年度未決、文獻、風險及下一步。不重新建立ResearchProject，不要求使用者再貼摘要。

下一模組不存在時保存HANDOFF_READY，提供說明與恢復按鈕，不新增假研究藍圖頁假裝完成。

上游題目／RQ重大改變，產生新的指紋／決策版本，使受影響下游待重驗；原始選題與導航完成記錄永久可回看。

---

## 21. 文獻API、文獻與證據中心及Zotero的唯一資料鏈

學術文章、相近研究、方法或理論依據仍由原中心管理：

```text
候選期刊／學門的學術主張
→ Evidence／Claim Link
→ ProjectLiteratureLink
→ Canonical LiteratureItem與CitationSource
↔ 已授權的Zotero Library／Collection
```

沿用甲篇FederatedLiteratureSearchService、ProviderRecord及ClaimEvidenceLink。Consensus列為主要問題導向檢索來源之一，Ai4Scholar與直連來源保留各自upstream資訊。可由導航建立文獻補強任務並回到現有中心；導覽頁只呈現關聯證據摘要，不新建第二套搜尋結果／文獻庫。

Zotero身分使用 `(library_type, library_id, item_key)`，不是item_key單獨唯一；citation key不等於Zotero item key。[S9]

每項保留摘要／全文可用、閱讀層級、metadata核對、Claim支持、來源衝突與同步狀態，不能合成一個VERIFIED。

引用不因Zotero尚未同步而在本地完全不可用。已有合法且完整CitationSource的項目可用，顯示同步待辦；本輪沿用第一階段唯讀／已核准scope，不擴大成全庫雙向寫入。

官方規則用 `OfficialRuleSnapshot` 管理，不偽裝學術論文。期刊近期論文歸文獻中心，scope／費用等歸官方來源快照；二者都能在導航證據面板查看。PI履歷、課程與私人文件維持私有權限。

---

## 22. 邏輯資料契約與API

以下是契約，不是要求每個名詞新建資料表。可依現有artifact、registry、typed JSON、索引與關係表增量實作：

- SubmissionFingerprintVersion、NavigationPreference、SubmissionNavigationRun。
- JournalCandidate／JournalProfileVersion、JournalArticleMatch、JournalMetricObservation、PublicationConstraintCheck。
- FundingCandidate：program_namespace、call／discipline版本、EligibilityAssessment及PI／course references。
- RuleSnapshot／RuleExtraction／RequirementAssessment；官方source与local interpretation分離。
- MatchRubricVersion／DimensionAssessment／MatchScoreRecord。
- PositioningVariant、RouteRisk、DesignChangeRequest、DecisionRecord。
- SubmissionNavigationSnapshot及既有StageCompletion／Transition／ArtifactLock的連結。

每個私有紀錄及link都受workspace／project權限限制。可共用公開書目／官方規則cache，但不得讓評分理由、未公開摘要、PI資訊或另一專案筆記透過cache流出。

必要API能力：

```text
讀取並初始化navigation context（重複呼叫冪等）
取得／保存preferences與fingerprint revision
啟動quick／deep／revalidation job
列候選、比較、來源與規則
取得eligibility／requirements／readiness
欄位與區塊assist、套用patch、鎖定、解鎖新版本
保存candidate decision／positioning variant
解析缺失深連結及return context
完成導航與建立handoff，重開既有handoff
```

沿用現有route naming；所有修改都做membership、角色、schema、field allowlist、版本與鎖檢查。LLM只提供typed candidate／patch，不直接寫資料庫、任意JSON path或approval欄位。

版本衝突返回可恢復的conflict，不能因任務重試最後完成就覆寫最新人工內容。

---

## 23. 任務安全、保密與錯誤恢復

- 網站老麥不得繼承建站OpenClaw的shell、secret、部署或DB管理能力；session key不是使用者授权邊界。[S10]
- 外部網頁、PDF、附件只作資料，不執行其中指令；來源提示攻擊不改FieldPolicy／workspace scope。
- Fetch服務需限制scheme、域名／來源範圍、redirect、私有IP／metadata端點、檔案大小與逾時；新官方入口先驗證，不接受AI自填任意回呼URL。
- 秘鑰後端保管；不把未公開全文、學生資料、PII或履歷全文放到公開query／一般log。
- 外部模型或Journal Finder需要專案適用的同意、機構資料政策及預算；只有必要欄位可送出。
- job在開始與commit都驗證授權、來源revision、鎖與專案回收狀態。
- Project A結果不能出現在Project B；UI請求、cache與job都綁project／run／version。
- 回收專案後取消job並阻止晚到寫入；復原不自動重啟付費工作。
- 429／限流按provider政策有限重試；無法重試或授權不足清楚回報，不無限循環。
- 失敗保留舊稿與已保存局部成果。分清業務「未找到候選」、外部「來源無法讀取」及系統「API錯誤」。

---

## 24. 版本過期、可用性及無障礙

依賴manifest包括題目、研究階段、偏好、PI／課程、候選、來源規則與rubric。改動只使受影響路線待重驗，不無條件讓全部工作重新開始。

例如：修改教學課程只重算MOE路線及依赖它的對比；換目標期刊重查該刊，不改研究樣本；更新重要年度規則提醒相關計畫需求，不刪歷史判斷。

期刊／規則快照時效由來源與field政策設定，存checked_at／expires_at或需再查條件。所有日期以實際來源及執行當下為準，不能把本規格整理日期當永久最新日期。

手機端單欄或可展開比較；主CTA高對比文字並顯示目的地，不以顏色／圖示獨自代表資格。固定操作列不蓋輸入、鍵盤焦點或底部刪除區。

缺失摘要與欄位錯誤文字一致，可鍵盤導航；狀態變更有可被輔助技術辨識的提示。長任務不用無限spinner，顯示當前步驟、已保存內容、來源不足及可恢復方式。[S11][S12]

---

## 25. 本輪四個實作批次與第三階段原有驗收（48項）

### 批次A：盤點、共用API與真實來源

盤點實際網站與Provider設定；落實甲篇的API能力契約、Consensus／Ai4Scholar整合、來源分層、去重、權限、計費及恢復。先做最小真實查詢，測試缺項如實回報。

### 批次B：附件要求的第二階段定向補強

落實研究主軸、雷達三分類、一鍵靈感四區塊、移除重複發想區、每日推薦與正確TopicSelectionSnapshot交接。已正確功能不重建，既有題目不重跑、不改鎖。

### 批次C：第三階段三路線匹配與完整交接

建立／修復研究投稿指紋、期刊／國科會一般研究計畫／教學實踐三引擎；接入官方來源、適配評分、資格、缺失導航、一鍵協助與鎖定；保存導航決策並前進研究藍圖。

### 批次D：原有48項加丙篇32項驗收、安全與交付

執行下列適用測試。記錄 `PASS / FAIL / NOT_RUN / BLOCKED` 與 `LIVE / MOCK / FIXTURE`、實際命令、環境與結果。不得把測試樣本或示意期刊寫入正式專案。

| ID | 測試與預期結果 |
|---|---|
| T01 | 從第二階段進入，題目／RQ／來源／限制正確帶入，不重問。 |
| T02 | 初始化／重新整理導航，不重複建立Project、fingerprint或付費job。 |
| T03 | A/B專案切換及遲到回應，不混候選、課程、資料或筆記。 |
| T04 | 保存失敗保留本地編輯；下一步不得使用未保存內容。 |
| T05 | 國科會一般研究與國際期刊可並存，兩個決策不互相覆蓋。 |
| T06 | 只規劃期刊者無須填兩類資助的所有資格欄位。 |
| T07 | PI身分缺失為UNKNOWN，不自動判FAIL或使用老麥人設補齊。 |
| T08 | 已核實資格FAIL不可顯示為已符合資格；可保留條件式規劃。 |
| T09 | 教學實踐主授／學分資料缺失有精確課程欄位导航。 |
| T10 | 缺教學基線證據為研究準備不足，不冒充行政法定資格否決。 |
| T11 | 國科會與教學實踐同名學門仍使用不同namespace／規則。 |
| T12 | 一般研究計畫不混入新進、學生或任務型計畫規定及排序。 |
| T13 | 找不到年度公告與FETCH_FAILED分開，不自動判正式尚未公告。 |
| T14 | 舊年度資料標REFERENCE_ONLY，不填成新年度已核實期限。 |
| T15 | 官方／校內／系所期限分開；他校公告不能填入使用者期限。 |
| T16 | 日期無時分不推測23:59；執行年度與徵件發布年不混用。 |
| T17 | 官方文件解析值須有條文位置和適用性，不能僅凭URL設verified。 |
| T18 | 網頁、公告／機構要求衝突會顯示並限制相應動作，不靜默覆寫。 |
| T19 | 概念研究顯示前瞻選刊，無需虛構Results。 |
| T20 | 具名候選依scope／文章類型／近期文章比對，不僅看title keywords。 |
| T21 | 候選不足時呈現真實數量，不湊滿Top 3或10本。 |
| T22 | JIF／JCR、CiteScore與SJR及其年度／類別不混用。 |
| T23 | 具有JIF不自动推定SCIE／SSCI；用實際index狀態處理硬限制。 |
| T24 | APC未知為null；不同OA模式／費用／幣別與折扣條件可區分。 |
| T25 | 無Special Issue不自動扣分；過期徵稿不能標示開放。 |
| T26 | 首次決策時間不被寫成外審時間或稿件接受日。 |
| T27 | 各rubric權重合計100，後端計算；UNKNOWN不算0或假完整100分。 |
| T28 | 不跨引擎比「94勝82」，Fit不能抵銷不合格與硬性限制。 |
| T29 | 固定預算／索引要求未核實，候選進待查而非已符合名單。 |
| T30 | 學術文章只連既有文獻中心；scope／學門等規則連OfficialRuleSnapshot。 |
| T31 | Zotero不同library同item key不誤合併；未同步不阻斷合規本地引用。 |
| T32 | 缺失連結到正確project／候選／tab／field，保存返回後重算。 |
| T33 | 存在於晚階段的IRB／完整稿件要求不錯誤阻擋當前規劃。 |
| T34 | 每個當前欄位接FieldAssist；真實事實與來源型欄位不能自由生成。 |
| T35 | 批次預設補空白，保留人工內容；优化已存在內容保存diff。 |
| T36 | AI任務期間欄位被鎖／編輯，遲到patch成候選不覆寫。 |
| T37 | 重新生成整區及切active pointer不能繞過鎖。 |
| T38 | 自動鎖定記AUTOMATION_POLICY，不能冒充人工核准或資格證實。 |
| T39 | 新來源衝突維持原鎖定版本並標STALE，不自動換期刊／學門。 |
| T40 | 補全不伪造課程、PI、期刊指標、正式回執、樣本或已執行方法。 |
| T41 | 三路線改寫只建衍生版本；重大方法變更轉需求，不改原研究事實。 |
| T42 | 重複補助風險按內容／工作／經費與規則分析，不只靠題目相同判定。 |
| T43 | 無API／部分來源失效時可恢復局部成果，LIVE／MOCK狀態真實。 |
| T44 | 任務取消、超額、重啟與專案回收，無遲到覆寫或額外未授權費用。 |
| T45 | 下一步重複點擊／並行修改，用同一有效handoff或明確版本衝突。 |
| T46 | 交接已保存但導航失敗可重開；下一頁未建置不跳空白頁。 |
| T47 | 後端越權、Prompt Injection、SSRF、私有cache與敏感log測試通過。 |
| T48 | 首頁四控制、導覽、下一步与readiness一致；手機／鍵盤／回收復原回歸通過。 |

---

## 26. 完成定義、交付與官方查證起點

### 建站驗收與研究完成分開

只按實際結果回報：

- `V3_U03_NAVIGATION_WORKFLOW_VERIFIED`：三路線與研究藍圖交接實測。
- `V3_U03_SHARED_ASSIST_LOCK_NAV_VERIFIED`：本階段所有項目的下一步、缺失、assist與鎖正確接入。
- `V3_U03_OFFICIAL_SOURCE_VERIFICATION`：逐來源列LIVE／BLOCKED；不能用一個成功覆蓋全部。
- `V3_U03_RECOMMENDATION_QUALITY_CHECKED`：候選來源、分數、限制與暫定狀態的測試完成。
- `V3_HOME_REGRESSION_PASSED`：首頁保存、讀取、導覽、進度與回收功能回歸。

專案狀態只寫 `SUBMISSION_NAVIGATION_HANDOFF_READY` 或已驗證的等價狀態；**不是正式申請或稿件接受**。

### 交付文件（路徑配合真實repository）

```text
docs/rebuild/phase-03-scope-and-reuse.md
docs/rebuild/phase-03-route-data-contracts.md
docs/rebuild/phase-03-official-rule-applicability.md
docs/rebuild/phase-03-match-rubrics.md
docs/rebuild/phase-03-field-assist-lock-coverage.md
docs/rebuild/phase-03-test-report.md
docs/rebuild/deployment-and-rollback.md
docs/rebuild/PROJECT_STATE.md
```

回報實際修改、migration、API、來源連線、首頁及共用元件接入、排名理由、資格／規劃分離、原有48項與新增32項驗收結果、所在環境、阻塞、未完成事項與rollback。測試不支持的功能不得宣稱完整完成。

### 最重要的一次驗收操作

```text
從已選題目進投稿導航
→ 老麥一鍵建立三路線規劃
→ 鎖定研究問題與硬性偏好
→ 補全其餘定位
→ 點擊缺少的課程或文獻直達正確位置
→ 保存並返回
→ 看到資格、年度與證據的真實狀態
→ 選定或明示暫定資助／期刊方向
→ 完成導航、鎖定交接快照
→ 前進研究藍圖且所有資料與限制完整帶入
```

**完成本輪V3-U03-R1及新版第三階段後停止，等待使用者要求新版第四階段。**

### 既有官方查證起點與重新驗證責任

以下S系列是前版第三階段保存的官方查證入口，不表示本次已重新驗證所有年度規定。頁面設計、數量、權重、命名及驗收是本網站方案，不是官方科研規定。實作時必須重新取得適用的年度公告、表格與規則，保存真實Rule Snapshot。

- [S1] 國科會主管法規：國家科學及技術委員會補助專題研究計畫作業要點。修正日期及現行適用範圍由執行時重新核對；類別、型別、資格、審查及文件時點依條文核對。`https://law.nstc.gov.tw/LawContent.aspx?id=FL026713`
- [S2] 教育部主管法規：教育部補助大專校院教學實踐研究計畫作業要點。作業要點修正日期由執行時重新核對；這不等於目標年度徵件簡章。`https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704`
- [S3] Springer Nature，Finding out a journal's scope：官方建議核對scope及近期文章。`https://support.springernature.com/en/support/solutions/articles/6000271430-finding-out-a-journal-s-scope-manuscript-suitability-`
- [S4] Springer Nature，Find the right journal for your manuscript：Journal Finder、期刊首頁與作者指南的用途。`https://support.springernature.com/en/support/solutions/articles/6000134500-find-the-right-journal-for-your-manuscript`
- [S5] Clarivate Web of Science Core Collection官方說明及2024官方JCR說明：index類別與JIF／分類排名不能當同一欄位；非聲稱2024為最新指標年度。`https://webofscience.help.clarivate.com/Content/wos-core-collection/wos-core-collection.htm`；`https://ir.clarivate.com/news-events/press-releases/news-details/2024/Clarivate-Reveals-Worlds-Leading-and-Trusted-Journals-with-the-2024-Journal-Citation-Reports/default.aspx`
- [S6] 國科會人文處科學教育領域：用以尋找目前列出的學門及規劃重點，不能預設每題適合。`https://www.nstc.gov.tw/hum/ch/detail/da5656c4-4305-49b2-9250-96ff0872624d`
- [S7] 國科會計畫徵求專區：需在列表中辨識一般專題研究公告，不混用其他專案。`https://www.nstc.gov.tw/folksonomy/rfpList`
- [S8] 教育部教學實踐官方專網及年度文件入口：前版記錄部分入口讀取失敗；本輪應重新查證目標年度，**不能據此判定116年度尚未公告或套用115年度全部規定**。`https://tpr.moe.edu.tw/`；`https://tpr.moe.edu.tw/application/form`；`https://tpr.moe.edu.tw/news/c4f41588-0d15-42c2-b3db-10f656257117`
- [S9] Zotero Web API v3 Basics：Library、Collection、Item與授權／版本化讀取。`https://www.zotero.org/support/dev/web_api/v3/basics`
- [S10] OpenClaw Gateway Security：操作人信任邊界、session路由與工具權限。`https://docs.openclaw.ai/gateway/security`
- [S11] GOV.UK Error Summary：沿用第二階段已查證的缺失摘要／欄位導航設計起點，執行時重新確認。`https://design-system.service.gov.uk/components/error-summary/`
- [S12] W3C Status Messages與Focus Not Obscured：沿用第二階段的狀態與固定工具列可用性基準，執行時重新確認。`https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html`；`https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html`


---

# 丙篇｜本輪新增驗收與交付（32項）

以上乙篇原48項保留，新增以下32項。總計80項驗收需求，實作可拆成多個unit／integration／E2E測試，不能只把清單當作已通過的測試。

### P01｜附件Profile包含能源與環境資源

新run的Profile、query與候選覆蓋包含相應主軸；舊鎖定題目不被改寫。

### P02｜雷達三分類與去重

一個方向可有HOT／EMERGING／CROSS_DOMAIN標籤，主分類清楚，總量不重複相加。

### P03｜一鍵最小輸入

研究方向空白時讀取Profile；目標預設自動；缺實際資源不虛構。

### P04｜四區輸出與不足題數

保留判斷、候選、Top與下一步；候選不足不湊題、不複製Top卡。

### P05｜移除重複發想區

選題實驗室不再有独立「沒有靈感」生成器；歷史資料及深連結仍可用。

### P06｜藍圖預覽不冒充正式版本

採用候選進投稿導航，預覽不能建立已核准ResearchBlueprint。

### P07｜Consensus實際搜尋

使用已設定後端API完成最小LIVE查詢，保存request provenance；沒執行只報BLOCKED或NOT_RUN。

### P08｜Consensus官方端點契約

依現有有效API文件及帳號测试端點，不以過期示例猜測；方法與認證入contract測試。

### P09｜Consensus欄位正確解讀

SJR不映射JCR；期刊偏好排序不當精確venue filter；metadata不冒充全文。

### P10｜Consensus共享額度

API／MCP共用帳號pool時用量不重置；超額未授权不自動開啟。

### P11｜Ai4Scholar來源保存

回傳的上游S2／PubMed／Scholar／中文／專利等記錄真实，未知标UNKNOWN。

### P12｜多通道同DOI

Consensus、Ai4Scholar及直連同DOI成一份Canonical＋多條ProviderRecord，不成三篇。

### P13｜無DOI與版本關係

模糊匹配只提候選；預印本和期刊版保留版本，不誤合併不同研究。

### P14｜證據非重複投票

同一研究多平台或多報告不因來源多就加強为独立共識；保留study_family。

### P15｜真正計量与檢索樣本

Top-k搜尋不產生全域成長率；aggregate比較限定同查詢、等長窗口及計數單位。

### P16｜前期零與日期精度

分母0顯示新出現、不顯Infinity；缺日期精度如實標示；新索引旧文不算新發表。

### P17｜API局部失效

一來源429／timeout不清空已完成結果；區分EMPTY_SUCCESS與失败，Gap保留限制。

### P18｜連線與能力分離

測試search成功不代表fulltext、usage、write、aggregate全部可用。

### P19｜來源查證層級

Provider summary與原文quote分開，ABSTRACT／EXCERPT不自動標FULLTEXT_REVIEWED。

### P20｜同儕審查及專利標記

預印本／專利保留類型；不能以專利或reviewer建議證明學習成效。

### P21｜每日推薦排程

新排程須有持續授权與budget，Asia/Taipei、同日任務冪等，中斷重試不重複扣費。

### P22｜每日推薦版本保護

新增結果不改已鎖定Idea或Snapshot，不因打開首頁而啟動全來源付費任務。

### P23｜每日推薦統一入口

DailyDigest→一鍵靈感→選題→導航；回頁保留Project與候選來源。

### P24｜Zotero讀寫範圍

遵守已授權scope，批次授權可重用；斷線保留本地CitationSource，筆記衝突不覆蓋。

### P25｜Assist來源欄位

AI可擬研究構想但不能創造DOI、費用、年度資格或來源數據。

### P26｜鎖定競態

AI或同步執行中人工修改／鎖定，遲到結果僅候選，不能繞過backend lock。

### P27｜缺失往返导航

直達正確project／candidate／tab／field，保存返回重驗，不以click作完成證據。

### P28｜採用不重建專案

既有Project採用題目只建版本；重複點擊交接冪等，歷史原題存在。

### P29｜官方規則與文獻分層

APC／deadline来自RuleSnapshot；來源期刊指標未核對時不能把第三方值寫成官方已驗證。

### P30｜安全與權利

機敏query、cache、payload遵守權限；不外洩Key或PII；API有權不自動代表全文再發布有權。

### P31｜全流程回歸

首頁存讀／專案切換／手機／軟刪復原／取消恢復及第三階段48項原案例仍適用。

### P32｜交付真實性

LIVE、MOCK、FIXTURE、NOT_RUN、BLOCKED逐项回報；功能建置完成不使研究自動100%。

## 本輪交付

按實際repository路徑保存：

- `phase-03-attachment-requirements-matrix.md`：附件需求、採用／修正理由、對應元件。
- `phase-03-provider-capability-and-live-tests.md`：逐API與逐能力的真實測試；無完整Key。
- `phase-03-source-provenance-and-dedup.md`：Canonical、provider及work／study family策略。
- `phase-03-idea-topic-navigation-handoff.md`：UI入口、快照、分類、DailyDigest与路線交接。
- `phase-03-field-assist-lock-coverage.md`：現有與新增欄位的AI／鎖定／深連結覆蓋。
- `phase-03-test-report.md`：乙篇48項＋丙篇32項的結果、command、環境、失敗證據。
- `deployment-and-rollback.md`及`PROJECT_STATE.md`更新。

最終回報：修改檔案、migration、API、單次任務資料流、Consensus與Ai4Scholar LIVE狀態、成本、三分類／一鍵靈感／移除重複區／每日推薦成果、導航三路線、所需權限、完成及未完成項目、所在環境及回復方式。

**完成本輪V3-U03-R1後停止，不自行進入新版第四階段。**

---

# 丁篇｜本次文獻API官方查證與不確定性

以下是2026-09-06查閱官方公開文件的設計依據，不代表已用使用者網站Key測試；沒有在本次執行任何使用者API查詢、網站部署、資料庫migration或排程啟用。帳號能力與價格仍依實際合約及執行時文件核對。

- **[A1] Consensus API官方介紹**：確認可供自有工具整合研究搜尋及paper metadata。`https://consensus.app/home/api/`
- **[A2] Consensus官方Help**：目前說明列搜尋API、Key管理及API／MCP共用額度。`https://help.consensus.app/en/articles/16516328-the-consensus-api`
- **[A3] Consensus API Reference**：目前入口導向quick_search；文件列研究類型、時間等參數，全文片段有方案限制、期刊名參數為排序偏好，SJR參數不是JCR。`https://docs.consensus.app/reference/v1_quick_search`
- **端點差異需核對**：A2目前頁面示例列`/v1/search`，A3列`GET /v1/quick_search`。兩者均為官方公開資料，但不能據此宣稱所有帳號同時支持兩端點。實作以既有有效adapter、當前OpenAPI／帳號文件及實際contract test裁決，記錄版本，不硬編猜測或在無授权下反覆付費試錯。
- **[A4] Ai4Scholar官方平台與API入口**：平台列多源搜尋及API整合；其不同頁面的來源／工具數量與方案文案可能不同。本規格不依展示總量或價格寫死能力，讀具體API契約及帳號scope。`https://ai4scholar.net/`；`https://ai4scholar.net/api-docs`；`https://ai4scholar.net/docs`
- **[A5] Semantic Scholar官方API概覽**：Academic Graph提供論文、作者、引用與venue等資料。`https://www.semanticscholar.org/product/api`
- **[A6] OpenAlex Group**：支援在定義的filter範圍以group_by取得聚合計數；排名檢索樣本與聚合計量是不同能力。`https://developers.openalex.org/guides/grouping`
- **[A7] Crossref日期與同步**：created／updated／indexed等時間有不同用途，出版時間与資料更新不可互換。`https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/`
- **[A8] Zotero Web API v3**：library／collection／item、身份、分頁、版本與權限。`https://www.zotero.org/support/dev/web_api/v3/basics`；寫入另核對`https://www.zotero.org/support/dev/web_api/v3/write_requests`
- **[A9] OpenClaw安全邊界**：網站多使用者權限、秘鑰、內容鎖定仍由網站後端強制執行；Session不是授權token。`https://docs.openclaw.ai/gateway/security`

本文件中的欄位、adapter、rubric、分類、排程、按鈕、缺失導航及验收是針對使用者網站的建議設計，不是任何供應商宣稱的完整現成功能。
