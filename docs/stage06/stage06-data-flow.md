# V3-U06-FULL 第六階段資料流向說明 (Stage 06 Data Flow)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

```text
[Stage 5: GapEvidenceSnapshot + candidateTheories + competingExplanationHints]
             │
             ▼ (POST /api/projects/:id/theory-mechanism/initialize)
[Stage 6: TheoryWorkspace (工作草稿狀態)]
    ├─ 1. ModelingBrief 定義 (解釋現象、範圍陳述、分析單位、8種建模取徑)
    ├─ 2. 候選理論池與選擇理由 (PRIMARY_LENS / RIVAL_EXPLANATION)
    ├─ 3. 構念字典 (ConstructDefinition: 概念定義、納排邊界、初步觀察方向)
    ├─ 4. Typed 關係模型 (HYPOTHESIZED_CAUSAL, MEDIATION_CANDIDATE, FEEDBACK)
    ├─ 5. 研究命題與假設 (ResearchStatement: H1 / P1 / GQ1, 包含 Disconfirmation 方向)
    ├─ 6. 競爭解釋與邊界條件 (AlternativeExplanation: 霍桑效應、注意力分散)
    ├─ 7. ModelToDesignRequirement 矩陣 (觀察需求、對照組需求、時點需求)
    ├─ 8. 三目標專屬理論論述 (JOURNAL 定位辯護 / NSTC 科學推導 / MOE_TPR 教學邏輯)
    ├─ 9. 欄位保護與鎖 (isLocked, MANUAL, AUTOMATION_POLICY 待審)
    └─ 10. Alignment 檢查器 (runTheoryMechanismLogicCheck: 檢測懸空引用、DAG循環)
             │
             ▼ (POST /api/projects/:id/theory-mechanism/complete)
[Stage 6: TheoryMechanismSnapshot (不可變基線)]
    ├─ measurementDirections & comparisonNeeds (交由 Stage 7 研究設計承接)
    ├─ downstreamRequirements (duePhase: RESEARCH_DESIGN / BEFORE_STUDY_START, 非阻礙)
    └─ 原子寫入 stage_completion_snapshots (stageId: "theory-mechanism", nextStageId: "study-design")
             │
             ▼
[Stage 7: 研究設計與分析計畫 (Study Design & Analysis Plan)]
```

## 關鍵保障原則

1. **零重複輸入**：直接自 Stage 5 讀取題目、RQ、文獻引用與理論候選提示。
2. **語義資料單一來源**：圖形、關係表、構念字典與矩陣共享同一 model revision，layout 移動不破壞科學語義。
3. **活動不等於機制**：MOE_TPR 教學實踐明確區分「教學活動」與「學習機制」，且評量嚴禁以滿意度代替技能。
4. **非循環 Gate**：Power 檢定力計算、量表完整題項與 IRB 審查屬於後續階段，不阻礙本輪模型基線交付。
