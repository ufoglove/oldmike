# V3-U04-FULL 第四階段相容映射表 (Stage 04 Compatibility Map)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、前三階段契約承接與映射

| 第三階段實體／路由 | 本輪第四階段用途 | 映射模型／實體 | 相容防護機制 |
|---|---|---|---|
| `SubmissionNavigationSnapshot` (`stage_completion_snapshots` where `stageId='navigator'`) | 第四階段初始化唯一輸入來源，零重複輸入 | `BlueprintWorkspace` (`sourceNavigationSnapshotId`) | 唯讀綁定；若快照不存在回傳 `NAVIGATION_HANDOFF_REQUIRED` |
| `SubmissionFingerprintVersion` | 承接研究問題、目的、文獻 ID、資格限制 | `BlueprintWorkspace.researchIdentity` / `coreProblemAndScope` | 保留原值，衍生編輯版標示 `fieldRevision: 1` 與 `origin: "SOURCE_SNAPSHOT"` |
| `OfficialRuleSnapshot` | 國科會與教學實踐官方作業要點與年度規則快照 | `BlueprintWorkspace.ruleSnapshotRefs` | 保留民國年與西元年分離，不因進入第四階段私自認定審查合規 |
| `TopicSelectionSnapshot` | 第二階段採用之核心題目與初步 Gap | `BlueprintWorkspace.sourceTopicSelectionSnapshotId` | 不可變保留，確保完整溯源鏈 |
| `HandoffReceiverView.tsx` | 第三階段交接接收頁 | 升級為 `ResearchBlueprintStudioView.tsx` | 保留原始快照檢視、JSON 匯出與返回導航入口，提供無斷層展開 |

## 二、三目標專業模板差異化映射

| 目標 ID | 專屬模型實體 | 核心規劃欄位 | 禁止與限制行為 |
|---|---|---|---|
| `JOURNAL_SCI_SSCI` | `JournalSpecificBlueprint` | `targetArticleType`, `internationalGapStatement`, `dataAndResultsRequirements` | 嚴禁在概念階段編造 Results 或偽造顯著統計值；樣例文獻追蹤設計標記為品質建議非官方強制法規 (S1) |
| `NSTC_GENERAL` | `NstcSpecificBlueprint` | `disciplineCode`, `scientificQuestionImportance`, `projectDuration` | 不強制預設三年期，多年期需具備連續性問題論述；主持人能力依授權 Profile (S2) |
| `MOE_TPR` | `MoeTprSpecificBlueprint` | `courseIdentity`, `pedagogicalProblemAndContext`, `instructionalIntervention`, `learningOutcomesAndAssessment` | 缺課程資料誠實保留 `UNKNOWN`；基線資料缺漏標記 `PENDING_BASELINE_TASK`，不得偽造學生不及格或滿意度代替成效 (S3) |

## 三、文獻與證據中心連結

- 不另建第二套文獻檢索庫。
- 缺文獻時產生定向 `EvidenceNeed`，附帶 `needId`, `projectId`, `sectionId`, `role` (CORE/GAP/THEORY/METHOD 等), `supportOrCounterevidence` (BOTH_SUPPORT_AND_COUNTER) 與預算上限，送交第五階段文獻中心處理。
- 保留 `literatureIds` 與 `citationSourceIds` 參考，本機引用不因遠端 Zotero 斷線中斷規劃。
