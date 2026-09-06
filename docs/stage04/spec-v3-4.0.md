# 老麥科研網站 V3｜第四階段完整建置提示詞 v3.4
## 研究藍圖與研究規劃：三目標專業規劃、證據連結、一鍵協作與無斷層交接

**工程識別：V3-U04-FULL｜日期：2026-09-06｜時區：Asia/Taipei。**

> 使用者已完成新版第一、第二、第三階段。本文件只建置新版第四階段。
> 交付對象是協助修改網站的 OpenClaw 建站工程代理；不是給老麥的角色設定、獨立 Skill，也不是請代理直接替使用者完成研究內容。
> 本文件可獨立執行，不必拼接舊版第四階段「理論與機制」提示詞。前置資料契約以第三階段 V3-U03-FULL／v3.4 為基準，實際程式名稱依 repository 對照。
> 「階段已建好」只表示使用者回報工程進度，不表示每個研究專案已完成該研究階段。本文件未查閱真實網站程式、憑證或部署日誌；工程代理必須實際盤點與測試。

---

## 1. 任務目的、邊界與本輪唯一主流程

實際建立「老麥・研究藍圖與研究規劃」，把已採用題目和投稿導航決策轉成可編輯、可追溯的研究總計畫。

```text
新版第一階段：專案、文獻／證據、Zotero、任務、權限與版本
新版第二階段：雷達 → 靈感 → 選題 → TopicSelectionSnapshot
新版第三階段：投稿與計畫導航 → SubmissionNavigationSnapshot
                                        ↓ 本輪直接接收
新版第四階段：研究藍圖與研究規劃
  目標與問題 → 目的／RQ → 初步方法／資料需求
  → 工作包／時程 → 證據需求 → 風險與條件 → 藍圖規劃基線
                                        ↓ BlueprintPlanningSnapshot
新版第五階段：文獻深化與Gap／新穎性驗證
  使用既有「文獻與證據中心」，不新增第二套文獻系統
```

本階段完成「研究規劃基線」，不是最終科學驗證、正式研究設計、倫理核准或完整稿件。

包含：接收第三階段、三目標藍圖、目的一RQ映射、初步研究邏輯、工作包與時程、證據覆蓋與補強任務、風險與需求、全欄位Assist與Lock、首頁燈號、下一步、可恢復工作、第四至第五階段交接。

不新建：完整選刊／選學門引擎、全領域Gap正式驗證、完整理論與機制實驗室、正式研究設計與Power計算、IRB送審、量表全文、Pilot、研究招募、資料分析、完整計畫書或論文、翻譯平台、對外送件。若後續舊模組已存在，保留並建立adapter，不破壞舊資料。

長期訴求是「一鍵協作完成專業且可用的期刊與計畫」。本輪的一鍵必須真正完成現有資料允許的研究藍圖，不得靠編造文獻、課程、數據或核准來宣稱已完成全文。

## 2. 先盤點實際網站，再安全增量實作

先找真實repository、分支、未提交修改、部署環境及實際PROJECT_STATE.md。不要把OpenClaw自己的workspace當成網站程式庫。

優先讀第三階段已交付的handoff schema、consumer contract test、compatibility map與測試結果。不存在時從程式盤點並補建；不能要求使用者重新提供已存資料。

至少確認：
- Project／workspace權限、首頁與Project Context、回收筒。
- TopicSelectionSnapshot、SubmissionNavigationSnapshot、GoalContext、NavigationDecision、PositioningVariant。
- 第三階段建立的「研究藍圖交接接收頁」與已有Blueprint資料。
- StageRegistry、StageReadinessService、StageActionBar、RequirementIssuePanel。
- FieldAssist／SectionAssist／StageAssist、FieldPolicy、Lock、Version、Audit Trail。
- AgentJob、queue／worker、checkpoint、取消、預算與外部來源adapter。
- 文獻與證據中心、ProjectLiteratureLink、Evidence、CitationSource、ZoteroBinding及Consensus等現有API。
- ResearchObjective／ResearchQuestion／WorkPackage等既有模型、寫作資料來源及匯出服務。

形成「實際名稱 → 本輪用途 → 相容映射 → 缺項 → 最小修正 → 驗收」清單。

保護原則：保留未提交修改；不清庫、不reset研究資料、不替換登入／框架／ORM、不刪測試或關閉權限以求通過。相容migration先在測試副本驗證。正式migration、正式部署、破壞性操作及新增費用另行授權；安全開發環境中可完成的工作要實作，不只Audit後停止。

## 3. 精確接收第三階段交接契約

藍圖的初始來源是第三階段的已保存交接，不是模型的聊天記憶，也不是任意取Project最新文字。

必須接受、驗證並保留：

```text
snapshot_id / schema_version / workspace_id / project_id / work_order_id
source_topic_selection_snapshot_id / topic_version
goal_context_revision / fingerprint_version / navigation_revision
research_stage / primary_goal / funding_intent / publication_intent
target_year / institution_ref / target_output
selected_and_provisional_candidate_refs / candidate_versions
journal_family_or_discipline_direction / alternative_routes
positioning_variant_refs / decision_rationale / decision_origin
assessments / coverage / eligibility_states / hard_constraints
rule_snapshot_refs / call_status
literature_ids / evidence_ids / citation_source_ids / zotero_bindings
risk_register_refs / downstream_open_requirements / due_phase
blueprint_requirements / handoff_limitations / lock_manifest
completion_basis / readiness_snapshot_ref / created_at / checksum
```

`target_output=ROUTE_PLAN`是上游工作單結果，不能直接覆蓋成本輪結果。建立關聯的本輪`target_output=RESEARCH_BLUEPRINT`工作單，繼承已授權scope或要求一次工作範圍確認，不擅自發起所有後續工作。

完整接收`blueprint_requirements`中的核心問題、初步RQ／Gap、貢獻、方法方向、所選路線建議、已有資料、未知事實及禁止覆寫內容。上游暫定、資格UNKNOWN／FAIL、硬限制及來源待查狀態原樣保留，不能因進入藍圖就變成VERIFIED或PASS。

未知schema_version回`HANDOFF_SCHEMA_UNSUPPORTED`並提供修復；可相容舊格式用明確adapter，保存原payload與conversion provenance。驗證每個嵌套source/candidate ID屬於該project或合法共用範圍，不能只驗外層project_id。

## 4. 初始化、恢復與上游變更

第三階段前進後：
1. 以同一project_id開啟既有接收頁，升級為完整藍圖工作區。
2. 初始化去重依`project_id + source_navigation_snapshot_id + work_order_scope + schema_version`；同來源已有藍圖就恢复，不自動重跑付費任務。
3. 原題與來源鎖是唯讀baseline；本輪草稿建立派生版本與差異，不直接更動原題／RQ。
4. 保留前版接收頁內的筆記、待辦、位置與來源，不以空白新頁替换。
5. 若無交接，提供「返回投稿導航完成交接」精確入口；仍可查看既有資料，不能自行採用第一名候選。
6. 舊專案有實際研究內容但無新格式快照時，提供有權限的相容匯入，保留來源與缺項；不要求重打一遍。
7. 第三階段選擇更新時，不靜默切到最新快照。顯示舊／新差異，允許保留分支或明確rebase；經確認後建立新來源綁定版本。
8. 讀取、重新整理、再登入及重開不得產生第二個Project、重複Blueprint或重複付費job。

