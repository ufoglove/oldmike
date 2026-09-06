# OpenClaw 科研網站 V3｜新版第十三階段完整建置提示詞
## 資料治理、清理與 Analysis Dataset

**版本：V3-U13-FULL / v3.4**  
**接收：新版第十二階段 FormalExecutionSnapshot**  
**交付：DataGovernanceSnapshot → 新版第十四階段「分析實驗室 Execution Mode、研究結果與圖表」**  
**編製日期：2026-09-06，Asia/Taipei**

本文件供 OpenClaw 實際增量建站使用，並不是要求模型直接生成研究資料。本文件獨立完整，不需拼接舊版第十一階段資料治理或舊版第十三階段全文寫作。

使用前提：使用者表示新版第一至第十二階段網站建置完成；真正repo、可用服務、每個專案的研究執行與資料狀態，由工程代理開工核對。本文沒有宣稱已檢查或部署使用者網站。

> 核心原則：老麥協助理解、提案與編排；資料處理由可驗證程式執行；科學與用途決策由有權者採用；Raw不被靜默改寫；所有完成狀態有真實版本依據。

---

## 1. 本階段定位、交付終點與明確邊界

你是協助既有網站開發的 OpenClaw 工程代理。本輪必須實際檢查、增量實作與測試，不是只替使用者清理資料、列操作建議或建立老麥人格 Skill。

本輪編號固定為 **V3-U13-FULL**，名稱為「資料治理、清理與 Analysis Dataset」。不要套用舊版第十三階段全文寫作規格。

唯一主流程：

FormalExecutionSnapshot → 授權與來源核對 → 固定資料範圍／版本 → Staging → 字典與映射 → 去識別與用途控制 → Query／裁決 → 可重現清理與計分 → Clean Dataset → 分析範圍／語料／切分 → Analysis Dataset 或 Analysis-ready Corpus → 驗證及簽核 → DataGovernanceSnapshot → 新版第十四階段「分析實驗室 Execution Mode、研究結果與圖表」。

本輪要有真正可用的來源瀏覽、規則預覽、執行、異常導航、差異、品質報告、資料版本保存、有限權限匯出與交接，不是只有模組卡片。

本輪允許：資料完整性／範圍／缺失診斷、計分、已核准衍生變數、資料準備與重跑核對。這些數值由計算服務產生，標示 DATA_PREPARATION_DIAGNOSTIC。

本輪不做：正式假設檢定、組間效果比較、正式可靠性／效度研究結論、迴歸／SEM等研究結果、模型訓練或效能選優、正式主題分析、Results／Discussion、投稿。不以是否顯著決定清理方案。

「使用者說第十二階段完成」表示其網站建置進度；每個真實專案是否已取得資料、完成收集或獲分析授權，仍讀取實際紀錄。開發測試成功不能更新真實研究完成狀態。

---

## 2. 開工健檢、相容性與現有成果保護

先找到真實網站 repository、PROJECT_STATE.md、分支、未提交修改、環境、Auth、ORM、storage與部署方式。OpenClaw工作目錄不一定是網站repo。

閱讀新版第十二階段的handoff schema、consumer tests、接收頁及實際API；核對第七階段Analysis Planning、第十階段ScoringSpecification、第十一階段Pilot區隔。不要假設實際Schema完全依提示詞命名。

盤點已有資料治理、計分、資料字典、Query、CSV／JSON解析、背景任務及權限元件：可靠者重用，缺少者最小增補。不得重建登入、Project、文獻資料庫、Zotero同步器或統計引擎。

保護原始資料、稿件、舊計畫、版本、研究者未提交程式碼；測試用隔離workspace與fixture。不得將真實原始資料複製到一般開發fixture、Git、模型提示詞或日誌。

先在開發／測試環境完成；正式migration、正式部署、破壞性操作、新付費服務、擴張外部資料傳输需另外授權。提供可回復migration方案；不可用刪測試、關閉ACL、清庫或覆寫Raw來消除錯誤。

輸出簡短Architecture Audit：實際來源、根因、既有能力、相容映射、最小改動及驗收方式。能實作的安全部分直接繼續，不只交報告，也不擅自進下一階段。

---

## 3. 精確接收 FormalExecutionSnapshot，不增加不存在的上游Gate

新版第十二階段明確輸出 `FormalExecutionSnapshot`，主要完成狀態為 `FORMAL_DATA_COLLECTION_COMPLETE`，不是舊版 `RAW_DATA_LOCKED_AND_HANDOFF_READY`。若網站已有等價raw lock可重用，但不得要求先補建不存在的舊Gate才能開啟本輪。

| 第十二階段內容 | 第十三階段用途 |
|---|---|
| project_id、goal_context | 同一Project及三目標上下文 |
| execution authorization、consent summary | 資料使用範圍與權限，不將摘要當原始同意文件 |
| protocol／instrument／scoring versions | 每筆資料用實際版本，不自動採最新 |
| data capture schema | Source欄位、單位、編碼與後續字典映射 |
| recruitment／enrollment／withdrawal／session summaries | 樣本流、研究單位與缺失原因核對 |
| intervention／exposure、deviations、safety events | 範圍限制、品質與分析註記，不自動排除 |
| device／AI versions | 訊號、事件、模型配置的可比性與變更 |
| raw data manifests、checksums、capture QA | 原始來源完整性與本批次固定範圍 |
| study unit registry refs | pseudonymous linkage與分層資料鍵 |
| identity vault references only | 僅安全參考，不展開實名與聯絡資料 |
| change history、outstanding data／compliance issues | 繼承待辦與權限限制，不重設成已完成 |
| source／lock／version manifests | 保留依賴、鎖與版本 |

另從已授權紀錄解析：RQ、AnalysisPlan adopted version、cohort與排除計畫、Preregistration及其修訂、DMP、instrument使用權與計分文件。不重填已有資訊；不存在則Issue並導向原模組。

既有快照是敘述性欄位時，建立adapter與明確的欄位mapping。技術metadata可由真實上下文補入；來源hash、核准、同意、研究數值不能生成補齊。未知goal不能默認期刊。

先驗證workspace／tenant、project、巢狀資產ACL、schema_version、來源存在與revision。Unsupported schema或跨專案reference需明確錯誤，不靜默丟棄欄位。

初始化鍵至少含 workspace、project、source_snapshot_id、dataset_scope_id、work_order目的及schema_version；重開、重試不重建Project、不再取一份最新Raw、不重複付費任務。

---

## 4. 三目標、研究類型與工作模式分開

沿用 `JOURNAL_SCI_SSCI`、`NSTC_GENERAL`、`MOE_TPR`。goal、funding route、publication route、study type、data domain與本次操作目的分開，不因切Tab重寫目標。

- 期刊：保留RQ、觀察單位、主要／次要／探索用途及可重現資料準備。
- 國科會一般：保留計畫、工作包、設備與實驗run關係；資料品質不能因申請需求而調整。
- 教學實踐：保留班級、週次、活動、評量、研究參與與成績使用條件；非研究參與者資料不得因課程同班就流入研究Dataset。

