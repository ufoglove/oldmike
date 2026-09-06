# V3-U10-FULL 第十至第十一階段交接契約 (Instrument & Protocol Handoff Contract)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`InstrumentProtocolSnapshot`)

```typescript
export interface InstrumentProtocolSnapshot {
  snapshotId: string;                              // e.g. ipsnap_proj_stage10_eval_1757148000
  schemaVersion: "instrument-protocol/1.0.0";    // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "study-protocol";
  nextStageId: "pilot-validation";                 // 指向第十一階段：Pilot／工具預試與 Protocol 驗證
  sourceStage09SnapshotId: string;
  sourceRouteSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  protocolRevision: number;
  decision: string;                                // e.g. INSTRUMENT_PROTOCOL_PLANNING_COMPLETE
  decisionRationale: string;

  // 核心範圍與工具清單統計
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    primaryInstrumentCount: number;
  };

  // 關聯與參照識別
  rqRefs: string[];
  instrumentDefinitionRefs: string[];
  instrumentVersionRefs: string[];
  scoringSpecRefs: string[];
  dataCaptureFieldRefs: string[];

  // 第十一階段 Pilot 預試與驗證需求 (Handed off to Stage 11)
  pilotValidationNeeds: string[];
  pilotApplicabilityHints: string[];

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十一階段消費者契約保證 (Consumer Contract Guarantees)

1. **預試需求精確交接**：第十一階段（`pilot-validation`）直接自快照讀取 `pilotValidationNeeds`，展開：
   - 毫秒級眼動日誌通訊延遲壓力測試 ($< 50\text{ms}$)。
   - NASA-TLX 中文短版量表目標對象認知訪談 (5-8 人)。
   - 高空危害處置 Rubric 評分者間信度 (Cohen's Kappa) 預試評定。
2. **合成測試資料嚴格隔離**：沙盒計分測試標記 `SYNTHETIC_INSTRUMENT_TEST`，保證第十一階段執行工具預試時資料庫不受假測試樣本污染。
3. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/instrument-protocol/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
