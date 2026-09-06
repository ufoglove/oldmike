# OpenClaw 科研網站 V3｜新版第十七階段完整建置提示詞
## 翻譯、學術潤稿、術語一致性與語言品質

**版本：V3-U17-FULL / v3.4**  
**接收：新版U16 ScientificReviewSnapshot**  
**交付：LanguageQualitySnapshot → 新版U18「目標期刊／計畫最終合規、送件文件與成果包」**  
**編製日期：2026-09-07（Asia/Taipei）**

本文件是供OpenClaw增量建置網站的完整規格。本次核對了使用者提供的U16文件之Gate、准用scope、科學約束與交接契約，也查閱官方API文件；沒有連入使用者網站、修改資料庫、啟用付費API或驗證真實研究稿件。

上游文件：`OpenClaw_Research_Site_V3_Stage16_Scientific_Review_Reviewer2_Revision_Complete_v3_4.md`  
上游SHA-256：`29157b043f28a74e777ed4d6ad17800f15ad0c1c610c20343e721d2e0c4583c9`  
此hash只用於提示詞檔案對照，不代表網站、資料或科學審查已驗收。

> 核心：在固定科學來源上改善語言；不以流暢性取代正確性，不靠單一token數量或模型分數宣称保真。已完成部分可恢復、已鎖定內容不覆寫、每個缺失能直達，最終交付可讀、可修改、可匯出且可追溯的語言版。

---

## 1. 本輪定位、成果及不得越界事項

你是建站工程代理。本次增量建置新版第十七階段「翻譯、學術潤稿、術語一致性與語言品質」，不是直接替使用者翻譯一篇論文，不是建立老麥人格，不是舊版第十七階段投稿追蹤。

新版順序固定：U14分析結果 → U15科學初稿 → U16科學審查與修訂 → **U17語言處理** → U18目標期刊／計畫最終合規、送件文件與成果包。本輪只做到指定範圍的語言版已準備交接；不執行正式投稿或申請。

核心流程：ScientificReviewSnapshot → 源稿與准用範圍固定 → Language Work Order → 科學約束及術語 → 受保護的分段語言處理 → 對齊、語義及數值／引用QA → 使用者採用或合法批次採用 → 語言版整稿與真實匯出 → LanguageQualitySnapshot及U18接收頁。

重用U15稿件編輯、U16審查、既有語言服務及引用系統；一個來源版本可有多個語言edition，但不得另外建立與原Project脫節的論文或引用資料庫。使用者說U16已建好，只代表網站建置進度，不代表每份稿件已被核准、可外傳或可正式翻譯定稿。

本輪不改Raw、Dataset、Result Facts、實際研究方法或原假設；不重做全文科學生成、正式量表文化調適、統計、最終期刊合規、Cover Letter全集、投稿／政府送件及正式Reviewer Response。允許讀取既有內容、保存語言候選及建立需要回U16查核的修改提案。

最低完成品必須真的能：選來源與範圍 → 啟動可用語言provider → 看對照與差異 → 檢查科學含義 → 採用／拒絕 → 鎖定 → 重开整稿 → 匯出 → 帶来源與約束前進。沒有憑證時可完成本地工程及fixture測試，但不能假稱付費API已接通。

---

## 2. 先盤點現有網站、舊功能與相容性

先找真實repository、PROJECT_STATE.md、分支及未提交修改、DB／ORM、storage、worker、Secret store、現有Stage registry、正式／測試環境及部署方式。不得把OpenClaw工作目錄直接當網站repo。

讀取U16實際ScientificReviewSnapshot、schema、consumer tests及原U17接收頁；核對U15的Section／Paragraph AST、typed result/citation nodes、language branch、renderer、word count、匯出與引用元件。確認U09申請書review、U08三路線工作室、既有DeepL／LanguageTool／Google／Azure／內部模型adapter是否真的存在。

盤點API設定、目前API訂閱與scope、區域、語言／script、功能與資料政策；不要把一般網頁版訂閱直接當API權限，也不要因有一個API key就宣稱所有付費功能可用。Capability與Live測試分開保存。

每項能力回報IMPLEMENTED_AND_TESTED／IMPLEMENTED_UNTESTED／PARTIAL／NOT_IMPLEMENTED／BLOCKED。欄位不同建立mapping，舊版翻譯／潤稿模組能用就修復重用，不重建一套平行服務；特別保留既有術語庫、Translation Memory、作者修改與草稿。

只在隔離開發／測試環境增量實作；先保護程式、DB、持久檔案與原稿。正式migration、正式部署、破壞性操作、新訂閱、額外費用及外傳範圍擴張另取得授權。無法Live測試不阻擋本地可完成的部分，但不得關閉權限或刪測試換通過。

---

## 3. U16交接欄位、固定來源與准用範圍

正式上游Gate是 **SCIENTIFIC_REVISION_READY_FOR_LANGUAGE**。舊Gate如MANUSCRIPT_V2_SCIENTIFICALLY_APPROVED_FOR_LANGUAGE_POLISHING只能建立明確alias，不要求稿件名稱必須v2，也不能重新要求使用者上傳已在同專案的稿件。

| U16來源欄位群 | U17必須承接的用途 |
|---|---|
| schema_version、snapshot_id、workspace_id、project_id、stage_key | stage應為V3-U16或明確映射；初始化幂等、tenant與來源檢查 |
| manuscript_id、manuscript_purpose、goal_context及revision | 定位原稿、文件用途與三目標，不以切Tab修改主目標 |
| reviewed_manuscript_ref、scientific_revision_ref及version/content_hash | 使用指定科學修訂版；不能默讀latest或未採用候選 |
| review_mode、review_scope、formal_manuscript_complete | 分開完整、局部、規劃、匯入或計畫書 |
| scientific_release_state、full_manuscript_language_allowed | 決定整稿能否走正式語言釋出流程 |
| language_allowed_scope_refs、allowed_next_actions | 到section／paragraph／claim範圍校驗，不因UI可見就准外傳 |
| scientific_meaning_constraints_ref、terminology_binding_ref | 不可改的科學含義、必要限制、術語及因果邊界 |
| result_usage_manifest_ref、protected_fact_node_index_ref | 固定結果事實、數值、單位、群組、時點與分母 |
| methods_source_manifest_ref、temporal_disclosure_refs | 固定實際方法、資料接觸時間與確認／探索分類 |
| claim_evidence_map_ref、citation_manifest_ref、bibliography_manifest_ref | 保留主張與引用的綁定，不能只保留作者年份文字 |
| zotero_reference_manifest_ref、evidence_packet_manifest_ref | 保留Library／Item／Version及准用來源 |
| qualitative_quote_usage_ref、table_usage_manifest_ref、figure_usage_manifest_ref | 直接引文、表註與图说的使用限制及固定來源 |
| input_manuscript_writing_snapshot_refs、input_analysis_results_snapshot_refs | 可回溯U15與U14，不讓語言工具重新查Raw |
| review_work_order_ref、source_baseline_ref、review_coverage_ref | 確認已審范围與未審内容，不把局部審查改成全稿 |
| review_role_run_refs、reviewer2_report_ref、mechanical_qa_ref | 保存審查脈絡，不能把AI角色稱正式Reviewer |
| finding_registry_ref、adjudication_refs、revision_task_refs、re_review_refs | 交接已處理與未處理議題 |
| internal_author_response_matrix_ref、accepted_change_manifest_ref | 真實採用紀錄，不生成新的完成聲明 |
| analysis_review_request_refs、evidence_reinforcement_refs、source_update_adoption_refs | 未完成上游請求及新版來源依賴 |
| journal_writing_profile_ref、reporting_guideline_coverage_ref | 只取語言適配需要的要求，最終合規留U18 |
| AI_assistance_audit_ref、disclosure_inputs_ref | 延續既有AI用途，不用本輪翻譯清除前面的使用史 |
| scientific_review_package_ref、language_handoff_package_ref、export_manifest_ref | 讀最小必要内容及真實檔案 |
| unresolved_issue_refs、accepted_limitations、later_stage_requirements | 延續限制及晚期缺項 |
| human_review_records、required_specialist_review_dispositions | 不冒充新的人工確認 |
| locks_manifest、source_dependencies、privacy_access_constraints、source_manifest_hash | 巢狀ACL、用途、版本與鎖保護 |

