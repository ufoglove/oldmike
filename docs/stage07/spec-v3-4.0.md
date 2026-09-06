# 老麥科研網站 V3｜第七階段完整建置提示詞 v3.4
## 研究設計與分析計畫：三目標方法規劃、可重現樣本計算、一鍵協作與路線工作室無斷層交接

**工程識別：V3-U07-FULL｜日期：2026-09-06｜時區：Asia/Taipei。**

> 給 OpenClaw 的實際網站增量開發任務，不是老麥人格、獨立 Skill，也不是直接替研究者選一種統計方法。
> 本規格已核對新版第六階段 v3.4 建置文件中的 `TheoryMechanismSnapshot`、模型決策與第七階段交接契約。尚未檢視真實網站程式、部署、憑證及測試結果；開工前仍須查核實際環境。
> 使用者回報第六階段「建站完成」，不等於每個研究專案都已完成模型規劃。工程模組狀態、研究內容狀態、人工審閱、資料接觸時間、內容鎖定與執行授權分開。
> 本輪是新版第七階段「研究設計與分析計畫」，不是舊版第七階段「IRB與計畫送件」。本輪下一站為新版第八階段「三路線研究與計畫工作室」：期刊研究規劃、國科會一般計畫書、教育部教學實踐計畫書。只建立交接，不在本輪重建完整工作室。

---

## 1. 唯一主流程、本輪交付及禁止擴張範圍

```text
V3-U01：Project／文獻證據／Zotero／任務／權限／版本
V3-U02：雷達 → 靈感 → 選題 → TopicSelectionSnapshot
V3-U03：投稿與計畫導航 → SubmissionNavigationSnapshot
V3-U04：研究藍圖 → BlueprintPlanningSnapshot + EvidenceNeed
V3-U05：文獻深化與Gap評估 → GapEvidenceSnapshot
V3-U06：理論與機制 → TheoryMechanismSnapshot
                                            ↓ 本輪接收
V3-U07：研究設計與分析計畫
 設計問題 → 可行方案 → 研究元件與比較目標
 → 對象／單位／分組／時點 → 樣本依據與規劃計算
 → 測量需求 → RQ—資料—分析矩陣
 → Analysis Planning Mode → 效度／偏誤／資源檢查
 → 設計與分析規劃基線 → DesignAnalysisPlanningSnapshot
                                            ↓
V3-U08：三路線研究與計畫工作室
 ├─ SCI／SSCI：國際期刊研究規劃與稿件骨架
 ├─ 國科會一般研究計畫：計畫書工作室
 └─ 教育部教學實踐：計畫書工作室
```

本輪回答「如何取得足以回答RQ的證據」，而不是先選ANOVA或SEM再倒推研究問題。

必須完成：第六階段接收頁升級；候選設計與選擇；研究元件、對象、比較與時間；樣本規劃及實際可運作的受控計算；測量需求；分析計畫 Planning Mode；風險、資源與規則對照；全項 Assist／Lock；缺失導航與首頁亮燈；不可變規劃基線及第八階段交接。

本輪可以執行「樣本、精確度、檢定力或模擬規劃計算」，只能使用合法參數及清楚標記的設計模擬；計算紀錄不是本研究實證結果。不得直接分析真實受試者資料、訓練正式模型、建立正式結果或產生p值結論。

本輪不新建或執行：完整量表題項與翻譯、正式招募、分配名單、同意程序執行、IRB送審、Pilot、資料蒐集、資料清理、正式分析 Execution Mode、完整計畫書／論文、投稿送件。已有模組與真實紀錄保留，透過adapter只讀或轉交。

「一鍵完成」是完成授權範圍內可執行的研究規劃、必要計算、檢查與保存，不保證研究成功、IRB通過、計畫核定或期刊接受。

## 2. 先盤點實際環境，保護資料並最小增量實作

先找真正repository、分支、未提交修改、部署環境及 `PROJECT_STATE.md`，不要把OpenClaw的工作區當網站程式庫。

至少核對：
- 第六階段snapshot schema、source manifest、handoff outbox、consumer contract tests、第七階段接收頁。
- Project、GoalContext、work order、RQ／Objective、構念／假設／命題與圖模型的實際ID及revision。
- 第六階段model_to_design_matrix、design_requirement、measurement_direction、assumption與競爭解釋。
- 投稿導航的期刊／計畫路線、官方Rule Snapshot、藍圖工作包與資源假設。
- 既有研究設計、分析計畫、樣本計算或Analysis Lab，優先修復重用，不能複製Planning Mode。
- 文獻與證據中心、EvidenceNeed、CitationSource、Consensus等API adapter、Zotero綁定與實際scope。
- StageWorkspaceShell、StageReadinessService、StageActionBar、RequirementIssuePanel、Assist、FieldPolicy、Lock、Version、AgentJob。
- 受控計算worker、允許的套件、依賴鎖定、環境／映像版本、網路與檔案權限、資源上限。

交付「實際物件／路由 → 本輪用途 → adapter → 缺項 → 修改 → 驗收」表。名稱以實際schema為準，本文件的邏輯名稱不是命令你另建數十張表。

禁止清庫、重建登入、隨意換框架／ORM、覆蓋使用者未提交修改、刪測試或關閉權限換取通過。Raw Data、Result Facts、已核准文件與原研究歷程不得修改。

先於隔離開發／測試環境完成可完成部分；正式migration、正式部署、破壞性操作及新增付費額度另取得授權。缺真實憑證時可測adapter與fixture，LIVE結果必須標BLOCKED，不假報成功。

## 3. 精確接收 TheoryMechanismSnapshot

使用第六階段已保存、可驗權、可解析的交接快照，不以聊天摘要、最新未採用草稿或模型圖片代替。

完整承接以下既有契約；required／nullable依實際schema映射，未知值附狀態，不默默丟失上游欄位：

```text
snapshot_id / schema_version / workspace_id / project_id / work_order_id / stage_id
source_gap_snapshot_id / source_blueprint_snapshot_id / source_navigation_snapshot_id
source_topic_snapshot_id / goal_context_revision / primary_goal
funding_intent / publication_intent / research_stage / temporal_status
source_review_decision / adopted_blueprint_revision_or_proposal_ref
scope / modeling_approach / modeling_brief_ref / model_id / model_revision
model_baseline_ref / objective_refs / rq_refs / adopted_statement_refs
theory_candidate_refs / theory_selection_ref / framework_rationale_ref
construct_versions / relation_versions / mechanism_path_refs
hypothesis_refs / proposition_refs / guiding_question_refs / temporal_provenance_refs
alternative_explanation_refs / boundary_condition_refs / assumption_refs
model_to_design_matrix_ref / design_requirement_refs / measurement_direction_refs
semantic_graph_ref / layout_version_ref / graph_validation_ref
literature_ids / publication_version_refs / study_family_refs
evidence_ids / citation_source_ids / zotero_bindings / source_manifest
reading_coverage_refs / extraction_refs / support_and_counterevidence_refs
fulfilled_evidence_need_refs / deferred_evidence_need_refs / theory_evidence_need_refs
rationale_note_refs / alignment_report_ref / decision / decision_origin / review_state
accepted_change_proposal_refs / pending_change_proposal_refs
risk_refs / requirement_refs / due_phases / blocks_actions / limitations
lock_manifest / readiness_snapshot_ref / completion_basis
next_stage_id / created_at / checksum
```

逐一驗snapshot及巢狀引用的workspace／project／source ACL、版本和checksum。checksum只能證明指定內容未變，不代表科學判斷正確。

本輪工作單 `target_output=RESEARCH_DESIGN_AND_ANALYSIS_PLANNING`，不覆蓋研究者真正的主要成果目標，不把NSTC或教學實踐專案改成統計研究。

來源包含未採用ChangeProposal時，只把已採用revision作為有效RQ／model；其餘保留為建議。無法解析版本回 `HANDOFF_SCHEMA_UNSUPPORTED`，提供修復入口；有明確adapter才轉換，原payload及歷程保留。

## 4. 冪等初始化、條件式入口及既有研究接入

將第六階段建立的第七階段接收頁升級為工作區，保留模型、RQ、研究陳述、EvidenceNeed、設計需求及筆記。

初始化唯一性至少包含 `workspace_id + project_id + source_theory_snapshot_id + work_order_scope + schema_version`；重開或重複點擊不能重建Project、工作區或重跑付費任務。

接受上游決策：

