# OpenClaw 科研網站 V3－第十二階段完整建置提示詞
## Formal Research Execution & Data Collection
### 正式研究執行與資料蒐集
Version: V3-U12-FULL / v3.4

---

## 0. 本階段定位

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
11. Pilot／工具預試與 Protocol 驗證

本階段請新增：

# 正式研究執行與資料蒐集
Formal Research Execution & Data Collection

本階段核心任務：

1. 承接 PilotValidationSnapshot 與 FormalStudyReadiness。
2. 建立正式研究執行放行 Gate。
3. 管理 Recruitment / Enrollment / Consent / Eligibility。
4. 管理 Intervention / Exposure / Observation / Session Execution。
5. 管理正式 Data Capture。
6. 管理 Protocol Deviations / Adverse Events / Device or Platform Failures。
7. 建立 Study Operations Dashboard。
8. 建立 Source Data / Raw Data 接收與唯讀保護。
9. 分離 Identifiable Data、Research Data 與 Identity Mapping。
10. 建立正式研究執行版本、稽核、狀態與交接。
11. 完成後交接至第十三階段「資料治理、清理與 Analysis Dataset」。

本階段不做：
- 正式統計分析
- 結果解讀
- Results撰寫
- Discussion
- 最終論文
- 正式投稿

---

# 1. 與第十一階段無縫銜接

先讀取：

- ResearchProject
- GoalContext
- PilotValidationSnapshot
- FormalStudyReadinessAssessment
- InstrumentProtocolSnapshot
- Adopted Instrument Versions
- Adopted Protocol Version
- Adopted Scoring Specification
- Adopted Data Capture Schema
- Ethics Scope
- InstitutionalEthicsDecision
- DataManagementPlan
- PreregistrationPlan
- Pilot Findings
- Pilot Revision History
- Lock Manifest
- Source Manifest
- PROJECT_STATE.md

不得重新建立：

- Project
- RQ
- Design
- Instrument
- Protocol
- Analysis Plan

若 Pilot 後曾修訂 Instrument / Protocol / Scoring，
正式研究只能使用「已採用且已通過 Formal Execution Gate」的版本。

不得默認使用最新版本。

---

# 2. 正式研究執行 Gate

建立：

FormalExecutionGate

狀態：

- NOT_READY
- CONDITIONALLY_READY
- READY
- PAUSED
- STOPPED

至少檢查：

- FormalStudyReadiness
- Institutional Ethics Decision
- Protocol Version
- Instrument Version
- Consent / Information Materials
- Recruitment Materials
- Eligibility Criteria
- Data Capture Configuration
- Data Management Plan
- Site / Classroom / Equipment Readiness
- Staff Training
- Device / Platform Readiness
- Study IDs
- Safety / Adverse Event Procedures
- Current Protocol Deviations
- Open FATAL Issues

若涉及人體研究，
缺少適用的 Institutional Decision / Permission 時不得 READY。

網站不能自行宣告 IRB Approved 或 Exempt。

---

# 3. Execution Authorization

建立：

ExecutionAuthorization

欄位：

- authorization_id
- project_id
- execution_type
- authorized_protocol_version
- authorized_instrument_versions
- authorized_site
- authorized_population
- authorized_date_range
- authorized_by
- basis
- status
- restrictions
- source_refs

execution_type：

- FORMAL_HUMAN_RESEARCH
- FORMAL_NON_HUMAN_RESEARCH
- FORMAL_SECONDARY_DATA
- FORMAL_TECHNICAL_EXPERIMENT
- FORMAL_COURSE_RESEARCH

不得讓網站模型自己建立虛假 authorization。

---

# 4. Study Operations Dashboard

首頁或Stage Workspace建立：

# Study Operations Dashboard

顯示：

- Formal Execution Status
- Enrollment Progress
- Sessions Completed
- Data Capture Status
- Missing Expected Sessions
- Protocol Deviations
- Adverse Events
- Device / Platform Alerts
- Data Sync Errors
- Pending Follow-ups
- Current Authorized Versions
- Next Operational Action

此Dashboard顯示的是「研究執行狀態」，
不等於研究結果。

---

# 5. Participant / Unit Enrollment

支援不同研究單位：

- Human Participant
- Student
- Employee
- Class
- Team
- Site
- Machine
- Process Run
- Device
- Dataset
- Document
- Environmental Sample

建立：

StudyUnit

欄位：

- study_unit_id
- project_id
- unit_type
- pseudonymous_id
- enrollment_status
- eligibility_status
- enrolled_at
- withdrawn_at
- withdrawal_reason_code
- site_id
- cohort_id
- arm_id
- source_system