Modes：
1. `PLANNING_ONLY`：尚無真實資料時，只配置字典／規則／流程。可進後續模組的規劃頁，不能獲正式分析放行。
2. `DEVELOPMENT_FIXTURE`：合成資料測試；UI永久標記，獨立storage／namespace，不影響真實N與研究Gate。
3. `STAGING_QA_DURING_COLLECTION`：只对已合法取得的版本做品質核對；資料仍在收集時，不自動解鎖未規劃的中期效果分析。
4. `FORMAL_DATA_PREPARATION`：已具合法資料使用範圍及固定收集版本的正式處理。

預設正式資料release需第十二階段收集結案及固定manifest；若研究原先有核准的分批／分波次資料交接，保存正式scope、cutoff、授權及分析時點，由同一規則處理，不靠開發者跳過Gate。整體研究未結束不能被改成已完成。

計畫書申請工作不必等未來資料治理完成。首頁只計算本次適用成果路徑，不用本階段資料缺失去阻擋已可完成的計畫草稿。

---

## 5. 資料分區、最小權限與隱私生命週期

沿用原storage，不以八份複製資料模擬分區。可用邏輯namespace＋角色ACL：

- Identity Vault：實名、聯絡與對照鍵；獨立授權，普通AI、分析者及匯出不可讀。
- Raw：原始資產與收到時內容，唯讀。
- Staging／Quarantine：解析工作與待裁決資料，保留原始定位。
- Clean／Derived：已採用規則生成的新版本。
- Analysis：按分析用途、cohort、語料或split組成的版本。
- Export／Sharing：另經目的、權利與揭露風險審查的匯出版本。

研究代碼化不等於匿名；日期、地點、小班級、罕見屬性、語音、影像與文本仍可能識別人。隱私掃描是檢查協助，不是匿名認證。[S2]

分析必要covariates不為「刪個資」而任意刪掉；依用途最小化、限制存取或另作sharing版本，保留治理決策。直接識別碼與對照鍵不得進一般分析release。授權分析需要的受限細節，用獨立受限附件與明確用途，不由一般AI開啟。

繼承實際Consent／DMP／機構規定。撤回、到期、合法刪除或機構保留要求分開記錄；不可變原則不等於永不刪除。必要處置交由獲授權隱私管理流程，停止相關分享／使用、使受影響release失效，保留最小必要處置紀錄；不得為保留audit而在一般log複製應移除的敏感值。

單純倫理文件「招募期已到」不自動推論既有資料分析不合法，也不能直接認定可繼續；以文件的資料使用條件、期限與機構判定決定。應確認者標UNKNOWN並限制作業。

---

## 6. 來源清冊、完整性核對與固定輸入

本轮建立或重用DataCatalog、SourceScopeManifest、SourceVersionFreeze。對來源清單逐一驗證：實際asset／record version、bytes／rows、hash、Schema、Instrument、Protocol、DataDomain、用途權限、來源日期與匯入批次。

若第十二階段只有動態表或可變檔案參考：以一致資料庫快照／MVCC讀取、storage版本或授權的immutable匯出建立固定source scope。沒有既有hash可以對已取得bytes「從現在起」計算並註明時間；不可反推歷史未被修改。Checksum只能檢查相對基線的完整性，不單獨證明資料真實性。

Raw hash不符、檔案缺失、同意範圍不符或未知來源：Quarantine並建立Issue。不能直接下載另一版假裝是原版。磁碟路徑不是授權憑證，所有讀取server端驗ACL。

保留Pilot、合成、dry run與正式資料的domain標籤。預設本階段不將Pilot改標Formal。若上游已有合法且明確的internal-pilot納入方案，只能引用經採用的獨立決策並保留pilot origin；不能本輪臨時自動合併。

凍結之後新資料或更正到達：建立新input manifest與新準備版本，標示影響，不自動吸入正在運算或已鎖定的資料集。資料版本不可透過「使用最新版」偷偷置換。

---

## 7. Canonical Data Dictionary與Source Mapping

字典按研究元件與資料版本管理，而不是全站只有一份。至少保存：
`variable_id、canonical_name、label_zh/en、rq_ids、construct_id、item/event_id、instrument_version、source_field、source_asset_ref、type、unit、scale、allowed_values、sentinel_codes、missing_reasons、measurement_level、timepoint、grain、role、privacy_classification、value_origin、transformation_ref、version`。

Mapping列出一對一／一對多／聚合對應、單位變換、編碼與版本適用條件、join鍵、來源定位、採用者及理由。保留來源欄位原名與值，不用AI猜測覆蓋。

重要規則：
- source `0012` 若為ID必須保留字串及前導零。
- 逗點小數、千分位、日期日月順序、百分比的0–1或0–100，需要來源locale與定義，不能只憑字串猜。
- 0可能是有效值；空字串、NULL、文字「無」、99、-999與NaN不能全域合併。
- kW與kWh、mm與µm、秒與毫秒、濃度單位等必須按來源定義；轉換不只改欄名。
- Observation grain先定義：人、訪視、題項、事件、感測點、班級、樣本或實驗run；不得把一個人多事件列當多名受試者。
- 同名欄位來自不同工具／語言版本，不自動視為等價構念。

AI可建議mapping與差異，採用依FieldPolicy；高風險語義映射未確定時保持UNKNOWN，導向來源或人工確認。

---

## 8. Cleaning Rule Registry與合法自動化範圍

每個Rule保存：id／version、類型、目的、適用cohort／asset／instrument／timepoint、輸入、typed參數、前置條件、輸出、assertions、來源／手冊、AnalysisPlan關係、decision時間、資料接觸狀態、review者、允許自動執行範圍及異動影響。

區分：
- Mechanical normalization：格式、已確認單位與字典轉換。
- Source correction：需連到上游真實CorrectionRecord。
- Scoring／feature derivation：從已核准規格計算。
- Exclusion／cohort decisions：保留明確理由與可用性範圍。
- Statistical/model-dependent處理：送第十四階段按AnalysisPlan執行，不假裝是一般清理。

Preview顯示影響筆數、變數、前後值例、缺失及資料domain；前後值需權限遮罩。預設不自動採用未知規則、不預設刪除超過3SD資料、不默認complete-case、不見缺失就平均補值。

選擇看過結果後建立的新規則，保存post-data decision，不能回填成事前規劃。[S3] 內部鎖定不等於預註冊；如果只是修正程式bug，不一律錯標新研究假設，但必須保留修正理由與受影響結果。

Rule變更建立新版本；已核准舊版不改。新版本是否成為採用版，要通過鎖與用途權限，不讓AI切換active pointer繞過人工鎖定。

---

## 9. Query、來源更正與資料裁決

