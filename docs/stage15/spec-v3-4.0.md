# OpenClaw 科研網站 V3｜新版第十五階段完整建置提示詞
## 研究結果整合與證據驅動全文寫作

**版本：V3-U15-FULL / v3.4**  
**接收：新版第十四階段 AnalysisResultsSnapshot**  
**交付：ManuscriptWritingSnapshot → 新版第十六階段「老麥科學內容審查、Reviewer #2與逐項修訂」**  
**編製日期：2026-09-06，Asia/Taipei**

本文件供OpenClaw實際增量建置網站。使用者表示新版第一至第十四階段網站建置完成；這不等於每個研究專案已有真實分析結果。本文件未檢查、修改或部署使用者網站，開工時須以真正repository、PROJECT_STATE.md、DB／API及有效資料為準。

已讀取並對照提供的新版第十四階段規格第20、27、28、29節的Result Fact、release、Gate與交接欄位。舊版Stage13寫作文件僅作功能參考，不能用舊版編號、固定v1.0或舊Gate阻擋本輪。

> 產品核心：一鍵編排來源化写作，不是一鍵創造研究事實。作者能看懂證據、逐段協作、保存及鎖定；數值使用正式來源，引用可回查，全文可閱讀與匯出，完成後精確交接下一階段。

上游核對檔案：`OpenClaw_Research_Site_V3_Stage14_Analysis_Execution_Results_Figures_Complete_v3_4.md`  
上游規格SHA-256：`28f9fc7f468a29e71bd0f2dfc255c0d705beda50322897734160243187f124f2`  
此hash只是提示詞檔案核對資訊，不代表任何真實研究資料或網站驗收已通過。


---

## 1. 本輪任務、交付終點與範圍

你是建站工程代理。本次請實際增量建置網站，不是替使用者直接捏造一篇論文、重建老麥人格，或再新增另一套獨立寫作App。

唯一主流程：AnalysisResultsSnapshot → 寫作權限與來源核對 → 論文範圍與寫作工作單 → 結果敘事與主張證據對照 → 逐章起草與作者協作 → 數值／引用／語義／報告完整性檢查 → 可閱讀與匯出的Scientific Draft → ManuscriptWritingSnapshot → 新版第十六階段科學內容審查、Reviewer #2與修訂。

本輪必須能實際建立稿件、編輯、逐段協作、插入具來源引用與結果、保存、鎖定、重開、比較版本、整篇預覽與匯出。不能只有章節標題、提示詞或按鈕，也不能所有按鈕都呼叫同一個長文生成Prompt。

核心交付是「證據驅動的科學內容初稿」，不是投稿接受保證。已有可靠語言及審查功能可保持可用，但本輪不重建完整翻譯服務、Reviewer Board、最終期刊格式、Cover Letter、Graphical Abstract、正式投稿或投稿後回覆中心。

不改Raw、Analysis Dataset、Result Facts或原先計畫；不自行重跑統計。需要結果修正時建立回送任務。沒有真實結果可做寫作規劃，但不能把規劃、Pilot或測試數據寫成正式發現。

「網站第十四階段建好」與「每個研究的正式分析均完成」分開。不能因工程驗收成功而替任何真實Project自動生成結果或點亮研究完成燈號。

---

## 2. 開工健檢、前十四階段相容與成果保護

找到真正repository、目前分支、未提交修改、PROJECT_STATE.md、網站技術棧、DB／storage／worker／模型服務、登入與專案權限。不要把OpenClaw工作區當成網站repo，也不要憑提示詞假設資料表存在。

先讀新版U14的AnalysisResultsSnapshot schema、consumer tests、U15接收頁；同時查閱U08既有Journal Manuscript Blueprint／Section Writing Workspace、U05文獻與Gap、U06模型、U07設計與分析計畫、U12執行紀錄與U13資料治理。

可靠的Manuscript、Section、Claim、引用、Result Fact Usage、表圖、文獻API、Zotero、Assist、Lock、AgentJob、StageReadiness及匯出元件全部重用；以adapter升級接收頁，保留原筆記與return context，不建立第二份Project或結果資料庫。

既有舊版全文功能及稿件可以映射到新版，但先保留原文與未驗證狀態；不能將手填數值或舊AI全文直接標成已驗證。單列舊版與V3資料映射，不混用舊版第十五階段翻譯的Gate。

先保護程式、資料庫、持久檔案與來源關係，建立可回復基線。在開發／隔離測試環境分批實作；正式migration、部署、破壞性修改、額外付費及資料外傳擴張另取授權。不得清庫、重設登入、關閉ACL或刪除測試換取通過。

Audit列出實際檔案、可用能力、缺口與最小變更。可安全完成的本地功能繼續實作；缺某外部憑證只阻擋對應能力，不以一個外部連線失敗阻斷全部工作。

---

## 3. 精確接收AnalysisResultsSnapshot與結果可用範圍

上游正式完成Gate為 `ANALYSIS_RESULTS_READY_FOR_MANUSCRIPT`；此前有 `REQUIRED_ANALYSES_ACCOUNTED_FOR` 與 `ANALYSIS_RESULTS_VALIDATED_AND_RELEASED`。網站若命名不同建立顯式mapping，不要求舊版Gate或固定v1.0字串存在。

| U14交接內容 | U15用途與驗證 |
|---|---|
| schema_version、snapshot_id、workspace_id、project_id、stage_key | 檢查版本支援、同專案與來源存在，不重新建立Project |
| goal_context、revision、primary_deliverable | 保留三目標與原計畫，明確新增或續寫哪份稿件 |
| scope_id、cutoff、data_domain、execution_mode | 區分正式研究、授權中期、Pilot、測試與規劃 |
| release_state、formal_writing_allowed、allowed_next_actions | 決定可引用哪些結果與可執行動作，不由UI自判 |
| adopted_protocol_refs、instrument_refs、scoring_refs | 方法來源版本；同時核對實際執行紀錄，不能只抄原計畫 |
| analysis_plan_refs、preregistration_refs、temporal_disclosures | 事前計畫、分析修訂與資料接觸時間 |
| work_order_ref、analysis_spec_refs、analysis_change_refs | 實際分析與偏離計畫的原因 |
| dataset／cohort／corpus／split refs與hash | 可追溯方法與分母，寫作代理不因此取得Raw讀取權 |
| run_manifest_ref、run_refs、analyzed_counts_by_run | 實際運算、分析N、觀察單位、分母與環境 |
| result_record_refs、immutable_result_fact_manifest_ref | 唯一正式結果讀取來源，不新增平行Fact庫 |
| qualitative_finding_refs、protected_quote_index_ref | 真實發現與可用引文範圍，不自由生成受訪者說話 |
| ai_evaluation_refs、sensor_technical_result_refs | 技術指標的split、模型／設備版本及限制 |
| rq_result_registry_ref、hypothesis_proposition_decision_refs | 沿用原判讀與其人員核准狀態，不以p值重判 |
| required_analysis_accounting_ref、unperformed_analysis_reasons | 必要結果覆蓋、未執行／不可估計的真實處置 |
| diagnostics、multiplicity、sensitivity、method_limitations | 解釋限制、主次分析角色與敏感度揭露 |
| table_manifest_ref、figure_manifest_ref | 固定表圖版本與可引用範圍 |
| interpretation_candidate_refs、human_review_status | AI解釋草稿與人員採用分開 |
| analysis_evidence_package_ref、analysis_report_ref、QA refs | 寫作依據，不把原分析報告當成已完成全文 |
| evidence_links、citation_refs、zotero_refs | 外部文獻引用與支持來源 |
| privacy_usage_constraints、withdrawal_disposition_refs | 當前用途、引用、外傳及下載權限 |
| unresolved_issue_refs、deferred_writing_requirements | 承接本輪義務與晚期待辦 |
| signoff_records、locks_manifest、source_dependencies | 採用、版本、過期與鎖定保護 |

initialize/resume以workspace＋project＋來源snapshot＋manuscript purpose去重。驗證巢狀資源ACL、hash、釋出scope與當前用途限制；不要使用latest自動替換來源。