## 5. 三大目標、工作範圍與研究時間身分

沿用ResearchGoalRegistry：

| goal_id | 顯示 |
|---|---|
| JOURNAL_SCI_SSCI | SCI／SSCI國際期刊論文 |
| NSTC_GENERAL | 國科會一般研究計畫 |
| MOE_TPR | 教育部教學實踐研究計畫 |

主目標、funding_intent、publication_intent、目標年度與本次交付物分開。國科會／教學實踐計畫可同時規劃期刊成果，建立共同研究核心與路線特有視圖，不複製三份互相漂移的RQ。

切換Tab是檢視，不是改主目標。真正改目標需影響預覽、新GoalContext版本與重新檢查；三種模板、API、validators、job、cache和handoff都必須包含MOE_TPR。

保留`input_state`與每個內容的`temporal_status`：
- `PROPOSED_BEFORE_STUDY`：研究執行前建議。
- `DOCUMENTED_PRIOR_PLAN`：有時間戳支持的既有事前規劃。
- `AS_CONDUCTED_RECORD`：已有實際研究紀錄，唯讀引用。
- `RETROSPECTIVE_PLANNING_NOTE`：研究完成後整理，不冒充事前假設或預註冊。

已有資料／結果／稿件時，允許接入既有研究計畫，但不得把未執行的方法補寫成已做，也不得將看到結果後形成的假設改標confirmatory。

## 6. 藍圖核心內容：一份研究總計畫，不是空白表單

建立下列可展開區塊。欄位附用途、輸入、預期產出、來源與老麥協助。

| 區塊 | 必須具備的規劃內容 | 當前成熟度 |
|---|---|---|
| 研究身分與目標 | 原題、工作題目候選、主目標、資助／發表方向、目標讀者或學門、目前研究階段 | 原題唯讀引用；路線可暫定 |
| 核心問題與範圍 | 誰／何種系統有何問題、情境、重要性、納入與不處理範圍 | 有來源或明示待查 |
| Gap與差異化線索 | 上游初步Gap、相近研究、可能新增價值、支持／衝突／待驗證狀態 | 不冒充正式新穎性驗證 |
| 總目的與Objectives | 一段總目的、可執行目標、各目標對應Gap與交付物 | 可由老麥起草 |
| Research Questions | 穩定RQ ID、問題、類型、單位、對象、情境、Objective、需要什麼證據 | 規劃版，不強制H1-Hn |
| 初步理論／機制／構念 | 候選理論、為何可能有效、核心構念、替代解釋、邊界 | 可不適用並說明；不是完整理論模型 |
| 方法與資料方向 | 方法候選、比較／觀察對象、資料來源類型、主要結果方向、時間需求、可行性 | PROVISIONAL；不做正式設計鎖定 |
| 工作包與里程碑 | 目標、任務、前置依賴、產出、驗收證据、角色、相對期間 | 規劃估計，不是已完成工作 |
| 資源與取得條件 | 人員角色、場域、工具、設備、資料存取、成本假設與替代方案 | OWNED/REQUESTED/PROPOSED/UNKNOWN分開 |
| 證據需求 | 已有Evidence、哪個主張缺什麼、搜尋任務、支持／反證與下游用途 | 連結既有中心 |
| 預期貢獻與產出 | 主要及次要貢獻、可能成果類型、適用範圍與判準 | 預期而非已實證 |
| 風險、決策與下一步 | 風險、未解問題、假設、到期階段、必補資料、單一Next Best Action | 帶責任與導航 |

不能用「待補」或不相關長文算完成欄位。自訂欄位同樣須接Assist／Lock／來源與權限政策。

## 7. 三目標的專業規劃模板

### A. SCI／SSCI國際期刊

承接第三階段的期刊或期刊領域群，形成：問題重要性、國際Gap線索、主要貢獻、Article Type、讀者、初步方法、需要的資料與結果、可能章節所需證據。

區分「期刊官方必備規則」和「依相近文章提出的研究品質建議」。例如建議長期追蹤不能誤標為該刊強制要求；查期刊scope與近期文章可協助定位，但不是保證接受。[S1]

沒有實際結果時，只規劃如何產生可回答RQ的證據，不能生成Results或預期顯著數字。方法／系統／質性／文獻研究依Article Type調整，不強迫每篇都有實驗組、量表、SEM。

### B. 國科會一般研究計畫

承接學門及規則快照，形成：科學問題、重要性與創新、主持人能力證據、研究目標、初步方法、工作包與依賴、團隊及資源、預期成果與經費方向。此規劃對應官方審查核心，但內部藍圖表不是官方表單或評分表。[S2]

計畫年限由使用者意向與適用官方規則決定；未知時用方案比較，不強制每案三年。多年期須有研究問題的延續與里程碑，不重複相同工作填滿年份。

研究履歷只能從真實Profile／授權文件引用。團隊角色可建議，不能替未同意的人員填上合作承諾。計畫書申請可以在研究前準備，不要求已有未來正式結果。

### C. 教育部教學實踐研究計畫

建立：

```text
實際或待確認的課程
→ 具體學習困難與問題證據
→ 可能根因（標示假設或已知）
→ 教學介入方向
→ 可能學習機制
→ 與課程目標相符的學生學習成果
→ 評量方向與資料需求
```

課程／主授／學生對象與學分資訊延續第三階段資格狀態；沒有資料保留UNKNOWN，允許條件式藍圖，不宣稱可申請。官方將教學實踐定位為從教育現場問題出發、透過教學介入與適當方法及評量檢證成效，並有授課相關條件。[S3]

教學品質判斷依研究問題決定；若問題是技能不足但只測滿意度，提出具體不一致。若研究本身是動機／情意成果，不能一律宣稱自陳工具不適用。至少說清楚何種證據能回答實際教學問題。

課堂基線資料可來自已合法提供的作業、成績彙整、觀察或訪談；沒有就建立「取得基線證據」任務，不編造低成績、失敗率或學生意見。

## 8. 建立Objective–RQ–Evidence規劃矩陣

唯一矩陣由既有Objective／RQ實體及關聯產生；畫面編輯和資料表不能各維護一份。

```text
Objective ID → RQ ID → 問題類型 → 分析／觀察單位
→ 構念或研究對象 → 所需證據 → 資料來源方向
→ 初步方法 → 工作包 → 預期貢獻
```

每列保存stable ID、source_ref、版本、狀態及待補項。RQ可為描述、關聯、因果、探索、設計、評估或綜合；不將所有問題當成因果研究。

例如（只作FIXTURE，不匯入真實專案）：
- RQ關心保留效果，應規劃延後測量或說明其他適當證據；時點尚未決定可列待設計，而非捏造已收30／90日資料。
- RQ關心系統延遲，規劃技術測試，不強迫填學生量表。
- 質性問題可用現象與觀點探索，不強迫建立自變項與統計假設。

初步假設需標HYPOTHESIZED與支持依據／待查，不能標已支持。理論提出的因果方向可作待檢驗機制；研究結論的因果強度留待設計與結果審查，不一律刪除合法因果研究問題。