| 第六階段決策 | 本輪處理 |
|---|---|
| ADOPT_MODEL | 使用被採用的模型規劃研究 |
| ADOPT_WITH_DECLARED_ASSUMPTIONS | 條件式設計，保留假設、待驗項，不升級成理論已證实 |
| USE_EXPLORATORY_OR_DESIGN_FRAMEWORK | 使用探索／質性／技術適用的設計，不強制H1、具名理論或SEM |
| RETURN_FOR_GAP_OR_SCOPE_REVISION | 可閱讀、保留草稿；主要CTA返回正確上游決策，不偽造設計已就緒 |
| NEEDS_CORE_DEFINITION_OR_RATIONALE | 先補核心定義與用途；允許局部規劃，但不得假造完整模型來源 |

沿用第六階段 `THEORY_MODEL_READY_FOR_DESIGN`／`THEORY_MODEL_PROVISIONAL_FOR_DESIGN` 及 `THEORY_MECHANISM_HANDOFF_COMMITTED`，不要新增一個只接受舊 `THEORY_AND_MECHANISM_LOCKED` 的硬門檻。

保存資料接觸狀態：PRE_DATA_PLANNING、EXISTING_DATA_NOT_ANALYZED、DATA_ACCESSED、RESULTS_AWARE、UNKNOWN，並記錄時間與操作者。既有資料／已完成研究可經明確adoption接入，不要求重做招募；已知結果後規劃不能回填成事前計畫。

刷新、重登、換裝置由後端恢復。換Project隔離editor、模型、文獻、工作及計算。來源更新顯示差異與rebase候選，採用後追加版本，不靜默切換來源。

## 5. 三大研究目標與研究類型分開

沿用共用GoalRegistry與完整資料鏈：

| goal_id | 本輪適配 |
|---|---|
| JOURNAL_SCI_SSCI | 研究問題、文章類型、方法與證據能力；依投稿導航讀scope／方法需求，不把近期某篇文章的做法當成期刊硬性規則 |
| NSTC_GENERAL | 科學問題、創新、方法可行性、工作包、團隊／設備與預算依據；類別限一般研究計畫，不預設三年或混入新進／任務型規則 |
| MOE_TPR | 課程問題、介入、學習成果及評量；正式課程條件由來源核對，不編造主授資格、開課時段、班級或學生人數 |

本輪三目標需通過UI、DB、API、validator、AI模板、job、cache、readiness與snapshot。缺模板回 `GOAL_TEMPLATE_UNAVAILABLE`，不得讓教學實踐回退成期刊模板。

funding_intent與publication_intent可並存，切Tab只是檢視，不更改primary goal或共用設計。不同成果若需不同子研究，以StudyComponent保存，不複製全部專案。

研究類型另建獨立模式，可組合：隨機／準實驗、觀察／縱貫、質性、混合方法、設計科學、技術／預測、環境／製程、二手資料、文獻證據綜整。工程模式不自動要求人體樣本，教學模式不自動要求RCT。

## 6. 研究設計問題摘要、候選方案及多元件研究

先形成 `DesignBrief`：核心RQ、希望得到的資訊、可用／未知資源、模型要檢驗的部分、不能回答的部分、資料接觸狀態、工作終點。

根據實際條件提出少量有差異的方案，例如2至3個；不為湊數虛構可行場域。每方案保存：設計名稱、適用RQ、目標推論、資料與單位、比較／時間結構、必要假設、可識別性、強項、限制、成本／負擔、Evidence與不確定性。

比較「能回答什麼／不能回答什麼」優先於新穎度或難度。預設比較矩陣與理由；若沿用Fit Score，權重版本化、unknown為null、coverage分開、後端計算，不稱為成功率。

可使用精簡方案與擴充方案：擴充設計需說明增加什麼資訊，不因多一個sensor或中介就自動較好。

同一Project可有多個StudyComponent，例如系統開發、課程介入及訪談。每個component有scope、設計、資料單位與方法，並記錄整合點與依賴；不能把樣本、人次、模型run與訪談混成一個N。

選擇形成 `DesignSelectionDecision`：selected／alternative／rejected、理由、Evidence、假設、limitations、actor或automation policy。AI可推薦、起草、比較；涉及核心RQ或模型更改則送ChangeProposal，不暗改上游。

## 7. 先定義要估計／比較／理解什麼，再選分析方法

每個RQ建立 `InferenceTarget`，用白話說清楚研究想得到的資訊，必要時附estimand定義：
- 目標群體及分析單位。
- 介入／暴露／預測任務，適用時的比較條件。
- 結果構念、觀察指標、時間點、分析尺度。
- 想估計的是群體差異、變化、關聯、預測誤差、過程解釋、體驗或設計效用。
- 適用時：意向分配與實際接受介入的區別，退出、換組、未完成介入等事件如何影響所問問題。
- 預期報告量與不確定性，以及實務上有意義的差異。

不能把「RQ1 → ANCOVA」當成完整計畫；應先定義比較、基線、時點、群集與資料結構，再判斷模型。

推論類型可為DESCRIPTIVE、ASSOCIATIONAL、CAUSAL、PREDICTIVE、EXPLORATORY、INTERPRETIVE、DESIGN_EVALUATION。不得把预测准确度當成機制證明；觀察性研究可提出有明確辨識假設的因果問題，不硬規定只有RCT才可研究因果。RCT也不自動識別所有中介機制。

無比較組並非一律違規；若只做單組前後測，就清楚限制介入效果歸因，提出可行的替代設計或降低主張，不把缺對照掩蓋成強因果結論。

## 8. 研究對象、單位、組別、分配與時間規劃

建立StudyStructure，至少包含：
- target／accessible population、sampling frame、納入排除方向、來源存取狀態。
- 招募、分配、觀察、分析單位，以及nesting／cross-classification結構。
- site／班級／教師／群集數與取得狀態；未知null，不自由產生真實班級。
- 適用的實驗組、比較組、常規教學／系統baseline；條件差異、暴露時間、介入劑量與負擔。
- 個人／群集隨機、配對、分層、交叉、自然組或非隨機分配的規劃與理由。
- 分配隱藏、評量者盲化、分析盲化可行性；不適用或不可行時說明，不填假PASS。
- 基線、介入、即時、追蹤的相對時點與可接受時間窗；具體日期未知時用相對規劃，不編造已約好的日期。
- 介入忠實度、污染、同期事件、學習／練習、carryover、洗脫及order等適用風險。

本輪只規劃分配方式，不生成正式隨機序列、不招募、不處理真實受試者名單。

特別檢查：一個班級做實驗組、另一班做控制組時，介入可能與班級／教師完全混淆。增加學生人數或在畫面選Mixed Model不能自動消除這個設計限制；應提出增加獨立群集、調整設計或縮小推論等候選。

重複Sensor資料／視窗不能自動當獨立受試者；保存subject、session、site與time等階層，用於樣本計算與分析計畫。

## 9. 樣本規劃：依資訊目的提供合理依據

建立 `SampleJustification`，不是對所有研究一律「至少30人」「每組30」「SEM一定200」。[S1]

適用策略包括：
- A_PRIORI_POWER：為特定模型／檢定及有意義差異規劃檢定力。
- PRECISION_PLANNING：以估計不確定性或區間精確度為目標。
- DETECTABLE_EFFECT_SCENARIOS：固定可用樣本下能偵測何種差異，誠實評估限制。
- SIMULATION_BASED_DESIGN：在明確模型與資料生成假設下比較設計。
- RESOURCE_CONSTRAINED：資源限制與可取得的資訊價值，並揭露推論限制。
- FIXED_DATASET／CENSUS：既有資料或普查範圍、可用事件數與分析限制。
- QUALITATIVE_INFORMATION_RATIONALE：依研究目的、方法、樣本異質性與資料深度規劃，不硬套量化power。
- TECHNICAL_REPLICATION／BENCHMARK_COVERAGE：獨立run、task、device、site、item或材料批次等適用單位與變異。

每策略保存目的、參數、參數來源、有效範圍、估計／假設區分、主要不確定性、計算能力及review。

效果量可以來自合法文獻、最接近研究、已授權先期研究，或明確定義的最小有意義差異。文獻未知時允許標記ASSUMPTION_BASED的情境規劃，不能說成「文獻證實的效果量」。不要為得到較小N而挑偏大的效果量。

區分 n_per_arm、total_analyzable_n、recruitment_target、cluster_count、units_per_cluster、repeated_observations、event_count、technical_runs。樣本規劃不是實際已招募人数。

如納入流失調整，明示分析樣本與招募目標、假設流失率與適用條件。简单除以留存比例不能當成所有群集／追蹤設計通用修正。