PARTIALLY_RELEASED只允許其manifest內已釋出的Fact；其他結果保留缺項。NOT_ESTIMABLE／NOT_TESTED可依真實處置如實寫入，不補數字或宣稱完整證實研究。

`formal_writing_allowed=false`仍可進規劃／匯入整理模式，不因缺正式資料讓整頁不可用；但不能生成正式Results、資料型結論或通過完整科學初稿Gate。

---

## 4. 三目標、文件用途、研究類型與寫作權限分開

沿用 `JOURNAL_SCI_SSCI`、`NSTC_GENERAL`、`MOE_TPR`。研究主要目標、Funding Route、Publication Route、稿件用途、研究型態、工作語言及寫作模式分開保存。

JOURNAL_SCI_SSCI：形成適用文章類型的Research Manuscript；沒有結果時保留前瞻稿件骨架。
NSTC_GENERAL：研究成果可建立期刊稿、工作包成果摘要等關聯；不覆蓋原國科會申請書或把未核定資助當成正式Funding。
MOE_TPR：研究成果可建立教學研究期刊稿，保留真實課程問題、教學介入、學習成果及學生權益限制；不能只將教學心得或滿意度包裝成已證明技能改善。

仍在申請書起草階段的專案，回用U08 Proposal Workspace及其三路線模板；不要為了寫計畫書強制先完成正式研究，也不把期刊IMRaD套在國科會或教學實踐申請表。

寫作存取模式至少：`FORMAL_SCIENTIFIC_DRAFT`、`PARTIAL_EVIDENCE_DRAFT`、`PLANNING_OUTLINE`、`AUTHOR_MANUSCRIPT_IMPORT`、`PILOT_REPORT_ONLY`、`DEVELOPMENT_FIXTURE`。每種模式說明可用內容與不能宣稱的狀態。

量化、質性、混合方法、AI／預測、方法／系統、環境／職安／能源／製程及二手資料研究使用適用adapter。不強制所有文章有H1、CFA、SEM或相同章節。系統性回顧須有真實檢索、篩選與綜合方法來源，不能把U05的探索性搜尋直接改成PRISMA系統回顧。

有權的作者可以從已有稿件入口使用此功能，不必重新跑全部階段。來源尚未映射時維持IMPORTED_UNVERIFIED與待辦，不自動點亮前十四階段或虛構核准。

---

## 5. 論文範圍、作者工作單與多稿件重疊控制

建立或擴充ManuscriptWorkspace及WritingWorkOrder，不新增ResearchProject。每稿保存manuscript_id、目的、主要問題、included RQ／scope／outcomes／results／cohorts／timepoints、target journal或journal family、article type、work language、主要貢獻、上游版本及作者角色。

用ReportingScopeMatrix將上游必要分析逐項歸位：MAIN_TEXT、TABLE、FIGURE、SUPPLEMENT、OTHER_MANUSCRIPT_WITH_DISCLOSURE、OUT_OF_SCOPE_WITH_REASON、NOT_PERFORMED_WITH_REASON。對本稿宣稱處理的主要問題，不得只挑顯著結果；移往補充也要讓正文可追溯。

不同稿件可使用同一資料集，但每篇須有明確問題與貢獻。OverlapAssessment比對研究問題、樣本／資料、核心結果、表圖及文字重用，給出風險及人工審閱需求，不用單一相似百分比直接宣判抄襲或重複發表。

不得要求整個大型專案全部RQ都放進同一篇；也不得讓AI把缺失主要分析降級成「不在範圍」以製造完成。重要範圍變更需有權者採用理由，保留和原scope差異。

一次工作單授權內容範圍、允許的自動操作、來源、語言、字數目標、模型／外部服務、費用上限、可覆写區域及是否自動鎖草稿。自動產生內容不等於所有作者同意投稿。

---

## 6. Target Journal Writing Profile與章節模板映射

沿用U03導航、U08 Journal Research Plan及OfficialRuleSnapshot，不再做一套全量期刊推薦。建立WritingProfile：期刊或領域群、article type、讀者、scope、可用章節、摘要型式、字數口徑、引用格式、表圖位置與適用reporting guideline。

分清OFFICIAL_REQUIREMENT、INTERNAL_WRITING_GUIDE、AI_SUGGESTION；某篇文章的樣本數或寫法不是強制規定。來源保存取得時間、適用版本與失效狀態。未核實的新規則可先用清楚標示的暫定模板起草，不能宣稱正式合規。

統計、Methods與結果報告可参考ICMJE等透明報告原則，但ICMJE以醫學期刊為範圍，不是所有SCI／SSCI必遵的章節或格式規定。[S1]

WordBudget保存正文／摘要／參考文獻／表圖註解分開計數的規則，中文字符與英文詞數不可混用。精簡建議不得刪除必要方法、不確定性或不利主要結果。

更換目標期刊先建立profile/version diff，更新寫作風格與格式待辦，不重寫研究事實。最終索引、APC、送件期限、作者指南、AI揭露與投稿包留後續正式合規階段重新確認。

---

## 7. 三種協作模式與真正的一鍵寫作編排

每章可選GUIDED_WRITING（問題、骨架與來源引導）、CO_WRITING（逐段建議、比較、採用）、EVIDENCE_TO_DRAFT（以固定來源連續起草）。模式變更不改內容來源或核准狀態。

主按鈕：**老麥一鍵協作完成科學內容初稿**。一次授權後執行：工作單核對 → 範圍與必報結果 → 全文論述主線 → 組裝章節來源包 → 依依賴逐章起草 → 機械檢查 → 有限度修補 → 保存候選／草稿 → 集中列必要人員決策 → 產生整稿與證據包。

不把全部文獻、Raw、全文與所有Prompt塞進單一巨大請求。每個SectionEvidencePacket固定來源ID、版本、准用Fact、直接引文範圍、上下文摘要、術語、鎖與不能改變的科學約束；摘要只是導航，不代替原始證據。

每段job保存task_id、來源hash、base revision、prompt/schema version、輸入權限摘要、輸出candidate、QA與成本。checkpoint按段或章保存，刷新或worker重啟可恢復；同payload idempotency不重複付費，不無限重試到看起來成功。

有一段缺文獻不應卡死其他安全章節；可先寫不受影響部分，缺项集中一次呈現。不得為完成率而補造。格式錯誤可有限schema修補，涉及研究意義改變轉ReviewIssue而非無限自動重寫。

預設只補空白；IMPROVE_UNLOCKED只作用於允許的未鎖定內容。FILL_AND_LOCK只鎖通過對應機械檢查的AI草稿，記錄AUTOMATION_POLICY_LOCKED_DRAFT，不偽裝HUMAN_APPROVED。

---

## 8. 全文論述主線、Results Storyboard與章節寫作卡

先建立ManuscriptStoryline：問題為何重要 → 既有知識 → 尚未解決處 → 本研究實際做了什麼 → 得到什麼（含不確定／負面） → 合理意義 → 適用邊界。故事線用來組織論證，不能反向篩掉不合故事的結果。

ResultsStoryboard每列連結RQ、original hypothesis/proposition、分析角色、actual method/run、ResultRecord、Fact、N與分母、interval、表圖、原判讀、限制與報告位置。顯示哪些是未執行、無法估計或僅部分釋出。

每章開啟不是空白：顯示本章目的、應回答問題、段落順序、可用方法／結果／文獻、相關表圖、缺少資料、字數範圍、風險與一個下一步。

ParagraphBrief保存paragraph_id、purpose、claim_ids、allowed_sources、result_fact_refs、terminology、preceding/following context及source coverage。上下段銜接不得新增未支持的因果鏈。

可採Methods → Results → 表圖敘述 → Discussion → Introduction → 結論 → Abstract／Title的預設寫作順序，但這是可調整的產品引導，不是所有期刊規定；閱讀與匯出順序按文章模板。

---

## 9. Result Fact唯讀引用、結構化內容與數值保護

