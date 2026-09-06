# V3-U06-FULL 第六至第七階段交接契約 (Theory Mechanism Handoff Contract)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`TheoryMechanismSnapshot`)

```typescript
export interface TheoryMechanismSnapshot {
  snapshotId: string;                              // e.g. tms_proj_stage6_eval_1757140000
  schemaVersion: "theory-mechanism/1.0.0";        // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "theory-mechanism";
  nextStageId: "study-design";                     // 指向第七階段：研究設計與分析計畫
  sourceGapSnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  modelRevision: number;
  modelingApproach: string;                        // e.g. THEORY_TESTING, TEACHING_LOGIC_MODEL
  decision: string;                                // e.g. ADOPT_MODEL
  decisionRationale: string;

  // 核心範圍
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    targetPhenomenon: string;
  };

  // 關聯與參照
  rqRefs: string[];
  theoryCandidateRefs: string[];
  constructRefs: string[];
  relationRefs: string[];
  statementRefs: string[];
  alternativeExplanationRefs: string[];
  boundaryConditionRefs: string[];
  designRequirementRefs: string[];

  // 晚期需求
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // 研究設計提示（交由 Stage 7 承接）
  measurementDirections: Array<{ constructId: string; observationDirection: string }>;
  comparisonNeeds: string[];
  temporalNeeds: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第七階段消費者契約保證 (Consumer Contract Guarantees)

1. **零重複輸入**：第七階段直接自快照讀取 `scope.workingTitleZh`, `rqRefs`, `constructRefs`, `statementRefs`，無需重新建構模型。
2. **設計需求直接映射**：第七階段直接承接 `measurementDirections`（觀察方向）、`comparisonNeeds`（對照組需求）與 `temporalNeeds`（時點需求）展開取樣與統計規劃。
3. **安全冪等**：重複呼叫 `POST /api/projects/:id/theory-mechanism/complete` 回傳既有 snapshot ID，不重複扣費或產生分歧快照。
