# OpenClaw 科研網站 V3－第十一階段完整建置提示詞
## Pilot／工具預試與 Protocol 驗證
Version: V3-U11-FULL / v3.4

---

# 0. 本階段定位

目前新版科研網站已完成：
1. 專案與文獻證據底座
2. 前沿雷達 × 一鍵靈感 × 選題實驗室
3. 投稿與計畫導航
4. 研究藍圖與研究規劃
5. 文獻深化與 Gap／新穎性驗證
6. 理論與機制
7. 研究設計與分析計畫
8. 三路線研究與計畫工作室
9. 路線審查、合規準備與研究倫理
10. 研究工具、量表與 Study Protocol

本階段新增：

# Pilot／工具預試與 Protocol 驗證
Pilot, Instrument Pretest & Protocol Validation

本階段不是正式研究執行。
本階段目的，是在正式資料蒐集前，用小規模、受控、可追溯的方式驗證：

- 量表／問卷是否可理解、可操作
- 技能評分規準是否可執行
- 教學／實驗材料是否可正常使用
- 系統／感測器／AI模組是否可穩定產生資料
- Study Protocol 是否可實際照流程執行
- 計分、跳題、資料欄位與分析前置規格是否正確
- 時間、負擔、招募、場域及倫理流程是否存在實務問題
- 是否需要修訂 Instrument / Material / Protocol / Analysis Plan

本階段完成後，交接至：

# 新版第十二階段：正式研究執行與資料蒐集
Formal Research Execution & Data Collection

---

# 1. 與第十階段無縫銜接

必須讀取並沿用：

- ResearchProject
- GoalContext
- InstrumentProtocolSnapshot
- MeasurementRequirementMap
- InstrumentVersion
- InstrumentUsage
- InstrumentRightsRecord
- TranslationAdaptationRecord
- MaterialVersion
- ActivitySchedule
- ScoringSpecification
- DataCaptureSchema
- StudyProtocolVersion
- EthicsPlanningSnapshot
- InstitutionalEthicsDecision
- DataManagementPlan
- PreregistrationPlan
- RequirementIssue
- RevisionTask
- Evidence / CitationSource / Zotero refs
- Assist / Lock / Version / Audit Trail
- StageReadiness / StageActionBar
- PROJECT_STATE.md

不得重新建立專案、工具、Protocol或文獻庫。
不得要求使用者重填已存在內容。

若第十階段交接只有條件式規劃，必須保留其限制，不能自動升級為可執行。

---

# 2. 本階段頁面架構

Project Navigation 新增：

11 Pilot／預試與 Protocol 驗證

Tabs：

1. Pilot 總覽
2. 放行條件
3. 工具預試
4. 認知訪談／可理解性
5. 評分者／一致性
6. 系統與設備測試
7. Protocol 演練
8. Pilot 資料品質
9. 修訂與版本
10. 放行決策
11. Evidence
12. 歷程

首頁流程：

工具、量表與 Protocol
→ Pilot／預試與 Protocol 驗證
→ 正式研究執行與資料蒐集

---

# 3. Pilot 與正式研究必須分開

建立明確資料狀態：

- SYNTHETIC_TEST
- INTERNAL_DRY_RUN
- COGNITIVE_PRETEST
- PILOT_RESEARCH_DATA
- FORMAL_RESEARCH_DATA

不得把：

- Synthetic test
- sandbox scoring test
- 研究團隊內部dry run
- Pilot participants

混入正式研究 Dataset 或正式樣本數。

Pilot 若依研究設計與倫理要求屬於人體研究，必須先確認適用的InstitutionalEthicsDecision與執行許可。

網站不得因本階段名稱為Pilot，就自動判定可以招募人體受試者。

---

# 4. Pilot Readiness Gate

建立：

PilotReadinessAssessment

至少檢查：

- Instrument版本是否明確
- Protocol版本是否明確
- Scoring Spec可執行
- Data Capture Schema已建立
- 權利／授權是否允許Pilot用途
- 涉及人體時是否符合倫理執行條件
- 招募材料是否準備
- 同意流程是否準備
- Data Management Plan可落地
- 場域／設備／帳號是否可用
- 危害與風險控制是否完成
- Pilot目的與成功／失敗準則是否明確

狀態：

- READY_FOR_INTERNAL_DRY_RUN
- READY_FOR_HUMAN_PILOT
- CONDITIONALLY_READY
- BLOCKED

只有符合真實條件時才能進行人體Pilot。

---

# 5. Pilot Plan

建立：

PilotPlan

欄位至少包含：