重用U14的Immutable Result Facts，禁止另建第二份可編輯數字來源。正文內用具型別的Reference Node綁定fact_id＋version＋hash、group、timepoint、unit、denominator、metric／contrast及render rule。

內部可有 `{{RESULT_FACT:id@version}}`、`{{CITATION:id@version}}`、`{{TABLE_REF:id@version}}` 等placeholder表示，但持久化主體應是結構化AST／editor nodes或等價typed span，不只靠正規表達式或字串替換維持引用。

生成前保護來源節點，回寫前核對白名單、ID、多重出現的合法位置、無新增未知Fact／Citation。結果節點缺失、ID誤配或被改寫時只能保存失敗候選，不寫回已核准段落。

數值顯示使用受控formatter：完整精度留來源，p的比較符號、調整／未調整、CI／credible interval、level、單位、方向、百分比與百分點、OR與risk ratio均須保持。不得把一個Run的N套到所有段落；不得將0.000四捨五入展示成p=0。

需要新的差值、百分比、合併N、效果量或變換單位結果時，回U14計算或既有受控derived fact服務；模型不能心算補進正文。純顯示格式可依已核准render規則轉換，但須保留原尺度，不能冒充新估計值。

NumericSpanVerifier識別手動輸入的未綁定數值並要求來源；頁碼、文獻年份、模型版本等分類為metadata，不誤當研究結果。機械校驗只能證明綁定一致，不能證明附近語句的科學意義正確，還須後續語義審查。

---

## 10. Claim–Evidence Map：不同主張使用不同來源

建立或擴充ManuscriptClaim與ClaimEvidenceLink。最小欄位：claim_id、section／paragraph、主張文字、類型、source refs與定位、evidence_relation、verification／human_review狀態、推論強度、有效用途、版本與受影響usage。

類型包含BACKGROUND、GAP、THEORY、METHOD、RESULT、INTERPRETATION、CONTRIBUTION、LIMITATION、ADMINISTRATIVE、FUTURE_WORK。連接詞或作者明示提案不要求硬塞外部引用，但重要可查證主張需對應依據或明確標示待證。

來源規則：
- 背景／Gap／理論：既有LiteratureItem、EvidenceItem、CitationSource及確切段落／頁面／版本。
- 方法：實际Protocol／Instrument／Study Execution／Data Preparation／Analysis Run紀錄；外部方法文獻另連。
- 結果：已釋出的ResultRecord、Fact、Finding或核准表圖；不是拿外部文獻替自己結果作證。
- 解釋：本研究結果與相關支持／衝突文獻，並標明機制是否直接測量。
- 貢獻：問題與Gap、相近研究差異、實際結果及其邊界。
- Funding／倫理／註冊：真實行政紀錄與使用者確認，不以LLM生成內容取代。

支持關係至少SUPPORTS、PARTIAL、CONTRADICTS、BACKGROUND_ONLY、UNVERIFIED。多來源同研究不重複計票。來源品質、metadata核對、取得全文、實際處理範圍與人工閱讀分開，不用單一VERIFIED混淆。

引用存在不等於支持句子。範圍過度延伸、數值張冠李戴或將review二手敘述冒充原研究都應生成Issue；無法判定時標需查證，不用AI自信分數消除缺失。[S1]

---

## 11. 寫作文獻補強與既有文獻中心／Consensus整合

寫作中缺乏背景、機制、方法、反證或最新相近研究時，建立EvidenceNeed／LiteratureReinforcementTask，附project、manuscript、claim、角色、檢索目的及return target。

全部搜尋、篩選、阅读與分析仍在既有文獻與證據中心。Consensus及其他已接API按能力、領域、既有授權與預算選用；本輪不建立新搜尋器、不每次全API輪詢、不新增付費訂閱。[S5]

新文獻先進Canonical record及本專案關聯，處理版本／DOI／同研究關係，再建立支持定位與CitationSource。實際使用前確認metadata、可讀範圍、來源更新或撤稿警示；查詢失敗不代表沒有新研究，未查到出版後問題也不宣稱確定沒有。

已有合法本地引用可以使用，不强制每篇都先同步Zotero。臨時斷線只影響遠端功能，不能刪掉稿件或把引用改為不存在。保留來源取得通道、原出版來源與版本，不把Consensus摘要本身當本研究發現。

向文獻搜尋API只送必要研究主題或方法問題，不附完整未公開稿件、Raw、身份鍵、學生成績或敏感逐字稿。機密程度更高時支援審核搜尋詞、僅使用已有專案文獻。

如需原文才能判斷具體機制或結果，標EVIDENCE_LOCATION_REQUIRED／FULLTEXT_REVIEW_NEEDED，允許其他段落先完成，不能由摘要擴寫成不存在的全文內容。

---

## 12. CitationSource、Zotero與真正可更新的引用呈現

重用CitationSource＋library_type／library_id＋zotero_item_key＋remote_version及本地metadata snapshot。Zotero item key、BibTeX key、DOI與網站CitationSource ID是不同識別碼，不互相代替。[S2]

編輯器支援單筆／群組引用、narrative／parenthetical、頁碼／章節locator、prefix／suffix及suppress-author等適用欄位。引用按稿件AST順序、CSL style/version與locale由同一renderer建立，處理作者年份消歧及數字序號重排。

不能把每篇API回傳的獨立citation字串拼接成整篇文獻表；同作者同年、第一次出現、數字重編與群組引用需以稿件引用上下文處理。用csl-json／既有資料與經測試citeproc或等價服務；遠端HTML先清理，不直接插入頁面。[S2]

書目由實際使用citation nodes產生；閱讀清單與正式References分開。沒有DOI也可能合法引用，不能以所有文獻有DOI作Gate。資料集、軟體、官方文件、預印本等按真實類型引用，勿偽造作者或出版頁碼。

遠端書目更新先顯示diff，新採用版本使相關claim／bibliography重驗；不靜默更新已鎖定稿。作者、題名、來源內容的重要變更與單純格式修正分別處理。

匯出能力必須明示：`STATIC_CITATION_EXPORT`（正確格式文字＋metadata清冊）、`BIBLATEX_OR_BIBTEX_EXPORT`或實際測試過的`ZOTERO_LIVE_FIELDS_EXPORT`。Web API格式化書目不會自動等於Word動態欄位；後者屬另需支援的字處理整合能力。[S2][S3]

最小交付包含正確靜態引用、References、CSL-JSON與BibTeX／RIS中實际支持的格式、Citation Manifest。動態Word欄位未實作時如實顯示，不偽裝可在Word一鍵刷新。桌面local API與雲端API不可混接，更不能把server localhost當使用者電腦。

---

## 13. Methods Builder：描述實際執行，不把計畫改成事實

Methods從實際Research Design、採用Protocol及amendments、session-used instrument版本、U12執行紀錄、U13資料處理與U14 analysis_method_record／Run生成。只有計畫資料時以planned/proposed語氣，正式Methods不能直接複製U08未執行方案。

依文章型態組織對象／研究單位、場域、納入排除、招募與同意、分配與盲化、介入與比較條件、工具與量測、時點與程序、資料處理、分析方法、倫理、註冊及可重現軟硬體版本。

每段MethodClaim保留source refs＋實際版本＋定位；核對planned versus performed，包含偏差、未完成追蹤、工具改版與analysis deviations。未隨機不能寫randomized；未盲化不能補寫blinded；未收的變數不能補成控制變项。

引用原量表的信效度與本樣本測得值分開。本研究的品質數值只能取U14有效結果；不能將文獻alpha寫成本樣本alpha。

AI／LLM／RAG或感測器研究需適用的模型、prompt/config、知識庫／split、軟體、硬體、時間與版本紀錄。商用API實際版本未知時如實披露可確認名稱、日期與可重現限制，不虛构確定版本。

正式方法草稿可明示未知項並引导補來源。文字潤色不能掩蓋執行缺陷；方法改變需回原模組審查，而不是在稿件里偷偷補做。[S1]

---

## 14. Results Builder：完整、精確與有分母的研究發現

