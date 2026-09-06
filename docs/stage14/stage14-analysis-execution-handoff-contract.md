# V3-U14-FULL 第十四至第十五階段交接契約 (Analysis Execution Handoff Contract)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`AnalysisResultsSnapshot`)

```typescript
export interface AnalysisResultsSnapshot {
  snapshotId: string;                              // e.g. arsnap_proj_stage14_eval_1757156000
  schemaVersion: "analysis-results/1.0.0";        // 版本固定
  stageKey: "V3-U14";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "analysis-execution";
  nextStageId: "results-writing";                  // 指向第十五階段：研究結果整合與證據驅動全文寫作
  sourceDataGovernanceSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  resultsRevision: number;
  decision: string;                                // e.g. ANALYSIS_RESULTS_VALIDATED_AND_RELEASED
  decisionRationale: string;

  // 核心範圍與分析執行模式
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    executionMode: AnalysisExecutionMode;
  };

  // 唯一受控資料集來源參照與 Checksum
  sourceDatasetVersion: string;                    // e.g. v1.0-formal-analysis-ready
  sourceDatasetContentHashSha256: string;        // 64-char SHA-256 seal

  // 不可變結果事實清單與統計
  resultRecordRefs: string[];
  immutableResultFactManifestRef: string[];
  totalResultFactsCount: number;                   // e.g. 3

  // 出版級表圖清單
  tableRefs: string[];
  figureRefs: string[];

  // 科學誠信與多重校正驗證
  isMultiplicityCorrected: boolean;
  hasNonSignificantOutcomesReportedHonesty: boolean;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十五階段消費者契約保證 (Consumer Contract Guarantees)

1. **唯一結果數據事實來源**：第十五階段（`results-writing`）撰寫全文 Results 章節時，正文所有統計數字（如差值、效應量、p 值）**必須直接引用本快照之不可變 ResultFact 標籤**，嚴禁在寫作對話中讓模型隨機捏造數值。
2. **出版圖表直接嵌入**：Table 1 與 Figure 1 均由受控渲染引擎從真實數據生成，第十五階段寫作工作室直接引用已發布之向量 SVG 或結構化表格，**嚴禁調用文生圖模型重畫假圖表**。
3. **明確工作邊界**：本快照確認統計推論運算完成與結果事實存證，**第十五階段方能展開證據驅動之全文章節起草（Introduction/Methods/Results/Discussion）**。
4. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/analysis-execution/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