- pilot_id
- purpose
- pilot_type
- target_components
- participant_type
- planned_n
- sampling_rationale
- inclusion_exclusion
- environment
- duration
- activities
- measures
- data_collected
- success_criteria
- stop_criteria
- adverse_event_plan
- owner
- start_window
- status

pilot_type：

- INTERNAL_DRY_RUN
- COGNITIVE_PRETEST
- SMALL_SCALE_PILOT
- TECHNICAL_PILOT
- RATER_CALIBRATION
- DATA_PIPELINE_PILOT

planned_n不得自動寫成實際完成N。

---

# 6. 工具預試

對問卷／量表／測驗／評分規準，支援：

- 可理解性
- 題目歧義
- 回答選項合理性
- 作答負擔
- 天花板／地板初步訊號
- 缺失與跳題問題
- 題序問題
- 重複題／冗餘
- 反向題理解風險
- 評分規則錯誤
- 題項與構念對應

但：

小型Pilot結果不得直接宣稱正式信效度成立。

例如：

- Cronbach alpha from pilot = PILOT_DIAGNOSTIC_ONLY
- factor analysis with insufficient N = NOT_FORMAL_VALIDATION

不得因Pilot alpha高就自動鎖定工具為Validated。

---

# 7. Cognitive Interview / Comprehension Check

適用於：

- 新編問卷
- 翻譯／文化調適量表
- 學生版問卷
- 複雜指令
- 高風險或敏感題目

建立：

CognitiveInterviewRecord

保存：

- item_id
- participant_profile
- comprehension_issue
- interpretation_variance
- retrieval_issue
- judgment_issue
- response_mapping_issue
- suggestion
- severity
- action

不得保存不必要的直接識別個資。

---

# 8. 評分者一致性／Rater Calibration

適用於：

- 技能表現
- 作品評分
- 行為編碼
- VR操作評量
- 教學觀察
- 質性編碼前校準

建立：

RaterCalibrationRun

保存：

- rubric_version
- raters
- training_material
- calibration_cases
- agreement_metric
- disagreements
- adjudication_rule
- revision_needed

指標由真實計算服務產生。

不得AI直接生成κ、ICC或agreement數值。

---

# 9. 系統／設備／AI模組 Technical Pilot

適用：

- VR / AR
- AI model
- Wearable
- Eye tracker
- EEG / EDA / HRV
- Sensor / IoT
- Learning platform
- Data pipeline
- API integration

測試：

- device availability
- sampling frequency
- time synchronization
- packet loss
- missing event
- calibration
- logging completeness
- timestamp consistency
- sensor drift
- inference latency
- model output availability
- platform crash
- network dependency
- local fallback
- privacy / third-party transfer

建立：

TechnicalPilotRecord

不得將synthetic system test當成研究participant資料。

---

# 10. AI研究模組專屬測試

若研究含AI：

建立：

AIResearchSystemValidation

至少檢查：

- model/version
- prompt/version
- inference settings
- benchmark / reference dataset
- leakage risk
- output logging
- deterministic / stochastic behavior
- failure handling
- unsafe output handling
- human override
- latency
- cost
- privacy
- third-party retention

若AI模型在Pilot後更新，正式研究前須REVALIDATION_REQUIRED。

---

# 11. Protocol Dry Run

建立：

ProtocolDryRun

逐步執行Study Protocol：

- setup
- participant arrival
- consent
- baseline
- intervention
- measurement
- break
- adverse event
- debrief
- data save
- backup
- closeout

每步保存：

- planned_duration
- actual_duration
- deviation
- issue
- severity
- corrective_action

目的：驗證流程可行性，不是產生研究效果。

---

# 12. Protocol Deviation Log

建立：

PilotProtocolDeviation

- deviation_id
- protocol_step
- expected
- actual
- cause
- impact
- safety_impact
- data_impact
- action
- recurrence_risk

Pilot中的偏差應回饋正式Protocol。

---

# 13. Pilot Data Quality Dashboard

只針對Pilot資料顯示：

- recruitment
- completion
- missingness
- invalid values
- device dropout
- protocol deviations
- scoring errors
- timing
- burden
- data completeness

不得顯示假正式研究結論。

所有指標必須標示：

PILOT_DIAGNOSTIC

---

# 14. Pilot Outcome Types

Pilot結果不是「研究假設成立／不成立」。

分類：

- INSTRUMENT_OK
- INSTRUMENT_REVISION_REQUIRED
- PROTOCOL_OK
- PROTOCOL_REVISION_REQUIRED
- TECHNICAL_OK
- TECHNICAL_REVISION_REQUIRED
- ETHICS_REVIEW_UPDATE_REQUIRED
- DATA_PIPELINE_REVISION_REQUIRED
- ANALYSIS_PLAN_REVISION_REQUIRED
- FORMAL_STUDY_NOT_READY

