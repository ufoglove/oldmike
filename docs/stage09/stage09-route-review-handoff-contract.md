# V3-U09-FULL 第九至第十階段交接契約 (Route Review Handoff Contract)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`Stage09HandoffSnapshot`)

```typescript
export interface Stage09HandoffSnapshot {
  snapshotId: string;                              // e.g. s9snap_proj_stage9_eval_1757146000
  schemaVersion: "stage09-handoff/1.0.0";         // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "ethics-review";
  nextStageId: "study-protocol";                   // 指向第十階段：研究工具、量表與 Study Protocol
  sourceRouteSnapshotId: string;
  sourceDesignSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  reviewRevision: number;
  decision: string;                                // e.g. PLANNING_REVIEW_COMPLETE
  decisionRationale: string;

  // 核心範圍與選定路線
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    primaryRoute: string;
  };

  // 審查與合規統計指標
  totalFindingsCount: number;
  unresolvedFatalCount: number;
  complianceMetRate: number;                       // e.g. 0.85 (85%)

  // 倫理審查結論與風險旗標
  ethicsScopeResult: EthicsScopeResult;
  institutionalDecisionStatus: string;
  isTeacherStudentPowerRiskIdentified: boolean;

  // 第十階段工具與 Protocol 需求摘要 (Handed off to Stage 10)
  instrumentRequirementsSummary: string[];
  protocolNeedsSummary: string[];

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十階段消費者契約保證 (Consumer Contract Guarantees)

1. **研究工具與規準需求對齊**：第十階段（`study-protocol`）直接承接 `instrumentRequirementsSummary`，重點發展客觀眼動毫秒級日誌紀錄協議與危害處置表現評量規準（Rubrics），無需重複構思測量工具。
2. **倫理監控納入 Protocol**：將本階段識別之穿戴式 VR 動暈物理風險與師生權力關係防護（知情同意獨立收集、學期成績封存）直接轉化為第十階段 Study Protocol SOP 具體章節。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/route-review/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