矩陣為下一階段證據驗證及後續研究設計輸入，不在本輪直接執行ANCOVA、SEM或Power分析。

## 9. 工作包、研究路徑、時程與資源可行性

WorkPackage至少有：穩定ID、Objective/RQ refs、研究任務、deliverable、驗收標準、dependency、負責角色、owner_ref可空、所需資源、估計期間、風險、route_scope與狀態。

研究任務依賴使用可檢查的DAG；模型流程的概念回饋環另存，不能錯判成工作排程循環。偵測循環、前置工作晚於後置、無產出工作包、同成果重複計數與過度擴張範圍。

同一資料／技術平台服務計畫和期刊可以共用work_package_id；不同成果保留獨立完成條件，不把一份計畫書完成算成整個研究完成。

未有真實開始日期使用M1/M2、Week 1等相對時程，標註估計，不虛構calendar date。目標年、校內截止與官方截止分開；讀取失敗不是尚未公告。課程週次依實際CourseProfile或明示假設，不預設所有課都是18週。

資源表區分「已可使用、待取得、建議、未知」。尚缺合作場域可起草替代方案，但須記錄何時必須取得，不把建議當承諾。成本只作規劃：已知數值標來源／幣別／日期，假設單價明示estimate，後端計算subtotal。未知成本是null，不填0；本輪不建正式經費報銷或完整預算引擎。

依工作單指出最低可行研究範圍與可選擴充，不用多技術、多感測器、多中介堆疊作為專業品質指標。

## 10. Evidence覆蓋、來源身分與Citation Pipeline

全文參考文獻仍集中於既有文獻與證據中心。本頁只顯示具來源的Evidence摘要與連結；完整文獻列表、閱讀、篩選、全文與筆記操作仍回該中心。

每個重要規劃主張標示：
- `SOURCE_BACKED_STATEMENT`：有來源與精確定位，可核對支持程度。
- `USER_REPORTED_CONTEXT`：使用者提供事實，未必獨立驗證。
- `PROPOSED_DESIGN_CHOICE`：本研究建議做法，不冒充文獻共識。
- `HYPOTHESIS_TO_TEST`：待檢验關係。
- `ASSUMPTION_PENDING_VALIDATION`：假設或未知。
- `DOCUMENTED_RESULT_REFERENCE`：既有真實結果的唯讀引用。

EvidenceLink保存project／section／claim／RQ refs、literature_id、evidence_id、citation_source_id、source_revision、location、retrieval scope、processed coverage與support relation。SUPPORTS／CONTRADICTS／CONTEXT／INSUFFICIENT分開。

書目核對、全文可取得、實際處理範圍、人類阅读／機器閱讀、Claim支持、Zotero同步是不同維度。機器處理某幾段不能標成已讀整篇；存在source_id不保證支持claim。

同篇論文由Consensus、Ai4Scholar、Semantic Scholar等取得保留來源紀錄，不能算多份獨立研究。預印本和正式文章保留版本關係；近似title只產生去重候選，不自動合併不同研究。

Zotero沿用Library type + Library ID + Item key + Item version以及Collection關聯；item key不單獨作跨Library唯一鍵，也不是BibTeX citation key。正式引用的可靠本地CitationSource存在時，遠端暫時斷線不阻止規劃；呈現待同步即可。[S5]

來源遠端更新不覆蓋已鎖定段落，保留所引用來源版本與差異。學術文獻、官方規則、私有課堂資料及實際結果分別管理，不能將學生資料一律上傳Zotero。

## 11. 缺文獻時建立定向任務，不另造搜尋器

根據藍圖缺項建立`EvidenceNeed`，並送到既有文獻與證據中心／AgentJob執行。每項包含：

```text
need_id / project_id / blueprint_revision / section_id / claim_id / rq_id
purpose / role / what_must_be_verified / support_or_counterevidence
keyword_groups / suggested_query / population_context
source_preferences / freshness_rationale / retrieval_budget
existing_evidence_refs / acceptance_criteria / status / return_context_id
```

role沿用CORE／GAP／THEORY／METHOD／MEASUREMENT／SIMILAR_STUDY／DISCUSSION等。期間依問題決定，近期實證與奠基理論分開，不一律截斷為近三年。

Consensus是已納入架構的實際API來源，官方允許將搜尋嵌入應用流程。[S4] 與其他已串接來源共同用現有adapter，按任務與帳號權限選擇，不全部重查。端點、費率、能力及付費額度依現有契約；不在本輪硬寫供應商新功能。

任務去重至少包含project、blueprint revision、RQ／claim、query及purpose；已有結果先重用並判斷是否需更新。查無結果=該範圍未檢得；來源失敗=FETCH_FAILED；兩者都不是全球首創。

「老麥補充本區證據」可在已授權範圍跑定向檢索、整理與寫入候選來源，但不在本輪宣稱完成全套系統性回顧或正式Gap驗證。

閱讀來源與回傳結果分頁、去重、有限重試、完整保存partial結果。只有具真實回應才標LIVE完成；無憑證時可做本地資料規劃與Mock測試，不能把來源列未來功能後就不實作adapter。

## 12. 官方規則、假設、風險與晚期需求

延續第三階段OfficialRuleSnapshot，不重建另一套合規庫。保存適用年度、authority、document location、retrieved_at、verification status與適用動作。

期刊／計畫規則與研究建議不可混同。資格UNKNOWN不等於FAIL；已知FAIL不得以分數抵銷或AI補字變PASS。若資助路線不適用，可保留條件式參考或更改資助意向，但須明確決策，不能靜默換目標。

繼承`downstream_open_requirements`並保留原ID。新增需求標：
- `due_phase`：CURRENT_BLUEPRINT、GAP_VALIDATION、THEORY_MODEL、RESEARCH_DESIGN、APPLICATION、BEFORE_STUDY_START、MANUSCRIPT、FINAL_SUBMISSION。
- `blocks_actions`：EDIT_DRAFT、COMPLETE_BLUEPRINT、HANDOFF_TO_EVIDENCE_VALIDATION、CONFIRM_ELIGIBILITY、EXECUTE_STUDY、SUBMIT_EXTERNALLY等。
- `allowed_deferral_reason`、owner/未分派提示、field_ref、source_ref。

本轮不能要求取得IRB最終核准、正式樣本數、完整量表或研究結果才能起草藍圖；需要哪些倫理文件及何時提供，要依適用規則安排，不能一律推到計畫核定後。[S2][S3]

Risk/Assumption Register：內容、證據／假設、影響RQ或工作包、發生可能性、影響程度、處理方向、待確認動作、責任與期限。風險可評估但不能把估計機率寫成事實。

既有結果不可反寫為事前規劃；重複補助、數據或成果重疊需列風險與真實區隔，不只換標題就宣稱兩計畫可以同時申請。

## 13. 研究藍圖頁面、首頁燈號與操作說明

頁面上方顯示Project、三目標、來源選題／導航版本、目前工作版本、保存狀態、鎖定與審閱、證據狀態。既有未完成專案下拉、儲存／讀取／新增、回收復原、功能導覽與老麥對話全部保留。