不以事後觀察效果的「observed power」取代設計合理性；已知結果後規劃需標時間来源，不改原研究紀錄。

## 10. 真實可運作的規劃計算服務，不讓AI編算式答案

沿用既有計算服務或新增最小受控 `PlanningCalculationService`。AI只整理參數及解釋結果，數值必須由實際程式計算返回。

本輪最低可交付能力：
1. 一種常用簡單設計的事前樣本／power計算，例如兩獨立組連續結果；明確限定模型與假設。
2. 該設計的固定N可偵測效果情境比較，或一種精確度規劃。
3. 每組／總量／向上取整及適用流失調整的明確呈現。
4. 輸入檢核、執行紀錄、可重算、單元測試及與已驗證公式／套件參考值比對。

複雜群集、SEM、中介、Bayesian assurance或進階模擬若尚無可靠engine，可建立需求與外部已完成結果匯入，但必須顯示 `CALCULATION_NOT_SUPPORTED`／`EXPERT_REVIEW_REQUIRED`，不可偷偷套用簡單t-test公式。

Capability Registry分開記錄PLAN_SUPPORTED、COMPUTE_SUPPORTED、LIVE_VERIFIED，不把方法名稱出現在選單就當已支援計算。

每筆 `PlanningCalculationRecord` 至少保存：

```text
calculation_id / workspace_id / project_id / work_order_id
calculation_kind / purpose / design_revision / analysis_plan_revision
inference_target_ref / source_parameter_refs / parameters / units
alpha / sidedness / desired_power_or_precision / allocation_ratio
cluster_or_repeated_structure / effect_basis / assumption_labels
engine_id / engine_version / package_versions / code_hash / environment_ref
seed_if_stochastic / simulation_iterations / monte_carlo_uncertainty
input_checksum / output_values / output_units / rounding_policy
convergence_or_error / warnings / computation_status / review_state
created_at / actor_or_policy / superseded_by
```

以 `COMPUTED` 表示程式計算成功，以review狀態表示假設是否審閱，二者分開。AI生成的樣本建議不得偽裝成該record。

計算timeout／NaN／不收斂／無有效來源時，不產生正式N。限制alpha、power、比例、樣本及分配等參數的合法範圍；單尾檢定需先規劃並有理由，不能為節省N自動使用。

若使用模擬，標 `SIMULATED_FOR_DESIGN`；不寫入Raw Data、Participant、Result Facts或正式Analysis Runs，圖表只標「規劃情境」而不是實證結果。模擬有seed、迭代與MC不確定性。

worker使用允許的計算模板與typed inputs，不任意eval使用者公式／AI程式。禁止網路、PII、資料庫管理與主機shell權限；有資源上限、取消、隔離及套件版本鎖。需要自訂程式先經獨立審查，不用「可信AI」繞過。

## 11. 測量需求與測量時程：本輪定義需要什麼，不冒充工具已驗證

沿用ResearchConstruct與MeasurementRequirement stable ID，擴充版本及使用關係，不複製構念／量表庫。

每項需求保存：構念、預計觀察指標、資料型態／尺度／單位、來源、時點、群組、分析單位、主要／次要或探索性用途、負擔、語言／文化適配、信效度需求、授權需求、Evidence與目前狀態。

區分：概念定義、候選工具、實際題項、計分規則、觀察值及分析變數。選了一個量表名稱不代表題項、中文版信效度、授權與數位施測權都已確認。

知識、技能、行為、作品、訪談、觀察、Sensor／Log、環境採樣及AI評估可並存，按RQ使用。教學實踐的學習目標如為技能，只有滿意度不能作為技能改善的直接量測；滿意度仍可作為適當的次要結果。

建立MeasurementSchedule：`component × unit/group × relative_time_point × measurement_requirement × expected_data × responsible_role`。可以用T0/T1等顯示，但需實際相對時間意義，不固定30／90日。

本輪只建立DataRequirements及DataDictionary Draft的連結規格，不收取資料、不執行反向題計分、不重製未授權題項。後續工具與Protocol模組沿用同一ID鏈。

## 12. 核心 RQ—設計—資料—分析矩陣

每一列必須是可編輯、可定位、可驗證的結構，不只是生成Markdown表格。

```text
matrix_row_id / revision / project_id / study_component_ref
objective_ref / rq_ref / research_statement_ref / statement_type
model_relation_refs / construct_refs / inference_target_ref
design_ref / population_ref / allocation_unit / observation_unit / analysis_unit
arm_or_comparator_refs / measurement_requirement_refs / time_point_refs
data_requirement_refs / data_type / scale / nesting_structure
primary_secondary_or_exploratory / temporal_provenance_ref
planned_method_ref / target_estimate_or_interpretive_output
uncertainty_plan_ref / assumption_refs / sample_justification_ref
required_evidence_refs / unresolved_issue_refs / status / lock_state
```

量化、質性、技術、綜整及混合方法使用適用欄位，不適用需理由，不用假p值欄位填满。每個核心RQ至少有「如何取得與判讀資訊」的可追溯路徑。

例如教學技能比較可以表達為：學生／班級結構 → 技能評量需求 → 基線與後測 → 適合該資料結構的比較估計。不是看到前後測就自動填配對t-test，忽略組間差異與班級。

同一資料支援多RQ須標關係，不複製資料；同一RQ包含多StudyComponent，保留整合策略。修改測量時點、構念或資料型態時，受影響的AnalysisPlan與SampleCalculation標需重驗。

## 13. 分析實驗室 Planning Mode：先規劃，不執行正式結果

本輪接入既有Analysis Lab的Planning Mode，不另建一套平行統計系統。Execution Mode仍受後續真實資料及執行Gate控制。

建立AnalysisPlan，依StudyComponent與RQ分組：
- 主要分析、次要分析、敏感度／穩健性、預先規劃探索及新增探索分開。
- 目標比較／估計量、主要outcome及時點、分析單位、分組與群集結構。
- 模型／分析策略、變數角色、covariates及選擇理由、interaction、contrast／reference category、時間結構。
- 估計／區間／不確定性報告方式；p-value只是適用時的一部分，不要求質性研究p值。[S1][S2]
- 分析集／納入邏輯、未完成介入或退出等事件的處理，與InferenceTarget一致。
- 缺失類型及假設、缺失診斷、可行處理與敏感度；不預設平均值補值／完整案例一定合理。
- 異常值定義、量測錯誤與有效極端值的區別，處理規則及保留紀錄，不以取得顯著為刪除依據。
- 多重比較的family、主要／次要層次及適用調整／解讀；不把每個模型的每個數字都硬套相同方法。
- 模型假設、診斷、處理分支與替代方法的理由，不以單一常態檢定自動決定所有分析。
- 敏感度／穩健性、依從性、attrition、測量品質或效度需求，明示探索與主要結論的區別。
- 方法／套件能力、預期輸出形式與報告需求；未實作engine不得顯示可立即執行。

本輪可以產生typed analysis recipe、未執行的code skeleton及假資料單元測試，但不可對真實研究資料運算或產生研究發現。圖表在此僅有規劃名稱與資料需求，不建立假結果柱狀圖。

允許正當計畫修訂，不把Analysis Plan當成永遠不能改；修訂保存理由、時間、資料接觸狀態、影響、原版及是否需重新審閱／揭露。不能看過結果後靜默把原計畫改成剛好支持新結論。[S2]

## 14. 特殊研究方法的適配，不將所有專案套成量化實驗

### 質性與混合方法

質性規劃保存研究取向、取樣邏輯、資料形式、訪談／觀察方向、研究者位置與反思、分析方法、證據充足判斷及倫理需求。不把飽和、雙編碼一致率、member checking或factor analysis列為所有質性研究必做；應說明所選方法的適用做法。

混合方法保存convergent／sequential等設計方向、優先性、取樣或資料連結、整合時點、joint display需求、相互矛盾結果如何探討。不能只說「問卷加訪談」就稱完成整合設計。

### AI／LLM／RAG與預測研究

規劃task／label、ground truth來源、基準方法、split unit、群集／時間外推、train／validation／test的用途、hyperparameter與prompt調整規則、外部評估、失敗案例、校準／公平性／成本／延遲等適用指標。

資料切分單位必須避免同一人、同一文件變體或相鄰時間窗造成洩漏；前處理與特徵選擇要在訓練範圍／fold內學習，不先在全資料fit後才交叉驗證。scikit-learn官方文件亦說明test資料不應參與前處理的fit，Pipeline可協助避免這類洩漏。[S3]