依RQ／主要outcome與文章型態組織：研究單位流程與實際樣本、必要描述、主要結果、次要結果、預先規劃敏感度及探索性結果；並安排質性／混合／AI元件。不要把每個診斷數字全部塞正文，也不能省略會改變解讀的重要診斷。

每段綁定ResultRecord／Fact／Finding、actual N、unit／denominator、group與timepoint、contrast方向、estimate、適用區間、p_raw/p_adj與family、effect定義、限制及table/figure。計畫N、招募N、分析N、complete pairs、班級數與sensor rows各有名稱。

測試決策與科學解釋沿用U14，不用p<.05直接生成SUPPORTED或理論成立。不顯著不等於無作用，不能寫等效除非有對應設計與結果；不可估計／未測試有真實理由就明示，不補估計值。

數值已存在但結果USE_BLOCKED或不屬scope，禁止引用為正式結果。部分釋出可以寫對應段落；未釋出結果保持NOT_YET_AVAILABLE並顯示缺失，不能以流暢文字遮住。

報告主要與適用次要結果時不因方向不利省略；不同稿件合法分工需Scope Accounting及交叉揭露。正文提要不重複整張表，每个結果仍可在正文／表圖／補充找到位置。[S1]

對某變數提供全新百分比、效果比較、趨勢或總樣本合併推論，若上游沒有對應已核准Fact，建立RESULT_FACT_REQUEST回U14，不能在寫作裡自行算新結果。

---

## 15. 質性、混合方法、AI與技術文章專屬寫作

質性Results以已採用Finding／Theme和原始quote index組織。引用須有corpus version、speaker pseudonym、位置、核准用途與節錄範圍；不能創造受訪者說話、將摘要改成直接引文或合成多人引言卻不揭露。

不得擅自修飾口語改變意思。刪節、方括號補字及跨語言譯文要標示並保存source mapping；敏感引文與罕見個案識別風險另核對。發現新主題需回U14質性分析紀錄，不能在Discussion當成已驗證Finding。

混合方法以真實Joint Display、整合結果、收斂／差異與meta-inference組織，不把量化未顯著與質性正面自動合成「效果證實」。保留兩類樣本、時間與分析目的差異。

AI／ML結果敘述完整對應split／fold／external test、模型與版本、baseline、實際指標定義、uncertainty、失敗模式、calibration或fairness如已分析。不得把validation最佳表現叫external test，或刪掉失敗Run。

環境、能源、製程、Sensor及技術文章保留實驗單位、批次、採樣條件、儀器校正、誤差、benchmark及限制。重複資料點不冒充獨立樣本；Prototype可行性不等於正式場域效果。

Article adapter決定結構，不是所有文稿硬套H1、問卷信度與IMRaD。新adapter尚未可靠支持時允許手動結構＋來源關聯，而不是套錯模板假裝完成。

---

## 16. Discussion Builder：解釋、反證與貢獻的可追溯推理

每個主要Finding建立DiscussionEvidenceMatrix：已報結果 → 可得知什麼／不能得知什麼 → 相近研究的支持與差異 → 可能機制 → 其他解釋 → 理論／方法／實務意義 → 邊界與限制。

明確區分直接測量的中介或過程與未測機制推測。模型箭頭、相关結果或回歸調整不自動代表因果；因果語言依已審閱的識別假設、時間順序、實際設計與偏差決定，不用「RCT一律caused、觀察研究一律不可談因果」的過度簡化。[S1]

文獻衝突不隱藏；相反結果先比較對象、context、介入、測量、時點與方法差異，有直接證據才提出較強解釋，其餘以可能性表達。

Discussion不可新增Results未記錄的觀察、受訪者主題、模型效能或統計。新假設與解釋可以提出，標POST_RESULT_EXPLANATION／FUTURE_TEST，不能改寫成事前Hypothesis；正當新增解釋不被死板禁用。[S1][S4]

Contribution由已驗證差異及實際結果界定，不只把Introduction的預期貢獻改過去式。弱或混合結果也可形成限制、理論邊界或方法教訓，不能因負面結果被系統強迫重算。

不得生成未測量的ROI、成本效益、政策衝擊或長期效果；未有正式經濟分析就只提出待評估實務問題。保留學生、場域、技術的適用範圍。

---

## 17. Introduction、理論與研究問題的忠實定位

以研究重要性 → 現有知識 → 相近研究與限制 → 有範圍的Gap → 本研究目的與設計定位 → 合理貢獻組織，可依article type調整，不強制每篇六段或大量引用。

重用U05 Gap判斷、反證、Closest Studies、Contribution Delta與U06採用模型。需要更新文獻先走EvidenceNeed；未更新則顯示last_verified與適用時點，不宣稱最新全球首創。

不能以「沒有搜尋到」證明無人研究，不因新文獻讓文章不好寫就隱藏。對Gap的修改建立ChangeProposal與版本；已選題歷史保持，不能把原先目的改寫成剛好符合結果的目的。

原研究假設、確認／探索角色與timestamp保持。事後合理的新框架可以放Discussion或明確標探索性理論再解釋，不倒填成preregistered。這符合預先計畫與結果後探索應透明區分的原則。[S4]

本章可引用重要定義、研究價值與直接相關原典，不為湊References或顯示專業而堆疊無關理論。每個核心理論詞使用構念字典，避免同詞不同義或異詞當同義。

---

## 18. Implications、Limitations、Future Research與Conclusion

Implication以result_id為出發點，標示理論、方法、教學、職安、環境／能源、技術或政策用途；不得將可能建議寫成已被驗證的效益。

Limitations從真實設計、樣本與招募、量測、失訪與missing、Protocol deviations、診斷、AI外部有效性、場域與時間限制整理。每項說明影響哪些主張、結果可能如何受限、已做何種緩解及仍不能排除什麼，不只列制式「小樣本、未來擴大」。

不把不利限制刪掉來符合字數；重要限制需在Abstract／結論適度反映。未執行sensitivity不能寫成已經處理偏誤。

Future Research基於未解問題提出可檢驗方向，不捏造已完成後續研究。與U06模型／U07設計需要重大新工作時可以建立後续project idea，但未經允許不自動新開Project或覆蓋原設計。

Conclusion概括核心問題、主要結果、恰當貢獻與範圍；不新增數值或比正文更強的確定性。沒有足夠證據時可以「仍需進一步證據」，不以接近顯著或部分指標有利掩飾主要不支持結果。

---

## 19. Abstract、Title與Keywords：整稿一致而非另寫故事

核心章節可先有占位概要，完成後才將正式摘要與全文revision綁定。結構、字數、是否要求研究設計入標題依Target Writing Profile與真實來源；不同期刊或article type不一律要求structured abstract。[S1]

Abstract的研究對象、設計、actual N、主要結果、時間、interval及結論只用已採用來源。不能只留顯著次要結果、省略不支持的主要結果或重要限制。摘要與正文一致性是單獨QA，不等於語言流暢度。

Title提供少量候選與差異理由：核心問題、對象、方法定位、可檢索性與過度因果／首創風險。標題可以中英文候選，但未核實英文術語不改構念ID。不能把初稿標題改成已證實效果或保證高影響期刊。

Keywords來源於構念、方法、對象、技術與正式主題詞如適用；外部詞彙表需有真實來源，不假造標準主題詞。標題／關鍵詞更新不直接變更研究原始題目。

主結果變更時摘要、標題、Conclusion及相關主張標STALE並逐項重驗；不能只更新數字token而讓一句話方向仍錯誤。

---

## 20. Tables／Figures、圖說及Reporting Guideline Coverage

只引用U14已釋出的Table／Figure及source spec版本。本輪可以安排章節位置、編號、圖說文字候選與cross-reference，不能在圖表圖片上塗改數值或另用生成圖像模型繪製研究統計值。

表圖敘述連結結果、N／denominator、error bar類型、contrast、單位與調整策略。若數值來源為受控DatasetView而非逐格Fact，保留核准view／transform／render hash，不能強迫全部拆成一筆筆偽造Fact。