沿用第十二階段Data／Protocol Issue。可擴充DataQuery與Adjudication，不重建兩套待辦。

每筆Issue含來源asset／row locator、相關unit/session、問題、影響欄位與RQ、嚴重性、due_event、blocks_actions、人工／source／program可處理方式、owner與return_context。

Resolution包括：SOURCE_CORRECTION_ACCEPTED、VALUE_CONFIRMED_VALID、RETAIN_WITH_FLAG、EXCLUDE_FOR_NAMED_ANALYSIS、NOT_RECOVERABLE、DEFER_WITH_LIMITATION。原始問題與所有回答均保留；「已點導航」或AI說完成不算解決。

上游DataCorrectionRecord只有在真實授權與來源確認滿足時，pipeline把已採用修正套到新Clean版本。Raw不改，未採用修正不默認生效。同一cell多筆互相衝突的更正不可用latest-wins。

Metadata確定錯誤可依授權一次批次處理；影響納入、Primary Outcome或資料使用合法性的裁決，需具權限研究者決定。AI不能替機構核准，也不能接受風險來跳過法律／安全限制。

尚未解決的非重大Issue可以隨release揭露；關鍵來源缺失／cohort不明或privacy禁止使用不能僅靠總分抵銷。

---

## 10. 重複、範圍、邏輯、連結與時間品質

先定義expected key及record grain再檢查duplication。區分傳輸重送、重測、同受試者不同時間、同事件不同來源、多評分者與真正重複。可按採用規則在派生資料選定代表紀錄，Raw與未選定紀錄依權限保留，不直接drop_duplicates當科學決策。

檢查：資料型別、range、跨欄邏輯、序列／時間、tool版本、study arm、site、cohort、outcome可用性、missing event及sensor中斷。異常值只先flag，不等同錯誤。

Join使用明確cardinality：one-to-one／one-to-many；many-to-many預設需解釋與授權。保存join前後rows與unique units、unmatched keys、duplicate key報告，避免班級／問卷合併造成樣本倍增。

時間處理保留原timestamp、timezone、offset、clock來源，另產生canonical時間。時間窗由Protocol或採用方案定義；T2晚到不能直接改T1。跨國夏令時間、只有本地時鐘、感測漂移需標示不確定。錯位修正保存算法、錨點與修正量。

Dashboard只顯示品質檢查或適用blind label，不默認組間Outcome圖、p值與效果以影響清理決策。

---

## 11. Missing Data：分類與後續處理，不把缺值補成事實

保存原missing碼與原因欄，至少區分：NOT_COLLECTED、DEVICE_FAILURE、SKIPPED_BY_DESIGN、NOT_APPLICABLE、REFUSED、LOST_TO_FOLLOWUP、INVALID_READING、BELOW_DETECTION_LIMIT、UNKNOWN。實際enum依資料適用性擴充；未查明原因不要自動推斷。

品質報告分母明確：預定活動、實際施測或應回答題數；跳題與不適用不能全算漏答。給出缺失筆數、受影響unit與變數可用性，不自動斷言MCAR／MAR／MNAR已確定。

本輪預設不做統計插補：不做全域平均補值、LOCF、為平衡樣本補問卷答案或合成Participant。主Analysis Dataset可合法保留missing，附解析與AnalysisPlan處理義務，不能以「還有null」一律阻擋鎖定。

區分三類：
1. Source有真實回答，只因解析失敗：來源更正，不是imputation。
2. 正式工具手冊明定的缺題計分／折算：按已採用ScoringSpecification產生衍生score，標明方法，不把缺答Raw改有答。
3. Multiple imputation、IPW、依模型估計的缺失處理：本輪交接設定／eligibility與來源，第十四階段執行適用模型、保存多個資料版本與pooling。不能先平均成唯一完整表，也不得以此形成循環Gate。

Sensor短缺口插值如確有預先核准的technical recipe，可在獨立派生signal生成，保留observed mask、方法、最大gap及品質flag，與正式推論插補分開。

---

## 12. Outlier、品質排除與分析用途範圍

建立Outlier／AnomalyFlag，不自動視為錯誤或剔除。依可驗證來源、設備限制、量程、預定規則與分析假設決定處理。

排除只能生成versioned InclusionDecision，保存：適用analysis_id／RQ、unit／observation scope、原因、決策者、時間、資料接觸狀態、來源與被排除資料reference。

區分：無法使用／權限不符、資料品質、Protocol deviation、分析模型條件與敏感度方案。一次session無效不代表該參與者全部資料無效。

Winsorization、截尾、轉換或更改門檻均不得以「讓結果更顯著」為目標。需要時建立預定／合理修訂方案與獨立資料版本，不覆蓋原始量測。保留極值不等於所有模型都適用，後續由AnalysisPlan檢查。

不能預設缺任何欄就刪整人、缺追蹤就刪baseline、以組別表現決定清理規則。已無法補救的資料不足，誠實記錄並回研究設計判斷可回答RQ，而不是AI補齊樣本。

---

## 13. 正式計分與衍生變數：重用第十階段引擎

將第十階段ScoringSpecification與沙盒preview engine擴充為授權正式資料運算；不得再讓LLM重新撰寫一套計分算法。

按來源instrument／language／scoring version逐批路由：先判斷missing／invalid／skip，再做反向題，再分量表／加總／按手冊折算。1–5有效反向值可用6-x僅在該spec明定時；99缺失碼不能被算成-93。避免欄位已反向又再反向，以recipe step ID及已施作來源紀錄去重。

DerivedVariable至少保存：定義、單位、輸入變數及版本、typed expression、計分來源、處理順序、precision、missing rule、參數、value_origin、output metadata與lineage。

可支援：知識測驗分數、rubric組成、前後差、指定任務完成時間、事件計數、sensor window feature、已確認單位轉換。百分比變化的零分母需明確策略，不能輸出無限值當有效觀察。

分組／標籤／cut-off／及格值只從來源或已採用設定帶入，不能AI編造。不同工具版本有修改題意或不同題數，保留版本並提出等化需求；不能只因標題相同就直接合併score。

所有計分數值由程式產生，保留run、inputs、rule與environment。正式資料結果標記DERIVED_FROM_FORMAL；fixture標記SYNTHETIC_GOVERNANCE_TEST，嚴禁混用。

---

## 14. 跨時間、跨場域、教學、感測與環境資料準備

### Longitudinal／Multi-site／MOE_TPR
以stable study code＋site／class／session／timepoint連接；long↔wide轉換保存規則、uniqueness與row manifest。區分未來尚未到期、未開課、失訪與問卷缺值。

課程資料与研究同意分層；公開於LMS不代表研究可用。成績釋出依既有grade release rule；未參與研究者、未同意錄影或未同意特定二次用途者，不能因分析方便納入。需保留班級／教師／場域群聚鍵，但採適当假名及受限存取。