LLM評估保存模型／prompt／retrieval corpus版本規劃、參考答案與人工判準、重複執行單位、stochastic variance及judge限制。LLM-as-judge不能直接充當絕對真值。

本輪不執行training或benchmark實驗，不把模擬precision或sample curve當模型Accuracy。

### Sensor、環境、能源、職安與製程

規劃設備／工件／site／batch／session層級，校正、漂移、同步、採樣頻率需求、時間自相關、批次差異、季節／生產狀態、獨立重複及可解讀的單位。採樣點數不等於獨立樣本數，單一批次的重複量測不冒充多批次實驗。

### 二手資料與文獻研究

保存資料存取、license、群體定義、可取得變數及資料接觸歷史。若是系統性回顧／證據綜整專案，取樣／納入、偏誤評估與綜整方法按該研究設計處理，不要求受試者分组或生理量表；借鏡指南不等於已完成該指南要求。

## 15. 效度、混雜、替代解釋與設計辨識檢查

接入第六階段AlternativeExplanation、BoundaryCondition及Assumption，不重新任意新增一長串控制變項。

每項風險保存：影響的RQ／target、何種偏誤、預防或設計改善、可檢查證據、分析敏感度方向、殘餘限制、必要行動與due_phase。

適用風險包括selection、confounding、history／maturation、testing、教師／場域、新奇性、量測變化、依從性、污染、流失、群集、時間依賴、共同方法與選擇性報告。不要把相關矩陣檢查當成混雜已消除，也不要自動調整所有可能變項而造成collider／post-treatment偏差。

中介候選必須檢查時間順序、量測、可能共同原因與可辨識假設。橫斷資料可探索統計分解，但不得直接承諾因果中介成立。調節需清楚指定被調節關係、比較尺度與interaction，不能只比較「一組顯著、另一組不顯著」。

研究已執行者，區分可補分析／透明揭露與無法事後修復的設計限制。不得把非隨機改寫為RCT或補造未測量變項；改進建議屬future study或明確追加研究，不覆蓋歷史。

## 16. 時間來源、預註冊與報告規範規劃

延續第六階段temporal provenance。每項假設、主要分析、樣本參數、排除規則保存建立／採用時間與資料接觸狀態。

預註冊在本輪只建立適用性、內容清單、擬使用平台、預定時機、匿名／embargo需求與缺項。沒有真實registration record不能顯示REGISTERED；鎖定、hash或內部保存不是外部預註冊。既有資料可在分析前規劃註冊，但應揭露已知內容。[S2]

保留規劃內探索與事後探索差異，不把「exploratory」當成無效研究，也不把預先計畫的探索強制變成確認性檢定。

Reporting Guideline Candidate按研究與文章類型選擇，保存來源、版本、適用理由與需要的資料項；本輪只做規劃coverage，不宣稱正式合規。SPIRIT 2025適用隨機試驗protocol報告、CONSORT 2025適用試驗結果報告，不能當所有教育／工程研究的通用規格；其他研究依EQUATOR等官方來源及期刊規則核對。[S4][S5]

涉及期刊／年度規則沿用OfficialRuleSnapshot，必要時在授權下更新。source不可讀不等於未公告；本輪不硬寫頁數、金額、截止日或學門代碼。

## 17. 可行性、教學安排、倫理與資源：只做必要的前置規劃

把設計回連第四階段WorkPackage、Milestone與資源假設，不另建一套互不相容的甘特圖。每工作保存研究元件、產出、相對時程、依賴、負責角色、設備／場域需求、存取狀態、成本依據、風險及替代方案。

國科會一般研究計畫重點連結科學問題、方法與人力／經費合理性，但本輪不審定資格、不認定核定。規則以現有官方來源快照為準。[S9]

教學實踐增加Course–Design Alignment：課程目標、教學問題、介入、週次、學習成果、評量與RQ。未知課程基線仍需真實資料；不因目標是教學實踐就認定免審或可使用全部成績資料。[S10]

倫理／隱私只建立需求：人類參與、學生／從屬關係、未成年、敏感資料、錄音錄影／Sensor、第三方AI、資料傳輸／保存、研究參與與成績分離、替代學習權益等。轉交既有Ethics Center或後續需求，網站不自行宣布免審或核准。

計畫書準備、量表／Protocol草擬與伦理文件規劃可以按適用條件平行，不硬寫成「核定後才可開始準備IRB」。真正人體Pilot／正式收資料才依適用文件與授權把關；「設計基線完成」絕非執行授權。

## 18. 文獻、Consensus、Zotero與計算參數來源

所有方法、樣本、測量、偏誤控制與分析文獻，回到既有文獻與證據中心。缺來源建立EvidenceNeed，帶project、rq、design candidate、calculation parameter、Role及return context。

Role沿用METHOD、MEASUREMENT、SIMILAR_STUDY等，若需STATISTICAL_METHOD或SAMPLE_JUSTIFICATION以現有taxonomy擴充，不重建文獻庫。

Consensus正式列入已有API供應商，依任務選用；API官方支援嵌入應用研究搜尋，但具體端點、欄位、配額以現有有效adapter及官方文件實測，不抄過時範例。[S6]

與Ai4Scholar、Semantic Scholar、Crossref、OpenAlex及其他現有專業來源共用retrieval pipeline。只用必要的研究詞與合法片段，不把完整未公開計畫、學生資料或Identity Map丟進所有外部API。

保留來源通道、原始出版來源、publication version、study family、source quality、實際閱讀範圍、抽取位置及支持／反證。同篇多來源不計為獨立研究；API摘要不當全文，人機閱讀狀態不混淆。

每個Sample Parameter的來源要能反查原文章的量尺、族群、設計及effect type；不同定義的d、f、OR或相關不能直接互換，轉換必須有明確公式、假設及計算紀錄。

Zotero沿用library type/id、item key、object version與Collection reference，不把item key當BibTeX citekey；遠端版本與website revision分開。同步衝突不覆蓋已鎖定方法或來源摘錄，partial-sync沿用現有範圍；斷線仍可讀合法且未撤權的本地引用，不能因cache而忽略ACL撤銷。[S7]

本輪不擴大Zotero write／全文／附件權限，頁面標NOT_LINKED／SYNC_PENDING／CONFLICT不會自動阻擋所有研究規劃。

## 19. 首頁與研究設計工作區：少量主操作，完整能力可展開

保留最上方未完成專案下拉、讀取／儲存／新增、目前Goal及儲存狀態；保留底部獨立刪除本專案（回收筒）與復原。不得把刪除放進浮動主要操作列。

首頁流程首屏顯示：文獻與Gap → 理論與機制 → **研究設計與分析計畫** → 三路線研究與計畫工作室；完整生命週期可展開，資助／期刊分支分開，不混算進度。

節點以後端readiness／baseline顯示灰、藍、黃、紅、綠並搭配文字／圖示；綠燈只標「設計規劃完成」。工程測試通過、按儲存、AI填滿或加鎖不自動亮綠燈。狀態訊息需能被輔助技術讀取。[S11]

工作區主頁籤建議：
1. 總覽與方案；2. 對象／組別／時點；3. 測量需求；4. 樣本與規劃計算；5. RQ—資料—分析矩陣；6. 分析計畫；7. 風險／資源／規範；8. Evidence與版本。

每頁有「用途、準備、操作、產出、保存位置、限制」簡短解說，進階統計欄位依設計及能力展開，不把數十種方法塞成首頁表單。

總覽顯示本次設計決策、主要RQ、方案、實際計算狀態、當前缺項、晚期待辦與一個Next Best Action。手機為垂直卡片，矩陣有可存取的逐列編輯檢視，sticky bar不遮鍵盤焦點。

## 20. 全項老麥Assist、FieldPolicy與小型Runtime契約

沿用FieldAssist／SectionAssist／StageAssist，每個欄位、組別、時點、矩陣列、樣本參數、分析條目都有適用操作，不只有全頁聊天。

至少提供：解說、依來源帶入、起草、補空白、優化未鎖定内容、比較候選、查證、計算、檢查、版本及鎖定。不同欄位的可寫方式依FieldPolicy決定：

