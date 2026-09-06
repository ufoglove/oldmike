# V3-U07-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 06 -> Stage 07 -> Stage 08)

```text
[Stage 06: 理論與機制]
  TheoryMechanismSnapshot (不可變快照，含模型、RQ、構念、觀察方向、對照需求、時點需求)
         │
         ▼
[Stage 07: 研究設計與分析計畫工作區 (StudyDesignStudioView)]
  1. Intake & Brief (承接快照，零重複輸入，產生 DesignBrief 與推論目標 InferenceTarget)
  2. Study Candidates & Architecture (多候選方案比較，決定研究架構：抽樣、分配、觀察與分析單位)
  3. Sample Size Justification & Engine Calculation (受控引擎執行真實檢定力與樣本規劃，標記 SIMULATED_FOR_DESIGN)
  4. Measurement Requirements (定義指標與時程 MeasurementSchedule，對齊構念，不偽造量表)
  5. RQ - Design - Data - Analysis Matrix (建立可追溯矩陣，整合時點、資料尺度與分析方法)
  6. Analysis Lab Planning Mode (規劃主要、次要、探索性分析、缺失值策略與多重比較校正)
  7. Design Alignment Checker (檢測班級混淆、延宕時點遺失、滿意度與技能不對稱等偏誤)
  8. Human Review & Gate (確認規劃基線，鎖定欄位，建立待辦清單)
         │
         ▼
  DesignAnalysisPlanningSnapshot (不可變交接快照，含版本、計算限制、晚期待辦與三路線意圖)
         │
         ▼
[Stage 08: 三路線研究與計畫工作室 (route-studio)]
  ├─ SCI/SSCI 國際期刊研究規劃與稿件骨架
  ├─ 國科會一般研究計畫書工作室
  └─ 教育部教學實踐研究計畫書工作室
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/study-design/initialize`
   - 驗證 `TheoryMechanismSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `StudyDesignWorkspace`。
2. **規劃計算執行**：`POST /api/projects/:projectId/study-design/calculate`
   - 透過 `planning-calculation-engine` 進行嚴格數學運算。
   - 產生具備唯一 ID 之 `PlanningCalculationRecord`，禁止 AI 任意竄改數值。
3. **工作區完成與交接**：`POST /api/projects/:projectId/study-design/complete`
   - 執行 `runStudyDesignLogicCheck`（阻擋 FATAL 錯誤）。
   - 原子寫入 `DesignAnalysisPlanningSnapshot`，並將狀態更新為交接至 `route-studio`。
