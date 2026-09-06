# V3-U11-FULL 第十一至第十二階段交接契約 (Pilot Validation Handoff Contract)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`PilotValidationSnapshot`)

```typescript
export interface PilotValidationSnapshot {
  snapshotId: string;                              // e.g. pvsnap_proj_stage11_eval_1757150000
  schemaVersion: "pilot-validation/1.0.0";        // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "pilot-validation";
  nextStageId: "formal-execution";                 // 指向第十二階段：正式研究執行與資料蒐集
  sourceInstrumentSnapshotId: string;
  sourceStage09SnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  pilotRevision: number;
  decision: string;                                // e.g. PILOT_VALIDATION_COMPLETE
  decisionRationale: string;

  // 核心範圍與預試清單統計
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    pilotRunsCount: number;
  };

  // 關聯與參照識別
  testedInstrumentVersionRefs: string[];
  testedProtocolVersionRefs: string[];
  technicalPilotRefs: string[];
  revisionProposalRefs: string[];

  // 預試診斷結論與正式研究放行狀態
  isProtocolFeasibleConfirmed: boolean;
  raterKappaAchieved: number;                      // e.g. 0.861
  averageInferenceLatencyMs: number;               // e.g. 38.5
  formalExecutionReadinessStatus: string;          // e.g. CONDITIONALLY_READY

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十二階段消費者契約保證 (Consumer Contract Guarantees)

1. **嚴格資料分層隔離**：第十二階段（`formal-execution`）讀取本快照時，保證 Pilot 診斷資料與合成測試資料完全隔離於正式研究 Dataset 之外，絕不污染正式受試者分析庫。
2. **正式執行放行把關**：正式執行前強制核驗 `formalExecutionReadinessStatus`。若為 `CONDITIONALLY_READY`，必須於實體收案前補齊正式 REC/IRB 核准函文號與場地公文，防止未獲授權開展人體試驗。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/pilot-validation/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
