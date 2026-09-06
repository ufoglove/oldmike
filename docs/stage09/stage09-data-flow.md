# V3-U09-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 08 -> Stage 09 -> Stage 10)

```text
[Stage 08: 三路線研究與計畫工作室]
  RouteWorkspaceSnapshot (不可變快照，含初稿、工作包、受控預算紀錄與 nextActions 分流意圖)
         │
         ▼
[Stage 09: 路線審查、合規準備與研究倫理 (Route Review & Ethics Center)]
  1. Intake & Routing (承接快照，零重複輸入，依 primary_goal 啟用專屬審查邏輯)
  2. Tri-Route Simulated Review:
     ├─ SCI/SSCI: PRE_STUDY_JOURNAL_REVIEW (Aims & Scope, Reporting Guideline, 絕不造假 Results)
     ├─ NSTC General: 學門與科學問題、方法可行性、主持人與資源合理性審查
     └─ MOE TPR: 教學現場痛點、學習成效對齊 (Rubrics)、師生權力關係防護審查
  3. Official Rules & Compliance Matrix (更新官方作業要點，區分 CURRENT_STAGE vs LATER_STAGE)
  4. Shared Research Ethics & IRB Center:
     ├─ Ethics Scope Screening (15 類指標，識別穿戴式 VR 與眼動生理日誌)
     ├─ Institutional Ethics Decision (無真實文件嚴禁編造假 IRB 案號)
     └─ Teacher-Student Power Risk (知情同意獨立收集、學期成績封存與替代學習方案)
  5. Data Management Plan (DMP) & Preregistration:
     ├─ DMP: 去識別化、TLS 1.3 傳輸、第三方 AI 限制與五年銷毀機制
     └─ Preregistration: 標記 DRAFT_READY，無真實網址嚴禁標為 REGISTERED
  6. Revision Tasks Workflow (將未解決之 Reviewer Finding 轉為指派任務，導航修正)
         │
         ▼
  Stage09HandoffSnapshot (不可變交接快照，含審查結論、合規率、倫理範疇與 Stage 10 工具清單)
         │
         ▼
[Stage 10: 研究工具、量表與 Study Protocol (study-protocol)]
  ├─ 客觀行為日誌與眼動記錄協議
  ├─ 專業技能評量規準 (Rubrics)
  └─ 雙組隨機對照試驗標準作業程序 (Study Protocol / SOP)
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/route-review/initialize`
   - 驗證 `RouteWorkspaceSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `RouteReviewWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/route-review/complete`
   - 執行 `runRouteReviewLogicCheck`（阻擋 `FATAL_REVIEWER_FINDING_UNRESOLVED`、`TEACHER_STUDENT_POWER_RISK_UNMITIGATED`、`FABRICATED_IRB_APPROVAL_PROHIBITED` 等）。
   - 原子寫入 `Stage09HandoffSnapshot`，並將狀態更新為交接至 `study-protocol`。
