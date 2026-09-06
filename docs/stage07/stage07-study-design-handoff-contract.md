# V3-U07-FULL 第七至第八階段交接契約 (Study Design & Analysis Planning Handoff Contract)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`DesignAnalysisPlanningSnapshot`)

```typescript
export interface DesignAnalysisPlanningSnapshot {
  snapshotId: string;                              // e.g. daps_proj_stage7_eval_1757142000
  schemaVersion: "study-design-planning/1.0.0";   // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "study-design";
  nextStageId: "route-studio";                     // 指向第八階段：三路線研究與計畫工作室
  sourceTheorySnapshotId: string;
  sourceGapSnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  designRevision: number;
  decision: string;                                // e.g. ADOPT_DESIGN
  decisionRationale: string;

  // 核心範圍與選定設計
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    selectedDesignName: string;
    selectedDesignType: ResearchDesignType;
  };

  // 關聯與參照識別
  rqRefs: string[];
  designCandidateRefs: string[];
  inferenceTargetRefs: string[];
  armRefs: string[];
  timePointRefs: string[];
  measurementRefs: string[];
  matrixRowRefs: string[];
  analysisPlanRefs: string[];

  // 樣本理據與實質計算數據 (非 AI 虛構)
  sampleJustificationRefs: string[];
  planningCalculationRefs: string[];
  recruitmentTargetTotalN: number;
  totalAnalyzableN: number;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // 第八階段路線工作室意圖 (Route Workspace Intents)
  routeWorkspaceIntents: {
    isJournalManuscriptPlanned: boolean;
    isNstcProposalPlanned: boolean;
    isMoeTprProposalPlanned: boolean;
  };

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第八階段消費者契約保證 (Consumer Contract Guarantees)

1. **零斷層路線承接**：第八階段三路線工作室（`route-studio`）直接自快照讀取 `routeWorkspaceIntents`、`selectedDesignName`、`matrixRowRefs` 與 `planningCalculationRefs`，無需使用者重複填寫方法與分析結構。
2. **計算數據可追溯**：分析與樣本數值嚴格綁定 `planningCalculationRefs`，保證第八階段撰寫方法論章節時具備可驗證之數學理據，拒絕 AI 隨機捏造樣本數。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/study-design/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