主要工作區使用可展開內容，不一次放十多個擠在一起的Tab。建議：
1. 總覽與一頁研究計畫。
2. 問題、Gap與研究目標。
3. RQ與初步方法／資料。
4. 三目標專屬規劃。
5. 工作包、時程與資源。
6. 文獻與證據需求。
7. 風險、缺失與檢查。
8. 版本、決策與交接。

每區提供：用途、何時使用、已帶入資料、尚缺內容、完成產出與保存位置。每欄可點老麥解說，不只有空白輸入框。

右側／可收合面板提供來源、相關RQ、待辦、AI處理進度、已保留內容。老麥回答「目前要做什麼」使用真實registry與readiness，不自己發明未建置能力。

首頁流程圖加入或啟用「研究藍圖」節點：
- 灰色：尚未開始。
- 藍色：規劃中。
- 黃色：待補資料、暫定基線或來源需重驗。
- 紅色：真正錯誤或當前阻擋，附原因。
- 綠色勾選：研究規劃基線完成，顯示completion snapshot。
- 未建置後續模組：明示，不跳空白頁。

所有燈號加文字／圖示；綠燈只代表本階段規劃任務完成，不代表研究設計、Gap、倫理或論文通過。AI草稿鎖定須另顯示「自動草稿已鎖定／人工待審」。

首頁顯示本次成果路徑進度與完整生命周期兩種視圖。進度由版本化workflow和適用必要任務後端計算，不能由LLM產生百分比，不因本輪工程測試成功而把所有Project完成。

手機單欄／垂直流程清單；固定StageActionBar留足捲動與鍵盤空間，不遮欄位或危險區。底部紅色刪除區與下一步分開，沿用回收機制。

## 14. 全欄位、區塊與階段的老麥協作

沿用FieldAssist、SectionAssist、StageAssist與FieldPolicy，所有實際可見欄位包含自訂欄位有stable field_ref與適當操作；不是每欄都能自由生成事實。

| 欄位性質 | 老麥可做 | 必須限制 |
|---|---|---|
| GENERATED_DRAFT | 目的、RQ候選、方法方向、工作包、風險及規劃摘要 | 不冒充實證結論 |
| USER_FACT | 從授權Profile／課程／附件抽取，提供來源與差異 | 不編造職稱、學分、設備、合作、真實樣本 |
| EXTERNAL_FACT | 依現有adapter查證來源，提出新fact候選 | 不猜學門、期限、費用或文獻結果 |
| COMPUTED_FACT | 呼叫受控計算服務、解釋公式與輸入 | 不自由填進度、總額、比例 |
| PROTECTED_RESULT | 引用既有Result Fact及解說 | 不改N、p、CI、效果方向 |
| APPROVAL_OR_ATTESTATION | 解說、整理材料、導航本人確認 | 不代簽、認定IRB、計畫核定或投稿成功 |

每欄：`老麥一鍵協助`、`鎖定／版本化解鎖`、`查看來源與差異`。
每區：`補全本區`、`優化未鎖定內容`、`檢查本區一致性`、`鎖定本區`。
整階段：`老麥一鍵建立研究藍圖`、`一鍵補足可處理缺項`、`補全並鎖定規劃草稿`。

批次模式：FILL_EMPTY預設、IMPROVE_UNLOCKED、FILL_AND_LOCK。使用者一次授權範圍／來源／預算後連續處理，不逐欄彈確認。真正需要來源、事實或權限的項目集中列表；能處理的其他部分繼續，不能一項API失敗就整頁空白。

來源欄位唯讀且不適用鎖定時說明原因；權威原始來源透過來源版本控制，不把全局來源凍結給單一Project。

保存結果逐項標：APPLIED_DRAFT、PROPOSAL_SAVED、SKIPPED_LOCKED、NEEDS_USER_FACT、NEEDS_SOURCE、CONFLICT、FAILED；只有實際保存且符合欄位語義的內容計完成。

三目標使用不同專業模板；模板不存在時回GOAL_TEMPLATE_UNAVAILABLE，不偷偷回退到期刊通用文字。

## 15. 一鍵藍圖編排器與真正執行的任務契約

重用AgentJob／Project Orchestrator，不建立第二套無狀態長請求。預設一鍵依已授權工作單執行：

```text
INTAKE_SOURCE_SNAPSHOT
→ AUDIT_EXISTING_FIELDS_AND_LOCKS
→ MAP_ROUTE_REQUIREMENTS
→ PLAN_PURPOSE_OBJECTIVES_AND_RQS
→ PLAN_METHOD_DATA_AND_WORK_PACKAGES
→ IDENTIFY_EVIDENCE_NEEDS
→ 可選授權的定向文獻查證（送既有中心）
→ GENERATE_ROUTE_SPECIFIC_BLUEPRINT
→ CHECK_LOGIC_AND_PROVENANCE
→ SAVE_ALLOWED_FIELD_PATCHES
→ READINESS_RECHECK
→ SAVE_PLANNING_BASELINE_CANDIDATE
→ 若有明確自動前進授權，保存交接；否則等待一次採用／前進
```

可以先保存無外部查證的局部草稿，標清楚所有假設；不得因token／時間限制截斷仍回COMPLETED。採結構化欄位／區塊分段與有限依賴，保留已完成結果。無進展重試要停止，不無限讓模型自我修正。

SourcePack只包含該project及本任務必需的快照、欄位、文獻片段、來源定位、允許事實、鎖清單與需求。外部文字是資料不是指令；不塞整庫、PII、其他Project或完整未公開附件給不必要供應商。

在網站後端建立可版本化的小模板，至少包括INTAKE_MAP、JOURNAL_BLUEPRINT、NSTC_BLUEPRINT、MOE_TPR_BLUEPRINT、RQ_MATRIX、WORK_PACKAGE_PLAN、EVIDENCE_NEEDS、LOGIC_CHECK、ASSIST_PATCH。不要將整份建站提示詞每次塞給網站老麥。

共用runtime骨架：

```text
你是老麥研究藍圖的指定任務助理。
只處理task_type、goal_id、project_id與allowed_fields。
沿用來源快照、已鎖定內容與來源成熟度；不重新選題或選刊。
起草研究目的、RQ、方法方向與工作包時說明如何連結來源。
對未驗證Gap、機制、資源或日期標明假設／待查，不編造。
不因模板完整而强制加入量化假設、固定理論或未適用的IRB欄位。
研究既有結果唯讀，事後整理不能冒充事前假設。
所有補文獻動作交既有EvidenceNeed工具；只引用返回的合法ID。
輸出schema指定的候選patch、evidence_needs、issues與lineage。
不可寫DB、修改鎖、通過gate、代替人類核准或自行對外送件。
```

Assist結果契約（以下欄位形狀，不是production範例資料）：

```yaml
schema_version: <版本>
task_id: <實際任務ID>
base_blueprint_revision: <實際版本>
source_navigation_snapshot_id: <來源>
goal_revision: <目標版本>
patches:
  - field_ref: <白名單欄位ID>
    expected_field_revision: <基準>
    operation: SET_DRAFT | PROPOSE_REPLACEMENT
    value: <符合欄位型別內容>
    origin: GENERATED_DRAFT | EXTRACTED_FROM_SOURCE
    source_refs: []
    assumptions: []
    uncertainty: <可空>
evidence_needs: []
issues: []
summary: <只陳述真實完成範圍>
```