不得在 Research Workspace 暴露不必要的直接識別資訊。

---

# 6. Identity Mapping 分離

建立或沿用：

IdentityMappingVault

只能保存：

- Real-world Identity
- Contact Information
- Mapping to Pseudonymous Study ID

要求：

- 權限獨立
- 稽核獨立
- 最小暴露
- 不能送入一般AI任務
- 不能進分析Dataset
- 不能在一般研究頁顯示

AI不得取得參與者PII。

---

# 7. Recruitment Workflow

建立：

RecruitmentRecord

狀態：

- IDENTIFIED
- CONTACTED
- SCREENING
- ELIGIBLE
- INELIGIBLE
- INVITED
- DECLINED
- ENROLLED
- WITHDRAWN

保存：

- recruitment_source
- recruitment_material_version
- contact_channel
- contacted_at
- screening_status
- exclusion_reason_code

教育情境要能記錄：

- teacher-student relationship
- voluntary participation
- grading separation
- recruitment delegate

---

# 8. Eligibility Screening

建立：

EligibilityAssessment

依 adopted inclusion / exclusion criteria 執行。

每項保存：

- criterion_id
- status
- source
- assessed_by
- assessed_at

status：

- MET
- NOT_MET
- UNKNOWN
- NOT_APPLICABLE

UNKNOWN 不得自動當 ELIGIBLE。

---

# 9. Consent / Information Process

建立：

ConsentRecord

保存：

- study_unit_id
- consent_type
- document_version
- language
- presented_at
- signed_at
- status
- source_file_ref
- consented_optional_components
- withdrawn_at

status：

- NOT_REQUIRED_BY_CONFIRMED_DECISION
- PENDING
- CONSENTED
- DECLINED
- WITHDRAWN
- INVALID

不得AI生成真實簽署或 consent date。

未有真實記錄不能標 CONSENTED。

---

# 10. Session / Visit / Activity Execution

建立：

StudySession

適用於：

- Pre-test
- Intervention
- Post-test
- Follow-up
- Lab session
- VR session
- Sensor session
- Interview
- Focus group
- Field observation
- Technical experiment
- Manufacturing run
- Environmental measurement
- AI evaluation session

保存：

- session_id
- study_unit_id
- planned_session_type
- protocol_version
- instrument_versions
- scheduled_at
- started_at
- ended_at
- status
- operator
- site
- condition / arm
- device_config
- deviations
- notes

status：

- PLANNED
- STARTED
- COMPLETED
- PARTIAL
- MISSED
- CANCELLED
- INVALIDATED

---

# 11. Protocol Fidelity

建立：

ProtocolFidelityRecord

檢查：

- intended activity
- delivered activity
- duration
- dose
- sequence
- provider
- environment
- adaptations
- omissions
- participant exposure

輸出：

- COMPLETE
- MINOR_DEVIATION
- MAJOR_DEVIATION
- NOT_ASSESSABLE

不能用AI自動把缺失記錄判為 COMPLETE。

---

# 12. Protocol Deviation

建立：

ProtocolDeviation

欄位：

- deviation_id
- session_id
- protocol_version
- category
- description
- occurred_at
- discovered_at
- severity
- impact
- corrective_action
- requires_ethics_notification
- status

severity：

- MINOR
- MAJOR
- CRITICAL

不得因「偏差不影響主要假設」就刪除原始紀錄。

---

# 13. Adverse Event / Safety Event

適用研究建立：

SafetyEvent

保存：

- study_unit_id
- event_type
- severity
- seriousness
- relatedness
- onset
- resolution
- action_taken
- reporting_requirement
- reported_to
- reported_at
- status

網站只管理流程，
不能取代機構正式安全判斷。

---

# 14. 正式 Data Capture

建立或擴充：

FormalDataCaptureService

支援：

- Manual form
- Questionnaire
- Assessment
- Rubric
- Sensor
- Device
- API
- LMS
- AI system
- File import
- Database import
- Environmental / Process Measurement

每筆資料需保存：

- project_id
- study_unit_id
- session_id
- variable_id
- value
- unit
- source_type
- source_id
- captured_at
- received_at
- instrument_version
- schema_version
- provenance
- quality_flag

---

# 15. Source Data / Raw Data Immutable Layer

正式研究的原始資料建立：

RawDataRecord / RawDataObject

要求：

- append-only 或 immutable object
- checksum
- created_at
- source
- version
- provenance
- acquisition metadata
- access audit

不得讓：

- AI
- data cleaning
- analysis
- manual edit

