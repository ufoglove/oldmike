# OpenClaw 科研網站 V3－第九階段完整建置提示詞
## Route Review, Compliance Preparation & Research Ethics
### 路線審查、合規準備與研究倫理
Version: V3-U09-FULL / v3.4

目前新版科研網站已完成：
1. 專案與文獻證據底座
2. 前沿雷達 × 一鍵靈感 × 選題實驗室
3. 投稿與計畫導航
4. 研究藍圖與研究規劃
5. 文獻深化與 Gap／新穎性驗證
6. 理論與機制
7. 研究設計與分析計畫
8. 三路線研究與計畫工作室

本階段請新增：
# 路線審查、合規準備與研究倫理
Route Review, Compliance Preparation & Research Ethics

本階段核心任務：
1. 對三大研究目標進行路線專屬的專業審查。
2. 重新確認當年度官方規則與資格條件。
3. 建立缺失清單、修訂任務與合規矩陣。
4. 建立共用 Research Ethics / IRB 規劃中心。
5. 建立計畫與期刊的「送件前準備基線」。
6. 保存審查、規則、倫理與待辦快照。
7. 完成後交接至下一階段「研究工具、量表與 Study Protocol」。

---

## 1. 三大研究目標

全站沿用同一 ResearchGoalRegistry：
- JOURNAL_SCI_SSCI
- NSTC_GENERAL
- MOE_TPR

三者共用研究核心資料，但審查邏輯不同。
不得以同一份 Reviewer Prompt 只換標題。

---

## 2. 與第八階段無縫銜接

先讀取：
- ResearchProject
- GoalContext
- DesignAnalysisPlanningSnapshot
- RouteWorkspaceSnapshot
- Writing Evidence Package
- Journal Research Planning Draft
- NSTC Proposal Draft
- MOE Teaching Practice Proposal Draft
- Budget Planning Records
- Course Research Alignment Matrix
- Project Literature
- Evidence Matrix
- CitationSource
- Zotero bindings
- OfficialRuleSnapshot
- Assist / Lock / Version / Audit Trail
- StageReadiness / StageActionBar
- PROJECT_STATE.md

不得重新要求使用者輸入已存在的：
- 題目
- RQ
- Gap
- 理論
- 方法
- 樣本規劃
- 期刊方向
- 國科會學門
- 教學實踐學門／專案
- 文獻
- 計畫書章節

若既有資料缺失，建立 RequirementIssue，不得以空白覆蓋或自行虛構。

---

## 3. 頁面與首頁流程

Project Navigation 新增：
09 路線審查、合規與研究倫理

頁面 Tabs：
1. 總覽
2. 路線審查
3. 官方規則
4. 合規矩陣
5. 修訂任務
6. 研究倫理／IRB
7. 資料與隱私
8. 申請／投稿準備
9. Evidence
10. 版本與歷程

首頁流程節點顯示：
三路線工作室
→ 路線審查／合規／倫理
→ 工具、量表與 Study Protocol

燈號狀態：
- 灰：NOT_STARTED
- 藍：IN_PROGRESS
- 黃：MISSING / CONDITIONAL / REVALIDATION_REQUIRED
- 紅：BLOCKED / FATAL
- 綠：PLANNING_REVIEW_COMPLETE
- 黃綠：CONDITIONAL_HANDOFF_READY

燈號不得只靠顏色，必須同時有文字與圖示。

---

## 4. 全站共用操作規格

每個欄位：
- 老麥一鍵協助
- 查證
- 查看來源
- 鎖定
- 查看版本

每個區塊：
- 老麥補全本區
- 優化未鎖定內容
- 一致性檢查
- Reviewer 檢查
- 鎖定本區

整個階段：
- 老麥一鍵完成可處理審查
- 老麥一鍵補足可處理缺項
- 老麥一鍵建立修訂清單
- 補全並鎖定規劃草稿
- 重新驗證官方規則

支援：
- FILL_EMPTY
- IMPROVE_UNLOCKED
- FILL_AND_LOCK

所有 AI 回寫都由後端檢查：
- project permission
- research goal
- source version
- base revision
- lock status
- field policy

遲到輸出不得覆蓋已修改或鎖定內容。
AI 自動鎖定 = AUTOMATION_POLICY_LOCKED_DRAFT
不得冒充 HUMAN_APPROVED。

---

## 5. 路線 A：SCI／SSCI 國際期刊審查