後端必須驗schema、project來源權限、內容型別、source_ref存在性與支持關係、未授權新事實、鎖、版本；合法JSON不代表正確研究。LLM不可輸出任意JSON path更新DB，patch只能使用FieldPolicy白名單。

Job保存來源快照、goal/source/lock revision、tool scopes、prompt/schema版本、budget cap、checkpoint、output revision與audit。同key不同payload回conflict；已完成task可重開不重複扣費。外部provider無冪等時不能保證exactly-once計費，逾時先確認既有結果並揭露可能費用。

## 16. 鎖定、審閱、版本與競態必須獨立

沿用欄位／區塊／artifact／handoff lock；手動、autosave、AI、同步、匯入與worker全部經同一後端寫入服務。

每次寫入原子檢查：membership、project未回收、goal_revision、source_snapshot綁定、base_revision、field revision與lock_revision。長AI任務完成前再次檢查，不能只在開始時驗權。

AI運作期間使用者改字、加鎖、換目標或來源，遲到結果只能成為候選／CONFLICT／STALE_INPUT，不能覆蓋。切換active_version或以整份section替換也不能繞過field lock。

`補全並鎖定`：只鎖本次成功保存、通過適用結構檢查且在授權範圍的草稿，actor=AUTOMATION_POLICY並保留policy_id與HUMAN_REVIEW_PENDING。不自動核准科學內容。

使用者解鎖建立新工作版本，原鎖定快照不可變；來源更新標LOCKED_SOURCE_STALE，提供差異／rebase，不自動解鎖。不要因一個外部來源更新把全Project歷史內容全部作廢，按依賴圖標受影響欄位。

至少獨立顯示：工作狀態、內容鎖定、人工審閱、來源證據、官方資格、研究執行授權。保存、鎖定、AI檢查與人類核准不能共用一個APPROVED值。

## 17. 缺失清單、精確導航與返回

所有問題沿用RequirementIssuePanel，每項必須含：

```text
issue_id / project_id / work_order_id / stage_id
entity_ref / requirement_ref / field_ref / tab_id / section_id
message / reason / severity / issue_type
source_refs / expected_action / assist_actions
status / due_phase / blocks_actions / allowed_deferral
owner_ref / return_context_id / revision
```

`前往補足`由server-side route resolver解析站內合法路由；帶正確Project、藍圖、RQ／工作包、Tab、field_ref。展開、捲動並聚焦欄位，不只到模組首頁。未儲存時先保存／放棄本地變更／取消，保存失敗不離開。

典型導航：
- RQ尚不具體 → RQ編輯欄位＋老麥擬定替代問題。
- Gap缺支持與反證 → 文獻中心帶project、claim/RQ、role=GAP、search purpose。
- 課程主授資訊未知 → CourseProfile正確欄位＋從授權文件抽取。
- 相對時程與工作依賴衝突 → WorkPackage的dependency欄位。
- 鎖定內容與新來源衝突 → 來源差異與rebase候選，不直接改原文。

修改後有`保存並返回研究藍圖`，恢復原頁籤與工作位置；後端重驗後才解除issue。已訪問、占位文字、AI自報或狀態手動勾選不能當作已解決。

若目標功能未建，提供同一資料schema的必要補資料抽屜或真實待辦接收頁，不製造死連結、不要求先完成未建引擎才能保存。

## 18. 一致性檢查、適用性與本階段Gate

使用共同Readiness Service與可版本化規則，避免藍圖自創另一套互相矛盾的完成引擎。

Logic Checker至少查：
- 問題／目的／Objective／RQ是否能對應。
- 方法方向及證據型態是否可能回答RQ。
- 研究保留效果是否有時間資訊需求。
- 教學問題、介入、學習成果與評量是否相符。
- 統計／技術／質性方案是否混套。
- 工作包有無RQ或產出、依賴循環及資源矛盾。
- 所選期刊或學門建議是否被當成研究已完成事实。
- 已有結果是否遭改寫成事前規劃。
- 主要宣稱是否有來源或明示假設；是否漏反證。
- 是否因目標切換而有模板錯用、未授權內容覆寫。

每個finding包含定位、rationale、evidence、嚴重度與可補路徑。模型可提出語義疑慮，但不能自行設fatal門檻或解除阻擋。未確認的模型疑慮需人工裁決，不保證零誤判。

內部Gate（映射實際服務）：
1. `BLUEPRINT_CONTEXT_READY`：合法Project、有效可讀的導航交接、工作範圍與目標脈絡。
2. `BLUEPRINT_PLANNING_READY`／`BLUEPRINT_PLANNING_PROVISIONAL_READY`：可用的研究規劃與誠實的條件式狀態。
3. `BLUEPRINT_HANDOFF_COMMITTED`：保存基線、完成狀態與下一階段交接。

允許正式規劃基線完成的最低條件：
- 來源鏈存在，目標／本次工作範圍可辨識。
- 核心問題、總目的、至少一個有意義的Objective及RQ／探索目的。
- 每個核心問題能對應初步方法與所需證據方向。
- 至少一個有效工作包，說清楚要產生什麼證據或交付物。
- 未證實Gap／資源／日期／效果已標示而非冒充事實。
- 文獻缺口已具體化為EvidenceNeed，外部引用可追溯或明示待查。
- 核心假設、限制及下游待辦可讀，沒有未解版本／鎖／隱私／偽造問題。
- 較晚需求依due_phase交接，不被遺漏。
- 已有使用者採用或有效的自動規劃基線授權；不冒充人工核准。

**不得要求下一階段正式Gap驗證、完整理論、Power、IRB、真實樣本或Results先完成。** 正是本階段生成的EvidenceNeed會交給下一階段處理，避免循環Gate。

缺少重要路線事實但研究問題可規劃時可存PROVISIONAL基線，首頁黃勾與具體待查；不解除資格或研究執行權限。若連研究問題與目的都無法形成，保存草稿但不宣稱完成。

缺所有外部來源時可先做LOCAL_ONLY／CONCEPTUAL草稿及定向查證任務；沒有引用不自動填假文獻，也不能把它升格「正式文獻驗證」。

## 19. 藍圖基線、版本與上游回寫方式

新藍圖第一份基線顯示`Research Blueprint v1.0 — Planning Baseline`；已有Blueprint時依現有局部版本號追加，不強制覆寫或倒退到v1，工程階段號與文件內容版本分開。

保留：
- 上游TopicSelectionSnapshot與SubmissionNavigationSnapshot不可變。
- 原題／採用RQ與本輪建議修改的差異；重要選題變更建立ChangeProposal並回來源決策，不靜默重選題。
- Blueprint工作版本、鎖定基線、來源manifest、人工審閱與auto policy。
- 學術內容以引用或基線必要快照保存；不要拷貝獨立文獻庫／結果庫。

狀態範例：NOT_STARTED、DRAFT、WAITING_INPUT、WAITING_EVIDENCE、IN_REVIEW、REVISION_REQUIRED、BASELINED、BASELINED_PROVISIONAL、STALE_SOURCE、ARCHIVED。名稱可以映射，但語義不能混用。

