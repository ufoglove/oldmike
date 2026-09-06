# V3-U13-FULL 第十三至第十四階段交接契約 (Data Governance Handoff Contract)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`DataGovernanceSnapshot`)

```typescript
export interface DataGovernanceSnapshot {
  snapshotId: string;                              // e.g. dgsnap_proj_stage13_eval_1757154000
  schemaVersion: "data-governance/1.0.0";        // 版本固定
  stageKey: "V3-U13";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "data-governance";
  nextStageId: "analysis-execution";               // 指向第十四階段：分析實驗室 Execution Mode、研究結果與圖表
  sourceFormalExecutionSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  governanceRevision: number;
  decision: string;                                // e.g. ANALYSIS_DATASET_LOCKED_AND_HANDOFF_READY
  decisionRationale: string;

  // 核心範圍與運作模式
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    operationalMode: GovernanceOperationalMode;
  };

  // 來源凍結與分析資料集 Checksum
  sourceScopeManifestHash: string;
  analysisDatasetVersion: string;                  // e.g. v1.0-formal-analysis-ready
  analysisDatasetContentHashSha256: string;        // 64-char SHA-256 seal
  totalUnitsCount: number;                         // e.g. 3
  totalAnalysisRecordsCount: number;               // e.g. 3

  // 品質診斷彙整 (DATA_PREPARATION_DIAGNOSTIC)
  dataQualitySummary: DataQualitySummary;

  // 分析範圍與延後統計處理義務 (Handed off to Stage 14)
  analysisScopeRefs: string[];
  deferredStatisticalProcessing: Array<{
    targetVariableId: string;
    plannedObligation: string;                     // e.g. LINEAR_MIXED_EFFECTS_MODEL_ANCOVA_EXECUTION
    dueStage: "STAGE_14";
  }>;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十四階段消費者契約保證 (Consumer Contract Guarantees)

1. **唯一受控資料源**：第十四階段（`analysis-execution`）讀取本快照時，嚴格以 `analysisDatasetContentHashSha256` 驗證資料集完整性，**絕不自動讀取未經治理之原始 Raw Data 或最新暫存檔**。
2. **延後處理義務明確交接**：資料治理階段未執行之複雜統計模型（如多重補值、線性混合效應模型估計），記錄於 `deferredStatisticalProcessing`，由第十四階段按已採用之 AnalysisPlan 嚴謹實施。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/data-governance/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
