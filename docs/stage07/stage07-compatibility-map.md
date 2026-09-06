# V3-U07-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §27) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `TheoryMechanismSnapshot` | `lib/theory-mechanism-v3-contract.ts` | 第七階段唯一輸入來源，零重複輸入 | 直接承接 `measurementDirections`, `comparisonNeeds`, `temporalNeeds` | 新增 `literatureIds`, `evidenceIds`, `citationSourceIds` 承接 | PASS (T01) |
| `DesignBrief` | `lib/study-design-planning-contract.ts` | 彙整核心 RQ、推論目標與可用資源邊界 | 承接 `TheoryMechanismSnapshot.scope` 與 `overallPurpose` | 建立 typed interface，保留資源限制 | PASS (T01, T14) |
| `DesignCandidate` / `DesignSelectionDecision` | `lib/study-design-planning-contract.ts` | 多方案研究設計（RCT、準實驗、質性、技術基準） | 支援選定、備選與拒選，提供理由與邊界 | 支援質性/技術/探索性設計，不強制 H1 | PASS (T09) |
| `InferenceTarget` | `lib/study-design-planning-contract.ts` | 明確推論目標、比較結構、最小有意義差異 | 連接特定 RQ 與命題 (H1/P1) | 清楚定義 estimand，不將預測當成因果 | PASS (T12, T25) |
| `StudyStructure` | `lib/study-design-planning-contract.ts` | 嚴格區分抽樣、分配、觀察與分析單位 | 提供 StudyArm 與 StudyTimePoint 結構 | 班級/群集混淆時觸發邏輯檢查，不混淆單一 N | PASS (T10, T11) |
| `SampleJustification` | `lib/study-design-planning-contract.ts` | 樣本規模理據（Power、精確度、可偵測效果量等） | 結合可偵測效果情境計算與流失率調整 | 缺文獻時標記 `ASSUMPTION_BASED`，不編造已招募 N | PASS (T18, T24) |
| `PlanningCalculationRecord` | `lib/planning-calculation-engine.ts` | 真實受控樣本與檢定力計算引擎 (v1.0.0) | 嚴格基於 Cohen (1988) / Lakens (2022) 公式運算 | 支援獨立雙樣本 t-test、檢定力、可偵測效果與流失調整 | PASS (T17, T20, T21) |
| `DesignMeasurementRequirement` | `lib/study-design-planning-contract.ts` | 定義測量指標、資料尺度與時程，不偽造量表 | 對齊理論構念與觀察方向 | 教學問題為技能卻只測滿意度時觸發警告 | PASS (T15, T28) |
| `RqDesignDataAnalysisRow` | `lib/study-design-planning-contract.ts` | 核心 RQ—設計—資料—分析矩陣可追溯列 | 連接 RQ、構念、時點、分析方法與偏誤控制 | 可逐列定位編輯與鎖定，非僅純 Markdown 表格 | PASS (T25, T33) |
| `AnalysisPlanItem` | `lib/study-design-planning-contract.ts` | 分析實驗室 Planning Mode，事前分析計畫規劃 | 區分 Primary/Secondary/Exploratory，缺失值與多重比較 | 僅產出 recipe/skeleton，不執行正式資料 | PASS (T26, T27) |
| `DesignValidityRisk` | `lib/study-design-planning-contract.ts` | 偏誤與效度風險防範（霍桑效應、資料洩漏等） | 連接第六階段競爭解釋與邊界條件 | 支援敏感度分析規劃與設計防範措施 | PASS (T27) |
| 三目標設計論述 (`Journal/Nstc/MoeTpr`) | `lib/study-design-planning-contract.ts` | 期刊、國科會一般計畫與教學實踐專案客製 | 依 `primaryGoal` 自動注入專屬研究論述 | 各目標具備專屬檢驗規則，無模板不回退 | PASS (T05, T06) |
| 邏輯檢查器 (`runStudyDesignLogicCheck`) | `lib/study-design-planning-service.ts` | 檢查設計、分析、時點與樣本矛盾 | 輸出結構化 `DesignLogicFinding` | 精確檢測班級混淆、延宕時點遺失與滿意度不匹配 | PASS (T11, T13, T15) |
| `DesignAnalysisPlanningSnapshot` | `lib/study-design-planning-contract.ts` | 第七至第八階段不可變交接快照 | 傳遞至 Stage 8 (`route-studio`)，帶入路線意圖 | 包含版本、計算限制、晚期待辦與 SHA-256 checksum | PASS (T45, T47) |