建立：
# Journal Scientific & Submission Readiness Review

分兩種模式：

### A1. PRE_STUDY_JOURNAL_REVIEW
適用於尚未完成正式研究。

檢查：
- Target Journal / Journal Family
- Aims & Scope Fit
- Article Type Fit
- Research Gap Fit
- Theory / Mechanism Fit
- Methodological Rigor
- Sample Planning
- Measurement Requirements
- Reporting Guideline Planning
- Ethics Planning
- Data / Code Sharing Planning
- Open Science Planning
- Authorship Planning
- Major Desk-Reject Risks

不得生成假 Results。

### A2. MANUSCRIPT_READINESS_REVIEW
只有存在真實 Manuscript 與正式結果時才啟用。

輸出：
- BEST_FIT_STATUS
- MAJOR_RISK
- REQUIRED_ACTIONS
- JOURNAL_REQUIREMENT_GAPS
- PRE_STUDY_READINESS

內部評分不得宣稱為接受率。

---

## 6. 路線 B：國科會一般研究計畫審查

建立：
# NSTC General Proposal Review

### B1. 學門與科學問題 Reviewer
檢查：
- 是否符合目前選定學門定位
- 科學問題是否清楚
- 重要性
- 創新性
- Gap 是否有證據
- 理論／方法／技術貢獻
- 是否只是一般技術應用
- 國內外研究現況是否充分

### B2. 方法與可行性 Reviewer
檢查：
- Research Design
- Sample Planning
- Measurement Requirements
- Analysis Plan
- Work Packages
- Timeline
- Milestones
- Risk and Alternative Plan
- Equipment / Resources
- Budget Logic

### B3. 主持人與資源 Reviewer
檢查：
- PI Expertise
- Relevant Publications
- Previous Projects
- Preliminary Work
- Team Roles
- Resource Fit
- Expected Outputs
- Budget–Outcome Alignment

不得虛構 PI 論文、計畫或設備。

Reviewer Finding severity：
- FATAL
- MAJOR
- MINOR
- SUGGESTION

全部標示：
SIMULATED_REVIEW
NOT_OFFICIAL_NSTC_REVIEW

---

## 7. 路線 C：教育部教學實踐審查

建立：
# MOE Teaching Practice Review

### C1. 教學問題 Reviewer
檢查：
- 課程是否為真實授課場域
- Teaching Problem 是否具體
- 是否有課堂基線證據
- 問題是否與課程目標一致
- 是否只是教師主觀感覺
- 是否能形成可研究的問題

### C2. 教學介入與學習 Reviewer
檢查：
- Root Cause
- Teaching Intervention
- Learning Mechanism
- Student Learning Outcome
- Assessment
- Course–Research Alignment
- 是否只測滿意度／TAM
- 是否有直接學習成果
- 教學介入與評量是否對得起來

### C3. 方法、倫理與可行性 Reviewer
檢查：
- Research Questions
- Design
- Course Schedule
- Sample / Class Structure
- Measurement
- Analysis Plan
- Teacher Workload
- Student Burden
- Teacher–Student Power Relationship
- Research Ethics
- Budget

全部標示：
SIMULATED_REVIEW
NOT_OFFICIAL_MOE_DECISION

---

## 8. 官方規則重驗證

建立或擴充 OfficialRuleSnapshot。

規則類型：
- JOURNAL
- NSTC_GENERAL
- MOE_TPR
- INSTITUTION_INTERNAL

每筆保存：
- authority
- target_year
- document_title
- rule_type
- section
- requirement
- source_url
- retrieved_at
- effective_date
- verification_status
- applies_to
- current_project_status
- required_action

verification_status：
- VERIFIED_CURRENT
- VERIFIED_PREVIOUS_YEAR
- PENDING_NEW_ANNOUNCEMENT
- SOURCE_UNAVAILABLE
- CONFLICTING
- UNVERIFIED

不得：
- 把來源讀取失敗解釋為未公告
- 把舊年度規則冒充本年度規則
- 把其他學校校內期限當成使用者校內期限
- 虛構頁數、費用、截止日、學門代碼、索引或 APC

---

## 9. 共用 Compliance Matrix

建立 ComplianceItem：

- compliance_id
- project_id
- route
- target_year
- authority
- requirement
- source_snapshot_id
- status
- evidence
- missing_item
- required_action
- severity
- due_phase
- blocks_action
- owner
- verified_at

