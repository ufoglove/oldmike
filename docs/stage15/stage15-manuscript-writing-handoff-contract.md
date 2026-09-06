# V3-U15-FULL 第十五至第十六階段交接契約 (Manuscript Writing Handoff Contract)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`ManuscriptWritingSnapshot`)

```typescript
export interface ManuscriptWritingSnapshot {
  snapshotId: string;                              // e.g. mwsnap_proj_stage15_eval_1757158000
  schemaVersion: "manuscript-writing/1.0.0";    // 版本固定
  stageKey: "V3-U15";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "results-writing";
  nextStageId: "scientific-review";               // 指向第十六階段：老麥科學內容審查、Reviewer #2與逐項修訂
  sourceAnalysisSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  manuscriptRevision: number;
  decision: string;                                // e.g. MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW
  decisionRationale: string;

  // 核心範圍與稿件內容統計
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    writingMode: ManuscriptWritingMode;
    totalWordCount: number;                        // e.g. 5205
  };

  // 全文章節與事實引用清單
  sectionRefs: string[];
  boundResultFactIds: string[];                  // Immutable ResultFact references
  boundCitationSourceRefs: string[];            // CitationSource references
  embeddedTableRefs: string[];                   // e.g. ["tab_01_t1_results"]
  embeddedFigureRefs: string[];                  // e.g. ["fig_01_reaction_time_interaction"]

  // 寫作誠信與 QA 驗證
  isNumericDataVerifiablyBound: boolean;
  hasDiscussionGhostDataAvoided: boolean;
  hasNonSignificantOutcomesIncludedHonesty: boolean;

  // 晚期待辦（不形成循環 Gate）
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第十六階段消費者契約保證 (Consumer Contract Guarantees)

1. **唯一結果事實來源**：第十六階段（`scientific-review`）進行獨立模擬同行評審時，針對 Results 章節所有數值（差值 -913.1ms、Cohen's d、ANCOVA Beta1）必須直接引用本快照之不可變 ResultFact 標籤，**嚴禁審查過程中讓模型隨機修改或重算數值**。
2. **科學內容誠信核對**：將 Methods 實施現況（RCT 隨機、知情同意 REC-115-089、防動暈中斷流程）與 Results 因果邊界提示納入第十六階段 Reviewer #2 科學嚴謹度審查範圍。
3. **明確工作邊界**：本快照確認證據驅動科學初稿完成，**第十六階段方能展開逐項修訂與獨立科學審查**。
4. **安全冪等與狀態一致**：重複呼叫 `POST /api/projects/:id/manuscript-writing/complete` 回傳既有快照 ID，不重複扣費；若前端跳轉中斷，可自同一基線安全重開。
