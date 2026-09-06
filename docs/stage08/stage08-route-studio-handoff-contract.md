# V3-U08-FULL 第八至第九階段交接契約 (Route Studios Handoff Contract)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`RouteWorkspaceSnapshot`)

```typescript
export interface RouteWorkspaceSnapshot {
  snapshotId: string;                              // e.g. rws_proj_stage8_eval_1757144000
  schemaVersion: "route-studio/1.0.0";            // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "route-studio";
  nextStageId: "ethics-review";                    // 指向第九階段：路線審查、合規準備與研究倫理
  sourceDesignSnapshotId: string;
  sourceTheorySnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  studioRevision: number;
  decision: string;                                // e.g. ADOPT_PLAN_OR_DRAFT
  decisionRationale: string;

  // 核心範圍與選定工作室
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    activeStudio: StudioKind;
  };

  // 關聯與參照識別
  rqRefs: string[];
  sectionRefs: string[];
  workPackageRefs: string[];
  budgetItemRefs: string[];
  citationSourceRefs: string[];

  // 預算規劃彙整 (非 AI 虛構)
  grandTotalBudget: number;
  budgetCalculationStatus: string;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // 第九階段分流動作意圖 (Next Actions for Stage 9 Routing)
  nextActions: {
    isJournalPreCheckNeeded: boolean;
    isNstcReviewNeeded: boolean;
    isMoeTprReviewNeeded: boolean;
    isEthicsFilingRequired: boolean;
  };

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第九階段消費者契約保證 (Consumer Contract Guarantees)

1. **精準分流審查**：第九階段（`ethics-review`）根據 `nextActions` 進行差異化審查配置：
   - 期刊路線：導向研究前科學檢查、Reporting Guideline 與資料庫共享規範。
   - 國科會路線：導向學門專案審查、校內申請期限與特定倫理送審文件時程。
   - 教育部教學實踐路線：導向課程教師資格複核、學生知情同意與成績權力關係防護。
2. **預算與事實不變形**：所有引用之預算總額（`grandTotalBudget`）與樣本規模嚴格保留受控計算來源，第九階段審查預算合理性時具備唯一真實依據。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/route-studio/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
