# V3-U04-FULL 第四至第五階段交接契約 (Blueprint Handoff Contract)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`BlueprintPlanningSnapshot`)

```typescript
export interface BlueprintPlanningSnapshot {
  snapshotId: string;                              // e.g. bps_proj_full_48_1757134000
  schemaVersion: "blueprint-planning/1.0.0";       // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "blueprint";
  nextStageId: "gap-novelty";                      // 指向第五階段：文獻深化與Gap／新穎性驗證
  sourceNavigationSnapshotId: string;
  sourceTopicSelectionSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  blueprintId: string;
  blueprintRevision: number;
  planningBaselineRef: string;
  planningStatus: "BASELINED" | "BASELINED_PROVISIONAL";
  researchStage: string;
  temporalStatus: "PROPOSED_BEFORE_STUDY";

  // 核心規劃摘要
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    problemSummary: string;
    overallPurpose: string;
  };
  objectiveRefs: string[];                         // ["OBJ-01", "OBJ-02"]
  rqRefs: string[];                                // ["RQ-01", "RQ-02"]
  methodAndDataPlanRefs: string[];
  workPackageRefs: string[];                       // ["WP-01", "WP-02", "WP-03"]
  milestoneRefs: string[];
  resourceAssumptionsCount: number;

  // 文獻中心對接
  literatureIds: string[];
  evidenceIds: string[];
  citationSourceIds: string[];
  zoteroBindings: any[];
  evidenceNeedRefs: string[];                      // 產出的定向需求列表，直接由 Stage 5 承接！
  searchTaskRefs: string[];

  // 規則與晚期需求
  ruleSnapshotRefs: string[];
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // 鎖定與核准
  lockManifest: any[];
  sourceManifest: any[];
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  decisionOrigin: "USER_MANUAL_ADOPTION" | "AUTO_PLANNING_BASELINE";
  readinessSnapshotRef: string;
  completionBasis: "PLANNING_BASELINE_COMMITTED" | "PROVISIONAL_PLANNING_BASELINE";
  limitations: string[];
  createdAt: string;
  checksum: string;
}
```

## 二、第五階段消費者契約測試保證 (Consumer Contract Guarantees)

1. **零重複輸入**：第五階段直接自快照讀取 `scope.workingTitleZh`, `objectiveRefs`, `rqRefs`，不要求使用者重新輸入研究題目與 RQ。
2. **定向需求處理**：第五階段文獻中心讀取 `evidenceNeedRefs` 陣列，針對所列之 `needId`（如 `EN-01`）執行定向搜尋與反證驗證。
3. **安全冪等**：重複呼叫 `POST /api/projects/:id/blueprint/complete` 回傳既有 snapshot ID，不重複扣費或產生分歧快照。