直接覆寫 Raw Data。

任何修正建立：

DataCorrectionRecord

保留：

- original value
- proposed corrected value
- reason
- authorized_by
- timestamp

---

# 16. Data Capture Validation

輸入時做：

- schema validation
- type validation
- unit validation
- allowed-range check
- required variable check
- timestamp consistency
- duplicate detection
- session matching
- impossible value flag

但：

Outlier / unusual value ≠ automatically wrong。

不得自動修正正式研究原始資料。

---

# 17. Sensor / Device / AI Provenance

若研究包含：

- VR
- Wearable
- EEG
- EDA
- HRV
- Eye tracking
- IoT
- AI / LLM
- Computer Vision
- Energy systems
- Environmental sensors

保存：

- device_model
- firmware
- software_version
- calibration
- sampling_rate
- timezone
- clock_sync
- model_version
- prompt_version
- inference_config
- API provider
- preprocessing_at_capture
- failure_state

正式資料不能只寫「由AI取得」。

---

# 18. AI研究的額外控制

若AI系統本身是介入或測試對象：

保存：

- model/provider
- exact version if available
- system prompt version
- application version
- retrieval corpus version
- tool configuration
- temperature / sampling if relevant
- guardrails
- failure logs
- human override
- response latency

若研究期間AI服務發生版本切換：

MODEL_VERSION_CHANGED_DURING_STUDY

需建立影響評估，
不能靜默混在同一處理條件。

---

# 19. Educational Research Operations

教學實踐或教育研究額外管理：

- Course Week
- Class Section
- Teaching Activity
- Attendance
- Intervention Exposure
- Learning Artifact
- Assessment
- Assignment
- Grading Separation
- Research Participation
- Course Outcome

必須分開：

Course Data
vs
Research Participation Data

不參與研究者的正常課程權益不能受到影響。

---

# 20. Non-human / Technical Research

對：

- AI benchmark
- process experiment
- manufacturing
- material experiment
- energy optimization
- environmental monitoring

建立適合的：

ExperimentRun

欄位：

- run_id
- configuration_version
- inputs
- process_parameters
- environment
- equipment
- calibration
- start/end
- operator
- output refs
- anomalies
- deviation
- validity_status

不強制 Consent / Participant schema。

---

# 21. Secondary Data Research

若正式研究使用既有資料：

建立：

SecondaryDataAcquisition

保存：

- source
- license / permission
- access_date
- dataset_version
- inclusion_window
- extraction_query
- fields
- privacy restrictions
- provenance

原始取得資料與分析衍生資料分開。

---

# 22. Formal Execution QA

建立：

ExecutionQualityCheck

至少：

- Expected vs Actual Sessions
- Missing Captures
- Duplicate Records
- Timing Deviations
- Device Failures
- Protocol Fidelity
- Dropout / Withdrawal
- Data Sync Failures
- Consent Mismatch
- Unauthorized Version Use
- Unknown Study Unit
- Unexpected Arm / Condition

狀態：

- PASS
- WARNING
- FAIL
- NOT_APPLICABLE

FAIL不應自動刪除資料，
而是建立 Data/Protocol Issue。

---

# 23. Enrollment / Progress Monitoring

進度顯示：

- target_planned_n
- enrolled_n
- completed_n
- withdrawn_n
- valid_session_n
- pending_followup_n

不得：

- 把Pilot N加入正式N
- 把未完成 session 當完成
- 把規劃N當實際N

---

# 24. Stopping Rule / Pause Rule

若上游已有：

- recruitment stop rule
- safety stop rule
- data collection end rule

正式執行依規則顯示。

但系統不能擅自建立新的正式研究停止標準。

若需要重大改變：

PROTOCOL_AMENDMENT_REQUIRED

---

# 25. 研究執行中版本管理

正式研究啟動後，

若變更：

- Protocol
- Instrument
- Scoring
- Recruitment
- Consent
- Intervention
- Device
- AI version
- Data Capture Schema

不得直接覆蓋。

建立：

FormalExecutionChangeProposal

並記錄：

- reason
- affected data range
- ethics impact
- comparability impact
- implementation date

---

# 26. 老麥AI的角色

本階段每個 operational item 可以有：

- 老麥解說
- 檢查缺失
- 建立操作清單
- 協助整理偏差
- 產生待辦
- 檢查一致性
- 彙整進度

AI不得：

- 代簽Consent
- 創造受試者
- 創造研究資料
- 修改Raw Data
- 宣告IRB核准
- 隱藏Protocol deviation
- 自動刪除outlier
- 把Pilot轉成Formal Data