同snapshot_id不同hash回CONFLICT；跨Project的nested Fact／Quote／文獻拒絕。被撤權、用途禁止或stale來源不能憑舊快照繼續外傳與回寫。

把U16原U17接收頁升級，保留工作位置、說明、筆記及待辦。完整與局部輸入用不同readiness；缺少重要約束先回源模組補充，不能自行生成較寬鬆的科學准用範圍。

---

## 4. 三研究目標、獨立工具模式與文件成熟度

沿用JOURNAL_SCI_SSCI、NSTC_GENERAL、MOE_TPR；資助路線、發表路線、文件用途、language profile及research maturity分開。

- JOURNAL_ENGLISH：期刊英語科學翻譯／同語言潤稿，可選en-US／en-GB，保留原研究事實。
- NSTC_PROPOSAL_ZH_HANT_TW：國科會一般研究計畫繁體中文學術表達，另處理已存在的英文摘要；保留工作包、規劃樣本、預算、假設與預期時態。
- MOE_TPR_PROPOSAL_ZH_HANT_TW：教學實踐課程問題、介入、學生學習及評量表達；不能把「擬改善」變成「已顯著改善」。

國科會／教學實踐成果論文可選JOURNAL_ENGLISH，但仍保留原Goal與計畫關係。切換語言profile不改主目標、不覆蓋原計畫或其他稿件edition。

保留首頁「獨立翻譯／潤稿」入口：STANDALONE_TEXT_LANGUAGE_EDIT。使用者自己的段落或匯入稿，不必先完成17個階段；但標示IMPORTED_UNVERIFIED／LANGUAGE_ONLY，不能因此取得U16科學核准或推進正式研究燈號。需要併入正式稿時，回U15／U16建立來源與scope。

PARTIAL_SCIENTIFIC_LANGUAGE只处理U16准用段落；PLANNING_LANGUAGE可处理未有結果的計畫文字；SOURCE_STALE／USE_BLOCKED的內容不送正式語言流程。普通工作可規劃及保存，不強迫每份文件有所有研究結果。

---

## 5. Language Work Order與一次授權的工作流程

建立LanguageWorkOrder：project／document／source snapshot、目的、source locale、target locale/script、revision branch、准用scope、排除區塊、處理強度、科學約束hash、術語版本、引用profile、provider plan、外傳權限、費用上限、重試／迭代上限及核准方式。

主按鈕：「老麥一鍵完成已授權內容的翻譯與學術潤稿」。執行前簡短顯示處理範圍、語言、引擎、估計用量與是否傳送未公開稿；一次授權後可連續分段處理，不逐段彈確認。超範圍、超預算、換provider／region或敏感內容才重新確認。

任務鏈：Intake → Source/Privacy Preflight → Term/Reference Pack → Segment Plan → Translate（需要時）→ Correct（需要時）→ 選擇性Rephrase → Restore & Align → Mechanical QA → Semantic Review → 允許的採用／鎖草稿 → 全文一致性 → 整稿確認與handoff。

不是所有稿件都強制經過每一個引擎；已是目標語言可跳翻譯，文法本已正確可記NO_CHANGE_NEEDED。Methods／Results預設Conservative；Introduction／Discussion可在scope內Balanced；Substantive language edit需更嚴格語義核對，不代表准重寫研究內容。

source already locked不需要解鎖才能翻譯：將固定源稿投影到有transform permission的新語言分支；若來源有NO_DERIVATIVE／NO_EXTERNAL_PROCESSING另行阻擋。target的人工／使用者鎖則不能被批次覆寫。

---

## 6. External Language Provider Gateway與能力登錄

沿用現有Gateway，沒有時只增量補上統一adapter，不在每個章節直接寫供應商HTTP程式。內部介面可含translate_text、correct_text、rephrase_text、grammar_check、translate_document（可選）、capabilities、usage、health；這些是網站介面，不是假設供應商都有同名endpoint。

核心優先串DeepL Translate、DeepL Write與既有「老麥」語義服務；LanguageTool有相應API／企業授權或自架能力再接診斷；Google／Azure及其他已接工具保留備援或文件處理，不要求本輪新增訂閱或每次都跑一遍。所有fallback重新核對用途、script、保護策略與費用，不默換較貴或不同資料政策的服務。

ProviderCapabilitySnapshot至少保存operation、account_scope、request/response schema reference、endpoint/API version、實測日期、支援locale/script、feature constraints、body大小與單位、批次數限制、markup／placeholder策略、glossary／TM／style能力、region、cost model及資料政策來源。

分開DOCUMENTED、ACCOUNT_ENABLED、CONNECTION_TESTED、CONTRACT_TESTED、LIVE_VERIFIED；有文件不等於帳號支援。有可用官方能力API就查；沒有則用具版本文件＋contract tests，不虛構/capabilities。快照過期重新核對，不因讀取失敗清掉有效舊設定或假稱停用。

UI主助手仍叫老麥，但「外部處理同意、費用、稽核、學術揭露」必須呈現真實provider名稱；品牌簡化不可以隱藏對外傳輸或AI用途。所有credential reference只在server，不入browser、Git或一般log。

---

## 7. DeepL Translate／Write正式接入與本輪核對結論

依官方當前文件與實際帳號執行contract tests，不直接照抄舊版參數。以下為2026-09-07查閱快照，不是永久版本保證。[S1–S6]

| 操作 | 本輪確認的能力／限制 | 網站實作要求 |
|---|---|---|
| Translate | /v2/translate，文字翻譯與可用的context／glossary／tag等功能 | 語言對、feature與request schema要相容；Context只用必要背景，不當system prompt |
| Write Correct | /v2/write/correct，同語言最低限度校正 | 英文Methods／Results可優先採用，但仍需語義及引用QA |
| Write Rephrase | /v2/write/rephrase，同語言重組；支援時可選academic | 不是跨語言翻譯；writing_style與tone不能一起傳，不預設confident語氣 |
| Write權限／大小 | 官方Quickstart列API Pro及整個request body 10 KiB | 依實際UTF-8序列化body計量，含JSON、標記與escaping；不以字數當byte |
| 語言能力 | /v3/languages可依resource查語言及features | Translate與Write分開查；不能用Translate有中文推定Write支援繁體或academic |

Translate與Write分開Pipeline；一個Write成功不能被記為完成跨語言翻譯。官方Write schema本輪未列Translate的tag_handling／ignore_tags／glossary參數，不把Translate保護策略不加驗證地移植到Write。[S3][S4]

Translate glossary需適配指定source/target；有多glossary能力也先在本站合併衝突，再送出有效設定。TM／style／custom instructions等只在能力與帳號核實後啟用，不把全部進階參數當每次必填。官方文件更新時保留快照版本與adapter tests。[S5]

paid網站版與API訂閱分開；不得宣稱使用者已購買API Pro或本輪已LIVE測通。auth與usage測試需有合法憑證和預算；test用非機密短句，且保留實際結果而非印出key。

---

## 8. 繁體中文、英語變體與語言正確性

網站保存語言＋script＋region，例如zh-Hant-TW、en-US、en-GB，再由adapter映射服務所支援的BCP47／provider code；不能以資料庫一律ZH或EN抹掉繁簡和地區需求。[S6]

台灣中文計畫書預設繁體與台灣常用學術術語，保留官方計畫名稱及核准專有名詞。英文變體按目標或作者選擇；沒有查得期刊規定就標作者偏好，不編造期刊一定要求美式。

若API的Write只提供簡體或不支援目標script／academic style：顯示operation-specific限制，使用已授權且能符合zh-Hant-TW的既有模型／校稿引擎，或只做可支援部分。不得默默轉成簡體再把字形轉回就宣称繁體學術潤稿通過。