status：
- MET
- PARTIAL
- MISSING
- NOT_APPLICABLE
- UNKNOWN
- AWAITING_OFFICIAL_RULE
- UNVERIFIED

severity：
- FATAL
- MAJOR
- MINOR

區分：
1. CURRENT_STAGE_REQUIRED
2. LATER_STAGE_REQUIRED
3. SUBMISSION_ONLY
4. EXECUTION_ONLY

不得把晚期 IRB 核准、正式結果、作者簽署等要求，
錯誤設成現在撰寫草稿的阻塞條件。

---

## 10. 缺失導航

每一個 RequirementIssue 必須顯示：
- 缺什麼
- 為什麼需要
- 影響哪個動作
- 需要哪種真實資料
- 老麥可以協助什麼
- 去哪裡補

導航必須精確到：
- project
- route
- workspace
- tab
- section
- field / entity

補完提供：
[保存並返回路線審查／合規／倫理]

返回後由後端重新驗證，
不能只因使用者點過連結就解除缺失。

---

## 11. 共用 Research Ethics & IRB Center

本階段建立全站唯一：
# Research Ethics & IRB Center

先做 Ethics Scope Screening，檢查：
- 是否涉及人體參與者
- 是否涉及學生／員工／從屬關係
- 是否涉及未成年人
- 是否涉及健康／心理資料
- 是否錄音／錄影
- 是否 Eye Tracking / EDA / EEG / HRV / Wearable
- 是否位置／行為追蹤
- 是否第三方 AI / Cloud
- 是否學習平台紀錄
- 是否 Secondary Data
- 是否公共資料
- 是否敏感個資
- 是否跨境資料
- 是否酬勞／加分
- 是否可能不良事件

Scope 結果只能是：
- REVIEW_LIKELY_REQUIRED
- EXEMPTION_MAY_APPLY
- NON_HUMAN_RESEARCH
- SECONDARY_DATA_REVIEW_REQUIRED
- INSTITUTIONAL_CONFIRMATION_REQUIRED
- INSUFFICIENT_INFORMATION

網站不得自行宣告正式 Exempt 或 Approved。

---

## 12. Institutional Ethics Decision

建立 InstitutionalEthicsDecision：

- institution
- decision_type
- application_number
- approval_number
- decision_date
- expiry_date
- protocol_version
- approved_documents
- conditions
- file_reference
- verified_by_user
- status

只有真實文件或使用者明確確認，
才能標示：
SUBMITTED
APPROVED
EXEMPT_CONFIRMED

缺少文件時不得生成假的 IRB number。

---

## 13. 教師與學生權力關係專屬檢查

若研究包含主持人本人授課學生，自動檢查：
- 參與研究是否完全自願
- 不參與是否不影響成績
- 是否提供等值學習活動
- 課程與研究參與是否分開
- 研究資料與正式成績是否分離
- 教師是否在適當時點前看不到拒絕名單
- 招募是否可由非授課人員協助
- 是否需要去識別化後才交給授課教師
- 錄影／AI／平台紀錄是否揭露
- 退出流程

若未處理：
TEACHER_STUDENT_POWER_RISK

可設 MAJOR 或 FATAL。

---

## 14. Ethics Risk Register

建立 EthicsRiskItem：

至少包含：
- Physical
- Psychological
- Privacy
- Data Security
- Social
- Academic
- Employment
- Teacher–Student Power
- Undue Influence
- Re-identification
- Algorithmic Bias
- AI Misclassification
- Third-party Platform
- Cross-border Data
- Adverse Event

每項：
- likelihood
- severity
- affected_population
- mitigation
- monitoring
- owner
- residual_risk
- status

---

## 15. Data Management Plan

建立共用 Research Data Management Plan：

- data_types
- data_sources
- identifiers
- de_identification
- coding_key_location
- access_control
- encryption
- storage
- backup
- transfer
- third_party_services
- retention
- destruction
- sharing
- repository
- sensitive_restrictions
- responsible_person

必須與：
Research Design
Measurement Requirements
Analysis Plan

一致。

---

## 16. Preregistration / Open Science Planning

適用時建立 PreregistrationPlan：

- applicable
- registration_type
- platform_candidate
- primary_outcome
- secondary_outcome
- hypotheses
- sample_plan
- exclusion_rules
- stopping_rule
- missing_strategy
- outlier_strategy
- main_analysis
- exploratory_analysis
- status

