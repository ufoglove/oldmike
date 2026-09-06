# V3-U05-FULL 欄位協作與鎖定覆蓋表 (Field Assist & Lock Coverage)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、全欄位 Assist 動作與加鎖覆蓋矩陣

| 區塊與欄位 Ref | 欄位性質 | 老麥協作能力 | 鎖定與限制保護 | 來源與時間狀態 |
|---|---|---|---|---|
| `reviewScope.stoppingCriteriaNotes` | `GENERATED_DRAFT` | 起草檢索收斂條件說明 | 支援手動鎖定；鎖定後 AI 略過不覆蓋 | 依據 `ReviewScope` 派生 |
| `searchTasks[].executedQuery` | `EXTERNAL_FACT` | 依據資料庫語法編譯查詢式 | 鎖定查詢式版本，杜絕非預期自動刷新 | 檢索計畫版本化 |
| `extractions[].reportedValue` | `PROTECTED_RESULT` | 自原文段落抽取數值；若未報告填 `NOT_REPORTED` | 原文抽取值唯讀引用，禁止自由捏造 | 嚴格綁定 `sourceLocation` |
| `gapClaims[].claimText` | `GENERATED_DRAFT` | 老麥協作修訂缺口語句，補足邊界與限制 | 支援個別 Claim 鎖定；鎖定後存候選 | `PROPOSED` / `PARTIALLY_SUPPORTED` |
| `gapClaims[].counterevidenceRefs` | `EXTERNAL_FACT` | 自反證檢索任務中篩選潛在反向文獻 | 鎖定引用清單，嚴禁 AI 自動清空反證 | 來自文獻中心反證檢索結果 |
| `contributionDeltas[].potentialValueRationale` | `GENERATED_DRAFT` | 闡述實質差異價值，阻擋表面技術堆疊 | 支援手動鎖定 | 需具體說明學術或教學不可替代性 |
| `moeTprSynthesis.classroomBaselineNotice` | `USER_FACT` | 課堂基線缺漏標記 `PENDING_BASELINE_TASK` | 嚴禁 AI 填入及格率或學生反饋 | 誠實保留 `UNKNOWN` |
| `overallDecision` | `APPROVAL_OR_ATTESTATION` | 提供研究保留、收斂或重選之建議 | 最終決策由研究者確認或 Policy 授權 | `RETAIN_DIRECTION` 等五大狀態 |

## 二、批次執行模式說明

1. `FILL_EMPTY`（預設）：僅對未分析或未標註之 Claim 填入草稿建議，保留所有已鎖定欄位。
2. `IMPROVE_UNLOCKED`：針對未加鎖之文字陳述進行學術嚴謹度優化（如補足邊界限制）。
3. `FILL_AND_LOCK`：完成草稿後加上 `AUTOMATION_POLICY` 鎖，標記 `reviewState: "HUMAN_REVIEW_PENDING"`，絕不冒充人工核准。