---

# 15. Revision Impact Analysis

任何Pilot發現需要修改時：

建立：

PilotRevisionProposal

欄位：

- affected_entity
- current_version
- proposed_change
- reason
- evidence
- scientific_impact
- participant_impact
- analysis_impact
- ethics_impact
- requires_reapproval
- proposed_by

不得直接覆蓋原Instrument／Protocol／Analysis Plan。

採用後建立新版本。

---

# 16. Ethics Change Check

若Pilot修訂涉及：

- 招募
- 同意書
- 介入內容
- 風險
- 量表敏感題
- 錄音錄影
- AI/cloud
- Data sharing
- participant burden

必須檢查：

ETHICS_AMENDMENT_MAY_BE_REQUIRED

網站只能提醒與記錄，不得自行宣告不需變更審查。

---

# 17. Pilot Statistical Diagnostics

可支援：

- missingness
- completion time
- score range
- item response distribution
- obvious ceiling/floor signal
- inter-rater agreement
- technical reliability

但必須避免：

- 以Pilot做正式confirmatory hypothesis testing
- 將低power p-value當成正式研究結論
- 用Pilot效果量直接包裝為已證實成果

Pilot效應資訊如供正式研究規劃使用，必須標示不確定性與用途限制。

---

# 18. 三大研究目標專屬Pilot

## JOURNAL_SCI_SSCI

重點：

- 方法可重現
- 工具品質
- protocol feasibility
- technical reliability
- analysis readiness

## NSTC_GENERAL

重點：

- preliminary feasibility
- methods risk
- system prototype
- resource estimates
- work package realism

若Pilot發生在送件前，可作為真實Preliminary Work；
只有真的做過才能寫入計畫書。

## MOE_TPR

重點：

- course logistics
- student burden
- teaching activity timing
- learning outcome assessment
- teacher-student power safeguards
- classroom feasibility

不能為了Pilot而任意以正式課程學生進行未授權人體研究。

---

# 19. 老麥全項協作

每個Pilot項目：

- 老麥解說
- 產生測試清單
- 產生dry-run腳本
- 整理問題
- 分類severity
- 建議修訂
- 建立RevisionProposal
- 產生缺失導航
- 查看來源
- 鎖定

StageAssist：

- 老麥一鍵建立Pilot計畫
- 一鍵建立Dry Run
- 一鍵整理Pilot發現
- 一鍵產生修訂清單
- 一鍵檢查正式研究放行條件

不得虛構participant、N、數值、IRB或Pilot完成紀錄。

---

# 20. Lock / Version / Concurrency

Instrument、Material、Protocol、Scoring、DataSchema均保留版本。

Pilot永遠引用明確版本。

若Pilot執行中版本被修改：

- 該run仍綁原版本
- 新版本建立新的pilot需要時再驗證

遲到AI／背景任務不得覆蓋鎖定版本。

---

# 21. Pilot Execution Permission

建立：

PilotExecutionPermission

區分：

- INTERNAL_NON_HUMAN
- HUMAN_PILOT
- TECHNICAL_SYSTEM_ONLY

permission狀態：

- ALLOWED
- BLOCKED
- PENDING_INSTITUTIONAL_CONFIRMATION
- PENDING_RIGHTS
- PENDING_SITE_ACCESS

Stage規劃完成不自動等於permission ALLOWED。

---

# 22. Formal Study Readiness Gate

建立：

FormalStudyReadinessAssessment

至少檢查：

- adopted Instrument Version
- adopted Protocol Version
- adopted Scoring Spec
- adopted Data Capture Schema
- Pilot critical issues resolved
- Ethics execution conditions
- Rights / licenses
- Site / equipment
- DMP
- recruitment materials
- consent materials
- role assignments
- analysis plan status
- preregistration status if applicable

狀態：

- READY_FOR_FORMAL_EXECUTION
- CONDITIONALLY_READY
- BLOCKED

不得因Pilot頁完成就自動標READY。

---

# 23. 缺失導航

每個阻擋項：

- issue
- why
- impact
- required truth source
- AI action
- destination

例如：

缺失：EEG時間同步測試仍有事件偏移。

影響：正式研究無法可靠對齊刺激事件與生理訊號。

按鈕：

[前往Technical Pilot]
[老麥建立修正與重測清單]

補完：

[保存並返回Pilot驗證]

後端重新驗證。

---

# 24. 首頁燈號與下一步

完成Pilot與正式研究放行：

【完成Pilot驗證，前進「正式研究執行與資料蒐集」→】

Pilot完成，但正式執行仍有晚期條件：