---

# 27. 缺失導航

例如：

缺失：
目前Formal Execution使用Instrument v3，
但ExecutionAuthorization只授權v2。

影響：
不得繼續此正式施測。

按鈕：

[前往工具版本]
[前往執行授權]
[查看版本差異]

補完：

[保存並返回正式研究執行]

---

# 28. 本階段完成條件

建立兩類Gate：

## FORMAL_DATA_COLLECTION_ACTIVE

代表正式研究目前可合法／依計畫執行。

不是 Stage完成條件。

## FORMAL_DATA_COLLECTION_COMPLETE

至少：

- applicable formal sessions closed
- expected data capture status known
- unresolved critical deviations handled / flagged
- source data persisted
- provenance preserved
- enrollment and withdrawal reconciled
- final execution QA snapshot
- formal collection end recorded

但：

研究完成收資料
≠
資料已清理
≠
分析完成
≠
結果成立

---

# 29. 首頁流程燈號與下一步

正式執行中：

藍燈：
FORMAL_DATA_COLLECTION_ACTIVE

收資料完成：

綠燈：
FORMAL_DATA_COLLECTION_COMPLETE

有重大問題：

紅／黃：
EXECUTION_BLOCKED
EXECUTION_WARNING

完成後：

【完成正式資料蒐集，前進「資料治理、清理與 Analysis Dataset」→】

若有關鍵缺失：

【尚缺 N 項，前往補足】

---

# 30. 第十三階段交接

建立：

FormalExecutionSnapshot

包含：

- project_id
- goal_context
- formal execution authorization
- protocol version
- instrument versions
- scoring version
- data capture schema
- recruitment summary
- enrollment summary
- withdrawal summary
- consent summary
- session summary
- intervention / exposure summary
- deviations
- safety events
- device / AI versions
- raw data manifests
- source checksums
- data capture QA
- study unit registry refs
- identity vault references only
- execution change history
- outstanding data issues
- unresolved compliance issues
- source manifest
- lock / version manifest

下一階段：

# 新版第十三階段
資料治理、清理與 Analysis Dataset

下一模組未建時提供可重開接收頁。

---

# 31. 資料安全

正式資料預設：

- least privilege
- workspace isolation
- PII separation
- audit logging
- encrypted storage where applicable
- download permission
- access expiry where applicable
- role-based access

Identity Mapping不送入LLM。

敏感Raw Data不自動送外部AI服務。

---

# 32. E2E驗收

至少驗收：

1. 第十一階段Pilot資料不進Formal Dataset。
2. Formal Execution Gate阻擋未授權人體研究。
3. Instrument版本與Authorization一致。
4. Consent沒有真實記錄不得標Consented。
5. Withdrawal可被追蹤。
6. Teacher-student研究保留權力風險控制。
7. Study Session版本可追溯。
8. Protocol deviations不能被覆寫或刪除。
9. Raw Data不可直接修改。
10. Correction保留原值與理由。
11. Device/AI版本保存。
12. AI模型切換觸發影響評估。
13. Duplicate capture被flag但不自動刪除。
14. Missing capture可導航補查。
15. Pilot N不加入Formal N。
16. Planned N不顯示成Enrolled N。
17. Secondary data保留license與版本。
18. Non-human study不被強迫Consent。
19. Access權限測試。
20. Stage handoff可被下一階段consumer test讀取。

---

# 33. 分批實作

Batch A：
Formal Execution Gate、Authorization、StudyUnit、Enrollment。

Batch B：
Sessions、Data Capture、Raw Data、QA、Device/AI provenance。

Batch C：
Deviations、Safety、Education/Technical/Secondary-data adapters、Dashboard。

Batch D：
Completion gate、首頁燈號、handoff、E2E、安全與rollback。

---

# 34. 完成後回報

請回報：

1. 修改／新增檔案
2. Migration
3. Models
4. APIs
5. Formal Execution Gate
6. Authorization
7. Enrollment
8. Consent
9. Study Sessions
10. Protocol Fidelity
11. Deviations
12. Safety Events
13. Data Capture
14. Raw Data Immutable Layer
15. Device / AI Provenance
16. QA
17. Study Operations Dashboard
18. Assist coverage
19. Permission / PII isolation
20. FormalExecutionSnapshot
21. Consumer Contract Tests
22. E2E
23. LIVE / MOCK / FIXTURE / NOT_RUN / BLOCKED
24. Known Issues
25. Rollback

更新 PROJECT_STATE.md。

完成新版第十二階段後停止，不自行開始第十三階段。
