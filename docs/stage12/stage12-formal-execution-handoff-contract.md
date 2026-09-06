# V3-U12-FULL 第十二至第十三階段交接契約 (Formal Execution Handoff Contract)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`FormalExecutionSnapshot`)

```typescript
export interface FormalExecutionSnapshot {
  snapshotId: string;                              // e.g. fesnap_proj_stage12_eval_1757152000
  schemaVersion: "formal-execution/1.0.0";        // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "formal-execution";
  nextStageId: "data-governance";                  // 指向第十三階段：資料治理、清理與 Analysis Dataset
  sourcePilotSnapshotId: string;
  sourceInstrumentSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  executionRevision: number;
  decision: string;                                // e.g. FORMAL_DATA_COLLECTION_ACTIVE / FORMAL_DATA_COLLECTION_COMPLETE
  decisionRationale: string;

  // 核心範圍與正式執行授權類型
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    authorizedExecutionType: ExecutionType;
  };

  // 收案統計與進度 (非 AI 虛構)
  targetPlannedN: number;                          // e.g. 151
  enrolledTotalN: number;                          // e.g. 4
  completedTotalN: number;                         // e.g. 3
  withdrawnTotalN: number;                         // e.g. 1

  // 試驗 Session 與原始資料簽章
  totalSessionsCompleted: number;                  // e.g. 3
  totalRawRecordsCaptured: number;                 // e.g. 3
  rawDataManifestChecksumSha256: string;           // 64-char SHA-256 seal
  identityVaultRef: string;                        // vault:// reference only, NEVER PII!

  // 偏差與安全事件摘要
  totalDeviationsCount: number;
  totalSafetyEventsCount: number;
  hasUnresolvedCriticalSafety: boolean;

  // 硬體與 AI 模組追蹤識別
  hardwareAndAIProvenanceRef: string;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十三階段消費者契約保證 (Consumer Contract Guarantees)

1. **原始資料不可變存證**：第十三階段（`data-governance`）讀取本快照時，以 `rawDataManifestChecksumSha256` 驗證原始數據完整性。資料治理與清理流程一律建立衍生資料集，**絕不覆寫 Raw Data 原始記錄**。
2. **身分安全金庫隔離**：快照僅攜帶 `identityVaultRef` 參照，絕不暴露直接識別個資。第十三階段資料清理與建置 Analysis Dataset 嚴格基於去識別化代碼進行。
3. **明確工作邊界**：本快照確認收案完成與原始資料存證，**第十三階段方能啟動缺失值分析、極端值清理與衍生指標計算**。
4. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/formal-execution/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