### Sensor／Event Log
由已採用recipe完成格式、校正參考、timestamp同步、artifact flag、windowing、事件session化與衍生特徵。保存濾波器、取樣率、padding／邊界、同步錨點、缺口遮罩與資料覆蓋；不能無依據平滑掉不利訊號。先保留可追溯signal，再依capability提取feature；不支援設備檔案就明確UNSUPPORTED。

### 環境／能源／職安／製程
保存採樣單位、批次、位置代碼、校正、chain of custody、檢出／定量下限與censoring flag。低於偵測限不自動改0或LOD/2。

kW為功率，kWh為能量；從功率積分成能量要明確時間間隔、gap policy及單位。設備高頻列不能當獨立N。工件、樣本、機台與process run關係不能遺失。

這些都是本研究資料準備規則，應有方法來源與採用紀錄，不因網站支援就自動適用每個研究。

---

## 15. 質性、文件與混合方法語料準備

支援Analysis-ready Corpus而非強制一張數值表。

原音訊／影像／逐字稿分開；保存錄製、transcription來源與版本、speaker pseudonym、timecodes／段落定位、校閱狀態與權限。自動轉錄是AUTOMATED_DRAFT，不等於真實逐字稿已核對。

AI可建議隱私遮罩、文字辨識錯誤與整理metadata，但不得改寫參與者語句使其「更學術」、補造缺段或產生正式themes。聽不清保留標記；非必要個資遮罩保留受限對照，不能在一般log外洩。

語料元件明確scope：哪些訪談／反思／文件納入、來源版本、權利與排除理由、單位與codebook候選reference。論文或政策文件作研究對象時，研究Corpus與外部理論Literature角色分開，但可引用同一合法asset。

Mixed methods只準備量化—質性安全link鍵與共同metadata，不在本輪形成混合推論結果。分析時需要的coding、reflexivity或case資訊保留，但不將探索性coding scheme假稱已驗證結果。

---

## 16. AI／ML／RAG資料治理與防止洩漏

沿用既有split manifest與experiment配置，不重新隨機切分以改善表現。先明確以person／site／document family／sample／time作切分單位；同人多張圖、同文多chunk、同run重疊window應依設計避免跨集合洩漏。

Deterministic、與資料分布無關的合法格式轉換可以先做。需要fit的scaler、imputer、feature selector、embedding調參、目標編碼及降維，不能在全資料上fit後再切。對cross-validation必須fold內fit；validation/test不作訓練統計來源。[S4]

本輪建立未fit的PreprocessingRecipe、split/fold要求與capability，按既有計畫必要時保存training-only參數並記錄fit scope；模型學習、選模、超參數調整與正式效能留下一階段。不能用本輪「清理成功」作模型performance。

如上游沒有切分方案，建立待採用計畫與blocked actions；可以保存clean candidate，不許自動造正式test split與通過狀態。

RAG／LLM：test答案不得漏進retrieval corpus、prompt examples或評分參考來源。保存corpus／prompt／judge/model version、label／human annotation來源、污染風險；未知預訓練語料不能宣稱已排除所有contamination。

合成或pseudo labels保留來源，不冒充人工gold label；正式sample計數、資料品質与模型研究結果分開。

---

## 17. Analysis Cohort、資料集與可用範圍

Clean Dataset保存合法可保留的研究紀錄與品質flag；Analysis Dataset以已採用cohort、AnalysisPlan與指定RQ組裝，不等於把「不好看」的列刪掉。

每個AnalysisScope保存：analysis_id／RQ、confirmatory／secondary／exploratory、資料接觸狀態、inclusion/exclusion規則、unit／observation grain、時間窗、outcome与covariates、group mapping、missing treatment obligation、權利及版本。

不強制ITT／per-protocol等名詞到所有研究；適用的分配群與分析群依實際設計與計畫定義。不得悄改原分組。預定但無法執行的分析標NOT_EXECUTABLE_WITH_AVAILABLE_DATA，附原因與修訂提案，不補造資料。

不同RQ可用不同分析scope；一個次要outcome缺失，不一定阻擋其他合法且完整的scope。選定required scope才決定整階段Gate；被移出本次required範圍要有真實決策與對主要結果影響，不能由AI降成optional來掩蓋失敗。

保存counts的分母及粒度：enrolled、eligible、consented、available、included人數，與observation／session／sensor point數分開。資料準備只產生analysis inclusion summary，不提前判斷假設。

Analysis Dataset可含多張關聯表、派生feature、Corpus及split manifest。v1.0表示本次首個正式release，不強制對每個專案重置成同一版本號。

---

## 18. 真正可運作的Transformation Pipeline與重現性

建立或擴充 `DataPreparationService`，在既有安全worker執行，AI不直接持有Raw寫入權。

本輪最低可用路徑：CSV及JSON/JSONL真實解析 → 固定來源 → 型別／單位映射 → sentinel／缺失分類 → 結構檢查 → 既有計分 → 衍生變數 → Clean與Analysis candidate → Manifest／Report匯出。XLSX、Parquet、感測檔等可沿用可靠parser；沒有adapter明確標不支援，不假装成功。試算表公式與macro不自動執行，對formula cached value保留來源與解析狀態。

Pipeline為版本化DAG，每節點typed inputs、allowlisted operation、param schema、spec refs、assertions及預計影響。不得把LLM文字交給eval／任意SQL／shell；進階自訂程式需人工審閱、隔離環境、限制filesystem/network、CPU／記憶體／逾時與套件版本。

每次run保存：source manifest/hash、rule版本、cohort、code commit／script hash、dependency lock／container digest、seed（適用）、locale、timezone、排序、每步前後counts、warnings、output paths/hash、開始結束與執行者。失敗run保留狀態与非機敏錯誤，不只保存成功。

相同凍結輸入與確定規則重跑應有相同logical content hash；檔案若因timestamp／序列化metadata而bytes不同，另存byte hash與canonical content hash。浮點或非決定性操作設定合理且有理由的tolerance，揭露無法bitwise重現部分，不宣稱所有運算必然相同。

工具test先跑fixture，正式data需独立authorization。分塊大檔可恢复checkpoint，內容中斷不能回報完整成功或遺失既有版本。

---

## 19. Data Quality Report、lineage與方法證據包

建立 `DataQualityReport`：來源完整性、unit與row counts、字典mapping、missing原因與分母、重複與裁決、range/logic、版本分層、privacy、sample flow、計分與派生、unresolved issues、checks清單及runtime coverage。

缺失／異常統計可作診斷，但預設不揭露blinded arm的效果；任何圖示標DATA_PREPARATION_DIAGNOSTIC，不是Publication Result。null不是0；沒有資料就顯示尚無真實QA資料，不放示範數字。

不採一個「資料品質100分」保證可分析。可有透明check coverage，但輸入完整、結構有效、用途合法、模型適用與測量品質分開。研究測量信效度或missing機制推論不由本輪QA完成。