| 類型 | 可執行協助 |
|---|---|
| 研究設計理由／草稿 | Evidence導向起草與改寫，標PROJECT_PROPOSAL或INTERPRETATION |
| 真實場域／課程／設備／已知樣本 | 從合法既有紀錄帶入或導航提供；不得自由生成 |
| 文獻參數／方法主張 | 來源抽取與定位、核對適用性；不把缺項填0 |
| 規劃假設 | 可提出候選與情境，標ASSUMPTION且附理由及待確認狀態 |
| 計算結果 | 只讀PlanningCalculationService的結果reference；AI不得直接patch數值 |
| 官方規則／倫理／核定 | 來源核對／真實文件帶入，不生成成功狀態 |
| 已鎖定／人工核准 | 檢視／解說／提出新候選，不能直接覆寫 |

支援FILL_EMPTY、IMPROVE_UNLOCKED、FILL_AND_LOCK；預設FILL_EMPTY。一次授權範圍與預算後，普通草稿與查證連續處理，不逐欄確認。需要額外外傳、付費或不可委任的確認，集中顯示待辦；不能為自動前進取消安全条件。

網站後端可使用下列runtime指令核心，但必須搭配typed schema與後端工具限制：

```text
你是老麥研究設計協作者。根據目前專案已採用的
TheoryMechanismSnapshot、GoalContext、RQ、證據及資源，
提出適合研究目的的設計與分析規劃。

你只可處理server傳入的permitted_field_refs及允許工具。
不得改原RQ／理論／結果，不得將建議寫成實際資源或已執行程序。
每項重要建議說明適用理由、必要前提、限制與來源。
需要新來源建立EvidenceNeed；需要數值建立calculation request，
只引用工具實際返回的PlanningCalculationRecord。
來源不完整時保留未知與待辦，不能編造N、DOI或p-value。
先確認資料單位、比較目標與時點，再選分析方法。
質性、技術、二手資料不強制使用RCT、H1或量化Power。
看過資料後提出的方案保持正確temporal status。
遇鎖定、版本變更或無權限只回候選，不直接覆寫。
輸出符合schema的候選patch、計算需求、EvidenceNeed、issues與摘要。
不得由你自行宣布readiness通過、IRB核准或正式研究可執行。
```

輸出契約示例：

```yaml
project_id: <actual>
source_theory_snapshot_id: <actual>
goal_context_revision: <actual>
base_revision: <actual>
operation_mode: FILL_EMPTY | IMPROVE_UNLOCKED | FILL_AND_LOCK
patches:
  - field_ref: <allowlisted>
    expected_field_revision: <actual>
    value: <typed proposal or source ref>
    content_origin: SOURCE_REPORTED | PROJECT_PROPOSAL | ASSUMPTION
    source_refs: []
    source_locations: []
    rationale: <reason>
    limitations: []
    temporal_status: <actual>
calculation_requests: []
evidence_needs: []
issues: []
change_proposals: []
summary: <actual completed scope>
```

不得接受任意DB path、shell、network request或模型輸出的「calculation result」作為工具真結果。來源ID存在不等於支持主張；語義判讀保留信心與人工審阅狀態。

## 21. 一鍵編排器、計算與預算

復用Project Orchestrator／AgentJob，不以單一巨大prompt塞完整專案全文，也不建立新的佇列系統。

一鍵流程：

```text
固定Project／Goal／來源revision／lock及工作範圍
→ DesignBrief與能力檢查
→ 候選與目前資源
→ 暫定採用範圍或已選設計
→ 對象、比較、時點及測量需求
→ 樣本參數來源／假設整理
→ 受控規劃計算（適用且具輸入）
→ RQ矩陣及AnalysisPlan草稿
→ 效度、倫理需求、資源與路線檢查
→ 保存候選／工作版本
→ 顯示已完成、略過鎖定、需資料、需審閱與失敗
→ 適用policy下保存規劃基線或集中等待使用者
```

每步保存checkpoint、source pack、prompt version、scope、工作狀態與費用。與外部API、計算worker及資料寫入分開；request失敗不能整頁空白或丟掉已完成內容。

runtime source pack只帶必要的版本化摘要與合法來源定位，不將整份私人計畫傳送所有服務；token不夠應分段並保留references，不直接丟失關鍵假設。

成本沿用全站budget reservation／usage，啟動前估計、每步更新，hard limit停止；不自動換昂貴provider或新增訂閱。Provider無冪等能力時不保證exactly-once計費，逾時重試須先核對既有回應及預算。

在計算或查證過程無法取得結果時，可以保留工作版本並顯示CALCULATION_PENDING／SOURCE_UNAVAILABLE，不得補一個假結果讓流程亮燈。

使用者可以取消、離開、刷新與重開；有lease、去重、有限重試與checkpoint。過時或已取消job的輸出不能復活已回收Project。

## 22. 後端鎖定、並行編輯與來源變更

所有手動、autosave、AI、匯入、同步及worker回寫走同一mutation service。

每次原子寫入驗：membership、project未回收、Goal revision、source binding、base revision、field revision、lock revision與來源ACL。任務開始與完成都驗，不能只在開始時驗權。

使用者中途改字、加鎖、改Goal、採用新上游、取消或被撤權，遲到輸出只保留proposal／CONFLICT／STALE_INPUT，不覆寫。

鎖定範圍可為field、section、design component、analysis item、artifact及handoff。刪除StudyArm、TimePoint、矩陣列、整段替換或切active version都需檢查被影響的鎖，不能繞過。允許獨立UI排序或layout改動，但不改科學語義。

FILL_AND_LOCK只鎖本次成功保存且政策允許的草稿，記錄AUTOMATION_POLICY及HUMAN_REVIEW_PENDING。鎖定不表示假設已驗證、計算假設合理或研究可執行。

解鎖建立新工作版本。PlanningCalculationRecord不可改值，只能新計算；引用舊計算的設計若參數變更，標 `CALCULATION_SOURCE_STALE`，舊結果保留。

更正／撤稿／来源變化／適用規則改變，只標受影響的模型、參數或分析項需重驗，不把整專案所有成果清空。遵循原版本序列，不強迫改成v3／v4或把較新研究版本倒退。

## 23. Design Alignment Checker：規則與科學審閱分開

沿用Readiness與Finding引擎，區分：
- STRUCTURAL：ID／ACL／typed欄位／時間與單位／依賴／版本／計算輸入。
- SCIENTIFIC：RQ可回答性、辨識假設、測量與分析適合性、樣本理據、偏誤、目標及主張。

每finding保存：`code / rule_version / check_type / locator / rationale / source_refs / severity / certainty / review_state / due_phase / blocks_actions / remediation`。

至少包含：

```text
INFERENCE_TARGET_MISSING
RQ_WITHOUT_DESIGN_OR_DATA_PATH
UNIT_OR_CLUSTER_STRUCTURE_UNCLEAR
ARM_SITE_CONFOUNDING
CAUSAL_IDENTIFICATION_ASSUMPTION_MISSING
OUTCOME_TIMEPOINT_MISMATCH
RETENTION_WITHOUT_FOLLOWUP
MECHANISM_TIMING_OR_CONFOUNDING_UNRESOLVED
MODERATION_WITHOUT_TARGET_INTERACTION
SAMPLE_JUSTIFICATION_MISSING
CALCULATION_INPUT_INCOMPLETE
CALCULATION_NOT_SUPPORTED
CALCULATION_SOURCE_STALE
MEASUREMENT_REQUIREMENT_MISSING
ANALYSIS_DATA_TYPE_MISMATCH
MISSING_DATA_STRATEGY_UNSPECIFIED
MULTIPLICITY_SCOPE_UNDEFINED
PREDICTIVE_DATA_LEAKAGE_RISK
COURSE_OUTCOME_ASSESSMENT_MISMATCH
POSTHOC_AS_PRESPECIFIED_RISK
SOURCE_OR_LOCK_STALE
GOAL_TEMPLATE_UNAVAILABLE
```

不因質性研究沒有CI、非介入研究沒有控制組、探索性沒有H1、技術研究没有量表，或事前規劃沒有真實結果就一律報錯。

不是所有警告都blocking。確定的权限／版本／結構錯誤由系統阻擋；AI方法疑慮需研究者裁決，不能模型任意自設不可解除FATAL。接受科學限制需記理由、影響與降低主張，不能只寫「AI說可以」。

對當前嚴重矛盾，例如要驗證介入效果卻無可合理辨識的比較、核心RQ完全沒有資料路徑，提供替代設計、調整問題或返回上游，不單純給高Fit Score通過。

## 24. 缺失直達、返回原位置與晚期待辦

延續RequirementIssuePanel及server route resolver，每個issue附：project／work order／component／RQ／design／calculation／measurement／analysis item、tab／section／field、原因、影響、assist actions、due_phase、blocks_actions、允許延後理由與return_context。

