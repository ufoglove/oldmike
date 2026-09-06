# V3-U06-FULL 欄位協作與鎖定覆蓋表 (Field Assist & Lock Coverage)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、全欄位 Assist 動作與加鎖覆蓋矩陣

| 區塊與欄位 Ref | 欄位性質 | 老麥協作能力 | 鎖定與限制保護 | 來源與時間狀態 |
|---|---|---|---|---|
| `modelingBrief.targetScopeExplanation` | `GENERATED_DRAFT` | 起草「本模型解釋...，而不是...」範圍陳述 | 支援手動鎖定；鎖定後 AI 略過不覆蓋 | 依據 `ModelingBrief` 派生 |
| `theoryCandidates[].selectionRationale` | `GENERATED_DRAFT` | 撰寫理論選擇與拒選理由 | 鎖定理由，杜絕非預期自動替換 | 依據理論適配度 |
| `constructs[].conceptualDefinition` | `GENERATED_DRAFT` | 撰寫構念定義與邊界納排說明 | 支援個別構念鎖定；鎖定後存候選 | `PROJECT_PROPOSED_NEW` / `SOURCE_REPORTED` |
| `constructs[].provisionalObservationDirection` | `GENERATED_DRAFT` | 規劃初步觀察方向，嚴禁假造題項信效度 | 鎖定觀察方向 | 導向 Stage 7 設計 |
| `relations[].mechanismRationale` | `GENERATED_DRAFT` | 老麥協作修訂機制詮釋，補充學理推導 | 支援個別關係鎖定 | `EXISTING_THEORY_DERIVATION` / `NEW_PROPOSED_LINK` |
| `statements[].disconfirmationDirection` | `GENERATED_DRAFT` | 明確指出何種觀察將證偽本假設 | 支援手動鎖定，確保具備可否證性 | `PROPOSED_BEFORE_STUDY` |
| `alternativeExplanations[].discriminatingObservation` | `GENERATED_DRAFT` | 規劃如何透過設計區分主解釋與競爭解釋 | 支援手動鎖定 | 杜絕確認偏差 |
| `moeTprRationale.expectedLearningMechanism` | `GENERATED_DRAFT` | 嚴格釐清「教學活動」與「學習機制」之差異 | 支援鎖定 | 教學實踐核心 |

## 二、批次執行模式說明

1. `FILL_EMPTY`（預設）：僅對未填寫機制推導或觀察方向之欄位注入草稿，保留所有已鎖定構念與關係。
2. `IMPROVE_UNLOCKED`：針對未加鎖之關係卡補充競爭機制檢定建議。
3. `FILL_AND_LOCK`：完成草稿後加上 `AUTOMATION_POLICY` 鎖，標記 `reviewState: "HUMAN_REVIEW_PENDING"`，絕不冒充人工核准。