來源artifact ID與稿件中的Table 1／Figure 2顯示編號分離；重排後更新所有合法引用與caption，不只改正文文字。參考文獻出现在caption／表註／附錄也計入citation renderer。

Supplement只做內容安排與來源引用，不自動公開Raw、逐字稿、完整受限量表或識別性資料。對必要结果移往補充須記錄理由與正文指引，不能成為掩蓋不利結果的方法。

ReportingCoverage依既有適用guideline逐項映射section／claim／table／file，標ADDRESSED／PARTIAL／MISSING／NOT_APPLICABLE／UNVERIFIED。機械映射不是正式規範認證，沒有段落内容不能只打勾。

重排與格式改變不需重算統計；Caption涉及新科學解釋則走語義審閱。最終圖片解析度、刊物附件及授權合規留後续規範階段，但目前已知風險需保存。

---

## 21. 作者既有稿件匯入、回填與文字來源保留

支援作者既有稿件入口，重用既有upload/parser；最小支援安全Markdown／plain text。DOCX、LaTeX等只有現有可靠能力或本輪驗收實作才顯示SUPPORTED。匯入前權限、大小、格式與機敏內容檢查，保存原檔hash與不可改原版。

解析章節、段落、表圖引用、書目及候選數字，建立Import Mapping Review。原始作者數值先為UNVERIFIED_IMPORTED_FACT_CANDIDATE，與U14結果匹配後才可轉成有來源引用節點；不能AI猜出N或Statistic。

引用比對使用DOI、完整書目、版本與人工裁決，不因姓氏年份相同就自動綁定。未核對保留作者原文及CITATION_UNRESOLVED，不能刪掉假裝乾淨。

匯入的樣式、圖片或公式無法保真要列Loss Report；不對外聲稱完整round-trip。Word Track Changes、註解、hidden text及metadata保存／去除策略需可見並核對隱私，不能將修訂刪文當正式正文。

匯入可先做結構與文法協作、缺失清單或部分證據對應。正式科學初稿Gate仍須來源核對與範圍判定，不強迫重走已有可驗證的研究，也不倒填前階段已完成。

---

## 22. 術語、統計語言與工作語言一致性

沿用構念／工具／系統／分析字典建立ManuscriptTermBinding，保存canonical ID、中英文名稱、縮寫、群組與時點顯示名、單位、允許別名、使用理由、locked status與版本。

同一構念一致命名，不把learning outcome／achievement／performance一律合併，也不禁止有理由的情境用詞。名稱不同但定義相同可建alias；定義不同不能只為語言流暢當同义詞。

統計語言formatter保留p調整、區間類型與level、效應尺度、實際N與denominator。格式檢查與科學推論分開：字串沒有caused不代表沒有因果過度推論，語義審查需有研究設計、識別假設、結果與限制。

支援繁體中文科學初稿或英文科學初稿，介面維持繁體中文；這不是本輪重建完整中英翻譯／DeepL／學術潤稿中心。既有語言工具若使用，須按已授權範圍記錄，不使草稿自動成為語言QA核准版。

涉及陰性敘述、否定、not supported、部分支持與關聯方向要測試前後一致；不得用更強語氣或更高確定性換取「專業感」。

---

## 23. 作者、資助、倫理、資料與AI協助紀錄

連結既有作者Profile、Authorship Plan、貢獻、機構、Funding、COI、EthicsDecision、Preregistration及Data／Code Plan。尚未確認的資訊保留待辦，不預設全部作者已同意、沒有利益衝突或資料已公開。

申請計畫與核定資助分開，Grant ID不能由專案名推測；僅有倫理規劃不能生成核准號碼；私有或embargo資料可依真實權限擬定限制性聲明，不為完整度捏造repository URL。

記錄語言或研究AI使用的不同用途：寫作、文獻整理、程式、分析、模型作為介入、圖像或校正。品牌介面統一「老麥」不等於隱藏正式揭露需用到的工具名稱與版本。

AI不列作者，也不自動代作者簽署內容負責。以Elsevier目前政策為例，強調人類監督、核實輸出與依用途揭露；適用要求仍需按目標期刊核對，不將單一出版商政策套用所有期刊。[S6]

本輪保存AIWritingAudit及DisclosureDraftInputs，最終聲明與作者全體核准在後續階段完成。不能將原始system prompt、未公開機密或身份資料無限制放入揭露附件。

---

## 24. 全項Assist、內容鎖定與多層版本保護

每欄、Scope、Section、Paragraph、Claim、Storyline、Caption、Citation Cluster及Quality Issue接入Field／Section／Stage Assist。提供解說、起草、補全、優化、補查證據、來源、差異與鎖定；不是每項都允許自由生成。

FieldPolicy至少：NARRATIVE_DRAFT、AUTHOR_TEXT、SOURCE_REFERENCE、COMPUTED_RESULT_READ_ONLY、QUALITATIVE_QUOTE_PROTECTED、TEMPORAL_RESEARCH_CLAIM、FORMAL_APPROVAL。Fact只能來源服務更新，直接引文只能引用已准用範圍，正式核准只能真人或可驗證紀錄。

所有手動patch、autosave、AI回寫、匯入、引用更新、同步、刪子節點及active-version切換均由後端檢查workspace/project ACL、manuscript/workspace關係、goal revision、source revision、base revision及lock。UI disabled不等於安全控制。[S7]

FILL_EMPTY、IMPROVE_UNLOCKED、FILL_AND_LOCK作用於允許範圍。段落含鎖定claim／token時整段替換不得繞過；可以產生獨立建議與diff。AI處理中使用者修改、鎖定、取消、回收Project或撤銷用途，遲到輸出不得覆蓋或復活成果。

鎖分欄位／段落／章節／稿件release；解鎖產生新working revision，舊版可依權限回看。儲存、鎖定、機械QA、人工閱讀、科學審查、作者投稿同意各有狀態，不能混成APPROVED。

來源Fact／文獻／表圖更新由Usage Index產生精確stale影響；有權者採用新版後重驗相關段落。舊稿不自動套最新數字。必要用途撤回觸發USE_BLOCKED，保留的audit不重存應刪除機敏內容。

---

## 25. 整稿一致性QA、問題回送與缺失精確導航

建立兩層檢查：可決定的機械規則＋不確定的語義／科學風險建議。機械包括節點有效、版本/hash、數值與單位、引用雙向關聯、cross-reference、字數；語義包括claim支持、因果／確定性、方法忠實、Results與Discussion、Abstract、选择性報告與適用範圍。

語義AI回覆存候選Finding＋依据＋信心及人員審閱狀態，不能把兩個模型一致視為獨立科學驗證，也不能低分或高分直接解除正式阻擋。

每Issue保存category、severity、affected source、manuscript／section／paragraph／claim／fact、說明、影響、建議動作、due_stage、blocks_actions、owner、return target及resolution evidence。

數值疑慮回U14；清理或計分疑慮回U13／U10；方法執行疑慮回U12；事前設計回U07；理論與Gap回U06／U05；文獻回既有中心；官方或資格資料回U03／U09。不得在写作頁把上游問題勾掉卻沒修來源。

Issue按鈕直達正確Project、manuscript、source entity、tab及field，展開並聚焦；補完提供「保存並返回全文寫作」。返回由後端重新驗證，不把點過連結算修好。放棄／接受限制需真人理由，不能用ACCEPTED_RISK解除虛構、錯誤數值或隱私禁用。

U16多角色科學審查會再深入處理；本輪的ReadyForReview不能要求U16先核准才可交接。非阻斷科學問題可明確帶入待審；錯誤結果與假引文仍不得當成有效初稿釋出。

---

## 26. 前端工作台、首頁亮燈與醒目下一步

U15工作台升級接收頁，左側章節／全文切換，中間段落協作編輯器，右側按需開啟Section Brief／來源／結果／Issue／老麥。手機採單欄可收合，固定操作列不得遮住焦點或底部危險操作。