語言偵測可協助提示，不能覆寫使用者指定語言；混合中英文段落、引用、縮寫、公式、標題及專有名詞分開處理。locale normalization、script QA與語義QA均保留結果。

英文原稿的en-US→en-GB屬變體調整，不強制經中文回譯；零更動是有效工作結果，不為顯示AI做事而改写每句。

---

## 9. 科學含義约束與Semantic Unit資料模型

直接讀U16 ScientificMeaningConstraints，不由U17另生成更寬鬆的約束。每個ScientificSemanticUnit連結source sentence/claim、subject、relationship、outcome、condition/group、timepoint、population/scope、quantifier、negation、certainty、causal ceiling、method/result refs與required qualifiers。

保護內容不只數字：對象、研究設計、實際vs規劃、主要vs探索性、方向、單位、尺度、分母、結果狀態、時點、未做的程序、重要限制及正式聲明都要保持。

區分HARD_LITERAL（標識、數字、公式等）、REFERENCE_BOUND（引用與Fact節點）、SEMANTIC_BOUND（否定、範圍、推論）、AUTHOR_STYLE_LOCK（作者希望保留表達）與NO_EXTERNAL／NO_DERIVATIVE。保護的類型不同，不能全部當不准翻譯的字串。

跨語言可正當重排詞序與拆句，不能移動數值的歸屬、把分組結果寫成總樣本、把模型預測寫成觀察真實值、把未顯著寫成等效、把may變成證明。

源文存在矛盾、歧義或錯誤時標SOURCE_CLARIFICATION_REQUIRED，回U16或原輸入查證，不為流暢自行選一個答案。language quality分數不抵銷任何科學內容硬性缺失。

---

## 10. 受保護節點、Token Codec與安全還原

重用U15的AST與typed reference nodes。原ResultFact、CitationSource、Quote、公式及Table/Figure Reference保留ID＋version/hash，翻譯只處理可譯文字，回寫不得把typed node降級成無來源字串。

建立ProtectedSpanManifest：node_id、type、source_ref/version、原始payload hash、所在claim、locale renderer、可移動邊界、source/target occurrences及保護策略。token生成唯一nonce，避免和使用者文字撞名；使用schema allowlist，不把provider返回的任意ID當本站引用。

Translate XML可用受支援tag_handling／ignore_tags保留指定span；XML parser禁用DTD／external entity，escape文字，允許的markup白名單。[S2] 若Write或其他provider無強標記能力，採驗證過的opaque marker／結構化adapter並逐次核對；不可靠的段落改用受約束模型或只生成建議，不強送後假裝保護成功。

校驗不只count：集合與multiplicity、來源mapping、claim歸屬、單位、組別、時點、比較順序與周圍語義一起核對。跨語言合法重排不應僅因全篇token順序不同就一律拒絕，但跨claim錯置必须阻擋；一般markup可能複製不等於ResultFact可重複。新文字內所有未有來源的科學數字也要偵測。

禁止「token遺失後把數字隨便貼回句末」或由模型猜mapping。失敗輸出留candidate/quarantine，不寫入准用稿。來源仍在原稿，無需從外部provider重建。

opaque token不是匿名化保證；上下文仍可能暴露研究機密。是否外傳須另外通過資料用途與保密檢查。

---

## 11. 數值、統計語言、公式與Methods專有表示

NumericIntegrityCheck重用ResultFact renderer，按typed Fact核對值、符號、小數位／精度政策、區間端點、N與分母、%與percentage points、正負號、單位及reference level。允許經核准locale renderer做表示轉換，但不得改原值或計算新效果。

p < .001不能變成p = .001或p = .000；負數CI端點與括號不可丟失；OR、risk ratio、相關係數、标准化／非標準化係數不可換尺度；「兩個班、60位學生、180筆測量」不能全部變成N=180。新百分比、合併N、換單位或新摘要統計需回U14產生正式Fact，不在潤稿模型內算。

公式、程式碼、變數代碼與資料欄位名不翻譯；其旁邊說明可翻，但記號與上下標需保留。LaTeX、Unicode負號、百分號、希臘字母、scientific notation與零寬字元做round-trip測試，不用regex取出所有數字後排序比較就當一致。

Methods中的規劃、實際執行、未完成、排除與缺失處理時態按來源保留。特殊名稱保留原始版本或核准譯名；不能把matching翻成randomization、把未盲化寫成雙盲、把可用樣本寫成已做Power。

純拼字或格式錯誤可依已授權範圍修正；若科學意義受影響，建立ScientificMeaningChangeRequest回U16，不直接更動正式Fact或Method來源。

---

## 12. 術語庫、同義詞與縮寫一致性

沿用Project Terminology Bank，按workspace權限引用可共用的公開術語，不將私密稿件字句暴露給其他Project。每筆包含concept/construct ID、source term、target term、locale/script、definition、domain、allowed variants、disallowed conflations、case、plural、abbreviation、first-use rule、source refs、scope、version、approval。

以「同一構念」而非表面同詞決定統一：learning outcome、achievement、performance是否同義由研究定義判斷；不能全域取代後把不同結果混在一起。hazard recognition、situation awareness、flow等均連到原構念，不新增理論。

優先尊重U16科學術語約束；其下以明確適用範圍處理工具正式名稱、專案核准詞、目標期刊指南、領域與一般術語。衝突要出候選与理由，不由provider任意決定。不要把詞尾、大小寫與一般複數形態差異都視為錯誤。

傳給DeepL的glossary是本地已決議內容的投影；遠端ID及版本只是一個binding，不是唯一來源。建立／更新遠端glossary屬外部寫入，必須在既有授權範圍內，失敗不毀掉本地術語。

縮寫依Abstract／正文／表註等適用規則檢查首次定義；無明確期刊要求則標作者／網站偏好。title、keywords、caption與正文使用同一術語版本。

---

## 13. Translation Memory與重用安全

重用既有Translation Memory，不另建可互相矛盾的記憶庫。source-target segment保存source hash、locale pair、術語／style版本、必要上下文、permission、protected-reference shape、語義QA、採用者、採用時間及適用Project／document scope。

只有通過適用QA且由授權程序採用的對照可加入；若僅AI自動候選，保留CANDIDATE_ONLY，不當正式可重用譯例。Rejected、stale、source changed及撤權條目不可自動套用。

Exact match也重新檢查來源與permission；fuzzy match只能是建議，不因相似度高就把舊組別、數字、否定詞或引用貼到新句。專案特有Fact ID不能跨Project移植；以可解析reference shape做重用時仍需新source binding及完整QA。

本地TM是可追溯與權限控制基線；DeepL遠端TM等僅在已核實API與帳號能力、明確外傳／寫入授權下映射。API文件與UI功能可能不同，不假設所有帳號都能以API创建、上傳或刪除記憶庫。

撤回或隱私處置需傳播到TM、cache與遠端可管理副本；保留最小tombstone，不在稽核日誌複製本應刪除的敏感句子。

---

## 14. 分段、上下文、請求大小與雙語對齊

LanguageJobSegment依語義段落、句子、表格儲存格及標題建立，保存stable source anchors、payload hash、source version、section目的與返回位置。不切開token、公式、引用節點或UTF-8字元；可在句群邊界分批，不任意每固定N字切一次。

計量採實際序列化request的UTF-8 byte長度，含JSON／XML escaping及額外context；預留安全空間並按provider limits snapshot驗證。400不當成無限重試，413要安全重分段；不要因中文一字一byte的錯誤估算造成丟文。

Context packet含必要的前後文摘要、構念定義與所在章節目的，不包含未授權段落或Raw。context需標為CONTEXT_ONLY，provider若把它重複輸出到正文必須被QA偵測。多text request不假定彼此共享上下文。[S7]

BilingualAlignment支援1:1、1:n、n:1的句／段連結；source anchor不可變，target新anchor對應原claim與reference。正常拆合句可接受，但需coverage檢查，不能漏掉限制句、重複前後文或把相鄰段落合併後失去定位。