第五階段補文獻或發現反證後，提出受影響Gap/RQ/工作包的修訂候選，以新版本更新，不覆蓋基線。第二、三階段出現新版本同樣可diff/rebase；舊分支仍可回溯。

Project只更新當前stage/readiness與blueprint_ref，不把未驗證結果回寫成confirmed_topic已正式驗證，也不改計畫或投稿狀態。

## 20. 第四→第五階段完整交接與醒目下一步

下一階段名稱固定為新版「文獻深化與Gap／新穎性驗證」，使用既有文獻與證據中心；不是重建文獻引擎，也不是直接開始全文。

建立不可變`BlueprintPlanningSnapshot`（工程契約版本化）：

```text
snapshot_id / schema_version / workspace_id / project_id / work_order_id
stage_id / source_navigation_snapshot_id / source_topic_selection_snapshot_id
goal_context_revision / primary_goal / funding_intent / publication_intent
blueprint_id / blueprint_revision / planning_baseline_ref / planning_status
research_stage / temporal_status / adopted_or_provisional_route_refs
scope / purpose / objective_refs / rq_refs / hypothesis_proposal_refs
provisional_model_refs / construct_refs / method_and_data_plan_refs
work_package_refs / milestone_refs / resource_assumptions
literature_ids / evidence_ids / citation_source_ids / zotero_bindings
evidence_need_refs / conflicting_source_refs / search_task_refs
rule_snapshot_refs / risk_refs / requirement_refs / due_phases
lock_manifest / source_manifest / review_state / decision_origin
readiness_snapshot_ref / completion_basis / next_stage_id
limitations / created_at / checksum
```

對象最小必要必填需在schema定義，未知事實可null；空陣列表示確認沒有或尚未填要另有status，不能用空陣列隱藏資訊缺失。所有reference具有版本或能解析到immutable snapshot。

交接後端transaction保存baseline reference、completion、snapshot與transition／outbox。external API不放在長transaction內。consumer按snapshot ID去重；同冪等鍵不同payload回409／等價conflict。

防斷層：
- 第五階段已有：adapter開啟同Project工作區，讀此快照與EvidenceNeed，不重選題、不重打RQ、不自動重新評分。
- 第五階段未建：本輪提供真實交接接收頁，顯示已保存的藍圖摘要、研究目標、證據需求、搜尋計畫與待辦，可開文獻中心／返回；標示下一專業引擎待建置。
- 保存成功導航失敗：顯示「交接已保存，重新開啟」，重開不重跑AI。
- 消費者初始化失敗：保存HANDOFF_READY、可有限重試，不rollback已保存研究內容。
- 日後第五階段建好直接消費同schema，提供consumer contract tests。

主要StageActionBar：

| 真實狀態 | 按鈕與行為 |
|---|---|
| 規劃就緒 | **完成研究藍圖，前進「文獻深化與Gap驗證」→** |
| 暫定就緒 | **保存暫定藍圖並前進「文獻深化與Gap驗證」→**＋待查事項 |
| 必要缺項 | **尚缺N項，前往補足**＋**老麥一鍵補全** |
| 未保存 | **儲存並檢查下一步** |
| 執行中 | **查看老麥處理進度** |
| 來源／版本衝突 | **查看差異並重新檢查** |
| 下一專業引擎未建 | **保存交接並查看下一階段準備** |
| 交接已完成 | **繼續文獻深化與Gap驗證→** |

點下一步必須最後一次驗權、revision、lock、source與readiness。可在一次有限AUTO_ADVANCE授權內保存規劃交接，但不得啟動未授權的新付費工作或冒充人類審閱。

## 21. 最小資料模型、欄位契約與API

不要逐名字建表。先重用既有typed artifacts／JSONB／關聯表與索引，建立真正需要的最小模型。

本輪邏輯物件：BlueprintWorkspace、BlueprintVersion、BlueprintSection、ObjectiveLink、RQPlanningLink、MethodDataPlanningRow、WorkPackagePlan、MilestonePlan、ResourceAssumption、EvidenceNeed、BlueprintEvidenceLink、PlanningRisk、AlignmentFinding、BlueprintPlanningSnapshot。

既有ResearchQuestion／Objective／WorkPackage已有時引用並版本化；只對新候選建立proposal，不另建平行全集。

通用FieldEnvelope至少可表示：value、value_type、origin、source_refs、temporal_status、assumptions、evidence_state、review_state、field_revision、lock_ref。不要求每個欄位都複製相同JSON，服務可聚合多張來源表。

| 能力 | 示意API（依現有route風格映射） | 核心要求 |
|---|---|---|
| 初始化／恢復 | POST projects/:id/blueprints/initialize | 驗交接、冪等、不新Project |
| 工作區 | GET projects/:id/blueprints/:bpId | project範圍、回來源與readiness |
| 欄位保存 | PATCH .../sections/:sectionId | allowlist、revision、lock |
| AI起草／補全 | 既有Assist／jobs API | scope/budget、持久化、typed patches |
| 證據需求 | POST .../evidence-needs | 與既有中心任務去重關聯 |
| 一致性檢查 | POST .../checks | 固定規則＋有證據的模型候選finding |
| 缺失導航 | 既有issues resolver | 站內allowlist、field定位、return context |
| 鎖／解鎖 | 既有Lock／Version API | 原子保護、原快照不改 |
| readiness | GET .../readiness | due_phase/blocks_actions、非模型總分 |
| 完成與交接 | POST .../complete | 最後重驗、原子保存與冪等 |
| 重開交接 | GET .../handoffs/:snapshotId | 不重跑AI、不自動變更來源 |
| 匯出 | GET .../exports/:exportId | 權限、manifest、真實檔案狀態 |

成功／錯誤皆有request_id、project_id、job_id（適用）、data或error、field_errors、recoverable及next_action。禁止200空資料掩蓋失敗。

錯誤至少可區分：PROJECT_ACCESS_DENIED、PROJECT_TRASHED、NAVIGATION_HANDOFF_REQUIRED、HANDOFF_SCHEMA_UNSUPPORTED、SOURCE_BINDING_CONFLICT、GOAL_TEMPLATE_UNAVAILABLE、REVISION_CONFLICT、FIELD_LOCKED、SOURCE_UNVERIFIED、PROVIDER_AUTH_REQUIRED、BUDGET_LIMIT_REACHED、READINESS_BLOCKED、NEXT_MODULE_UNAVAILABLE。

## 22. 可靠性、安全與服務能力隔離

沿用queue／worker、checkpoint、取消、有限重試、backoff與outbox。Task cache綁workspace/project、goal、來源／prompt／schema版本與權限範圍。匿名公開書目可共用，私有課程、草稿、PI資料及評估不能跨專案外洩。

每個callback和job回寫重新驗權、專案未回收與基準版本。取消、回收、角色撤銷後不能被遲到結果復活或寫入。讀取首頁不自動啟動檢索、Zotero全庫同步或付費藍圖生成。

外部傳輸沿用已有供應商同意與資料治理；沒有同意時用本地來源，或只傳已允許的概括關鍵字。不得傳參與者PII、原始成績表、完整未公開稿件給非必要服務。