lineage最低可查：analysis欄位／record → input field／source locator → correction／rule → transform run → code/environment →原source asset/version。聚合輸出附可追溯member set/window索引；大資料可分區再鑽取，不只畫漂亮箭頭。[S1]

`DataPreparationEvidencePackage`包含：來源manifest、dictionary、mapping、rule manifest、query/adjudication、cohort、counts、DMP及用途制約、run log、lineage、QA、open issues、方法引用與版本清單。

資料準備說明可由老麥根據已執行run起草，未做的步驟只列計畫；此說明可供未來Methods引用，但本輪不生成整篇論文或研究Results。

---

## 20. 文獻與證據中心、Consensus與Zotero

方法／計分／缺失策略／訊號处理需要文獻時，沿用 `EvidenceNeed → 文獻與證據中心 → 既有Consensus及其他API adapter → Project Evidence／CitationSource → Zotero references → 返回原Rule或Issue`。

本輪不重新建立API connector、不每次呼叫全部服務，不為查方法把研究資料行或敏感逐字稿送到文獻搜尋API。送出的query只含必要方法描述並遵守預算。[S6]

保存source locator、文獻版本、實際read scope、supports／conflicts與用途。摘要不假稱全文，人工作業與AI處理範圍分開。同篇多平台不重複當獨立依據。

Zotero reference以library type/id＋item key＋version識別；item key不等於citation key。不因本輪匯出就自動全庫寫入，不把Raw、學生成績、內部Query或pipeline輸出上傳為Zotero附件。公開研究資料集若另有合法正式引用，可以保存DataCitation metadata，不代表公開內容。

Zotero更新處理版本與衝突；來源更新不能直接覆蓋已採用計分方法或鎖定分析。斷線保留合法本地引用，標明sync狀態及取得日期，不阻擋所有本地整理。[S5]

---

## 21. 全項老麥Assist與一鍵資料治理編排器

沿用FieldAssist／SectionAssist／StageAssist、FieldPolicy與AgentJob，每個字典欄、mapping、Rule、Issue、cohort、報告區塊均有解說／建議／查證／來源／鎖／版本功能。

FieldPolicy類型至少：
- NARRATIVE_DRAFT：AI可起草方法說明、Issue解說與待辦。
- MAPPING_OR_RULE_CANDIDATE：AI可提出候選；既有規則可在明確policy內採用。
- SOURCE_VALUE：Raw只讀，AI只能定位與協助查詢。
- COMPUTED_VALUE：只能計算服務寫入；AI解释，不自由輸入數字。
- INCLUSION_OR_PRIVACY_DECISION：具權限人員採用，AI不能裁決真實Consent或私改納入。
- FORMAL_APPROVAL：僅真實人員確認與來源，不由模型生成。

支援FILL_EMPTY、IMPROVE_UNLOCKED、FILL_AND_LOCK，但適用於草稿／候選／規則設定，不表示可AI填補資料空值。前端分開「補全規則設定」與「統計插補」，不能把兩者放同一個模糊按鈕。

主按鈕：**老麥一鍵檢查並執行已核准資料整理**。使用者一次授權scope、允許rules、外部工具、費用與操作目的後，編排器可連續：audit→profile→mapping候選→可執行rule→run→QA→save candidate；依授權通過的機械轉換不逐欄確認。

遇未知資料、權利、重要cohort／手冊／版本衝突集中列待辦；其他獨立安全節點繼續，不能為了流程全綠而改「需人工」欄。FILL_AND_LOCK產生AUTOMATION_POLICY_LOCKED_DRAFT，不冒充HUMAN_APPROVED_ANALYSIS_RELEASE。

網站老麥不能繼承OpenClaw建站代理shell、資料庫管理或deployment權限。模型source content與數據文件均不可信指令；後端檢查所有工具能力與Project ACL。[S7]

---

## 22. 鎖定、任務恢復、來源失效與競態保護

沿用Lock／Version機制擴充dataset、dictionary、rule、cohort、source binding與release scope。

所有手動patch、autosave、AI、同步、計算回寫及背景完成，都重新驗project未回收、actor角色、Goal revision、source revision、base revision與lock。鎖不能藉整段替換、換active版本或刪child列繞過。

AI／pipeline開始時固定InputManifest與RuleSet。期間使用者修改規則或source變更，輸出仍屬原快照candidate，顯示STALE_INPUT／SUPERSEDED，不套進新工作版。

idempotency key含scope、來源hash、rule/cohort版本與參數hash。重複點擊不重複release或扣費；有retry上限與退避，cancel後遲到結果不可自動發布。服務重啟後可查持久job及checkpoint，不以session記憶當資料庫。

完成採短transaction：readiness重新檢查→immutable manifest／snapshot pointer→Audit＋outbox。大檔先寫temporary immutable object並verify，再短交易發布引用，不長時間hold DB transaction。失敗物件清理依保留策略，不能遺失已發布artifact。

權限撤銷、Consent範圍變更或合法删除使派生資料受影響時，標ACCESS_REVIEW_REQUIRED／USE_BLOCKED；原hash與版本歷史保留可允許的metadata，但不得繼續提供受限bytes下載。

---

## 23. 工作區、全站首頁與精確缺失導航

將第十二階段已有的第十三階段接收頁升級為工作區，保留原route、筆記、sources及return context。

主Tabs建議收斂為：總覽、來源與字典、規則與執行、問題與裁決、專屬資料處理、資料集與範圍、品質與追溯、鎖定與交接。特殊研究模組按類型展開，不塞數十個空Tab。

頁首顯示：目前Project／Goal、source scope、工作模式、資料版本、實際readiness、隱私級別、受阻動作、最後保存與一個Next Best Action。空資料不顯示假數字。

沿用首頁未完成專案選單、儲存／讀取、新增、功能解說、全流程圖及底部回收按鈕。切換Project時，mapping／dataset／chat／jobs／query完全隔離；晚到回應不顯示在新專案。

每個Issue帶安全typed navigation target：project_id、scope_id、entity_type/id、tab、field／row locator及return_context。按鈕展開並聚焦正確欄位；row preview依ACL遮罩，不把PII寫入URL。

例如「某題99缺失碼與反向規則衝突」→前往該Instrument Scoring欄／方法来源；「Join造成重複unit」→前往key mapping；「資料未獲該用途同意」→前往第九／十二階段原紀錄。

保存後提供 **保存並返回資料治理**，後端重新跑適用檢查才解除問題。找不到欄位的舊版本導航顯示對應差異及安全fallback，不能只跳模組首頁或空白頁。外部return URL需allowlist，不接受任意跳轉。

---

## 24. Readiness、簽核、燈號與下一步，不形成循環Gate

分开module_health、project_stage_state、job_status、evidence_status、access_status、release_state。網站完成驗收，不等於任何研究資料已清理完成。

三層Gate（名稱映射實際registry）：