語法檢查器常返回文字offset；adapter要記錄provider index單位及對應的確切payload版本，轉成本站anchor。Unicode、emoji、組合字、HTML與placeholder造成的offset差異須測試，不可把原offset直接套到已改寫的最新版文字。

---

## 15. 科學翻譯模式與逐章策略

TRANSLATE_FAITHFULLY只轉語言，保留研究內容、證據層級、文字功能與論述先後；不趁翻譯增加新文獻、新理由或新結論。缺少主詞、指代不清或原句自相矛盾時保留Issue及候選，不能擅自選定研究事實。

Methods、Results、Abstract結果句、Ethics／Funding聲明預設Conservative與較高風險檢查；Background／Introduction／Discussion可Balanced但仍限原含義。預期成果保留will/aims/proposed等計畫時態，正式結果保留實際來源，不全篇機械改成過去式。

提供逐段或整章候選；源稿只讀，語言edition允許修改可譯文字，不允許更動source Fact／Citation payload。使用者可鎖某個target segment、要求替代版本、保留原文或選不翻譯。

摘要可有同源中英對照，但不能為壓字數只保留有利結果。部分准用Results不得擴寫成完整論文結論；全文缺源章節仍明顯標明未核准，不靠翻譯補齊。

所有輸出保留origin=TRANSLATION／VARIANT_ADAPTATION／LANGUAGE_CORRECTION等來源，避免日後把machine translation誤認為原始受訪者引文或原始研究資料。

---

## 16. 學術潤稿、修改強度與章節差異

提供CONSERVATIVE、BALANCED、SUBSTANTIVE_LANGUAGE_EDIT三種強度。Conservative修正文法、拼字及明顯語病；Balanced改善句法、銜接、冗長及術語；Substantive允許重組句段但必須保存claim、限定詞、引用關係及完整對齊，不是新科學論述授權。

來源版與候選版顯示：修改前後、diff、修改分類、理由、字數差、source refs、meaning risk及QA狀態。不追求固定降字率或每句必改；可維持作者風格、第一人稱／被動語態等合理選擇。

Results避免為語氣「更有力」而加clearly、robustly、proved或statistically significant；Discussion維持可能解釋、相反證據與限制。Null或mixed結果不被改成正向結論。

國科會中文強化科学問題與方法的清晰連貫，不添加未核准成果；教學實踐中文保留課堂問題—介入—學生成果—評量鏈，不把技術新穎性誇大成學生已改善。

文法建議的採用依位置、科學風險與鎖決定；不能「接受全部grammar suggestions」後改壞變數代碼、引文、公式或p值。

---

## 17. Semantic QA、否定／不確定性與回譯

QA分三類：DETERMINISTIC（referential、數字、syntax、coverage）、MODEL_ASSISTED_SEMANTIC（意義差異候選）、HUMAN_RECONCILIATION（指定範圍採用／確認）。三者不混成一個「100%正確」。

逐Semantic Unit比較：添加／省略、主語、對象、群組、時點、作用方向、尺度、數量詞、否定／雙重否定、必要保留語氣、因果強度、比較／交互作用、量表／技術名稱、方法時態、confirmatory/exploratory及研究限制。

例：「未觀察到足夠差異證據」不能變成「兩組等效」；「模型預測改善」不能變成「實測證實改善」；「僅在本樣本」不能消失；統計中介不能被修成完整因果機制。目標語句流暢或token完整都不能使這些問題PASS。

回譯或第二引擎比較可選且僅處理授權範圍，主要用於Abstract、Primary Results、Conclusion、倫理或其他高風險句；必須先確認費用及provider權限。同一模型回譯或兩引擎一致不等於獨立真人驗證；輸出差異提示與不確定性，不以相似度門檻取代內容判讀。

每個semantic issue記source／target anchor、severity、疑慮或confirmed、evidence、可行候選及裁決。有限retry修復後仍無法保真，保留來源與問題，不強制PASS。只是不自然的語言可繼續修正；源內容的科學疑慮回U16。

---

## 18. 引用、Zotero、直接引文與受限工具內容

所有Citation仍由既有CitationSource及Zotero binding管理。正文引用位置可隨合法語序調整，但引用必須繼續支持同一claim；不能將一個citation移到含新主張的段落尾就假稱支持整段。

書目作者、原始題名、期刊、年份、DOI、URL、卷期頁不由翻譯服務改寫。需要非英語題名譯文時，保存獨立的translation label與來源用途，不覆蓋Canonical Metadata；引用樣式與locale由原citation renderer處理。[S9]

受訪者直接引文保留原文、來源定位、准用範圍、原/譯語言及翻譯者／程序。不得做無痕「學術潤稿」改變其聲音或原意；翻譯候選另存，依倫理與使用授權核對。已公開出版的英文逐字引用同樣不重新rephrase後仍保留引號。

量表題項、手冊、測驗答案或正式知情同意文字不是一般潤稿素材。若要求改動，回U10工具調適／U09倫理文件流程，保存授權、調適與再審需求，不因U17語言QA就宣称工具已驗證或倫理文件已批准。

Zotero斷線可用合法已固定的本地Citation snapshot繼續允許工作，明示需同步核對；不清空References或自動整庫更新。最新遠端metadata不得覆寫已審來源，須diff、採用及相依重驗。

---

## 19. 表格、圖說、補充材料與非文字資產

本輪可處理已准用的表格標題、欄標、圖說、替代文字、補充檔說明及章節標題；每個文字資產都有parent Table/Figure及source version。數據矩陣、座標、error bars、線條、統計標註與單位不重新生成。

既有繪圖服務可依核准label map重新render同一資料圖，建立display version並核對來源hash。不可使用生成式圖像工具重畫研究結果或修改原始影像；沒有可重現來源時只產生標籤翻譯提案。

方程式與code block保留不變；名稱或旁註可依能力單獨處理。圖中文字無可編輯來源時標需人工處理，不假裝已完成圖片內文字更換。

Table/Figure reference號碼屬renderer呈現，可依合法重排重編；source ID與結果綁定不變。本文、表圖及補充材料的數值／術語／符號一起核對，不只正文PASS。

受限附件不因存在Project就全部外傳或匯出。獨立Supplementary需單獨source permission、scope及文檔用途記錄。

---

## 20. 期刊語言適配、字數與官方規則

使用U03／U08／U15／U16的Target Journal Writing Profile及OfficialRuleSnapshot，只查本輪語言相關範圍：English variant、摘要結構、縮寫、術語、包容性語言、正文／abstract字數、圖說和語言服務揭露。Official requirement、網站建議與作者偏好分開。

期刊指南版本過期時定向重查；讀取失敗顯示SOURCE_UNAVAILABLE，不說官方未公告。仍可在作者指定中性風格下起草，但不能顯示已符合最新期刊語言規則。沒有指定期刊可用Journal Family profile，不虛构要求。

字數以renderer/tokenizer實際計數，記方法、語言、是否含References、表註及摘要；中文「字數」與英文word count不混用。超標提供安全縮寫候選，不能删主要陰性結果、研究限制、必要方法、倫理資訊或把數值藏到未交付附件。

同語言風格轉換不重選期刊、不改原研究問題；期刊最終字數、結構、匿名化、作者、費用與附件全面合規留U18。本輪記錄受影響項与待辦，避免要求先完成U18才能完成U17。

---

## 21. LanguageTool、備援與帳號授權

LanguageTool只作拼字、文法與style診斷，將建議定位到exact payload版本再映射本文。規則disable理由與自訂詞典沿專案保存，不把方法術語一律自動修成常見詞。

官方公共HTTP頁面明確限制自動化請求；網站批次流程要用相符的企業／API授權或自架實例，不能把免費public endpoint當自動備援。[S8] 一般Premium名稱不必然等於已取得本網站用途之API資格，開工核對帳號。

Google／Azure等已有文件服務可透過同一gateway接入，但必須個別核對語言、region、文件保留、版面、標記保護及費用能力。不以「DeepL失敗」授權自動外傳到所有供應商。