典型回路：
- 缺效果量依據 → 指定樣本參數的來源欄位／既有文獻中心定向檢索。
- 只有固定可用N → 轉到精確度／可偵測差異／限制情境，而非強行填一個效果量。
- RQ含保留但沒追蹤 → 正確StudyComponent的TimePoint設定。
- 班級與介入混淆 → 組別／cluster結構，老麥提出替代方案。
- 缺方法依據 → 文獻與證據中心的METHOD任務，保留rq與return位置。
- 課程目標與評量不符 → Course–Design Matrix指定欄。
- 既有資料後見性 → temporal provenance欄，不允許回填假日期。
- API或Zotero權限失效 → 有權限者設定頁或替代來源，不揭露憑證。

補足按鈕直達合法Project、component、tab、field；展開、捲動、聚焦。未保存變更先選保存、放棄本地變更或取消；保存失敗不能切頁。

提供「保存並返回研究設計與分析計畫」，回到原位置。後端重驗才關閉issue，點過連結／手動勾選／AI自報不算完成。

完整量表授權／題項、IRB正式文件、計畫核定、實際場域許可、正式資料等，保留其應到期階段及真正阻擋的動作。不要用未來執行Gate阻止本輪規劃與計畫書起草。

## 25. 完成條件、規劃決策與首頁燈號

映射至既有StageReadinessService，建議內部Gate：
1. `DESIGN_CONTEXT_READY`：合法模型交接與採用研究版本、Goal、scope可讀。
2. `DESIGN_ANALYSIS_ALIGNMENT_REVIEW_COMPLETE`：設計、資料、分析與樣本理據已處理或具體記錄限制。
3. `DESIGN_PLAN_READY_FOR_ROUTE_WORKSPACE`／`DESIGN_PLAN_PROVISIONAL_FOR_ROUTE_WORKSPACE`：形成能交給後續期刊規劃或計畫書的設計基線。
4. `DESIGN_ANALYSIS_HANDOFF_COMMITTED`：baseline、readiness、snapshot及transition保存成功。

規劃決策：ADOPT_DESIGN、ADOPT_WITH_DECLARED_ASSUMPTIONS、USE_EXPLORATORY_OR_TECHNICAL_DESIGN、RETURN_FOR_MODEL_OR_SCOPE_REVISION、NEEDS_CORE_DESIGN_INFORMATION。

**完整基線**最低要求：核心RQ與推論目標清楚；已選設計及資料單位；適用的組別／時間／測量路徑；主要分析或解釋策略；有適當樣本理據及必要計算或明確不適用理由；主要偏誤／資源／路線限制處理；來源及時間狀態正確；沒有未處理的本輪重大矛盾；版本／鎖／ACL有效。

**條件式基線**可以保留數值參數、場域許可、測量候選或專家審阅待辦，只要核心問題、設計選擇、資料路徑及分析方向足以支援後續規劃，且清楚列出假設、預計解決時間與會阻擋什麼。若連基本研究對象或RQ要回答什麼都不清楚，應先補足，不以「暫定」跳過全部內容。

不要求：所有研究必做量化Power、每種候選都計算、固定篇數、每篇全文、每篇Zotero同步、全部API可用、完整量表、IRB核准、計畫核定、正式資料或研究結果。

規劃已完成≠正式研究可執行；計算COMPUTED≠參數已獲人工審閱；鎖定≠預註冊；AI草稿≠人工核准。上述狀態在UI與JSON分開。

首頁綠燈「設計規劃完成」；條件式黃燈「規劃已保存，待補N項」；返回上游保留本輪成果並標需調整。不得為維持漂亮百分比隱藏warning、刪適用的未來階段或把功能建好當成研究完成。

## 26. 上游修訂、第七→第八階段的無斷層交接

保存 `Research Design & Analysis Planning Baseline`，包含設計版本、分析計畫版本、樣本依據及計算、矩陣、限制與Evidence。不直接覆蓋原研究藍圖、模型、RQ、Result Facts或已知研究執行紀錄。

需改RQ、核心構念或模型時建立現有ChangeProposal：original／proposed／reason／evidence／影響／時間來源／review。採用才追加版本並重綁來源；待採用不自動生效。

本輪新增不可變 `DesignAnalysisPlanningSnapshot`，schema必須是可機器驗證JSON Schema，不只文字清單：

```text
snapshot_id / schema_version / workspace_id / project_id / work_order_id / stage_id
source_theory_snapshot_id / source_gap_snapshot_id / source_blueprint_snapshot_id
source_navigation_snapshot_id / source_topic_snapshot_id
goal_context_revision / primary_goal / funding_intent / publication_intent
research_stage / temporal_status / temporal_provenance_refs
adopted_blueprint_revision_or_proposal_ref / model_id / model_revision
scope / design_brief_ref / objective_refs / rq_refs / adopted_statement_refs
construct_versions / model_relation_refs / study_component_versions
inference_target_refs / design_candidate_refs / design_selection_ref
design_baseline_ref / selected_design_versions / population_plan_refs
unit_structure_refs / arm_versions / allocation_plan_refs / time_point_versions
intervention_requirement_refs / comparator_requirement_refs
measurement_requirement_versions / measurement_schedule_ref / data_requirement_refs
sample_justification_refs / sample_parameter_refs / planning_calculation_refs
calculation_capability_ref / calculation_assumptions / calculation_limitations
rq_design_data_analysis_matrix_ref / analysis_plan_refs / analysis_plan_versions
primary_analysis_refs / secondary_analysis_refs / exploratory_analysis_refs
qualitative_plan_refs / mixed_method_plan_refs / predictive_plan_refs
bias_control_refs / missingness_plan_refs / reporting_plan_refs
preregistration_requirement_refs / ethics_requirement_refs / execution_restrictions
resource_plan_refs / feasibility_refs / course_alignment_ref / work_package_refs
literature_ids / publication_version_refs / study_family_refs
evidence_ids / citation_source_ids / zotero_bindings / source_manifest
reading_coverage_refs / extraction_refs / support_and_counterevidence_refs
fulfilled_evidence_need_refs / deferred_evidence_need_refs / method_evidence_need_refs
alignment_report_ref / decision / decision_origin / review_state
accepted_change_proposal_refs / pending_change_proposal_refs
risk_refs / requirement_refs / due_phases / blocks_actions / limitations
lock_manifest / readiness_snapshot_ref / completion_basis
route_workspace_intents / next_stage_id / created_at / checksum
```

ref帶revision／不可變內容，optional欄位可null但有可追溯狀態。設計模擬或計算只引用PlanningCalculationRecord，不使用ResultFact namespace。

**下一站固定：新版第八階段「三路線研究與計畫工作室」。** 既有registry若已有同義穩定ID，以adapter映射，不用文字序號亂接回舊版IRB頁。

`route_workspace_intents` 依Goal及工作終點帶入：
- JOURNAL_SCI_SSCI：期刊研究規劃、方法與預期稿件結構；沒結果不生正式Results。
- NSTC_GENERAL：一般研究計畫書規劃及初稿工作區，另可帶次要期刊布局。
- MOE_TPR：教學實踐計畫書與課程／評量安排，另可帶次要期刊布局。

本輪不再選刊／學門，沿用第三階段决策；不建立兩份新的Project。倫理／工具等預備需求可平行列入，不把「必須等核定後才開始倫理準備」當通用規則。

第八階段已存在則adapter接入；未建置就提供真實handoff接收頁：顯示同Project的目標、選題、設計、RQ矩陣、樣本情境、分析計畫、Evidence及待辦，可重開／返回／看文獻，明示專業引擎待建。不以空白placeholder假完成。

完成動作用後端短transaction保存baseline、readiness、snapshot及transition/outbox；外部API與長計算在transaction外。consumer以snapshot_id去重，相同冪等鍵但不同payload回CONFLICT，不重複交接。

StageActionBar：

| 狀態 | 醒目主要按鈕 |
|---|---|
| 完整就緒 | 完成研究設計，前進「三路線研究與計畫工作室」→ |
| 條件式就緒 | 保存條件式設計並前進「三路線研究與計畫工作室」→ |
| 当前缺失 | 尚缺N項，前往補足；另有老麥一鍵補全 |
| 原模型需改 | 查看問題，返回「理論與機制／研究藍圖」→ |
| 未保存 | 儲存並檢查下一步 |
| 工作中 | 查看老麥處理進度 |
| 來源／鎖／計算過期 | 查看差異並重新檢查 |
| 下一模組未建 | 保存交接並查看「三路線研究與計畫工作室」準備 |
| 已交接 | 繼續「三路線研究與計畫工作室」→ |