status：
- NOT_STARTED
- NOT_APPLICABLE
- PLANNED
- DRAFT_READY
- REGISTERED
- AMENDED

只有存在真實 registration URL / ID 時，
才能標記 REGISTERED。

內部 Analysis Plan Lock 不等於正式 preregistration。

---

## 17. 修訂任務系統

每個 ReviewerFinding 或 ComplianceIssue 可轉成 RevisionTask：

- task_id
- source_finding_id
- affected_workspace
- section
- field
- severity
- required_action
- owner
- due_phase
- status
- before_version
- after_version
- resolution_note

status：
- OPEN
- IN_PROGRESS
- RESOLVED
- ACCEPTED_RISK
- NOT_APPLICABLE

不得直接覆蓋已鎖定內容。

---

## 18. Reviewer 建議與作者控制

老麥可提供：
- Suggested Revision
- Suggested Rewrite
- Evidence Needed
- Source Search Task
- Alternative Strategy

但 Suggested Rewrite 不得直接覆蓋核准內容。

如可能改變科學意義：
SCIENTIFIC_MEANING_CHANGE_REVIEW_REQUIRED

---

## 19. 文獻與 Evidence 串接

Reviewer 提出：
- Gap evidence 不足
- Theory source 不足
- Method evidence 不足
- 遺漏重要反證

建立 LiteratureReinforcementTask

導向既有：
文獻與證據中心
→ Consensus及其他已接 API
→ Evidence Verification
→ CitationSource
→ Zotero
→ 返回本 Findings

不得在 Reviewer 頁建立第二套文獻庫。

---

## 20. 三路線合規輸出

### JOURNAL
輸出：
- Journal Readiness Review
- Scope / Method / Reporting Gaps
- Ethics Planning Status
- Open Science Planning
- Major Pre-study Risks

### NSTC_GENERAL
輸出：
- Simulated Reviewer Report
- Official Compliance Matrix
- Missing Materials
- Proposal Revision Tasks
- Application Preparation Baseline

### MOE_TPR
輸出：
- Eligibility / Course Evidence Check
- Simulated Reviewer Report
- Course–Research Compliance
- Ethics / Student Rights Review
- Proposal Revision Tasks
- Application Preparation Baseline

---

## 21. 本階段完成 ≠ 正式送件

本階段完成的是：
- Review baseline
- Compliance baseline
- Ethics planning baseline
- Revision status
- Route readiness

不得自動顯示：
SUBMITTED
UNDER_REVIEW
APPROVED
ACCEPTED

除非存在真實紀錄。

---

## 22. 首頁下一步

狀態完整：

【完成路線審查與倫理準備，前進「研究工具、量表與 Study Protocol」→】

條件式完成：

【保存條件式審查並前進下一階段→】

有 CURRENT_STAGE_REQUIRED 缺失：

【尚缺 N 項，前往補足】
【老麥一鍵補全】

有 FATAL：

【查看阻擋問題並修正】

若下一模組未建：

【保存交接並查看下一階段準備】

---

## 23. Stage Gates

### ROUTE_REVIEW_BASELINE_COMPLETE

條件：
- 主要 Route Reviewer 完成
- Findings 已分類
- 目前階段缺失已建立
- 官方規則狀態清楚
- 不要求所有 Late-stage item 完成

### ETHICS_SCOPE_AND_DATA_PLAN_COMPLETE

條件：
- Ethics Scope完成
- Ethics Risks已建立
- Data Management Plan有基線
- 需要機構確認者明確標示
- 不冒充正式核准

### STAGE09_HANDOFF_READY

條件：
- RouteReviewSnapshot
- ComplianceSnapshot
- EthicsPlanningSnapshot
- RevisionTaskSummary
- Evidence links
- Late-stage requirements
- Lock manifest
- source manifest
- next-stage needs

均已保存。

---

## 24. 第十階段交接

建立 Stage09HandoffSnapshot，至少包含：

- project_id
- goal_context
- selected_route
- selected_journal / discipline
- proposal / planning draft references
- reviewer findings
- resolved findings
- unresolved findings
- official rule snapshots
- compliance matrix
- ethics scope
- ethics risks
- institutional decision status
- data management plan
- preregistration plan
- measurement / instrument needs
- protocol needs
- blocking issues
- later-stage issues
- evidence links
- citation links
- zotero refs
- locks
- versions
- source manifest