頂部保留專案下拉、儲存／讀取／新增、目前稿件版本、主要研究目標、發表用途、研究結果模式、last successful save與未存變更。切換Project或Manuscript前處理未存內容；失敗留原稿，不顯示新標題配舊內容。

核心頁籤或子工作區：總覽、範圍與論述主線、來源與Storyboard、逐章寫作、表圖、Citations／Zotero、Consistency、整稿預覽／匯出、版本。進階細節收合，別一次列二十個頁籤佔滿首屏。

每章顯示已準備來源、進行狀態、缺失與產出；首頁仍有功能導覽、近期成果、文獻摘要及底部回收復原。不要將每次開首頁當作觸發付費全稿重生或文獻重抓。

進度以本稿適用必要工作與已保存結果計算，不以字數、所有欄位有字、AI自評或鎖定計算完成。三Goal、多稿件與計畫書進度分開；必報結果未交代不得自動從分母移除。

燈號：灰NOT_STARTED、藍WRITING／IN_PROGRESS、黃SOURCE_NEEDED／PARTIAL／STALE、紅BLOCKED、綠SCIENTIFIC_DRAFT_READY_FOR_REVIEW；全部有文字與圖示。綠燈不是科學審查通過或期刊接受。

主要按鈕依狀態：
- 已備妥初稿：**完成科學初稿，前進「老麥科學內容審查與Reviewer #2」→**。
- AI草稿待作者確認：**檢視整稿與證據，確認送交科學審查**。
- 當前缺項：**尚缺N項，前往補足**＋**老麥一鍵處理可自動項目**。
- 部分證據：**保存部分初稿與限制，前往審查準備→**。
- 只有規劃：**保存写作規劃並查看待取得資料**。
- 下一階段未建：**保存交接並查看科學審查準備**，不跳空白。

---

## 27. 隱私、外部AI處理、權限與任務成本

寫作代理預設只讀必要聚合Fact、已准用Finding／節錄、文獻與方法紀錄，不直接取得Raw／完整Dataset、IdentityVault、聯絡或學生身份。聚合結果與小班級引文也可能敏感，不自動視為匿名。

外部LLM／語言服務使用沿用已核准provider、專案用途、內容範圍與預算。一般登入或按一鍵不能代表同意傳送全部機密稿件；超出既有授權須集中提醒，具本地能力時可選internal-only。

Prompt包、稿件、引用原文不寫一般log／Git，audit存安全reference與必要hash。provider session與cache key包含workspace/project／manuscript／source hash／goal／權限，不能跨專案共用私人context。

所有nested refs、artifact下載、匯出與原文回查執行ACL。Secrets只在server，OpenClaw工程代理shell與DB管理權不提供網站聊天使用者。外部來源、上傳稿、PDF抽文與模型輸出中的命令只當資料，不覆寫system policy。[S7]

安全解析DOCX／壓縮包／HTML／SVG／LaTeX，禁用macro、外部link自動抓取、shell escape、不安全反序列化、任意路徑與SSRF。LaTeX編譯若無隔離能力先不支援，不能在生產shell直接執行陌生文件。

Job保存checkpoint、有限重試、取消、估計與實際用量。規格或工具輸出不明確時不自動切換昂貴provider或擴大外傳。取消與權限撤回同時傳播到寫作、補文獻與匯出job；遲到成功不得改完成狀態。

---

## 28. 真正可用的整稿閱讀、檔案匯出與一致性核對

本輪最低真實交付：整稿閱讀頁、可編輯章節與段落、引用與Result nodes渲染、Markdown全文與結構化JSON、References／Citation Manifest／Fact Usage Manifest、表圖引用清冊與機械QA報告。下載必須真有檔案、格式、bytes與checksum，不生成不存在的URL。

重用現有DOCX／PDF／LaTeX exporter並執行round-trip驗證。沒有可靠引擎時，至少完成上述可用核心，其他格式標UNSUPPORTED而非宣稱成功；既有可靠DOCX功能不得倒退只給純文字。

匯出固定manuscript/source/profile revision，manifest記錄build環境、renderer、citation style與locale、章節順序、Fact／Citation／表圖refs/hash、輸出hash及模式水印。重建在同條件下需語義一致；時間戳或壓縮metadata造成位元差異時揭露，不虛稱byte-identical。

round-trip核對章節／公式／引用順序、全部使用Fact與caption、符號、CI上下界、p運算子、百分比、小數與表格。References同步全文引用而非所有Collection項目；佔位符不得悄悄消失，部分稿匯出附缺失報告及DRAFT標記。

下載提供科學初稿與審查證據包兩種，證據包不得無限制包含Raw、密集個體資料、受限全文或量表；只帶權限內metadata、locator與必要引用。

跨工具引用能力如第12節明示：靜態DOCX不宣稱Zotero Word可編輯欄位。動態欄位有測試才開放，並保存可回匯網站的Citation映射。沒有Word環境測試應列NOT_RUN，不以字串存在冒稱Live整合通過。

---

## 29. Stage Gates、部分寫作與科學審查的分界

分開module_health、job_status、source_access、content_state、mechanical_qa、author_review、scientific_review與handoff_state。AI自動鎖草稿不能冒充作者核准。

Gate依實际registry明確映射：

1. **WRITING_SCOPE_AND_SOURCES_READY**：工作單、article用途、範圍、採用source snapshot、可用Fact／Finding／方法與文獻、必報結果歸位已建立；僅規劃也可生成outline，但正式結果写作仍受上游release限制。
2. **MANUSCRIPT_CORE_DRAFT_ASSEMBLED**：本稿適用章節已有實際內容，非只有模板；方法、結果、解釋與摘要對齊。必要未执行研究如實交代，不能用placeholder假裝完整。
3. **MANUSCRIPT_NUMERIC_CITATION_QA_PASSED**：無未處理錯誤數字／來源映射／偽引用／無權引文；必報內容已歸位，表圖及Abstract一致；語義風險有清單與下一階段處理，不假稱自動QA證明研究正確。
4. **MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW**：科學內容初稿與Evidence Package保存、來源有效、重大當前錯誤已解決、有權作者確認送內部審查範圍（不等於全部共同作者正式投稿同意）、Snapshot與Audit／outbox完整。

舊 `MANUSCRIPT_V1_READY_FOR_SCIENTIFIC_REVIEW` 若已存在可作alias，但不得要求每份稿一定版本v1。來源未完成或被撤權不能以總分超過門檻放行。

PARTIAL_EVIDENCE_DRAFT可帶已驗證部分與missing matrix供局部審查；`review_scope`明確而`formal_manuscript_complete=false`。沒有結果只能規劃／作者匯入整理，不亮正式初稿完成燈。

真實且經審閱的不可估計／陰性研究可按適當文章定位形成完整報告，不要求每個假設成立。沒有真實研究就不能以這個例外捏造陰性結果。

U16科學審查、後续翻譯潤稿、作者全體核准、最終期刊合規及送件都不是本輪完成的前置条件；不能造成循環Gate。必要機構/法律限制仍按實际blocks_actions與用途處理。

---

## 30. 寫作證據包、U15→U16交接、API與最小資料模型

建立 `ManuscriptEvidencePackage`：scope/accounting、storyline、section briefs、methods-source map、result/fact usage、claim-evidence map、quote locator、table/figure refs、citation/term/profile manifests、各章QA、局部核准／未解問題、上游版本、AI協作摘要與真實匯出。

建立 **ManuscriptWritingSnapshot** 交接新版第十六階段「老麥科學內容審查、Reviewer #2與逐項修訂」。請提供JSON Schema、正反fixtures、consumer contract，以下是語義契約，不是已完成研究的實際資料：