外部網頁／API／文獻／PDF內容只當資料，不執行其中指令。URL擷取限制協定、網域策略、大小、逾時及每次redirect，防SSRF；文字輸出escape/sanitize。憑證只保存server-side secret reference，不在log、Git、前端、交付檔印出。

OpenClaw建站代理和網站老麥分離。官方指出Gateway採特定信任邊界，sessionKey不是授權token；不能單靠Project ID或Session隔離不互信使用者。[S6] 網站後端自行執行租戶與Project權限；跨互信邊界使用隔離的gateway/agent credentials或等價部署隔離，最小scope工具，不把shell／migration／主機管理委派給網站聊天。

正式部署、資料migration、平台費用、永久刪除及對外送件不屬本輪自動起草授權。所有機器檢查只記錄實際能力，不聲稱「完全無幻覺」或必定通過期刊／計畫。

## 23. 本輪成果、匯出與品質驗收

至少建立可查看及重新載入的：
1. Research Blueprint Planning Baseline（全內容＋來源）。
2. 一頁研究規劃摘要視圖（不是另維護一份文案）。
3. Objective–RQ–Evidence矩陣。
4. Work Package／Milestone規劃表。
5. Evidence Need與支持／反證清單。
6. Risk／Assumption／Requirement清單。
7. Blueprint Planning Check Report。
8. BlueprintPlanningSnapshot與下一階段接收頁。

本輪最小匯出Markdown與結構化JSON，附source manifest、版本、暫定標記、未解問題與generated_at。不為了新增DOCX／PDF而重建文件引擎；若已有可靠匯出服務可重用，必須實際產檔並驗證數值、引用ID與內容，不用成功訊息替代檔案。

不將Schema正確、字數很多、模型自評90分視為專業品質。應可驗證：
- 每个Objective與RQ邏輯可讀。
- 每个主要問題有方法／資料方向。
- 三目標内容有真實差異與不適用處理。
- 未知與假設未被抹除，來源可追溯。
- 文獻不足有可執行的補強計畫。
- 工作包說明產出與前置條件。
- 不可寫欄位、鎖、原快照及既有結果未受影響。
- 下游真能讀取基線，不再次要求輸入。

成果是規劃，不宣稱可正式送件、研究已驗證、某理論成立或研究產出已接受。

## 24. 四個實作批次

### A：接收與相容底座
讀PROJECT_STATE及第三階段handoff契約，建compatibility map、備份／回復基線；升級第三階段交接接收頁為藍圖工作區；完成初始化、三目標、來源／版本／權限、保存與恢復。

驗收重點：同Project帶入、不重複建立、未完成來源有清楚處理，MOE_TPR全鏈可用。

### B：三目標專業藍圖與證據連結
完成共同欄位及三套目標模板、RQ矩陣、工作包／時程／資源、EvidenceNeed與文獻中心回路、風險與due_phase。只做本輪定向查證，不擴建完整Gap或理論引擎。

驗收重點：資料有來源且不重複、研究任務可理解、三條路不只換標題，條件式規劃可用。

### C：一鍵Assist、鎖與完整下一步
接入全欄位／區塊／階段Assist、typed output、Orchestrator、並行保護、Readiness、精確缺失導航、燈號及Baseline／Handoff。

驗收重點：鎖定不被AI覆蓋、來源待查不假綠燈、晚期需求不阻斷合理規劃、下一頁未建不空白。

### D：回歸與交付
測試三路線、保存、刷新、重啟、取消、回收、費用、跨Project隔離、來源失敗及consumer契約；交付匯出、檔案、報告與rollback。

不要要求每個草稿段落得到人工同意才開發下一批；安全環境內逐批完成測試。只有真正需要尚未取得的權限、憑證或正式部署列BLOCKED；每批回報真實成果，不預支「全部完成」。

## 25. 驗收案例：48項

每項記錄PASS／FAIL／NOT_RUN／BLOCKED，並標測試層級UNIT／INTEGRATION／E2E與資料模式LIVE／MOCK／FIXTURE。固定測試專案與數值不可混入production。尚無憑證不回報LIVE成功。

### A. 前後階段與資料相容（T01–T08）
| ID | 測試 | 必要結果 |
|---|---|---|
| T01 | 由第三階段完成頁進入 | 同project讀真實SubmissionNavigationSnapshot，題目/RQ/路線/來源/待辦帶入 |
| T02 | 重複初始化、回應遺失後重試 | 恢復同藍圖，不建立重複Project／基線／付費job |
| T03 | 第三階段原接收頁有筆記 | 升級後保留筆記、位置、來源與待辦 |
| T04 | 無交接或不支援schema | 說明與精確修復入口，無crash／無自動選題 |
| T05 | 舊專案與新版資料並存 | adapter保留原ID與歷史版本，不強制覆寫v1 |
| T06 | 題目或導航新增來源版本 | 顯示diff/rebase，舊來源及鎖不靜默替換 |
| T07 | 暫定路線／資格UNKNOWN進入 | 可建條件式規劃，UNKNOWN沒有變PASS |
| T08 | 同專案國科會＋期刊布局 | 共用核心研究資料，兩路產出與完成狀態分開 |

### B. 三目標與研究規劃（T09–T16）
| ID | 測試 | 必要結果 |
|---|---|---|
| T09 | 三goal由首頁到prompt/cache/handoff | MOE_TPR不遺失，不回退到期刊模板 |
| T10 | SCI/SSCI構想尚無Results | 產生研究規劃與資料需求，不生成正式結果 |
| T11 | 期刊樣本文章有追蹤設計 | 顯示建議，未有官方來源不得寫成強制要求 |
| T12 | 國科會年限與團隊未知 | 以候選／估計和待補呈現，不硬填三年或真實人員 |
| T13 | 教學實踐缺正式課程／基線 | 能起草條件式藍圖，列缺項不偽造資格、成績或學生意見 |
| T14 | 教學技能問題只規劃滿意度 | 提出可定位的目標—評量不一致及改善方案 |
| T15 | 質性、技術或次級資料研究 | 不強制H1／中介／問卷／RCT，按適用性規劃 |
| T16 | 已有資料／已知結果匯入 | 事後規劃與事前紀錄分開，Result Facts唯讀 |

### C. Evidence與來源（T17–T24）
| ID | 測試 | 必要結果 |
|---|---|---|
| T17 | 藍圖點補Gap文獻 | 既有中心開啟正確project/claim/RQ/role，補完返回原位置 |
| T18 | Consensus＋其他來源取得同篇 | canonical去重、保留取得紀錄，不算獨立多篇支持 |
| T19 | API只有摘要或局部全文 | 保留處理範圍，不能標全文或人工已讀 |
| T20 | 存在相反Evidence | 支持和衝突都顯示，不只選有利來源 |
| T21 | 合法來源ID但不支持Claim | 標不匹配／待核對，不因ID存在而自動通過 |
| T22 | Zotero斷線與跨Library同item key | 本地引用可繼續、同步待辦；不合併不同Library項目 |
| T23 | 外部403／429／空結果 | 分類失敗、限流、未檢得；保留局部草稿不宣稱首創 |
| T24 | 官方規則過期／讀取失敗 | 舊快照保留並要求核對，不宣稱新年度未公告或沿用錯期限 |