【保存Pilot驗證，查看正式研究待辦】

有當前必要缺失：

【尚缺N項，前往補足】
【老麥一鍵建立修正方案】

首頁綠燈表示：

PILOT_VALIDATION_COMPLETE

不得代表正式研究完成。

正式研究是否可開始另外顯示：

FORMAL_EXECUTION_READINESS

---

# 25. 本階段Handoff

建立：

PilotValidationSnapshot

至少包含：

- project_id
- goal_context
- pilot plans
- runs
- instrument version tested
- protocol version tested
- scoring version tested
- data schema version tested
- technical pilot
- cognitive pretest
- rater calibration
- protocol dry run
- pilot quality diagnostics
- deviations
- findings
- adopted revisions
- unresolved issues
- ethics amendment flags
- execution permissions
- formal study readiness
- evidence
- source manifest
- lock manifest
- next-stage needs

下一階段：

新版第十二階段
正式研究執行與資料蒐集

若尚未建置，提供真實接收頁，不跳空白頁。

---

# 26. 本階段不要做

不得提前：

- 正式招募
- 正式人體研究執行
- 正式樣本計數
- 正式研究Dataset
- confirmatory analysis
- 正式Results
- Manuscript Results/Discussion
- 正式submission

可建立：

- recruitment readiness
- formal execution checklist
- pilot findings
- revised instrument/protocol

---

# 27. 資料模型

依既有ORM增量新增／擴充：

- PilotReadinessAssessment
- PilotPlan
- PilotRun
- PilotParticipantRecord（必要最小化、依法規與倫理）
- CognitiveInterviewRecord
- RaterCalibrationRun
- TechnicalPilotRecord
- AIResearchSystemValidation
- ProtocolDryRun
- PilotProtocolDeviation
- PilotDataQualityMetric
- PilotFinding
- PilotRevisionProposal
- PilotExecutionPermission
- FormalStudyReadinessAssessment
- PilotValidationSnapshot

不得複製：

- Instrument
- Material
- StudyProtocol
- ResearchDesign
- AnalysisPlan
- EthicsDecision
- Evidence

全部以版本ID關聯。

---

# 28. E2E驗收

至少測試：

1. 第十階段交接可直接進第十一階段。
2. Pilot引用明確工具與Protocol版本。
3. Synthetic資料不能混入Pilot或Formal dataset。
4. Internal dry run與Human pilot permission分開。
5. 未有倫理執行條件時阻擋Human pilot。
6. planned_n不變成actual_n。
7. Cognitive interview可產生item-level修訂。
8. Pilot alpha不標Validated。
9. Rater agreement由真實計算服務產生。
10. Technical Pilot可記錄同步／遺失／漂移。
11. AI模組版本改變觸發revalidation。
12. Protocol dry run可記錄實際時間與偏差。
13. Pilot data標示PILOT_DIAGNOSTIC。
14. Pilot finding不變成研究假設結果。
15. 修訂採用後建立新版本，不覆蓋舊版。
16. 可能影響倫理時建立amendment flag。
17. FormalStudyReadiness不由Pilot頁面完成自動判定。
18. 鎖定內容不被遲到AI覆寫。
19. 缺失導航可直達並返回。
20. Stage11 snapshot可被第十二階段consumer test讀取。
21. 下一模組未建置時不跳空白頁。
22. 重新整理後Pilot findings仍存在。
23. 三目標適用性邏輯不同。
24. LIVE/MOCK/SYNTHETIC/PILOT狀態清楚分離。

---

# 29. 分批實作

## Batch A
承接第十階段、Pilot頁面、Readiness與資料模型。

## Batch B
Instrument／Cognitive／Rater／Technical／Protocol dry run。

## Batch C
Pilot diagnostics、Revision、Ethics Change、Formal Readiness。

## Batch D
首頁燈號、缺失導航、handoff、E2E、安全與rollback。

---

# 30. 完成後交付

請回報：

1. 修改／新增檔案
2. Migration
3. Models
4. API routes
5. Pilot Readiness Gate
6. Pilot Plan / Run
7. Cognitive Pretest
8. Rater Calibration
9. Technical Pilot
10. AI System Validation
11. Protocol Dry Run
12. Data Quality Dashboard
13. Revision Pipeline
14. Ethics Change Check
15. Execution Permission
16. Formal Study Readiness
17. Assist / Lock coverage
18. PilotValidationSnapshot
19. 第十二階段consumer tests
20. 真實E2E
21. LIVE / MOCK / SYNTHETIC / PILOT / BLOCKED狀態
22. Known Issues
23. Rollback

更新PROJECT_STATE.md。

完成新版第十一階段後停止，不自行開始第十二階段。