```text
schema_version / snapshot_id / workspace_id / project_id
stage_key = V3-U15 / next_stage = V3-U16
manuscript_id / manuscript_version / manuscript_content_hash
goal_context + revision / primary_deliverable / publication_purpose
input_analysis_results_snapshot_refs[] + version + hash
mode / review_scope / formal_manuscript_complete
source_release_scope / allowed_next_actions[]
writing_work_order_ref / manuscript_scope_ref / overlap_assessment_ref
storyline_ref / results_storyboard_ref / reporting_scope_matrix_ref
section_version_refs[] / paragraph_version_refs[]
methods_source_manifest_ref / planned_performed_difference_refs[]
result_usage_manifest_ref / protected_fact_node_index_ref
claim_evidence_map_ref / evidence_packet_manifest_ref
qualitative_quote_usage_ref / sensitive_content_use_constraints
rq_hypothesis_coverage_ref / temporal_disclosure_refs[]
unreported_or_unperformed_outcome_dispositions[]
table_usage_manifest_ref / figure_usage_manifest_ref
citation_manifest_ref / bibliography_manifest_ref / zotero_reference_manifest_ref
terminology_binding_ref / journal_writing_profile_ref
reporting_guideline_coverage_ref / word_budget_ref
numeric_qa_ref / citation_qa_ref / consistency_review_candidate_refs[]
resolved_issue_refs[] / unresolved_issue_refs[] / later_stage_requirements[]
AI_writing_audit_summary_ref / disclosure_inputs_ref
manuscript_evidence_package_ref / export_manifest_ref
readiness_decision / author_review_records[] / locks_manifest
source_dependencies / privacy_access_constraints / source_manifest_hash
created_by / created_at
```

只帶有權的ID、version/hash与必要摘要，不包含IdentityVault、Raw rows、整本受限文獻或敏感完整逐字稿。作者名與聯絡權限按用途最小化。

U16 consumer固定讀這份稿與來源，不自行調整結果、重跑分析或修改鎖定段落；Issue可以精確定位。需要新分析回U14建立Run；來源變更使受影響段落重驗。不得把內部模擬Reviewer當正式期刊決定。

完成交易：長生成／renderer在DB transaction外 → 暫存artifact與hash → 短transaction重驗ACL／revision／locks／readiness → 保存Draft Release、Snapshot、Audit與outbox → 導航。consumer以snapshot_id＋schema去重，同id不同hash衝突；導航失敗可重開原交接不重跑AI。

U16若尚未建置，本輪提供可重開receiver，顯示稿件、模式、範圍、QA、來源與待辦，能返回U15，不生成假審查與空白頁。保留原Research Blueprint与Study Protocol，不因論文敘事改寫事前計畫。

資料模型是邏輯角色，不要求每個名詞一張新表：ManuscriptWorkspace／WorkOrder、Scope／Version／Section／Paragraph、TypedReferenceNode、ClaimEvidenceLink、Storyboard、WritingProfile／TermBinding、CitationCluster／UsageIndex、WritingIssue／ChangeProposal、WritingJobCandidate、DraftRelease／EvidencePackage／ManuscriptWritingSnapshot。共用Project、Dataset、ResultFact、Literature、Zotero、Job、Lock、ReviewTask不再造。

API按現有框架提供initialize/resume、scope/workorder、section brief、typed patch、assist/status/cancel、cite/result insert、compare/adopt/lock、QA、Issue、export、release/handoff。write帶expected_revision或ETag及nested ACL；來源引用端點不能當任意資源讀取代理。

錯誤至少：HANDOFF_SCHEMA_UNSUPPORTED、UPSTREAM_REFERENCE_MISSING、SOURCE_HASH_MISMATCH、RESULT_SCOPE_NOT_RELEASED、FORMAL_WRITING_NOT_ALLOWED、PROJECT_ACCESS_DENIED、MANUSCRIPT_SCOPE_CONFLICT、LOCKED_FIELD、REVISION_CONFLICT、SOURCE_STALE、RESULT_FACT_READ_ONLY、UNKNOWN_REFERENCE_TOKEN、CITATION_UNRESOLVED、CLAIM_EVIDENCE_MISSING、QUOTE_USE_NOT_AUTHORIZED、EXPORT_FORMAT_UNSUPPORTED、EXTERNAL_PROCESSING_BLOCKED、BUDGET_LIMIT_REACHED、HANDOFF_SAVE_FAILED。提供可恢復說明與導航，不用HTTP200＋空白內容掩飾失敗。

---

## 31. 四個實作批次與60項驗收案例

**Batch A｜來源接收與寫作範圍。** U14 consumer及現有receiver升級、三Goal／mode／article adapter、固定來源、Scope/accounting、WorkOrder、typed paragraph與Section Brief、權限與placeholder處理。

**Batch B｜真實全文協作。** 三種協作模式、Job與checkpoint、Methods／Results／Discussion等builders、唯讀Fact節點、Claim Evidence、Citation renderer／Zotero、本專案文獻補強、舊稿匯入及術語。

**Batch C｜品質、鎖定與整稿輸出。** 對照planned/performed、必要結果覆蓋、語義風險、Numeric／Citation／Abstract／表圖檢查、採用／鎖定、真實預覽與匯出、源更新影響。

**Batch D｜無斷層交接與回歸。** scope release、Evidence Package、Snapshot／outbox、U16 receiver與contract、首頁燈號、缺失往返、任務恢復、權限安全與以下60項驗收。

Fixtures須清楚標示測試，不能写到真實研究域。每例報PASS／FAIL／NOT_RUN／BLOCKED；環境另標LIVE、MOCK、FIXTURE、SYNTHETIC_WRITING_TEST，不把本地fixture成功當成Live API或真實研究完成。

### A. 相容與來源（T01–T08）
- **T01** U14接收頁升級後同Project／snapshot／筆記／待辦仍存在，不新增重複Project。
- **T02** 正確使用ANALYSIS_RESULTS_READY_FOR_MANUSCRIPT及release scope；缺舊版Gate名稱不阻塞。
- **T03** snapshot跨workspace或巢狀Fact未授權，後端拒絕且不洩漏內容。
- **T04** hash或source revision不符，生成stale Issue，不默用latest。
- **T05** formal_writing_allowed=false可建立outline但不能生成正式Results或亮完整初稿綠燈。
- **T06** PARTIALLY_RELEASED僅其有效Fact可引用，未釋出不得變成0或文字結果。
- **T07** NOT_ESTIMABLE／NOT_TESTED有實際處置時如實表達，不補估計值。
- **T08** U14未有人員核准的Interpretation維持candidate，不在寫作時自動改成已核准科學判斷。

### B. 目標、範圍與一鍵任務（T09–T18）
- **T09** 三Goal通過DB、API、job、prompt、cache與handoff，MOE不退回期刊預設模板。
- **T10** NSTC／MOE衍生稿共用研究來源但不覆蓋原申請書、主目標或混算進度。
- **T11** 質性／技術稿不強制H1、CFA或所有IMRaD小節。
- **T12** 同資料多稿形成Overlap風險及處置，不自動判為抄襲也不忽略核心重複。
- **T13** 本稿主要不顯著結果被省略或降級，ReportingScopeMatrix阻擋未裁決的完整稿件release。
- **T14** Guided／Co-writing／Evidence-to-draft均能實際編輯、存檔、重開，而非僅輸出聊天文字。
- **T15** 一次授權逐章job可連續執行，遇來源缺項保存部分成果並集中列出，不反覆要求每句確認。
- **T16** 重複啟動相同工作單不重複建立任務；worker重啟能从checkpoint恢復。
- **T17** 取消任務、回收Project或撤用途後，遲到輸出不覆寫／復活稿件。
- **T18** 成本超限或外部服務不允許，停止對應呼叫並保留本地草稿，不偷偷轉另一付費provider。