文件翻譯即使能保留版面，也不等於保留Citation Field、ResultFact binding或科學語義。輸入整檔須額外同意且可做round-trip驗證；本輪預設以結構化稿件逐段處理，不能先上傳機密整篇再檢查PII。

缺少外部provider時，保留本地編輯、來源、術語、機械QA及合法既有模型；同樣外部托管的「內部老麥模型」仍是外部資料處理，不可標成LOCAL_ONLY。

---

## 22. 稿件保密、資料政策與外部傳輸

LanguageProcessingConsent保存provider／region、目的、文檔與scope、上下文範圍、TM/glossary遠端寫入、保存／訓練政策引用、預算及授權期限。來源release不等於外傳授權；付費不等於機構已允許，零保存或不訓練政策未核實時標UNKNOWN。

外傳前最小化稿件、檢查PII及機密分類；Identity Vault、Raw、可識別学生成績、完整敏感逐字稿與禁止外傳附件不送語言／文獻API。PII scanner只是輔助，不能以掃描未命中宣稱沒有私密資訊。

API keys只在server secret references；一般log只存job／來源hash／錯誤碼，不存完整文稿、token mapping或key。加密、role-based download、短效下載連結、source revoke、retention與合法刪除流程沿用現有平台。

provider URL及回呼需allowlist、防SSRF；外部輸出與上傳文件只作資料，禁止不安全HTML、macro、DTD、任意shell與tool指令。網站聊天不能繼承建站OpenClaw的主機管理權；session routing不能代替tenant授權。[S12]

同一供應商或同Project的不同manuscript仍逐一核對scope；cache/TM必須tenant隔離且納入source permission與policy版本。正式外傳前與採用前都重查授權，避免background在撤權後回寫。

---

## 23. 用量、費用、重試與取消

BudgetPlanner分開estimated／reserved／reported／reconciled usage，按provider計費單位保存字元、token、文件最低費用、幣別與費率快照；無費率時只顯示可測用量或費用未知，不編造金額。

子job送出前原子保留預算，並核對project／manuscript上限。context可能不计某種費用但仍有大小與隱私成本；翻譯、Write、第二引擎與語义模型分别記帳，不能只算第一輪。

對429／5xx依已驗證錯誤策略有限退避；413安全分段；401/403/配額類錯誤停止對應功能並提示設定。沒有provider idempotency或任務查詢能力時，超時可能已計費，記PROVIDER_OUTCOME_UNKNOWN，不立即無限重送或保證外部exactly once。

本站採用與交接可幂等，不等於外部計費只會一次。取消停止尚未發出的子任務；已發出請求未必可取消或退費，遲到內容只隔離保存，不能復活稿件或突破預算。

恢復只重做確實未完成或需重驗範圍，來源、術語、權限及版本都包含在cache key。預算達上限保存已完成内容及缺失，不自動換另一個付費provider。

---

## 24. 採用、回退、目標版本鎖定與併發

每段候選可選接受、編輯後接受、拒絕、替代版本、保留原文、鎖定。允許已授權的低風險批次採用與保留完整diff，避免逐段強制確認；核心高風險句與全稿最終release由有權者確認指定版本。

source canonical manuscript不可變；target language edition沿同一Manuscript lineage追加，記source_ref、locale、purpose、base revision、terminology/style/provider設定與採用紀錄。新target譯文不標成原文已改或原受訪者說法。

採用由後端檢查document、scope、nested references、source hash、target base_revision、依賴與locks。使用者在provider執行中修改、鎖定或取消時，遲到內容只能成為CONFLICT_CANDIDATE；不能用刪除重建段落、整章替換或切active version繞鎖。

鎖有來源文字不可改、科學約束、target內容鎖及用途禁止等不同含義。一般source lock允許有權翻譯衍生版；NO_DERIVATIVE不允許。UI清楚說明鎖對哪個對象生效，不因全篇源稿已鎖而強迫解鎖科學定稿。

單一段落回退要重驗受影響的術語、引用與全稿一致性；不把舊QA報告貼到新hash。保留原候選與採用原因，合法隱私處置仍可透過專門機制限制／刪除應處理內容。

---

## 25. 科學含義變更回送與語言重驗

語言工具若發現源稿錯誤或只能透過改變科學內容才能解決，建立ScientificMeaningChangeRequest，帶source/target anchors、U16 constraints、問題類型、建議、來源與差異，導航U16或原正確模組。

數值問題不得在U17手動修；回U14分析或U13/U10規格處理，經相應驗證及U16重審後才採新source。已知未做的方法不能以「潤稿補敘述」新增。正常語法修正不要求重跑全套科學審查，按影響及scope區分。

SOURCE_STALE影響只精確傳播至依賴段落及其摘要／結論／表圖等；新科學版本採用後重新生成或人工修訂受影響語言，做整稿一致性掃描。舊ScientificReviewSnapshot保留，不靜默換成新內容。

回送請求進度可在U17查看；完成後「保存並返回翻譯與學術潤稿」。U16未處理的核心意義問題不能以ACCEPTED_RISK或回譯分數解除。

原稿中已合法接受的限制繼續保留，不因翻譯工具想讓句子強勢而要求抹掉限制，也不因有局部不確定性就阻止全部低風險語言工作。

---

## 26. AI／語言協助紀錄與期刊揭露

沿用U15／U16的AI用途紀錄，追加實際使用的翻譯、correct、rephrase、grammar、第二引擎、模型語義檢查、人工修改及範圍；記provider、可查版本、使用日期、目的、source範圍、採用結果與human oversight。

網站外觀統一老麥，不表示可把正式學術揭露全部寫成老麥而隱去實際服務。AI不是作者；也不能由系統代作者承擔責任、簽署或宣称完全未使用AI。

依目標期刊当前政策區分基本拼字文法檢查與生成式／實質改寫；不得一律「所有工具都需聲明」或「語言工具永遠不用聲明」。例如Elsevier目前對基本檢查與實質句構修改有不同揭露說明，最終以適用期刊規定確認。[S11]

本輪產生LanguageAssistanceRecord及DisclosureDraft候選，保留政策source與待辦；U18做最終合規與作者确认。政策未知不刪除使用史，也不為了省揭露切換成假手寫標記。

不得提供AI偵測規避、繞相似度工具、仿造母語證明或保證Q1／接受率功能。回譯與潤稿服務的商業名稱或品質分數不能當同行評審證明。

---

## 27. 首頁、工作區與逐段操作介面

首頁保留未完成專案下拉、儲存／讀取／新增、研究流程圖、功能導覽、近期成果、老麥情境協助，以及頁底醒目的「刪除本專案（移至回收筒）」與復原。不得因增加語言工作室移除這些功能。

U17頁首顯示Project、Manuscript／Proposal、source科學版、source scope、target locale、target edition、儲存狀態、目前job、用量、來源stale與review狀態。導航名稱「翻譯與學術潤稿」，用途用白話說明：改善表達，保留研究事實。

主要工作區採來源／目標對照及右側證據／問題面板；手機改上下排列而非極寬表格。可切整稿阅读、章節目錄、術語、來源與token、QA、用量／provider、版本與匯出。進階設定收合，不用20個必填Tab擋一鍵入口。

每個候選呈現原文、建議、diff、理由、意義風險、protected references、字數變化及操作。高亮要配文字或圖示，不能只用紅綠顏色；鍵盤可聚焦、動態任務結果可被輔助技術讀取，固定工具列不能蓋住欄位或刪除區。

主要CTA依狀態改變：啟動一鍵翻譯潤稿／查看處理進度／尚缺N項前往補足／檢視整稿並確認語言版／完成語言品質檢查前進「最終合規與送件成果包」。未建U18則保存真實交接並顯示準備內容，不跳空白頁。

對本輪範圍外的Cover Letter、正式Response Letter或量表調適，只提供正確入口，不假裝已生成並完成。

---

