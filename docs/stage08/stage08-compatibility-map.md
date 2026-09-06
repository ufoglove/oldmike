# V3-U08-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §27) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `DesignAnalysisPlanningSnapshot` | `lib/study-design-planning-contract.ts` | 第八階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `rqRefs`, `planningCalculationRefs`, `routeWorkspaceIntents` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `JournalResearchPlan` / `ManuscriptBlueprint` | `lib/route-studio-contract.ts` | 國際期刊研究規劃、投稿定位與論文骨架 | Methods 標記為計畫預計，Results 保留插槽 (`NOT_YET_AVAILABLE`) | 嚴禁在未收案前虛構顯著性數據 | PASS (T09, T10) |
| `NSTCProposalDraft` / `WorkPackageMatrix` | `lib/route-studio-contract.ts` | 國科會一般研究計畫書科學內容初稿與工作包 | 依據一般研究計畫規格，年限按實際輸入不強制三年 | 團隊與設備未知時保留待補，不偽造履歷 | PASS (T11, T12) |
| `TeachingPracticeProposalDraft` / `CourseAssessmentMatrix` | `lib/route-studio-contract.ts` | 教育部教學實踐研究計畫書初稿與課程評量對照 | 串聯課程問題 $\to$ 現場證據 $\to$ 介入 $\to$ 成果 $\to$ 評量 $\to$ RQ | 技能目標缺乏客觀評量時精確觸發警示 | PASS (T13, T14, T15) |
| `ProtectedFactBinding` | `lib/route-studio-contract.ts` | 受保護結構化事實節點 (`PLANNING_CALC_REF` 等) | 將 Stage 7 計算樣本數與文獻來源綁定為不可變節點 | AI 協作時嚴禁任意竄改數值或單位 | PASS (T21, T30, T32) |
| `SectionDraft` / AST Nodes | `lib/route-studio-contract.ts` | 結構化章節與段落編輯 AST | 支援 GUIDED、CO_WRITE、EVIDENCE_TO_DRAFT 三種寫作模式 | 具備鎖定機制與來源追溯 | PASS (T18, T33, T34) |
| `BudgetPlanningService` (`calculateBudgetPlan`) | `lib/budget-planning-engine.ts` | 受控預算計算引擎 (v1.0.0) | 確定性加總：數量 $\times$ 單價 $\times$ 期間，支援管理費與分類 | 缺失單價保留 null，不同幣別拒絕直接合計 | PASS (T19, T20) |
| `DraftAlignmentReport` (`runDraftAlignmentCheck`) | `lib/route-studio-service.ts` | 草稿一致性與邏輯檢查器 | 檢測虛構 Results (`FABRICATED_RESULTS_PROHIBITED`) 與評量不匹配 | 阻擋 FATAL 錯誤並提供返回修正入口 | PASS (T09, T15) |
| `RouteWorkspaceSnapshot` | `lib/route-studio-contract.ts` | 第八至第九階段不可變交接快照 | 傳遞至 Stage 9 (`ethics-review`)，帶入分流動作意圖 | 包含版本、預算計算狀態、限制與 SHA-256 checksum | PASS (T45, T47) |
