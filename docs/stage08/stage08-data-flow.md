# V3-U08-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 07 -> Stage 08 -> Stage 09)

```text
[Stage 07: 研究設計與分析計畫]
  DesignAnalysisPlanningSnapshot (不可變快照，含設計、RQ 矩陣、分析計畫、受控樣本計算與路線意圖)
         │
         ▼
[Stage 08: 三路線研究與計畫工作室 (Route Studios)]
  1. Intake & Route Setup (承接快照，依 primary_goal 啟用主工作室，支援次要期刊規劃，零重複輸入)
  2. Tri-Route Drafting & Structuring:
     ├─ SCI/SSCI: 投稿定位、文獻背景與研究方法草稿、Results 插槽 (NOT_YET_AVAILABLE)
     ├─ NSTC General: 科學背景、研究方法、年度工作包矩陣 (WorkPackageMatrix)
     └─ MOE TPR: 教學痛點、課程評量對照矩陣 (CourseTeachingAssessmentMatrix)
  3. Protected Fact Bindings (綁定受控計算樣本數 N=151 與文獻 CitationSource，防止 AI 任意修改)
  4. Budget Planning Engine (受控程式計算人事、業務、設備與管理費，精準加總與幣別檢查)
  5. Draft Alignment QA (檢測虛構 Results、評量失衡、現場證據缺失等潛在矛盾)
  6. Human Review & Lock (確認初稿基線，鎖定重要段落，保留晚期待辦清單)
         │
         ▼
  RouteWorkspaceSnapshot (不可變交接快照，含章節、工作包、預算、限制與 Stage 9 審查意圖)
         │
         ▼
[Stage 09: 路線審查、合規準備與研究倫理 (ethics-review)]
  ├─ 期刊：研究前科學/期刊規劃檢查、Reporting/Preregistration 適用性、資料治理
  └─ 計畫：專案審查、官方/校內規範與附件、適用倫理送審與知情同意時程
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/route-studio/initialize`
   - 驗證 `DesignAnalysisPlanningSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `RouteWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/route-studio/complete`
   - 執行 `runDraftAlignmentCheck`（阻擋 `FABRICATED_RESULTS_PROHIBITED` 等重大違規）。
   - 原子寫入 `RouteWorkspaceSnapshot`，並將狀態更新為交接至 `ethics-review`。