前進前重驗權限、來源、goal、revision、locks與readiness。保存成功但導航失敗顯示「交接已保存，重新開啟」，不重新生成、不重建Project或重複扣費。

## 27. 最小資料模型、API與安全可靠性

先重用typed artifacts／JSONB／既有關聯表。下列為邏輯物件，不強迫逐一獨立建表：DesignWorkspace、DesignBrief、StudyComponent、InferenceTarget、DesignCandidate／Selection、StudyStructure、PopulationPlan、ArmPlan、TimePoint、MeasurementRequirement、SampleJustification、PlanningParameter、PlanningCalculationRecord、RQDesignDataAnalysisLink、AnalysisPlanVersion、BiasRisk、FeasibilityPlan、AlignmentReport、DesignDecision、ChangeProposal、DesignAnalysisPlanningSnapshot。

Project、RQ、Statement、Construct、EvidenceNeed、LiteratureItem、CitationSource、Zotero、RuleSnapshot、Job、Lock及Stage不能重複新建。對舊版Planning Mode做相容映射及版本採用，不自動批量把舊研究改成新規劃。

API能力契約：

| 能力 | 核心要求 |
|---|---|
| initialize／resume | source_theory_snapshot、schema、ACL、冪等、恢復 |
| get workspace | 真實版本、sources、decisions、locks、issues及jobs |
| typed patch | allowlist、If-Match或等價revision、影響範圍、鎖及引用完整性 |
| compare／assist | SourcePack、Goal、method capability、範圍、預算及取消 |
| planning calculation | 許可模板、typed parameters、engine、input hash、回傳不可變record |
| evidence task | 原文獻中心、需求、來源位置與return_context |
| sample／design adoption | 科學理由、temporal status、decision actor／policy |
| readiness | 版本化規則、due_phase、blocks_actions及可解決缺失 |
| complete／handoff | 重驗、原子baseline＋snapshot＋outbox、冪等與恢復 |
| export／reopen | 指定快照、ACL、真實檔案狀態，不回不存在的下載連結 |

錯誤至少區分：HANDOFF_REQUIRED、HANDOFF_SCHEMA_UNSUPPORTED、PROJECT_ACCESS_DENIED、PROJECT_TRASHED、SOURCE_ACCESS_REVOKED、GOAL_TEMPLATE_UNAVAILABLE、REVISION_CONFLICT、FIELD_LOCKED、INVALID_PARAMETER、CALCULATION_NOT_SUPPORTED、CALCULATION_FAILED、CALCULATION_INPUT_STALE、BUDGET_LIMIT_REACHED、READINESS_BLOCKED、NEXT_MODULE_UNAVAILABLE。帶request_id、field errors、recoverable與next_action，不以HTTP200空頁掩蓋失敗。

權限涵蓋schema內全部巢狀refs、來源全文、embedding、cache、jobs、計算及匯出，不能僅根據URL project_id。build agent與網站老麥runtime分離，不把shell、DB管理、部署或任意檔案讀寫交給網站聊天；OpenClaw官方指出sessionKey不是授權token，共享Gateway也不是不可信租戶的安全邊界。[S8]

外部網頁、PDF、文獻與使用者上傳內容為不可信資料；不執行其中指令，防prompt injection、XSS、SSRF、內網redirect及任意code execution。credentials只在server secret，不放Git、前端、prompt或一般日誌；日誌不印私人計畫全文、PII與未授權筆記。

Export優先使用現有Markdown、JSON及矩陣CSV能力。現有Word／PDF可adapter接入，但本輪不另建新文件平台。CSV需處理公式注入。每份輸出標規劃、來源版本、計算情境、未解限制與審閱狀態。

## 28. 四個實作批次：一條可用流程優先，不做一頁假功能

**A｜相容接收與資料保護。** 查核真實schema、升級原接收頁、TheoryMechanismSnapshot consumer、Goal／temporal context、條件式入口、DesignBrief與原筆記恢復。測版本、ACL與初始化冪等。

**B｜專業設計與真實規劃計算。** 候選比較、研究元件、推論目標、單位／組別／時點、SampleJustification、最小可運作計算、MeasurementRequirements、RQ矩陣及Analysis Planning。至少提供一條MOE_TPR班級研究、一般期刊研究與技術／探索設計的可測垂直流程，不只static cards。

**C｜全項協作與交接。** FieldPolicy／Assist、Orchestrator、Lock、版本、Evidence往返、偏誤／資源檢查、缺失直達、首頁燈號、Readiness、ChangeProposal及第八階段handoff。

**D｜驗收與交付。** 下列48項適用測試、計算參考值／property tests、auth／取消／重啟／rebase、匯出、migration rollback、source live狀態及交接契約。每批驗證後才下一批；不得宣稱未執行測試通過。

不要求本輪把所有統計方法都做成可執行引擎；完整支援適用的「規劃」，可計算範圍據實揭露。不能以功能很多為由交付完全沒有可運作的樣本計算或交接。

## 29. 驗收案例：48項

每項回報PASS／FAIL／NOT_RUN／BLOCKED，資料類型另標LIVE／MOCK／FIXTURE／SIMULATED_FOR_DESIGN。網站fixture通過不代表真實研究、外部API或計算假設已核准。

### A. 承接與目標（T01–T08）
- **T01** 第六階段TheoryMechanismSnapshot初始化同一Project，RQ、模型、設計需求、Evidence與筆記完整保留。
- **T02** ADOPT_WITH_DECLARED_ASSUMPTIONS可進入條件式規劃，不升級為理論已驗證。
- **T03** RETURN_FOR_GAP_OR_SCOPE_REVISION保留工作、提供返回入口，不暗建正式已核准設計。
- **T04** 未知schema有可修復錯誤；重開、雙擊不重建工作區；同冪等鍵不同payload回conflict。
- **T05** JOURNAL_SCI_SSCI、NSTC_GENERAL、MOE_TPR通過validator、API、job、prompt、cache與snapshot；缺模板不回退。
- **T06** 資助與期刊成果可並存，切Tab不改主要Goal、RQ、共用設計或完成進度。
- **T07** 只使用已採用ChangeProposal revision，pending提案不冒充有效模型。
- **T08** 第六階段接收頁筆記升級後仍可讀；缺handoff時提供上游導航，不能生假來源。

### B. 設計品質與研究適用性（T09–T16）
- **T09** 質性／技術／探索性設計可用適用RQ與資料路徑，不強制H1、RCT、量表、p-value或量化Power。
- **T10** 抽樣、分配、觀察及分析單位分開；學生人數、班級數、重複視窗及模型run不混為單一N。
- **T11** 一班一組且班級／教師與介入混淆時，報ARM_SITE_CONFOUNDING；選Mixed Model不能自動解除。
- **T12** 中介候選缺時間順序或辨識假設時，標問題並提供替代／降低主張，不宣稱因果中介成立。
- **T13** 保留RQ無追蹤時點，問題直達TimePoint；所有修正同步更新RQ矩陣與計算過期狀態。
- **T14** 未知場域／設備／學生人數保存null或PROPOSED，不自動變成確定資源。
- **T15** 教學目標為技能卻只測滿意度，顯示Course–Design缺口；不要求所有研究都測同一成果。
- **T16** RESULTS_AWARE條目不得回填為事前規劃或預註冊；正當修訂保留時間、理由及原版。

### C. 規劃計算與分析計畫（T17–T24）
- **T17** 支援的簡單樣本計算實際運作，結果與核對的公式／套件參考值在明確容差內一致，保存engine與版本。
- **T18** 缺文獻效果量時，可執行有理由且標ASSUMPTION_BASED的情境；不得宣稱為來源已證实或顯示已招募N。
- **T19** 群集／重複量測／中介等超出engine能力時，顯示CALCULATION_NOT_SUPPORTED，不套簡單獨立t-test公式。
- **T20** 每組、總量、群集數、向上取整與流失調整明確呈現；總樣本不能誤當每組數。
- **T21** 非法參數、NaN、timeout、不收斂回可診斷失敗；AI不得補上正式數值。
- **T22** 設計模擬有seed／迭代／MC不確定性並標SIMULATED_FOR_DESIGN，不進Raw Dataset或Result Facts。
- **T23** 參數或設計來源變更，舊計算保留並標stale；新計算建立新record，不改舊值。
- **T24** 固定資料、普查、質性或技術研究能採合理SampleJustification，不因沒有一般量化Power被整頁鎖住。

