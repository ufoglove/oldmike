# V3-U04-FULL 第四階段資料流向說明 (Stage 04 Data Flow)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

```text
[Stage 2: TopicSelectionSnapshot]
             │
             ▼
[Stage 3: SubmissionNavigationSnapshot] ──────┐
             │ (POST /api/projects/:id/blueprint/initialize)
             ▼
[Stage 4: BlueprintWorkspace (工作草稿狀態)]
    ├─ 1. Objective - RQ - Evidence 矩陣 (穩定 RQ ID, 問題類型, 分析單位, 所需證據)
    ├─ 2. 三目標專屬藍圖 (JOURNAL_SCI_SSCI / NSTC_GENERAL / MOE_TPR)
    ├─ 3. 工作包 DAG 排程 (WP-01 -> WP-02 -> WP-03, 循環依賴檢測)
    ├─ 4. 定向證據需求 (EvidenceNeeds: EN-01, role, keywordGroups, 預算上限)
    ├─ 5. 欄位保護與鎖 (FieldEnvelope: isLocked, lockPolicy, AUTOMATION_POLICY)
    └─ 6. 邏輯檢查器 (runBlueprintLogicCheck: FATAL / MAJOR_WARNING)
             │
             ▼ (POST /api/projects/:id/blueprint/complete)
[Stage 4: BlueprintPlanningSnapshot (不可變基線)]
    ├─ planningStatus: "BASELINED" | "BASELINED_PROVISIONAL"
    ├─ evidenceNeedRefs: ["EN-01", ...] (交由 Stage 5 承接)
    ├─ downstreamRequirements: (due_phase: BEFORE_STUDY_START / RESEARCH_DESIGN, 非阻礙)
    └─ 原子寫入 stage_completion_snapshots (stageId: "blueprint", nextStageId: "gap-novelty")
             │
             ▼
[Stage 5: 文獻深化與Gap／新穎性驗證 (使用既有文獻與證據中心)]
```

## 關鍵保障原則

1. **零重複輸入**：直接自 Stage 3 快照讀取主題、題目、RQ、文獻 ID、資格限制與官方規則。
2. **時間身分誠實**：事前規劃皆標記 `PROPOSED_BEFORE_STUDY`，禁止偽造實驗結果或事後反推假設。
3. **定向證據交接**：藍圖識別出的文獻缺口包裝為 `EvidenceNeed`，直接交接至 Stage 5，不自造平行搜尋引擎。
4. **非循環 Gate**：IRB 送審與樣本數 Power 計算標記 `due_phase="BEFORE_STUDY_START"` 或 `"RESEARCH_DESIGN"`，不阻礙第四階段藍圖基線完成。