## 28. 全項Assist、精確缺失導航與恢復

每個可編輯欄位、段落、術語、對齊、QA issue、profile與聲明候選接入FieldAssist／SectionAssist／StageAssist及FieldPolicy，提供解說、帶入／翻譯／校正／查證、優化、鎖定與来源。

保留FILL_EMPTY、IMPROVE_UNLOCKED、FILL_AND_LOCK；這些只補目標語言內容、設定與建議，不填假Result、Citation、付款、核准或人工確認。ResultFact只讀欄位也有「老麥解釋／前往來源」，不是沒有AI按鈕。

缺失至少包含：problem、reason、blocks_action、due_phase、source/version、scope、assist_action、destination、return_context。例：target繁體Write不支援 → 前往provider語言設定；NOT丟失 → 直達该句對照；Citation錯位 → 前往原claim；來源錯誤 → 回U16。

後端重新驗證才解除issue，不能因點過連結就解決。補完提供「保存並返回翻譯與學術潤稿」並恢復section、segment、游標與篩選。待人工或來源問題不阻擋其他已准用段落繼續。

切換專案／稿件／語言edition先處理未保存變更；失敗留在原稿。API錯誤、provider暫時失效、權限不足及下一模組缺失分開說明，保留Partial outputs。worker重啟可復原，不重新跑已完成且有效的付費段落。

---

## 29. 整稿Language QA、實際匯出與可追溯品質包

局部QA後執行全稿檢查：來源准用coverage、未翻譯／重複段落、語言與script、術語與縮寫、數值／單位／群組／時點、引用與bibliography、表圖、Abstract與正文一致、否定／不確定性／限制、被破壞格式及已採用變更。新稿hash不同，舊QA不可沿用作正式PASS。

QA status分PASS、WARNING、FAIL、NOT_ASSESSED、UNSUPPORTED、SOURCE_REVIEW_REQUIRED；「未找到問題」不是保證沒有問題。得分只供管理，不抵銷數字錯誤、source revoked或核心語義問題。不是所有警告都必須消滅，合理作者風格或已確認差異可記處置與理由。

建立LanguageQualityReport、BilingualAlignmentPackage（同語言時為版本對照）、TerminologySnapshot、ProtectedReferenceManifest、ChangeLog、UsageSummary、AssistanceRecord及ComplianceHandoffPackage；共用資料用refs，不複製一套Fact或Zotero item。

最低真實輸出：目標語言整稿Markdown、結構化可重開稿件、source-target alignment JSON、References、Fact/Citation／表圖Manifest、QA與修改／使用紀錄。檔案必須真的有bytes、hash與下載ACL；匯出失敗有重試入口，不生成假URL。

既有DOCX／PDF／LaTeX能力可靠就重用並round-trip核對AST、數值、字母、公式、引用與版面。静態引用不冒充Zotero Word動態欄位；只有實際建立且在相容環境驗證後才顯示可刷新欄位能力。[S10] 不為加入動態引用而擅自改使用者桌面Zotero設定。

獨立語言工作或局部稿匯出需明示LANGUAGE_ONLY／PARTIAL；正式完整語言版附本輪准用scope與source，不能把輸出一個檔案當所有作者已同意送件。

---

## 30. Stage Gates、局部釋出與流程燈號

分開module health、job execution、source eligibility、provider access、mechanical QA、semantic disposition、user adoption、language release及submission readiness。建站fixture測試不替真實稿件點亮研究燈號。

1. **LANGUAGE_INTAKE_AND_SCOPE_READY**：合法U16交接或明確獨立／計畫書adapter、固定source／scope／工作單。沒有provider憑證仍可編輯與本地預檢，不偽造Live完成。
2. **LANGUAGE_PROCESSING_QA_COMPLETE**：範圍內各segment有真實輸出／NO_CHANGE處置、對齊與referential／數值／語義等檢查狀態完整。此Gate不等於所有錯誤已修正，也不等於作者已採用。
3. **LANGUAGE_REVISION_VERIFIED**：已採用target版與source符合，核心錯誤已解決或回U16完成正確處置，無來源撤權與critical semantic問題，整稿一致性重驗。
4. **LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE**：有權者確認固定target版本及准用scope，QA/package/disclosure inputs/source manifests完整，原子保存release及handoff。

source是局部且`full_manuscript_language_allowed=false`時，target不能宣稱全稿正式語言完成。可保存PARTIAL_LANGUAGE_RELEASE且對U18只准局部合規預檢；STANDALONE_LANGUAGE_ONLY不轉成科學核准，也不自動完成正式研究階段。

狀態建議：DRAFT、PROCESSING、AWAITING_SOURCE、QA_ISSUES、AWAITING_ADOPTION、PARTIAL_LANGUAGE_RELEASE、LANGUAGE_APPROVED_FOR_COMPLIANCE、SOURCE_STALE、USE_BLOCKED。首頁完整綠勾寫「指定語言版完成」；待確認／局部用文字及警示，不說期刊已接受。

U18最終指南、全作者投稿同意、APC、Title Page、完整匿名化、Cover Letter與外部送件都不是現在語言工作的前提。不得製造「先有Submission Package才能完成Language Package」循環Gate。

已符合要求且不需要改字的稿件可用no-change audit完成，不強迫翻譯或買DeepL／多引擎才能前進。語義問題不能只由AI自評高分、自動鎖定或接受風險強行解除。

---

## 31. U17→U18快照契約、API與原子交接

輸出 **LanguageQualitySnapshot**，接收方為新版第十八階段「目標期刊／計畫最終合規、送件文件與成果包」。SCI／SSCI走期刊最終合規；計畫書透過既有U08／U09 route adapter準備申請包，不重選學門也不強迫有Results。

```text
schema_version / snapshot_id / workspace_id / project_id
stage_key = V3-U17 / next_stage = V3-U18
document_id / manuscript_id / document_purpose / goal_context + revision
input_scientific_review_snapshot_refs[] + version + hash
scientific_revision_ref + version + content_hash
source_scientific_release_state / full_manuscript_language_allowed
source_allowed_scope_refs[] / language_work_order_ref / source_baseline_ref
source_locale / target_locale / language_mode / edit_intensity
language_edition_ref + version + content_hash
language_processed_scope_refs[] / adopted_scope_refs[] / untranslated_scope_refs[]
segment_plan_ref / bilingual_or_revision_alignment_ref / accepted_change_manifest_ref
scientific_meaning_constraints_ref / semantic_unit_manifest_ref
protected_reference_manifest_ref / result_usage_manifest_ref / methods_source_manifest_ref
claim_evidence_map_ref / citation_manifest_ref / bibliography_manifest_ref
zotero_reference_manifest_ref / qualitative_quote_usage_ref
table_usage_manifest_ref / figure_usage_manifest_ref
terminology_snapshot_ref / glossary_binding_refs[] / translation_memory_usage_refs[]
provider_plan_ref / capability_snapshot_refs[] / provider_attempt_refs[]
external_processing_authorization_refs[] / usage_and_cost_summary_ref
mechanical_qa_refs[] / semantic_issue_dispositions[] / language_quality_report_ref
scientific_meaning_change_request_refs[] / source_update_adoption_refs[]
human_language_review_records[] / target_style_profile_ref
language_assistance_record_ref / disclosure_candidate_ref / policy_snapshot_refs[]
language_evidence_package_ref / compliance_handoff_package_ref / export_manifest_ref
language_release_state / formal_compliance_allowed / compliance_allowed_scope_refs[]
allowed_next_actions[] / unresolved_issue_refs[] / later_stage_requirements[]
locks_manifest / source_dependencies / privacy_access_constraints
source_manifest_hash / created_by / created_at
```

JSON Schema及正反fixtures必須驗證nested refs、scope包含關係、locale、hash與來源權限；同ID不同hash拒絕，未知新欄位可按版本策略相容，但不能吞掉新的重要授權限制。