### D. 矩陣、來源與方法（T25–T32）
- **T25** 每個核心RQ可追溯推論目標、設計、構念、測量、時點、資料及分析或解釋策略。
- **T26** Primary、secondary、規劃內探索及新增探索分開；缺失／異常值處理不自動設平均補值或刪除。
- **T27** AI資料切分出現同個體／同文件洩漏或全資料先fit前處理，標風險並定位split／pipeline規劃欄。
- **T28** 計算來源效果量類型或量尺不一致時，不直接套用；轉換需正式計算及假設。
- **T29** 補方法Evidence直達既有文獻與證據中心Project、RQ、需求與return context，保存後返回原欄位。
- **T30** API摘要／全文片段／AI處理與人工閱讀分開，同研究多來源不增加獨立支持票數。
- **T31** Zotero Library+Item+Version與CitationSource保留，斷線不刪引用，也不要求全庫write。
- **T32** CONSORT／SPIRIT等候選依適用研究類型區分規劃与報告，不將所有教育／工程專案標為強制合規。

### E. Assist、鎖定與安全（T33–T40）
- **T33** 欄位、矩陣列、StudyArm、TimePoint、SampleParameter及AnalysisItem均有FieldPolicy與適用Assist，不只有聊天。
- **T34** FILL_EMPTY不改既有內容；IMPROVE_UNLOCKED跳過鎖定；FILL_AND_LOCK記Automation Policy而非人工核准。
- **T35** AI或計算執行中使用者修改／鎖定，遲到輸出只保存候選或stale，不覆寫。
- **T36** 刪組別／時點／矩陣列、整section替換及切active revision不能繞過鎖定與引用檢查。
- **T37** 跨Project或被撤權source參數、全文、job、計算、cache、snapshot與export均被拒絕。
- **T38** 計算worker不能執行任意AI程式、讀PII／secret、任意上網或取得主機管理權。
- **T39** 取消、重啟或回收Project後正確恢復／停止，遲到結果不復活專案、重試不無限付費。
- **T40** 已知研究資料／Result Facts／正式Protocol不能被本輪改寫成規劃新版本；需要修改走明確ChangeProposal。

### F. 缺失、亮燈與交接（T41–T48）
- **T41** 缺失直達正確Project、component、tab與field；未保存內容先處理，失敗不離頁。
- **T42** 補足後保存並返回原位置，後端重驗才解除issue，造訪或AI說完成不算。
- **T43** 規劃基線不要求先有IRB核准、完整量表、計畫核定或真實Results，晚期待辦帶due_phase及blocks_actions。
- **T44** 必要設計矛盾未處理不通過；可解釋的未確定參數能條件式保存，完整與條件式燈號不同。
- **T45** DesignAnalysisPlanningSnapshot具實際schema、版本refs、計算限制、Evidence與late tasks，consumer contract test通過。
- **T46** 完成保存成功但跳轉失敗，可重開原handoff；雙擊／retry不重複建立snapshot或扣費。
- **T47** 第八階段未建時有真實接收頁，顯示三路線所需設計摘要與待辦；已建則同Project adapter正確帶入。
- **T48** 手機、鍵盤、返回、刷新及首頁進度一致；綠燈只表示設計規劃，不自動核准IRB、真實研究或正式投稿。

## 30. 交付內容、狀態紀錄與停止點

完成後交付：
- 實際問題、根因、最小修改方案，修改／新增檔案與所在環境。
- Migration、索引、資料版本映射、API與前後階段資料流。
- 三目標及研究類型覆蓋、StudyComponent／RQ矩陣、Analysis Planning Mode接入。
- PlanningCalculation實際能力、公式／套件、輸入輸出單位、source refs、engine與測試結果；不可用項明確列出。
- Design／Sample／Analysis／Bias／Resource／Evidence／Rule之間的連結。
- FieldPolicy、Assist／Lock覆蓋表，尚未接入項不能稱全站完成。
- Readiness、缺失路由、stage燈號、版本與競態保護。
- TheoryMechanismSnapshot consumer、DesignAnalysisPlanningSnapshot JSON Schema、fixtures及第八階段consumer tests。
- 本輪48項適用驗收、實際命令／紀錄、LIVE／MOCK／FIXTURE／SIMULATION區別，不假報。
- 匯出檔案、資料完整性、備份／回復測試、未完成與阻塞原因。

更新實際repository內 `PROJECT_STATE.md`：本輪V3-U07-FULL範圍、接收及輸出契約、完成批次、引用來源、schema／API、資料與lock策略、計算能力、測試證據、未完成事項、下一階段入口、rollback。日誌與交付不包含API key或敏感研究資料。

**停止於研究設計與分析規劃基線、可重現PlanningCalculation、Evidence鏈與第八階段handoff。不要自行建置完整路線工作室、量表、IRB、Pilot、正式統計或全文。**

---

### 外部核對依據與實作引用

以下為本規格查核的官方文件／原始方法論來源，查核日期2026-09-06。功能設計、狀態名稱與Gate是本網站的產品規劃，不冒充主管機關或期刊強制規定。任何版本、能力或期限變動仍須由建站環境以官方資料核對。

- **[S1]** Lakens, D. (2022). *Sample Size Justification*. Collabra: Psychology, 8(1), 33267. DOI: 10.1525/collabra.33267。用途：樣本理由、精確度、資源限制與情境規劃，不將固定N當通用標準。https://doi.org/10.1525/collabra.33267
- **[S2]** Center for Open Science, *Preregistration*. 用途：區分規劃與探索、資料接觸時間及透明揭露修訂；不把内部保存當註冊。https://www.cos.io/initiatives/prereg
- **[S3]** scikit-learn, *Common pitfalls and recommended practices*. 用途：資料洩漏、test隔離與fold內前處理，實作需核對本環境套件版本。https://scikit-learn.org/stable/common_pitfalls.html
- **[S4]** CONSORT–SPIRIT官方網站，SPIRIT 2025／CONSORT 2025。用途：按適用研究區分protocol與results報告規劃。https://www.consort-spirit.org/
- **[S5]** EQUATOR Network, *Reporting guidelines*. 用途：依study type查詢適用指南，不套用單一checklist。https://www.equator-network.org/reporting-guidelines/
- **[S6]** Consensus官方API說明。用途：既有文獻檢索API整合、能力與授權核對；不固定方案價格或端點。https://help.consensus.app/en/articles/16516328-the-consensus-api
- **[S7]** Zotero Web API v3 Basics／Syncing。用途：Library／Item／Version、partial sync及衝突，不將遠端同步成功當學術驗證。https://www.zotero.org/support/dev/web_api/v3/basics ｜ https://www.zotero.org/support/dev/web_api/v3/syncing
- **[S8]** OpenClaw官方Security。用途：Gateway信任邊界、sessionKey不是授權token、工具／sandbox權限。https://docs.openclaw.ai/gateway/security
- **[S9]** 國科會補助專題研究計畫作業要點。用途：一般研究計畫與審查／資源合理性背景；不在本輪重選學門或寫死年度表單。https://law.nstc.gov.tw/LawContent.aspx?id=FL026713
- **[S10]** 教育部補助大專校院教學實踐研究計畫作業要點。用途：課程教學問題及學生學習成效定位，資格及年度條件另按實際來源核對。https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001704
- **[S11]** W3C WCAG 2.2, Understanding Status Messages。用途：動態狀態可被輔助技術辨識；不只靠視覺燈號。https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

### 最重要的端到端演示

以MOE_TPR專案從第六階段同一Project進入：帶入課程問題、模型、RQ與測量需求 → 老麥提出可行班級研究設計 → 發現一班一組與教師混淆風險 → 提出有說明的替代或限縮推論 → 建立群集／學生／時點結構及樣本理據 → 可支援的情境才實際計算，不能支援者顯示待專家處理 → 把樣本數鎖定為指定參數版本 → 補充方法來源並返回 → 建立RQ—資料—分析矩陣 → 保存完整或條件式規劃基線 → 首頁顯示真實燈號 → 將設計、分析、計算限制、課程安排、Evidence與待辦交給第八階段教學實踐工作室。

再用JOURNAL與技術／探索性研究測試：不被強迫使用量表、H1或普通Power；沒有正式結果不生成Results；切換期刊成果視圖不覆蓋計畫資料；刷新、取消、鎖定、來源更新、重啟與下一模組未建置皆不遺失資料或斷層。
