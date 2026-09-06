# V3-U04-FULL 欄位協作與鎖定覆蓋表 (Field Assist & Lock Coverage)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、全欄位 Envelope 盤點與 Assist 動作矩陣

| 區塊與欄位 Ref | 欄位性質 | 老麥協作能力 | 鎖定與限制保護 | 來源與時間狀態 |
|---|---|---|---|---|
| `researchIdentity.workingTitleZh` | `GENERATED_DRAFT` | 支援 `FILL_EMPTY`、`IMPROVE_UNLOCKED`、`FILL_AND_LOCK`；起草與優化修飾語 | 支援手動鎖定；鎖定後 AI 略過不覆蓋 | 繼承自 `TopicSelectionSnapshot`，`PROPOSED_BEFORE_STUDY` |
| `researchIdentity.workingTitleEn` | `GENERATED_DRAFT` | 英文學術翻譯潤稿起草 | 支援手動鎖定 | 同上 |
| `researchIdentity.sourceTopicTitle` | `PROTECTED_RESULT` | 唯讀引用，不得直接改寫 | 強制唯讀，無鎖定操作 | `ORIGINAL_TOPIC` |
| `coreProblemAndScope.problemStatement` | `GENERATED_DRAFT` | 老麥補充情境急迫性與產業現況 | 支援鎖定；鎖定後只存候選 | `PROPOSED_BEFORE_STUDY` |
| `coreProblemAndScope.inScopeAndOutScope` | `GENERATED_DRAFT` | 劃定研究邊界與非目標情境 | 支援鎖定 | 同上 |
| `gapAndNoveltyClues.preliminaryGapStatement` | `GENERATED_DRAFT` | 梳理初步缺口線索 | 支援鎖定 | `UNVERIFIED`，不得冒充正式 Gap 成立 |
| `purposeAndObjectives.overallPurpose` | `GENERATED_DRAFT` | 綜整總研究目的 | 支援鎖定 | 同上 |
| `researchQuestionsMatrix[].questionText` | `GENERATED_DRAFT` | 老麥協作細化 RQ，標明分析單位與類型 | 支援個別 RQ 鎖定 | `PROPOSED_BEFORE_STUDY` |
| `researchQuestionsMatrix[].objectiveId` | `COMPUTED_FACT` | 下拉映射，後端檢查對應性 | 必選合法 Objective | `OBJ-01` / `OBJ-02` |
| `journalBlueprint.dataAndResultsRequirements.evidenceNeededPerSection.Results` | `PROTECTED_RESULT` | 僅規劃資料收集方向，嚴禁生成數值 | 強制鎖定為事前規劃文字 | `PROPOSED_BEFORE_STUDY`，禁止編造 |
| `nstcBlueprint.projectDuration.durationOption` | `USER_FACT` | 方案比選 (1/2/3 年)，多年期需補論述 | 不預設 3 年 | 使用者授權決策 |
| `moeTprBlueprint.courseIdentity.courseInfoStatus` | `USER_FACT` | 無 CourseProfile 時保持 `UNKNOWN` | 嚴禁 AI 擅自填入及格或通過 | `UNKNOWN` / `USER_PROVIDED` |
| `downstreamRequirements[].status` | `APPROVAL_OR_ATTESTATION` | 列明 `due_phase`，指引本人確認 | 嚴禁 AI 代簽代核准 | `PENDING` / `DEFERRED` |

## 二、批次執行模式說明

1. `FILL_EMPTY`（預設）：僅為未填寫內容之欄位注入結構化草稿，保留既有欄位與鎖定內容。
2. `IMPROVE_UNLOCKED`：針對未加鎖欄位進行一致性優化；已加鎖欄位一律跳過。
3. `FILL_AND_LOCK`：完成草稿後加上 `AUTOMATION_POLICY` 鎖，標記 `reviewState: "HUMAN_REVIEW_PENDING"`，不冒充人工核准。