1. **DATA_GOVERNANCE_INPUT_AND_RULES_READY**：source可讀／範圍固定、字典mapping與需用規則已採用、使用權與隱私檢查滿足本次處理；可先開規劃不等於通過正式Gate。
2. **CLEAN_DATASET_SCOPE_VALIDATED**：真實pipeline成功、有checks與lineage、Query已處理或具範圍限制、計分符合版本、Raw未覆寫；允許missing與合法保留flag，不要求「0缺失」。
3. **ANALYSIS_DATASET_LOCKED_AND_HANDOFF_READY**：選定required Analysis Scope完成，cohort與RQ變數對照清楚、no unresolved critical blockers、QA與reproducibility通過、使用限制／late actions列明、必要真實簽核、snapshot持久化。

一般操作權限不等於release approval。按機構／專案配置signoff role（PI、資料管理、統計／方法審阅、隱私如適用）；不用固定要求三個不同人才能使用，也不得冒充未存在人員。單人專案可由同一有權人履行角色，記錄同人簽核與審阅限制。

狀態：PLANNING_ONLY／SOURCE_REVIEW／RULES_INCOMPLETE／PROCESSING／QUERY_REQUIRED／CANDIDATE_READY／READY_FOR_REVIEW／LOCKED_FOR_ANALYSIS／REVALIDATION_REQUIRED／BLOCKED。

首頁綠燈僅代表選定scope的Analysis Dataset準備與鎖定完成，不能表示結果成立、IRB核准或論文完成。完成用文字＋勾；待查用黃燈＋具體項目；blocked用紅圖示＋受阻動作，不單靠顏色。

按鈕：
- 已鎖定：**完成資料治理，前進「分析實驗室 Execution Mode」→**。
- 候選需審阅：**檢查資料品質並核准鎖定**。
- 可規劃但尚未正式release：**保存治理規劃並查看分析準備**；下一stage僅規劃，不授正式Execution。
- 有當前缺失：**尚缺N項，前往補足**＋**老麥協助處理可自動項目**。
- 執行中：查看進度／取消。
- 下一stage未建：保存交接與顯示已接收摘要，不跳空白。

正式模型估計／效能／插補與pooling在下一階段，不要求先完成它們才能release含missing與recipe的資料。不能藉條件式handoff放行未授權或不可用的Primary Outcome。

---

## 25. 匯出、資料集版本與使用限制

真正產生可讀取的artifact，不能只回傳虛構URL。最低交付：DataDictionary、mapping／rule manifest、QA report、lineage、Analysis Manifest、採用cohort及一種結構化Analysis資料格式；對Corpus交付index與有權引用，不強制表格。

可用JSON、CSV／Parquet依實際能力；中文CSVencoding、ID前導零、missing碼及decimal precision需round-trip測試。CSV防公式注入時在export view安全處理並附格式說明，不改研究source。XLSX或文件匯出有現成安全引擎就重用，不為本輪換全套office服務。

Source／Clean／Analysis各自不可變版本與manifest，語義dataset version和UI字段編輯lock分開。舊版不直接刪掉或覆蓋；需要回復時切換「採用的有權版本」並保存decision，不更改歷史。

`LOCKED_FOR_ANALYSIS`不等於允許公開、下載到任何人或上傳repo。下載前每次驗用途／ACL，signed URL短效且不可在普通log保留token。Sharing另有Consent、license、risk review與去識別化版本；本輪不自動發DOI或公開上傳。

DataPreparationReport與方法引用可以匯出；學生成績、受保護題項、身份映射、音視訊及某些工程機敏資料需要不同權利。不得把共用zip當成所有使用者都可取得的完整備份。

---

## 26. 第十三→十四階段交接契約

輸出 **DataGovernanceSnapshot**；可在現有模型採名稱別名，但必須有schema、version、source_manifest及consumer tests。不得冒用舊版Manuscript交接或要求下一stage先有研究結果。

下列為契約欄位，不是本次執行過的研究資料；必須將其轉成repo內實際JSON Schema／typed contract並用fixture驗證：

```text
DataGovernanceSnapshot
  schema_version / snapshot_id / project_id / workspace_id
  stage_key = V3-U13
  goal_context + revision
  input_formal_execution_snapshot_id + revision
  scope_id / cutoff / data_domain / planning_or_formal_mode
  adopted_protocol_refs[] / instrument_refs[] / scoring_refs[]
  analysis_plan_refs[] / preregistration_refs[] / temporal_disclosures[]
  source_scope_manifest_ref + hash + verification_time
  source_asset_refs[] + revision + domain + access_classification
  dictionary_ref / mapping_ref / rule_set_ref
  transformation_run_refs[] + environment + code_hash
  correction_and_adjudication_refs[]
  clean_dataset_refs[] / derived_dataset_refs[]
  analysis_scope_refs[] / cohort_refs[] / unit_and_observation_counts
  analysis_dataset_refs[] + version + content_hash + file_manifest
  qualitative_corpus_refs[] / sensor_log_recipe_refs[]
  ai_split_manifest_refs[] / fold_safe_preprocessing_recipes[]
  missingness_summary / outlier_flag_summary / exclusion_summary
  deferred_statistical_processing[] + due_stage + blocks_actions
  query_summary / unresolved_issue_refs[] / constraints_by_scope[]
  privacy_usage_decision_refs[] / withdrawal_disposition_refs[]
  evidence_links[] / citation_refs[] / zotero_refs[]
  quality_report_ref / lineage_manifest_ref
  data_preparation_evidence_package_ref
  signoff_records[] / release_decision / access_constraints
  locks_manifest / source_dependencies / created_by / created_at
  next_stage = V3-U14
  allowed_next_actions[]
```

規則：
- 必填技術欄有實值，unknown科學／權利資訊保持null與Issue，不填空字串假裝完成。
- 只有reference与可授權metadata；不可把PII、Identity Vault原文、完整Raw列嵌入snapshot或一般模型context。
- U14取得指定Dataset版本與hash，不自動讀latest；輸入schema不支援、來源已撤權或release未核准即拒絕正式Execution。
- 延後插補／模型前處理是正式任務義務；U14必須按AnalysisPlan與fit scope實作，不當成本階段遺漏無聲跳過。
- 異動重大RQ／分組／主分析只能ChangeProposal回原模組，不重寫原藍圖使其看似一開始就如此。
- 存檔與handoff outbox具冪等性；navigate失敗可打開同snapshot，不重跑整個pipeline。

第十四階段尚未建：建立真實receiver，顯示資料版本、scope、可用RQ、QA、限制與待辦，只允許查看／規劃；不顯示假的分析已完成。U14未建不阻擋本階段合法鎖定與保存。

---

## 27. 最小資料模型、API能力、安全與錯誤類型

優先擴充既有模型，不要求每個名詞都一張新表。可組合：

