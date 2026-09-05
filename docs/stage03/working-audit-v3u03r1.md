# V3-U03-R1 開工盤點對照（2026-09-06 初版，依 spec-v3-3.2.0）

## 規格基準
- docs/stage03/spec-v3-3.2.0.md（85,209 bytes，唯一基準）
- 批次：A 盤點/共用 API/真實來源 → B 附件補強 → C 三路線導航 → D 驗收 80 項（乙 48 + 丙 32）

## 既有可重用元件（盤點結果）
| 需求 | 既有實作 | 缺口（初判） |
|---|---|---|
| Stage 共用操作層 | stage-operation route+repo（readiness/issue/lock/completion snapshot）、field-assist/policy、generic-stage-adapter、StageActionBar/RequirementIssuePanel | 需擴充 SubmissionNavigation stage adapter 與 snapshot 型別 |
| TopicSelectionSnapshot 交接 | topic-lab → scs_*（stage_completion_snapshots, migration 0034） | 已有；下游導航入口需接續 |
| 投稿導航前身 | SubmissionNavigatorStudio（navigator 分支）、migration 0009/0010（runs/journal_candidates/funding_routes/compliance/evidence/rule_snapshots/journal_details/marks）、SubmissionNavigator v1/v2 lib | 為 v2-alpha 世代契約，非 Stage-02 共用層；需判定重用或對接（不機械建第二套同名） |
| 期刊投稿工作室 | JournalSubmissionStudio + journal-submission（需求規則/cover letter/analysis） | 屬 M04 稿件後段；與「選題後前瞻布局」分離 |
| 一鍵靈感 | OneClickInspiration + one-click-inspiration lib | 需最小輸入＋四區輸出＋移除獨立「沒有靈感」大表單 |
| 雷達 | TopicLabFrontierRadar(radar view) + research-opportunity-radar lib | 需 HOT/EMERGING/CROSS_DOMAIN 三分類＋多標籤＋去重 |
| 選題/驗證 | topic-lab libs、TopicValidation、gap-novelty | 已正確，不重建 |
| Consensus adapter | topic-lab-source-provider.ts:194 已有（api.consensus.app/v1/search + citation_count + doi） | 端點 vs quick_search 差異待 contract test；僅 topic-lab 用途 |
| Ai4Scholar | 僅 v2-alpha catalog 提及，未見正式 adapter | 需確認 key/契約 |
| 其他文獻來源 | topic-lab-scholarly-adapters、source-verifier、zotero 既有 | 需能力矩陣化（documented/configured/contract_tested/live_verified…） |
| AgentJob | agent_jobs/agent_job_events（0031） | 可承接 quick/deep/revalidation/daily job |
| 每日推薦 | 未見 DailyDigest/schedule | 全新；需授權＋budget＋Asia/Taipei 排程 |
| 研究 Profile 六主軸 | USER.md 領域六軸（AI×教育/職安/環工/能源/XR…）＋ProfileDisplayNameForm | Profile 版本化＋能源關鍵詞 query 化待建 |
| 國科會/教學實踐規則 | 未見 OfficialRuleSnapshot 對應 NSTC/MOE TPR namespace | 全新（S1/S2 官方查證） |
| 首頁/導覽 | GuidedResearchCenter + V3-HOME-02 | 回歸基線 |

## 重要約束（自 spec）
- 不退回重建全站；不重做已正確 Stage 02；舊資料/鎖定題目不自動改寫。
- Profile 新預設只套新 run；既有鎖定專案需先顯示差異由使用者選擇。
- Consensus/Ai4Scholar 共用帳號計費池 → Quota Ledger 以 billing pool 計；不自動開超額付費。
- 所有欄位接 FieldAssist/Lock/深鏈；AI 不得偽造 DOI/費用/年度資格/來源數據。
- 完成後停在本階段（Navigation Handoff），不自動進第四階段。
- 正式 migration/部署/破壞性修改/新費用需另行授權。