下一階段 consumer contract：

# 新版第十階段
研究工具、量表與 Study Protocol

若第十階段尚未建置，
提供真實接收頁，不跳空白頁。

---

## 25. 本階段不要做

不得提前建立：
- 完整量表題項
- 正式問卷完整版
- Pilot
- 正式招募
- 正式 Data Collection
- Statistical Analysis Execution
- 真實 Results
- Final Journal Manuscript
- 正式投稿
- Reviewer Response

可以建立：
- instrument requirements
- ethics draft needs
- protocol requirements
- planning checklists

但必須標示為規劃。

---

## 26. 資料模型

依現有 ORM 增量建立或擴充：

- RouteReviewRun
- ReviewerRole
- ReviewerFinding
- ReviewAdjudication
- OfficialRuleSnapshot
- ComplianceItem
- RequirementIssue
- RevisionTask
- EthicsScopeAssessment
- EthicsScopeItem
- EthicsRiskItem
- InstitutionalEthicsDecision
- DataManagementPlan
- PreregistrationPlan
- LiteratureReinforcementTask
- RouteReadinessAssessment
- RouteReviewSnapshot
- ComplianceSnapshot
- EthicsPlanningSnapshot
- Stage09HandoffSnapshot

不得複製：
- ResearchProject
- ResearchQuestion
- ResearchDesign
- AnalysisPlan
- ProposalDraft
- LiteratureItem
- EvidenceItem
- CitationSource
- ZoteroItem

全部透過既有 ID 關聯。

---

## 27. Lock / Version / Audit

所有：
- Reviewer Finding
- Revision
- Compliance
- Ethics
- Data Plan

均需版本化。

若上游：
- Topic
- Gap
- Theory
- Design
- Route
- Target Year
- Target Journal
- Discipline

重大變更，受影響項目標示：

OUTDATED
REVALIDATION_REQUIRED

不得靜默沿用舊審查。

---

## 28. E2E 驗收重點

至少測試：

1. 第八階段交接可直接進第九階段。
2. 三條目標使用不同 Reviewer 邏輯。
3. MOE 缺主授課程資料時顯示 UNKNOWN，不假裝 FAIL/PASS。
4. Reviewer Finding 可直達原章節修訂。
5. Evidence 缺失可跳文獻中心並返回。
6. Official Rule source 失敗不等於未公告。
7. 舊年度規則不冒充新年度規則。
8. 教師學生風險能被自動識別。
9. IRB 未有文件時不得標 APPROVED。
10. Preregistration 沒URL不得標 REGISTERED。
11. AI 補全不能覆蓋鎖定內容。
12. 修訂後原版本可回溯。
13. Late-stage requirement 不阻擋目前規劃完成。
14. FATAL current-stage issue 阻擋前進。
15. 三路線可共存但不混進度。
16. 下一模組未建時不跳空白頁。
17. 刷新／重啟後審查與待辦仍存在。
18. 重複點擊不重複建立 ReviewRun。
19. LIVE／MOCK／NOT_RUN 狀態分開。
20. Stage09HandoffSnapshot可被下一階段 consumer test 驗證。

---

## 29. 分批實作

### Batch A
承接第八階段、頁面與資料骨架。

### Batch B
三路線 Reviewer、Official Rules、Compliance。

### Batch C
Ethics／IRB、Data Management、Preregistration、Revision Tasks。

### Batch D
Stage Gates、首頁燈號、缺失導航、handoff、E2E與rollback。

---

## 30. 完成後回報

完成後請回報：

1. 修改與新增檔案
2. Database Migration
3. Models
4. API Routes
5. Review Board
6. 三路線 Reviewer
7. OfficialRuleSnapshot
8. Compliance Matrix
9. RequirementIssue / RevisionTask
10. Research Ethics Center
11. Ethics Scope / Risk
12. Institutional Decision
13. Data Management Plan
14. Preregistration
15. Literature Reinforcement
16. Assist / Lock coverage
17. Stage Gates
18. Stage09HandoffSnapshot
19. Consumer Contract Tests
20. 真實 E2E 結果
21. LIVE / MOCK / BLOCKED 狀態
22. Known Issues
23. Rollback

更新 PROJECT_STATE.md。

完成新版第九階段後停止，不自行開始第十階段。