- Intake：GovernanceWorkspace、SourceScopeManifest、DatasetVersion。
- Semantics：DataDictionaryVersion、FieldMapping、CleaningRuleSet、DerivedVariable。
- Process：DataPreparationRun、TransformationStep、DataQuery／Adjudication、LineageEdge。
- Scope：AnalysisScope、CohortDefinition、SplitManifest、CorpusManifest。
- Assurance：PrivacyUseDecision、DataQualityReport、ReleaseSignoff、DataPreparationEvidencePackage。
- Handoff：DataGovernanceSnapshot、StageDecision、Outbox。

原Project／Goal／RQ／Construct／Instrument／Protocol／StudyUnit／Consent／Raw／AnalysisPlan／Literature／CitationSource／Zotero／Job／Lock不可重建第二套。

API配合現有框架：
`initialize/resume、get workspace、source audit/freeze、dictionary/mapping/rules typed patch、assist job、pipeline preview/execute/status/cancel、query adjudicate、cohort adopt、validate、freeze/release、export、complete/handoff`。

write需expected revision／ETag等價機制、field allowlist、巢狀ACL與審阅Policy。候選AI與正式計算輸出不同role。不得將client傳來project、owner或role當授權結果；背景worker也要以授權scope執行。

限制解析大小／型別／壓縮展開／file path，防path traversal、惡意CSV公式、巨量檔案、HTML／XSS、upload macro、pickle反序列化、內網URL SSRF及任意SQL。Service帳號read Raw、write derived only，不能由chat開任意檔案或寫任意bucket。

error最少：HANDOFF_SCHEMA_UNSUPPORTED、UPSTREAM_REFERENCE_MISSING、SOURCE_HASH_MISMATCH、SOURCE_ACCESS_REVOKED、DATA_USE_UNVERIFIED、PROJECT_ACCESS_DENIED、PROJECT_TRASHED、REVISION_CONFLICT、LOCKED_FIELD、INPUT_VERSION_STALE、SCORING_SPEC_MISSING、JOIN_CARDINALITY_ERROR、FIT_SCOPE_VIOLATION、PIPELINE_UNSUPPORTED_OPERATION、COMPUTE_UNAVAILABLE、RELEASE_BLOCKED、HANDOFF_SAVE_FAILED。每種帶安全訊息與導航，不用HTTP200假成功。

---

## 28. 四個實作批次與可用能力範圍

**Batch A｜接收與安全來源**：Stage12 adapter、接收頁升級、三Goal／研究mode、source freeze、privacy／ACL、dictionary及可導航Issue。用fixture與授權資料分開驗收。

**Batch B｜真正可運作的治理流程**：Rule registry、CSV/JSON核心pipeline、Query／correction、missing/duplicates/logic、重用正式計分、cohort、Clean/Analysis candidate與report。至少有可執行非假資料運算結果，不能只有AI回覆。

**Batch C｜專屬資料及智慧操作**：按網站現有能力接入教學longitudinal、sensor/log、qualitative、AI splits與其他元件；Assist、Lock、jobs、預算、精確返回、lineage及匯出。需要能力未實作明確標UNSUPPORTED／BLOCKED，不能用mock偽裝。

**Batch D｜正式release與無斷層交接**：scope驗證、真實簽核、lock、DataGovernanceSnapshot、U14 receiver、consumer contracts、首頁燈號、隱私/重啟/回歸、部署及rollback。

交付Capability Matrix：SUPPORTED_AND_TESTED、SUPPORTED_NOT_TESTED、CONFIG_REQUIRED、UNSUPPORTED。嚴禁把所有研究adapter畫成Available卻只有一份通用CSV處理。通用核心與真實支持能力需完成；非适用項有理由才NOT_APPLICABLE，不能把本案必須能力標N/A以宣稱全部完成。

Demo UI可使用明顯標示的fixture workspace，正式空專案顯示空狀態。provider呼叫失敗與compute失敗分開；機器無R/Python支持時交付安全依賴設定與BLOCKED，不生成假品質報告。

---

## 29. 驗收案例：48項

以下案例都要有可執行測試或明確人工驗收步驟、前提、斷言與實際結果。僅寫測試檔不等於已跑；SYNTHETIC_GOVERNANCE_TEST需與真實研究完全隔離。

### A. 交接與scope（T01–T08）
- **T01** 接收FormalExecutionSnapshot及原筆記／Issue，不重建Project；重入唯一。
- **T02** 上游沒有舊Raw Lock Gate仍可source audit/freeze；不因此卡死，也不補造raw核准。
- **T03** 三Goal、资助／發表共存，cache/job/snapshot不互相污染；不明Goal回錯誤。
- **T04** 尚無真實data可規劃與fixture測試，但正式dataset與研究完成燈號保持未完成。
- **T05** 收集中QA與已批准固定波次scope分開，不擅自放行未規劃中期效果分析。
- **T06** source hash mismatch或missing asset觸發Quarantine／補足導航，不默換來源。
- **T07** 固定scope之後晚到資料／更正只生成新候選manifest，不改running／locked版本。
- **T08** Pilot、synthetic、dry run、formal不能混成正式N或dataset；合法上游special採用也保留origin。

### B. 字典、規則與計分（T09–T16）
- **T09** ID「0012」、中文、decimal locale與單位mapping在round-trip後不失真。
- **T10** 同名欄位不同tool版本不自動合併；未知mapping保留Issue。
- **T11** 99為missing且1–5反向題，輸出missing不是-93；有效端點反向正確。
- **T12** 已反向／已計分欄再重跑不重複套轉換；rule与source version可追溯。
- **T13** Pending或互相衝突CorrectionRecord不自動採用；合法更正只作用新Clean版。
- **T14** 事件多列與真正重送能區分；不任意刪除重复資料或改N。
- **T15** Join造成many-to-many與unit倍增時停止該merge並回報key問題。
- **T16** Score缺手冊／missing rule、零分母或unsupported公式不猜值、不用任意eval。

### C. 缺失、納入與研究類型（T17–T24）
- **T17** 有效0、不適用、拒答、device failure及censored value保留不同語義。
- **T18** 缺失資料不自動平均補值／LOCF；合法missing不被強制填滿才能release。
- **T19** Multiple imputation／模型依賴處理保留deferred obligation，U14契約可讀，不先折成唯一表。
- **T20** 極端值先flag；排除需named analysis與理由，Raw仍在，無為顯著選threshold。
- **T21** 同人多時點與缺T2不刪baseline，不能全域complete-case。
- **T22** MOE_TPR未同意研究／成績未可釋出者不因同班就納入；preserve class key及去識別。
- **T23** 環境檢出限與kW／kWh需要正確語義及時間規則，不自動補0或只改單位名稱。
- **T24** 質性Corpus保存原語句、speaker/timecode與校閱狀態，不改寫成更好看引文、不生成themes。