### D. AI與鎖定（T25–T32）
| ID | 測試 | 必要結果 |
|---|---|---|
| T25 | 全實際欄位／區塊Assist盤點 | 每類有適當操作；來源與核准欄位不自由生成 |
| T26 | FILL_EMPTY、IMPROVE_UNLOCKED | 只處理授權欄位，已存在或已鎖定依模式跳過 |
| T27 | FILL_AND_LOCK | 成功草稿可鎖，actor為AUTOMATION_POLICY、人工待審 |
| T28 | AI執行中手動改字／加鎖 | 遲到結果只存候選／conflict，不覆蓋 |
| T29 | Autosave、sync、匯入、整section替換 | 所有路徑都遵守field lock與optimistic revision |
| T30 | 換goal／撤權／回收／取消job | 不再套用舊來源結果，不復活專案 |
| T31 | 瀏覽器刷新、worker重啟、重複點擊 | checkpoint可恢復、無重複內容；外部費用如實記錄 |
| T32 | API回傳指令注入／越權patch／假source | 不執行、不任意DB寫、不通過來源驗證 |

### E. Readiness、燈號與導航（T33–T40）
| ID | 測試 | 必要結果 |
|---|---|---|
| T33 | RQ含占位文字／缺Objective映射 | 缺失顯示原因與精確欄位，不能假完成 |
| T34 | 工作包有循環／無deliverable | 明確指出依賴或產出問題，概念回饋環不誤判 |
| T35 | Gap全文、IRB、Power尚未完成 | 不形成循環Gate；以具體EvidenceNeed與晚期待辦交接 |
| T36 | 已知資格FAIL但Fit高 | 不變PASS，不顯示可申請；允許明示條件式或其他合法規劃 |
| T37 | 課程／資料缺失導航補完 | 正確聚焦、保存返回、後端重驗；點過不算解決 |
| T38 | 儲存／鎖定／工程測試通過 | 不直接亮研究綠燈；基線及暫定狀態分開 |
| T39 | 前進時有未儲存或source conflict | 先處理不丟稿；不能按舊readiness通過 |
| T40 | 手機、鍵盤、流程圖與底部刪除 | 操作列不遮欄位、燈有文字、回收復原沿用且不誤刪 |

### F. 安全、交接與交付（T41–T48）
| ID | 測試 | 必要結果 |
|---|---|---|
| T41 | 跨Project讀嵌套evidence/candidate ID | 後端拒絕越權，不只驗最外層ID |
| T42 | 完成與前進重複請求 | 同操作只一份有效交接，同key不同payload回conflict |
| T43 | 第五階段尚未建置 | 真實接收頁有摘要/RQ/EvidenceNeed/待辦，不空白、不假核准 |
| T44 | 已存在第五階段消費者 | contract測試按版本讀同快照，不重填也不重啟全庫檢索 |
| T45 | 保存成功但導航或consumer失敗 | 重開同快照，保存成果不丟、不再跑AI |
| T46 | MD／JSON匯出 | 真實可讀檔，ID／數值／來源／暫定標記與基線相符 |
| T47 | 缺真實外部憑證與預算上限 | LIVE標BLOCKED、mock另列；達上限不偷偷切付費供應商 |
| T48 | 完成本階段回歸與部署檢查 | 舊stage、引用、資料、鎖不壞；記錄所在環境、rollback及未部署事項 |

## 26. 完成後交付、停止範圍與來源起點

交付不能只有「完成」或截圖。至少提供：

1. 實際修改／新增檔案、models、migration與API。
2. `stage04-compatibility-map.md`：前3階段、舊Blueprint、實際路由與來源映射。
3. `stage04-data-flow.md`：NavigationSnapshot → Blueprint → EvidenceNeed → PlanningSnapshot。
4. `stage04-field-assist-lock-coverage.md`：總欄位／各goal／Assist/Lock/來源的實際覆蓋，未接入清單。
5. `stage04-provider-status.md`：現有Consensus、Zotero及其他來源LIVE／MOCK／BLOCKED；不含秘密。
6. `stage04-blueprint-handoff-contract.md`、schema與consumer contract tests，含可空欄位、來源／鎖／待辦版本。
7. `stage04-test-results.md`：48項真實結果、基線失敗與本輪回歸、證據或log位置。
8. `stage04-deploy-rollback.md`：安全環境migration、備份、回復路徑、正式部署尚需的授權。
9. 更新實際`PROJECT_STATE.md`：V3-U04-FULL完成範圍、所在環境、主要限制、下一入口；不將網站工程完成寫成所有研究專案完成。

完成定義：使用者可從第三階段進入同一Project，老麥依三大目標協作產生有來源／假設標記的研究目的、RQ、方法與資料方向、工作包、證據需求及風險；鎖定內容不被覆蓋，缺失能直接導航補足，刷新與失敗不遺失，最後保存可被第五階段消費的規劃基線。

**完成本輪第四階段後停止，不自行開始新版第五階段。下一階段為「文獻深化與Gap／新穎性驗證」，直接使用本輪EvidenceNeed與BlueprintPlanningSnapshot。**

### 官方來源核對起點（2026-09-06查閱；不是網站LIVE測試證明）

- **[S1] Springer Nature：Finding out a journal's scope (manuscript suitability)**。官方建議核對scope與近期文章；不能將此通用頁當每本期刊的強制方法清單。
  `https://support.springernature.com/en/support/solutions/articles/6000271430-finding-out-a-journal-s-scope-manuscript-suitability-`
- **[S2] 國家科學及技術委員會補助專題研究計畫作業要點**。一般研究計畫、型別與審查面向；倫理文件的時點須依適用條文、年度公告和機構要求個別核對。本文件不代替正式資格審查。
  `https://law.nstc.gov.tw/LawContent.aspx?id=FL026713`
- **[S3] 教育部補助大專校院教學實踐研究計畫作業要點**。教育現場問題、教學介入、學習成效、授課條件與倫理要求；不把本頁與前年度附件代替目標年度全部規定。
  `https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704`
- **[S4] Consensus API官方介紹**。確認可嵌入自有應用的研究搜尋能力；實際endpoint、schema、服務額度與安全政策依現有有效adapter及最新帳號文件核對。本輪未呼叫使用者網站的付費API。
  `https://consensus.app/home/api/`
- **[S5] Zotero Web API v3 Basics**。線上Library、Collection、Item與版本化；正式程式指定API版本，使用者電腦local API與雲端環境分開。不得從metadata可取得推論全文或使用授權均已具備。
  `https://www.zotero.org/support/dev/web_api/v3/basics`
- **[S6] OpenClaw Security**。Gateway信任邊界、session路由非授權；使用實際部署版本的最新文件與安全稽核，不在本提示詞硬寫可能過時的預設值。
  `https://docs.openclaw.ai/security`
  `https://docs.openclaw.ai/gateway/security`

本輪交付的Markdown／TXT是網站建置規格，不是已完成的網站程式、研究藍圖實例或正式計畫／論文；實際建置與驗收由OpenClaw依上述流程執行。