長任務與renderer在transaction外，先暫存artifact；短transaction重查ACL、source、base revision、locks與Gate後保存Edition Release、Snapshot、Audit和handoff outbox。outbox採至少一次投遞，U18按snapshot/version幂等消費，不把provider重試與完成交易混在一起。

U18未建時提供真實可重開receiver：語言版、scope、科學約束、References、QA、使用紀錄與晚期待辦。保存成功但跳轉失敗可重開原快照，不重新翻譯或扣費。原U16 source與原語言版都可追溯。

最小邏輯模型重用或擴充：LanguageWorkspace／WorkOrder／Edition、SegmentPlan／Alignment、ProtectedSpan、TermBinding／TMUsage、ProviderCapability／Attempt／Usage、LanguageIssue／Adoption、MeaningChangeRequest、QAReport／LanguageRelease／LanguageQualitySnapshot。不要每個名詞都建一张新表，更不能複製ResultFact與CitationSource。

API能力：initialize/resume、workorder、capabilities、estimate、run/status/cancel、segments/candidates、accept/reject/lock、term/TM、qa/issues、upstream change request、export、release/handoff。一般patch不能修改Fact、SourceRelease、費用回執或人工核准。

錯誤至少：HANDOFF_SCHEMA_UNSUPPORTED、SOURCE_HASH_MISMATCH、LANGUAGE_SCOPE_NOT_AUTHORIZED、SOURCE_STALE、LOCALE_OR_SCRIPT_UNSUPPORTED、PROVIDER_FEATURE_UNSUPPORTED、EXTERNAL_PROCESSING_BLOCKED、REQUEST_TOO_LARGE、PROVIDER_OUTCOME_UNKNOWN、BUDGET_LIMIT_REACHED、PROTECTED_REFERENCE_MISMATCH、SEMANTIC_DRIFT_REVIEW_REQUIRED、REVISION_CONFLICT、LOCKED_CONTENT、READ_ONLY_RESULT_FACT、LANGUAGE_RELEASE_BLOCKED、EXPORT_FORMAT_UNSUPPORTED、HANDOFF_SAVE_FAILED。全部附可恢復操作與精確導航，不以HTTP200空白掩蓋失敗。

---

## 32. 四個實作批次與最低可用閉環

**Batch A｜相容與來源保護**：U16契約、source/target edition、scope與Lock、Work Order、protected AST／token manifest、已有語言元件重用及UI骨架。測試源稿已鎖仍可合法建立翻譯分支，未授權範圍不能外傳。

**Batch B｜可用語言服務與對齊**：DeepL Translate／Write adapter、既有老麥模型、capability／locale／bytes／成本控制、分段／context、術語與TM、同語言潤稿、optional grammar QA。沒有Live key可mock完整flow，但要清楚標示；不得只放DeepL Logo或假回應。

**Batch C｜QA、採用與上游回送**：Mechanical＋Semantic QA、citation/quote、table/figure labels、差異與採用、鎖定／競態、U16修訂請求、局部重驗、整稿與真實匯出。

**Batch D｜釋出及無斷層交接**：首頁燈號、下一步、缺失直達、有限重試／取消／重啟、LanguageQualitySnapshot schema、U18 receiver/consumer tests、60項驗收與rollback。

最低示範閉環：指定源稿 → 實際可用provider輸出 → 數字／引用／語義檢查 → author或既有授權採用 → target edition保存與重開 → 真實整稿／References／QA匯出 → scope-aware下一步。未完成外部功能不阻擋可交付的本地部分，但本地測試不能冒充Live翻譯成功。

---

## 33. 60項適用驗收案例與判定方式

以下是要求OpenClaw在實際網站執行的驗收，不是本次對真實網站的測試結果。機械案例用可重現fixture；語義案例需有人可核對的預期判斷，不能只用模型自評作通過證明。

### 來源、目標與相容

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T01 | 有效U16交接初始化與重開 | 同一Project/Manuscript；固定scientific revision與hash，保留筆記，不重建另一篇。 |
| T02 | 來源Gate是新版名稱、稿件非v2 | 使用SCIENTIFIC_REVISION_READY_FOR_LANGUAGE或明確alias，不強求舊編號。 |
| T03 | U16只有部分語言准用範圍 | 只處理allowed scope；不能以局部完成釋出全稿。 |
| T04 | 獨立翻譯段落／計畫書 | 可以使用合適adapter，不要求未來研究結果；保持LANGUAGE_ONLY或計畫用途。 |
| T05 | 三Goal、三語言profile切換 | 不覆蓋主目標／原計畫，MOE_TPR不回退成期刊模板。 |
| T06 | 跨專案nested Fact或Citation | 後端拒絕，不得透過改URL或cache取得其他研究資料。 |
| T07 | 科學源稿已鎖、有翻譯衍生權 | 源稿不改即可建立target edition；不是要求解除科學鎖。 |
| T08 | 來源NO_DERIVATIVE或已撤權 | 阻擋不允許動作，舊快照不能繞過。 |
| T09 | 同source snapshot ID但hash不同 | 顯示conflict，不默換latest。 |
| T10 | 語言本已符合要求 | 保留NO_CHANGE_NEEDED，不為了進度製造多餘改寫。 |

### API、語言與資料保護

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T11 | 中翻英呼叫路線 | 先Translate，Write僅同語言；不得用Write一次冒充翻譯與潤稿。 |
| T12 | DeepL Write權限未具備 | 明確BLOCKED或使用已授权可用服務；不稱API Pro已設定。 |
| T13 | 中文＋XML／JSON escaping造成body超限 | 依實際UTF-8 bytes安全分段，token及字元不被切斷。 |
| T14 | 將Translate ignore_tags等參數傳給Write | adapter schema拒絕或不送；不假設Write提供相同保護。 |
| T15 | writing_style與tone同時設定 | 提供可理解衝突處理，不發無效request或靜默改意圖。 |
| T16 | 目標繁體但provider只有其他script | 顯示不支援或用已授權合適引擎，不靜默簡繁來回。 |
| T17 | en-US／en-GB變體切換 | 只變語言表達及合法拼字，來源研究事實不變。 |
| T18 | 未核准外部傳輸或payload含Identity資訊 | 送出前阻擋；不先傳後掃描，也不把老麥名義當本機處理。 |
| T19 | LanguageTool公共免費端點作批次自動化 | 禁止該配置；要求合適API／企業授權或自架。 |
| T20 | 備援provider或region改變 | 重新核對授權、費用及能力，不以主provider失敗自動擴張外傳。 |

### 科學含義、數值與引用

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T21 | Result token遺失／重複／未知ID | 保留失敗candidate，不能把數字猜回或寫入正式target。 |
| T22 | token完整但群組A、B互換 | 語義與關係檢查標出direction/group mismatch，不能因count一致PASS。 |
| T23 | p<.001改為p=.001或.000 | Numeric QA失敗，保留原結果。 |
| T24 | 负CI端點、百分比與百分點 | 保留符號尺度與單位，不以字串相似度放行。 |
| T25 | 同一稿件有招募N、分析N、觀測列數 | 分母語义與來源維持，不能全變成同一N。 |
| T26 | 未顯著變成無效果／等效 | 標semantic drift，不能只因p字串未變而PASS。 |
| T27 | may／associated移成證明因果 | 依U16 claim constraints標出過強語氣，不一律用RCT標籤代替判讀。 |
| T28 | 翻譯刪除否定詞或研究限制 | Coverage與semantic QA找到定位，限制不能被壓字數抹去。 |
| T29 | Citation ID不變但綁到新主張 | 保留claim-citation relationship，標不適當移動／新增主張。 |
| T30 | 公式、變數名及科學符號 | round-trip保持來源與內容，不被grammar工具改成普通文字。 |