### C. 科學內容與Fact（T19–T30）
- **T19** Fact-only欄位不能透過通用patch、bulk import或AI文字端點改值。
- **T20** 新增未知Fact／Citation token、token遺失或錯連結果，候選不能直接採用。
- **T21** planned N、enrolled N、analysis N、pair／cluster分母不同時正確引用，不誤報統一N。
- **T22** p比較符號、adjustment、CI類型／level與效應方向在格式化後保持，無p=0假報告。
- **T23** 需新百分比或結果合併而無來源Fact，建立U14需求，不讓模型心算入稿。
- **T24** Protocol為計畫但實際無隨機／盲化，Methods不得補寫隨機試驗或已盲化。
- **T25** 實際Instrument版本與文獻版本不同可對照；原研究alpha不冒充本樣本alpha。
- **T26** 新探索性解釋可明確放Discussion，不能回填為原先預註冊假設。
- **T27** Discussion加入未報告數據、未採用theme或新AUC，產生NEW_RESULT_IN_DISCUSSION。
- **T28** 未顯著不寫成等效；較弱識別下的因果過度推論標待審，而不是按設計標籤一刀切。
- **T29** Abstract與正文的N、方向、主要outcome、限制不一致時不能通過對應QA。
- **T30** 真實負面或混合結果、無法估計的透明報告可以交審，不因假設未成立卡住。

### D. 文獻、引用與特殊內容（T31–T42）
- **T31** 外部Claim引用存在但不支持內容時標Citation–Claim Issue，不能只因ID存在過關。
- **T32** Abstract-only或只取得片段不能標已讀全文；AI處理與人工閱讀分開。
- **T33** 同研究多平台或預印本／正式版不重複計為獨立支持。
- **T34** EvidenceNeed從段落跳文獻中心後，能保存並返回同Project／manuscript／claim。
- **T35** Consensus失敗或缺憑證如實標示；不傳Raw或敏感稿段作一般搜尋query。
- **T36** Zotero暫時斷線保留合法本地Citation；不存在item不虛造DOI或替代作者。
- **T37** library＋item key＋version與citation key不同，合併／更新有diff而不靜默覆寫已鎖定引用。
- **T38** 作者同年a/b消歧、群組引文及數字引用重排由整稿context正確渲染。
- **T39** Citation在表註、caption或附錄仍進正式書目；閱讀清單不自動全部列References。
- **T40** 質性引文不在准用quote index或權限被撤，禁止插入；AI不能創作受訪者說話。
- **T41** AI模型稿維持train／validation／test、模型版本與指標定義，不把驗證集結果改稱外部測試。
- **T42** 已有作者稿匯入保留原檔／loss report，未知數值與書目維持未驗證，不自動視為正式Fact。

### E. 鎖定、過期與實際文件（T43–T52）
- **T43** 欄位、段落與章節鎖同時對手動、autosave、AI、同步生效。
- **T44** 整段替換／刪子節點／改active pointer不能繞過鎖。
- **T45** AI進行中有人編輯或鎖定，回應只存舊revision候選，不覆蓋。
- **T46** 新Result版本使對應正文、表圖、Discussion、Abstract與Conclusion標STALE，不偷偷換值。
- **T47** 更換期刊只改WritingProfile與格式待辦，不能改研究來源或結果。
- **T48** 整稿預覽與實際Markdown／JSON／References匯出檔存在，hash與來源manifest相符。
- **T49** 匯出重新解析後Fact、符號、引用順序與表圖crossrefs一致；佔位符沒有靜默消失。
- **T50** 無Word Live Fields能力時只標STATIC_CITATION_EXPORT，不冒充Zotero可刷新欄位。
- **T51** 惡意HTML／SVG／DOCX連結／LaTeX指令及path traversal無法執行或讀任意資料。
- **T52** 匯出或AI audit不包含Raw、IdentityVault、受限全文、API keys或超出權限的敏感引文。

### F. 完成與無斷層交接（T53–T60）
- **T53** 缺失直達正確稿件／欄位且補完返回；只點連結不能關閉Issue。
- **T54** AI自動Lock、儲存與測試通過不冒充人工核准或正式科學審查。
- **T55** ReadyForReview不要求下一階段Reviewer、語言QA或共同作者投稿核准先完成。
- **T56** 部分稿件交接帶review_scope及missing matrix，formal_manuscript_complete=false，不亮完整綠燈。
- **T57** ManuscriptWritingSnapshot具schema、manifest、signoff、Fact／Citation／quote引用與U16 consumer test。
- **T58** 完成交易提交成功但導航失敗，可重開同snapshot，不重跑生成或重複交接。
- **T59** 第十六階段未建置有真實接收頁，可查看稿件／Evidence／待辦並返回，不跳空白。
- **T60** 手機與桌面流程燈、下一步、儲存、未存切換保護及底部回收復原正常，三Goal／多稿件資料不混用。

---

## 32. 工程交付、實際測試與停止條件

完成後回報真實修改，不要只說「完成」或貼功能清單：

1. 修改／新增檔案、repo分支、環境、migration、相容adapter及rollback。
2. U14來源mapping與結果scope控制、工作單與多稿範圍／Overlap。
3. 三種寫作模式、章節brief、連續job、結果敘事與Claim Evidence。
4. Methods／Results／Discussion等builder、planned/performed及各研究adapter。
5. Typed Fact／Citation nodes、renderer、版本與保護測試。
6. Consensus／其他文獻來源與Zotero實際狀態，Live／Mock不能混報。
7. 作者稿件匯入、已有U08稿件升級、完整閱讀、真實匯出與引用能力限制。
8. 一致性QA、必報结果、假設時間線、語義風險及人工決策。
9. Field／Section／Stage Assist覆蓋報告、Lock、權限、外傳與成本測試。
10. ManuscriptEvidencePackage、ManuscriptWritingSnapshot JSON Schema、fixtures、U16 consumer contract與接收頁。
11. 60項適用案例的實際命令／環境／輸出摘要，失敗與NOT_RUN／BLOCKED原因，不把fixture當真實研究。
12. 可重現的驗收操作、已知缺口、對後续階段的需求、回復／重開方式。

更新PROJECT_STATE.md：目前V3-U15已實作能力與版本、stage／Goal映射、可用export模式、source dependencies、待解問題、測試證據及下一個V3-U16交接契約。不能只把階段寫成100%而不附真實驗收。

至少演示一個合成測試域中的完整流程：U14有效snapshot → scope → Methods／Results／Discussion → 引用補強 → 鎖定段落 → 批次起草其他內容 → QA與真實匯出 → 新版本 → U16接收頁。再演示無結果、部分結果、教學實踐衍生稿、質性或技術稿等不被錯套模板的情境。

完成本輪後停止。不自行開始第十六階段完整Reviewer、正式翻譯潤稿、期刊最終合規或投稿。未完成能力如實列明，不以占位按鈕或聊天輸出冒充可用網站。

---

## 參考來源與實作查證說明（非研究專案文獻）

查證日期：2026-09-06。以下用於產品與工程規範，不能自動寫入使用者的論文References。適用期刊、機構、provider與部署版本仍須開工核對；不固定API費用、模型能力、文章格式或官方期限。

- **[S1] ICMJE，Preparing a Manuscript for Submission to a Medical Journal**：Methods、Results、Discussion、Abstract一致性與來源核對等報告原則。適用範圍為醫學期刊，不將所有細項套到其他學科。https://www.icmje.org/recommendations/browse/manuscript-preparation/preparing-for-submission.html
- **[S2] Zotero Web API v3 Basics**：Library／Collection／Item、版本、csljson／bibtex／bibliography等讀取與格式能力。https://www.zotero.org/support/dev/web_api/v3/basics
- **[S3] Zotero Word Processor Plugins**：Word等字處理軟體的動態引用／書目整合，與靜態格式匯出不同。https://www.zotero.org/support/word_processor_integration
- **[S4] Center for Open Science，Preregistration**：區分事前計畫、既有資料與探索性工作，不以內部Lock冒充外部註冊。https://www.cos.io/initiatives/prereg
- **[S5] Consensus API官方頁**：可嵌入自有工具的研究搜尋能力；實際端點、帳號與權限使用既有adapter及官方文件確認。https://consensus.app/home/api/
- **[S6] Elsevier，Generative AI policies for journals**：人類監督、內容核實、作者責任及依用途揭露。僅作具體出版商政策範例，非全期刊通用規則。https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals
- **[S7] OpenClaw，Security**：Gateway信任邊界、工具權限與Session路由。網站仍須獨立專案ACL、外傳及可寫範圍控制。https://docs.openclaw.ai/gateway/security
