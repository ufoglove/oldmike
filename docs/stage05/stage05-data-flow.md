# V3-U05-FULL 第五階段資料流向說明 (Stage 05 Data Flow)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

```text
[Stage 4: BlueprintPlanningSnapshot + EvidenceNeeds]
             │
             ▼ (POST /api/projects/:id/gap-novelty/initialize)
[Stage 5: GapReviewWorkspace (工作草稿狀態)]
    ├─ 1. Review Scope 定義 (問題、Population、介入、時間窗口、停止條件)
    ├─ 2. 檢索計畫與 Search Log (寬查詢 + 精確查詢 + 反證查詢，記錄截斷與去重)
    ├─ 3. 共用文獻中心列表與抽取 (StudyFamily: VERSION_OF, 誠實 NOT_REPORTED)
    ├─ 4. Gap Claims 註冊表 (支持文獻 vs 反證文獻，不單靠 FutureWork 宣稱 Gap)
    ├─ 5. 最相近研究矩陣 (ClosestStudy: DIRECT_COMPETITOR, 方法與限制)
    ├─ 6. Contribution Delta (實質差異分析，阻擋 superficial technology-piling)
    ├─ 7. 三目標專屬評估 (JOURNAL 國際差異 / NSTC 科學創新 / MOE_TPR 課堂介入)
    ├─ 8. 欄位保護與鎖 (isLocked, MANUAL, AUTOMATION_POLICY 待審)
    └─ 9. 邏輯檢查器 (runGapNoveltyLogicCheck: 檢測漏失反證、表面技術堆疊)
             │
             ▼ (POST /api/projects/:id/gap-novelty/complete)
[Stage 5: GapEvidenceSnapshot (不可變基線)]
    ├─ reviewDecision: "RETAIN_DIRECTION" | "REFINE_WITH_ACCEPTED_CHANGES" | ...
    ├─ candidateTheories & competingExplanationHints (交由 Stage 6 理論機制承接)
    ├─ downstreamRequirements (duePhase: BEFORE_STUDY_START, 非阻礙)
    └─ 原子寫入 stage_completion_snapshots (stageId: "gap-novelty", nextStageId: "theory-mechanism")
             │
             ▼
[Stage 6: 理論與機制 (Theory & Mechanism)]
```

## 關鍵保障原則

1. **零重複輸入**：直接自 Stage 4 讀取題目、RQ、EvidenceNeed 與既有文獻引用。
2. **反證主動檢索**：要求包含反證檢索任務，嚴禁為提高新穎性評分而隱匿反向效果。
3. **區分閱讀覆蓋**：只有摘要不得標為全文已讀；未報告數值標記 `NOT_REPORTED`。
4. **非循環 Gate**：不要求完整理論模型、Power 計算或 IRB 核准先行完成。