### 術語、對齊與特殊內容

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T31 | 同一字串對應兩個不同構念 | 術語依concept ID及context處理，不能盲目全域replace。 |
| T32 | glossary與已鎖定專案詞衝突 | 先在本地處理衝突，不由API任意挑選。 |
| T33 | fuzzy TM匹配舊句但數字／否定不同 | 只能建議且重新bind/QA，不直接套用舊Fact或引用。 |
| T34 | TM條目撤權／stale／未核准 | 不能自動重用或跨Project暴露。 |
| T35 | 合法1:n句子翻譯與詞序重排 | alignment能保留coverage與claim，不只按token全序判fail。 |
| T36 | context被重複輸出為正文 | 偵測新增／重複內容，不把context當新源段落。 |
| T37 | grammar offset與emoji／Unicode／AST不同 | 正確映射exact payload版本，不能改到錯的字。 |
| T38 | 質性直接引文送academic rephrase | 阻擋無痕改寫；翻譯另存原文、定位及用途。 |
| T39 | 正式量表題項或同意文件要求改寫 | 回工具調適／倫理流程，不用Language QA替代驗證或核准。 |
| T40 | 表圖文字、數據及靜態／動態Citation匯出 | 只改有來源label；保持數值，靜態引用不冒充Word可刷新欄位。 |

### 採用、成本與可靠性

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T41 | 已授權低風險批次採用 | 可一次連續處理並保存逐段來源／diff，不反覆彈確認。 |
| T42 | AI完成前作者修改或鎖定target | 遲到輸出存conflict candidate，不覆寫。 |
| T43 | 整章替換／刪除重建避開子節點鎖 | 後端同樣拒絕。 |
| T44 | 取消任務或回收專案 | 子任務停止採用，不復活內容；已送出外部請求不假稱必然退款。 |
| T45 | HTTP timeout但可能已處理 | 記PROVIDER_OUTCOME_UNKNOWN，無provider支援不保證外部exactly once。 |
| T46 | 多worker接近預算上限 | 原子reservation防超支，不自動改用其他付費服務。 |
| T47 | 重啟服務／刷新頁面 | checkpoint可恢復，重用仍有效segment，不重複採用或無故重翻。 |
| T48 | 來源更新導致stale | 僅重驗相依內容且整稿掃描，不把舊QA貼到新hash。 |
| T49 | 源稿有科學錯誤 | 建立U16回送，不在U17偷偷改Fact或已做方法。 |
| T50 | provider輸出含外傳指令或危險markup | 只當資料，無任意tool/shell/SSRF/DTD能力。 |

### 釋出、交接與驗收誠信

| 案例 | 測試情境 | 必須達到的結果 |
|---|---|---|
| T51 | 語義問題未裁決但AI自評高分 | 完整release阻擋，分數／自動鎖不能取代處置。 |
| T52 | 全稿確認與局部語言完成 | 分開記錄；局部不能點亮全稿或取得正式投稿同意。 |
| T53 | U18尚未建置 | 真實receiver可看語言版、scope、constraints、QA及待辦，能返回。 |
| T54 | 保存成功但導航失敗或outbox重播 | 重開同一snapshot，幂等消費，不重跑語言API。 |
| T55 | 目標期刊語言規則未核實 | 可中性風格草稿，標待核對，不假稱最新合規。 |
| T56 | 基本grammar與生成式rephrase紀錄 | 分別保存實際用途；依適用policy產生候選揭露，不一律免除或捏造。 |
| T57 | Markdown/JSON整稿及QA包匯出 | bytes/hash/引用/Fact manifest真實存在且一致，不能空下載。 |
| T58 | 只有mock／fixture沒有Live key | 清楚報MOCK／NOT_RUN／BLOCKED，不稱研究稿已真正翻譯。 |
| T59 | 語言工作完成後的Stage燈號 | 只表示指定語言版准交合規，不表示科學證實、期刊接受或政府核定。 |
| T60 | U18 consumer contract驗證 | 校驗source/target hash、准用scope、locale、issues與ACL；來源撤權或hash衝突拒絕。 |

---

## 34. 交付、環境說明與停止條件

交付修改／新增檔案及理由、資料與API相容mapping、migration與rollback、實際來源契約、語言provider與capability測試、source/target edition資料流、Semantic Unit與token codec、術語／TM、精確對齊、Assist／Lock覆蓋、QA與採用、U16回送、真實匯出、LanguageQualitySnapshot schema及U18 consumer tests。

每項測試回報command、環境、資料來源、期待／實際結果、PASS／FAIL／NOT_RUN、log/artifact reference及阻擋原因；不在log洩漏key或機密稿。分開LIVE、MOCK、FIXTURE、SYNTHETIC_LANGUAGE_TEST、NOT_RUN、BLOCKED與UNSUPPORTED。

說明目前位於開發、測試或正式環境，沒有真實部署就不要寫「已上線」。缺外部憑證仍交付本地功能、必要設定及未驗證清單；不能只回答「完成」。

更新真正repository的PROJECT_STATE.md：V3-U17版本、實作範圍、目前schema與Gate、provider能力、locale限制、檢查覆蓋、測試、已知風險、回復方法、handoff檔案位置及U18待辦。

本輪交付的科學來源仍由U16管理；正式投稿前的完整格式、作者聲明、匿名化、APC與對外送件由U18及其後續處理。不以「全站智慧化」擴張本輪到所有後续功能。

**完成新版第十七階段後停止，等待使用者提供下一階段指令。**

---

## 參考來源與查證範圍

以下資料是工程與出版原則參考，不自動加入使用者Project的文獻列表或Zotero。檢視日期：2026-09-07。供應商schema、能力、權限、費率與政策在實作時重新核對。官方文件不同頁面更新時間可能不同；以operation-specific schema、帳號能力及實測共同判斷，不混用舊範例。

- **[S1] DeepL Write Quickstart.** https://developers.deepl.com/docs/translate/write-quickstart  
  用於翻譯與同語言Write分工、API Pro條件及request body限制；不是使用者帳號已開通的證明。
- **[S2] DeepL Translating XML.** https://developers.deepl.com/docs/translate/translating-xml  
  用於Translate markup與ignore_tags；不是語義保真保證，也不是Write能力。
- **[S3] DeepL Correct text.** https://developers.deepl.com/api-reference/improve-text/correct-text
- **[S4] DeepL Rephrase / Writing style.** https://developers.deepl.com/api-reference/improve-text/request-text-improvement 及 https://developers.deepl.com/docs/translate/controlling-writing-style-and-tone  
  用於correct/rephrase可用schema、academic及style/tone互斥；本輪查閱schema未列Translate的XML保護參數。
- **[S5] DeepL Translate text.** https://developers.deepl.com/api-reference/translate/request-translation  
  用於Translate glossary、context、style、TM及其他實際參數；帳號與功能需另測。
- **[S6] DeepL Languages API.** https://developers.deepl.com/docs/languages/using-the-languages-api 及 https://developers.deepl.com/docs/getting-started/supported-languages  
  用於依resource、locale及feature檢查，不能跨operation推論能力。
- **[S7] DeepL Context parameter.** https://developers.deepl.com/docs/learning-how-tos/examples-and-guides/how-to-use-context-parameter  
  用於最小必要context與多text request的上下文行為。
- **[S8] LanguageTool Public HTTP API / API information.** https://dev.languagetool.org/public-http-api.html 及 https://help.languagetool.org/hc/en-us/articles/39254488835095-Does-LanguageTool-offer-an-API  
  公共免費服務不適合自動化批次；核對企業/API或自架能力，不將未核實授權當可用。
- **[S9] Zotero Web API v3 basics.** https://www.zotero.org/support/dev/web_api/v3/basics  
  用於既有Library／Item與引用資料的重用，不擴大遠端寫入。
- **[S10] Zotero Word Processor Plugins.** https://www.zotero.org/support/word_processor_integration  
  用於區分格式化靜態References與真正可刷新動態欄位。
- **[S11] Elsevier Generative AI policies for journals.** https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals  
  用於實際用途、作者責任及基本校正／實質改寫的揭露差別；不是所有出版社的統一政策。
- **[S12] OpenClaw Security.** https://docs.openclaw.ai/gateway/security  
  用於Gateway信任邊界及session不是授權憑證；網站需自行執行tenant ACL與工具權限。