### D. 權限、AI資料與可重現性（T25–T32）
- **T25** 不同Project／tenant不能讀Raw、signed export或透過row locator取得資料。
- **T26** Identity Vault、直接識別與敏感文本不得進普通AI、Query URL／log或Analysis匯出；假名不標完全匿名。
- **T27** Consent撤回／權限撤銷後，派生release受限且重新評估；依合法處置不以immutable拒絕必要刪除。
- **T28** AI train/test及cross-validation資料：全資料fit scaler/imputer/selector被阻擋，fold-safe recipe可交接。
- **T29** 同人／同文件／重疊sensor window跨split風險被flag；不自行重切以改善表現。
- **T30** 相同固定source、規則與環境重跑logical content hash一致或按已聲明tolerance核對。
- **T31** 大檔分塊、失敗、重啟與cancel可恢復；無半份輸出被當完整正式release。
- **T32** 任意程式、路徑、SSRF／反序列化及公式注入被限制；工具不能寫Raw或讀未授權資產。

### E. 老麥、鎖定與導航（T33–T40）
- **T33** FILL_EMPTY只補設定草稿，不補造研究missing值；computed欄只由引擎寫。
- **T34** 一次授權的approved規則可連續處理；需人工cohort／隱私決策集中提示，不逐格詢問、不擅自批准。
- **T35** 手動／autosave／AI／sync／job均尊重欄、區塊、rule與dataset lock；換active pointer不能繞過。
- **T36** AI／pipeline完成前source或rule被修改／鎖定／取消，遲到結果只保存原snapshot候選。
- **T37** 缺失按鈕直達正確instrument／mapping／query欄，保存並返回後重新檢核才解除。
- **T38** 修改清理方法需文獻時導向原中心；Consensus request不含敏感Raw，Zotero斷線不刪本地引用。
- **T39** UI切Project、刷新、多tab版本衝突與回收後late job不混資料、不復活已回收Project。
- **T40** model_assisted=false或provider unavailable時保留可手動完成的本地規則／pipeline，不假稱AI已查證。

### F. Release、匯出與下一階段（T41–T48）
- **T41** 選定analysis scope所需變數缺失／關鍵用途不符，不能以高品質總分抵銷；其他適用scope獨立處理。
- **T42** 沒有真實signoff不能標人工release核准；自動鎖定仍是候選，單人合法角色簽核如實記錄。
- **T43** LOCKED_FOR_ANALYSIS後不能直接修改；新revision保留舊版並使依賴指標重新檢查。
- **T44** 真實export檔存在、有manifest/hash、round-trip型別正確；含metadata／受限欄的下載依法權限阻擋。
- **T45** 身份/文獻sync、正式機構批准、模型顯著與module測試不影響本階段研究燈號；完成只來自dataset release。
- **T46** DataGovernanceSnapshot JSON Schema及U14 consumer驗證指定dataset/hash/recipe；未放行scope不准正式分析。
- **T47** Complete交易重複請求只產生同handoff；保存成功而導航失敗可重开，不重跑pipeline。
- **T48** U14未建仍有receiver可看scope/QA/待辦；既有首頁儲存/讀取/導覽/刪除復原無退化，手機與鍵盤可操作。

---

## 30. 交付、狀態更新與停止點

完成後回報：
1. 真實repository與環境、架構差異、已重現問題與修復。
2. 新增／修改檔、migration、API、source adapter與相容策略。
3. SourceScope固定方式、privacy／ACL、data domain區隔、dictionary與RuleSet。
4. 計分與pipeline實際支援能力、真實程式／環境、失敗／不支援項。
5. Query／correction／cohort、缺失／異常／longitudinal／特殊資料處理與方法依據。
6. Clean／Analysis候選、quality report、lineage、export與version release。
7. 全項Assist／Lock接入清單：可自動、來源受限、需人工、尚未接入，不冒稱全站完成。
8. 設備／AI／文獻adapter實測狀態，LIVE、MOCK、FIXTURE、SYNTHETIC_GOVERNANCE_TEST、NOT_RUN、BLOCKED分開。
9. 48項適用案例的執行命令、斷言、實際結果、未測與原因；測試資料不冒充研究成果。
10. DataGovernanceSnapshot machine schema、manifest與U14 consumer tests／receiver。
11. feature flag、儲存／備份／恢復、部署限制、known issues與rollback。

更新真實 `PROJECT_STATE.md`：V3-U13範圍、實際完成能力、前後handoff schema、研究狀態是否曾變動、資料權限、inputs/outputs版本、測試證據、下一階段入口及未完成項目。不得把建站完成寫成所有Project已完成資料清理。

停止於可追溯的資料治理流程、選定scope的Analysis Dataset／Corpus及新版第十四階段接收契約。不要自行實作正式統計Execution、研究結果、圖表工作室、全文或投稿。

**人工端到端演示**：用清楚標為fixture的MOE_TPR專案從U12 receiver進入→核對source scope→老麥提出mapping與規則→辨識反向題missing碼、重測及班級join問題→缺失直達原欄修正並返回→鎖定規則→引擎執行→QC→採用cohort→核對report／lineage→有權者確認release→首頁更新→保存U14handoff。再以技術或質性fixture確認不強迫問卷／人數Schema。真實研究放行另依資料與授權紀錄，不用fixture當通過證明。

---

## 附錄：方法及整合依據

以下來源於2026-09-06查閱。它們支持資料準備、來源追溯、隱私與工程控制的原則，並不表示本網站必須符合所有來源所屬國家或資助機構的法規。台灣機構、計畫、資料權利與具體倫理要求須另核對實際文件。本規格狀態名、Gate、API與UI是產品設計，不冒充外部標準。

- **[S1] W3C — PROV-O: The PROV Ontology.** Entity、Activity、Agent與wasDerivedFrom等概念用於lineage。無需為本輪強制另建RDF資料庫。https://www.w3.org/TR/prov-o/
- **[S2] NIH — Principles and Best Practices for Protecting Participant Privacy.** 去識別後仍應按資料及用途評估風險、受控存取、同意與使用條件；此處作設計參考，不作台灣法律判定。https://grants.nih.gov/policy-and-compliance/policy-topics/sharing-policies/dms/privacy/best-practices
- **[S3] Center for Open Science — Preregistration.** 規劃、資料接觸與探索性工作透明揭露；內部lock不冒充外部註冊。https://www.cos.io/initiatives/prereg
- **[S4] scikit-learn — Common pitfalls and recommended practices.** test隔離、preprocessing僅從training資料學習、CV內pipeline及randomness；實作核對實際已安裝版本。https://scikit-learn.org/stable/common_pitfalls.html
- **[S5] Zotero — Web API v3 Syncing.** Item與library版本、同步衝突及選定Collection範圍，不重建同步器。https://www.zotero.org/support/dev/web_api/v3/syncing
- **[S6] Consensus — API.** 既有文獻搜尋adapter的產品依據，實际帳號端點／scope／額度以現有設定核對；不藉檢索傳出原始研究資料。https://consensus.app/home/api/
- **[S7] OpenClaw — Security.** Gateway/session與授權邊界、權限控制及不信任外部內容。https://docs.openclaw.ai/gateway/security
